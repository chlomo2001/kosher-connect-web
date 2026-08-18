// An airline confirmation email → a booking the counter only has to confirm.
//
// The shop books flights in someone's own Gmail (`ch7023518@gmail.com`) and
// then re-types the result into the app — passenger, route, date, price — which
// is how the July dig found tickets that were flown and never billed. The
// confirmation email already holds every one of those fields. This module is
// the reader.
//
// TWO RULES, AND THEY ARE THE WHOLE DESIGN.
//
// 1. It never books anything. Everything here produces a SUGGESTION that a
//    person confirms at the counter. A parser that silently posted a wallet
//    charge would turn one bad regex into a customer being billed for someone
//    else's flight, and that is not a trade worth making to save ten seconds of
//    typing.
//
// 2. It would rather leave a field empty than fill it wrongly. A blank price is
//    a number someone types; a wrong price is money that moves. So every
//    extraction is anchored to a LABEL the airline actually wrote, and the
//    fallbacks that guess from shape are deliberately narrow — one distinct
//    amount in the whole mail, a date that is definitely in the future, an IATA
//    code inside brackets. What is not certain comes back null and is reported
//    in `missing`, which the review card shows in red.
//
// Pure — no DOM, no network, no clock except the `today` you pass in.

import { namesSimilar } from './nameMatch.mjs'

// ── who sends tickets ─────────────────────────────────────────────────────
//
// Sender domain first, because it is the one field a forwarding hop cannot
// forge accidentally: subjects get prefixed with "Fwd:", bodies get quoted and
// re-wrapped, but `noreply@wizzair.com` stays what it is.
//
// The list is the airlines and agents this shop actually uses (Wizz Air is most
// of it — see docs/WIZZ-RECONCILE-2026-08-02.md), plus the majors a Manchester
// counter books often enough to expect. An airline that is not on the list
// still gets through on its subject line; the list only decides what NAME we
// put on the booking.
const AIRLINES = [
  [/wizzair|wizz\.com/i, 'Wizz Air'],
  [/ryanair/i, 'Ryanair'],
  [/easyjet/i, 'easyJet'],
  [/\belal\b|el-al|elal\.co/i, 'El Al'],
  [/britishairways|\bba\.com\b/i, 'British Airways'],
  [/lufthansa/i, 'Lufthansa'],
  [/klm\.com/i, 'KLM'],
  [/airfrance/i, 'Air France'],
  [/turkishairlines|thy\.com/i, 'Turkish Airlines'],
  [/aerlingus/i, 'Aer Lingus'],
  [/jet2/i, 'Jet2'],
  [/tuifly|\btui\b/i, 'TUI'],
  [/virginatlantic/i, 'Virgin Atlantic'],
  [/norwegian/i, 'Norwegian'],
  [/vueling/i, 'Vueling'],
  [/israir/i, 'Israir'],
  [/arkia/i, 'Arkia'],
  [/swiss\.com|swissair/i, 'SWISS'],
  [/austrian\.com/i, 'Austrian'],
  [/brusselsairlines/i, 'Brussels Airlines'],
  [/lot\.com/i, 'LOT'],
  [/pegasus|flypgs/i, 'Pegasus'],
  [/emirates/i, 'Emirates'],
  // Agents and consolidators — the ticket is real, the airline comes from the
  // body rather than the sender.
  [/edreams/i, 'eDreams'],
  [/opodo/i, 'Opodo'],
  [/kiwi\.com/i, 'Kiwi.com'],
  [/expedia/i, 'Expedia'],
  [/lastminute/i, 'lastminute.com'],
]

