import test from 'node:test'
import assert from 'node:assert'
import { parseMRZ } from '../lib/mrz.mjs'

test('parses a clean TD3 passport MRZ', () => {
  const m = parseMRZ(`PASSPORT PHOTO PAGE NOISE
P<GBRROTHBART<<OSHER<CHAIM<<<<<<<<<<<<<<<<<<
1234567897GBR8501017M3006157<<<<<<<<<<<<<<02`)
  assert.ok(m)
  assert.equal(m.surname, 'ROTHBART')
  assert.equal(m.givenNames, 'OSHER CHAIM')
  assert.equal(m.passportNumber, '123456789')
  assert.equal(m.dob, '1985-01-01')
  assert.equal(m.expiry, '2030-06-15')
  assert.equal(m.sex, 'M')
})

test('survives OCR noise: lowercase, stray spaces, O/0 confusion', () => {
  const m = parseMRZ(`p<gbrkohn<<duvid<tsvi<<<<<<<<<<<<<<<<<<<<<<<
  98 7654321 2GBR 9OO215 8 F 28O1O1 2<<<<<<<<<<<<<< 04`)
  assert.ok(m)
  assert.equal(m.surname, 'KOHN')
  assert.equal(m.givenNames, 'DUVID TSVI')
  assert.equal(m.dob, '1990-02-15')
  assert.equal(m.expiry, '2028-01-01')
})

test('birth years pivot to the right century', () => {
  const m = parseMRZ(`P<GBRSMITH<<ANNA<<<<<<<<<<<<<<<<<<<<<<<<<<<<
1234567897GBR2201017F3006157<<<<<<<<<<<<<<02`)
  assert.equal(m.dob, '2022-01-01') // 22 ≤ current YY → a child, not 1922
})

test('returns null on non-passport text', () => {
  assert.equal(parseMRZ('Invoice\nTotal £40.00\nThank you'), null)
  assert.equal(parseMRZ(''), null)
})
