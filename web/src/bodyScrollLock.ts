/**
 * Ref-counted body scroll lock so nested modals (e.g. master list + confirm)
 * cannot leave `overflow: hidden` when unmount order differs.
 */
let depth = 0
let savedBodyOverflow = ''
let savedHtmlOverflow = ''

/** Call from `useEffect(() => subscribeBodyScrollLock(), [])`. */
export function subscribeBodyScrollLock(): () => void {
  if (depth === 0) {
    savedBodyOverflow = document.body.style.overflow
    savedHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
  }
  depth++

  return () => {
    depth = Math.max(0, depth - 1)
    if (depth === 0) {
      document.body.style.overflow = savedBodyOverflow
      document.documentElement.style.overflow = savedHtmlOverflow
    }
  }
}
