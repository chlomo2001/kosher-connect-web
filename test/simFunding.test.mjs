// A "through me" plan the shop cannot collect on.
//
// Owner, 20 Aug, after asking whether saving a customer's card would flip a
// plan to 'direct' (it does not — the field is about whose card is on the
// NETWORK account): "2 suggestions are good." The first was this — a plan
// marked Through me whose customer has no saved card and no Direct Debit
// mandate is a line the shop is quietly funding, and nothing said so.
import test from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { simFundingState, simUnfunded, fundingLabel } from '../lib/simFunding.mjs'

const ROOT = path.join(import.meta.dirname, '..')
const SRC = readFileSync(path.join(ROOT, 'public/main.js'), 'utf8')
const CSS = readFileSync(path.join(ROOT, 'styles/app.css'), 'utf8')

const THROUGH = { paymentType: 'through-me', status: 'active' }
const DIRECT = { paymentType: 'direct', status: 'active' }

test('a plan the customer pays for themselves is not the shop’s problem', () => {
  assert.equal(simFundingState(DIRECT, {}), 'not-billed')
  assert.equal(simFundingState(DIRECT, null), 'not-billed')
  assert.ok(!simUnfunded(DIRECT, null))
})

test('a cancelled plan bills nobody, so it is not flagged', () => {
  assert.equal(simFundingState({ paymentType: 'through-me', status: 'cancelled' }, {}), 'not-billed')
  // Suspended is NOT dead — a suspended line can come back, and the shop is
  // still the one on the hook for it.
  assert.equal(simFundingState({ paymentType: 'through-me', status: 'suspended' }, {}), 'none')
})

test('the flagged case: we pay the network, they have left us nothing', () => {
  assert.equal(simFundingState(THROUGH, {}), 'none')
  assert.equal(simFundingState(THROUGH, { card: false, dd: '' }), 'none')
  assert.ok(simUnfunded(THROUGH, {}))
  assert.match(fundingLabel('none'), /nothing to collect/)
})

test('a card or a live mandate clears it', () => {
  assert.equal(simFundingState(THROUGH, { card: true }), 'card')
  assert.equal(simFundingState(THROUGH, { dd: 'active' }), 'dd')
  assert.ok(!simUnfunded(THROUGH, { card: true }))
  assert.ok(!simUnfunded(THROUGH, { dd: 'active' }))
  // Nothing to say on screen about a plan that is fine.
  assert.equal(fundingLabel('card'), '')
  assert.equal(fundingLabel('dd'), '')
})

// Bacs activates about two working days after setup. A customer who has done
// their part is not the same as a customer who has done nothing, and rolling
// them together fills the list with rows that fix themselves by Thursday.
test('a mandate still setting up is its own answer, not a gap', () => {
  assert.equal(simFundingState(THROUGH, { dd: 'pending' }), 'dd-pending')
  assert.ok(!simUnfunded(THROUGH, { dd: 'pending' }))
  assert.match(fundingLabel('dd-pending'), /setting up/i)
  // A cancelled mandate is nothing at all — it is not 'active', and the shop
  // may not collect on it.
  assert.equal(simFundingState(THROUGH, { dd: 'cancelled' }), 'none')
})

test('a card outranks a pending mandate, because it can be charged today', () => {
  assert.equal(simFundingState(THROUGH, { card: true, dd: 'pending' }), 'card')
  assert.equal(simFundingState(THROUGH, { card: true, dd: 'active' }), 'dd')
})

// UNKNOWN IS NOT "NOBODY HAS A CARD". Until /api/payment-methods answers, the
// screen must say nothing — a false "nothing to collect from" across hundreds
// of rows gets read once, disproved, and then ignored for good.
test('the screen claims nothing before the methods have loaded', () => {
  const fn = SRC.slice(SRC.indexOf('function fundingChip(sim)'))
  const body = fn.slice(0, fn.indexOf('\n}\n'))
  assert.match(body, /if \(!method\) return '';/, 'an unloaded state must render no chip')
  assert.ok(body.indexOf('!method') < body.indexOf('simFundingState'),
    'it must bail out before it judges')

  const loader = SRC.slice(SRC.indexOf('async function ensurePayMethods()'))
  const lbody = loader.slice(0, loader.indexOf('\n}\n'))
  assert.match(lbody, /if \(!res \|\| !res\.success\)[\s\S]{0,80}return;/,
    'a failed load must leave the state unknown, not empty')
  assert.ok(!/simPayMethods = \{\}/.test(lbody.split('return;')[0]),
    'it must not default to an empty map on failure')
})

