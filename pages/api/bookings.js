// Tickets & flight bookings — the first tables-native feature (no legacy
// blob) and the first wallet-ledger writer.
//
// Money model (ported from the .gs Bookings/Ledger design):
//   - creating a booking posts ONE ledger charge of -(price + booking_fee)
//     with entry_type 'booking' and charge_reference 'BOOKING-<uuid>'
//   - the DB enforces sign (ledger_amount_sign) and idempotency
//     (charge_reference unique); the ledger is append-only
//   - balance is never stored: read from the customer_balances view

import { withTab, tabAllowedFor } from '../../lib/auth.js'
import { db, tablesMode } from '../../lib/db.js'
import { postAutoCharges } from '../../lib/customCharges.js'

const BOOKING_STATUSES = ['Booked', 'Ticketed', 'Completed', 'Cancelled']

// passport_expiry is owner-only on READS (schema §9): helpers may enter it
// when creating a booking (counter workflow, and the expiry sweep needs it)
// but never see it back. passport_on_file stays visible to everyone.
// Per-passenger passport number + expiry follow the same rule; DOB stays
// visible (staff need it to make the airline booking).
function toApp(row, staff) {
  const app = toAppFull(row)
  if (staff && staff.role !== 'owner') {
    app.passportExpiry = ''
    app.passengers = app.passengers.map(p => ({ ...p, passportNumber: '', passportExpiry: '' }))
  }
  return app
}

function toAppFull(row) {
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
    // Role-safe honest signal: are real passport details actually stored?
    // Computed here from the unmasked row, so it's accurate for EVERY staff
    // role (passenger passport numbers themselves are owner-only on reads).
    // It's just a yes/no — no number is leaked.
    hasPassportDetails: (row.booking_passengers || [])
      .some(p => p.passport_number && String(p.passport_number).trim()),
    passportExpiry: row.passport_expiry || '',
    checkinDone: !!row.checkin_done,
    checkinBy: row.checkin_by || '',
    checkinDate: row.checkin_date || '',
    notes: row.notes || '',
    createdAt: row.created_at,
    passengers: (row.booking_passengers || [])
      .slice()
      .sort((a, b) => (a.position || 0) - (b.position || 0))
      .map(p => ({
        id: p.id,
        fullName: p.full_name || '',
        dob: p.dob || '',
        passportNumber: p.passport_number || '',
        passportExpiry: p.passport_expiry || '',
        nationality: p.nationality || '',
        passportIssueDate: p.passport_issue_date || '',
        issuingCountry: p.issuing_country || '',
      })),
  }
}

const CUSTOMER_EMBED = 'customers(legacy_id,first_name,last_name)'
const PASSENGER_EMBED = 'booking_passengers(id,position,full_name,dob,passport_number,passport_expiry,nationality,passport_issue_date,issuing_country)'

