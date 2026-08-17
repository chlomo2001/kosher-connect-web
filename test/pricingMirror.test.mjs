// The rental pricing maths exists twice ON PURPOSE — and the two copies have
// to stay the same maths.
//
// lib/rentalMath.mjs is the canonical, unit-tested statement of the formulas
// (see test/rentalMath.test.mjs). public/main.js keeps its own thin copies
// (priceFromDays, ticketFeeFor, ddMonthlyAmount, poolScore) because that file
// is a classic script served from /public and cannot import anything — the
// staff app needs a price the moment the dates are picked, not after a round
// trip. Deleting either copy breaks something real, so neither is "the
// duplicate": this test is the thing that stops them drifting apart, the same
// arrangement nameCase.test.mjs has with capName and flags.test.mjs has with
// WHATSAPP_ENABLED.
//
// It does not compare source text (identical text can still be two rules a
// year apart) — it lifts each browser function out of main.js, runs it, and
// holds it to lib/rentalMath's answers.
//
// The browser copies round2() to the penny exactly like the canon (the gap
// where they returned raw floats — 16.049999999999997 for 3 days at £5.35 —
// was closed on the owner's decision, 9 Aug 2026), so every comparison here
// is PLAIN EQUALITY. If one of these fails, someone edited one copy of the
// maths without the other: fix the drift, do not loosen the assertion.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { round2, priceFromPeriods, ticketFeeFor, ddSurcharge, poolScore } from '../lib/rentalMath.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = readFileSync(path.join(ROOT, 'public/main.js'), 'utf8')

// The client's own rounding helper, lifted so the money functions below run
// against the client's rounding, not the lib's.
const CLIENT_ROUND2 = (SRC.match(/function round2\s*\([^)]*\)\s*\{[\s\S]*?\n\}/) || [])[0]
assert.ok(CLIENT_ROUND2, 'public/main.js must define its round2 mirror')

// Lift one top-level `function name(...) { … }` out of the classic script.
// Same technique (and the same justification) as nameCase.test.mjs: the
// functions are pure, and the source they come from is in this repo.
function lift(name, prelude = '') {
  const m = SRC.match(new RegExp(`function ${name}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n\\}`))
  assert.ok(m, `public/main.js must still define ${name}`)
  // eslint-disable-next-line no-new-func
  return new Function(`${prelude}; ${m[0]}; return ${name}`)
}

// Rates that exercise every branch: the min-charge lift, the cap clamp, the
// per-30-day cap scaling, an uncapped rate, and the fractional/half-penny
// rates that expose rounding.
const RATES = [
  { ratePerDay: 5,     minCharge: 10,   cap: 90,   capPeriodDays: 30, afterCapPerDay: 2 },
  { ratePerDay: 5.5,   minCharge: 10,   cap: 90,   capPeriodDays: 30, afterCapPerDay: 2.5 },
  { ratePerDay: 5.35,  minCharge: 12.5, cap: 92.5, capPeriodDays: 30, afterCapPerDay: 1.75 },
  { ratePerDay: 1.15,  minCharge: 5,    cap: null, afterCapPerDay: 2 },
  { ratePerDay: 2.675, minCharge: 0,    cap: 200,  capPeriodDays: 30, afterCapPerDay: 2 },
  // A row from before the 08-17 migration: no after-cap rate at all. Both
  // copies must fall back to the full day rate, and to the SAME answer.
  { ratePerDay: 5,     minCharge: 10,   cap: 90,   capPeriodDays: 30 },
]
// Chargeable days per cap window — one window, several, and the edges.
const PERIOD_SPLITS = [
  [0], [1], [3], [29], [30], [30, 1], [30, 5], [25, 15], [30, 30, 5], [30, 30, 30, 12], [0, 0], [12, 0, 7],
]

test('public/main.js round2 IS lib/rentalMath round2', () => {
  // eslint-disable-next-line no-new-func
  const clientRound2 = new Function(`${CLIENT_ROUND2}; return round2`)()
  for (const v of [0, 0.004, 0.005, 1.005, 2.675, 16.049999999999997, -1.005, -2.675, 99.999, NaN, '3.505']) {
    assert.equal(clientRound2(v), round2(v),
      `round2(${v}) differs between public/main.js and lib/rentalMath`)
  }
})

