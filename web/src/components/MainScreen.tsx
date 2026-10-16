import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'
import { EMPTY_VEHICLE_FORM, type VehicleData, type VehicleDoc, type VehicleForm } from '../types'
import { isAppAdmin } from '../adminConfig'
import {
  addVehicleToBoth,
  addVehicleToToday,
  deleteVehicleDoc,
  formatFirestoreError,
  normalizeVehicle,
  plateKey,
  restoreVehicleDoc,
  subscribeVehicles,
  updateVehicleDocsForPlate,
} from '../vehicleRepository'
import { archiveAndClearToday } from '../historyRepository'
import { clearLegacySession } from './LegacyLoginScreen'
import { AdminAccessModal } from './AdminAccessModal'
import { HistoryModal } from './HistoryModal'
import { signOutUser } from '../firebase'
import { BusyLabel, LoadingSpinner } from './LoadingSpinner'
import { MasterListModal } from './MasterListModal'
import { ModalFrame } from './ModalFrame'
import { SwipeActionRow } from './SwipeActionRow'
import { VehicleFormModal } from './VehicleFormModal'

type Props = {
  db: Firestore
  authUser?: User | null
  /** When using `VITE_LEGACY_LOGIN`, clear session and return to legacy login. */
  onLegacyLogout?: () => void
}

type Pending = null | 'addNew' | 'addFromMaster' | 'deleteOne' | 'deleteAll' | 'editSave'

type Toast = { message: string; undo?: () => void }

const TODAY_LABEL = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  weekday: 'long',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

function telHref(phone: string): string | null {
  const cleaned = phone.replace(/[^\d+]/g, '')
  return cleaned ? `tel:${cleaned}` : null
}

function validateVehicleForm(form: VehicleForm): string | null {
  if (!form.entry1.trim()) return 'Name is required.'
  if (!form.entry2.trim()) return 'Vehicle number is required.'
  return null
}

