import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  writeBatch,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore'
import type { VehicleData, VehicleDoc } from './types'
import { VEHICLE_FIELD_MAX_LENGTH } from './types'
import { formatVehicleNumber, plateKey } from './plateFormat'

export { formatVehicleNumber, plateKey } from './plateFormat'

/**
 * Web vehicle collections (cloned from Android’s `your_collection` / `your_collection1`).
 * Override with VITE_FIRESTORE_* only if you rotate names again; keep firestore.rules in sync.
 */
const ALL_COLLECTION =
  import.meta.env.VITE_FIRESTORE_MASTER_COLLECTION?.trim() || 'my_new_collection'
const TODAY_COLLECTION =
  import.meta.env.VITE_FIRESTORE_TODAY_COLLECTION?.trim() || 'my_new_collection_1'

/** Firestore allows at most 500 operations per batch. */
const BATCH_DELETE_LIMIT = 450

function colRef(db: Firestore, today: boolean) {
  return collection(db, today ? TODAY_COLLECTION : ALL_COLLECTION)
}

function docAddedAtMillis(data: VehicleData): number {
  const a = data.addedAt
  if (a && typeof a.toMillis === 'function') return a.toMillis()
  return 0
}

/** Today’s list: first added at top, latest at bottom (missing `addedAt` sorts with oldest). */
function sortTodayDocsOldestFirst(rows: VehicleDoc[]): VehicleDoc[] {
  return [...rows].sort((a, b) => {
    const da = docAddedAtMillis(a.data)
    const db = docAddedAtMillis(b.data)
    if (da !== db) return da - db
    return a.id.localeCompare(b.id)
  })
}

function clip(s: string): string {
  return s.trim().slice(0, VEHICLE_FIELD_MAX_LENGTH)
}

/** Normalizes strings before write (trim, max length, plate format). */
export function normalizeVehicle(input: VehicleData): VehicleData {
  return {
    id: input.id ?? 0,
    entry1: clip(input.entry1),
    entry2: formatVehicleNumber(input.entry2),
    entry3: clip(input.entry3),
    entry4: clip(input.entry4),
  }
}

export function formatFirestoreError(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code?: string }).code
    switch (code) {
      case 'permission-denied':
        return 'You don’t have access to do that. Try signing in again.'
      case 'unavailable':
      case 'deadline-exceeded':
        return 'Network problem. Check your connection and try again.'
      case 'failed-precondition':
        return 'Couldn’t finish that. Please try again.'
      case 'resource-exhausted':
        return 'Too many requests. Wait a moment and try again.'
      default:
        break
    }
  }
  if (err instanceof Error && err.message) return err.message
  return 'Something went wrong. Please try again.'
}

export function subscribeVehicles(
  db: Firestore,
  today: boolean,
  onUpdate: (rows: VehicleDoc[]) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    colRef(db, today),
    (snap) => {
      const rows: VehicleDoc[] = []
      snap.forEach((d) => {
        const data = d.data() as VehicleData
        rows.push({ id: d.id, data })
      })
      onUpdate(today ? sortTodayDocsOldestFirst(rows) : rows)
    },
    (e) => onError(e as Error),
  )
}

/**
 * New vehicle: write master + today in one batch.
 * Use for “Add new” only — not when copying from master into today.
 */
export async function addVehicleToBoth(
  db: Firestore,
  vehicle: VehicleData,
): Promise<void> {
  const v = normalizeVehicle(vehicle)
  const batch = writeBatch(db)
  const allRef = doc(collection(db, ALL_COLLECTION))
  const todayRef = doc(collection(db, TODAY_COLLECTION))
  batch.set(allRef, v)
  batch.set(todayRef, { ...v, addedAt: serverTimestamp() })
  await batch.commit()
}

/** Copy an existing master entry onto today’s list only (no second master row). */
export async function addVehicleToToday(
  db: Firestore,
  vehicle: VehicleData,
): Promise<void> {
  const v = normalizeVehicle(vehicle)
  await addDoc(collection(db, TODAY_COLLECTION), {
    ...v,
    addedAt: serverTimestamp(),
  })
}

export async function deleteVehicleDoc(
  db: Firestore,
  docId: string,
  today: boolean,
): Promise<void> {
  await deleteDoc(doc(db, today ? TODAY_COLLECTION : ALL_COLLECTION, docId))
}

/**
 * Updates every master and today document whose `entry2` matches `oldPlate` (case-insensitive),
 * so one edit keeps both lists in sync with Firestore.
 */
export async function updateVehicleDocsForPlate(
  db: Firestore,
  oldPlate: string,
  newData: VehicleData,
  masterDocs: VehicleDoc[],
  todayDocs: VehicleDoc[],
): Promise<void> {
  const key = plateKey(oldPlate)
  const v = normalizeVehicle(newData)
  const payload = {
    id: v.id,
    entry1: v.entry1,
    entry2: v.entry2,
    entry3: v.entry3,
    entry4: v.entry4,
  }
  const batch = writeBatch(db)
  let n = 0
  for (const row of masterDocs) {
    if (plateKey(row.data.entry2) === key) {
      batch.update(doc(db, ALL_COLLECTION, row.id), payload)
      n++
    }
  }
  for (const row of todayDocs) {
    if (plateKey(row.data.entry2) === key) {
      batch.update(doc(db, TODAY_COLLECTION, row.id), payload)
      n++
    }
  }
  if (n === 0) return
  await batch.commit()
}

/**
 * Deletes all documents in today’s collection in chunks (Firestore batch limit).
 */
export async function deleteAllToday(db: Firestore): Promise<void> {
  const ref = colRef(db, true)
  while (true) {
    const q = query(ref, limit(BATCH_DELETE_LIMIT))
    const snap = await getDocs(q)
    if (snap.empty) return
    const batch = writeBatch(db)
    snap.forEach((d) => batch.delete(d.ref))
    await batch.commit()
  }
}
