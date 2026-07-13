import { useState } from 'react'
import { useVote } from '../useVote'
import { castBallot, resolveVote } from '../../lib/api'
import styles from './Voting.module.css'

/**
 * Tribunal / voting (PRD §5.3). Ballots are public in real time; auto-resolves
 * once mathematically locked, otherwise the host can Resolve Now (missing =
 * acquit).
 */
export default function Voting({ game, roster, me }) {
  const { vote, ballots } = useVote(game.current_vote_id)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  if (!vote) {
    return (
      <div className={styles.voting}>
        <span className={styles.tag}>TRIBUNAL</span>
        <p className={styles.hint}>Loading the ballot…</p>
      </div>
    )
  }

  const byId = Object.fromEntries(roster.map((p) => [p.id, p]))
  const accused = byId[vote.accused_id]
  const isHost = !!me?.is_host
  const isEligible = !!me?.is_alive && me.id !== vote.accused_id
  const myBallot = ballots.find((b) => b.voter_id === me?.id)
  const eligibleVoters = roster.filter((p) => p.is_alive && p.id !== vote.accused_id)
  const convictCount = ballots.filter((b) => b.choice === 'convict').length
  const acquitCount = ballots.filter((b) => b.choice === 'acquit').length
  const outstanding = eligibleVoters.filter((p) => !ballots.some((b) => b.voter_id === p.id))

  async function onVote(choice) {
    setBusy(true)
    setError(null)
    try {
      await castBallot(vote.id, me.id, choice)
    } catch (e) {
      setError(e.message ?? 'Could not cast that vote.')
    } finally {
      setBusy(false)
    }
  }

  async function onResolve() {
    setBusy(true)
    setError(null)
    try {
      await resolveVote(vote.id)
    } catch (e) {
      setError(e.message ?? 'Could not resolve.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.voting}>
      <span className={styles.tag}>TRIBUNAL</span>
      <p className={styles.accused}>{accused?.name}</p>

      {error && (
        <p className={styles.error} role="alert">
          ⚠ {error}
        </p>
      )}

      {isEligible && (
        <div className={styles.ballotButtons}>
          <button
            type="button"
            className={`${styles.ballotBtn} ${styles.convict} ${
              myBallot?.choice === 'convict' ? styles.chosen : ''
            }`}
            onClick={() => onVote('convict')}
            disabled={busy}
          >
            ☠ Convict
          </button>
          <button
            type="button"
            className={`${styles.ballotBtn} ${styles.acquit} ${
              myBallot?.choice === 'acquit' ? styles.chosen : ''
            }`}
            onClick={() => onVote('acquit')}
            disabled={busy}
          >
            ✓ Acquit
          </button>
        </div>
      )}

      <div className={styles.tally}>
        <span>☠ CONVICT {convictCount}</span>
        <span>✓ ACQUIT {acquitCount}</span>
      </div>

      <span className={styles.label}>OUTSTANDING</span>
      <ul className={styles.outstandingList}>
        {outstanding.length === 0 && <li className={styles.empty}>All ballots in.</li>}
        {outstanding.map((p) => (
          <li key={p.id}>{p.name}</li>
        ))}
      </ul>

      {isHost && (
        <button type="button" className={styles.resolveBtn} onClick={onResolve} disabled={busy}>
          Resolve Now
        </button>
      )}
    </div>
  )
}
