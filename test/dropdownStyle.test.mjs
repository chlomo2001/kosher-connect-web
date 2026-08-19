// One dropdown look, everywhere (owner #10, 19 August).
//
// There were three: .form-input on the 60 selects across forms and filter bars,
// .country-select on the dialling-code box, and .task-mini on a task's priority
// and postpone. .task-mini was the odd one three separate ways — a different
// border token, a different corner radius, and no focus style at all beyond a
// hover, so somebody driving the task list by keyboard could not see where they
// were.
//
// It is fixed, and this is here so it stays fixed: the drift happened once by
// each variant quietly growing its own look, and nothing would have caught it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const CSS = readFileSync(new URL('../styles/app.css', import.meta.url), 'utf8')
const FAMILIES = ['select.form-input', '.country-select', '.task-mini']

/** The rule that states the shared look, whatever order the selectors are in. */
function sharedRule(pseudo = '') {
  const want = FAMILIES.map((f) => f + pseudo)
  return CSS.split('}').find((block) => want.every((sel) => block.includes(sel)))
}

test('all three dropdown families share one look', () => {
  const rule = sharedRule()
  assert.ok(rule, 'no single rule styles all three — that is how they drifted apart the first time')
  // The properties that were actually different, named so a future edit that
  // pulls one of them back out fails here rather than on somebody's screen.
  for (const prop of ['background', 'border', 'border-radius', 'color']) {
    assert.match(rule, new RegExp(`\\b${prop}\\s*:`), `the shared rule does not set ${prop}`)
  }
})

test('all three get the same focus ring', () => {
  // .task-mini had none at all. A dropdown you can tab to and cannot see is
  // the accessibility half of this item, and it is the half that would be
  // dropped quietly if only the colours were checked.
  const rule = sharedRule(':focus-visible') || sharedRule(':focus')
  assert.ok(rule, 'the three do not share a focus style')
  assert.match(rule, /box-shadow\s*:\s*var\(--ring\)/,
    'focus must use the same ring as the rest of the app')
})

test('a variant may change its size, not its look', () => {
  // .task-mini legitimately differs in one way: it sits in a list row, not on
  // a form, so it is smaller. That is size, not identity.
  // Split on '}' leaves the preceding comment attached to each chunk, so the
  // selector is whatever sits between the last '*/' or newline and the '{'.
  const mini = CSS.split('}')
    .map((b) => {
      const at = b.indexOf('{')
      if (at < 0) return null
      const sel = b.slice(0, at).replace(/\/\*[\s\S]*?\*\//g, '').trim()
      return { sel, body: b.slice(at + 1) }
    })
    .find((r) => r && r.sel === '.task-mini' && r.body.includes('font-size'))
  assert.ok(mini, '.task-mini should still set its own size')
  for (const banned of ['border-radius', 'background', 'border:']) {
    assert.ok(!mini.body.includes(banned), `.task-mini has taken back its own ${banned}`)
  }
})
