/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_STORAGE_BUCKET: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string
  readonly VITE_FIREBASE_APP_ID: string
  /** Set to `"true"` to use the old fixed demo login instead of Firebase Email/Password. */
  /** Firebase callable region (default `asia-south1`). Must match Cloud Functions deployment. */
  readonly VITE_FUNCTIONS_REGION?: string
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
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
