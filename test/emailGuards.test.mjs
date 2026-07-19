import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { verifySvixSignature, normalizeEmail } from '../lib/emailGuards.mjs'

const KEY_B64 = Buffer.from('a-test-webhook-signing-key').toString('base64')
const SECRET = `whsec_${KEY_B64}`

function sign(id, timestamp, payload, secret = SECRET) {
  const key = Buffer.from(String(secret).replace(/^whsec_/, ''), 'base64')
  return crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${payload}`).digest('base64')
}

const NOW = 1789000000
const base = () => {
  const id = 'msg_2abc'
  const timestamp = String(NOW)
  const payload = '{"type":"email.bounced","data":{"email_id":"re_1","to":["x@y.com"]}}'
  return { secret: SECRET, id, timestamp, payload, signatureHeader: `v1,${sign(id, timestamp, payload)}`, nowSec: NOW }
}

test('svix: valid signature verifies', () => {
  assert.equal(verifySvixSignature(base()), true)
})

test('svix: tampered payload fails', () => {
  const p = base()
  p.payload = p.payload.replace('bounced', 'delivered')
  assert.equal(verifySvixSignature(p), false)
})

test('svix: wrong secret fails', () => {
  const p = base()
  p.secret = `whsec_${Buffer.from('some-other-key').toString('base64')}`
  assert.equal(verifySvixSignature(p), false)
})

test('svix: one valid candidate among several verifies (key rotation)', () => {
  const p = base()
  const bogus = Buffer.from('nope-nope-nope-nope-nope-nope-32b').toString('base64')
  p.signatureHeader = `v1,${bogus} ${p.signatureHeader} v2,${bogus}`
  assert.equal(verifySvixSignature(p), true)
})

test('svix: non-v1 versions are ignored', () => {
  const p = base()
  p.signatureHeader = `v2,${sign(p.id, p.timestamp, p.payload)}`
  assert.equal(verifySvixSignature(p), false)
})

test('svix: stale timestamp is rejected (replay window)', () => {
  const p = base()
  p.nowSec = NOW + 301
  assert.equal(verifySvixSignature(p), false)
  const q = base()
  q.nowSec = NOW + 299
  assert.equal(verifySvixSignature(q), true)
})

test('svix: future-skewed timestamp beyond tolerance is rejected', () => {
  const p = base()
  p.nowSec = NOW - 301
  assert.equal(verifySvixSignature(p), false)
})

test('svix: missing pieces fail closed', () => {
  for (const missing of ['secret', 'id', 'timestamp', 'signatureHeader']) {
    const p = base()
    p[missing] = ''
    assert.equal(verifySvixSignature(p), false, `missing ${missing}`)
  }
  const p = base()
  p.timestamp = 'not-a-number'
  assert.equal(verifySvixSignature(p), false)
})

test('normalizeEmail trims and lower-cases', () => {
  assert.equal(normalizeEmail('  Moishe@Example.COM '), 'moishe@example.com')
  assert.equal(normalizeEmail(null), '')
})
