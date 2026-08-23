// The manual's filter box (owner, 23 Aug: "why is the manual still so
// unineractive?"). Type a word, only the screens that mention it stay, and
// printing prints what is showing — so one filtered screen can be printed
// for the till. The law of the page applies to its own search: the filter
// reads the SAME entry objects the page renders, no second index.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SCREENS } from '../lib/manual.mjs'

const PAGE = readFileSync(new URL('../pages/manual.js', import.meta.url), 'utf8')

test('the filter exists, filters at the source lists, and can be cleared', () => {
  assert.match(PAGE, /className="kc-man-filter"/)
  assert.match(PAGE, /const keep = \(list\) => \(hits \? list\.filter\(\(s\) => hits\.has\(s\.id\)\) : list\)/)
  assert.match(PAGE, /Show everything/)
})

test('it searches everything an entry says, not just its name', () => {
  const m = PAGE.match(/function screenText\(s\) \{[\s\S]*?\n\}/)
  assert.ok(m, 'screenText is missing')
  for (const field of ['s.what', 's.parts', 's.dialogs', 's.rules', 's.wrong', 's.example']) {
    assert.ok(m[0].includes(field), `${field} is not searched — a match a reader can see would not be found`)
  }
})

test('the behaviour on the real entries: a rare word finds its screen only', () => {
  const screenText = (s) => [
    s.name, s.path, s.what,
    ...s.parts.flatMap((p) => p),
    ...s.dialogs.flatMap((d) => d),
    ...s.rules,
    ...s.wrong.flatMap((w) => w),
    ...(s.example ? [s.example.title, ...s.example.steps] : []),
  ].join(' ').toLowerCase()
  const hits = (q) => SCREENS.filter((s) => q.toLowerCase().split(/\s+/).filter(Boolean)
    .every((w) => screenText(s).includes(w)))
  // Empty query keeps the whole manual.
  assert.equal(hits('').length, SCREENS.length)
  // A word from the manual's own entry finds it.
  assert.ok(hits('Show everything').some((s) => s.id === 'manual'))
  // Nonsense matches nothing rather than everything.
  assert.equal(hits('qqqzzzxxx').length, 0)
})

test('the manual describes its own filter, and print hides the box', () => {
  const manualEntry = SCREENS.find((s) => s.id === 'manual')
  assert.ok(manualEntry.parts.some(([label]) => label === 'Find in the manual'),
    'a new control on the screen updates its manual entry in the same commit')
  const css = readFileSync(new URL('../styles/app.css', import.meta.url), 'utf8')
  assert.match(css, /\.kc-man-filter \{ display: none; \}/)
})

test('a picture opens full size in a lightbox, and Escape closes it', () => {
  // Owner, 23 Aug: zoom was the "first" pick of the next interactivity round.
  assert.match(PAGE, /className="kc-man-zoom"/)
  assert.match(PAGE, /onZoom && onZoom\(\{ src: screenShot/)
  assert.match(PAGE, /e\.key === 'Escape'\) setZoom\(null\)/)
  const css = readFileSync(new URL('../styles/app.css', import.meta.url), 'utf8')
  assert.match(css, /\.kc-man-zoom \{\s*\n\s*position: fixed; inset: 0;/)
})
