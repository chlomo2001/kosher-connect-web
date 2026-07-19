import { test } from 'node:test'
import assert from 'node:assert/strict'
import { londonDate, londonDayStartUtc, londonDayBoundsUtc } from '../lib/localDay.mjs'

// These MUST hold regardless of the process TZ (the gate runs the suite under
// both the default zone and Asia/Jerusalem) — the helpers pin Europe/London.

test('londonDayStartUtc — BST day opens at 23:00 UTC the previous day', () => {
  // 19 Jul 2026 is British Summer Time (UTC+1): London midnight = 18 Jul 23:00Z.
  assert.equal(londonDayStartUtc('2026-07-19'), '2026-07-18T23:00:00.000Z')
})

test('londonDayStartUtc — GMT day opens at 00:00 UTC', () => {
  // 15 Jan 2026 is GMT (UTC+0): London midnight = the same UTC midnight.
  assert.equal(londonDayStartUtc('2026-01-15'), '2026-01-15T00:00:00.000Z')
})

test('londonDayStartUtc — spring-forward day (clocks jump at 01:00 BST)', () => {
  // 29 Mar 2026 clocks go forward; midnight itself is still GMT (00:00Z).
  assert.equal(londonDayStartUtc('2026-03-29'), '2026-03-29T00:00:00.000Z')
})

test('londonDayStartUtc — autumn day just after the clocks go back', () => {
  // 26 Oct 2025 clocks went back at 02:00 BST→GMT; the day still opens in BST
  // (still UTC+1 at midnight) = 25 Oct 23:00Z.
  assert.equal(londonDayStartUtc('2025-10-26'), '2025-10-25T23:00:00.000Z')
})

test('londonDayBoundsUtc — a summer day is a full 24h window on the right side of UTC midnight', () => {
  const { start, end } = londonDayBoundsUtc('2026-07-19')
  assert.equal(start, '2026-07-18T23:00:00.000Z')
  assert.equal(end, '2026-07-19T23:00:00.000Z')
  // A 00:30 London-time till movement (23:30 UTC on the 18th) falls INSIDE.
  const move = Date.parse('2026-07-18T23:30:00Z')
  assert.ok(move >= Date.parse(start) && move < Date.parse(end),
    'a 00:30 London movement must land on this day, not the day before')
  // The old UTC-midnight window [19T00:00Z, 20T00:00Z) would have missed it.
  assert.ok(move < Date.parse('2026-07-19T00:00:00Z'),
    'and it sits before UTC midnight — the exact case the old window dropped')
})

test('londonDayBoundsUtc — the DST-change day (26 Oct 2025) is a 25-hour window', () => {
  const { start, end } = londonDayBoundsUtc('2025-10-26')
  const hours = (Date.parse(end) - Date.parse(start)) / 3600000
  assert.equal(hours, 25) // clocks go back → the day is an hour longer
})

test('londonDate — formats the shop-local calendar date for a known instant', () => {
  // 2026-07-18T23:30:00Z is already 00:30 on the 19th in London (BST).
  assert.equal(londonDate(0, Date.parse('2026-07-18T23:30:00Z')), '2026-07-19')
  // ...and still the 18th in UTC — the distinction the Z-report depends on.
  assert.equal(londonDate(0, Date.parse('2026-07-18T12:00:00Z')), '2026-07-18')
})
