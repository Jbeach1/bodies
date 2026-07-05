import { PHASES, PHASE_LABEL } from './phases'
import styles from './PhaseRouter.module.css'

/**
 * Placeholder screen for a phase. Later slices replace each entry in SCREENS
 * with the real screen component (Lobby, RoleReveal, Playing, …).
 */
function Placeholder({ phase }) {
  return (
    <div className={styles.placeholder}>
      <span className={styles.tag}>{PHASE_LABEL[phase]}</span>
      <p className={styles.hint}>
        Phase <code>{phase}</code> — screen lands in a later slice.
      </p>
    </div>
  )
}

/**
 * Maps each game phase (PRD §4) to the screen that renders it. The GameShell
 * feeds this the live `games.phase`; this is the single switch point so future
 * slices only need to swap a map entry.
 */
const SCREENS = {
  [PHASES.LOBBY]: Placeholder,
  [PHASES.ROLE_REVEAL]: Placeholder,
  [PHASES.PLAYING]: Placeholder,
  [PHASES.DISCUSSION]: Placeholder,
  [PHASES.VOTING]: Placeholder,
  [PHASES.GAME_OVER]: Placeholder,
}

export default function PhaseRouter({ phase }) {
  const Screen = SCREENS[phase]
  if (!Screen) {
    return <Placeholder phase={PHASES.LOBBY} />
  }
  return <Screen phase={phase} />
}
