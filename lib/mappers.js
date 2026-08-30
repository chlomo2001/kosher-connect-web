// Pure app-shape ⇄ table-row mappers for the transitional data layer.
// No I/O here — unit-testable with plain node.
//
// Contract: legacy_extras stores the COMPLETE app object, so reading back is
// an exact round-trip regardless of how much the typed projection captures.
// The typed columns exist for SQL, FK integrity, and the post-cutover world.

import { normalizeUkNumber, formatPhoneDisplay } from './ukPhone.mjs'
import { canonProvider } from './simProvider.mjs'
import { withProvenance, stripProvenance } from './provenance.mjs'

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
/**
 * A number, or null when there isn't one.
 *
 * NULL AND '' ARE NOT ZERO, and this used to say they were: `Number(null)` is
 * 0 and `Number('')` is 0, both finite, so "no value" arrived at the database
 * as an explicit zero. On 30 Aug that took the whole SIM save down — a
 * through-me line with no direct-debit day mapped to dd_collection_day 0, the
 * CHECK demands 1-31, and because the sync upserts all 797 rows in one batch,
 * one bad row meant NOTHING saved for anybody.
 *
 * `undefined` was already handled (NaN → null). The two that were not are the
 * two a form actually produces: an empty input and a field explicitly cleared.
 */
const numOrNull = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * A day of the month, or null. The column carries
 * `CHECK (dd_collection_day BETWEEN 1 AND 31)`, so anything else is not a
 * smaller problem than a wrong day — it is a failed write for every SIM in the
 * shop. A mapper owes the database a value the database will accept.
 */
const dayOrNull = (v) => {
  const n = numOrNull(v)
  return n !== null && Number.isInteger(n) && n >= 1 && n <= 31 ? n : null
}

// ---------- customers ----------

