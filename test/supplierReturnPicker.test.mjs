// Returns to supplier: only what the shelf holds, only as many as it holds.
//
// Owner, 23 Aug: "it should only let anything which is already in stock and
// only the amount we have." The old form was a free-text box — a return of six
// phones the shelf never held is a claim the supplier bounces and the count
// cannot absorb. The constraint lives at ENTRY, serialised into the same
// `items` text the API has always stored, so nothing downstream changes.
import test from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const SRC = readFileSync(path.join(import.meta.dirname, '..', 'public/main.js'), 'utf8')
const CODE = SRC.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*|<!--|-->)/.test(l) && !/^\s{10,}\S/.test(l) === false || !/^\s*(\/\/|\*)/.test(l)).join('\n')

test('the picker offers only active items with stock on the shelf', () => {
  assert.match(CODE, /shopItems\.filter\(i => i\.active && \(i\.quantity \|\| 0\) > 0\)/,
    'a retired or sold-out item is not returnable')
})

test('the amount is clamped to the shelf, counting what is already on the return', () => {
  const clamp = CODE.match(/function srPickClamp\(\) \{[\s\S]*?\n\}/)
  assert.ok(clamp, 'srPickClamp missing')
  assert.match(clamp[0], /Math\.min\(Math\.max\(1, v\), Math\.max\(1, max\)\)/)
  const add = CODE.match(/function srPickAdd\(\) \{[\s\S]*?\n\}/)
  assert.ok(add, 'srPickAdd missing')
  assert.match(add[0], /onShelf - \(already \? already\.qty : 0\)/,
    'two lines of 3 against a shelf of 4 is the same over-claim as one line of 6')
})

test('a new return cannot be saved empty, and serialises the lines', () => {
  const save = CODE.match(/async function saveSupplierReturn\(retId\) \{[\s\S]*?\n\}/)
  assert.ok(save, 'saveSupplierReturn missing')
  assert.match(save[0], /if \(!srPicked\.length\)/, 'an empty picker must refuse')
  assert.match(save[0], /srPicked\.map\(l => `\$\{l\.qty\}× \$\{l\.name\}/, 'the lines become the items text')
  assert.match(save[0], /retId \? document\.getElementById\('srItems'\)\.value\.trim\(\) : srItemsText/,
    'edits keep their original free text — the picker is for NEW returns only')
})

test('a fresh return starts with an empty list', () => {
  assert.match(CODE, /if \(!r\) srPicked = \[\];/,
    'lines from the last return must not leak into the next one')
})
