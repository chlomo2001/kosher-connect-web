// What the shop may say about money (port item C1).
//
// The decision and the words are separate functions, so the belief can be
// tested without reading a sentence of copy — and the copy can be tested
// without re-deriving the belief. Both are tested here, and the two failure
// modes that produce a PLAUSIBLE wrong answer get the most attention: the sign
// convention, and the order of operations in moneyResult.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  moneyState, moneySentence, moneySay, moneyResult, rate, chaseOrder, gbp,
  MONEY_STATES, AUDIENCES, CHASE_AFTER_DAYS,
} from '../lib/moneyWords.mjs'

// ── the sign convention ───────────────────────────────────────────────────
test('NEGATIVE means they owe us; POSITIVE means we hold their money', () => {
  // Reversed, this tells a customer who owes £45 that they are £45 in credit —
  // plausible, wrong, and believed. It is the reason the convention is written
  // at the top of the module rather than left to be inferred.
  assert.equal(moneyState({ balance: -45 }), 'owes')
  assert.equal(moneyState({ balance: 45 }), 'in_credit')
  assert.match(moneySentence('owes', { balance: -45 }, 'customer'), /£45\.00 is outstanding/)
  assert.match(moneySentence('in_credit', { balance: 45 }, 'customer'), /£45\.00 in credit/)
  // The amount is shown as a magnitude either way — never "-£45.00 in credit".
  assert.ok(!moneySay({ balance: -45 }, 'customer').text.includes('-'))
})

test('rounding is not money', () => {
  assert.equal(moneyState({ balance: 0 }), 'settled')
  assert.equal(moneyState({ balance: 0.004 }), 'settled')
  assert.equal(moneyState({ balance: -0.004 }), 'settled')
  assert.equal(moneyState({ balance: 0.01 }), 'in_credit')
})

// ── unreliable wins over everything ───────────────────────────────────────
test('a figure we cannot stand behind is never described as settled or owed', () => {
  // settled, owed and in-credit are all CLAIMS. None may be made from a figure
  // that is not reliable, whatever the number happens to be.
  for (const balance of [-45, 0, 45]) {
    assert.equal(moneyState({ balance, reliable: false }), 'unreliable')
  }
  assert.equal(moneyState({ balance: NaN }), 'unreliable')
  assert.equal(moneyState({ balance: undefined }), 'unreliable')
  assert.equal(moneyState({}), 'unreliable')
  assert.match(moneySentence('unreliable', {}, 'staff'), /Do not quote this to anyone/)
})

test('lateness escalates in words, past thirty days', () => {
  assert.equal(CHASE_AFTER_DAYS, 30)
  assert.equal(moneyState({ balance: -20, oldestDebtDays: 29 }), 'owes')
  assert.equal(moneyState({ balance: -20, oldestDebtDays: 30 }), 'owes_overdue')
  assert.match(moneySentence('owes_overdue', { balance: -20, oldestDebtDays: 44 }, 'staff'), /worth a phone call/)
  assert.match(moneySentence('owes_overdue', { balance: -20, oldestDebtDays: 44 }, 'staff'), /for 44 days/)
  assert.match(moneySentence('owes', { balance: -20, oldestDebtDays: 1 }, 'staff'), /for 1 day\b/)
})

// ── the gaps/reliable shape ───────────────────────────────────────────────
test('a missing input is never treated as zero', () => {
  // The whole point. Summing before checking turns "we do not know" into "£0",
  // and £0 is a number somebody will quote.
  const r = moneyResult({ amount: 30, inputs: [rate(null, { what: 'the daily rate for Israel' })] })
  assert.equal(r.reliable, false)
  assert.equal(r.gaps.length, 1)
  assert.match(r.gaps[0], /do not have the daily rate for Israel on record/)
  // …and the amount still comes back, so a screen can show its working.
  assert.equal(r.amount, 30)
})

test('one unconfirmed rate makes the WHOLE answer provisional, not just its line', () => {
  const r = moneyResult({
    amount: 60,
    inputs: [rate(2, { confirmed: true, what: 'the daily rate' }), rate(15, { confirmed: false, what: 'the minimum charge' })],
  })
  assert.equal(r.reliable, false)
  assert.equal(r.gaps.length, 1)
  assert.match(r.gaps[0], /minimum charge has not been checked/)
})

test('order of operations: missing is reported before unconfirmed', () => {
  // Reversing these produces the same `reliable` and a differently-ordered
  // explanation — which is how a reader is told the least important thing
  // first about a figure they are deciding whether to quote.
  const r = moneyResult({
    amount: 10,
    inputs: [rate(5, { confirmed: false, what: 'the cap' }), rate(null, { what: 'the daily rate' })],
  })
  assert.equal(r.gaps.length, 2)
  assert.match(r.gaps[0], /do not have the daily rate/)
  assert.match(r.gaps[1], /cap has not been checked/)
})

