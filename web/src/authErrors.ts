/** User-facing messages for Firebase Auth error codes. */
export function formatAuthError(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code?: string }).code)
    switch (code) {
      case 'auth/invalid-email':
        return 'Enter a valid email address.'
      case 'auth/user-disabled':
        return 'This account has been disabled. Contact an administrator.'
      case 'auth/user-not-found':
        return 'No account found for this email.'
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Incorrect email or password.'
      case 'auth/invalid-login-credentials':
        return 'Incorrect email or password.'
      case 'auth/email-already-in-use':
        return 'An account already exists with this email.'
      case 'auth/weak-password':
        return 'Password is too weak. Use at least 8 characters and mix letters, numbers, and symbols.'
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a few minutes and try again.'
      case 'auth/network-request-failed':
        return 'Network error. Check your connection and try again.'
      case 'auth/operation-not-allowed': {
        const pid = import.meta.env.VITE_FIREBASE_PROJECT_ID
        const url = pid
          ? `https://console.firebase.google.com/project/${pid}/authentication/providers`
          : 'https://console.firebase.google.com/'
        return `Email/password is disabled for this Firebase project. Open the link below, enable “Email/Password”, then Save: ${url}`
      }
      case 'auth/expired-action-code':
      case 'auth/invalid-action-code':
        return 'This reset link was already used or has expired. Inbox “link preview” or security scanners sometimes open the link first — request a new reset from the sign-in page, then open the link once from your phone or a desktop mail app. For a more reliable flow, set the password-reset email template action URL to this app’s URL (see web/README.md).'
      default:
        break
    }
  }
  if (err instanceof Error && err.message) {
    const m = err.message.toLowerCase()
    if (
      m.includes('expired') ||
      m.includes('already been used') ||
      m.includes('invalid action code')
    ) {
      return 'This reset link was already used or has expired. Request a new reset from the sign-in page and open the link once without mail previews. See web/README.md to point reset emails at this app.'
    }
    return err.message
  }
  return 'Something went wrong. Please try again.'
}
