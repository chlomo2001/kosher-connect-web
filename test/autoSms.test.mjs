// The automated customer reminders, and the four locks in front of them.
// Run: npm test
//
// This is the first thing in the app that can message a customer with no human
// in the loop. Everything else — receipts, reminders, replies — has a person
// pressing send. So the tests here are mostly about what it must NOT do.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { autoSmsBody, autoSmsGate, autoSmsKey, RULE_ACTIONS, SMS_TRIGGERS } from '../lib/autoSms.mjs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const SWEEP = read('pages/api/cron/sweep.js')
const API = read('pages/api/automations.js')

// ── Lock 2: armed ──────────────────────────────────────────────────────────
test('nothing sends unless AUTO_SMS_LIVE is set, and the reason is reported', () => {
  const had = process.env.AUTO_SMS_LIVE
  try {
    delete process.env.AUTO_SMS_LIVE
    assert.deepEqual(autoSmsGate('2026-08-27'), { send: false, why: 'not-armed' })
    process.env.AUTO_SMS_LIVE = 'yes'
    assert.equal(autoSmsGate('2026-08-27').send, false, 'only the exact word true arms it')
    process.env.AUTO_SMS_LIVE = 'TRUE'
    assert.equal(autoSmsGate('2026-08-27').send, true, 'case should not matter')
    process.env.AUTO_SMS_LIVE = 'true'
    assert.deepEqual(autoSmsGate('2026-08-27'), { send: true, why: 'armed' })
  } finally {
    if (had === undefined) delete process.env.AUTO_SMS_LIVE; else process.env.AUTO_SMS_LIVE = had
  }
})

// ── Lock 3: quiet days ─────────────────────────────────────────────────────
test('armed or not, it never sends on Shabbos or yom tov', () => {
  const had = process.env.AUTO_SMS_LIVE
  try {
    process.env.AUTO_SMS_LIVE = 'true'
    assert.deepEqual(autoSmsGate('2026-08-29'), { send: false, why: 'quiet-day' }) // Saturday
    assert.deepEqual(autoSmsGate('2026-04-02'), { send: false, why: 'quiet-day' }) // 15 Nisan
    assert.equal(autoSmsGate('2026-08-27').send, true)                              // Thursday
  } finally {
    if (had === undefined) delete process.env.AUTO_SMS_LIVE; else process.env.AUTO_SMS_LIVE = had
  }
})

// ── Lock 1: only two triggers may text ─────────────────────────────────────
test('only a passport or a SIM renewal can text a customer', () => {
  assert.deepEqual([...SMS_TRIGGERS].sort(), ['passport_in_days', 'sim_renewal_in_days'])
  assert.deepEqual([...RULE_ACTIONS].sort(), ['create_task', 'send_sms'])
  // The pairing is refused at the API, not just left out of the UI.
  assert.match(API, /action === 'send_sms' && !SMS_TRIGGERS\.includes\(b\.trigger\)/)
  assert.match(API, /Only a passport or SIM-renewal rule can text the customer/)
  // Money chasing in particular must not be reachable.
  assert.ok(!SMS_TRIGGERS.includes('balance_over'), 'a debt rule must never be able to text')
})

test('a rule that texts about anything else composes nothing', () => {
  for (const t of ['balance_over', 'rental_overdue_days', 'flight_in_days', 'checkin_due', 'nonsense']) {
    assert.equal(autoSmsBody(t, { name: 'A', when: '1 Sep' }), null, `${t} must not compose a message`)
  }
})

// ── Lock 4, and the send path ──────────────────────────────────────────────
test('it sends through the gate and never past it', () => {
  assert.match(SWEEP, /await sendSms\(\{ to, body, customerId: customerUuid \}\)/)
  // Comments stripped. The sweep explains in prose that SMS_LIVE governs
  // sendSms underneath, and a scan that reads prose fails on the explanation
  // rather than the code — which has now caught me three times in one day.
  const code = SWEEP.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
  for (const smell of ['twilio.com', 'api.twilio', 'TWILIO_']) {
    assert.ok(!code.includes(smell), `the sweep reaches past sendSms: ${smell}`)
  }
  // SMS_LIVE is sendSms's business, not the sweep's — but AUTO_SMS_LIVE
  // contains it, so match the bare name only.
  assert.ok(!/(?<!AUTO_)SMS_LIVE/.test(code), 'the sweep reads SMS_LIVE itself instead of leaving it to sendSms')
})

