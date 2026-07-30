// Lenient importer for the rental-pool sheet (docs/RENTAL-POOL-MIGRATION.md).
//
// The governing rule: NEVER REJECT A ROW. The sheet is how the pool has really
// been run for years — holders recorded as "?Erenfeld", rentals with no end
// date, end dates 500 days stale, IMEI columns containing the word "sim?".
// An importer that validates its way to clean data would hand all of that back
// as homework to be done in Excel, alone, before the migration can even start.
// Instead every row lands, everything unparseable is preserved verbatim, and
// anything we could not confidently interpret is FLAGGED for review inside the
// app — where the customer records that can resolve it actually live.
//
// This module is pure: no I/O, no dates from the clock (pass `today` in), so
// the whole decision table is testable. scripts/import-rental-pool.mjs is the
// only thing that touches a file or the database.

// Every reason a row can land in the review queue. The UI groups by these, so
// they are stable identifiers, not sentences.
export const REVIEW = {
  HOLDER_UNCERTAIN: 'holder-uncertain',
  HOLDER_MISSING: 'holder-missing',
  DUE_DATE_MISSING: 'due-date-missing',
  DUE_DATE_PAST: 'due-date-past',
  STATUS_UNKNOWN: 'status-unknown',
  NUMBER_AMBIGUOUS: 'number-ambiguous',
  ICCID_UNCLEAR: 'iccid-unclear',
  IMEI_UNCLEAR: 'imei-unclear',
  ACCOUNT_UNCLEAR: 'account-unclear',
  NOTE_UNPARSED: 'note-unparsed',
  CARRIER_UNKNOWN: 'carrier-unknown',
}

// Human sentences for the queue. Kept beside the codes so a new reason can't
// ship without one.
export const REVIEW_LABEL = {
  [REVIEW.HOLDER_UNCERTAIN]: 'Who has this was recorded with a question mark',
  [REVIEW.HOLDER_MISSING]: 'Marked rented but nobody is named',
  [REVIEW.DUE_DATE_MISSING]: 'Marked rented with no return date',
  [REVIEW.DUE_DATE_PAST]: 'Return date has already passed',
  [REVIEW.STATUS_UNKNOWN]: 'Status was not a word we recognise',
  [REVIEW.NUMBER_AMBIGUOUS]: 'Phone number has no country code',
  [REVIEW.ICCID_UNCLEAR]: 'SIM number column held something else',
  [REVIEW.IMEI_UNCLEAR]: 'IMEI column held something else',
  [REVIEW.ACCOUNT_UNCLEAR]: 'Provider account is not an email address',
  [REVIEW.NOTE_UNPARSED]: 'A note we could not file anywhere',
  [REVIEW.CARRIER_UNKNOWN]: 'Carrier is not one we know',
}

const str = (v) => (v === null || v === undefined ? '' : String(v).trim())
const digits = (v) => str(v).replace(/\D/g, '')

// ---------- status ----------
// The sheet spells these by hand: rented/Rented, availble/available/Available,
// Pemenant/Permenat/Permenant. "permanent" is a line that lives with someone
// indefinitely — NOT a rental running late. Collapsing it into "rented" would
// put 9 lines into the overdue chase forever; collapsing it into "available"
// (which is what the old mapper's unknown-value fallback did) would offer a
// phone that is in somebody's pocket.
export function normaliseStatus(raw) {
  const s = str(raw).toLowerCase().replace(/[^a-z]/g, '')
  if (!s) return { status: 'unknown', recognised: false }
  if (s.startsWith('rent')) return { status: 'rented', recognised: true }
  if (s.startsWith('avail') || s === 'availble') return { status: 'available', recognised: true }
  if (s.startsWith('pem') || s.startsWith('perm')) return { status: 'permanent', recognised: true }
  if (s.includes('notworking') || s.includes('broken')) return { status: 'not_working', recognised: true }
  return { status: 'unknown', recognised: false }
}

