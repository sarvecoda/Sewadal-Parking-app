import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  type DocumentReference,
  type Firestore,
} from 'firebase/firestore'
import { dayKeyIST, shiftDayKey } from './historyDay'
import { todayCollection } from './vehicleRepository'

const HISTORY = 'parking_history'
/** History is kept for this many days, today included. */
export const HISTORY_KEEP_DAYS = 23
/** Firestore allows at most 500 operations per batch. */
const BATCH_MAX = 450

export type HistoryVehicle = {
  entry1: string
  entry2: string
  entry3: string
  entry4: string
  addedAt: Timestamp | null
}

export type HistoryDay = {
  day: string
  count: number
  vehicles: HistoryVehicle[]
}

type Op = { kind: 'set'; ref: DocumentReference; data: object } | { kind: 'delete'; ref: DocumentReference }

async function commitOps(db: Firestore, ops: Op[]): Promise<void> {
  for (let i = 0; i < ops.length; i += BATCH_MAX) {
    const batch = writeBatch(db)
    for (const op of ops.slice(i, i + BATCH_MAX)) {
      if (op.kind === 'set') batch.set(op.ref, op.data)
      else batch.delete(op.ref)
    }
    await batch.commit()
  }
}

/**
 * Saves today’s vehicles to history (one doc per India calendar day of `addedAt`) and clears
 * today’s list. History writes come first, so for normal list sizes it is one atomic batch.
 */
export async function archiveAndClearToday(db: Firestore, clearedBy: string | null): Promise<void> {
  const snap = await getDocs(todayCollection(db))
  if (snap.empty) return

  const fallbackDay = dayKeyIST(new Date())
  const byDay = new Map<string, HistoryVehicle[]>()
  for (const d of snap.docs) {
    const v = d.data()
    const addedAt = v.addedAt instanceof Timestamp ? v.addedAt : null
    const day = addedAt ? dayKeyIST(addedAt.toDate()) : fallbackDay
    const list = byDay.get(day) ?? []
    list.push({
      entry1: String(v.entry1 ?? ''),
      entry2: String(v.entry2 ?? ''),
      entry3: String(v.entry3 ?? ''),
      entry4: String(v.entry4 ?? ''),
      addedAt,
    })
    byDay.set(day, list)
  }

  const ops: Op[] = []
  for (const [day, vehicles] of byDay) {
    ops.push({
      kind: 'set',
      ref: doc(collection(db, HISTORY)),
      data: { day, count: vehicles.length, vehicles, clearedAt: serverTimestamp(), clearedBy },
    })
  }
  for (const d of snap.docs) ops.push({ kind: 'delete', ref: d.ref })
  await commitOps(db, ops)
}

/** Deletes history older than `HISTORY_KEEP_DAYS` (admin only; runs when History opens). */
export async function pruneOldHistory(db: Firestore): Promise<void> {
  const cutoff = shiftDayKey(dayKeyIST(new Date()), -(HISTORY_KEEP_DAYS - 1))
  const snap = await getDocs(query(collection(db, HISTORY), where('day', '<', cutoff)))
  await commitOps(
    db,
    snap.docs.map((d) => ({ kind: 'delete', ref: d.ref })),
  )
}

/** All saved days, newest first; clears from the same day are merged. */
export async function listHistory(db: Firestore): Promise<HistoryDay[]> {
  const snap = await getDocs(query(collection(db, HISTORY), orderBy('day', 'desc')))
  const byDay = new Map<string, HistoryVehicle[]>()
  for (const d of snap.docs) {
    const x = d.data() as { day: string; vehicles?: HistoryVehicle[] }
    byDay.set(x.day, [...(byDay.get(x.day) ?? []), ...(x.vehicles ?? [])])
  }
  return [...byDay].map(([day, vehicles]) => ({
    day,
    count: vehicles.length,
    vehicles: [...vehicles].sort(
      (a, b) => (a.addedAt?.toMillis() ?? 0) - (b.addedAt?.toMillis() ?? 0),
    ),
  }))
}
