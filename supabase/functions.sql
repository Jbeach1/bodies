-- Bodies — Postgres RPCs (PRD §5/§7). Apply after schema.sql. Safe to re-run.
-- All mutations live here as SECURITY DEFINER functions so transitions are
-- atomic and server-authoritative even though client RLS is permissive.

-- Connectivity round-trip used by the app's pingSupabase() (scaffold).
create or replace function public.now_utc()
returns timestamptz language sql stable
security definer set search_path = public as $$
  select now();
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Room codes: 4 chars from an unambiguous alphabet (no 0/O/1/I) so they're easy
-- to read aloud in a dim room.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.gen_room_code()
returns text language plpgsql
security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
  i int;
begin
  loop
    code := '';
    for i in 1..4 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.games where room_code = code);
  end loop;
  return code;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- create_game: host creates a room, becomes player #1, binds their device.
-- Returns { game_id, room_code, player_id }.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.create_game(host_name text, device_uuid text)
returns table (game_id uuid, room_code text, player_id uuid)
language plpgsql
security definer set search_path = public as $$
declare
  v_game_id uuid;
  v_code text;
  v_player_id uuid;
begin
  if coalesce(trim(host_name), '') = '' then
    raise exception 'host_name is required';
  end if;

  v_code := public.gen_room_code();

  insert into public.games (room_code, phase)
  values (v_code, 'lobby')
  returning id into v_game_id;

  insert into public.players (game_id, name, join_order, is_host)
  values (v_game_id, trim(host_name), 1, true)
  returning id into v_player_id;

  update public.games set host_player_id = v_player_id where id = v_game_id;

  insert into public.device_sessions (player_id, device_uuid)
  values (v_player_id, device_uuid);

  return query select v_game_id, v_code, v_player_id;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- join_game: join by room code + name. Idempotent per device — if this device
-- already has a player in the room it rebinds/heartbeats instead of creating a
-- duplicate "Steve (2)" (reconnect path, PRD §7 / issue 02).
-- Returns { game_id, player_id, phase, reconnected }.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.join_game(
  p_room_code text,
  player_name text,
  device_uuid text
)
returns table (game_id uuid, player_id uuid, phase text, reconnected boolean)
language plpgsql
security definer set search_path = public as $$
declare
  v_game_id uuid;
  v_phase text;
  v_player_id uuid;
  v_next_order int;
begin
  select id, phase into v_game_id, v_phase
  from public.games
  where room_code = upper(trim(p_room_code));

  if v_game_id is null then
    raise exception 'no game with room code %', p_room_code
      using errcode = 'no_data_found';
  end if;

  -- Reconnect: this device already bound to a player in this game?
  select p.id into v_player_id
  from public.device_sessions ds
  join public.players p on p.id = ds.player_id
  where ds.device_uuid = join_game.device_uuid and p.game_id = v_game_id
  limit 1;

  if v_player_id is not null then
    update public.device_sessions set last_seen = now()
    where player_id = v_player_id and device_uuid = join_game.device_uuid;
    return query select v_game_id, v_player_id, v_phase, true;
    return;
  end if;

  if coalesce(trim(player_name), '') = '' then
    raise exception 'player_name is required';
  end if;

  -- New roster entry. Joining is only open in the lobby.
  if v_phase <> 'lobby' then
    raise exception 'game already started' using errcode = 'check_violation';
  end if;

  select coalesce(max(join_order), 0) + 1 into v_next_order
  from public.players where game_id = v_game_id;

  insert into public.players (game_id, name, join_order)
  values (v_game_id, trim(player_name), v_next_order)
  returning id into v_player_id;

  insert into public.device_sessions (player_id, device_uuid)
  values (v_player_id, join_game.device_uuid);

  return query select v_game_id, v_player_id, v_phase, false;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- heartbeat: refresh a device's last_seen (touches game.updated_at via the
-- player trigger indirectly is unnecessary; we update last_seen only).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.heartbeat(p_player_id uuid, device_uuid text)
returns void language plpgsql
security definer set search_path = public as $$
begin
  update public.device_sessions set last_seen = now()
  where player_id = p_player_id and device_sessions.device_uuid = heartbeat.device_uuid;
end $$;

grant execute on function
  public.now_utc(),
  public.gen_room_code(),
  public.create_game(text, text),
  public.join_game(text, text, text),
  public.heartbeat(uuid, text)
to anon, authenticated;
