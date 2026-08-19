// Who the portal will let you be.
//
// The portal matches a signed-in email to a customer record and then shows that
// customer's balance, rentals, flights, SIM plans and last twelve ledger lines.
// The whole thing rests on one claim — that the person signing in owns the
// mailbox — so these hold the check that the claim was ever made.
//
// Why it matters here specifically: lib/mappers.js normalizeEmail strips dots
// at EVERY provider, so `a.s.uj.e.l.apud.7.86@gmail.com` and
// `asujelapud786@gmail.com` collapse to the same email_normalized. Two accounts
// in exactly that dot-stuffed shape appeared in Auth on 6 and 10 August,
// unverified and never signed in. They can do nothing — but only because
// Supabase withholds a session until an address is confirmed, which is a
// setting rather than a guarantee.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { portalUserIsUsable } from '../lib/auth.js'

test('a confirmed email may be somebody', () => {
  assert.equal(portalUserIsUsable({ email: 'a@b.com', email_confirmed_at: '2026-08-01T00:00:00Z' }), true)
  // Supabase's generated column, set for phone confirmation too.
  assert.equal(portalUserIsUsable({ email: 'a@b.com', confirmed_at: '2026-08-01T00:00:00Z' }), true)
})

test('an UNCONFIRMED email may not — this is the whole guard', () => {
  assert.equal(portalUserIsUsable({ email: 'a.s.uj.e.l.apud.7.86@gmail.com' }), false)
  assert.equal(portalUserIsUsable({ email: 'a@b.com', email_confirmed_at: null }), false)
  assert.equal(portalUserIsUsable({ email: 'a@b.com', email_confirmed_at: '', confirmed_at: null }), false)
})

test('no email at all is nobody, and nothing crashes on rubbish', () => {
  for (const bad of [null, undefined, {}, { email: '' }, { email_confirmed_at: 'x' }, 'string', 0]) {
    assert.equal(portalUserIsUsable(bad), false)
  }
})
