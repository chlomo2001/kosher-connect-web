// Does every section of the morning digest say what is actually in it?
//
// This exists because of a bug the owner found on 27 August, the first morning
// the digest genuinely arrived: a section headed "KOL TORAH — consignment jobs"
// containing fifty-five airline tickets. `TICKET-` is raised by
// pages/api/inbound/mail.js when an airline confirmation lands, and the task it
// makes carries a "Confirm booking details" button with a plane on it. It had
// been labelled Kol Torah since the day the table was written. Kol Torah's own
// references — `KT-SETTLE-` and `KT-JOB-` — had no group at all and were
// falling into 'other'.
//
// Neither half was findable by reading lib/dailyDigest.mjs, because the file is
// self-consistent: it is a list of prefixes and a list of labels, and nothing
// in it knows what raises a prefix. The two facts only meet in the codebase.
// So that is what this test reads.
//
// It asserts the join in both directions:
//   · every prefix RAISED in the code has a group (nothing silently 'other')
//   · every prefix GROUPED here is actually raised by something
//
// The second direction is the one that would have caught the Kol Torah label:
// a group for a prefix nothing raises is a section that can never appear, and
// the only reason to have one is that somebody meant a different prefix.
import test from 'node:test'
import assert from 'node:assert'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { GROUPS, groupOf } from '../lib/dailyDigest.mjs'

const ROOT = path.join(import.meta.dirname, '..')

/** Every .js/.mjs under pages/, lib/ and scripts/ — where tasks are raised. */
function sources(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) sources(full, out)
    else if (/\.(js|mjs)$/.test(name)) out.push(full)
  }
  return out
}

const FILES = ['pages', 'lib', 'scripts'].flatMap((d) => sources(path.join(ROOT, d)))

// The scan. It must read ONLY where a task is actually created, which is
// `upsertOpenTask({…})` and `db.insert('tasks', [{…}])`. An earlier draft
// matched every `reference:` in the repo and came back with PAY, SALE, BOOKING,
// STRIPE — those are `charge_reference` on a LEDGER row and a payment-link ref
// passed to Stripe, none of which is a task and none of which belongs in the
// morning. A test that cries wolf on thirteen non-findings gets switched off.
//
// Some sites build the reference into a variable first (`const ref =
// \`HOUSE-${c.id}-${ym}\``) and pass it as shorthand, so each creation site is
// read together with the lines just above it.
const CREATES = /(upsertOpenTask\(\{|db\.insert\('tasks',\s*\[\{)/g
const PREFIX_AT = /(?:^|[^a-z_])(?:reference|ref)\s*[:=]\s*[`'"]([A-Z][A-Z_]*)/

const RAISED = new Set()
for (const file of FILES) {
  if (file.endsWith('lib/dailyDigest.mjs')) continue
  const code = readFileSync(file, 'utf8')
    .split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
  for (const m of code.matchAll(CREATES)) {
    // The reference is either inside the object or assigned just above it.
    const window = code.slice(Math.max(0, m.index - 1200), m.index + 1200)
    const hits = [...window.matchAll(new RegExp(PREFIX_AT, 'g'))].map((h) => h[1])
    hits.forEach((h) => RAISED.add(h))
  }
}

test('the codebase raises at least the references we think it does', () => {
  assert.ok(RAISED.size >= 10,
    `only found ${RAISED.size} reference prefixes — the scan has probably stopped matching`)
})

test('every reference the code raises lands in a named group, not "other"', () => {
  const orphans = [...RAISED].filter((p) => groupOf(p + '-1') === 'other')
  assert.deepStrictEqual(orphans, [],
    `these prefixes are raised in the code but fall into "other": ${orphans.join(', ')}`)
})

test('every group in the digest is one something actually raises', () => {
  // A group for a prefix nothing raises is a section that can never appear —
  // and the reason it exists is almost always that somebody meant a different
  // prefix. That is exactly how TICKET came to be labelled "Kol Torah".
  const unraised = GROUPS.map(([p]) => p).filter((p) => !RAISED.has(p))
  assert.deepStrictEqual(unraised, [],
    `these groups exist but nothing raises them: ${unraised.join(', ')}`)
})

test('the ticket group is about airline tickets, and Kol Torah has no group', () => {
  // The specific thing that was wrong, pinned by name so a re-swap is loud.
  const byPrefix = Object.fromEntries(GROUPS.map(([p, title, blurb]) => [p, { title, blurb }]))
  assert.ok(byPrefix.TICKET, 'TICKET must have its own group')
  assert.doesNotMatch(byPrefix.TICKET.title, /kol torah/i,
    'TICKET- is raised for an airline confirmation, not a consignment job')
  // And there is deliberately no Kol Torah section: KT-SETTLE- and KT-JOB- are
  // charge_reference on a ledger row. Kol Torah raises no tasks, so a Kol Torah
  // section could only ever be empty — which is what the mislabelled TICKET
  // group was hiding.
  assert.deepStrictEqual(
    GROUPS.filter(([, title]) => /kol torah/i.test(title)).map(([p]) => p), [],
    'Kol Torah raises no tasks, so it must not have a digest section')
})

test('a longer prefix is never eaten by a shorter one', () => {
  // groupOf sorts longest-first for this reason; the test states the property
  // rather than trusting the sort to stay.
  for (const [p] of GROUPS) {
    assert.strictEqual(groupOf(p + '-123'), p, `${p}- should group as ${p}`)
  }
})
