import { useParams, Navigate } from 'react-router-dom'
import Layout from '../components/Layout'
import PhaseRouter from '../game/PhaseRouter'
import { useGame } from '../game/useGame'
import { PHASE_LABEL } from '../game/phases'
import styles from './GameShell.module.css'

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

  return (
    <Layout header={header}>
      <PhaseRouter game={game} roster={roster} me={me} />
    </Layout>
  )
}

function Centered({ children }) {
  return <div className={styles.centered}>{children}</div>
}
