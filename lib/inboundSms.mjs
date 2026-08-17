// A customer texts back. Pure helpers for the endpoint that receives it.
//
// Two-way SMS only works from a real phone number — an alphanumeric sender ID
// like "KosherCnct" is a display name, and there is nothing for a handset to
// reply to. So this exists for the number the shop is buying (owner, 17 Aug:
// "Shloime DOES rather want to buy a Twilio number for reply ability").
//
// It is deliberately built BEFORE the number: a reply that arrives with no
// endpoint to receive it is gone — Twilio does not retry an inbound webhook the
// way it retries a status callback. Better the endpoint waits for the number
// than the other way round.

import { phoneDigits } from './phoneNumber.mjs'

/**
 * The words a carrier and the law treat as "stop texting me".
 *
 * Twilio's Messaging Service handles these itself — it will refuse further
 * sends to that number, which is the enforcement. Our job is to make the
 * opt-out VISIBLE, so nobody at the counter wonders why a customer stopped
 * getting reminders, and so a person can ring them instead if it matters.
 *
 * Matched on the whole message, case- and punctuation-insensitive: "STOP" is
 * an opt-out, "stop sending me the £20 one" is a sentence.
 */
const STOP_WORDS = new Set(['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit', 'revoke', 'optout'])
const START_WORDS = new Set(['start', 'yes', 'unstop'])

const oneWord = (body) => String(body ?? '').toLowerCase().replace(/[^a-z]/g, '')

export function isStopKeyword(body) {
  return STOP_WORDS.has(oneWord(body))
}

/** The opposite — "START" puts them back on. Twilio honours these too. */
export function isStartKeyword(body) {
  return START_WORDS.has(oneWord(body))
}

/**
 * Which customer sent this?
 *
 * Compared on the last 9 digits, not the whole string: the shop stores
 * "07911 123456" and Twilio delivers "+447911123456", and those agree only
 * from the right-hand end. 9 rather than 10 because a UK national number
 * drops its leading 0 when it takes the +44 — the shared tail is 911123456.
 *
 * Returns null rather than a guess when nothing matches or when TWO customers
 * share the tail: a reply filed against the wrong person is worse than a reply
 * filed against nobody, because the second is obvious and the first is not.
 */
export function matchCustomerByPhone(from, customers = []) {
  const tail = phoneDigits(from).slice(-9)
  if (tail.length < 9) return null
  const hits = customers.filter(c => {
    const own = phoneDigits(c.phone || c.phone_number || '').slice(-9)
    const alt = phoneDigits(c.altPhone || '').slice(-9)
    return (own.length === 9 && own === tail) || (alt.length === 9 && alt === tail)
  })
  return hits.length === 1 ? hits[0] : null
}

/**
 * What to write to the message log for one inbound message.
 *
 * The same table as everything else the shop sends, so there is ONE place to
 * see a conversation rather than an inbox per direction. `to_email` holds the
 * OTHER party either way — the customer — so a thread reads down the column.
 */
export function inboundLogRow({ from, to, body, messageSid, customerId = null }) {
  const stop = isStopKeyword(body)
  return {
    provider: 'twilio',
    kind: 'sms_in',
    to_email: String(from || ''),
    actual_to: String(to || ''),
    // Same field the outbound rows use for the message text.
    subject: String(body ?? '').slice(0, 160),
    status: stop ? 'opt_out' : 'received',
    provider_id: String(messageSid || ''),
    customer_id: customerId || null,
  }
}

/** One line for a person: who texted, what it said, and whether it needs them. */
export function inboundSummary({ from, body, customerName = null }) {
  const who = customerName || from || 'an unknown number'
  if (isStopKeyword(body)) return `${who} asked to stop receiving texts.`
  const text = String(body ?? '').trim()
  return `${who}: ${text.length > 80 ? text.slice(0, 77) + '…' : text}`
}
