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
        return 'Email/password sign-in is not enabled for this project. Ask an administrator to turn it on in Firebase Console.'
      default:
        break
    }
  }
  if (err instanceof Error && err.message) return err.message
  return 'Something went wrong. Please try again.'
}
