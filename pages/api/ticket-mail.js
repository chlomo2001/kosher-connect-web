// Tickets that arrived by email: what is waiting, and what a person decided.
//
// /api/inbound/mail parses an airline confirmation into ticket_mail and raises
// a task against it. This is the read side plus the three things someone at the
// counter can do:
//
//   GET  ?filter=pending|booked|all&limit=50
//   POST { id, customerId }              → it's for this customer (no booking yet)
//   POST { id, op:'booked', bookingId }  → the booking has been made from it
//   POST { id, op:'dismiss', reason }    → not ours / already entered / junk
//   POST { ids:[…], op:'dismiss', reason } → the same, for a morning of circulars
//
// The booking itself is NOT made here. It goes through /api/bookings like every
// other booking, so the wallet charge, the idempotency token, the passenger
// rows and the booking gate all behave identically whether the details were
// typed at the counter or read out of an email. This route only records that a
// message became that booking — one join, set after the fact.
//
// Whatever happens, the task raised at ingest is closed, because a task nobody
// closes is a queue that grows forever.

import { withTab } from '../../lib/auth.js'
import { ticketKind, ticketKindLabel, NOT_BOOKABLE } from '../../lib/ticketMail.mjs'
import { db, tablesMode, selectAllPaged } from '../../lib/db.js'

const enc = encodeURIComponent

// Raw column list — used by the read endpoint AND by `attach`, which builds a
// flight leg out of exactly these fields.
const SELECT = 'id,received_at,from_address,subject,airline,kind,booking_reference,' +
  'passengers,origin,destination,travel_date,return_date,departure_time,arrival_time,' +
  'price,currency,confidence,missing,customer_id,customer_confidence,candidates,body,' +
  'booking_id,resolved_at,dismissed_reason'

// The browser works in the app's own customer ids (legacy_id), not row UUIDs —
// same translation the rest of the API does.
async function customerMaps() {
  const rows = await selectAllPaged('customers', 'id,legacy_id,first_name,last_name', 'order=id.asc')
  const byUuid = new Map()
  const byLegacy = new Map()
  for (const c of rows) {
    const entry = {
      id: c.id,
      legacyId: c.legacy_id ? String(c.legacy_id) : '',
      name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
    }
    byUuid.set(String(c.id), entry)
    if (entry.legacyId) byLegacy.set(entry.legacyId, entry)
  }
  return { byUuid, byLegacy }
}

// Cancellations and changes are the two kinds the INGEST decided and a re-read
// of a trimmed body might miss (the tell can be past the 2500-char cut). Honour
// those from the stored column; re-derive everything else — that is where the
// old 'confirmation' default did its damage.
function computedKind(row) {
  const stored = row.kind
  if (stored === 'cancellation' || stored === 'change') return stored
  return ticketKind({ subject: row.subject || '', text: row.body || '' })
}

function toApp(row, byUuid) {
  const customer = row.customer_id ? byUuid.get(String(row.customer_id)) || null : null
  return {
    id: row.id,
    receivedAt: row.received_at,
    from: row.from_address || '',
    subject: row.subject || '',
    airline: row.airline || '',
    // The kind is worked out HERE, from the subject and body, not read from the
    // stored column. Rows filed before 18 Aug 2026 were all stored as
    // 'confirmation' — the old default — so trusting the column would leave a
    // privacy notice and a bag-drop advert still dressed as bookings in the
    // register. Re-deriving on read corrects them with no migration, and is the
    // same thing the carrier-mail queue does with carrierMailKind.
    kind: computedKind(row),
    kindLabel: ticketKindLabel(computedKind(row)),
    // Whether this message is a booking to MAKE. Marketing and the unclassified
    // are not, so the card offers to read and dismiss them, not to book them.
    bookable: !NOT_BOOKABLE.has(computedKind(row)),
    reference: row.booking_reference || '',
    passengers: row.passengers || [],
    origin: row.origin || '',
    destination: row.destination || '',
    route: row.origin && row.destination ? `${row.origin} → ${row.destination}` : '',
    travelDate: row.travel_date || '',
    returnDate: row.return_date || '',
    departureTime: row.departure_time ? String(row.departure_time).slice(0, 5) : '',
    arrivalTime: row.arrival_time ? String(row.arrival_time).slice(0, 5) : '',
    price: row.price === null ? null : Number(row.price),
    currency: row.currency || '',
    confidence: row.confidence,
    missing: row.missing || [],
    customerId: customer ? customer.legacyId : '',
    customerName: customer ? customer.name : '',
    customerConfidence: row.customer_confidence || 'none',
    // Candidates carry row UUIDs (that is what the matcher works in); the
    // browser needs the app's ids, so they are translated on the way out.
    candidates: (row.candidates || [])
      .map((c) => {
        const hit = byUuid.get(String(c.id))
        return hit ? { id: hit.legacyId, name: hit.name || c.name || '', why: c.why || '' } : null
      })
      .filter(Boolean),
    // Enough of the mail to check a number against, not the whole thing.
    body: (row.body || '').slice(0, 2500),
    bookingId: row.booking_id || null,
    resolvedAt: row.resolved_at,
    dismissedReason: row.dismissed_reason || '',
  }
}

