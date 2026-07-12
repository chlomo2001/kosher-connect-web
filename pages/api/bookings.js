// Tickets & flight bookings — the first tables-native feature (no legacy
// blob) and the first wallet-ledger writer.
//
// Money model (ported from the .gs Bookings/Ledger design):
//   - creating a booking posts ONE ledger charge of -(price + booking_fee)
//     with entry_type 'booking' and charge_reference 'BOOKING-<uuid>'
//   - the DB enforces sign (ledger_amount_sign) and idempotency
//     (charge_reference unique); the ledger is append-only
//   - balance is never stored: read from the customer_balances view

import { db, tablesMode } from '../../lib/db.js'

const BOOKING_STATUSES = ['Booked', 'Ticketed', 'Completed', 'Cancelled']

function toApp(row) {
  return {
    id: row.id,
    customerId: row.customers?.legacy_id ?? null,
    customerName: row.customers
      ? `${row.customers.first_name || ''} ${row.customers.last_name || ''}`.trim()
      : '',
    passenger: row.passenger || '',
    route: row.route || '',
    airline: row.airline || '',
    bookingReference: row.booking_reference || '',
    travelDate: row.travel_date || '',
    departureTime: row.departure_time ? String(row.departure_time).slice(0, 5) : '',
    arrivalTime: row.arrival_time ? String(row.arrival_time).slice(0, 5) : '',
    price: row.price === null ? 0 : Number(row.price),
    bookingFee: row.booking_fee === null ? 0 : Number(row.booking_fee),
    status: row.status || 'Booked',
    passportOnFile: !!row.passport_on_file,
    passportExpiry: row.passport_expiry || '',
    notes: row.notes || '',
    createdAt: row.created_at,
  }
}

const CUSTOMER_EMBED = 'customers(legacy_id,first_name,last_name)'

async function walletBalance(customerUuid) {
  const rows = await db.select('customer_balances', `customer_id=eq.${customerUuid}`)
  return rows.length ? Number(rows[0].balance) : 0
}

async function handler(req, res) {
  if (!tablesMode) {
    return res.status(503).json({
      success: false,
      error: 'Bookings need the relational data layer (SUPABASE_SERVICE_ROLE_KEY not configured).',
    })
  }

  try {
    if (req.method === 'GET') {
      const rows = await db.select(
        'bookings',
        `select=*,${CUSTOMER_EMBED}&order=created_at.desc`
      )
      return res.json(rows.map(toApp))
    }

    if (req.method === 'POST') {
      const b = req.body || {}
      const price = Number(b.price)
      const fee = Number(b.bookingFee) || 0
      if (!b.customerId) return res.status(400).json({ success: false, error: 'Customer is required.' })
      if (!b.route || !String(b.route).trim()) return res.status(400).json({ success: false, error: 'Route is required.' })
      if (!b.travelDate) return res.status(400).json({ success: false, error: 'Travel date is required.' })
      if (!Number.isFinite(price) || price < 0) return res.status(400).json({ success: false, error: 'Price must be a number ≥ 0.' })
      if (fee < 0) return res.status(400).json({ success: false, error: 'Booking fee cannot be negative.' })

      const custRows = await db.select(
        'customers',
        `select=id&legacy_id=eq.${encodeURIComponent(String(b.customerId))}`
      )
      if (!custRows.length) return res.status(400).json({ success: false, error: `Customer ${b.customerId} not found.` })
      const customerUuid = custRows[0].id

      const inserted = await db.insert(
        'bookings',
        [{
          customer_id: customerUuid,
          passenger: b.passenger || null,
          route: String(b.route).trim(),
          airline: b.airline || null,
          booking_reference: b.bookingReference || null,
          travel_date: b.travelDate,
          departure_time: b.departureTime || null,
          arrival_time: b.arrivalTime || null,
          price,
          booking_fee: fee,
          status: BOOKING_STATUSES.includes(b.status) ? b.status : 'Booked',
          passport_on_file: !!b.passportOnFile,
          passport_expiry: b.passportExpiry || null,
          notes: b.notes || null,
        }]
      )
      const booking = inserted[0]

      // Wallet charge: one signed, idempotent ledger row. A £0 booking posts
      // nothing (the ledger forbids zero amounts by design).
      const total = price + fee
      let chargePosted = false
      if (total > 0) {
        const memo =
          `Flight ${booking.route}${booking.airline ? ` (${booking.airline})` : ''}` +
          (booking.booking_reference ? ` — ref ${booking.booking_reference}` : '')
        await db.insertIgnoreDup(
          'ledger',
          [{
            customer_id: customerUuid,
            charge_reference: `BOOKING-${booking.id}`,
            entry_type: 'booking',
            amount: -total,
            description: memo,
            related_booking_id: booking.id,
          }],
          'charge_reference'
        )
        chargePosted = true
      }

      const balance = await walletBalance(customerUuid)
      const [full] = await db.select(
        'bookings',
        `select=*,${CUSTOMER_EMBED}&id=eq.${booking.id}`
      )
      return res.json({ success: true, booking: toApp(full), chargePosted, charged: total, balance })
    }

    if (req.method === 'PUT') {
      // Status/notes only — money fields are immutable once charged; price
      // corrections become explicit ledger adjustments (step-3 wallet UI).
      const { id, status, notes } = req.body || {}
      if (!id) return res.status(400).json({ success: false, error: 'Booking id is required.' })
      const patch = {}
      if (status !== undefined) {
        if (!BOOKING_STATUSES.includes(status)) {
          return res.status(400).json({ success: false, error: `Status must be one of: ${BOOKING_STATUSES.join(', ')}.` })
        }
        patch.status = status
      }
      if (notes !== undefined) patch.notes = notes || null
      if (!Object.keys(patch).length) return res.status(400).json({ success: false, error: 'Nothing to update.' })

      const updated = await db.update('bookings', `id=eq.${encodeURIComponent(String(id))}`, patch)
      if (!updated.length) return res.status(404).json({ success: false, error: 'Booking not found.' })
      const [full] = await db.select('bookings', `select=*,${CUSTOMER_EMBED}&id=eq.${encodeURIComponent(String(id))}`)
      return res.json({ success: true, booking: toApp(full) })
    }

    return res.status(405).end()
  } catch (e) {
    console.error('[api/bookings]', e)
    return res.status(500).json({ success: false, error: 'Storage error' })
  }
}

export default withStaff(handler)
