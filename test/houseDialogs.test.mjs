// The shop's own dialogs, not the browser's.
//
// public/main.js has had kcConfirm and kcPrompt for months — themed, following
// the text-size setting, focus put somewhere safe, and looking like the rest of
// the app. Alongside them, `api.confirmDelete` was still a one-line wrapper
// around window.confirm, and it was doing TEN of the app's questions: deleting a
// customer, retiring a shop item, removing a team member, deleting an email
// alias, and six more.
//
// A system sheet is the wrong thing in all ten. It ignores dark mode and the
// text-size setting, it cannot be read right-to-left, and on a phone it is
// chrome that says the BROWSER is asking — at the moment the shop is asking
// whether to delete a customer.
import test from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.join(import.meta.dirname, '..')
const SRC = readFileSync(path.join(ROOT, 'public/main.js'), 'utf8')

// Comments talk about window.confirm; code must not call it. Skipping lines
// that LOOK like comments, rather than stripping comments out of the source
// first: the strip version used /\/\*[\s\S]*?\*\//, and a `/*` sitting inside a
// string literal opened a comment that ran until the next `*/` and swallowed
// real code with it — main.js:8490 calls prompt() and this walked straight past
// it. It also renumbered every line it did report, so the seven it found were
// all pointed at the wrong place. Reading the real lines keeps the numbers
// true, and every comment in main.js starts its line.
const isComment = (l) => /^\s*(\/\/|\*|\/\*)/.test(l)

