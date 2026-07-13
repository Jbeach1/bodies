import { PHASES, PHASE_LABEL } from './phases'
import Lobby from './screens/Lobby'
import styles from './PhaseRouter.module.css'

/**
 * Placeholder screen for phases whose real screen lands in a later slice.
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
 * Maps each game phase (PRD §4) to the screen that renders it. The single
 * switch point: future slices swap a placeholder for the real screen.
 */
const SCREENS = {
  [PHASES.LOBBY]: Lobby,
  [PHASES.ROLE_REVEAL]: Placeholder,
  [PHASES.PLAYING]: Placeholder,
  [PHASES.DISCUSSION]: Placeholder,
  [PHASES.VOTING]: Placeholder,
  [PHASES.GAME_OVER]: Placeholder,
}

export default function PhaseRouter({ game, roster, me }) {
  const phase = game?.phase ?? PHASES.LOBBY
  const Screen = SCREENS[phase] ?? Placeholder
  return <Screen phase={phase} game={game} roster={roster} me={me} />
}
