import { useVote } from '../useVote'
import styles from './Ghost.module.css'

/**
 * Ghost overlay (PRD §8 screen 11). Dead players get full spectator view —
 * roster, phase, live tally, and killer identity — but no actions.
 */
export default function Ghost({ game, roster, me }) {
  const { vote, ballots } = useVote(game.phase === 'voting' ? game.current_vote_id : null)
  const byId = Object.fromEntries(roster.map((p) => [p.id, p]))

  return (
    <div className={styles.ghost}>
      <span className={styles.tag}>GHOST VIEW</span>
      <p className={styles.hint}>
        {me?.is_host
          ? 'You are dead but keep the mod panel below.'
          : 'You are dead. Spectating only.'}
      </p>

      <div className={styles.rosterHead}>
        <span className={styles.rosterTitle}>FULL ROSTER</span>
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

      {game.phase === 'voting' && vote && (
        <div className={styles.tallyBlock}>
          <span className={styles.rosterTitle}>LIVE TALLY — {byId[vote.accused_id]?.name}</span>
          <div className={styles.tally}>
            <span>☠ CONVICT {ballots.filter((b) => b.choice === 'convict').length}</span>
            <span>✓ ACQUIT {ballots.filter((b) => b.choice === 'acquit').length}</span>
          </div>
        </div>
      )}
    </div>
  )
}
