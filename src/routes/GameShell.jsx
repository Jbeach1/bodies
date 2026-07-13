import { useParams, Navigate } from 'react-router-dom'
import Layout from '../components/Layout'
import PhaseRouter from '../game/PhaseRouter'
import Ghost from '../game/screens/Ghost'
import HostPanel from '../game/HostPanel'
import { useGame } from '../game/useGame'
import { PHASE_LABEL } from '../game/phases'
import styles from './GameShell.module.css'

// Ghost view only applies once roles are in play — not lobby/role_reveal, and
// game_over already shows a full reveal to everyone via the GameOver screen.
const GHOST_PHASES = new Set(['playing', 'discussion', 'voting'])

/**
 * In-game shell for /game/:roomCode. Resolves membership + live game state via
 * useGame, then renders the phase-appropriate screen. Reconnect (reload) lands
 * straight back here; an unbound device is bounced to Join with the code prefilled.
 */
export default function GameShell() {
  const { roomCode } = useParams()
  const { status, game, roster, me, error } = useGame(roomCode)

  if (status === 'loading') {
    return (
      <Layout>
        <Centered>Loading room…</Centered>
      </Layout>
    )
  }
  if (status === 'not_found') {
    return (
      <Layout>
        <Centered>
          No room <code>{roomCode?.toUpperCase()}</code>.{' '}
          <a href="/" className={styles.link}>
            Back home
          </a>
        </Centered>
      </Layout>
    )
  }
  if (status === 'needs_join') {
    return <Navigate to={`/join?code=${roomCode.toUpperCase()}`} replace />
  }
  if (status === 'error') {
    return (
      <Layout>
        <Centered>⚠ {error}</Centered>
      </Layout>
    )
  }

  const header = (
    <span className={styles.room}>
      ROOM {game.room_code} · {PHASE_LABEL[game.phase]}
    </span>
  )

  const showGhost = !!me && !me.is_alive && GHOST_PHASES.has(game.phase)

  return (
    <Layout header={header}>
      {showGhost ? (
        <Ghost game={game} roster={roster} me={me} />
      ) : (
        <PhaseRouter game={game} roster={roster} me={me} />
      )}
      {me?.is_host && <HostPanel game={game} roster={roster} me={me} />}
    </Layout>
  )
}

function Centered({ children }) {
  return <div className={styles.centered}>{children}</div>
}
