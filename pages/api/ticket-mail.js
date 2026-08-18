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
import { db, tablesMode, selectAllPaged } from '../../lib/db.js'

const enc = encodeURIComponent

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

function toApp(row, byUuid) {
  const customer = row.customer_id ? byUuid.get(String(row.customer_id)) || null : null
  return {
    id: row.id,
    receivedAt: row.received_at,
    from: row.from_address || '',
    subject: row.subject || '',
    airline: row.airline || '',
    kind: row.kind || 'confirmation',
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
    const { id, op, customerId, bookingId, reason } = req.body || {}
    if (!id) return res.status(400).json({ success: false, error: 'A ticket id is required.' })
    const now = new Date().toISOString()

    if (op === 'dismiss') {
      const rows = await db.update('ticket_mail', `id=eq.${enc(id)}`, {
        resolved_at: now,
        dismissed_reason: String(reason || '').slice(0, 200) || 'Not needed',
      })
      if (!rows.length) return res.status(404).json({ success: false, error: 'No such ticket.' })
      await closeTicketTask(id)
      return res.json({ success: true, dismissed: true })
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
