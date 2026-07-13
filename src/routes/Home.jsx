import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import Button from '../components/Button'
import { isSupabaseConfigured } from '../lib/supabase'
import styles from './Home.module.css'

export default function Home() {
  return (
    <Layout>
      <div className={styles.hero}>
        <h1 className={styles.title}>BODIES</h1>
        <p className={styles.tagline}>
          A neutral moderator for live social deduction.
          <br />
          Draw roles. Find the body. Convict the killer.
        </p>
      </div>

      <div className={styles.actions}>
        <Button as={Link} to="/create" icon="✚">
          Create Game
        </Button>
        <Button as={Link} to="/join" variant="ghost" icon="⌦">
          Join Game
        </Button>
      </div>

      {!isSupabaseConfigured && (
        <p className={styles.notice} role="status">
          ⚠ Backend not configured — set Supabase env vars to enable play.
        </p>
      )}
    </Layout>
  )
}
