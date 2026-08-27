// Five phones, one payment, and £90 that never reached the ledger.
//
// Shloime hired five phones out on 27 August, recorded them as paid, and the
// ledger took £237.60 against £327.60 of charges. The first three rentals were
// settled, the fourth got £32.40, the fifth got no payment row at all.
//
// The allocation was never the problem. saveMultiPhoneRental spreads the pot
// across the batch in order and caps it at the batch total:
//
//   let payLeft = Math.max(0, Math.min(total, parseFloat(rPayAmount.value) || 0))
//
// It was handed the wrong pot. updateRentalCalc paints the batch total when
// there is more than one phone and then RETURNS — jumping over the two lines at
// the foot of the function that store rLastTotal and refill the "paid now" box.
// So the batch total went on screen and nowhere else, and rLastTotal kept
// whatever it held the last time the calculator ran in single-phone mode.
//
// The cap is what made it silent: a stale pot can only ever UNDER-pay, never
// over-pay, so nothing ever looked wrong. And "Full total" re-filled from the
// same stale number — the one control meant to fix this reproduced it.
//
// This test reads the source rather than the DOM: the multi-phone branch must
// set rLastTotal before it returns, and the save must say out loud when the pot
// is short.
import test from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const SRC = readFileSync(path.join(import.meta.dirname, '..', 'public/main.js'), 'utf8')
const CODE = SRC.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')

/** The multi-phone branch of updateRentalCalc, up to its early return. */
function multiBranch() {
  const start = CODE.indexOf('if (nrPhones.length > 1) {')
  assert.ok(start > -1, 'the multi-phone branch is gone — has the form been rewritten?')
  const end = CODE.indexOf('return;', start)
  assert.ok(end > start, 'the multi-phone branch no longer returns early')
  return CODE.slice(start, end)
}

test('the batch total is stored, not only painted', () => {
  assert.match(multiBranch(), /rLastTotal\s*=\s*net/,
    'the batch total must reach rLastTotal before the early return, or "Full total" refills from a stale number')
})

test('the paid-now box follows the batch total too', () => {
  assert.match(multiBranch(), /rPayAmount[\s\S]*?\.value = net\.toFixed\(2\)/,
    'an untouched paid-now box must track the batch total')
})

test('it still respects a figure somebody typed by hand', () => {
  // dataset.touched is how the form remembers that a person overrode the
  // default. Refilling over that would be its own bug.
  assert.match(multiBranch(), /dataset\.touched !== '1'/,
    'a hand-typed amount must not be overwritten')
})

test('a payment smaller than the total is said out loud', () => {
  const save = CODE.slice(CODE.indexOf('async function saveMultiPhoneRental'))
  assert.match(save, /payLeft < total/,
    'the confirm must compare the pot against the total')
  assert.match(save, /less than the total/,
    'and say so — a short pot used to look exactly like a full one')
})

test('the pot is still capped at the total', () => {
  // The cap is right; it is what stops a batch being over-paid. It just must
  // not be the only thing standing between a stale number and the ledger.
  const save = CODE.slice(CODE.indexOf('async function saveMultiPhoneRental'))
  assert.match(save, /Math\.min\(total,/)
})
