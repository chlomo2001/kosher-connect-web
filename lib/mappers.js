// Pure app-shape ⇄ table-row mappers for the transitional data layer.
// No I/O here — unit-testable with plain node.
//
// Contract: legacy_extras stores the COMPLETE app object, so reading back is
// an exact round-trip regardless of how much the typed projection captures.
// The typed columns exist for SQL, FK integrity, and the post-cutover world.

import { normalizeUkNumber, formatPhoneDisplay } from './ukPhone.mjs'

const ITEMS = ['phone', 'sim', 'plug', 'cable']

// Matches the app's normalizeEmail (public/main.js): lowercase, strip dots in
// the local part, strip +suffix.
export function normalizeEmail(raw) {
  const s = String(raw || '').trim().toLowerCase()
  if (!s || !s.includes('@')) return null
  const [local, domain] = s.split('@')
  const cleaned = local.split('+')[0].replace(/\./g, '')
  return cleaned ? `${cleaned}@${domain}` : null
}

// Sign-in email equality. Gmail ignores dots and +tags in the local part
// (e.a.rothbart == earothbart), so Google may report a different spelling
// than the one on record; other providers get exact matching only, since
// for them dots can be significant.
export function emailsMatchLoose(a, b) {
  const na = String(a || '').trim().toLowerCase()
  const nb = String(b || '').trim().toLowerCase()
  if (!na || !nb || !na.includes('@') || !nb.includes('@')) return false
  if (na === nb) return true
  const gmailKey = (s) => {
    const [local, domain] = s.split('@')
    if (domain !== 'gmail.com' && domain !== 'googlemail.com') return null
    const cleaned = local.split('+')[0].replace(/\./g, '')
    return cleaned ? `${cleaned}@gmail.com` : null
  }
  const ka = gmailKey(na)
  return ka != null && ka === gmailKey(nb)
}

// App stores phone as one string: "+44 7911 123456". Split for the
// (phone_country_code, phone_number) unique key.
//
// Canonicalise BEFORE splitting (sweep 2026-08-02 #17): the old split kept
// whatever spacing arrived, so '+44 7911 123456', '+447911123456' and
// '07911 123456' produced three DIFFERENT (code, number) pairs and the unique
// index treated one person as three. Every format now collapses to one pair
// of digits, which is what makes the index actually bind.
export function splitPhone(full) {
  const s = String(full || '').trim()
  if (!s) return { code: null, number: null }
  const n = normalizeUkNumber(s)
  const cc = ['+972', '+44', '+1'].find((c) => n.startsWith(c)) ||
    (n.match(/^(\+\d{2})\d/) || [])[1] || null
  if (cc) return { code: cc, number: n.slice(cc.length) }
  return { code: null, number: n } // sender IDs, short codes, oddities
}

