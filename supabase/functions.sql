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

-- ─────────────────────────────────────────────────────────────────────────────
-- update_settings: host persists killerCount + blacklist to games.settings.
-- Lobby-only (settings are locked once role assignment starts).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.update_settings(
  p_game_id uuid,
  p_killer_count int,
  p_blacklist uuid[]
)
returns void language plpgsql
security definer set search_path = public as $$
declare
  v_phase text;
begin
  select phase into v_phase from public.games where id = p_game_id;
  if v_phase is null then
    raise exception 'game not found';
  end if;
  if v_phase <> 'lobby' then
    raise exception 'settings can only change in the lobby' using errcode = 'check_violation';
  end if;
  if p_killer_count < 1 then
    raise exception 'killerCount must be at least 1' using errcode = 'check_violation';
  end if;

  update public.games
  set settings = jsonb_build_object(
    'killerCount', p_killer_count,
    'blacklistedFromKiller', coalesce(to_jsonb(p_blacklist), '[]'::jsonb)
  )
  where id = p_game_id;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- assign_roles: host Start (PRD §5.1). Re-validates server-side (never trust the
-- client check alone), picks killerCount killers at random from the
-- non-blacklisted pool, everyone else town, then advances lobby → role_reveal.
-- `for update` on the games row serializes a double-tap into one assignment.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.assign_roles(p_game_id uuid)
returns void language plpgsql
security definer set search_path = public as $$
declare
  v_phase text;
  v_settings jsonb;
  v_killer_count int;
  v_blacklist uuid[];
  v_player_count int;
  v_pool_count int;
begin
  select phase, settings into v_phase, v_settings
  from public.games where id = p_game_id
  for update;

  if v_phase is null then
    raise exception 'game not found';
  end if;
  if v_phase <> 'lobby' then
    raise exception 'game already started' using errcode = 'check_violation';
  end if;

  v_killer_count := greatest(coalesce((v_settings->>'killerCount')::int, 1), 1);
  select coalesce(array_agg(elem::uuid), '{}')
    into v_blacklist
    from jsonb_array_elements_text(coalesce(v_settings->'blacklistedFromKiller', '[]'::jsonb)) elem;

  select count(*) into v_player_count from public.players where game_id = p_game_id;
  select count(*) into v_pool_count
    from public.players
    where game_id = p_game_id and not (id = any(v_blacklist));

  if v_player_count < 4 then
    raise exception 'need at least 4 players' using errcode = 'check_violation';
  end if;
  if v_killer_count >= (v_player_count - v_killer_count) then
    raise exception 'killerCount must stay below parity' using errcode = 'check_violation';
  end if;
  if v_pool_count < v_killer_count then
    raise exception 'blacklist leaves too few eligible players' using errcode = 'check_violation';
  end if;

  update public.players set role = 'town', role_confirmed = false where game_id = p_game_id;

  update public.players set role = 'killer'
  where id in (
    select id from public.players
    where game_id = p_game_id and not (id = any(v_blacklist))
    order by random()
    limit v_killer_count
  );

  update public.games set phase = 'role_reveal' where id = p_game_id;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- confirm_role: player acks CONFIRM IDENTITY after peeking their card.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.confirm_role(p_player_id uuid)
returns void language plpgsql
security definer set search_path = public as $$
begin
  update public.players set role_confirmed = true where id = p_player_id;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- begin_playing: host BEGIN, role_reveal → playing. Host may force before
-- everyone has confirmed (PRD §8.5).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.begin_playing(p_game_id uuid)
returns void language plpgsql
security definer set search_path = public as $$
declare
  v_phase text;
begin
  select phase into v_phase from public.games where id = p_game_id;
  if v_phase is null then
    raise exception 'game not found';
  end if;
  if v_phase <> 'role_reveal' then
    raise exception 'not in role reveal' using errcode = 'check_violation';
  end if;
  update public.games set phase = 'playing' where id = p_game_id;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- report_body: host marks 1+ victims dead (PRD §4/§5.4). Resets discussion
