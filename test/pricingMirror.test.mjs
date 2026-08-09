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
// KNOWN GAP, deliberately tolerated for now: the browser copies return the
// raw float and let the caller display it, while the lib copies round2() to
// the penny (half away from zero — the audited money rounding from
// lib/money.mjs). So client priceFromDays(3, …, 5.35/day) says
// 16.049999999999997 where the server maths says 16.05, and a half-penny rate
// like 2.675 splits a full penny (2.675 vs 2.68). The formula comparisons
// below therefore pass the client result through lib round2() before
// comparing — that pins the actual formulas (rate × days, min-charge lift,
// per-window cap scaling, ticket tiers, surcharge floor) while the rounding
// question is with the owner. If the client copies are ever re-synced to
// round like the canon, tighten these to plain equality.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { round2, priceFromDays, ticketFeeFor, ddSurcharge, poolScore } from '../lib/rentalMath.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = readFileSync(path.join(ROOT, 'public/main.js'), 'utf8')

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
  { ratePerDay: 5,     minCharge: 10,   cap: 90,   capPeriodDays: 30 },
  { ratePerDay: 5.5,   minCharge: 10,   cap: 90,   capPeriodDays: 30 },
  { ratePerDay: 5.35,  minCharge: 12.5, cap: 92.5, capPeriodDays: 30 },
  { ratePerDay: 1.15,  minCharge: 5,    cap: null },
  { ratePerDay: 2.675, minCharge: 0,    cap: 200,  capPeriodDays: 30 },
]
const DAY_COUNTS = [0, 1, 3, 6, 13, 29, 30, 31, 60, 100]

test('public/main.js priceFromDays agrees with lib/rentalMath on the formula', () => {
  const clientPriceFromDays = lift('priceFromDays')()
  for (const rate of RATES) {
    for (const cd of DAY_COUNTS) {
      const totalDays = cd + 2 // a couple of free (Shabbos) days in the range
      const got = clientPriceFromDays(cd, totalDays, rate)
      const want = priceFromDays(cd, totalDays, rate)
      assert.equal(round2(got), want,
        `public/main.js priceFromDays(${cd}, ${totalDays}, ${JSON.stringify(rate)}) has drifted from lib/rentalMath`)
    }
  }
})

test('public/main.js priceFromDays matches exactly where no rounding is involved', () => {
  const clientPriceFromDays = lift('priceFromDays')()
  const rate = { ratePerDay: 5, minCharge: 10, cap: 90, capPeriodDays: 30 }
  for (const cd of DAY_COUNTS) {
    assert.equal(clientPriceFromDays(cd, cd, rate), priceFromDays(cd, cd, rate),
      `integer-rate priceFromDays(${cd}) must be penny-identical in both copies`)
  }
})

test('public/main.js ticketFeeFor agrees with lib/rentalMath on the tiers', () => {
  const clientTicketFeeFor = lift('ticketFeeFor')()
  const SERVICES = [
    { price: 25,   repeatPrice: 10,   bulkPrice: 8 },         // full tier ladder
    { price: 25,   repeatPrice: null },                        // flat service (start fee)
    { price: 12.5, repeatPrice: 7.3 },                         // bulk falls back to repeat
    { price: 10.1, repeatPrice: 20.2, bulkPrice: 0.1 },        // float-dust bait
  ]
  for (const svc of SERVICES) {
    for (const n of [1, 2, 3, 5, 6, 9, 12]) {
      assert.equal(round2(clientTicketFeeFor(svc, n)), ticketFeeFor(svc, n),
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
    const clientDd = lift('ddMonthlyAmount', 'const settingNum = arguments[0]')(settingNum)
    assert.equal(round2(clientDd(cost)), ddSurcharge(cost, pct / 100, min),
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
