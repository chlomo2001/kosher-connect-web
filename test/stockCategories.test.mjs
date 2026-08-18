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

test('the server validates against this module, including the owner list', () => {
  // The allowlist that rejects a bad category must be THIS module's merged
  // keys (defaults + the owner's), not a private copy that can drift.
  const shop = readFileSync(new URL('../pages/api/shop.js', import.meta.url), 'utf8')
  assert.match(shop, /mergedStockCategoryKeys/, 'shop.js must build its allowlist from mergedStockCategoryKeys')
  assert.match(shop, /allowedCategoryKeys\(\)\)\.includes\(b\.category\)/, 'a saved item is checked against the merged allowlist')
  assert.doesNotMatch(shop, /const CATEGORIES = \[/, 'shop.js must not keep its own category list')
  // …and the settings API must actually store the owner's list.
  const settings = readFileSync(new URL('../pages/api/settings.js', import.meta.url), 'utf8')
  assert.match(settings, /key === 'stock_categories'/, 'settings.js must handle the stock_categories key')
})

// ── the merge: defaults + the owner's own ────────────────────────────────────
import { mergeStockCategories, mergedStockCategoryKeys, customStockCategories, cleanCategoryLabel } from '../lib/stockCategories.mjs'

test('a custom category is appended under its own label as its key', () => {
  const merged = mergeStockCategories('Gift set, Watch strap')
  const defaults = STOCK_CATEGORIES.length
  assert.equal(merged.length, defaults + 2)
  assert.deepEqual(merged[defaults], ['Gift set', 'Gift set'])
  assert.deepEqual(merged[defaults + 1], ['Watch strap', 'Watch strap'])
})

test('a custom label that repeats a built-in is dropped — emoji ignored', () => {
  // "Phone" collides with the key, "Case & cover" and "Repair part" with the
  // built-in labels once their emoji are stripped. None may shadow a default.
  assert.deepEqual(customStockCategories('Phone, Case & cover, Repair part, Gift set'), ['Gift set'])
  // …and 'phone' can never be redefined, which is the one that carries money.
  const keys = mergedStockCategoryKeys('Phone, phone, PHONE')
  assert.equal(keys.filter((k) => k.toLowerCase() === 'phone').length, 1)
  assert.equal(keys[0], 'phone')
})

test('duplicates and blanks among the owner list collapse', () => {
  assert.deepEqual(customStockCategories('Gift, Gift, gift ,  , Gift Set'), ['Gift', 'Gift Set'])
})

test('a label is sanitised — no comma, no brackets, capped', () => {
  assert.equal(cleanCategoryLabel('  A <b>bold</b>, item  '), 'A bbold/b item')
  assert.equal(cleanCategoryLabel('x'.repeat(80)).length, 40)
  // emoji survive — an owner may prefix one like the built-ins do
  assert.equal(cleanCategoryLabel('🎁 Gift'), '🎁 Gift')
})

// ── the browser mirror of the merge agrees with the module ───────────────────
function liftClientMerge() {
  const grab = (re, what) => { const m = SRC.match(re); assert.ok(m, `${what} not found`); return m[0] }
  const labels = grab(/const STOCK_CATEGORY_LABELS = \{[\s\S]*?\};/, 'STOCK_CATEGORY_LABELS')
  const bare = grab(/const kcBareCat = [^\n]+/, 'kcBareCat')
  const fn = grab(/function stockCategories\(\) \{[\s\S]*?\n\}/, 'stockCategories')
  return new Function('csv',
    `const pricingConfig = { settings: [{ key: 'stock_categories', textValue: csv }] };
     ${labels}\n${bare}\n${fn}\n return stockCategories();`)
}

test('the browser stockCategories() matches lib mergeStockCategories() exactly', () => {
  const clientMerge = liftClientMerge()
  for (const csv of ['', 'Gift set', 'Gift, Gift, Phone, Case & cover', 'Watch strap, 🎁 Gift box, Repair part',
    'a, b, c, d, e', '  ,  , ', 'Very long name that exceeds the forty character cap for sure yes',
    // digits distinguish the unicode-aware key from an ascii-only one — Type 5
    // and Type5 are two categories, not one, and the mirror must agree on that.
    'Type 5, Type5, Grade 2 SIM']) {
    assert.deepEqual(clientMerge(csv), mergeStockCategories(csv), `merge differs for "${csv}"`)
  }
})
