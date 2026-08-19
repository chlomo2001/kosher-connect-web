// The browser copy of the next-action decision, held to lib/nextAction.mjs —
// and the check that makes rule 2 enforceable rather than aspirational: every
// action a screen can NAME must exist in the table of what actions DO.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { screenNextAction, SCREENS, allActionKeys } from '../lib/nextAction.mjs'

const SRC = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')

function liftMirror() {
  const m = SRC.match(/\/\/ ── KC_NEXT mirror start ──\n([\s\S]*?)\n\/\/ ── KC_NEXT mirror end ──/)
  assert.ok(m, 'KC_NEXT mirror region not found in public/main.js')
  return new Function(`${m[1]}; return KC_NEXT;`)()
}

/** The keys of KC_NEXT_DO. Read as text: its values call browser functions. */
function doKeys() {
  const m = SRC.match(/const KC_NEXT_DO = \{([\s\S]*?)\n\};/)
  assert.ok(m, 'KC_NEXT_DO not found in public/main.js')
  return [...m[1].matchAll(/^\s*'([^']+)':/gm)].map((x) => x[1])
}

// Enough combinations to reach every branch of every screen, including the
// second one that only appears when the first has gone quiet.
const FACTS = [
  {},
  { overdueRentals: 3 }, { overdueRentals: 1 }, { dueTodayRentals: 2 },
  { overdueRentals: 2, dueTodayRentals: 5 },
  { readyRepairs: 1 }, { readyRepairs: 6 }, { lateRenewals: 1 }, { lateRenewals: 4 },
  { dueTasks: 1 }, { dueTasks: 3, highTasks: 1 }, { mailPending: 2 },
  { unreachable: 57 }, { needCheckIn: 1 }, { unparsedTickets: 2 },
  { needCheckIn: 1, unparsedTickets: 2 },
  { arrears: 1 }, { arrears: 12 }, { lowStock: 3 }, { openReturns: 2 },
  { lowStock: 3, openReturns: 2 }, { unconfirmed: 1861 },
  { overdueRentals: 1, readyRepairs: 1, lateRenewals: 1, dueTasks: 1, mailPending: 1 },
]

test('the browser mirror decides exactly what the lib decides', () => {
  const B = liftMirror()
  assert.deepEqual(B.SCREENS, SCREENS, 'the two disagree about which screens exist')
  for (const screen of SCREENS) {
    for (const f of FACTS) {
      assert.deepEqual(B.screenNextAction(screen, f), screenNextAction(screen, f),
        `${screen} differs for ${JSON.stringify(f)}`)
    }
  }
})

test('the mirror refuses a broken row the same way the lib does', () => {
  const B = liftMirror()
  assert.throws(() => B.nextAction({ text: 'Chase them', label: 'Go' }), /offers no way/)
  assert.throws(() => B.nextAction({ text: 'Chase them', do: 'x.y' }), /names no button/)
})

test('every action a screen can name is one the app can actually perform', () => {
  // This is the whole of rule 2. A row promising something nothing can do reads
  // as broken, and the only way to be sure is to hold the two lists together.
  const named = allActionKeys()
  const doable = doKeys()
  for (const key of named) {
    assert.ok(doable.includes(key),
      `a screen can offer "${key}" and KC_NEXT_DO has no entry for it — the button would do nothing`)
  }
  // …and the other way, so a view that gets removed does not leave a dead
  // entry sitting in the table looking supported.
  for (const key of doable) {
    assert.ok(named.includes(key),
      `KC_NEXT_DO carries "${key}" that no screen can ever name — dead code, or a screen that lost its row`)
  }
})

test('the row is painted from a slot the screens cannot destroy', () => {
  // Every tab render owns mainContent.innerHTML outright, so a row inside it
  // would vanish on the next repaint — and most of those renders are async,
  // which is exactly how that bug hides.
  const shell = readFileSync(new URL('../components/AppShell.js', import.meta.url), 'utf8')
  assert.match(shell, /id="kcNextAction"/, 'the shell has no slot for the row')
  assert.ok(shell.indexOf('id="kcNextAction"') < shell.indexOf('id="mainContent"'),
    'the row must sit above the content column, not inside it')
  assert.match(SRC, /kcPaintNextAction\(tab\)/, 'nothing paints the row on a tab change')
})

test('going to a panel moves the keyboard there too', () => {
  // Rule 3. A next-action button that only scrolls is the same dead end for
  // anyone not using a mouse: the page moved, the caret did not.
  const m = SRC.match(/function focusPanel\(id\) \{[\s\S]*?\n\}/)
  assert.ok(m, 'focusPanel not found')
  assert.match(m[0], /scrollIntoView/)
  // Both paths, named separately. A loose /\.focus\(/ passes on the fallback
  // alone, so deleting the line that focuses the CONTROL inside the panel went
  // unnoticed the first time this was mutation-tested.
  assert.match(m[0], /target\.focus\(/, 'the first focusable control inside must take focus')
  assert.match(m[0], /el\.focus\(/, 'a panel with nothing focusable inside must take focus itself')
  assert.match(m[0], /tabindex/, '…and it needs tabindex="-1" to be able to')
})
