// The stamp that lets a PRINTOUT say how old it is.
//
// From the Virtual Mail navigation map: every page carries a version and a
// date, so paper can be checked against the live system at a glance. KC's
// manual is built to be printed and handed to somebody starting on Sunday —
// and the printout had no way to say when its words were last true.
//
// The stamp is hand-written and test-held, the same bargain as the manual
// itself: change a screen's prose and this test fails until the stamp's date
// moves forward in the same commit. So the date always means "when the words
// last changed" — the only date a reader of paper actually wants.
import test from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { SCREENS, MANUAL_STAMP, manualFingerprint, manualStampLine } from '../lib/manual.mjs'

const ROOT = path.join(import.meta.dirname, '..')

test('the stamp matches the manual as it stands', () => {
  assert.equal(MANUAL_STAMP.fingerprint, manualFingerprint(SCREENS),
    `the manual's words changed but the stamp did not — set MANUAL_STAMP to ` +
    `{ date: '<today>', fingerprint: '${manualFingerprint(SCREENS)}' } in lib/manual.mjs`)
})

test('the date is a real date, and not from the future', () => {
  assert.match(MANUAL_STAMP.date, /^\d{4}-\d{2}-\d{2}$/)
  assert.ok(MANUAL_STAMP.date >= '2026-08-21', 'before the stamp existed')
  assert.ok(MANUAL_STAMP.date <= new Date().toISOString().slice(0, 10),
    'a manual cannot be newer than today')
})

test('the fingerprint is stable and content-driven', () => {
  assert.equal(manualFingerprint(SCREENS), manualFingerprint(SCREENS), 'not deterministic')
  const altered = JSON.parse(JSON.stringify(SCREENS))
  altered[0].what += ' '
  assert.notEqual(manualFingerprint(altered), manualFingerprint(SCREENS),
    'a one-character prose change must change the fingerprint')
})

test('the page and the markdown both carry the line', () => {
  const page = readFileSync(path.join(ROOT, 'pages/manual.js'), 'utf8')
  assert.ok(page.includes('manualStampLine'), '/manual does not print the stamp')
  assert.ok(page.includes('kc-man-stampfoot'),
    'the print footer is missing — a fixed element repeats on every printed sheet, which is the point')
  const md = readFileSync(path.join(ROOT, 'docs/MANUAL.md'), 'utf8')
  assert.ok(md.includes(manualStampLine()), 'docs/MANUAL.md does not carry the current stamp')
})
