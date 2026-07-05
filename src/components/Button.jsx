import styles from './Button.module.css'

/**
 * Case-file button. `icon` + children keep the "color never carries meaning
 * alone" rule (§9.1) — every semantic action ships an icon beside its label.
 *
 * variant: 'primary' (default) | 'danger' | 'ghost'
 */
export default function Button({
  as = 'button',
  variant = 'primary',
  icon,
  children,
  className = '',
  ...props
}) {
  const Comp = as
  return (
    <Comp className={`${styles.btn} ${styles[variant]} ${className}`} {...props}>
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      <span className={styles.label}>{children}</span>
    </Comp>
  )
}
