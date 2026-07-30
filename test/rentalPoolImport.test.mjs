// The importer's whole job is to not lose things, so these tests are written
// from the ACTUAL cell values in the owner's sheet — "Pemenant", "?Erenfeld",
// "sim?" sitting in the IMEI column, "Usmonile wrap" — rather than from tidy
// invented ones. If a rule here changes, a real row changes with it.
// Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  REVIEW, REVIEW_LABEL, normaliseStatus, parseHolder, parseCarrier, splitLabel,
  parseNumber, parseIdField, parseAccountEmail, parsePoolDetails, buildLine, buildPool,
} from '../lib/rentalPoolImport.mjs'

const TODAY = new Date('2026-07-30T00:00:00Z')
const row = (o = {}) => {
  const r = new Array(11).fill(null)
  const at = { label: 0, number: 1, carrier: 2, status: 3, holder: 4, contact: 5, till: 6, account: 7, iccid: 8, imei: 9, pool: 10 }
  for (const [k, v] of Object.entries(o)) r[at[k]] = v
  return r
}
const line = (o, today = TODAY) => buildLine(row(o), { today, rowNumber: 2 }).phone

test('every review reason has a human sentence', () => {
  for (const code of Object.values(REVIEW)) {
    assert.ok(REVIEW_LABEL[code], `${code} has no label`)
  }
})

test('public/main.js mirrors REVIEW_LABEL exactly', () => {
  // main.js is a plain browser script and cannot import the module, so it
  // carries a copy. A reason added here but not there renders in the queue as
  // a raw slug like "holder-uncertain" — which tells the operator nothing.
  const src = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')
  const block = src.match(/const REVIEW_LABELS = \{([\s\S]*?)\n\};/)
  assert.ok(block, 'public/main.js must declare `const REVIEW_LABELS = {…};`')
  const mirrored = {}
  for (const m of block[1].matchAll(/'([^']+)':\s*'([^']*)'/g)) mirrored[m[1]] = m[2]
  assert.deepEqual(mirrored, REVIEW_LABEL, 'the two label maps have drifted — change both together')
})

test('status: all the hand-typed spellings in the sheet', () => {
  for (const s of ['rented', 'Rented']) assert.equal(normaliseStatus(s).status, 'rented')
  for (const s of ['available', 'Available', 'availble']) assert.equal(normaliseStatus(s).status, 'available')
  for (const s of ['Pemenant', 'Permenat', 'Permenant']) assert.equal(normaliseStatus(s).status, 'permanent')
  for (const s of ['not working', 'Not working']) assert.equal(normaliseStatus(s).status, 'not_working')
})

test('status: permanent is NOT available — the old fallback would have offered the phone out', () => {
  const p = line({ status: 'Permenant', number: '19172093587', carrier: 'usmobile', holder: 'Altusky' })
  assert.equal(p.status, 'permanent')
  assert.equal(p.heldByNote, 'Altusky')
  // and it is not chased for a return date it was never going to have
  assert.ok(!p.reviewReasons.includes(REVIEW.DUE_DATE_MISSING))
})

test('status: an unrecognised word is flagged, never guessed', () => {
  const p = line({ status: '?', number: '1', carrier: 'usmobile' })
  assert.equal(p.status, 'unknown')
  assert.ok(p.reviewReasons.includes(REVIEW.STATUS_UNKNOWN))
})

test('holder: a question mark is doubt, and doubt is kept', () => {
  assert.deepEqual(parseHolder('?Erenfeld'), { name: 'Erenfeld', uncertain: true })
  assert.deepEqual(parseHolder('??Schwalbe??'), { name: 'Schwalbe', uncertain: true })
  assert.deepEqual(parseHolder('?'), { name: '', uncertain: true })
  assert.deepEqual(parseHolder('Leibl Rosenberg'), { name: 'Leibl Rosenberg', uncertain: false })
})

test('holder: an available line keeps its name as HISTORY, not as the current holder', () => {
  // 15 rows in the sheet look like this. Reading the name as current occupancy
  // would show 15 free phones as rented the day he migrates.
  const p = line({ status: 'available', holder: 'yosef blau', number: '19175885003', carrier: 'usmobile' })
  assert.equal(p.heldByNote, '')
  assert.equal(p.lastHeldByNote, 'yosef blau')
  assert.ok(!p.reviewReasons.includes(REVIEW.HOLDER_MISSING))
})

