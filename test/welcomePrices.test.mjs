// The welcome page's rental prices must come from the rental_rates rows the
// till bills from — never from text typed into the page.
//
// This test exists because all three typed numbers had silently drifted by
// 19 Aug 2026: the page said £3 a day (cheapest destination is £2), a £20
// minimum (USA-no-SIM is £15) and a £45 cap (the lowest is £30). A price a
// customer reads is a promise; it has to be the same list the shop charges.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const SRC = readFileSync(new URL('../pages/welcome.js', import.meta.url), 'utf8')
const withPrices = (() => {
  const m = SRC.match(/const money = [\s\S]*?\nexport default function/)
  assert.ok(m, 'the price formatter is missing from pages/welcome.js')
  return new Function(m[0].replace('export function', 'function').replace('\nexport default function', '') + '; return withPrices;')()
})()

const BAND = {
  body: 'You pay by the day{minClause}, Shabbos and Yom Tov are never charged.',
  price: '{dayClause}{minSpec}{capSpec}Shabbos & Yom Tov never charged',
}
const RATES = { day: { from: 2, to: 3 }, min: { from: 15, to: 25 }, cap: { from: 30, to: 50 } }

test('the live rates fill every clause, in English and in Hebrew', () => {
  const en = withPrices(BAND, RATES, 'en')
  assert.equal(en.price, '£2–£3 a day · minimum £15–£25 · capped £30–£50 a month · Shabbos & Yom Tov never charged')
  assert.match(en.body, /\(minimum £15–£25 by destination\)/)
  const he = withPrices(BAND, RATES, 'he')
  assert.match(he.price, /£2–£3/)
  assert.match(he.price, /מינימום/)
})

test('no rates means NO price, never a stale one', () => {
  const out = withPrices(BAND, null, 'en')
  assert.equal(out.body, 'You pay by the day, Shabbos and Yom Tov are never charged.')
  assert.equal(out.price, 'Shabbos & Yom Tov never charged')
  assert.ok(!/[£{}]/.test(out.body + out.price), 'a placeholder or stray £ leaked to the page')
})

test('a single-value range reads as one price, not "£20–£20"', () => {
  const flat = { day: { from: 3, to: 3 }, min: { from: 20, to: 20 }, cap: { from: 50, to: 50 } }
  assert.equal(withPrices(BAND, flat, 'en').price, '£3 a day · minimum £20 · capped £50 a month · Shabbos & Yom Tov never charged')
})

test('the travel band carries placeholders, not typed pounds', () => {
  // Scoped to the rental band in both languages: other bands (virtual numbers)
  // still carry their own prices and are not this test's business.
  for (const marker of ['A kosher phone, sorted before you travel', 'טסים לארה״ב']) {
    const at = SRC.indexOf(marker)
    assert.ok(at > 0, `band not found: ${marker}`)
    const band = SRC.slice(at, SRC.indexOf('note:', at) + 200)
    assert.ok(/\{minClause\}/.test(band), `${marker}: body lost its {minClause} placeholder`)
    assert.deepEqual(band.match(/£\d+/g), null,
      `${marker}: a price is typed into the copy again — it must come from rental_rates`)
  }
})
