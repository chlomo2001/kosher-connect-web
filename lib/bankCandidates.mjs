// Turning what the shop knows into candidates for the bank matcher. Pure.
//
// bankMatch.mjs scores a candidate on four signals: known references, an
// expected amount, a name, a due date. This module is the other half — it
// assembles those candidates from the rows the API already reads (customers,
// balances, bookings), so the matcher itself never touches the database and
// stays testable as it is.
//
// Every customer is a candidate, not just debtors: a top-up or an early
// payment arrives from someone with a zero balance, and a name hit alone is
// still worth SHOWING (it scores 'weak' — the human decides).

const REF_SHAPE = /^[A-Z0-9]{5,8}$/

export function buildCandidates({ customers = [], balances = [], bookings = [] } = {}) {
  const owed = new Map()      // uuid → positive amount the shop expects in
  for (const b of balances) {
    const bal = Number(b.balance) || 0
    if (bal < 0) owed.set(b.customer_id, Math.round(-bal * 100) / 100)
  }

  const refs = new Map()      // uuid → Set of booking refs
  const due = new Map()       // uuid → latest travel date seen (proxy for "when settling was expected")
  for (const bk of bookings) {
    const ref = String(bk.booking_reference || '').trim().toUpperCase()
    if (REF_SHAPE.test(ref)) {
      if (!refs.has(bk.customer_id)) refs.set(bk.customer_id, new Set())
      refs.get(bk.customer_id).add(ref)
    }
    const d = String(bk.travel_date || '').slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && (!due.has(bk.customer_id) || d > due.get(bk.customer_id))) {
      due.set(bk.customer_id, d)
    }
  }

  return customers
    .map((c) => ({
      customerId: c.legacy_id ?? null,          // the app id — what the UI deep-links with
      customerUuid: c.id,
      name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
      // The contact address, for the email signal. A card checkout carries the
      // payer's own; a bank line never does, so this simply never fires there.
      email: c.email_normalized || c.email_raw || null,
      references: [...(refs.get(c.id) || [])],
      expectedAmount: owed.get(c.id) ?? null,
      dueAt: due.get(c.id) ?? null,
    }))
    .filter((c) => c.name.length > 0)
}
