import { VEHICLE_FIELD_MAX_LENGTH } from './types'

/**
 * Compare plates ignoring case and spaces (KA03NX1174 === "KA 03 NX 1174").
 */
export function plateKey(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/**
 * Format vehicle number like "KA 03 NX 1174" (uppercase + spaced groups).
 * Unrecognised shapes still get uppercase + letter↔digit spacing.
 */
export function formatVehicleNumber(raw: string): string {
  const compact = plateKey(raw).slice(0, VEHICLE_FIELD_MAX_LENGTH)
  if (!compact) return ''

  // Bharat series: 25BH5239F → 25 BH 5239 F
  const bh = compact.match(/^(\d{2})(BH)(\d{4})([A-Z]{0,2})$/)
  if (bh) {
    return [bh[1], bh[2], bh[3], bh[4]].filter(Boolean).join(' ')
  }

  // Standard RTO: KA03NX1174 → KA 03 NX 1174
  const classic = compact.match(/^([A-Z]{2})(\d{2})([A-Z]{1,3})(\d{4})$/)
  if (classic) {
    return `${classic[1]} ${classic[2]} ${classic[3]} ${classic[4]}`
  }

  // Soft fallback: space at every letter↔digit boundary
  return compact
    .replace(/([A-Z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Z])/g, '$1 $2')
}
