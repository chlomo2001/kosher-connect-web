// The identity keys and the duplicate finder (port item A2).
import test from 'node:test'
import assert from 'node:assert'
import { personKey, nameKey, findDuplicates, phoneKey } from '../lib/identity.mjs'

// ── personKey — same human, tag and Gmail noise gone ─────────────────────
test('personKey drops the +tag that mailboxKey must keep', () => {
  assert.equal(personKey('shevabruches111+s9@gmail.com'), 'shevabruches111@gmail.com')
  assert.equal(personKey('shevabruches111+s30@gmail.com'), 'shevabruches111@gmail.com')
})

test('personKey strips dots at Gmail only — they are significant elsewhere', () => {
  assert.equal(personKey('e.a.rothbart@gmail.com'), 'earothbart@gmail.com')
  assert.equal(personKey('e.a.rothbart@googlemail.com'), 'earothbart@gmail.com')
  assert.equal(personKey('john.smith@company.co.uk'), 'john.smith@company.co.uk')
})

test('personKey handles header forms and refuses non-addresses', () => {
  assert.equal(personKey('Gitt Bilig <gitt.bilig+m@gmail.com>'), 'gittbilig@gmail.com')
  assert.equal(personKey('not an email'), null)
  assert.equal(personKey(''), null)
})

// ── nameKey — written-name equality across word order ────────────────────
test('nameKey meets transliterated names whichever way round they arrive', () => {
  assert.equal(nameKey('Mordche Grunfeld'), nameKey('Grunfeld, Mordche'))
  assert.equal(nameKey('GRUNFELD MORDCHE'), 'grunfeld mordche')
  assert.equal(nameKey('Mendl-Hersh  Grinfeld'), 'grinfeld hersh mendl')
})

test('nameKey does not bridge different spellings — that is a matcher, not a key', () => {
  assert.notEqual(nameKey('Mordche Grunfeld'), nameKey('Mordechai Grunfeld'))
})

test('nameKey survives empties and diacritics', () => {
  assert.equal(nameKey(''), '')
  assert.equal(nameKey('  ,  '), '')
  assert.equal(nameKey('José Ángel'), 'angel jose')
})

// ── findDuplicates — confidence shaped for a family-phone community ──────
const C = (id, over = {}) => ({ id, firstName: 'A', lastName: `Person${id}`, phone: '', email: '', ...over })

test('a shared phone alone is MEDIUM — one family phone serves several real customers', () => {
  const pairs = findDuplicates([
    C('1', { firstName: 'Mayer', lastName: 'Kraus', phone: '07807 263476' }),
    C('2', { firstName: 'Rivka', lastName: 'Kraus', phone: '+447807263476' }),
  ])
  assert.equal(pairs.length, 1)
  assert.equal(pairs[0].confidence, 'medium')
  assert.deepEqual(pairs[0].reasons, ['same phone number'])
})

test('name alone is LOW; name plus a contact signal is HIGH', () => {
  const nameOnly = findDuplicates([
    C('1', { firstName: 'Mordche', lastName: 'Grunfeld' }),
    C('2', { firstName: 'Grunfeld', lastName: 'Mordche' }),
  ])
  assert.equal(nameOnly[0].confidence, 'low')

  const nameAndEmail = findDuplicates([
    C('1', { firstName: 'Mordche', lastName: 'Grunfeld', email: 'm.grunfeld@gmail.com' }),
    C('2', { firstName: 'Grunfeld', lastName: 'Mordche', email: 'mgrunfeld+sim2@gmail.com' }),
  ])
  assert.equal(nameAndEmail[0].confidence, 'high')
  assert.equal(nameAndEmail[0].reasons.length, 2)
})

test('the alt phone counts, and 07/+44 forms meet through phoneKey', () => {
  const pairs = findDuplicates([
    C('1', { phone: '07911 123456' }),
    C('2', { phone: '0161 531 1386', altPhone: '+44 7911 123456' }),
  ])
  assert.equal(pairs.length, 1)
  assert.equal(phoneKey('07911 123456'), phoneKey('+44 7911 123456'))
})

test('strangers produce no pairs, and empty input is safe', () => {
  assert.deepEqual(findDuplicates([]), [])
  assert.deepEqual(findDuplicates([
    C('1', { firstName: 'Shloime', lastName: 'W', phone: '07700 900001', email: 'a@b.com' }),
    C('2', { firstName: 'Yossi', lastName: 'K', phone: '07700 900002', email: 'c@d.com' }),
  ]), [])
})

test('three customers on one phone pair up pairwise, high first in the ordering', () => {
  const pairs = findDuplicates([
    C('1', { phone: '07700 900123' }),
    C('2', { phone: '07700 900123' }),
    C('3', { phone: '07700 900123', firstName: 'A', lastName: 'Person1' }),   // also name-matches 1
  ])
  assert.equal(pairs.length, 3)
  assert.equal(pairs[0].confidence, 'high')       // 1↔3: phone + name
  assert.ok(pairs.slice(1).every(p => p.confidence === 'medium'))
})

test('a short or empty phone never becomes a bucket', () => {
  assert.deepEqual(findDuplicates([C('1', { phone: '123' }), C('2', { phone: '123' })]), [])
})
