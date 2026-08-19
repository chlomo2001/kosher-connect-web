// Every "needs attention" line opens the list it counted, already narrowed.
//
// Owner #15, 19 August: the dashboard's overdue line opened the plain SIMs tab.
// The line had just told you the answer and then made you work it out again by
// hand. The same was true of two more lines beside it and of two results in the
// command palette, so this holds all of them rather than the one that was
// noticed.
//
// Checked in the source rather than by driving the app: what matters is that
// each row carries a filter at all, and a rendered check would pass the moment
// the seed happened to have nothing overdue.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const MAIN = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')

/** The body of the attention/coming feed, where every one of these lives. */
const feed = () => {
  const from = MAIN.indexOf('const coming = [];')
  assert.ok(from > -1, 'the attention feed is missing')
  return MAIN.slice(from, MAIN.indexOf('const lowStock', from))
}

test('a repair-ready line opens the repairs list on ready', () => {
  const f = feed()
  assert.match(f, /readyRepairs\.forEach[\s\S]*?kcView\('repairs'\)\.filter = 'ready'/,
    'the repair line must land on the repairs it counted')
  assert.ok(!/readyRepairs\.forEach[\s\S]{0,240}goToTab\('repairs'\)/.test(f),
    'the repair line still opens the plain tab')
})

test('a flight line opens the bookings list on upcoming', () => {
  const f = feed()
  assert.match(f, /travel7\.forEach[\s\S]*?kcView\('bookings'\)\.filter = 'upcoming'/,
    'the flight line must land on the flights it counted')
  assert.ok(!/travel7\.forEach[\s\S]{0,240}goToTab\('bookings'\)/.test(f),
    'the flight line still opens the plain tab')
})

test('the SIM roll-up opens the plans renewing this week', () => {
  // 'week' is the SIM list's own "renewing in the next 7 days" — the very set
  // the line counted. Landing on all 797 plans is the defect owner #15 named.
  const f = feed()
  assert.match(f, /renewals7\.length > 3[\s\S]*?simFilterStatus = 'week'/,
    'the roll-up must open the plans it counted, not every plan')
  assert.ok(!/renewals7\.length > 3[\s\S]{0,200}goToTab\('sim'\)/.test(f),
    'the roll-up still opens the plain SIM tab')
})

test('the late-renewal line keeps its own filter', () => {
  // This one was already right; it is here so a sweep of the others cannot
  // quietly take it with them.
  assert.match(feed(), /renewalsLate\.length[\s\S]*?simFilterStatus = 'late'/)
})

test('a palette hit that names one booking opens that booking', () => {
  // Searching a booking reference and landing on the whole list is the app
  // forgetting what you just typed. The SIM result has always opened its own
  // record; this holds the flight one to the same standard.
  const from = MAIN.indexOf('for (const b of bookings) {')
  assert.ok(from > -1, 'the palette booking loop is missing')
  const block = MAIN.slice(from, MAIN.indexOf('for (const s of sims', from))
  assert.match(block, /openEditBookingModal\(b\.id\)/, 'it must open the booking itself')
  assert.ok(!/run: \(\) => goToTab\('bookings'\)/.test(block), 'it still opens the plain tab')
})

test('the palette repair hit is honest about going to the tab', () => {
  // Deliberately NOT changed: a repair has no record of its own to open and the
  // repairs list has no search term to set. The comment is the point — without
  // it, the next person "fixes" this by inventing state that does not exist,
  // which is exactly what I did on the first attempt.
  const from = MAIN.indexOf('for (const r of repairs) {')
  const block = MAIN.slice(from, MAIN.indexOf('for (const o of serviceOrders', from))
  assert.match(block, /goToTab\('repairs'\)/)
  assert.ok(!/repairSearchTerm/.test(MAIN),
    'repairSearchTerm does not exist — nothing may set it')
})
