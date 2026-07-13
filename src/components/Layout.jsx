import styles from './Layout.module.css'

/**
 * Base app frame: a centered mobile-first column on a near-black field.
 * Every route/screen renders inside this shell.
 */
export default function Layout({ children, header }) {
  return (
    <div className={styles.frame}>
      <header className={styles.header}>
        <span className={styles.brand}>BODIES</span>
        {header}
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  )
}
