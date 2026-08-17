// A sparkline is a small claim with a large failure mode: scaled from its own
// minimum instead of zero, a flat week becomes a dramatic climb. These tests
// are mostly about that.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sparklinePath, sparklineLabel } from '../lib/sparkline.mjs'

test('nothing in, nothing drawn — never an empty axis reading as zero every day', () => {
  for (const v of [[], null, undefined, 'nope']) {
    const s = sparklinePath(v)
    assert.equal(s.d, '')
    assert.deepEqual(s.dots, [])
    assert.equal(s.count, 0)
  }
})

test('the baseline is zero, not the minimum', () => {
  // 120,125,130 is a flat week. Scaled from its own low it would climb from the
  // floor to the ceiling; from zero it stays in the top of the box, barely moving.
  const s = sparklinePath([120, 125, 130], { width: 100, height: 30, pad: 2 })
  const ys = s.d.match(/[ML][\d.]+ ([\d.]+)/g).map(m => Number(m.split(' ')[1]))
  const spread = Math.max(...ys) - Math.min(...ys)
  assert.ok(spread < 6, `a flat week moved ${spread}px — it is being scaled from its minimum`)
})

test('a real climb does use the box', () => {
  const s = sparklinePath([0, 50, 100], { width: 100, height: 30, pad: 2 })
  const ys = s.d.match(/[ML][\d.]+ ([\d.]+)/g).map(m => Number(m.split(' ')[1]))
  assert.ok(Math.max(...ys) - Math.min(...ys) > 20)
})

test('an all-zero week is a flat line on the floor, not a crash', () => {
  const s = sparklinePath([0, 0, 0, 0])
  assert.match(s.d, /^M0 26 L/)
  const ys = s.d.match(/[ML][\d.]+ ([\d.]+)/g).map(m => Number(m.split(' ')[1]))
  assert.equal(new Set(ys).size, 1)
})

test('one day is a dot, because nothing can be inferred from one day', () => {
  const s = sparklinePath([42], { width: 120 })
  assert.equal(s.d, '')
  assert.equal(s.dots.length, 1)
  assert.equal(s.dots[0].x, 60)
})

test('the last point is marked, so "today" can be shown', () => {
  const s = sparklinePath([1, 2, 3, 9], { width: 120, height: 28 })
  assert.equal(s.dots.length, 1)
  assert.equal(s.dots[0].x, 120)          // hard right
  assert.equal(s.last, 9)
  assert.equal(s.first, 1)
  assert.equal(s.count, 4)
})

test('the path stays inside its box', () => {
  const s = sparklinePath([5, 0, 90, 12, 60], { width: 200, height: 40, pad: 3 })
  const nums = s.d.match(/[\d.]+/g).map(Number)
  const xs = nums.filter((_, i) => i % 2 === 0)
  const ys = nums.filter((_, i) => i % 2 === 1)
  assert.ok(Math.min(...xs) >= 0 && Math.max(...xs) <= 200)
  assert.ok(Math.min(...ys) >= 3 && Math.max(...ys) <= 37)
})

test('rubbish values are dropped rather than poisoning the scale', () => {
  const s = sparklinePath([10, NaN, 20, null, 'x', 30])
  assert.equal(s.count, 6)   // coerced to 0, kept in place — a gap is a real day
  assert.equal(s.max, 30)
})

test('the label says what the picture shows', () => {
  assert.match(sparklineLabel([10, 20, 30], { unit: '£' }), /3 days, £60 in total, best day £30/)
  assert.equal(sparklineLabel([]), 'No data yet')
})

// ── the browser copy ──────────────────────────────────────────────────────
// public/main.js cannot import, so it keeps a mirror. Same arrangement as
// phoneProblem: lift it out, run it, hold it to the lib's answers.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = readFileSync(path.join(ROOT, 'public/main.js'), 'utf8')

test('public/main.js sparklinePath agrees with lib/sparkline', () => {
  const src = (SRC.match(/function sparklinePath\s*\([^)]*\)\s*\{[\s\S]*?\n\}/) || [])[0]
  assert.ok(src, 'public/main.js must define its sparklinePath mirror')
  // eslint-disable-next-line no-new-func
  const client = new Function(`${src}; return sparklinePath`)()
  for (const values of [[], [5], [0, 0, 0], [120, 125, 130], [0, 50, 100], [3, 1, 4, 1, 5, 9, 2, 6]]) {
    for (const opts of [undefined, { width: 200, height: 40, pad: 3 }]) {
      assert.deepEqual(client(values, opts), sparklinePath(values, opts),
        `drifted on ${JSON.stringify(values)} ${JSON.stringify(opts)}`)
    }
  }
})
