// Texts waiting for an answer.
//
// The reply box shipped on 19 August; nothing counted the questions nobody had
// answered, and the message log only loads when somebody opens Settings and
// presses a button. Three real replies arrived on 18 August and the app looked
// perfectly calm throughout.
//
// The rule that carries the weight: AN ANSWER IS A MESSAGE THAT REACHED THEM.
// SMS is HOLD-gated today, so pressing Reply builds a message and sends
// nothing. If that emptied the queue, the feature would do the opposite of its
// job — it would tell the shop everybody had been answered on the one
// configuration where nobody had.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  needsAnswer, isAnswered, unanswered, replyOutcome, waitingSentence, DELIVERED, TRACKING_FROM,
} from '../lib/replyQueue.mjs'

// Dated after the link column existed — before it, an answered question and an
// ignored one are indistinguishable, and the queue says nothing about either.
const inbound = (id, over = {}) => ({ id, kind: 'sms_in', status: 'received', at: '2026-08-20T10:00:00Z', ...over })

test('only a delivered reply answers a question', () => {
  const q = inbound('q1')
  // Every outcome sendSms can record, against the same question.
  assert.equal(isAnswered(q, [{ repliesTo: 'q1', status: 'sent' }]), true)
  for (const status of ['held', 'redirected', 'invalid', 'failed']) {
    assert.equal(isAnswered(q, [{ repliesTo: 'q1', status }]), false,
      `a ${status} reply never reached the customer — they are still waiting`)
  }
  // And the set is stated once, so this cannot drift from the module.
  assert.deepEqual([...DELIVERED], ['sent'])
})

test('a reply to a DIFFERENT message does not answer this one', () => {
  // The whole reason the link exists: before it, "some text went to that number
  // afterwards" was the only available rule, and a renewal reminder would have
  // marked a customer's question answered.
  const q = inbound('q1')
  assert.equal(isAnswered(q, [{ repliesTo: 'q2', status: 'sent' }]), false)
})

test('STOP is not a question', () => {
  // Twilio handles the opt-out itself, and texting back to acknowledge it would
  // be a message to somebody who has just asked for no more messages.
  assert.equal(needsAnswer(inbound('s', { status: 'opt_out' })), false)
  assert.equal(needsAnswer(inbound('r')), true)
})

test('outbound messages are not questions, whatever their status', () => {
  assert.equal(needsAnswer({ id: 'o', kind: 'sms', status: 'sent' }), false)
  assert.equal(needsAnswer({ id: 'e', kind: 'renewal', status: 'sent' }), false)
  assert.equal(needsAnswer(null), false)
  assert.equal(needsAnswer(undefined), false)
})

test('an unrecognised inbound status is not silently treated as answerable', () => {
  // Guessing about a shape this module has not been taught is the same
  // overconfidence it exists to refuse.
  assert.equal(needsAnswer(inbound('x', { status: 'queued' })), false)
})

test('the queue is oldest first — the one ignored longest is the point', () => {
  const rows = [
    inbound('new', { at: '2026-08-22T09:00:00Z' }),
    inbound('old', { at: '2026-08-20T09:00:00Z' }),
    inbound('mid', { at: '2026-08-21T09:00:00Z' }),
  ]
  assert.deepEqual(unanswered(rows, []).map((r) => r.id), ['old', 'mid', 'new'])
})

test('a held reply leaves the message in the queue', () => {
  const rows = [inbound('q1'), inbound('q2')]
  const replies = [{ repliesTo: 'q1', status: 'held' }, { repliesTo: 'q2', status: 'sent' }]
  assert.deepEqual(unanswered(rows, replies).map((r) => r.id), ['q1'],
    'the one the gate held is still unanswered; the one that sent is not')
})

test('the sentence counts and reads', () => {
  assert.equal(waitingSentence([]), '')
  assert.equal(waitingSentence([1]), '1 text is waiting for an answer')
  assert.equal(waitingSentence([1, 2]), '2 texts are waiting for an answer')
})

test('a held reply is not reported as sent', () => {
  // The toast and the count have to agree. If the toast says "sent" and the
  // dashboard still says one is waiting, the count reads as a bug and gets
  // removed — so the words say the customer is still waiting.
  const held = replyOutcome({ status: 'held' })
  assert.equal(held.answered, false)
  assert.match(held.text, /still waiting/i)
  assert.doesNotMatch(held.text, /^Sent\b/)
  const redirected = replyOutcome({ status: 'redirected' })
  assert.equal(redirected.answered, false)
  assert.match(redirected.text, /still waiting/i)
  assert.equal(replyOutcome({ status: 'sent' }).answered, true)
})

