// Pointing at a row must not repaint the answer.
//
// globals.css carries `tbody tr:hover td { background: var(--bg) }` for every
// data table in the app. Its specificity is (0,1,3); a plain `.cal-active` is
// (0,1,0). So the generic row hover BEAT the availability colours: point at a
// phone's number and its whole row went pale — a fortnight of hires and an
// overdue handset washed to the same nothing, on the one screen whose entire
// job is that colour.
//
// The 27 Aug fix only ever cured the cell under the pointer, because
// `td.cal-active:hover` is (0,2,1) and squeaks past. The other thirty cells in
// the row were never covered. Owner, 30 Aug: "you corrected the calender
// coloring only for when hovering over 1 date, but not for when hovering over
// phone, which then the whole row still gets lighter."
//
// This file checks the arithmetic, not the wording — a rule that looks right
// and loses the cascade is exactly the bug that got here twice.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const APP = readFileSync(new URL('../styles/app.css', import.meta.url), 'utf8')
const GLOBALS = readFileSync(new URL('../styles/globals.css', import.meta.url), 'utf8')

/** (ids, classes+attrs+pseudo-classes, elements+pseudo-elements). */
function specificity(sel) {
  const s = sel.trim()
  const ids = (s.match(/#[\w-]+/g) || []).length
  const cls = (s.match(/\.[\w-]+/g) || []).length
    + (s.match(/\[[^\]]+\]/g) || []).length
    + (s.match(/:(?!:)(?!where\b)[\w-]+/g) || []).length
  const els = (s.replace(/[.#][\w-]+/g, '').match(/(^|[\s>+~])[a-z][\w-]*/gi) || []).length
  return [ids, cls, els]
}
const beats = (a, b) => {
  const x = specificity(a), y = specificity(b)
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]
  return false   // a tie is decided by order, which is not what this asks
}

const GENERIC_ROW_HOVER = 'tbody tr:hover td'
const PAINTER = '.cal-table tbody tr td.cal-cell'

test('the generic row hover is still there — this is not a fix by deletion', () => {
  // Every other table in the app wants it. The calendar's answer must be to
  // outrank it, not to remove it from underneath thirty other screens.
  assert.match(GLOBALS, /tbody tr:hover td \{ background: var\(--bg\); \}/)
})

test('the one painter outranks the generic row hover', () => {
  assert.ok(APP.includes(`${PAINTER} { background: var(--cal-bg); }`),
    'the single painting rule is gone')
  assert.ok(beats(PAINTER, GENERIC_ROW_HOVER),
    `${PAINTER} ${JSON.stringify(specificity(PAINTER))} does not beat ` +
    `${GENERIC_ROW_HOVER} ${JSON.stringify(specificity(GENERIC_ROW_HOVER))}`)
})

test('every state declares a colour, not a background', () => {
  // A state that sets `background:` directly is a state the row hover can
  // overwrite again — which is precisely how this came back the first time.
  for (const state of ['cal-free', 'cal-active', 'cal-booked', 'cal-overdue']) {
    const re = new RegExp(String.raw`^\.${state}\s*\{([^}]*)\}`, 'm')
    const m = APP.match(re)
    assert.ok(m, `.${state} has no rule of its own`)
    assert.match(m[1], /--cal-bg:/, `.${state} does not declare --cal-bg`)
    assert.doesNotMatch(m[1], /(^|;)\s*background:/, `.${state} sets background directly and can be overwritten`)
  }
  assert.match(APP, /td\.cal-shabbat \{ --cal-bg:/)
  assert.match(APP, /td\.cal-yomtov \{ --cal-bg:/)
  assert.match(APP, /td\.cal-active\.cal-shabbat \{ --cal-bg:/)
})

test('the hover treatments outrank the painter, or nothing would react', () => {
  const hover = `${PAINTER}:hover`
  assert.ok(APP.includes(`${hover} { background: color-mix(in srgb, var(--cal-bg) 78%, var(--kc-navy)); }`))
  assert.ok(beats(hover, PAINTER), 'the darkening hover cannot beat the painter')
  assert.ok(beats(hover, GENERIC_ROW_HOVER), 'the darkening hover cannot beat the row hover')
})

test('a filled cell darkens and a free one lightens, and both still hold', () => {
  // Owner, 27 Aug: "when hovering in dates availability on a blue box, it
  // becomes light. shouldnt it instead become darker?" Written against
  // --cal-bg, the darkening now covers every state including any added later,
  // rather than the three that were once listed out by hand.
  assert.match(APP, /var\(--cal-bg\) 78%, var\(--kc-navy\)/)
  const free = '.cal-table tbody tr td.cal-free:hover'
  assert.ok(APP.includes(`${free} { background: color-mix(in srgb, var(--kc-blue) 12%, var(--surface)); }`))
  // Free comes AFTER the general darkening: they tie on specificity, so the
  // order in the file is what decides it.
  assert.ok(APP.indexOf(free) > APP.indexOf(`${PAINTER}:hover`),
    'the free-cell tint is written before the darkening rule and loses the tie')
})

test('the row still answers to the pointer, in the cell that carries no answer', () => {
  // Tracking one phone across thirty columns is a real need. Repainting the
  // availability to do it is not the way, so the row header takes the highlight.
  assert.match(APP, /\.cal-table tbody tr:hover th\.cal-phone \{ background: var\(--bg\); \}/)
})

test('the three listed-by-hand hover rules are gone', () => {
  // They were the half-fix. Leaving them would mean two places to change a
  // colour and one of them silently wrong.
  for (const dead of ['td.cal-active:hover', 'td.cal-booked:hover', 'td.cal-overdue:hover']) {
    assert.ok(!APP.includes(`${dead}  {`) && !APP.includes(`${dead} {`),
      `${dead} is still declared separately`)
  }
})
