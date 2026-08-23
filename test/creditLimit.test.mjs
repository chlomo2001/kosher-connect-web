// The Epos Now Customer Credit idea, KC-shaped (owner's KB capture, 23 Aug).
//
// Epos Now's till carries a per-customer Max Credit and REFUSES credit past
// it. KC draws the same line but warns instead of refusing — the counter can
// see the person standing there, the till cannot — and it warns twice: in the
// tender panel the moment the sale would cross the line (the say-it-where-
// it-is-decided rule the walk-in note already follows), and again on a red
// confirm at Charge, because a panel line can scroll past a busy counter.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const MAIN = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')
const CODE = MAIN.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
const SHELL = readFileSync(new URL('../components/AppShell.js', import.meta.url), 'utf8')

// The projection, lifted and run — the arithmetic is the feature.
const fnSrc = MAIN.match(/function posOverCreditLimit\(cust, paid, total\) \{[\s\S]*?\n\}/)[0]
const makeFn = (balance, wallet) => new Function(
  'customerLedgerBalance', 'posWallet',
  `${fnSrc}; return posOverCreditLimit;`
)(() => balance, wallet)

test('within the limit, paid now, no limit set, or walk-in: silence', () => {
  const f = makeFn(0, 0)
  assert.equal(f({ creditLimit: 100 }, true, 50), null, 'a paid sale never warns')
  assert.equal(f(null, false, 50), null, 'no customer, no line to cross')
  assert.equal(f({ creditLimit: '' }, false, 50), null, 'blank means no limit')
  assert.equal(f({ creditLimit: 100 }, false, 60), null, '£60 on account against a £100 limit is fine')
})

test('past the line it names both numbers, wallet slice counted first', () => {
  const f = makeFn(0, 0)
  const over = f({ creditLimit: 100 }, false, 150)
  assert.deepEqual(over, { owing: 150, limit: 100 })
  // £80 already owed + £30 more crosses a £100 limit…
  const f2 = makeFn(-80, 0)
  assert.deepEqual(f2({ creditLimit: 100 }, false, 30), { owing: 110, limit: 100 })
  // …but a wallet slice that covers the sale keeps it off the account entirely.
  const f3 = makeFn(-80, 30)
  assert.equal(f3({ creditLimit: 100 }, false, 30), null)
})

test('credit held works FOR the customer — balance nets before the line is judged', () => {
  const f = makeFn(40, 0) // £40 in credit
  assert.equal(f({ creditLimit: 100 }, false, 120), null, '£120 minus £40 credit = £80 owing, inside £100')
  assert.deepEqual(f({ creditLimit: 100 }, false, 150), { owing: 110, limit: 100 })
})

test('the form field exists and round-trips through the customer payload', () => {
  assert.match(SHELL, /id="fCreditLimit"/)
  assert.match(CODE, /creditLimit: \(Number\(document\.getElementById\('fCreditLimit'\)\?\.value\) > 0/)
  assert.match(CODE, /cl\.value = \(Number\(c\.creditLimit\) > 0 \? c\.creditLimit : ''\)/)
})

test('both warnings are wired: the panel line and the red confirm at Charge', () => {
  assert.match(CODE, /posOverCreditLimit\(cust, paid, total\)/, 'the tender panel asks at decision time')
  assert.match(CODE, /posOverCreditLimit\(custObj, false, totalBefore\)/, 'the charge path asks again')
  assert.match(CODE, /okLabel: 'Put it on account anyway',\s*\n\s*danger: true/, 'pressing on is the money-moving choice — red, per #19')
})