// ── the wiring, which lives in three files and only fails as a set ─────────

const SMS = readFileSync(new URL('../lib/sms.js', import.meta.url), 'utf8')
const API = readFileSync(new URL('../pages/api/sms.js', import.meta.url), 'utf8')
const LOG = readFileSync(new URL('../pages/api/message-log.js', import.meta.url), 'utf8')
const MAIN = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')

test('the reply link is recorded on every outcome, failures included', () => {
  // Recorded only on success, a held reply would leave no trace of the attempt
  // and the queue could never show "tried, did not go".
  assert.match(SMS, /repliesTo = null/, 'sendSms must accept the link')
  assert.match(SMS, /\.\.\.\(repliesTo \? \{ replies_to: repliesTo \} : \{\}\)/,
    'the link belongs on `base`, which every logSend spreads — not on one branch')
})

test('the endpoint records the id it verified, not the one it was sent', () => {
  assert.match(API, /repliesTo = src\.id/,
    'a reply must be linked to the row the lookup actually checked')
  assert.ok(!/repliesTo: b\.replyTo/.test(API),
    'the browser-supplied id must not go straight into a foreign key')
})

test('the count is taken over the whole log, not the page on screen', () => {
  // The log reads newest-first with a limit, so an answer and its question can
  // land on different pages. Counting what is on screen would report an
  // answered question as waiting.
  assert.match(LOG, /kind=eq\.sms_in&limit=2000/,
    'the waiting count must not be limited to the rows being displayed')
  assert.match(LOG, /countOnly/, 'the dashboard needs a count without the entries')
})

test('the dashboard row exists, is urgent, and leads somewhere that loads', () => {
  assert.match(MAIN, /f\.smsWaiting/, 'the dashboard must read the waiting count')
  assert.match(MAIN, /do: 'messages\.waiting'/)
  // The guarantee, unchanged through two rewrites of how it is met: the row
  // must land somewhere the waiting texts are actually ON SCREEN. It used to
  // have to load the Settings log by hand, or you arrived at "press Load the
  // log" — a button that promised to show you something and asked you to press
  // another. Now it opens the inbox, which loads itself, narrowed to the ones
  // waiting so the screen you land on is the list the row was counting.
  const act = MAIN.match(/'messages\.waiting':\s*(?:\(\) =>\s*)?\{[\s\S]*?\n  \},/)
  assert.ok(act, 'the messages.waiting action is missing')
  assert.match(act[0], /'messages'/, 'the row must land on the inbox')
  assert.match(act[0], /msgFilter = 'waiting'/,
    'and narrowed to the ones waiting — that is what the row counted')
  const row = MAIN.match(/if \(f\.smsWaiting\)[^;]*;/)
  assert.ok(row, 'the row is missing')
  assert.match(row[0], /tone: 'urgent'/, 'a person waiting on an answer is urgent')
})

test('the palette reaches the inbox by the words somebody would type', () => {
  // From 25 Aug the command palette is the app's front door, so a job it cannot
  // reach is a job that is hidden. This one was: Ctrl+K for "text", "sms" or
  // "reply" returned nothing, and the only route was knowing that inbound texts
  // lived in Settings, eleventh card down, behind a button that loads them.
  // They have a screen of their own now; the aliases still matter, because
  // none of the words people use for this job is the word on the tab.
  const cmd = MAIN.match(/\{[^{}]*label: 'Answer a text a customer sent'[\s\S]*?\n  \},/)
  assert.ok(cmd, 'the palette needs an entry for answering a text')
  for (const word of ['text', 'sms', 'reply', 'inbox', 'message']) {
    assert.ok(cmd[0].includes(`'${word}`) || cmd[0].includes(word),
      `the palette entry must match "${word}" — it is what the job is called`)
  }
  assert.match(cmd[0], /tab: 'messages'/,
    'gate it on the screen it opens, so it hides from anyone who could not open it')
  assert.match(cmd[0], /goToTab\('messages'\)/, 'it must open the inbox, like the dashboard row')
})

