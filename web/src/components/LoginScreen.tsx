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
import { submitAccessRequestFirestore } from '../accessControlRepository'
import { getFirebaseAuth, getFirestoreDb } from '../firebase'
import { formatFirestoreError } from '../vehicleRepository'

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

function looksLikeEmail(s: string): boolean {
  const t = s.trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)
}

type AuthMode = 'signIn' | 'requestAccess'

/**
 * Sign in: email or short username + password.
 * Request access: writes a Firestore pending request (no paid backend). Admin approves in-app.
 */
export function LoginScreen() {
  const [authMode, setAuthMode] = useState<AuthMode>('signIn')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [requestEmail, setRequestEmail] = useState('')
  const [requestNote, setRequestNote] = useState('')
  const [requestOk, setRequestOk] = useState('')
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

  function switchMode(next: AuthMode) {
    setAuthMode(next)
    setError('')
    setRequestOk('')
    setResetFeedback(null)
    setResetNote('')
  }

  function resolveOrSetError(): string | null {
    try {
      return resolveSignInIdentifier(username)
    } catch (e) {
      if (e instanceof Error) {
        if (e.message === 'MISSING_EMAIL_DOMAIN') {
          setError(
            'Missing email domain for username sign-in. Set VITE_FIREBASE_AUTH_DOMAIN (from Firebase) or VITE_LOGIN_EMAIL_DOMAIN in web/.env, then rebuild—or use your full email here.',
          )
        } else if (e.message === 'EMPTY_USERNAME') {
          setError('Enter your email or username.')
        } else {
          setError(e.message)
        }
      }
      return null
    }
  }

  async function handleSignIn(e: FormEvent) {
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

  async function handleRequestAccess(e: FormEvent) {
    e.preventDefault()
    setError('')
    setRequestOk('')
    const email = requestEmail.trim().toLowerCase()
    if (!looksLikeEmail(email)) {
      setError('Enter a valid email (include @ and domain).')
      return
    }
    setBusy(true)
    try {
      const db = getFirestoreDb()
      await submitAccessRequestFirestore(db, email, requestNote)
      setRequestOk(
        'Request sent. When the admin approves it, Firebase will email you a link to set your password—then sign in here.',
      )
    } catch (err) {
      setError(formatFirestoreError(err))
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
              ? 'Enter your email or username above first, then tap Forgot password again.'
              : 'Enter your full email above, or set VITE_FIREBASE_AUTH_DOMAIN / VITE_LOGIN_EMAIL_DOMAIN in web/.env for short usernames.',
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
            'That address is not set up for a parking password (for example it may be Google-only). Use an account that has Email/Password in Firebase, or type the full email you use for this app.',
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

        <div className="login-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={authMode === 'signIn'}
            className={`login-tab${authMode === 'signIn' ? ' login-tab--active' : ''}`}
            onClick={() => switchMode('signIn')}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={authMode === 'requestAccess'}
            className={`login-tab${authMode === 'requestAccess' ? ' login-tab--active' : ''}`}
            onClick={() => switchMode('requestAccess')}
          >
            Request access
          </button>
        </div>

        {authMode === 'signIn' ? (
          <>
            <p className="login-note login-note--muted">
              Use your <strong>email</strong> (full address) or a short <strong>username</strong> if
              your account was set up that way.
            </p>
            <form className="login-form" onSubmit={(e) => void handleSignIn(e)}>
              <label className="field-label" htmlFor="login-username">
                Email or username
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
                placeholder={domainConfigured ? 'e.g. admin or you@email.com' : 'your@email.com'}
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
          </>
        ) : (
          <>
            <p className="login-note login-note--muted">
              New staff: enter your <strong>work email</strong> and an optional note. Your account is
              created only after the <strong>admin</strong> approves the request (you must be signed
              out here). You will then get a link to choose your password.
            </p>
            <form className="login-form" onSubmit={(e) => void handleRequestAccess(e)}>
              <label className="field-label" htmlFor="request-email">
                Email
              </label>
              <input
                id="request-email"
                className="field-input"
                name="email"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="you@example.com"
                value={requestEmail}
                onChange={(e) => {
                  setRequestEmail(e.target.value)
                  setError('')
                  setRequestOk('')
                }}
              />

              <label className="field-label" htmlFor="request-note">
                Note <span className="field-optional">(optional)</span>
              </label>
              <textarea
                id="request-note"
                className="field-input field-input--textarea"
                name="note"
                rows={3}
                maxLength={800}
                placeholder="Name or role, so the admin knows who you are"
                value={requestNote}
                onChange={(e) => {
                  setRequestNote(e.target.value)
                  setError('')
                  setRequestOk('')
                }}
              />

              {requestOk ? (
                <p className="login-reset-inline login-reset-inline--ok" role="status">
                  {requestOk}
                </p>
              ) : null}

              {error ? (
                <p className="login-error">{error}</p>
              ) : null}

              <button type="submit" className="btn btn-login" disabled={busy}>
                {busy ? 'Sending request…' : 'Send request'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
