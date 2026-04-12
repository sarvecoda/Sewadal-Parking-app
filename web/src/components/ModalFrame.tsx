import {
  useCallback,
  useEffect,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { subscribeBodyScrollLock } from '../bodyScrollLock'

type Props = {
  title: string
  titleId: string
  onClose: () => void
  children: ReactNode
  /** Taller sheet for scrollable lists */
  variant?: 'default' | 'tall'
  /** Backdrop click calls onClose (default true) */
  closeOnBackdrop?: boolean
  /** Block backdrop / × while a write is in progress */
  locked?: boolean
  /** Extra class on the sheet */
  className?: string
}

export function ModalFrame({
  title,
  titleId,
  onClose,
  children,
  variant = 'default',
  closeOnBackdrop = true,
  locked = false,
  className = '',
}: Props) {
  const onBackdropMouseDown = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (locked) return
      if (closeOnBackdrop && e.target === e.currentTarget) onClose()
    },
    [closeOnBackdrop, locked, onClose],
  )

  const handleCloseClick = useCallback(() => {
    if (!locked) onClose()
  }, [locked, onClose])

  useEffect(() => subscribeBodyScrollLock(), [])

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={onBackdropMouseDown}
    >
      <div
        className={`modal-sheet ${variant === 'tall' ? 'modal-sheet--tall' : ''} ${locked ? 'modal-sheet--locked' : ''} ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={locked}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-sheet__grab" aria-hidden />
        <header className="modal-sheet__header">
          <h2 className="modal-sheet__title" id={titleId}>
            {title}
          </h2>
          <button
            type="button"
            className="modal-sheet__close"
            onClick={handleCloseClick}
            disabled={locked}
            aria-label="Close"
          >
            <span aria-hidden>×</span>
          </button>
        </header>
        <div className="modal-sheet__body">{children}</div>
      </div>
    </div>
  )
}