test('holder: a rented line with nobody named is flagged', () => {
  const p = line({ status: 'rented', number: '19175885003', carrier: 'usmobile', till: new Date('2026-08-12') })
  assert.ok(p.reviewReasons.includes(REVIEW.HOLDER_MISSING))
})

test('due date: missing, past and future are three different answers', () => {
  const base = { status: 'rented', number: '19175885003', carrier: 'usmobile', holder: 'Kornbluth' }
  const none = line(base)
  assert.ok(none.reviewReasons.includes(REVIEW.DUE_DATE_MISSING))

  const past = line({ ...base, till: new Date('2025-02-19') })
  assert.ok(past.reviewReasons.includes(REVIEW.DUE_DATE_PAST))
  assert.equal(past.dueDate, '2025-02-19')

  const future = line({ ...base, till: new Date('2026-08-12') })
  assert.equal(future.needsReview, false)
  assert.deepEqual(future.reviewReasons, [])
})

test('carrier: eight spellings of one carrier collapse, sub-brand survives', () => {
  for (const c of ['usmobile', 'Usmobile', 'Usmbile', 'usmonile', 'usmobile att']) {
    assert.equal(parseCarrier(c).carrier, 'US Mobile', c)
  }
  assert.equal(parseCarrier('Usmobile Verizion').subBrand, 'Verizon')
  assert.equal(parseCarrier('usmobile - tmobile').subBrand, 'T-Mobile')
  assert.equal(parseCarrier('usmobile att').subBrand, 'AT&T')
  assert.equal(parseCarrier('Usmonile wrap').wrap, true)
  assert.equal(parseCarrier('golan').region, 'Israel')
  assert.equal(parseCarrier('Fizz Canada').region, 'Canada')
  assert.equal(parseCarrier('LuckyMobile.ca').carrier, 'Lucky Mobile')
})

test('label column: four meanings in one cell come apart', () => {
  assert.equal(splitLabel('Rental 220').assetTag, 'Rental 220')
  assert.equal(splitLabel('rental 203').assetTag, 'Rental 203')
  assert.equal(splitLabel('Etolk').model, 'Etalk')
  assert.equal(splitLabel('Etalk').model, 'Etalk')
  assert.equal(splitLabel('SIM only').productType, 'SIM only')
  assert.equal(splitLabel('USA').region, 'USA')
  assert.equal(splitLabel('Canada').region, 'Canada')
  assert.equal(splitLabel('USA sim sold').region, 'USA')
  assert.equal(splitLabel('USA sim sold').productType, 'SIM sold')
})

test('label column: anything unclassified is kept verbatim, not dropped', () => {
  assert.equal(splitLabel('something odd').labelRest, 'something odd')
})

test('numbers: full international forms pass through; a missing country code is flagged not guessed', () => {
  assert.deepEqual(parseNumber('19175885003', 'USA'), { number: '19175885003', ambiguous: false })
  assert.deepEqual(parseNumber('972583287421', 'Israel'), { number: '972583287421', ambiguous: false })
  assert.deepEqual(parseNumber('447311492603', 'UK'), { number: '447311492603', ambiguous: false })
  // 9298844236 — a US number that lost its 1. We do NOT invent the prefix.
  const bare = parseNumber('9298844236', 'USA')
  assert.equal(bare.number, '9298844236')
  assert.equal(bare.ambiguous, true)
  // 7423423058 with a UK carrier is unambiguously the 07… domestic form.
  assert.deepEqual(parseNumber('7423423058', 'UK'), { number: '447423423058', ambiguous: false })
})

test('id fields: length decides, and prose is preserved instead of written into an ID', () => {
  assert.equal(parseIdField('89012803331726185413', { min: 18, max: 22 }).value, '89012803331726185413')
  const junk = parseIdField('sim?', { min: 14, max: 16 })
  assert.equal(junk.value, '')
  assert.equal(junk.leftover, 'sim?')
  assert.equal(junk.clear, false)
  // a 10-digit mobile number sitting in the IMEI column is not an IMEI
  assert.equal(parseIdField('9177673763', { min: 14, max: 16 }).clear, false)
  assert.equal(parseIdField('359370792455705', { min: 14, max: 16 }).value, '359370792455705')
})