-- immunity for everyone, runs the win-check, and lands on discussion or
-- game_over. `for update` on the games row serializes concurrent reports.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.report_body(p_game_id uuid, p_victim_ids uuid[])
returns table (phase text, winner text)
language plpgsql
security definer set search_path = public as $$
declare
  v_phase text;
  v_valid_count int;
  v_living_killers int;
  v_living_town int;
  v_next_phase text;
  v_winner text;
begin
  select phase into v_phase from public.games where id = p_game_id for update;

  if v_phase is null then
    raise exception 'game not found';
  end if;
  if v_phase <> 'playing' then
    raise exception 'body can only be reported during play' using errcode = 'check_violation';
  end if;
  if p_victim_ids is null or array_length(p_victim_ids, 1) is null then
    raise exception 'at least one victim is required' using errcode = 'check_violation';
  end if;

  select count(*) into v_valid_count
  from public.players
  where game_id = p_game_id and is_alive and id = any(p_victim_ids);

  if v_valid_count <> cardinality(p_victim_ids) then
    raise exception 'victims must be living players in this game' using errcode = 'check_violation';
  end if;

  update public.players
  set is_alive = false
  where game_id = p_game_id and id = any(p_victim_ids);

  update public.players
  set spared_this_discussion = false
  where game_id = p_game_id;

  select count(*) filter (where role = 'killer'), count(*) filter (where role <> 'killer')
    into v_living_killers, v_living_town
  from public.players
  where game_id = p_game_id and is_alive;

  if v_living_killers = 0 then
    v_next_phase := 'game_over';
    v_winner := 'town';
  elsif v_living_killers >= v_living_town then
    v_next_phase := 'game_over';
    v_winner := 'killers';
  else
    v_next_phase := 'discussion';
    v_winner := null;
  end if;

  update public.games set phase = v_next_phase, winner = v_winner where id = p_game_id;

  return query select v_next_phase, v_winner;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- log_accusation: any living player accuses a living, non-immune, non-self
-- target (PRD §5.2). Multiple pending accusations coexist.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.log_accusation(
  p_game_id uuid,
  p_accuser_id uuid,
  p_accused_id uuid
)
returns uuid language plpgsql
security definer set search_path = public as $$
declare
  v_phase text;
  v_accuser_alive boolean;
  v_accused_alive boolean;
  v_accused_immune boolean;
  v_id uuid;
begin
  select phase into v_phase from public.games where id = p_game_id;
  if v_phase is distinct from 'discussion' then
    raise exception 'accusations are only open during discussion' using errcode = 'check_violation';
  end if;
  if p_accuser_id = p_accused_id then
    raise exception 'cannot accuse yourself' using errcode = 'check_violation';
  end if;

  select is_alive into v_accuser_alive
    from public.players where id = p_accuser_id and game_id = p_game_id;
  select is_alive, spared_this_discussion into v_accused_alive, v_accused_immune
    from public.players where id = p_accused_id and game_id = p_game_id;

  if v_accuser_alive is not true then
    raise exception 'only living players may accuse' using errcode = 'check_violation';
  end if;
  if v_accused_alive is not true then
    raise exception 'target must be living' using errcode = 'check_violation';
  end if;
  if v_accused_immune then
    raise exception 'target is immune this discussion' using errcode = 'check_violation';
  end if;

  insert into public.accusations (game_id, accuser_id, accused_id)
  values (p_game_id, p_accuser_id, p_accused_id)
  returning id into v_id;

  return v_id;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- corroborate_accusation: first second promotes the accusation to the floor
-- (opens a vote, discussion → voting) and clears every other pending
-- accusation in the game. `for update` makes the "first" race-safe.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.corroborate_accusation(
  p_accusation_id uuid,
  p_seconder_id uuid
)
returns void language plpgsql
security definer set search_path = public as $$
declare
  v_game_id uuid;
  v_accuser_id uuid;
  v_accused_id uuid;
  v_status text;
  v_seconder_alive boolean;
  v_vote_id uuid;
