import {
  addDoc,
  collection,
  deleteField,
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
import { emailHasFirebasePasswordAccount } from './authEmailRegistered'
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

  const staleIds: string[] = []
  for (const r of rows) {
    if (!(await emailHasFirebasePasswordAccount(r.email))) {
      staleIds.push(r.id)
    }
  }
  if (staleIds.length > 0) {
    const CHUNK = 400
    for (let i = 0; i < staleIds.length; i += CHUNK) {
      const batch = writeBatch(db)
      for (const id of staleIds.slice(i, i + CHUNK)) {
        batch.update(doc(db, ACCESS_REQUESTS, id), {
          status: 'auth_removed',
          handledAt: serverTimestamp(),
        })
      }
      await batch.commit()
    }
    return rows.filter((r) => !staleIds.includes(r.id))
  }

  return rows
}

export async function listAppUsersFirestore(db: Firestore): Promise<AppUserRow[]> {
  const snap = await getDocs(collection(db, APP_USERS))
  const rows = snap.docs.map((d) => {
    const x = d.data() as { email: string }
    return { uid: d.id, email: x.email }
  })
  rows.sort((a, b) => a.email.localeCompare(b.email))

  const orphanUids: string[] = []
  for (const r of rows) {
    if (!(await emailHasFirebasePasswordAccount(r.email))) {
      orphanUids.push(r.uid)
    }
  }
  if (orphanUids.length > 0) {
    const CHUNK = 400
    for (let i = 0; i < orphanUids.length; i += CHUNK) {
      const batch = writeBatch(db)
      for (const uid of orphanUids.slice(i, i + CHUNK)) {
        batch.delete(doc(db, APP_USERS, uid))
      }
      await batch.commit()
    }
    return rows.filter((r) => !orphanUids.includes(r.uid))
  }

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
    if (!(await emailHasFirebasePasswordAccount(em))) {
      await updateDoc(doc(db, ACCESS_REQUESTS, requestId), {
        status: 'auth_removed',
        handledAt: serverTimestamp(),
      })
      throw new Error(
        'That email no longer has a Firebase login (it was probably deleted under Authentication). This request was closed—refresh Pending requests.',
      )
    }
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
 * Revokes staff access: deletes `app_users/{uid}` and, when we know the original request id,
 * sets that `access_requests` row back to **pending** so it shows under Pending requests again.
 * The person’s Firebase Auth account is unchanged—they see the “request pending” screen until
 * re-approved. Full removal of Auth + Firestore rows is manual in the Firebase Console.
 */
export async function removeAppUserRecord(
  db: Firestore,
  targetUid: string,
  actingAdminUid: string,
): Promise<void> {
  if (targetUid === actingAdminUid) {
    throw new Error('Cannot remove your own account from this list.')
  }
  const userRef = doc(db, APP_USERS, targetUid)
  const userSnap = await getDoc(userRef)
  if (!userSnap.exists()) {
    throw new Error('That person is not on the staff list.')
  }
  const u = userSnap.data() as { email?: string; accessRequestId?: string }
  const batch = writeBatch(db)
  batch.delete(userRef)
  const rid = typeof u.accessRequestId === 'string' ? u.accessRequestId.trim() : ''
  if (rid) {
    const reqRef = doc(db, ACCESS_REQUESTS, rid)
    const reqSnap = await getDoc(reqRef)
    if (reqSnap.exists()) {
      batch.update(reqRef, {
        status: 'pending',
        handledAt: deleteField(),
        createdUid: deleteField(),
      })
    }
  }
  await batch.commit()
}
