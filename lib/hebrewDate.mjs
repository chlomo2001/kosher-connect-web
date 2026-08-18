// Gregorian → Hebrew date, pure arithmetic (port item 6 / AHT reference,
// 18 Aug 2026). The owner shared the AHT portal, whose ledger shows the
// Hebrew date beside every Gregorian one — for this community that is
// utility, not decoration. This module is ONLY the converter: correct first,
// wired to screens never (placement is the owner's call; nothing imports
// this into a screen yet).
//
// A WRONG Hebrew date shown to this readership is worse than none, so the
// arithmetic is the classical molad-and-postponements calculation
// (Dershowitz–Reingold form), and test/hebrewDate.test.mjs holds it to known
// anchors — Rosh Hashana boundaries, Adar I vs Adar II in leap years, chagim
// — plus a multi-year round-trip sweep. public/main.js carries a mirror
// (the browser cannot import); test/hebrewDateMirror.test.mjs lifts it and
// holds it to this module over a sweep, the way pricing is held.
//
// One deliberate simplification, stated: the Hebrew day begins at NIGHTFALL.
// This converter maps a CIVIL date to the Hebrew date of that DAYTIME. A
// screen that wants to be right after dark must add its own "after sunset"
// handling; the converter stays pure and time-of-day-free.

// ── fixed day numbers (RD): days since 31 Dec, 1 BCE Gregorian ───────────
export function gregorianToRd(gy, gm, gd) {
  const a = Math.floor((14 - gm) / 12)
  const y = gy + 4800 - a
  const m = gm + 12 * a - 3
  const jdn = gd + Math.floor((153 * m + 2) / 5) + 365 * y +
    Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045
  return jdn - 1721425
}

const HEBREW_EPOCH = -1373427   // RD of 1 Tishrei, AM 1

export function isHebrewLeapYear(hy) {
  return ((7 * hy + 1) % 19) < 7
}

export function monthsInHebrewYear(hy) {
  return isHebrewLeapYear(hy) ? 13 : 12
}

// Days from the epoch's molad to the (pre-postponement) new year of hy.
function elapsedDays(hy) {
  const monthsElapsed = Math.floor((235 * hy - 234) / 19)
  const partsElapsed = 12084 + 13753 * monthsElapsed
  let days = monthsElapsed * 29 + Math.floor(partsElapsed / 25920)
  if (((3 * (days + 1)) % 7) < 3) days += 1   // molad zaken / midnight rule fold
  return days
}

/** RD of 1 Tishrei of Hebrew year hy, postponements applied. */
export function roshHashanaRd(hy) {
  const ny0 = elapsedDays(hy - 1)
  const ny1 = elapsedDays(hy)
  const ny2 = elapsedDays(hy + 1)
  let delay = 0
  if (ny2 - ny1 === 356) delay = 2        // coming year would be too long
  else if (ny1 - ny0 === 382) delay = 1   // past year would be too short
  return HEBREW_EPOCH + ny1 + delay
}

function daysInHebrewYear(hy) {
  return roshHashanaRd(hy + 1) - roshHashanaRd(hy)
}

// Months numbered Nisan=1 … Elul=6, Tishrei=7 … Adar=12, Adar II=13.
// In a leap year month 12 IS Adar I and 13 is Adar II; in a common year
// month 12 is plain Adar and 13 does not exist.
export function hebrewMonthDays(hy, hm) {
  if (hm === 2 || hm === 4 || hm === 6 || hm === 10 || hm === 13) return 29
  if (hm === 12 && !isHebrewLeapYear(hy)) return 29
  if (hm === 8 && daysInHebrewYear(hy) % 10 !== 5) return 29   // short Cheshvan
  if (hm === 9 && daysInHebrewYear(hy) % 10 === 3) return 29   // short Kislev
  return 30
}

export function hebrewToRd(hy, hm, hd) {
  let rd = roshHashanaRd(hy) + hd - 1
  if (hm < 7) {   // Tishrei..year-end, then Nisan..hm-1
    for (let m = 7; m <= monthsInHebrewYear(hy); m++) rd += hebrewMonthDays(hy, m)
    for (let m = 1; m < hm; m++) rd += hebrewMonthDays(hy, m)
  } else {
    for (let m = 7; m < hm; m++) rd += hebrewMonthDays(hy, m)
  }
  return rd
}

