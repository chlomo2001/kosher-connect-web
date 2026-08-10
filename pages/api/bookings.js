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
import { db, tablesMode, STORAGE_ERROR } from '../../lib/db.js'
import { postAutoCharges } from '../../lib/customCharges.js'
import { money } from '../../lib/money.mjs'

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
    // The whole passport DOCUMENT is masked for helpers — number, expiry, and
    // the passport-adjacent fields (nationality, issue date, issuing country)
    // that the old mask let through (sweep 2026-08-02 #8). DOB deliberately
    // stays visible: staff need it to make the airline booking (owner
    // decision, see header). The check-in view carries the full details.
    app.passengers = app.passengers.map(p => ({
      ...p, passportNumber: '', passportExpiry: '',
      nationality: '', passportIssueDate: '', issuingCountry: '',
    }))
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
    destinationCountry: row.destination_country || '',
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

// The unmasked check-in view is the only place passport numbers leave the
// server, so reads through it are throttled per staff member and audited
// (sweep 2026-08-02 #7). The budget covers a family's worth of check-ins
// back-to-back; walking the whole register trips it. Same best-effort
// in-memory trade-off as the auth counters in lib/auth.js — the Vercel
// runtime log is the audit trail.
const checkinReads = new Map() // staff id -> { n, first }
const CHECKIN_READS_MAX = 15
const CHECKIN_WINDOW_MS = 10 * 60 * 1000
function checkinReadAllowed(staffId) {
  const key = String(staffId || 'unknown')
  const e = checkinReads.get(key)
  if (e && Date.now() - e.first > CHECKIN_WINDOW_MS) checkinReads.delete(key)
  const cur = checkinReads.get(key) || { n: 0, first: Date.now() }
  cur.n += 1
  if (checkinReads.size > 200) checkinReads.clear()
  checkinReads.set(key, cur)
  return cur.n <= CHECKIN_READS_MAX
}

