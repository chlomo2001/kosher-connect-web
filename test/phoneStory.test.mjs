// A handset's own history, and the browser copy of it.
//
// Owner, 30 Aug 2026: "i wanna be able to see a history on each phone in
// rentals, at which date it got added to the inventory."
//
// The date was already there and had never been shown. `lines.created_at` is
// NOT NULL and honest — counted that day: 3 handsets on 26 Aug, 31 on the
// 27 Aug sheet import, 2 on 30 Aug. What kept it off the screen is
// lib/tableStore.js's listApp, which reads legacy_extras AND ONLY the blob, so
// every typed column beside it is write-only.
//
// The fact this file works hardest to defend: A HIRE OLDER THAN THE RECORD IS
// NORMAL. Kc-Live has 5 rentals that start before their handset's created_at,
// because the handsets arrived in an import while the hires were already
// running. Unexplained, the trail reads "added on the 26th, out with somebody
// on the 24th" and looks like a fault in the data instead of a fact about it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { phoneStory, phoneStoryLine } from '../lib/phoneStory.mjs'

const SRC = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')
const lift = () => {
  const m = SRC.match(/\/\/ ── KC_PHONESTORY mirror start ──\n([\s\S]*?)\n\/\/ ── KC_PHONESTORY mirror end ──/)
  assert.ok(m, 'KC_PHONESTORY mirror region not found in public/main.js')
  return new Function(`${m[1]}; return KC_PHONESTORY;`)()
}

const PHONE = { id: 'p1', addedAt: '2026-08-27T12:29:11Z', dataSource: 'import', status: 'available' }
const RENTALS = [
  { id: 'r1', phoneId: 'p1', customerName: 'Adler', fromDate: '2026-08-28', toDate: '2026-09-04', status: 'returned', returnedDate: '2026-09-05' },
  { id: 'r2', phoneId: 'p1', customerName: 'Weiss', fromDate: '2026-09-10', toDate: '2026-09-20', status: 'active' },
  { id: 'r3', phoneId: 'OTHER', customerName: 'Nobody', fromDate: '2026-09-01', toDate: '2026-09-02' },
  { id: 'r4', phoneId: 'p1', customerName: 'Void', fromDate: '2026-09-25', toDate: '2026-09-26', voided: true },
]

test('the day it arrived is the bottom of the trail', () => {
  const ev = phoneStory(PHONE, RENTALS)
  const added = ev.find((e) => e.kind === 'added')
  assert.ok(added, 'no arrival event')
  assert.equal(added.date, '2026-08-27')
  assert.equal(ev[ev.length - 1].kind, 'added', 'the arrival should be the oldest thing on it')
})

test('another handset\'s hires and a voided one stay out of it', () => {
  const ev = phoneStory(PHONE, RENTALS)
  assert.ok(!ev.some((e) => /Nobody/.test(e.title)), "another phone's rental is on this trail")
  assert.ok(!ev.some((e) => /Void/.test(e.title)), 'a voided rental is on this trail')
})

test('newest first, because "where is it now" is the question asked most', () => {
  const dates = phoneStory(PHONE, RENTALS).map((e) => e.date).filter(Boolean)
  assert.deepEqual(dates, [...dates].sort().reverse())
})

test('a return is its own event, and only once it has happened', () => {
  const ev = phoneStory(PHONE, RENTALS)
  const backs = ev.filter((e) => e.kind === 'back')
  assert.equal(backs.length, 1, 'the running hire should not have a return row')
  assert.equal(backs[0].date, '2026-09-05')
})

test('a hire older than the record explains itself', () => {
  // The production case. Without this the trail looks wrong rather than honest.
  const late = { id: 'p2', addedAt: '2026-08-26', dataSource: 'import' }
  const early = [{ id: 'r9', phoneId: 'p2', customerName: 'Kopilowitz', fromDate: '2026-08-24', toDate: '2026-09-02' }]
  const added = phoneStory(late, early).find((e) => e.kind === 'added')
  assert.match(added.detail, /already out on hire from 2026-08-24, before there was a record of it/)
  // …and it says nothing of the kind when the dates are in the ordinary order.
  const ordinary = phoneStory(PHONE, RENTALS).find((e) => e.kind === 'added')
  assert.doesNotMatch(ordinary.detail, /already out on hire/)
})