test('everything confirmed and present is the only way to be reliable', () => {
  const r = moneyResult({ amount: 45, inputs: [rate(2, { confirmed: true, what: 'the daily rate' })] })
  assert.deepEqual(r.gaps, [])
  assert.equal(r.reliable, true)
  // A note pushed in by a caller is a gap like any other.
  const withNote = moneyResult({ amount: 45, notes: ['Two rentals overlap on this phone.'] })
  assert.equal(withNote.reliable, false)
  assert.equal(withNote.gaps[0], 'Two rentals overlap on this phone.')
  // An amount that is not a number cannot be reliable however clean the inputs.
  assert.equal(moneyResult({ amount: NaN }).reliable, false)
})

// ── the words ─────────────────────────────────────────────────────────────
test('every state has a sentence for every audience, and none says "certain"', () => {
  for (const state of MONEY_STATES) {
    for (const audience of AUDIENCES) {
      const text = moneySentence(state, { balance: -45, refundDue: 45, oldestDebtDays: 40 }, audience)
      assert.ok(text && text.length > 10, `${state}/${audience} has no sentence`)
      assert.doesNotMatch(text, /certain|guaranteed|definitely/i,
        `${state}/${audience} claims certainty — a confidence label teaches the reader to stop reading`)
      assert.doesNotMatch(text, /undefined|NaN|\[object/, `${state}/${audience} leaked a value`)
    }
  }
})

test('the customer is never told to worry about a figure that is not theirs to fix', () => {
  // The brief's rule, in KC's terms: a customer reading a hard number on a
  // Sunday night, when there is nothing they can do about it, has had a bad
  // night for no reason. Every customer-facing line therefore either says
  // there is nothing to do, or says what to do.
  for (const state of MONEY_STATES) {
    const text = moneySentence(state, { balance: -45, refundDue: 45, oldestDebtDays: 40 }, 'customer')
    assert.match(text, /nothing to (pay|do)|you can pay|please settle|please ask|ask us|we are sending|comes off/i,
      `the customer line for ${state} states a figure without saying what happens next: "${text}"`)
  }
})

test('an unknown audience falls back to staff rather than crashing', () => {
  assert.equal(moneySentence('settled', {}, 'nobody'), moneySentence('settled', {}, 'staff'))
  assert.equal(moneySay({ balance: 0 }).audience, 'staff')
})

test('an unknown state is treated as unreliable, not as settled', () => {
  // Failing open here would be a screen confidently saying "nothing to pay".
  assert.match(moneySentence('nonsense', {}, 'staff'), /Do not quote this/)
})

// ── formatting and ordering ───────────────────────────────────────────────
test('money reads as money', () => {
  assert.equal(gbp(0), '£0.00')
  assert.equal(gbp(-45), '£45.00')
  assert.equal(gbp(1234.5), '£1,234.50')
  assert.equal(gbp(1234567.891), '£1,234,567.89')
  assert.equal(gbp('nonsense'), '£0.00')
})

test('a chasing list is most-overdue first, with the unquotable at the very top', () => {
  const rows = [
    { id: 'settled', balance: 0 },
    { id: 'owes-recent', balance: -10, oldestDebtDays: 2 },
    { id: 'owes-old', balance: -10, oldestDebtDays: 90 },
    { id: 'credit', balance: 40 },
    { id: 'unknown', balance: -10, reliable: false },
    { id: 'owes-older', balance: -10, oldestDebtDays: 200 },
  ]
  assert.deepEqual(chaseOrder(rows).map(r => r.id),
    ['unknown', 'owes-older', 'owes-old', 'owes-recent', 'credit', 'settled'])
  // …and it does not mutate what it was handed.
  assert.equal(rows[0].id, 'settled')
})

test('absence is checked before conversion — the bug this module exists to prevent', () => {
  // Number(null) is 0. Number('') is 0. Number([]) is 0. A rate nobody has
  // entered must never become a free one, and the first draft of rate() had
  // exactly that fault sitting inside the function written to prevent it.
  for (const nothing of [null, undefined, '', [], {}, NaN]) {
    const r = rate(nothing, { what: 'the daily rate' })
    assert.equal(r.amount, null, `rate(${JSON.stringify(nothing)}) became a number`)
    const result = moneyResult({ amount: 0, inputs: [r] })
    assert.equal(result.reliable, false)
    assert.match(result.gaps[0], /do not have the daily rate on record/)
  }
  // A real zero is a real zero, though — a free day is a legitimate rate.
  assert.equal(rate(0, { what: 'a free day' }).amount, 0)
  assert.equal(rate('0').amount, 0)
  assert.equal(moneyResult({ amount: 0, inputs: [rate(0, { confirmed: true })] }).reliable, true)
})
