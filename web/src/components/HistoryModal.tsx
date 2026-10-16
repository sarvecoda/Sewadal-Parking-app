import { useEffect, useState } from 'react'
import type { Firestore } from 'firebase/firestore'
import {
  HISTORY_KEEP_DAYS,
  listHistory,
  pruneOldHistory,
  type HistoryDay,
} from '../historyRepository'
import { formatFirestoreError } from '../vehicleRepository'
import { LoadingSpinner } from './LoadingSpinner'
import { ModalFrame } from './ModalFrame'

const DAY_LABEL = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

const TIME_LABEL = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  hour: 'numeric',
  minute: '2-digit',
})

function dayLabel(day: string): string {
  return DAY_LABEL.format(new Date(`${day}T12:00:00+05:30`))
}

function vehiclesLabel(n: number): string {
  return n === 1 ? '1 vehicle' : `${n} vehicles`
}

/** Admin-only: past days saved when “Delete all today” was used. */
export function HistoryModal({ db, onClose }: { db: Firestore; onClose: () => void }) {
  const [days, setDays] = useState<HistoryDay[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openDay, setOpenDay] = useState<HistoryDay | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        await pruneOldHistory(db)
        const rows = await listHistory(db)
        if (!cancelled) setDays(rows)
      } catch (e) {
        if (!cancelled) {
          setError(formatFirestoreError(e))
          setDays([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [db])

  return (
    <ModalFrame
      title={openDay ? dayLabel(openDay.day) : 'History'}
      titleId="history-title"
      onClose={onClose}
      variant="tall"
    >
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {days === null ? (
        <LoadingSpinner label="Loading…" padded />
      ) : openDay ? (
        <>
          <button type="button" className="link-button history-back" onClick={() => setOpenDay(null)}>
            ‹ All days
          </button>
          <p className="modal-hint">{vehiclesLabel(openDay.count)}</p>
          <ul className="history-vehicles">
            {openDay.vehicles.map((v, i) => (
              <li key={`${v.entry2}-${i}`} className="history-vehicle">
                <span className="history-vehicle__sl">{i + 1}</span>
                <span className="history-vehicle__main">
                  <strong>{v.entry1 || '—'}</strong> · {v.entry2}
                </span>
                <span className="history-vehicle__sub">
                  {[v.entry3, v.entry4].filter(Boolean).join(' · ')}
                  {v.addedAt ? ` · ${TIME_LABEL.format(v.addedAt.toDate())}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <p className="modal-hint">
            Saved each time today’s list is cleared. Kept for {HISTORY_KEEP_DAYS} days.
          </p>
          {days.length === 0 ? (
            <p className="master-empty">Nothing saved yet.</p>
          ) : (
            <ul className="history-days">
              {days.map((d) => (
                <li key={d.day}>
                  <button type="button" className="history-day" onClick={() => setOpenDay(d)}>
                    <span className="history-day__date">{dayLabel(d.day)}</span>
                    <span className="history-day__count">{vehiclesLabel(d.count)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <div className="modal-footer modal-footer--single">
        <button type="button" className="btn btn-secondary btn-block" onClick={onClose}>
          Done
        </button>
      </div>
    </ModalFrame>
  )
}