begin
  select game_id, accuser_id, accused_id, status
    into v_game_id, v_accuser_id, v_accused_id, v_status
  from public.accusations where id = p_accusation_id
  for update;

  if v_game_id is null then
    raise exception 'accusation not found';
  end if;
  if v_status <> 'pending' then
    raise exception 'accusation is no longer pending' using errcode = 'check_violation';
  end if;
  if p_seconder_id = v_accuser_id or p_seconder_id = v_accused_id then
    raise exception 'seconder must be a different living player' using errcode = 'check_violation';
  end if;

  select is_alive into v_seconder_alive
    from public.players where id = p_seconder_id and game_id = v_game_id;
  if v_seconder_alive is not true then
    raise exception 'only living players may corroborate' using errcode = 'check_violation';
  end if;

  update public.accusations set status = 'on_floor', seconder_id = p_seconder_id
  where id = p_accusation_id;

  update public.accusations set status = 'cleared'
  where game_id = v_game_id and status = 'pending' and id <> p_accusation_id;

  insert into public.votes (game_id, accusation_id, accused_id)
  values (v_game_id, p_accusation_id, v_accused_id)
  returning id into v_vote_id;

  update public.games set phase = 'voting', current_vote_id = v_vote_id where id = v_game_id;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- withdraw_accusation / dismiss_accusation: clear an unseconded accusation
-- (accuser's own choice, or the host's).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.withdraw_accusation(p_accusation_id uuid, p_accuser_id uuid)
returns void language plpgsql
security definer set search_path = public as $$
begin
  update public.accusations
  set status = 'withdrawn'
  where id = p_accusation_id and accuser_id = p_accuser_id and status = 'pending';

  if not found then
    raise exception 'accusation cannot be withdrawn' using errcode = 'check_violation';
  end if;
end $$;

create or replace function public.dismiss_accusation(p_accusation_id uuid)
returns void language plpgsql
security definer set search_path = public as $$
begin
  update public.accusations
  set status = 'cleared'
  where id = p_accusation_id and status = 'pending';

  if not found then
    raise exception 'accusation cannot be dismissed' using errcode = 'check_violation';
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- resolve_vote_core: shared resolution logic (PRD §5.3). p_force=false is the
-- auto-resolve path after each ballot (only resolves once mathematically
-- locked); p_force=true is host Resolve Now (missing ballots count as
-- acquit). Not granted to anon directly — only called from cast_ballot /
-- resolve_vote, which run as the function owner.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.resolve_vote_core(p_vote_id uuid, p_force boolean)
returns table (resolved boolean, outcome text, phase text, winner text)
language plpgsql
security definer set search_path = public as $$
declare
  v_game_id uuid;
  v_accused_id uuid;
  v_status text;
  v_eligible int;
  v_convict int;
  v_acquit int;
  v_remaining int;
  v_outcome text;
  v_next_phase text;
  v_winner text;
  v_living_killers int;
  v_living_town int;
