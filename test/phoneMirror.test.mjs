// phoneProblem exists twice on purpose — once in lib/phoneNumber.mjs for the
// send path, once in public/main.js so the counter is told before the save,
// not after. public/main.js is a classic script and cannot import, so the copy
// is real; this test is what stops the two answering differently. Same
// arrangement as pricingMirror.test.mjs and nameCase.test.mjs.
//
// It does not compare source text — it lifts the browser function out of
// main.js, runs it, and holds it to the lib's verdict on the same input.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { phoneProblem } from '../lib/phoneNumber.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = readFileSync(path.join(ROOT, 'public/main.js'), 'utf8')

const lift = (name) => {
  const src = (SRC.match(new RegExp(`function ${name}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n\\}`)) || [])[0]
  assert.ok(src, `public/main.js must define its ${name} mirror`)
  return new Function(`${src}; return ${name}`)()
}

const clientPhoneProblem = lift('phoneProblem')

const CASES = [
  // real numbers the shop deals with — none of these may ever be refused
  '07911 123456', '+447911123456', '447911123456', '0044 7911 123456',
  '+972 54 400 0111', '+1 845 304 7204', '0161 531 1386', '1234567',
  // and the ones that cannot be numbers
  '079111234567890123', '1'.repeat(16), '1'.repeat(15), '12345', '123456',
  'call the shul', '+44+7911123456', '', '   ',
]

test('both copies agree on every number, verdict and reason alike', () => {
  for (const n of CASES) {
    const lib = phoneProblem(n)
    const client = clientPhoneProblem(n)
    assert.deepEqual(client, lib, `disagreed on ${JSON.stringify(n)}`)
  }
})

test('null and undefined are a missing number in both', () => {
  for (const n of [null, undefined]) {
    assert.deepEqual(clientPhoneProblem(n), phoneProblem(n))
  }
})
