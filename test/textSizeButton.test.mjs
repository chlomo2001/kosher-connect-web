// The text-size button shows which of the three modes is set: an "Aa" that
// grows, and three pips filled to the level. The pip count is an off-by-one
// waiting to happen — 0 pips on Standard, or all three always on — so it is
// pinned here. Lifted from public/main.js the way the other browser-only bits
// are, with a tiny fake document so currentTextSize() can read a mode.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const SRC = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')
const grab = (re, what) => { const m = SRC.match(re); assert.ok(m, `${what} not found`); return m[0] }

// Build a runnable copy: the size table, currentTextSize(), textSizeBtnInner().
function makeFace() {
  const table = grab(/const TEXT_SIZES = \[[\s\S]*?\];/, 'TEXT_SIZES')
  const cur = grab(/function currentTextSize\(\) \{[\s\S]*?\n\}/, 'currentTextSize')
  const inner = grab(/function textSizeBtnInner\(\) \{[\s\S]*?\n\}/, 'textSizeBtnInner')
  const fn = new Function('mark',
    `const document = { documentElement: { getAttribute: () => mark } };
     ${table}\n${cur}\n${inner}\n return textSizeBtnInner();`)
  return (mark) => fn(mark)
}

const pips = (html) => (html.match(/<i class="on">/g) || []).length
const total = (html) => (html.match(/<i(?: class="on")?><\/i>/g) || []).length

test('each mode fills the right number of pips', () => {
  const face = makeFace()
  assert.equal(pips(face('')), 1, 'Standard should show one filled pip')
  assert.equal(pips(face('large')), 2, 'Large should show two')
  assert.equal(pips(face('largest')), 3, 'Largest should show all three')
})

test('there are always exactly three pips', () => {
  const face = makeFace()
  for (const mark of ['', 'large', 'largest']) {
    assert.equal(total(face(mark)), 3, `${mark || 'standard'} should render three pips in total`)
  }
})

test('an unknown mode falls back to Standard, not to zero pips', () => {
  assert.equal(pips(makeFace()('nonsense')), 1)
})

test('the face carries the growing Aa', () => {
  assert.match(makeFace()(''), /class="kc-fs-aa">Aa</)
})

test('the topbar and till both use the shared builder, not a bare "Aa"', () => {
  // Two call sites drift into two faces otherwise.
  assert.match(SRC, /b\.innerHTML = textSizeBtnInner\(\)/, 'updateTextSizeBtns must paint the face')
  assert.match(SRC, /Press to change\.">\$\{textSizeBtnInner\(\)\}<\/button>/, 'the till button must use the shared builder')
})
