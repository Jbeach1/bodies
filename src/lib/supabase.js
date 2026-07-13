import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * True when both env vars are present. Screens can use this to render a
 * "not configured yet" state instead of throwing before Supabase is provisioned.
 */
export const isSupabaseConfigured = Boolean(url && anonKey)

if (!isSupabaseConfigured) {
  // Loud in dev, harmless in prod — the app still boots so the shell renders.
  console.warn(
    '[bodies] Supabase env not set. Copy .env.example → .env and fill ' +
      'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.',
  )
}

/**
 * Shared Supabase client. Identity is a localStorage UUID (no auth, PRD §2/§7),
 * so we disable Supabase's own auth persistence/refresh machinery.
 */
export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'anon', {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

/**
 * Trivial connectivity round-trip for the scaffold acceptance criterion.
 * Calls a `select now()` RPC (see supabase/schema.sql). Returns { ok, value, error }.
 */
export async function pingSupabase() {
  if (!isSupabaseConfigured) {
    return { ok: false, error: 'Supabase env not configured' }
  }
  const { data, error } = await supabase.rpc('now_utc')
  if (error) return { ok: false, error: error.message }
  return { ok: true, value: data }
}
