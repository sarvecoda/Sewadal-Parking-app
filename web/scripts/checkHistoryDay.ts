// Run: npm run check:history
import assert from 'node:assert/strict'
import { dayKeyIST, shiftDayKey } from '../src/historyDay.ts'

// India is UTC+5:30: 18:29:59Z is 23:59:59 IST, 18:30:00Z is the next day.
assert.equal(dayKeyIST(new Date('2026-10-16T18:29:59Z')), '2026-10-16')
assert.equal(dayKeyIST(new Date('2026-10-16T18:30:00Z')), '2026-10-17')
assert.equal(dayKeyIST(new Date('2026-12-31T19:00:00Z')), '2027-01-01')

assert.equal(shiftDayKey('2026-03-01', -1), '2026-02-28')
assert.equal(shiftDayKey('2028-03-01', -1), '2028-02-29')
// 23-day window with today included: oldest kept day is 22 days back.
assert.equal(shiftDayKey('2026-10-17', -22), '2026-09-25')

console.log('historyDay ok')
