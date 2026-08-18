// Travel entry-requirement rules for Kosher Connect's common routes.
//
// PROTOTYPE / preview of what will become an owner-editable table. Every
// result is GUIDANCE ONLY — the UI must always show "confirm on the official
// site". Rules reflect the position in 2026 for SHORT visits (tourism /
// family, under ~90 days) and are deliberately conservative: anything
// uncertain returns CHECK, never a confident wrong answer.
//
// Pure module (no I/O) so it can be unit-tested and run identically on the
// server (sweep) and — mirrored — in the browser panel.

// ── Authorisation kinds ──────────────────────────────────────────────────
// Each carries the official application site and the typical validity so the
// panel can say "ESTA, valid ~2 years, apply at esta.cbp.dhs.gov".
export const AUTH = {
  ESTA:   { code: 'ESTA',   label: 'ESTA',              scheme: 'US visa-waiver',   validityMonths: 24, url: 'https://esta.cbp.dhs.gov' },
  ETA_CA: { code: 'ETA_CA', label: 'Canada eTA',        scheme: 'Canada eTA',       validityMonths: 60, url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/eta.html' },
  ETA_IL: { code: 'ETA_IL', label: 'Israel ETA-IL',     scheme: 'Israel ETA',       validityMonths: 24, url: 'https://israel-entry.piba.gov.il/' },
  ETIAS:  { code: 'ETIAS',  label: 'ETIAS (Europe)',    scheme: 'Schengen ETIAS',   validityMonths: 36, url: 'https://travel-europe.europa.eu/etias_en' },
  ETA_UK: { code: 'ETA_UK', label: 'UK ETA',            scheme: 'UK ETA',           validityMonths: 24, url: 'https://www.gov.uk/apply-uk-eta' },
  VISA:   { code: 'VISA',   label: 'Visa (apply ahead)', scheme: 'Visa',            validityMonths: null, url: null },
  NONE:   { code: 'NONE',   label: 'Passport only',     scheme: null,               validityMonths: null, url: null },
  CHECK:  { code: 'CHECK',  label: 'Check officially',  scheme: null,               validityMonths: null, url: null },
}

// ── Normalisers ──────────────────────────────────────────────────────────
// Passenger.nationality and the booking destination are free text entered at
// the counter ("British", "UK", "Israeli", "United States"…). Fold the common
// forms down to a short code we can switch on. Unknown → '' (→ CHECK).
const NAT = [
  ['GB', /^(gb|uk|brit|england|scot|wales|welsh|northern irel|united kingdom)/],
  ['US', /^(us|usa|american|united states)/],
  ['IL', /^(il|isr|israel)/],
  ['CA', /^(ca|can|canadian|canada)/],
  ['BE', /^(be|belg|belgium)/],
  ['CH', /^(ch|swiss|switzerl)/],
  ['HU', /^(hu|hung|magyar|hungary)/],
  ['AT', /^(at|austri)/], // Austria / Austrian
]
export function natCode(input) {
  const s = String(input || '').trim().toLowerCase()
  if (!s) return ''
  // two-letter code fast path
  const two = s.slice(0, 2).toUpperCase()
  if (['GB','US','IL','CA','BE','CH','HU','AT'].includes(two) && s.length <= 3) return two
  for (const [code, re] of NAT) if (re.test(s)) return code
  return ''
}

const DEST = [
  ['US', /(^|\b)(usa?|america|united states|new york|jfk|ewr|miami|los angeles|lax)/],
  ['IL', /(^|\b)(israel|tel aviv|tlv|ben gurion|jerusalem|eretz)/],
  ['CA', /(^|\b)(canada|toronto|yyz|montreal|yul)/],
  ['UK', /(^|\b)(uk|united kingdom|england|london|manchester|man\b|lhr|ltn|stn)/],
  ['EU', /(^|\b)(europe|schengen|belgium|brussels|antwerp|vienna|austria|zurich|switzerland|geneva|budapest|hungary|paris|amsterdam|berlin|spain|italy)/],
]
export function destCode(input) {
  const s = String(input || '').trim().toLowerCase()
  if (!s) return ''
  const two = s.slice(0, 2).toUpperCase()
  if (['US','IL','CA','UK','EU'].includes(two) && s.length <= 3) return two
  // A route like "MAN → JFK": look at the part after an arrow/hyphen/"to".
  const tail = s.split(/→|->|—|--|\bto\b|\/|,/).pop()
  for (const [code, re] of DEST) if (re.test(tail) || re.test(s)) return code
  return ''
}

// The set the prototype is seeded for, so the UI can offer a clean picker.
export const KNOWN_DESTINATIONS = [
  { code: 'US', name: 'USA' },
  { code: 'IL', name: 'Israel' },
  { code: 'CA', name: 'Canada' },
  { code: 'EU', name: 'Europe (Schengen)' },
  { code: 'UK', name: 'United Kingdom' },
]

// ── The matrix ───────────────────────────────────────────────────────────
// destination × nationality → authorisation type. This is the built-in
// DEFAULT; the owner-editable rules table (travel_requirement_rules) overrides
// it when rows are passed to requirementFor(). Home country → NONE.
const MATRIX = {
  US: { GB: 'ESTA', US: 'NONE', IL: 'ESTA', CA: 'NONE', BE: 'ESTA', CH: 'ESTA', HU: 'ESTA', AT: 'ESTA' },
  IL: { GB: 'ETA_IL', US: 'ETA_IL', IL: 'NONE', CA: 'ETA_IL', BE: 'ETA_IL', CH: 'ETA_IL', HU: 'ETA_IL', AT: 'ETA_IL' },
  CA: { GB: 'ETA_CA', US: 'NONE', IL: 'CHECK', CA: 'NONE', BE: 'ETA_CA', CH: 'ETA_CA', HU: 'ETA_CA', AT: 'ETA_CA' },
  EU: { GB: 'NONE', US: 'NONE', IL: 'NONE', CA: 'NONE', BE: 'NONE', CH: 'NONE', HU: 'NONE', AT: 'NONE' },
  UK: { GB: 'NONE', US: 'ETA_UK', IL: 'ETA_UK', CA: 'ETA_UK', BE: 'ETA_UK', CH: 'ETA_UK', HU: 'ETA_UK', AT: 'ETA_UK' },
}
const NUANCE = {
  'CA:IL': 'Israeli passport holders usually need a visitor visa for Canada — an eTA only if they hold a valid US visa or held a Canadian visa in the last 10 years.',
  'EU:GB': 'No visa for short stays; ETIAS is expected to become required for UK passports — confirm before travel.',
  'EU:US': 'No visa for short stays; ETIAS is expected to become required — confirm before travel.',
  'EU:CA': 'No visa for short stays; ETIAS is expected to become required — confirm before travel.',
  'EU:IL': 'No visa for short stays; ETIAS is expected to become required — confirm before travel.',
}

// The built-in matrix as flat rows — used to seed the editable table and as the
// fallback when no DB rules are supplied. Codes only (already normalised).
export const BUILTIN_RULES = Object.entries(MATRIX).flatMap(([dest, row]) =>
  Object.entries(row).map(([nat, authType]) => ({
    destination: dest, nationality: nat, auth_type: authType, note: NUANCE[`${dest}:${nat}`] || '', active: true,
  })))

// The nationalities the prototype is seeded for (for the Settings picker).
export const KNOWN_NATIONALITIES = [
  { code: 'GB', name: 'British' }, { code: 'US', name: 'American' }, { code: 'IL', name: 'Israeli' },
  { code: 'CA', name: 'Canadian' }, { code: 'BE', name: 'Belgian' }, { code: 'CH', name: 'Swiss' },
  { code: 'HU', name: 'Hungarian' }, { code: 'AT', name: 'Austrian' },
]

// Public: what does this passenger need for this trip? Pass `rules` (rows from
// travel_requirement_rules, codes in .destination/.nationality/.auth_type) to
// use the owner's edited matrix; omit to use the built-in default.
export function requirementFor({ destination, nationality, rules }) {
  const dest = destCode(destination)
  const nat = natCode(nationality)
  if (!dest) return { ...AUTH.CHECK, dest: '', nat, reason: 'destination-unknown', note: 'Set the trip destination to see what’s needed.' }
  if (!nat) return { ...AUTH.CHECK, dest, nat: '', reason: 'nationality-unknown', note: 'Add this traveller’s passport nationality to see what’s needed.' }
  let type, note = null
  if (Array.isArray(rules) && rules.length) {
    const r = rules.find((x) => x.destination === dest && x.nationality === nat && x.active !== false && x.auth_type)
    if (r) { type = r.auth_type; note = r.note || null }
  }
  if (!type) { // fall back to the built-in default
    type = (MATRIX[dest] && MATRIX[dest][nat]) || 'CHECK'
    note = NUANCE[`${dest}:${nat}`] || null
  }
  const auth = AUTH[type] || AUTH.CHECK
  return { ...auth, dest, nat, reason: auth.code === 'NONE' && nat === homeNat(dest) ? 'home' : 'rule', note }
}

function homeNat(dest) {
  return { US: 'US', CA: 'CA', IL: 'IL', UK: 'GB', EU: '' }[dest] || ''
}

// ── When the trip ends ───────────────────────────────────────────────────
// A document has to outlive the JOURNEY, not the departure. Owner, 18 Aug:
// "sometimes we do 2 airlines for there and 2 additional for back.. all for
// one person's one time 2-way journey" — and a passport or an ETA that dies
// while the customer is abroad is a worse problem than one that died before
// they left, because they are already there. A rule keyed on the outbound date
// cannot see it, so every rule below judges on the last date the app knows.
//
// The last date is the return when there is one and it is later; otherwise the
// travel date. A one-way booking is unchanged by all of this.
export function tripEnd({ travelDate, returnDate } = {}) {
  const ok = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''))
  const out = ok(travelDate) ? String(travelDate) : ''
  const back = ok(returnDate) ? String(returnDate) : ''
  if (!out) return back
  if (!back) return out
  return back > out ? back : out
}

