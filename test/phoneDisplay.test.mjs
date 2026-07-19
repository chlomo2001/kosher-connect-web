// formatPhoneDisplay — display-only grouping over the canonical store format.
import test from 'node:test'
import assert from 'node:assert/strict'
import { formatPhoneDisplay, phoneKey } from '../lib/ukPhone.mjs'

test('UK mobile: memorable 4-3-3 whatever the input shape', () => {
  assert.equal(formatPhoneDisplay('+447974924585'), '+44 7974 924 585')
  assert.equal(formatPhoneDisplay('07974924585'), '+44 7974 924 585')
  assert.equal(formatPhoneDisplay('447974924585'), '+44 7974 924 585')
  assert.equal(formatPhoneDisplay('00447974924585'), '+44 7974 924 585')
  assert.equal(formatPhoneDisplay('+44 7809 450519'), '+44 7809 450 519')
})

test('UK landline: 3-3-4', () => {
  assert.equal(formatPhoneDisplay('01615311386'), '+44 161 531 1386')
})

test('Israeli and US numbers group their own way', () => {
  assert.equal(formatPhoneDisplay('+972521234567'), '+972 52 123 4567')  // mobile: 2-digit prefix
  assert.equal(formatPhoneDisplay('+972525115445'), '+972 52 511 5445')
  assert.equal(formatPhoneDisplay('+97225005656'), '+972 2 500 5656')    // landline: 1-digit area
  assert.equal(formatPhoneDisplay('+12125551234'), '+1 212 555 1234')
  assert.equal(formatPhoneDisplay('+17185998889'), '+1 718 599 8889')
})

test('the owner\'s reference examples verbatim', () => {
  assert.equal(formatPhoneDisplay('+441617952727'), '+44 161 795 2727')
  assert.equal(formatPhoneDisplay('+97225005656'), '+972 2 500 5656')
  assert.equal(formatPhoneDisplay('+17185998889'), '+1 718 599 8889')
  assert.equal(formatPhoneDisplay('+972525115445'), '+972 52 511 5445')
})

test('pass-throughs: empty, sender IDs, short codes, odd lengths', () => {
  assert.equal(formatPhoneDisplay(''), '')
  assert.equal(formatPhoneDisplay(null), '')
  assert.equal(formatPhoneDisplay('HSBC'), 'HSBC')
  assert.equal(formatPhoneDisplay('61016'), '61016')
  assert.equal(formatPhoneDisplay('+4479749245'), '+44 79749245') // 8 digits — no fake grouping
})

test('display output round-trips to the same storage key', () => {
  for (const raw of ['+447974924585', '07974924585', '+972521234567', '+12125551234', '01615311386']) {
    assert.equal(phoneKey(formatPhoneDisplay(raw)), phoneKey(raw), raw)
  }
})