// Normalise a client passengers array into insertable rows. Rows with no
// name are dropped (blank editor lines), everything else is trimmed.
function passengerRows(bookingId, passengers) {
  if (!Array.isArray(passengers)) return []
  return passengers
    .filter(p => p && String(p.fullName || '').trim())
    .map((p, i) => ({
      booking_id: bookingId,
      position: i + 1,
      full_name: String(p.fullName).trim(),
      dob: p.dob || null,
      passport_number: String(p.passportNumber || '').trim() || null,
      passport_expiry: p.passportExpiry || null,
      nationality: String(p.nationality || '').trim() || null,
      passport_issue_date: p.passportIssueDate || null,
      issuing_country: String(p.issuingCountry || '').trim() || null,
    }))
}

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
      // Check-in view: full, UNMASKED passenger passport details for one
      // booking — staff DOING the check-in may see them (owner decision
      // 2026-07-13), i.e. anyone with the bookings tab; the general list
      // below stays masked. Gating this closes the IDOR where a helper
      // without the bookings tab could harvest every passport via this path.
      if (req.query.checkin) {
        if (!(await tabAllowedFor(req.staff, 'bookings'))) {
          return res.status(403).json({ success: false, error: 'Not permitted to view check-in details.' })
        }
        const [full] = await db.select(
          'bookings',
          `select=*,${CUSTOMER_EMBED},${PASSENGER_EMBED}&id=eq.${encodeURIComponent(String(req.query.checkin))}`
        )
        if (!full) return res.status(404).json({ success: false, error: 'Booking not found.' })
        return res.json({ success: true, booking: toAppFull(full) }) // toAppFull = no masking
      }
      const rows = await db.select(
        'bookings',
        `select=*,${CUSTOMER_EMBED},${PASSENGER_EMBED}&order=created_at.desc`
      )
      return res.json(rows.map(r => toApp(r, req.staff)))
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
          checkin_done: !!b.checkinDone,
          checkin_by: b.checkinBy === 'us' || b.checkinBy === 'customer' ? b.checkinBy : null,
          checkin_date: b.checkinDate || null,
          notes: b.notes || null,
        }]
      )
      const booking = inserted[0]

      const paxRows = passengerRows(booking.id, b.passengers)
      if (paxRows.length) await db.insert('booking_passengers', paxRows)

      // Wallet charge: one signed, idempotent ledger row. A £0 booking posts
      // nothing (the ledger forbids zero amounts by design).
      const total = price + fee
      // How the customer paid: 'account' leaves a wallet balance owing;
      // any real method ('cash'/'card'/'card_on_file'/'bank_transfer')
      // means paid on the spot, so we post an equal-and-opposite payment
      // and the wallet nets to zero — no debt for a ticket already paid.
      const PAY_METHODS = { cash: 'cash', card: 'card', card_on_file: 'card', bank_transfer: 'bank_transfer' }
      const payMethod = PAY_METHODS[b.payment] || null
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
        if (payMethod) {
          await db.insertIgnoreDup(
            'ledger',
            [{
              customer_id: customerUuid,
              charge_reference: `PAY-BOOKING-${booking.id}`,
              entry_type: 'payment',
              amount: total,
              method: payMethod,
              description: `Paid (${b.payment === 'card_on_file' ? 'card on file' : payMethod}) — ${memo}`,
              related_booking_id: booking.id,
            }],
            'charge_reference'
          )
        }
      }

      // Owner-defined auto extras for bookings (e.g. a service/handling fee).
      const extras = await postAutoCharges({
        customerUuid, appliesTo: 'booking', refBase: booking.id,
        paidNow: !!payMethod, method: payMethod,
      })
      if (extras.total > 0) chargePosted = true

      const balance = await walletBalance(customerUuid)
      const [full] = await db.select(
        'bookings',
        `select=*,${CUSTOMER_EMBED},${PASSENGER_EMBED}&id=eq.${booking.id}`
      )
      return res.json({
        success: true, booking: toApp(full, req.staff), chargePosted,
        charged: total + extras.total, extras: extras.lines, balance, paidNow: !!payMethod,
      })
    }

    if (req.method === 'PUT') {
      // Flight logistics + status/notes/passengers/check-in are editable.
      // MONEY (price/booking_fee) stays immutable once charged — corrections
      // go through an explicit wallet adjustment, so the ledger stays honest.
      const { id, status, notes, passengers, checkinDone, checkinBy, checkinDate,
        passenger, route, airline, bookingReference, travelDate, departureTime,
        arrivalTime, passportOnFile, passportExpiry } = req.body || {}
      if (!id) return res.status(400).json({ success: false, error: 'Booking id is required.' })
      const patch = {}
      if (status !== undefined) {
        if (!BOOKING_STATUSES.includes(status)) {
          return res.status(400).json({ success: false, error: `Status must be one of: ${BOOKING_STATUSES.join(', ')}.` })
        }
        patch.status = status
      }
      if (notes !== undefined) patch.notes = notes || null
      if (passenger !== undefined) patch.passenger = passenger || null
      if (route !== undefined) {
        if (!String(route).trim()) return res.status(400).json({ success: false, error: 'Route cannot be empty.' })
        patch.route = String(route).trim()
      }
      if (airline !== undefined) patch.airline = airline || null
      if (bookingReference !== undefined) patch.booking_reference = bookingReference || null
      if (travelDate !== undefined) patch.travel_date = travelDate || null
      if (departureTime !== undefined) patch.departure_time = departureTime || null
      if (arrivalTime !== undefined) patch.arrival_time = arrivalTime || null
      if (passportOnFile !== undefined) patch.passport_on_file = !!passportOnFile
      if (passportExpiry !== undefined) patch.passport_expiry = passportExpiry || null
      if (checkinDone !== undefined) patch.checkin_done = !!checkinDone
      if (checkinBy !== undefined) patch.checkin_by = (checkinBy === 'us' || checkinBy === 'customer') ? checkinBy : null
      if (checkinDate !== undefined) patch.checkin_date = checkinDate || null
      if (!Object.keys(patch).length && passengers === undefined) {
        return res.status(400).json({ success: false, error: 'Nothing to update.' })
      }

      const bid = encodeURIComponent(String(id))
      let updated
      if (Object.keys(patch).length) {
        updated = await db.update('bookings', `id=eq.${bid}`, patch)
      } else {
        updated = await db.select('bookings', `select=id&id=eq.${bid}`)
      }
      if (!updated.length) return res.status(404).json({ success: false, error: 'Booking not found.' })

      if (passengers !== undefined) {
        // Replace-all, with one wrinkle: helpers never see passport fields,
        // so a blank passport on a row they round-trip means "unchanged",
        // not "erase" — merge those back from the existing rows by id.
        const rows = passengerRows(String(id), passengers)
        if (req.staff && req.staff.role !== 'owner') {
          const existing = await db.select('booking_passengers',
            `select=id,passport_number,passport_expiry&booking_id=eq.${bid}`)
          const byId = new Map(existing.map(p => [p.id, p]))
          const sent = Array.isArray(passengers) ? passengers.filter(p => p && String(p.fullName || '').trim()) : []
          rows.forEach((row, i) => {
            const prev = byId.get(sent[i]?.id)
            if (prev) {
              if (!row.passport_number) row.passport_number = prev.passport_number
              if (!row.passport_expiry) row.passport_expiry = prev.passport_expiry
            }
          })
        }
        await db.delete('booking_passengers', `booking_id=eq.${bid}`)
        if (rows.length) await db.insert('booking_passengers', rows)
      }

      const [full] = await db.select('bookings', `select=*,${CUSTOMER_EMBED},${PASSENGER_EMBED}&id=eq.${bid}`)
      return res.json({ success: true, booking: toApp(full, req.staff) })
    }

    return res.status(405).end()
  } catch (e) {
    console.error('[api/bookings]', e)
    return res.status(500).json({ success: false, error: 'Storage error' })
  }
}

export default withTab('bookings', handler)
