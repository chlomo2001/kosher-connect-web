// The common-jobs strip — derived, or it does not exist.
//
// Virtual Mail's navigation map opens with "Common shortcuts" before the full
// key-by-key reference; /manual now opens the same way, with the jobs the ❓
// guides already walk through. The one rule that matters: the strip is DRAWN
// FROM lib/guides.mjs at render. A pasted copy of a question would be the
// fifth two-answers-to-one-fact bug in a week, so the test's job is to make a
// paste impossible to ship.
import test from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { GUIDES } from '../lib/guides.mjs'

const ROOT = path.join(import.meta.dirname, '..')
const PAGE = readFileSync(path.join(ROOT, 'pages/manual.js'), 'utf8')
const CSS = readFileSync(path.join(ROOT, 'styles/app.css'), 'utf8')

test('the strip renders the guides, not a copy of them', () => {
  assert.match(PAGE, /import \{ GUIDES \} from '\.\.\/lib\/guides\.mjs'/)
  assert.match(PAGE, /GUIDES\.map\(/, 'the questions must be interpolated, not typed')
  assert.match(PAGE, /\{GUIDES\.length\}/, 'the count must be live — "these 20" goes stale the day a guide lands')
  for (const g of GUIDES) {
    assert.ok(!PAGE.includes(g.q), `a guide question is pasted into the page: "${g.q}"`)
  }
})

test('every guide still has a question the strip can show', () => {
  for (const g of GUIDES) {
    assert.ok(g.q && g.q.length > 8 && g.q.endsWith('?'), `guide ${g.id} has no readable question`)
  }
})

test('hidden in print, like the contents and for the same reason', () => {
  assert.match(CSS, /\.kc-man-chrome, \.kc-man-toc, \.kc-man-jobs \{ display: none; \}/,
    'on paper the strip points at a button paper does not have')
})
