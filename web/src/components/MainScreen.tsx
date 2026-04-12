import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Firestore } from 'firebase/firestore'
import type { VehicleData, VehicleDoc } from '../types'
import {
  addVehicleToBoth,
  deleteAllToday,
  deleteVehicleDoc,
  formatFirestoreError,
  normalizeVehicle,
  subscribeVehicles,
} from '../vehicleRepository'
import { clearLegacySession } from './LegacyLoginScreen'
import { signOutUser } from '../firebase'
import { ModalFrame } from './ModalFrame'

type Props = {
  db: Firestore
  /** When using `VITE_LEGACY_LOGIN`, clear session and return to legacy login. */
  onLegacyLogout?: () => void
}

type Pending =
  | null
  | 'addNew'
  | 'addFromMaster'
  | 'deleteOne'
  | 'deleteAll'

function telHref(phone: string): string | null {
  const cleaned = phone.replace(/[^\d+]/g, '')
  return cleaned ? `tel:${cleaned}` : null
}

function validateNewVehicle(form: {
  entry1: string
  entry2: string
  entry3: string
  entry4: string
}): string | null {
  if (!form.entry1.trim()) return 'Name is required.'
  if (!form.entry2.trim()) return 'Vehicle number is required.'
  return null
}

export function MainScreen({ db, onLegacyLogout }: Props) {
  const [today, setToday] = useState<VehicleDoc[]>([])
  const [all, setAll] = useState<VehicleDoc[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [fireErr, setFireErr] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const busy = pending !== null

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2600)
  }, [])

  useEffect(() => {
    const u1 = subscribeVehicles(
      db,
      false,
      setAll,
      (e) => setFireErr(formatFirestoreError(e)),
    )
    const u2 = subscribeVehicles(
      db,
      true,
      setToday,
      (e) => setFireErr(formatFirestoreError(e)),
    )
    return () => {
      u1()
      u2()
    }
  }, [db])

  const [addOpen, setAddOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [confirmAdd, setConfirmAdd] = useState<VehicleData | null>(null)
  const [deleteOne, setDeleteOne] = useState<VehicleDoc | null>(null)
  const [deleteAllOpen, setDeleteAllOpen] = useState(false)
  const [callConfirm, setCallConfirm] = useState<VehicleData | null>(null)

  const [newForm, setNewForm] = useState({
    entry1: '',
    entry2: '',
    entry3: '',
    entry4: '',
  })

  const [searchQuery, setSearchQuery] = useState('')

  const closeSearch = useCallback(() => {
    if (busy) return
    setSearchOpen(false)
    setSearchQuery('')
  }, [busy])

  const closeAdd = useCallback(() => {
    if (busy) return
    setAddOpen(false)
    setFormError(null)
  }, [busy])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || busy) return
      if (confirmAdd) setConfirmAdd(null)
      else if (deleteOne) setDeleteOne(null)
      else if (deleteAllOpen) setDeleteAllOpen(false)
      else if (callConfirm) setCallConfirm(null)
      else if (addOpen) closeAdd()
      else if (searchOpen) closeSearch()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    busy,
    confirmAdd,
    deleteOne,
    deleteAllOpen,
    callConfirm,
    addOpen,
    searchOpen,
    closeAdd,
    closeSearch,
  ])

  const filteredMaster = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return all
    return all.filter(
      ({ data: v }) =>
        v.entry1.toLowerCase().includes(q) ||
        v.entry2.toLowerCase().includes(q),
    )
  }, [all, searchQuery])

  async function submitNewVehicle() {
    const err = validateNewVehicle(newForm)
    if (err) {
      setFormError(err)
      return
    }
    const v = normalizeVehicle({
      id: 0,
      entry1: newForm.entry1,
      entry2: newForm.entry2,
      entry3: newForm.entry3,
      entry4: newForm.entry4,
    })
    if (today.some((t) => t.data.entry2 === v.entry2)) {
      showToast('This vehicle number is already on today’s list')
      return
    }
    setFormError(null)
    setPending('addNew')
    try {
      await addVehicleToBoth(db, v)
      setAddOpen(false)
      setNewForm({ entry1: '', entry2: '', entry3: '', entry4: '' })
      showToast('Vehicle added')
    } catch (e) {
      setFireErr(formatFirestoreError(e))
    } finally {
      setPending(null)
    }
  }

  async function confirmAddToToday() {
    if (!confirmAdd) return
    const normalized = normalizeVehicle(confirmAdd)
    if (today.some((t) => t.data.entry2 === normalized.entry2)) {
      showToast('This vehicle is already in the list')
      setConfirmAdd(null)
      return
    }
    setPending('addFromMaster')
    try {
      await addVehicleToBoth(db, normalized)
      setConfirmAdd(null)
      setSearchOpen(false)
      setSearchQuery('')
      showToast('Added to today’s list')
    } catch (e) {
      setFireErr(formatFirestoreError(e))
    } finally {
      setPending(null)
    }
  }

  async function removeTodayDoc(row: VehicleDoc) {
    setPending('deleteOne')
    try {
      await deleteVehicleDoc(db, row.id, true)
      setDeleteOne(null)
      showToast('Removed')
    } catch (e) {
      setFireErr(formatFirestoreError(e))
    } finally {
      setPending(null)
    }
  }

  async function wipeToday() {
    setPending('deleteAll')
    try {
      await deleteAllToday(db)
      setDeleteAllOpen(false)
      showToast('Today’s list cleared')
    } catch (e) {
      setFireErr(formatFirestoreError(e))
    } finally {
      setPending(null)
    }
  }

  async function handleLogout() {
    if (busy) return
    if (import.meta.env.VITE_LEGACY_LOGIN === 'true') {
      clearLegacySession()
      onLegacyLogout?.()
      return
    }
    try {
      await signOutUser()
    } catch {
      /* still leave UI — auth listener will update if sign-out worked */
    }
  }

  const callHref = callConfirm ? telHref(callConfirm.entry3) : null

  return (
    <div className="main-root">
      <header className="main-header">
        <div className="main-header__text">
          <p className="main-eyebrow">SNS Parking · BLR</p>
          <h1 className="main-title">Today’s list</h1>
          <p className="main-sub">
            {today.length} vehicle{today.length === 1 ? '' : 's'} · {all.length} in master
          </p>
        </div>
        <button
          type="button"
          className="btn-pill btn-pill--ghost"
          onClick={handleLogout}
          disabled={busy}
        >
          Log out
        </button>
      </header>

      {fireErr ? (
        <div className="banner banner-error" role="alert">
          <span className="banner__text">{fireErr}</span>
          <button
            type="button"
            className="banner__dismiss"
            aria-label="Dismiss error"
            onClick={() => setFireErr(null)}
          >
            ×
          </button>
        </div>
      ) : null}

      <div className="btn-row">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setSearchOpen(true)}
          disabled={busy}
        >
          Add from list
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setAddOpen(true)}
          disabled={busy}
        >
          Add new
        </button>
      </div>

      <section className="list-section" aria-label="Today’s parking list">
        {today.length === 0 ? (
          <div className="empty-card">
            <p className="empty-card__title">No vehicles yet</p>
            <p className="empty-card__hint">
              Use <strong>Add new</strong> for a fresh entry, or <strong>Add from list</strong> to
              copy from the master list.
            </p>
          </div>
        ) : (
          <ul className="vehicle-list">
            {today.map((row, index) => (
              <li
                key={row.id}
                className={`vehicle-card ${index % 2 === 0 ? 'vehicle-card--a' : 'vehicle-card--b'}`}
              >
                <div className="vehicle-card__sl">{index + 1}</div>
                <div className="vehicle-card__main">
                  <div className="vehicle-card__row">
                    <span className="vehicle-card__name">{row.data.entry1}</span>
                    <span className="vehicle-card__plate">{row.data.entry2}</span>
                  </div>
                  <div className="vehicle-card__row">
                    <button
                      type="button"
                      className="vehicle-card__phone"
                      onClick={() => !busy && setCallConfirm(row.data)}
                      disabled={busy}
                    >
                      {row.data.entry3 || '—'}
                    </button>
                    <span className="vehicle-card__model">{row.data.entry4}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="vehicle-card__delete"
                  aria-label="Delete entry"
                  onClick={() => !busy && setDeleteOne(row)}
                  disabled={busy}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button
        type="button"
        className="btn btn-danger-outline"
        onClick={() => setDeleteAllOpen(true)}
        disabled={busy || today.length === 0}
      >
        Delete all today
      </button>

      {toast ? <div className="toast">{toast}</div> : null}

      {addOpen ? (
        <ModalFrame
          title="Add new vehicle"
          titleId="add-title"
          onClose={closeAdd}
          locked={busy}
        >
          {formError ? (
            <p className="form-error" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="modal-fields">
            <label className="field-label field-label--modal">
              Name
              <input
                className="field-input"
                value={newForm.entry1}
                onChange={(e) => {
                  setNewForm((f) => ({ ...f, entry1: e.target.value }))
                  setFormError(null)
                }}
              />
            </label>
            <label className="field-label field-label--modal">
              Vehicle number
              <input
                className="field-input"
                value={newForm.entry2}
                onChange={(e) => {
                  setNewForm((f) => ({ ...f, entry2: e.target.value }))
                  setFormError(null)
                }}
              />
            </label>
            <label className="field-label field-label--modal">
              Mobile
              <input
                className="field-input"
                inputMode="tel"
                value={newForm.entry3}
                onChange={(e) =>
                  setNewForm((f) => ({ ...f, entry3: e.target.value }))
                }
              />
            </label>
            <label className="field-label field-label--modal">
              Model
              <input
                className="field-input"
                value={newForm.entry4}
                onChange={(e) =>
                  setNewForm((f) => ({ ...f, entry4: e.target.value }))
                }
              />
            </label>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={closeAdd} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void submitNewVehicle()}
              disabled={busy}
            >
              {pending === 'addNew' ? 'Saving…' : 'Save'}
            </button>
          </div>
        </ModalFrame>
      ) : null}

      {searchOpen ? (
        <ModalFrame
          title="Master list"
          titleId="search-title"
          onClose={closeSearch}
          variant="tall"
          locked={busy}
        >
          <label className="sr-only" htmlFor="master-search">
            Search master list
          </label>
          <input
            id="master-search"
            className="field-input field-input--search"
            placeholder="Search by name or vehicle number…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoComplete="off"
            disabled={busy}
          />
          <p className="modal-hint">Tap a row to add it to today’s list.</p>
          <ul className="master-list">
            {filteredMaster.length === 0 ? (
              <li className="master-empty">No matches.</li>
            ) : (
              filteredMaster.map((row, index) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className={`master-row ${index % 2 === 0 ? 'master-row--a' : 'master-row--b'}`}
                    onClick={() => !busy && setConfirmAdd({ ...row.data })}
                    disabled={busy}
                  >
                    <span className="master-row__name">{row.data.entry1}</span>
                    <span className="master-row__plate">{row.data.entry2}</span>
                    <span className="master-row__meta">{row.data.entry3}</span>
                    <span className="master-row__meta">{row.data.entry4}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
          <div className="modal-footer modal-footer--single">
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={closeSearch}
              disabled={busy}
            >
              Done
            </button>
          </div>
        </ModalFrame>
      ) : null}

      {confirmAdd ? (
        <ModalFrame
          title="Add to today?"
          titleId="confirm-title"
          onClose={() => !busy && setConfirmAdd(null)}
          locked={busy}
        >
          <p className="confirm-summary">
            {confirmAdd.entry1} · {confirmAdd.entry2}
            {confirmAdd.entry4 ? ` · ${confirmAdd.entry4}` : ''}
          </p>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setConfirmAdd(null)}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void confirmAddToToday()}
              disabled={busy}
            >
              {pending === 'addFromMaster' ? 'Adding…' : 'Add'}
            </button>
          </div>
        </ModalFrame>
      ) : null}

      {deleteOne ? (
        <ModalFrame
          title="Delete record"
          titleId="del-title"
          onClose={() => !busy && setDeleteOne(null)}
          locked={busy}
        >
          <p className="modal-lead">Remove this vehicle from today’s list?</p>
          <p className="confirm-summary">
            {deleteOne.data.entry1} · {deleteOne.data.entry2}
          </p>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setDeleteOne(null)}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => void removeTodayDoc(deleteOne)}
              disabled={busy}
            >
              {pending === 'deleteOne' ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </ModalFrame>
      ) : null}

      {deleteAllOpen ? (
        <ModalFrame
          title="Clear today’s list?"
          titleId="dall-title"
          onClose={() => !busy && setDeleteAllOpen(false)}
          locked={busy}
        >
          <p className="modal-lead">
            This removes every vehicle from today’s list. You cannot undo this.
          </p>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setDeleteAllOpen(false)}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => void wipeToday()}
              disabled={busy}
            >
              {pending === 'deleteAll' ? 'Deleting…' : 'Delete all'}
            </button>
          </div>
        </ModalFrame>
      ) : null}

      {callConfirm ? (
        <ModalFrame
          title="Place call"
          titleId="call-title"
          onClose={() => setCallConfirm(null)}
        >
          <p className="modal-lead">
            Call <strong className="text-emphasis">{callConfirm.entry1}</strong> on{' '}
            <strong className="text-emphasis">{callConfirm.entry3}</strong>?
          </p>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setCallConfirm(null)}>
              Cancel
            </button>
            {callHref ? (
              <a
                className="btn btn-primary"
                href={callHref}
                onClick={() => setCallConfirm(null)}
              >
                Call
              </a>
            ) : (
              <button type="button" className="btn btn-primary" disabled>
                Call
              </button>
            )}
          </div>
        </ModalFrame>
      ) : null}
    </div>
  )
}
