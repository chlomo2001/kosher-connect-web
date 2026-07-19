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
//
// Callers: Vercel Cron (Authorization: Bearer CRON_SECRET — note crons fire
// only on PRODUCTION deployments), or a signed-in staff member (the "Run
// sweeps now" button, which is also how previews test this).

import { db, tablesMode } from '../../../lib/db.js'
import { resolveStaff } from '../../../lib/auth.js'
import { advanceOneMonth } from '../../../lib/money.mjs'

const enc = encodeURIComponent
const localDate = (offsetDays = 0) => {
  const d = new Date(Date.now() + offsetDays * 86400000)
  // Shop-local calendar date; Vercel functions run in UTC, the shop is UK.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(d)
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

// Evaluate every enabled automation rule. Returns the number of tasks raised.
async function runCustomRules({ today, names }) {
  const rules = await db.select('automation_rules', 'enabled=is.true')
  let raised = 0
  const keep = new Set() // references that should stay open after this run

  for (const rule of rules) {
    const n = Number(rule.threshold) || 0
    const priority = rule.priority || 'high'
    const raise = async (entityId, title, customerUuid, dueDate) => {
      const reference = `RULE-${rule.id}-${entityId}`
      keep.add(reference)
      await upsertOpenTask({ reference, title, customerUuid, priority, dueDate,
        notes: `Automation: ${rule.name}` })
      raised++
    }

    if (rule.trigger === 'balance_over') {
      const balances = await db.select('customer_balances', '')
      for (const b of balances) {
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
      const rows = await db.select('bookings',
        `select=id,passenger,passport_expiry,customer_id,customers(first_name,last_name)&status=neq.Cancelled&passport_expiry=gte.${today}&passport_expiry=lte.${localDate(n)}`)
      for (const b of rows) {
        const nm = b.passenger || (b.customers ? `${b.customers.first_name || ''} ${b.customers.last_name || ''}`.trim() : '?')
        await raise(b.id, fillTitle(rule.task_title, `Passport expires in {n}d — {name}`, nm, n), b.customer_id, b.passport_expiry)
      }
    } else if (rule.trigger === 'sim_renewal_in_days') {
      const rows = await db.select('sims',
        `select=id,provider,next_renewal_date,customer_id,customers(first_name,last_name)&status=eq.active&next_renewal_date=gte.${today}&next_renewal_date=lte.${localDate(n)}`)
      for (const s of rows) {
        const nm = s.customers ? `${s.customers.first_name || ''} ${s.customers.last_name || ''}`.trim() : '?'
        await raise(s.id, fillTitle(rule.task_title, `SIM renews in {n}d — {name} (${s.provider || 'SIM'})`, nm, n), s.customer_id, s.next_renewal_date)
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
  return raised
}

async function handler(req, res) {
  if (!tablesMode) {
    return res.status(503).json({ success: false, error: 'Sweeps need the relational data layer.' })
  }

  // Auth: Vercel Cron bearer OR a signed-in staff member.
  const cronSecret = (process.env.CRON_SECRET || '').trim()
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  const isCron = cronSecret && bearer === cronSecret
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
    const flipped = await db.update(
      'rentals',
      `status=eq.active&end_date=lt.${today}`,
      { status: 'overdue' }
    )
    counts.rentalsFlippedOverdue = flipped.length

    const overdue = await db.select(
      'rentals',
      `select=id,legacy_id,end_date,customer_id,customers(first_name,last_name)&status=eq.overdue&is_void=is.false`
    )
    let overdueTasks = 0
    for (const r of overdue) {
      const name = r.customers ? `${r.customers.first_name || ''} ${r.customers.last_name || ''}`.trim() : '?'
      await upsertOpenTask({
        reference: `OVERDUE-${r.id}`,
        title: `Rental overdue — ${name} (due ${r.end_date})`,
        customerUuid: r.customer_id,
        notes: `Rental ${r.legacy_id || r.id} was due back ${r.end_date}.`,
      })
      overdueTasks++
    }
    counts.overdueTasks = overdueTasks

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
    const [balances, freshCustRows] = await Promise.all([
      db.select('customer_balances', ''),
      db.select('customers', 'select=id,first_name,last_name'),
    ])
    custRows = freshCustRows
    names = new Map(custRows.map(c => [c.id, `${c.first_name || ''} ${c.last_name || ''}`.trim()]))
    let balCreated = 0, balClosed = 0
    for (const b of balances) {
      const bal = Number(b.balance)
      const ref = `BALANCE-${b.customer_id}`
      if (bal < 0) {
        await upsertOpenTask({
          reference: ref,
          title: `Outstanding balance — ${names.get(b.customer_id) || '?'} — £${Math.abs(bal).toFixed(2)}`,
          customerUuid: b.customer_id,
          notes: `Negative wallet balance £${Math.abs(bal).toFixed(2)}.`,
        })
        balCreated++
      } else {
        balClosed += await closeOpenTask(ref)
      }
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
        title: `Passport expires ${b.passport_expiry} — ${name}`,
        customerUuid: b.customer_id,
        notes: 'Passport on file expires within 90 days.',
        dueDate: b.passport_expiry,
      })
      passportTasks++
    }
    counts.passportTasks = passportTasks
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
        title: `Reservation pickup — ${name} (from ${r.start_date})`,
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
    const flownPast = await db.update(
      'bookings',
      `status=in.(Booked,Ticketed)&travel_date=lt.${today}`,
      { status: 'Completed' }
    )
    const flownTodayTimed = await db.update(
      'bookings',
      `status=in.(Booked,Ticketed)&travel_date=eq.${today}&departure_time=lte.${nowTime}`,
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
      const row = await db.select('bookings', `select=travel_date,status&id=eq.${enc(bookingId)}`)
      if (!row.length || row[0].status === 'Cancelled' || row[0].travel_date < today) {
        flightsClosed += await closeOpenTask(t.reference)
      }
    }
    counts.flightsClosed = flightsClosed
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
        title: `SIM renews ${s.next_renewal_date} — ${name} (${s.provider || 'SIM'})${s.paid_by === 'kc' ? ' — KC pays' : ''}`,
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
      const stale = !row.length || row[0].status !== 'active' ||
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

    await section('custom-rules', async () => {
    // ── 6. Owner-defined automation rules (#20) ──
    // Each enabled rule raises RULE-<ruleId>-<entityId> tasks for matching
    // records; keys not re-raised this run are closed. Built on the same
    // idempotent upsert as the fixed sweeps above.
    counts.ruleTasks = await runCustomRules({ today, names, custRows })
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
