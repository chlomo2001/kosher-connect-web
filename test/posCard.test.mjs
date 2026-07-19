import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeCardResult } from '../lib/posCard.mjs'

const APPROVED = {
  chargeReference: 'PAY-SALE-abc12345-now',
  approved: true,
  amount: 120,
  myposRef: 'MP123456',
  stan: '004512',
  authCode: 'A1B2C3',
  brand: 'Visa',
  last4: '4242',
}

test('approved result sanitizes cleanly', () => {
  const r = sanitizeCardResult(APPROVED)
  assert.equal(r.ok, true)
  assert.equal(r.row.charge_reference, 'PAY-SALE-abc12345-now')
  assert.equal(r.row.approved, true)
  assert.equal(r.row.amount, 120)
  assert.equal(r.row.last4, '4242')
  assert.equal(r.row.error, null)
})

test('a full PAN is cut down to its last 4 digits, however it arrives', () => {
  for (const pan of ['4242424242424242', '4242 4242 4242 4242', '4242-4242-4242-9999']) {
    const r = sanitizeCardResult({ ...APPROVED, last4: pan })
    assert.equal(r.ok, true)
    assert.equal(r.row.last4, pan.replace(/\D/g, '').slice(-4))
    assert.equal(r.row.last4.length, 4)
  }
})

test('missing or malformed chargeReference is rejected', () => {
  assert.equal(sanitizeCardResult({ ...APPROVED, chargeReference: undefined }).ok, false)
  assert.equal(sanitizeCardResult({ ...APPROVED, chargeReference: 'short' }).ok, false)
  assert.equal(sanitizeCardResult({ ...APPROVED, chargeReference: 'has spaces not allowed' }).ok, false)
})

test('approved without a sane amount is rejected; declined without amount is fine', () => {
  assert.equal(sanitizeCardResult({ ...APPROVED, amount: undefined }).ok, false)
  assert.equal(sanitizeCardResult({ ...APPROVED, amount: -5 }).ok, false)
  assert.equal(sanitizeCardResult({ ...APPROVED, amount: 'NaN' }).ok, false)
  const declined = sanitizeCardResult({
    chargeReference: APPROVED.chargeReference,
    approved: false,
    error: 'DECLINED_BY_ISSUER',
  })
  assert.equal(declined.ok, true)
  assert.equal(declined.row.approved, false)
  assert.equal(declined.row.error, 'DECLINED_BY_ISSUER')
})

test('approved must be literal true — strings and 1 count as declined', () => {
  for (const v of ['true', 1, 'yes']) {
    const r = sanitizeCardResult({ ...APPROVED, approved: v, error: 'x' })
    assert.equal(r.ok, true)
    assert.equal(r.row.approved, false)
  }
})

test('free-text fields are length-clamped', () => {
  const r = sanitizeCardResult({ ...APPROVED, myposRef: 'x'.repeat(500), error: 'y'.repeat(500), approved: false })
  assert.equal(r.ok, true)
  assert.equal(r.row.mypos_ref.length, 64)
  assert.equal(r.row.error.length, 200)
})

test('amount is rounded to pennies', () => {
  const r = sanitizeCardResult({ ...APPROVED, amount: 10.005 })
  assert.equal(r.row.amount, 10.01)
})
