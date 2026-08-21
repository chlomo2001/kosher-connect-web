// "12 of 797" beside a list.
//
// From the 2026-07-17 idea-hunt, and re-argued by the Epos Now read: a filtered
// list and an empty list look identical, and this shop's lists are big enough
// for that to matter — 797 SIMs, 788 customers, 214 rentals. Somebody who types
// a name and sees three rows cannot tell whether three matched or whether the
// list failed to load.
//
// The SIM tab and the Shop tab had each grown their own copy of the line. Four
// other lists had nothing. This is the same line, once.
import test from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const SRC = readFileSync(path.join(import.meta.dirname, '..', 'public/main.js'), 'utf8')

function lift() {
  const m = SRC.match(/function kcListCount\(el, shown, total, noun\)[\s\S]*?\n\}/)
  assert.ok(m, 'kcListCount not found')
  // A DOM stub that records what was written, and answers for a missing node.
  const nodes = new Map()
  const document = {
    getElementById: (id) => nodes.get(id) || null,
    _add: (id) => { const n = { id, textContent: '' }; nodes.set(id, n); return n },
  }
  const fn = new Function('document', `${m[0]}; return kcListCount;`)(document)
  return { fn, document }
}

const { fn, document } = lift()
const node = document._add('list')

test('a filtered list says how much it is showing', () => {
  fn('list', 12, 797)
  assert.equal(node.textContent, '12 of 797')
})

test('an unfiltered list just says how many there are', () => {
  // "797 of 797" is noise: the reader can see the list is whole.
  fn('list', 797, 797)
  assert.equal(node.textContent, '797')
  // …and names its unit where the list has one worth naming.
  fn('list', 12, 12, 'item')
  assert.equal(node.textContent, '12 items')
  fn('list', 1, 1, 'item')
  assert.equal(node.textContent, '1 item')
  // Filtered, the noun gives way to the comparison.
  fn('list', 3, 12, 'item')
  assert.equal(node.textContent, '3 of 12')
})

test('nothing matched still says what was searched', () => {
  // The important one. "0 of 797" is the difference between "your search found
  // nothing" and "the list failed to load".
  fn('list', 0, 797)
  assert.equal(node.textContent, '0 of 797')
})

test('an empty list says nothing alarming', () => {
  fn('list', 0, 0)
  assert.equal(node.textContent, '0')
})

test('a missing element is not an error', () => {
  assert.doesNotThrow(() => fn('nope', 1, 2))
  assert.doesNotThrow(() => fn(null, 1, 2))
})

test('an element can be passed directly, not only by id', () => {
  const direct = { textContent: '' }
  fn(direct, 3, 9)
  assert.equal(direct.textContent, '3 of 9')
})

// ── the lists that carry it ────────────────────────────────────────────────

test('every big list has a count, and none of them rolls its own', () => {
  for (const [id, why] of [
    ['custCount', 'Customer List'],
    ['rentalCount', 'Active & Recent Rentals'],
    ['phoneCount', 'Phone Inventory'],
    ['simCount', 'SIM plans'],
  ]) {
    assert.match(SRC, new RegExp(`id="${id}"`), `${why} has no count element`)
    assert.match(SRC, new RegExp(`kcListCount\\((?:'${id}'|countEl)`), `${why} never fills it`)
  }
  // The string lives in one place. Two lists had grown their own copy before.
  // Toasts are excluded: "3 of 5 created — 2 failed" is a sentence about a job,
  // not a list count, and the first version of this check flagged it.
  const strays = SRC.split('\n')
    .filter((l) => /\$\{[\w.]+\.length\} of \$\{[\w.]+\.length\}/.test(l))
    .filter((l) => !/toast\(/.test(l))
  assert.deepEqual(strays, [], `a list is still wording this itself:\n  ${strays.join('\n  ')}`)
})

test('the rentals count is set before the empty-state returns', () => {
  // Otherwise filtering down to nothing leaves the previous number on screen —
  // the one moment the count is most worth reading.
  const fnSrc = SRC.slice(SRC.indexOf('function renderRentalRows()'))
  const body = fnSrc.slice(0, fnSrc.indexOf('\n}\n'))
  const count = body.indexOf("kcListCount('rentalCount'")
  const empty = body.indexOf('if (filtered.length === 0)')
  assert.ok(count > 0 && empty > 0, 'shape changed')
  assert.ok(count < empty, 'the count is set after the early return, so 0 never shows')
})

test('the customer count is against the whole book', () => {
  // filteredCustomers is already a search result; counting against it would
  // say "12 of 12" and answer nothing.
  assert.match(SRC, /kcListCount\('custCount', shown\.length, customers\.length\)/)
})