// Phrases that only appear on a ticket. Kept boring on purpose: "your booking"
// alone matches a hotel, a restaurant and a barber, so every one of these has
// to name a flight, a PNR or an e-ticket.
const TICKET_PHRASES = [
  /booking\s+confirmation/i,
  /flight\s+confirmation/i,
  /your\s+flight/i,
  /e-?ticket/i,
  /itinerary/i,
  /boarding\s+pass/i,
  /booking\s+reference/i,
  /confirmation\s+(?:number|code)/i,
  /reservation\s+(?:number|code)/i,
  /\bPNR\b/,
  /check-?in\s+(?:is\s+)?(?:now\s+)?open/i,
]

const CANCELLED = /\b(cancell?ed|cancellation|refund(?:ed)?)\b/i
const CHANGED = /\b(schedule\s+change|flight\s+change|has\s+been\s+(?:re-?)?scheduled|time\s+change|rebooked)\b/i

/** The airline this mail is about, or null. Sender first, then the text. */
export function airlineOf({ from = '', subject = '', text = '' } = {}) {
  const sender = String(from || '')
  for (const [re, name] of AIRLINES) if (re.test(sender)) return name
  const body = `${subject}\n${text}`
  for (const [re, name] of AIRLINES) if (re.test(body)) return name
  return null
}

/**
 * Is this mail about a flight ticket at all?
 *
 * A known airline sender is enough on its own — a marketing blast from Wizz Air
 * costs a person one "not a ticket" click and is worth it against missing a
 * real confirmation. An unknown sender has to say something ticket-shaped.
 */
export function looksLikeTicket({ from = '', subject = '', text = '' } = {}) {
  if (airlineOf({ from }) ) return true
  const body = `${subject}\n${String(text).slice(0, 4000)}`
  const phrases = TICKET_PHRASES.filter((re) => re.test(body)).length
  if (!phrases) return false
  // An unknown sender needs a flight in it too, so "booking reference" on a
  // hotel confirmation does not walk in.
  return phrases >= 2 || /\bflight\b|\bairline\b|\bdeparture\b|\bIATA\b/i.test(body)
}

/** confirmation | cancellation | change — what the mail is telling us. */
export function ticketKind({ subject = '', text = '' } = {}) {
  const head = `${subject}\n${String(text).slice(0, 1200)}`
  if (CANCELLED.test(head)) return 'cancellation'
  if (CHANGED.test(head)) return 'change'
  return 'confirmation'
}

// ── airports ──────────────────────────────────────────────────────────────
//
// Not a world index — the codes a Salford counter sees, so a bare "LTN → TLV"
// in running text can be trusted without brackets round it. Anything outside
// the list is still accepted when the airline bracketed it, `Tel Aviv (TLV)`,
// which no ordinary word does.
export const AIRPORTS = {
  LTN: 'London Luton', STN: 'London Stansted', LHR: 'London Heathrow',
  LGW: 'London Gatwick', LCY: 'London City', SEN: 'London Southend',
  MAN: 'Manchester', LPL: 'Liverpool', BHX: 'Birmingham', LBA: 'Leeds Bradford',
  NCL: 'Newcastle', EDI: 'Edinburgh', GLA: 'Glasgow', BFS: 'Belfast',
  BRS: 'Bristol', EMA: 'East Midlands', DSA: 'Doncaster',
  TLV: 'Tel Aviv', ETM: 'Haifa', VDA: 'Ovda',
  JFK: 'New York JFK', EWR: 'Newark', LGA: 'New York LaGuardia',
  BOS: 'Boston', MIA: 'Miami', LAX: 'Los Angeles', ORD: 'Chicago',
  YYZ: 'Toronto', YUL: 'Montreal',
  BRU: 'Brussels', ANR: 'Antwerp', AMS: 'Amsterdam', CDG: 'Paris CDG',
  ORY: 'Paris Orly', VIE: 'Vienna', BUD: 'Budapest', KRK: 'Krakow',
  WAW: 'Warsaw', WMI: 'Warsaw Modlin', PRG: 'Prague', BER: 'Berlin',
  FRA: 'Frankfurt', MUC: 'Munich', DUS: 'Dusseldorf', ZRH: 'Zurich',
  GVA: 'Geneva', MXP: 'Milan Malpensa', FCO: 'Rome', BCN: 'Barcelona',
  MAD: 'Madrid', LIS: 'Lisbon', ATH: 'Athens', IST: 'Istanbul',
  SAW: 'Istanbul Sabiha', KIV: 'Chisinau', LWO: 'Lviv', IEV: 'Kyiv',
  DUB: 'Dublin', CPH: 'Copenhagen', OSL: 'Oslo', ARN: 'Stockholm',
  HEL: 'Helsinki', RIX: 'Riga', VNO: 'Vilnius', TLL: 'Tallinn',
  SOF: 'Sofia', OTP: 'Bucharest', BEG: 'Belgrade', SKG: 'Thessaloniki',
}

