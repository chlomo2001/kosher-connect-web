// Portal self-pay: create a Stripe PaymentIntent for the customer to pay by
// card. Defaults to clearing their outstanding balance; an explicit amount lets
// them top up. Dormant until Stripe keys are set (503 until then). The ledger
// row is posted by the webhook on payment_intent.succeeded — NOT here — so a
// closed browser or a retry can't lose or double a payment.
import { db, tablesMode } from '../../../lib/db.js'
import { resolvePortalCustomer } from '../../../lib/portal.js'
import { stripeEnabled, webhookConfigured, keysMatch, publishableKey, getOrCreateCustomer, createPaymentIntent } from '../../../lib/stripe.js'

export default async function handler(req, res) {
  if (process.env.PORTAL_ENABLED !== '1') return res.status(404).json({ success: false, error: 'Not found.' })
  if (req.method !== 'POST') return res.status(405).end()
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Portal unavailable.' })
  if (!stripeEnabled) return res.status(503).json({ success: false, error: 'Card payments aren’t switched on yet.' })
  // The ledger 'payment' row is posted only by the webhook. Refuse to take money
  // while the webhook is unconfigured, or the payment would be captured and never
  // reconciled (customer charged, balance still shows owing). (audit C7)
  if (!webhookConfigured) return res.status(503).json({ success: false, error: 'Card payments aren’t fully set up yet — please pay in store.' })
  // Mismatched key modes make the browser form fail silently (empty box), so
  // refuse here with a real error instead. /api/health shows keysMatch:false.
  if (!keysMatch) return res.status(503).json({ success: false, error: 'Card payments are temporarily unavailable — please contact us.' })

  const base = await resolvePortalCustomer(req)
  if (!base) return res.status(401).json({ success: false, error: 'Please sign in again.' })
  const cust = (await db.select('customers',
    `select=id,stripe_customer_id,email_raw,email_normalized,first_name,last_name&id=eq.${base.id}`))[0]
  if (!cust) return res.status(401).json({ success: false, error: 'Please sign in again.' })

  // Amount: requested top-up, else whatever they owe (negative balance).
  const balRows = await db.select('customer_balances', `customer_id=eq.${cust.id}`)
  const balance = balRows.length ? Number(balRows[0].balance) : 0
  const owed = balance < 0 ? Math.round(-balance * 100) / 100 : 0
  let amount = Number(req.body?.amount)
  if (!(amount > 0)) amount = owed
  amount = Math.round(amount * 100) / 100
  if (!(amount > 0)) return res.status(400).json({ success: false, error: 'Nothing to pay — your balance is settled.' })
  if (amount > 5000) return res.status(400).json({ success: false, error: 'That amount is too large to pay online — please contact us.' })

  const name = `${cust.first_name || ''} ${cust.last_name || ''}`.trim()
  const stripeCustomerId = await getOrCreateCustomer({
    existingId: cust.stripe_customer_id,
    email: cust.email_raw || cust.email_normalized,
    name, appCustomerId: cust.id,
  })
  if (stripeCustomerId && stripeCustomerId !== cust.stripe_customer_id) {
    await db.update('customers', `id=eq.${cust.id}`, { stripe_customer_id: stripeCustomerId }).catch(() => {})
  }

  const reference = `STRIPE-PORTAL-${cust.id}-${Date.now()}`
  const pi = await createPaymentIntent({
    amountPence: Math.round(amount * 100), currency: 'gbp',
    customerId: stripeCustomerId, appCustomerId: cust.id, reference,
    description: `KosherConnect — payment from ${name || 'customer'}`,
  })
  return res.json({ success: true, clientSecret: pi.client_secret, publishableKey, amount })
}
