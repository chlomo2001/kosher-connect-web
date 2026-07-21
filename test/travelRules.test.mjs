import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  natCode, destCode, requirementFor, passportCheck, coverageStatus,
} from '../lib/travelRules.mjs'

test('natCode folds common free-text forms', () => {
  assert.equal(natCode('British'), 'GB')
  assert.equal(natCode('UK'), 'GB')
  assert.equal(natCode('United Kingdom'), 'GB')
  assert.equal(natCode('American'), 'US')
  assert.equal(natCode('Israeli'), 'IL')
  assert.equal(natCode('israel'), 'IL')
  assert.equal(natCode('Canadian'), 'CA')
  assert.equal(natCode('Belgian'), 'BE')
  assert.equal(natCode('Swiss'), 'CH')
  assert.equal(natCode('Hungarian'), 'HU')
  assert.equal(natCode('Austrian'), 'AT')
  assert.equal(natCode(''), '')
  assert.equal(natCode('Martian'), '')
})

test('destCode reads a country or a route tail', () => {
  assert.equal(destCode('USA'), 'US')
  assert.equal(destCode('MAN → JFK'), 'US')
  assert.equal(destCode('Manchester to Tel Aviv'), 'IL')
  assert.equal(destCode('Toronto'), 'CA')
  assert.equal(destCode('Israel'), 'IL')
  assert.equal(destCode('Vienna'), 'EU')
  assert.equal(destCode(''), '')
})

test('USA: ESTA for VWP passports, none for US/Canadian', () => {
  assert.equal(requirementFor({ destination: 'USA', nationality: 'British' }).code, 'ESTA')
  assert.equal(requirementFor({ destination: 'USA', nationality: 'Israeli' }).code, 'ESTA')
  assert.equal(requirementFor({ destination: 'USA', nationality: 'Austrian' }).code, 'ESTA')
  assert.equal(requirementFor({ destination: 'USA', nationality: 'American' }).code, 'NONE')
  assert.equal(requirementFor({ destination: 'USA', nationality: 'Canadian' }).code, 'NONE')
})

test('Israel: ETA-IL for every foreign passport, none for Israeli', () => {
  for (const nat of ['British', 'American', 'Canadian', 'Belgian', 'Swiss', 'Hungarian', 'Austrian']) {
    assert.equal(requirementFor({ destination: 'Israel', nationality: nat }).code, 'ETA_IL', nat)
  }
  assert.equal(requirementFor({ destination: 'Israel', nationality: 'Israeli' }).code, 'NONE')
})

test('Canada: eTA for European passports, none for US, CHECK for Israeli', () => {
  assert.equal(requirementFor({ destination: 'Canada', nationality: 'British' }).code, 'ETA_CA')
  assert.equal(requirementFor({ destination: 'Canada', nationality: 'Belgian' }).code, 'ETA_CA')
  assert.equal(requirementFor({ destination: 'Canada', nationality: 'American' }).code, 'NONE')
  const il = requirementFor({ destination: 'Canada', nationality: 'Israeli' })
  assert.equal(il.code, 'CHECK')
  assert.match(il.note, /visitor visa/i)
})

test('Europe: none for EU nationals, ETIAS-coming note for others', () => {
  assert.equal(requirementFor({ destination: 'Europe', nationality: 'Belgian' }).code, 'NONE')
  const gb = requirementFor({ destination: 'Europe', nationality: 'British' })
  assert.equal(gb.code, 'NONE')
  assert.match(gb.note, /ETIAS/)
})

test('requirementFor honours the owner-edited DB rules', () => {
  const rules = [{ destination: 'US', nationality: 'GB', auth_type: 'VISA', note: 'changed', active: true }]
  const r = requirementFor({ destination: 'USA', nationality: 'British', rules })
  assert.equal(r.code, 'VISA')
  assert.equal(r.note, 'changed')
  // any cell not overridden falls back to the built-in default
  assert.equal(requirementFor({ destination: 'USA', nationality: 'Israeli', rules }).code, 'ESTA')
  // an inactive rule is ignored (falls back)
  const inactive = [{ destination: 'US', nationality: 'GB', auth_type: 'VISA', active: false }]
  assert.equal(requirementFor({ destination: 'USA', nationality: 'British', rules: inactive }).code, 'ESTA')
})

test('unknown inputs return CHECK with a helpful reason', () => {
  assert.equal(requirementFor({ destination: '', nationality: 'British' }).reason, 'destination-unknown')
  assert.equal(requirementFor({ destination: 'USA', nationality: '' }).reason, 'nationality-unknown')
})

test('passportCheck applies the 6-month rule against travel date', () => {
  // travels 2026-08-01, needs valid to ~2027-02-01
  const bad = passportCheck({ passportExpiry: '2026-10-01', travelDate: '2026-08-01' })
  assert.equal(bad.ok, false)
  assert.equal(bad.needBy, '2027-02-01')
  const good = passportCheck({ passportExpiry: '2027-06-01', travelDate: '2026-08-01' })
  assert.equal(good.ok, true)
  const unknown = passportCheck({ passportExpiry: '', travelDate: '2026-08-01' })
  assert.equal(unknown.ok, null)
})

test('coverageStatus: missing, covered, expires-before-travel', () => {
  const esta = requirementFor({ destination: 'USA', nationality: 'British' })
  assert.equal(coverageStatus({ requirement: esta, travelDate: '2026-08-01', auths: [] }).status, 'missing')
  assert.equal(
    coverageStatus({ requirement: esta, travelDate: '2026-08-01', auths: [{ type: 'ESTA', valid_until: '2028-01-01' }] }).status,
    'covered')
  const exp = coverageStatus({ requirement: esta, travelDate: '2026-08-01', auths: [{ type: 'ESTA', valid_until: '2026-07-01' }] })
  assert.equal(exp.status, 'expiring')
  assert.equal(exp.expiresBeforeTravel, true)
  // home / not-needed short-circuits
  const none = requirementFor({ destination: 'USA', nationality: 'American' })
  assert.equal(coverageStatus({ requirement: none, travelDate: '2026-08-01', auths: [] }).status, 'not-needed')
})
