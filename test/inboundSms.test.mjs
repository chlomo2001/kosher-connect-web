import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  isStopKeyword, isStartKeyword, matchCustomerByPhone, inboundLogRow, inboundSummary, replyTarget,
} from '../lib/inboundSms.mjs'
import { needsAnswer, unanswered, unansweredThreads, threadKey } from '../lib/replyQueue.mjs'

test('the stop words carriers and the law recognise', () => {
  for (const w of ['STOP', 'stop', 'Stop.', 'STOPALL', 'unsubscribe', 'CANCEL', 'end', 'QUIT']) {
    assert.equal(isStopKeyword(w), true, w)
  }
})

test('a sentence containing "stop" is a sentence, not an opt-out', () => {
  for (const s of ['stop sending me the £20 one', 'can you stop the rental', 'please stop by tomorrow']) {
    assert.equal(isStopKeyword(s), false, s)
  }
  assert.equal(isStopKeyword(''), false)
  assert.equal(isStopKeyword(null), false)
})

test('START puts them back on', () => {
  assert.equal(isStartKeyword('START'), true)
  assert.equal(isStartKeyword('yes'), true)
  assert.equal(isStartKeyword('yes please, tomorrow'), false)
})

const CUSTOMERS = [
  { id: '1', firstName: 'Menachem', phone: '07911 123456' },
  { id: '2', firstName: 'Yossi', phone: '+44 7700 900123' },
  { id: '3', firstName: 'Rivka', phone: '+972 54 412 3456' },
  { id: '4', firstName: 'Chaim', phone: '0161 531 1386', altPhone: '07871 385566' },
]

test('a UK number matches however either side wrote it', () => {
  // The shop stores 07911…, Twilio delivers +447911… — they agree from the right.
  assert.equal(matchCustomerByPhone('+447911123456', CUSTOMERS)?.id, '1')
  assert.equal(matchCustomerByPhone('07911123456', CUSTOMERS)?.id, '1')
  assert.equal(matchCustomerByPhone('+44 7700 900 123', CUSTOMERS)?.id, '2')
})

test('an international number matches too', () => {
  assert.equal(matchCustomerByPhone('+972544123456', CUSTOMERS)?.id, '3')
})

test('the second number on a record is matched as well', () => {
  assert.equal(matchCustomerByPhone('+447871385566', CUSTOMERS)?.id, '4')
})

test('no match, and an ambiguous match, both return null rather than a guess', () => {
  assert.equal(matchCustomerByPhone('+447000000000', CUSTOMERS), null)
  assert.equal(matchCustomerByPhone('', CUSTOMERS), null)
  assert.equal(matchCustomerByPhone('12345', CUSTOMERS), null)
  // Two customers sharing a tail: filing it against either would be a coin toss.
  const twins = [{ id: 'a', phone: '07911123456' }, { id: 'b', phone: '+447911123456' }]
  assert.equal(matchCustomerByPhone('+447911123456', twins), null)
})

test('the log row keeps the customer on the OTHER-party column, either direction', () => {
  const row = inboundLogRow({
    from: '+447911123456', to: '+441615311386', body: 'Yes that is fine, thanks',
    messageSid: 'SM123', customerId: '6e19b0a3-6f24-4b7e-9c1d-2a8f5b7c4d3e',
  })
  assert.equal(row.kind, 'sms_in')
  assert.equal(row.to_email, '+447911123456')   // the customer, as on outbound rows
  assert.equal(row.actual_to, '+441615311386')  // our own number
  assert.equal(row.subject, 'Yes that is fine, thanks')
  assert.equal(row.status, 'received')
  assert.equal(row.provider, 'twilio')
  assert.equal(row.customer_id, '6e19b0a3-6f24-4b7e-9c1d-2a8f5b7c4d3e')
})

test('a wrong-shaped customer id is dropped, never allowed to sink the insert', () => {
  // The first real reply (18 Aug) was lost exactly this way: a legacy_id went
  // into the uuid column, Postgres 400ed, and the message died with it.
  const row = inboundLogRow({
    from: '+447911123456', to: '+441615311386', body: 'hello',
    messageSid: 'SM124', customerId: '1785069385818',
  })
  assert.equal(row.customer_id, null)   // filed unmatched, but FILED
  assert.equal(row.status, 'received')  // the message itself is untouched
})

test('an opt-out is logged as one, so nobody wonders why the texts stopped', () => {
  const row = inboundLogRow({ from: '+447911123456', to: '+441615311386', body: 'STOP', messageSid: 'SM9' })
  assert.equal(row.status, 'opt_out')
  assert.equal(row.customer_id, null)
})

