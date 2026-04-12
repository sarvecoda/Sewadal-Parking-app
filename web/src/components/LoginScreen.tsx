import { useEffect, useState, type FormEvent } from 'react'
import {
  browserLocalPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth'
import { formatAuthError } from '../authErrors'
import {
  isEmailDomainConfigured,
  normalizeLocalPart,
  resolveSignInIdentifier,
} from '../authIdentity'
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
 * Sign-in with **username** + password (mapped to `username@VITE_LOGIN_EMAIL_DOMAIN`),
 * or full **email** if the value contains `@`. Firebase Auth must have matching users.
 */
export function LoginScreen() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [forgotOpen, setForgotOpen] = useState(false)
  const [resetStatus, setResetStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [resetMessage, setResetMessage] = useState('')

  const domainConfigured = isEmailDomainConfigured()

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

  function resolveOrSetError(): string | null {
    try {
      return resolveSignInIdentifier(username)
    } catch (e) {
      if (e instanceof Error) {
        if (e.message === 'MISSING_EMAIL_DOMAIN') {
          setError(
            'Set VITE_LOGIN_EMAIL_DOMAIN in web/.env (same domain as Firebase user emails, e.g. park.yourorg.com).',
          )
        } else if (e.message === 'EMPTY_USERNAME') {
          setError('Enter your username.')
        } else {
          setError(e.message)
        }
      }
      return null
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const authEmail = resolveOrSetError()
    if (!authEmail) return
    setBusy(true)
    try {
      const auth = getFirebaseAuth()
      await signInWithEmailAndPassword(auth, authEmail, password)
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
    void navigator.clipboard.writeText(next).catch(() => {})
    setError('')
  }

  async function sendReset() {
    const local = normalizeLocalPart(username)
    if (!local && !username.trim().includes('@')) {
      setResetMessage('Enter your username on the sign-in form above, then open “Forgot password?” again.')
      setResetStatus('error')
      return
    }
    let authEmail: string
    try {
      authEmail = resolveSignInIdentifier(username)
    } catch {
      setResetMessage(
        domainConfigured
          ? 'Enter a valid username on the sign-in form first.'
          : 'This app is not configured for username sign-in. Ask your administrator.',
      )
      setResetStatus('error')
      return
    }

    setResetStatus('sending')
    setResetMessage('')
    try {
      const auth = getFirebaseAuth()
      // Omit custom ActionCodeSettings: wrong continueUrl is a common cause of
      // "link expired / already used" (and some mail scanners prefetch URLs).
      await sendPasswordResetEmail(auth, authEmail)
      setResetStatus('sent')
      setResetMessage(
        'If that account exists, a reset message was sent. Check spam/promotions and open the link once, in this browser if possible.',
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
          Sign in with your <strong>username</strong> and password. Admins create accounts in
          Firebase Authentication — each username matches the part before{' '}
          <strong>@</strong> in that account’s email.
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="login-username">
            Username
          </label>
          <input
            id="login-username"
            className="field-input"
            name="username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder={domainConfigured ? 'e.g. mandeep' : 'email or username'}
            value={username}
            onChange={(e) => {
              setUsername(e.target.value)
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
            <strong>Forgot password?</strong> sends a reset link to the address Firebase has on file
            for your username — nothing is shown on screen. Some inboxes scan links; if the first
            click fails, use <strong>Resend</strong> after a minute or open the link from a
            computer. Mark sender as “Not spam” if messages land in spam.
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
            Uses the <strong>username</strong> you typed on the sign-in screen. We’ll send a
            secure reset link from Google/Firebase to the email on file for that account — your
            username stays private here.
          </p>
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
          <div className="modal-footer modal-footer--stack">
            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={() => void sendReset()}
              disabled={
                resetStatus === 'sending' ||
                resetStatus === 'sent' ||
                (!normalizeLocalPart(username) && !username.trim().includes('@'))
              }
            >
              {resetStatus === 'sending'
                ? 'Sending…'
                : resetStatus === 'sent'
                  ? 'Check your email'
                  : 'Send reset link'}
            </button>
            {resetStatus === 'sent' || resetStatus === 'error' ? (
              <button
                type="button"
                className="btn btn-secondary btn-block"
                onClick={() => {
                  setResetStatus('idle')
                  setResetMessage('')
                  void sendReset()
                }}
              >
                Resend link
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={() => setForgotOpen(false)}
              disabled={resetStatus === 'sending'}
            >
              Close
            </button>
          </div>
        </ModalFrame>
      ) : null}
    </div>
  )
}
