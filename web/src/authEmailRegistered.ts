import { getFirebaseWebConfig } from './firebase'

/**
 * Uses Identity Toolkit `createAuthUri` (same API key as the web app) to see if an email is
 * still registered for Email/Password. Used to prune Firestore when someone deletes the user in
 * Firebase Authentication — `fetchSignInMethodsForEmail` is unreliable when enumeration
 * protection is enabled.
 */
export async function emailHasFirebasePasswordAccount(email: string): Promise<boolean> {
  const em = email.trim()
  if (!em) return false
  const { apiKey } = getFirebaseWebConfig()
  if (!apiKey?.trim()) return true

  const continueUri =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : `https://${getFirebaseWebConfig().authDomain}`

  try {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${encodeURIComponent(apiKey)}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: em,
        continueUri,
        providerId: 'password',
      }),
    })
    if (!res.ok) return true
    const json = (await res.json()) as { registered?: boolean }
    if (typeof json.registered !== 'boolean') return true
    return json.registered === true
  } catch {
    return true
  }
}
