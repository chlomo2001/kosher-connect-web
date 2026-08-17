// One customer match, three callers — and the browser's copy has to agree
// with the lib's, because public/main.js is a classic script and cannot
// import. Same arrangement as phoneMirror / pricingMirror / nameCase: the
// browser function is LIFTED out of main.js, run, and held to the lib.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { customerMatches, customerNames, phoneDigitsMatch } from '../lib/customerSearch.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = readFileSync(path.join(ROOT, 'public/main.js'), 'utf8')

const lift = (name, deps = '') => {
  const src = (SRC.match(new RegExp(`function ${name}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n\\}`)) || [])[0]
  assert.ok(src, `public/main.js must define its ${name} mirror`)
  return new Function(`${deps}${src}; return ${name}`)()
}
const depSrc = ['phoneDigitsMatch', 'customerNames'].map((n) =>
  (SRC.match(new RegExp(`function ${n}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n\\}`)) || [])[0] + ';\n').join('')
const clientMatches = lift('customerMatches', depSrc)

const SHMUEL = {
  firstName: 'Shmuel', lastName: 'Bleier', phone: '+44 7703572578', email: '',
  aka: ['Shmiel Y Bleier'],
}
const PLAIN = { firstName: 'Chaim', lastName: 'Kopilowitz', phone: '+44 7871385566', email: 'chaim@example.com' }

test('a name merged away still finds the man', () => {
  // Two records of one man were merged on 17 Aug; the shop had been typing the
  // losing spelling for a year. If search only reads the surviving name, that
  // spelling becomes a dead end — worse than the duplicate was.
  assert.equal(customerMatches('shmuel', SHMUEL), true)
  assert.equal(customerMatches('shmiel', SHMUEL), true)
  assert.equal(customerMatches('Shmiel Y', SHMUEL), true)
  assert.equal(customerMatches('bleier', SHMUEL), true)
  assert.equal(customerMatches('shmerel', SHMUEL), false)
})

test('aka takes a bare string as well as a list, and never repeats the current name', () => {
  assert.deepEqual(customerNames({ firstName: 'A', lastName: 'B' }), ['A B'])
  assert.deepEqual(customerNames({ firstName: 'A', lastName: 'B', aka: 'C D' }), ['A B', 'C D'])
  assert.deepEqual(customerNames({ firstName: 'A', lastName: 'B', aka: ['a b', 'C D'] }), ['A B', 'C D'])
  assert.deepEqual(customerNames({ firstName: 'A', lastName: 'B', aka: ['', null] }), ['A B'])
})

test('a number is found however either side writes it', () => {
  assert.equal(customerMatches('07871 385566', PLAIN), true)
  assert.equal(customerMatches('+447871385566', PLAIN), true)
  assert.equal(customerMatches('385566', PLAIN), true)
  assert.equal(phoneDigitsMatch('07703572578', SHMUEL), true)
  // Too few digits to mean a number — must not sweep half the book in.
  assert.equal(phoneDigitsMatch('44', PLAIN), false)
})

test('an empty query matches everyone, a missing customer matches nothing', () => {
  assert.equal(customerMatches('', PLAIN), true)
  assert.equal(customerMatches('   ', PLAIN), true)
  assert.equal(customerMatches('chaim', null), false)
})

test('email still matches', () => {
  assert.equal(customerMatches('chaim@', PLAIN), true)
  assert.equal(customerMatches('EXAMPLE.COM', PLAIN), true)
})

test('the browser copy answers exactly as the lib does', () => {
  const people = [SHMUEL, PLAIN, { firstName: 'Rivka', lastName: 'Gluck', phone: '+972 54 412 3456' },
    { firstName: '', lastName: '', phone: '', email: '' }, null]
  const queries = ['', '  ', 'shm', 'shmiel', 'shmuel bleier', 'bleier', 'gluck', '385566',
    '07871385566', '+972', '44', 'chaim@example.com', 'zzz', '7703 572 578']
  for (const q of queries) {
    for (const p of people) {
      assert.equal(clientMatches(q, p), customerMatches(q, p),
        `disagreed on ${JSON.stringify(q)} × ${JSON.stringify(p)}`)
    }
  }
})
