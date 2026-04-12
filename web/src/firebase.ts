import { getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { getFirestore, type Firestore } from 'firebase/firestore'

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
