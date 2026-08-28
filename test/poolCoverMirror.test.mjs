// The browser copy of the pool-cover decision, held to lib/poolCover.mjs.
//
// Two copies exist because public/main.js is a plain script with no module
// loader — the same reason KC_NEXT, KC_COMMLOG and the rest are mirrored. The
// risk with a mirror is that it drifts and nobody notices until the screen and
// the nightly sweep disagree about the same rental, which is precisely the
// failure this rule was written to end: the app knew a pool was too short at
// the moment of CHOOSING a phone and never looked again.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { poolCover, poolCoverNote, poolCoverLabel, poolCoverNeedsAction, WARN_WITHIN_DAYS } from '../lib/poolCover.mjs'

const SRC = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')

function liftMirror() {
  const m = SRC.match(/\/\/ ── KC_POOL mirror start ──\n([\s\S]*?)\n\/\/ ── KC_POOL mirror end ──/)
  assert.ok(m, 'KC_POOL mirror region not found in public/main.js')
  return new Function(`${m[1]}; return KC_POOL;`)()
}

// Every shape a real rental can be in, including the ones with nothing on record.
const CASES = []
for (const expiry of [null, '2026-08-20', '2026-08-27', '2026-08-28', '2026-09-02', '2026-09-03', '2026-09-20', '2027-01-01']) {
  for (const back of [null, '2026-08-25', '2026-08-27', '2026-09-01', '2026-09-15', '2026-12-31']) {
    CASES.push([expiry, back, '2026-08-27'])
  }
}

test('the browser mirror decides exactly what the lib decides', () => {
  const B = liftMirror()
  for (const [e, r, t] of CASES) {
    assert.equal(B.poolCover(e, r, t), poolCover(e, r, t), `poolCover(${e}, ${r})`)
    const state = poolCover(e, r, t)
    assert.equal(B.poolCoverNote(state, e, r, t), poolCoverNote(state, e, r, t), `note for ${state}`)
    assert.equal(B.poolCoverNeedsAction(state), poolCoverNeedsAction(state))
  }
})

test('the mirror carries the same warning window', () => {
  assert.equal(liftMirror().WARN_WITHIN_DAYS, WARN_WITHIN_DAYS,
    'Shloime asked for the last 7 days — both copies have to agree what 7 means')
})

test('a pool that ends before the phone comes back is always actionable', () => {
  // The exact case he reported: the hire is much longer than the pool.
  assert.equal(poolCover('2026-09-01', '2026-09-20', '2026-08-27'), 'short')
  assert.ok(poolCoverNeedsAction('short'))
  assert.match(poolCoverNote('short', '2026-09-01', '2026-09-20', '2026-08-27'), /19 day\(s\) before/)
})

test('no expiry on record says so rather than implying cover', () => {
  assert.equal(poolCover(null, '2026-09-20', '2026-08-27'), 'unknown')
  assert.match(poolCoverNote('unknown'), /nobody can say/)
})

test('the digest has somewhere to put the task the sweep raises', async () => {
  const { groupOf } = await import('../lib/dailyDigest.mjs')
  assert.equal(groupOf('POOLEXP-abc'), 'POOLEXP',
    'a POOLEXP task must not fall into "other"')
})

// ── The badge's own sentence ──────────────────────────────────────────────
// Owner, 28 Aug: "rentals, pool ends first isnt enough. need to say 7 days etc.
// with dates." The three words were true of a pool ending one day early and of
// one ending three weeks early, which are not the same problem — and the count
// and the date the app had already worked out sat in the `title` attribute,
// which never appears on the counter tablet at all.
test('the badge carries the date and the number, not just the state', () => {
  const fmt = { date: (v) => `D(${v})` }
  const T = '2026-08-28'
  const say = (pe, rd) => poolCoverLabel(poolCover(pe, rd, T), pe, rd, T, fmt)

  // Short: the number that matters is the SHORTFALL — how long they are abroad
  // with a dead line — not how long the pool has left.
  assert.equal(say('2026-09-04', '2026-09-11'), 'Pool ends D(2026-09-04) — 7 days before it is back')
  assert.equal(say('2026-09-10', '2026-09-11'), 'Pool ends D(2026-09-10) — 1 day before it is back')
  // Expired: how long it has been dead.
  assert.equal(say('2026-08-25', '2026-09-10'), 'Pool ended D(2026-08-25) — 3 days ago')
  // Soon: how long is left.
  assert.equal(say('2026-09-02', '2026-08-30'), 'Pool ends D(2026-09-02) — in 5 days')
})

test('"today" is said as today, never as zero days', () => {
  const fmt = { date: (v) => `D(${v})` }
  const T = '2026-08-28'
  // A pool that ran out this morning is not "0 days ago", and one ending
  // tonight is not "in 0 days".
  assert.equal(poolCoverLabel('expired', '2026-08-28', '2026-09-10', T, fmt), 'Pool ended today, D(2026-08-28)')
  assert.equal(poolCoverLabel('soon', '2026-08-28', '2026-08-20', T, fmt), 'Pool ends today, D(2026-08-28)')
  // And a pool ending exactly on the return day is not "0 days before".
  assert.equal(poolCoverLabel('short', '2026-09-10', '2026-09-10', T, fmt),
    'Pool ends D(2026-09-10) — the day it is due back')
})

test('the browser mirror says exactly what the lib says', () => {
  const B = liftMirror()
  const fmt = { date: (v) => `D(${v})` }
  const T = '2026-08-28'
  const DATES = ['2026-08-20', '2026-08-28', '2026-09-02', '2026-09-04', '2026-09-10', '2026-09-30', null]
  for (const pe of DATES) {
    for (const rd of DATES) {
      const st = poolCover(pe, rd, T)
      assert.equal(B.poolCoverLabel(st, pe, rd, T, fmt), poolCoverLabel(st, pe, rd, T, fmt),
        `${st}: expiry ${pe}, back ${rd}`)
    }
  }
})

test('the badge no longer says only the state', () => {
  assert.doesNotMatch(SRC, /'Pool ends first'/, 'the wordless badge label is back')
  assert.match(SRC, /KC_POOL\.poolCoverLabel\(state,/,
    'the badge is not asking for the sentence with the numbers in it')
})
