import { httpsCallable } from 'firebase/functions'
import { useCallback, useEffect, useState } from 'react'
import { ADMIN_UID } from '../adminConfig'
import { formatCallableError } from '../callableErrors'
import { getFirebaseFunctions } from '../firebase'
import { ModalFrame } from './ModalFrame'

type AccessRequest = {
  id: string
  email: string
  note: string | null
  createdAt: number | null
}

type AuthUserRow = {
  uid: string
  email: string | null
  disabled: boolean
  providers: string[]
}

type Tab = 'requests' | 'users'

type Props = {
  onClose: () => void
}

export function AdminAccessModal({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('requests')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [users, setUsers] = useState<AuthUserRow[]>([])
  const [lastApproval, setLastApproval] = useState<{
    email: string
    passwordResetLink: string
  } | null>(null)

  const loadRequests = useCallback(async () => {
    setError(null)
    const fn = getFirebaseFunctions()
    const listAccessRequests = httpsCallable(fn, 'listAccessRequests')
    const res = await listAccessRequests({})
    const data = res.data as { requests: AccessRequest[] }
    setRequests(data.requests ?? [])
  }, [])

  const loadUsers = useCallback(async () => {
    setError(null)
    const fn = getFirebaseFunctions()
    const listAuthUsers = httpsCallable(fn, 'listAuthUsers')
    const res = await listAuthUsers({})
    const data = res.data as { users: AuthUserRow[] }
    setUsers(data.users ?? [])
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setBusy(true)
      try {
        if (tab === 'requests') await loadRequests()
        else await loadUsers()
      } catch (e) {
        if (!cancelled) setError(formatCallableError(e))
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tab, loadRequests, loadUsers])

  async function approve(id: string) {
    setError(null)
    setLastApproval(null)
    setBusy(true)
    try {
      const fn = getFirebaseFunctions()
      const approveAccessRequest = httpsCallable(fn, 'approveAccessRequest')
      const res = await approveAccessRequest({ requestId: id })
      const data = res.data as { email: string; passwordResetLink: string }
      setLastApproval({ email: data.email, passwordResetLink: data.passwordResetLink })
      await loadRequests()
    } catch (e) {
      setError(formatCallableError(e))
    } finally {
      setBusy(false)
    }
  }

  async function reject(id: string) {
    if (!window.confirm('Reject this access request?')) return
    setError(null)
    setBusy(true)
    try {
      const fn = getFirebaseFunctions()
      const rejectAccessRequest = httpsCallable(fn, 'rejectAccessRequest')
      await rejectAccessRequest({ requestId: id })
      await loadRequests()
    } catch (e) {
      setError(formatCallableError(e))
    } finally {
      setBusy(false)
    }
  }

  async function removeUser(uid: string) {
    if (uid === ADMIN_UID) return
    if (!window.confirm('Permanently delete this user from Authentication?')) return
    setError(null)
    setBusy(true)
    try {
      const fn = getFirebaseFunctions()
      const deleteAuthUser = httpsCallable(fn, 'deleteAuthUser')
      await deleteAuthUser({ uid })
      await loadUsers()
    } catch (e) {
      setError(formatCallableError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalFrame
      title="Manage access"
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
          Pending requests
        </button>
        <button
          type="button"
          className={`admin-access-tab${tab === 'users' ? ' admin-access-tab--on' : ''}`}
          onClick={() => setTab('users')}
          disabled={busy}
        >
          All users
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
            <strong>{lastApproval.email}</strong> was approved. Send them this one-time link so they
            can set their password, then sign in:
          </p>
          <div className="admin-access-link-row">
            <input
              className="field-input admin-access-link-input"
              readOnly
              value={lastApproval.passwordResetLink}
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void navigator.clipboard.writeText(lastApproval.passwordResetLink)}
            >
              Copy link
            </button>
          </div>
        </div>
      ) : null}

      {tab === 'requests' ? (
        <div className="admin-access-list">
          {requests.length === 0 ? (
            <p className="login-note login-note--muted">No pending requests.</p>
          ) : (
            <ul className="admin-access-req-list">
              {requests.map((r) => (
                <li key={r.id} className="admin-access-req">
                  <div className="admin-access-req__main">
                    <strong>{r.email}</strong>
                    {r.note ? (
                      <p className="admin-access-req__note">{r.note}</p>
                    ) : (
                      <p className="admin-access-req__note admin-access-req__note--empty">No note</p>
                    )}
                  </div>
                  <div className="admin-access-req__actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={() => void approve(r.id)}
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
            Users in Firebase Authentication. You cannot delete your own admin account.
          </p>
          <ul className="admin-access-user-list">
            {users.map((u) => (
              <li key={u.uid} className="admin-access-user">
                <div className="admin-access-user__meta">
                  <span className="admin-access-user__email">{u.email ?? '(no email)'}</span>
                  <span className="admin-access-user__uid">{u.uid}</span>
                  <span className="admin-access-user__prov">{u.providers.join(', ') || '—'}</span>
                  {u.disabled ? <span className="admin-access-user__badge">Disabled</span> : null}
                </div>
                {u.uid === ADMIN_UID ? (
                  <span className="admin-access-user__admin-label">Admin</span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={busy}
                    onClick={() => void removeUser(u.uid)}
                  >
                    Delete
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
