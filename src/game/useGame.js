import { useEffect, useState, useCallback } from 'react'
import {
  getGameByCode,
  getMyPlayerId,
  fetchRoster,
  subscribeGame,
  heartbeat,
} from '../lib/api'

const HEARTBEAT_MS = 30_000

/**
 * Live game state for a room. Resolves this device's membership (reconnect),
 * loads the game + roster, and keeps them fresh over a realtime subscription.
 *
 * status: 'loading' | 'not_found' | 'needs_join' | 'error' | 'ready'
 */
export function useGame(roomCode) {
  const [status, setStatus] = useState('loading')
  const [game, setGame] = useState(null)
  const [roster, setRoster] = useState([])
  const [meId, setMeId] = useState(null)
  const [error, setError] = useState(null)

  const refetchRoster = useCallback((gameId) => {
    fetchRoster(gameId)
      .then(setRoster)
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    let alive = true
    let unsub = () => {}
    let hb

    async function boot() {
      try {
        const g = await getGameByCode(roomCode)
        if (!alive) return
        if (!g) return setStatus('not_found')

        const myId = await getMyPlayerId(g.id)
        if (!alive) return
        if (!myId) return setStatus('needs_join')

        const players = await fetchRoster(g.id)
        if (!alive) return

        setGame(g)
        setMeId(myId)
        setRoster(players)
        setStatus('ready')

        unsub = subscribeGame(g.id, {
          onGame: (row) => alive && row && setGame(row),
          onPlayersChange: () => alive && refetchRoster(g.id),
        })

        heartbeat(myId)
        hb = setInterval(() => heartbeat(myId), HEARTBEAT_MS)
      } catch (e) {
        if (alive) {
          setError(e.message ?? 'Failed to load the room.')
          setStatus('error')
        }
      }
    }

    setStatus('loading')
    boot()
    return () => {
      alive = false
      unsub()
      clearInterval(hb)
    }
  }, [roomCode, refetchRoster])

  const me = roster.find((p) => p.id === meId) ?? null
  return { status, game, roster, me, error }
}
