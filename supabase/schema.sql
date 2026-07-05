-- Bodies — database schema.
-- Applied by pasting into the Supabase SQL editor (or `supabase db push`).
-- Slice 01 seeds only the connectivity round-trip RPC; the full data model
-- (PRD §7) and mutation RPCs (§5) land in slices 02+.

-- Connectivity check used by the app's pingSupabase() (scaffold acceptance).
-- SECURITY DEFINER + a stable search_path so the anon role can call it safely.
create or replace function public.now_utc()
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select now();
$$;

grant execute on function public.now_utc() to anon, authenticated;
