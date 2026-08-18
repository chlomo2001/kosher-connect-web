// What a carrier message MEANS. Every subject below is a real one from the
// shop's queue on 18 Aug 2026, and the case that started this is the first:
// Lebara's port confirmation, subject "PortIn", which the app filed as
// undifferentiated post and left a person to settle by hand an hour later.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { carrierMailKind, kindLabel, carrierMailTask, ACTIONABLE, NEVER_FILE } from '../lib/carrierMail.mjs'

const REAL = [
  ['PortIn', 'Dear customer, your existing mobile number has been successfully moved to the Lebara network. Please make sure you now have the Lebara SIM in your handset.', 'port_in_complete'],
  ['Your port is successful', 'Great news your port request for your number has now successfully completed!', 'port_in_complete'],
  ['Your Lebara Mobile UK Auto Renew reminder', 'Your 5GB Monthly Plan is scheduled to renew on 30/07/2026.', 'renewal_reminder'],
  ['Your Lebara mobile plan has been successfully renewed', 'We have received payment for your SIM Only plan', 'renewed'],
  ['Your giffgaff mobile number (07591989314) will expire in 5 days', '', 'expiry_warning'],
  ['1pMobile auto-Boost', '', 'renewed'],
  ['spusu - Reminder - 7147008', '', 'renewal_reminder'],
  ["There's still time – update your pool's credit card now", '', 'payment_failed'],
]

test('every subject in the real queue is read correctly', () => {
  for (const [subject, text, expected] of REAL) {
    assert.equal(carrierMailKind({ subject, text }), expected, `"${subject}" → ${carrierMailKind({ subject, text })}`)
  }
})

test('a PAC code is recognised — the one piece of post that means a customer is leaving', () => {
  assert.equal(carrierMailKind({ subject: 'Your PAC code' }), 'pac_issued')
  assert.equal(carrierMailKind({ subject: 'Porting Authorisation Code request', text: '' }), 'pac_issued')
  assert.equal(carrierMailKind({ subject: 'Your STAC', text: '' }), 'pac_issued')
})

test('the subject outranks the body', () => {
  // A renewal email carries a footer link about porting TO the network. Reading
  // the body first would label every renewal in the queue as a port.
  const kind = carrierMailKind({
    subject: 'Your Lebara Mobile UK Auto Renew reminder',
    text: 'Your plan is scheduled to renew. … Thinking of joining us? Port your number to Lebara today.',
  })
  assert.equal(kind, 'renewal_reminder')
})

test('the body is read when the subject says nothing', () => {
  // Lebara's own port mail is the reverse case: a one-word subject and the
  // meaning in the first line of the body.
  assert.equal(carrierMailKind({
    subject: 'Update from your provider',
    text: 'your existing mobile number has been successfully moved to the Lebara network',
  }), 'port_in_complete')
})

test('an unrecognised message is "other", not a guess', () => {
  // An honest shrug: a queue of unlabelled post is visible as unlabelled. A
  // wrong label on a payment failure is worse than none.
  // 'Your August newsletter' and 'Refer a friend' used to live in this list.
  // They are now deliberately classified as marketing and dropped (owner,
  // 19 Aug) — see the marketing tests below. Everything here is post the
  // classifier genuinely cannot read, and unreadable post must still be FILED.
  for (const subject of ['Hello', '', 'A message about your account', 'Update']) {
    assert.equal(carrierMailKind({ subject }), 'other')
    assert.equal(kindLabel(carrierMailKind({ subject })), '')
  }
  assert.equal(carrierMailKind({}), 'other')
  assert.equal(carrierMailKind(), 'other')
})

test('only the messages that mean work raise a task', () => {
  assert.ok(ACTIONABLE.has('port_in_complete'))
  assert.ok(ACTIONABLE.has('pac_issued'))
  assert.ok(ACTIONABLE.has('payment_failed'))
  // The renewals are the wallpaper — hundreds a month. A task for each would
  // bury the three that matter.
  for (const quiet of ['renewal_reminder', 'renewed', 'expiry_warning', 'other']) {
    assert.ok(!ACTIONABLE.has(quiet), `${quiet} must not raise a task`)
    assert.equal(carrierMailTask(quiet, { customerName: 'A' }), null)
  }
})

test('a task says what to DO, and names who it is about', () => {
  const t = carrierMailTask('port_in_complete', { customerName: 'Mordche Grinfeld', carrier: 'Lebara' })
  assert.match(t, /Mordche Grinfeld/)
  assert.match(t, /check/i, 'a task titled "Port completed" is a notification, not work')
  assert.match(t, /Lebara/)
  // No customer on the record yet — the number is the next best name.
  assert.match(carrierMailTask('pac_issued', { number: '07700900123' }), /07700900123/)
  // Nothing at all still reads as a sentence.
  assert.match(carrierMailTask('payment_failed', {}), /a customer/)
})

// ── marketing: filed nowhere, and never at the cost of a real notice ──────
// Owner, 19 Aug: "promotion emails filtered to never arrive to app". Dropping
// a message is the most destructive thing this classifier can do, so the tests
// that matter are the ones proving a real notice still wins.
test('an advert is classified as marketing and marked never-file', () => {
  assert.equal(carrierMailKind({ subject: 'Summer sale — 30% off all plans', snippet: '', text: '' }), 'marketing')
  assert.equal(carrierMailKind({ subject: 'Refer a friend and both get £10', snippet: '', text: '' }), 'marketing')
  assert.equal(carrierMailKind({ subject: 'Our July newsletter', snippet: '', text: '' }), 'marketing')
  assert.ok(NEVER_FILE.has('marketing'))
})

test('a real notice carrying an advert in its footer is NOT dropped', () => {
  const footer = 'Unsubscribe from our marketing. Download our app. 20% off accessories!'
  assert.equal(carrierMailKind({ subject: 'Your port request is complete', snippet: '', text: footer }), 'port_in_complete')
  assert.equal(carrierMailKind({ subject: 'Your PAC code', snippet: '', text: footer }), 'pac_issued')
  assert.equal(carrierMailKind({ subject: 'Payment failed', snippet: '', text: footer }), 'payment_failed')
  assert.equal(carrierMailKind({ subject: 'Your plan is scheduled to renew', snippet: '', text: footer }), 'renewal_reminder')
  for (const k of ['port_in_complete', 'pac_issued', 'payment_failed', 'renewal_reminder']) {
    assert.ok(!NEVER_FILE.has(k), `${k} must never be dropped`)
  }
})

test('an unclassifiable message is still filed, never dropped', () => {
  const kind = carrierMailKind({ subject: 'A message about your account', snippet: '', text: '' })
  assert.ok(!NEVER_FILE.has(kind), 'the fallback kind must be filed — dropping the unknown loses real post')
})
