// Daily sweeps — the automation heartbeat (ports of the Apps Script triggers).
//
// All sweeps are IDEMPOTENT and re-runnable: keyed tasks follow the
// one-OPEN-task-per-reference rule (upsert the open task in place, close it
// when the condition clears, a closed key can be re-raised later — the
// Ledger.gs collections pattern).
//
//   1. Overdue rentals   → status flip + OVERDUE-<rental> task (closed on return)
//   2. Collections       → BALANCE-<customer> task while balance < 0
//   3. Passport expiry   → PASSPORT-<booking> task when expiring within 90 days
//   4. SIM renewals due  → SIMDUE-<sim> task when renewing within 3 days
//   5. VN monthly billing → one ledger charge per billing period
//      (VN-<id>-<YYYY-MM>, idempotent), next_billing_date advances +1 month
//   6. Carrier email needing a human → rolling SIMNEW / SIMPAIR tasks from the
//      sim_mail rows /api/inbound/mail could not pair with certainty
//   7. SMS that never arrived → rolling SMSFAIL task from the delivery results
//      /api/sms-status writes back onto email_log
//   8. KC's OWN subscriptions → SUBDUE-<account> when one renews within 7 days,
//      plus a rolling SUBGAPS task counting the ones with no renewal date at all
//      (business_accounts — Vercel, Twilio, Supabase, Gemini and the rest)
//
// Callers: Vercel Cron (Authorization: Bearer CRON_SECRET — note crons fire
// only on PRODUCTION deployments), or a signed-in staff member (the "Run
// sweeps now" button, which is also how previews test this).

import crypto from 'node:crypto'
import { db, tablesMode } from '../../../lib/db.js'
import { poolCover, poolCoverNote, poolCoverNeedsAction } from '../../../lib/poolCover.mjs'
import { rentalStage, readinessDue, RETURN_GRACE_DAYS } from '../../../lib/rentalStage.mjs'

// The stage rule speaks the app's shape; the sweep reads database rows. One
// adapter, so the two cannot disagree about which date is which.
const asStageRental = (r) => ({
  status: r.status,
  fromDate: r.start_date || null,
  toDate: r.end_date || null,
  pickupDate: (r.legacy_extras && r.legacy_extras.pickupDate) || null,
})

// Days past its return date before a phone is chased rather than simply waited
// for. Owner-editable in Settings; the lib constant is the fallback so a sweep
// still runs if the row is missing.
async function returnGraceDays() {
  try {
    const rows = await db.select('settings', 'select=num_value&key=eq.rental_return_grace_days')
    const n = rows.length ? Number(rows[0].num_value) : NaN
    return Number.isFinite(n) ? Math.max(0, n) : RETURN_GRACE_DAYS
  } catch { return RETURN_GRACE_DAYS }
}
import { resolveStaff } from '../../../lib/auth.js'
import { advanceOneMonth, advancePastDate } from '../../../lib/money.mjs'
import { displayDate } from '../../../lib/localDay.mjs'
import { requirementFor, coverageStatus, KNOWN_DESTINATIONS } from '../../../lib/travelRules.mjs'
import { loadTravelRules } from '../../../lib/travelRulesDb.js'
import { buildSimIndex, matchSimForMail, simMatchRow } from '../../../lib/simMailMatch.mjs'
import { customerDrift, simDrift, rentalDrift, lineDrift } from '../../../lib/mappers.js'
import { sendSms } from '../../../lib/sms.js'
import { autoSmsGate, autoSmsBody, autoSmsKey, SMS_TRIGGERS } from '../../../lib/autoSms.mjs'

const DEST_NAME = Object.fromEntries(KNOWN_DESTINATIONS.map(d => [d.code, d.name]))
const RECORDABLE = new Set(['ESTA', 'ETA_CA', 'ETA_IL', 'ETIAS', 'ETA_UK'])

const enc = encodeURIComponent
const localDate = (offsetDays = 0) => {
  const d = new Date(Date.now() + offsetDays * 86400000)
  // Shop-local calendar date; Vercel functions run in UTC, the shop is UK.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(d)
}

// Read an entire filtered result set, PAGED past PostgREST's 1000-row default
// cap — an unbounded SELECT silently stops at the cap. `tail` is everything
// after the column list (filters + a stable order); pages walk until a short
// page proves the end. (An exact multiple of PAGE does one harmless empty read.)
async function selectAllPaged(table, cols, tail) {
  const PAGE = 1000
  const out = []
  for (let offset = 0; ; offset += PAGE) {
    const page = await db.select(table, `select=${cols}&${tail}&limit=${PAGE}&offset=${offset}`)
    if (!Array.isArray(page) || !page.length) break
    out.push(...page)
    if (page.length < PAGE) break
  }
  return out
}

// Every customer currently in debt (balance < 0). The collections sweep must
// raise a task for each one, so this can't truncate at the cap.
async function allDebtorBalances() {
  return selectAllPaged('customer_balances', 'customer_id,balance', 'balance=lt.0&order=customer_id.asc')
}

async function upsertOpenTask({ reference, title, customerUuid = null, priority = 'high', notes = '', dueDate = null }) {
  const open = await db.select('tasks', `select=id&reference=eq.${enc(reference)}&done=is.false`)
  if (open.length) {
    await db.update('tasks', `id=eq.${open[0].id}`, {
      title, raw_text: notes || null, priority, ...(dueDate ? { due_date: dueDate } : {}),
    })
    return 'updated'
  }
  await db.insert('tasks', [{
    title,
    customer_id: customerUuid,
    due_date: dueDate || localDate(),
    source: 'auto',
    priority,
    raw_text: notes || null,
    reference,
  }])
  return 'created'
}

async function closeOpenTask(reference) {
  const rows = await db.update(
    'tasks',
    `reference=eq.${enc(reference)}&done=is.false`,
    { done: true, done_at: new Date().toISOString() }
  )
  return rows.length
}

// Fill {name}/{n} in a rule's title template.
function fillTitle(tpl, fallback, name, n) {
  const base = (tpl && tpl.trim()) || fallback
  return base.replace(/\{name\}/g, name || '?').replace(/\{n\}/g, String(n))
}

