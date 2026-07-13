import { useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout'
import Button from '../components/Button'
import Field from '../components/Field'
import { joinGame } from '../lib/api'
import { isSupabaseConfigured } from '../lib/supabase'
import styles from './Form.module.css'

export default function Join() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [code, setCode] = useState((params.get('code') ?? '').toUpperCase())
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function onSubmit(e) {
    e.preventDefault()
    if (!code.trim() || !name.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      await joinGame(code.trim(), name.trim())
      navigate(`/game/${code.trim().toUpperCase()}`)
    } catch (err) {
      setError(friendly(err))
      setBusy(false)
    }
  }

  return (
    <Layout>
      <form className={styles.form} onSubmit={onSubmit}>
        <h1 className={styles.title}>JOIN CASE</h1>

        <Field
          label="Room code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABCD"
          maxLength={4}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          autoFocus={!code}
        />
        <Field
          label="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. RILEY"
          maxLength={24}
          autoFocus={!!code}
        />

        {error && (
          <p className={styles.error} role="alert">
            ⚠ {error}
          </p>
        )}

        <Button
          type="submit"
          icon="⌦"
          disabled={!code.trim() || !name.trim() || busy || !isSupabaseConfigured}
        >
          {busy ? 'Joining…' : 'Enter Room'}
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

function friendly(err) {
  const msg = err?.message ?? ''
  if (/no game with room code/i.test(msg)) return 'No room with that code.'
  if (/already started/i.test(msg)) return 'That game has already started.'
  return msg || 'Could not join the game.'
}
