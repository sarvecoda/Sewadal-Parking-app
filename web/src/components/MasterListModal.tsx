import { useMemo, useState } from 'react'
import type { VehicleDoc } from '../types'
import { plateKey } from '../plateFormat'
import { LoadingSpinner } from './LoadingSpinner'
import { ModalFrame } from './ModalFrame'
import { SwipeActionRow } from './SwipeActionRow'

type Props = {
  rows: VehicleDoc[]
  /** `plateKey` of every vehicle already on today’s list. */
  todayPlateKeys: Set<string>
  loading: boolean
  busy: boolean
  openSwipeId: string | null
  onSwipeChange: (key: string, open: boolean) => void
  onPick: (row: VehicleDoc) => void
  onEdit: (row: VehicleDoc) => void
  onDelete: (row: VehicleDoc) => void
  onClose: () => void
}

export function MasterListModal({
  rows,
  todayPlateKeys,
  loading,
  busy,
  openSwipeId,
  onSwipeChange,
  onPick,
  onEdit,
  onDelete,
  onClose,
}: Props) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    const qPlate = plateKey(query)
    return rows.filter(({ data: v }) => {
      if (v.entry1.toLowerCase().includes(q)) return true
      if (v.entry2.toLowerCase().includes(q)) return true
      return Boolean(qPlate) && plateKey(v.entry2).includes(qPlate)
    })
  }, [rows, query])

  return (
    <ModalFrame
      title={loading ? 'Master list' : `Master list (${rows.length})`}
      titleId="search-title"
      onClose={onClose}
      variant="tall"
      locked={busy}
    >
      <label className="sr-only" htmlFor="master-search">
        Search master list
      </label>
      <input
        id="master-search"
        className="field-input field-input--search"
        placeholder="Name or vehicle number"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
        disabled={busy || loading}
      />
      <p className="modal-hint">Tap to add. Swipe left to edit or delete.</p>
      {loading ? (
        <LoadingSpinner label="Loading…" padded />
      ) : (
        <ul className="master-list">
          {filtered.length === 0 ? (
            <li className="master-empty">Nothing matched that search.</li>
          ) : (
            filtered.map((row, index) => {
              const swipeKey = `m-${row.id}`
              const onToday = todayPlateKeys.has(plateKey(row.data.entry2))
              return (
                <li key={row.id} className="master-list__item">
                  <SwipeActionRow
                    isOpen={openSwipeId === swipeKey}
                    onOpenChange={(open) => onSwipeChange(swipeKey, open)}
                    onEdit={() => onEdit(row)}
                    onDelete={() => onDelete(row)}
                    onRowTap={() => !busy && onPick(row)}
                    disabled={busy}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      className={`master-row ${index % 2 === 0 ? 'master-row--a' : 'master-row--b'}`}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && !busy) {
                          e.preventDefault()
                          onPick(row)
                        }
                      }}
                    >
                      <span className="master-row__name">{row.data.entry1}</span>
                      <span className="master-row__plate">{row.data.entry2}</span>
                      <span className="master-row__meta">{row.data.entry3}</span>
                      <span className="master-row__meta">{row.data.entry4}</span>
                      {onToday ? <span className="master-row__badge">On today’s list</span> : null}
                    </div>
                  </SwipeActionRow>
                </li>
              )
            })
          )}
        </ul>
      )}
      <div className="modal-footer modal-footer--single">
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={onClose}
          disabled={busy}
        >
          Done
        </button>
      </div>
    </ModalFrame>
  )
}