// One open task per ticket, closed the moment the ticket stops being pending.
async function closeTicketTask(id) {
  try {
    await db.update('tasks', `reference=eq.${enc(`TICKET-${id}`)}&done=is.false`,
      { done: true, done_at: new Date().toISOString() })
  } catch (e) {
    // The decision is recorded either way; a task left open is visible and
    // harmless, an error here would undo a confirmation that already happened.
    console.error('[api/ticket-mail] task not closed', id, e)
  }
}

async function handler(req, res) {
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Storage unavailable.' })

  if (req.method === 'GET') {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50))
    const filter = String(req.query.filter || 'pending')
    const where = filter === 'booked' ? 'booking_id=not.is.null'
      : filter === 'all' ? ''
        : 'resolved_at=is.null'

    const [rows, { byUuid }] = await Promise.all([
      db.select('ticket_mail', `select=${SELECT}&${where ? `${where}&` : ''}order=received_at.desc&limit=${limit}`),
      customerMaps(),
    ])

    const [pending, booked, total] = await Promise.all([
      selectAllPaged('ticket_mail', 'id', 'resolved_at=is.null&order=id.asc'),
      selectAllPaged('ticket_mail', 'id', 'booking_id=not.is.null&order=id.asc'),
      selectAllPaged('ticket_mail', 'id', 'order=id.asc'),
    ])

    return res.json({
      success: true,
      counts: { pending: pending.length, booked: booked.length, total: total.length },
      tickets: rows.map((r) => toApp(r, byUuid)),
    })
  }

  if (req.method === 'POST') {
    const { id, ids, op, customerId, bookingId, reason } = req.body || {}
    const now = new Date().toISOString()

    // ── dismiss MANY ──────────────────────────────────────────────────────
    // A morning of airline circulars is one decision made thirty times, and a
    // queue that takes thirty presses to clear is a queue nobody clears. One
    // statement, so half of them cannot be dismissed while the other half fail.
    //
    // Only dismiss takes a list. Confirming a booking charges a customer and
    // answers a document gate; that is a decision per ticket, and offering it
    // in bulk would be a way to make thirty of them without reading one.
    if (op === 'dismiss' && Array.isArray(ids)) {
      const clean = [...new Set(ids.map((v) => String(v).trim()))].filter((v) => /^\d{1,18}$/.test(v))
      if (!clean.length) return res.status(400).json({ success: false, error: 'No ticket ids to dismiss.' })
      // A ceiling, not a limit anyone will meet: the pending queue is capped at
      // 40 on the read side, and an unbounded IN list is a way to ask the
      // database for something silly.
      if (clean.length > 200) return res.status(400).json({ success: false, error: 'Too many at once.' })
      const rows = await db.update('ticket_mail', `id=in.(${clean.map(enc).join(',')})&resolved_at=is.null`, {
        resolved_at: now,
        dismissed_reason: String(reason || '').slice(0, 200) || 'Not needed',
      })
      // Tasks are closed one by one because each ticket raised its own; a
      // failure here must not undo the dismissals, which have already happened.
      for (const r of rows) { try { await closeTicketTask(r.id) } catch { /* the queue is clear either way */ } }
      return res.json({ success: true, dismissed: rows.length })
    }

    if (!id) return res.status(400).json({ success: false, error: 'A ticket id is required.' })

    if (op === 'dismiss') {
      const rows = await db.update('ticket_mail', `id=eq.${enc(id)}`, {
        resolved_at: now,
        dismissed_reason: String(reason || '').slice(0, 200) || 'Not needed',
      })
      if (!rows.length) return res.status(404).json({ success: false, error: 'No such ticket.' })
      await closeTicketTask(id)
      return res.json({ success: true, dismissed: true })
    }

    // ── attach: this email is ANOTHER FLIGHT on a booking that already exists ──
    //
    // A self-transfer journey does not arrive as one email. Owner, 18 Aug:
    // "sometimes we do 2 airlines for there and 2 additional for back.. all for
    // one person's one time 2-way journey" — that is two to four separate
    // confirmations, each landing as its own card. Confirming the first makes
    // the booking; the rest are legs of it, not bookings of their own.
    //
    // No money moves here. The wallet charge was posted when the booking was
    // made, and a leg is detail beneath it — see the booking_legs migration.
    // What this does is stop three more cards sitting in the queue asking to be
    // booked when they have already been paid for.
    if (op === 'attach') {
      if (!bookingId) return res.status(400).json({ success: false, error: 'Which booking?' })
      const [ticket] = await db.select('ticket_mail', `select=${SELECT}&id=eq.${enc(id)}&limit=1`)
      if (!ticket) return res.status(404).json({ success: false, error: 'No such ticket.' })
      if (ticket.booking_id) {
        return res.status(400).json({ success: false, error: 'That email is already on a booking.' })
      }
      const [booking] = await db.select('bookings',
        `select=id,travel_date,booking_legs(position)&id=eq.${enc(bookingId)}&limit=1`)
      if (!booking) return res.status(404).json({ success: false, error: 'No such booking.' })

      const taken = (booking.booking_legs || []).map(l => Number(l.position) || 0)
      const position = (taken.length ? Math.max(...taken) : 0) + 1
      // A flight later than the day the trip starts is the way home, near
      // enough to be worth guessing — and it sits in an editor where a person
      // can say otherwise in one click.
      const direction = ticket.travel_date && booking.travel_date &&
        ticket.travel_date > booking.travel_date ? 'return' : 'out'

      await db.insert('booking_legs', [{
        booking_id: booking.id,
        position,
        direction,
        airline: ticket.airline || null,
        booking_reference: ticket.booking_reference || null,
        origin: ticket.origin || null,
        destination: ticket.destination || null,
        flight_date: ticket.travel_date || null,
        departure_time: ticket.departure_time || null,
        arrival_time: ticket.arrival_time || null,
        // The leg's own price is recorded when the airline stated one in
        // POUNDS. A foreign amount is not converted here for the same reason
        // it is not converted on the form: nobody chose the rate.
        price: ticket.price !== null && (!ticket.currency || ticket.currency === 'GBP')
          ? ticket.price : null,
        notes: ticket.currency && ticket.currency !== 'GBP' && ticket.price !== null
          ? `Airline charged ${ticket.currency} ${Number(ticket.price).toFixed(2)}`
          : null,
      }])

      const rows = await db.update('ticket_mail', `id=eq.${enc(id)}`, {
        booking_id: booking.id, resolved_at: now,
      })
      if (!rows.length) return res.status(404).json({ success: false, error: 'No such ticket.' })
      await closeTicketTask(id)
      return res.json({ success: true, attached: true, position, direction })
    }

    if (op === 'booked') {
      if (!bookingId) return res.status(400).json({ success: false, error: 'Which booking?' })
      const rows = await db.update('ticket_mail', `id=eq.${enc(id)}`, {
        booking_id: bookingId, resolved_at: now,
      })
      if (!rows.length) return res.status(404).json({ success: false, error: 'No such ticket.' })
      await closeTicketTask(id)
      return res.json({ success: true, booked: true })
    }

    // Just naming the customer: the ticket STAYS in the queue, because knowing
    // whose it is is not the same as having booked it.
    if (!customerId) return res.status(400).json({ success: false, error: 'Pick a customer, or dismiss it.' })
    const { byLegacy } = await customerMaps()
    const customer = byLegacy.get(String(customerId))
    if (!customer) return res.status(400).json({ success: false, error: 'That customer no longer exists.' })
    const rows = await db.update('ticket_mail', `id=eq.${enc(id)}`, {
      customer_id: customer.id, customer_confidence: 'sure',
    })
    if (!rows.length) return res.status(404).json({ success: false, error: 'No such ticket.' })
    // The task follows the customer, so it shows on their record too.
    try {
      await db.update('tasks', `reference=eq.${enc(`TICKET-${id}`)}&done=is.false`,
        { customer_id: customer.id })
    } catch { /* cosmetic */ }
    return res.json({ success: true, customer: { id: customer.legacyId, name: customer.name } })
  }

  res.status(405).end()
}

// Tickets are bookings-shaped work, so they follow the bookings permission.
export default withTab('bookings', handler)
