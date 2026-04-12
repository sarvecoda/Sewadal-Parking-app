import type { User } from 'firebase/auth'

/** Expected admin UID (Firebase Console). Also allow `ADMIN_EMAIL` so the button works if UID differs. */
export const ADMIN_UID = 'Ayisu6zH1OgqQ4XM9ggk6y1mpxS2'

export const ADMIN_EMAIL = 'sarveshkum9999@gmail.com'

function normEmail(e: string | null | undefined): string {
  return (e ?? '').trim().toLowerCase()
}

/** True when this signed-in Firebase user is the parking admin (UID or email match). */
export function isAppAdmin(user: User | null | undefined): boolean {
  if (!user) return false
  if (user.uid === ADMIN_UID) return true
  if (normEmail(user.email) === normEmail(ADMIN_EMAIL)) return true
  return false
}
