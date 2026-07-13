import { useEffect, useState } from 'react'
import Button from '../../components/Button'
import { updateSettings, startGame } from '../../lib/api'
import { validateStart } from '../validate'
import styles from './Settings.module.css'

/**
 * Host-only settings + START (PRD §5.1, §8.4). killerCount stepper and the
 * blacklist multi-select persist to games.settings on every change; START
 * runs the same validation the assign_roles RPC re-checks server-side.
 */
export default function Settings({ game, roster }) {
  const [killerCount, setKillerCount] = useState(game.settings?.killerCount ?? 1)
  const [blacklist, setBlacklist] = useState(new Set(game.settings?.blacklistedFromKiller ?? []))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setKillerCount(game.settings?.killerCount ?? 1)
    setBlacklist(new Set(game.settings?.blacklistedFromKiller ?? []))
  }, [game.settings])

  function persist(nextKillerCount, nextBlacklist) {
    updateSettings(game.id, {
      killerCount: nextKillerCount,
      blacklist: [...nextBlacklist],
    }).catch((e) => setError(e.message ?? 'Could not save settings.'))
  }

  function changeKillerCount(delta) {
    const next = Math.max(1, killerCount + delta)
    setKillerCount(next)
    persist(next, blacklist)
  }

  function toggleBlacklist(playerId) {
    const next = new Set(blacklist)
    if (next.has(playerId)) next.delete(playerId)
    else next.add(playerId)
    setBlacklist(next)
    persist(killerCount, next)
  }

  const problem = validateStart(roster, {
    killerCount,
    blacklistedFromKiller: [...blacklist],
  })

  async function onStart() {
    if (problem || busy) return
    setBusy(true)
    setError(null)
    try {
      await startGame(game.id)
    } catch (e) {
      setError(e.message ?? 'Could not start the game.')
      setBusy(false)
    }
  }

  return (
    <div className={styles.settings}>
      <div className={styles.row}>
        <span className={styles.label}>KILLERS</span>
        <div className={styles.stepper}>
          <button
            type="button"
            className={styles.stepBtn}
            onClick={() => changeKillerCount(-1)}
            disabled={killerCount <= 1}
            aria-label="Fewer killers"
          >
            −
          </button>
          <span className={styles.stepValue}>{killerCount}</span>
          <button
            type="button"
            className={styles.stepBtn}
            onClick={() => changeKillerCount(1)}
            aria-label="More killers"
          >
            +
          </button>
        </div>
      </div>

      <span className={styles.label}>BLACKLIST FROM KILLER</span>
      <ul className={styles.blacklist}>
        {roster.map((p) => (
          <li key={p.id} className={styles.blItem}>
            <label className={styles.blLabel}>
              <input
                type="checkbox"
                checked={blacklist.has(p.id)}
                onChange={() => toggleBlacklist(p.id)}
              />
              {p.name}
            </label>
          </li>
        ))}
      </ul>

      {(problem || error) && (
        <p className={styles.error} role="alert">
          ⚠ {error ?? problem}
        </p>
      )}

      <Button icon="▶" onClick={onStart} disabled={!!problem || busy}>
        {busy ? 'Initiating…' : 'Initiate'}
      </Button>
    </div>
  )
}