const dateOrNull = (v) => {
  const s = String(v || '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}
const numOrNull = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// ---------- customers ----------

export function customerToRow(c) {
  const { code, number } = splitPhone(c.phone)
  return {
    legacy_id: String(c.id),
    first_name: c.firstName || '',
    last_name: c.lastName || null,
    phone_country_code: code,
    phone_number: number,
    has_whatsapp: !!c.hasWhatsapp,
    email_raw: c.email || null,
    email_normalized: normalizeEmail(c.email),
    address: c.address || null,
    passport_on_file: !!c.passportOnFile,
    notes: c.notes || null,
    ...(c.createdAt ? { created_at: c.createdAt } : {}),
    legacy_extras: c,
  }
}

// #19 — reconstruct the app-shaped customer from the TYPED columns, making them
// authoritative for the fields they cover, and merging the app-only remainder
// (history, services, commLog, tasks, totalPaid…) from legacy_extras so nothing
// is lost. This flips customers off the "read legacy_extras verbatim" path so
// the typed projection stops being a write-only dead shadow.
export function customerRowFromTyped(row) {
  const extras = row.legacy_extras || {}
  // Typed columns hold canonical digits; the app string gets the human
  // grouping (the owner's 4-3-3 for UK mobiles). Round-trip safe: splitPhone
  // normalises the grouping straight back out.
  const phone = row.phone_country_code && row.phone_number
    ? formatPhoneDisplay(`${row.phone_country_code}${row.phone_number}`)
    : (row.phone_number || extras.phone || '')
  return {
    ...extras, // app-only fields first…
    // …then the typed columns win for everything they represent:
    id: String(row.legacy_id ?? extras.id ?? ''),
    firstName: row.first_name ?? extras.firstName ?? '',
    lastName: row.last_name ?? extras.lastName ?? '',
    phone,
    hasWhatsapp: !!row.has_whatsapp,
    email: row.email_raw ?? extras.email ?? '',
    address: row.address ?? extras.address ?? '',
    passportOnFile: !!row.passport_on_file,
    notes: row.notes ?? extras.notes ?? '',
    createdAt: row.created_at ?? extras.createdAt,
  }
}

// #19 — drift detector: does a stored row's typed columns match what
// customerToRow would derive from its legacy_extras? Returns the mismatched
// fields (empty = in sync). Used to catch silent rot between the two.
export function customerDrift(row) {
  const derived = customerToRow(row.legacy_extras || {})
  const fields = [
    'first_name', 'last_name', 'phone_country_code', 'phone_number',
    'email_raw', 'email_normalized', 'address', 'passport_on_file',
    'has_whatsapp', 'notes',
  ]
  const diffs = []
  for (const f of fields) {
    const a = row[f] ?? null
    const b = derived[f] ?? null
    if (String(a ?? '') !== String(b ?? '')) diffs.push({ field: f, typed: a, derived: b })
  }
  return diffs
}

// ---------- phones → lines ----------

// 'permanent'  — the line lives with someone indefinitely, by arrangement.
//                Not a rental running late: it has no return date and must
//                never appear in the overdue chase.
// 'not_working' — broken or dead. Not stock.
// 'unknown'    — the source said something we could not read. Deliberately a
//                real state rather than a guess; the review queue asks.
//
// All three are OUT OF STOCK. The old list stopped at rented/suspended/retired
// and the fallback below silently rewrote anything else to 'available' — which
// on the 114-line pool import would have offered out 9 phones sitting in
// customers' pockets and 2 that don't work. An unknown status now lands on
// 'unknown', where it is visible, instead of on the one value that means
// "safe to rent".
const LINE_STATUSES = ['available', 'rented', 'permanent', 'not_working', 'suspended', 'retired', 'unknown']
export const RENTABLE_STATUSES = ['available']

export function phoneToRow(p) {
  return {
    legacy_id: String(p.id),
    number: p.number || null,
    region: p.country || null,
    carrier: p.company || null,
    iccid: p.simId || null,
    wrap_imei: p.imei || null,
    status: LINE_STATUSES.includes(p.status) ? p.status : 'unknown',
    notes: p.notes || null,
    // The app object is the source of truth; the typed columns above are a
    // projection for querying. Everything the importer learned — heldByNote,
    // reviewReasons, importSource — rides along here without a migration.
    legacy_extras: p,
  }
}

// ---------- rentals ----------

// App country values: USA / UK / Israel / EU / Canada. UK splits by the
// phone's plan into the two priced UK codes; a USA phone rented without a
// SIM prices on the no-SIM row (same mapping as public/main.js
// pricedCountryCode).
export function rentalCountryCode(country, ukPlan, simGiven = true) {
  if (country === 'UK') return ukPlan === 'unlimited' ? 'UK-Intl' : 'UK-UKmins'
  if (country === 'USA' && simGiven === false) return 'USA-NoSIM'
  if (['USA', 'Israel', 'Canada', 'EU'].includes(country)) return country
  return 'USA' // unknown → priced on the app's default branch; raw kept in extras
}

const RENTAL_STATUSES = ['booked', 'active', 'overdue', 'returned']
const DISCOUNT_TYPES = ['percent', 'fixed']

export function rentalToRow(r, customerUuid, lineUuid) {
  const lateFee = numOrNull(r.lateFee)
  const lost = numOrNull(r.lostChargesTotal)
  const price = numOrNull(r.price)
  const hasDiscount =
    DISCOUNT_TYPES.includes(r.discountType) && numOrNull(r.discountValue) > 0
  return {
    legacy_id: String(r.id),
    customer_id: customerUuid,
    line_id: lineUuid,
    country_code: rentalCountryCode(r.country, r.ukPlan, r.equipmentGiven?.sim !== false),
    start_date: dateOrNull(r.fromDate),
    end_date: dateOrNull(r.toDate),
    vn_selection: !r.vn ? 'none' : r.vnSub === 'weekly' ? 'weekly' : 'per_30_days',
    vn_prefix: r.vnPrefix || null,
    chargeable_days: numOrNull(r.chargeableDays),
    calendar_days: numOrNull(r.totalDays),
    base_charge: price,
    late_fee: lateFee,
    damage_charges: lost,
    total_charge: price === null ? null : price + (lateFee || 0) + (lost || 0),
    status: RENTAL_STATUSES.includes(r.status) ? r.status : 'active',
    discount_type: hasDiscount ? r.discountType : null,
    discount_value: hasDiscount ? numOrNull(r.discountValue) : null,
    notes: r.notes || null,
    ...(r.createdAt ? { created_at: r.createdAt } : {}),
    legacy_extras: r,
  }
}

// Per-item rows carrying the A-series model. Mirrors getItemStatus's
// back-compat: itemStatus wins, legacy returnedItems===true means 'returned'.
export function rentalItemRows(r, rentalUuid) {
  const eq = r.equipmentGiven || { phone: true, sim: true, plug: true, cable: true }
  return ITEMS.map((item) => {
    const status =
      r.itemStatus?.[item] !== undefined
        ? r.itemStatus[item]
        : r.returnedItems?.[item] === true
          ? 'returned'
          : 'undecided'
    const safe = ['undecided', 'returned', 'lost'].includes(status) ? status : 'undecided'
    const charge = safe === 'lost' ? numOrNull(r.lostCharges?.[item]) : null
    return {
      rental_id: rentalUuid,
      item,
      given: eq[item] ?? true,
      status: safe,
      lost_charge: charge,
    }
  })
}

// ---------- sims ----------

const SIM_STATUSES = ['active', 'renewal_pending', 'cancelled', 'suspended']

export function simToRow(s, customerUuid) {
  const throughMe = s.paymentType !== 'direct'
  return {
    legacy_id: String(s.id),
    customer_id: customerUuid,
    provider: s.provider || null,
    billing_option: 'per_service', // app has no annual-plan concept yet
    next_renewal_date: dateOrNull(s.renewalDate),
    paid_by: throughMe ? 'kc' : 'customer',
    provider_monthly_cost: throughMe ? numOrNull(s.simMonthlyCost) : null,
    dd_collection_day: throughMe ? numOrNull(s.ddDate) : null,
    status: SIM_STATUSES.includes(s.status) ? s.status : 'active',
    ...(s.createdAt ? { created_at: s.createdAt } : {}),
    legacy_extras: s,
  }
}

// ---------- read-back (exact round-trip via extras) ----------

export const rowToApp = (row) => row.legacy_extras
