import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import { fetchSignInMethodsForEmail } from 'firebase/auth'
import { getFirebaseAuth } from './firebase'
import { createParkingUserAndSendPasswordReset } from './secondarySignupApp'

const ACCESS_REQUESTS = 'access_requests'
const APP_USERS = 'app_users'

export type AccessRequestRow = {
  id: string
  email: string
  note: string | null
  createdAtMs: number | null
}

export type AppUserRow = {
  uid: string
  email: string
}

function emailKey(e: string): string {
  return e.trim().toLowerCase()
}

export async function submitAccessRequestFirestore(
  db: Firestore,
  email: string,
  note: string,
): Promise<void> {
  const em = emailKey(email)
  const snap = await getDocs(query(collection(db, ACCESS_REQUESTS), where('email', '==', em)))
  const pending = snap.docs.some((d) => (d.data() as { status?: string }).status === 'pending')
  if (pending) {
    throw new Error('A pending request for this email already exists.')
  }

  await addDoc(collection(db, ACCESS_REQUESTS), {
    email: em,
    note: note.trim() ? note.trim().slice(0, 800) : null,
    status: 'pending',
    createdAt: serverTimestamp(),
  })
}

export async function listPendingAccessRequests(db: Firestore): Promise<AccessRequestRow[]> {
  const snap = await getDocs(
    query(collection(db, ACCESS_REQUESTS), where('status', '==', 'pending')),
  )
  const rows = snap.docs.map((d) => {
    const x = d.data() as {
      email: string
      note?: string | null
      createdAt?: { toMillis: () => number }
    }
    return {
      id: d.id,
      email: x.email,
      note: x.note ?? null,
      createdAtMs: x.createdAt ? x.createdAt.toMillis() : null,
    }
  })
  rows.sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0))
  return rows
}

export async function listAppUsersFirestore(db: Firestore): Promise<AppUserRow[]> {
  const snap = await getDocs(collection(db, APP_USERS))
  const rows = snap.docs.map((d) => {
    const x = d.data() as { email: string }
    return { uid: d.id, email: x.email }
  })
  rows.sort((a, b) => a.email.localeCompare(b.email))
  return rows
}

export async function rejectAccessRequestFirestore(db: Firestore, requestId: string): Promise<void> {
  await updateDoc(doc(db, ACCESS_REQUESTS, requestId), {
    status: 'rejected',
    handledAt: serverTimestamp(),
  })
}

export async function approveAccessRequestFirestore(
  db: Firestore,
  requestId: string,
  email: string,
  approvedByUid: string,
): Promise<{ email: string; emailedReset: true }> {
  const em = emailKey(email)
  const auth = getFirebaseAuth()
  const methods = await fetchSignInMethodsForEmail(auth, em)
  if (methods.length > 0) {
    throw new Error('That email already has an account in Firebase.')
  }

  const uid = await createParkingUserAndSendPasswordReset(em)

  const batch = writeBatch(db)
  batch.update(doc(db, ACCESS_REQUESTS, requestId), {
    status: 'approved',
    handledAt: serverTimestamp(),
    createdUid: uid,
  })
  batch.set(doc(db, APP_USERS, uid), {
    email: em,
    accessRequestId: requestId,
    approvedAt: serverTimestamp(),
    approvedBy: approvedByUid,
  })
  await batch.commit()

  return { email: em, emailedReset: true }
}

export async function removeAppUserRecord(
  db: Firestore,
  targetUid: string,
  actingAdminUid: string,
): Promise<void> {
  if (targetUid === actingAdminUid) {
    throw new Error('Cannot remove your own account from this list.')
  }
  await deleteDoc(doc(db, APP_USERS, targetUid))
}
