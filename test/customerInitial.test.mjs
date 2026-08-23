// The phone-book jump (owner, 23 Aug: "while pressing 'A' it should filter to
// all A initials customers (instead of neding to go to the search box)").
//
// The hazard in a bare-letter shortcut is everything it must NOT do: eat
// letters someone is typing into a box, fire under a modal, fire on another
// tab, or swallow Ctrl+A. The tests pin the guards as hard as the feature.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const MAIN = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')
const CODE = MAIN.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')

test('the filter follows the SORT column — surname when sorting by surname', () => {
  assert.match(CODE, /surnameFirst \? \(c\.lastName \|\| c\.firstName\) : \(c\.firstName \|\| c\.lastName\)/)
})

test('the guards: no typing fields, no modals, no modifiers, customers tab only', () => {
  const m = MAIN.match(/\/\/ ── The phone-book jump ─[\s\S]*?\n\}\);/)
  assert.ok(m, 'the handler block is missing')
  const h = m[0]
  assert.match(h, /currentTab !== 'customers'/)
  assert.match(h, /e\.ctrlKey \|\| e\.metaKey \|\| e\.altKey/)
  assert.match(h, /INPUT|isContentEditable/)
  assert.match(h, /kcTopModalOverlay\(\)/)
})

test('the same letter toggles off, Escape clears, Hebrew letters count too', () => {
  assert.match(CODE, /customerInitial === L \? '' : L/)
  assert.match(CODE, /e\.key === 'Escape' && customerInitial/)
  assert.match(CODE, /\[א-ת\]/)
})

test('the letter is visible while it narrows: chip on, empty state honest', () => {
  assert.match(CODE, /custInitialChip/)
  assert.match(CODE, /setCustomerInitial\(''\)/)
  assert.match(CODE, /Nobody under/)
})

// ── the passport filter, while we are on this screen ───────────────────────

test('the 🛂 filter counts a passport saved on the CUSTOMER, not only on a booking', () => {
  // Moishe Zev Salinsky (owner, 23 Aug): passport saved via the scan reader —
  // details on his customer record, no flight anywhere — and the filter
  // showed everyone but him, because it read bookings alone.
  const m = MAIN.match(/function customerHasPassport\(c\) \{[\s\S]*?\n\}/)[0]
  assert.match(m, /c\.passportNumber \|\| c\.passportExpiry/)
  assert.match(m, /b\.hasPassportDetails/)
  const fn = new Function('bookings', `${m}; return customerHasPassport;`)([])
  assert.equal(fn({ passportNumber: 'X' }), true)
  assert.equal(fn({ passportExpiry: '2030-01-01' }), true)
  assert.equal(fn({ dob: '1990-01-01' }), false, 'a birthday is not a passport')
  assert.equal(fn({}), false)
})
