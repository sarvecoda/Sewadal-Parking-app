/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_STORAGE_BUCKET: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string
  readonly VITE_FIREBASE_APP_ID: string
  /** Set to `"true"` to use the old fixed demo login instead of Firebase Email/Password. */
  readonly VITE_LEGACY_LOGIN?: string
  /**
   * Optional domain for username-only sign-in (e.g. `park.yourorg.com`). If omitted, the app uses
   * `VITE_FIREBASE_AUTH_DOMAIN` so `user` maps to `user@{project}.firebaseapp.com`.
   */
  readonly VITE_LOGIN_EMAIL_DOMAIN?: string
  /**
   * If set, "Forgot password?" sends Firebase’s reset email to this address only (one tap, no modal).
   * Must be an existing Firebase Authentication user email.
   */
  readonly VITE_PASSWORD_RESET_EMAIL?: string
  /**
   * OAuth 2.0 **Web client** ID (ends in `.apps.googleusercontent.com`) from Google Cloud Console
   * → APIs & Credentials → OAuth client (Web application). Add this app’s URL to **Authorized
   * JavaScript origins** so “Choose Google account” can fill the email field.
   */
  readonly VITE_GOOGLE_OAUTH_WEB_CLIENT_ID?: string
  /** Firestore collection for master vehicle list (default: my_new_collection). */
  readonly VITE_FIRESTORE_MASTER_COLLECTION?: string
  /** Firestore collection for today’s vehicle list (default: my_new_collection_1). */
  readonly VITE_FIRESTORE_TODAY_COLLECTION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