test('public/main.js priceFromPeriods agrees with lib/rentalMath to the penny', () => {
  // priceFromPeriods calls priceForWindow, so the window helper is lifted with it.
  const CLIENT_WINDOW = (SRC.match(/function priceForWindow\s*\([^)]*\)\s*\{[\s\S]*?\n\}/) || [])[0]
  assert.ok(CLIENT_WINDOW, 'public/main.js must define its priceForWindow mirror')
  const clientPriceFromPeriods = lift('priceFromPeriods', `${CLIENT_ROUND2}; ${CLIENT_WINDOW}`)()
  for (const rate of RATES) {
    for (const periods of PERIOD_SPLITS) {
      assert.equal(clientPriceFromPeriods(periods, rate), priceFromPeriods(periods, rate),
        `public/main.js priceFromPeriods(${JSON.stringify(periods)}, ${JSON.stringify(rate)}) has drifted from lib/rentalMath`)
    }
  }
})

test('public/main.js ticketFeeFor agrees with lib/rentalMath on the tiers', () => {
  const clientTicketFeeFor = lift('ticketFeeFor', CLIENT_ROUND2)()
  const SERVICES = [
    { price: 25,   repeatPrice: 10,   bulkPrice: 8 },         // full tier ladder
    { price: 25,   repeatPrice: null },                        // flat service (start fee)
    { price: 12.5, repeatPrice: 7.3 },                         // bulk falls back to repeat
    { price: 10.1, repeatPrice: 20.2, bulkPrice: 0.1 },        // float-dust bait
  ]
  for (const svc of SERVICES) {
    for (const n of [1, 2, 3, 5, 6, 9, 12]) {
      assert.equal(clientTicketFeeFor(svc, n), ticketFeeFor(svc, n),
        `public/main.js ticketFeeFor(${JSON.stringify(svc)}, ${n}) has drifted from lib/rentalMath`)
    }
  }
})

test('public/main.js ddMonthlyAmount agrees with lib/rentalMath ddSurcharge', () => {
  // The browser copy reads pct/min from settings; inject a stub settingNum so
  // the same numbers reach both sides.
  for (const [cost, pct, min] of [[10, 10, 2], [30, 10, 2], [7.37, 10, 2], [0, 10, 2], [25.55, 12.5, 3]]) {
    const settingNum = (key, dflt) =>
      key === 'sim_dd_surcharge_pct' ? pct : key === 'sim_dd_surcharge_min' ? min : dflt
    const clientDd = lift('ddMonthlyAmount', `const settingNum = arguments[0]; ${CLIENT_ROUND2}`)(settingNum)
    assert.equal(clientDd(cost), ddSurcharge(cost, pct / 100, min),
      `public/main.js ddMonthlyAmount(${cost}) with ${pct}%/£${min} has drifted from lib/rentalMath`)
  }
})

test('public/main.js poolScore agrees with lib/rentalMath exactly', () => {
  // The browser copy bakes the activation-fee bonus in as POOL_ACTIVATION_FEE;
  // lift the real constant so a change to either side shows up here.
  const feeM = SRC.match(/const POOL_ACTIVATION_FEE\s*=\s*([\d.]+)/)
  assert.ok(feeM, 'public/main.js must still define POOL_ACTIVATION_FEE')
  const clientPoolScore = lift('poolScore', `const POOL_ACTIVATION_FEE = ${feeM[1]}`)()
  for (const overlap of [-10, -1, 0, 1, 2, 3, 4, 10, 40]) {
    for (const alreadyActive of [true, false]) {
      // No round2 shim here: the two copies are exact today, including the
      // default £8 activation bonus, and must stay exact.
      assert.equal(clientPoolScore(overlap, alreadyActive), poolScore(overlap, alreadyActive),
        `public/main.js poolScore(${overlap}, ${alreadyActive}) has drifted from lib/rentalMath`)
    }
  }
})
