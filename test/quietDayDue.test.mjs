// A task dated Shabbos or yom tov is asked for earlier.
//
// Owner, 30 Aug 2026: "whenever you raise a task for a specific date (e.g. the
// pool expires and its still rented), if its shabbes or yom tov, it should be
// raised 3 days before already."
//
// The reason is the shop's week rather than the calendar's. A task due on
// Shabbos is a task nobody sees until Sunday, by which time the pool has
// expired with a customer's phone on it. Three days is the owner's number and
// it is the right one: it clears a three-day yom tov and still leaves a working
// day to act in.
//
// What this must NOT do is move the underlying fact. The pool still expires
// when it expires and the task's title still says so — only the day somebody is
// asked moves.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { workingDueDate, QUIET_LEAD_DAYS, isQuietDay, isShabbos, isYomTov } from '../lib/yomTov.mjs'

const iso = (t) => new Date(t).toISOString().slice(0, 10)
const DAY = 86400000
const at = (d) => Date.parse(`${d}T12:00:00Z`)

test('the owner\'s number is three', () => {
  assert.equal(QUIET_LEAD_DAYS, 3)
})

test('an ordinary day is left exactly alone', () => {
  for (const d of ['2026-08-30', '2026-09-01', '2026-09-04', '2026-12-25']) {
    assert.equal(workingDueDate(d), d, d)
  }
})

test('Friday is a working day and is not stepped over', () => {
  // The shop is open on erev shabbos. Moving a Friday task would be the
  // component deciding it knows better than the person who set the date.
  const fri = '2026-09-04'
  assert.equal(new Date(at(fri)).getUTCDay(), 5)
  assert.equal(workingDueDate(fri), fri)
})

test('Shabbos moves back three days, onto a Wednesday', () => {
  const sat = '2026-09-05'
  assert.ok(isShabbos(sat))
  assert.equal(workingDueDate(sat), '2026-09-02')
  assert.equal(new Date(at('2026-09-02')).getUTCDay(), 3)
})

test('yom tov moves too, not only Shabbos', () => {
  // 13 Sep 2026 is a Sunday and second-day Rosh Hashana — not Shabbos, and
  // exactly the case a weekday-only rule would miss.
  const sun = '2026-09-13'
  assert.ok(isYomTov(sun) && !isShabbos(sun))
  assert.equal(workingDueDate(sun), '2026-09-10')
})

test('it never lands on another quiet day, however the calendar falls', () => {
  // The reason this walks rather than subtracting three and stopping. Over
  // 2020-2035 there are 48 quiet days whose plain minus-three is ALSO quiet —
  // a three-day yom tov running into Shabbos, or chol hamoed in between two
  // yom tov days. Every one of them has to come out on a day somebody works.
  let quiet = 0, walked = 0
  for (let t = Date.UTC(2020, 0, 1, 12); t < Date.UTC(2036, 0, 1, 12); t += DAY) {
    const d = iso(t)
    if (!isQuietDay(d)) continue
    quiet++
    const out = workingDueDate(d)
    assert.ok(!isQuietDay(out), `${d} → ${out}, which is itself Shabbos or yom tov`)
    assert.ok(out < d, `${d} → ${out} is not earlier`)
    if (isQuietDay(iso(t - QUIET_LEAD_DAYS * DAY))) walked++
  }
  assert.ok(quiet > 900, `only ${quiet} quiet days across 16 years — the calendar is not being read`)
  assert.ok(walked > 30, `only ${walked} needed the walk — expected around 48, so the walk is being under-exercised`)
})

test('it is never MORE than a week early', () => {
  // A lead that quietly grew would be its own bug: a task raised a fortnight
  // out is noise, and noise is how a queue stops being read.
  for (let t = Date.UTC(2020, 0, 1, 12); t < Date.UTC(2036, 0, 1, 12); t += DAY) {
    const d = iso(t)
    if (!isQuietDay(d)) continue
    const gap = Math.round((at(d) - at(workingDueDate(d))) / DAY)
    assert.ok(gap >= QUIET_LEAD_DAYS && gap <= 7, `${d} moved ${gap} days`)
  }
})

test('a lead that would land in the past becomes today', () => {
  // Friday, for a pool expiring on Shabbos: three days back is Tuesday and
  // Tuesday has gone. Somebody has to be told now.
  assert.equal(workingDueDate('2026-09-05', '2026-09-04'), '2026-09-04')
  assert.equal(workingDueDate('2026-09-05', '2026-09-03'), '2026-09-03')
  // …but not once the lead is genuinely reachable.
  assert.equal(workingDueDate('2026-09-05', '2026-09-01'), '2026-09-02')
})

test('a date already in the past stays late instead of being tidied forward', () => {
  // A pool that expired last Shabbos is overdue, and the queue must keep saying
  // so. Clamping it to today would quietly erase how long it has been ignored.
  assert.equal(workingDueDate('2026-08-29', '2026-08-31'), '2026-08-26')
})

test('rubbish in does not become a date', () => {
  for (const v of [null, undefined, '', 'soon', '2026-13-45x']) {
    assert.equal(workingDueDate(v), v)
  }
})

test('every auto-raised task goes through it, at the one funnel', () => {
  // Thirty call sites raise tasks; one function writes them. The rule lives
  // there so a task type added later cannot forget it.
  const sweep = readFileSync(new URL('../pages/api/cron/sweep.js', import.meta.url), 'utf8')
  assert.match(sweep, /import \{ workingDueDate \} from '\.\.\/\.\.\/\.\.\/lib\/yomTov\.mjs'/)
  const fn = sweep.match(/async function upsertOpenTask\([\s\S]*?\n\}/)
  assert.ok(fn, 'upsertOpenTask has moved')
  assert.match(fn[0], /workingDueDate\(dueDate, today\)/)
  // Both the insert and the update path, or a task raised before the rule
  // existed keeps its old date for ever.
  assert.match(fn[0], /\.\.\.\(due \? \{ due_date: due \} : \{\}\)/)
  assert.match(fn[0], /due_date: due \|\| today/)
  assert.equal((sweep.match(/due_date: dueDate/g) || []).length, 0,
    'a raw dueDate is still being written past the rule')
})