test('a long message is stored to the same 160 the outbound rows use', () => {
  const row = inboundLogRow({ from: '+1', to: '+2', body: 'x'.repeat(400), messageSid: 'SM1' })
  assert.equal(row.subject.length, 160)
})

test('the one-line summary names the person when we know them', () => {
  assert.equal(
    inboundSummary({ from: '+447911123456', body: 'on my way', customerName: 'Menachem Adler' }),
    'Menachem Adler: on my way',
  )
  assert.equal(inboundSummary({ from: '+447911123456', body: 'on my way' }), '+447911123456: on my way')
  assert.match(inboundSummary({ from: '+44', body: 'STOP', customerName: 'Yossi' }), /asked to stop/)
  assert.match(inboundSummary({ from: '+44', body: 'y'.repeat(200) }), /…$/)
})

// ── replying to one of these (owner item 21, 19 Aug) ─────────────────────
// "the reply in SMS in settings isnt doing anything" — there was no reply
// control at all. These hold the decision the reply endpoint makes, which is
// the half that must not quietly change: WHO a reply may go to.
test('a reply goes to the number that texted us, taken from the row', () => {
  const t = replyTarget({
    provider: 'twilio', kind: 'sms_in', status: 'received',
    to_email: '+447700900123', subject: 'is my phone ready?',
    customer_id: '11111111-2222-3333-4444-555555555555',
  })
  assert.equal(t.error, undefined)
  assert.equal(t.phone, '+447700900123')
  assert.equal(t.customerId, '11111111-2222-3333-4444-555555555555')
  assert.equal(t.original, 'is my phone ready?')
})

test('somebody who texted STOP is never replied to', () => {
  const t = replyTarget({
    provider: 'twilio', kind: 'sms_in', status: 'opt_out',
    to_email: '+447700900123', subject: 'STOP',
  })
  assert.match(t.error, /STOP/)
  assert.equal(t.phone, undefined)
})

test('only an inbound TEXT can be replied to — not our own sends, not email', () => {
  const outbound = replyTarget({ provider: 'twilio', kind: 'sms', status: 'sent', to_email: '+447700900123' })
  assert.match(outbound.error, /came in/)
  const email = replyTarget({ provider: 'resend', kind: 'receipt', status: 'sent', to_email: 'a@b.com' })
  assert.match(email.error, /came in/)
  const missing = replyTarget(null)
  assert.match(missing.error, /no longer in the log/)
})

test('a row with no number to answer says so instead of sending nowhere', () => {
  const t = replyTarget({ provider: 'twilio', kind: 'sms_in', status: 'received', to_email: '' })
  assert.match(t.error, /no number/)
})

test('an unmatched inbound text can still be answered — the person is unknown, the number is not', () => {
  const t = replyTarget({
    provider: 'twilio', kind: 'sms_in', status: 'received',
    to_email: '+447700900999', subject: 'hello', customer_id: null,
  })
  assert.equal(t.phone, '+447700900999')
  assert.equal(t.customerId, null)
  // A legacy id must never reach the uuid column — the fault that lost the
  // very first real reply, and it would be the same fault on the way out.
  const legacy = replyTarget({
    provider: 'twilio', kind: 'sms_in', status: 'received',
    to_email: '+447700900999', customer_id: '1785069385818',
  })
  assert.equal(legacy.customerId, null)
})

// ── A conversation, not a pile of messages ────────────────────────────────
// Owner, 28 Aug: "even after a reply the waiting tag remains!"
//
// Production, +447511075011:
//   27 Aug 21:59  "Hello"  no reply
//   28 Aug 08:07  "?"      replied to, sent, delivered
//
// The screen flagged that thread Waiting because ONE message was unanswered,
// while the reply box deliberately answers the NEWEST. So the newest was
// already answered, pressing Send again only re-answered it, and the tag could
// never come off — the app flagging a state its own controls could not clear.
test('a conversation waits on its newest text, not its oldest', () => {
  const inbounds = [
    { id: 'hello', kind: 'sms_in', status: 'received', at: '2026-08-27T21:59:59Z', to: '+447511075011' },
    { id: 'qmark', kind: 'sms_in', status: 'received', at: '2026-08-28T08:07:19Z', to: '+447511075011' },
  ]
  const replies = [{ repliesTo: 'qmark', status: 'sent', deliveryStatus: 'delivered' }]
  // Per message the old "Hello" is still unanswered, and that stays true —
  // the bubble in the thread reads it to mark itself.
  assert.deepEqual(unanswered(inbounds, replies).map((r) => r.id), ['hello'])
  // Per conversation, nobody is waiting: their latest message was answered.
  assert.deepEqual(unansweredThreads(inbounds, replies).map((r) => r.id), [])
})

