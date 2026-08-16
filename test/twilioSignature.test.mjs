// Verifying a Twilio webhook signature. Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { expectedSignature, verifyTwilioSignature, requestUrl } from '../lib/twilioSignature.mjs'

const TOKEN = 'test_auth_token_do_not_use'
const URL_ = 'https://app.kosher-connect.com/api/sms-status'
const PARAMS = { MessageSid: 'SM123', MessageStatus: 'delivered', To: '+447776659703' }

// The algorithm, written out independently of the implementation: URL, then
// each key and value concatenated in sorted key order, HMAC-SHA1, base64.
function signTheHardWay(token, url, params) {
  let data = url
  for (const k of Object.keys(params).sort()) data += k + params[k]
  return crypto.createHmac('sha1', token).update(data, 'utf8').digest('base64')
}

test('the signature matches an independent implementation of the algorithm', () => {
  assert.equal(expectedSignature(TOKEN, URL_, PARAMS), signTheHardWay(TOKEN, URL_, PARAMS))
})

test('a correctly signed request verifies', () => {
  const signature = signTheHardWay(TOKEN, URL_, PARAMS)
  assert.equal(verifyTwilioSignature({ authToken: TOKEN, url: URL_, params: PARAMS, signature }), true)
})

test('THE POINT — a tampered parameter fails', () => {
  // Someone rewriting "failed" to "delivered" in the audit trail is exactly
  // what this stops.
  const signature = signTheHardWay(TOKEN, URL_, PARAMS)
  const tampered = { ...PARAMS, MessageStatus: 'failed' }
  assert.equal(verifyTwilioSignature({ authToken: TOKEN, url: URL_, params: tampered, signature }), false)
})

test('a signature for a DIFFERENT url does not work here', () => {
  const signature = signTheHardWay(TOKEN, 'https://app.kosher-connect.com/api/inbound/mail', PARAMS)
  assert.equal(verifyTwilioSignature({ authToken: TOKEN, url: URL_, params: PARAMS, signature }), false)
})

test('the wrong token fails', () => {
  const signature = signTheHardWay('someone_elses_token', URL_, PARAMS)
  assert.equal(verifyTwilioSignature({ authToken: TOKEN, url: URL_, params: PARAMS, signature }), false)
})

test('it fails CLOSED — no token, no signature, empty signature', () => {
  const signature = signTheHardWay(TOKEN, URL_, PARAMS)
  assert.equal(verifyTwilioSignature({ authToken: '', url: URL_, params: PARAMS, signature }), false)
  assert.equal(verifyTwilioSignature({ authToken: TOKEN, url: URL_, params: PARAMS, signature: '' }), false)
  assert.equal(verifyTwilioSignature({ authToken: TOKEN, url: URL_, params: PARAMS }), false)
  assert.equal(verifyTwilioSignature({}), false)
})

test('a wrong-length signature is rejected rather than throwing', () => {
  // timingSafeEqual throws on a length mismatch and the header is attacker
  // controlled, so the guard has to come first (same lesson as check2faTicket).
  assert.doesNotThrow(() =>
    verifyTwilioSignature({ authToken: TOKEN, url: URL_, params: PARAMS, signature: 'short' }))
  assert.equal(verifyTwilioSignature({ authToken: TOKEN, url: URL_, params: PARAMS, signature: 'short' }), false)
})

test('parameter ORDER in the request does not change the signature', () => {
  const reordered = { To: PARAMS.To, MessageStatus: PARAMS.MessageStatus, MessageSid: PARAMS.MessageSid }
  assert.equal(expectedSignature(TOKEN, URL_, reordered), expectedSignature(TOKEN, URL_, PARAMS))
})

test('missing and empty values are signed as empty strings, not "undefined"', () => {
  assert.equal(expectedSignature(TOKEN, URL_, { A: '', B: undefined }),
    expectedSignature(TOKEN, URL_, { A: '', B: '' }))
})

test('requestUrl rebuilds the public URL from the proxy headers', () => {
  assert.equal(requestUrl({
    headers: { 'x-forwarded-proto': 'https', 'x-forwarded-host': 'app.kosher-connect.com' },
    url: '/api/sms-status',
  }), 'https://app.kosher-connect.com/api/sms-status')

  assert.equal(requestUrl({ headers: { host: 'app.kosher-connect.com' }, url: '/api/sms-status' }),
    'https://app.kosher-connect.com/api/sms-status')
})
