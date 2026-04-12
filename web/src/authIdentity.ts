/**
 * Staff sign in with a short username; Firebase still stores an email.
 * Set `VITE_LOGIN_EMAIL_DOMAIN` to the domain part of those accounts (e.g. `park.yourorg.com`).
 * If someone types a full address (contains `@`), it is used as-is.
 */

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

  const domain = import.meta.env.VITE_LOGIN_EMAIL_DOMAIN?.trim()
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
  return Boolean(import.meta.env.VITE_LOGIN_EMAIL_DOMAIN?.trim())
}
