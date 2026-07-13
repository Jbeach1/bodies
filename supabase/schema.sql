-- Bodies — database schema (tables, RLS, realtime, triggers).
-- Apply first, then supabase/functions.sql. Paste into the Supabase SQL editor
-- (or `supabase db push`). Safe to re-run.
--
-- Identity is a localStorage UUID with no auth (PRD §2/§7); RLS is intentionally
-- permissive (secrecy is UI-only) and all mutations go through SECURITY DEFINER
-- RPCs in functions.sql so phase transitions stay server-authoritative. Room
-- scoping is client-side: each device only ever queries its own game_id.

-- ─────────────────────────────────────────────────────────────────────────────
-- Tables (PRD §7). Slices 01–02 define games / players / device_sessions; the
-- accusations / votes / ballots tables land in slices 04–05.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.games (
  id              uuid primary key default gen_random_uuid(),
  room_code       text unique not null,
  phase           text not null default 'lobby',
  host_player_id  uuid,                       -- fk added after players exists
  settings        jsonb not null default '{"blacklistedFromKiller":[],"killerCount":1}'::jsonb,
  winner          text,                       -- town | killers | null
  current_vote_id uuid,                       -- fk added in the voting slice
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.players (
  id                     uuid primary key default gen_random_uuid(),
  game_id                uuid not null references public.games(id) on delete cascade,
  name                   text not null,
  join_order             int not null,
  role                   text,               -- killer | town | null (pre-assign)
  is_alive               boolean not null default true,
  is_host                boolean not null default false,
  spared_this_discussion boolean not null default false,
  created_at             timestamptz not null default now()
);

create table if not exists public.device_sessions (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.players(id) on delete cascade,
  device_uuid text not null,
  last_seen   timestamptz not null default now(),
  unique (player_id, device_uuid)
);

-- host_player_id references a player once both tables exist.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'games_host_player_id_fkey'
  ) then
    alter table public.games
      add constraint games_host_player_id_fkey
      foreign key (host_player_id) references public.players(id) on delete set null;
  end if;
end $$;

create index if not exists players_game_id_idx on public.players(game_id);
create index if not exists device_sessions_device_uuid_idx on public.device_sessions(device_uuid);
create unique index if not exists games_room_code_key on public.games(room_code);

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at bookkeeping (supports the 24h idle TTL cleanup, PRD §7).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists games_touch_updated_at on public.games;
create trigger games_touch_updated_at
  before update on public.games
  for each row execute function public.touch_updated_at();

-- Roster activity (join/leave/edit) also counts as room activity.
create or replace function public.touch_game_from_player()
returns trigger language plpgsql
security definer set search_path = public as $$
begin
  update public.games set updated_at = now()
  where id = coalesce(new.game_id, old.game_id);
  return coalesce(new, old);
end $$;

drop trigger if exists players_touch_game on public.players;
create trigger players_touch_game
  after insert or update or delete on public.players
  for each row execute function public.touch_game_from_player();

-- ─────────────────────────────────────────────────────────────────────────────
-- Row-level security. Permissive by design (PRD §2): anon may read all game
-- state (realtime needs SELECT) and update its own device_sessions heartbeat.
-- All game mutations are funnelled through SECURITY DEFINER RPCs, so no broad
-- INSERT/UPDATE grants on games/players are needed from the client.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.games enable row level security;
alter table public.players enable row level security;
alter table public.device_sessions enable row level security;

drop policy if exists games_read on public.games;
create policy games_read on public.games for select to anon, authenticated using (true);

drop policy if exists players_read on public.players;
create policy players_read on public.players for select to anon, authenticated using (true);

drop policy if exists device_sessions_read on public.device_sessions;
create policy device_sessions_read on public.device_sessions
  for select to anon, authenticated using (true);

-- Devices heartbeat their own last_seen directly (cheap, non-authoritative).
drop policy if exists device_sessions_update on public.device_sessions;
create policy device_sessions_update on public.device_sessions
  for update to anon, authenticated using (true) with check (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime: publish the room tables so clients get live roster/phase updates.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'games'
  ) then
    alter publication supabase_realtime add table public.games;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'players'
  ) then
    alter publication supabase_realtime add table public.players;
  end if;
end $$;
