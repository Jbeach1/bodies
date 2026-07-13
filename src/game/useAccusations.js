import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchPendingAccusations } from '../lib/api'

/** Live pending accusations for a game's discussion screen. */
export function useAccusations(gameId) {
  const [accusations, setAccusations] = useState([])

  const refetch = useCallback(() => {
    fetchPendingAccusations(gameId)
      .then(setAccusations)
      .catch(() => {})
  }, [gameId])

  useEffect(() => {
    let alive = true
    refetch()

    const channel = supabase
      .channel(`accusations:${gameId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'accusations', filter: `game_id=eq.${gameId}` },
        () => alive && refetch(),
      )
      .subscribe()

    return () => {
      alive = false
      supabase.removeChannel(channel)
    }
  }, [gameId, refetch])

  return accusations
}
