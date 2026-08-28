// The morning digest as an email. Rendering only — it cannot send, and the
// send is HOLD-gated anyway.
//
// Split from lib/dailyDigest.mjs on purpose: that module decides what today
// needs and imports nothing, so it stays testable as plain data. This one is
// allowed to reach for the house shell, and reaching is all it does.
import test from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { buildDigest } from '../lib/dailyDigest.mjs'
import { digestEmail } from '../lib/digestEmail.mjs'

const T = (over = {}) => ({
  title: 'Something to do', priority: 'medium', reference: 'BALANCE-x',
  due_date: null, created_at: '2026-08-01T09:00:00Z', done: false, ...over,
})
const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

test('a quiet morning sends nothing at all', () => {
  const out = digestEmail(buildDigest([]))
  assert.deepEqual(out, { subject: '', html: '' },
    'forwarding an empty digest trains the reader to ignore the next one')
  assert.deepEqual(digestEmail(null), { subject: '', html: '' })
  assert.deepEqual(digestEmail(undefined), { subject: '', html: '' })
})

test('it renders the groups, their blurbs and their lines', () => {
  const d = buildDigest([
    T({ title: 'Bleier owes £240', reference: 'BALANCE-1' }),
    T({ title: 'Luftig’s phone was due back Tuesday', reference: 'OVERDUE-1', priority: 'high' }),
  ], { today: '2026-08-21' })
  const t = text(digestEmail(d, { date: '21 Aug' }).html)
  assert.match(t, /Overdue, and now charged/)
  assert.match(t, /Past the return window: the late fee has started\./)
  assert.match(t, /Luftig’s phone was due back Tuesday/)
  assert.match(t, /Money owed/)
  assert.match(t, /Bleier owes £240/)
})

test('the urgent count leads, and the calm case says so plainly', () => {
  const busy = digestEmail(buildDigest([T({ priority: 'high' }), T()], { today: '2026-08-21' }))
  assert.match(text(busy.html), /1 of these is either marked urgent or past a date somebody set/)
  assert.match(busy.subject, /1 needs you today/)

  const calm = digestEmail(buildDigest([T(), T()], { today: '2026-08-21' }))
  assert.match(text(calm.html), /Nothing here is urgent or overdue/)
  assert.doesNotMatch(text(calm.html), /marked urgent or past/)
})

test('a capped group says how many it left out, in words', () => {
  const many = Array.from({ length: 9 }, (_, i) => T({ title: `debt ${i}` }))
  const t = text(digestEmail(buildDigest(many, { perGroup: 5 })).html)
  assert.match(t, /…and 4 more like these\./)
  // One reads as one.
  const seven = Array.from({ length: 6 }, (_, i) => T({ title: `debt ${i}` }))
  assert.match(text(digestEmail(buildDigest(seven, { perGroup: 5 })).html), /…and 1 more like it\./)
})

test('weight is shown, not spelled out', () => {
  // The reader is scanning at eight in the morning; "high priority" as words is
  // one more thing to read.
  const html = digestEmail(buildDigest([
    T({ title: 'urgent one', priority: 'high' }),
    T({ title: 'late one', due_date: '2026-08-01' }),
    T({ title: 'ordinary one' }),
  ], { today: '2026-08-21' })).html
  assert.match(html, /title="high priority"/)
  assert.match(html, /title="past its date"/)
  assert.doesNotMatch(text(html), /\bhigh priority\b(?!")/, 'the words themselves stay out of the body')
})

test('the inbox preview repeats the count, not the greeting', () => {
  const html = digestEmail(buildDigest([T(), T({ priority: 'high' })], { today: '2026-08-21' })).html
  assert.match(html, /mso-hide:all">2 open, 1 needing you\./)
})

test('a task title cannot inject markup into the digest', () => {
  const html = digestEmail(buildDigest([
    T({ title: 'Ring <script>alert(1)</script> Bleier' }),
  ])).html
  assert.doesNotMatch(html, /<script>/)
  assert.match(html, /&lt;script&gt;/)
})

test('it renders, and it does not send', () => {
  const SRC = readFileSync(path.join(import.meta.dirname, '..', 'lib/digestEmail.mjs'), 'utf8')
  for (const smell of ['sendEmail', 'fetch(', 'db.', 'MAIL_LIVE', 'transport']) {
    assert.ok(!SRC.includes(smell), `digestEmail is doing more than rendering: ${smell}`)
  }
  // And the data half stays free of the shell, or it stops being plain data.
  const DATA = readFileSync(path.join(import.meta.dirname, '..', 'lib/dailyDigest.mjs'), 'utf8')
  assert.doesNotMatch(DATA, /^import /m, 'lib/dailyDigest.mjs must import nothing')
})

test('it goes through the house shell, so it looks like everything else', () => {
  const html = digestEmail(buildDigest([T()])).html
  assert.match(html, /logo-full-tight\.png/, 'the wordmark')
  assert.match(html, /421 Bury New Road/, 'the business footer')
  assert.match(html, /Anything you have snoozed is left to sleep/,
    'the footer must claim only what buildDigest actually does — the Tasks ' +
    'screen shows snoozed tasks in a lane, the digest drops them, and the old ' +
    'wording said they were the same list')
})
