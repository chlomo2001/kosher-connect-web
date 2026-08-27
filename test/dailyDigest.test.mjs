// The morning digest — what today needs, in one reading.
//
// Epos Now push a daily low-stock alert; KC computes the same kind of thing and
// waits on a dashboard badge for somebody to notice. The idea worth taking is
// the direction, not the alert: they push, we wait to be looked at.
//
// The design decision under test is what it is BUILT FROM. The nightly sweep
// already raises a task for every one of these, so the digest summarises those
// rather than re-deriving anything. A second answer to "what needs doing" is
// exactly what went wrong three times this week — the backlog said Hebrew dates
// were unplaced after they shipped, the clarity scan called a fixed bug live,
// and T2.2 called a table with ten real rows unused.
import test from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { buildDigest, digestSubject, groupOf, GROUPS } from '../lib/dailyDigest.mjs'

const T = (over = {}) => ({
  title: 'Something to do', priority: 'medium', reference: 'BALANCE-x',
  due_date: null, created_at: '2026-08-01T09:00:00Z', done: false, ...over,
})

// ── which pile a task belongs in ───────────────────────────────────────────

test('the sweep’s own prefixes decide the grouping', () => {
  assert.equal(groupOf('OVERDUE-abc'), 'OVERDUE')
  assert.equal(groupOf('BALANCE-abc'), 'BALANCE')
  assert.equal(groupOf('SIMMAIL-141'), 'SIMMAIL')
  assert.equal(groupOf('PASSPORT-abc'), 'PASSPORT')
  assert.equal(groupOf('REQ-1-2'), 'REQ')
})

test('a prefix nobody has taught it is grouped, not dropped', () => {
  // A digest that silently omits a kind of work is worse than one with an
  // untidy last section.
  assert.equal(groupOf('WHATEVER-1'), 'other')
  assert.equal(groupOf(''), 'other')
  assert.equal(groupOf(null), 'other')
})

test('SIMNEW is not eaten by a shorter SIM prefix', () => {
  assert.equal(groupOf('SIMNEW'), 'SIMNEW')
  assert.equal(groupOf('SIMPAIR'), 'SIMPAIR')
  assert.equal(groupOf('SIMDUE-9'), 'SIMDUE')
})

// The three above pass with or without the longest-first sort, because no
// prefix on today's list is a prefix of another — so the sort is defending
// against a future one ('SIM' added above 'SIMNEW' would swallow it silently).
// Assert the INVARIANT instead, which is what actually keeps grouping
// unambiguous and which fires the day somebody adds the overlapping prefix.
test('no group prefix is a prefix of another', () => {
  const keys = GROUPS.map(([k]) => k)
  for (const a of keys) {
    for (const b of keys) {
      if (a === b) continue
      assert.ok(!b.startsWith(a),
        `"${a}" is a prefix of "${b}" — a reference could belong to either, ` +
        'and which one wins would depend on declaration order')
    }
  }
})

// ── what gets in ───────────────────────────────────────────────────────────

test('finished work is not part of a morning', () => {
  const d = buildDigest([T(), T({ done: true }), T({ done: true })])
  assert.equal(d.total, 1)
})

test('a snoozed task is somebody’s "not yet", and is honoured', () => {
  const tasks = [T({ snoozed_until: '2026-09-01' }), T({ snoozed_until: '2026-08-01' }), T()]
  const d = buildDigest(tasks, { today: '2026-08-21' })
  assert.equal(d.total, 2, 'the one snoozed into the future should be held back')
  // With no today to compare against, nothing is filtered on a date.
  assert.equal(buildDigest(tasks).total, 3)
})

test('nothing waiting means nothing to send', () => {
  const d = buildDigest([])
  assert.equal(d.quiet, true)
  assert.equal(digestSubject(d), '',
    'a digest that arrives every morning saying "nothing today" is one people stop opening')
  assert.equal(buildDigest(null).quiet, true)
  assert.equal(buildDigest(undefined).quiet, true)
})

// ── the order things are read in ───────────────────────────────────────────

test('high priority first, then the nearest deadline, then the oldest', () => {
  const d = buildDigest([
    T({ title: 'old, no date', created_at: '2026-01-01T00:00:00Z' }),
    T({ title: 'due soon', due_date: '2026-08-22' }),
    T({ title: 'urgent', priority: 'high' }),
    T({ title: 'due later', due_date: '2026-09-30' }),
  ], { today: '2026-08-21' })
  assert.deepEqual(d.groups[0].lines.map((l) => l.title),
    ['urgent', 'due soon', 'due later', 'old, no date'])
})

test('a deadline somebody set outranks a deadline nobody did', () => {
  // Four items, dated and undated interleaved, because a two-item list only
  // exercises ONE side of the comparator: with two, the sort happened to call
  // it in the order that used the untouched default, and breaking the other
  // default changed nothing. This ordering forces both.
  const d = buildDigest([
    T({ title: 'no date A', created_at: '2020-01-01T00:00:00Z' }),
    T({ title: 'dated late', due_date: '2030-01-01' }),
    T({ title: 'no date B', created_at: '2021-01-01T00:00:00Z' }),
    T({ title: 'dated soon', due_date: '2029-01-01' }),
  ])
  assert.deepEqual(d.groups[0].lines.map((l) => l.title),
    ['dated soon', 'dated late', 'no date A', 'no date B'])
})

