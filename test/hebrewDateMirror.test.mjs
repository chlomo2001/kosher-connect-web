// Three-way hold on the Hebrew date logic.
//
// 1. The KC_HEBREW mirror in public/main.js is lifted and compared to
//    lib/hebrewDate.mjs function by function over anchors and a daily sweep —
//    the pricing-mirror pattern.
// 2. The lib is cross-checked against the PLATFORM's own Hebrew calendar
//    (Intl, ICU) over the sweep — an independent implementation agreeing on
//    every single day is the strongest correctness evidence available here.
// 3. The app's existing numToHebrew gematria (Intl path's formatter) is held
//    to the lib's numeral over the domain the app actually uses, so the two
//    renderings can never disagree on a screen.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  hebrewFromGregorian, hebrewNumeral, hebrewMonthName, formatHebrewDate,
  hebrewWeekday, hebrewMonthDays, hebrewToRd,
} from '../lib/hebrewDate.mjs'

const SRC = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')

function liftMirror() {
  const m = SRC.match(/\/\/ ── KC_HEBREW mirror start ──\n([\s\S]*?)\n\/\/ ── KC_HEBREW mirror end ──/)
  assert.ok(m, 'KC_HEBREW mirror region not found in public/main.js')
  return new Function(`${m[1]}; return KC_HEBREW;`)()
}

function* sweep() {   // every day of 2024-2027 as [gy, gm, gd]
  const len = (y, m) => [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
  for (let y = 2024; y <= 2027; y++)
    for (let m = 1; m <= 12; m++)
      for (let d = 1; d <= len(y, m); d++) yield [y, m, d]
}

test('the browser mirror agrees with the lib on every day of 2024-2027', () => {
  const B = liftMirror()
  for (const [y, m, d] of sweep()) {
    assert.deepEqual(B.hebrewFromGregorian(y, m, d), hebrewFromGregorian(y, m, d),
      `mirror diverged at ${y}-${m}-${d}`)
  }
  assert.equal(B.format(2026, 8, 18), formatHebrewDate(2026, 8, 18))
  assert.equal(B.format(2026, 8, 18), 'ה׳ אלול תשפ״ו')
  assert.equal(B.weekday(2026, 8, 18), hebrewWeekday(2026, 8, 18))
  for (let n = 1; n <= 999; n++) assert.equal(B.numeral(n), hebrewNumeral(n), `numeral ${n}`)
  for (let y = 5780; y <= 5790; y++)
    for (let m = 1; m <= (((7 * y + 1) % 19) < 7 ? 13 : 12); m++) {
      assert.equal(B.monthName(y, m), hebrewMonthName(y, m), `month name ${y}/${m}`)
      assert.equal(B.monthDays(y, m), hebrewMonthDays(y, m), `month days ${y}/${m}`)
    }
})

test('the lib agrees with the platform Hebrew calendar (ICU) on every day of 2024-2027', () => {
  const fmt = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { day: 'numeric', month: 'long', year: 'numeric' })
  // ICU spells some months in modern orthography; map to ours before comparing.
  const NAME_MAP = { 'חשוון': 'חשון', 'מרחשוון': 'חשון', 'מרחשון': 'חשון', 'סיוון': 'סיון', 'אדר א׳': 'אדר א׳', 'אדר ב׳': 'אדר ב׳' }
  for (const [y, m, d] of sweep()) {
    const parts = fmt.formatToParts(new Date(Date.UTC(y, m - 1, d, 12)))
    const icuDay = parseInt(parts.find(p => p.type === 'day')?.value || '0')
    const icuYear = parseInt(parts.find(p => p.type === 'year')?.value || '0')
    const icuMonthRaw = parts.find(p => p.type === 'month')?.value || ''
    const icuMonth = NAME_MAP[icuMonthRaw] || icuMonthRaw
    const ours = hebrewFromGregorian(y, m, d)
    assert.equal(ours.day, icuDay, `day differs from ICU at ${y}-${m}-${d}`)
    assert.equal(ours.year, icuYear, `year differs from ICU at ${y}-${m}-${d}`)
    assert.equal(hebrewMonthName(ours.year, ours.month), icuMonth,
      `month differs from ICU at ${y}-${m}-${d} (icu said "${icuMonthRaw}")`)
  }
})

test("the app's existing numToHebrew agrees with the lib over the used domain", () => {
  const m = SRC.match(/function numToHebrew\(n\) \{[\s\S]*?\n\}/)
  assert.ok(m, 'numToHebrew not found in public/main.js')
  const numToHebrew = new Function(`${m[0]}; return numToHebrew;`)()
  for (let d = 1; d <= 30; d++) assert.equal(numToHebrew(d), hebrewNumeral(d), `day ${d}`)
  for (let y = 5770; y <= 5820; y++) {
    assert.equal(numToHebrew(y), hebrewNumeral(y % 1000), `year ${y}`)
  }
})