test('an imported handset does not claim to have been bought that day', () => {
  // 31 of 36 arrived in one import. "Added to the inventory" on that date is
  // the day the APP learned about it, and the detail has to say so or the
  // screen is making a claim the data cannot support.
  const added = phoneStory(PHONE, RENTALS).find((e) => e.kind === 'added')
  assert.match(added.detail, /the day the app learned about it/)
  const typed = phoneStory({ ...PHONE, dataSource: 'app' }, []).find((e) => e.kind === 'added')
  assert.match(typed.detail, /Entered here by hand/)
})

test('no arrival date means no invented one', () => {
  const ev = phoneStory({ id: 'p3', status: 'available' }, RENTALS.filter((r) => r.phoneId === 'p1').map((r) => ({ ...r, phoneId: 'p3' })))
  assert.equal(ev.filter((e) => e.kind === 'added').length, 0)
  assert.ok(ev.length > 0, 'the hires should still be there')
})

test('a retired handset says so, and sorts last for want of a date', () => {
  const ev = phoneStory({ ...PHONE, status: 'retired' }, RENTALS)
  const last = ev[ev.length - 1]
  assert.equal(last.kind, 'retired')
  assert.equal(last.date, null, 'no retirement date is recorded, so none is invented')
})

test('dates are formatted by the caller, not baked in', () => {
  const fmt = { date: (d) => `[${d}]` }
  const ev = phoneStory(PHONE, RENTALS, null, fmt)
  assert.match(ev.find((e) => e.kind === 'out').detail, /until \[2026-09-20\]/)
})

test('the one-line version is the fold\'s summary', () => {
  assert.equal(phoneStoryLine(PHONE, RENTALS), '2 hires · on the books here since 2026-08-27')
  assert.equal(phoneStoryLine({ id: 'p4', addedAt: '2026-08-27' }, []), 'never been out · on the books here since 2026-08-27')
})

test('nothing at all does not throw', () => {
  for (const p of [null, undefined, {}]) assert.deepEqual(phoneStory(p, RENTALS), p ? [] : [])
  assert.deepEqual(phoneStory(PHONE, null).filter((e) => e.kind === 'out'), [])
})

test('the browser mirror tells exactly the same story', () => {
  const B = lift()
  const fmt = { date: (d) => `<${d}>` }
  const cases = [
    [PHONE, RENTALS], [{ ...PHONE, status: 'retired' }, RENTALS],
    [{ ...PHONE, dataSource: 'app' }, RENTALS], [{ id: 'p9' }, RENTALS],
    [{ id: 'p2', addedAt: '2026-08-26', dataSource: 'import' },
     [{ id: 'r9', phoneId: 'p2', customerName: 'K', fromDate: '2026-08-24', toDate: '2026-09-02' }]],
    [PHONE, []], [null, RENTALS],
  ]
  for (const [p, rs] of cases) {
    assert.deepEqual(B.phoneStory(p, rs, null, fmt), phoneStory(p, rs, null, fmt), JSON.stringify(p))
    assert.equal(B.phoneStoryLine(p || {}, rs, fmt), phoneStoryLine(p || {}, rs, fmt), JSON.stringify(p))
  }
})

test('the arrival date reaches the app, and never rides back into the blob', () => {
  // listApp reads the blob and only the blob, so listPhones has to read the
  // column beside it — and lib/mappers.js has to strip it again, or the blob
  // grows a copy of a column and the two start answering separately.
  const store = readFileSync(new URL('../lib/tableStore.js', import.meta.url), 'utf8')
  assert.match(store, /'lines', 'legacy_extras,created_at'/)
  assert.match(store, /addedAt: row\.created_at \|\| null/)
  const mappers = readFileSync(new URL('../lib/mappers.js', import.meta.url), 'utf8')
  assert.match(mappers, /legacy_extras: stripDerived\(p\)/)
  assert.match(mappers, /delete out\.addedAt/)
})

test('the dialog shows it, folded, under the fields', () => {
  assert.match(SRC, /<details class="ph-story-wrap">/)
  assert.match(SRC, /KC_PHONESTORY\.phoneStoryLine\(p, rentals, \{ date: fmtDate \}\)/)
  assert.match(SRC, /KC_PHONESTORY\.phoneStory\(p, rentals, localISO\(\), \{ date: fmtDate \}\)/)
  // A hire row opens the hire — the trail is a way in, not just a read.
  assert.match(SRC, /openManageRentalModal\('\$\{escJs\(String\(e\.rentalId\)\)\}'\)/)
})
