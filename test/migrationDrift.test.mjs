// The migration drift check. Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { migrationName, parseDbMigrations, diffMigrations } from '../lib/migrationDrift.mjs'

test('migrationName — strips path, extension and version stamp', () => {
  assert.equal(
    migrationName('supabase/migrations/20260719240000_customers_passport_on_file.sql'),
    'customers_passport_on_file'
  )
  assert.equal(migrationName('20260712120000_initial_schema.sql'), 'initial_schema')
  assert.equal(migrationName('initial_schema'), 'initial_schema')
  // Underscores and digits inside the name survive — only the leading stamp goes.
  assert.equal(migrationName('20260715110100_sim_charge_sign.sql'), 'sim_charge_sign')
})

test('parseDbMigrations — takes the shapes the tools actually return', () => {
  const expected = ['initial_schema', 'rls']
  assert.deepEqual(parseDbMigrations({ migrations: [
    { version: '20260712120000', name: 'initial_schema' },
    { version: '20260712120100', name: 'rls' },
  ] }), expected)
  assert.deepEqual(parseDbMigrations('{"migrations":[{"version":"1","name":"initial_schema"},{"version":"2","name":"rls"}]}'), expected)
  assert.deepEqual(parseDbMigrations([{ name: 'initial_schema' }, { name: 'rls' }]), expected)
  assert.deepEqual(parseDbMigrations('initial_schema\nrls\n'), expected)
  assert.deepEqual(parseDbMigrations(''), [])
  assert.deepEqual(parseDbMigrations(null), [])
  assert.throws(() => parseDbMigrations('{not json'), /valid JSON/)
})

test('diffMigrations — mismatched versions are NOT drift', () => {
  // The real shape of Kc-Live: every version differs from the repo filename
  // because apply_migration stamps its own. Diffing on version would call all
  // of this drift; diffing on name correctly reports none.
  const repo = [
    '20260712120000_initial_schema.sql',
    '20260719240000_customers_passport_on_file.sql',
  ]
  const db = { migrations: [
    { version: '20260712120000', name: 'initial_schema' },
    { version: '20260731171234', name: 'customers_passport_on_file' },  // stamped at apply time
  ] }
  const r = diffMigrations(repo, db)
  assert.equal(r.ok, true)
  assert.deepEqual(r.missingInDb, [])
  assert.deepEqual(r.extraInDb, [])
})

test('diffMigrations — catches the gap that was actually real', () => {
  // Production held everything except customers_passport_on_file.
  const repo = [
    '20260712120000_initial_schema.sql',
    '20260719240000_customers_passport_on_file.sql',
    '20260731100000_refund_payout_enum.sql',
  ]
  const db = { migrations: [{ version: '20260712120000', name: 'initial_schema' }] }
  const r = diffMigrations(repo, db)
  assert.equal(r.ok, false)
  assert.deepEqual(r.missingInDb, ['customers_passport_on_file', 'refund_payout_enum'])
  assert.deepEqual(r.extraInDb, [])
  assert.equal(r.repoCount, 3)
  assert.equal(r.dbCount, 1)
})

test('diffMigrations — flags a migration the database has but the repo does not', () => {
  const r = diffMigrations(['20260712120000_initial_schema.sql'], 'initial_schema\napplied_by_hand')
  assert.equal(r.ok, false)
  assert.deepEqual(r.extraInDb, ['applied_by_hand'])
})

test('diffMigrations — a duplicate name makes matching unsafe and must be loud', () => {
  // Name matching only holds while names are unique. Two files sharing one name
  // would silently mask a missing migration, so it fails rather than compares.
  const r = diffMigrations(
    ['20260101000000_shared_name.sql', '20260202000000_shared_name.sql'],
    'shared_name'
  )
  assert.deepEqual(r.duplicateNames, ['shared_name'])
  assert.equal(r.ok, false)
})

test('diffMigrations — same filenames on both sides, no drift', () => {
  const files = ['20260712120000_initial_schema.sql', '20260712120100_rls.sql']
  const r = diffMigrations(files, 'initial_schema\nrls')
  assert.equal(r.ok, true)
  assert.equal(r.repoCount, 2)
  assert.equal(r.dbCount, 2)
})
