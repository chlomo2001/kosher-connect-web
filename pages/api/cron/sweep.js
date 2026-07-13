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

  try {
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

    // ── 2. Collections (BALANCE-<customer>) ──
    const [balances, custRows] = await Promise.all([
      db.select('customer_balances', ''),
      db.select('customers', 'select=id,first_name,last_name'),
    ])
    const names = new Map(custRows.map(c => [c.id, `${c.first_name || ''} ${c.last_name || ''}`.trim()]))
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

    // ── 5. Standalone-VN monthly billing ──
    // Post one charge per elapsed billing period. Refs carry the period
    // (VN-<id>-<YYYY-MM of the billing date>), so re-runs and catch-up after
    // missed days are safe; the date pointer only advances after posting.
    const billableVNs = await db.select(
      'virtual_numbers',
      `select=id,number,monthly_price,next_billing_date,customer_id,bundle_label,plan` +
      `&billing_enabled=is.true&status=eq.Active&customer_id=not.is.null` +
      `&monthly_price=gt.0&next_billing_date=lte.${today}`
    )
    let vnCharges = 0
    for (const vn of billableVNs) {
      let bill = vn.next_billing_date
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
        const d = new Date(bill + 'T00:00:00Z')
        d.setUTCMonth(d.getUTCMonth() + 1)
        bill = d.toISOString().slice(0, 10)
        await db.update('virtual_numbers', `id=eq.${vn.id}`, { next_billing_date: bill })
      }
    }
    counts.vnChargesPosted = vnCharges

    console.log('[cron/sweep]', JSON.stringify(counts))
    return res.json({ success: true, ranAt: new Date().toISOString(), by: isCron ? 'cron' : staff.email, counts })
  } catch (e) {
    console.error('[cron/sweep]', e)
    return res.status(500).json({ success: false, error: 'Sweep failed — check logs.', counts })
  }
}

export default handler
