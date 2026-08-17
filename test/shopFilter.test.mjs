import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchStockItem, filterStock, stockBrands, facetsActive, stockHaystack } from '../lib/shopFilter.mjs'

const SHELF = [
  { id: '1', company: 'Samsung', model: 'A20 case', code: 'CS-A20', barcode: '5012345678900', category: 'accessory' },
  { id: '2', company: 'Samsung', model: 'A10 case', code: 'CS-A10', category: 'accessory' },
  { id: '3', company: 'Anker', model: 'Charger 20W', code: 'CH-20', category: 'accessory' },
  { id: '4', company: '', model: 'Nokia 105', code: 'PH-105', category: 'phone' },
  { id: '5', company: 'Lebara', model: 'SIM pack', code: 'SIM-1', category: 'sim' },
]

test('an empty facet narrows nothing — the default must never hide stock', () => {
  assert.equal(filterStock(SHELF, {}).length, 5)
  assert.equal(filterStock(SHELF, { q: '', category: 'all', brand: 'all' }).length, 5)
  assert.equal(filterStock(SHELF).length, 5)
  assert.equal(filterStock(SHELF, null).length, 5)
})

test('text matches brand, model, code and barcode alike', () => {
  assert.deepEqual(filterStock(SHELF, { q: 'anker' }).map(i => i.id), ['3'])
  assert.deepEqual(filterStock(SHELF, { q: 'nokia' }).map(i => i.id), ['4'])
  assert.deepEqual(filterStock(SHELF, { q: 'ch-20' }).map(i => i.id), ['3'])
  assert.deepEqual(filterStock(SHELF, { q: '5012345678900' }).map(i => i.id), ['1'])
})

test('words are ANDed and order-free — "sam 20" is the A20, not the A10', () => {
  assert.deepEqual(filterStock(SHELF, { q: 'sam 20' }).map(i => i.id), ['1'])
  assert.deepEqual(filterStock(SHELF, { q: '20 sam' }).map(i => i.id), ['1'])
  assert.deepEqual(filterStock(SHELF, { q: 'samsung case' }).map(i => i.id), ['1', '2'])
})

test('category and brand narrow, and stack with the text', () => {
  assert.deepEqual(filterStock(SHELF, { category: 'phone' }).map(i => i.id), ['4'])
  assert.deepEqual(filterStock(SHELF, { brand: 'Samsung' }).map(i => i.id), ['1', '2'])
  assert.deepEqual(filterStock(SHELF, { brand: 'Samsung', q: 'a10' }).map(i => i.id), ['2'])
  assert.deepEqual(filterStock(SHELF, { brand: 'Samsung', category: 'phone' }).map(i => i.id), [])
})

test('the brand list holds only brands that exist, sorted and unique', () => {
  assert.deepEqual(stockBrands(SHELF), ['Anker', 'Lebara', 'Samsung'])
  assert.deepEqual(stockBrands([]), [])
  assert.deepEqual(stockBrands([{ company: '  ' }, { company: null }]), [])
})

test('facetsActive drives the clear affordance', () => {
  assert.equal(facetsActive({}), false)
  assert.equal(facetsActive({ q: '   ' }), false)
  assert.equal(facetsActive({ q: 'a' }), true)
  assert.equal(facetsActive({ category: 'phone' }), true)
  assert.equal(facetsActive({ brand: 'Anker' }), true)
})

test('an item with missing fields is matched on what it does have, not skipped', () => {
  assert.equal(matchStockItem({ model: 'Loose item' }, { q: 'loose' }), true)
  assert.equal(matchStockItem({}, {}), true)
  assert.equal(stockHaystack({}), '')
})

test('filtering never mutates the shelf', () => {
  const before = JSON.stringify(SHELF)
  filterStock(SHELF, { q: 'sam', brand: 'Samsung' })
  assert.equal(JSON.stringify(SHELF), before)
})