/** {year, month, day} of the civil date gy-gm-gd (numbers, month 1-12). */
export function hebrewFromGregorian(gy, gm, gd) {
  const rd = gregorianToRd(gy, gm, gd)
  let year = Math.floor((rd - HEBREW_EPOCH) / 365.2468) + 1
  while (roshHashanaRd(year) > rd) year -= 1
  while (roshHashanaRd(year + 1) <= rd) year += 1
  let month = rd < hebrewToRd(year, 1, 1) ? 7 : 1
  while (rd > hebrewToRd(year, month, hebrewMonthDays(year, month))) month += 1
  const day = rd - hebrewToRd(year, month, 1) + 1
  return { year, month, day }
}

// ── display ──────────────────────────────────────────────────────────────
const HE_ONES = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט']
const HE_TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ']
const HE_HUNDREDS = ['', 'ק', 'ר', 'ש', 'ת']

/** 1..999 as a Hebrew numeral with geresh/gershayim; 15/16 spelt ט״ו/ט״ז. */
export function hebrewNumeral(n) {
  let v = Math.floor(n)
  if (!(v >= 1 && v <= 999)) return String(n)
  let s = ''
  while (v >= 400) { s += 'ת'; v -= 400 }
  if (v >= 100) { s += HE_HUNDREDS[Math.floor(v / 100)]; v %= 100 }
  if (v === 15) { s += 'טו'; v = 0 }        // avoid spelling the Name
  else if (v === 16) { s += 'טז'; v = 0 }
  if (v >= 10) { s += HE_TENS[Math.floor(v / 10)]; v %= 10 }
  if (v > 0) s += HE_ONES[v]
  return s.length > 1 ? s.slice(0, -1) + '״' + s.slice(-1) : s + '׳'
}

const MONTHS_HE = ['', 'ניסן', 'אייר', 'סיון', 'תמוז', 'אב', 'אלול',
  'תשרי', 'חשון', 'כסלו', 'טבת', 'שבט', 'אדר', 'אדר ב׳']
const MONTHS_EN = ['', 'Nisan', 'Iyar', 'Sivan', 'Tammuz', 'Av', 'Elul',
  'Tishrei', 'Cheshvan', 'Kislev', 'Tevet', 'Shvat', 'Adar', 'Adar II']

export function hebrewMonthName(hy, hm, lang = 'he') {
  if (hm === 12 && isHebrewLeapYear(hy)) return lang === 'he' ? 'אדר א׳' : 'Adar I'
  return (lang === 'he' ? MONTHS_HE : MONTHS_EN)[hm] || ''
}

/**
 * 'ה׳ אלול תשפ״ו' (or '5 Elul 5786') for a civil date. Accepts (gy,gm,gd)
 * or a single 'YYYY-MM-DD' string. Years render without the thousands, the
 * customary short form.
 */
export function formatHebrewDate(a, b, c, opts = {}) {
  let gy = a, gm = b, gd = c
  if (typeof a === 'string') {
    const m = a.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (!m) return ''
    gy = +m[1]; gm = +m[2]; gd = +m[3]
    opts = b || {}
  }
  const lang = opts.lang || 'he'
  const h = hebrewFromGregorian(gy, gm, gd)
  const month = hebrewMonthName(h.year, h.month, lang)
  if (lang === 'he') return `${hebrewNumeral(h.day)} ${month} ${hebrewNumeral(h.year % 1000)}`
  return `${h.day} ${month} ${h.year}`
}

/** Hebrew weekday letter for a civil date — 'ג׳' for a Tuesday; Shabbos 'שבת'. */
export function hebrewWeekday(gy, gm, gd) {
  const dow = ((gregorianToRd(gy, gm, gd) % 7) + 7) % 7   // 0 = Sunday
  return dow === 6 ? 'שבת' : HE_ONES[dow + 1] + '׳'
}
