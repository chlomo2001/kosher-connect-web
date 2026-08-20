// "Your payment method has been safely removed."
//
// Owner, 20 Aug, explaining a SIM he had just opened for a customer: "i paid
// with my card, he paid me, i removed my card, and still need to set up a
// payment method for him (didnt manage to do from app)". Then: "ALL such
// emails (remove conf) shall evoke a task."
//
// The shop's card gets a line going and then comes off the account. Between
// the card coming off and the customer's own method going on, the plan has no
// way to pay for itself — and unlike a failed payment, which shouts on the day
// it happens, this announces itself once and then goes quiet until the line
// stops on renewal day. It was landing in the queue as 'other'.
import test from 'node:test'
import assert from 'node:assert'
import {
  carrierMailKind, kindLabel, carrierMailTask, ACTIONABLE, HIGH_PRIORITY_KINDS, NEVER_FILE,
} from '../lib/carrierMail.mjs'
import { forwardKind } from '../lib/mailForward.mjs'

// Lebara's real message, id 142 in the live queue, 20 Aug 15:08.
const REAL = {
  subject: 'Payment remove confirmation',
  snippet: 'Hey there, Your payment method has been safely removed. If you didn’t request this please contact our customer support team Just a heads up, removing the payment method will interrupt your recurring plan. Login to your MyLebara account to add a new payment method. Thanks, The Lebara Team',
  text: '',
}

test('the message the owner was looking at is classified', () => {
  assert.equal(carrierMailKind(REAL), 'payment_method_removed')
  assert.equal(kindLabel('payment_method_removed'), 'Payment method removed')
})

test('the subject alone is enough, and so is the body alone', () => {
  assert.equal(carrierMailKind({ subject: 'Payment remove confirmation' }), 'payment_method_removed')
  assert.equal(carrierMailKind({ subject: 'A note from us', snippet: REAL.snippet }),
    'payment_method_removed')
})

test('other carriers phrase it differently and still land', () => {
  for (const subject of [
    'Your payment card was removed',
    'We have removed your payment details',
    'You’ve removed your payment method',
    'Payment method removed',
  ]) {
    assert.equal(carrierMailKind({ subject }), 'payment_method_removed', subject)
  }
})

// The word "remove" is all over mail footers. Matching on it alone would turn
// every unsubscribe line into a high-priority task.
test('an unsubscribe footer is not a removed payment method', () => {
  assert.notEqual(
    carrierMailKind({ subject: 'Our best deal yet', snippet: 'To remove yourself from this list click here. Remove me.' }),
    'payment_method_removed')
  assert.notEqual(
    carrierMailKind({ subject: 'SIM removed from your pool', snippet: 'A line left your pool.' }),
    'payment_method_removed')
})

// A failed payment and a removed method are different events with different
// fixes: one is "the card bounced", the other is "there is no card". The
// removal is checked first so a message that reads as both is filed as the one
// with something to do about it.
test('it is not confused with a failed payment, in either direction', () => {
  assert.equal(carrierMailKind({ subject: 'Payment failed' }), 'payment_failed')
  assert.equal(carrierMailKind({ subject: 'Payment remove confirmation' }), 'payment_method_removed')
  // The tie-break, in the BODY, where kind order is what decides it — the
  // subject is tested on its own first, so a subject test proves nothing here.
  assert.equal(
    carrierMailKind({
      subject: 'About your plan',
      snippet: 'We were unable to take payment. Your payment method has been safely removed.',
    }),
    'payment_method_removed',
    'the removal must be listed ahead of payment_failed')
})

test('it raises work, at high priority', () => {
  assert.ok(ACTIONABLE.has('payment_method_removed'))
  assert.ok(HIGH_PRIORITY_KINDS.has('payment_method_removed'))
  assert.ok(HIGH_PRIORITY_KINDS.has('payment_failed'), 'the existing high one must stay high')
  assert.ok(!HIGH_PRIORITY_KINDS.has('port_in_complete'), 'a port is work, not a deadline')
})

test('the task says what to do and by when, not what happened', () => {
  const title = carrierMailTask('payment_method_removed',
    { customerName: 'Yeshaye Tager', carrier: 'Lebara' })
  assert.match(title, /Yeshaye Tager/)
  assert.match(title, /Lebara/)
  assert.match(title, /set one up/i)
  assert.match(title, /before the next renewal|the line stops/i)
  // Falls back to the number, then to something readable, like its siblings.
  assert.match(carrierMailTask('payment_method_removed', { number: '07349969084' }), /07349969084/)
  assert.match(carrierMailTask('payment_method_removed', {}), /a customer/)
})

// It is the SHOP's card that came off, by the shop's own hand. The customer
// has nothing to do with it and would only be alarmed.
test('it is filed and it is not forwarded to the customer', () => {
  assert.ok(!NEVER_FILE.has('payment_method_removed'))
  assert.ok(!forwardKind('payment_method_removed'))
})
