// Operator: charge a customer's saved card-on-file off-session (owner action —
// deposits, no-shows, SIM direct-debits). Requires a stored card
// (stripe_customer_id + stripe_pm_id). On success posts one ledger 'payment'
// row (idempotent on the PaymentIntent id; the webhook would post the same row,
// so either path is safe). Dormant until Stripe keys are set.
import { withStaff, requireOwner } from '../../lib/auth.js'
import { db, tablesMode } from '../../lib/db.js'
import { stripeEnabled, webhookConfigured, chargeOffSession } from '../../lib/stripe.js'

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Needs the relational data layer.' })
  if (!stripeEnabled) return res.status(503).json({ success: false, error: 'Card payments aren’t switched on yet.' })
  // Off-session card charging is the most consequential money action in the app
  // (real money, no customer present) — owner-only, matching the header note.
  if (requireOwner(req, res)) return
  // A charge can resolve asynchronously ('processing'); the ledger row for that
  // case is posted only by the payment_intent.succeeded webhook. Without the
  // webhook configured, such a charge captures money that is never credited to
  // the wallet — so refuse, exactly as portal/pay.js does (audit C7).
  if (!webhookConfigured) {
    return res.status(503).json({ success: false, error: 'Card charging needs the Stripe webhook configured first.' })
  }

  const { customerId, amount, clientRef } = req.body || {}
  const amt = Math.round((Number(amount) || 0) * 100) / 100
  // The idempotency token is REQUIRED here: it becomes Stripe's Idempotency-Key, so a
  // double-submit collapses to one PaymentIntent (and one ledger row) instead of
  // charging the card twice. A stale client that omits it fails loudly, not silently.
  const ref = (typeof clientRef === 'string' && /^[\w-]{8,64}$/.test(clientRef)) ? clientRef : null
  if (!customerId) return res.status(400).json({ success: false, error: 'customerId required.' })
  if (!ref) return res.status(400).json({ success: false, error: 'Missing idempotency token — refresh and try again.' })
  if (!(amt > 0)) return res.status(400).json({ success: false, error: 'Enter an amount greater than £0.' })
  if (amt > 5000) return res.status(400).json({ success: false, error: 'That amount is too large.' })

  const rows = await db.select('customers',
    `select=id,stripe_customer_id,stripe_pm_id,first_name,last_name&legacy_id=eq.${encodeURIComponent(String(customerId))}`)
  const c = rows[0]
  if (!c) return res.status(404).json({ success: false, error: 'Customer not found.' })
  if (!c.stripe_customer_id || !c.stripe_pm_id) {
    return res.status(400).json({ success: false, error: 'No card on file for this customer.' })
  }

  const reference = `STRIPE-OFFSESSION-${c.id}-${ref}`
  try {
    const pi = await chargeOffSession({
      amountPence: Math.round(amt * 100), currency: 'gbp',
      customerId: c.stripe_customer_id, paymentMethodId: c.stripe_pm_id, appCustomerId: c.id,
      reference, description: `Card on file — ${`${c.first_name || ''} ${c.last_name || ''}`.trim() || 'customer'}`,
    })
    if (pi.status === 'succeeded') {
      await db.insertIgnoreDup('ledger', [{
        customer_id: c.id, charge_reference: `STRIPE-${pi.id}`,
        entry_type: 'payment', amount: amt, method: 'card', description: 'Card on file charge',
      }], 'charge_reference')
      return res.json({ success: true, status: 'succeeded' })
    }
    return res.json({ success: true, status: pi.status, note: 'The payment is processing.' })
  } catch (e) {
    // A Stripe API error ('[stripe] …') is a definitive decline/failure — Stripe
    // took no money, so a retry is safe. Any other throw (fetch failed, timeout/
    // AbortError) is AMBIGUOUS: the card may already have been charged before the
    // response was lost, and since a retry mints a fresh idempotency key it would
    // charge again. Tell the operator NOT to retry blindly in that case.
    const isStripeError = typeof e.message === 'string' && e.message.startsWith('[stripe]')
    if (!isStripeError) {
      return res.status(504).json({
        success: false,
        status: 'unknown',
        error: 'Charge status unknown — do NOT retry. Check Stripe (or the customer’s wallet) in a minute before trying again.',
      })
    }
    const msg = /authentication/i.test(e.message)
      ? 'The bank needs the customer to re-authorise this card — they must be present next time.'
      : (e.message || 'The charge was declined.')
    return res.status(402).json({ success: false, error: msg })
  }
}

export default withStaff(handler)