// ---------- holder ----------
// A name wrapped in question marks is the operator telling us he isn't sure.
// That doubt is data: it is preserved as a flag, never silently promoted to a
// confident value and never thrown away for failing to be a customer record.
export function parseHolder(raw) {
  const v = str(raw)
  if (!v) return { name: '', uncertain: false }
  const stripped = v.replace(/\?/g, '').trim()
  const uncertain = v.includes('?')
  // A bare "?" carries no name at all — only the doubt.
  return { name: stripped, uncertain }
}

// ---------- carriers ----------
// One carrier, spelled eight ways: usmobile, Usmobile, Usmbile, usmonile,
// "Usmonile wrap", "usmobile - tmobile", "Usmobile Verizion". The sub-brand
// (AT&T / Verizon / T-Mobile) is a real distinction — US Mobile resells all
// three — so it is split out rather than flattened away.
const CARRIERS = [
  { test: /usm[obniel]*e?|usmbile/i, name: 'US Mobile', region: 'USA' },
  { test: /lebara/i, name: 'Lebara', region: 'UK' },
  { test: /golan/i, name: 'Golan', region: 'Israel' },
  { test: /fizz/i, name: 'Fizz', region: 'Canada' },
  { test: /lucky ?mobile/i, name: 'Lucky Mobile', region: 'Canada' },
  { test: /\bthree\b|^3$/i, name: 'Three', region: 'UK' },
]
const SUB_BRANDS = [
  { test: /at ?& ?t|\batt\b/i, name: 'AT&T' },
  { test: /veri[sz]i?on/i, name: 'Verizon' },
  { test: /t-?mobile/i, name: 'T-Mobile' },
]

export function parseCarrier(raw) {
  const v = str(raw)
  const hit = CARRIERS.find((c) => c.test.test(v))
  const sub = SUB_BRANDS.find((s) => s.test.test(v))
  return {
    carrier: hit ? hit.name : v || '',
    region: hit ? hit.region : '',
    subBrand: sub ? sub.name : '',
    recognised: !!hit,
    // "Usmonile wrap" — the word "wrap" means the SIM sits inside a wrap
    // device rather than a handset. Worth keeping; it explains the IMEI column.
    wrap: /wrap/i.test(v),
  }
}

// ---------- the overloaded first column ----------
// It carries four different kinds of thing, sometimes in one cell: a region
// (USA, Canada), a product type (SIM only, USA sim sold), a handset brand
// (Etolk / Etalk — the same phone, spelled twice), and a physical asset tag
// (Rental 220, rental 203). Splitting them is our job, not his.
export function splitLabel(raw) {
  const v = str(raw)
  if (!v) return {}
  const out = {}
  const tag = v.match(/rental\s*(\d+)/i)
  if (tag) out.assetTag = `Rental ${tag[1]}`
  if (/\bet[oa]lk\b/i.test(v)) out.model = 'Etalk'
  if (/\bsim only\b/i.test(v)) out.productType = 'SIM only'
  if (/\bsim sold\b/i.test(v)) out.productType = 'SIM sold'
  if (/\busa\b/i.test(v)) out.region = 'USA'
  else if (/\bcanada\b/i.test(v)) out.region = 'Canada'
  else if (/\bisrael\b/i.test(v)) out.region = 'Israel'
  // Anything we did not classify is kept verbatim rather than dropped.
  const consumed = [tag && tag[0], /\bet[oa]lk\b/i.exec(v)?.[0], /\bsim (only|sold)\b/i.exec(v)?.[0],
    /\b(usa|canada|israel)\b/i.exec(v)?.[0]].filter(Boolean)
  let rest = v
  for (const c of consumed) rest = rest.replace(c, ' ')
  rest = rest.replace(/\s+/g, ' ').trim()
  if (rest) out.labelRest = rest
  return out
}

