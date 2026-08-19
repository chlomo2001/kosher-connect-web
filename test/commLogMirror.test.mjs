// The browser copy of the correction logic, held to lib/commLog.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { correctEntry, currentText, entryView, isCorrected } from '../lib/commLog.mjs'

const SRC = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')

function liftMirror() {
  const m = SRC.match(/\/\/ ── KC_COMMLOG mirror start ──\n([\s\S]*?)\n\/\/ ── KC_COMMLOG mirror end ──/)
  assert.ok(m, 'KC_COMMLOG mirror region not found in public/main.js')
  return new Function(`${m[1]}; return KC_COMMLOG;`)()
}

const AT = '2026-08-12T09:00:00Z'
const CASES = [
  { at: '2026-08-10T14:00:00Z', type: 'call_in', text: 'Rang about the Israel SIM', by: 'Shloime' },
  { at: '2025-01-01T00:00:00Z', text: 'Old note' },                       // legacy shape
  { at: '2026-01-01T00:00:00Z', text: 'a', corrections: 'nonsense' },     // wrong type
  { at: '2026-01-01T00:00:00Z', text: '' },
  {},
]

test('the browser mirror corrects exactly the way the lib does', () => {
  const B = liftMirror()
  for (const entry of CASES) {
    assert.equal(B.currentText(entry), currentText(entry))
    assert.equal(B.isCorrected(entry), isCorrected(entry))
    assert.deepEqual(B.entryView(entry), entryView(entry))
  }
  const base = CASES[0]
  const a = correctEntry(base, { text: 'Rang about the USA SIM', by: 'Eliezer', at: AT })
  const b = B.correctEntry(base, { text: 'Rang about the USA SIM', by: 'Eliezer', at: AT })
  assert.deepEqual(b, a)
  assert.deepEqual(B.entryView(b), entryView(a))
  // …and correcting a correction stays in step.
  const a2 = correctEntry(a, { text: 'Rang twice', by: 'Shloime', at: AT })
  const b2 = B.correctEntry(b, { text: 'Rang twice', by: 'Shloime', at: AT })
  assert.deepEqual(b2, a2)
})

test('the mirror refuses the same corrections the lib refuses', () => {
  const B = liftMirror()
  const base = CASES[0]
  for (const bad of ['', '   ', null, undefined, 'Rang about the Israel SIM']) {
    assert.throws(() => B.correctEntry(base, { text: bad }))
    assert.throws(() => correctEntry(base, { text: bad }))
  }
  assert.throws(() => B.correctEntry(null, { text: 'x' }))
})

test('the screen shows the original rather than replacing it', () => {
  // A renderer that dropped `wasText` would erase in the only place that
  // matters — on the screen somebody actually reads.
  assert.match(SRC, /e\.wasText \? `<div class="tl-was">was: <s>\$\{escHtml\(e\.wasText\)\}<\/s>/,
    'a corrected entry must still show what it used to say')
  assert.match(SRC, /corrected by \$\{escHtml\(e\.correctedBy/, 'and who changed it')
  // The save path must put the entry back if the write fails, or the screen
  // would show a correction that was never recorded.
  const fn = SRC.match(/async function correctCommEntry\([\s\S]*?\n\}/)
  assert.ok(fn, 'correctCommEntry not found')
  assert.match(fn[0], /c\.commLog\[index\] = entry;/, 'a failed save must be rolled back on screen')
})
