// A rental has to record HOW it was paid, not only that it was.
//
// The new-rental form has asked cash / card / transfer since the beginning.
// Both save paths read the answer — to decide whether any money moved — and
// then threw it away, so every rental payment reached the ledger with
// `method` null. Cash-up buckets the day by method and, worse,
// `cashExpected()` counts only rows whose method is 'cash'. A hire paid in
// cash therefore never reached expected cash: the drawer read OVER by that
// amount at the end of the day, every day, and the variance pointed at
// nothing in particular.
//
// Three things have to hold, and each is a test below.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PAYMENT_METHODS, cashExpected } from '../lib/money.mjs'

const MAIN = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')
const STORE = readFileSync(new URL('../lib/tableStore.js', import.meta.url), 'utf8')

// 1. Every tender the counter can PICK must be one the ledger can STORE.
//
// `method` is a Postgres enum, so an unrecognised string does not degrade to
// null — it fails the insert, and the rental does not save. Adding a friendly
// new option to the dropdown is exactly the innocent-looking change that would
// break saving a rental at the till, so the two lists are pinned together
// here rather than in somebody's memory.
test('every payment option on the rental form is a tender the ledger accepts', () => {
  const sel = MAIN.match(/<select[^>]*id="rPay"[\s\S]*?<\/select>/)
  assert.ok(sel, 'the rental form no longer has an #rPay picker — has it moved?')
  const values = [...sel[0].matchAll(/value="([^"]+)"/g)].map((m) => m[1])
  assert.ok(values.length >= 2, 'expected several payment options')
  for (const v of values) {
    if (v === 'account') continue // wallet, not a tender — no money moves now
    assert.ok(PAYMENT_METHODS.has(v),
      `the form offers "${v}" but the payment_method enum has no such value — `
      + 'saving a rental paid that way would fail at the counter')
  }
})

// 2. Both save paths must carry it. There are two, and only one of them
//    getting this right is how the multi-phone batch drifted from the single
//    rental before.
test('both rental save paths put the method on the rental', () => {
  const hits = [...MAIN.matchAll(/paymentMethod:/g)]
  assert.equal(hits.length, 2,
    'expected the single-rental and multi-phone paths each to record a method')
})

// 3. The ledger writer must whitelist rather than pass through, and must put
//    the tender ONLY on the payment row — a price correction is not money in.
test('the ledger writer guards the tender against the enum', () => {
  assert.match(STORE, /PAYMENT_METHODS\.has\(r\.paymentMethod\)/,
    'an unchecked method string would fail the insert and lose the whole save')
  assert.match(STORE, /method: usePayment \? method : null/,
    'a rental_adjustment is a price correction, not a tender')
})

// The reason any of it matters, stated as arithmetic.
test('cash taken on a rental reaches expected cash; a method-less one cannot', () => {
  const float = 50
  const withMethod = [{ amount: 61.2, method: 'cash' }]
  const without = [{ amount: 61.2, method: null }]
  assert.equal(cashExpected(withMethod, float), 111.2)
  assert.equal(cashExpected(without, float), 50,
    'this is the old behaviour: the drawer holds £61.20 the count does not expect')
})

test('a card rental does not inflate the cash the drawer should hold', () => {
  assert.equal(cashExpected([{ amount: 61.2, method: 'card' }], 50), 50)
})
