// The two answers to "was that day free" must be the same answer.
//
// The rental price is counted with `isShabbatOrHoliday(day)`
// (public/main.js, inside calcRentalPrice). The words a customer reads — the
// named free days on screen, and since 20 Aug the shaded cells in the emailed
// receipt's calendar — come from `freeDayReason(day)`. Two functions, one
// question, and only one of them decides what anybody is charged.
//
// They agree because both read the same map. They used not to SAY so: the
// pricer took a `country` and threw it away, which reads as though country is
// already handled and invites somebody to make Israeli hires keep one day of
// yom tov instead of two by filling it in — at which point the price moves, the
// receipt's calendar does not, and a customer is looking at a shaded day they
// were charged for. The parameter is gone as of 21 Aug; this test is what stops
// the divergence coming back by another route.
//
// A receipt that draws its own working has to be right about the working. So
// the invariant is pinned: for every day in a three-year span, and for every
// country the shop rents into, a day is free to the pricer exactly when it has
// a reason to the reader.
//
// Neither function is executed from an import — public/main.js is a browser
// script — so both are lifted out of the source and run against the same
// holiday map, which is what makes this a test of the two READERS rather than
// of the table. The table itself is test/yomTov.test.mjs's job.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const SRC = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')

function lift() {
  const grab = (name) => {
    const m = SRC.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n\\}`))
    assert.ok(m, `${name} not found in public/main.js`)
    return m[0]
  }
  // Faithful copies of the two date helpers (public/main.js:2010, :2018).
  // Local midnight matters: new Date('2026-08-22') is UTC midnight, which in a
  // negative-offset zone is a different weekday.
  const helpers = `
    function localISO(d) {
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
        + '-' + String(d.getDate()).padStart(2, '0');
    }
    function parseLocalDate(v) {
      if (v instanceof Date) return new Date(v.getFullYear(), v.getMonth(), v.getDate());
      const m = String(v || '').match(/^(\\d{4})-(\\d{2})-(\\d{2})/);
      if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      return new Date(v);
    }`
  const code = `${helpers}\n${grab('isShabbatOrHoliday')}\n${grab('freeDayReason')}
    ; return { isShabbatOrHoliday, freeDayReason };`
  // The real map, parsed from the real table — same source both functions read.
  const block = SRC.match(/const DIASPORA_YOM_TOV = \[([\s\S]*?)\n\];/)
  assert.ok(block, 'DIASPORA_YOM_TOV table not found')
  const names = SRC.match(/const YOM_TOV_NAMES = \{([\s\S]*?)\n\};/)
  assert.ok(names, 'YOM_TOV_NAMES not found')
  const nameFor = new Map([...names[1].matchAll(/(\w+):\s*'([^']+)'/g)].map((m) => [m[1], m[2]]))
  const DIASPORA_HOLIDAYS = new Map(
    [...block[1].matchAll(/'(\d{4}-\d{2}-\d{2})([a-z])'/g)].map((m) => [m[1], nameFor.get(m[2])])
  )
  return new Function('DIASPORA_HOLIDAYS', code)(DIASPORA_HOLIDAYS)
}

const { isShabbatOrHoliday, freeDayReason } = lift()

// Every country the rental form offers. NEITHER function takes one any more —
// the list is kept so the assertion still reads as "for every destination", and
// so a country parameter reappearing has somewhere obvious to fail.
const COUNTRIES = ['USA', 'UK', 'Israel', 'Europe', 'Canada', undefined, null, '']

const eachDay = function* (fromISO, toISO) {
  const [fy, fm, fd] = fromISO.split('-').map(Number)
  const [ty, tm, td] = toISO.split('-').map(Number)
  const cur = new Date(fy, fm - 1, fd)
  const end = new Date(ty, tm - 1, td)
  while (cur <= end) {
    yield `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
    cur.setDate(cur.getDate() + 1)
  }
}

test('free to the pricer means named to the reader, every day for three years', () => {
  let free = 0, checked = 0
  for (const iso of eachDay('2025-01-01', '2027-12-31')) {
    const reason = freeDayReason(iso)
    for (const country of COUNTRIES) {
      assert.equal(
        isShabbatOrHoliday(iso, country), reason !== '',
        `${iso} (country ${JSON.stringify(country)}): the pricer says ` +
        `${isShabbatOrHoliday(iso, country) ? 'free' : 'chargeable'} and the reader says ` +
        `${reason === '' ? 'nothing' : `"${reason}"`}`)
    }
    checked++
    if (reason) free++
  }
  // A guard against the whole thing passing vacuously — if the table went
  // missing, every day would be chargeable and every assertion above would
  // still hold.
  assert.ok(checked > 1000, `only ${checked} days walked`)
  // Three years is ~156 Shabbosim plus 13 yom tov days a year, less the ones
  // that fall on a Shabbos and are already free — 186 on today's table. The
  // floor is set below that, not at it: this guards against the table going
  // missing, and is not a second copy of the calendar to maintain.
  assert.ok(free > 150, `only ${free} free days in three years — the table is not being read`)
})

test('free days do not depend on the destination — and the signature says so', () => {
  // Extra arguments are ignored in JS, so passing one must change nothing…
  const answers = COUNTRIES.map((c) => isShabbatOrHoliday('2026-04-02', c))
  assert.equal(new Set(answers).size, 1)
  // …and the declaration must not offer one, which is the part that stops
  // somebody filling it in and moving the price away from the receipt.
  const src = SRC.match(/function isShabbatOrHoliday\([\s\S]*?\n\}/)[0]
  assert.match(src, /function isShabbatOrHoliday\(date\)/,
    'a country parameter here is an invitation — the rule is diaspora yom tov for every hire')
  assert.ok(!/\bcountry\b/.test(src),
    'if free days really do become per-country, the receipt calendar must learn about it in the same change')
  // Same for the late-fee counter, which passed a country in and binned it.
  assert.match(SRC, /function countChargeableDays\(fromDate, toDate\)/)
})

// Shabbos that is also yom tov is one free day with two names — the pricer
// must not count it twice, and the reader must not drop half the answer.
test('a yom tov on Shabbos is one free day and two reasons', () => {
  const both = [...eachDay('2025-01-01', '2027-12-31')]
    .filter((iso) => freeDayReason(iso).includes(' · '))
  assert.ok(both.length > 0, 'no yom tov fell on a Shabbos in three years?')
  for (const iso of both) {
    assert.equal(isShabbatOrHoliday(iso, 'USA'), true)
    assert.match(freeDayReason(iso), /^Shabbos · .+/)
  }
})
