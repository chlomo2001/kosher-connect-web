// Inbound email → the thing it is about.
//
// Two jobs down one pipe, decided by what the message says rather than which
// alias it came through (see the branch in the handler):
//
//   a carrier notice        → sim_mail, paired to the SIM it names
//   an airline confirmation → ticket_mail, parsed into a booking to confirm
//
// Forward Email delivers here. The shop mailbox auto-forwards everything to an
// alias on kosher-connect.com whose recipient is this URL, so a Lebara renewal
// notice reaches the app the moment it arrives — no polling, no Gmail OAuth,
// and nothing to re-authorise every seven days (which is exactly what killed
// the July sweep).
//
// The pairing key is the ORIGINAL recipient. 535 SIMs are registered at a
// plus-addressed Gmail (`gitt.bilig+moshe@gmail.com`) and Gmail funnels the lot
// into one mailbox, so that address names a single SIM. lib/inboundMail drops
// the kosher-connect.com hop before matching — it appears on every message and
// would otherwise match everything to nothing.
//
// Anything that cannot be paired with certainty is STORED, not guessed at and
// not dropped: 'ambiguous' (a pool address, nothing to narrow it) and 'unknown'
// (a number live at a carrier that the app has never heard of — the July sweep
// found 241 of those) both land in sim_mail for the daily sweep to raise.
//
// Auth: a shared secret in the webhook URL (?key=…) or as the Basic-auth
// password, compared timing-safely. Forward Email cannot sign requests for us,
// so the secret in the URL is the whole gate — it lives in Vercel env as
// INBOUND_MAIL_SECRET and nowhere else.

import crypto from 'node:crypto'
import { db, tablesMode, selectAllPaged } from '../../../lib/db.js'
import { normaliseInbound, carrierOf } from '../../../lib/inboundMail.mjs'
import { buildSimIndex, matchSimForMail, simMatchRow } from '../../../lib/simMailMatch.mjs'
import { looksLikeTicket, parseTicketMail, suggestCustomer, ticketTaskTitle } from '../../../lib/ticketMail.mjs'
import { carrierMailKind, carrierMailTask, ACTIONABLE, HIGH_PRIORITY_KINDS, NEVER_FILE } from '../../../lib/carrierMail.mjs'

// Bodies are parsed mail, not attachments — but a forwarded message with an
// inline image can still be chunky, and a 413 would make Forward Email retry
// forever.
export const config = { api: { bodyParser: { sizeLimit: '4mb' } } }

const HOP_DOMAIN = (process.env.MAIL_DOMAIN || 'kosher-connect.com').trim().toLowerCase()

function secretOk(req) {
  const want = (process.env.INBOUND_MAIL_SECRET || '').trim()
  if (!want) return false // fail closed: no secret configured, no ingest
  const fromQuery = String(req.query?.key || '')
  let fromBasic = ''
  const auth = req.headers.authorization || ''
  if (/^Basic\s+/i.test(auth)) {
    const decoded = Buffer.from(auth.replace(/^Basic\s+/i, ''), 'base64').toString('utf8')
    fromBasic = decoded.slice(decoded.indexOf(':') + 1)
  }
  return [fromQuery, fromBasic].some((given) => {
    const a = Buffer.from(String(given))
    const b = Buffer.from(want)
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  })
}

// The SIM index costs a full read of sims (797 rows today). Cached briefly so a
// burst of carrier mail doesn't re-read it per message; short enough that a SIM
// added at the counter starts pairing within the minute.
let cache = { at: 0, index: null }
const INDEX_TTL_MS = 60_000

async function simIndex() {
  if (cache.index && Date.now() - cache.at < INDEX_TTL_MS) return cache.index
  const rows = await selectAllPaged('sims',
    'id,customer_id,legacy_extras,alt_emails,master_accounts(account_email)', 'order=id.asc')
  // simMatchRow gathers every address a line receives at — the one on the SIM,
  // any taught since, and the master account's carrier login. This is the index
  // that decides AT ARRIVAL, so a message reaching an address the record
  // already knows about is filed straight away rather than joining the queue.
  const index = buildSimIndex(rows.map(simMatchRow))
  index.customerBySim = new Map(rows.map((r) => [String(r.id), r.customer_id]))
  // The customer's NAME as well, so a task raised from a port confirmation reads
  // "check Mordche Grinfeld's number is live" rather than naming a row id.
  index.nameBySim = new Map(rows.map((r) => [String(r.id), r.legacy_extras?.customerName || '']))
  cache = { at: Date.now(), index }
  return index
}

