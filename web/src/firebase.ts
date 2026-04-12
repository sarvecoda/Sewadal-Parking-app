import { getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, signOut, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getFunctions, type Functions } from 'firebase/functions'

function readConfig() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
    appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
  }
}

export function isFirebaseConfigured(): boolean {
  const c = readConfig()
  if (!c.apiKey?.trim() || !c.projectId?.trim()) return false
  if (!c.appId?.trim()) return false
  if (c.appId.includes('REPLACE')) return false
  return true
}

let app: FirebaseApp | null = null
let db: Firestore | null = null
let auth: Auth | null = null
let functions: Functions | null = null

export function getFirestoreDb(): Firestore {
  if (db) return db
  if (!isFirebaseConfigured()) {
    throw new Error(
      'Firebase is not configured. Copy web/.env.example to web/.env and set VITE_FIREBASE_APP_ID from Firebase Console → Project settings → Your apps → Web app.',
    )
  }
  const config = readConfig()
  app = getApps().length > 0 ? getApps()[0]! : initializeApp(config)
  db = getFirestore(app)
  return db
}

/** Uses the same Firebase app as Firestore. Call after `getFirestoreDb()` or it will init the app. */
export function getFirebaseAuth(): Auth {
  if (auth) return auth
  if (!getApps().length) {
    getFirestoreDb()
  }
  auth = getAuth(getApps()[0]!)
  return auth
}

export async function signOutUser(): Promise<void> {
  await signOut(getFirebaseAuth())
}

/** Cloud Functions (same project). Region must match `functions/src/index.ts` (`setGlobalOptions`). */
export function getFirebaseFunctions(): Functions {
  if (functions) return functions
  if (!getApps().length) {
    getFirestoreDb()
  }
  const region = import.meta.env.VITE_FUNCTIONS_REGION?.trim() || 'asia-south1'
  functions = getFunctions(getApps()[0]!, region)
  return functions
}

