// An advert is filed and marked done, not thrown away.
//
// It used to be dropped outright — stored nowhere, a line in a Vercel log the
// only trace. That broke the rule the endpoint states at the top of itself:
// "Anything that cannot be paired with certainty is STORED, not guessed at and
// not dropped."
//
// The asymmetry is the whole argument. A missed advert costs one dismissal in
// a queue. A MISCLASSIFIED message — a completed port, a failed payment — was
// gone, and nobody would ever know to look for it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { carrierMailKind, NEVER_FILE, ACTIONABLE } from '../lib/carrierMail.mjs'

const API = readFileSync(new URL('../pages/api/inbound/mail.js', import.meta.url), 'utf8')

test('an advert is written to sim_mail, already resolved', () => {
  assert.match(API, /const filedResolved = NEVER_FILE\.has\(kind\)/)
  assert.match(API, /\.\.\.\(filedResolved \? \{ resolved_at: new Date\(\)\.toISOString\(\) \} : \{\}\)/,
    'an advert must be filed as already dealt with, so it never enters the working queue')
  // The old early return is what has to be gone: it returned before the insert.
  assert.ok(!/stored: false, reason: 'marketing'/.test(API),
    'the endpoint still drops adverts without storing them')
})

test('an advert still raises no task and enters no queue', () => {
  // Filing it must not undo the reason it was dropped in the first place.
  assert.ok(!ACTIONABLE.has('marketing'), 'an advert is not work for anybody')
  for (const kind of NEVER_FILE) assert.ok(!ACTIONABLE.has(kind))
})

test('the subject decides before the body is read at all', () => {
  // This is what actually protects transactional mail that carries a tracking
  // link, and it is worth stating because it is not obvious: carrierMailKind
  // tests the SUBJECT against every kind first, and only reads the body if no
  // subject matched. So Smarty's genuine port completion — whose body carries
  // utm_campaign — is settled by its subject long before the link is seen.
  //
  // I first assumed list ORDER was the protection and wrote a test around
  // that. It could not fail: the mutation I aimed at it changed nothing,
  // because the body was never reached. A test that cannot fail for the reason
  // it claims is worse than no test, so this asserts the real mechanism.
  const marketingBody = 'unsubscribe from our marketing newsletter — 50% off this weekend'
  assert.equal(carrierMailKind({
    subject: 'Your port is successful',
    snippet: marketingBody,
  }), 'port_in_complete', 'a recognised subject must win over anything in the body')
  assert.equal(carrierMailKind({
    subject: 'Your Lebara Mobile UK Auto Renew reminder',
    snippet: marketingBody,
  }), 'renewal_reminder')
  // …and with nothing in the subject, the body is what is left to go on.
  assert.equal(carrierMailKind({ subject: 'Hello', snippet: marketingBody }), 'marketing')
})

test('a port completion carrying a tracking link is still a port completion', () => {
  const port = carrierMailKind({
    subject: 'Your port is successful',
    snippet: 'Your port is successful <https://smarty.co.uk?utm_medium=email&utm_source=Group' +
      '&utm_campaign=EECC_group_port-IN_Complete_solo&utm_content=non-convertible>',
  })
  assert.equal(port, 'port_in_complete')
  assert.ok(ACTIONABLE.has(port), 'and it must still raise work for somebody')
})

test('a plain advert is still recognised', () => {
  assert.equal(carrierMailKind({ subject: '50% off this weekend', snippet: '' }), 'marketing')
  assert.ok(NEVER_FILE.has('marketing'))
})