// ── One text per customer per event, for ever ──────────────────────────────
test('the key is claimed before the send, and released if it fails', () => {
  assert.equal(autoSmsKey('r1', 'e1'), 'AUTOSMS-r1-e1')
  const claim = SWEEP.indexOf('db.claimKey(autoSmsKey(')
  const send = SWEEP.indexOf('await sendSms({ to, body')
  assert.ok(claim > -1 && send > -1 && claim < send,
    'the key must be claimed BEFORE sending — a retry would text twice otherwise')
  assert.match(SWEEP, /releaseKey\(autoSmsKey\(/,
    'a failed send must release the key, or it is remembered as done and never retried')
})

test('a texting rule does not also raise a task', () => {
  assert.match(SWEEP, /if \(textsCustomer && fields\) \{ await text\([\s\S]{0,60}return \}/,
    'the task exists to make a person act; if the customer was told, it is done')
})

// ── The messages themselves ────────────────────────────────────────────────
test('both messages fit one SMS segment, for a long name', () => {
  // A non-GSM-7 character drops the limit from 160 to 70 and the shop pays
  // twice to say the same thing. 150 leaves headroom over a long name.
  for (const name of ['Yossi Klein', 'Yehoshua Rosenberg', 'Chaya Mushka Lipschitz']) {
    const p = autoSmsBody('passport_in_days', { name, when: '12 Sep', travel: '20 Sep' })
    const s = autoSmsBody('sim_renewal_in_days', { name, when: '3 Sep', provider: 'Lebara' })
    for (const [what, body] of [['passport', p], ['sim', s]]) {
      assert.ok(body.length <= 150, `${what} for ${name} is ${body.length} chars`)
      const odd = [...body].filter((c) => c.charCodeAt(0) > 126)
      assert.deepEqual(odd, [], `${what} carries non-GSM-7 characters: ${odd.join(' ')}`)
    }
  }
})

test('the messages say who is calling and how to reach a person', () => {
  const both = [
    autoSmsBody('passport_in_days', { name: 'A', when: '12 Sep', travel: '20 Sep' }),
    autoSmsBody('sim_renewal_in_days', { name: 'A', when: '3 Sep', provider: 'Lebara' }),
  ]
  for (const body of both) {
    assert.match(body, /^Kosher Connect: /, 'an unsigned text from an unknown number is a scam text')
    assert.match(body, /0161 531 1386/, 'there must be a person to call')
  }
})

test('a missing date composes nothing rather than a message with a hole in it', () => {
  assert.equal(autoSmsBody('passport_in_days', { name: 'A' }), null)
  assert.equal(autoSmsBody('sim_renewal_in_days', { name: 'A' }), null)
  // A booking with no travel date still texts — the passport fact stands alone.
  assert.match(autoSmsBody('passport_in_days', { name: 'A', when: '12 Sep' }), /expires 12 Sep\./)
})

test('no name is "hi there", not "hi undefined"', () => {
  assert.match(autoSmsBody('sim_renewal_in_days', { when: '3 Sep' }), /hi there,/)
  assert.match(autoSmsBody('sim_renewal_in_days', { name: '  ', when: '3 Sep' }), /hi there,/)
})

// ── The dry run ────────────────────────────────────────────────────────────
test('an unarmed run still composes, counts and samples', () => {
  assert.match(SWEEP, /texts\.wouldSend\+\+/)
  assert.match(SWEEP, /texts\.samples\.push\(body\)/)
  assert.match(SWEEP, /counts\.autoSms = ruleRun\.texts/,
    'the tally must reach the response, or the dry run is invisible')
})
