// Pure app-shape ⇄ table-row mappers for the transitional data layer.
// No I/O here — unit-testable with plain node.
//
// Contract: legacy_extras stores the COMPLETE app object, so reading back is
// an exact round-trip regardless of how much the typed projection captures.
// The typed columns exist for SQL, FK integrity, and the post-cutover world.

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

// App stores phone as one string: "+44 7911 123456". Split for the
// (phone_country_code, phone_number) unique key.
export function splitPhone(full) {
  const s = String(full || '').trim()
  if (!s) return { code: null, number: null }
  const m = s.match(/^(\+\d+)\s+(.+)$/)
  if (m) return { code: m[1], number: m[2].trim() }
  return { code: null, number: s }
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

// ---------- phones → lines ----------

const LINE_STATUSES = ['available', 'rented', 'suspended', 'retired']

export function phoneToRow(p) {
  return {
    legacy_id: String(p.id),
    number: p.number || null,
    region: p.country || null,
    carrier: p.company || null,
    iccid: p.simId || null,
    wrap_imei: p.imei || null,
    status: LINE_STATUSES.includes(p.status) ? p.status : 'available',
    notes: p.notes || null,
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
  // The carrier password is a secret — it must NEVER sit in the plaintext
  // legacy_extras blob (which reads return verbatim). Strip it here; the
  // ciphertext is written to the password_encrypted column by syncSims.
  const { password, ...extrasNoPassword } = s
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
    legacy_extras: extrasNoPassword,
  }
}

// ---------- read-back (exact round-trip via extras) ----------

export const rowToApp = (row) => row.legacy_extras
