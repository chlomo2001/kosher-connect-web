// A backlog that names finished work sends the reader chasing it.
//
// Owner, 21 Aug, on being told the improve backlog had 41 open items: "41 open
// items?!" Six were not open. Three had shipped and never been ticked, three
// were the same item written twice.
//
// That was the FOURTH stale list in one week — the AHT backlog said Hebrew
// dates were unplaced two days after they shipped; docs/clarity-scan.md called
// a fixed bug "the single most valuable thing this scan found"; its T2.2 called
// a table with ten live rows unused, and acting on it would have dropped real
// data. The shape is always the same: the entry gets written when the problem
// is found, and nothing brings anyone back to it when it is solved.
//
// So this is the check the owner asked for. It cannot catch everything — no
// test knows that a paragraph of prose has come true — but it catches the three
// mechanical ways the rot showed up, and each rule is one a person can act on
// without arguing:
//
//   1. an open item that names a file which now EXISTS
//   2. an open item that says of itself, in bold, that it is BUILT or DONE
//   3. the same item written twice, both open
//
// A false positive is cheap to settle: tick the item, or add the escape marker
// with a reason. Both are better than the list quietly lying.
import test from 'node:test'
import assert from 'node:assert'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.join(import.meta.dirname, '..')
const FILES = ['BACKLOG.md', 'ops/loops/kc-improve/BACKLOG.md']

// The way out, for the cases the rules get wrong. It has to carry a reason —
// a bare silencer would just be a slower way of letting the list lie.
const ESCAPE = /<!--\s*backlog-ok:\s*\S[^>]*-->/

// "**P2 · S**", "**P1 · L**" and the bare warning marks are labels every item
// carries. The title is the first bolded run that is none of those.
const TAG = /^(P\d\s*·|[⚠🔒]|done-but-dark)/
function bodyTitle(body) {
  for (const m of body.matchAll(/\*\*([^*]{3,})\*\*/g)) {
    const t = m[1].trim().replace(/\s+/g, ' ')
    if (!TAG.test(t)) return t
  }
  return ''
}

/**
 * Every checkbox item in a file, with its whole body.
 *
 * Walked line by line rather than matched with one regex. The regex version
 * ended each body at `$`, and `$` under the `m` flag is the end of every LINE —
 * so every item was one line long and rule 1, which looks for a filename in the
 * body, never had a body to look in. It passed clean against the very backlog
 * the owner had just complained about. Caught by running it against that file
 * from git rather than trusting it green on the day it was written.
 *
 * A continuation is an indented line or a blank one; anything at column 0 that
 * is not another item ends the item.
 */
function items(file) {
  const src = readFileSync(path.join(ROOT, file), 'utf8')
  const lines = src.split('\n')
  const out = []
  let cur = null
  const close = () => { if (cur) { cur.body = cur.lines.join('\n'); out.push(cur) } cur = null }
  lines.forEach((ln, idx) => {
    const start = ln.match(/^- \[( |x)\] /)
    if (start) {
      close()
      cur = { file, open: start[1] === ' ', line: idx + 1, lines: [ln] }
      return
    }
    if (!cur) return
    if (ln.trim() === '' || /^\s/.test(ln)) { cur.lines.push(ln); return }
    close()
  })
  close()
  return out.map((it) => {
    const body = it.body
    return {
      file: it.file,
      open: it.open,
      line: it.line,
      body,
      // The bolded lead is what a person would call the item — but the FIRST
      // bolded run is the priority tag ("**P2 · S**"), which every item shares,
      // so keying on it made all 24 open items look like duplicates of each
      // other. Skip the tags and take the first bold that is actually a name.
      title: bodyTitle(body),
      escaped: ESCAPE.test(body),
    }
  })
}

const ALL = FILES.flatMap(items)
const OPEN = ALL.filter((i) => i.open && !i.escaped)

test('the backlogs parse at all — a rule nothing matches proves nothing', () => {
  assert.ok(ALL.length > 40, `only ${ALL.length} items parsed across ${FILES.length} files`)
  assert.ok(OPEN.length > 5, `only ${OPEN.length} open items parsed`)
  assert.ok(ALL.some((i) => !i.open), 'no ticked items parsed — the regex is wrong')
})

