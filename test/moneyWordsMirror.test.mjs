// The browser copy of the compact money vocabulary, held to lib/moneyWords.mjs.
//
// Port item C1b. The reason this mirror exists is the reason the module does:
// before it, five screens each wrote their own short form of one fact and the
// app said "owes", "owed", "owing" and "£45.00 owed" depending where you looked.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { moneyState, moneyLabel, moneySayShort, gbp, MONEY_STATES } from '../lib/moneyWords.mjs'

const SRC = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')
function liftMirror() {
  const m = SRC.match(/\/\/ ── KC_MONEY mirror start ──\n([\s\S]*?)\n\/\/ ── KC_MONEY mirror end ──/)
  assert.ok(m, 'KC_MONEY mirror region not found in public/main.js')
  return new Function(`${m[1]}; return KC_MONEY;`)()
}

const CASES = [
  { balance: -45 }, { balance: -45, oldestDebtDays: 40 }, { balance: -0.004 },
  { balance: 0 }, { balance: 20 }, { balance: 1234.5 }, { balance: -1234567.89 },
  { balance: -45, reliable: false }, { balance: NaN }, { refundDue: 12, balance: 0 },
  {}, { balance: undefined },
]

test('the browser mirror states and labels exactly what the lib does', () => {
  const B = liftMirror()
  for (const ctx of CASES) {
    assert.equal(B.moneyState(ctx), moneyState(ctx), `state differs for ${JSON.stringify(ctx)}`)
    assert.deepEqual(B.moneySayShort(ctx), moneySayShort(ctx), `label differs for ${JSON.stringify(ctx)}`)
  }
  for (const state of [...MONEY_STATES, 'nonsense']) {
    assert.equal(B.moneyLabel(state, { balance: -45, refundDue: 45 }),
      moneyLabel(state, { balance: -45, refundDue: 45 }), `label differs for state ${state}`)
  }
  for (const n of [0, -45, 20, 1234.5, 1234567.891, 'nonsense']) {
    assert.equal(B.gbp(n), gbp(n), `gbp differs for ${n}`)
  }
})

test('the sign convention survived the copy', () => {
  // Reversed in the mirror only, a customer who owes £45 is told they are £45
  // in credit on five screens while the tests on the lib stay green.
  const B = liftMirror()
  assert.equal(B.moneySayShort({ balance: -45 }).text, 'owes £45.00')
  assert.equal(B.moneySayShort({ balance: 45 }).text, '£45.00 in credit')
})

test('no screen writes its own short form any more', () => {
  // The four spellings this replaced. Any of them reappearing in a template
  // means a screen has gone back to inventing its own words.
  //
  // Scoped to the CUSTOMER-balance spellings on purpose. The Goods-in header
  // says "£X owed" about money the SHOP owes a SUPPLIER — the opposite
  // direction, a different relationship, and legitimately its own words. A
  // broader pattern flagged it, and a test that flags correct code is a test
  // people learn to weaken.
  const banned = [
    /'owing'/,                       // the ELID accounts cell
    /'owed £'/,                      // the statement total
    /`owes \$\{fmtGbp/,              // the customer card label
    /fmtGbp\(bal\) \+ ' in credit'/,  // the wallet header
  ]
  for (const re of banned) {
    assert.doesNotMatch(SRC, re, `a screen is writing its own money wording again: ${re}`)
  }
  // …and the vocabulary is actually reached from the screens.
  assert.ok((SRC.match(/KC_MONEY\.(moneySayShort|moneyLabel)\(/g) || []).length >= 5,
    'fewer than five screens are using the shared vocabulary')
})