// ---------- numbers ----------
// Most rows are full international numbers. A handful lost their country code
// somewhere (7423423058, 9298844236). We keep the digits we were given and
// flag the ambiguity rather than guessing a prefix onto a phone number — a
// wrong guess here is a number that can never be dialled or matched.
export function parseNumber(raw, carrierRegion) {
  const d = digits(raw)
  if (!d) return { number: '', ambiguous: true }
  if (d.startsWith('972') || d.startsWith('44')) return { number: d, ambiguous: false }
  if (d.length === 11 && d.startsWith('1')) return { number: d, ambiguous: false }
  // 10 digits with no country code, or 07… UK domestic form.
  if (d.length === 10 && d.startsWith('7') && carrierRegion === 'UK') {
    return { number: `44${d}`, ambiguous: false }
  }
  return { number: d, ambiguous: true }
}

// ICCID is 19–20 digits, IMEI 14–16. The columns also contain "sim?" and bare
// mobile numbers, so length is the test — and anything failing it is kept as a
// note instead of being written into a field that means something specific.
export function parseIdField(raw, { min, max }) {
  const v = str(raw)
  if (!v) return { value: '', leftover: '', clear: true }
  const d = digits(v)
  if (d.length >= min && d.length <= max) return { value: d, leftover: '', clear: true }
  return { value: '', leftover: v, clear: false }
}

export function parseAccountEmail(raw) {
  const v = str(raw)
  if (!v) return { email: '', leftover: '', clear: true }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return { email: v.toLowerCase(), leftover: '', clear: true }
  return { email: '', leftover: v, clear: false }
}

// ---------- POOL DETAILS ----------
// Five kinds of thing in one spare column: a sub-brand (AT&T, Verizion), a
// pool number (Pool 3), a payment note (paid 150 rubinstein), a renewal note
// (Yearly 6 sep 25) and a stray IMEI. Classify what we can; anything left is
// a note the operator gets asked about — not a silent deletion.
export function parsePoolDetails(raw) {
  const v = str(raw)
  if (!v) return {}
  const out = {}
  const sub = SUB_BRANDS.find((s) => s.test.test(v))
  if (sub) out.subBrand = sub.name
  const pool = v.match(/pool\s*(\w+)/i)
  if (pool) out.pool = `Pool ${pool[1]}`
  if (/\b(yearly|monthly|annual)\b/i.test(v)) out.renewalNote = v
  if (/\bpaid\b/i.test(v)) out.paymentNote = v
  const d = digits(v)
  if (d.length >= 14 && d.length <= 16) out.imei = d
  if (!sub && !pool && !out.renewalNote && !out.paymentNote && !out.imei) out.unparsed = v
  return out
}

export function parseDate(raw) {
  if (raw instanceof Date && !isNaN(raw)) return raw
  const v = str(raw)
  if (!v) return null
  const d = new Date(v)
  return isNaN(d) ? null : d
}

const iso = (d) => (d ? d.toISOString().slice(0, 10) : null)

