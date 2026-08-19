// Correcting a timeline entry without erasing it (owner item 1, 19 Aug 2026).
//
// The owner chose "correct it, never erase it" over both alternatives: an
// append-only log where a mistake stays wrong for ever, and a freely editable
// one that stops being evidence of anything. These hold the property that makes
// the middle option worth having — the original survives every correction.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { correctEntry, currentText, entryView, isCorrected, MAX_CORRECTION } from '../lib/commLog.mjs'

const ENTRY = { at: '2026-08-10T14:00:00Z', type: 'call_in', text: 'Rang about the Israel SIM', by: 'Shloime' }

test('a correction changes what it SAYS and never what it said', () => {
  const c = correctEntry(ENTRY, { text: 'Rang about the USA SIM, not Israel', by: 'Eliezer' })
  assert.equal(currentText(c), 'Rang about the USA SIM, not Israel')
  // The original is untouched — this is the whole point of the shape.
  assert.equal(c.text, 'Rang about the Israel SIM')
  assert.equal(c.corrections.length, 1)
  assert.equal(c.corrections[0].by, 'Eliezer')
  // …and the entry handed in is not mutated, so a failed save cannot leave a
  // half-corrected record sitting in memory.
  assert.equal(ENTRY.corrections, undefined)
  assert.equal(ENTRY.text, 'Rang about the Israel SIM')
})

test('correcting a correction keeps every version, oldest first', () => {
  const once = correctEntry(ENTRY, { text: 'Rang about the USA SIM', by: 'Eliezer', at: '2026-08-11T09:00:00Z' })
  const twice = correctEntry(once, { text: 'Rang about the USA SIM — wanted the £15 plan', by: 'Shloime', at: '2026-08-12T09:00:00Z' })
  assert.equal(currentText(twice), 'Rang about the USA SIM — wanted the £15 plan')
  assert.equal(twice.text, 'Rang about the Israel SIM')
  const v = entryView(twice)
  assert.equal(v.history.length, 3)
  assert.deepEqual(v.history.map(h => h.by), ['Shloime', 'Eliezer', 'Shloime'])
  assert.equal(v.history[0].text, 'Rang about the Israel SIM')
  assert.equal(v.correctedBy, 'Shloime')
  assert.equal(v.correctedAt, '2026-08-12T09:00:00Z')
})

test('an uncorrected entry does not render its own text twice', () => {
  const v = entryView(ENTRY)
  assert.equal(v.current, 'Rang about the Israel SIM')
  assert.equal(v.original, null, 'the original is only shown when it differs')
  assert.equal(v.corrected, false)
  assert.deepEqual(v.history, [])
  assert.equal(isCorrected(ENTRY), false)
})

test('a correction that would record nothing throws rather than pretending', () => {
  // Quietly returning the original would leave the person who typed it
  // believing it landed, which is the worse failure of the two.
  assert.throws(() => correctEntry(ENTRY, { text: '' }), /must say something/)
  assert.throws(() => correctEntry(ENTRY, { text: '   ' }), /must say something/)
  assert.throws(() => correctEntry(ENTRY, { text: null }), /must say something/)
  assert.throws(() => correctEntry(ENTRY, { text: 'Rang about the Israel SIM' }), /already says/)
  assert.throws(() => correctEntry(null, { text: 'x' }), /no entry/)
  assert.throws(() => correctEntry('not an entry', { text: 'x' }), /no entry/)
})

test('a correction is trimmed and capped, and still counts as a change', () => {
  const c = correctEntry(ENTRY, { text: '  Rang twice  ' })
  assert.equal(currentText(c), 'Rang twice')
  const long = correctEntry(ENTRY, { text: 'x'.repeat(MAX_CORRECTION + 50) })
  assert.equal(currentText(long).length, MAX_CORRECTION)
  // Whoever corrected it is always recorded, even when nobody was named.
  assert.equal(c.corrections[0].by, 'staff')
  assert.ok(c.corrections[0].at, 'a correction is always stamped')
})

test('a legacy entry with no corrections field behaves like an uncorrected one', () => {
  // Every entry written before today is this shape, and there are years of them.
  const old = { at: '2025-01-01T00:00:00Z', text: 'Old note' }
  assert.equal(currentText(old), 'Old note')
  assert.equal(isCorrected(old), false)
  const c = correctEntry(old, { text: 'Old note, corrected', by: 'Eliezer' })
  assert.equal(c.corrections.length, 1)
  assert.equal(c.text, 'Old note')
  // A corrections field of the wrong type is treated as absent rather than
  // crashing a whole customer card.
  assert.equal(currentText({ text: 'a', corrections: 'nonsense' }), 'a')
  assert.equal(isCorrected({ text: 'a', corrections: {} }), false)
})

test('an empty entry is survivable — a blank timeline row is not a crash', () => {
  assert.equal(currentText({}), '')
  assert.equal(currentText(null), '')
  assert.equal(entryView({}).current, '')
  assert.equal(entryView({}).corrected, false)
})
