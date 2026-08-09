// The dashboard's colour thresholds. Run: npm test
//
// Three things have to line up for one of these to work, and they live in
// three different files: the seeded value (migration), the offline fallback
// (public/main.js STAT_BANDS) and the editability whitelist (pages/api/
// settings.js SETTING_RULES). Miss the third and the setting exists, seeds,
// prices the colour — and is silently read-only in Settings, which is the
// failure you would only find by trying to change it months later.
//
// So this test wires the three together, and then checks the banding logic
// itself by lifting the real function out of main.js rather than restating it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const MAIN = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')
const API = readFileSync(new URL('../pages/api/settings.js', import.meta.url), 'utf8')
const MIGRATION = readFileSync(
  new URL('../supabase/migrations/20260809120000_dashboard_stat_thresholds.sql', import.meta.url), 'utf8')

function block(src, header, open, close) {
  const start = src.indexOf(header)
  assert.ok(start > -1, `could not find ${header}`)
  const from = src.indexOf(open, start)
  let depth = 0
  for (let i = from; i < src.length; i++) {
    if (src[i] === open) depth++
    else if (src[i] === close && --depth === 0) return src.slice(from, i + 1)
  }
  throw new Error(`unterminated ${header}`)
}

// eslint-disable-next-line no-new-func -- reading the app's own literal beats
// keeping a second copy of it here, which is the very bug under test.
const STAT_BANDS = new Function(`return ${block(MAIN, 'const STAT_BANDS =', '{', '}')}`)()

const seeded = new Map(
  [...MIGRATION.matchAll(/\('(dash_\w+)',\s*([\d.]+)/g)].map((m) => [m[1], Number(m[2])])
)

test('every band names an amber and a red key, and both are seeded', () => {
  const missing = []
  for (const [name, b] of Object.entries(STAT_BANDS)) {
    for (const key of [b.amber, b.red]) {
      if (!seeded.has(key)) missing.push(`${name}: ${key} is not seeded by the migration`)
    }
  }
  assert.deepEqual(missing, [], missing.join('\n'))
})

test('the offline fallbacks match what the migration seeds', () => {
  // FALLBACK_RATES has the same contract for the same reason: the client prices
  // with these before settings load, so a disagreement is a card that changes
  // colour a second after it appears.
  const drift = []
  for (const [name, b] of Object.entries(STAT_BANDS)) {
    if (seeded.get(b.amber) !== b.amberDefault) drift.push(`${name}.amber: code ${b.amberDefault}, migration ${seeded.get(b.amber)}`)
    if (seeded.get(b.red) !== b.redDefault) drift.push(`${name}.red: code ${b.redDefault}, migration ${seeded.get(b.red)}`)
  }
  assert.deepEqual(drift, [], drift.join('\n'))
})

test('every threshold is actually editable from Settings', () => {
  const rules = block(API, 'const SETTING_RULES =', '{', '}')
  const meta = block(MAIN, 'const FEE_META =', '{', '}')
  const unreachable = []
  for (const b of Object.values(STAT_BANDS)) {
    for (const key of [b.amber, b.red]) {
      // In the API whitelist, or the endpoint refuses the write.
      if (!new RegExp(`\\b${key}\\s*:`).test(rules)) unreachable.push(`${key} is not in SETTING_RULES — the save would be rejected`)
      // …and labelled, or it lands in the "⚙️ Other" bucket as a raw key name.
      if (!new RegExp(`\\b${key}\\s*:`).test(meta)) unreachable.push(`${key} has no FEE_META entry — Settings would show the raw key`)
    }
  }
  assert.deepEqual(unreachable, [], unreachable.join('\n'))
})

test('statBand — the bands themselves, using the app’s own function', () => {
  const src = MAIN.slice(MAIN.indexOf('function statBand(name, value) {'))
  const body = block(src, 'function statBand', '{', '}')
  const statBand = new Function('STAT_BANDS', 'settingNum',
    `function statBand(name, value) ${body}; return statBand`)(
    STAT_BANDS,
    // No settings loaded: every lookup falls through to the code default, which
    // is the state the app is in for the first moment after every sign-in.
    (_key, fallback) => fallback
  )

  // Bigger is worse — arrears default amber 250 / red 1000.
  assert.equal(statBand('arrears', 0), 'clear', 'nothing owed is worth saying in green')
  assert.equal(statBand('arrears', 40), '', 'ordinary trading is not a warning')
  assert.equal(statBand('arrears', 250), 'amber', 'the band is inclusive at its edge')
  assert.equal(statBand('arrears', 999.99), 'amber')
  assert.equal(statBand('arrears', 1000), 'red')

  // Smaller is worse — phones left default amber 3 / red 1.
  assert.equal(statBand('phonesFree', 30), '', 'a full shelf is neutral')
  assert.equal(statBand('phonesFree', 3), 'amber')
  assert.equal(statBand('phonesFree', 1), 'red')
  assert.equal(statBand('phonesFree', 0), 'red', 'none left is not "clear"')

  assert.equal(statBand('nonesuch', 5), '', 'an unknown metric stays neutral rather than throwing')
})

test('an owner can switch a colour off, or make it permanent', () => {
  const src = MAIN.slice(MAIN.indexOf('function statBand(name, value) {'))
  const body = block(src, 'function statBand', '{', '}')
  const withSettings = (values) => new Function('STAT_BANDS', 'settingNum',
    `function statBand(name, value) ${body}; return statBand`)(
    STAT_BANDS, (key, fallback) => (key in values ? values[key] : fallback))

  // Amber at 0: the warning is permanent, and the green "all clear" is gone.
  // That is a real choice, not a bug — a shop that wants to be nagged.
  const nagging = withSettings({ dash_arrears_amber: 0, dash_arrears_red: 1000 })
  assert.equal(nagging('arrears', 0), 'amber')

  // A red step nothing will reach switches red off without touching amber.
  const noRed = withSettings({ dash_arrears_amber: 250, dash_arrears_red: 1e9 })
  assert.equal(noRed('arrears', 50000), 'amber')
})