// ── 1 · an open item that names a file which now exists ────────────────────
//
// This is what would have caught the Hebrew date converter: the entry said
// "Build `lib/hebrewDate.mjs` FIRST", the file was built, mirrored, tested and
// placed, and the box stayed empty for two days.
//
// Only a path this item PROMISES TO CREATE — a creation verb right before it.
// Matching any path an item mentions was useless: most entries cite a reference
// doc for background (`docs/TWILIO-SENDER.md`, `docs/GMAIL-SWEEP-…md`), and
// that doc existing says nothing about whether the work is done. Four false
// positives out of four, on the first run.
//
// The slash-and-extension shape stays, so `sims` and `billing_enabled` do not
// trip it either.
// The verb must not be hyphenated: "Full write-up in `docs/…`" is a citation,
// not a promise, and `write` matched it.
const PROMISED = /\b(build|create|add|write|make|new)\b(?!-)[^`\n]{0,40}`([\w./[\]-]*\/[\w.[\]-]+\.\w{2,4})`/gi

test('an open item does not name a file that already exists', () => {
  const guilty = []
  for (const it of OPEN) {
    for (const m of it.body.matchAll(PROMISED)) {
      const p = m[2]
      if (existsSync(path.join(ROOT, p))) {
        guilty.push(`${it.file}:${it.line} — open, but ${p} exists · ${it.title || '(untitled)'}`)
        break
      }
    }
  }
  assert.deepEqual(guilty, [], `these read as work to do, and the work is on disk:\n  ${guilty.join('\n  ')}\n` +
    'Tick them, or add <!-- backlog-ok: why --> saying what is still outstanding.')
})

// ── 2 · an open item that says of itself that it is built ──────────────────
//
// myPOS ↔ till sat on the open list reading "done-but-dark — BUILT 08-04 and
// PARKED by owner decision". Bold only: prose like "built, never used" is a
// real open question and must not trip this.
//
// And the FIRST LINE only, which is the item's own headline claim about itself.
// Reading the whole body flagged an open auto-SMS item whose note said
// "**Drafts BUILT 08-04**" — a part of it shipped, the item did not.
const CLAIMS_DONE = /\*\*[^*]*\b(DONE|BUILT|SHIPPED|done-but-dark)\b[^*]*\*\*/

test('an open item does not announce itself as done', () => {
  const guilty = OPEN.filter((i) => CLAIMS_DONE.test(i.body.split('\n')[0]))
    .map((i) => `${i.file}:${i.line} — ${i.title || '(untitled)'}`)
  assert.deepEqual(guilty, [], `these say they are finished and are still ticked open:\n  ${guilty.join('\n  ')}`)
})

// ── 3 · the same item, twice ───────────────────────────────────────────────
//
// Un-hold email, open a business bank account and fill in the Google Business
// Profile each appeared once in the body and again in a later review section.
// Three phantom items on a list of 41.
const STOP = new Set(['the', 'and', 'for', 'with', 'into', 'from', 'that', 'this', 'its', 'a', 'an', 'in', 'on', 'of', 'to'])
const words = (t) => new Set(t.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/)
  .filter((w) => w.length > 2 && !STOP.has(w)))

test('no item is counted twice', () => {
  // Compared by CONTAINMENT of the significant words, not by an exact key. The
  // restatements were reworded — "Fill the profile in" against "Fill in the
  // Google Business Profile" — so sorting the first four words and comparing
  // them matched two of the three duplicates and walked past the third.
  const dupes = []
  for (let a = 0; a < OPEN.length; a++) {
    for (let b = a + 1; b < OPEN.length; b++) {
      const wa = words(OPEN[a].title), wb = words(OPEN[b].title)
      if (wa.size < 2 || wb.size < 2) continue
      const [small, big] = wa.size <= wb.size ? [wa, wb] : [wb, wa]
      if ([...small].every((w) => big.has(w))) {
        dupes.push(`"${OPEN[a].title}" (${OPEN[a].file}:${OPEN[a].line}) and ` +
          `"${OPEN[b].title}" (${OPEN[b].file}:${OPEN[b].line})`)
      }
    }
  }
  assert.deepEqual(dupes, [], `the same work is on the list more than once:\n  ${dupes.join('\n  ')}\n` +
    'Keep the fuller entry and make the other a "> …" cross-reference.')
})

// The escape must stay rare and must stay explained, or it becomes the way the
// rot comes back.
test('every escape carries a reason, and there are not many', () => {
  const escaped = ALL.filter((i) => i.escaped)
  assert.ok(escaped.length <= 5, `${escaped.length} items are silenced — the rules want fixing, not muting`)
  for (const it of escaped) {
    const why = it.body.match(ESCAPE)[0]
    assert.ok(why.replace(/<!--\s*backlog-ok:\s*/, '').replace(/-->/, '').trim().length > 12,
      `${it.file}:${it.line} silences a rule without saying why`)
  }
})
