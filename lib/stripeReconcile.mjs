// Turning a Stripe charge into a row the bank-reconciliation lane can triage.
// Pure — no I/O, no Stripe, no database.
//
// Why this exists: money taken through a Payment Link made in the Stripe
// dashboard mints a fresh guest customer per checkout and carries none of our
// metadata, so the webhook has nobody to credit and the payment never reaches a
// wallet. As of 14 Aug 2026 that is 149 of 192 Stripe customers and roughly
// £24k — real money the app has no record of.
//
// The shape of the answer is the one the bank feed already uses, and for the
// same reason (docs/OPEN-BANKING.md): a payment processor knows an amount, a
// date and whatever name the payer typed. It does not know which customer that
// is. So a charge lands as a bank_transactions row, the matcher PROPOSES, and a
// person confirms. Nothing here can write to the ledger.

// Refunds net off rather than arriving as their own row: a £100 charge with £40
// refunded put £60 on the shop's account, and £60 is what a wallet should show.
// A fully refunded charge nets to zero and is dropped by importableCharges.
export function netAmount(charge) {
  const gross = Number(charge?.amount) || 0
  const refunded = Number(charge?.amount_refunded) || 0
  return Math.round((gross - refunded)) / 100
}

// The name the payer typed at Stripe's checkout, which is the only identity
// most of these carry. Falls back to the email's local part — "yoelgreen2020"
// is a worse clue than a name but a better one than nothing.
export function payerName(charge) {
  const billed = String(charge?.billing_details?.name || '').trim()
  if (billed) return billed
  const email = String(charge?.billing_details?.email || charge?.receipt_email || '').trim()
  const local = email.split('@')[0] || ''
  // Strip the digits people append to a mailbox; they are never part of a name.
  const guess = local.replace(/[._+-]+/g, ' ').replace(/\d+/g, '').trim()
  return guess.length >= 3 ? guess : ''
}

export function chargeEmail(charge) {
  return String(charge?.billing_details?.email || charge?.receipt_email || '').trim().toLowerCase()
}

// The ledger reference this charge would be posted under. Deliberately the
// PAYMENT INTENT id, not the charge id, because that is what the webhook's own
// payment_intent.succeeded branch writes — so if a webhook replay ever delivers
// this payment later, insertIgnoreDup sees the reference already present and
// the money cannot be counted twice.
export function ledgerRefFor(charge) {
  const pi = typeof charge?.payment_intent === 'string'
    ? charge.payment_intent
    : charge?.payment_intent?.id
  return `STRIPE-${pi || charge?.id || ''}`
}

// Did the app already know about this payment? Two ways it can have: our own
// checkout stamped the customer on it, or the ledger already carries its
// reference (the webhook posted it, or a previous confirm here did).
export function alreadyLinked(charge, ledgerRefs) {
  const meta = charge?.metadata?.app_customer_id
    || charge?.payment_intent?.metadata?.app_customer_id
  if (meta) return true
  return !!(ledgerRefs && ledgerRefs.has(ledgerRefFor(charge)))
}

export function chargeToRow(charge, { accountRef = 'Stripe' } = {}) {
  return {
    provider: 'stripe',
    // The charge id, not the payment intent: one row per real-world movement is
    // the table's rule, and a payment intent can hold more than one charge.
    providerTxnId: String(charge.id),
    accountRef,
    bookedAt: new Date((Number(charge.created) || 0) * 1000).toISOString(),
    amount: netAmount(charge),
    currency: String(charge.currency || 'gbp').toUpperCase(),
    description: [charge.description, chargeEmail(charge)].filter(Boolean).join(' · ').slice(0, 200) || 'Card payment (Stripe)',
    counterpartyName: payerName(charge).slice(0, 120) || null,
    raw: {
      id: charge.id,
      payment_intent: typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id || null,
      ledger_reference: ledgerRefFor(charge),
      email: chargeEmail(charge) || null,
      created: charge.created,
      amount: charge.amount,
      amount_refunded: charge.amount_refunded || 0,
      payment_method: charge.payment_method_details?.type || null,
    },
  }
}

// The charges worth putting in front of a person: settled, still holding money
// after refunds, and not already accounted for. `ledgerRefs` is a Set of the
// charge_references the ledger already carries.
export function importableCharges(charges, ledgerRefs, opts = {}) {
  const rows = []
  const skipped = { unpaid: 0, refunded: 0, alreadyLinked: 0 }
  for (const c of charges || []) {
    if (c?.status !== 'succeeded' || c?.paid === false) { skipped.unpaid++; continue }
    if (!(netAmount(c) > 0)) { skipped.refunded++; continue }
    if (alreadyLinked(c, ledgerRefs)) { skipped.alreadyLinked++; continue }
    rows.push(chargeToRow(c, opts))
  }
  return { rows, skipped }
}
