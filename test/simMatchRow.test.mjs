// Every address a SIM receives carrier mail at, gathered in ONE place.
//
// Found 21 Aug while checking whether the clarity scan's Tier 2 findings were
// still true. T2.2 said the `pools` / `master_accounts` tables "describe a pool
// model no code has ever used". Half right: `pools` is empty and `lines.pool_id`
// is never set, but `master_accounts` holds ten real Three accounts and ten SIMs
// point at them — and `account_email` on those rows is the carrier login the
// line actually sits under.
//
// Nothing read it. buildSimIndex was fed `legacy_extras.email` and `alt_emails`
// and nothing else, so for the three SIMs whose blob holds a POOLED mailbox
// (gittb.i.lig@, shared by 253 lines) while the master account holds the address
// that names the line, the naming address was invisible to the matcher. On the
// morning of 21 Aug, 22 messages sat unresolved at one such address.
//
// The row-shaper was also written out three times — inbound/mail.js,
// sim-mail.js, cron/sweep.js — agreeing only because each was copied from the
// last. The sweep's own comment says why that matters: reach a different answer
// from the screen and it re-opens settled questions. One function now.
import test from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { simMatchRow, buildSimIndex, matchSimForMail, mailboxKey } from '../lib/simMailMatch.mjs'

const ROOT = path.join(import.meta.dirname, '..')
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8')
const SITES = ['pages/api/inbound/mail.js', 'pages/api/sim-mail.js', 'pages/api/cron/sweep.js']

test('the master account email joins the addresses this line answers to', () => {
  const row = {
    id: 'sim-50',
    legacy_extras: { email: 'g.i.tt.bi.li.g@gmail.com', simNumber: '07123456789' },
    alt_emails: [],
    master_accounts: { account_email: 'e.limelechgrun.nfeld@gmail.com' },
  }
  const out = simMatchRow(row)
  // The primary stays the primary — it is what the SIM card shows.
  assert.equal(out.email, 'g.i.tt.bi.li.g@gmail.com')
  assert.deepEqual(out.altEmails, ['e.limelechgrun.nfeld@gmail.com'])
  assert.equal(out.simNumber, '07123456789')
})

test('addresses already taught are kept, and the master one is not duplicated', () => {
  const base = { id: 's', legacy_extras: {}, alt_emails: ['taught@x.com'] }
  assert.deepEqual(
    simMatchRow({ ...base, master_accounts: { account_email: 'ma@gmail.com' } }).altEmails,
    ['taught@x.com', 'ma@gmail.com'])
  // Same mailbox written differently is the SAME address at Gmail — dots are
  // noise there, and adding it twice would index one line under one key twice.
  assert.deepEqual(
    simMatchRow({ ...base, alt_emails: ['e.limelech@gmail.com'],
      master_accounts: { account_email: 'elimelech@gmail.com' } }).altEmails,
    ['e.limelech@gmail.com'])
})

// A matcher that throws files nothing at all, so every shape the read can
// produce has to land somewhere sane.
test('a missing, null or oddly-shaped embed costs an address, never a crash', () => {
  const cases = [
    { id: 's', legacy_extras: { email: 'a@x.com' } },                      // no embed
    { id: 's', legacy_extras: { email: 'a@x.com' }, master_accounts: null },
    { id: 's', legacy_extras: { email: 'a@x.com' }, master_accounts: {} },
    { id: 's', legacy_extras: { email: 'a@x.com' }, master_accounts: { account_email: '' } },
    { id: 's', legacy_extras: { email: 'a@x.com' }, master_accounts: [] },
    { id: 's', legacy_extras: { email: 'a@x.com' }, alt_emails: null },
  ]
  for (const row of cases) {
    const out = simMatchRow(row)
    assert.equal(out.email, 'a@x.com')
    assert.deepEqual(out.altEmails, [], JSON.stringify(row))
  }
  // PostgREST returns an object for a to-one embed; an array is handled anyway
  // rather than being silently dropped if it ever decides otherwise.
  assert.deepEqual(
    simMatchRow({ id: 's', legacy_extras: {}, master_accounts: [{ account_email: 'ma@gmail.com' }] }).altEmails,
    ['ma@gmail.com'])
  assert.deepEqual(simMatchRow(null).altEmails, [])
  assert.deepEqual(simMatchRow(undefined).altEmails, [])
})

// The point of the whole change, end to end.
test('mail to the master account address now finds its line', () => {
  const rows = [
    { id: 'sim-50', legacy_extras: { email: 'g.i.tt.bi.li.g@gmail.com' }, alt_emails: [],
      master_accounts: { account_email: 'e.limelechgrun.nfeld@gmail.com' } },
    // The pooled mailbox, shared by other lines — the reason the blob address
    // cannot answer the question on its own.
    { id: 'sim-99', legacy_extras: { email: 'gitt.bilig@gmail.com' }, alt_emails: [] },
    { id: 'sim-98', legacy_extras: { email: 'gittbilig@gmail.com' }, alt_emails: [] },
  ]
  const index = buildSimIndex(rows.map(simMatchRow))
  const hit = matchSimForMail({ deliveredTo: 'elimel.echgrunnfeld@gmail.com' }, index)
  assert.equal(hit.simId, 'sim-50')
  assert.equal(hit.confidence, 'address')

  // …and without the master account it is exactly the miss that was happening.
  const blind = buildSimIndex(rows.map((r) => simMatchRow({ ...r, master_accounts: null })))
  assert.equal(matchSimForMail({ deliveredTo: 'elimel.echgrunnfeld@gmail.com' }, blind).simId, null)
  assert.equal(matchSimForMail({ deliveredTo: 'elimel.echgrunnfeld@gmail.com' }, blind).confidence, 'unknown')
})

test('dots and plus-tags still mean what they meant', () => {
  // The tag names a SIM and must survive; dots are noise at Gmail.
  assert.equal(mailboxKey('e.limelechgrun.nfeld@gmail.com'), 'elimelechgrunnfeld@gmail.com')
  assert.equal(mailboxKey('gitt.bilig+moshe@gmail.com'), 'gittbilig+moshe@gmail.com')
})

test('all three readers build the index the same way', () => {
  for (const site of SITES) {
    const src = read(site)
    assert.match(src, /simMatchRow/, `${site} still shapes its own rows`)
    assert.match(src, /master_accounts\(account_email\)/,
      `${site} does not ask for the master account email, so simMatchRow has nothing to fold in`)
    assert.doesNotMatch(src, /altEmails: Array\.isArray\(r\.alt_emails\)/,
      `${site} kept its own copy of the shape`)
  }
})
