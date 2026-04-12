/** User-facing text for Firebase callable (`httpsCallable`) failures. */
export function formatCallableError(err: unknown): string {
  if (err instanceof Error) return err.message || 'Request failed.'
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: string }).message) || 'Request failed.'
  }
  return 'Request failed. Try again.'
}
