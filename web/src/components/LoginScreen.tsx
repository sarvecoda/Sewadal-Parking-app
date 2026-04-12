import { useEffect, useState, type FormEvent } from 'react'
import {
  browserLocalPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth'
import { formatAuthError } from '../authErrors'
import { getFirebaseAuth } from '../firebase'
import { ModalFrame } from './ModalFrame'

function generateStrongPassword(length = 18): string {
  const lower = 'abcdefghjkmnpqrstuvwxyz'
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ'
  const digits = '23456789'
  const symbols = '!@#$%&*-'
  const all = lower + upper + digits + symbols
  const out = new Uint32Array(length)
  crypto.getRandomValues(out)
  let s = ''
  s += lower[out[0]! % lower.length]
  s += upper[out[1]! % upper.length]
  s += digits[out[2]! % digits.length]
  s += symbols[out[3]! % symbols.length]
  for (let i = 4; i < length; i++) {
    s += all[out[i]! % all.length]
  }
  const arr = s.split('')
  for (let i = arr.length - 1; i > 0; i--) {
    const j = out[i % out.length]! % (i + 1)
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
  return arr.join('')
}

/**
 * Firebase Email/Password sign-in. Enable Authentication → Email/Password in the
 * Firebase Console and create users there (Authentication → Users → Add user).
 */
export function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [forgotOpen, setForgotOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetStatus, setResetStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [resetMessage, setResetMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const auth = getFirebaseAuth()
        await setPersistence(auth, browserLocalPersistence)
      } catch {
        if (!cancelled) setError('Could not initialize sign-in. Check Firebase configuration.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const auth = getFirebaseAuth()
      await signInWithEmailAndPassword(auth, email.trim(), password)
    } catch (err) {
      setError(formatAuthError(err))
    } finally {
      setBusy(false)
    }
  }

  function applyGeneratedPassword() {
    const next = generateStrongPassword()
    setPassword(next)
    setShowPassword(true)
    void navigator.clipboard.writeText(next).catch(() => {
      /* clipboard may be denied — field still updated */
    })
    setError('')
  }

  async function sendReset() {
    const addr = resetEmail.trim() || email.trim()
    if (!addr) {
      setResetMessage('Enter your email address.')
      setResetStatus('error')
      return
    }
    setResetStatus('sending')
    setResetMessage('')
    try {
      const auth = getFirebaseAuth()
      await sendPasswordResetEmail(auth, addr, {
        url: `${window.location.origin}${window.location.pathname}`,
        handleCodeInApp: false,
      })
      setResetStatus('sent')
      setResetMessage(
        'If an account exists for that address, Google sent a reset link. Check your inbox and spam folder.',
      )
    } catch (err) {
      setResetStatus('error')
      setResetMessage(formatAuthError(err))
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <h1 className="login-brand">SNM Bangalore</h1>
        <p className="login-sub">Parking</p>
        <p className="login-note login-note--muted">
          Sign in with the email and password for your account in Firebase Authentication.
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            className="field-input"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError('')
            }}
          />

          <div className="login-password-row">
            <label className="field-label login-password-label" htmlFor="login-password">
              Password
            </label>
            <button
              type="button"
              className="link-button"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <input
            id="login-password"
            className="field-input"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError('')
            }}
          />

          <div className="login-row-actions">
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setResetEmail(email)
                setForgotOpen(true)
                setResetStatus('idle')
                setResetMessage('')
              }}
            >
              Forgot password?
            </button>
            <button type="button" className="link-button" onClick={applyGeneratedPassword}>
              Suggest strong password
            </button>
          </div>
          <p className="login-microcopy">
            <strong>Forgot password?</strong> sends a secure reset link from Google/Firebase to
            the email you enter (standard “forgot password” email — we do not email a random
            password). Use <strong>Suggest strong password</strong> to fill and copy a strong
            password when setting one in the reset flow or in Firebase Console.
          </p>

          {error ? <p className="login-error">{error}</p> : null}

          <button type="submit" className="btn btn-login" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>

      {forgotOpen ? (
        <ModalFrame
          title="Reset password"
          titleId="reset-title"
          onClose={() => {
            setForgotOpen(false)
            setResetStatus('idle')
            setResetMessage('')
          }}
          locked={resetStatus === 'sending'}
        >
          <p className="modal-lead">
            Enter the email for your parking app account. Firebase will send a link to choose a
            new password.
          </p>
          <label className="field-label field-label--modal" htmlFor="reset-email">
            Email
          </label>
          <input
            id="reset-email"
            className="field-input"
            type="email"
            autoComplete="email"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
          />
          {resetMessage ? (
            <p
              className={
                resetStatus === 'error'
                  ? 'form-error login-reset-msg'
                  : 'login-reset-msg login-reset-msg--ok'
              }
              role={resetStatus === 'error' ? 'alert' : 'status'}
            >
              {resetMessage}
            </p>
          ) : null}
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setForgotOpen(false)}
              disabled={resetStatus === 'sending'}
            >
              Close
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void sendReset()}
              disabled={resetStatus === 'sending' || resetStatus === 'sent'}
            >
              {resetStatus === 'sending'
                ? 'Sending…'
                : resetStatus === 'sent'
                  ? 'Email sent'
                  : 'Send reset link'}
            </button>
          </div>
        </ModalFrame>
      ) : null}
    </div>
  )
}
