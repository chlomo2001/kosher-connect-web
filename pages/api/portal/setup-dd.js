// Portal "set up Direct Debit" — a HOSTED Stripe Checkout session (setup
// mode, bacs_debit) so the customer can store a bank mandate for monthly SIM
// collections (DD phase 1). Hosted, not an embedded SetupIntent: Stripe
// refuses direct Bacs mandate creation on standard accounts (see
// lib/stripe.js createDdCheckoutSession). The mandate is recorded only by the
// setup_intent.succeeded webhook; the endpoint is dormant until Stripe keys
// are set. Collections themselves are phase 2 and are NOT built here.
import { db, tablesMode } from '../../../lib/db.js'
import { resolvePortalCustomer } from '../../../lib/portal.js'
import { stripeEnabled, webhookConfigured, keysMatch, getOrCreateCustomer, createDdCheckoutSession } from '../../../lib/stripe.js'

export default async function handler(req, res) {
  if (process.env.PORTAL_ENABLED !== '1') return res.status(404).json({ success: false, error: 'Not found.' })
  if (req.method !== 'POST') return res.status(405).end()
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Portal unavailable.' })
  if (!stripeEnabled) return res.status(503).json({ success: false, error: 'Online payments aren’t switched on yet.' })
  // Same reasoning as save-card audit C7: without the webhook the mandate
  // would exist at Stripe but never attach to the customer here.
  if (!webhookConfigured) return res.status(503).json({ success: false, error: 'Direct Debit isn’t fully set up yet — please ask in store.' })
  if (!keysMatch) return res.status(503).json({ success: false, error: 'Direct Debit is temporarily unavailable — please contact us.' })

  const base = await resolvePortalCustomer(req)
  if (!base) return res.status(401).json({ success: false, error: 'Please sign in again.' })
  const cust = (await db.select('customers',
    `select=id,stripe_customer_id,email_raw,email_normalized,first_name,last_name&id=eq.${base.id}`))[0]
  if (!cust) return res.status(401).json({ success: false, error: 'Please sign in again.' })

  const name = `${cust.first_name || ''} ${cust.last_name || ''}`.trim()
  const stripeCustomerId = await getOrCreateCustomer({
    existingId: cust.stripe_customer_id,
    email: cust.email_raw || cust.email_normalized, name, appCustomerId: cust.id,
  })
  if (stripeCustomerId && stripeCustomerId !== cust.stripe_customer_id) {
    await db.update('customers', `id=eq.${cust.id}`, { stripe_customer_id: stripeCustomerId }).catch(() => {})
  }

  // Send the customer back to the portal either way; ?dd= drives the message.
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  const origin = `${proto}://${host}`
  const session = await createDdCheckoutSession({
    customerId: stripeCustomerId,
    appCustomerId: cust.id,
    successUrl: `${origin}/portal?dd=done`,
    cancelUrl: `${origin}/portal?dd=cancelled`,
  })
  return res.json({ success: true, url: session.url })
}
