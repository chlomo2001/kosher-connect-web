// What to say back — drafted, never sent.
//
// Owner, 27 Aug, item 8: an auto-suggested reply draft on an inbound text.
//
// The obvious build is a keyword matcher over what they wrote. Production says
// that would fire on almost nothing. Every inbound text the shop has ever had
// (28 Aug, all of them): "?", "Hello", "K", "Ok..", one referral spam sent
// twice, and one real question — "Hi there, any qlyx phones available?". Five
// of seven carry no answerable content at all.
//
// So the suggestions are led by CONTEXT and only steered by the words. What a
// person at the counter would actually say to somebody who texts "?" comes from
// that person's record — the phone that was due back on Sunday, the £87 still
// open, the repair sitting on the shelf — not from the question mark. The text
// is read too, and when it does say something (a price, availability, an
// extension, a plain thank-you) that answer is offered first.
//
// Every draft is a DRAFT. It lands in the reply box for a person to read,
// change and send; nothing here reaches a customer by itself.
//
// Straight quotes, hyphens, no em dash — the same GSM-7 discipline as
// lib/autoSms.mjs and lib/rentalReceipt.mjs, because a suggestion is sent as
// often as it is offered and one curly character doubles the bill.
//
// No sign-off. These are replies inside a conversation the customer opened,
// where "- the Kosher Connect team" under every line reads like a robot. The
// receipt signs itself because it is a document; a reply is talk.

/** The words, lowercased and stripped of punctuation that gets in the way. */
function words(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9£+\s]/g, ' ')
}

/** Did they ask about one of the things the shop is asked about? */
export function readIntent(text) {
  const w = words(text)
  if (!w.trim()) return 'none'
  // Order matters: a text can hold two of these, and the more specific one is
  // the one worth answering. "how much to extend" is an extension, not a price
  // list.
  if (/\b(extend|longer|another week|another day|keep it|more days)\b/.test(w)) return 'extend'
  if (/\b(availab|in stock|got any|do you have|any left|spare)\w*/.test(w)) return 'availability'
  if (/\b(how much|price|prices|cost|costs|rate|rates|charge)\b/.test(w)) return 'price'
  if (/\b(open|opening|closed|closing|what time|hours)\b/.test(w)) return 'hours'
  if (/\b(paid|payment|pay|transfer|bank|card)\b/.test(w)) return 'payment'
  if (/\b(ready|collect|pick ?up|repaired|fixed)\b/.test(w)) return 'collect'
  // A bare acknowledgement. This is the commonest inbound text there is, and
  // the right reply is short and ends the exchange.
  if (/^\s*(ok|okay|k|kk|thanks|thank you|thx|ta|great|perfect|lovely|got it|sure|yes|no)\s*$/.test(w)) return 'ack'
  return 'other'
}

/**
 * Suggested replies, best first.
 *
 * `ctx` is the customer's situation, already worked out by the caller — this
 * module does no lookups and holds no prices. Each field is optional; a
 * suggestion whose facts are missing is simply not offered.
 *
 *   firstName   what to call them, or nothing
 *   overdue     [{ number, toDate }]        hires past their date, phone not back
 *   live        [{ number, toDate }]        hires running now
 *   owed        £ still open on the account
 *   readyRepair { device }                  something on the shelf to collect
 *   trip        { route, travelDate }       a flight coming up
 *   rate        { perDay, cap, capDays }    the standard rate, from Settings
 *   shopPhone   the number to ring
 *
 * `fmt` injects the caller's date/money formatters — this module has no locale,
 * the same arrangement as lib/rentalReceipt.mjs.
 *
 * Returns [{ id, label, body }] — `label` is what the button says, `body` is
 * what goes in the box. At most `max` of them, because a row of eight chips is
 * a decision rather than a shortcut.
 */