// Three uppercase letters that are words, not airports. Without this, "VAT",
// "GBP" and "MON" all read as destinations.
const NOT_AIRPORTS = new Set([
  'THE', 'AND', 'FOR', 'YOU', 'VAT', 'GBP', 'EUR', 'USD', 'ILS', 'PLN', 'CHF',
  'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN', 'JAN', 'FEB', 'MAR', 'APR',
  'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'PNR', 'REF', 'NEW',
  'ALL', 'PDF', 'FAQ', 'BAG', 'ADT', 'CHD', 'INF', 'TAX', 'FEE', 'LTD',
])

/** { origin, destination } as IATA codes, or nulls. */
export function routeIn(text) {
  const s = String(text || '')

  // 1. Bracketed, the way every airline writes an itinerary line:
  //    "London Luton (LTN)  →  Tel Aviv (TLV)". Strongest signal there is —
  //    accepted even for codes the table has never heard of.
  const bracketed = s.match(/\(([A-Z]{3})\)[\s\S]{0,120}?\(([A-Z]{3})\)/)
  if (bracketed && bracketed[1] !== bracketed[2]) {
    return { origin: bracketed[1], destination: bracketed[2] }
  }

  // 2. Bare codes joined by an arrow, a dash or the word "to". Only for codes
  //    the table knows, or the sentence "GET TO THE GATE" becomes a flight.
  const joined = s.match(/\b([A-Z]{3})\s*(?:→|->|-->|–|—|-|\bto\b|\/)\s*([A-Z]{3})\b/)
  if (joined) {
    const [, a, b] = joined
    if (a !== b && !NOT_AIRPORTS.has(a) && !NOT_AIRPORTS.has(b) && AIRPORTS[a] && AIRPORTS[b]) {
      return { origin: a, destination: b }
    }
  }

  // 3. Written out in full: "from London Luton to Tel Aviv". Matched against
  //    the table's own names, longest first so "London Luton" beats "London".
  const names = Object.entries(AIRPORTS).sort((a, b) => b[1].length - a[1].length)
  const fromTo = s.match(/\bfrom\s+([A-Za-z][A-Za-z .'-]{2,30}?)\s+to\s+([A-Za-z][A-Za-z .'-]{2,30}?)(?=[,.\n]|\s+on\b|\s+at\b|$)/)
  if (fromTo) {
    const code = (label) => {
      const want = label.trim().toLowerCase()
      const hit = names.find(([, name]) => name.toLowerCase() === want) ||
        names.find(([, name]) => want.includes(name.toLowerCase()))
      return hit ? hit[0] : null
    }
    const origin = code(fromTo[1])
    const destination = code(fromTo[2])
    if (origin && destination && origin !== destination) return { origin, destination }
  }

  return { origin: null, destination: null }
}

/** "LTN → TLV", the shape the booking form's Route field already uses. */
export function routeLabel(origin, destination) {
  return origin && destination ? `${origin} → ${destination}` : ''
}

