// Reading an inbound webhook payload. Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  addressesOf, pairableRecipients, snippetOf, normaliseInbound, carrierOf,
} from '../lib/inboundMail.mjs'

const HOP = 'kosher-connect.com'

test('addresses are read out of every shape a parser might send', () => {
  assert.deepEqual(addressesOf('a@b.com'), ['a@b.com'])
  assert.deepEqual(addressesOf('A Name <a@b.com>'), ['a@b.com'])
  assert.deepEqual(addressesOf('a@b.com, c@d.com'), ['a@b.com', 'c@d.com'])
  assert.deepEqual(addressesOf(['a@b.com', 'c@d.com']), ['a@b.com', 'c@d.com'])
  assert.deepEqual(addressesOf({ text: 'A <a@b.com>, c@d.com' }), ['a@b.com', 'c@d.com'])
  assert.deepEqual(addressesOf({ value: [{ address: 'a@b.com', name: 'A' }] }), ['a@b.com'])
  assert.deepEqual(addressesOf(null), [])
  assert.deepEqual(addressesOf({ value: [] }), [])
})

test('THE FORWARDING HOP IS EXCLUDED — it is on every message', () => {
  // Mail is addressed to the per-SIM alias, then forwarded through the shop
  // domain to reach the app. Pairing on the hop would match everything to
  // nothing, because it is identical on every single message.
  const payload = {
    to: 'gitt.bilig+moshe@gmail.com',
    deliveredTo: 'lebara-in@kosher-connect.com',
  }
  assert.deepEqual(pairableRecipients(payload, HOP), ['gitt.bilig+moshe@gmail.com'])
})

test('the original recipient survives several hops and header spellings', () => {
  const payload = {
    headers: {
      'Delivered-To': 'lebara-in@kosher-connect.com',
      'X-Forwarded-To': 'gitt.bilig+rivky@gmail.com',
      To: 'Gitt <gitt.bilig+rivky@gmail.com>',
    },
  }
  assert.deepEqual(pairableRecipients(payload, HOP), ['gitt.bilig+rivky@gmail.com'])
})

test('a message with nothing but the hop is pairable by nothing', () => {
  const payload = { to: 'lebara-in@kosher-connect.com' }
  assert.deepEqual(pairableRecipients(payload, HOP), [])
})

test('body text is found wherever it lives, and capped', () => {
  assert.equal(snippetOf({ text: '  Your   plan\nrenews  ' }), 'Your plan renews')
  assert.equal(snippetOf({ html: '<p>Your <b>plan</b> renews</p>' }), 'Your plan renews')
  assert.equal(snippetOf({}), '')
  assert.equal(snippetOf({ text: 'x'.repeat(5000) }).length, 600)
})

test('a realistic Lebara payload normalises end to end', () => {
  const payload = {
    messageId: '<abc123@lebara.com>',
    from: { value: [{ address: 'noreply@lebara.com', name: 'Lebara' }] },
    to: { value: [{ address: 'gitt.bilig+moshe@gmail.com' }] },
    headers: { 'delivered-to': 'lebara-in@kosher-connect.com' },
    subject: '  Your plan for 07349 967598 renews soon  ',
    text: 'Hello, your National Plus plan renews on 20 August.',
    date: '2026-08-16T09:15:00.000Z',
  }
  const m = normaliseInbound(payload, { hopDomain: HOP })
  assert.equal(m.messageId, 'abc123@lebara.com')      // angle brackets stripped
  assert.deepEqual(m.recipients, ['gitt.bilig+moshe@gmail.com'])
  assert.equal(m.from, 'noreply@lebara.com')
  assert.equal(m.subject, 'Your plan for 07349 967598 renews soon')
  assert.equal(m.receivedAt, '2026-08-16T09:15:00.000Z')
  assert.equal(carrierOf(m.from), 'Lebara')
})

test('a missing Message-Id gets a DETERMINISTIC id, so redelivery still dedupes', () => {
  const payload = { from: 'noreply@lebara.com', to: 'a+b@gmail.com', subject: 'Hi', date: '2026-08-16T09:15:00Z' }
  const a = normaliseInbound(payload, { hopDomain: HOP })
  const b = normaliseInbound(payload, { hopDomain: HOP })
  assert.equal(a.messageId, b.messageId)
  assert.ok(a.messageId.startsWith('no-id:'))
})

test('a garbage date does not become an invalid timestamp', () => {
  const m = normaliseInbound({ date: 'not a date', subject: 'x' }, { hopDomain: HOP })
  assert.equal(m.receivedAt, null)
})

test('an empty payload normalises without throwing', () => {
  const m = normaliseInbound({}, { hopDomain: HOP })
  assert.deepEqual(m.recipients, [])
  assert.equal(m.subject, '')
  assert.ok(m.messageId.length > 0)
})

test('carrier comes from the sender, not the forwarding path', () => {
  assert.equal(carrierOf('billing@lebara.co.uk'), 'Lebara')
  assert.equal(carrierOf('no-reply@1pmobile.com'), '1pMobile')
  assert.equal(carrierOf('hello@giffgaff.com'), 'giffgaff')
  assert.equal(carrierOf('someone@kosher-connect.com'), null)
  assert.equal(carrierOf(''), null)
})
