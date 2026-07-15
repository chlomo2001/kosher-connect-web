// Operator: charge a customer's saved card-on-file off-session (owner action —
// deposits, no-shows, SIM direct-debits). Requires a stored card
// (stripe_customer_id + stripe_pm_id). On success posts one ledger 'payment'
// row (idempotent on the PaymentIntent id; the webhook would post the same row,
// so either path is safe). Dormant until Stripe keys are set.
import { withStaff, tabAllowedFor } from '../../lib/auth.js'
import { db, tablesMode } from '../../lib/db.js'
import { stripeEnabled, chargeOffSession } from '../../lib/stripe.js'

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Needs the relational data layer.' })
  if (!stripeEnabled) return res.status(503).json({ success: false, error: 'Card payments aren’t switched on yet.' })
  if (!(await tabAllowedFor(req.staff, 'wallet'))) return res.status(403).json({ success: false, error: 'Not permitted.' })

  const { customerId, amount } = req.body || {}
  const amt = Math.round((Number(amount) || 0) * 100) / 100
  if (!customerId) return res.status(400).json({ success: false, error: 'customerId required.' })
  if (!(amt > 0)) return res.status(400).json({ success: false, error: 'Enter an amount greater than £0.' })
  if (amt > 5000) return res.status(400).json({ success: false, error: 'That amount is too large.' })

  const rows = await db.select('customers',
    `select=id,stripe_customer_id,stripe_pm_id,first_name,last_name&legacy_id=eq.${encodeURIComponent(String(customerId))}`)
  const c = rows[0]
  if (!c) return res.status(404).json({ success: false, error: 'Customer not found.' })
  if (!c.stripe_customer_id || !c.stripe_pm_id) {
    return res.status(400).json({ success: false, error: 'No card on file for this customer.' })
  }

  const reference = `STRIPE-OFFSESSION-${c.id}-${Date.now()}`
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
    const msg = /authentication/i.test(e.message)
      ? 'The bank needs the customer to re-authorise this card — they must be present next time.'
      : (e.message || 'The charge was declined.')
    return res.status(402).json({ success: false, error: msg })
  }
}

export default withStaff(handler)
