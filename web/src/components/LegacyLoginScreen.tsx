import { useState, type FormEvent } from 'react'

const SESSION_KEY = 'sns_parking_legacy_session'

type Props = {
  onLoggedIn: () => void
}

/** Original fixed demo login — only when `VITE_LEGACY_LOGIN=true` in `.env`. */
export function LegacyLoginScreen({ onLoggedIn }: Props) {
  const [userName, setUserName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password === 'nirankar' && userName === 'nirankar') {
      sessionStorage.setItem(SESSION_KEY, '1')
      onLoggedIn()
      return
    }
    setError('The username or the password is wrong')
  }

  return (
    <div className="login-shell">
      <div className="login-card login-card--narrow">
        <h1 className="login-brand">SNM Bangalore</h1>
        <p className="login-sub">Parking</p>
        <p className="login-note">
          Legacy demo login. Set <code className="login-code">VITE_LEGACY_LOGIN=false</code> and
          use Firebase email sign-in when your team is ready.
        </p>
        <form className="login-form" onSubmit={handleSubmit}>
          <label className="field-label">
            Username
            <input
              className="field-input"
              name="username"
              autoComplete="username"
              value={userName}
              onChange={(e) => {
                setUserName(e.target.value)
                setError('')
              }}
            />
          </label>
          <label className="field-label">
            Password
            <input
              className="field-input"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError('')
              }}
            />
          </label>
          {error ? <p className="login-error">{error}</p> : null}
          <button type="submit" className="btn btn-login">
            Login
          </button>
        </form>
      </div>
    </div>
  )
}

export function clearLegacySession(): void {
  sessionStorage.removeItem(SESSION_KEY)
}