begin
  select game_id, accused_id, status into v_game_id, v_accused_id, v_status
  from public.votes where id = p_vote_id for update;

  if v_game_id is null then
    raise exception 'vote not found';
  end if;
  if v_status <> 'open' then
    return query select false, null::text, null::text, null::text;
    return;
  end if;

  select count(*) into v_eligible
  from public.players
  where game_id = v_game_id and is_alive and id <> v_accused_id;

  select count(*) filter (where choice = 'convict'),
         count(*) filter (where choice = 'acquit')
    into v_convict, v_acquit
  from public.ballots where vote_id = p_vote_id;

  v_remaining := v_eligible - v_convict - v_acquit;

  if p_force then
    v_outcome := case when v_convict > v_eligible / 2.0 then 'convict' else 'acquit' end;
  else
    if v_convict > v_eligible / 2.0 then
      v_outcome := 'convict';
    elsif (v_convict + v_remaining) <= v_eligible / 2.0 then
      v_outcome := 'acquit';
    else
      return query select false, null::text, null::text, null::text;
      return;
    end if;
  end if;

  update public.votes
  set status = 'resolved', outcome = v_outcome, resolved_at = now()
  where id = p_vote_id;

  update public.accusations
  set status = 'resolved'
  where id = (select accusation_id from public.votes where id = p_vote_id);

  if v_outcome = 'convict' then
    update public.players set is_alive = false where id = v_accused_id;

    select count(*) filter (where role = 'killer'), count(*) filter (where role <> 'killer')
      into v_living_killers, v_living_town
    from public.players
    where game_id = v_game_id and is_alive;

    if v_living_killers = 0 then
      v_next_phase := 'game_over';
      v_winner := 'town';
    elsif v_living_killers >= v_living_town then
      v_next_phase := 'game_over';
      v_winner := 'killers';
    else
      v_next_phase := 'playing';
      v_winner := null;
    end if;

    update public.players set spared_this_discussion = false where game_id = v_game_id;
    update public.games
      set phase = v_next_phase, winner = v_winner, current_vote_id = null
      where id = v_game_id;
  else
    update public.players set spared_this_discussion = true where id = v_accused_id;
    v_next_phase := 'discussion';
    v_winner := null;
    update public.games
      set phase = 'discussion', current_vote_id = null
      where id = v_game_id;
  end if;

  return query select true, v_outcome, v_next_phase, v_winner;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- cast_ballot: eligible voter casts/changes Convict or Acquit; triggers
-- auto-resolve once the outcome is mathematically locked.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.cast_ballot(p_vote_id uuid, p_voter_id uuid, p_choice text)
returns void language plpgsql
security definer set search_path = public as $$
declare
  v_game_id uuid;
  v_accused_id uuid;
  v_status text;
  v_voter_alive boolean;
begin
  if p_choice not in ('convict', 'acquit') then
    raise exception 'invalid choice' using errcode = 'check_violation';
  end if;

  select game_id, accused_id, status into v_game_id, v_accused_id, v_status
  from public.votes where id = p_vote_id;

  if v_game_id is null then
    raise exception 'vote not found';
  end if;
  if v_status <> 'open' then
    raise exception 'vote already resolved' using errcode = 'check_violation';
  end if;
  if p_voter_id = v_accused_id then
    raise exception 'the accused cannot vote' using errcode = 'check_violation';
  end if;

  select is_alive into v_voter_alive
    from public.players where id = p_voter_id and game_id = v_game_id;
  if v_voter_alive is not true then
    raise exception 'only living players may vote' using errcode = 'check_violation';
  end if;

  insert into public.ballots (vote_id, voter_id, choice)
  values (p_vote_id, p_voter_id, p_choice)
  on conflict (vote_id, voter_id) do update set choice = excluded.choice;

  perform public.resolve_vote_core(p_vote_id, false);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- resolve_vote: host Resolve Now — missing ballots count as acquit.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.resolve_vote(p_vote_id uuid)
returns void language plpgsql
security definer set search_path = public as $$
begin
  perform public.resolve_vote_core(p_vote_id, true);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- resume_play: host safety valve / normal loop exit, discussion → playing.
-- Clears discussion immunity (PRD: immune "for rest of this discussion").
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.resume_play(p_game_id uuid)
returns void language plpgsql
security definer set search_path = public as $$
declare
  v_phase text;
begin
  select phase into v_phase from public.games where id = p_game_id;
  if v_phase is distinct from 'discussion' then
    raise exception 'can only resume from discussion' using errcode = 'check_violation';
  end if;

  update public.players set spared_this_discussion = false where game_id = p_game_id;
  update public.games set phase = 'playing' where id = p_game_id;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- play_again: host NEW CASE, game_over → lobby (PRD §8.10). Resets roles,
