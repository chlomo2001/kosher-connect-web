// Undoing a carrier-mail match (owner, 19 Aug: "any way to undo a non needs a
// human match?").
//
// The interesting half is not the undo — it is that the undo HOLDS. Clearing
// sim_id alone leaves the row in exactly the state the nightly sweep hunts for
// (resolved_at null AND sim_id null), so the next run would re-file it on the
// SIM the person just rejected. These hold the two halves together, because
// they live in different files and only fail as a pair.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const API = readFileSync(new URL('../pages/api/sim-mail.js', import.meta.url), 'utf8')
const SWEEP = readFileSync(new URL('../pages/api/cron/sweep.js', import.meta.url), 'utf8')
const MAIN = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')

test('unpairing clears the match AND marks it, in one write', () => {
  const m = API.match(/if \(op === 'unpair'\) \{[\s\S]*?\n    \}/)
  assert.ok(m, 'the unpair op is missing from the endpoint')
  const fn = m[0]
  for (const [field, why] of [
    ['sim_id: null', 'the match must actually be cleared'],
    ['customer_id: null', 'the customer link must go with it'],
    ['resolved_at: null', 'it must return to the queue'],
    ['unpaired_at: now', 'without this the sweep re-files it overnight'],
  ]) {
    assert.ok(fn.includes(field), `${field} — ${why}`)
  }
  // Only something actually filed can be unfiled.
  assert.match(fn, /sim_id=not\.is\.null/, 'unpairing must refuse a message that is not filed')
  // And it records who, because this overrules the machine.
  assert.match(fn, /unpaired_by/, 'the person who overruled the match is not recorded')
})

test('the nightly sweep leaves an unfiled message alone', () => {
  // This is the whole point. Without the filter the undo undoes itself.
  const m = SWEEP.match(/const stuck = await selectAllPaged\(\s*'sim_mail',[\s\S]*?\)/)
  assert.ok(m, "the sweep's re-pair query is missing")
  assert.match(m[0], /unpaired_at=is\.null/,
    'the sweep would re-file a message a person has just unfiled')
  // …and it still only looks at messages that are genuinely unfiled.
  assert.match(m[0], /resolved_at=is\.null/)
  assert.match(m[0], /sim_id=is\.null/)
})

test('the undo is only offered on a message that is filed', () => {
  assert.match(MAIN, /m\.sim \? `<button[^`]*cmUnpair/,
    'the undo button must only appear on a filed message')
  const fn = MAIN.match(/async function cmUnpair\(id\) \{[\s\S]*?\n\}/)
  assert.ok(fn, 'cmUnpair is missing')
  assert.match(fn[0], /kcConfirm/, 'undoing a match should ask first')
  assert.match(fn[0], /op: 'unpair'/)
})
