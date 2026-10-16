const IST_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Calendar day in India time as `YYYY-MM-DD`. */
export function dayKeyIST(date: Date): string {
  const parts = Object.fromEntries(IST_PARTS.formatToParts(date).map((p) => [p.type, p.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

/** Moves a `YYYY-MM-DD` key by whole days (negative = earlier). */
export function shiftDayKey(day: string, deltaDays: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + deltaDays)).toISOString().slice(0, 10)
}
