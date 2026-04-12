import { useEffect, useState, type FormEvent } from 'react'
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth'
import { formatAuthError } from '../authErrors'
import { getFirebaseAuth } from '../firebase'

type Phase = 'checking' | 'form' | 'invalid'

/**
 * Handles Firebase password-reset links when the email template action URL
 * points at this app. Query: ?mode=resetPassword&oobCode=...
 */
export function PasswordResetFromEmail({
  oobCode,
  onFinished,
}: {
  oobCode: string
  onFinished: () => void
}) {
  const [phase, setPhase] = useState<Phase>('checking')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const auth = getFirebaseAuth()
        const addr = await verifyPasswordResetCode(auth, oobCode)
        if (!cancelled) {
          setEmail(addr)
          setPhase('form')
        }
      } catch (err) {
        if (!cancelled) {
          setError(formatAuthError(err))
          setPhase('invalid')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [oobCode])

  function clearActionFromUrl() {
    const path = window.location.pathname || '/'
    window.history.replaceState({}, '', path)
    onFinished()
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Use at least 8 characters.')
      return
    }
    if (password !== password2) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const auth = getFirebaseAuth()
      await confirmPasswordReset(auth, oobCode, password)
      clearActionFromUrl()
    } catch (err) {
      setError(formatAuthError(err))
    } finally {
      setBusy(false)
    }
  }

  if (phase === 'checking') {
    return (
      <div className="login-shell">
        <div className="login-card">
          <p className="login-note login-note--muted">Checking reset link…</p>
        </div>
      </div>
    )
  }

  if (phase === 'invalid') {
    return (
      <div className="login-shell">
        <div className="login-card">
          <h1 className="login-brand">Reset link</h1>
          <p className="login-error" role="alert">
            {error}
          </p>
          <p className="login-note login-note--muted">
            Request a new email from the sign-in screen. If you use Outlook or corporate mail,
            try opening the link from a phone or turn off link preview for the message.
          </p>
          <button type="button" className="btn btn-login" onClick={() => clearActionFromUrl()}>
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <h1 className="login-brand">New password</h1>
        <p className="login-note login-note--muted">
          Account <strong>{email}</strong>
        </p>
        <form className="login-form" onSubmit={(e) => void handleSubmit(e)}>
          <label className="field-label" htmlFor="reset-pw1">
            New password
          </label>
          <input
            id="reset-pw1"
            className="field-input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError('')
            }}
          />
          <label className="field-label" htmlFor="reset-pw2">
            Confirm password
          </label>
          <input
            id="reset-pw2"
            className="field-input"
            type="password"
            autoComplete="new-password"
            value={password2}
            onChange={(e) => {
              setPassword2(e.target.value)
              setError('')
            }}
          />
          {error ? (
            <p className="login-error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="btn btn-login" disabled={busy}>
            {busy ? 'Saving…' : 'Save password'}
          </button>
          <button type="button" className="link-button login-reset-cancel" onClick={() => clearActionFromUrl()}>
            Cancel
          </button>
        </form>
      </div>
    </div>
  )
}
