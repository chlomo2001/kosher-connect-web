// The batch-levelling hazard, and the mappers that must not trip it.
//
// db.uniformRows fills each row's missing keys with explicit nulls, because
// PostgREST rejects a mixed-key batch whole (PGRST102). That is right, and it
// has one sharp edge: a key sent on SOME rows becomes an explicit null on the
// rest. For a `not null default now()` column that is 23502 and the entire
// batch fails.
//
// It happened. sims.created_at is not null default now(); all 796 stored SIMs
// lack createdAt in their blob so the key was omitted for them, and a newly
// added SIM carried one. Every save that added a SIM died from 19 Jul to
// 20 Aug — invisibly, because the caller did not await the result. A customer
// was charged £20 for a plan that was never stored.
import test from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { uniformRows } from '../lib/db.js'
import { customerToRow, simToRow, rentalToRow } from '../lib/mappers.js'

const ROOT = path.join(import.meta.dirname, '..')

test('uniformRows really does turn a missing key into an explicit null', () => {
  const out = uniformRows([{ a: 1, b: 2 }, { a: 3 }])
  assert.deepEqual(out, [{ a: 1, b: 2 }, { a: 3, b: null }])
  assert.ok('b' in out[1], 'the key must be present — that is the whole hazard')
})

test('a single row is passed through untouched', () => {
  const one = [{ a: 1 }]
  assert.equal(uniformRows(one), one)
})

// The fix: never send created_at, so the batch cannot become mixed on it.
// Sending it on every row would work too, but rewriting a creation stamp on
// every upsert is wrong on its own terms.
for (const [name, build] of [
  ['customerToRow', () => customerToRow({ id: 'c1', firstName: 'A', lastName: 'B', createdAt: '2026-01-01T00:00:00.000Z' })],
  ['simToRow', () => simToRow({ id: 's1', customerId: 'c1', createdAt: '2026-01-01T00:00:00.000Z' }, 'uuid-1')],
  ['rentalToRow', () => rentalToRow({ id: 'r1', customerId: 'c1', createdAt: '2026-01-01T00:00:00.000Z' }, 'uuid-1', null)],
]) {
  test(`${name} never sends created_at, even when the app object has one`, () => {
    const row = build()
    assert.ok(!('created_at' in row),
      `${name} must not send created_at — a mixed batch nulls it on every other row (23502)`)
  })
}

test('a batch built from mixed app objects stays uniform on created_at', () => {
  const rows = [
    simToRow({ id: 'old', customerId: 'c1' }, 'u1'),                                  // no createdAt (the 796)
    simToRow({ id: 'new', customerId: 'c1', createdAt: new Date().toISOString() }, 'u1'), // the newly added one
  ]
  const levelled = uniformRows(rows)
  for (const r of levelled) {
    assert.ok(!('created_at' in r), 'created_at leaked back into the payload')
  }
})

// Wiring: the caller must not act on an unverified save.
test('the SIM form awaits its save before charging or claiming success', () => {
  const src = readFileSync(path.join(ROOT, 'public/main.js'), 'utf8')
  const fn = src.slice(src.indexOf('async function saveSimForm(editId)'))
  const body = fn.slice(0, fn.indexOf('\n}\n'))

  assert.match(body, /const simSaved = await saveSims\(sims\)/,
    'saveSims must be awaited — fire-and-forget is what billed £20 for an unsaved plan')
  assert.match(body, /if \(!simSaved \|\| simSaved\.success === false\)[\s\S]{0,320}?return;/,
    'a failed save must stop the function')

  const awaitAt = body.indexOf('const simSaved = await saveSims')
  const guardAt = body.indexOf('simSaved.success === false')
  const chargeAt = body.indexOf('window.api.chargeSim')
  const panelAt = body.indexOf('showDonePanel')
  assert.ok(awaitAt < guardAt, 'the guard must follow the await')
  assert.ok(guardAt < chargeAt, 'nothing may be charged before the save is known to have worked')
  assert.ok(guardAt < panelAt, 'the done card must not be shown before the save is known to have worked')
})
