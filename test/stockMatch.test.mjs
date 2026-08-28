// Which stock item a delivery line is about, and the browser copy of it.
//
// The case that started this, read from production on 28 Aug: the shop has
// recorded exactly one delivery, `goods_in_lines` holds exactly one row, and
// its `item_id` is null. The description on it is "QLYX Q8" and there is a
// stock item whose company is QLYX and whose model is Q8. The app held the
// answer and never offered it, because the picker's first option is "Not in
// stock list" and that is what the default does.
//
// The cost of that null was silent and double: /api/goods-in skips the
// quantity bump on a line with no item_id, so a recorded delivery left the
// shelf untouched; and lib/stockStory.mjs derives "in" from item_id, so the
// one delivery this shop has ever recorded was invisible on the screen built
// to show deliveries.
//
// The rule this file defends is the one that keeps the fix safe: EXACT, and
// never ambiguous. A wrong link moves the wrong shelf and prices the wrong
// item — worse than no link, because the operator can always pick by hand.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { matchStockItem, normaliseStockText, stockItemNames } from '../lib/stockMatch.mjs'

const SRC = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')
const lift = () => {
  const m = SRC.match(/\/\/ ── KC_STOCKMATCH mirror start ──\n([\s\S]*?)\n\/\/ ── KC_STOCKMATCH mirror end ──/)
  assert.ok(m, 'KC_STOCKMATCH mirror region not found in public/main.js')
  return new Function(`${m[1]}; return KC_STOCKMATCH;`)()
}

// Production's own stock list, near enough: item_code on most, a company on
// one, two retired rows, and the duplicate-model pair that must refuse.
const ITEMS = [
  { id: 'q8', company: 'QLYX', model: 'Q8', item_code: null, active: true },
  { id: 'n105', company: null, model: 'Nokia 105', item_code: 'PH-08', active: true },
  { id: 'mini2', company: null, model: 'Mini 2 SIM', item_code: 'PH-13', active: true },
  { id: 'figcore', company: null, model: 'FIG Core', item_code: 'PH-02', active: true },
  { id: 'old', company: null, model: 'TCL 4042', item_code: 'PH-10', active: false },
  { id: 'cros1', company: null, model: 'Croscall', item_code: 'PH-04', active: true },
  { id: 'cros2', company: null, model: 'Croscall', item_code: null, active: true },
]

const TEXTS = [
  'QLYX Q8', 'qlyx q8', 'qlyx-q8', ' QLYX   Q8 ', 'QLYX_Q8',
  'Nokia 105', 'nokia105', 'PH-08', 'ph 08', 'PH-13',
  'Croscall', 'TCL 4042', 'FIG Core', 'fig  core',
  'Q8', 'QLYX', 'a case of chargers', '', '   ', null, undefined, 12345,
]

test('the browser mirror matches exactly what the lib matches', () => {
  const B = lift()
  for (const t of TEXTS) {
    const mine = B.matchStockItem(t, ITEMS)
    const theirs = matchStockItem(t, ITEMS)
    assert.equal(mine ? mine.id : mine, theirs ? theirs.id : theirs, JSON.stringify(t))
    assert.equal(B.normaliseStockText(t), normaliseStockText(t), JSON.stringify(t))
  }
  for (const i of ITEMS) assert.deepEqual(B.stockItemNames(i), stockItemNames(i), i.id)
})

test('the production case: "QLYX Q8" finds the QLYX Q8', () => {
  assert.equal(matchStockItem('QLYX Q8', ITEMS).id, 'q8')
})

test('case, spacing and punctuation are noise', () => {
  for (const t of ['qlyx q8', 'QLYX-Q8', ' QLYX   Q8 ', 'QLYX_Q8', 'qlyx.q8']) {
    assert.equal(matchStockItem(t, ITEMS)?.id, 'q8', t)
  }
})

test('an item answers to its code as well as its name', () => {
  assert.equal(matchStockItem('PH-08', ITEMS).id, 'n105')
  assert.equal(matchStockItem('ph 08', ITEMS).id, 'n105')
})

test('two items sharing a name refuse rather than pick one', () => {
  // The case a confident guess gets most wrong. Production carries exactly this
  // pair — two Croscall rows, one with a code and one without.
  assert.equal(matchStockItem('Croscall', ITEMS), null)
})

test('a retired item is never matched', () => {
  // A line arriving for something the shop has stopped selling is a question,
  // not an answer.
  assert.equal(matchStockItem('TCL 4042', ITEMS), null)
})

test('half a name is not a name', () => {
  // No stemming, no prefix matching, no edit distance: every one of those
  // invents a match the typist did not make.
  assert.equal(matchStockItem('QLYX', ITEMS), null)
  assert.equal(matchStockItem('Nokia', ITEMS), null)
  assert.equal(matchStockItem('Nokia 1050', ITEMS), null)
  assert.equal(matchStockItem('Mini 2', ITEMS), null)
})

test('the model on its own IS one of the item\'s names', () => {
  // Not the same thing as a prefix. "Q8" is the QLYX Q8's model field entire,
  // and an invoice line saying "Q8" is a person naming that item — so it
  // matches, exactly like "Nokia 105" does for the item whose whole name is
  // its model.
  assert.equal(matchStockItem('Q8', ITEMS).id, 'q8')
  assert.equal(matchStockItem('Nokia 105', ITEMS).id, 'n105')
})

test('a model shared by two companies refuses, as ambiguity should', () => {
  // The reason the line above is safe. A bare model is a weaker name than a
  // company-and-model, and the moment two brands share one the answer stops
  // being knowable — so it is not guessed.
  const clash = [...ITEMS,
    { id: 'other-q8', company: 'Sunbeam', model: 'Q8', item_code: 'PH-99', active: true }]
  assert.equal(matchStockItem('Q8', clash), null)
  // …and the full name still resolves, because only one item carries it.
  assert.equal(matchStockItem('QLYX Q8', clash).id, 'q8')
  assert.equal(matchStockItem('Sunbeam Q8', clash).id, 'other-q8')
})

test('nothing typed matches nothing', () => {
  for (const t of ['', '   ', null, undefined, '---']) assert.equal(matchStockItem(t, ITEMS), null)
})

test('an empty or missing stock list does not throw', () => {
  assert.equal(matchStockItem('QLYX Q8', []), null)
  assert.equal(matchStockItem('QLYX Q8', null), null)
  assert.equal(matchStockItem('QLYX Q8', [null, undefined]), null)
})

// The two consequences that make this worth having at all. Both are one line
// of source each and both have been wrong in production.
test('an unlinked line still moves no stock, and the save says so', () => {
  const api = readFileSync(new URL('../pages/api/goods-in.js', import.meta.url), 'utf8')
  assert.match(api, /if \(!l\.item_id\) continue/, 'the quantity bump no longer skips unlinked lines')
  assert.match(api, /const unlinked = lines\.filter\(\(l\) => !l\.item_id\)/,
    'the save no longer reports which lines were left unlinked')
  assert.match(SRC, /res\.unlinked && res\.unlinked\.length/,
    'the counter no longer tells anybody a delivery changed no stock')
})

test('a deliberate answer in the picker is never overwritten by typing', () => {
  // Including "not in the stock list", which is a real answer. Typing after
  // that must not quietly re-link the line.
  assert.match(SRC, /if \(sel\.dataset\.touched === '1'\)/)
  assert.match(SRC, /sel\.dataset\.touched = '1'/)
})