// ── the booking reference ─────────────────────────────────────────────────
//
// Six characters, letters and digits, and every airline calls it something
// different. Only ever read from a LABEL: a bare six-character token in a
// paragraph is as likely to be a coupon code as a PNR.
const REF_LABELS = /(?:booking|confirmation|reservation|order|itinerary)\s*(?:reference|number|code|no\.?|id)?\s*(?:\(PNR\))?\s*[:#-]?\s*([A-Z0-9]{5,8})\b|(?:^|\s)PNR\s*[:#-]?\s*([A-Z0-9]{5,8})\b/im

export function referenceIn(text) {
  const m = String(text || '').match(REF_LABELS)
  const raw = m && (m[1] || m[2])
  if (!raw) return null
  const ref = raw.toUpperCase()
  // All-digits is an invoice or an order number, not a PNR — and letting it
  // through put "20260912" on a booking during testing.
  if (!/[A-Z]/.test(ref)) return null
  if (NOT_AIRPORTS.has(ref)) return null
  return ref
}

// ── dates and times ───────────────────────────────────────────────────────
const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const valid = (y, m, d) => m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2000 && y <= 2100

/**
 * Every date in the text, in the order they appear, as { date, at }.
 *
 * Numeric dates are read DAY FIRST. The whole business is British and the
 * database is set to DMY (see 20260803000000_datestyle_dmy.sql); reading
 * 09/12/2026 as 12 September would put a customer at the airport in the wrong
 * season, which is the kind of bug nobody notices until someone misses a
 * flight.
 */
export function datesIn(text, { today } = {}) {
  const s = String(text || '')
  const now = today ? new Date(`${today}T00:00:00Z`) : new Date()
  const out = []

  // 12 September 2026 · 12 Sep 2026 · Sat, 12 Sep · 12th September
  const words = /\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?(?:\s+(\d{4}))?\b/g
  for (let m; (m = words.exec(s));) {
    const mon = MONTHS[m[2].slice(0, 3).toLowerCase()]
    if (!mon) continue
    const day = Number(m[1])
    const year = m[3] ? Number(m[3]) : inferYear(mon, day, now)
    if (valid(year, mon, day)) out.push({ date: iso(year, mon, day), at: m.index })
  }

  // September 12, 2026 — American order, but only ever with the month spelled
  // out, so it cannot collide with the British numeric form.
  const monthFirst = /\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/g
  for (let m; (m = monthFirst.exec(s));) {
    const mon = MONTHS[m[1].slice(0, 3).toLowerCase()]
    if (!mon) continue
    const day = Number(m[2]), year = Number(m[3])
    if (valid(year, mon, day)) out.push({ date: iso(year, mon, day), at: m.index })
  }

  // 12/09/2026 · 12-09-26 · 2026-09-12
  const numeric = /\b(\d{4})-(\d{2})-(\d{2})\b|\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/g
  for (let m; (m = numeric.exec(s));) {
    if (m[1]) {
      const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
      if (valid(y, mo, d)) out.push({ date: iso(y, mo, d), at: m.index })
    } else {
      const d = Number(m[4]), mo = Number(m[5])
      let y = Number(m[6])
      if (y < 100) y += 2000
      if (valid(y, mo, d)) out.push({ date: iso(y, mo, d), at: m.index })
    }
  }

  return out.sort((a, b) => a.at - b.at)
}

// A date with no year is the next time that day comes round — an airline
// writing "Sat, 12 Sep" in December means next September, never last.
function inferYear(mon, day, now) {
  const y = now.getUTCFullYear()
  const thisYear = Date.parse(`${iso(y, mon, day)}T00:00:00Z`)
  return thisYear >= now.getTime() - 86400000 ? y : y + 1
}

/** HH:MM in 24h, from either "08:25" or "8:25 AM". */
export function timesIn(text) {
  const s = String(text || '')
  const out = []
  const re = /\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/gi
  for (let m; (m = re.exec(s));) {
    let h = Number(m[1])
    const min = Number(m[2])
    const half = (m[3] || '').toLowerCase()
    if (min > 59) continue
    if (half === 'pm' && h < 12) h += 12
    if (half === 'am' && h === 12) h = 0
    if (h > 23) continue
    out.push({ time: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`, at: m.index })
  }
  return out
}

// ── money ─────────────────────────────────────────────────────────────────
const SYMBOL = { '£': 'GBP', '€': 'EUR', $: 'USD', '₪': 'ILS' }
const MONEY = /(?:(£|€|\$|₪)\s?|\b(GBP|EUR|USD|ILS)\s+)(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)|(\d{1,3}(?:,\d{3})*\.\d{2})\s*(GBP|EUR|USD|ILS)\b/gi

function moneyIn(text) {
  const out = []
  const re = new RegExp(MONEY.source, 'gi')
  for (let m; (m = re.exec(String(text || '')));) {
    const amount = Number(String(m[3] || m[4]).replace(/,/g, ''))
    if (!Number.isFinite(amount) || amount <= 0) continue
    const currency = SYMBOL[m[1]] || (m[2] || m[5] || '').toUpperCase() || null
    out.push({ amount, currency, at: m.index })
  }
  return out
}

/**
 * What the ticket cost — from a labelled total, or nothing.
 *
 * The fallback is deliberately one line long: if the whole mail contains
 * exactly one distinct amount, that is the price. Any other guess (largest
 * amount, last amount) picks up baggage allowances and compensation limits, and
 * a wrong price here becomes a wrong wallet charge.
 */
export function priceIn(text) {
  const s = String(text || '')
  const labels = /(?:total(?:\s+(?:price|amount|to\s+pay|paid|cost|charged))?|grand\s+total|amount\s+(?:paid|due|charged)|order\s+total|you\s+paid)\s*[:=]?\s*[^\S\n]{0,20}([^\n]{0,40})/gi
  for (let m; (m = labels.exec(s));) {
    const found = moneyIn(m[1])
    if (found.length) return { amount: found[0].amount, currency: found[0].currency || 'GBP' }
  }
  const all = moneyIn(s)
  const distinct = [...new Set(all.map((x) => `${x.amount}|${x.currency || ''}`))]
  if (distinct.length === 1 && all.length) {
    return { amount: all[0].amount, currency: all[0].currency || 'GBP' }
  }
  return { amount: null, currency: null }
}

// ── passengers ────────────────────────────────────────────────────────────
// Single spaces and tabs only, never \s — a name does not run across a line
// break, and one that was allowed to gave "Yossi Adler Total Paid" as a
// passenger on the very first Ryanair fixture.
const TITLED = /\b(?:mr|mrs|ms|miss|mstr|master|dr|rabbi|rev)\b\.?[ \t]+([A-Za-z][A-Za-z'’-]+(?:[ \t]+[A-Za-z][A-Za-z'’-]+){1,3})/gi
const NAME_LINE = /^[A-Za-z][A-Za-z'’-]+(?:\s+[A-Za-z][A-Za-z'’-]+){1,3}$/

const titleCase = (s) => String(s).toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase())

/** Passenger names, best effort, deduped and tidied. Never more than eight. */
export function passengersIn(text) {
  const s = String(text || '')
  const found = []

  // Titles are the reliable one — airlines print "MR SHMUEL BLEIER" whatever
  // the rest of the layout looks like.
  for (let m; (m = TITLED.exec(s));) found.push(m[1])

  // A "Passengers:" heading, then the lines under it until something stops
  // looking like a name. Bounded to a short window so a heading near the top
  // cannot swallow the terms and conditions.
  const heading = s.match(/passengers?\s*(?:\(\d+\))?\s*[:\n]([\s\S]{0,400})/i)
  if (heading) {
    for (const raw of heading[1].split('\n')) {
      const line = raw.replace(/^\s*\d+[.)]\s*/, '').trim()
      if (!line) continue
      if (!NAME_LINE.test(line)) break
      found.push(line)
    }
  }

  const seen = new Set()
  const out = []
  for (const name of found) {
    const tidy = titleCase(name.replace(/\s+/g, ' ').trim())
    const key = tidy.toLowerCase()
    // Words that are names in shape only. "Kosher Connect" is on every
    // forwarded mail in this shop and is not a passenger.
    if (/^(kosher connect|wizz air|el al|british airways|customer service|best regards|kind regards|thank you)$/i.test(tidy)) continue
    if (seen.has(key)) continue
    seen.add(key)
    out.push(tidy)
    if (out.length === 8) break
  }
  return out
}

// ── the whole thing ───────────────────────────────────────────────────────

/**
 * parseTicketMail({ from, subject, text, today }) → the fields a booking needs.
 *
 * `missing` names the fields that must be typed by hand, and `confidence` says
 * how much of the mail we actually read:
 *
 *   full     reference, route, date and price all present — one click to book
 *   partial  enough to recognise the ticket, something still to fill in
 *   thin     it looks like a ticket and almost nothing parsed
 */
export function parseTicketMail({ from = '', subject = '', text = '', today } = {}) {
  const body = `${subject}\n${text}`
  const airline = airlineOf({ from, subject, text })
  const kind = ticketKind({ subject, text })
  const reference = referenceIn(body)
  const { origin, destination } = routeIn(body)
  const passengers = passengersIn(body)
  const { amount, currency } = priceIn(body)

  // Dates: prefer the one the airline labelled, then the earliest date that is
  // definitely in the future. "Definitely" excludes today, because the issue
  // date is today on every confirmation and would otherwise win every time.
  const dates = datesIn(body, { today })
  const nowIso = today || new Date().toISOString().slice(0, 10)
  const labelled = labelledDate(body, dates, /depart|outbound|travel\s+date|flight\s+date|going\s+out/i)
  const future = dates.filter((d) => d.date > nowIso)
  const travelDate = labelled || (future.length ? future[0].date : null)
  const returnDate = (() => {
    const back = labelledDate(body, dates, /return|inbound|coming\s+back/i)
    if (back && back !== travelDate) return back
    const later = future.filter((d) => d.date > (travelDate || ''))
    return later.length ? later[later.length - 1].date : null
  })()

  // Times only mean anything once we know where the departure line is, so they
  // are read from the same window the travel date came out of.
  const { departureTime, arrivalTime } = timesAround(body, travelDate, dates)

  const missing = []
  if (!reference) missing.push('reference')
  if (!origin || !destination) missing.push('route')
  if (!travelDate) missing.push('travel date')
  if (amount === null) missing.push('price')
  if (!passengers.length) missing.push('passenger')

  const core = [reference, origin && destination, travelDate, amount !== null].filter(Boolean).length
  const confidence = core >= 4 ? 'full' : core >= 2 ? 'partial' : 'thin'

  return {
    airline, kind, reference,
    origin, destination, route: routeLabel(origin, destination),
    passengers, travelDate, returnDate, departureTime, arrivalTime,
    price: amount, currency: amount === null ? null : (currency || 'GBP'),
    confidence, missing,
  }
}

// The date nearest after a label like "Departure:". Nearest AFTER, not nearest
// either way: "Departure 12 Sep" reads forwards, and a date sitting before the
// word belongs to whatever line came before it.
function labelledDate(text, dates, label) {
  const s = String(text || '')
  const re = new RegExp(label.source, 'gi')
  for (let m; (m = re.exec(s));) {
    const hit = dates.find((d) => d.at >= m.index && d.at - m.index < 120)
    if (hit) return hit.date
  }
  return null
}

// The two times either side of the travel date on an itinerary line. Airlines
// print "08:25 LTN … 15:05 TLV", in that order, near the date — so the first
// two times within a couple of lines of it are departure and arrival.
function timesAround(text, travelDate, dates) {
  const none = { departureTime: null, arrivalTime: null }
  if (!travelDate) return none
  const anchor = dates.find((d) => d.date === travelDate)
  if (!anchor) return none
  const near = timesIn(text).filter((t) => Math.abs(t.at - anchor.at) < 300)
  return {
    departureTime: near[0] ? near[0].time : null,
    arrivalTime: near[1] ? near[1].time : null,
  }
}

// ── which customer is this? ───────────────────────────────────────────────

/**
 * suggestCustomer(passengers, { customers, priorPassengers })
 *
 * Two kinds of evidence, and they are not equal:
 *
 *   priorPassengers — this exact person has flown on a booking before, and that
 *                     booking says whose account it went on. Near-certain, and
 *                     the case that matters most: families book the same names
 *                     every year.
 *   customers       — the passenger is a customer's own name. Good, but a wife
 *                     flying on her husband's account is not on this list, and
 *                     two Yossi Adlers are.
 *
 * Returns { customerId, confidence, candidates } where confidence is
 * 'sure' | 'likely' | 'many' | 'none'. Only 'sure' and 'likely' preselect
 * anything in the review card, and even then a person confirms it.
 */
export function suggestCustomer(passengers, { customers = [], priorPassengers = [] } = {}) {
  const names = (passengers || []).filter(Boolean)
  if (!names.length) return { customerId: null, confidence: 'none', candidates: [] }

  const score = new Map() // customerId -> { id, name, why, score }
  const add = (id, name, why, points) => {
    if (!id) return
    const key = String(id)
    const cur = score.get(key) || { id: key, name, why, score: 0 }
    cur.score += points
    // The stronger reason is the one worth showing.
    if (points >= 10) cur.why = why
    score.set(key, cur)
  }

  for (const passenger of names) {
    for (const p of priorPassengers) {
      const hit = namesSimilarSafe(passenger, p.name)
      if (hit.match) add(p.customerId, p.customerName || '', `flew as ${p.name} before`, hit.strong >= 2 ? 12 : 10)
    }
    for (const c of customers) {
      const full = `${c.firstName || ''} ${c.lastName || ''}`.trim()
      const hit = namesSimilarSafe(passenger, full)
      if (hit.match) add(c.id, full, 'name matches the customer', hit.strong >= 2 ? 6 : 4)
    }
  }

  const ranked = [...score.values()].sort((a, b) => b.score - a.score)
  if (!ranked.length) return { customerId: null, confidence: 'none', candidates: [] }

  const [top, second] = ranked
  const clear = !second || top.score > second.score
  const confidence = !clear ? 'many' : top.score >= 10 ? 'sure' : 'likely'
  return {
    customerId: clear ? top.id : null,
    confidence,
    candidates: ranked.slice(0, 6),
  }
}

// A bad input must never throw into the webhook: an unparseable name is a
// pairing we don't make, not a message we lose.
function namesSimilarSafe(a, b) {
  try { return namesSimilar(a, b) } catch { return { match: false, score: 0, strong: 0 } }
}

/**
 * The one-line summary a task carries: what a person needs to read on the
 * Tasks tab to know what they are being asked to confirm.
 */
export function ticketTaskTitle(parsed, { customerName = '' } = {}) {
  const who = parsed.passengers[0] || customerName || 'a customer'
  const bits = [parsed.route || 'flight']
  if (parsed.travelDate) {
    const d = new Date(`${parsed.travelDate}T00:00:00Z`)
    bits.push(d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }))
  }
  if (parsed.price !== null) {
    const cur = { GBP: '£', EUR: '€', USD: '$', ILS: '₪' }[parsed.currency] || ''
    bits.push(`${cur}${parsed.price.toFixed(2)}`)
  }
  const what = parsed.kind === 'cancellation' ? 'Cancelled ticket'
    : parsed.kind === 'change' ? 'Changed flight'
      : 'Confirm ticket'
  return `${what}: ${who} — ${bits.join(', ')}`.slice(0, 200)
}
