// The next action on every screen (port item B2).
//
// The decision is here and the words are here; the browser owns only the counts
// and what each action does. So these tests can hold the whole judgement without
// a browser, which is the point of splitting it that way.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nextAction, screenNextAction, SCREENS, NOTHING, allActionKeys } from '../lib/nextAction.mjs'

test('a row that names an action and offers no way to do it cannot be built', () => {
  // Six of the source app's screens shipped exactly this: a sentence telling
  // you what was outstanding, and nothing to press. Beside the screens that do
  // work, that reads as broken.
  assert.throws(() => nextAction({ text: 'Chase 3 phones', label: 'Show them' }), /offers no way/)
  assert.throws(() => nextAction({ text: 'Chase 3 phones', do: 'rentals.overdue' }), /names no button/)
  assert.throws(() => nextAction({ label: 'Show them', do: 'rentals.overdue' }), /must say what to do/)
  // …and the escape hatch is explicit, never accidental.
  assert.deepEqual(nextAction({ clear: true }), { clear: true, text: NOTHING })
})

test('a quiet screen says so and loses the button', () => {
  for (const screen of SCREENS) {
    const row = screenNextAction(screen, {})
    assert.equal(row.clear, true, `${screen} invented work out of no facts`)
    assert.equal(row.text, NOTHING)
    assert.equal(row.label, undefined, `${screen} kept a button on an empty queue`)
  }
})

test('the words are verbs about a number, and the number is the fact given', () => {
  const row = screenNextAction('rentals', { overdueRentals: 3 })
  assert.equal(row.text, '3 phones overdue back')
  assert.equal(row.label, 'Show them')
  assert.equal(row.count, 3)
  assert.equal(row.tone, 'urgent')
  assert.equal(screenNextAction('rentals', { overdueRentals: 1 }).text, '1 phone overdue back')
  assert.equal(screenNextAction('repairs', { readyRepairs: 1 }).text, '1 repair ready to collect')
  assert.equal(screenNextAction('repairs', { readyRepairs: 4 }).text, '4 repairs ready to collect')
  assert.equal(screenNextAction('sim', { lateRenewals: 2 }).text, '2 SIM plans past the renewal date')
})

test('the loudest thing wins, and the quieter one appears once it is alone', () => {
  const both = screenNextAction('rentals', { overdueRentals: 2, dueTodayRentals: 5 })
  assert.equal(both.do, 'rentals.overdue', 'an overdue phone outranks one due back today')
  const one = screenNextAction('rentals', { overdueRentals: 0, dueTodayRentals: 5 })
  assert.equal(one.do, 'rentals.dueToday')
  assert.equal(one.text, '5 rentals due back today')
})

test('the dashboard speaks for every screen, in order of loudness', () => {
  const f = { overdueRentals: 1, readyRepairs: 1, lateRenewals: 1, dueTasks: 1, mailPending: 1 }
  assert.equal(screenNextAction('dashboard', f).do, 'rentals.overdue')
  assert.equal(screenNextAction('dashboard', { ...f, overdueRentals: 0 }).do, 'repairs.ready')
  assert.equal(screenNextAction('dashboard', { ...f, overdueRentals: 0, readyRepairs: 0 }).do, 'sim.late')
  assert.equal(screenNextAction('dashboard', { dueTasks: 2 }).do, 'tasks.due')
  assert.equal(screenNextAction('dashboard', { mailPending: 2 }).do, 'mail.pending')
  // …and it is the one screen that must never say "all clear" while a tab
  // behind it has work on it.
  assert.equal(screenNextAction('dashboard', { lowStock: 3 }).clear, true,
    'low stock is the shop screen’s job — the dashboard has its own line for it')
})

test('a renewal that happens by itself is not work', () => {
  // Owner, 19 Aug: "why is auto renew a needs attention? its just auto, no?"
  // Only a renewal PAST its date is here — that one did not happen by itself.
  assert.equal(screenNextAction('sim', { renewalsSoon: 9 }).clear, true)
  assert.equal(screenNextAction('sim', { lateRenewals: 1 }).clear, false)
})

test('the screens with no queue of their own stay quiet whatever they are told', () => {
  const noisy = { overdueRentals: 9, readyRepairs: 9, dueTasks: 9, lowStock: 9, arrears: 9 }
  for (const screen of ['services', 'koltorah', 'virtual', 'settings']) {
    assert.equal(screenNextAction(screen, noisy).clear, true,
      `${screen} is a place you go to do a thing, not a queue`)
  }
})

test('an unknown screen is quiet rather than a crash', () => {
  assert.equal(screenNextAction('nonesuch', { overdueRentals: 5 }).clear, true)
  assert.equal(screenNextAction(undefined).clear, true)
})

test('every action a screen can name is discovered, not hand-listed', () => {
  const keys = allActionKeys()
  // Both branches of every two-branch screen, not just the loudest.
  assert.ok(keys.includes('rentals.overdue') && keys.includes('rentals.dueToday'))
  assert.ok(keys.includes('shop.low') && keys.includes('shop.returns'))
  assert.ok(keys.includes('bookings.upcoming') && keys.includes('bookings.tickets'))
  assert.equal(keys.length, new Set(keys).size, 'the key list repeats itself')
  for (const k of keys) assert.match(k, /^[a-z]+\.[a-zA-Z]+$/, `${k} is not a screen.action key`)
})