-- alive status, and discussion immunity; clears trial state; keeps the room
-- code and device_sessions so the same group replays without re-scanning.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.play_again(p_game_id uuid)
returns void language plpgsql
security definer set search_path = public as $$
declare
  v_phase text;
begin
  select phase into v_phase from public.games where id = p_game_id for update;

  if v_phase is null then
    raise exception 'game not found';
  end if;
  if v_phase <> 'game_over' then
    raise exception 'can only play again after game over' using errcode = 'check_violation';
  end if;

  delete from public.ballots
  where vote_id in (select id from public.votes where game_id = p_game_id);
  delete from public.votes where game_id = p_game_id;
  delete from public.accusations where game_id = p_game_id;

  update public.players
  set role = null, role_confirmed = false, is_alive = true, spared_this_discussion = false
  where game_id = p_game_id;

  update public.games
  set phase = 'lobby', winner = null, current_vote_id = null
  where id = p_game_id;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- toggle_alive: host correction toolkit (PRD §5.5). Flips a player's alive
-- status and re-runs the win-check once roles are in play. Available
-- regardless of the host's own alive status (no host check here — the client
-- only shows the panel to the host player, same trust model as every other
-- RPC in this schema).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.toggle_alive(p_game_id uuid, p_player_id uuid)
returns void language plpgsql
security definer set search_path = public as $$
declare
  v_phase text;
  v_living_killers int;
  v_living_town int;
begin
  select phase into v_phase from public.games where id = p_game_id for update;
  if v_phase is null then
    raise exception 'game not found';
  end if;

  update public.players set is_alive = not is_alive
  where id = p_player_id and game_id = p_game_id;

  if v_phase not in ('lobby', 'role_reveal') then
    select count(*) filter (where role = 'killer'), count(*) filter (where role <> 'killer')
      into v_living_killers, v_living_town
    from public.players
    where game_id = p_game_id and is_alive;

    if v_living_killers = 0 then
      update public.games set phase = 'game_over', winner = 'town' where id = p_game_id;
    elsif v_living_killers >= v_living_town then
      update public.games set phase = 'game_over', winner = 'killers' where id = p_game_id;
    end if;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- cancel_vote: host correction toolkit. Discards the current vote + its
-- ballots and returns to discussion.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.cancel_vote(p_game_id uuid)
returns void language plpgsql
security definer set search_path = public as $$
declare
  v_vote_id uuid;
begin
  select current_vote_id into v_vote_id from public.games where id = p_game_id for update;
  if v_vote_id is null then
    raise exception 'no active vote' using errcode = 'check_violation';
  end if;

  delete from public.ballots where vote_id = v_vote_id;
  update public.votes set status = 'cancelled' where id = v_vote_id;
  update public.accusations set status = 'cleared'
    where id = (select accusation_id from public.votes where id = v_vote_id);

  update public.games set phase = 'discussion', current_vote_id = null where id = p_game_id;
end $$;

grant execute on function
  public.now_utc(),
  public.gen_room_code(),
  public.create_game(text, text),
  public.join_game(text, text, text),
  public.heartbeat(uuid, text),
  public.update_settings(uuid, int, uuid[]),
  public.assign_roles(uuid),
  public.confirm_role(uuid),
  public.begin_playing(uuid),
  public.report_body(uuid, uuid[]),
  public.log_accusation(uuid, uuid, uuid),
  public.corroborate_accusation(uuid, uuid),
  public.withdraw_accusation(uuid, uuid),
  public.dismiss_accusation(uuid),
  public.cast_ballot(uuid, uuid, text),
  public.resolve_vote(uuid),
  public.resume_play(uuid),
  public.play_again(uuid),
  public.toggle_alive(uuid, uuid),
  public.cancel_vote(uuid)
to anon, authenticated;
