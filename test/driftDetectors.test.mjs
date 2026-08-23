// Issue #14 — drift between the typed columns and the blob, made detectable
// on the three tables where it was invisible.
//
// sims, rentals and lines are blob-only reads: the app writes the typed
// columns and never reads them back, so a disagreement has no symptom today
// and becomes archaeology the day anything cuts over to the columns. These
// detectors are the same shape as customerDrift (the one table that already
// had one); the sweep runs all four nightly and raises a DRIFT-<table> task,
// because customerDrift's own report was a console.warn nobody reads.
//
// Proven necessary before it shipped: measured on production 23 Aug, 206 sims
// carried a blob customerId naming a DELETED merge-duplicate while the typed
// FK named the survivor — the exact class clarity-scan T2.11 predicted.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  simToRow, rentalToRow, phoneToRow,
  simDrift, rentalDrift, lineDrift,
} from '../lib/mappers.js'

const SIM = { id: 'sim-1', customerId: 'c-1', provider: 'Lebara', renewalDate: '2026-09-01',
  paymentType: 'through-me', simMonthlyCost: 10, ddDate: 1, status: 'active' }
const RENTAL = { id: 'r-1', customerId: 'c-1', country: 'USA', fromDate: '2026-08-01',
  toDate: '2026-08-10', price: 40, lateFee: 0, lostChargesTotal: 0, status: 'returned',
  chargeableDays: 7, totalDays: 10 }
const PHONE = { id: 'p-1', number: '07700900123', country: 'USA', company: 'T-Mobile',
  simId: 'SIM123', imei: '350000000000000', status: 'available', notes: '' }

test('a row written by the mapper reports no drift — the baseline that makes a report mean something', () => {
  assert.deepEqual(simDrift(simToRow(SIM, 'uuid-1')), [])
  assert.deepEqual(rentalDrift(rentalToRow(RENTAL, 'uuid-1', 'uuid-2')), [])
  assert.deepEqual(lineDrift(phoneToRow(PHONE)), [])
})

test('a typed column edited behind the blob’s back is caught, and named', () => {
  const sim = { ...simToRow(SIM, 'uuid-1'), provider: 'Vodafone' }
  assert.deepEqual(simDrift(sim).map((d) => d.field), ['provider'])

  const rental = { ...rentalToRow(RENTAL, 'uuid-1', 'uuid-2'), base_charge: 999 }
  assert.deepEqual(rentalDrift(rental).map((d) => d.field), ['base_charge'])

  const line = { ...phoneToRow(PHONE), status: 'retired' }
  assert.deepEqual(lineDrift(line).map((d) => d.field), ['status'])
})

test('a blob edited behind the columns’ back is the same drift, seen from the other side', () => {
  const row = simToRow(SIM, 'uuid-1')
  row.legacy_extras = { ...row.legacy_extras, renewalDate: '2026-10-01' }
  assert.deepEqual(simDrift(row).map((d) => d.field), ['next_renewal_date'])
})

test('an empty or missing blob does not throw — a detector that crashes detects nothing', () => {
  assert.ok(Array.isArray(simDrift({ legacy_extras: null })))
  assert.ok(Array.isArray(rentalDrift({})))
  assert.ok(Array.isArray(lineDrift({ legacy_extras: {} })))
})

test('the sweep surfaces each table as a rolling task, and closes it clean', () => {
  const sweep = readFileSync(new URL('../pages/api/cron/sweep.js', import.meta.url), 'utf8')
    .split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
  assert.match(sweep, /section\('drift'/)
  assert.match(sweep, /reference: `DRIFT-\$\{table\}`/)
  assert.match(sweep, /closeOpenTask\(`DRIFT-\$\{table\}`\)/)
  // The FK check the field detectors cannot do alone — the 206-sims class.
  assert.match(sweep, /uuidByLegacy/)
})
