import { useState } from 'react'
import Button from '../../components/Button'
import { reportBody } from '../../lib/api'
import styles from './Playing.module.css'

/**
 * Dormant PLAYING screen (PRD §8.6). Same ambient view for everyone, including
 * killers — purely informational during the dark phase. Only the host holds
 * REPORT BODY.
 */
export default function Playing({ game, roster, me }) {
  const isHost = !!me?.is_host
  const living = roster.filter((p) => p.is_alive)
  const [reporting, setReporting] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  function toggle(id) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  function openReport() {
    setSelected(new Set())
    setError(null)
    setReporting(true)
  }

  async function onConfirm() {
    if (selected.size === 0 || busy) return
    setBusy(true)
    setError(null)
    try {
      await reportBody(game.id, [...selected])
      setReporting(false)
    } catch (e) {
      setError(e.message ?? 'Could not report the body.')
    } finally {
      setBusy(false)
    }
  }

  if (reporting) {
    return (
      <div className={styles.report}>
        <span className={styles.tag}>REPORT BODY</span>
        <p className={styles.hint}>Select the victim(s).</p>
        <ul className={styles.list}>
          {living.map((p) => (
            <li key={p.id} className={styles.item}>
              <label className={styles.itemLabel}>
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={() => toggle(p.id)}
                />
                {p.name}
              </label>
            </li>
          ))}
        </ul>
        {error && (
          <p className={styles.error} role="alert">
            ⚠ {error}
          </p>
        )}
        <Button
          icon="☠"
          variant="danger"
          onClick={onConfirm}
          disabled={selected.size === 0 || busy}
        >
          {busy ? 'Reporting…' : `Confirm (${selected.size})`}
        </Button>
        <Button variant="ghost" onClick={() => setReporting(false)} disabled={busy}>
          Cancel
        </Button>
      </div>
    )
  }

  return (
    <div className={styles.playing}>
      <div className={styles.ambient}>
        <span className={styles.tag}>SURVEILLANCE</span>
        <p className={styles.hint}>The case is active. Stay alert.</p>
      </div>
      {isHost && (
        <Button icon="☠" variant="danger" onClick={openReport}>
          Report Body
        </Button>
      )}
    </div>
  )
}
