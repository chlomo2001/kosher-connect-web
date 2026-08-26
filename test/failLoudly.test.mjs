// Three places that answered a failure with a plausible number.
//
// Found while sweeping for the fault that hid the manual's screenshots. That
// one was a filesystem read that could not work in production; these are the
// same shape one layer up — a catch that converts "I could not find out" into
// a specific, confident, wrong answer, which is the one kind of failure nobody
// ever notices.
//
// The rule they now follow: a fallback is legitimate when it is a REAL answer
// (built-in travel rules are real rules). It is not legitimate when it is a
// number the rest of the code will believe (0 pounds, no rules at all).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const code = (p) => read(p).split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')

test('a cash-up that cannot read the float refuses, rather than counting it as zero', () => {
  const src = code('pages/api/cashup.js')
  // The suppressor is gone: the handler's own catch is what should fire, and
  // it returns a 500 the screen can show.
  assert.ok(!/catch\s*\{\s*return 0\s*\}/.test(src),
    'openingFloat still answers a failed read with 0 — expectedCash comes out short by the float')
  // A missing row is still an honest zero: no float has been set.
  assert.match(src, /if \(!rows\.length\) return 0/,
    'a float that was never set is legitimately 0 and must stay that way')
  // A stored value that is not money is a fault, not a zero.
  assert.match(src, /throw new Error\(`till_opening_float/,
    'a malformed float must say so — silently using 0 costs the day\'s count that much cash')
  // The reason it can throw at all: one catch, at the handler, that 500s.
  assert.match(src, /catch \(e\) \{[\s\S]{0,120}console\.error\('\[api\/cashup\]'/,
    'the handler must still log and 500 — that is where the thrown float lands')
})

test('the POST path is the reason it matters', () => {
  // Not a display bug. A wrong float is WRITTEN, with the variance computed
  // from it, into the till record for that day.
  const src = code('pages/api/cashup.js')
  assert.match(src, /db\.upsert\('till_counts'[\s\S]{0,200}expected: s\.expectedCash/,
    'the expected figure is persisted — so it must never be a guess')
})

test('the travel-rules editor says it could not load, not that there are none', () => {
  const src = code('pages/api/travel-rules.js')
  assert.ok(!/catch \{ rules = \[\] \}/.test(src),
    'a failed read still becomes an empty matrix, which reads as "no rules are set"')
  assert.match(src, /console\.error\('\[api\/travel-rules\]/, 'the failure must be logged')
  assert.match(src, /return res\.status\(503\)\.json\(\{ success: false/,
    'the card already knows how to say it could not load — it has to be told')
  // And the card must still be the thing that says it.
  assert.match(read('public/main.js'), /Could not load rules\./,
    'the settings card lost its failure message')
})

test('the booking gate keeps its fallback, loses its silence and its stickiness', () => {
  const src = code('lib/travelRulesDb.js')
  // The fallback is deliberate: built-in rules are real rules, and a booking
  // must never hard-fail over this. That stays.
  assert.match(src, /return BUILTIN_RULES/, 'the built-in fallback must stay — a booking cannot hard-fail here')
  assert.match(src, /console\.error\('\[travelRules\]/,
    'running the shop on built-in rules instead of the owner\'s must not be silent')
  // The bug: cacheAt was stamped after the catch, pinning the built-ins for a
  // full minute of bookings after the database had already come back.
  const cat = src.slice(src.indexOf('} catch'), src.indexOf('cache = Array.isArray'))
  assert.ok(!/cacheAt/.test(cat), 'the error path caches the fallback — one failed read pins it for the whole TTL')
})