// Passenger dates arrive as yyyy-mm-dd from the date inputs; anything else
// must be refused BEFORE the replace starts, because a row that fails to
// insert after the old rows are deleted destroys passport data helpers
// cannot re-enter (sweep 2026-08-02 #16).
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
function badPassengerDate(passengers) {
  for (const p of Array.isArray(passengers) ? passengers : []) {
    if (!p || !String(p.fullName || '').trim()) continue
    for (const [label, v] of [
      ['date of birth', p.dob],
      ['passport expiry', p.passportExpiry],
      ['passport issue date', p.passportIssueDate],
    ]) {
      if (v && !ISO_DATE.test(String(v))) {
        return `${String(p.fullName).trim()}: ${label} must be a full date (year-month-day).`
      }
    }
  }
  return null
}

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
        if (!checkinReadAllowed(req.staff?.id)) {
          return res.status(429).json({ success: false, error: 'Too many check-in views in a row — wait a few minutes.' })
        }
        console.log(`[audit] check-in passport view: staff=${req.staff?.id || 'auth-off'} booking=${String(req.query.checkin)}`)
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
      const clientRef = (typeof b.clientRef === 'string' && /^[\w-]{8,64}$/.test(b.clientRef)) ? b.clientRef : null
      const price = Number(b.price)
      const fee = Number(b.bookingFee) || 0
      if (!b.customerId) return res.status(400).json({ success: false, error: 'Customer is required.' })
      if (!b.route || !String(b.route).trim()) return res.status(400).json({ success: false, error: 'Route is required.' })
      if (!b.travelDate) return res.status(400).json({ success: false, error: 'Travel date is required.' })
      // Booking-level dates hit Postgres `date` columns — ISO only, or a slash
      // date parses month-first (sweep 2026-08-02 #22).
      for (const [label, v] of [['Travel date', b.travelDate], ['Check-in date', b.checkinDate], ['Passport expiry', b.passportExpiry]]) {
        if (v && !ISO_DATE.test(String(v))) {
          return res.status(400).json({ success: false, error: `${label} must be a full date (year-month-day).` })
        }
      }
      if (!Number.isFinite(price) || price < 0) return res.status(400).json({ success: false, error: 'Price must be a number ≥ 0.' })
      if (fee < 0) return res.status(400).json({ success: false, error: 'Booking fee cannot be negative.' })
      const badDate = badPassengerDate(b.passengers)
      if (badDate) return res.status(400).json({ success: false, error: badDate })

      const custRows = await db.select(
        'customers',
        `select=id&legacy_id=eq.${encodeURIComponent(String(b.customerId))}`
      )
      if (!custRows.length) return res.status(400).json({ success: false, error: `Customer ${b.customerId} not found.` })
      const customerUuid = custRows[0].id

      // Idempotency: a repeat submit (retry / double-click / concurrent) must not
      // create a second booking or a second charge. Two layers:
      //   1. Fast path — the BOOKING-<clientRef> charge already exists → this is a
      //      completed replay: return the booking it points at, post nothing new.
      //   2. claimKey — atomically claim the token BEFORE inserting the booking row.
      //      The ledger dedupes the CHARGE, but not the booking row itself: without
      //      the claim, two parallel submits both pass the read-check and each
      //      insert a booking (one left with no charge). The claim lets only one win.
      const existingBooking = async () => {
        const dup = await db.select('ledger',
          `charge_reference=eq.${encodeURIComponent('BOOKING-' + clientRef)}&select=related_booking_id&limit=1`)
        if (!dup.length || !dup[0].related_booking_id) return null
        const [existing] = await db.select('bookings',
          `select=*,${CUSTOMER_EMBED},${PASSENGER_EMBED}&id=eq.${dup[0].related_booking_id}`)
        return existing || null
      }
      const bookingDuplicate = async (existing) => res.json({
        success: true, duplicate: true, booking: toApp(existing, req.staff),
        balance: await walletBalance(customerUuid),
      })
      let keyClaimed = false
      if (clientRef) {
        const already = await existingBooking()
        if (already) return bookingDuplicate(already)
        keyClaimed = await db.claimKey(`BOOKING-${clientRef}`, { scope: 'booking', customerId: customerUuid })
        if (!keyClaimed) {
          // Another submit holds the token: if it already committed return that
          // booking, otherwise it's still in flight — 409 so the client retries
          // instead of double-posting.
          const racing = await existingBooking()
          if (racing) return bookingDuplicate(racing)
          return res.status(409).json({ success: false, error: 'This booking is already being saved — give it a second and try again.' })
        }
      }

      let booking
      try {
        const inserted = await db.insert(
          'bookings',
          [{
            customer_id: customerUuid,
            passenger: b.passenger || null,
            route: String(b.route).trim(),
            airline: b.airline || null,
            destination_country: b.destinationCountry || null,
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
        booking = inserted[0]

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
        // Reference base = the client idempotency token when present (so retries dedupe
        // even across a race that created two booking rows), else the booking id.
        const refBase = clientRef || booking.id
        let chargePosted = false
        if (total > 0) {
          const memo =
            `Flight ${booking.route}${booking.airline ? ` (${booking.airline})` : ''}` +
            (booking.booking_reference ? ` — ref ${booking.booking_reference}` : '')
          await db.insertIgnoreDup(
            'ledger',
            [{
              customer_id: customerUuid,
              charge_reference: `BOOKING-${refBase}`,
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
                charge_reference: `PAY-BOOKING-${refBase}`,
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
          customerUuid, appliesTo: 'booking', refBase,
          paidNow: !!payMethod, method: payMethod,
        })
        if (extras.total > 0) chargePosted = true

        // A £0 booking that posted no money leaves nothing on the ledger to dedupe
        // a later re-save against — so free the token, or a legitimate resubmit
        // would be refused forever. Money-bearing bookings keep the token as their
        // permanent idempotency marker (a replay hits the fast path above).
        if (keyClaimed && !chargePosted) {
          try { await db.releaseKey(`BOOKING-${clientRef}`) }
          catch (e2) { console.error('[api/bookings] token not released', clientRef, e2) }
        }

        const balance = await walletBalance(customerUuid)
        const [full] = await db.select(
          'bookings',
          `select=*,${CUSTOMER_EMBED},${PASSENGER_EMBED}&id=eq.${booking.id}`
        )
        return res.json({
          success: true, booking: toApp(full, req.staff), chargePosted,
          charged: total + extras.total, extras: extras.lines, balance, paidNow: !!payMethod,
        })
      } catch (e) {
        // Aborted after claiming but before the charge is durable: release the
        // token so a genuine retry isn't locked out. The ledger's unique key still
        // makes any charge that DID land a no-op on that retry.
        if (keyClaimed) {
          try { await db.releaseKey(`BOOKING-${clientRef}`) }
          catch (e2) { console.error('[api/bookings] token not released after error', clientRef, e2) }
        }
        throw e
      }
    }

    if (req.method === 'PUT') {
      // Flight logistics + status/notes/passengers/check-in are editable.
      // MONEY (price/booking_fee) stays immutable once charged — corrections
      // go through an explicit wallet adjustment, so the ledger stays honest.
      const { id, status, notes, passengers, checkinDone, checkinBy, checkinDate,
        passenger, route, airline, destinationCountry, bookingReference, travelDate, departureTime,
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
      if (destinationCountry !== undefined) patch.destination_country = destinationCountry || null
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
      for (const [label, v] of [['Travel date', patch.travel_date], ['Check-in date', patch.checkin_date], ['Passport expiry', patch.passport_expiry]]) {
        if (v && !ISO_DATE.test(String(v))) {
          return res.status(400).json({ success: false, error: `${label} must be a full date (year-month-day).` })
        }
      }

      const bid = encodeURIComponent(String(id))
      let updated
      if (Object.keys(patch).length) {
        updated = await db.update('bookings', `id=eq.${bid}`, patch)
      } else {
        updated = await db.select('bookings', `select=id&id=eq.${bid}`)
      }
      if (!updated.length) return res.status(404).json({ success: false, error: 'Booking not found.' })

      // Cancelling reverses the booking's ledger position — mirrors rental void
      // (idempotent net reversal). A cancelled UNPAID booking otherwise leaves
      // permanent arrears that the sweep then chases; a booking already paid nets
      // to zero, so nothing posts (the cash refund is handled at the counter).
      if (patch.status === 'Cancelled') {
        const buid = updated[0].id
        // Base charge + its payment both carry related_booking_id.
        const linked = await db.select('ledger', `select=charge_reference,amount,customer_id&related_booking_id=eq.${buid}`)
        const net = money(linked.reduce((s, e) => s + Number(e.amount), 0))
        if (linked.length && Math.abs(net) >= 0.005) {
          await db.insertIgnoreDup('ledger', [{
            customer_id: linked[0].customer_id,
            charge_reference: `BOOKING-REVERSAL-${buid}`,
            entry_type: 'manual_adjustment', // either-sign
            amount: money(-net),
            description: 'Booking cancelled — ledger position reversed',
            related_booking_id: buid,
          }], 'charge_reference')
        }
        // Auto/optional extras carry NO related_booking_id — they're keyed
        // EXTRA-…-<refBase> / PAY-EXTRA-…-<refBase>, where refBase is the client
        // token when one was sent (the UI always sends it), NOT the booking id.
        // Recover that refBase from the base BOOKING-/PAY-BOOKING- charge (which
        // does carry related_booking_id) so the extra keys actually match — a
        // stale `-${bookingId}` match reversed nothing and left the fee owing.
        let refBase = buid
        for (const r of linked) {
          const m = String(r.charge_reference || '').match(/^(?:PAY-)?BOOKING-(.+)$/)
          if (m) { refBase = m[1]; break }
        }
        const extras = await db.select('ledger',
          `select=charge_reference,amount,customer_id&charge_reference=like.*EXTRA-*-${encodeURIComponent(refBase)}`)
        const mine = extras.filter((e) => {
          const ref = String(e.charge_reference)
          return ref.endsWith(`-${refBase}`) && (ref.startsWith('EXTRA-') || ref.startsWith('PAY-EXTRA-'))
        })
        const exNet = money(mine.reduce((s, e) => s + Number(e.amount), 0))
        if (mine.length && Math.abs(exNet) >= 0.005) {
          await db.insertIgnoreDup('ledger', [{
            customer_id: mine[0].customer_id,
            charge_reference: `BOOKING-EXTRA-REVERSAL-${buid}`,
            entry_type: 'manual_adjustment',
            amount: money(-exNet),
            description: 'Booking cancelled — extra charges reversed',
            related_booking_id: buid,
          }], 'charge_reference')
        }
      }

      if (passengers !== undefined) {
        // Replace-all, with two wrinkles. First: helpers never see passport
        // fields, so a blank passport on a row they round-trip means
        // "unchanged", not "erase" — merge those back from the existing rows
        // by id. Second: the NEW rows go in before the OLD rows come out
        // (there's no transaction across PostgREST calls), so a failed insert
        // leaves the old passenger data fully intact instead of destroying
        // passports nobody can see to re-enter (sweep 2026-08-02 #16). Dates
        // were validated up front, so a failure here is the exceptional case,
        // not the malformed-input case.
        const badEditDate = badPassengerDate(passengers)
        if (badEditDate) return res.status(400).json({ success: false, error: badEditDate })
        const rows = passengerRows(String(id), passengers)
        const existing = await db.select('booking_passengers',
          `select=id,passport_number,passport_expiry,nationality,passport_issue_date,issuing_country&booking_id=eq.${bid}`)
        if (req.staff && req.staff.role !== 'owner') {
          const byId = new Map(existing.map(p => [p.id, p]))
          const sent = Array.isArray(passengers) ? passengers.filter(p => p && String(p.fullName || '').trim()) : []
          rows.forEach((row, i) => {
            const prev = byId.get(sent[i]?.id)
            if (prev) {
              // Every masked field merges back when blank — a helper's
              // round-trip of the masked read must never erase document data.
              if (!row.passport_number) row.passport_number = prev.passport_number
              if (!row.passport_expiry) row.passport_expiry = prev.passport_expiry
              if (!row.nationality) row.nationality = prev.nationality
              if (!row.passport_issue_date) row.passport_issue_date = prev.passport_issue_date
              if (!row.issuing_country) row.issuing_country = prev.issuing_country
            }
          })
        }
        if (rows.length) await db.insert('booking_passengers', rows)
        if (existing.length) {
          await db.delete('booking_passengers', `id=in.(${existing.map(p => p.id).join(',')})`)
        }
      }

      const [full] = await db.select('bookings', `select=*,${CUSTOMER_EMBED},${PASSENGER_EMBED}&id=eq.${bid}`)
      return res.json({ success: true, booking: toApp(full, req.staff) })
    }

    if (req.method === 'DELETE') {
      // Deleting is for rows that should never have existed — imported junk,
      // duplicates, typos. A booking with money on the ledger must be
      // CANCELLED instead (cancelling reverses the charges); deleting it
      // would orphan the ledger rows, so the server refuses.
      const { id } = req.body || {}
      if (!id) return res.status(400).json({ success: false, error: 'Booking id is required.' })
      const bid = encodeURIComponent(String(id))
      const linked = await db.select('ledger', `select=id&related_booking_id=eq.${bid}&limit=1`)
      if (linked.length) {
        return res.status(409).json({
          success: false,
          error: 'This booking has wallet charges — set it to Cancelled instead (that reverses the money).',
        })
      }
      await db.delete('booking_passengers', `booking_id=eq.${bid}`)
      await db.delete('bookings', `id=eq.${bid}`)
      return res.json({ success: true })
    }

    return res.status(405).end()
  } catch (e) {
    console.error('[api/bookings]', e)
    return res.status(500).json({ success: false, error: STORAGE_ERROR })
  }
}

export default withTab('bookings', handler)
