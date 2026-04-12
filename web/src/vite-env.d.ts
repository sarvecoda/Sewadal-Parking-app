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
   * Domain for username-only sign-in (e.g. `park.yourorg.com`). Firebase users must exist as
   * `username@park.yourorg.com`. Omit only if everyone types a full email in the username field.
   */
  readonly VITE_LOGIN_EMAIL_DOMAIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
