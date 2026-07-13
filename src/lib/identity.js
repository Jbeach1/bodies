/**
 * Device identity + session persistence (PRD §2/§7). No auth — a device is a
 * random UUID kept in localStorage. Membership (which player this device is, in
 * which room) is cached per room so a reload rehydrates without a re-scan.
 */

const DEVICE_KEY = 'bodies:device'
const SESSIONS_KEY = 'bodies:sessions' // { [ROOMCODE]: { gameId, playerId } }

/** Stable per-device UUID; created on first use. */
export function getDeviceUuid() {
  let uuid = localStorage.getItem(DEVICE_KEY)
  if (!uuid) {
    uuid =
      globalThis.crypto?.randomUUID?.() ??
      `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`
    localStorage.setItem(DEVICE_KEY, uuid)
  }
  return uuid
}

function readSessions() {
  try {
    return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '{}')
  } catch {
    return {}
  }
}

/** Remember which player this device is in a given room. */
export function saveSession(roomCode, { gameId, playerId }) {
  const sessions = readSessions()
  sessions[roomCode.toUpperCase()] = { gameId, playerId }
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
}

/** Cached membership hint for a room, or null. Verify against the DB before trusting. */
export function loadSession(roomCode) {
  return readSessions()[roomCode.toUpperCase()] ?? null
}

export function clearSession(roomCode) {
  const sessions = readSessions()
  delete sessions[roomCode.toUpperCase()]
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
}
