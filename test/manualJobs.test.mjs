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

test('a question opens into its steps — interpolated, never pasted', () => {
  // 23 Aug: the strip's questions became <details> that open into the guide's
  // own steps. Same law as the questions: rendered from GUIDES, so the steps
  // shown here and the steps the ❓ button walks are one copy shown twice.
  assert.match(PAGE, /<details key=\{g\.id\} className="kc-man-job">/)
  assert.match(PAGE, /g\.steps\.map\(/, 'the steps must be interpolated from the guide')
  for (const g of GUIDES) {
    for (const st of g.steps) {
      assert.ok(!PAGE.includes(st), `a guide step is pasted into the page: "${st.slice(0, 50)}"`)
    }
  }
  // The affordance is visible: the summary dresses as a link with a chevron.
  assert.match(CSS, /\.kc-man-job > summary \{[^}]*cursor: pointer/s)
  assert.match(CSS, /\.kc-man-job > summary::before \{ content: '▸'/)
})

test('every guide still has a question the strip can show', () => {
  for (const g of GUIDES) {
    assert.ok(g.q && g.q.length > 8 && g.q.endsWith('?'), `guide ${g.id} has no readable question`)
  }
})

test('hidden in print, like the contents and for the same reason', () => {
  assert.match(CSS, /\.kc-man-chrome, \.kc-man-toc, \.kc-man-jobs, \.kc-man-filter \{ display: none; \}/,
    'on paper the strip points at a button paper does not have')
})

test('on a phone the strip is bounded, so it cannot bury the contents', () => {
  // At 320px the twenty questions rendered as a single-column wall a screen
  // and a half tall, with the Contents — the page's own navigation — below
  // it. The list scrolls in place instead: the house rule for wide content,
  // applied downward.
  assert.match(CSS, /@media \(max-width: 560px\) \{\s*\.kc-man-jobs \.kc-man-toc-grid \{[^}]*max-height/s,
    'the narrow-screen bound is gone — twenty questions will wall off the contents again')
  assert.match(CSS, /\.kc-man-jobs \.kc-man-toc-grid \{[^}]*overflow-y: auto/s,
    'bounded but not scrollable is fifteen hidden questions')
})
