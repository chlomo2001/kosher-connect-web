// The low-stock task — the push half of the badge that already existed.
//
// Source-shape tests, the sweep's own style: the rule must be THE DASHBOARD'S
// RULE verbatim, the task must be reference-keyed so it cannot duplicate, and
// recovery must close it — a task that survives its own fix is clutter that
// teaches people to ignore the list.
import test from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { GROUPS, groupOf } from '../lib/dailyDigest.mjs'

const ROOT = path.join(import.meta.dirname, '..')
const SWEEP = readFileSync(path.join(ROOT, 'pages/api/cron/sweep.js'), 'utf8')
const MAIN = readFileSync(path.join(ROOT, 'public/main.js'), 'utf8')
const CODE = SWEEP.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')

test('the sweep raises and closes STOCKLOW by reference', () => {
  assert.match(CODE, /reference: `STOCKLOW-\$\{i\.id\}`/, 'the task must be keyed to the item')
  assert.match(CODE, /reference=like\.STOCKLOW-\*/, 'a closing pass must exist')
  assert.match(CODE, /closeOpenTask\(t\.reference\)/, 'recovery must close the task')
})

test('the rule is the dashboard’s rule, not a second answer', () => {
  // Dashboard (public/main.js): active && quantity <= lowStockAt.
  assert.match(MAIN, /i\.active && i\.quantity <= i\.lowStockAt/,
    'the dashboard rule moved — update this test AND the sweep together')
  assert.match(CODE, /\(i\.quantity \?\? 0\) > \(i\.low_stock_at \?\? 1\)/,
    'the sweep must skip items ABOVE the warn level and raise at-or-below — the dashboard comparison, inverted')
  assert.match(CODE, /active=is\.true/, 'retired items must not nag')
})

test('the digest has a home for it, so it survives into the morning email', () => {
  assert.equal(groupOf('STOCKLOW-abc'), 'STOCKLOW')
  const g = GROUPS.find(([k]) => k === 'STOCKLOW')
  assert.ok(g, 'no STOCKLOW group in the digest')
  assert.ok(g[1].length > 3 && !/^[A-Z]+$/.test(g[1]), 'the group title must be words')
})
