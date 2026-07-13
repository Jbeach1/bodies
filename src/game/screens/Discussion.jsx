import { useState } from 'react'
import Button from '../../components/Button'
import { useAccusations } from '../useAccusations'
import {
  logAccusation,
  corroborateAccusation,
  withdrawAccusation,
  dismissAccusation,
  resumePlay,
} from '../../lib/api'
import styles from './Discussion.module.css'

/**
 * Discussion / interrogation loop (PRD §5.2). Accusations coexist as pending;
 * the first corroboration promotes one to the floor and clears the rest.
 */
export default function Discussion({ game, roster, me }) {
  const accusations = useAccusations(game.id)
  const isHost = !!me?.is_host
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)

  const byId = Object.fromEntries(roster.map((p) => [p.id, p]))

  async function run(id, action) {
    setBusyId(id)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(e.message ?? 'That action failed.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className={styles.discussion}>
      <span className={styles.tag}>INTERROGATION</span>

      {error && (
        <p className={styles.error} role="alert">
          ⚠ {error}
        </p>
      )}

      <ul className={styles.accusationList}>
        {accusations.length === 0 && (
          <li className={styles.empty}>No accusations logged yet.</li>
        )}
        {accusations.map((a) => {
          const accuser = byId[a.accuser_id]
          const accused = byId[a.accused_id]
          const canCorroborate = me?.is_alive && me.id !== a.accuser_id && me.id !== a.accused_id
          const canWithdraw = me?.id === a.accuser_id

          return (
            <li key={a.id} className={styles.accusationItem}>
              <span className={styles.accusationText}>
                {accuser?.name} → {accused?.name}
              </span>
              <div className={styles.accusationActions}>
                {canCorroborate && (
                  <button
                    type="button"
                    className={styles.chip}
                    disabled={busyId === a.id}
                    onClick={() => run(a.id, () => corroborateAccusation(a.id, me.id))}
                  >
                    ✚ Corroborate
                  </button>
                )}
                {canWithdraw && (
                  <button
                    type="button"
                    className={styles.chip}
                    disabled={busyId === a.id}
                    onClick={() => run(a.id, () => withdrawAccusation(a.id, me.id))}
                  >
                    ↩ Withdraw
                  </button>
                )}
                {isHost && (
                  <button
                    type="button"
                    className={styles.chip}
                    disabled={busyId === a.id}
                    onClick={() => run(a.id, () => dismissAccusation(a.id))}
                  >
                    ✕ Dismiss
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <div className={styles.rosterHead}>
        <span className={styles.rosterTitle}>ROSTER</span>
      </div>
      <ul className={styles.roster}>
        {roster.map((p) => {
          const canAccuse =
            me?.is_alive && p.is_alive && p.id !== me.id && !p.spared_this_discussion

          return (
            <li key={p.id} className={`${styles.player} ${!p.is_alive ? styles.dead : ''}`}>
              <span className={styles.pname}>
                {p.name}
                {!p.is_alive && <span className={styles.statusBadge}> ▪ CASE CLOSED</span>}
                {p.is_alive && p.spared_this_discussion && (
                  <span className={styles.immune}> IMMUNE</span>
                )}
              </span>
              {canAccuse && (
                <button
                  type="button"
                  className={styles.chip}
                  onClick={() => run(p.id, () => logAccusation(game.id, me.id, p.id))}
                >
                  ☞ Log Accusation
                </button>
              )}
            </li>
          )
        })}
      </ul>

      {isHost && (
        <Button icon="◼" variant="ghost" onClick={() => run('resume', () => resumePlay(game.id))}>
          Resume Surveillance
        </Button>
      )}
    </div>
  )
}
