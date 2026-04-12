import { useState, type FormEvent } from 'react'

const SESSION_KEY = 'sns_parking_web_session'

export function isSessionValid(): boolean {
  return sessionStorage.getItem(SESSION_KEY) === '1'
}

export function loginSession(): void {
  sessionStorage.setItem(SESSION_KEY, '1')
}

export function logoutSession(): void {
  sessionStorage.removeItem(SESSION_KEY)
}

type Props = {
  onLoggedIn: () => void
}

/** Same credentials as Android `MainActivity`. */
export function LoginScreen({ onLoggedIn }: Props) {
  const [userName, setUserName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password === 'nirankar' && userName === 'nirankar') {
      loginSession()
      onLoggedIn()
      return
    }
    setError('The username or the password is wrong')
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <h1 className="login-brand">SNM Bangalore</h1>
        <p className="login-sub">Parking</p>
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
