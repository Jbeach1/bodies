import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import Button from '../components/Button'
import styles from '../game/PhaseRouter.module.css'

/**
 * Generic "lands in a later slice" route (Join, Create). Real flows arrive in
 * slice 02 (rooms & lobby).
 */
export default function Placeholder({ title, slice }) {
  return (
    <Layout>
      <div className={styles.placeholder}>
        <span className={styles.tag}>{title}</span>
        <p className={styles.hint}>Arrives in {slice}.</p>
        <Button as={Link} to="/" variant="ghost" icon="←">
          Back
        </Button>
      </div>
    </Layout>
  )
}