// ── Passport validity ────────────────────────────────────────────────────
// Conservative universal prompt: most destinations want the passport valid
// for ~6 months beyond the trip. Returns ok=null when we don't hold an expiry.
export function passportCheck({ passportExpiry, travelDate, returnDate, monthsRequired = 6 }) {
  if (!passportExpiry) return { ok: null, note: 'No passport expiry on file.' }
  const exp = new Date(passportExpiry + 'T00:00:00Z')
  if (Number.isNaN(exp.getTime())) return { ok: null, note: 'Passport expiry not readable.' }
  const last = tripEnd({ travelDate, returnDate })
  const twoWay = !!last && last !== String(travelDate || '')
  const travel = last ? new Date(last + 'T00:00:00Z') : null
  // The date the passport must still be valid *to*: trip end + required months.
  const base = travel && !Number.isNaN(travel.getTime()) ? travel : new Date(Date.UTC(1970, 0, 1))
  const needBy = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + monthsRequired, base.getUTCDate()))
  const ok = exp.getTime() >= needBy.getTime()
  const daysToExpiry = travel ? Math.round((exp - travel) / 86400000) : null
  return {
    ok,
    daysToExpiry,
    tripEnd: last,
    needBy: needBy.toISOString().slice(0, 10),
    note: ok
      ? null
      : `Passport should be valid until at least ${needBy.toISOString().slice(0, 10)} (≈${monthsRequired} months after ${twoWay ? 'the return' : 'travel'}).`,
  }
}

