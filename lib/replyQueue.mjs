// Which inbound texts are still waiting for an answer. Pure — no I/O.
//
// The reply box shipped on 19 August and the message log shows inbound texts,
// but nothing COUNTED the ones nobody had answered, and the log only loads when
// somebody opens Settings and presses a button. So a customer's question could
// sit unread indefinitely and the app would look perfectly calm. This is the
// count that makes it visible.
//
// Two decisions live here, and both are about refusing to look tidier than the
// shop actually is.
//
// 1. AN ANSWER IS A MESSAGE THAT REACHED THEM.
//
//    sendSms records five outcomes: sent, redirected, held, invalid, failed.
//    Only `sent` reached the customer. `held` is the safety gate holding a
//    message while live SMS is off — the shop pressed Reply and nothing left
//    the building. `redirected` went to the shop's own handset in test mode.
//    Counting either as an answer would empty this queue for messages the
//    customer has never seen, which is the failure that matters: the queue
//    exists to stop somebody being ignored, and a false "all clear" is worse
//    than no count at all.
//
// 2. "STOP" IS NOT A QUESTION.
//
//    An opt-out is handled by Twilio before the app sees it, and texting back
//    to acknowledge it would be both pointless and, to someone who has just
//    asked to be left alone, rude. Those rows are not in the queue.

/** Statuses that mean the app handed the message to the provider. */
export const DELIVERED = new Set(['sent'])

/**
 * Delivery results that mean it did NOT reach them, whatever we did.
 *
 * `status` is our side of the story — Twilio accepted this — and it is set the
 * instant the API returns a SID. `delivery_status` is the carrier's side, and
 * it arrives seconds later on the /api/sms-status callback. Until 25 Aug this
 * module only ever read ours: a reply the handset never received still cleared
 * the customer off the waiting queue, the red count went down, the dashboard
 * row went quiet, and nobody chased. Found by sending the first real live text
 * and reading back what the carrier said about it.
 *
 * Only an EXPLICIT failure demotes a reply. A null delivery result means the
 * callback has not arrived yet — or that delivery tracking is off entirely,
 * with no PUBLIC_BASE_URL set — and treating "not yet known" as "did not
 * arrive" would leave every reply in the queue for ever on a shop whose
 * tracking is not wired up. Demote on evidence, never on silence.
 */
export const UNDELIVERED = new Set(['undelivered', 'failed'])

/**
 * When the app started recording WHICH message a reply answered.
 *
 * Before the `replies_to` column existed (migration 20260819140000) a reply was
 * logged as an ordinary outbound text with no link back, so for anything older
 * there is simply no way to tell an answered question from an ignored one.
 *
 * Those older messages are left out rather than counted. The three inbound
 * texts from 18 August were all answered — but nothing points at them, so
 * counting them would have opened this feature by announcing three customers
 * had been ignored when none had. A queue that cries wolf on its first morning
 * is a queue somebody turns off, and it would have been wrong as well as loud.
 *
 * The alternative was to guess the links from "some text went to that number
 * afterwards", which is the same weak rule this whole design exists to avoid.
 */
export const TRACKING_FROM = '2026-08-19T14:00:00.000Z'

/** An inbound row worth answering at all. */
export function needsAnswer(row) {
  if (!row || row.kind !== 'sms_in') return false
  // 'received' is the ordinary inbound. 'opt_out' is a STOP and is not a
  // question; anything else is a shape this module has not been taught, and
  // guessing about it would be the same overconfidence the module refuses.
  //
  // 'seen' is the third real state, added 28 Aug on the owner's ask: "an option
  // to ignore and not come up as waiting anymore. like ive seen it, ok, nothing
  // needed." It is set ONLY by a person pressing a button — never inferred,
  // never by age, never by a sweep. That is the whole safeguard: the queue may
  // be emptied by a human deciding, and by nothing else. It falls through the
  // test below like every other non-'received' status, and is named here so a
  // reader knows it is a state and not an accident.
  if (row.status !== 'received') return false
  // Undated is unknowable, and unknowable is not the same as waiting. A missing
  // date becomes '', which sorts below every real timestamp, so the one
  // comparison excludes it too — no separate check, and none that a test could
  // tell apart from this one.
  return String(row.at || '') >= TRACKING_FROM
}

/**
 * Was this inbound message answered?
 *
 * `replies` is every outbound row that names it via `repliesTo`. An answer
 * counts only if it was delivered — see the note above.
 */