// Evaluate every enabled automation rule. Returns what it raised and, for the
// rules that text, what it sent or would have sent.
//
// A rule's `action` decides which. 'create_task' is what every rule did until
// 26 Aug and what all but two triggers can still do. 'send_sms' texts the
// customer — and gets there through four locks, three of which are outside this
// function: the rule has to carry the action, AUTO_SMS_LIVE has to be set, and
// SMS_LIVE governs sendSms underneath as it does for a receipt. The fourth,
// the quiet-day check, is here. See lib/autoSms.mjs.
async function runCustomRules({ today, names, debtors = [] }) {
  const rules = await db.select('automation_rules', 'enabled=is.true')
  let raised = 0
  const texts = { sent: 0, wouldSend: 0, skipped: 0, why: autoSmsGate(today).why, samples: [] }
  const keep = new Set() // references that should stay open after this run

  for (const rule of rules) {
    const n = Number(rule.threshold) || 0
    const priority = rule.priority || 'high'
    const textsCustomer = rule.action === 'send_sms' && SMS_TRIGGERS.includes(rule.trigger)

    // The SMS half. `fields` is what the message needs; the caller already has
    // the row in hand, so nothing is re-read.
    const text = async (entityId, customerUuid, fields) => {
      const body = autoSmsBody(rule.trigger, fields)
      if (!body) { texts.skipped++; return }
      const gate = autoSmsGate(today)
      if (!gate.send) {
        // NOT armed, or a quiet day. Compose it anyway and keep a sample: a
        // feature nobody has seen run is a feature nobody trusts, and the whole
        // point of the dry run is that the owner can read a week of what it
        // WOULD have said before switching it on.
        texts.wouldSend++
        if (texts.samples.length < 3) texts.samples.push(body)
        return
      }
      // One text per customer per event, for ever — claimed BEFORE the send, so
      // a retry or a second sweep in the same day cannot text twice. The key
      // outlives the task: a closed and re-raised PASSPORT does not re-text.
      const fresh = await db.claimKey(autoSmsKey(rule.id, entityId), { scope: 'auto-sms', customerId: customerUuid })
      if (!fresh) { texts.skipped++; return }
      const to = fields.phone
      if (!to) { texts.skipped++; return }
      // Through sendSms, never a provider: HOLD, TEST and the suppression list
      // all behave exactly as they do for any other message the shop sends.
      const r = await sendSms({ to, body, customerId: customerUuid }).catch(() => null)
      if (r && r.success) texts.sent++
      else {
        texts.skipped++
        // Release the key so a failed send can be retried tomorrow rather than
        // being remembered as done.
        await db.releaseKey(autoSmsKey(rule.id, entityId)).catch(() => {})
      }
    }

    const raise = async (entityId, title, customerUuid, dueDate, fields = null) => {
      // A texting rule does not also raise a task. The task exists to make a
      // person do the thing; if the customer has been told, the thing is done.
      if (textsCustomer && fields) { await text(entityId, customerUuid, fields); return }
      const reference = `RULE-${rule.id}-${entityId}`
      keep.add(reference)
      await upsertOpenTask({ reference, title, customerUuid, priority, dueDate,
        notes: `Automation: ${rule.name}` })
      raised++
    }

    if (rule.trigger === 'balance_over') {
      // Reuse the paged debtor list built in §2 — only debtors can trip an
      // "owes £N+" rule, and re-reading customer_balances unbounded here had the
      // same 1000-row truncation risk.
      for (const b of debtors) {
        const owed = -Number(b.balance) // positive = owes
        if (owed >= n && n > 0) {
          await raise(b.customer_id,
            fillTitle(rule.task_title, `Owes £{n}+ — {name}`, names.get(b.customer_id), owed.toFixed(2)),
            b.customer_id)
        }
      }
    } else if (rule.trigger === 'rental_overdue_days') {
      const rows = await db.select('rentals',
        `select=id,end_date,customer_id,customers(first_name,last_name)&status=eq.overdue&is_void=is.false&end_date=lte.${localDate(-n)}`)
      for (const r of rows) {
        const nm = r.customers ? `${r.customers.first_name || ''} ${r.customers.last_name || ''}`.trim() : '?'
        await raise(r.id, fillTitle(rule.task_title, `Overdue {n}+ days — {name}`, nm, n), r.customer_id, r.end_date)
      }
    } else if (rule.trigger === 'flight_in_days') {
      const rows = await db.select('bookings',
        `select=id,passenger,route,travel_date,customer_id,customers(first_name,last_name)&status=neq.Cancelled&travel_date=gte.${today}&travel_date=lte.${localDate(n)}`)
      for (const b of rows) {
        const nm = b.passenger || (b.customers ? `${b.customers.first_name || ''} ${b.customers.last_name || ''}`.trim() : '?')
        await raise(b.id, fillTitle(rule.task_title, `Flight in {n}d — {name} (${b.route})`, nm, n), b.customer_id, b.travel_date)
      }
    } else if (rule.trigger === 'passport_in_days') {
      // travel_date and the phone come along only because a texting rule needs
      // them; the task path ignores both. Asking for two more columns costs
      // nothing and saves a second read per booking.
      const rows = await db.select('bookings',
        `select=id,passenger,passport_expiry,travel_date,customer_id,customers(first_name,last_name,phone_number)&status=neq.Cancelled&passport_expiry=gte.${today}&passport_expiry=lte.${localDate(n)}`)
      for (const b of rows) {
        const nm = b.passenger || (b.customers ? `${b.customers.first_name || ''} ${b.customers.last_name || ''}`.trim() : '?')
        await raise(b.id, fillTitle(rule.task_title, `Passport expires in {n}d — {name}`, nm, n), b.customer_id, b.passport_expiry, {
          // The customer's own name, not the passenger's: the text goes to the
          // person whose phone it is, and on a family booking those differ.
          name: b.customers ? `${b.customers.first_name || ''} ${b.customers.last_name || ''}`.trim() : nm,
          when: displayDate(b.passport_expiry),
          travel: b.travel_date ? displayDate(b.travel_date) : '',
          phone: b.customers?.phone_number || '',
        })
      }
    } else if (rule.trigger === 'sim_renewal_in_days') {
      const rows = await db.select('sims',
        `select=id,provider,next_renewal_date,customer_id,customers(first_name,last_name,phone_number)&status=eq.active&next_renewal_date=gte.${today}&next_renewal_date=lte.${localDate(n)}`)
      for (const s of rows) {
        const nm = s.customers ? `${s.customers.first_name || ''} ${s.customers.last_name || ''}`.trim() : '?'
        await raise(s.id, fillTitle(rule.task_title, `SIM renews in {n}d — {name} (${s.provider || 'SIM'})`, nm, n), s.customer_id, s.next_renewal_date, {
          name: nm,
          when: displayDate(s.next_renewal_date),
          provider: s.provider || '',
          phone: s.customers?.phone_number || '',
        })
      }
    } else if (rule.trigger === 'checkin_due') {
      const rows = await db.select('bookings',
        `select=id,passenger,route,checkin_date,customer_id,customers(first_name,last_name)&status=neq.Cancelled&checkin_by=eq.us&checkin_done=is.false&checkin_date=lte.${localDate(n)}`)
      for (const b of rows) {
        const nm = b.passenger || (b.customers ? `${b.customers.first_name || ''} ${b.customers.last_name || ''}`.trim() : '?')
        await raise(b.id, fillTitle(rule.task_title, `Check in {name} — ${b.route}`, nm, n), b.customer_id, b.checkin_date)
      }
    } else {
      continue // unknown trigger — skip
    }
  }

  // Close EVERY open rule task that no rule re-raised this run — including tasks
  // orphaned by a rule that was disabled, deleted, or given an unknown trigger.
  // Those rules aren't iterated above, so the old per-rule close never reached
  // them and their tasks stayed open forever. audit C11.
  const open = await db.select('tasks', 'select=id,reference&done=is.false&reference=like.RULE-*')
  for (const t of open) if (!keep.has(t.reference)) await closeOpenTask(t.reference)
  return { raised, texts }
}