test('account column: "Default" and bare numbers are not email addresses', () => {
  assert.equal(parseAccountEmail('elimel.echgrunnfeld@gmail.com').email, 'elimel.echgrunnfeld@gmail.com')
  assert.equal(parseAccountEmail('Default').clear, false)
  assert.equal(parseAccountEmail('7584399526').clear, false)
})

test('pool details: five kinds of thing, each filed or surfaced', () => {
  assert.equal(parsePoolDetails('AT&T').subBrand, 'AT&T')
  assert.equal(parsePoolDetails('Verizion').subBrand, 'Verizon')
  assert.equal(parsePoolDetails('Pool 3').pool, 'Pool 3')
  assert.equal(parsePoolDetails('Yearly 6 sep 25').renewalNote, 'Yearly 6 sep 25')
  assert.equal(parsePoolDetails('paid 150 rubinstein').paymentNote, 'paid 150 rubinstein')
  assert.equal(parsePoolDetails('356601718319432').imei, '356601718319432')
  assert.equal(parsePoolDetails('sim?').unparsed, 'sim?')
})

test('nothing is lost: the raw row travels with the line', () => {
  const p = line({ status: 'rented', number: '19175885003', carrier: 'Usmonile wrap', holder: '?Erenfeld', imei: 'sim?' })
  assert.equal(p.importSource.sheet, 'Rental')
  assert.equal(p.importSource.row, 2)
  assert.ok(p.importSource.raw.includes('sim?'), 'the unparseable cell survives verbatim')
  assert.match(p.notes, /IMEI column said: sim\?/)
})

test('an unknown carrier is flagged: it is how "deleted" and a new provider both look', () => {
  const p = line({ number: '19175885003', carrier: 'deleted', status: 'available' })
  assert.ok(p.reviewReasons.includes(REVIEW.CARRIER_UNKNOWN))
  assert.equal(p.company, 'deleted', 'the original word survives for the human to read')
})

test('a clean row raises nothing — the queue must not cry wolf', () => {
  const p = line({
    label: 'Rental 220', number: '19175885003', carrier: 'Usmobile ATT', status: 'rented',
    holder: 'Leibl Rosenberg', till: new Date('2026-08-12'),
    account: 'elimel.echgrunnfeld@gmail.com', iccid: '89012803331726185413', imei: '359370792455705',
  })
  assert.equal(p.needsReview, false)
  assert.deepEqual(p.reviewReasons, [])
  assert.equal(p.company, 'US Mobile')
  assert.equal(p.subBrand, 'AT&T')
  assert.equal(p.assetTag, 'Rental 220')
  assert.equal(p.country, 'USA')
})

test('ids are stable, so re-running the import updates rather than duplicates', () => {
  const a = line({ number: '19175885003', carrier: 'usmobile', status: 'available' })
  const b = line({ number: '19175885003', carrier: 'Usmobile', status: 'rented', holder: 'Zilber' })
  assert.equal(a.id, b.id)
  assert.equal(a.id, 'pool-19175885003')
})

test('buildPool summarises what the operator needs to decide', () => {
  const rows = [
    row({ number: '19175885003', carrier: 'usmobile', status: 'rented', holder: '?', till: new Date('2025-01-01') }),
    row({ number: '19175885004', carrier: 'usmobile', status: 'available', holder: 'Old Name' }),
    row({ number: '972583287421', carrier: 'golan', status: 'Pemenant', holder: 'Altusky' }),
  ]
  const { lines, summary } = buildPool(rows, { today: TODAY })
  assert.equal(lines.length, 3)
  assert.equal(summary.total, 3)
  assert.equal(summary.byStatus.rented, 1)
  assert.equal(summary.byStatus.available, 1)
  assert.equal(summary.byStatus.permanent, 1)
  assert.equal(summary.needsReview, 1)
  assert.equal(summary.reasons[REVIEW.DUE_DATE_PAST], 1)
  assert.equal(summary.reasons[REVIEW.HOLDER_UNCERTAIN], 1)
})

test('no row is ever rejected, however empty', () => {
  const { lines } = buildPool([[], row({}), row({ status: 'zzz' })], { today: TODAY })
  assert.equal(lines.length, 3)
  for (const l of lines) assert.ok(l.id, 'every row still produces an identifiable line')
})
