// Staff-initiated "save a card on file" — returns a hosted Stripe Checkout URL
// (setup mode, card) for the counter to open on the tablet or send to the
// customer.
//
// Hosted, never a form of ours. The number is typed into Stripe's page; this
// app never sees it, never logs it and never stores it, which is what keeps the
// shop out of PCI scope. What comes back to us is a payment-method id.
//
// Nothing is charged here. The card is recorded only when Stripe fires
// setup_intent.succeeded (its non-Bacs branch writes customers.stripe_pm_id),
// so the webhook has to be configured — without it the card would authorise at
// Stripe and never attach to anyone. Same reasoning as the portal's own
// save-card route (audit C7).
import { withStaff, tabAllowedFor } from '../../../lib/auth.js'
import { db, tablesMode } from '../../../lib/db.js'
import {
  stripeEnabled, webhookConfigured, keysMatch, publishableKey,
  getOrCreateCustomer, createCardCheckoutSession, createCardSetupIntent,
} from '../../../lib/stripe.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// The browser addresses customers by legacy id; the tables key on uuid.
async function lookup(ref) {
  const v = String(ref || '').trim()
  if (!v) return null
  const filter = UUID_RE.test(v)
    ? `id=eq.${v}`
    : `legacy_id=eq.${encodeURIComponent(v)}`
  const rows = await db.select('customers',
    `select=id,stripe_customer_id,stripe_pm_id,email_raw,email_normalized,first_name,last_name&${filter}&limit=1`)
  return rows[0] || null
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Needs the relational data layer.' })
  if (!(await tabAllowedFor(req.staff, 'wallet'))) {
    return res.status(403).json({ success: false, error: 'Not permitted.' })
  }
  if (!stripeEnabled) return res.status(503).json({ success: false, error: 'Stripe isn’t switched on yet.' })
  if (!webhookConfigured) {
    return res.status(503).json({
      success: false,
      error: 'The Stripe webhook isn’t configured — a card saved now would never attach to the customer.',
    })
  }
  if (!keysMatch) {
    return res.status(503).json({ success: false, error: 'Stripe test and live keys are mixed — fix that before saving cards.' })
  }

  const cust = await lookup(req.body?.customerId)
  if (!cust) return res.status(404).json({ success: false, error: 'Customer not found.' })

  const name = `${cust.first_name || ''} ${cust.last_name || ''}`.trim()
  const stripeCustomerId = await getOrCreateCustomer({
    existingId: cust.stripe_customer_id,
    email: cust.email_raw || cust.email_normalized,
    name,
    appCustomerId: cust.id,
  })
  if (!stripeCustomerId) {
    return res.status(502).json({ success: false, error: 'Stripe would not open a customer record.' })
  }
  if (stripeCustomerId !== cust.stripe_customer_id) {
    await db.update('customers', `id=eq.${cust.id}`, { stripe_customer_id: stripeCustomerId }).catch(() => {})
  }

  // INLINE: the counter types the card into Stripe's own field inside one of
  // our modals. Card only — no Link, no wallet, and so no verification email
  // to a customer who is standing at the counter (owner, 17 Aug). The number
  // still never reaches this app; what comes back here is a client secret,
  // which authorises confirming THIS one setup and nothing else.
  if (req.body?.inline) {
    if (!publishableKey) {
      return res.status(503).json({ success: false, error: 'No Stripe publishable key is configured.' })
    }
    try {
      const intent = await createCardSetupIntent({ customerId: stripeCustomerId, appCustomerId: cust.id })
      if (!intent?.client_secret) {
        return res.status(502).json({ success: false, error: 'Stripe would not open a card form.' })
      }
      return res.json({
        success: true,
        inline: true,
        clientSecret: intent.client_secret,
        publishableKey,
        hadCard: !!cust.stripe_pm_id,
        customerName: name,
      })
    } catch (e) {
      console.error('[save-card inline]', e.message)
      return res.status(502).json({ success: false, error: 'Stripe would not open a card form.' })
    }
  }

  // Where Stripe sends them afterwards — the public welcome page either way,
  // since the customer may be finishing this on their own phone. Same
  // forwarded-header derivation the Direct Debit route uses, so both land on
  // the host the request actually came through rather than a guess.
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  const origin = `${proto}://${host}`
  try {
    const session = await createCardCheckoutSession({
      customerId: stripeCustomerId,
      appCustomerId: cust.id,
      successUrl: `${origin}/welcome?card=saved`,
      cancelUrl: `${origin}/welcome?card=cancelled`,
    })
    if (!session?.url) return res.status(502).json({ success: false, error: 'Stripe did not return a link.' })
    return res.json({ success: true, url: session.url, hadCard: !!cust.stripe_pm_id })
  } catch (e) {
    console.error('[api/customers/save-card]', e.message)
    return res.status(502).json({ success: false, error: e.message || 'Could not reach Stripe.' })
  }
}

export default withStaff(handler)
