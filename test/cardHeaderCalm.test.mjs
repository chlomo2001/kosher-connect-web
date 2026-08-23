// Why the customer card was uncomfortable to look at, pinned so it stays fixed.
//
// Owner, 23 Aug, with the header circled in red: "why am i still so
// uncomfortable with this UI? the side bar UI also needs some redoing in term
// of eye comfort."
//
// Three separate causes, all measurable:
//
//   1. The meta line was ONE inline sentence with " · " typed between the
//      facts. The card is never wide enough to hold them on one line, so the
//      separators were stranded at line ends — "unconfirmed — confirm? ·",
//      "+44 7703 572 578 ·". Punctuation pointing at nothing is litter, and
//      the eye returns to it every pass.
//   2. The three tool menus took their natural ~350px FIRST, leaving the
//      person's own details ~184px on a 660px card — so every fact dropped
//      onto a line of its own beside a half-empty button row.
//   3. The avatar was centred against however many facts happened to exist,
//      so it floated beside the middle of the block instead of labelling the
//      name it belongs to.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const MAIN = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')
const CSS = readFileSync(new URL('../styles/app.css', import.meta.url), 'utf8')
const TOKENS = readFileSync(new URL('../styles/globals.css', import.meta.url), 'utf8')

test('the facts are separated by GAP, never by typed punctuation', () => {
  const meta = MAIN.split('\n').find((l) => l.includes('class="detail-meta"'))
  assert.ok(meta, 'the detail-meta line is gone')
  assert.ok(!meta.includes(' · '),
    'a typed separator is back — it will strand at a line end the moment the card wraps')
  assert.match(CSS, /\.detail-meta \{[^}]*display: flex; flex-wrap: wrap/s)
  assert.match(CSS, /\.detail-meta \{[^}]*column-gap: \d+px; row-gap: \d+px/s)
})

test('the person outranks the menus for width, and the avatar labels the name', () => {
  assert.match(CSS, /\.detail-headline \{ flex: 1 1 min\(\d+px, \d+%\); min-width: 0; \}/,
    'a flat pixel floor orphans the avatar on a phone; a bare flex:1 lets the menus win on a desktop')
  assert.match(CSS, /\.detail-header \{ display: flex; flex-wrap: wrap; align-items: flex-start/)
})

test('the carrier login is told apart by shape, not by shouting', () => {
  assert.match(CSS, /\.kc-acct \{ color: var\(--gold\); font-size: var\(--fs-small\); \}/)
  const acct = MAIN.split('\n').find((l) => l.includes('c.accountEmail ?'))
  assert.ok(acct && acct.includes('class="kc-acct"'), 'the account email lost its class')
  assert.ok(!acct.includes('style="color:var(--gold);"'),
    'the inline gold is back — the class owns the look, so the two cannot disagree')
})

// ── the rail ───────────────────────────────────────────────────────────────

test('the rail never paints pure white on its own navy', () => {
  assert.match(TOKENS, /--sb-ink: #eef1f5;/)
  for (const rule of ['.nav-item:hover, .nav-link:hover', '.nav-item.active']) {
    const line = CSS.split('\n').find((l) => l.startsWith(rule))
    assert.ok(line && line.includes('var(--sb-ink)'),
      `${rule} still paints #ffffff — white on a dark saturated field haloes`)
  }
})

test('the rail is desaturated at the SAME lightness, so no contrast moved', () => {
  const m = TOKENS.match(/--brand-dark: (#[0-9a-f]{6});/)
  assert.ok(m)
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const L = (max + min) / 2
  const S = max === min ? 0 : (max - min) / (1 - Math.abs(2 * L - 1))
  assert.ok(S < 0.58, `the track is still ${(S * 100).toFixed(0)}% saturated — blue that strong shimmers under white text`)
  assert.ok(L > 0.19 && L < 0.26, `lightness ${(L * 100).toFixed(0)}% moved — every measured contrast on the rail depends on it`)
})
