// The Customers tab's headline money figure comes from the ledger.
//
// The bug, from the owner's screenshot of 28 Aug: the card read
//
//   const totalPaid = rentals.reduce((s, r) => s + (r.amountPaid || 0), 0)
//
// and printed it under "Total revenue / All time". Counted against Kc-Live that
// same morning:
//
//   rentals.amountPaid, all 12 rows          £410.40
//   ledger payments + top_ups, 256 rows   £92,129.10
//
// So a card claiming to be all the money the shop has ever taken was showing
// 0.4% of it. It is the same fault as the Balance column beside it — fixed
// under audit U9 by reading /api/ledger — left standing nine lines above the
// fix, in the same function.
//
// What this file defends is the shape of the correction, not the number: the
// figure is served from the DB aggregate, and there is NO rental-maths
// fallback, because a number wrong by two hundred times is not a fallback.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const SRC = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')
const API = readFileSync(new URL('../pages/api/ledger.js', import.meta.url), 'utf8')
const MANUAL = readFileSync(new URL('../lib/manual.mjs', import.meta.url), 'utf8')

test('the card no longer sums the rentals array', () => {
  // Comment lines are skipped on purpose: the fix documents the old expression
  // by quoting it, and a test that cannot tell the quote from the code would
  // fail on its own explanation.
  const live = SRC.split('\n').filter((l) => !l.trimStart().startsWith('//'))
  const guilty = live.filter((l) => /rentals\.reduce\([^)]*amountPaid/.test(l))
  assert.deepEqual(guilty, [],
    'the Customers tab is summing rental payments for its revenue figure again')
})

test('the figure comes off the ledger response', () => {
  assert.match(SRC, /customerRevenueAllTime = typeof d\.receivedAllTime === 'number'/)
  assert.match(SRC, /id="statRevenue"/)
})

test('there is no fallback to a wrong number', () => {
  // The three states are: not loaded, not permitted, and the figure. None of
  // them is "something else that happens to be on screen".
  const fn = SRC.match(/function paintCustomerRevenue\(\) \{[\s\S]*?\n\}/)
  assert.ok(fn, 'paintCustomerRevenue is gone')
  assert.match(fn[0], /customerRevenueAllTime === false/, 'no not-permitted state')
  assert.match(fn[0], /customerRevenueAllTime === null/, 'no still-loading state')
  assert.doesNotMatch(fn[0], /rentals/, 'the painter is reading rentals again')
})

test('a refused or failed ledger read says so rather than showing a number', () => {
  // Staff without the wallet get the same treatment the Balance column gives
  // them: nothing, said out loud. A revenue figure is not something to guess.
  assert.match(SRC, /\{ customerRevenueAllTime = false; paintCustomerRevenue\(\); return; \}/)
  assert.match(SRC, /catch\(\(\) => \{ customerRevenueAllTime = false; paintCustomerRevenue\(\); \}\)/)
  assert.match(SRC, /Not available on your account/)
})

test('the API aggregates in the database, not over fetched rows', () => {
  // Summing rows client-side is what silently truncated the revenue report at
  // PostgREST's 1000-row cap once already; the comment in this file says so.
  assert.match(API, /db\.rpc\('ledger_revenue_since', \{ p_from: EPOCH \}\)/)
  assert.match(API, /receivedAllTime: Math\.round\(/)
  assert.match(API, /const EPOCH = '1970-01-01T00:00:00Z'/)
})

test('received is money in, not money in netted against money out', () => {
  // refund_payout is money genuinely leaving the till and it has its own line.
  // Folding it in here would make one figure answer two questions.
  const block = API.match(/receivedAllTime: Math\.round\(\(allTimeRows \|\| \[\]\)[\s\S]*?\* 100\) \/ 100/)
  assert.ok(block, 'the all-time sum has moved')
  assert.doesNotMatch(block[0], /paid_out|refunded/, 'the all-time figure is netting payouts off')
  assert.match(block[0], /Number\(r\.received\)/)
})

test('the manual stopped saying the figure is rentals only', () => {
  assert.doesNotMatch(MANUAL, /what the shop has taken from rentals all told/,
    'the manual still describes the old rentals-only card')
  assert.match(MANUAL, /every payment and top-up in the ledger/)
})

test('the harness has a figure to draw', () => {
  const seed = JSON.parse(readFileSync(new URL('../ops/harness/seed.json', import.meta.url), 'utf8'))
  assert.equal(typeof seed['/api/ledger'].receivedAllTime, 'number',
    'the seeded ledger has no receivedAllTime, so every screenshot shows a dash')
})