// Every word in a name gets a capital first letter ("moshe chaim" → "Moshe
// Chaim", "cohen-levi" → "Cohen-Levi"). Only LOWERCASE first letters are
// touched, so "McDonald" keeps its capital D and an all-caps passport name
// stays as typed — which is why this is not initcap(), whose lowercasing of
// the remainder would flatten both.
//
// This lives here, at the write boundary, because the browser copy in
// public/main.js only runs on the customer form. Everything that does not go
// through that form — the ELID import, the legacy import script, the merge
// routes — wrote names exactly as the source had them, which is how 31
// production customers ended up as "yossy-adler". test/nameCase.test.mjs holds
// the two copies to the same behaviour.
// After an apostrophe the letter is only capitalised when two or more letters
// follow it: "o'brien" → "O'Brien", but the "m" in "I'm" is left alone. The
// old rule treated every apostrophe as a word break, which turned a real
// production record — "Thaler I'm Paying" — into "Thaler I'M Paying".
export function capName(s) {
  return String(s || '').trim()
    .replace(/(^|[\s\-])([a-zà-ÿ])/g, (m, sep, ch) => sep + ch.toUpperCase())
    .replace(/(['’])([a-zà-ÿ])(?=[a-zà-ÿ])/g, (m, sep, ch) => sep + ch.toUpperCase())
}

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
    // created_at is deliberately NOT sent. It is a creation stamp: a
    // merge-upsert has no business rewriting one, and omitting it lets the
    // column default fill it on insert and keeps the stored value on update.
    //
    // It also has to be omitted CONSISTENTLY. db.uniformRows levels a batch by
    // filling each row's missing keys with explicit nulls — necessary, because
    // PostgREST rejects a mixed batch whole (PGRST102). Send this key on some
    // rows and not others and every row without it gets created_at = null,
    // which a `not null default now()` column refuses: 23502, and the WHOLE
    // batch fails. That is exactly what happened to sims. All 796 stored rows
    // lack createdAt in their blob, a newly added SIM carries one, so the new
    // row made the batch mixed and killed every save from 19 Jul to 20 Aug —
    // silently, because the caller never awaited the result.
    // Provenance lives in columns, never in the blob (lib/provenance.mjs).
    legacy_extras: stripProvenance(c),
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
    // From the columns, and only the columns — see lib/provenance.mjs.
    dataSource: row.data_source || 'app',
    verifiedAt: row.verified_at || null,
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
  return driftBetween(row, derived, fields)
}

// Issue #14 — the same detector for the three tables where drift was
// INVISIBLE: sims, rentals and lines are blob-only reads (tableStore.listApp),
// so their typed columns are write-only and a disagreement has no symptom
// until the day something starts reading them. Each returns the mismatched
// fields, empty = in sync. FK columns (customer_id, line_id) are deliberately
// not here: they need a lookup to judge, which the sweep does with the
// customer list it already holds.
function driftBetween(row, derived, fields) {
  const diffs = []
  for (const f of fields) {
    const a = row[f] ?? null
    const b = derived[f] ?? null
    if (String(a ?? '') !== String(b ?? '')) diffs.push({ field: f, typed: a, derived: b })
  }
  return diffs
}

export function simDrift(row) {
  return driftBetween(row, simToRow(row.legacy_extras || {}), [
    'provider', 'billing_option', 'next_renewal_date', 'paid_by',
    'provider_monthly_cost', 'dd_collection_day', 'status',
  ])
}

export function rentalDrift(row) {
  return driftBetween(row, rentalToRow(row.legacy_extras || {}), [
    'country_code', 'start_date', 'end_date', 'vn_selection', 'vn_prefix',
    'chargeable_days', 'calendar_days', 'base_charge', 'late_fee',
    'damage_charges', 'total_charge', 'status', 'discount_type',
    'discount_value', 'notes',
  ])
}

export function lineDrift(row) {
  return driftBetween(row, phoneToRow(row.legacy_extras || {}), [
    'number', 'region', 'carrier', 'iccid', 'wrap_imei', 'status', 'notes',
  ])
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

export function phoneToRow(p) {
  return {
    legacy_id: String(p.id),
    number: p.number || null,
    region: p.country || null,
    carrier: p.company || null,
    // US Mobile is an MVNO on AT&T, Verizon and T-Mobile, and which one a line
    // rides decides whether it has signal in a given town. The column has been
    // here since the schema was written and nothing ever filled it in.
    sub_brand: p.subBrand || null,
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
    // `_rev` is the row's own updated_at, handed to the client by listRentals so
    // a stale tab can be spotted (task #48). It is a property OF the row, not a
    // fact about the rental, and writing it into the blob would put a value in
    // there that changes on every save and disagrees with the column beside it
    // the moment the trigger fires.
    legacy_extras: stripRev(r),
  }
}

const stripRev = (r) => {
  if (!r || r._rev === undefined) return r
  const { _rev, ...rest } = r
  return rest
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
  // One spelling per carrier, applied on the way in so the counter can keep
  // typing "lebara" and the data stays clean. It has to land in legacy_extras
  // as well as the column: the app reads SIMs back from the blob (listApp →
  // rowToApp), so a column-only fix would be invisible on screen AND undone by
  // the next sync, which writes the app's own spelling back over it.
  const provider = canonProvider(s.provider) || null
  return {
    legacy_id: String(s.id),
    customer_id: customerUuid,
    provider,
    billing_option: 'per_service', // app has no annual-plan concept yet
    next_renewal_date: dateOrNull(s.renewalDate),
    // THE DICTIONARY, both ends. Who pays the network is spelled three ways:
    //   app blob   paymentType  'through-me' | 'direct'
    //   DB column  paid_by      'kc'         | 'customer'
    //   on screen               'Through me' | 'Customer pays directly'
    // and the only thing linking them is the inversion on this line. The app
    // value is the question "does the shop front the money"; the column value
    // is the answer "who pays the provider", so the two read in opposite
    // directions and a maintainer matching them by eye will get it backwards.
    //
    // The default matters too: anything that is not exactly 'direct' is
    // through-me, so an unknown or missing value means THE SHOP fronts the
    // renewal and bills the wallet later. That is a money decision, and it is
    // made by an inequality with no comment on it anywhere else.
    paid_by: throughMe ? 'kc' : 'customer',
    provider_monthly_cost: throughMe ? numOrNull(s.simMonthlyCost) : null,
    dd_collection_day: throughMe ? dayOrNull(s.ddDate) : null,
    status: SIM_STATUSES.includes(s.status) ? s.status : 'active',
    // The blob stays the complete app object (the round-trip contract) — the
    // one field corrected is the one we just canonicalised, and provenance is
    // stripped because it belongs to the columns (lib/provenance.mjs).
    legacy_extras: stripProvenance(s.provider && provider !== s.provider ? { ...s, provider } : s),
  }
}

// ---------- read-back (exact round-trip via extras) ----------

export const rowToApp = (row) => row.legacy_extras