test('the inbox never draws a held reply as delivered', () => {
  // A chat bubble is the most convincing "it was sent" a UI can draw, and a
  // reply the safety gate held reached nobody. If this screen ever lets one
  // look delivered, somebody closes it believing a customer was answered —
  // which is worse than the Settings log this replaced, because that one at
  // least printed the status in a column.
  const fn = MAIN.match(/function openThread\(key\) \{[\s\S]*?\n\}/)
  assert.ok(fn, 'openThread is missing')
  assert.match(fn[0], /const undelivered = mine && !\['sent', 'delivered'\]\.includes\(m\.status\)/,
    'an outbound bubble must decide delivery from the status, not assume it')
  assert.match(fn[0], /not delivered/, 'and say so on the bubble, in words')
})

test('there is one composer, and the log points at it', () => {
  // Two ways to answer the same text is the complication the owner asked to be
  // rid of. The Settings log keeps its Reply button — it is the audit trail and
  // people land there — but it hands off rather than opening a second box.
  const fn = MAIN.match(/function msgLogReply\(id\) \{[\s\S]*?\n\}/)
  assert.ok(fn, 'msgLogReply is missing')
  assert.match(fn[0], /openThread\(/, 'the log must hand off to the conversation')
  assert.doesNotMatch(fn[0], /showDynamicModal/, 'it must not open a composer of its own')
  assert.equal(MAIN.match(/id="smsReplyText"/g)?.length, 1,
    'the reply box must exist in exactly one place')
})

test('the pulse never interrupts a reply being typed, and never replays', () => {
  const fn = MAIN.match(/async function kcTextPulse\(\) \{[\s\S]*?\n\}/)
  assert.ok(fn, 'kcTextPulse is missing')
  // Three things this must never do, each of which turns a useful pop-up into
  // a reason to stop trusting them.
  assert.match(fn[0], /document\.hidden/, 'a parked tab must not poll')
  assert.match(fn[0], /before === null/,
    'the first answer sets the watermark and says nothing — texts already waiting at sign-in are the list\'s job')
  assert.match(fn[0], /!kcDialogOpen\(\)/,
    'never repaint under a dialog: the reply box IS a dialog, and it holds typing')
  assert.match(fn[0], /status === 403/,
    'stop polling for an account that may not read them, rather than 403 once a minute all shift')
})

test('the reply toasts agree with the count', () => {
  const fn = MAIN.match(/async function sendSmsReply\(id\) \{[\s\S]*?\n\}/)
  assert.ok(fn, 'sendSmsReply is missing')
  const held = fn[0].match(/if \(j\.held\) toast\((.*?)\);/)
  assert.ok(held, 'the held branch is missing')
  assert.match(held[1], /still waiting/i,
    'a held reply must say the customer is still waiting, or the count looks broken')
})

test('messages from before the link existed are not counted as ignored', () => {
  // The three real inbound texts of 18 August were all answered, but replies
  // were not linked to questions until 19 August — so nothing points at them.
  // Counting them would have launched this queue by announcing three customers
  // had been ignored when none had, which is both wrong and the fastest way to
  // get a count switched off.
  const before = { id: 'aug18', kind: 'sms_in', status: 'received', at: '2026-08-18T19:33:53Z' }
  assert.equal(needsAnswer(before), false)
  assert.deepEqual(unanswered([before], []), [])

  // Anything the app could actually track still counts.
  const after = { id: 'later', kind: 'sms_in', status: 'received', at: '2026-08-20T09:00:00Z' }
  assert.equal(needsAnswer(after), true)
  assert.deepEqual(unanswered([after], []).map((r) => r.id), ['later'])

  // A row with no date is unknowable, and unknowable is not waiting.
  assert.equal(needsAnswer({ id: 'u', kind: 'sms_in', status: 'received' }), false)
  assert.equal(needsAnswer({ id: 'u2', kind: 'sms_in', status: 'received', at: '' }), false)
})

test('the cutoff is the migration that added the link, not an arbitrary date', () => {
  // If these drift apart the queue either misses real messages or resurrects
  // the untrackable ones. Stated so the pair has to be changed together.
  assert.equal(TRACKING_FROM, '2026-08-19T14:00:00.000Z')
  const migration = readFileSync(
    new URL('../supabase/migrations/20260819140000_sms_reply_link.sql', import.meta.url), 'utf8')
  assert.match(migration, /replies_to/, 'the migration this date refers to must exist')
})
