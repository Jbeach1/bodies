/**
 * Room/roster data access (PRD §7, issue 02). Writes go through Postgres RPCs;
 * reads and realtime use the anon client directly. Room scoping is client-side
 * (every query filters by game_id).
 */
import { supabase } from './supabase'
import { getDeviceUuid, saveSession } from './identity'

/** Host creates a room and becomes player #1. Persists the session. */
export async function createGame(hostName) {
  const device_uuid = getDeviceUuid()
  const { data, error } = await supabase
    .rpc('create_game', { host_name: hostName, device_uuid })
    .single()
  if (error) throw error
  saveSession(data.room_code, { gameId: data.game_id, playerId: data.player_id })
  return data // { game_id, room_code, player_id }
}

/** Join a room by code + name (idempotent per device). Persists the session. */
export async function joinGame(roomCode, playerName) {
  const device_uuid = getDeviceUuid()
  const { data, error } = await supabase
    .rpc('join_game', {
      p_room_code: roomCode,
      player_name: playerName,
      device_uuid,
    })
    .single()
  if (error) throw error
  saveSession(roomCode, { gameId: data.game_id, playerId: data.player_id })
  return data // { game_id, player_id, phase, reconnected }
}

/** Fetch a game row by its short room code (case-insensitive). */
export async function getGameByCode(roomCode) {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('room_code', roomCode.toUpperCase())
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * Which player is this device in this game? Authoritative reconnect check —
 * returns the player id bound to this device, or null if unbound.
 */
export async function getMyPlayerId(gameId) {
  const device_uuid = getDeviceUuid()
  const { data, error } = await supabase
    .from('device_sessions')
    .select('player_id, players!inner(game_id)')
    .eq('device_uuid', device_uuid)
    .eq('players.game_id', gameId)
    .maybeSingle()
  if (error) throw error
  return data?.player_id ?? null
}

/** Full roster for a game, in join order. */
export async function fetchRoster(gameId) {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', gameId)
    .order('join_order', { ascending: true })
  if (error) throw error
  return data
}

/** Best-effort presence heartbeat (refreshes last_seen). */
export async function heartbeat(playerId) {
  const device_uuid = getDeviceUuid()
  await supabase.rpc('heartbeat', { p_player_id: playerId, device_uuid })
}

/**
 * Subscribe to a room's live state: the `games` row (phase/settings/winner) and
 * its `players` roster. Calls onGame(row) and onPlayersChange() on any change.
 * Returns an unsubscribe function.
 */
export function subscribeGame(gameId, { onGame, onPlayersChange }) {
  const channel = supabase
    .channel(`game:${gameId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
      (payload) => onGame?.(payload.new),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'players', filter: `game_id=eq.${gameId}` },
      () => onPlayersChange?.(),
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}
