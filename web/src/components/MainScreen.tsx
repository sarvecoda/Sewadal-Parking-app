import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'
import type { VehicleData, VehicleDoc } from '../types'
import { isAppAdmin } from '../adminConfig'
import {
  addVehicleToBoth,
  deleteAllToday,
  deleteVehicleDoc,
  formatFirestoreError,
  normalizeVehicle,
  subscribeVehicles,
  updateVehicleDocsForPlate,
} from '../vehicleRepository'
import { clearLegacySession } from './LegacyLoginScreen'
import { AdminAccessModal } from './AdminAccessModal'
import { signOutUser } from '../firebase'
import { ModalFrame } from './ModalFrame'
import { SwipeActionRow } from './SwipeActionRow'

type Props = {
  db: Firestore
  authUser?: User | null
  /** When using `VITE_LEGACY_LOGIN`, clear session and return to legacy login. */
  onLegacyLogout?: () => void
}

type Pending =
  | null
  | 'addNew'
  | 'addFromMaster'
  | 'deleteOne'
  | 'deleteAll'
  | 'editSave'

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

export function MainScreen({ db, authUser = null, onLegacyLogout }: Props) {
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
  const [adminOpen, setAdminOpen] = useState(false)

  const canAdmin = isAppAdmin(authUser)
  const [confirmAdd, setConfirmAdd] = useState<VehicleData | null>(null)
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<
    null | { row: VehicleDoc; kind: 'today' | 'master' }
  >(null)
  const [editVehicle, setEditVehicle] = useState<VehicleDoc | null>(null)
  const editInitialPlateRef = useRef('')
  const [deleteAllOpen, setDeleteAllOpen] = useState(false)
  const [callConfirm, setCallConfirm] = useState<VehicleData | null>(null)

  const [newForm, setNewForm] = useState({
    entry1: '',
    entry2: '',
    entry3: '',
    entry4: '',
  })

  const [editForm, setEditForm] = useState({
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
    setOpenSwipeId(null)
    setDeleteConfirm(null)
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
      else if (deleteConfirm) setDeleteConfirm(null)
      else if (openSwipeId) setOpenSwipeId(null)
      else if (editVehicle) setEditVehicle(null)
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
    deleteConfirm,
    openSwipeId,
    editVehicle,
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

  async function executeConfirmedDelete() {
    if (!deleteConfirm) return
    const { row, kind } = deleteConfirm
    setPending('deleteOne')
    try {
      if (kind === 'today') {
        await deleteVehicleDoc(db, row.id, true)
        setOpenSwipeId((cur) => (cur === row.id ? null : cur))
        showToast('Removed from today')
      } else {
        const swipeKey = `m-${row.id}`
        await deleteVehicleDoc(db, row.id, false)
        setOpenSwipeId((cur) => (cur === swipeKey ? null : cur))
        showToast('Removed from master')
      }
      setDeleteConfirm(null)
    } catch (e) {
      setFireErr(formatFirestoreError(e))
    } finally {
      setPending(null)
    }
  }

  function beginEdit(row: VehicleDoc) {
    editInitialPlateRef.current = row.data.entry2.trim()
    setEditVehicle(row)
    setEditForm({
      entry1: row.data.entry1,
      entry2: row.data.entry2,
      entry3: row.data.entry3,
      entry4: row.data.entry4,
    })
    setFormError(null)
  }

  function closeEdit() {
    if (busy) return
    setEditVehicle(null)
    setFormError(null)
  }

  async function saveEditVehicle() {
    if (!editVehicle) return
    const oldPlate = editInitialPlateRef.current
    const err = validateNewVehicle(editForm)
    if (err) {
      setFormError(err)
      return
    }
    const newP = editForm.entry2.trim().toLowerCase()
    if (newP !== oldPlate.toLowerCase()) {
      const clash = [...all, ...today].some((r) => r.data.entry2.trim().toLowerCase() === newP)
      if (clash) {
        setFormError('That vehicle number is already in use.')
        return
      }
    }
    setFormError(null)
    setPending('editSave')
    try {
      await updateVehicleDocsForPlate(
        db,
        oldPlate,
        {
          id: 0,
          entry1: editForm.entry1,
          entry2: editForm.entry2,
          entry3: editForm.entry3,
          entry4: editForm.entry4,
        },
        all,
        today,
      )
      setEditVehicle(null)
      showToast('Saved')
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
    <>
    <div className="main-root">
      <header className="main-header">
        <div className="main-header__text">
          <p className="main-eyebrow">SNS Parking · BLR</p>
          <h1 className="main-title">Today’s list</h1>
          <p className="main-sub">
            {today.length} vehicle{today.length === 1 ? '' : 's'} · {all.length} in master · oldest
            at top
          </p>
        </div>
        <div className="main-header__actions">
          {canAdmin ? (
            <button
              type="button"
              className="btn-pill btn-pill--ghost"
              onClick={() => setAdminOpen(true)}
              disabled={busy}
            >
              Manage access
            </button>
          ) : null}
          <button
            type="button"
            className="btn-pill btn-pill--ghost"
            onClick={handleLogout}
            disabled={busy}
          >
            Log out
          </button>
        </div>
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
              <li key={row.id} className="vehicle-list__item">
                <SwipeActionRow
                  isOpen={openSwipeId === row.id}
                  onOpenChange={(open) =>
                    setOpenSwipeId((cur) => {
                      if (open) return row.id
                      return cur === row.id ? null : cur
                    })
                  }
                  onEdit={() => beginEdit(row)}
                  onDelete={() => setDeleteConfirm({ row, kind: 'today' })}
                  disabled={busy}
                >
                  <div
                    className={`vehicle-card ${index % 2 === 0 ? 'vehicle-card--a' : 'vehicle-card--b'}`}
                  >
                    <div className="vehicle-card__sl">{index + 1}</div>
                    <div className="vehicle-card__grid">
                      <span className="vehicle-card__name">{row.data.entry1}</span>
                      <span className="vehicle-card__plate">{row.data.entry2}</span>
                      <button
                        type="button"
                        className="vehicle-card__phone vehicle-card__grid-tap"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!busy) setCallConfirm(row.data)
                        }}
                        disabled={busy}
                      >
                        {row.data.entry3 || '—'}
                      </button>
                      <span className="vehicle-card__meta">{row.data.entry4}</span>
                    </div>
                  </div>
                </SwipeActionRow>
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
          <p className="modal-hint">
            Drag a row left for <strong>Edit</strong> or <strong>Delete</strong>. Short tap still
            adds to today’s list.
          </p>
          <ul className="master-list">
            {filteredMaster.length === 0 ? (
              <li className="master-empty">No matches.</li>
            ) : (
              filteredMaster.map((row, index) => {
                const swipeKey = `m-${row.id}`
                return (
                  <li key={row.id} className="master-list__item">
                    <SwipeActionRow
                      isOpen={openSwipeId === swipeKey}
                      onOpenChange={(open) =>
                        setOpenSwipeId((cur) => {
                          if (open) return swipeKey
                          return cur === swipeKey ? null : cur
                        })
                      }
                      onEdit={() => beginEdit(row)}
                      onDelete={() => setDeleteConfirm({ row, kind: 'master' })}
                      onRowTap={() => !busy && setConfirmAdd({ ...row.data })}
                      disabled={busy}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        className={`master-row ${index % 2 === 0 ? 'master-row--a' : 'master-row--b'}`}
                        onKeyDown={(e) => {
                          if ((e.key === 'Enter' || e.key === ' ') && !busy) {
                            e.preventDefault()
                            setConfirmAdd({ ...row.data })
                          }
                        }}
                      >
                        <span className="master-row__name">{row.data.entry1}</span>
                        <span className="master-row__plate">{row.data.entry2}</span>
                        <span className="master-row__meta">{row.data.entry3}</span>
                        <span className="master-row__meta">{row.data.entry4}</span>
                      </div>
                    </SwipeActionRow>
                  </li>
                )
              })
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

      {editVehicle ? (
        <ModalFrame
          title="Edit vehicle"
          titleId="edit-title"
          onClose={closeEdit}
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
                value={editForm.entry1}
                onChange={(e) => {
                  setEditForm((f) => ({ ...f, entry1: e.target.value }))
                  setFormError(null)
                }}
              />
            </label>
            <label className="field-label field-label--modal">
              Vehicle number
              <input
                className="field-input"
                value={editForm.entry2}
                onChange={(e) => {
                  setEditForm((f) => ({ ...f, entry2: e.target.value }))
                  setFormError(null)
                }}
              />
            </label>
            <label className="field-label field-label--modal">
              Mobile
              <input
                className="field-input"
                inputMode="tel"
                value={editForm.entry3}
                onChange={(e) => setEditForm((f) => ({ ...f, entry3: e.target.value }))}
              />
            </label>
            <label className="field-label field-label--modal">
              Model
              <input
                className="field-input"
                value={editForm.entry4}
                onChange={(e) => setEditForm((f) => ({ ...f, entry4: e.target.value }))}
              />
            </label>
          </div>
          <p className="modal-hint modal-hint--tight">
            Saves to Firestore for both <strong>master</strong> and <strong>today</strong> wherever
            this vehicle number appears.
          </p>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={closeEdit} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void saveEditVehicle()}
              disabled={busy}
            >
              {pending === 'editSave' ? 'Saving…' : 'Save'}
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
    {deleteConfirm ? (
      <div
        className="delete-confirm-toast"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-title"
      >
        <p id="delete-confirm-title" className="delete-confirm-toast__title">
          Are you sure you want to delete?
        </p>
        <p className="delete-confirm-toast__meta">
          <strong>{deleteConfirm.row.data.entry1}</strong>
          <span className="delete-confirm-toast__sep"> · </span>
          {deleteConfirm.row.data.entry2}
        </p>
        {(deleteConfirm.row.data.entry3 || deleteConfirm.row.data.entry4) && (
          <p className="delete-confirm-toast__sub">
            {deleteConfirm.row.data.entry3 ? (
              <span>{deleteConfirm.row.data.entry3}</span>
            ) : null}
            {deleteConfirm.row.data.entry3 && deleteConfirm.row.data.entry4 ? (
              <span className="delete-confirm-toast__sep"> · </span>
            ) : null}
            {deleteConfirm.row.data.entry4 ? <span>{deleteConfirm.row.data.entry4}</span> : null}
          </p>
        )}
        <p className="delete-confirm-toast__hint">
          {deleteConfirm.kind === 'today'
            ? 'Removes this vehicle from today’s list only. The master list is unchanged.'
            : 'Removes this vehicle from the master database. Matching rows on today’s list are not removed automatically.'}
        </p>
        <div className="delete-confirm-toast__actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setDeleteConfirm(null)}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => void executeConfirmedDelete()}
            disabled={busy}
          >
            {pending === 'deleteOne' ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    ) : null}

    {adminOpen && authUser ? (
      <AdminAccessModal db={db} authUser={authUser} onClose={() => setAdminOpen(false)} />
    ) : null}
    </>
  )
}