test('nothing in the app asks through the browser any more', () => {
  const guilty = []
  SRC.split('\n').forEach((l, i) => {
    if (isComment(l)) return
    if (/(?:^|[^.\w])(?:window\.)?(?:confirm|prompt|alert)\s*\(/.test(l) &&
        !/kcConfirm|kcPrompt|kcAlert|confirmDelete\s*[:(]/.test(l)) {
      guilty.push(`main.js:${i + 1} ${l.trim().slice(0, 80)}`)
    }
  })
  assert.deepEqual(guilty, [], 'these still open a system sheet:\n  ' + guilty.join('\n  '))
})

// ── api.confirmDelete ──────────────────────────────────────────────────────

function liftConfirmDelete() {
  const m = SRC.match(/confirmDelete: \(msg[\s\S]*?\n  \},/)
  assert.ok(m, 'api.confirmDelete not found')
  // MIRRORS main.js escHtml — &, <, > and ", and deliberately NOT the
  // apostrophe. A stub that escapes more than the real thing cannot fail.
  const escHtml = (v) => String(v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const calls = []
  const kcConfirm = (opts) => { calls.push(opts); return Promise.resolve(true) }
  const fn = new Function('escHtml', 'kcConfirm',
    `const api = { ${m[0]} }; return api.confirmDelete;`)(escHtml, kcConfirm)
  return { fn, calls }
}

test('it goes to the house dialog, and carries the caller’s verb to the button', async () => {
  const { fn, calls } = liftConfirmDelete()
  await fn('Retire this item?\n\nPast sales keep their history.', 'Retire')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].title, 'Retire this item?', 'the question is the title')
  assert.equal(calls[0].body, 'Past sales keep their history.', 'what it means is the body')
  assert.equal(calls[0].okLabel, 'Retire',
    'a button reading "Delete" on the dialog that retires a shop item is a different promise')
})

test('the default verb is the one the function is named for', async () => {
  const { fn, calls } = liftConfirmDelete()
  await fn('Delete "Luftig"?\n\nThis cannot be undone.')
  assert.equal(calls[0].okLabel, 'Delete')
})

test('a customer’s own name cannot put markup in the dialog', async () => {
  // kcConfirm takes `body` as HTML on purpose — other callers hand it markup —
  // and every one of these messages interpolates something a person typed: a
  // customer name, an email address, a rate code.
  const { fn, calls } = liftConfirmDelete()
  await fn('Delete this?\n\nBelongs to <img src=x onerror=alert(1)> & Sons.', 'Delete')
  assert.doesNotMatch(calls[0].body, /<img/)
  assert.match(calls[0].body, /&lt;img/)
  assert.match(calls[0].body, /&amp; Sons/)
})

test('a message with no blank line keeps its words', async () => {
  // Every caller today writes "question\n\nconsequence", but a future one that
  // writes a bare question must not lose it.
  const { fn, calls } = liftConfirmDelete()
  await fn('Just a question?', 'Yes')
  assert.equal(calls[0].title, 'Just a question?')
  assert.equal(calls[0].body, '')
})

test('a single newline inside the explanation survives as a line break', async () => {
  const { fn, calls } = liftConfirmDelete()
  await fn('Go on?\n\nOne thing.\nAnother thing.', 'Yes')
  assert.equal(calls[0].body, 'One thing.<br>Another thing.')
})

test('nothing at all is asked without crashing', async () => {
  const { fn, calls } = liftConfirmDelete()
  await fn(undefined)
  assert.equal(calls[0].title, '')
  assert.equal(calls[0].body, '')
})

// ── the call sites ─────────────────────────────────────────────────────────

test('every caller still awaits it — it returns a promise now, not a boolean', () => {
  const sites = [...SRC.matchAll(/^.*\bapi\.confirmDelete\(/gm)].map((m) => m[0])
  assert.ok(sites.length >= 10, `only ${sites.length} call sites found — the regex is wrong`)
  for (const s of sites) {
    assert.match(s, /await\s+window\.api\.confirmDelete\($/,
      `a call that does not await now gets a Promise, which is always truthy: ${s.trim()}`)
  }
})

test('every caller names the verb its button should carry', () => {
  // Without a second argument the button reads "Delete", and three of the ten
  // are not deletions: two are "save anyway" questions on the customer form and
  // one retires a shop item.
  const bare = []
  for (const m of SRC.matchAll(/api\.confirmDelete\(([\s\S]{0,400}?)\);/g)) {
    // A trailing options object (the #19 danger opt-out) may follow the verb.
    const args = m[1].trim().replace(/,\s*\{[^}]*\}\s*$/, '')
    if (!/,\s*'[^']+'\s*$/.test(args)) bare.push(args.slice(0, 70))
  }
  assert.deepEqual(bare, [], 'these fall back to "Delete":\n  ' + bare.join('\n  '))
})

// ── issue #19, option 2: a delete must not dress like a save ───────────────

test('the confirming button is red exactly when the caller says danger', async () => {
  const kcConfirmSrc = SRC.match(/function kcConfirm\(\{[\s\S]*?\n\}/)[0]
  assert.match(kcConfirmSrc, /danger = false/,
    'kcConfirm must take a danger flag, off by default — most confirms are not deletions')
  assert.match(kcConfirmSrc, /\$\{danger \? 'btn-danger' : 'btn-primary'\}/,
    'the flag must swap the confirming button class, nothing else')
})

test('confirmDelete is red by default, and the two saves opt out', () => {
  const helper = SRC.match(/confirmDelete: \(msg[\s\S]*?\n  \},/)[0]
  assert.match(helper, /danger = true/, 'deletion is this helper’s whole job — red is its default')
  const optOuts = [...SRC.matchAll(/confirmDelete\([\s\S]{0,400}?\{ danger: false \}/g)]
  assert.equal(optOuts.length, 2,
    'exactly the duplicate-name and account-email saves opt out of the red button')
})

test('.btn-danger exists, in the stylesheet the app actually loads', () => {
  const css = readFileSync(new URL('../styles/globals.css', import.meta.url), 'utf8')
  assert.match(css, /\.btn-danger \{ background: var\(--danger-solid\)/,
    'issue #19 noted .btn-danger was referenced but never defined — --danger-solid is the one red that carries white in both themes')
})
