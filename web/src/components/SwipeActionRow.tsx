import { useCallback, useEffect, useRef, useState } from 'react'

const REVEAL_PX = 112
const SNAP_OPEN = -56
const TAP_MAX_PX = 14
const TAP_MAX_MS = 500

type Props = {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onEdit: () => void
  onDelete: () => void
  /** Short tap when row starts closed (e.g. master list → add to today). */
  onRowTap?: () => void
  disabled?: boolean
  frontClassName?: string
  children: React.ReactNode
}

/**
 * Drag the row left to reveal Edit and Delete. Short tap when closed runs `onRowTap` (optional).
 */
export function SwipeActionRow({
  isOpen,
  onOpenChange,
  onEdit,
  onDelete,
  onRowTap,
  disabled,
  frontClassName,
  children,
}: Props) {
  const [offset, setOffset] = useState(() => (isOpen ? -REVEAL_PX : 0))
  const dragging = useRef(false)
  const start = useRef({ x: 0, y: 0, base: 0, t: 0 })
  const frontRef = useRef<HTMLDivElement>(null)

  const clamp = useCallback((v: number) => Math.max(-REVEAL_PX, Math.min(0, v)), [])

  useEffect(() => {
    if (!dragging.current) {
      setOffset(isOpen ? -REVEAL_PX : 0)
    }
  }, [isOpen])

  function handlePointerDown(e: React.PointerEvent) {
    if (disabled) return
    if (e.button !== 0) return
    const el = frontRef.current
    if (!el) return
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    dragging.current = true
    start.current = {
      x: e.clientX,
      y: e.clientY,
      base: offset,
      t: performance.now(),
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging.current) return
    const dx = e.clientX - start.current.x
    setOffset(clamp(start.current.base + dx))
  }

  function finishPointer(e: React.PointerEvent) {
    if (!dragging.current) return
    const el = frontRef.current
    try {
      el?.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    dragging.current = false

    const dx = e.clientX - start.current.x
    const dy = e.clientY - start.current.y
    const dt = performance.now() - start.current.t
    const base = start.current.base
    const raw = clamp(base + dx)
    const isTap =
      Math.abs(dx) < TAP_MAX_PX && Math.abs(dy) < TAP_MAX_PX && dt < TAP_MAX_MS

    if (isTap) {
      if (base < -10) {
        onOpenChange(false)
        setOffset(0)
        return
      }
      if (onRowTap) {
        onRowTap()
      }
      setOffset(0)
      return
    }

    const open = raw <= SNAP_OPEN
    onOpenChange(open)
    setOffset(open ? -REVEAL_PX : 0)
  }

  function handleEdit() {
    onOpenChange(false)
    setOffset(0)
    onEdit()
  }

  function handleDelete() {
    onOpenChange(false)
    setOffset(0)
    onDelete()
  }

  const transitioning = !dragging.current

  return (
    <div className="swipe-row">
      <div className="swipe-row__actions">
        <button
          type="button"
          className="swipe-row__btn swipe-row__btn--edit"
          aria-label="Edit entry"
          disabled={disabled}
          onClick={(ev) => {
            ev.stopPropagation()
            handleEdit()
          }}
        >
          Edit
        </button>
        <button
          type="button"
          className="swipe-row__btn swipe-row__btn--delete"
          aria-label="Delete entry"
          disabled={disabled}
          onClick={(ev) => {
            ev.stopPropagation()
            handleDelete()
          }}
        >
          Delete
        </button>
      </div>
      <div
        ref={frontRef}
        className={`swipe-row__front${frontClassName ? ` ${frontClassName}` : ''}`}
        style={{
          transform: `translateX(${offset}px)`,
          transition: transitioning ? 'transform 0.22s ease' : 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
      >
        {children}
      </div>
    </div>
  )
}
