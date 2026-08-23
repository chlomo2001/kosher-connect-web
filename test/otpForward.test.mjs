// Issue #15, all three parts, owner's yes in four words ("yes to all 3").
//
// 1. The portal shows each PLAN's carrier login — tagged addresses only.
// 2. The four safe kinds forward themselves on arrival; the certainty test
//    (forwardTarget) is kept exactly as it was.
// 3. A sign-in code forwards with NO human in the loop — under stricter
//    conditions than anything else, because an OTP to the wrong customer is
//    an account handed to a stranger, which is worse than a late one.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { carrierMailKind, KINDS } from '../lib/carrierMail.mjs'
import { FORWARD_KINDS, AUTO_FORWARD_KINDS } from '../lib/mailForward.mjs'
import { mailboxKey } from '../lib/simMailMatch.mjs'

const code = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
  .split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')

const INBOUND = code('../pages/api/inbound/mail.js')
const EMAIL = code('../lib/email.js')
const SEND = code('../lib/forwardSend.js')
const ME = code('../pages/api/portal/me.js')

// ── the otp kind, matched narrowly ─────────────────────────────────────────

test('a sign-in code is recognised in the shapes carriers write it', () => {
  assert.equal(carrierMailKind({ subject: 'Your verification code' }), 'otp')
  assert.equal(carrierMailKind({ subject: 'Lebara', snippet: 'Your one-time passcode is 483920.' }), 'otp')
  assert.equal(carrierMailKind({ snippet: 'Use this login code to continue: 552211' }), 'otp')
  assert.equal(carrierMailKind({ subject: 'Your OTP' }), 'otp')
})

test('narrow means narrow — money and marketing mail must not fast-track', () => {
  assert.equal(carrierMailKind({ snippet: 'We couldn’t process the payment for your SIM Only plan.' }), 'payment_failed')
  assert.equal(carrierMailKind({ subject: '20% off this week only!' }), 'marketing')
  // A port confirmation that happens to carry a validation code is still the
  // port — its task must be raised. Ports sit above otp in KINDS on purpose.
  assert.equal(carrierMailKind({
    subject: 'PortIn', snippet: 'Your number has moved. Your verification code was used.',
  }), 'port_in_complete')
  const order = KINDS.map(([k]) => k)
  assert.ok(order.indexOf('port_in_complete') < order.indexOf('otp'))
})

// ── which kinds go by themselves ───────────────────────────────────────────

test('the four safe kinds auto-forward; otp is deliberately NOT among them', () => {
  assert.deepEqual([...AUTO_FORWARD_KINDS].sort(),
    ['expiry_warning', 'payment_failed', 'port_in_complete', 'renewed'])
  assert.ok(FORWARD_KINDS.has('otp'),
    'an otp that misses the strict auto conditions must land in the approval queue, not vanish')
})

test('the inbound hook forwards fresh arrivals only, otp under stricter terms', () => {
  assert.match(INBOUND, /AUTO_FORWARD_KINDS\.has\(kind\) \|\| kind === 'otp'/)
  assert.match(INBOUND, /inserted\.length && match\.simId && !filedResolved/)
  assert.match(INBOUND, /match\.confidence === 'address' && key\.includes\('\+'\)/,
    'an OTP goes only when the ADDRESS paired it and that address is tagged')
  assert.match(INBOUND, /key=eq\.otp_forward_live/, 'the live switch is read from settings, on the record')
  // The nightly sweep must NOT auto-forward: a repaired backlog is history,
  // and forwarding it greets a customer with ninety old emails.
  const SWEEP = code('../pages/api/cron/sweep.js')
  assert.ok(!SWEEP.includes('sendCarrierForward'), 'the sweep re-pair must never forward')
})

// ── the one sanctioned crack in the HOLD gate ──────────────────────────────

test('forceLive bypasses ONLY the hold — test mode still redirects, and it is opt-in', () => {
  assert.match(EMAIL, /forceLive = false/)
  assert.match(EMAIL, /gate\.mode === 'hold' && forceLive/)
  const holdBypass = EMAIL.indexOf("gate.mode === 'hold' && forceLive")
  const testBranch = EMAIL.indexOf("gate.mode === 'test'")
  assert.ok(holdBypass < testBranch, 'the bypass rewrites hold to live BEFORE the test/live fork, so TEST still redirects')
})

test('an automatic forward held by the gate stays UNMARKED for the queue', () => {
  assert.match(SEND, /markHeld = false/)
  assert.match(SEND, /if \(!held \|\| markHeld\)/,
    'marking a held auto-forward as forwarded would silently drop it for ever')
  const APPROVE = code('../pages/api/mail-forward.js')
  assert.match(APPROVE, /markHeld: true/, 'an owner approval IS a decision — held builds are marked there')
})

// ── the portal login, tagged only ──────────────────────────────────────────

test('the portal serves a login only when the address names ONE line', () => {
  assert.match(ME, /\(mailboxKey\(raw\) \|\| ''\)\.includes\('\+'\)/)
  // The rule itself, run: a tagged address survives, the bare pool dies.
  const loginOf = (raw) => raw && (mailboxKey(raw) || '').includes('+') ? raw : ''
  assert.equal(loginOf('gitt.bilig+moshe@gmail.com'), 'gitt.bilig+moshe@gmail.com')
  assert.equal(loginOf('gitt.bilig@gmail.com'), '', 'the bare base names 253 lines — never printed')
  assert.equal(loginOf(''), '')
})

test('portal sign-in codes are recent-only and per-plan', () => {
  assert.match(ME, /15 \* 60000/, 'a code older than its own lifetime is noise, not help')
  assert.match(ME, /carrierMailKind\(\{ subject: m\.subject, snippet: m\.snippet \}\) !== 'otp'/)
})