export function isAnswered(inbound, replies = []) {
  if (!inbound) return false
  const id = String(inbound.id)
  return (replies || []).some((r) =>
    r && String(r.repliesTo) === id
    && DELIVERED.has(String(r.status))
    && !UNDELIVERED.has(String(r.deliveryStatus || '')))
}

/**
 * The queue: inbound messages still waiting, oldest first.
 *
 * Oldest first because that is the order they should be dealt with, and
 * because the oldest is the one that has been ignored longest — which is the
 * whole reason to show a number at all.
 */
export function unanswered(inbounds = [], replies = []) {
  return (inbounds || [])
    .filter((row) => needsAnswer(row) && !isAnswered(row, replies))
    .sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')))
}

/**
 * How a reply attempt should be reported back to the person who pressed send.
 *
 * Separated from the sending so the words are testable and the same in every
 * caller. A held reply is deliberately NOT called sent, and the sentence says
 * what to do about it rather than only what happened.
 */
export function replyOutcome({ status } = {}) {
  switch (String(status)) {
    case 'sent':
      return { answered: true, tone: 'success', text: 'Sent.' }
    case 'redirected':
      return {
        answered: false, tone: 'info',
        text: 'Test mode — that went to the shop’s own handset, not to them. They are still waiting.',
      }
    case 'held':
      return {
        answered: false, tone: 'info',
        text: 'Written and logged, but live texting is off — nothing was sent. They are still waiting.',
      }
    case 'invalid':
      return { answered: false, tone: 'error', text: 'That number cannot receive texts.' }
    default:
      return { answered: false, tone: 'error', text: 'The message did not go — it is still waiting.' }
  }
}

/** The dashboard line. Empty string when there is nothing waiting. */
export function waitingSentence(rows = []) {
  const n = rows.length
  if (!n) return ''
  return `${n} ${n === 1 ? 'text is' : 'texts are'} waiting for an answer`
}

// ── A CONVERSATION, not a pile of messages ────────────────────────────────
//
// Owner, 28 Aug: "even after a reply the waiting tag remains!"
//
// He was right and the app could not be argued with. On +447511075011:
//
//   27 Aug 21:59  "Hello"   no reply
//   28 Aug 08:07  "?"       replied to, sent, delivered
//
// The Messages screen flagged that thread Waiting because ONE of its messages
// was unanswered — `t.waiting = t.msgs.some(m => m.awaitingAnswer)`. But the
// reply box answers the NEWEST inbound, deliberately and by its own comment:
// "that is the message still on their screen". So the newest was already
// answered, pressing Send again only re-answered it, and the tag could never
// come off. THE APP FLAGGED A STATE ITS OWN CONTROLS COULD NOT CLEAR, which is
// worse than a wrong count: it is a to-do list with an item nobody can tick.
//
// So a conversation is waiting when its NEWEST inbound is unanswered — the same
// rule the reply box already follows. Answering the latest message is what
// answering somebody means in a conversation; the earlier ones stay visible in
// the thread, they simply stop being a summons.
//
// `unanswered` (above) is untouched and still answers "which MESSAGES are
// unanswered" — the bubble in the thread reads it to mark itself. This is the
// other question, "who is waiting on me", and it is the one the count and the
// tag are asking.

/**
 * Last ten digits — the same key the Messages screen groups threads on.
 *
 * UK numbers reach the shop written half a dozen ways (+447700900321,
 * 07700900321, 44 7700 900321) and a conversation that splits on formatting is
 * not a conversation.
 */
export function threadKey(n) {
  return String(n || '').replace(/\D/g, '').slice(-10)
}

/**
 * The conversations still waiting, oldest first.
 *
 * One entry per number: its newest inbound, and only when that one is both
 * worth answering and unanswered. A number whose newest message has been
 * answered is not waiting, however many older ones went unanswered.
 *
 * Rows with no usable number are dropped rather than lumped together — an
 * empty key is not a person.
 */
export function unansweredThreads(inbounds = [], replies = []) {
  const newest = new Map()
  for (const row of inbounds || []) {
    if (!row) continue
    const key = threadKey(row.to)
    if (!key) continue
    const held = newest.get(key)
    // Ties broken on id so the answer is stable rather than insertion-ordered:
    // two texts can share a timestamp, and a count that changes when nothing
    // did is a count nobody trusts.
    const at = String(row.at || '')
    if (!held || at > String(held.at || '') ||
        (at === String(held.at || '') && String(row.id) > String(held.id))) {
      newest.set(key, row)
    }
  }
  return [...newest.values()]
    .filter((row) => needsAnswer(row) && !isAnswered(row, replies))
    .sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')))
}
