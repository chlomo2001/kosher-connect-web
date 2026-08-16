// One spelling per carrier. Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canonProvider, providerKey, providerNeedsFix, CANON_NAMES } from '../lib/simProvider.mjs'

test('case variants collapse to one spelling', () => {
  assert.equal(canonProvider('lebara'), 'Lebara')
  assert.equal(canonProvider('Lebara'), 'Lebara')
  assert.equal(canonProvider('LEBARA'), 'Lebara')
  assert.equal(canonProvider('three'), 'Three')
  assert.equal(canonProvider('Smarty'), 'Smarty')
  assert.equal(canonProvider('  tello '), 'Tello')
})

test('brand casing is the brand’s, not Title Case', () => {
  // giffgaff and spusu are lowercase brands; 1pMobile has the capital M.
  assert.equal(canonProvider('Giffgaff'), 'giffgaff')
  assert.equal(canonProvider('Spusu'), 'spusu')
  assert.equal(canonProvider('1pmobile'), '1pMobile')
})

test('known typos and redundant suffixes are folded', () => {
  assert.equal(canonProvider('giffgaf'), 'giffgaff')
  assert.equal(canonProvider('giffgaft'), 'giffgaff')
  assert.equal(canonProvider('asda'), 'Asda Mobile')
  assert.equal(canonProvider('asda mobile'), 'Asda Mobile')
  assert.equal(canonProvider('US mobile SIM card'), 'US Mobile')
  assert.equal(canonProvider('redpoced'), 'Red Pocket')
  assert.equal(canonProvider('redpocked'), 'Red Pocket')
})

test('a typo plus real information keeps the information', () => {
  // The counter wrote a second line into the provider field on these two.
  // "US Mobile SIM card" alone is redundant and folds; "+ UK number" is not.
  assert.equal(canonProvider('US Mobile SIM card + UK number'), 'US Mobile SIM card + UK number')
  assert.equal(canonProvider('Three + Israeli number'), 'Three + Israeli number')
})

test('THE SAFETY PROPERTY — a value carrying information is never flattened', () => {
  // These are notes, not carrier names. Folding them into "Lebara" would lose
  // a billed line ("x2"), a plan type, and a migration between carriers.
  for (const v of ['Lebara Local x2', 'Lebara International', 'Lebara .. 1pmobile',
    'GCS336096', 'sichul', 'ukraine 24', 'Bussiness phone system + internet']) {
    assert.equal(canonProvider(v), v)
    assert.equal(providerNeedsFix(v), false)
  }
})

test('empty and missing values pass straight through', () => {
  assert.equal(canonProvider(null), null)
  assert.equal(canonProvider(undefined), undefined)
  assert.equal(canonProvider(''), '')
  assert.equal(providerNeedsFix(null), false)
  assert.equal(providerNeedsFix(''), false)
})

test('providerNeedsFix only fires when the text really changes', () => {
  assert.equal(providerNeedsFix('lebara'), true)
  assert.equal(providerNeedsFix('Lebara'), false)
  assert.equal(providerNeedsFix('giffgaff'), false)
  assert.equal(providerNeedsFix('Red Pocket'), false)
})

test('providerKey ignores case, spaces and punctuation', () => {
  assert.equal(providerKey('Red Pocket'), providerKey('red-pocket'))
  assert.equal(providerKey('UK SIM'), 'uksim')
  assert.equal(providerKey(null), '')
})

test('canonicalising twice changes nothing the second time', () => {
  for (const name of CANON_NAMES) assert.equal(canonProvider(name), name)
})
