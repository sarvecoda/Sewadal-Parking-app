/** Matches Android `VehicleData` field names for Firestore documents. */
export type VehicleData = {
  id?: number
  entry1: string
  entry2: string
  entry3: string
  entry4: string
  /** Set on today-list writes so the list can show oldest first, newest last. */
  addedAt?: { toMillis: () => number }
}

export type VehicleDoc = {
  id: string
  data: VehicleData
}

/** Max characters per string field stored in Firestore. */
export const VEHICLE_FIELD_MAX_LENGTH = 120

/** Add / Edit form fields (same names as the Firestore document). */
export type VehicleForm = Pick<VehicleData, 'entry1' | 'entry2' | 'entry3' | 'entry4'>

export const EMPTY_VEHICLE_FORM: VehicleForm = { entry1: '', entry2: '', entry3: '', entry4: '' }
