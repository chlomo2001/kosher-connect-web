// What one person has with the shop — the decisions behind the record page.
//
// Owner, 20 August 2026, asked for the customer card to open as a full record
// "with all his lines". The first design was to GROUP by line. The data said
// not to: 838 distinct numbers across 502 customers, and 837 of them carry
// exactly one thing. Grouping would have wrapped 837 single items in 837
// groups. What the number actually is here is not a folder — it is the NAME of
// the thing, which is why it leads the row.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  KINDS, serviceUnits, groupUnits, recordSummary, recordHeadline,
} from '../lib/customerRecord.mjs'

const TODAY = '2026-08-20'
const unitsOf = (lists) => serviceUnits(lists, TODAY)

test('the number field only ever holds a phone number', () => {
  // The rule most likely to be broken by someone being helpful: a booking
  // reference, an IMEI or a repair ticket dropped into the number position
  // because the row looked empty. A column that sometimes holds a PNR stops
  // being the thing this shop recognises a line by.
  const lists = {
    booking: [{ id: 'b', route: 'MAN → TLV', bookingRef: 'BNKYRW', airline: 'Wizz', travelDate: '2026-09-01' }],
    repair: [{ id: 'r', device: 'Nokia 105', status: 'Open', imei: '350077521234567' }],
    service: [{ id: 'o', serviceName: 'Passport photos', createdAt: '2026-08-05', reference: '99887766' }],
  }
  for (const u of unitsOf(lists)) {
    assert.equal(u.number, '', `${u.kind} put "${u.number}" in the number field — only phone numbers belong there`)
    assert.ok(u.name, `${u.kind} has no name to show instead`)
  }
})

test('the kinds that have a number expose it', () => {
  const lists = {
    sim: [{ id: 's', provider: 'Lebara', simNumber: '+447400555001', status: 'active' }],
    rental: [{ id: 'r', country: 'USA', phoneNumber: '+15185550101', status: 'active' }],
    vn: [{ id: 'v', number: '+17325550123', status: 'Active' }],
  }
  const byKind = Object.fromEntries(unitsOf(lists).map((u) => [u.kind, u]))
  assert.equal(byKind.sim.number, '+447400555001')
  assert.equal(byKind.rental.number, '+15185550101')
  assert.equal(byKind.vn.number, '+17325550123')
  // The name is still there underneath — the number says which line, the name
  // says what it is.
  assert.equal(byKind.sim.name, 'Lebara')
  assert.equal(byKind.rental.name, 'Rental · USA')
})

test('a flown flight is finished; one still to come is not', () => {
  const flown = unitsOf({ booking: [{ id: 'f', travelDate: '2026-08-19', status: 'confirmed' }] })
  const soon = unitsOf({ booking: [{ id: 'f', travelDate: '2026-08-21', status: 'confirmed' }] })
  assert.equal(flown[0].ended, true, 'a flight already taken is not a service someone still has')
  assert.equal(soon[0].ended, false)
  // Cancelled counts whatever the date says.
  assert.equal(unitsOf({ booking: [{ id: 'f', travelDate: '2026-12-01', status: 'Cancelled' }] })[0].ended, true)
})

test('an overdue rental is still running', () => {
  // Past its return date and therefore MORE somebody's problem, not less. The
  // date rule that ends a flight must not leak onto rentals.
  const late = unitsOf({ rental: [{ id: 'r', status: 'overdue', toDate: '2026-07-01' }] })
  assert.equal(late[0].ended, false)
  assert.equal(unitsOf({ rental: [{ id: 'r', status: 'Returned', toDate: '2026-07-01' }] })[0].ended, true)
})

test('statuses are read whatever their casing', () => {
  // 'Active' on virtual numbers, 'active' on SIMs, 'VOID' seen in imports.
  assert.equal(unitsOf({ vn: [{ id: 'v', status: 'Active' }] })[0].ended, false)
  assert.equal(unitsOf({ vn: [{ id: 'v', status: 'active' }] })[0].ended, false)
  assert.equal(unitsOf({ vn: [{ id: 'v', status: 'Cancelled' }] })[0].ended, true)
  assert.equal(unitsOf({ rental: [{ id: 'r', status: 'VOID' }] })[0].ended, true)
})

test('running things are ordered by what needs somebody soonest', () => {
  const u = unitsOf({
    sim: [{ id: 'later', provider: 'A', status: 'active', renewalDate: '2026-09-30' },
      { id: 'sooner', provider: 'B', status: 'active', renewalDate: '2026-08-22' }],
    vn: [{ id: 'undated', number: '+1732', status: 'Active' }],
  })
  const { running } = groupUnits(u)
  assert.deepEqual(running.map((r) => r.id), ['sooner', 'later', 'undated'],
    'a thing with no deadline must not jump ahead of one that has')
})

test('finished things read newest first', () => {
  const u = unitsOf({
    sim: [{ id: 'old', status: 'cancelled', renewalDate: '2025-01-01' },
      { id: 'recent', status: 'cancelled', renewalDate: '2026-06-01' }],
  })
  assert.deepEqual(groupUnits(u).finished.map((r) => r.id), ['recent', 'old'])
})

test('nothing yet and nothing running are different states', () => {
  // A new customer and a lapsed one look identical if you only count what is
  // running, and they are not the same person to the shop.
  const none = recordSummary(unitsOf({}))
  const lapsed = recordSummary(unitsOf({ sim: [{ id: 'x', status: 'cancelled' }] }))
  assert.equal(none.state, 'none')
  assert.equal(lapsed.state, 'lapsed')
  assert.match(recordHeadline(none), /Nothing on the books/)
  assert.match(recordHeadline(lapsed), /1 finished item/)
  assert.equal(recordSummary(unitsOf({ sim: [{ id: 'x', status: 'active' }] })).state, 'active')
})

test('the headline names the kinds in the shop’s own words', () => {
  const u = unitsOf({
    sim: [{ id: 'a', status: 'active' }, { id: 'b', status: 'active' }],
    vn: [{ id: 'c', status: 'Active' }],
  })
  const line = recordHeadline(recordSummary(u))
  // "SIM" is an acronym, not a word — lower-casing the label would print
  // "2 sim plans".
  assert.match(line, /2 SIM plans/)
  assert.match(line, /1 virtual number/)
  assert.doesNotMatch(line, /sim plan/)
})

test('rubbish in the lists does not throw', () => {
  // These arrive from the browser's own arrays, which hold imported rows.
  assert.deepEqual(unitsOf({ sim: [null, undefined] }), [])
  assert.deepEqual(unitsOf({ nonsense: [{ id: 'x' }] }), [])
  assert.deepEqual(unitsOf({}), [])
  assert.deepEqual(unitsOf(), [])
  assert.equal(recordHeadline(recordSummary([])), 'Nothing on the books yet')
})

test('every kind can be opened, or says which screen it goes to', () => {
  // A record row that promises to open something and has no way to is the
  // badge it replaced. Every kind must at least name an opener.
  for (const [kind, spec] of Object.entries(KINDS)) {
    assert.ok(spec.open, `${kind} has no opener`)
    assert.ok(spec.one && spec.many, `${kind} has no words to count it with`)
    assert.ok(spec.icon && spec.label, `${kind} has no icon or label`)
  }
})