test('the browser mirror matches lib/simFunding.mjs', () => {
  const m = SRC.match(/\/\/ ── KC_SIMFUNDING mirror start ──[\s\S]*?\/\/ ── KC_SIMFUNDING mirror end ──/)
  assert.ok(m, 'KC_SIMFUNDING mirror region not found')
  // The region ENDS in a line comment, so the return has to start a new line —
  // appended on the same line it is commented out and the lift returns nothing.
  const lifted = new Function(`${m[0]}\nreturn { simFundingState, fundingLabel };`)()
  const cases = [
    [DIRECT, {}], [THROUGH, {}], [THROUGH, { card: true }], [THROUGH, { dd: 'active' }],
    [THROUGH, { dd: 'pending' }], [THROUGH, { dd: 'cancelled' }],
    [THROUGH, { card: true, dd: 'pending' }], [THROUGH, { card: true, dd: 'active' }],
    [{ paymentType: 'through-me', status: 'cancelled' }, {}],
    [{ paymentType: 'through-me', status: 'suspended' }, { card: true }],
  ]
  for (const [sim, method] of cases) {
    assert.equal(lifted.simFundingState(sim, method), simFundingState(sim, method),
      `mirror disagrees on ${JSON.stringify(sim)} / ${JSON.stringify(method)}`)
  }
  for (const state of ['none', 'dd-pending', 'card', 'dd', 'not-billed']) {
    assert.equal(lifted.fundingLabel(state), fundingLabel(state), state)
  }
})

test('the SIMs tab offers it as a filter and marks the row', () => {
  assert.match(SRC, /value: 'unfunded'[\s\S]{0,220}?simFundingState\(s, simMethodFor\(s\)\) === 'none'/,
    'the filter must use the same rule as the chip')
  assert.match(SRC, /'🔄 Through me'\}\$\{fundingChip\(s\)\}/,
    'the chip belongs in the Payment cell, beside what it qualifies')
})

// The endpoint answers "is there one", never "which one". An id that is never
// sent cannot end up in a log, a screenshot or a support thread.
test('the bulk endpoint sends booleans, not payment-method ids', () => {
  const api = readFileSync(path.join(ROOT, 'pages/api/payment-methods.js'), 'utf8')
  const body = api.slice(api.indexOf('async function handler'))
  assert.match(body, /card = !!r\.stripe_pm_id/)
  assert.doesNotMatch(body, /methods\[[^\]]*\] = \{[^}]*stripe_pm_id/,
    'the payment-method id must never be put in the response')
  assert.doesNotMatch(body, /stripe_customer_id/, 'the Stripe customer id is not needed here')
  assert.match(body, /selectAllPaged/, 'an unpaged read would report false alarms past the cap')
  assert.match(api, /export default withStaff\(handler\)/, 'staff only')
})

test('the chip is styled for both states', () => {
  assert.match(CSS, /\.kc-unfunded\b/)
  assert.match(CSS, /\.kc-funding-pending\b/)
  // --danger-ink, not --danger: the raw colour over its own 10% wash fails AA
  // in light, which is why .kc-contact-flag already does it this way.
  const rule = CSS.match(/\.kc-unfunded \{[\s\S]*?\}/)[0]
  assert.match(rule, /color: var\(--danger-ink\)/)
  assert.doesNotMatch(rule, /color: var\(--danger\)\s*;/)
})

// The dropdown reads as a question about whose money it is. It is not — it
// decides whose card sits on the NETWORK account, which is exactly what the
// owner asked about on 20 Aug.
test('the payment-type field says what it actually decides', () => {
  const i = SRC.indexOf('id="simPayment"')
  const near = SRC.slice(i, i + 2000)
  assert.match(near, /Whose card is on the network account/)
  assert.match(near, /not whose card we hold/)
})
