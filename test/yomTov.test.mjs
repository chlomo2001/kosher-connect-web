// The yom tov table decides which rental days are free. Run: npm test
//
// This test exists because the table shipped WRONG and nothing caught it for
// months. scripts/generate-holidays.mjs formatted hebcal's local-midnight dates
// with toISOString(); run on a machine in British Summer Time, every date came
// back a day early. So the app gave erev yom tov away free and charged for yom
// tov itself, and where yom tov fell on a Sunday the free day landed on the
// Shabbos that was already free — the renter simply lost a day.
//
// Nothing on screen could have shown it either: the rental breakdown printed
// "3 free days (Shabbos / Yom Tov)" and never the dates, so there was nothing
// to be wrong-looking. The DateStamp work that names each free day is what
// surfaced it, and this test is what stops it recurring.
//
// The dates below are typed in from the calendar, NOT copied out of the
// generated table — a test that reads its expectations from the thing under
// test would have passed happily against the broken table.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const SRC = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')

function parseTable() {
  const block = SRC.match(/const DIASPORA_YOM_TOV = \[([\s\S]*?)\n\];/)
  assert.ok(block, 'public/main.js must carry a DIASPORA_YOM_TOV table')
  const entries = [...block[1].matchAll(/'(\d{4}-\d{2}-\d{2})([a-z])'/g)]
  return new Map(entries.map((m) => [m[1], m[2]]))
}

function parseNames() {
  const block = SRC.match(/const YOM_TOV_NAMES = \{([\s\S]*?)\n\};/)
  assert.ok(block, 'public/main.js must carry a YOM_TOV_NAMES map')
  return new Map([...block[1].matchAll(/(\w+):\s*'([^']+)'/g)].map((m) => [m[1], m[2]]))
}

const TABLE = parseTable()
const NAMES = parseNames()

// Three consecutive years off a printed calendar. Codes: a/b = Pesach 1st+2nd,
// c/d = Pesach 7th+8th, e/f = Shavuos, g/h = Rosh Hashanah, i = Yom Kippur,
// j/k = Succos, l = Shemini Atzeres, m = Simchas Torah.
const KNOWN = {
  '2024-04-23': 'a', '2024-04-24': 'b', '2024-04-29': 'c', '2024-04-30': 'd',
  '2024-06-12': 'e', '2024-06-13': 'f',
  '2024-10-03': 'g', '2024-10-04': 'h', '2024-10-12': 'i',
  '2024-10-17': 'j', '2024-10-18': 'k', '2024-10-24': 'l', '2024-10-25': 'm',

  '2025-04-13': 'a', '2025-04-14': 'b', '2025-04-19': 'c', '2025-04-20': 'd',
  '2025-06-02': 'e', '2025-06-03': 'f',
  '2025-09-23': 'g', '2025-09-24': 'h', '2025-10-02': 'i',
  '2025-10-07': 'j', '2025-10-08': 'k', '2025-10-14': 'l', '2025-10-15': 'm',

  '2026-04-02': 'a', '2026-04-03': 'b', '2026-04-08': 'c', '2026-04-09': 'd',
  '2026-05-22': 'e', '2026-05-23': 'f',
  '2026-09-12': 'g', '2026-09-13': 'h', '2026-09-21': 'i',
  '2026-09-26': 'j', '2026-09-27': 'k', '2026-10-03': 'l', '2026-10-04': 'm',
}

test('every known yom tov is in the table, on the right day', () => {
  const wrong = []
  for (const [iso, code] of Object.entries(KNOWN)) {
    const got = TABLE.get(iso)
    if (got !== code) wrong.push(`${iso}: expected ${NAMES.get(code)}, table says ${got ? NAMES.get(got) : 'not a yom tov'}`)
  }
  assert.deepEqual(wrong, [], `Yom tov dates are wrong:\n${wrong.join('\n')}`)
})

test('erev yom tov is NOT free — the exact shape of the shipped bug', () => {
  // The broken table listed the day BEFORE each of these. Charging correctly
  // and charging one day out both produce a plausible-looking total, so this
  // is the assertion that tells them apart.
  const leaked = []
  for (const iso of Object.keys(KNOWN)) {
    const erev = new Date(`${iso}T12:00:00Z`)
    erev.setUTCDate(erev.getUTCDate() - 1)
    const eve = erev.toISOString().slice(0, 10)
    // Skip the ones where erev is itself the previous day of the same festival
    // (2nd days, Pesach VIII) or a genuine yom tov in its own right.
    if (KNOWN[eve]) continue
    if (TABLE.has(eve)) leaked.push(`${eve} is listed as yom tov, but the festival is ${iso}`)
  }
  assert.deepEqual(leaked, [], `The table is a day early again:\n${leaked.join('\n')}`)
})

test('every code in the table has a name', () => {
  const orphans = [...new Set([...TABLE.values()])].filter((c) => !NAMES.has(c))
  assert.deepEqual(orphans, [], `Codes with no entry in YOM_TOV_NAMES: ${orphans.join(', ')}`)
})

test('every Gregorian year carries a full set of 13 yom tov days', () => {
  // Diaspora: Pesach 1,2,7,8 + Shavuos 1,2 + Rosh Hashanah 1,2 + Yom Kippur +
  // Succos 1,2 + Shemini Atzeres + Simchas Torah. A year short of 13 means the
  // generator dropped days at a year boundary and rentals over them are priced
  // as ordinary working days.
  const perYear = new Map()
  for (const iso of TABLE.keys()) {
    const y = iso.slice(0, 4)
    perYear.set(y, (perYear.get(y) || 0) + 1)
  }
  const short = [...perYear.entries()].filter(([, n]) => n !== 13)
  assert.deepEqual(short, [], `Years without exactly 13 yom tov days: ${short.map(([y, n]) => `${y}=${n}`).join(', ')}`)
})

test('the table spans the years the shop can actually book into', () => {
  const years = [...TABLE.keys()].map((d) => Number(d.slice(0, 4)))
  assert.ok(Math.min(...years) <= 2020, 'table must reach back over the imported history')
  assert.ok(Math.max(...years) >= 2100, 'table must reach far enough forward to outlive the app')
})
