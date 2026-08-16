// Provenance lives in columns, never in the blob. Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { withProvenance, stripProvenance, needsConfirming } from '../lib/provenance.mjs'
import { customerToRow, customerRowFromTyped, simToRow } from '../lib/mappers.js'

test('reading adds provenance from the row', () => {
  const app = withProvenance({ id: '1', firstName: 'Menachem' },
    { data_source: 'import', verified_at: null })
  assert.equal(app.dataSource, 'import')
  assert.equal(app.verifiedAt, null)
  assert.equal(app.firstName, 'Menachem')       // nothing else disturbed
})

test('a row with no provenance columns reads as hand-entered', () => {
  assert.equal(withProvenance({ id: '1' }, {}).dataSource, 'app')
  assert.equal(withProvenance({ id: '1' }, undefined).dataSource, 'app')
})

test('THE INVARIANT — a customer round-trip never writes provenance into the blob', () => {
  // Read a row, then save it straight back: exactly what an edit does. If the
  // blob picked up verifiedAt, it would hold a stale copy of a column the
  // confirm queue is actively changing — two answers to "has anyone checked
  // this", diverging from the moment they are written.
  const row = {
    legacy_id: '1', first_name: 'Menachem', last_name: 'Adler',
    phone_country_code: '+44', phone_number: '7911123456',
    legacy_extras: { id: '1', firstName: 'Menachem', lastName: 'Adler', notes: 'keep' },
    data_source: 'import', verified_at: '2026-08-16T10:00:00.000Z',
  }
  const app = customerRowFromTyped(row)
  assert.equal(app.dataSource, 'import')        // visible to the app…
  const back = customerToRow(app)
  assert.equal('dataSource' in back.legacy_extras, false)   // …and not stored
  assert.equal('verifiedAt' in back.legacy_extras, false)
  assert.equal(back.legacy_extras.notes, 'keep')            // the rest survives
})

test('THE INVARIANT — the same holds for SIMs', () => {
  const app = withProvenance(
    { id: 's1', provider: 'lebara', simNumber: '07349967598', customerId: 'c1' },
    { data_source: 'import', verified_at: null })
  const row = simToRow(app, 'uuid-1')
  assert.equal('dataSource' in row.legacy_extras, false)
  assert.equal('verifiedAt' in row.legacy_extras, false)
  assert.equal(row.legacy_extras.provider, 'Lebara')   // canonicalising still runs
  assert.equal(row.provider, 'Lebara')
})

test('stripping an object with no provenance leaves it untouched', () => {
  const obj = { id: '1', firstName: 'Menachem' }
  assert.equal(stripProvenance(obj), obj)   // same reference, no needless copy
})

test('needsConfirming is only true for imported-and-unvouched-for', () => {
  assert.equal(needsConfirming({ dataSource: 'import', verifiedAt: null }), true)
  assert.equal(needsConfirming({ dataSource: 'import', verifiedAt: '2026-08-16T10:00:00Z' }), false)
  assert.equal(needsConfirming({ dataSource: 'app', verifiedAt: null }), false)
  assert.equal(needsConfirming({}), false)
  assert.equal(needsConfirming(null), false)
})

test('null and non-objects pass through both directions', () => {
  assert.equal(withProvenance(null, { data_source: 'import' }), null)
  assert.equal(stripProvenance(null), null)
  assert.equal(stripProvenance('nope'), 'nope')
})
