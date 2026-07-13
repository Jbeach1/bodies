import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import Button from '../../components/Button'
import styles from './Lobby.module.css'

/**
 * Lobby (PRD §8.3). Live roster + room code + QR. Host sees settings/START in a
 * later slice; for now START is a labeled placeholder so the shell is complete.
 */
export default function Lobby({ game, roster, me }) {
  const isHost = me?.is_host
  const joinUrl = `${window.location.origin}/join?code=${game.room_code}`
  const qr = useQrDataUrl(joinUrl)

  return (
    <div className={styles.lobby}>
      <div className={styles.codeCard}>
        <span className={styles.codeLabel}>ROOM CODE</span>
        <span className={styles.code}>{game.room_code}</span>
        {qr && <img className={styles.qr} src={qr} alt={`QR to join room ${game.room_code}`} />}
        <span className={styles.codeHint}>Scan or enter the code to join</span>
      </div>

      <div className={styles.rosterHead}>
        <span className={styles.rosterTitle}>ROSTER</span>
        <span className={styles.count}>{roster.length}</span>
      </div>
      <ul className={styles.roster}>
        {roster.map((p) => (
          <li key={p.id} className={styles.player}>
            <span className={styles.pname}>
              {p.name}
              {p.id === me?.id && <span className={styles.you}> (you)</span>}
            </span>
            {p.is_host && (
              <span className={styles.badge} title="Host / moderator">
                ⚖ HOST
              </span>
            )}
          </li>
        ))}
      </ul>

      {isHost ? (
        <div className={styles.hostArea}>
          <Button icon="▶" disabled title="Role assignment lands in slice 03">
            Initiate
          </Button>
          <p className={styles.wait}>Settings &amp; start arrive in slice 03.</p>
        </div>
      ) : (
        <p className={styles.wait}>Waiting for the host to begin…</p>
      )}
    </div>
  )
}

function useQrDataUrl(text) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let alive = true
    QRCode.toDataURL(text, {
      margin: 1,
      width: 180,
      color: { dark: '#ECECEC', light: '#0a0a0b' },
    })
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setUrl(null))
    return () => {
      alive = false
    }
  }, [text])
  return url
}
