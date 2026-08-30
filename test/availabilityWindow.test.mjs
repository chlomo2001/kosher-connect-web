// The availability grid opens on today, not on the 1st.
//
// Owner, 30 Aug 2026: "maybe the view of avalibity should start with today
// instead of begiining of the month." Opened that morning the grid was
// twenty-nine columns of days nobody can book followed by two that matter. The
// question this screen exists to answer — can I promise this handset for the
// trip — is always about a day that has not happened yet.
//
// Trimming alone answers the letter of that and fails its point: on the 30th it
// leaves a two-column grid. So the window runs on into the next month when what
// is left of this one is too short to plan in, and there is a way back to the
// whole month for the rarer question of what the fleet did in August.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const SRC = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')
const MANUAL = readFileSync(new URL('../lib/manual.mjs', import.meta.url), 'utf8')
const CAL = SRC.slice(SRC.indexOf('function availabilityCalendarHtml()'),
                      SRC.indexOf('function getItemStatus('))

test('only the month containing today is trimmed', () => {
  // Navigate back deliberately and July arrives whole: looking at what happened
  // last month is a different question, and the answer to it is all of July.
  assert.match(CAL, /const trimmed = calFromToday && days\.length && days\[0\]\.iso < today && days\[days\.length - 1\]\.iso >= today/)
  assert.match(CAL, /days = days\.filter\(d => d\.iso >= today\)/)
})

test('a trimmed month too short to plan in runs on into the next one', () => {
  assert.match(SRC, /const MIN_AVAIL_DAYS = 21/)
  assert.match(CAL, /days\.length < MIN_AVAIL_DAYS/)
  // The appended columns are built the same way as the month's own, or they
  // would lose their Hebrew date and their Rosh Chodesh mark.
  const grow = CAL.match(/if \(calSystem !== 'hebrew' && days\.length < MIN_AVAIL_DAYS\) \{[\s\S]*?\n    \}/)
  assert.ok(grow, 'the run-on block has moved')
  assert.match(grow[0], /hebrewParts\(dObj\)/)
  assert.match(grow[0], /roshChodesh: hp\.day === 1/)
  assert.match(grow[0], /hebLabel: hp\.day === 1 \? hp\.month : numToHebrew\(hp\.day\)/)
})

test('the grid is not left looking short by accident', () => {
  // A month starting on the 30th reads as a fault unless the header says what
  // it is showing. The span replaces the month name's sub-line while trimmed.
  assert.match(CAL, /trimmed \? `<span[^`]*>\$\{escHtml\(gregSpan\)\}<\/span>` : ''/)
})

test('there is a way back to the whole month', () => {
  // Nothing becomes unreachable: early August is one button away, and the
  // button says which way the setting is rather than being a mystery toggle.
  assert.match(CAL, /calToggleFromToday\(\)/)
  assert.match(CAL, /\$\{calFromToday \? 'Whole month' : 'From today'\}/)
  assert.match(CAL, /aria-pressed="\$\{calFromToday \? 'true' : 'false'\}"/)
  assert.match(SRC, /function calToggleFromToday\(\) \{\s*calFromToday = !calFromToday;\s*renderRentalsTab\(\);\s*\}/)
})

test('the toggle is offered when it does something and not otherwise', () => {
  // On a past month there is nothing to trim, so a "Whole month" button there
  // would be a control that does nothing — which teaches people to ignore it.
  assert.match(CAL, /trimmed \|\| \(!calFromToday && calMonth === today\.slice\(0, 7\)\)/)
})

test('the default is on', () => {
  assert.match(SRC, /let calFromToday = true;/)
})

test('the manual says the grid starts today', () => {
  assert.match(MANUAL, /starts at today/i)
})