test('answering an older text does not clear a newer one', () => {
  // The mirror of the case above, and the one that must NOT be lost: answering
  // yesterday's question while today's sits unread is still somebody waiting.
  const inbounds = [
    { id: 'old', kind: 'sms_in', status: 'received', at: '2026-08-27T21:59:59Z', to: '+447511075011' },
    { id: 'new', kind: 'sms_in', status: 'received', at: '2026-08-28T08:07:19Z', to: '+447511075011' },
  ]
  const replies = [{ repliesTo: 'old', status: 'sent', deliveryStatus: 'delivered' }]
  assert.deepEqual(unansweredThreads(inbounds, replies).map((r) => r.id), ['new'])
})

test('one number is one conversation, however the number is written', () => {
  const inbounds = [
    { id: 'a', kind: 'sms_in', status: 'received', at: '2026-08-28T09:00:00Z', to: '+447511075011' },
    { id: 'b', kind: 'sms_in', status: 'received', at: '2026-08-28T10:00:00Z', to: '07511075011' },
    { id: 'c', kind: 'sms_in', status: 'received', at: '2026-08-28T11:00:00Z', to: '44 7511 075011' },
  ]
  // All one thread, so only the newest is asked about.
  assert.deepEqual(unansweredThreads(inbounds, []).map((r) => r.id), ['c'])
  assert.equal(threadKey('+447511075011'), threadKey('07511075011'))
  assert.equal(threadKey('44 7511 075011'), threadKey('+447511075011'))
})

test('a row with no number is dropped rather than lumped in with the others', () => {
  const inbounds = [
    { id: 'nowhere', kind: 'sms_in', status: 'received', at: '2026-08-28T09:00:00Z', to: '' },
    { id: 'alsonowhere', kind: 'sms_in', status: 'received', at: '2026-08-28T10:00:00Z', to: null },
    { id: 'real', kind: 'sms_in', status: 'received', at: '2026-08-28T09:30:00Z', to: '+447511075011' },
  ]
  // An empty key is not a person, and two of them are not one conversation.
  assert.deepEqual(unansweredThreads(inbounds, []).map((r) => r.id), ['real'])
})

test('the queue is oldest first — the longest ignored comes first', () => {
  const inbounds = [
    { id: 'newer', kind: 'sms_in', status: 'received', at: '2026-08-28T10:00:00Z', to: '+447700900001' },
    { id: 'older', kind: 'sms_in', status: 'received', at: '2026-08-25T10:00:00Z', to: '+447700900002' },
  ]
  assert.deepEqual(unansweredThreads(inbounds, []).map((r) => r.id), ['older', 'newer'])
})

// ── "Seen it, nothing needed" ─────────────────────────────────────────────
// Owner, 28 Aug: "an option to ignore and not come up as waiting anymore."
test('a text marked seen leaves the queue without a reply', () => {
  const row = { id: 's', kind: 'sms_in', status: 'received', at: '2026-08-28T09:00:00Z', to: '+447511075011' }
  assert.equal(needsAnswer(row), true)
  assert.deepEqual(unansweredThreads([row], []).map((r) => r.id), ['s'])
  const seen = { ...row, status: 'seen' }
  assert.equal(needsAnswer(seen), false)
  assert.deepEqual(unansweredThreads([seen], []).map((r) => r.id), [])
  assert.deepEqual(unanswered([seen], []).map((r) => r.id), [])
})

test('seen is set by a person and never inferred', () => {
  // The safeguard that keeps the queue honest: no age, no sweep, no heuristic
  // may empty it — only a button. Asserted on the source because it is a rule
  // about who writes, not about what a function returns.
  const api = readFileSync(new URL('../pages/api/message-log.js', import.meta.url), 'utf8')
  assert.match(api, /op !== 'seen'/, 'the write path no longer names the one action it accepts')
  // Only an unanswered inbound may be marked — a STOP is already out, an
  // outbound was never in, and marking one twice must change nothing.
  assert.match(api, /kind=eq\.sms_in&status=eq\.received/,
    'the update no longer restricts itself to unanswered inbound texts')
  const sweep = readFileSync(new URL('../pages/api/cron/sweep.js', import.meta.url), 'utf8')
  assert.doesNotMatch(sweep, /status:\s*'seen'/, 'the nightly sweep is marking texts seen by itself')
})
