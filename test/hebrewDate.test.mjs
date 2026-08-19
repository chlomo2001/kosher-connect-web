// The Hebrew-date converter, held to KNOWN dates — a wrong Hebrew date shown
// to this community is worse than none, so every anchor here is a date whose
// Hebrew equivalent is public knowledge (chagim), plus the one the owner's
// AHT screenshot showed, plus a multi-year round-trip sweep for internal
// consistency.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  hebrewFromGregorian, hebrewToRd, gregorianToRd, hebrewMonthDays,
  isHebrewLeapYear, monthsInHebrewYear, hebrewNumeral, hebrewMonthName,
  formatHebrewDate, hebrewWeekday,
} from '../lib/hebrewDate.mjs'

const h = (gy, gm, gd) => hebrewFromGregorian(gy, gm, gd)

// ── anchors ──────────────────────────────────────────────────────────────
test('the AHT screenshot date: 18 Aug 2026 is 5 Elul 5786, a Tuesday', () => {
  assert.deepEqual(h(2026, 8, 18), { year: 5786, month: 6, day: 5 })
  assert.equal(formatHebrewDate(2026, 8, 18), 'ה׳ אלול תשפ״ו')
  assert.equal(hebrewWeekday(2026, 8, 18), 'ג׳')
})

test('Rosh Hashana anchors: 5785 and 5786 begin on the known civil days', () => {
  assert.deepEqual(h(2024, 10, 3), { year: 5785, month: 7, day: 1 })
  assert.deepEqual(h(2025, 9, 23), { year: 5786, month: 7, day: 1 })
})

test('the year boundary: 22 Sep 2025 is still 29 Elul 5785, the next day is 5786', () => {
  assert.deepEqual(h(2025, 9, 22), { year: 5785, month: 6, day: 29 })
  assert.deepEqual(h(2025, 9, 23), { year: 5786, month: 7, day: 1 })
})

test('chagim: Pesach, Yom Kippur, Chanukah land where the calendar says', () => {
  assert.deepEqual(h(2025, 4, 13), { year: 5785, month: 1, day: 15 })   // 15 Nisan
  assert.deepEqual(h(2025, 10, 2), { year: 5786, month: 7, day: 10 })   // Yom Kippur
  assert.deepEqual(h(2024, 12, 26), { year: 5785, month: 9, day: 25 })  // 25 Kislev
})

test('leap year 5784: Purim falls in Adar II, Purim Katan in Adar I', () => {
  assert.ok(isHebrewLeapYear(5784))
  assert.deepEqual(h(2024, 3, 24), { year: 5784, month: 13, day: 14 })  // Adar II
  assert.deepEqual(h(2024, 2, 23), { year: 5784, month: 12, day: 14 })  // Adar I
  assert.equal(hebrewMonthName(5784, 12), 'אדר א׳')
  assert.equal(hebrewMonthName(5784, 13), 'אדר ב׳')
  assert.equal(hebrewMonthName(5784, 12, 'en'), 'Adar I')
})

test('common year 5786 has a plain Adar and no month 13', () => {
  assert.ok(!isHebrewLeapYear(5786))
  assert.equal(monthsInHebrewYear(5786), 12)
  assert.equal(hebrewMonthName(5786, 12), 'אדר')
})

test('the 19-year cycle: leap years fall where the cycle puts them', () => {
  assert.ok(isHebrewLeapYear(5787))
  assert.ok(!isHebrewLeapYear(5785))
  const leaps = []
  for (let y = 5777; y < 5796; y++) if (isHebrewLeapYear(y)) leaps.push(y)
  assert.equal(leaps.length, 7)   // seven leap years per cycle, always
})

// ── numerals ─────────────────────────────────────────────────────────────
test('numerals: gershayim, geresh, and the 15/16 exceptions', () => {
  assert.equal(hebrewNumeral(5), 'ה׳')
  assert.equal(hebrewNumeral(15), 'ט״ו')
  assert.equal(hebrewNumeral(16), 'ט״ז')
  assert.equal(hebrewNumeral(20), 'כ׳')
  assert.equal(hebrewNumeral(29), 'כ״ט')
  assert.equal(hebrewNumeral(786), 'תשפ״ו')   // the year part of תשפ״ו
  assert.equal(hebrewNumeral(784), 'תשפ״ד')
})

test('formatting accepts an ISO string and an english option', () => {
  assert.equal(formatHebrewDate('2026-08-18'), 'ה׳ אלול תשפ״ו')
  assert.equal(formatHebrewDate('2026-08-18', { lang: 'en' }), '5 Elul 5786')
  assert.equal(formatHebrewDate('not a date'), '')
})

