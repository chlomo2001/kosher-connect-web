// Stripe webhook — the source of truth for card payments. Verifies the
// signature against the RAW body (bodyParser disabled), dedupes on the event id
// (Stripe retries), and on payment_intent.succeeded posts exactly one ledger
// 'payment' row keyed on the PaymentIntent id (idempotent).
import { db } from '../../../lib/db.js'
import { verifyWebhook } from '../../../lib/stripe.js'
import { readRaw } from '../../../lib/rawBody.js'

export const config = { api: { bodyParser: false } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  let raw
  try {
    raw = await readRaw(req)
  } catch {
    return res.status(413).json({ error: 'Payload too large.' })
  }
  const event = verifyWebhook(raw, req.headers['stripe-signature'])
  if (!event) return res.status(400).json({ error: 'Invalid signature.' })

  // Idempotency is anchored on the WORK, not a marker written ahead of it: if this
  // event was already fully processed we skip, but we record it as processed only
  // AFTER the side effects below succeed. That way a retry following a partial
  // failure re-runs the work (the ledger charge_reference unique key makes the
  // re-run a no-op) instead of being suppressed with the payment never posted.
  try {
    const seen = await db.select('stripe_events', `id=eq.${encodeURIComponent(event.id)}&select=id&limit=1`)
    if (Array.isArray(seen) && seen.length) return res.json({ received: true, duplicate: true })
  } catch { /* if the read fails, fall through and process — the ledger key dedupes too */ }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data?.object || {}
    const appCustomerId = pi.metadata?.app_customer_id
    const amount = Math.round(((pi.amount_received ?? pi.amount) || 0)) / 100
    if (appCustomerId && amount > 0) {
      await db.insertIgnoreDup('ledger', [{
        customer_id: appCustomerId,
        charge_reference: `STRIPE-${pi.id}`,
        entry_type: 'payment',
        amount, // positive = credit toward balance
        method: 'card',
        description: 'Online card payment (portal)',
      }], 'charge_reference')
      // Card-on-file: a portal payment with setup_future_usage leaves a reusable
      // payment method — remember it so the owner can charge it off-session later.
      if (appCustomerId && pi.payment_method) {
        // Let a failure throw: it skips the stripe_events insert below, so Stripe
        // retries the whole event and the ledger insertIgnoreDup makes the payment
        // re-post a no-op while this card-save runs again. Swallowing it would lose
        // the saved card forever with the event marked processed.
        await db.update('customers', `id=eq.${appCustomerId}`, { stripe_pm_id: pi.payment_method })
      }
    }
  }

  // Explicit "save a card" / "set up Direct Debit" (no charge): store the
  // payment method on file. This is the event's ONLY side effect, so a
  // swallowed failure would mark the event processed with nothing saved. Let it
  // throw: the stripe_events insert below is skipped, Stripe retries, and the
  // update runs again (idempotent — same value).
  if (event.type === 'setup_intent.succeeded') {
    const si = event.data?.object || {}
    const appCustomerId = si.metadata?.app_customer_id
    if (appCustomerId && si.payment_method) {
      // A Bacs mandate is a bank account, not a card — it lives in its own
      // columns (DD phase 1) so stripe_pm_id stays cards-only. A succeeded
      // Bacs SetupIntent is chargeable, so the mandate records as active.
      const isBacs = Array.isArray(si.payment_method_types) && si.payment_method_types.includes('bacs_debit')
      await db.update('customers', `id=eq.${appCustomerId}`, isBacs
        ? { stripe_dd_pm_id: si.payment_method, dd_mandate_status: 'active' }
        : { stripe_pm_id: si.payment_method })
    }
  }

  // The bank side can revoke a Bacs mandate long after setup (customer cancels
  // at their bank). Requires 'mandate.updated' in the endpoint's event list —
  // harmless if it never arrives, but phase 2 must not collect against a
  // cancelled mandate, so keep the status honest when it does.
  if (event.type === 'mandate.updated') {
    const m = event.data?.object || {}
    const pmId = typeof m.payment_method === 'string' ? m.payment_method : m.payment_method?.id
    if (pmId && m.status && m.status !== 'active' && m.status !== 'pending') {
      await db.update('customers', `stripe_dd_pm_id=eq.${encodeURIComponent(pmId)}`, { dd_mandate_status: 'cancelled' })
    }
  }
  if (event.type === 'payment_method.detached') {
    const pm = event.data?.object || {}
    if (pm.id && pm.type === 'bacs_debit') {
      await db.update('customers', `stripe_dd_pm_id=eq.${encodeURIComponent(pm.id)}`, { dd_mandate_status: 'cancelled' })
    }
  }

  // Record the event as processed only now that its side effects have succeeded.
  // (A throw above skips this, so Stripe retries and the work runs again.)
  try { await db.insertIgnoreDup('stripe_events', [{ id: event.id, type: event.type }], 'id') } catch { /* observational only */ }

  return res.json({ received: true })
}
