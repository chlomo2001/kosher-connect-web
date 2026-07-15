// Stripe webhook — the source of truth for card payments. Verifies the
// signature against the RAW body (bodyParser disabled), dedupes on the event id
// (Stripe retries), and on payment_intent.succeeded posts exactly one ledger
// 'payment' row keyed on the PaymentIntent id (idempotent).
import { db } from '../../../lib/db.js'
import { verifyWebhook } from '../../../lib/stripe.js'

export const config = { api: { bodyParser: false } }

function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const raw = await readRaw(req)
  const event = verifyWebhook(raw, req.headers['stripe-signature'])
  if (!event) return res.status(400).json({ error: 'Invalid signature.' })

  // Idempotency: first insert wins; a duplicate delivery inserts nothing.
  try {
    const inserted = await db.insertIgnoreDup('stripe_events', [{ id: event.id, type: event.type }], 'id')
    if (Array.isArray(inserted) && inserted.length === 0) return res.json({ received: true, duplicate: true })
  } catch { /* if the dedupe insert fails, still process — the ledger key dedupes too */ }

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
    }
  }

  return res.json({ received: true })
}
