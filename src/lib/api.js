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

/** Host persists killerCount + blacklist to games.settings (lobby only). */
export async function updateSettings(gameId, { killerCount, blacklist }) {
  const { error } = await supabase.rpc('update_settings', {
    p_game_id: gameId,
    p_killer_count: killerCount,
    p_blacklist: blacklist,
  })
  if (error) throw error
}

/** Host START: server-side validated, atomic role assignment. lobby → role_reveal. */
export async function startGame(gameId) {
  const { error } = await supabase.rpc('assign_roles', { p_game_id: gameId })
  if (error) throw error
}

/** Player acks CONFIRM IDENTITY after peeking their role card. */
export async function confirmRole(playerId) {
  const { error } = await supabase.rpc('confirm_role', { p_player_id: playerId })
  if (error) throw error
}

/** Host BEGIN: role_reveal → playing (may force before everyone confirms). */
export async function beginPlaying(gameId) {
  const { error } = await supabase.rpc('begin_playing', { p_game_id: gameId })
  if (error) throw error
}

/**
 * Host REPORT BODY: marks 1+ victims dead, resets discussion immunity, runs
 * the win-check, and lands on discussion or game_over.
 */
export async function reportBody(gameId, victimIds) {
  const { error } = await supabase.rpc('report_body', {
    p_game_id: gameId,
    p_victim_ids: victimIds,
  })
  if (error) throw error
}

/** LOG ACCUSATION: living, non-immune, non-self target. Returns the accusation id. */
export async function logAccusation(gameId, accuserId, accusedId) {
  const { data, error } = await supabase.rpc('log_accusation', {
    p_game_id: gameId,
    p_accuser_id: accuserId,
    p_accused_id: accusedId,
  })
  if (error) throw error
  return data
}

/** CORROBORATE: first second promotes the accusation to a vote and clears the rest. */
export async function corroborateAccusation(accusationId, seconderId) {
  const { error } = await supabase.rpc('corroborate_accusation', {
    p_accusation_id: accusationId,
    p_seconder_id: seconderId,
  })
  if (error) throw error
}

/** Accuser withdraws their own unseconded accusation. */
export async function withdrawAccusation(accusationId, accuserId) {
  const { error } = await supabase.rpc('withdraw_accusation', {
    p_accusation_id: accusationId,
    p_accuser_id: accuserId,
  })
  if (error) throw error
}

/** Host dismisses an unseconded accusation. */
export async function dismissAccusation(accusationId) {
  const { error } = await supabase.rpc('dismiss_accusation', { p_accusation_id: accusationId })
  if (error) throw error
}

/** Pending accusations for a game's discussion screen (realtime keeps this fresh). */
export async function fetchPendingAccusations(gameId) {
  const { data, error } = await supabase
    .from('accusations')
    .select('*')
    .eq('game_id', gameId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

/** Host RESUME SURVEILLANCE: discussion → playing, clears discussion immunity. */
export async function resumePlay(gameId) {
  const { error } = await supabase.rpc('resume_play', { p_game_id: gameId })
  if (error) throw error
}

/** Cast or change a ballot (Convict/Acquit); auto-resolves once locked. */
export async function castBallot(voteId, voterId, choice) {
  const { error } = await supabase.rpc('cast_ballot', {
    p_vote_id: voteId,
    p_voter_id: voterId,
    p_choice: choice,
  })
  if (error) throw error
}

/** Host RESOLVE NOW: missing ballots count as acquit. */
export async function resolveVote(voteId) {
  const { error } = await supabase.rpc('resolve_vote', { p_vote_id: voteId })
  if (error) throw error
}

/** Fetch a vote row by id. */
export async function fetchVote(voteId) {
  const { data, error } = await supabase.from('votes').select('*').eq('id', voteId).maybeSingle()
  if (error) throw error
  return data
}

/** Ballots cast so far on a vote. */
export async function fetchBallots(voteId) {
  const { data, error } = await supabase.from('ballots').select('*').eq('vote_id', voteId)
  if (error) throw error
  return data
}

/** Host NEW CASE: resets roles/alive/trial state, game_over → lobby. */
export async function playAgain(gameId) {
  const { error } = await supabase.rpc('play_again', { p_game_id: gameId })
  if (error) throw error
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
