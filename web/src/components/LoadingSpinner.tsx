type Size = 'sm' | 'md' | 'lg'

type Props = {
  /** Optional text under the rings (also exposed to assistive tech via role="status") */
  label?: string
  size?: Size
  /** Extra vertical padding for centered empty regions */
  padded?: boolean
  /** Use inside buttons next to text (compact, horizontal-friendly) */
  inline?: boolean
  /** Hide from assistive tech (parent control already has a name, e.g. submit button) */
  quiet?: boolean
  className?: string
}

/**
 * Branded dual-ring spinner for Firestore/auth waits and modal locks.
 */
export function LoadingSpinner({
  label,
  size = 'md',
  padded = false,
  inline = false,
  quiet = false,
  className = '',
}: Props) {
  const rootClass = [
    'loading-spinner',
    `loading-spinner--${size}`,
    padded ? 'loading-spinner--padded' : '',
    inline ? 'loading-spinner--inline' : '',
    quiet ? 'loading-spinner--quiet' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={rootClass}
      role={quiet ? undefined : 'status'}
      aria-live={quiet ? undefined : 'polite'}
      aria-hidden={quiet ? true : undefined}
    >
      <span className="loading-spinner__rings" aria-hidden>
        <span className="loading-spinner__ring loading-spinner__ring--a" />
        <span className="loading-spinner__ring loading-spinner__ring--b" />
      </span>
      {label ? <span className="loading-spinner__label">{label}</span> : null}
    </div>
  )
}
