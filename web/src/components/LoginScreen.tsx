import { useEffect, useState, type FormEvent } from 'react'
import {
  browserLocalPersistence,
  fetchSignInMethodsForEmail,
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

function maskEmailForUi(email: string): string {
  const at = email.indexOf('@')
  if (at <= 0) return email
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  const head = local.slice(0, Math.min(2, local.length))
  return `${head}•••@${domain}`
}

/** Starter form defaults; Firebase user must use the same email this app resolves to. */
const STARTER_USERNAME = 'snmparking'
const STARTER_PASSWORD = 'nirankar'

/**
 * Username + password (domain from `VITE_LOGIN_EMAIL_DOMAIN` or `VITE_FIREBASE_AUTH_DOMAIN`),
 * or full email if value contains `@`.
 * Forgot password: sends Firebase reset to `VITE_PASSWORD_RESET_EMAIL` if set, else to the
 * account for the username typed above.
 */
export function LoginScreen() {
  const [username, setUsername] = useState(STARTER_USERNAME)
  const [password, setPassword] = useState(STARTER_PASSWORD)
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
            'Missing email domain for username sign-in. Set VITE_FIREBASE_AUTH_DOMAIN (from Firebase) or VITE_LOGIN_EMAIL_DOMAIN in web/.env, then rebuild.',
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

  async function sendPasswordReset() {
    setResetFeedback(null)
    setResetNote('')
    setResetBusy(true)
    try {
      let target: string
      if (fixedResetEmail) {
        target = fixedResetEmail
      } else {
        try {
          target = resolveSignInIdentifier(username)
        } catch {
          setResetFeedback('err')
          setResetNote(
            domainConfigured
              ? 'Enter your username above first (same one you use to sign in), then tap Forgot password again.'
              : 'Set VITE_FIREBASE_AUTH_DOMAIN or VITE_LOGIN_EMAIL_DOMAIN in web/.env, or set VITE_PASSWORD_RESET_EMAIL to always send resets to one address.',
          )
          return
        }
      }

      const auth = getFirebaseAuth()

      if (!fixedResetEmail) {
        const methods = await fetchSignInMethodsForEmail(auth, target)
        if (methods.length > 0 && !methods.includes('password')) {
          setResetFeedback('err')
          setResetNote(
            'That address is not set up for a parking password (for example it may be Google-only). Use an account that has Email/Password in Firebase, or type the full email you were given for this app.',
          )
          return
        }
      }

      await sendPasswordResetEmail(auth, target)
      setResetFeedback('ok')
      setResetNote(
        `If an Email/Password account exists for ${maskEmailForUi(target)}, Firebase will send a message there—check inbox and spam and open the link once.`,
      )
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
          Firebase always stores a <strong>full email</strong> for each user (you cannot add only a
          short name there). Here you usually type just the part <strong>before @</strong>; the app
          fills in the rest to match your Firebase account. Or paste the whole email in the username
          field.
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
              setResetFeedback(null)
              setResetNote('')
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
              disabled={resetBusy}
              onClick={() => void sendPasswordReset()}
            >
              {resetBusy ? 'Sending…' : 'Forgot password?'}
            </button>
            <button type="button" className="link-button" onClick={applyGeneratedPassword}>
              Suggest strong password
            </button>
          </div>

          {resetFeedback && resetNote ? (
            <p
              className={
                resetFeedback === 'err'
                  ? 'form-error login-reset-inline'
                  : 'login-reset-inline login-reset-inline--ok'
              }
              role={resetFeedback === 'err' ? 'alert' : 'status'}
            >
              {resetNote}
            </p>
          ) : null}

          {error ? (
            <p className="login-error">{error}</p>
          ) : null}

          <button type="submit" className="btn btn-login" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
