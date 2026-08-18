// The stock categories live in two places — lib/stockCategories.mjs (imported
// by the server that validates a saved item) and a mirror in public/main.js
// (the browser cannot import). Two copies of a list is how a category the
// dropdown offers becomes one the server rejects, so this holds them together —
// same keys, same labels, same order — the way pricingMirror and
// bookingGateMirror do for their pairs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { STOCK_CATEGORIES, STOCK_CATEGORY_KEYS, STOCK_CATEGORY_LABELS, LOAD_BEARING_CATEGORY } from '../lib/stockCategories.mjs'

const SRC = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')

// Lift the browser literal: `const STOCK_CATEGORY_LABELS = { ... };`
function browserLabels() {
  const m = SRC.match(/const STOCK_CATEGORY_LABELS = \{([\s\S]*?)\};/)
  assert.ok(m, 'STOCK_CATEGORY_LABELS not found in public/main.js')
  const out = {}
  const order = []
  for (const pair of m[1].matchAll(/(\w+):\s*'([^']*)'/g)) { out[pair[1]] = pair[2]; order.push(pair[1]) }
  return { labels: out, order }
}

test('the browser mirror has exactly the module keys, in the same order', () => {
  const { order } = browserLabels()
  assert.deepEqual(order, STOCK_CATEGORY_KEYS,
    'the main.js STOCK_CATEGORY_LABELS keys/order drifted from lib/stockCategories.mjs')
})

test('every label matches between the two copies', () => {
  const { labels } = browserLabels()
  for (const [k, label] of STOCK_CATEGORIES) {
    assert.equal(labels[k], label, `label for "${k}" differs — module "${label}", browser "${labels[k]}"`)
  }
  assert.equal(Object.keys(labels).length, Object.keys(STOCK_CATEGORY_LABELS).length)
})

test("'phone' is present and stays first — it is the load-bearing one", () => {
  // A phone line captures an IMEI and a phone sale posts a 'phone_sale' ledger
  // row. Lose the key and both break; the test names why it must not move.
  assert.equal(LOAD_BEARING_CATEGORY, 'phone')
  assert.ok(STOCK_CATEGORY_KEYS.includes('phone'))
  assert.equal(STOCK_CATEGORY_KEYS[0], 'phone')
  assert.ok(browserLabels().labels.phone, 'the browser mirror dropped phone')
})

test('the four original keys survive, so existing stock keeps its category', () => {
  // 13 items are 'phone' and one is 'other' today; 'accessory' and 'sim' are
  // valid with no rows. Renaming or removing any of these four would orphan a
  // saved item. New categories may be ADDED; these four may not vanish.
  for (const k of ['phone', 'accessory', 'sim', 'other']) {
    assert.ok(STOCK_CATEGORY_KEYS.includes(k), `original category "${k}" was dropped`)
  }
})

test('keys are plain slugs and unique', () => {
  const seen = new Set()
  for (const k of STOCK_CATEGORY_KEYS) {
    assert.match(k, /^[a-z]+$/, `"${k}" is not a plain slug`)
    assert.ok(!seen.has(k), `duplicate key "${k}"`)
    seen.add(k)
  }
})

test('the server validates against this list', () => {
  // The allowlist that rejects a bad category must be THIS module, not a private
  // copy that can drift — the bug the whole file exists to prevent.
  const shop = readFileSync(new URL('../pages/api/shop.js', import.meta.url), 'utf8')
  assert.match(shop, /STOCK_CATEGORY_KEYS\.includes\(b\.category\)/, 'shop.js must validate against STOCK_CATEGORY_KEYS')
  assert.doesNotMatch(shop, /const CATEGORIES = \[/, 'shop.js must not keep its own category list')
})
