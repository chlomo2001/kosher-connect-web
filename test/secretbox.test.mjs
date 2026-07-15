// Round-trip + fail-closed behaviour for the secret cipher. Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'

// Set a key BEFORE importing the module (the key is read at load time).
process.env.SIM_CRED_KEY = crypto.randomBytes(32).toString('base64')
const { encryptSecret, decryptSecret, secretsEnabled } = await import('../lib/secretbox.js')

test('key present → enabled', () => {
  assert.equal(secretsEnabled, true)
})

test('round-trips a password', () => {
  const pw = 'Tr0ub4dour&3 — סיסמה'
  const token = encryptSecret(pw)
  assert.match(token, /^v1:/)
  assert.equal(decryptSecret(token), pw)
})

test('two encryptions of the same value differ (random IV) but both decrypt', () => {
  const a = encryptSecret('same')
  const b = encryptSecret('same')
  assert.notEqual(a, b)
  assert.equal(decryptSecret(a), 'same')
  assert.equal(decryptSecret(b), 'same')
})

test('empty / null encrypt to null (nothing stored)', () => {
  assert.equal(encryptSecret(''), null)
  assert.equal(encryptSecret(null), null)
  assert.equal(encryptSecret(undefined), null)
})

test('tampered ciphertext fails the auth tag → null, never throws', () => {
  const token = encryptSecret('secret')
  const tampered = token.slice(0, -4) + (token.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA')
  assert.equal(decryptSecret(tampered), null)
})

test('garbage / wrong-format tokens → null', () => {
  assert.equal(decryptSecret('not-a-token'), null)
  assert.equal(decryptSecret(''), null)
  assert.equal(decryptSecret(null), null)
})
