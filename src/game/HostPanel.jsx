import { useState } from 'react'
import { toggleAlive, cancelVote, resumePlay } from '../lib/api'
import styles from './HostPanel.module.css'

/**
 * Host correction toolkit (PRD §5.5). Reachable in every phase and works even
 * when the host is dead — mounted in GameShell independent of the phase
 * screen, keyed only on `me.is_host`.
 */
export default function HostPanel({ game, roster, me }) {
  const [open, setOpen] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)

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

  if (!open) {
    return (
      <button type="button" className={styles.toggle} onClick={() => setOpen(true)}>
        ⚖ Host Tools
      </button>
    )
  }

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <span className={styles.title}>HOST TOOLS</span>
        <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="Close">
          ✕
        </button>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          ⚠ {error}
        </p>
      )}

      <ul className={styles.roster}>
        {roster.map((p) => (
          <li key={p.id} className={styles.player}>
            <span className={p.is_alive ? '' : styles.dead}>
              {p.name}
              {!p.is_alive && ' ▪ CASE CLOSED'}
            </span>
            <button
              type="button"
              className={styles.chip}
              disabled={busyId === p.id}
              onClick={() => run(p.id, () => toggleAlive(game.id, p.id))}
            >
              {p.is_alive ? '☠ Mark Dead' : '✚ Revive'}
            </button>
          </li>
        ))}
      </ul>

      <div className={styles.actions}>
        {game.phase === 'voting' && (
          <button
            type="button"
            className={styles.chip}
            disabled={busyId === 'cancel'}
            onClick={() => run('cancel', () => cancelVote(game.id))}
          >
            ✕ Cancel Vote
          </button>
        )}
        {game.phase === 'discussion' && (
          <button
            type="button"
            className={styles.chip}
            disabled={busyId === 'resume'}
            onClick={() => run('resume', () => resumePlay(game.id))}
          >
            ◼ Force Resume Surveillance
          </button>
        )}
      </div>
    </div>
  )
}