export function MainScreen({ db, authUser = null, onLegacyLogout }: Props) {
  const [today, setToday] = useState<VehicleDoc[]>([])
  const [all, setAll] = useState<VehicleDoc[]>([])
  /** First Firestore snapshot received (or error) per list — avoids flashing “empty” while loading. */
  const [todayHydrated, setTodayHydrated] = useState(false)
  const [masterHydrated, setMasterHydrated] = useState(false)
  const listsLoading = !todayHydrated || !masterHydrated
  const [toast, setToast] = useState<Toast | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)
  const [fireErr, setFireErr] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const busy = pending !== null

  const hideToast = useCallback(() => {
    window.clearTimeout(toastTimer.current)
    setToast(null)
  }, [])

  const showToast = useCallback((message: string, undo?: () => void) => {
    window.clearTimeout(toastTimer.current)
    setToast({ message, undo })
    toastTimer.current = window.setTimeout(() => setToast(null), undo ? 5000 : 2600)
  }, [])

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  useEffect(() => {
    setMasterHydrated(false)
    setTodayHydrated(false)
    const u1 = subscribeVehicles(
      db,
      false,
      (rows) => {
        setAll(rows)
        setMasterHydrated(true)
      },
      (e) => {
        setFireErr(formatFirestoreError(e))
        setMasterHydrated(true)
      },
    )
    const u2 = subscribeVehicles(
      db,
      true,
      (rows) => {
        setToday(rows)
        setTodayHydrated(true)
      },
      (e) => {
        setFireErr(formatFirestoreError(e))
        setTodayHydrated(true)
      },
    )
    return () => {
      u1()
      u2()
    }
  }, [db])

  const [addOpen, setAddOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
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
  const [newForm, setNewForm] = useState<VehicleForm>(EMPTY_VEHICLE_FORM)
  /** Plate last checked against the master list (on blur / Save) in the Add form. */
  const [addCheckedPlate, setAddCheckedPlate] = useState('')
  const [editForm, setEditForm] = useState<VehicleForm>(EMPTY_VEHICLE_FORM)

  const todayPlateKeys = useMemo(
    () => new Set(today.map((t) => plateKey(t.data.entry2))),
    [today],
  )

  /** Master entry with the same plate as the Add form, once that plate has been checked. */
  const addMatch = useMemo(() => {
    const key = plateKey(newForm.entry2)
    if (!key || plateKey(addCheckedPlate) !== key) return null
    return all.find((r) => plateKey(r.data.entry2) === key) ?? null
  }, [all, newForm.entry2, addCheckedPlate])

  const swipeChange = useCallback((key: string, open: boolean) => {
    setOpenSwipeId((cur) => {
      if (open) return key
      return cur === key ? null : cur
    })
  }, [])

  const closeSearch = useCallback(() => {
    if (busy) return
    setSearchOpen(false)
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
      else if (historyOpen) setHistoryOpen(false)
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
    historyOpen,
    addOpen,
    searchOpen,
    closeAdd,
    closeSearch,
  ])

  async function submitNewVehicle() {
    const err = validateVehicleForm(newForm)
    if (err) {
      setFormError(err)
      return
    }
    const v = normalizeVehicle({ id: 0, ...newForm })
    const key = plateKey(v.entry2)
    if (all.some((r) => plateKey(r.data.entry2) === key)) {
      setNewForm((f) => ({ ...f, entry2: v.entry2 }))
      setAddCheckedPlate(v.entry2)
      return
    }
    if (todayPlateKeys.has(key)) {
      showToast('This number is already on today’s list')
      return
    }
    setFormError(null)
    setPending('addNew')
    try {
      await addVehicleToBoth(db, v)
      setAddOpen(false)
      setNewForm(EMPTY_VEHICLE_FORM)
      showToast('Added')
    } catch (e) {
      setFireErr(formatFirestoreError(e))
    } finally {
      setPending(null)
    }
  }

  /** Adds an existing master entry to today (never writes a new master row). */
  async function addToToday(data: VehicleData, onDone: () => void) {
    if (todayPlateKeys.has(plateKey(data.entry2))) {
      showToast('Already on today’s list')
      onDone()
      return
    }
    setPending('addFromMaster')
    try {
      await addVehicleToToday(db, data)
      onDone()
      showToast('Added for today')
    } catch (e) {
      setFireErr(formatFirestoreError(e))
    } finally {
      setPending(null)
    }
  }

  function pickFromMaster(row: VehicleDoc) {
    if (todayPlateKeys.has(plateKey(row.data.entry2))) showToast('Already on today’s list')
    else setConfirmAdd({ ...row.data })
  }

  async function executeConfirmedDelete() {
    if (!deleteConfirm) return
    const { row, kind } = deleteConfirm
    const isToday = kind === 'today'
    setPending('deleteOne')
    try {
      await deleteVehicleDoc(db, row.id, isToday)
      const swipeKey = isToday ? row.id : `m-${row.id}`
      setOpenSwipeId((cur) => (cur === swipeKey ? null : cur))
      setDeleteConfirm(null)
      showToast(isToday ? 'Removed from today' : 'Removed from master list', () => {
        restoreVehicleDoc(db, row, isToday)
          .then(() => showToast('Restored'))
          .catch((e) => setFireErr(formatFirestoreError(e)))
      })
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
    const err = validateVehicleForm(editForm)
    if (err) {
      setFormError(err)
      return
    }
    const newP = plateKey(editForm.entry2)
    if (newP !== plateKey(oldPlate)) {
      const clash = [...all, ...today].some((r) => plateKey(r.data.entry2) === newP)
      if (clash) {
        setFormError('That vehicle number is already saved.')
        return
      }
    }
    setFormError(null)
    setPending('editSave')
    try {
      await updateVehicleDocsForPlate(db, oldPlate, { id: 0, ...editForm }, all, today)
      setEditVehicle(null)
      showToast('Updated')
    } catch (e) {
      setFireErr(formatFirestoreError(e))
    } finally {
      setPending(null)
    }
  }

  async function wipeToday() {
    setPending('deleteAll')
    try {
      await archiveAndClearToday(db, authUser?.uid ?? null)
      setDeleteAllOpen(false)
      showToast('Today cleared')
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
      <div className="main-root__fixed">
        <header className="main-header">
          <div className="main-header__text">
            <p className="main-eyebrow">SNM Bangalore · Parking</p>
            <h1 className="main-title">Today</h1>
            <p className="main-sub">
              {today.length === 0
                ? 'No vehicles added yet'
                : today.length === 1
                  ? '1 vehicle'
                  : `${today.length} vehicles`}
              {listsLoading ? '' : ` · ${all.length} on the master list`}
            </p>
            <p className="main-date">{TODAY_LABEL.format(new Date())}</p>
          </div>
          <div className="main-header__actions">
            {canAdmin ? (
              <>
                <button
                  type="button"
                  className="btn-pill btn-pill--ghost"
                  onClick={() => setAdminOpen(true)}
                  disabled={busy}
                >
                  Manage Saints
                </button>
                <button
                  type="button"
                  className="btn-pill btn-pill--ghost"
                  onClick={() => setHistoryOpen(true)}
                  disabled={busy}
                >
                  History
                </button>
              </>
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
            disabled={busy || listsLoading}
          >
            Add from list
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setAddOpen(true)}
            disabled={busy || listsLoading}
          >
            Add new
          </button>
        </div>
      </div>

      <div className="main-root__scroll">
        <section className="list-section" aria-label="Today’s vehicles">
          {listsLoading ? (
            <LoadingSpinner label="Loading…" padded />
          ) : today.length === 0 ? (
            <div className="empty-card">
              <p className="empty-card__title">No vehicles yet</p>
            </div>
          ) : (
            <ul className="vehicle-list">
              {today.map((row, index) => (
                <li key={row.id} className="vehicle-list__item">
                  <SwipeActionRow
                    isOpen={openSwipeId === row.id}
                    onOpenChange={(open) => swipeChange(row.id, open)}
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
          className="btn btn-danger main-delete-all-today"
          onClick={() => setDeleteAllOpen(true)}
          disabled={busy || today.length === 0}
        >
          Delete all today
        </button>
      </div>

      {toast ? (
        <div className="toast" role="status">
          <span>{toast.message}</span>
          {toast.undo ? (
            <button
              type="button"
              className="toast__undo"
              onClick={() => {
                const undo = toast.undo
                hideToast()
                undo?.()
              }}
            >
              Undo
            </button>
          ) : null}
        </div>
      ) : null}

      {addOpen ? (
        <VehicleFormModal
          title="Add vehicle"
          titleId="add-title"
          form={newForm}
          onChange={(patch) => {
            setNewForm((f) => ({ ...f, ...patch }))
            setFormError(null)
          }}
          onPlateBlur={setAddCheckedPlate}
          error={formError}
          notice={
            addMatch ? (
              <div className="saved-match" role="status">
                <p className="saved-match__title">Already saved</p>
                <p className="saved-match__line">
                  <strong>{addMatch.data.entry1 || 'No name'}</strong> · {addMatch.data.entry2}
                </p>
                {addMatch.data.entry3 || addMatch.data.entry4 ? (
                  <p className="saved-match__sub">
                    {[addMatch.data.entry3, addMatch.data.entry4].filter(Boolean).join(' · ')}
                  </p>
                ) : null}
                {todayPlateKeys.has(plateKey(addMatch.data.entry2)) ? (
                  <p className="saved-match__note">It’s already on today’s list.</p>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary btn-block"
                    disabled={busy}
                    onClick={() =>
                      void addToToday(addMatch.data, () => {
                        setAddOpen(false)
                        setNewForm(EMPTY_VEHICLE_FORM)
                        setAddCheckedPlate('')
                      })
                    }
                  >
                    <BusyLabel busy={pending === 'addFromMaster'} busyText="Adding…">
                      Add to today
                    </BusyLabel>
                  </button>
                )}
              </div>
            ) : null
          }
          busy={busy}
          saving={pending === 'addNew'}
          saveDisabled={addMatch !== null}
          onSave={() => void submitNewVehicle()}
          onClose={closeAdd}
        />
      ) : null}

      {searchOpen ? (
        <MasterListModal
          rows={all}
          todayPlateKeys={todayPlateKeys}
          loading={listsLoading}
          busy={busy}
          openSwipeId={openSwipeId}
          onSwipeChange={swipeChange}
          onPick={pickFromMaster}
          onEdit={beginEdit}
          onDelete={(row) => setDeleteConfirm({ row, kind: 'master' })}
          onClose={closeSearch}
        />
      ) : null}

      {confirmAdd ? (
        <ModalFrame
          title="Add for today?"
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
              onClick={() =>
                void addToToday(confirmAdd, () => {
                  setConfirmAdd(null)
                  setSearchOpen(false)
                })
              }
              disabled={busy}
            >
              <BusyLabel busy={pending === 'addFromMaster'} busyText="Adding…">
                Add
              </BusyLabel>
            </button>
          </div>
        </ModalFrame>
      ) : null}

      {editVehicle ? (
        <VehicleFormModal
          title="Edit vehicle"
          titleId="edit-title"
          form={editForm}
          onChange={(patch) => {
            setEditForm((f) => ({ ...f, ...patch }))
            setFormError(null)
          }}
          error={formError}
          busy={busy}
          saving={pending === 'editSave'}
          onSave={() => void saveEditVehicle()}
          onClose={closeEdit}
        />
      ) : null}

      {deleteAllOpen ? (
        <ModalFrame
          title="Clear today’s list?"
          titleId="dall-title"
          onClose={() => !busy && setDeleteAllOpen(false)}
          locked={busy}
        >
          <p className="modal-lead">
            {today.length === 1 ? '1 vehicle' : `${today.length} vehicles`} will be removed.
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
              <BusyLabel busy={pending === 'deleteAll'} busyText="Deleting…">
                Delete all
              </BusyLabel>
            </button>
          </div>
        </ModalFrame>
      ) : null}

      {callConfirm ? (
        <ModalFrame title="Call?" titleId="call-title" onClose={() => setCallConfirm(null)}>
          <p className="modal-lead">
            Call <strong className="text-emphasis">{callConfirm.entry1}</strong> (
            <strong className="text-emphasis">{callConfirm.entry3}</strong>)?
          </p>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setCallConfirm(null)}>
              Cancel
            </button>
            {callHref ? (
              <a className="btn btn-primary" href={callHref} onClick={() => setCallConfirm(null)}>
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
          {deleteConfirm.kind === 'today' ? 'Remove from today?' : 'Delete from master list?'}
        </p>
        <p className="delete-confirm-toast__meta">
          <strong>{deleteConfirm.row.data.entry1}</strong>
          <span className="delete-confirm-toast__sep"> · </span>
          {deleteConfirm.row.data.entry2}
        </p>
        {deleteConfirm.row.data.entry3 || deleteConfirm.row.data.entry4 ? (
          <p className="delete-confirm-toast__sub">
            {[deleteConfirm.row.data.entry3, deleteConfirm.row.data.entry4]
              .filter(Boolean)
              .join(' · ')}
          </p>
        ) : null}
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
            <BusyLabel busy={pending === 'deleteOne'} busyText="Deleting…">
              Delete
            </BusyLabel>
          </button>
        </div>
      </div>
    ) : null}

    {adminOpen && authUser ? (
      <AdminAccessModal db={db} authUser={authUser} onClose={() => setAdminOpen(false)} />
    ) : null}
    {historyOpen && canAdmin ? (
      <HistoryModal db={db} onClose={() => setHistoryOpen(false)} />
    ) : null}
    </>
  )
}
