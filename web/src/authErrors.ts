/** User-facing messages for Firebase Auth error codes. */
export function formatAuthError(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code?: string }).code)
    switch (code) {
      case 'auth/invalid-email':
        return 'Enter a valid email address.'
      case 'auth/user-disabled':
        return 'This account is disabled. Contact an admin.'
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
        return 'Use a stronger password (at least 8 characters).'
      case 'auth/too-many-requests':
        return 'Too many attempts. Wait a few minutes and try again.'
      case 'auth/network-request-failed':
        return 'Network problem. Check your connection and try again.'
      case 'auth/operation-not-allowed':
        return 'Password sign-in is not enabled yet. Ask an admin to turn it on.'
      case 'auth/expired-action-code':
      case 'auth/invalid-action-code':
        return 'This reset link is expired or already used. Request a new one and open it once from your mail app.'
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
      return 'This reset link is expired or already used. Request a new one from sign-in.'
    }
    return err.message
  }
  return 'Something went wrong. Please try again.'
}
