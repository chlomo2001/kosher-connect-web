// The stock story — E4: history and discrepancy as a trail, not a number.
//
// The design decision under test: the trail is DERIVED from goods-in lines and
// stock sales, never stored twice. What deriving cannot itemise (hand edits,
// supplier returns) is not hidden — it is the opening figure, said out loud.
// And when the arithmetic is IMPOSSIBLE (a shelf cannot start below zero),
// that is a proven discrepancy, which is the one thing a stored trail could
// not have said with more certainty.
import test from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { buildStockStory, stockStoryLine } from '../lib/stockStory.mjs'

const G = (qty, when = '2026-08-01', supplier = 'Yossi Ltd') => ({ qty, delivery_date: when, supplier })
const S = (qty, when = '2026-08-10', who = 'M. Adler') => ({ qty, created_at: when + 'T10:00:00Z', who })

test('goods in and sales interleave newest first', () => {
  const { moves } = buildStockStory({ quantityNow: 5,
    sales: [S(1, '2026-08-05'), S(2, '2026-08-12')],
    goodsIn: [G(4, '2026-08-01'), G(3, '2026-08-08')] })
  assert.deepEqual(moves.map(m => `${m.when} ${m.kind}${m.qty}`),
    ['2026-08-12 out2', '2026-08-08 in3', '2026-08-05 out1', '2026-08-01 in4'])
})

test('a same-day tie shows the sale above the delivery that made it possible', () => {
  const { moves } = buildStockStory({ quantityNow: 1,
    sales: [S(1, '2026-08-08')], goodsIn: [G(2, '2026-08-08')] })
  assert.deepEqual(moves.map(m => m.kind), ['out', 'in'])
})

test('the opening figure is the honest remainder', () => {
  const st = buildStockStory({ quantityNow: 5, sales: [S(2)], goodsIn: [G(4)] })
  assert.equal(st.opening, 3, '5 now, net +2 recorded → started at 3')
  assert.equal(st.impossible, 0)
  assert.match(stockStoryLine(st, 5), /at 3\./)
  assert.match(stockStoryLine(st, 5), /not\s+itemised/, 'the derivation must confess what it cannot see')
})

test('an impossible opening is a PROVEN discrepancy, and says so', () => {
  // 10 in, 2 out cannot end at 3: at least 5 moved unrecorded.
  const st = buildStockStory({ quantityNow: 3, sales: [S(2)], goodsIn: [G(10)] })
  assert.equal(st.opening, -5)
  assert.equal(st.impossible, 5)
  assert.match(stockStoryLine(st, 3), /do not add up/)
  assert.match(stockStoryLine(st, 3), /at least 5 of movement was never recorded/)
})

test('no records at all is a beginning, not an error', () => {
  const st = buildStockStory({ quantityNow: 7, sales: [], goodsIn: [] })
  assert.equal(st.opening, 7)
  assert.match(stockStoryLine(st, 7), /where the story starts/)
})

test('junk quantities are dropped, not summed as NaN', () => {
  const st = buildStockStory({ quantityNow: 2,
    sales: [S('x'), S(0), S(-3), S(1)], goodsIn: [G(null), G(2)] })
  assert.equal(st.totalOut, 1)
  assert.equal(st.totalIn, 2)
  assert.ok(Number.isFinite(st.opening))
})

// ── the mirror ─────────────────────────────────────────────────────────────
const MAIN = readFileSync(path.join(import.meta.dirname, '..', 'public/main.js'), 'utf8')

function liftMirror() {
  const m = MAIN.match(/\/\/ ── KC_STOCKSTORY mirror start ──\n([\s\S]*?)\n\/\/ ── KC_STOCKSTORY mirror end ──/)
  assert.ok(m, 'KC_STOCKSTORY mirror missing from public/main.js')
  return new Function(`${m[1]}; return KC_STOCKSTORY;`)()
}

test('the mirror in main.js computes exactly what the module computes', () => {
  const B = liftMirror()
  const args = { quantityNow: 3, sales: [S(2, '2026-08-12'), S(4, '2026-08-01')], goodsIn: [G(10, '2026-08-03')] }
  assert.deepEqual(B.buildStockStory(args), buildStockStory(args))
  assert.equal(B.stockStoryLine(B.buildStockStory(args), 3), stockStoryLine(buildStockStory(args), 3))
})

// ── the dialog's manners ───────────────────────────────────────────────────
test('the dialog paints before the network answers, and a late answer cannot lie', () => {
  const MAINSRC = readFileSync(path.join(import.meta.dirname, '..', 'public/main.js'), 'utf8')
  const CODE = MAINSRC.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
  const fn = CODE.match(/async function openStockStory\(itemId\) \{[\s\S]*?\n\}/)
  assert.ok(fn, 'openStockStory not found')
  const shell = fn[0].indexOf('showStackedModal')
  const fetch_ = fn[0].indexOf('kcFetch')
  assert.ok(shell > -1 && fetch_ > -1 && shell < fetch_,
    'the shell must open BEFORE the read — a button that waits on the network reads as dead and gets pressed twice')
  assert.match(fn[0], /body\.dataset\.item !== String\(itemId\)/,
    'a slow answer for item A must never paint itself under item B\u2019s title')
  // STACKED, because the button lives inside the item-edit form: the base
  // dialog would replace that form and take a half-typed quantity with it.
  assert.doesNotMatch(fn[0], /showDynamicModal/,
    'the story must stack OVER the edit form, not replace it')
})
