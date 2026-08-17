import { test } from 'node:test'
import assert from 'node:assert/strict'
import { phoneDigits, normalisePhoneE164, phoneProblem, isSendableNumber } from '../lib/phoneNumber.mjs'

test('digits survive whatever the number was written in', () => {
  assert.equal(phoneDigits('07911 123456'), '07911123456')
  assert.equal(phoneDigits('+44 (0) 7911-123456'), '4407911123456')
  assert.equal(phoneDigits(null), '')
})

test('UK numbers reach E.164 the way the shop writes them', () => {
  assert.equal(normalisePhoneE164('07911 123456'), '+447911123456')
  assert.equal(normalisePhoneE164('0044 7911 123456'), '+447911123456')
  assert.equal(normalisePhoneE164('447911123456'), '+447911123456')
  assert.equal(normalisePhoneE164('+44 7911 123456'), '+447911123456')
})

test('a number already carrying its own country code is left alone', () => {
  assert.equal(normalisePhoneE164('+972 54 400 0111'), '+972544000111')
  assert.equal(normalisePhoneE164('+1 845 304 7204'), '+18453047204')
})

test('nothing in, nothing out', () => {
  assert.equal(normalisePhoneE164(''), '')
  assert.equal(normalisePhoneE164('   '), '')
  assert.equal(normalisePhoneE164(undefined), '')
})

test('real numbers are not refused', () => {
  for (const n of ['07911123456', '+447911123456', '+972544000111', '+18453047204', '0161 531 1386']) {
    assert.equal(phoneProblem(n), null, n)
    assert.equal(isSendableNumber(n), true, n)
  }
})

test('the owner’s case: a number too long to be a number is flagged', () => {
  const p = phoneProblem('079111234567890123')
  assert.equal(p.code, 'long')
  assert.match(p.message, /15/)
  assert.equal(isSendableNumber('079111234567890123'), false)
})

test('15 digits passes, 16 does not — E.164’s own boundary', () => {
  assert.equal(phoneProblem('1'.repeat(15)), null)
  assert.equal(phoneProblem('1'.repeat(16))?.code, 'long')
})

test('too short, letters, a stray plus and nothing at all each say why', () => {
  assert.equal(phoneProblem('12345')?.code, 'short')
  assert.equal(phoneProblem('call the shul')?.code, 'letters')
  assert.equal(phoneProblem('+44+7911123456')?.code, 'shape')
  assert.equal(phoneProblem('')?.code, 'missing')
  assert.equal(phoneProblem(null)?.code, 'missing')
})

test('7 digits is the floor, 6 is below it', () => {
  assert.equal(phoneProblem('1234567'), null)
  assert.equal(phoneProblem('123456')?.code, 'short')
})
