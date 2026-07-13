import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchVote, fetchBallots } from '../lib/api'

/** Live vote + ballots for the tribunal screen. */
export function useVote(voteId) {
  const [vote, setVote] = useState(null)
  const [ballots, setBallots] = useState([])

  const refetchBallots = useCallback(() => {
    if (!voteId) return
    fetchBallots(voteId)
      .then(setBallots)
      .catch(() => {})
  }, [voteId])

  useEffect(() => {
    if (!voteId) {
      setVote(null)
      setBallots([])
      return
    }

    let alive = true
    fetchVote(voteId)
      .then((v) => alive && setVote(v))
      .catch(() => {})
    refetchBallots()

    const channel = supabase
      .channel(`vote:${voteId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'votes', filter: `id=eq.${voteId}` },
        (payload) => alive && setVote(payload.new),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ballots', filter: `vote_id=eq.${voteId}` },
        () => alive && refetchBallots(),
      )
      .subscribe()

    return () => {
      alive = false
      supabase.removeChannel(channel)
    }
  }, [voteId, refetchBallots])

  return { vote, ballots }
}