// ---------- the row → line ----------
// `today` is injected so the overdue decision is deterministic in tests and
// reproducible if the same sheet is re-imported later.
//
// Column order in the sheet:
//   0 label  1 number  2 carrier  3 status  4 holder  5 contact
//   6 till   7 account email  8 ICCID  9 wrap IMEI  10 pool details
export function buildLine(row, { today, rowNumber }) {
  const cell = (i) => (Array.isArray(row) && row.length > i ? row[i] : null)
  const reasons = []
  const flag = (r) => { if (!reasons.includes(r)) reasons.push(r) }

  const carrier = parseCarrier(cell(2))
  const label = splitLabel(cell(0))
  const { status, recognised } = normaliseStatus(cell(3))
  if (!recognised) flag(REVIEW.STATUS_UNKNOWN)
  // An unknown carrier is how a decommissioned line ("deleted") or a provider
  // we've newly started using both look. Either way a human should see it —
  // the carrier drives the region, and a blank region prices a rental wrong.
  if (!carrier.recognised) flag(REVIEW.CARRIER_UNKNOWN)

  const { number, ambiguous } = parseNumber(cell(1), carrier.region)
  if (ambiguous) flag(REVIEW.NUMBER_AMBIGUOUS)

  const holder = parseHolder(cell(4))
  const due = parseDate(cell(6))
  const iccid = parseIdField(cell(8), { min: 18, max: 22 })
  const imei = parseIdField(cell(9), { min: 14, max: 16 })
  const account = parseAccountEmail(cell(7))
  const pool = parsePoolDetails(cell(10))

  if (!iccid.clear) flag(REVIEW.ICCID_UNCLEAR)
  if (!imei.clear) flag(REVIEW.IMEI_UNCLEAR)
  if (!account.clear) flag(REVIEW.ACCOUNT_UNCLEAR)
  if (pool.unparsed) flag(REVIEW.NOTE_UNPARSED)

  // Holder rules apply to lines that are OUT (rented or permanent). An
  // available line's name is history — see below — so a missing one is normal.
  const isOut = status === 'rented' || status === 'permanent'
  if (holder.uncertain) flag(REVIEW.HOLDER_UNCERTAIN)
  if (isOut && !holder.name) flag(REVIEW.HOLDER_MISSING)

  // Only a rental has a return date. A permanent line is with someone by
  // arrangement, so no date is expected and none is chased.
  if (status === 'rented') {
    if (!due) flag(REVIEW.DUE_DATE_MISSING)
    else if (due < today) flag(REVIEW.DUE_DATE_PAST)
  }

  // 15 available lines still carry the last holder's name. Treating that as
  // the CURRENT holder would show 15 free phones as rented on day one — and
  // the operator would rightly conclude the app had got his pool wrong.
  const heldBy = isOut ? holder.name : ''
  const lastHeldBy = isOut ? '' : holder.name

  return {
    phone: {
      // Stable and derived from the number, so re-running the import updates
      // rows in place instead of duplicating the pool.
      id: `pool-${number || `row${rowNumber}`}`,
      number,
      country: label.region || carrier.region || '',
      company: carrier.carrier,
      subBrand: pool.subBrand || carrier.subBrand || '',
      model: label.model || '',
      assetTag: label.assetTag || '',
      productType: label.productType || '',
      pool: pool.pool || '',
      poolExpiry: null,
      simId: iccid.value,
      imei: imei.value || pool.imei || '',
      email: account.email,
      status,
      isWrap: carrier.wrap,
      heldByNote: heldBy,
      lastHeldByNote: lastHeldBy,
      holderUncertain: holder.uncertain,
      customerId: null,               // resolved by a human in the review queue
      dueDate: iso(due),
      contactNumber: digits(cell(5)) || '',
      needsReview: reasons.length > 0,
      reviewReasons: reasons,
      // Everything the columns said, verbatim. Nothing in this import is
      // lossy: if a rule above guessed wrong, the original is right here.
      importSource: { sheet: 'Rental', row: rowNumber, raw: (row || []).map((c) => str(c)) },
      notes: [pool.renewalNote, pool.paymentNote, pool.unparsed, label.labelRest,
        iccid.leftover && `SIM column said: ${iccid.leftover}`,
        imei.leftover && `IMEI column said: ${imei.leftover}`,
        account.leftover && `Account column said: ${account.leftover}`,
      ].filter(Boolean).join(' · '),
      currentRental: null,
    },
    reasons,
  }
}

// Whole-sheet pass. Returns the lines plus a summary the import script prints
// and the owner reads — the numbers are the point of the migration, so they
// are computed here rather than eyeballed.
export function buildPool(rows, { today }) {
  const lines = []
  const counts = {}
  for (let i = 0; i < rows.length; i++) {
    const { phone, reasons } = buildLine(rows[i], { today, rowNumber: i + 2 })
    lines.push(phone)
    for (const r of reasons) counts[r] = (counts[r] || 0) + 1
  }
  const byStatus = {}
  for (const l of lines) byStatus[l.status] = (byStatus[l.status] || 0) + 1
  return {
    lines,
    summary: {
      total: lines.length,
      byStatus,
      needsReview: lines.filter((l) => l.needsReview).length,
      reasons: counts,
      duplicateNumbers: lines.length - new Set(lines.map((l) => l.number)).size,
    },
  }
}
