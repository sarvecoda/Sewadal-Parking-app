/**
 * Staff sign in with a short username; Firebase still stores an email.
 * - If `VITE_LOGIN_EMAIL_DOMAIN` is set, usernames map to `user@that-domain`.
 * - Otherwise the domain defaults to `VITE_FIREBASE_AUTH_DOMAIN` (e.g. `project.firebaseapp.com`),
 *   so `snmparking` → `snmparking@project.firebaseapp.com` — create that exact user in Firebase.
 * If someone types a full address (contains `@`), it is used as-is.
 */

/** Domain used after `@` for username-only sign-in (explicit env or Firebase auth host). */
export function getEffectiveLoginEmailDomain(): string | undefined {
  const explicit = import.meta.env.VITE_LOGIN_EMAIL_DOMAIN?.trim()
  if (explicit) return explicit
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim().toLowerCase()
  if (authDomain) return authDomain
  return undefined
}

export function normalizeLocalPart(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9._-]/g, '')
}

export function resolveSignInIdentifier(raw: string): string {
  const t = raw.trim().toLowerCase()
  if (t.includes('@')) return raw.trim()

  const domain = getEffectiveLoginEmailDomain()
  if (!domain) {
    throw new Error('MISSING_EMAIL_DOMAIN')
  }
  const local = normalizeLocalPart(raw)
  if (!local) {
    throw new Error('EMPTY_USERNAME')
  }
  return `${local}@${domain}`
}

export function isEmailDomainConfigured(): boolean {
  return Boolean(getEffectiveLoginEmailDomain())
}
