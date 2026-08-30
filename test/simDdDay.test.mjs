// "no value" is not zero, and one bad row must not take the shop's SIMs with it.
//
// 30 Aug, from the Vercel log rather than from the screen:
//
//   POST /api/sims 500 — new row for relation "sims" violates check constraint
//   "sims_dd_collection_day_check" … (…, per_service, 0, null, 2026-09-19, kc,
//   null, 0.00, …)
//
// A new through-me Lebara line arrived with dd_collection_day = 0 against a
// CHECK of 1-31. The cause is one line in lib/mappers.js: `Number(null)` is 0
// and `Number('')` is 0, both finite, so numOrNull turned "not set" into an
// explicit zero. And because syncSims upserts all 797 rows in a single batch,
// that one row meant NOTHING saved — for every customer, not just that one.
//
// What the counter saw was "Couldn't save sims — reload to check nothing was
// lost", the same sentence a dropped connection produces. The reason existed
// only in a server log. That is the second time in one day (see
// test/emailLogStatus.test.mjs) that a real database refusal reached a person
// as a shrug, so both halves are pinned here.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { simToRow } from '../lib/mappers.js'

const SRC = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')
const API = readFileSync(new URL('../pages/api/sims.js', import.meta.url), 'utf8')

const dd = (ddDate, paymentType = 'monthly') =>
  simToRow({ id: 's1', provider: 'Lebara', status: 'active', paymentType, ddDate }, 'cust-uuid').dd_collection_day

test('the row that actually broke production maps to null now', () => {
  // Through-me, no direct-debit day. This is the exact shape from the log.
  assert.equal(dd(null), null)
})

test('every value the column would refuse becomes null instead', () => {
  // The constraint is BETWEEN 1 AND 31. A mapper owes the database a value the
  // database will accept — anything else is not a smaller problem than a wrong
  // day, it is a failed write for every SIM in the shop.
  for (const bad of [0, -1, 32, 99, 1.5, '', '   ', 'first', NaN, null, undefined, {}, []]) {
    assert.equal(dd(bad), null, `ddDate ${JSON.stringify(bad)} should map to null`)
  }
})

test('a real day still gets through, at both ends of the range', () => {
  assert.equal(dd(1), 1)
  assert.equal(dd(15), 15)
  assert.equal(dd(31), 31)
  assert.equal(dd('7'), 7, 'a numeric string from a form input is a real day')
})

test('a customer-pays line never carries a day at all', () => {
  assert.equal(dd(15, 'direct'), null)
})

test('null and empty stop being zero everywhere, not just here', () => {
  // numOrNull feeds the rental money fields too — price, late fee, lost
  // charges. "Not priced" arriving as £0.00 is the same bug wearing money.
  const src = readFileSync(new URL('../lib/mappers.js', import.meta.url), 'utf8')
  const fn = src.match(/const numOrNull = \(v\) => \{[\s\S]*?\n\}/)
  assert.ok(fn, 'numOrNull has moved')
  assert.match(fn[0], /if \(v === null \|\| v === undefined \|\| v === ''\) return null/)
})

test('the day guard is its own function, not an inline condition', () => {
  const src = readFileSync(new URL('../lib/mappers.js', import.meta.url), 'utf8')
  assert.match(src, /const dayOrNull = \(v\) => \{/)
  assert.match(src, /dd_collection_day: throughMe \? dayOrNull\(s\.ddDate\) : null/)
})

test('the server says which column it was, in words a counter can act on', () => {
  assert.match(API, /sims_dd_collection_day_check/)
  assert.match(API, /set a day between 1 and 31, and save again/)
  // And any other refusal comes back named rather than as STORAGE_ERROR.
  assert.match(API, /violates check constraint\|violates foreign key\|duplicate key/)
})

test('the browser repeats the reason instead of its own fixed sentence', () => {
  const fn = SRC.match(/function reportSave\(label, promise\) \{[\s\S]*?\n\}/)
  assert.ok(fn, 'reportSave has moved')
  assert.match(fn[0], /const why = res && res\.error \? String\(res\.error\) : '';/)
  assert.match(fn[0], /Couldn’t save \$\{label\} — \$\{why\}/)
  // The old sentence stays for a failure that genuinely says nothing.
  assert.match(fn[0], /reload to check nothing was lost/)
})
