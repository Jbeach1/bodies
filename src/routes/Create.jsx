import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Layout from '../components/Layout'
import Button from '../components/Button'
import Field from '../components/Field'
import { createGame } from '../lib/api'
import { isSupabaseConfigured } from '../lib/supabase'
import styles from './Form.module.css'

export default function Create() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function onSubmit(e) {
    e.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const { room_code } = await createGame(name.trim())
      navigate(`/game/${room_code}`)
    } catch (err) {
      setError(err.message ?? 'Could not create the game.')
      setBusy(false)
    }
  }

  return (
    <Layout>
      <form className={styles.form} onSubmit={onSubmit}>
        <h1 className={styles.title}>NEW CASE</h1>
        <p className={styles.blurb}>You’ll host and moderate. You also draw a role.</p>

        <Field
          label="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. DET. MORGAN"
          maxLength={24}
          autoFocus
        />

        {error && (
          <p className={styles.error} role="alert">
            ⚠ {error}
          </p>
        )}

        <Button type="submit" icon="✚" disabled={!name.trim() || busy || !isSupabaseConfigured}>
          {busy ? 'Opening…' : 'Open Case'}
        </Button>
        {!isSupabaseConfigured && (
          <p className={styles.blurb}>Backend not configured — set Supabase env vars.</p>
        )}
        <Button as={Link} to="/" variant="ghost" icon="←">
          Back
        </Button>
      </form>
    </Layout>
  )
}
