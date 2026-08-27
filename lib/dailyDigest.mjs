// What today needs, in one reading. Pure — no I/O.
//
// From the Epos Now read (docs/IDEAS-EPOSNOW-2026-08-21.md, E1). Their
// low-stock alert arrives daily by email; KC computes the same kind of thing
// and waits on a badge for somebody to notice it. **They push, we wait to be
// looked at**, and that is the difference worth taking — not the alert itself.
//
// IT SUMMARISES THE TASKS THAT ALREADY EXIST. It does not decide what matters.
// The nightly sweep (pages/api/cron/sweep.js) already raises a task for every
// one of these — an overdue rental, a debt, a passport about to expire, a
// travel authorisation missing, a completed port, a payment problem, a plan
// with no payment method. Re-deriving any of that here would be a SECOND answer
// to "what needs doing", and this codebase has been bitten three times in one
// week by a second answer drifting from the first. So: tasks in, digest out.
//
// THIS IS HALF THE FEATURE, on purpose. Deciding what to say is the pure half
// and it is here, tested. Getting it in front of the owner needs a read and a
// send, and the send is HOLD-gated until he flips live email on — so the
// remaining half is his, and the backlog says so rather than this pretending to
// be finished.

/**
 * What kind of work a task is, read off the reference prefix the raiser used.
 *
 * The prefixes are the sweep's own (`OVERDUE-`, `BALANCE-`, `PASSPORT-`,
 * `PICKUP-`, `SIMDUE-`, `FLIGHT-`, `HOUSE-`, `RULE-`, `TRAVELREQ-`, `SUBDUE-`,
 * `SUBGAPS`, `DRIFT-`) plus the ones raised on arrival
 * (`SIMMAIL-`, `SIMNEW`, `SIMPAIR`, `SMSFAIL`) and from the public forms
 * (`REQ-`, `TICKET-`, `REPAIR-`). Anything unrecognised is grouped as 'other'
 * rather than dropped: a digest that silently omits a kind of work is worse
 * than one with an untidy last section.
 *
 * This table was wrong in three ways from the day it was written, and none of
 * them could show until the digest actually started arriving (27 Aug).
 *
 * 1. `TICKET-` was labelled "Kol Torah — consignment jobs". It is raised by
 *    pages/api/inbound/mail.js for an AIRLINE ticket email, and the task it
 *    makes carries a "Confirm booking details" button with a plane on it.
 *    Fifty-five flight tasks were filed under Kol Torah in the owner's first
 *    digest — which is how it was found.
 * 2. There is no Kol Torah section at all now, because Kol Torah raises no
 *    tasks. `KT-SETTLE-` and `KT-JOB-` are `charge_reference` on a LEDGER row.
 *    `SIMDUP` and `VN` were the same mistake made quietly: sections for work
 *    nothing raises, which could never once have appeared.
 * 3. Seven kinds of real work had no section and were landing in 'other':
 *    RULE, TRAVELREQ, HOUSE, SUBDUE, SUBGAPS, DRIFT and REPAIR.
 *
 * All three are the same missing check — nothing compared this table against
 * the code that raises the references. test/digestGroups.test.mjs does now,
 * in both directions.
 */
export const GROUPS = [
  // Read in the order a shopkeeper reads a morning: who is waiting, what is
  // owed, what will bite today, then the admin. Every prefix below is one that
  // something actually raises as a TASK — test/digestGroups.test.mjs checks the
  // join in both directions, because that is the check that was missing.
  ['OVERDUE', 'Phones due back', 'A hire that has run past its day.'],
  ['HANDOVER', 'Travelling tomorrow', 'Collected already — worth checking the line is live.'],
  ['POOLEXP', 'Pools running out under a live hire', 'The service will cut out before the phone comes back.'],
  ['PICKUP', 'Waiting to be collected', 'Done, and still on the shelf.'],
  ['BALANCE', 'Money owed', 'Customers carrying a debt.'],
  ['HOUSE', 'House accounts to settle', 'A monthly account has reached its day.'],
  ['REQ', 'Customers who wrote in', 'From the portal or the website.'],
  ['REPAIR', 'Repairs asked for online', 'Somebody filled in the repair form.'],
  ['SIMMAIL', 'Carrier post', 'Something a network sent that needs a person.'],
  ['SIMNEW', 'Lines the app does not know', 'Live at a carrier, absent here.'],
  ['SIMPAIR', 'Post nobody could file', 'Arrived at an address no plan claims.'],
  ['SIMDUE', 'Plans renewing', 'A SIM about to take money.'],
  ['PASSPORT', 'Passports', 'Expiring, or not on file before a trip.'],
  ['TRAVELREQ', 'Visas and entry rules', 'A trip needs paperwork that is missing or expiring.'],
  ['FLIGHT', 'Travel', 'Check-in and travel paperwork.'],
  ['TICKET', 'Tickets from email', 'An airline confirmation waiting to become a booking.'],
  ['STOCKLOW', 'Running out', 'Stock at or below its warn level.'],
  ['SMSFAIL', 'Messages that did not arrive', 'A text the network rejected.'],
  ['RULE', 'Automations that want a person', 'A rule fired and left something to do.'],
  ['SUBDUE', 'Our own subscriptions renewing', 'A bill the shop pays, about to go out.'],
  ['SUBGAPS', 'The subscription register’s gaps', 'Accounts with no renewal date on file.'],
  ['DRIFT', 'Data that disagrees with itself', 'Typed columns against the app’s own record.'],
]

