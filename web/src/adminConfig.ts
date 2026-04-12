import type { User } from 'firebase/auth'

/** Parking admin — only this account sees “Manage access”. Must match `web/firestore.rules` (`isParkingAdmin`). */
export const ADMIN_UID = 'Ayisu6zH1OgqQ4XM9ggk6y1mpxS2'

export const ADMIN_EMAIL = 'sarveshkum9999@gmail.com'

export function isAppAdmin(user: User | null | undefined): boolean {
  if (!user?.uid) return false
  return user.uid === ADMIN_UID
}
