// One visit, one place (owner, 23 Aug): "i had a customer come in, wanted to
// set up a rentals, tickets, bought a few items. but i couldnt do it all from
// one place". Rentals, SIMs, flights, repairs and print jobs already start
// from the customer card with the person pre-filled; the till was the one
// service that made the operator leave the card and re-find the customer.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const MAIN = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')
const CODE = MAIN.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')

test('the card offers the till, beside the other six services', () => {
  assert.match(CODE, /onclick="posOpenForCustomer\('\$\{c\.id\}'\)"/)
  assert.match(CODE, /Sell at the till/)
})

test('opening the till from the card attaches the customer through the SAME path a hand-pick uses', () => {
  const m = MAIN.match(/function posOpenForCustomer\(custId\) \{[\s\S]*?\n\}/)
  assert.ok(m, 'posOpenForCustomer missing')
  assert.match(m[0], /openOnTab\('shop'/)
  assert.match(m[0], /kcPickerSet\('posCustomer', String\(custId\)\)/)
  assert.match(m[0], /posCustomerChange\(\)/,
    'the hand-pick path is what brings wallet credit, usual payment, credit limit and the pop-up note along')
})

test('Exit till bounces back to the card it was opened from — and ONLY then', () => {
  // Owner, 23 Aug: "yes, bounce back to the card when done." Driven live in
  // the harness: card → till → Exit lands back on the card; a till opened
  // from the Shop tab exits to the shop as always; a sidebar navigation away
  // clears the target so no bounce fires later out of nowhere.
  const m = MAIN.match(/function closePosView\(\) \{[\s\S]*?\n\}/)[0]
  assert.match(m, /posReturnCustomer != null/)
  assert.match(m, /renderDetailPanel\(backTo\)/)
  assert.match(MAIN, /posReturnCustomer = null; \/\/ a chosen navigation is not an exit/)
  // Set AFTER arriving at the till — setting before meant the opening
  // navigation's own guard wiped it (the first harness drive caught it).
  const opener = MAIN.match(/function posOpenForCustomer\(custId\) \{[\s\S]*?\n\}/)[0]
  const openIdx = opener.indexOf('openSaleModal()')
  const setIdx = opener.indexOf('posReturnCustomer = custId')
  assert.ok(openIdx > -1 && setIdx > openIdx, 'the bounce target must be set after the till opens')
})
