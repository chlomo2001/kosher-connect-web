// One number is one line. Shloime's rule, and what it has to survive.
import test from 'node:test'
import assert from 'node:assert'
import { digits, emailLooksReal, lineClashes } from '../lib/lineIdentity.mjs'

test('the same number in three formats is one number', () => {
  // This is the whole reason the rule compares digits. US Mobile does not care
  // how it was typed and neither should we.
  const forms = ['+1 845 828 1823', '1 845 828 1823', '18458281823', '(845) 828-1823']
  const seen = new Set(forms.map(digits))
  assert.strictEqual(seen.size, 2, 'only the one without a country code should differ')
  assert.deepStrictEqual(lineClashes([
    { id: 'a', number: '+1 845 828 1823' },
    { id: 'b', number: '18458281823' },
  ]).length, 1, 'the pair Shloime found by hand must be refused')
})

test('one SIM cannot be in two phones', () => {
  const out = lineClashes([
    { id: 'a', number: '19297943933', simId: '89012803331726323915' },
    { id: 'b', number: '19175443574', simId: '89012803331726323915' },
  ])
  assert.strictEqual(out.length, 1)
  assert.match(out[0], /ICCID/)
  // It names the OTHER line, because "duplicate ICCID" tells nobody which
  // phone to go and pick up.
  assert.match(out[0], /19297943933/)
})

test('a pool and an email may repeat — those are groups, not identities', () => {
  assert.deepStrictEqual(lineClashes([
    { id: 'a', number: '1', pool: 'Pool 37', email: 'shop@kosher-connect.com' },
    { id: 'b', number: '2', pool: 'Pool 37', email: 'shop@kosher-connect.com' },
  ]), [], 'one carrier login runs many lines — that is what a master account is')
})

test('an email without an @ is refused', () => {
  assert.strictEqual(emailLooksReal(''), true, 'not given is not the same as wrong')
  assert.strictEqual(emailLooksReal('a@b.com'), true)
  assert.strictEqual(emailLooksReal('no-at-sign'), false)
  assert.strictEqual(emailLooksReal('two@@at.com'), false)
  assert.match(lineClashes([{ id: 'a', number: '1', email: 'no-at-sign' }])[0], /needs an @/)
})

test('saving a line over itself is not a duplicate of itself', () => {
  // The first draft of this refused every edit, which would have been a worse
  // bug than the one it was fixing.
  assert.deepStrictEqual(
    lineClashes([{ id: 'a', number: '18458281823', simId: '8901' }],
                [{ id: 'a', number: '18458281823', simId: '8901' }]), [])
})

test('a blank number or ICCID never clashes with another blank', () => {
  // Plenty of lines are added before the SIM is to hand.
  assert.deepStrictEqual(lineClashes([
    { id: 'a', number: '', simId: '' },
    { id: 'b', number: '', simId: '' },
  ]), [])
})

test('a new line is checked against what is already stored, not just its batch', () => {
  const out = lineClashes([{ id: 'new', number: '+1 845 828 1823' }],
                          [{ id: 'old', number: '18458281823' }])
  assert.strictEqual(out.length, 1)
})
