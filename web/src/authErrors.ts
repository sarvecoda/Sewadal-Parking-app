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
      case 'auth/operation-not-allowed':
        return 'Email/password sign-in is turned off for this project. An administrator needs to enable “Email/Password” under Firebase Authentication → Sign-in method.'
      case 'auth/expired-action-code':
      case 'auth/invalid-action-code':
        return 'This reset link was already used or has expired. Inbox previews sometimes open the link first—request a new reset, then open the link once from your mail app. Ask an admin to point the password-reset email “action URL” at this app’s address if this keeps happening.'
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
      return 'This reset link was already used or has expired. Request a new reset and open the link once without mail previews.'
    }
    return err.message
  }
  return 'Something went wrong. Please try again.'
}
