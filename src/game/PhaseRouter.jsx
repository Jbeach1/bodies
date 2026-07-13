import { PHASES, PHASE_LABEL } from './phases'
import Lobby from './screens/Lobby'
import RoleReveal from './screens/RoleReveal'
import Playing from './screens/Playing'
import Discussion from './screens/Discussion'
import Voting from './screens/Voting'
import GameOver from './screens/GameOver'
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
  [PHASES.ROLE_REVEAL]: RoleReveal,
  [PHASES.PLAYING]: Playing,
  [PHASES.DISCUSSION]: Discussion,
  [PHASES.VOTING]: Voting,
  [PHASES.GAME_OVER]: GameOver,
}

export default function PhaseRouter({ game, roster, me }) {
  const phase = game?.phase ?? PHASES.LOBBY
  const Screen = SCREENS[phase] ?? Placeholder
  return <Screen phase={phase} game={game} roster={roster} me={me} />
}
