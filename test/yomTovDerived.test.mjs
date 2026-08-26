// The derived yom tov gate, held to the hand-checked table. Run: npm test
//
// lib/yomTov.mjs computes the thirteen diaspora days from lib/hebrewDate.mjs
// rather than carrying a list. That is only worth doing if the computation is
// right, and "it looked right for a few dates I tried" is not evidence — so
// this checks it against DIASPORA_YOM_TOV in public/main.js, all 1,378 dates,
// 2020 to 2125, which were hand-checked when the free-day pricing was built.
//
// Both directions matter. A derivation that says yes to everything would pass
// a one-way check and silence the shop's automated messages for ever.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isYomTov, isShabbos, isQuietDay } from '../lib/yomTov.mjs'

const MAIN = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')
const block = MAIN.match(/const DIASPORA_YOM_TOV = \[([\s\S]*?)\n\];/)
assert.ok(block, 'public/main.js no longer carries DIASPORA_YOM_TOV')
// Entries are '2026-04-02a' — the date plus a letter marking which of the
// thirteen it is. The letter is the free-day pricing's business, not ours.
const LISTED = [...block[1].matchAll(/'(\d{4}-\d{2}-\d{2})[a-m]'/g)].map((m) => m[1])

test('the table parsed, and is the size it should be', () => {
  assert.ok(LISTED.length > 1300, `only ${LISTED.length} dates parsed — the regex has drifted`)
  const years = new Set(LISTED.map((d) => d.slice(0, 4)))
  // Thirteen days a year, every year, is the invariant the table was built to.
  for (const y of years) {
    const n = LISTED.filter((d) => d.startsWith(y)).length
    assert.equal(n, 13, `${y} has ${n} yom tov days in the table, not 13`)
  }
})

test('every date the table calls yom tov, the derivation calls yom tov', () => {
  const missed = LISTED.filter((d) => !isYomTov(d))
  assert.deepEqual(missed.slice(0, 10), [],
    `${missed.length} of ${LISTED.length} hand-checked dates the derivation does not recognise`)
})

test('and nothing else in those years is', () => {
  // The other direction, and the one that catches a derivation that says yes
  // too often. Walk every day of every year the table covers.
  const listed = new Set(LISTED)
  const years = [...new Set(LISTED.map((d) => Number(d.slice(0, 4))))].sort()
  const extra = []
  for (const y of years) {
    for (let m = 1; m <= 12; m++) {
      for (let d = 1; d <= 31; d++) {
        const dt = new Date(Date.UTC(y, m - 1, d, 12))
        if (dt.getUTCMonth() !== m - 1) continue          // rolled into next month
        const iso = dt.toISOString().slice(0, 10)
        if (isYomTov(iso) && !listed.has(iso)) extra.push(iso)
      }
    }
  }
  assert.deepEqual(extra.slice(0, 10), [],
    `${extra.length} dates the derivation calls yom tov that the table does not`)
})

test('Shabbos is Saturday, in any timezone the server happens to be in', () => {
  assert.equal(isShabbos('2026-08-29'), true)   // a Saturday
  assert.equal(isShabbos('2026-08-28'), false)  // the Friday before
  assert.equal(isShabbos('2026-08-30'), false)  // the Sunday after
  // Constructed at UTC noon on purpose: read at midnight, a west-of-UTC server
  // reads the day before and a message goes out on Shabbos.
  assert.match(readFileSync(new URL('../lib/yomTov.mjs', import.meta.url), 'utf8'),
    /Date\.UTC\([^)]*12\)/, 'the weekday must be read at midday, not midnight')
})

test('a quiet day is either, and an ordinary Thursday is neither', () => {
  assert.equal(isQuietDay('2026-08-29'), true)   // Shabbos
  assert.equal(isQuietDay(LISTED[0]), true)      // yom tov
  assert.equal(isQuietDay('2026-08-27'), false)  // an ordinary Thursday
  assert.equal(isQuietDay(''), false)            // and nonsense is not a reason to send
  assert.equal(isQuietDay(null), false)
})
