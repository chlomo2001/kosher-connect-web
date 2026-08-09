// Auto-generates the yom tov table for public/main.js.
//
//   npm i --no-save @hebcal/core          # dev-only, not a runtime dependency
//   node scripts/generate-holidays.mjs > scripts/holidays-output.txt
//
// Covers Gregorian years 2020–2125. Paste the DIASPORA_YOM_TOV block into
// public/main.js (the ISRAEL block is generated for reference only — every
// rental, Eretz Yisroel included, keeps the 2-day diaspora calendar; decision
// 12 Jul 2026).
//
// HebrewCalendar.calendar() with mask=CHAG returns major biblical yom tov only:
// Rosh Hashanah, Yom Kippur, Succos 1–2, Shemini Atzeres, Simchas Torah,
// Pesach 1–2 + 7–8, Shavuos (adjusted for il: true/false).
//
// TWO THINGS THIS SCRIPT GETS RIGHT THAT THE FIRST VERSION DID NOT:
//
// 1. LOCAL date components, never toISOString(). hebcal hands back a Date at
//    LOCAL midnight; toISOString() reads it in UTC, so on any machine east of
//    Greenwich — including this shop during British Summer Time — every date
//    came out a day early. The committed table was generated that way and every
//    yom tov in it was wrong by one day: erev yom tov was free and yom tov
//    itself was charged. Same class of bug as audit C10 in lib/rentalMath.mjs.
//
// 2. Each date carries WHICH yom tov it is, so the app can tell a renter why a
//    day was not charged instead of only how many days were not charged. The
//    name is appended as a single character to keep the table small — it ships
//    to every browser, and 1,378 spelled-out names would be ~40KB of the
//    stylesheet budget for something the parser can rebuild in a millisecond.
import { HebrewCalendar, flags } from '@hebcal/core'

const GREG_START = 2020
const GREG_END = 2125

// hebcal's basename + day number → the shop's spelling. This community says
// Succos and Shavuos, not Sukkot and Shavuot, and the app is written in the
// language of the counter, not of a calendar library.
const NAMES = {
  a: 'Pesach — 1st day',
  b: 'Pesach — 2nd day',
  c: 'Pesach — 7th day',
  d: 'Pesach — 8th day',
  e: 'Shavuos — 1st day',
  f: 'Shavuos — 2nd day',
  g: 'Rosh Hashanah — 1st day',
  h: 'Rosh Hashanah — 2nd day',
  i: 'Yom Kippur',
  j: 'Succos — 1st day',
  k: 'Succos — 2nd day',
  l: 'Shemini Atzeres',
  m: 'Simchas Torah',
}

// hebcal's English rendering → our code. Israel collapses the second days, so
// a few of these are diaspora-only and simply never match on the il pass.
const CODE_BY_RENDER = {
  'Pesach I': 'a',
  'Pesach II': 'b',
  'Pesach VII': 'c',
  'Pesach VIII': 'd',
  'Shavuot I': 'e',
  'Shavuot II': 'f',
  'Shavuot': 'e',
  'Yom Kippur': 'i',
  'Sukkot I': 'j',
  'Sukkot II': 'k',
  'Shmini Atzeret': 'l',
  'Simchat Torah': 'm',
}

// Rosh Hashanah renders with the year on it ("Rosh Hashana 5787"), and Israel
// keeps both days, so match it by shape rather than by exact string.
function codeFor(render) {
  if (CODE_BY_RENDER[render]) return CODE_BY_RENDER[render]
  if (/^Rosh Hashana II\b/.test(render)) return 'h'
  if (/^Rosh Hashana\b/.test(render)) return 'g'
  return null
}

// The LOCAL calendar day — see note 1 in the header.
const localISO = (d) =>
  d.getFullYear() + '-' +
  String(d.getMonth() + 1).padStart(2, '0') + '-' +
  String(d.getDate()).padStart(2, '0')

const diaspora = new Map()
const israel = new Map()
const unmatched = new Set()

for (let gy = GREG_START; gy <= GREG_END; gy++) {
  for (const il of [false, true]) {
    const events = HebrewCalendar.calendar({ year: gy, isHebrewYear: false, il, mask: flags.CHAG })
    const target = il ? israel : diaspora
    for (const ev of events) {
      const d = ev.getDate().greg()
      if (d.getFullYear() < GREG_START || d.getFullYear() > GREG_END) continue
      const code = codeFor(ev.render('en'))
      if (!code) { unmatched.add(ev.render('en')); continue }
      target.set(localISO(d), code)
    }
  }
}

// A name we cannot spell is a day we would charge for in silence, so refuse to
// emit a table rather than emit one with holes in it.
if (unmatched.size) {
  console.error('Unrecognised yom tov names — add them to CODE_BY_RENDER:')
  for (const n of unmatched) console.error('  ' + n)
  process.exit(1)
}

// `--sql` emits the body of a migration for the `holidays` table instead of the
// JS table. Same generator, one source of truth: the seed and the client table
// went out of step once already (both wrong, in the same direction, for the
// same reason) and there is no reason to type the dates twice.
function sqlRows(map, region) {
  const arr = [...map.keys()].sort()
  const lines = []
  for (let i = 0; i < arr.length; i += 12) lines.push(arr.slice(i, i + 12).join(','))
  return `insert into holidays (holiday_date, region)\nselect d, '${region}'::holiday_region from unnest('{\n${lines.join(',\n')}\n}'::date[]) d\non conflict do nothing;`
}

function format(map) {
  const arr = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  const lines = []
  for (let i = 0; i < arr.length; i += 6) {
    lines.push('  ' + arr.slice(i, i + 6).map(([iso, c]) => `'${iso}${c}'`).join(','))
  }
  return lines.join(',\n')
}

const namesBlock = Object.entries(NAMES)
  .map(([c, n]) => `  ${c}: '${n.replace(/'/g, "\\'")}',`)
  .join('\n')

if (process.argv.includes('--sql')) {
  console.log(sqlRows(diaspora, 'diaspora'))
  console.log('')
  console.log(sqlRows(israel, 'israel'))
  process.exit(0)
}

console.log(`// Auto-generated by scripts/generate-holidays.mjs — DO NOT EDIT`)
console.log(`// Covers Gregorian years ${GREG_START}–${GREG_END}`)
console.log(`// Each entry is YYYY-MM-DD followed by a one-letter name code.`)
console.log(`const YOM_TOV_NAMES = {`)
console.log(namesBlock)
console.log(`};`)
console.log(``)
console.log(`const DIASPORA_YOM_TOV = [`)
console.log(format(diaspora))
console.log(`];`)
console.log(``)
console.log(`const ISRAEL_YOM_TOV = [`)
console.log(format(israel))
console.log(`];`)
