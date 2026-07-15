// Portal "save a card on file" — a SetupIntent so the customer can store a card
// without paying now (for future deposits / no-shows / SIM direct-debits). The
// card is stored by Stripe; the webhook (setup_intent.succeeded) records the
// payment method on the customer. Dormant until Stripe keys are set.
import { db, tablesMode } from '../../../lib/db.js'
import { resolvePortalCustomer } from '../../../lib/portal.js'
import { stripeEnabled, publishableKey, getOrCreateCustomer, createSetupIntent } from '../../../lib/stripe.js'

export default async function handler(req, res) {
  if (process.env.PORTAL_ENABLED !== '1') return res.status(404).json({ success: false, error: 'Not found.' })
  if (req.method !== 'POST') return res.status(405).end()
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Portal unavailable.' })
  if (!stripeEnabled) return res.status(503).json({ success: false, error: 'Card payments aren’t switched on yet.' })

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

  const si = await createSetupIntent({ customerId: stripeCustomerId, appCustomerId: cust.id })
  return res.json({ success: true, clientSecret: si.client_secret, publishableKey })
}
