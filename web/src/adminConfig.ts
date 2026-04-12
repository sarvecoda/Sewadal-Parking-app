import type { User } from 'firebase/auth'

/** Parking admin — only this account sees “Manage access”. Must match `web/functions/src/index.ts`. */
export const ADMIN_UID = 'qn5SgVc62lckW5pJmpNwV1Oqv9I2'

export const ADMIN_EMAIL = 'sarveshkum9999@gmail.com'

export function isAppAdmin(user: User | null | undefined): boolean {
  if (!user?.uid) return false
  return user.uid === ADMIN_UID
}
