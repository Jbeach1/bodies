import { useState } from 'react'
import Button from '../../components/Button'
import { confirmRole, beginPlaying } from '../../lib/api'
import styles from './RoleReveal.module.css'

/**
 * Role reveal (PRD §5.1, §8.5). Press-and-hold to peek, release snaps back.
 * Killers see accomplices; town sees CIVILIAN only. Each player acks CONFIRM
 * IDENTITY; the host sees readiness and can BEGIN (may force).
 */
export default function RoleReveal({ game, roster, me }) {
  const [peeking, setPeeking] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [beginning, setBeginning] = useState(false)
  const [error, setError] = useState(null)

  const isHost = !!me?.is_host
  const isKiller = me?.role === 'killer'
  const accomplices = isKiller
    ? roster.filter((p) => p.role === 'killer' && p.id !== me.id).map((p) => p.name)
    : []
  const confirmedCount = roster.filter((p) => p.role_confirmed).length

  async function onConfirm() {
    if (confirming || me?.role_confirmed) return
    setConfirming(true)
    setError(null)
    try {
      await confirmRole(me.id)
    } catch (e) {
      setError(e.message ?? 'Could not confirm.')
    } finally {
      setConfirming(false)
    }
  }

  async function onBegin() {
    if (beginning) return
    setBeginning(true)
    setError(null)
    try {
      await beginPlaying(game.id)
    } catch (e) {
      setError(e.message ?? 'Could not begin play.')
      setBeginning(false)
    }
  }

  return (
    <div className={styles.reveal}>
      <div
        className={`${styles.card} ${peeking ? styles.peeking : ''}`}
        onPointerDown={() => setPeeking(true)}
        onPointerUp={() => setPeeking(false)}
        onPointerLeave={() => setPeeking(false)}
        onPointerCancel={() => setPeeking(false)}
        onContextMenu={(e) => e.preventDefault()}
      >
        {peeking ? (
          <div className={styles.face}>
            <span className={styles.roleTag}>{isKiller ? 'KILLER' : 'CIVILIAN'}</span>
            {isKiller && accomplices.length > 0 && (
              <div className={styles.accomplices}>
                <span className={styles.accLabel}>ACCOMPLICES</span>
                <span className={styles.accNames}>{accomplices.join(', ')}</span>
              </div>
            )}
          </div>
        ) : (
          <div className={styles.back}>
            <span className={styles.backTag}>CASE FILE</span>
            <span className={styles.hint}>Press and hold to view</span>
          </div>
        )}
      </div>

      {error && (
        <p className={styles.error} role="alert">
          ⚠ {error}
        </p>
      )}

      <Button
        icon={me?.role_confirmed ? '✓' : '◆'}
        onClick={onConfirm}
        disabled={me?.role_confirmed || confirming}
      >
        {me?.role_confirmed ? 'Identity Confirmed' : 'Confirm Identity'}
      </Button>

      {isHost && (
        <div className={styles.hostArea}>
          <div className={styles.readiness}>
            <span className={styles.readyLabel}>READY</span>
            <span className={styles.readyCount}>
              {confirmedCount}/{roster.length}
            </span>
          </div>
          <ul className={styles.readyList}>
            {roster.map((p) => (
              <li key={p.id} className={styles.readyItem}>
                <span>{p.name}</span>
                <span className={p.role_confirmed ? styles.ok : styles.pending}>
                  {p.role_confirmed ? '✓' : '…'}
                </span>
              </li>
            ))}
          </ul>
          <Button icon="▶" onClick={onBegin} disabled={beginning}>
            {beginning ? 'Beginning…' : 'Begin'}
          </Button>
        </div>
      )}
    </div>
  )
}
