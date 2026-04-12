import { useCallback, useMemo, useState } from 'react'
import { LoginScreen, isSessionValid } from './components/LoginScreen'
import { MainScreen } from './components/MainScreen'
import { getFirestoreDb, isFirebaseConfigured } from './firebase'

export default function App() {
  const [loggedIn, setLoggedIn] = useState(isSessionValid)
  const firebaseReady = useMemo(() => isFirebaseConfigured(), [])

  const db = useMemo(() => {
    if (!firebaseReady) return null
    try {
      return getFirestoreDb()
    } catch {
      return null
    }
  }, [firebaseReady])

  const handleLoggedIn = useCallback(() => setLoggedIn(true), [])
  const handleLogout = useCallback(() => setLoggedIn(false), [])

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
          Firestore rules must allow reads and writes from the web client (same as your Android
          app), or authenticated access if you add sign-in later.
        </p>
      </div>
    )
  }

  if (!db) {
    return (
      <div className="setup-root">
        <h1>Firebase error</h1>
        <p>Could not initialize Firebase. Check <code>web/.env</code> values.</p>
      </div>
    )
  }

  if (!loggedIn) {
    return <LoginScreen onLoggedIn={handleLoggedIn} />
  }

  return <MainScreen db={db} onLogout={handleLogout} />
}
