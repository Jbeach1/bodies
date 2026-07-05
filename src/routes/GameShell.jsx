import { useState } from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import PhaseRouter from '../game/PhaseRouter'
import { PHASE_ORDER } from '../game/phases'
import styles from './GameShell.module.css'

/**
 * The in-game shell. Later slices drive `phase` from the live `games` row via
 * a Supabase realtime subscription; for the scaffold it's local state with a
 * dev stepper so the phase-switch structure is demonstrable end-to-end.
 */
export default function GameShell() {
  const { roomCode } = useParams()
  const [phaseIndex, setPhaseIndex] = useState(0)
  const phase = PHASE_ORDER[phaseIndex]

  const header = <span className={styles.room}>ROOM {roomCode}</span>

  return (
    <Layout header={header}>
      <PhaseRouter phase={phase} />

      {/* Dev-only phase stepper — removed once realtime drives the phase. */}
      <div className={styles.stepper} role="group" aria-label="dev phase stepper">
        <button
          onClick={() => setPhaseIndex((i) => Math.max(0, i - 1))}
          disabled={phaseIndex === 0}
        >
          ◀ prev
        </button>
        <span className={styles.count}>
          {phaseIndex + 1}/{PHASE_ORDER.length}
        </span>
        <button
          onClick={() => setPhaseIndex((i) => Math.min(PHASE_ORDER.length - 1, i + 1))}
          disabled={phaseIndex === PHASE_ORDER.length - 1}
        >
          next ▶
        </button>
      </div>
    </Layout>
  )
}
