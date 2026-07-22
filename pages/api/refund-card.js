// Operator: refund a card payment back to the customer's card (owner action —
// overpayment, cancellation, goodwill). Refunds ONLY a real card payment we
// recorded (a ledger 'payment' row whose reference is STRIPE-<paymentIntent>),
// never more than that payment, and posts a negative 'manual_adjustment' so the
// wallet credit the payment created is reversed by the same amount.
//
// Sign note: entry_type 'refund' in this app is a CREDIT (money INTO the wallet).
// A card refund is the opposite — money leaves Stripe back to the card — so it
// must REDUCE the wallet. That's a negative manual_adjustment, not a 'refund'.
import { withStaff, requireOwner } from '../../lib/auth.js'
import { db, tablesMode } from '../../lib/db.js'
import { stripeEnabled, refundPayment } from '../../lib/stripe.js'

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Needs the relational data layer.' })
  if (!stripeEnabled) return res.status(503).json({ success: false, error: 'Card payments aren’t switched on yet.' })
  // Refunds move real money — owner-only, like off-session charging.
  if (requireOwner(req, res)) return

  const { customerId, reference, amount, clientRef } = req.body || {}
  const ref = (typeof clientRef === 'string' && /^[\w-]{8,64}$/.test(clientRef)) ? clientRef : null
  if (!ref) return res.status(400).json({ success: false, error: 'Missing idempotency token — refresh and try again.' })
  if (!customerId) return res.status(400).json({ success: false, error: 'customerId required.' })
  // The reference must be the STRIPE-<paymentIntent> of a payment we recorded.
  if (typeof reference !== 'string' || !/^STRIPE-pi_[\w]+$/.test(reference)) {
    return res.status(400).json({ success: false, error: 'That entry isn’t a refundable card payment.' })
  }

  const custRows = await db.select('customers', `select=id&legacy_id=eq.${encodeURIComponent(String(customerId))}`)
  const c = custRows[0]
  if (!c) return res.status(404).json({ success: false, error: 'Customer not found.' })

  // Load the original payment row and make sure it belongs to this customer.
  const payRows = await db.select('ledger',
    `select=amount,method,entry_type,customer_id&charge_reference=eq.${encodeURIComponent(reference)}`)
  const pay = payRows[0]
  if (!pay || pay.customer_id !== c.id || pay.entry_type !== 'payment') {
    return res.status(404).json({ success: false, error: 'Original card payment not found for this customer.' })
  }
  const paid = Math.round((Number(pay.amount) || 0) * 100) / 100
  if (!(paid > 0)) return res.status(400).json({ success: false, error: 'That payment has no positive amount to refund.' })

  // Default to a full refund; a supplied amount must be within the payment.
  let amt = amount === '' || amount == null ? paid : Math.round((Number(amount) || 0) * 100) / 100
  if (!(amt > 0)) return res.status(400).json({ success: false, error: 'Enter an amount greater than £0.' })
  if (amt > paid + 0.005) return res.status(400).json({ success: false, error: `You can’t refund more than the £${paid.toFixed(2)} paid.` })

  const paymentIntentId = reference.replace(/^STRIPE-/, '')
  try {
    const refund = await refundPayment({
      paymentIntentId,
      amountPence: Math.round(amt * 100),
      reference: `refund-${ref}`,
    })
    if (refund.status === 'failed' || refund.status === 'canceled') {
      return res.status(402).json({ success: false, error: `The refund did not go through (${refund.status}).` })
    }
    // Reverse the wallet credit. Idempotent on the refund id, so a retry is a no-op.
    await db.insertIgnoreDup('ledger', [{
      customer_id: c.id,
      charge_reference: `STRIPE-REFUND-${refund.id}`,
      entry_type: 'manual_adjustment',
      amount: -amt, // negative = removes the credit the card payment added
      method: 'card',
      description: `Card refund of ${reference.replace(/^STRIPE-/, '')}`,
    }], 'charge_reference')
    return res.json({ success: true, status: refund.status, amount: amt })
  } catch (e) {
    // A '[stripe] …' error is a definitive API rejection (no money moved). Any
    // other throw (network/timeout) is ambiguous — the refund MAY have been
    // created — so tell the operator not to blindly retry.
    const isStripeError = typeof e.message === 'string' && e.message.startsWith('[stripe]')
    if (!isStripeError) {
      return res.status(504).json({ success: false, status: 'unknown', error: 'Refund status unknown — do NOT retry. Check Stripe before trying again.' })
    }
    return res.status(402).json({ success: false, error: e.message.replace(/^\[stripe\][^:]*:\s*/, '') || 'The refund was rejected.' })
  }
}

export default withStaff(handler)
