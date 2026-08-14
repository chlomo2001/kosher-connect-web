// Stripe charges → reconciliation rows. Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  netAmount, payerName, chargeEmail, ledgerRefFor, alreadyLinked, chargeToRow, importableCharges,
} from '../lib/stripeReconcile.mjs'

const charge = (over = {}) => ({
  id: 'ch_1', status: 'succeeded', paid: true, amount: 10000, amount_refunded: 0,
  currency: 'gbp', created: 1_760_000_000, payment_intent: 'pi_1',
  billing_details: { name: 'Hershy Tager', email: 'Hershy@Example.com' },
  description: 'Payment link', metadata: {},
  payment_method_details: { type: 'card' },
  ...over,
})

test('netAmount — refunds come off, in pounds', () => {
  assert.equal(netAmount(charge()), 100)
  assert.equal(netAmount(charge({ amount_refunded: 4000 })), 60)
  assert.equal(netAmount(charge({ amount_refunded: 10000 })), 0)
  assert.equal(netAmount({}), 0)
  // Rounding happens in pence, so a third of a pound can't drift.
  assert.equal(netAmount(charge({ amount: 3333, amount_refunded: 1111 })), 22.22)
})

test('payerName — the billing name, else a guess from the mailbox', () => {
  assert.equal(payerName(charge()), 'Hershy Tager')
  assert.equal(payerName(charge({ billing_details: { name: '', email: 'yoel.green2020@gmail.com' } })), 'yoel green')
  // Too little left after the digits go: say nothing rather than guess.
  assert.equal(payerName(charge({ billing_details: { name: '', email: '5380960@gmail.com' } })), '')
  assert.equal(payerName(charge({ billing_details: {}, receipt_email: 'mendl.rotter@gmail.com' })), 'mendl rotter')
})

test('chargeEmail — lowercased, either field', () => {
  assert.equal(chargeEmail(charge()), 'hershy@example.com')
  assert.equal(chargeEmail(charge({ billing_details: {}, receipt_email: 'A@B.COM' })), 'a@b.com')
  assert.equal(chargeEmail({}), '')
})

test('ledgerRefFor — the PAYMENT INTENT id, so a webhook replay dedupes', () => {
  // This is the same reference pages/api/stripe/webhook.js writes for
  // payment_intent.succeeded. If these two ever disagree the same money can be
  // posted twice, which is the whole point of the test.
  assert.equal(ledgerRefFor(charge()), 'STRIPE-pi_1')
  assert.equal(ledgerRefFor(charge({ payment_intent: { id: 'pi_2' } })), 'STRIPE-pi_2')
  assert.equal(ledgerRefFor(charge({ payment_intent: null })), 'STRIPE-ch_1')
})

test('alreadyLinked — our own metadata, or a reference the ledger holds', () => {
  assert.equal(alreadyLinked(charge(), new Set()), false)
  assert.equal(alreadyLinked(charge({ metadata: { app_customer_id: 'u1' } }), new Set()), true)
  assert.equal(alreadyLinked(charge(), new Set(['STRIPE-pi_1'])), true)
  assert.equal(alreadyLinked(charge(), new Set(['STRIPE-pi_9'])), false)
})

test('chargeToRow — the bank_transactions shape, keyed by the charge', () => {
  const r = chargeToRow(charge())
  assert.equal(r.provider, 'stripe')
  assert.equal(r.providerTxnId, 'ch_1')
  assert.equal(r.accountRef, 'Stripe')
  assert.equal(r.amount, 100)
  assert.equal(r.currency, 'GBP')
  assert.equal(r.counterpartyName, 'Hershy Tager')
  assert.match(r.description, /Payment link · hershy@example.com/)
  assert.equal(r.raw.ledger_reference, 'STRIPE-pi_1')
  assert.equal(new Date(r.bookedAt).getTime(), 1_760_000_000_000)
})

test('importableCharges — only settled money nobody has claimed', () => {
  const { rows, skipped } = importableCharges([
    charge({ id: 'ch_ok' }),
    charge({ id: 'ch_fail', status: 'failed' }),
    charge({ id: 'ch_ref', amount_refunded: 10000 }),
    charge({ id: 'ch_ours', metadata: { app_customer_id: 'u1' } }),
    charge({ id: 'ch_done', payment_intent: 'pi_done' }),
  ], new Set(['STRIPE-pi_done']))
  assert.deepEqual(rows.map((r) => r.providerTxnId), ['ch_ok'])
  assert.deepEqual(skipped, { unpaid: 1, refunded: 1, alreadyLinked: 2 })
})

test('importableCharges — nothing in, nothing out', () => {
  assert.deepEqual(importableCharges(null, new Set()).rows, [])
})