const PREFIXES = GROUPS.map(([p]) => p)

/** The group a reference belongs to, or 'other'. */
export function groupOf(reference) {
  const ref = String(reference || '').toUpperCase()
  // Longest prefix first, so `SIMNEW` is not eaten by a shorter `SIM…` if one
  // is ever added above it.
  const hit = [...PREFIXES].sort((a, b) => b.length - a.length).find((p) => ref.startsWith(p))
  return hit || 'other'
}

const isoDay = (v) => {
  const m = String(v || '').match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : ''
}

/**
 * The digest.
 *
 * `tasks` are the OPEN ones — done tasks are somebody's finished work and have
 * no place in a morning. Each is { title, priority, reference, due_date,
 * created_at, customer_id, snoozed_until }.
 *
 * Returns { total, urgent, groups: [{ key, title, blurb, lines, more }],
 * quiet } — `quiet` true when there is nothing worth sending, so a caller can
 * say nothing rather than send an empty page. A digest that arrives every
 * morning saying "nothing today" is a digest people stop opening.
 */
export function buildDigest(tasks, { today = '', perGroup = 5 } = {}) {
  const open = (Array.isArray(tasks) ? tasks : []).filter((t) => t && !t.done)
    // A snoozed task is one somebody has already answered with "not yet".
    .filter((t) => !(isoDay(t.snoozed_until) && today && isoDay(t.snoozed_until) > today))

  const cap = Math.max(1, Math.min(20, Math.round(Number(perGroup) || 5)))
  const byKey = new Map()
  for (const t of open) {
    const key = groupOf(t.reference)
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key).push(t)
  }

  // Inside a group: high priority first, then whatever is due soonest, then
  // oldest. A task with no due date sorts after one that has a date — a
  // deadline somebody set outranks a deadline nobody did.
  const rank = { high: 0, medium: 1, low: 2 }
  const order = (a, b) =>
    (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1) ||
    (isoDay(a.due_date) || '9999').localeCompare(isoDay(b.due_date) || '9999') ||
    String(a.created_at || '').localeCompare(String(b.created_at || ''))

  const groups = []
  for (const [key, title, blurb] of [...GROUPS, ['other', 'Everything else', '']]) {
    const items = (byKey.get(key) || []).sort(order)
    if (!items.length) continue
    groups.push({
      key,
      title,
      blurb,
      lines: items.slice(0, cap).map((t) => ({
        title: String(t.title || '').trim(),
        priority: t.priority || 'medium',
        overdue: !!(today && isoDay(t.due_date) && isoDay(t.due_date) < today),
        customerId: t.customer_id || null,
      })),
      // NEVER a silent cap. A digest that shows five of nineteen and does not
      // say so reads as "there are five", which is the one thing it must not do.
      more: Math.max(0, items.length - cap),
    })
  }

  // The urgent count is what the subject line is for, so it counts the two
  // things a person would want to know before opening: high priority, and past
  // a date somebody set.
  const urgent = open.filter((t) => t.priority === 'high' ||
    (today && isoDay(t.due_date) && isoDay(t.due_date) < today)).length

  return { total: open.length, urgent, groups, quiet: open.length === 0 }
}

/**
 * The subject line. Says the size of the day before it is opened, because that
 * is the whole use of a subject on a mail that arrives every morning.
 */
export function digestSubject(digest, { date = '' } = {}) {
  if (!digest || digest.quiet) return ''
  const d = digest.urgent
    ? `${digest.urgent} need${digest.urgent === 1 ? 's' : ''} you today`
    : `${digest.total} thing${digest.total === 1 ? '' : 's'} waiting`
  return date ? `Kosher Connect — ${d} (${date})` : `Kosher Connect — ${d}`
}
