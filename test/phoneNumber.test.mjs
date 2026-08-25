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

test('a UK mobile that lost its country code is caught before the provider', () => {
  // 25 Aug: the first live test SMS went out as a 10-digit number starting 7 —
  // a UK mobile typed with + in place of the leading 0. This guard passed it as
  // "plausible length" and Twilio rejected it: HTTP 400, not a valid phone
  // number. The failure was honest but it cost a round trip and left a red row
  // in the audit log for a typo.
  const bad = phoneProblem('+7776654321')
  assert.equal(bad?.code, 'nocc')
  assert.match(bad.message, /44/)
  assert.equal(isSendableNumber('+7776654321'), false)
})

test('and the guard is narrow enough to refuse nothing real', () => {
  // Country code 7 is Russia and Kazakhstan, and those numbers are 11 digits —
  // which is why a 10-digit one starting 7 can be refused without refusing a
  // real number anywhere in the world.
  for (const good of [
    '+7 916 123 45 67',      // a real Russian mobile: 11 digits
    '07776 654321',          // the same UK number typed properly
    '+447776654321',
    '+972 54 400 0111',
    '+1 845 304 7204',
    '7654321',               // seven digits, not ten
  ]) {
    assert.equal(phoneProblem(good), null, `${good} must not be refused`)
  }
})
