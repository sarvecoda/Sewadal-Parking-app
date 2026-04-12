/** Matches Android `VehicleData` field names for Firestore documents. */
export type VehicleData = {
  id?: number
  entry1: string
  entry2: string
  entry3: string
  entry4: string
}

export type VehicleDoc = {
  id: string
  data: VehicleData
}

/** Max characters per string field stored in Firestore. */
export const VEHICLE_FIELD_MAX_LENGTH = 120