test('past its date is marked, so the reader does not have to work it out', () => {
  const d = buildDigest([
    T({ title: 'late', due_date: '2026-08-01' }),
    T({ title: 'today', due_date: '2026-08-21' }),
  ], { today: '2026-08-21' })
  const by = Object.fromEntries(d.groups[0].lines.map((l) => [l.title, l.overdue]))
  assert.equal(by.late, true)
  assert.equal(by.today, false, 'due today is not yet late')
})

// ── the cap ────────────────────────────────────────────────────────────────

test('a capped group SAYS it is capped', () => {
  const many = Array.from({ length: 19 }, (_, i) => T({ title: `debt ${i}` }))
  const d = buildDigest(many, { perGroup: 5 })
  assert.equal(d.groups[0].lines.length, 5)
  assert.equal(d.groups[0].more, 14,
    'showing five of nineteen without saying so reads as "there are five"')
})

test('an uncapped group says there is no more', () => {
  const d = buildDigest([T(), T()], { perGroup: 5 })
  assert.equal(d.groups[0].more, 0)
})

test('the cap is clamped, and nonsense falls back rather than showing nothing', () => {
  const many = Array.from({ length: 40 }, () => T())
  // 0 and junk are not a request for an empty digest — they are no request at
  // all, so the default stands.
  assert.equal(buildDigest(many, { perGroup: 0 }).groups[0].lines.length, 5)
  assert.equal(buildDigest(many, { perGroup: 'x' }).groups[0].lines.length, 5)
  assert.equal(buildDigest(many, { perGroup: null }).groups[0].lines.length, 5)
  // A negative IS a request, and a wrong one: clamped to the floor.
  assert.equal(buildDigest(many, { perGroup: -3 }).groups[0].lines.length, 1)
  // And nobody gets the whole table in an email.
  assert.equal(buildDigest(many, { perGroup: 999 }).groups[0].lines.length, 20)
  assert.equal(buildDigest(many, { perGroup: 999 }).groups[0].more, 20)
})

// ── the subject line ───────────────────────────────────────────────────────

test('the subject says the size of the day before it is opened', () => {
  const urgent = buildDigest([T({ priority: 'high' }), T()], { today: '2026-08-21' })
  assert.equal(digestSubject(urgent), 'Kosher Connect — 1 needs you today')
  const calm = buildDigest([T(), T(), T()], { today: '2026-08-21' })
  assert.equal(digestSubject(calm), 'Kosher Connect — 3 things waiting')
  assert.equal(digestSubject(calm, { date: '21 Aug' }), 'Kosher Connect — 3 things waiting (21 Aug)')
})

test('urgent counts high priority AND anything past its date', () => {
  const d = buildDigest([
    T({ priority: 'high' }),
    T({ due_date: '2026-08-01' }),
    T(),
  ], { today: '2026-08-21' })
  assert.equal(d.urgent, 2)
  assert.equal(d.total, 3)
})

test('one of a thing reads as one', () => {
  assert.match(digestSubject(buildDigest([T({ priority: 'high' })], { today: '2026-08-21' })), /1 needs you/)
  assert.match(digestSubject(buildDigest([T()])), /1 thing waiting/)
})

// ── the design decision ────────────────────────────────────────────────────

test('it summarises tasks and derives nothing of its own', () => {
  const SRC = readFileSync(path.join(import.meta.dirname, '..', 'lib/dailyDigest.mjs'), 'utf8')
  // No second answer to "what needs doing": no balances, no renewal dates, no
  // rental windows. Tasks in, digest out.
  for (const smell of ['balance', 'renewalDate', 'toDate', 'ledger', 'fetch(', 'db.']) {
    assert.ok(!SRC.includes(smell), `dailyDigest is re-deriving work: ${smell}`)
  }
  // Which groups exist is NOT asserted here any more. This used to hold a
  // hand-typed list of nine prefixes, and a hand-typed list is exactly how the
  // 27 August bug survived: it named VN — which nothing has ever raised as a
  // task, only as a ledger charge_reference — so the test happily insisted on a
  // section that could never appear, while TICKET sat mislabelled as Kol Torah
  // and seven real kinds of work fell into 'other'. A list of prefixes checked
  // against a list of prefixes proves nothing.
  //
  // test/digestGroups.test.mjs asks the question this one could not: it reads
  // the references the CODE raises, at the places tasks are actually created,
  // and joins them against this table in both directions.
})

test('every group carries a title a person can read', () => {
  for (const [key, title] of GROUPS) {
    assert.ok(title && title.length > 3, `${key} has no readable title`)
    assert.ok(!/^[A-Z]+$/.test(title), `${key}'s title is a code, not words`)
  }
})
