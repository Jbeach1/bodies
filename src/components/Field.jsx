import styles from './Field.module.css'

/** Labeled text input in the case-file voice. */
export default function Field({ label, hint, className = '', ...props }) {
  return (
    <label className={`${styles.field} ${className}`}>
      <span className={styles.label}>{label}</span>
      <input className={styles.input} {...props} />
      {hint && <span className={styles.hint}>{hint}</span>}
    </label>
  )
}
