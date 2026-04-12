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
  resolveSignInIdentifier,
} from '../authIdentity'
import { getFirebaseAuth } from '../firebase'

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

const fixedResetEmail = import.meta.env.VITE_PASSWORD_RESET_EMAIL?.trim() ?? ''

/**
 * Username + password (see `VITE_LOGIN_EMAIL_DOMAIN`), or full email if value contains `@`.
 * Optional `VITE_PASSWORD_RESET_EMAIL`: one-tap forgot password sends Firebase reset to that address only.
 */
export function LoginScreen() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [resetBusy, setResetBusy] = useState(false)
  const [resetFeedback, setResetFeedback] = useState<'ok' | 'err' | null>(null)
  const [resetNote, setResetNote] = useState('')

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
            'Set VITE_LOGIN_EMAIL_DOMAIN in web/.env (same domain as Firebase user emails).',
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

  async function sendFixedReset() {
    if (!fixedResetEmail) return
    setResetFeedback(null)
    setResetNote('')
    setResetBusy(true)
    try {
      const auth = getFirebaseAuth()
      await sendPasswordResetEmail(auth, fixedResetEmail)
      setResetFeedback('ok')
      setResetNote('If this address has an account, Google sent a reset link. Check inbox and spam.')
    } catch (err) {
      setResetFeedback('err')
      setResetNote(formatAuthError(err))
    } finally {
      setResetBusy(false)
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <h1 className="login-brand">SNM Bangalore</h1>
        <p className="login-sub">Parking</p>
        <p className="login-note login-note--muted">
          Sign in with your <strong>username</strong> and password. (First account is created in
          Firebase Console — see project README.)
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
            placeholder={domainConfigured ? 'e.g. admin' : 'email or username'}
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
            {fixedResetEmail ? (
              <button
                type="button"
                className="link-button"
                disabled={resetBusy}
                onClick={() => void sendFixedReset()}
              >
                {resetBusy ? 'Sending…' : 'Forgot password?'}
              </button>
            ) : null}
            <button type="button" className="link-button" onClick={applyGeneratedPassword}>
              Suggest strong password
            </button>
          </div>

          {resetFeedback && resetNote ? (
            <p
              className={
                resetFeedback === 'err' ? 'form-error login-reset-inline' : 'login-reset-inline login-reset-inline--ok'
              }
              role={resetFeedback === 'err' ? 'alert' : 'status'}
            >
              {resetNote}
            </p>
          ) : null}

          {error ? <p className="login-error">{error}</p> : null}

          <button type="submit" className="btn btn-login" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
