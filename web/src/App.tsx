import { useEffect, useMemo, useState } from 'react'
import type { User } from 'firebase/auth'
import { onAuthStateChanged } from 'firebase/auth'
import { LegacyLoginScreen } from './components/LegacyLoginScreen'
import { LoginScreen } from './components/LoginScreen'
import { MainScreen } from './components/MainScreen'
import { PasswordResetFromEmail } from './components/PasswordResetFromEmail'
import { getFirebaseAuth, getFirestoreDb, isFirebaseConfigured } from './firebase'

function readPasswordResetOobFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  const p = new URLSearchParams(window.location.search)
  return p.get('mode') === 'resetPassword' && p.get('oobCode') ? p.get('oobCode')! : null
}

export default function App() {
  const legacyLogin = import.meta.env.VITE_LEGACY_LOGIN === 'true'
  const [passwordResetOob, setPasswordResetOob] = useState<string | null>(
    readPasswordResetOobFromUrl,
  )

  const [legacyOk, setLegacyOk] = useState(
    () => legacyLogin && sessionStorage.getItem('sns_parking_legacy_session') === '1',
  )

  const firebaseReady = useMemo(() => isFirebaseConfigured(), [])

  const db = useMemo(() => {
    if (!firebaseReady) return null
    try {
      return getFirestoreDb()
    } catch {
      return null
    }
  }, [firebaseReady])

  const [authUser, setAuthUser] = useState<User | null | undefined>(() =>
    legacyLogin ? null : undefined,
  )

  useEffect(() => {
    if (!firebaseReady || legacyLogin || !db) return
    const auth = getFirebaseAuth()
    return onAuthStateChanged(auth, setAuthUser)
  }, [firebaseReady, legacyLogin, db])

  if (!firebaseReady) {
    return (
      <div className="setup-root">
        <h1>Firebase setup</h1>
        <p>
          Add a <strong>Web app</strong> in the Firebase console for project{' '}
          <code>sns-parking-app-blr-d40c7</code>, then copy{' '}
          <code>web/.env.example</code> to <code>web/.env</code> and fill in{' '}
          <code>VITE_FIREBASE_APP_ID</code> (and adjust other keys if needed). Restart{' '}
          <code>npm run dev</code>.
        </p>
        <p className="setup-muted">
          For sign-in: enable <strong>Authentication → Sign-in method → Email/Password</strong>, add
          users under <strong>Authentication → Users</strong> (email + password for this app).
        </p>
      </div>
    )
  }

  if (!db) {
    return (
      <div className="setup-root">
        <h1>Firebase error</h1>
        <p>
          Could not initialize Firebase. Check <code>web/.env</code> values.
        </p>
      </div>
    )
  }

  if (!legacyLogin && passwordResetOob) {
    return (
      <PasswordResetFromEmail
        oobCode={passwordResetOob}
        onFinished={() => setPasswordResetOob(null)}
      />
    )
  }

  if (legacyLogin) {
    if (!legacyOk) {
      return <LegacyLoginScreen onLoggedIn={() => setLegacyOk(true)} />
    }
    return <MainScreen db={db} onLegacyLogout={() => setLegacyOk(false)} />
  }

  if (authUser === undefined) {
    return (
      <div className="login-shell">
        <div className="login-card login-card--narrow">
          <p className="login-note login-note--muted">Checking sign-in…</p>
        </div>
      </div>
    )
  }

  if (!authUser) {
    return <LoginScreen />
  }

  return <MainScreen db={db} authUser={authUser} />
}
