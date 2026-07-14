// Owner-defined "extra charges" that the engine applies automatically.
//
// Each row (custom_charges) has a label, an amount, a target (applies_to:
// booking / service / sim / repair / rental / any) and a mode:
//   - 'auto'     → posted automatically whenever a charge of that type is
//                  created (a flight booked, a service charged, …)
//   - 'optional' → offered as a tick-box the staff member can turn on
//
// Charges post as their own ledger line (entry_type 'extra_charge',
// reference 'EXTRA-<chargeId>-<refBase>') so they're idempotent per source
// event and show as a distinct line on the statement.

import { db } from './db.js'

export async function activeCustomCharges(appliesTo) {
  const rows = await db.select(
    'custom_charges',
    `active=is.true&or=(applies_to.eq.${encodeURIComponent(appliesTo)},applies_to.eq.any)&order=label.asc`
  )
  return rows.map(r => ({
    id: r.id,
    label: r.label,
    amount: Number(r.amount),
    appliesTo: r.applies_to,
    mode: r.mode,
  }))
}

// Post the applicable extras for one source event. `refBase` is the owning
// record's id (booking id, service-order id, …) so references stay unique
// and idempotent. `selectedIds` limits which optional charges apply (auto
// ones always do). Returns { total, lines }.
export async function postAutoCharges({ customerUuid, appliesTo, refBase, paidNow, method, selectedIds }) {
  const charges = await activeCustomCharges(appliesTo)
  const picked = charges.filter(c => c.mode === 'auto' || (Array.isArray(selectedIds) && selectedIds.includes(c.id)))
  let total = 0
  const lines = []
  for (const c of picked) {
    if (!(c.amount > 0)) continue
    const ref = `EXTRA-${c.id}-${refBase}`
    await db.insertIgnoreDup('ledger', [{
      customer_id: customerUuid,
      charge_reference: ref,
      entry_type: 'extra_charge',
      amount: -c.amount,
      description: c.label,
    }], 'charge_reference')
    if (paidNow) {
      await db.insertIgnoreDup('ledger', [{
        customer_id: customerUuid,
        charge_reference: `PAY-${ref}`,
        entry_type: 'payment',
        amount: c.amount,
        method: method || 'cash',
        description: `Paid — ${c.label}`,
      }], 'charge_reference')
    }
    total += c.amount
    lines.push({ label: c.label, amount: c.amount })
  }
  return { total: Math.round(total * 100) / 100, lines }
}
