import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import { fetchSignInMethodsForEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { getFirebaseAuth } from './firebase'
import {
  createParkingUserAndSendPasswordReset,
  createParkingUserWithChosenPassword,
} from './secondarySignupApp'

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
  password: string,
): Promise<void> {
  const em = emailKey(email)
  const mainAuth = getFirebaseAuth()
  const existing = await fetchSignInMethodsForEmail(mainAuth, em)
  if (existing.length > 0) {
    throw new Error(
      'That email already has a Firebase account. Try signing in, or use Forgot password on the Sign in tab.',
    )
  }

  await createParkingUserWithChosenPassword(em, password)

  try {
    await signInWithEmailAndPassword(mainAuth, em, password)
    const uid = mainAuth.currentUser?.uid
    if (!uid) throw new Error('Sign-in did not complete. Try again.')

    await addDoc(collection(db, ACCESS_REQUESTS), {
      email: em,
      note: note.trim() ? note.trim().slice(0, 800) : null,
      status: 'pending',
      createdAt: serverTimestamp(),
      requestUid: uid,
    })
  } finally {
    await signOut(mainAuth)
  }
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
): Promise<{ email: string; emailedReset: boolean }> {
  const em = emailKey(email)
  const auth = getFirebaseAuth()
  const reqSnap = await getDoc(doc(db, ACCESS_REQUESTS, requestId))
  if (!reqSnap.exists()) {
    throw new Error('That access request was not found.')
  }
  const reqData = reqSnap.data() as {
    email?: string
    requestUid?: string
    status?: string
  }
  if (emailKey(reqData.email ?? '') !== em) {
    throw new Error('Request email does not match.')
  }
  if (reqData.status !== 'pending') {
    throw new Error('That request is no longer pending.')
  }

  const batch = writeBatch(db)
  const requestUid = typeof reqData.requestUid === 'string' ? reqData.requestUid : undefined

  if (requestUid) {
    // Do not use fetchSignInMethodsForEmail here: with Email Enumeration Protection enabled,
    // Firebase often returns [] so we would falsely reject valid Email/Password accounts.
    // This request row only exists after the applicant signed in with password to create it.
    const staffSnap = await getDoc(doc(db, APP_USERS, requestUid))
    if (staffSnap.exists()) {
      throw new Error('That user is already on the staff list.')
    }

    batch.update(doc(db, ACCESS_REQUESTS, requestId), {
      status: 'approved',
      handledAt: serverTimestamp(),
      createdUid: requestUid,
    })
    batch.set(doc(db, APP_USERS, requestUid), {
      email: em,
      accessRequestId: requestId,
      approvedAt: serverTimestamp(),
      approvedBy: approvedByUid,
    })
    await batch.commit()
    return { email: em, emailedReset: false }
  }

  const methods = await fetchSignInMethodsForEmail(auth, em)
  if (methods.length > 0) {
    throw new Error('That email already has an account in Firebase.')
  }

  const uid = await createParkingUserAndSendPasswordReset(em)

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

/**
 * Removes staff from the app (Firestore `app_users` only).
 * Firebase client SDK cannot delete another user’s Auth account without a paid backend (Admin SDK).
 * To revoke login completely, delete that user under Firebase Console → Authentication → Users.
 */
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