// The customer list, for putting a name on a ticket. Same short cache as the
// SIM index and for the same reason: a burst of forwarded mail must not re-read
// 610 rows per message, and a customer added at the counter should be matchable
// within the minute.
let people = { at: 0, data: null }

async function customerIndex() {
  if (people.data && Date.now() - people.at < INDEX_TTL_MS) return people.data
  const [customers, pax] = await Promise.all([
    selectAllPaged('customers', 'id,first_name,last_name', 'order=id.asc'),
    // Who has flown on whose account before — the strongest evidence there is,
    // because families book the same names every year and the wife's ticket
    // goes on the husband's wallet.
    selectAllPaged(
      'booking_passengers',
      'full_name,bookings(customer_id,customers(first_name,last_name))',
      'order=id.asc'
    ).catch(() => []),
  ])
  const data = {
    customers: customers.map((c) => ({ id: c.id, firstName: c.first_name, lastName: c.last_name })),
    priorPassengers: pax
      .filter((p) => p.full_name && p.bookings?.customer_id)
      .map((p) => ({
        name: p.full_name,
        customerId: p.bookings.customer_id,
        customerName: `${p.bookings.customers?.first_name || ''} ${p.bookings.customers?.last_name || ''}`.trim(),
      })),
  }
  people = { at: Date.now(), data }
  return data
}

/**
 * An airline confirmation: parse it, guess whose it is, and raise the task.
 *
 * Deliberately writes nothing to `bookings` and nothing to `ledger`. Every row
 * here is a SUGGESTION a person confirms at the counter — see the migration.
 */
