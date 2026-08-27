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
  // Written against `rLastTotal = net`; the VN fix later the same evening made
  // it `round2(net + mVnAmt)`. The assertion is on the PROPERTY — something is
  // assigned to rLastTotal in this branch — because what the total is made of
  // is allowed to grow, and what must never come back is the early return
  // jumping over the assignment entirely.
  assert.match(multiBranch(), /rLastTotal\s*=\s*[^;]+;/,
    'the batch total must reach rLastTotal before the early return, or "Full total" refills from a stale number')
  assert.match(multiBranch(), /rLastTotal[\s\S]*?net/,
    'and it must be built from the batch total, not from a single phone')
})

test('the paid-now box follows the batch total too', () => {
  assert.match(multiBranch(), /rPayAmount[\s\S]*?\.value = rLastTotal\.toFixed\(2\)/,
    'an untouched paid-now box must track whatever the stored batch total is')
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

// ── The virtual number, added 27 Aug ───────────────────────────────────────
//
// Reported the same evening: "another money bug, VN isnt being added to the
// total calculation!"
//
// The VN checkbox lives on the shared rental form and is on screen whatever
// the phone count. saveMultiPhoneRental wrote `vn: false, vnPrice: 0` — it
// hardcoded the number OFF. So the operator ticked the box, set the price, saw
// it on the form, and neither the total nor the charge ever knew. The single
// rental path had it right all along (totalPrice = discountedRental +
// vnOnRental), which is what makes this the same shape as the payment bug
// above: two paths through one form, and only one of them was finished.

test('the multi-phone save reads the VN fields at all', () => {
  const save = CODE.slice(CODE.indexOf('async function saveMultiPhoneRental'))
  assert.doesNotMatch(save.slice(0, CODE.indexOf('const created') - CODE.indexOf('async function saveMultiPhoneRental')),
    /vn: false, vnPrefix: '', vnSub: '', vnPrice: 0/,
    'the VN must no longer be hardcoded off')
  assert.match(save, /rAddVN/, 'it has to look at the checkbox')
  assert.match(save, /rVNPrice/, 'and at the price')
})

test('a weekly VN is in the batch total', () => {
  const save = CODE.slice(CODE.indexOf('async function saveMultiPhoneRental'))
  assert.match(save, /const total = round2\(lines\.reduce\([\s\S]{0,80}\+ vnOnBatch\)/,
    'the batch total must include the one-off VN')
})

test('a monthly VN is deliberately NOT in the rental charge', () => {
  // It bills on the recurring VN path (VN-<id>-<month>). Charging it here as
  // well would take the same money twice — the single-rental path carries the
  // same note for the same reason.
  const save = CODE.slice(CODE.indexOf('async function saveMultiPhoneRental'))
  assert.match(save, /mVnRecurs = mAddVN && mVnSub === 'monthly'/)
  assert.match(save, /vnOnBatch = mAddVN && !mVnRecurs/)
})

test('the number is charged once, not once per handset', () => {
  const save = CODE.slice(CODE.indexOf('async function saveMultiPhoneRental'))
  assert.match(save, /i === 0 \? vnOnBatch : 0/,
    'one virtual number for the customer — not a fraction of one on each phone')
  assert.match(save, /addVirtualNumber/,
    'and the VN record itself is created once, as the single-rental path does')
})

test('the calculator shows the VN in the batch total too', () => {
  const calc = CODE.slice(CODE.indexOf('if (nrPhones.length > 1) {'))
  assert.match(calc.slice(0, 3000), /rLastTotal = round2\(net \+ mVnAmt\)/,
    'the stored total — and so the paid-now default — must include the VN')
})