// ── internal consistency: a four-year daily sweep ───────────────────────
test('round-trip and day-step consistency over 2024–2027', () => {
  const start = gregorianToRd(2024, 1, 1)
  const end = gregorianToRd(2027, 12, 31)
  let prev = null
  // walk civil days via RD; derive gregorian back is not needed — we walk
  // hebrewToRd(hebrewFromGregorian(g)) === rd via a moving gregorian cursor
  let [gy, gm, gd] = [2024, 1, 1]
  const gLen = (y, m) => [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
  for (let rd = start; rd <= end; rd++) {
    const hd = hebrewFromGregorian(gy, gm, gd)
    assert.equal(hebrewToRd(hd.year, hd.month, hd.day), rd,
      `round-trip broke at ${gy}-${gm}-${gd}`)
    assert.ok(hd.day >= 1 && hd.day <= hebrewMonthDays(hd.year, hd.month),
      `day out of month range at ${gy}-${gm}-${gd}`)
    if (prev) {
      const dayDiff = hebrewToRd(hd.year, hd.month, hd.day) - hebrewToRd(prev.year, prev.month, prev.day)
      assert.equal(dayDiff, 1, `hebrew date skipped/stalled at ${gy}-${gm}-${gd}`)
    }
    prev = hd
    gd += 1
    if (gd > gLen(gy, gm)) { gd = 1; gm += 1 }
    if (gm > 12) { gm = 1; gy += 1 }
  }
})

test('every year length is one of the six legal ones', () => {
  for (let y = 5770; y <= 5800; y++) {
    const len = hebrewToRd(y + 1, 7, 1) - hebrewToRd(y, 7, 1)
    const legal = isHebrewLeapYear(y) ? [383, 384, 385] : [353, 354, 355]
    assert.ok(legal.includes(len), `year ${y} has illegal length ${len}`)
  }
})

test('the pure calendar agrees with the browser’s Hebrew calendar, day for day', () => {
  // Two implementations live in this codebase and both reach a reader. The
  // screens render Hebrew dates through Intl('he-IL-u-ca-hebrew'); this module
  // is the one destined for the server side, where receipts and emails are
  // built and Intl is not what draws them. If they ever disagree, a customer's
  // receipt and the shop's own screen say different days — in a community that
  // would notice immediately.
  //
  // The tests above prove this module is RIGHT against known anchors. This
  // proves the two agree, which is a different property and the one that
  // breaks quietly.
  const F = new Intl.DateTimeFormat('en-u-ca-hebrew', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })
  // Sixteen years spans five leap years and every one of the six legal year
  // lengths, so a molad change cannot slip through on a lucky range.
  const from = Date.UTC(2020, 0, 1), to = Date.UTC(2035, 11, 31)
  // Intl and this module spell the transliterations differently — Heshvan vs
  // Cheshvan, Tishri vs Tishrei. Spelling is not the claim; IDENTITY is. So
  // the mapping between the two names is built as we go and required to stay
  // one-to-one, which is exactly what catches Adar / Adar I / Adar II drift.
  const intlToMine = new Map(), mineToIntl = new Map()
  let days = 0
  for (let t = from; t <= to; t += 86400000) {
    const d = new Date(t)
    const gy = d.getUTCFullYear(), gm = d.getUTCMonth() + 1, gd = d.getUTCDate()
    const mine = hebrewFromGregorian(gy, gm, gd)
    const parts = F.formatToParts(d)
    const on = `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`
    assert.equal(mine.year, Number(parts.find((p) => p.type === 'year').value), `year differs on ${on}`)
    assert.equal(mine.day, Number(parts.find((p) => p.type === 'day').value), `day differs on ${on}`)

    const intlName = parts.find((p) => p.type === 'month').value
    const myName = hebrewMonthName(mine.year, mine.month, 'en')
    if (intlToMine.has(intlName)) {
      assert.equal(intlToMine.get(intlName), myName, `${intlName} became a different month on ${on}`)
    } else intlToMine.set(intlName, myName)
    if (mineToIntl.has(myName)) {
      assert.equal(mineToIntl.get(myName), intlName, `${myName} became a different month on ${on}`)
    } else mineToIntl.set(myName, intlName)
    days++
  }
  assert.ok(days > 5800, `only ${days} days compared`)
  // Twelve months plus both Adars — if a leap month were being folded away,
  // the map would be short.
  assert.equal(intlToMine.size, 14, `${intlToMine.size} distinct months seen, expected 14`)
  assert.equal(intlToMine.get('Adar I'), 'Adar I')
  assert.equal(intlToMine.get('Adar II'), 'Adar II')
  assert.equal(intlToMine.get('Adar'), 'Adar')
})