// ── Recorded-authorisation coverage ──────────────────────────────────────
// Given the requirement and any stored authorisations for a traveller, decide
// the status shown on the panel and whether a reminder is warranted.
// auths: [{ type, country, valid_until }]. status ∈ covered|missing|expiring|
// not-needed|check.
// `expiresBeforeTravel` means before the trip is OVER — an ETA that runs out
// mid-holiday leaves someone in the country without one, so it is the same
// answer as one that had already run out on the day they flew.
export function coverageStatus({ requirement, travelDate, returnDate, auths = [], warnDays = 30 }) {
  const code = requirement.code
  if (code === 'NONE') return { status: 'not-needed' }
  if (code === 'CHECK' || code === 'VISA') return { status: 'check' }
  const match = auths.find(a => (a.type === code))
  if (!match || !match.valid_until) return { status: 'missing' }
  const validUntil = new Date(match.valid_until + 'T00:00:00Z')
  const last = tripEnd({ travelDate, returnDate })
  const travel = last ? new Date(last + 'T00:00:00Z') : null
  if (travel && !Number.isNaN(travel.getTime()) && validUntil.getTime() < travel.getTime()) {
    return {
      status: 'expiring',
      validUntil: match.valid_until,
      expiresBeforeTravel: true,
      // Distinguishes "they cannot leave" from "they cannot stay" — the task
      // the sweep raises is worded from this.
      expiresDuringTrip: !!travelDate && match.valid_until >= String(travelDate),
    }
  }
  // expiring "soon" relative to travel (or today if no travel date)
  const ref = travel && !Number.isNaN(travel.getTime()) ? travel : new Date()
  const days = Math.round((validUntil - ref) / 86400000)
  if (days <= warnDays) return { status: 'expiring', validUntil: match.valid_until, daysLeft: days }
  return { status: 'covered', validUntil: match.valid_until }
}