async function handler(req, res) {
  if (!tablesMode) {
    return res.status(503).json({ success: false, error: 'Sweeps need the relational data layer.' })
  }

  // Auth: Vercel Cron bearer OR a signed-in staff member. The secret compare
  // is timing-safe, matching check2faTicket (sweep 2026-08-02 #12).
  const cronSecret = (process.env.CRON_SECRET || '').trim()
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  const a = Buffer.from(bearer)
  const b = Buffer.from(cronSecret)
  const isCron = !!cronSecret && a.length === b.length && crypto.timingSafeEqual(a, b)
  // Cookie-authenticated runs must be POST: the session cookie is SameSite=Lax,
  // which rides along on a top-level cross-site GET, so a crafted link could run
  // the sweep as whoever clicked it (sweep 2026-08-02 #10). The app already
  // POSTs; only Vercel Cron calls with GET, and it authenticates by bearer.
  if (!isCron && req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Sweeps run with POST.' })
  }
  const staff = isCron ? null : await resolveStaff(req)
  if (!isCron && !staff) {
    return res.status(401).json({ success: false, error: 'Not authorised to run sweeps.' })
  }

  const today = localDate()
  const counts = {}
  const errors = {}
  // Shared across sections (built in §2, read in §6). Hoisted so a §2 failure
  // leaves safe defaults instead of crashing later sections.
  let names = new Map()
  let custRows = []
  let debtors = []

  // Run one sweep section in isolation: a thrown error is recorded and the
  // remaining sections still run. The sweep is idempotent, so a section that
  // fails today simply retries on the next run instead of blocking the rest
  // of the automation heartbeat.
  const section = async (label, fn) => {
    try { await fn() }
    catch (e) {
      errors[label] = String((e && e.message) || e)
      console.error(`[cron/sweep] section "${label}" failed:`, e)
    }
  }

  try {
    await section('overdue', async () => {
    // ── 1. Overdue rentals ──
    //
    // The stored status still flips the morning after the dates end, and it has
    // to: `overdue` is what keeps the handset counted as out rather than back on
    // the shelf. What changed is when the shop gets TOLD.
    //
    // Shloime, 27 Aug: "the person is back, but hasnt retuned the phone/sim, so
    // the line doesnt have to be actively running, but still its not available
    // yet until physically back". A customer who landed last night and will drop
    // the phone in on his way past is not a problem to chase, so the task waits
    // out the grace window (Settings → rental_return_grace_days). The rentals
    // list says "Home — phone out 2d" in the meantime.
    const flipped = await db.update(
      'rentals',
      `status=eq.active&end_date=lt.${today}`,
      { status: 'overdue' }
    )
    counts.rentalsFlippedOverdue = flipped.length

    const grace = await returnGraceDays()
    counts.returnGraceDays = grace
    const chaseFrom = localDate(-grace)
    const overdue = await db.select(
      'rentals',
      `select=id,legacy_id,end_date,customer_id,customers(first_name,last_name)`
        + `&status=eq.overdue&is_void=is.false&end_date=lt.${chaseFrom}`
    )
    let overdueTasks = 0
    for (const r of overdue) {
      const name = r.customers ? `${r.customers.first_name || ''} ${r.customers.last_name || ''}`.trim() : '?'
      await upsertOpenTask({
        reference: `OVERDUE-${r.id}`,
        title: `Rental overdue — ${name} (due ${displayDate(r.end_date)})`,
        customerUuid: r.customer_id,
        notes: `Rental ${r.legacy_id || r.id} was due back ${r.end_date}`
             + (grace > 0 ? `, more than ${grace} day${grace === 1 ? '' : 's'} ago.` : '.'),
      })
      overdueTasks++
    }
    counts.overdueTasks = overdueTasks

    // ── Pools that will not last the hire ──────────────────────────────────
    //
    // Shloime, 27 Aug: a rental much longer than its pool's validity was not
    // flagged anywhere. The app knew this at the moment of CHOOSING a phone —
    // poolPhoneSuggestions ranks candidates on exactly this overlap and will say
    // "risky, service may cut out mid-trip" — and then never looked again. So a
    // hire that outlasts its pool sat in the list looking like one that does
    // not, until the customer rang from abroad with no service.
    //
    // The decision is lib/poolCover.mjs, shared with the rentals row so the
    // badge and this task can never disagree about the same rental.
    // Reservations are in scope now, because a rental that has been collected
    // is stored as `active` whatever its travel date — the stage is derived
    // from the dates, not from the stored status.
    const liveRentals = await db.select(
      'rentals',
      'select=id,legacy_id,start_date,end_date,customer_id,line_id,legacy_extras,customers(first_name,last_name),'
        + 'lines(number,pool_id,renewal_date)&status=in.(booked,active,overdue)&is_void=is.false'
    )
    const poolWanted = new Set()
    let poolTasks = 0
    for (const r of liveRentals) {
      const line = r.lines
      if (!line || !line.pool_id) continue          // not a pooled line — nothing to expire
      // Nothing is asked about a line until the trip is running or starts
      // within 24 hours. A phone collected a fortnight early, sitting at home
      // with an unactivated pool, is not a problem — and a task saying it is
      // teaches people to close tasks without reading them.
      if (!readinessDue(asStageRental(r), localDate(), grace)) continue
      const state = poolCover(line.renewal_date || null, r.end_date || null, localDate())
      if (!poolCoverNeedsAction(state)) continue
      const name = r.customers ? `${r.customers.first_name || ''} ${r.customers.last_name || ''}`.trim() : '?'
      const ref = `POOLEXP-${r.id}`
      poolWanted.add(ref)
      const icon = state === 'soon' ? '⏳' : '⚠️'
      await upsertOpenTask({
        reference: ref,
        title: `${icon} Pool ${state === 'expired' ? 'has run out' : state === 'short' ? 'ends before this comes back' : 'ends within a week'} — ${name} (${line.number || 'line'})`,
        customerUuid: r.customer_id,
        priority: state === 'soon' ? 'medium' : 'high',
        notes: poolCoverNote(state, line.renewal_date || null, r.end_date || null, localDate()),
        dueDate: line.renewal_date || null,
      })
      poolTasks++
    }
    counts.poolTasks = poolTasks

    // ── Trips starting tomorrow ────────────────────────────────────────────
    //
    // Shloime's other half of the same ask: "only when the date for that
    // reservation comes, 24hr before it should be raised - color plus task".
    // The badge on the row is the colour; this is the task.
    const handoverWanted = new Set()
    let handoverTasks = 0
    for (const r of liveRentals) {
      const sr = asStageRental(r)
      if (rentalStage(sr, localDate(), false, grace) !== 'fetched') continue
      if (!readinessDue(sr, localDate(), grace)) continue
      const name = r.customers ? `${r.customers.first_name || ''} ${r.customers.last_name || ''}`.trim() : '?'
      const ref = `HANDOVER-${r.id}`
      handoverWanted.add(ref)
      await upsertOpenTask({
        reference: ref,
        title: `✈️ Travels tomorrow — check ${name}'s line is live (${r.lines?.number || 'line'})`,
        customerUuid: r.customer_id,
        notes: `Collected ${sr.pickupDate || 'earlier'}, travels ${r.start_date}. `
             + 'Nothing was raised while it sat at home; it is worth a look now.',
        dueDate: r.start_date || null,
      })
      handoverTasks++
    }
    counts.handoverTasks = handoverTasks
    const openHandover = await db.select('tasks', 'select=id,reference&done=is.false&reference=like.HANDOVER-*')
    let handoverClosed = 0
    for (const t of openHandover) {
      if (handoverWanted.has(t.reference)) continue
      await closeOpenTask(t.reference)
      handoverClosed++
    }
    counts.handoverClosed = handoverClosed

    // …and close the ones whose rental came back, or whose pool was renewed.
    // Same shape as the OVERDUE close below: a task nobody closed is a task
    // nobody trusts.
    const openPool = await db.select('tasks', 'select=id,reference&done=is.false&reference=like.POOLEXP-*')
    let poolClosed = 0
    for (const t of openPool) {
      if (poolWanted.has(t.reference)) continue
      await closeOpenTask(t.reference)
      poolClosed++
    }
    counts.poolClosed = poolClosed

    // Close OVERDUE tasks whose rental has since been returned/voided.
    const openOverdue = await db.select('tasks', 'select=id,reference&done=is.false&reference=like.OVERDUE-*')
    let overdueClosed = 0
    for (const t of openOverdue) {
      const rentalId = t.reference.slice('OVERDUE-'.length)
      const row = await db.select('rentals', `select=status,is_void&id=eq.${enc(rentalId)}`)
      if (!row.length || row[0].status === 'returned' || row[0].is_void) {
        overdueClosed += await closeOpenTask(t.reference)
      }
    }
    counts.overdueClosed = overdueClosed
    })

    await section('collections', async () => {
    // ── 2. Collections (BALANCE-<customer>) ──
    // Only debtors matter here (and for the §6 balance rules). Fetch them paged
    // — never the whole balances/customers tables, which truncate at 1000 rows.
    debtors = await allDebtorBalances()
    const debtorIds = new Set(debtors.map(b => b.customer_id))
    const ids = [...debtorIds]
    // Names + contact fields for just the debtors — a bounded id-set read, not
    // the full table. Contact fields feed the unreachable-debtor flag below.
    custRows = ids.length
      ? await db.select('customers', `select=id,first_name,last_name,phone_number,email_normalized&id=in.(${ids.map(enc).join(',')})`)
      : []
    names = new Map(custRows.map(c => [c.id, `${c.first_name || ''} ${c.last_name || ''}`.trim()]))
    // A debtor with neither phone nor email can't be chased by ANY channel —
    // flag it on the task so staff learn at a glance, not after opening the
    // card, and each shop visit becomes the moment the number gets captured.
    const unreachable = new Set(
      custRows.filter(c => !c.phone_number && !c.email_normalized).map(c => c.id)
    )
    let balCreated = 0, balClosed = 0
    for (const b of debtors) {
      const bal = Number(b.balance)
      const noContact = unreachable.has(b.customer_id)
      await upsertOpenTask({
        reference: `BALANCE-${b.customer_id}`,
        title: `Outstanding balance — ${names.get(b.customer_id) || '?'} — £${Math.abs(bal).toFixed(2)}${noContact ? ' — ⚠ no contact details' : ''}`,
        customerUuid: b.customer_id,
        notes: `Negative wallet balance £${Math.abs(bal).toFixed(2)}.${noContact ? ' No phone or email on file — capture a phone number at the next visit.' : ''}`,
      })
      balCreated++
    }
    // Close BALANCE tasks for anyone who has since cleared their debt. Drive this
    // off the OPEN tasks (bounded — only current/recent debtors) instead of
    // scanning every customer with a non-negative balance. Paged so a >1000
    // debtor set doesn't leave paid-up customers' tasks stuck open.
    const openBalanceTasks = await selectAllPaged('tasks', 'reference,customer_id',
      'done=is.false&reference=like.BALANCE-*&order=reference.asc')
    for (const t of openBalanceTasks) {
      if (!debtorIds.has(t.customer_id)) balClosed += await closeOpenTask(t.reference)
    }
    counts.balanceTasks = balCreated
    counts.balanceClosed = balClosed
    })

    await section('passport', async () => {
    // ── 3. Passport expiry (within 90 days, not already expired) ──
    const expiring = await db.select(
      'bookings',
      `select=id,passenger,passport_expiry,customer_id,customers(first_name,last_name)` +
      `&passport_expiry=gte.${today}&passport_expiry=lte.${localDate(90)}&status=neq.Cancelled`
    )
    let passportTasks = 0
    for (const b of expiring) {
      const name = b.passenger || (b.customers ? `${b.customers.first_name || ''} ${b.customers.last_name || ''}`.trim() : '?')
      await upsertOpenTask({
        reference: `PASSPORT-${b.id}`,
        title: `Passport expires ${displayDate(b.passport_expiry)} — ${name}`,
        customerUuid: b.customer_id,
        notes: 'Passport on file expires within 90 days.',
        dueDate: b.passport_expiry,
      })
      passportTasks++
    }
    counts.passportTasks = passportTasks
    })

    await section('travelReq', async () => {
    // ── 3c. Travel authorisations (ESTA / eTA / ETA-IL) not recorded, or
    // expiring before an upcoming trip. Uses the same rules as the booking
    // panel (lib/travelRules.mjs). Only the crisp, actionable case raises a
    // task: an authorisation is NEEDED and is missing or expires before the
    // travel date. CHECK / VISA / passport-only never nag here (staff see
    // those in the panel). Key includes the passenger index so two travellers
    // on one booking get their own task; the whole set is recomputed each run
    // and stale ones closed. ~120-day look-ahead.
    const trips = await db.select(
      'bookings',
      `select=id,travel_date,return_date,destination_country,customer_id,` +
      `booking_passengers(full_name,nationality),customers(legacy_id)` +
      `&travel_date=lte.${localDate(120)}` +
      // Trips still to come OR still happening. Somebody already abroad on an
      // ETA that lapses next week can still do something about it, and a
      // window keyed only on the departure date would have stopped looking at
      // them the morning they flew.
      `&or=(travel_date.gte.${today},return_date.gte.${today})` +
      `&destination_country=not.is.null&status=neq.Cancelled`
    )
    const wanted = new Set()
    let travelTasks = 0
    const rules = await loadTravelRules()
    // Cache authorisations per customer so a family's trips don't re-query.
    const authCache = new Map()
    for (const b of trips) {
      const pax = b.booking_passengers || []
      if (!pax.length) continue
      if (!authCache.has(b.customer_id)) {
        authCache.set(b.customer_id,
          await db.select('travel_authorisations', `select=traveller_name,type,valid_until&customer_id=eq.${enc(b.customer_id)}`))
      }
      const allAuths = authCache.get(b.customer_id)
      for (let i = 0; i < pax.length; i++) {
        const p = pax[i]
        const name = (p.full_name || '').trim()
        if (!name) continue
        const req = requirementFor({ destination: b.destination_country, nationality: p.nationality })
        if (!RECORDABLE.has(req.code)) continue
        const mine = allAuths.filter(a => (a.traveller_name || '').trim().toLowerCase() === name.toLowerCase() && a.type === req.code)
        // returnDate: an ETA that runs out mid-holiday is as much a problem
        // as one that had already run out on the day they flew.
        const cov = coverageStatus({ requirement: req, travelDate: b.travel_date, returnDate: b.return_date, auths: mine })
        const needsTask = cov.status === 'missing' || (cov.status === 'expiring' && cov.expiresBeforeTravel)
        if (!needsTask) continue
        const ref = `TRAVELREQ-${b.id}-${i}`
        wanted.add(ref)
        const destName = DEST_NAME[b.destination_country] || b.destination_country
        const title = cov.status === 'missing'
          ? `${req.label} needed — ${name} (${destName}, ${b.travel_date})`
          : cov.expiresDuringTrip
            ? `${req.label} expires mid-trip — ${name} (${destName}, back ${b.return_date})`
            : `${req.label} expires before trip — ${name} (${destName}, ${b.travel_date})`
        await upsertOpenTask({
          reference: ref,
          title,
          customerUuid: b.customer_id,
          notes: 'Record it under the booking’s 🛂 Travel requirements, or send the customer the official link.',
          dueDate: b.travel_date,
        })
        travelTasks++
      }
    }
    counts.travelTasks = travelTasks

    // Close any TRAVELREQ task no longer wanted (recorded now, trip passed,
    // destination cleared, booking cancelled).
    const openTravel = await db.select('tasks', 'select=id,reference&done=is.false&reference=like.TRAVELREQ-*')
    let travelClosed = 0
    for (const t of openTravel) {
      if (!wanted.has(t.reference)) travelClosed += await closeOpenTask(t.reference)
    }
    counts.travelClosed = travelClosed
    })

    // ── Low stock → a task, not just a badge (E1, the alert it was modelled
    // on). The dashboard counts items at or below their warn level and waits to
    // be looked at; Epos Now POSTS the same fact every morning. The task is the
    // push half — it lands on the Tasks screen today and in the morning digest
    // once that is armed. The rule is THE DASHBOARD'S OWN, verbatim
    // (quantity <= low_stock_at, active items only): two answers to "what is
    // low" is the drift this repo keeps paying for.
    await section('stock-low', async () => {
      const items = await db.select('stock_items', 'select=id,company,model,quantity,low_stock_at,active&active=is.true')
      let raised = 0
      const lowIds = new Set()
      for (const i of items) {
        if ((i.quantity ?? 0) > (i.low_stock_at ?? 1)) continue
        lowIds.add(String(i.id))
        const name = `${i.company || ''} ${i.model || ''}`.trim() || 'Stock item'
        await upsertOpenTask({
          reference: `STOCKLOW-${i.id}`,
          title: `Running out — ${name} (${i.quantity ?? 0} left, warns at ${i.low_stock_at ?? 1})`,
          priority: 'medium',
          notes: `Reorder or retire. The count and its story are on the Shop tab (edit the item → 📜 Story).`,
        })
        raised++
      }
      counts.stockLowTasks = raised

      // Close STOCKLOW tasks whose item has been restocked or retired — the
      // shelf recovering is the task being done, whoever did it.
      const open = await db.select('tasks', 'select=id,reference&done=is.false&reference=like.STOCKLOW-*')
      let closed = 0
      for (const t of open) {
        if (!lowIds.has(t.reference.slice('STOCKLOW-'.length))) closed += await closeOpenTask(t.reference)
      }
      counts.stockLowClosed = closed
    })

    await section('pickups', async () => {
    // ── 1b. Reservation pickups due (booked, start date arrived) ──
    const pickups = await db.select(
      'rentals',
      `select=id,legacy_id,start_date,customer_id,customers(first_name,last_name)` +
      `&status=eq.booked&start_date=lte.${today}&is_void=is.false`
    )
    let pickupTasks = 0
    for (const r of pickups) {
      const name = r.customers ? `${r.customers.first_name || ''} ${r.customers.last_name || ''}`.trim() : '?'
      await upsertOpenTask({
        reference: `PICKUP-${r.id}`,
        title: `Reservation pickup — ${name} (from ${displayDate(r.start_date)})`,
        customerUuid: r.customer_id,
        notes: 'Press ▶ Start on the rental when the phone is handed over.',
        dueDate: r.start_date,
      })
      pickupTasks++
    }
    counts.pickupTasks = pickupTasks

    // Close PICKUP tasks once the rental started (or was removed).
    const openPickups = await db.select('tasks', 'select=id,reference&done=is.false&reference=like.PICKUP-*')
    let pickupsClosed = 0
    for (const t of openPickups) {
      const rentalId = t.reference.slice('PICKUP-'.length)
      const row = await db.select('rentals', `select=status&id=eq.${enc(rentalId)}`)
      if (!row.length || row[0].status !== 'booked') {
        pickupsClosed += await closeOpenTask(t.reference)
      }
    }
    counts.pickupsClosed = pickupsClosed
    })

    await section('flights', async () => {
    // ── 3b. Flight-day reminders (flies today or tomorrow) ──
    const flying = await db.select(
      'bookings',
      `select=id,passenger,route,travel_date,departure_time,customer_id,customers(first_name,last_name)` +
      `&travel_date=gte.${today}&travel_date=lte.${localDate(1)}&status=neq.Cancelled`
    )
    let flightTasks = 0
    for (const b of flying) {
      const name = b.passenger || (b.customers ? `${b.customers.first_name || ''} ${b.customers.last_name || ''}`.trim() : '?')
      const dep = b.departure_time ? ` ${String(b.departure_time).slice(0, 5)}` : ''
      await upsertOpenTask({
        reference: `FLIGHT-${b.id}`,
        title: `Flies ${b.travel_date === today ? 'TODAY' : 'tomorrow'} — ${name} (${b.route}${dep})`,
        customerUuid: b.customer_id,
        priority: 'high',
        notes: 'Check phone + SIM handed over; passport & check-in sorted.',
        dueDate: b.travel_date,
      })
      flightTasks++
    }
    counts.flightTasks = flightTasks

    // Auto-complete flown bookings. Time-aware: a flight completes once its
    // departure time has passed on the travel day (not just at midnight).
    //   (a) travel date already in the past, or
    //   (b) travel date is today AND departure_time <= now (or no time set).
    const nowTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date()) + ':00'
    // A ROUND TRIP IS NOT FLOWN WHEN THE OUTBOUND IS. Bookings grew a
    // return_date on 18 Aug, and this rule — untouched since it was written for
    // one-way bookings — would have marked a trip Completed the morning after
    // the flight out, while the customer was abroad with a return leg still to
    // check in for. The journey ends on the last flight, so a booking with a
    // return is judged on THAT date; one without is judged on its only date.
    const flownPast = [
      ...await db.update(
        'bookings',
        `status=in.(Booked,Ticketed)&return_date=is.null&travel_date=lt.${today}`,
        { status: 'Completed' }
      ),
      ...await db.update(
        'bookings',
        `status=in.(Booked,Ticketed)&return_date=lt.${today}`,
        { status: 'Completed' }
      ),
    ]
    // Same on the day itself: only a one-way completes when its departure time
    // passes. A round trip's outbound leaving at 08:25 says nothing about
    // whether the trip is over.
    const flownTodayTimed = await db.update(
      'bookings',
      `status=in.(Booked,Ticketed)&return_date=is.null&travel_date=eq.${today}&departure_time=lte.${nowTime}`,
      { status: 'Completed' }
    )
    // Today with no departure time recorded: leave until midnight (avoids
    // completing a flight that may still be later today).
    counts.bookingsFlown = flownPast.length + flownTodayTimed.length

    // Close FLIGHT tasks once the travel date has passed.
    const openFlights = await db.select('tasks', 'select=id,reference&done=is.false&reference=like.FLIGHT-*')
    let flightsClosed = 0
    for (const t of openFlights) {
      const bookingId = t.reference.slice('FLIGHT-'.length)
      const row = await db.select('bookings', `select=travel_date,return_date,status&id=eq.${enc(bookingId)}`)
      // The last date of the journey, for the same reason as above.
      const ends = row.length ? (row[0].return_date || row[0].travel_date) : null
      if (!row.length || row[0].status === 'Cancelled' || ends < today) {
        flightsClosed += await closeOpenTask(t.reference)
      }
    }
    counts.flightsClosed = flightsClosed
    })

    await section('sim-renewal-advance', async () => {
    // ── 4a. Roll lapsed SIM renewal dates forward (monthly cycle) ──
    // A renewal date is useless the day after it passes: without this the
    // whole renewal stack (SIMDUE tasks, banners, drafts) goes dark again one
    // cycle after the owner fills the dates in. 3-day grace so the SIMDUE
    // "check payment goes through" task survives the renewal itself.
    // renewal_pending lines are in here too: the flip below (4b) parks a line
    // in that status the day its date passes, and THIS is what lets it out —
    // an active-only filter would strand every flipped line in renewal_pending
    // with a date nothing would ever advance again.
    const lapsed = await db.select(
      'sims',
      `select=id,next_renewal_date,legacy_extras&status=in.(active,renewal_pending)&next_renewal_date=lt.${localDate(-3)}`
    )
    let advanced = 0
    for (const s of lapsed) {
      const next = advancePastDate(s.next_renewal_date, localDate(-3))
      if (next === s.next_renewal_date) continue
      // Patch BOTH the typed column and legacy_extras.renewalDate: sims persist
      // by whole-array upsert from the app object (simToRow), so a typed-only
      // patch would be silently reverted on the next admin SIM save.
      await db.update('sims', `id=eq.${enc(s.id)}`, {
        next_renewal_date: next,
        legacy_extras: { ...(s.legacy_extras || {}), renewalDate: next },
      })
      advanced++
    }
    counts.simRenewalsAdvanced = advanced
    })

    await section('sim-renewal-pending', async () => {
    // ── 4b. Status follows the date (issue #13, owner 23 Aug: "set it
    // automatically when next_renewal_date passes") ──
    //
    // The day a line's renewal date passes, it goes renewal_pending: the staff
    // list shows "Renewal due" and the customer portal warns in both
    // languages. It comes BACK by the same rule the moment the date is ahead
    // again — whether a person pushed it forward or 4a rolled it after the
    // 3-day grace — so the status is never something anybody has to remember
    // to reset. Both writes patch legacy_extras.status too: sims persist by
    // whole-array upsert from the app blob, so a typed-only flip would be
    // reverted by the next admin SIM save (same trap as renewalDate in 4a).
    const goPending = await db.select(
      'sims',
      `select=id,legacy_extras&status=eq.active&next_renewal_date=lt.${today}`
    )
    for (const s of goPending) {
      await db.update('sims', `id=eq.${enc(s.id)}`, {
        status: 'renewal_pending',
        legacy_extras: { ...(s.legacy_extras || {}), status: 'renewal_pending' },
      })
    }
    const goActive = await db.select(
      'sims',
      `select=id,legacy_extras&status=eq.renewal_pending&or=(next_renewal_date.gte.${today},next_renewal_date.is.null)`
    )
    for (const s of goActive) {
      await db.update('sims', `id=eq.${enc(s.id)}`, {
        status: 'active',
        legacy_extras: { ...(s.legacy_extras || {}), status: 'active' },
      })
    }
    counts.simsRenewalPending = goPending.length
    counts.simsRenewalCleared = goActive.length
    })

    await section('sim-renewals', async () => {
    // ── 4. SIM renewals due within 3 days ──
    const renewing = await db.select(
      'sims',
      `select=id,provider,next_renewal_date,paid_by,customer_id,customers(first_name,last_name)` +
      `&status=eq.active&next_renewal_date=gte.${today}&next_renewal_date=lte.${localDate(3)}`
    )
    let simTasks = 0
    for (const s of renewing) {
      const name = s.customers ? `${s.customers.first_name || ''} ${s.customers.last_name || ''}`.trim() : '?'
      await upsertOpenTask({
        reference: `SIMDUE-${s.id}`,
        title: `SIM renews ${displayDate(s.next_renewal_date)} — ${name} (${s.provider || 'SIM'})${s.paid_by === 'kc' ? ' — KC pays' : ''}`,
        customerUuid: s.customer_id,
        priority: s.paid_by === 'kc' ? 'high' : 'medium',
        notes: 'Renewal due — check payment goes through.',
        dueDate: s.next_renewal_date,
      })
      simTasks++
    }
    counts.simRenewalTasks = simTasks

    // Close SIMDUE tasks that no longer apply (renewed / cancelled).
    const openSimDue = await db.select('tasks', 'select=id,reference&done=is.false&reference=like.SIMDUE-*')
    let simClosed = 0
    for (const t of openSimDue) {
      const simId = t.reference.slice('SIMDUE-'.length)
      const row = await db.select('sims', `select=status,next_renewal_date&id=eq.${enc(simId)}`)
      // renewal_pending is the renewal actually HAPPENING — closing its
      // "check payment goes through" task then would be exactly backwards.
      const stale = !row.length || !['active', 'renewal_pending'].includes(row[0].status) ||
        !row[0].next_renewal_date || row[0].next_renewal_date > localDate(3)
      if (stale) simClosed += await closeOpenTask(t.reference)
    }
    counts.simClosed = simClosed
    })

    await section('vn-billing', async () => {
    // ── 5. Standalone-VN monthly billing ──
    // Post one charge per elapsed billing period. Refs carry the period
    // (VN-<id>-<YYYY-MM of the billing date>), so re-runs and catch-up after
    // missed days are safe; the date pointer only advances after posting.
    const billableVNs = await db.select(
      'virtual_numbers',
      `select=id,number,monthly_price,next_billing_date,customer_id,bundle_label,plan,billing_anchor_day` +
      `&billing_enabled=is.true&status=eq.Active&customer_id=not.is.null` +
      `&monthly_price=gt.0&next_billing_date=lte.${today}`
    )
    let vnCharges = 0
    for (const vn of billableVNs) {
      // Isolate each VN: a bad row (missing customer, malformed date) is
      // recorded but never stops billing the remaining virtual numbers.
      try {
        let bill = vn.next_billing_date
        // Immutable anchor day so a month-end subscription doesn't drift earlier
        // forever (audit C15). Self-heal rows the backfill migration missed.
        let anchorDay = vn.billing_anchor_day != null
          ? Number(vn.billing_anchor_day)
          : Number(String(vn.next_billing_date).slice(8, 10))
        if (!(anchorDay >= 1 && anchorDay <= 31)) anchorDay = undefined
        if (vn.billing_anchor_day == null && anchorDay) {
          await db.update('virtual_numbers', `id=eq.${vn.id}`, { billing_anchor_day: anchorDay }).catch(() => {})
        }
        // Catch up every period due to date (guard: max 24 to bound a bad date).
        for (let i = 0; i < 24 && bill <= today; i++) {
          await db.insertIgnoreDup('ledger', [{
            customer_id: vn.customer_id,
            charge_reference: `VN-${vn.id}-${bill.slice(0, 7)}`,
            entry_type: 'virtual_number',
            amount: -Number(vn.monthly_price),
            description: `Virtual number ${vn.number}${vn.bundle_label ? ` (${vn.bundle_label}${vn.plan ? ', ' + vn.plan.replace(/_/g, ' ') : ''})` : ''} — month from ${bill}`,
          }], 'charge_reference')
          vnCharges++
          // advanceOneMonth clamps to the month end instead of overflowing:
          // 31 Jan -> 28 Feb, never rolling to March and skipping February's
          // charge (the setUTCMonth bug this replaces).
          bill = advanceOneMonth(bill, anchorDay)
          await db.update('virtual_numbers', `id=eq.${vn.id}`, { next_billing_date: bill })
        }
      } catch (e) {
        errors[`vn-${vn.id}`] = String((e && e.message) || e)
        console.error(`[cron/sweep] VN ${vn.id} billing failed:`, e)
      }
    }
    counts.vnChargesPosted = vnCharges
    })

    await section('house-accounts', async () => {
    // ── Owner #2: house accounts ──
    // A customer clears their wallet monthly on a set day, by their saved
    // card. From that day until the month is settled, an open
    // HOUSE-<uuid>-<YYYY-MM> task asks for the settlement — the charge itself
    // stays a human action (off-session card charging is owner-only). The
    // task closes itself once houseAccount.lastSettled stamps the month.
    const ym = today.slice(0, 7)
    const dom = Number(today.slice(8, 10))
    const haRows = await selectAllPaged('customers', 'id,first_name,last_name,legacy_extras',
      `legacy_extras->houseAccount->>enabled=eq.true&order=id.asc`)
    let haCreated = 0, haClosed = 0
    for (const c of haRows) {
      const ha = (c.legacy_extras || {}).houseAccount || {}
      const day = Math.min(28, Math.max(1, Number(ha.day) || 1))
      const name = `${c.first_name || ''} ${c.last_name || ''}`.trim()
      const ref = `HOUSE-${c.id}-${ym}`
      if (dom >= day && ha.lastSettled !== ym) {
        await upsertOpenTask({
          reference: ref,
          title: `💳 House account — settle ${name}'s month`,
          customerUuid: c.id,
          notes: `Monthly settlement day ${day}${ha.min ? ` · min £${ha.min}` : ''}${ha.max ? ` · max £${ha.max}` : ''}. Customer card → 💳 Settle month charges the saved card and prints the statement.`,
        })
        haCreated++
      } else if (ha.lastSettled === ym) {
        haClosed += await closeOpenTask(ref)
      }
    }
    counts.houseAccountTasks = haCreated
    counts.houseAccountClosed = haClosed
    })

    await section('own-subscriptions', async () => {
    // ── 8. KC's own subscriptions ──
    // Owner, 25 Aug 2026. Every other sweep here watches a CUSTOMER's dates —
    // their rental back, their SIM renewing, their passport expiring. Nothing
    // watched the shop's own bills, and those are the ones that take the shop
    // off the air: Vercel or Supabase lapsing is the site down, Twilio lapsing
    // is no SMS. A register that lists what the shop uses without ever telling
    // anyone it is about to renew is a spreadsheet, not an alarm.
    //
    // Seven days rather than the SIM sweep's three, because a failed card on an
    // infrastructure account needs a working week to fix, not a weekend.
    const OWN_SUB_DAYS = 7
    const subs = await db.select('business_accounts',
      `select=id,name,category,monthly_cost,billing_period,renewal_date,held_by` +
      `&active=is.true&renewal_date=not.is.null` +
      `&renewal_date=gte.${today}&renewal_date=lte.${localDate(OWN_SUB_DAYS)}`)
    let subTasks = 0
    for (const a of subs) {
      // Cost is only quotable with its period attached — "£20" against an
      // annual bill read as monthly overstates the run rate by twelve.
      const cost = a.monthly_cost != null && a.billing_period
        ? ` — £${Number(a.monthly_cost).toFixed(2)}/${a.billing_period === 'annual' ? 'yr' : 'mo'}`
        : ''
      await upsertOpenTask({
        reference: `SUBDUE-${a.id}`,
        title: `${a.name} renews ${displayDate(a.renewal_date)}${cost}`,
        priority: 'high',
        notes: `The shop's own subscription${a.held_by ? ` — held by ${a.held_by}` : ''}. `
             + 'Check the card on file is live and the plan is still the one you want.',
        dueDate: a.renewal_date,
      })
      subTasks++
    }
    counts.ownSubscriptionTasks = subTasks

    // Close the ones that renewed, were switched off, or had their date cleared.
    const openSub = await db.select('tasks', 'select=id,reference&done=is.false&reference=like.SUBDUE-*')
    let subClosed = 0
    for (const t of openSub) {
      const id = t.reference.slice('SUBDUE-'.length)
      const row = await db.select('business_accounts', `select=active,renewal_date&id=eq.${enc(id)}`)
      const stale = !row.length || !row[0].active || !row[0].renewal_date ||
        row[0].renewal_date > localDate(OWN_SUB_DAYS) || row[0].renewal_date < today
      if (stale) subClosed += await closeOpenTask(t.reference)
    }
    counts.ownSubscriptionClosed = subClosed

    // ── the gap itself, as ONE task rather than fifteen ──
    // On 25 Aug 2026 fifteen of sixteen active accounts had no renewal date, so
    // the sweep above could not see a single one. Raising a task per account
    // would bury the morning list under the very problem it is reporting; one
    // rolling task states the number and closes itself when it reaches zero.
    const blind = await db.select('business_accounts',
      'select=id,name&active=is.true&renewal_date=is.null&order=category.asc,name.asc')
    if (blind.length) {
      const names = blind.slice(0, 6).map(a => a.name).join(', ')
      await upsertOpenTask({
        reference: 'SUBGAPS',
        title: `${blind.length} of the shop's own subscriptions have no renewal date`,
        priority: 'medium',
        notes: `Nothing can warn you before these renew: ${names}`
             + `${blind.length > 6 ? `, and ${blind.length - 6} more` : ''}. `
             + 'Settings → Accounts & subscriptions. The dates are on the invoices.',
      })
    } else {
      await closeOpenTask('SUBGAPS')
    }
    counts.ownSubscriptionsBlind = blind.length
    })

    await section('sim-mail', async () => {
    // ── 6. Carrier email that needs a human ──
    // /api/inbound/mail files every message against the SIM it names, but two
    // piles need eyes: 'ambiguous' (a pool address shared by up to 37 SIMs,
    // with no number in the text to narrow it) and 'unknown' (a number live at
    // a carrier that the app has never heard of — the July sweep found 241).
    //
    // ONE rolling task per pile, not one per message. Lebara alone mails
    // hundreds of times a month; a task each would bury the list it lives in.
    // The count is the signal, the numbers are in the notes.
    // ── first, try the queue again against TODAY's SIM list ──
    //
    // Pairing happens once, at the moment a message lands, and it is only ever
    // as good as the SIM list at that instant. Two things change afterwards:
    // somebody adds the SIM the message was about, and — 18 Aug — the matcher
    // itself gets better. Neither reached the pile already sitting in the
    // queue, so a message filed as unpairable stayed unpairable for ever, and
    // the only way out was a human clicking it.
    //
    // So the queue is re-read here every night. Nothing is guessed at: this
    // calls exactly the same matcher the webhook does, on the same envelope
    // (`route` holds every recipient the message arrived with), and only a
    // result certain enough to carry a sim_id is written back. An ambiguous
    // message stays ambiguous.
    let repaired = 0
    const simRows = await selectAllPaged('sims',
      'id,customer_id,legacy_extras,alt_emails,master_accounts(account_email)', 'order=id.asc')
    // The same builder the queue and the inbound hook use, or the nightly pass
    // reaches a different answer from the screen and re-opens settled questions.
    const simIndex = buildSimIndex(simRows.map(simMatchRow))
    const customerBySim = new Map(simRows.map((r) => [String(r.id), r.customer_id]))
    // `unpaired_at=is.null` — a message a PERSON has unfiled is left alone. It
    // is in exactly the state this pass hunts for, so without that filter the
    // sweep would re-file it on the SIM the human just rejected, and the undo
    // would quietly undo itself overnight.
    const stuck = await selectAllPaged(
      'sim_mail', 'id,recipient,route,subject,snippet',
      'resolved_at=is.null&sim_id=is.null&unpaired_at=is.null&order=id.asc'
    )
    for (const m of stuck) {
      const envelope = (m.route && m.route.length ? m.route : [m.recipient]).filter(Boolean).join(',')
      if (!envelope) continue
      const again = matchSimForMail(
        { to: envelope, subject: m.subject || '', snippet: m.snippet || '' }, simIndex
      )
      if (!again.simId) continue
      await db.update('sim_mail', `id=eq.${m.id}`, {
        sim_id: again.simId,
        customer_id: customerBySim.get(String(again.simId)) || null,
        confidence: again.confidence,
        // A pair by NUMBER must not stamp the pool address the envelope merely
        // crossed over the address the carrier actually wrote to — same rule
        // as the inbound hook (the gitt.bilig masking, 23 Aug).
        recipient: (again.confidence !== 'number' && again.matchedOn) || m.recipient,
      })
      repaired++
    }
    if (repaired) console.log(`[sweep] re-paired ${repaired} carrier message(s) against today's SIM list`)

    const pending = await selectAllPaged(
      'sim_mail', 'confidence,numbers,carrier',
      'resolved_at=is.null&sim_id=is.null&order=received_at.desc'
    )
    const unknownNumbers = new Set()
    let ambiguous = 0
    for (const m of pending) {
      if (m.confidence === 'unknown') for (const n of m.numbers || []) unknownNumbers.add(n)
      else ambiguous++
    }

    if (unknownNumbers.size) {
      const list = [...unknownNumbers]
      const shown = list.slice(0, 10).map((n) => `0${n}`).join(', ')
      await upsertOpenTask({
        reference: 'SIMNEW',
        title: `📵 ${list.length} number${list.length === 1 ? '' : 's'} live at a carrier, not on the books`,
        notes: `${shown}${list.length > 10 ? ` … and ${list.length - 10} more` : ''}. `
             + 'Each one is a SIM a carrier is billing for that the app has no record of — '
             + 'add it to the customer it belongs to, or find out whose it is.',
      })
    } else {
      await closeOpenTask('SIMNEW')
    }

    if (ambiguous) {
      await upsertOpenTask({
        reference: 'SIMPAIR',
        title: `📬 ${ambiguous} carrier email${ambiguous === 1 ? '' : 's'} need pairing`,
        // 'medium', not 'normal': the app SAYS Normal, the column is an enum of
        // low/medium/high, and a bad value throws. This line had never run —
        // it only fires the first time a pool address arrives with no number
        // in it, which had not happened yet.
        priority: 'medium',
        notes: 'Sent to a shared pool address with no number in the message, so the app '
             + 'will not guess which SIM it belongs to.',
      })
    } else {
      await closeOpenTask('SIMPAIR')
    }
    counts.simMailUnknownNumbers = unknownNumbers.size
    counts.simMailAmbiguous = ambiguous
    counts.simMailRepaired = repaired
    })

    await section('sms-delivery', async () => {
    // ── 7. Messages that never reached anyone ──
    // /api/sms-status writes the carrier's verdict onto each row. A message the
    // carrier rejected is worse than one never sent: staff believe the customer
    // was told. Between 24 Jul and 16 Aug every SMS failed with 21267 and the
    // log said 'redirected' throughout — this is the task that would have said
    // so on the morning of 25 July.
    const since = new Date(Date.now() - 7 * 86400000).toISOString()
    const failed = await selectAllPaged(
      'email_log', 'id,delivery_status,delivery_error,actual_to,created_at',
      `provider=eq.twilio&delivery_status=in.(undelivered,failed)&created_at=gte.${since}&order=created_at.desc`
    )
    if (failed.length) {
      // One rolling task, not one per message: a broken sender fails EVERY
      // message, and 200 identical tasks would bury the list they live in.
      const reasons = [...new Set(failed.map(f => (f.delivery_error || 'no reason given')))].slice(0, 3)
      await upsertOpenTask({
        reference: 'SMSFAIL',
        title: `📵 ${failed.length} text${failed.length === 1 ? '' : 's'} did not reach anyone this week`,
        notes: `${reasons.join(' · ')}. The customer was NOT told, whatever the message said. `
             + 'Twilio → Monitor → Logs → Messaging has the full history.',
      })
    } else {
      await closeOpenTask('SMSFAIL')
    }
    counts.smsUndelivered = failed.length
    })

    await section('drift', async () => {
    // ── 9. Typed-vs-blob drift, made visible (issue #14) ──
    //
    // Four tables carry both a typed projection and the legacy_extras blob the
    // app actually reads. On sims, rentals and lines the typed columns are
    // WRITE-ONLY, so a disagreement has no symptom until the day something
    // starts reading them — and customerDrift's own report was a console.warn
    // nobody reads. This surfaces each table's count where every other broken
    // thing already surfaces: the task list. One rolling task per table,
    // closed the day the table is clean.
    //
    // The FK check is the one the field detectors cannot do alone: a customer
    // merge re-parents the typed customer_id but the blob keeps naming the
    // DELETED duplicate — 206 sims measured on 23 Aug, invisible in the app
    // because the app resolves the blob's id and finds nobody.
    const custAll = await selectAllPaged('customers', 'id,legacy_id', 'order=id.asc')
    const uuidByLegacy = new Map(custAll.map((c) => [String(c.legacy_id), c.id]))
    const tables = [
      ['customers', 'id,legacy_id,first_name,last_name,phone_country_code,phone_number,email_raw,email_normalized,address,passport_on_file,has_whatsapp,notes,legacy_extras',
        customerDrift, null],
      ['sims', 'id,legacy_id,customer_id,provider,billing_option,next_renewal_date,paid_by,provider_monthly_cost,dd_collection_day,status,legacy_extras',
        simDrift, (r) => r.legacy_extras?.customerId],
      ['rentals', 'id,legacy_id,customer_id,country_code,start_date,end_date,vn_selection,vn_prefix,chargeable_days,calendar_days,base_charge,late_fee,damage_charges,total_charge,status,discount_type,discount_value,notes,legacy_extras',
        rentalDrift, (r) => r.legacy_extras?.customerId],
      ['lines', 'id,legacy_id,number,region,carrier,iccid,wrap_imei,status,notes,legacy_extras',
        lineDrift, null],
    ]
    for (const [table, select, detect, blobCustomerOf] of tables) {
      const rows = await selectAllPaged(table, select, 'order=id.asc')
      const examples = []
      let fieldDrift = 0
      let fkDrift = 0
      for (const r of rows) {
        const diffs = detect(r)
        const blobCust = blobCustomerOf ? blobCustomerOf(r) : null
        const fkOff = blobCust != null &&
          String(r.customer_id || '') !== String(uuidByLegacy.get(String(blobCust)) || '')
        if (diffs.length) fieldDrift++
        if (fkOff) fkDrift++
        if ((diffs.length || fkOff) && examples.length < 3) {
          examples.push(`${r.legacy_id}: ${fkOff ? 'customer link' : diffs.map((d) => d.field).slice(0, 3).join(', ')}`)
        }
      }
      const total = fieldDrift + fkDrift
      counts[`drift_${table}`] = total
      if (total) {
        await upsertOpenTask({
          reference: `DRIFT-${table}`,
          title: `🧬 ${table}: ${total} row${total === 1 ? '' : 's'} where the typed columns disagree with the app's own record`,
          notes: `e.g. ${examples.join(' · ')}. The app reads legacy_extras; the typed columns are what SQL and any future `
               + 'cutover read. Neither is wrong by definition — each row needs a look at which side holds the truth. '
               + 'Issue #14 has the map.',
        })
      } else {
        await closeOpenTask(`DRIFT-${table}`)
      }
    }
    })

    await section('custom-rules', async () => {
    // ── 8. Owner-defined automation rules (#20) ──
    // Each enabled rule raises RULE-<ruleId>-<entityId> tasks for matching
    // records; keys not re-raised this run are closed. Built on the same
    // idempotent upsert as the fixed sweeps above.
    const ruleRun = await runCustomRules({ today, names, debtors })
    counts.ruleTasks = ruleRun.raised
    // Reported, not swallowed. `texts.why` says which lock is shut — 'not-armed'
    // until AUTO_SMS_LIVE is set, 'quiet-day' on Shabbos and yom tov — and
    // `wouldSend` with its samples is the dry run: what the shop's customers
    // WOULD have received. A feature that has never been seen run is a feature
    // nobody trusts, which is the lesson the morning digest cost us.
    counts.autoSms = ruleRun.texts
    })

    // If any section failed, return non-2xx so Vercel's cron dashboard/monitoring
    // marks the run failed. Otherwise a total DB outage (every section throws,
    // including vn-billing — the only thing that posts recurring VN revenue)
    // would be recorded as a healthy 200 and silently slip a day, indefinitely.
    if (Object.keys(errors).length) {
      counts.errors = errors
      console.error('[cron/sweep] completed with section errors', JSON.stringify(errors))
      return res.status(500).json({ success: false, ranAt: new Date().toISOString(), by: isCron ? 'cron' : staff.email, counts })
    }
    console.log('[cron/sweep]', JSON.stringify(counts))
    return res.json({ success: true, ranAt: new Date().toISOString(), by: isCron ? 'cron' : staff.email, counts })
  } catch (e) {
    console.error('[cron/sweep]', e)
    return res.status(500).json({ success: false, error: 'Sweep failed — check logs.', counts })
  }
}

export default handler
