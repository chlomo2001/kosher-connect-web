// The name signal, and the truthiness bug that made it useless.
//
// namesSimilar() returns { match, score, strong } — an OBJECT. scoreCandidate
// tested it directly, and every object is truthy, so EVERY candidate scored
// the name points and every proposal carried "counterparty resembles <name>",
// including a supermarket against a customer. The consequence is the one the
// owner reported on the Stripe pull (24 Aug): obvious name matches were not
// found, and far-off candidates were suggested instead — because the name
// distinguished nobody, leaving the amount to decide, and an amount
// coincidence is common.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scoreCandidate, proposeMatches } from '../lib/bankMatch.mjs'
import { namesSimilar } from '../lib/nameMatch.mjs'

test('namesSimilar returns an object, so it must never be used as a boolean', () => {
  const miss = namesSimilar('SAINSBURYS', 'Rivka Gluck')
  assert.equal(miss.match, false, 'these are not the same person')
  assert.ok(miss, 'and the object is still truthy — which is the whole trap')
})

test('a name that does not match scores nothing, and claims nothing', () => {
  const s = scoreCandidate(
    { counterpartyName: 'SAINSBURYS', amount: 0 },
    { customerId: 'c1', name: 'Rivka Gluck' })
  assert.equal(s.score, 0, 'an unrelated counterparty must not score')
  assert.deepEqual(s.reasons, [], 'and must not claim a resemblance')
})

test('forename AND surname reaches "possible" on the name alone', () => {
  // What the owner means by "obviously him": nothing else agreed, and it was
  // still plainly the right person.
  const s = scoreCandidate(
    { counterpartyName: 'MOSHE BODNER', amount: 0 },
    { customerId: 'c1', name: 'Moshe Bodner' })
  assert.ok(s.score >= 45, `a full-name match scored only ${s.score}`)
  assert.match(s.reasons.join(' '), /forename and surname/)
})

test('a shared surname is weaker than a full name', () => {
  const full = scoreCandidate({ counterpartyName: 'Moshe Bodner', amount: 0 },
    { customerId: 'c1', name: 'Moshe Bodner' }).score
  const sur = scoreCandidate({ counterpartyName: 'Bodner', amount: 0 },
    { customerId: 'c1', name: 'Yoel Bodner' }).score
  assert.ok(sur < full, `surname-only (${sur}) must not equal a full name (${full})`)
})

test('the right name beats a stranger who happens to owe the same amount', () => {
  // The exact shape that was reported. Before the fix the stranger won:
  // amount 25 + a name score every candidate got = 45, against the real
  // person's 20.
  const txn = { counterpartyName: 'MOSHE BODNER', amount: 46, description: 'STRIPE' }
  const { proposals, best } = proposeMatches(txn, [
    { customerId: 'c1', name: 'Moshe Bodner', expectedAmount: null },
    { customerId: 'c2', name: 'Chaim Kopilowitz', expectedAmount: 46 },
    { customerId: 'c3', name: 'Rivka Gluck', expectedAmount: null },
  ])
  assert.equal(best.candidate.name, 'Moshe Bodner', 'the named person must lead')
  assert.ok(!proposals.some((p) => p.candidate.name === 'Rivka Gluck'),
    'a candidate with no signal at all must not be proposed')
  for (const p of proposals) {
    if (p.candidate.name !== 'Moshe Bodner') {
      assert.ok(!/resembles|forename and surname|shares a name/.test(p.reasons.join(' ')),
        `${p.candidate.name} must not claim a name match`)
    }
  }
})