async function fileTicket(mail) {
  const parsed = parseTicketMail({ from: mail.from, subject: mail.subject, text: mail.text })
  const { customers, priorPassengers } = await customerIndex()
  const who = suggestCustomer(parsed.passengers, { customers, priorPassengers })

  const inserted = await db.insertIgnoreDup('ticket_mail', [{
    message_id: mail.messageId,
    ...(mail.receivedAt ? { received_at: mail.receivedAt } : {}),
    from_address: mail.from || null,
    subject: mail.subject || null,
    route_addresses: mail.route && mail.route.length ? mail.route : null,
    airline: parsed.airline,
    kind: parsed.kind,
    booking_reference: parsed.reference,
    passengers: parsed.passengers,
    origin: parsed.origin,
    destination: parsed.destination,
    travel_date: parsed.travelDate,
    return_date: parsed.returnDate,
    departure_time: parsed.departureTime,
    arrival_time: parsed.arrivalTime,
    price: parsed.price,
    currency: parsed.currency,
    confidence: parsed.confidence,
    missing: parsed.missing,
    customer_id: who.customerId,
    customer_confidence: who.confidence,
    candidates: who.candidates,
    body: mail.text ? mail.text.slice(0, 12000) : null,
  }], 'message_id')

  // A duplicate delivery must not raise a second task.
  if (!inserted.length) return { stored: false, duplicate: true }
  const row = inserted[0]

  // The task is what makes this visible to whoever is on the counter. It is
  // best-effort ON PURPOSE: a task that fails to insert must not 500 the
  // webhook, because Forward Email would then redeliver the message forever and
  // the ticket itself is already safely filed.
  try {
    const top = who.candidates[0]
    // A plain insert, not an upsert on the reference: `TICKET-<id>` names a row
    // that was created by the insert above, so it cannot already exist. (The
    // one-open-task-per-reference index is partial, and PostgREST cannot use a
    // partial index as a conflict target — see upsertOpenTask in cron/sweep.)
    await db.insert('tasks', [{
      title: ticketTaskTitle(parsed, { customerName: top ? top.name : '' }),
      customer_id: who.customerId,
      source: 'auto',
      priority: parsed.kind === 'cancellation' ? 'high' : 'medium',
      reference: `TICKET-${row.id}`,
      raw_text: `From ${mail.from || 'an airline'} — ${mail.subject || '(no subject)'}`,
    }])
  } catch (e) {
    console.error('[inbound/mail] ticket task not raised', row.id, e)
  }

  return { stored: true, duplicate: false, ticketId: row.id, confidence: parsed.confidence }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only.' })
  if (!secretOk(req)) return res.status(401).json({ ok: false, error: 'Bad or missing key.' })
  if (!tablesMode) return res.status(503).json({ ok: false, error: 'Storage unavailable.' })

  try {
    const payload = req.body && typeof req.body === 'object' ? req.body : {}
    const mail = normaliseInbound(payload, { hopDomain: HOP_DOMAIN })

    // A payload we could read nothing out of is a shape we don't handle yet.
    // Log the keys — a silent 200 here would look like a working integration
    // that quietly files nothing.
    if (!mail.recipients.length && !mail.subject && !mail.snippet) {
      console.warn('[inbound/mail] unreadable payload, top-level keys:',
        Object.keys(payload).join(',') || '(none)')
    }

    // ── which queue is this? ──────────────────────────────────────────────
    //
    // Two different jobs arrive down one pipe: carrier notices about SIMs, and
    // airline confirmations from the mailbox flights get booked in. Content
    // decides, not the alias — a forwarding rule can be edited by anyone in
    // Gmail, and a message that took the wrong route should still land in the
    // right queue. `?kind=ticket` on the alias URL forces the ticket path for a
    // filter that only ever sends tickets; `?kind=sim` forces the other way.
    const forced = String(req.query?.kind || '').toLowerCase()
    const ticketish = looksLikeTicket({ from: mail.from, subject: mail.subject, text: mail.text })

    if (forced === 'ticket') {
      // The tickets alias is fed from a PERSONAL mailbox, and a sender list can
      // never be complete — the shop books through Kiwi, eDreams and whoever is
      // cheapest that week (owner, 18 Aug: "sometimes its booked via 3rd party
      // like wiki.com and much more"). The only filter that catches an agent
      // nobody has heard of yet is a broad one, and a broad one out of a
      // personal mailbox will also catch hotels, restaurants and Amazon.
      //
      // So anything down this pipe that is not ticket-shaped is DROPPED, and
      // dropped means nothing stored — not a thin row, not a body, not a task.
      // That is what makes a broad filter safe to recommend: a false positive
      // costs a wasted webhook call and leaves no trace of somebody's private
      // post in the shop's database.
      //
      // The one exception is Google's own forwarding confirmation, which is
      // not ticket-shaped and is the message that turns the forward on: it
      // carries the code, and it has nowhere else to be read.
      const isForwardConfirm = /forwarding-noreply@google\.com/i.test(mail.from || '') ||
        /forwarding confirmation|verify your forwarding|confirm.*forwarding/i.test(mail.subject || '')
      if (!ticketish && !isForwardConfirm) {
        return res.json({ ok: true, queue: 'ignored', stored: false, reason: 'not a ticket' })
      }
      const result = await fileTicket(mail)
      return res.json({ ok: true, queue: 'ticket', ...result })
    }

    if (forced !== 'sim' && ticketish) {
      const result = await fileTicket(mail)
      return res.json({ ok: true, queue: 'ticket', ...result })
    }

    const index = await simIndex()
    const match = matchSimForMail({
      to: mail.recipients.join(','),
      subject: mail.subject,
      snippet: mail.snippet,
      // The body too. Carriers put the mobile number in the message, not in the
      // subject — leaving it out is what filled the queue with "which of these
      // thirteen?" on messages that name their own number.
      text: mail.text,
    }, index)

    // WHAT THE MESSAGE MEANS, not only whose it is. A completed port, a PAC
    // code and a failed payment each mean somebody has something to do; the
    // renewals are the ones that can simply be filed.
    const kind = carrierMailKind({ subject: mail.subject, snippet: mail.snippet, text: mail.text })

    // An advert is not news about a plan, so it must not sit in the working
    // queue for a person to read and dismiss — that is how a queue teaches
    // people to skim it (owner, 19 Aug).
    //
    // But it is FILED AND MARKED DONE, not thrown away. It used to be dropped
    // outright, which broke the rule this file states at the top of itself:
    // anything uncertain is stored, not guessed at and not dropped. The
    // asymmetry is the argument. A missed advert costs one dismissal. A
    // MISCLASSIFIED message — a completed port, a failed payment — was gone,
    // with a line in a Vercel log as the only trace, and nobody would ever
    // know to look for it. On the shop's real mail this classifier already
    // misses at least one advert ("The Pixel 11 ships today!") and the obvious
    // signal for catching it, a utm_campaign link, appears in Smarty's genuine
    // port-completion email — so tightening it further is exactly the kind of
    // change that would start eating real messages.
    //
    // Resolved on arrival keeps it out of 'pending' and out of everybody's
    // way, and leaves it readable under "Everything" if the call was wrong.
    const filedResolved = NEVER_FILE.has(kind)
    if (filedResolved) {
      console.log(`[inbound/mail] filed an advert as already dealt with: ${String(mail.subject || '').slice(0, 80)}`)
    }

    const inserted = await db.insertIgnoreDup('sim_mail', [{
      message_id: mail.messageId,
      ...(mail.receivedAt ? { received_at: mail.receivedAt } : {}),
      // The recipient that best IDENTIFIES the SIM: the address matched on
      // when the message paired (see matchSimForMail), or the first envelope
      // hop when it did not — which, with every shop mailbox forwarding into
      // one business-only inbox, is the hub and tells a human nothing. So on
      // the PENDING queue this column is usually the hub, not a pairing:
      // the migration's older comment ("the address we PAIRED on") described
      // only the happy half, and the pending queue is exactly where somebody
      // reads this column hardest.
      recipient: match.matchedOn || mail.recipients[0] || null,
      // The hops as well, so the route a message took is a fact on the row
      // rather than a thing to argue about — see the migration for why.
      route: mail.route && mail.route.length ? mail.route : null,
      from_address: mail.from || null,
      carrier: carrierOf(mail.from),
      subject: mail.subject || null,
      snippet: mail.snippet || null,
      confidence: match.confidence,
      numbers: match.numbers,
      sim_id: match.simId,
      customer_id: match.simId ? index.customerBySim.get(String(match.simId)) || null : null,
      // Marked done on arrival, so it never appears in the working queue —
      // present under "Everything" if the classification was wrong.
      ...(filedResolved ? { resolved_at: new Date().toISOString() } : {}),
    }], 'message_id')

    // A port completing is the end of a job the shop did: the number has moved,
    // the SIM record probably still holds the old one, and nobody knows the
    // line is live until a customer finds out it is not. Raise it as work.
    //
    // Only on a message that was actually stored — a redelivery must not raise
    // the task twice — and never fatally: the message is filed either way, and
    // a task that could not be written is better than a 500 that has Forward
    // Email redeliver a message already on the books.
    if (inserted.length && ACTIONABLE.has(kind)) {
      try {
        const title = carrierMailTask(kind, {
          customerName: match.simId ? index.nameBySim.get(String(match.simId)) || '' : '',
          number: (match.numbers && match.numbers[0]) ? `0${match.numbers[0]}` : '',
          carrier: carrierOf(mail.from) || '',
        })
        if (title) {
          await db.insert('tasks', [{
            title,
            customer_id: match.simId ? index.customerBySim.get(String(match.simId)) || null : null,
            source: 'auto',
            // Money kinds are high: a failed payment stops the line now, and a
            // removed payment method stops it silently on renewal day.
            priority: HIGH_PRIORITY_KINDS.has(kind) ? 'high' : 'medium',
            reference: `SIMMAIL-${inserted[0].id}`,
            raw_text: `From ${mail.from || 'the carrier'} — ${mail.subject || '(no subject)'}`,
          }])
        }
      } catch (e) {
        console.error('[inbound/mail] carrier task not raised', kind, e)
      }
    }

    // 200 on a duplicate too: a retry is not an error, and a non-2xx would have
    // Forward Email redeliver it indefinitely.
    return res.json({
      ok: true,
      queue: 'sim',
      stored: inserted.length > 0,
      duplicate: inserted.length === 0,
      confidence: match.confidence,
      kind,
      paired: !!match.simId,
      // Said plainly, because "stored: true" on an advert would otherwise read
      // as it having landed in somebody's queue.
      resolvedOnArrival: filedResolved,
    })
  } catch (e) {
    console.error('[inbound/mail]', e)
    // 500 so Forward Email retries — a storage blip should not lose the message.
    return res.status(500).json({ ok: false, error: 'Could not file that message.' })
  }
}
