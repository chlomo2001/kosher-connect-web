// renewal_pending, finished at last (issue #13; owner, 23 Aug: "Add the option
// to the staff form, and set it automatically when next_renewal_date passes").
//
// The enum existed from the first migration and the customer portal has always
// been ready to show it in two languages — but nothing could SET it, so the
// warning never fired once. Now two things can: a person, in the SIM form, and
// the nightly sweep, the day a line's renewal date passes. The same sweep
// clears it the moment the date is ahead again, so it is never a status
// somebody has to remember to reset.
//
// The dangerous half of the change is not the flip — it is every 'active'-only
// check in the app. A line parked in renewal_pending is still a LIVE line:
// if "has a SIM", the counts and the renewal views don't say so, the flip
// makes lines vanish from the app for exactly the days somebody should be
// looking at them.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const code = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
  .split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')

const MAIN = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')
const MAIN_CODE = code('../public/main.js')
const SWEEP = code('../pages/api/cron/sweep.js')

test('the staff form offers the status, worded the way the portal words it', () => {
  assert.match(MAIN_CODE, /<option value="renewal_pending"[^>]*>Renewal due<\/option>/)
  const PORTAL = readFileSync(new URL('../pages/portal.js', import.meta.url), 'utf8')
  assert.match(PORTAL, /renewal_pending: 'Renewal due'/,
    'staff and customer must read the same words for the same state')
})

test('the sweep sets it when the date passes, and clears it when the date is ahead', () => {
  assert.match(SWEEP, /section\('sim-renewal-pending'/)
  assert.match(SWEEP, /status=eq\.active&next_renewal_date=lt\.\$\{today\}/)
  assert.match(SWEEP, /status=eq\.renewal_pending&or=\(next_renewal_date\.gte\.\$\{today\},next_renewal_date\.is\.null\)/)
})

test('both flips patch legacy_extras.status — the blob is what the app reads back', () => {
  // sims persist by whole-array upsert from the app object; a typed-column-only
  // flip is silently reverted by the next admin SIM save (the 4a renewalDate trap).
  assert.match(SWEEP, /status: 'renewal_pending',\s*\n\s*legacy_extras: \{ \.\.\.\(s\.legacy_extras \|\| \{\}\), status: 'renewal_pending' \}/)
  assert.match(SWEEP, /status: 'active',\s*\n\s*legacy_extras: \{ \.\.\.\(s\.legacy_extras \|\| \{\}\), status: 'active' \}/)
})

test('the date-advance still reaches a parked line — else it never comes back', () => {
  assert.match(SWEEP, /status=in\.\(active,renewal_pending\)&next_renewal_date=lt\./,
    'an active-only advance filter would strand every flipped line in renewal_pending for ever')
})

test('the SIMDUE payment-check task survives the flip', () => {
  assert.match(SWEEP, /!\['active', 'renewal_pending'\]\.includes\(row\[0\]\.status\)/,
    'renewal_pending IS the renewal happening — closing its task then is backwards')
})

test('a parked line is still a live line everywhere the app asks', () => {
  assert.match(MAIN_CODE, /function simLive\(s\) \{ return !!s && \(s\.status === 'active' \|\| s\.status === 'renewal_pending'\); \}/)
  // The checks that used to hardcode 'active' now go through the helper. Count
  // stays a floor, not an exact number, so adding a new simLive call never
  // breaks this test — removing them is what it guards against.
  //
  // Floor moved 18 → 17 on 26 Aug, and only for the right reason. The AI reply
  // drafter was removed at the owner's request, and its customerContextForAi()
  // helper held one of the eighteen — it summarised a customer's live SIMs to
  // send to Gemini. The CALLER went, not the check: no site that asks whether a
  // line is live stopped asking. Verified before moving the number, by counting
  // simLive in the removed block (exactly one) rather than by assuming.
  const uses = (MAIN_CODE.match(/simLive\(/g) || []).length
  assert.ok(uses >= 17, `only ${uses} simLive uses — the liveness sweep has been unwound somewhere`)
  assert.match(MAIN_CODE, /badge-renewal">Renewal due/)
})

test('the behaviour, end to end on the pure pieces: live means active OR pending', () => {
  const m = MAIN.match(/function simLive\(s\) \{[^\n]*\}/)
  const simLive = new Function(`${m[0]}; return simLive`)()
  assert.equal(simLive({ status: 'active' }), true)
  assert.equal(simLive({ status: 'renewal_pending' }), true)
  assert.equal(simLive({ status: 'cancelled' }), false)
  assert.equal(simLive({ status: 'suspended' }), false)
  assert.equal(simLive(null), false)
})
