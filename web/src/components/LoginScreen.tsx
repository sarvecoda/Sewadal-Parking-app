import { useEffect, useState, type FormEvent } from 'react'
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  setPersistence,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
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

function looksLikeEmail(s: string): boolean {
  const t = s.trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)
}

type AuthMode = 'signIn' | 'signUp'

/**
 * Sign in: email or short username + password (see authIdentity).
 * Create account: full email + password — creates Firebase user and sets display name to local part.
 */
export function LoginScreen() {
  const [authMode, setAuthMode] = useState<AuthMode>('signIn')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupPassword2, setSignupPassword2] = useState('')
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

  async function handleSignUp(e: FormEvent) {
    e.preventDefault()
    setError('')
    const email = signupEmail.trim().toLowerCase()
    if (!looksLikeEmail(email)) {
      setError('Enter a valid email (include @ and domain, e.g. you@gmail.com).')
      return
    }
    if (signupPassword.length < 6) {
      setError('Password must be at least 6 characters (8 or more is better).')
      return
    }
    if (signupPassword !== signupPassword2) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const auth = getFirebaseAuth()
      const cred = await createUserWithEmailAndPassword(auth, email, signupPassword)
      const localPart = email.split('@')[0] ?? email
      await updateProfile(cred.user, { displayName: localPart })
    } catch (err) {
      setError(formatAuthError(err))
    } finally {
      setBusy(false)
    }
  }

  function applyGeneratedPassword() {
    const next = generateStrongPassword()
    if (authMode === 'signUp') {
      setSignupPassword(next)
      setSignupPassword2(next)
    } else {
      setPassword(next)
    }
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
      } else if (authMode === 'signUp') {
        const e = signupEmail.trim().toLowerCase()
        if (!looksLikeEmail(e)) {
          setResetFeedback('err')
          setResetNote('Enter your email on this screen first, then tap Forgot password again.')
          return
        }
        target = e
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
            aria-selected={authMode === 'signUp'}
            className={`login-tab${authMode === 'signUp' ? ' login-tab--active' : ''}`}
            onClick={() => switchMode('signUp')}
          >
            Create account
          </button>
        </div>

        {authMode === 'signIn' ? (
          <>
            <p className="login-note login-note--muted">
              Use your <strong>email</strong> (full address) or a short <strong>username</strong> if
              your account was created that way. Password is the one you chose (or were given).
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
              Add yourself here with your <strong>email</strong> and a password—we create your
              account in Firebase. Your <strong>username</strong> in the app will be the part
              before <strong>@</strong> (e.g. <code className="login-code">pat</code> from{' '}
              <code className="login-code">pat@gmail.com</code>).
            </p>
            <form className="login-form" onSubmit={(e) => void handleSignUp(e)}>
              <label className="field-label" htmlFor="signup-email">
                Email
              </label>
              <input
                id="signup-email"
                className="field-input"
                name="email"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="you@example.com"
                value={signupEmail}
                onChange={(e) => {
                  setSignupEmail(e.target.value)
                  setError('')
                  setResetFeedback(null)
                  setResetNote('')
                }}
              />

              <div className="login-password-row">
                <label className="field-label login-password-label" htmlFor="signup-password">
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
                id="signup-password"
                className="field-input"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={signupPassword}
                onChange={(e) => {
                  setSignupPassword(e.target.value)
                  setError('')
                }}
              />

              <label className="field-label" htmlFor="signup-password2">
                Confirm password
              </label>
              <input
                id="signup-password2"
                className="field-input"
                name="password2"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={signupPassword2}
                onChange={(e) => {
                  setSignupPassword2(e.target.value)
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
                {busy ? 'Creating account…' : 'Create account'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
