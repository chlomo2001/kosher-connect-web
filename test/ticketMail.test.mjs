// Reading an airline confirmation. Run: npm test
//
// The fixtures below are written to the shape the real mails take — an
// itinerary line with bracketed IATA codes, a labelled total, a PNR under a
// name the airline invented for it. What is deliberately NOT here is a fixture
// that only passes because the parser was written to it: every test that
// asserts a value also has a sibling asserting the parser leaves the field
// EMPTY when the mail doesn't really say it. A parser that fills in a price it
// cannot see is worse than one that fills in nothing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  looksLikeTicket, airlineOf, ticketKind, routeIn, routeLabel, referenceIn,
  datesIn, timesIn, priceIn, passengersIn, parseTicketMail, suggestCustomer,
  ticketTaskTitle,
} from '../lib/ticketMail.mjs'

const TODAY = '2026-08-18'

const WIZZ = {
  from: 'noreply@wizzair.com',
  subject: 'Your booking is confirmed — XU2WWH',
  text: `Dear Customer,

Thank you for booking with Wizz Air.

Confirmation number: XU2WWH

Outbound flight W6 5623
Departure: 12 September 2026
London Luton (LTN) 08:25  →  Tel Aviv (TLV) 15:05

Passengers:
Shmuel Bleier
Rivky Bleier

Total price: GBP 428.60

Manage your booking at wizzair.com`,
}

const RYANAIR = {
  from: 'noreply@ryanair.com',
  subject: 'Ryanair booking confirmation',
  text: `Reservation number: QK4T2M
Flight FR 1234 from Manchester to Krakow
Sat, 3 Oct 2026 at 06:40
MR YOSSI ADLER
Total paid £89.98`,
}

const CANCELLED = {
  from: 'noreply@wizzair.com',
  subject: 'Your flight has been cancelled — IJEVNV',
  text: `We are sorry to inform you that flight W6 5623 on 12 September 2026
London Luton (LTN) to Tel Aviv (TLV) has been cancelled.
Booking reference: IJEVNV
A refund of GBP 170.00 has been issued.`,
}

// ── is it even a ticket ───────────────────────────────────────────────────

test('a known airline sender is a ticket, whatever it says', () => {
  assert.equal(looksLikeTicket(WIZZ), true)
  assert.equal(looksLikeTicket({ from: 'promo@easyjet.com', subject: 'Sale now on' }), true)
})

test('an unknown sender has to look like a flight, not just a booking', () => {
  // The trap: hotels, restaurants and barbers all send "booking confirmation".
  assert.equal(looksLikeTicket({
    from: 'reservations@hotel.example',
    subject: 'Your booking confirmation',
    text: 'Two nights, breakfast included.',
  }), false)
  assert.equal(looksLikeTicket({
    from: 'tickets@some-agent.example',
    subject: 'Your e-ticket',
    text: 'Booking reference AB12CD — flight departs 12 September.',
  }), true)
})

test('an agent nobody has heard of still gets through on the phrases', () => {
  // The list of agents will never be complete — owner, 18 Aug: "sometimes its
  // booked via 3rd party like wiki.com and much more". An unknown sender has to
  // earn its way in on what the message SAYS, and this is that path.
  assert.equal(looksLikeTicket({
    from: 'confirmations@some-agent-nobody-listed.example',
    subject: 'Your itinerary',
    text: 'Booking reference: 8KP2QW. Flight departs 14 October from Manchester.',
  }), true)
  // The named agents are still named, so the booking gets a sensible airline.
  assert.equal(airlineOf({ from: 'noreply@kiwi.com' }), 'Kiwi.com')
  assert.equal(airlineOf({ from: 'no-reply@gotogate.com' }), 'Gotogate')
  assert.equal(airlineOf({ from: 'bookings@trip.com' }), 'Trip.com')
})

test('ordinary mail in a personal mailbox is left alone', () => {
  assert.equal(looksLikeTicket({
    from: 'someone@gmail.com', subject: 'Re: shabbos', text: 'See you at 8.',
  }), false)
})

test('the airline comes from the sender, which a forward cannot fake', () => {
  assert.equal(airlineOf(WIZZ), 'Wizz Air')
  assert.equal(airlineOf({ from: 'x@gmail.com', subject: 'Fwd: Your Ryanair booking' }), 'Ryanair')
  assert.equal(airlineOf({ from: 'x@gmail.com', subject: 'hello' }), null)
})

test('cancellations and changes are not confirmations', () => {
  assert.equal(ticketKind(WIZZ), 'confirmation')
  assert.equal(ticketKind(CANCELLED), 'cancellation')
  assert.equal(ticketKind({ subject: 'Schedule change to your flight' }), 'change')
})