export function suggestReplies(text, ctx = {}, fmt = {}, { max = 3 } = {}) {
  const date = fmt.date || ((v) => String(v || ''))
  const gbp = fmt.gbp || ((v) => `£${(Number(v) || 0).toFixed(2)}`)
  const phone = fmt.phone || ((v) => String(v || ''))

  const who = String(ctx.firstName || '').trim().split(/\s+/)[0]
  const hi = who ? `Hi ${who}, ` : ''
  const intent = readIntent(text)
  const out = []
  const add = (id, label, body) => { if (body && !out.some((o) => o.id === id)) out.push({ id, label, body }) }

  const overdue = (ctx.overdue || [])[0] || null
  const live = (ctx.live || [])[0] || null
  const owed = Number(ctx.owed) || 0

  // ── What they asked, when they asked something ────────────────────────
  if (intent === 'extend' && (live || overdue)) {
    const r = live || overdue
    add('extend', 'Extend the hire',
      `${hi}no problem - we can keep it going. It is booked to ${date(r.toDate)} at the moment; tell us the new date and we will put it on and text you what it comes to.`)
  }
  if (intent === 'availability') {
    add('availability', 'Check the shelf',
      `${hi}let me check what is free and come straight back to you.`)
  }
  if (intent === 'price' && ctx.rate && Number(ctx.rate.perDay) > 0) {
    const cap = Number(ctx.rate.cap) > 0
      ? `, and it caps at ${gbp(ctx.rate.cap)} per ${Math.round(Number(ctx.rate.capDays) || 30)} days`
      : ''
    add('price', 'Quote the rate',
      `${hi}the standard rate is ${gbp(ctx.rate.perDay)} a day${cap}. Shabbos and Yom Tov are not charged.`)
  }
  if (intent === 'hours' && ctx.shopPhone) {
    add('hours', 'When we are open',
      `${hi}give us a ring on ${ctx.shopPhone} and we will tell you when suits - we are on Bury New Road, Salford.`)
  }
  // "is my phone ready?" is a question whatever the shelf says. With the repair
  // actually done it answers itself below; without it, the honest reply is that
  // somebody will look — not silence, which is what an unanswered intent is.
  if (intent === 'collect' && !ctx.readyRepair) {
    add('checking', 'Say we will check',
      `${hi}let me check where it is up to and come straight back to you.`)
  }
  if (intent === 'payment' && owed > 0) {
    add('paid', 'About the payment',
      `${hi}thank you. There is ${gbp(owed)} showing as open on the account - if you have already sent it, tell us how and when and we will find it.`)
  }
  if (intent === 'payment' && !(owed > 0)) {
    add('settled', 'Nothing outstanding',
      `${hi}thank you - there is nothing outstanding on the account at the moment.`)
  }
  if (intent === 'ack') {
    add('ack', 'Close it off',
      `${hi}any time. Give us a shout if you need anything else.`)
  }

  // ── What is actually open on their record ─────────────────────────────
  // Offered whatever they wrote, because "?" and "Hello" are what most of these
  // texts are, and the answer is on the record rather than in the message.
  if (overdue) {
    add('overdue', 'Chase the phone',
      `${hi}${overdue.number ? `the phone ${phone(overdue.number)}` : 'the rental phone'} was due back on ${date(overdue.toDate)}. Could you drop it in when you are passing? Nothing has been charged yet.`)
  }
  if (ctx.readyRepair) {
    add('collect', 'It is ready',
      `${hi}your ${ctx.readyRepair.device || 'phone'} is repaired and ready to collect whenever suits.`)
  }
  if (owed > 0) {
    add('owed', 'The balance',
      `${hi}there is ${gbp(owed)} open on the account. You can settle it in the shop, by transfer, or we can send you a link.`)
  }
  if (ctx.trip && ctx.trip.travelDate) {
    add('trip', 'The trip',
      `${hi}we have you flying${ctx.trip.route ? ` ${ctx.trip.route}` : ''} on ${date(ctx.trip.travelDate)}. Anything you need before then?`)
  }
  if (live && !overdue) {
    add('live', 'The hire',
      `${hi}your hire runs to ${date(live.toDate)}. Let us know if anything needs changing.`)
  }

  // The one that always works. Somebody texted and nothing on their record
  // explains why, which is a real situation and not a failure — the honest
  // reply is to ask.
  add('ask', 'Ask what they need',
    `${hi}thanks for the message - what can we help with?`)

  return out.slice(0, Math.max(1, max))
}
