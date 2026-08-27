// The provider rules, and the browser copy of them.
//
// Shloime, 27 Aug: "At mobile provider, select from dropdown, if country is
// USA, USMobile, Tello, other (asking what provider? and add as provider on
// list if not yet in system) if israel or other country, type in provider
// names, after entered once, it should be saved to dropdown list to this
// country. If USMobile selected, choose from additianal dropdown ATT, Verizon,
// or T-Mobile."
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  PROVIDER_SEEDS, US_MOBILE_SUB_BRANDS, isUsMobile, needsSubBrand,
  providersForCountry, resolveProvider,
} from '../lib/providers.mjs'

const SRC = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')
const lift = () => {
  const m = SRC.match(/\/\/ ── KC_PROV mirror start ──\n([\s\S]*?)\n\/\/ ── KC_PROV mirror end ──/)
  assert.ok(m, 'KC_PROV mirror region not found in public/main.js')
  return new Function(`${m[1]}; return KC_PROV;`)()
}

const USED = [
  { provider: 'Rami Levy Mobile', country: 'Israel' },
  { provider: 'Mint Mobile', country: 'USA' },
  { provider: 'us mobile', country: 'USA' },   // a sloppier spelling of a seed
  { provider: 'EE', country: 'UK' },
]

test('the browser mirror lists exactly what the lib lists', () => {
  const B = lift()
  for (const c of [null, 'USA', 'UK', 'Israel', 'Canada', 'EU', 'Nowhere']) {
    assert.deepEqual(B.providersForCountry(c, USED), providersForCountry(c, USED), `country ${c}`)
  }
})

test('the browser mirror resolves exactly what the lib resolves', () => {
  const B = lift()
  const cases = [
    { choice: '' }, { choice: 'Tello' }, { choice: 'US Mobile' },
    { choice: 'US Mobile', subBrand: 'Verizon' }, { choice: 'US Mobile', subBrand: 'Sky' },
    { choice: '__other__', typed: '' }, { choice: '__other__', typed: 'Rami Levy' },
    { choice: '__other__', typed: 'usmobile' },
    { choice: '__other__', typed: 'usmobile', subBrand: 'AT&T' },
    { choice: 'Tello', subBrand: 'Verizon' },
  ]
  for (const c of cases) assert.deepEqual(B.resolveProvider(c, 'USA'), resolveProvider(c, 'USA'), JSON.stringify(c))
})

test('USA offers what he asked for, and nothing British', () => {
  const usa = providersForCountry('USA')
  assert.deepEqual(usa, ['Tello', 'US Mobile'])
  assert.ok(!usa.includes('O2'), 'a USA phone must not offer British networks')
})

test('a name typed once is in that country’s list and no other', () => {
  assert.ok(providersForCountry('Israel', USED).includes('Rami Levy Mobile'))
  assert.ok(!providersForCountry('USA', USED).includes('Rami Levy Mobile'))
  assert.ok(providersForCountry('USA', USED).includes('Mint Mobile'))
})

test('a provider with no country recorded stays out of every country list', () => {
  // Every SIM plan is one of these — the SIM form has no country field. Letting
  // them through put Lebara and 1pMobile in the USA dropdown, which is the hunt
  // through other countries' networks this was meant to end.
  const noCountry = [{ provider: 'Lebara', country: null }, { provider: '1pMobile', country: null }]
  assert.deepEqual(providersForCountry('USA', noCountry), ['Tello', 'US Mobile'])
  // …and they are still offered where there is no country to contradict.
  assert.ok(providersForCountry(null, noCountry).includes('1pMobile'))
})

test('one spelling wins — the seed’s', () => {
  // "us mobile" was used on a real record; the list must not show it beside
  // "US Mobile" as if they were two companies.
  const usa = providersForCountry('USA', USED)
  assert.equal(usa.filter((n) => isUsMobile(n)).length, 1)
  assert.ok(usa.includes('US Mobile'))
})

test('US Mobile insists on a network; nothing else is asked', () => {
  assert.ok(needsSubBrand('US Mobile') && needsSubBrand('usmobile') && needsSubBrand('U.S. Mobile'))
  assert.ok(!needsSubBrand('Tello'))
  assert.match(resolveProvider({ choice: 'US Mobile' }, 'USA').error, /AT&T, Verizon or T-Mobile/)
  assert.equal(resolveProvider({ choice: 'US Mobile', subBrand: 'T-Mobile' }, 'USA').subBrand, 'T-Mobile')
  assert.deepEqual(US_MOBILE_SUB_BRANDS, ['AT&T', 'Verizon', 'T-Mobile'])
})

test('a sub-brand on a non-US-Mobile provider is dropped, not stored', () => {
  assert.equal(resolveProvider({ choice: 'Tello', subBrand: 'Verizon' }, 'USA').subBrand, '')
})

test('typing "usmobile" into Other still gets asked which network', () => {
  // The question follows the PROVIDER, not the dropdown — otherwise the one
  // route that bypasses the list also bypasses the rule.
  assert.match(resolveProvider({ choice: '__other__', typed: 'usmobile' }, 'USA').error, /AT&T/)
})

test('no country means offer everything rather than invent a scope', () => {
  // The SIM-plan form has no country field.
  const all = providersForCountry(null)
  for (const c of Object.keys(PROVIDER_SEEDS)) {
    for (const n of PROVIDER_SEEDS[c]) assert.ok(all.includes(n), `${n} missing from the unscoped list`)
  }
})
