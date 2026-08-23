// Which address does a queue row SAY it was sent to?
//
// Owner, 23 Aug: "AGAIN a lot of carrier emails just to 'gittbilig' - i have
// no use from this!" and "it didnt see for exactle which gitt.blig like the
// dots ot plus". Production showed why: gitt.bilig@ is not only a 336-SIM
// pool, it also FORWARDS for the other family accounts (redfarbilig,
// hashomrimmcr, heimishecentre…). A notice the carrier wrote to
// redfarbilig+kre@gmail.com crossed gitt.bilig@ on its way in, the failed
// match reported the pool as `matchedOn`, and the row was stored — and shown —
// as "sent to gitt.bilig@gmail.com". The one fact that could help a person
// settle the row was overwritten by the one that could not.
//
// The rule everywhere is the same: matchedOn earns the recipient column only
// when an ADDRESS actually paired the message. A failed match, and a pair by
// NUMBER, keep the envelope's own first address — dots and +tag intact.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildSimIndex, matchSimForMail } from '../lib/simMailMatch.mjs'

const code = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
  .split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')

const INBOUND = code('../pages/api/inbound/mail.js')
const SWEEP = code('../pages/api/cron/sweep.js')
const API = code('../pages/api/sim-mail.js')

test('a failed match through a registered pool still names the pool in matchedOn', () => {
  // This is the matcher behaving as designed — matchedOn is "which address
  // produced the candidates". The write sites are what must not confuse that
  // with "which address the carrier wrote to".
  const idx = buildSimIndex([
    { id: 'p1', email: 'gitt.bilig@gmail.com', simNumber: '07700900001' },
    { id: 'p2', email: 'gitt.bilig@gmail.com', simNumber: '07700900002' },
  ])
  const m = matchSimForMail({ to: 'redfarbilig+kre@gmail.com, gitt.bilig@gmail.com' }, idx)
  assert.equal(m.simId, null)
  assert.equal(m.matchedOn, 'gitt.bilig@gmail.com')
})

test('the inbound hook stores matchedOn only for an ADDRESS pair', () => {
  assert.match(INBOUND,
    /recipient: \(match\.simId && match\.confidence !== 'number' \? match\.matchedOn : null\)\s*\n\s*\|\| mail\.recipients\[0\] \|\| null/,
    'a failed or number-driven match must store the envelope address, not the pool it crossed')
})

test('the nightly re-match obeys the same rule when it pairs by number', () => {
  assert.match(SWEEP,
    /recipient: \(again\.confidence !== 'number' && again\.matchedOn\) \|\| m\.recipient/,
    'the sweep must not stamp the pool over the stored address on a number pair')
})

test('the queue read repairs rows stored before the fix from the route', () => {
  // 94 rows were already stored with the pool in the recipient column. The
  // route survived on every one of them; the read side prefers its first hop
  // on unpaired rows so the backlog displays honestly without a data rewrite.
  assert.match(API, /const recipient = \(!m\.sim_id && Array\.isArray\(m\.route\)/)
  assert.ok(API.includes('mailboxKey(recipient)'),
    'candidates must be offered for the address shown, not the masked one')
  assert.ok(API.includes('addressTag(recipient)'))
})

test('learning an address teaches the route address, never the masked pool', () => {
  assert.match(API, /const routeFirst = Array\.isArray\(msg\.route\)/)
  assert.match(API, /routeFirst\.includes\('@'\) \? routeFirst : String\(msg\.recipient \|\| ''\)/,
    'teaching the pool would hand one SIM 336 other SIMs\' mail')
})