// ── the fields ────────────────────────────────────────────────────────────

test('a bracketed IATA pair is the route, in the order flown', () => {
  assert.deepEqual(routeIn('London Luton (LTN) → Tel Aviv (TLV)'), { origin: 'LTN', destination: 'TLV' })
  assert.equal(routeLabel('LTN', 'TLV'), 'LTN → TLV')
})

test('bare codes only count when both are airports we know', () => {
  assert.deepEqual(routeIn('LTN - TLV'), { origin: 'LTN', destination: 'TLV' })
  // THE TRAP: three capitals joined by "to" is a sentence, not an itinerary.
  assert.deepEqual(routeIn('GET TO THE GATE'), { origin: null, destination: null })
  assert.deepEqual(routeIn('VAT/GBP'), { origin: null, destination: null })
})

test('written-out airports resolve, and unknown ones do not invent a code', () => {
  assert.deepEqual(routeIn('from Manchester to Krakow'), { origin: 'MAN', destination: 'KRK' })
  assert.deepEqual(routeIn('from Narnia to Atlantis'), { origin: null, destination: null })
})

test('the reference is only ever read from a label', () => {
  assert.equal(referenceIn('Confirmation number: XU2WWH'), 'XU2WWH')
  assert.equal(referenceIn('Reservation number: QK4T2M'), 'QK4T2M')
  assert.equal(referenceIn('Booking reference (PNR): IJEVNV'), 'IJEVNV')
  assert.equal(referenceIn('PNR AB12CD'), 'AB12CD')
  // A six-character token on its own is a coupon code as often as a PNR.
  assert.equal(referenceIn('Use code SUMMER for 10% off'), null)
  // All digits is an invoice number — this one put "20260912" on a booking.
  assert.equal(referenceIn('Order number: 3048112'), null)
})

test('numeric dates are read the British way round', () => {
  const [d] = datesIn('Departure 09/12/2026', { today: TODAY })
  assert.equal(d.date, '2026-12-09')      // 9 December, not 12 September
  assert.equal(datesIn('2026-09-12')[0].date, '2026-09-12')
})

test('a date with no year means the next time it comes round', () => {
  assert.equal(datesIn('Sat, 12 Sep', { today: '2026-08-18' })[0].date, '2026-09-12')
  assert.equal(datesIn('Sat, 12 Sep', { today: '2026-12-01' })[0].date, '2027-09-12')
})

test('times read in both clocks', () => {
  assert.deepEqual(timesIn('08:25').map(t => t.time), ['08:25'])
  assert.deepEqual(timesIn('8:25 PM and 12:30 AM').map(t => t.time), ['20:25', '00:30'])
  assert.deepEqual(timesIn('99:99'), [])
})

test('the price comes from a label', () => {
  assert.deepEqual(priceIn('Total price: GBP 428.60'), { amount: 428.6, currency: 'GBP' })
  assert.deepEqual(priceIn('Total paid £89.98'), { amount: 89.98, currency: 'GBP' })
  assert.deepEqual(priceIn('Amount charged: €1,204.50'), { amount: 1204.5, currency: 'EUR' })
})

test('THE TRAP — an unlabelled mail full of numbers gets no price at all', () => {
  // Baggage allowances, compensation limits and fare rules are all money.
  // Guessing the largest one is how a customer gets billed £600 for a £90 seat.
  assert.deepEqual(
    priceIn('Hold bag £45.00. Compensation up to £520.00. Change fee £60.00.'),
    { amount: null, currency: null }
  )
  // One amount in the whole mail is not a guess.
  assert.deepEqual(priceIn('Your card was debited £89.98 today.'), { amount: 89.98, currency: 'GBP' })
})

test('passengers come off titles and off a heading', () => {
  assert.deepEqual(passengersIn('MR YOSSI ADLER'), ['Yossi Adler'])
  assert.deepEqual(
    passengersIn('Passengers:\nShmuel Bleier\nRivky Bleier\n\nTotal: £428.60'),
    ['Shmuel Bleier', 'Rivky Bleier']
  )
  // The shop's own name rides on every forwarded message.
  assert.deepEqual(passengersIn('Kosher Connect'), [])
})

// ── end to end ────────────────────────────────────────────────────────────

