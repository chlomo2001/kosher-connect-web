// Alias recipients: mailboxes and webhook URLs. Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  cleanRecipients, isValidRecipient, isWebhookRecipient, recipientProblem,
} from '../lib/aliasRecipients.mjs'

const HOOK = 'https://app.kosher-connect.com/api/inbound/mail?key=Ab3XyZ_Secret'

test('mailboxes still work exactly as before', () => {
  assert.deepEqual(cleanRecipients('a@b.com, c@d.com'), ['a@b.com', 'c@d.com'])
  assert.deepEqual(cleanRecipients('  A@B.COM  '), ['a@b.com'])   // folded
  assert.deepEqual(cleanRecipients(['a@b.com', 'nope']), ['a@b.com'])
  assert.deepEqual(cleanRecipients(''), [])
})

test('THE CASE TRAP — a webhook URL keeps its capitals', () => {
  // The secret lives in ?key=. Lowercasing it leaves an alias that looks right
  // and 401s on every single message.
  assert.deepEqual(cleanRecipients(HOOK), [HOOK])
  assert.equal(cleanRecipients(HOOK)[0], HOOK)
  assert.ok(cleanRecipients(HOOK)[0].includes('Ab3XyZ_Secret'))
})

test('http is refused — the secret would travel in the clear', () => {
  const insecure = 'http://app.kosher-connect.com/api/inbound/mail?key=x'
  assert.equal(isValidRecipient(insecure), false)
  assert.deepEqual(cleanRecipients(insecure), [])
  assert.match(recipientProblem(insecure), /https/)
})

test('a mailbox and a webhook can share one alias', () => {
  // Useful while testing: keep a copy going to a human inbox.
  assert.deepEqual(cleanRecipients(`${HOOK}, shloime@kosher-connect.com`),
    [HOOK, 'shloime@kosher-connect.com'])
})

test('splitting on whitespace cannot break a URL', () => {
  // URLs contain no spaces or commas, so the existing split is safe for them.
  assert.deepEqual(cleanRecipients(`${HOOK}\n a@b.com`), [HOOK, 'a@b.com'])
})

test('isWebhookRecipient is strict about the scheme', () => {
  assert.equal(isWebhookRecipient(HOOK), true)
  assert.equal(isWebhookRecipient('HTTPS://EXAMPLE.COM/x'), true)
  assert.equal(isWebhookRecipient('ftp://example.com'), false)
  assert.equal(isWebhookRecipient('a@b.com'), false)
  assert.equal(isWebhookRecipient(''), false)
})

test('the rejection message says what is actually wrong', () => {
  assert.equal(recipientProblem('a@b.com'), null)
  assert.equal(recipientProblem(HOOK), null)
  assert.match(recipientProblem(''), /https:\/\/ webhook URL/)
  assert.match(recipientProblem('ftp://x.com'), /Only https/)
  assert.match(recipientProblem('just-words'), /neither an email address/)
})
