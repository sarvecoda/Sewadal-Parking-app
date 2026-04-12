import { randomBytes } from 'crypto'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { setGlobalOptions } from 'firebase-functions/v2'
import { onCall, HttpsError } from 'firebase-functions/v2/https'

setGlobalOptions({ region: 'asia-south1' })

if (!getApps().length) {
  initializeApp()
}

const auth = getAuth()
const db = getFirestore()

/** Must match web/src/adminConfig.ts */
const ADMIN_UID = 'qn5SgVc62lckW5pJmpNwV1Oqv9I2'

function assertAdmin(uid: string | undefined): void {
  if (!uid || uid !== ADMIN_UID) {
    throw new HttpsError('permission-denied', 'Only the parking admin can do this.')
  }
}

const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Anyone not signed in can ask for access (writes Firestore via Admin only). */
export const submitAccessRequest = onCall(async (request) => {
  if (request.auth) {
    throw new HttpsError(
      'failed-precondition',
      'Sign out first, then submit a request for a new email address.',
    )
  }

  const email = String(request.data?.email ?? '')
    .trim()
    .toLowerCase()
  const note = String(request.data?.note ?? '')
    .trim()
    .slice(0, 800)

  if (!emailRx.test(email)) {
    throw new HttpsError('invalid-argument', 'Enter a valid email address.')
  }

  try {
    await auth.getUserByEmail(email)
    throw new HttpsError('already-exists', 'An account already exists for this email. Try signing in.')
  } catch (e: unknown) {
    const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: string }).code) : ''
    if (code === 'auth/user-not-found') {
      /* ok */
    } else if (e instanceof HttpsError) {
      throw e
    } else {
      throw new HttpsError('internal', 'Could not verify email.')
    }
  }

  const dupSnap = await db.collection('access_requests').where('email', '==', email).limit(25).get()
  const hasPending = dupSnap.docs.some((d) => d.data().status === 'pending')
  if (hasPending) {
    throw new HttpsError(
      'already-exists',
      'A pending request is already waiting for this email. The admin will review it soon.',
    )
  }

  const ref = await db.collection('access_requests').add({
    email,
    note: note || null,
    status: 'pending' as const,
    createdAt: FieldValue.serverTimestamp(),
  })

  return { requestId: ref.id }
})

export const listAccessRequests = onCall(async (request) => {
  assertAdmin(request.auth?.uid)

  const snap = await db.collection('access_requests').where('status', '==', 'pending').limit(50).get()

  const requests = snap.docs
    .map((d) => {
      const x = d.data()
      return {
        id: d.id,
        email: x.email as string,
        note: (x.note as string | null) ?? null,
        createdAt: x.createdAt ? (x.createdAt as { toMillis: () => number }).toMillis() : null,
      }
    })
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))

  return { requests }
})

export const approveAccessRequest = onCall(async (request) => {
  assertAdmin(request.auth?.uid)

  const requestId = String(request.data?.requestId ?? '').trim()
  if (!requestId) {
    throw new HttpsError('invalid-argument', 'Missing request id.')
  }

  const ref = db.collection('access_requests').doc(requestId)
  const doc = await ref.get()
  if (!doc.exists) {
    throw new HttpsError('not-found', 'Request not found.')
  }

  const data = doc.data()!
  if (data.status !== 'pending') {
    throw new HttpsError('failed-precondition', 'This request was already handled.')
  }

  const email = String(data.email ?? '').toLowerCase()
  if (!emailRx.test(email)) {
    throw new HttpsError('failed-precondition', 'Invalid email on request.')
  }

  try {
    await auth.getUserByEmail(email)
    await ref.update({
      status: 'rejected',
      handledAt: FieldValue.serverTimestamp(),
      rejectReason: 'User already existed in Authentication.',
    })
    throw new HttpsError('already-exists', 'That email already has an account. Request marked rejected.')
  } catch (e: unknown) {
    if (e instanceof HttpsError) throw e
    const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: string }).code) : ''
    if (code !== 'auth/user-not-found') {
      throw new HttpsError('internal', 'Could not check existing user.')
    }
  }

  const tempPassword = randomBytes(18).toString('base64url').slice(0, 32)

  const userRecord = await auth.createUser({
    email,
    password: tempPassword,
    emailVerified: false,
    disabled: false,
  })

  await ref.update({
    status: 'approved',
    handledAt: FieldValue.serverTimestamp(),
    createdUid: userRecord.uid,
  })

  await db
    .collection('app_users')
    .doc(userRecord.uid)
    .set({
      email,
      accessRequestId: requestId,
      approvedAt: FieldValue.serverTimestamp(),
      approvedBy: ADMIN_UID,
    })

  const passwordResetLink = await auth.generatePasswordResetLink(email)

  return {
    uid: userRecord.uid,
    email,
    passwordResetLink,
  }
})

export const rejectAccessRequest = onCall(async (request) => {
  assertAdmin(request.auth?.uid)

  const requestId = String(request.data?.requestId ?? '').trim()
  if (!requestId) {
    throw new HttpsError('invalid-argument', 'Missing request id.')
  }

  const ref = db.collection('access_requests').doc(requestId)
  const doc = await ref.get()
  if (!doc.exists) {
    throw new HttpsError('not-found', 'Request not found.')
  }

  const data = doc.data()!
  if (data.status !== 'pending') {
    throw new HttpsError('failed-precondition', 'This request was already handled.')
  }

  await ref.update({
    status: 'rejected',
    handledAt: FieldValue.serverTimestamp(),
    rejectReason: String(request.data?.reason ?? '').trim().slice(0, 400) || null,
  })

  return { ok: true }
})

export const listAuthUsers = onCall(async (request) => {
  assertAdmin(request.auth?.uid)

  const users: {
    uid: string
    email: string | null
    disabled: boolean
    providers: string[]
  }[] = []

  let pageToken: string | undefined
  do {
    const page = await auth.listUsers(1000, pageToken)
    for (const u of page.users) {
      users.push({
        uid: u.uid,
        email: u.email ?? null,
        disabled: u.disabled,
        providers: u.providerData.map((p) => p.providerId),
      })
    }
    pageToken = page.pageToken
  } while (pageToken)

  users.sort((a, b) => (a.email ?? '').localeCompare(b.email ?? ''))
  return { users }
})

export const deleteAuthUser = onCall(async (request) => {
  assertAdmin(request.auth?.uid)

  const targetUid = String(request.data?.uid ?? '').trim()
  if (!targetUid) {
    throw new HttpsError('invalid-argument', 'Missing user id.')
  }
  if (targetUid === ADMIN_UID) {
    throw new HttpsError('failed-precondition', 'Cannot delete the admin account.')
  }

  await auth.deleteUser(targetUid)
  await db.collection('app_users').doc(targetUid).delete().catch(() => {})

  return { ok: true }
})
