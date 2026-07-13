import { useEffect, useState } from 'react'
import styles from './Beat.module.css'

/**
 * Cinematic beat (PRD §9.4): cut-to-black, mono text types in, red
 * vignette/flicker, best-effort haptic buzz (iOS Safari ignores). No sound.
 * Auto-dismisses after `duration`.
 */
export default function Beat({ text, onDone, duration = 1800 }) {
  const [typed, setTyped] = useState('')

  useEffect(() => {
    navigator.vibrate?.(80)
    let i = 0
    const typeTimer = setInterval(() => {
      i += 1
      setTyped(text.slice(0, i))
      if (i >= text.length) clearInterval(typeTimer)
    }, 35)
    const doneTimer = setTimeout(() => onDone?.(), duration)
    return () => {
      clearInterval(typeTimer)
      clearTimeout(doneTimer)
    }
  }, [text, duration, onDone])

  return (
    <div className={styles.beat} role="status" aria-live="polite">
      <div className={styles.vignette} />
      <span className={styles.text}>{typed}</span>
    </div>
  )
}
