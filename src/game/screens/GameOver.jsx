import { useState } from 'react'
import Button from '../../components/Button'
import { playAgain } from '../../lib/api'
import styles from './GameOver.module.css'

/**
 * Game over (PRD §8.10). Full role reveal for every player; host can start a
 * new case in the same room.
 */
export default function GameOver({ game, roster, me }) {
  const isHost = !!me?.is_host
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function onPlayAgain() {
    setBusy(true)
    setError(null)
    try {
      await playAgain(game.id)
    } catch (e) {
      setError(e.message ?? 'Could not start a new case.')
      setBusy(false)
    }
  }

  return (
    <div className={styles.gameOver}>
      <span className={styles.tag}>CASE CLOSED</span>
      <p className={styles.winner}>{game.winner === 'town' ? 'TOWN WINS' : 'KILLERS WIN'}</p>

      <div className={styles.rosterHead}>
        <span className={styles.rosterTitle}>FULL REVEAL</span>
      </div>
      <ul className={styles.roster}>
        {roster.map((p) => (
          <li key={p.id} className={`${styles.player} ${!p.is_alive ? styles.dead : ''}`}>
            <span className={styles.pname}>
              {p.name}
              {!p.is_alive && <span className={styles.statusBadge}> ▪ CASE CLOSED</span>}
            </span>
            <span className={p.role === 'killer' ? styles.roleKiller : styles.roleTown}>
              {p.role === 'killer' ? 'KILLER' : 'CIVILIAN'}
            </span>
          </li>
        ))}
      </ul>

      {error && (
        <p className={styles.error} role="alert">
          ⚠ {error}
        </p>
      )}

      {isHost && (
        <Button icon="✚" onClick={onPlayAgain} disabled={busy}>
          {busy ? 'Opening…' : 'New Case'}
        </Button>
      )}
    </div>
  )
}