test('a full Wizz Air confirmation parses to a bookable draft', () => {
  const p = parseTicketMail({ ...WIZZ, today: TODAY })
  assert.equal(p.airline, 'Wizz Air')
  assert.equal(p.kind, 'confirmation')
  assert.equal(p.reference, 'XU2WWH')
  assert.equal(p.route, 'LTN → TLV')
  assert.equal(p.travelDate, '2026-09-12')
  assert.equal(p.departureTime, '08:25')
  assert.equal(p.arrivalTime, '15:05')
  assert.equal(p.price, 428.6)
  assert.equal(p.currency, 'GBP')
  assert.deepEqual(p.passengers, ['Shmuel Bleier', 'Rivky Bleier'])
  assert.equal(p.confidence, 'full')
  assert.deepEqual(p.missing, [])
})

test('a Ryanair confirmation in a different layout parses too', () => {
  const p = parseTicketMail({ ...RYANAIR, today: TODAY })
  assert.equal(p.airline, 'Ryanair')
  assert.equal(p.reference, 'QK4T2M')
  assert.equal(p.route, 'MAN → KRK')
  assert.equal(p.travelDate, '2026-10-03')
  assert.equal(p.price, 89.98)
  assert.deepEqual(p.passengers, ['Yossi Adler'])
})

test('a cancellation is parsed, flagged, and does not pretend to be a booking', () => {
  const p = parseTicketMail({ ...CANCELLED, today: TODAY })
  assert.equal(p.kind, 'cancellation')
  assert.equal(p.reference, 'IJEVNV')
  assert.equal(p.route, 'LTN → TLV')
  assert.match(ticketTaskTitle(p), /^Cancelled ticket/)
})

test('a thin mail says so instead of filling the gaps in', () => {
  const p = parseTicketMail({
    from: 'noreply@wizzair.com',
    subject: 'Check-in is now open',
    text: 'Check in online to save time at the airport.',
    today: TODAY,
  })
  assert.equal(p.confidence, 'thin')
  assert.equal(p.price, null)
  assert.equal(p.travelDate, null)
  assert.ok(p.missing.includes('price'))
  assert.ok(p.missing.includes('travel date'))
})

test("the issue date is not the travel date", () => {
  // Every confirmation is dated today. An earliest-date rule without this
  // guard books everyone onto a flight leaving the morning they bought it.
  const p = parseTicketMail({
    from: 'noreply@wizzair.com',
    subject: 'Booking confirmed',
    text: `Issued 18 August 2026
Booking reference: AB12CD
London Luton (LTN) → Tel Aviv (TLV)
Departure: 12 September 2026
Total: £200.00`,
    today: TODAY,
  })
  assert.equal(p.travelDate, '2026-09-12')
})

// ── whose ticket is it ────────────────────────────────────────────────────

const CUSTOMERS = [
  { id: 'c1', firstName: 'Shmuel', lastName: 'Bleier' },
  { id: 'c2', firstName: 'Yossi', lastName: 'Adler' },
  { id: 'c3', firstName: 'Yossi', lastName: 'Adler' },   // the shop really has these
]

test('a passenger who flew before lands on the account that paid', () => {
  const s = suggestCustomer(['Rivky Bleier'], {
    customers: CUSTOMERS,
    priorPassengers: [{ name: 'Rivky Bleier', customerId: 'c1', customerName: 'Shmuel Bleier' }],
  })
  assert.equal(s.customerId, 'c1')
  assert.equal(s.confidence, 'sure')
})

test('a passenger who is a customer matches, more weakly', () => {
  const s = suggestCustomer(['Shmuel Bleier'], { customers: [CUSTOMERS[0]] })
  assert.equal(s.customerId, 'c1')
  assert.equal(s.confidence, 'likely')
})

test('THE TRAP — two customers with the same name preselects NOBODY', () => {
  const s = suggestCustomer(['Yossi Adler'], { customers: CUSTOMERS })
  assert.equal(s.customerId, null)
  assert.equal(s.confidence, 'many')
  assert.equal(s.candidates.length, 2)   // both offered, neither chosen
})

test('spelling variants still find the person', () => {
  const s = suggestCustomer(['Shmiel Bleir'], { customers: [CUSTOMERS[0]] })
  assert.equal(s.customerId, 'c1')
})

test('no passenger, no suggestion', () => {
  assert.deepEqual(suggestCustomer([], { customers: CUSTOMERS }),
    { customerId: null, confidence: 'none', candidates: [] })
})

test('the task title reads like something a person can act on', () => {
  const p = parseTicketMail({ ...WIZZ, today: TODAY })
  // "Sept", not "Sep" — that is what en-GB renders, and the app is British.
  assert.equal(ticketTaskTitle(p), 'Confirm ticket: Shmuel Bleier — LTN → TLV, 12 Sept, £428.60')
})
