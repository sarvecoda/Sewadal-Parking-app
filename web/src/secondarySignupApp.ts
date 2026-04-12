import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAuth,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth'
import { getFirebaseAuth, getFirebaseWebConfig } from './firebase'

const HELPER_APP_NAME = 'signup-helper'

/**
 * Secondary Firebase app so `createUserWithEmailAndPassword` does not replace the admin session
 * on the primary app (Spark / no Admin SDK).
 */
function getSignupHelperApp(): FirebaseApp {
  const existing = getApps().find((a) => a.name === HELPER_APP_NAME)
  if (existing) return existing
  return initializeApp(getFirebaseWebConfig(), HELPER_APP_NAME)
}

/** Creates Email/Password user and asks Firebase to email them a password reset link. */
export async function createParkingUserAndSendPasswordReset(email: string): Promise<string> {
  const helperApp = getSignupHelperApp()
  const helperAuth = getAuth(helperApp)
  const tempPassword =
    'T' +
    Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) =>
      (b % 36).toString(36),
    ).join('') +
    '9z!'

  const { user } = await createUserWithEmailAndPassword(helperAuth, email, tempPassword)
  const uid = user.uid
  await signOut(helperAuth)

  const mainAuth = getFirebaseAuth()
  await sendPasswordResetEmail(mainAuth, email)
  return uid
}
