import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  writeBatch,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore'
import type { VehicleData, VehicleDoc } from './types'
import { VEHICLE_FIELD_MAX_LENGTH } from './types'

/** Same collection ids as Android `VehicleRepository`. */
const ALL_COLLECTION = 'your_collection'
const TODAY_COLLECTION = 'your_collection1'

/** Firestore allows at most 500 operations per batch. */
const BATCH_DELETE_LIMIT = 450

function colRef(db: Firestore, today: boolean) {
  return collection(db, today ? TODAY_COLLECTION : ALL_COLLECTION)
}

function clip(s: string): string {
  return s.trim().slice(0, VEHICLE_FIELD_MAX_LENGTH)
}

/** Normalizes strings before write (trim + max length). */
export function normalizeVehicle(input: VehicleData): VehicleData {
  return {
    id: input.id ?? 0,
    entry1: clip(input.entry1),
    entry2: clip(input.entry2),
    entry3: clip(input.entry3),
    entry4: clip(input.entry4),
  }
}

export function formatFirestoreError(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code?: string }).code
    switch (code) {
      case 'permission-denied':
        return 'Permission denied. Check Firestore rules for web access.'
      case 'unavailable':
      case 'deadline-exceeded':
        return 'Network issue. Check your connection and try again.'
      case 'failed-precondition':
        return 'Request could not be completed. Try again in a moment.'
      case 'resource-exhausted':
        return 'Too many requests. Please wait and try again.'
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
      onUpdate(rows)
    },
    (e) => onError(e as Error),
  )
}

/**
 * Adds the same vehicle to master and today in one atomic batch
 * (safer than two sequential writes if the network drops mid-way).
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
  batch.set(todayRef, v)
  await batch.commit()
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
  const key = oldPlate.trim().toLowerCase()
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
    if (row.data.entry2.trim().toLowerCase() === key) {
      batch.update(doc(db, ALL_COLLECTION, row.id), payload)
      n++
    }
  }
  for (const row of todayDocs) {
    if (row.data.entry2.trim().toLowerCase() === key) {
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
