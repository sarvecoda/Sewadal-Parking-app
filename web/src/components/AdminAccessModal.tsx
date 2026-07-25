import type { User } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'
import { useCallback, useEffect, useState } from 'react'
import {
  approveAccessRequestFirestore,
  listAppUsersFirestore,
  listPendingAccessRequests,
  rejectAccessRequestFirestore,
  removeAppUserRecord,
  type AccessRequestRow,
  type AppUserRow,
} from '../accessControlRepository'
import { formatFirestoreError } from '../vehicleRepository'
import { ModalFrame } from './ModalFrame'

type Tab = 'requests' | 'users'

type Props = {
  db: Firestore
  authUser: User
  onClose: () => void
}

function firebaseAuthUsersConsoleUrl(): string | null {
  const id = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim()
  if (!id) return null
  return `https://console.firebase.google.com/project/${encodeURIComponent(id)}/authentication/users`
}

export function AdminAccessModal({ db, authUser, onClose }: Props) {
  const authUsersConsoleHref = firebaseAuthUsersConsoleUrl()
  const [tab, setTab] = useState<Tab>('requests')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requests, setRequests] = useState<AccessRequestRow[]>([])
  const [appUsers, setAppUsers] = useState<AppUserRow[]>([])
  const [lastApproval, setLastApproval] = useState<{
    email: string
    emailedReset: boolean
  } | null>(null)

  const loadRequests = useCallback(async () => {
    setError(null)
    const rows = await listPendingAccessRequests(db)
    setRequests(rows)
  }, [db])

  const loadUsers = useCallback(async () => {
    setError(null)
    const rows = await listAppUsersFirestore(db)
    setAppUsers(rows)
  }, [db])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setBusy(true)
      try {
        if (tab === 'requests') await loadRequests()
        else await loadUsers()
      } catch (e) {
        if (!cancelled) setError(formatFirestoreError(e))
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tab, loadRequests, loadUsers])

  async function approve(r: AccessRequestRow) {
    setError(null)
    setLastApproval(null)
    setBusy(true)
    try {
      const res = await approveAccessRequestFirestore(db, r.id, r.email, authUser.uid)
      setLastApproval({ email: res.email, emailedReset: res.emailedReset })
      await loadRequests()
    } catch (e) {
      setError(formatFirestoreError(e))
    } finally {
      setBusy(false)
    }
  }

  async function reject(id: string) {
    if (!window.confirm('Reject this request?')) return
    setError(null)
    setBusy(true)
    try {
      await rejectAccessRequestFirestore(db, id)
      await loadRequests()
    } catch (e) {
      setError(formatFirestoreError(e))
    } finally {
      setBusy(false)
    }
  }

  async function removeStaff(uid: string) {
    if (uid === authUser.uid) return
    if (
      !window.confirm(
        'Remove this person from parking staff? They will need approval again to get back in. Their login account stays until you delete it in Firebase Authentication.',
      )
    )
      return
    setError(null)
    setBusy(true)
    try {
      await removeAppUserRecord(db, uid, authUser.uid)
      await loadUsers()
      await loadRequests()
    } catch (e) {
      setError(formatFirestoreError(e))
    } finally {
      setBusy(false)
    }
  }

  const adminRow: AppUserRow = { uid: authUser.uid, email: authUser.email ?? '(admin)' }
  const userRowsForList = appUsers.some((u) => u.uid === adminRow.uid)
    ? appUsers
    : [adminRow, ...appUsers]

  return (
    <ModalFrame
      title="Staff access"
      titleId="admin-access-title"
      onClose={onClose}
      variant="tall"
      locked={busy}
      className="admin-access-modal"
    >
      <div className="admin-access-tabs">
        <button
          type="button"
          className={`admin-access-tab${tab === 'requests' ? ' admin-access-tab--on' : ''}`}
          onClick={() => setTab('requests')}
          disabled={busy}
        >
          Requests
        </button>
        <button
          type="button"
          className={`admin-access-tab${tab === 'users' ? ' admin-access-tab--on' : ''}`}
          onClick={() => setTab('users')}
          disabled={busy}
        >
          Staff
        </button>
      </div>

      {error ? (
        <p className="admin-access-error" role="alert">
          {error}
        </p>
      ) : null}

      {lastApproval ? (
        <div className="admin-access-banner admin-access-banner--ok">
          <p>
            <strong>{lastApproval.email}</strong> is approved.
            {lastApproval.emailedReset ? (
              <> Ask them to check email (and spam) for a password reset link, then sign in.</>
            ) : (
              <> They can sign in with the password they chose when requesting access.</>
            )}
          </p>
        </div>
      ) : null}

      {tab === 'requests' ? (
        <div className="admin-access-list">
          {requests.length === 0 ? (
            <p className="login-note login-note--muted">No open requests.</p>
          ) : (
            <ul className="admin-access-req-list">
              {requests.map((r) => (
                <li key={r.id} className="admin-access-req">
                  <div className="admin-access-req__main">
                    <strong>{r.email}</strong>
                    {r.note ? (
                      <p className="admin-access-req__note">{r.note}</p>
                    ) : (
                      <p className="admin-access-req__note admin-access-req__note--empty">
                        No note added
                      </p>
                    )}
                  </div>
                  <div className="admin-access-req__actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={() => void approve(r)}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={busy}
                      onClick={() => void reject(r.id)}
                    >
                      Reject
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="admin-access-list">
          <p className="login-note login-note--muted">
            <strong>Remove</strong> takes away parking access (they go back to waiting for
            approval). It does not delete their login. To remove the account fully, delete them in{' '}
            {authUsersConsoleHref ? (
              <a
                href={authUsersConsoleHref}
                target="_blank"
                rel="noopener noreferrer"
                className="link-button"
              >
                Firebase Authentication
              </a>
            ) : (
              <span>Firebase Console → Authentication → Users</span>
            )}
            .
          </p>
          <ul className="admin-access-user-list">
            {userRowsForList.map((u) => (
              <li key={u.uid} className="admin-access-user">
                <div className="admin-access-user__meta">
                  <span className="admin-access-user__email">{u.email}</span>
                  <span className="admin-access-user__uid">{u.uid}</span>
                </div>
                {u.uid === authUser.uid ? (
                  <span className="admin-access-user__admin-label">Admin</span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={busy}
                    onClick={() => void removeStaff(u.uid)}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </ModalFrame>
  )
}
