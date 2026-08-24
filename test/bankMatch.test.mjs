// Bank-feed matching. Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  refsIn, scoreCandidate, confidenceOf, proposeMatches, shouldAutoPost, AUTO_POST_SUPPORTED, mailboxKey,
} from '../lib/bankMatch.mjs'

test('refsIn — finds a booking ref inside bank-statement noise', () => {
  assert.deepEqual(refsIn('BGC BNKYRW/KOPILOWITZ'), ['BNKYRW'])
  // Real refs are often all letters (BNKYRW, IMPKJZ), so "contains a digit"
  // can't be the filter — six-letter banking words have to be stopped by name.
  assert.deepEqual(refsIn('faster payment ehc93y ref'), ['EHC93Y'])
  assert.deepEqual(refsIn('DIRECT CREDIT ONLINE'), [])
  // Sort codes, dates and amounts are not references.
  assert.deepEqual(refsIn('230120 17316327 300726'), [])
  assert.deepEqual(refsIn(''), [])
})

test('refsIn — a word the stop list misses is harmless downstream', () => {
  // The stop list will never be complete. What protects the match is that a
  // stray token only scores if the candidate itself claims that reference.
  assert.deepEqual(refsIn('WIDGET transfer'), ['WIDGET'])   // false positive, by design tolerable
  const r = scoreCandidate({ amount: 50, description: 'WIDGET transfer' },
    { customerId: 'c1', references: ['BNKYRW'] })
  assert.equal(r.score, 0)  // matches nothing real
})

test('scoreCandidate — a reference hit is the strongest single signal', () => {
  const txn = { amount: 285, bookedAt: '2026-07-30', description: 'BGC BNKYRW' }
  const r = scoreCandidate(txn, { customerId: 'c1', references: ['BNKYRW'] })
  assert.equal(confidenceOf(r.score), 'possible')
  assert.match(r.reasons.join(' '), /reference BNKYRW/)
})

test('scoreCandidate — signals agreeing is what makes it strong', () => {
  // Reference + exact amount + name, all pointing the same way.
  const txn = {
    amount: 285, bookedAt: '2026-07-30T00:00:00Z',
    description: 'BGC BNKYRW', counterpartyName: 'KOPILOWITZ',
  }
  const r = scoreCandidate(txn, {
    customerId: 'c1', name: 'Chaim Kopilowitz',
    references: ['BNKYRW'], expectedAmount: 285, dueAt: '2026-07-30T00:00:00Z',
  })
  assert.equal(confidenceOf(r.score), 'strong')
})

test('scoreCandidate — money moving the wrong way is penalised, not ignored', () => {
  // A refund we owe OUT (-285) cannot be settled by money coming IN.
  const txn = { amount: 285, description: 'credit' }
  const r = scoreCandidate(txn, { customerId: 'c1', expectedAmount: -285 })
  assert.match(r.reasons.join(' '), /direction disagrees/)
  assert.equal(r.score, 0)  // the exact-amount credit does not rescue it
})

// The reason WORDING changed on 24 Aug when the name signal was graded
// (a shared surname and a full name no longer say the same thing). What
// this test is actually holding — Taitelbaum on file still finds
// Teitelbaum on the statement — is unchanged.
test('scoreCandidate — transliterated surnames still match', () => {
  const txn = { amount: 90, counterpartyName: 'TEITELBAUM' }
  const r = scoreCandidate(txn, { customerId: 'c1', name: 'Taitelbaum', expectedAmount: 90 })
  assert.match(r.reasons.join(' '), /shares a name with|forename and surname/)
})

test('proposeMatches — two customers owing the same amount is flagged ambiguous', () => {
  // The dangerous case: a bare £45 credit against two identical debts. Nothing
  // distinguishes them, so the UI must not present a confident winner.
  const txn = { amount: 45, bookedAt: '2026-07-29T00:00:00Z', description: 'BANK CREDIT' }
  const out = proposeMatches(txn, [
    { customerId: 'c1', expectedAmount: 45 },
    { customerId: 'c2', expectedAmount: 45 },
  ])
  assert.equal(out.ambiguous, true)
  assert.equal(out.proposals.length, 2)
})

test('proposeMatches — a reference breaks the tie', () => {
  const txn = { amount: 45, description: 'BGC FMLJ8J', bookedAt: '2026-07-29T00:00:00Z' }
  const out = proposeMatches(txn, [
    { customerId: 'c1', expectedAmount: 45 },
    { customerId: 'c2', expectedAmount: 45, references: ['FMLJ8J'] },
  ])
  assert.equal(out.ambiguous, false)
  assert.equal(out.best.candidate.customerId, 'c2')
})

test('proposeMatches — nothing plausible proposes nothing', () => {
  const out = proposeMatches({ amount: 12.5, description: 'CARD FEE' }, [
    { customerId: 'c1', expectedAmount: 400 },
  ])
  assert.equal(out.best, null)
  assert.equal(out.suggestedState, 'unmatched')
  assert.deepEqual(out.proposals, [])
})

test('a match is never auto-posted, at any confidence', () => {
  // The guard rail. A strong match is still only a proposal — the ledger is
  // append-only, so a wrong auto-post can only ever be corrected forward.
  assert.equal(AUTO_POST_SUPPORTED, false)
  assert.equal(shouldAutoPost({ confidence: 'strong', score: 999 }), false)
  const out = proposeMatches(
    { amount: 285, description: 'BGC BNKYRW', counterpartyName: 'KOPILOWITZ' },
    [{ customerId: 'c1', name: 'Chaim Kopilowitz', references: ['BNKYRW'], expectedAmount: 285 }]
  )
  assert.equal(out.best.confidence, 'strong')
  assert.equal(out.suggestedState, 'proposed')  // never 'confirmed'
})

test('email — the payer’s own address is the strongest signal a card carries', () => {
  const txn = { amount: 45, bookedAt: '2026-08-03', description: 'Payment link', counterpartyName: 'S Paneth', email: 'E.A.Rothbart+shop@gmail.com' }
  const hit = scoreCandidate(txn, { customerId: '1', name: 'Eliezer Rothbart', email: 'earothbart@gmail.com' })
  assert.ok(hit.score >= 50)
  assert.ok(hit.reasons.some((r) => /address on file/.test(r)))
  // Dots and +tags are decoration; a different mailbox is a different person.
  const miss = scoreCandidate(txn, { customerId: '2', name: 'Someone Else', email: 'other@gmail.com' })
  assert.equal(miss.reasons.some((r) => /address on file/.test(r)), false)
  // Neither side present must never match "nothing" to "nothing".
  const blank = scoreCandidate({ ...txn, email: '' }, { customerId: '3', name: 'No Email', email: '' })
  assert.equal(blank.reasons.some((r) => /address on file/.test(r)), false)
})

test('mailboxKey — the app’s own rule, and it refuses non-addresses', () => {
  assert.equal(mailboxKey('E.A.Rothbart+shop@Gmail.com'), 'earothbart@gmail.com')
  assert.equal(mailboxKey('plain'), '')
  assert.equal(mailboxKey(''), '')
  assert.equal(mailboxKey('@nope.com'), '')
})
