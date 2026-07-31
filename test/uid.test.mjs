// Collision-safe record ids (#45). Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { uid } from '../lib/uid.mjs'

test('same millisecond, different random → different ids', () => {
  const a = uid(1700000000000, () => 0.111111)
  const b = uid(1700000000000, () => 0.999999)
  assert.notEqual(a, b)
})

test('stays all-digits, like every legacy_id already on file', () => {
  for (let i = 0; i < 200; i++) assert.match(uid(), /^\d+$/)
})

test('the timestamp stays readable at the front', () => {
  assert.ok(uid(1700000000000, () => 0.5).startsWith('1700000000000'))
})

test('random suffix is zero-padded, so ids never shorten', () => {
  const len = uid(1700000000000, () => 0.5).length
  assert.equal(uid(1700000000000, () => 0).length, len)        // 000000
  assert.equal(uid(1700000000000, () => 0.0000001).length, len)
  assert.equal(uid(1700000000000, () => 0.9999999).length, len)
})

test('a burst inside one millisecond does not collide in practice', () => {
  // The real failure this fixes: a bulk import minting many rows per ms.
  const seen = new Set()
  for (let i = 0; i < 5000; i++) seen.add(uid(1700000000000))
  // 5,000 draws from 1,000,000 slots — expect ~12 collisions, never hundreds.
  // The old 3-digit suffix would have collapsed to ~1,000 distinct values.
  assert.ok(seen.size > 4950, `only ${seen.size} distinct ids from 5000 draws`)
})

test('the old 3-digit width would have failed that same burst', () => {
  // Guards the reason for the widening, so nobody narrows it back.
  const seen = new Set()
  for (let i = 0; i < 5000; i++) {
    seen.add(String(1700000000000) + Math.floor(Math.random() * 1000).toString().padStart(3, '0'))
  }
  assert.ok(seen.size <= 1000)
})
