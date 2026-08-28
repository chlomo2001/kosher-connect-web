// Which way the money went, and the browser copy of it.
//
// The row already carried a direction mark and it was wrong. Three renderers
// painted `amount >= 0 ? 'dot-green' : 'dot-blue'`, reading direction off the
// SIGN — and counted against Kc-Live on 28 Aug the sign does not mean that:
//
//   refund          14 rows, ALL POSITIVE   a credit onto their balance
//   refund_payout    3 rows, ALL NEGATIVE   cash actually handed back
//
// So two rows a person reads as "refund" were painted opposite colours, and the
// one that IS money leaving the shop got the same blue as an ordinary charge.
// This file pins direction to the type, with the sign as a tiebreak only where
// the type genuinely goes both ways.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ledgerDirection, directionOf, DIRECTIONS } from '../lib/ledgerDirection.mjs'

const SRC = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')
const lift = () => {
  const m = SRC.match(/\/\/ ── KC_LEDGERDIR mirror start ──\n([\s\S]*?)\n\/\/ ── KC_LEDGERDIR mirror end ──/)
  assert.ok(m, 'KC_LEDGERDIR mirror region not found in public/main.js')
  return new Function(`${m[1]}; return KC_LEDGERDIR;`)()
}

// Every entry_type in Kc-Live on 28 Aug, with the sign each actually carries
// and how many rows there are. If a type ever appears with the other sign this
// table is where it gets argued about.
const PRODUCTION = [
  ['booking', -1, 383, 'charge'],
  ['payment', +1, 254, 'in'],
  ['manual_adjustment', -1, 51, 'adjust'],
  ['manual_adjustment', +1, 15, 'adjust'],
  ['rental', -1, 25, 'charge'],
  ['online_service', -1, 17, 'charge'],
  ['refund', +1, 14, 'adjust'],
  ['phone_sale', -1, 13, 'charge'],
  ['rental_adjustment', +1, 5, 'adjust'],
  ['rental_adjustment', -1, 2, 'adjust'],
  ['rental_void', +1, 5, 'adjust'],
  ['stock_sale', -1, 4, 'charge'],
  ['refund_payout', -1, 3, 'out'],
  ['top_up', +1, 1, 'in'],
  ['sim_charge', -1, 1, 'charge'],
  ['sim_service', -1, 1, 'charge'],
]

test('every entry_type in production is read the way a person would read it', () => {
  for (const [type, sign, n, want] of PRODUCTION) {
    assert.equal(ledgerDirection({ type, amount: sign * 12.5 }), want,
      `${type} (${n} rows, ${sign > 0 ? 'positive' : 'negative'})`)
  }
})

test('the browser mirror reads exactly what the lib reads', () => {
  const B = lift()
  const cases = [
    ...PRODUCTION.map(([type, sign]) => ({ type, amount: sign * 12.5 })),
    { type: 'rental_loss', amount: -40 }, { type: 'virtual_number', amount: -10 },
    { type: 'extra_charge', amount: -5 }, { type: 'repair', amount: -25 },
    { type: 'something_new', amount: 10 }, { type: 'something_new', amount: -10 },
    { type: '', amount: 0 }, { type: null, amount: null }, {}, null, undefined,
  ]
  for (const e of cases) {
    assert.equal(B.ledgerDirection(e), ledgerDirection(e), JSON.stringify(e))
    assert.deepEqual(B.directionOf(e), directionOf(e), JSON.stringify(e))
  }
  assert.deepEqual(B.DIRECTIONS, DIRECTIONS)
})

// The bug the badge exists to fix, stated as a test so it cannot come back.
test('both kinds of refund stop being opposites', () => {
  const credited = { type: 'refund', amount: +20 }        // was painted GREEN
  const paidOut = { type: 'refund_payout', amount: -20 }  // was painted BLUE
  // They are still different — one is cash leaving, one is not — but neither is
  // now read as "money in", which is what the old green said about the first.
  assert.equal(ledgerDirection(credited), 'adjust')
  assert.equal(ledgerDirection(paidOut), 'out')
  assert.notEqual(ledgerDirection(credited), 'in')
})

test('money leaving the shop is the only thing called out', () => {
  // 'out' must stay rare and mean one thing. A charge is not money out — the
  // customer owing £383 of flights is not the till being emptied.
  const outs = PRODUCTION.filter(([type, sign]) => ledgerDirection({ type, amount: sign }) === 'out')
  assert.deepEqual(outs.map((o) => o[0]), ['refund_payout'])
})

test('an unknown type falls back to the sign, which is what the app did before', () => {
  // No worse off than today, and never blank.
  assert.equal(ledgerDirection({ type: 'not_a_type', amount: 10 }), 'in')
  assert.equal(ledgerDirection({ type: 'not_a_type', amount: -10 }), 'charge')
  assert.equal(ledgerDirection({ type: 'not_a_type', amount: 0 }), 'in')
})

test('nothing at all still draws something', () => {
  for (const e of [null, undefined, {}, { type: '' }]) {
    const d = directionOf(e)
    assert.ok(d.key && d.glyph && d.label, JSON.stringify(e))
  }
})

test('colour is never the only thing saying which way it went', () => {
  // WCAG 1.4.1. Each direction carries a distinct glyph and a distinct spoken
  // name as well as a hue, so it survives colour-blindness, a mono printout and
  // a screen reader.
  const glyphs = Object.values(DIRECTIONS).map((d) => d.glyph)
  const labels = Object.values(DIRECTIONS).map((d) => d.label)
  assert.equal(new Set(glyphs).size, glyphs.length, 'two directions share a glyph')
  assert.equal(new Set(labels).size, labels.length, 'two directions share a name')
  for (const d of Object.values(DIRECTIONS)) assert.ok(d.glyph.trim() && d.label.trim())
})

test('the type word is kept beside the badge, not replaced by it', () => {
  // The half of the AHT item that would have lost information. "Rental adj.",
  // "Loss", "Void credit" and "Refund paid out" are four things one shape
  // cannot tell apart.
  assert.match(SRC, /LEDGER_TYPE_LABELS\[e\.type\]/,
    'a ledger row no longer prints the type in words')
  // The interpolation, not the bare name — `function ledgerDirDot(e)` is the
  // definition and counting it made this read four.
  assert.equal((SRC.match(/\$\{ledgerDirDot\(e\)\}/g) || []).length, 3,
    'the three ledger row renderers should all draw the badge')
  assert.doesNotMatch(SRC, /history-dot \$\{e\.amount >= 0/,
    'a renderer is still reading direction off the sign')
})
