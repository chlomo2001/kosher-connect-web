// Operator: create a Stripe payment link for a specific customer and amount.
// Unlike a link made in the Stripe dashboard, this one is TAGGED with the app
// customer, so when they pay, the payment_intent.succeeded webhook posts it to
// their wallet automatically. Staff copy the link and send it however they like.
//
// Creating a link doesn't move money (the customer still enters their card), so
// it's staff-level — but it needs the webhook configured, or a paid link would
// capture money that never reaches the wallet (same reasoning as charge-card).
import { withStaff } from '../../lib/auth.js'
import { db, tablesMode } from '../../lib/db.js'
import { stripeEnabled, webhookConfigured, getOrCreateCustomer, createCheckoutLink, createOpenCheckoutLink } from '../../lib/stripe.js'

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Needs the relational data layer.' })
  if (!stripeEnabled) return res.status(503).json({ success: false, error: 'Card payments aren’t switched on yet.' })
  if (!webhookConfigured) {
    return res.status(503).json({ success: false, error: 'Payment links need the Stripe webhook configured first (otherwise a paid link wouldn’t reach the wallet).' })
  }

  const { customerId, amount, description, clientRef, openAmount } = req.body || {}
  const ref = (typeof clientRef === 'string' && /^[\w-]{8,64}$/.test(clientRef)) ? clientRef : null
  if (!ref) return res.status(400).json({ success: false, error: 'Missing idempotency token — refresh and try again.' })
  if (!customerId) return res.status(400).json({ success: false, error: 'customerId required.' })
  const amt = Math.round((Number(amount) || 0) * 100) / 100
  // openAmount: the customer types the amount on the Stripe page — any given
  // amount is just the suggestion prefilled there, so zero/blank is fine.
  if (!openAmount && !(amt > 0)) return res.status(400).json({ success: false, error: 'Enter an amount greater than £0.' })
  if (amt > 5000) return res.status(400).json({ success: false, error: 'That amount is too large.' })

  const rows = await db.select('customers',
    `select=id,stripe_customer_id,email_raw,email_normalized,first_name,last_name&legacy_id=eq.${encodeURIComponent(String(customerId))}`)
  const c = rows[0]
  if (!c) return res.status(404).json({ success: false, error: 'Customer not found.' })

  const base = `https://${req.headers.host}`
  const name = `${c.first_name || ''} ${c.last_name || ''}`.trim()
  try {
    // Ensure a Stripe customer so the saved card (setup_future_usage) attaches to
    // the right person; persist the id so we don't remint it next time.
    const stripeCustomerId = await getOrCreateCustomer({
      existingId: c.stripe_customer_id, email: c.email_raw || c.email_normalized, name, appCustomerId: c.id,
    })
    if (stripeCustomerId && stripeCustomerId !== c.stripe_customer_id) {
      await db.update('customers', `id=eq.${c.id}`, { stripe_customer_id: stripeCustomerId })
    }

    const linkArgs = {
      currency: 'gbp',
      appCustomerId: c.id, customerId: stripeCustomerId,
      reference: `STRIPE-LINK-${c.id}-${ref}`,
      description: (typeof description === 'string' && description.trim()) ? description.trim().slice(0, 200) : `Payment — ${name || 'Kosher Connect'}`,
      successUrl: `${base}/welcome?paid=1`,
      cancelUrl: `${base}/welcome`,
    }
    const session = openAmount
      ? await createOpenCheckoutLink({ ...linkArgs, suggestedPence: Math.round(amt * 100) })
      : await createCheckoutLink({ ...linkArgs, amountPence: Math.round(amt * 100) })
    if (!session.url) return res.status(502).json({ success: false, error: 'Stripe did not return a link.' })
    return res.json({ success: true, url: session.url, amount: amt, openAmount: !!openAmount })
  } catch (e) {
    const msg = typeof e.message === 'string' && e.message.startsWith('[stripe]')
      ? e.message.replace(/^\[stripe\][^:]*:\s*/, '')
      : 'Could not create the payment link.'
    return res.status(502).json({ success: false, error: msg })
  }
}

export default withStaff(handler)
