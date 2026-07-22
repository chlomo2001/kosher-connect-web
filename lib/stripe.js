// Stripe — server-side, dormant until keys are set (same discipline as
// lib/email.js). No SDK dependency: thin fetch calls to the Stripe REST API,
// so nothing to install and nothing runs until STRIPE_SECRET_KEY exists.
//
// SAFETY: a card is NEVER read by our server. The browser talks to Stripe's
// hosted Payment Element directly; we only create/confirm intents and read
// results. Use TEST keys (sk_test_…) until the whole path is proven, then swap
// to live keys. `mode` is derived from the key prefix so /api/health can show
// which environment is wired without exposing the key.
//
// Env:
//   STRIPE_SECRET_KEY      sk_test_… (start here) or sk_live_…
//   STRIPE_PUBLISHABLE_KEY pk_test_… / pk_live_…  (sent to the browser)
//   STRIPE_WEBHOOK_SECRET  whsec_…  (verifies incoming webhooks)

import crypto from 'crypto'

const SECRET = (process.env.STRIPE_SECRET_KEY || '').trim()
const WEBHOOK_SECRET = (process.env.STRIPE_WEBHOOK_SECRET || '').trim()
export const publishableKey = (process.env.STRIPE_PUBLISHABLE_KEY || '').trim()

export const stripeEnabled = /^sk_(test|live)_/.test(SECRET)
export function stripeStatus() {
  return {
    configured: stripeEnabled,
    mode: stripeEnabled ? (SECRET.startsWith('sk_live_') ? 'live' : 'test') : 'unconfigured',
    webhook: !!WEBHOOK_SECRET,
  }
}

// Form-encode nested params the way Stripe expects (metadata[key]=value).
function encodeForm(obj, prefix, out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue
    const key = prefix ? `${prefix}[${k}]` : k
    if (typeof v === 'object' && !Array.isArray(v)) encodeForm(v, key, out)
    else out.append(key, String(v))
  }
  return out
}

async function stripeApi(path, { method = 'POST', body, idempotencyKey } = {}) {
  if (!stripeEnabled) throw new Error('stripe-not-configured')
  const headers = {
    Authorization: `Bearer ${SECRET}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  }
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
  // Bound the request. NOTE: an abort/transport failure leaves the charge status
  // UNKNOWN (Stripe may have captured before the response was lost), so callers
  // that move money must treat a non-'[stripe]' throw as ambiguous, never as a
  // clean decline to auto-retry (see pages/api/charge-card.js).
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers,
    body: body ? encodeForm(body).toString() : undefined,
    signal: AbortSignal.timeout(20000),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`[stripe] ${method} ${path}: ${json?.error?.message || res.status}`)
  return json
}

// Reuse the customer's Stripe Customer if we have one, else create it. Returns
// the Stripe customer id (caller persists it on customers.stripe_customer_id).
export async function getOrCreateCustomer({ existingId, email, name, appCustomerId }) {
  if (existingId) return existingId
  const c = await stripeApi('customers', {
    body: { email: email || undefined, name: name || undefined, metadata: { app_customer_id: appCustomerId } },
  })
  return c.id
}

// Amount is in the smallest unit (pence). `reference` is our idempotency key and
// is echoed in metadata so the webhook can post exactly one ledger row.
export async function createPaymentIntent({ amountPence, currency = 'gbp', customerId, appCustomerId, reference, description }) {
  return stripeApi('payment_intents', {
    idempotencyKey: reference,
    body: {
      amount: Math.round(amountPence),
      currency,
      customer: customerId || undefined,
      description: description || undefined,
      'automatic_payment_methods[enabled]': 'true',
      // Save the card for later off-session charges (card-on-file) whenever a
      // customer pays — the webhook stores the resulting payment method.
      setup_future_usage: 'off_session',
      // The webhook reads these back to post exactly one ledger row to the
      // right customer, regardless of which browser confirmed the intent.
      metadata: { charge_reference: reference, app_customer_id: appCustomerId || '' },
    },
  })
}

// Save a card for later off-session charges (card-on-file) without charging now.
export async function createSetupIntent({ customerId, appCustomerId }) {
  return stripeApi('setup_intents', {
    body: {
      customer: customerId,
      usage: 'off_session',
      'automatic_payment_methods[enabled]': 'true',
      metadata: { app_customer_id: appCustomerId || '' },
    },
  })
}

// Charge a saved card-on-file when the customer ISN'T present (deposits,
// no-shows, SIM direct-debits). confirm:true attempts it immediately; it can
// throw authentication_required (SCA) — the caller surfaces that so the card is
// re-authorised next time the customer is present.
export async function chargeOffSession({ amountPence, currency = 'gbp', customerId, paymentMethodId, appCustomerId, reference, description }) {
  return stripeApi('payment_intents', {
    idempotencyKey: reference,
    body: {
      amount: Math.round(amountPence),
      currency,
      customer: customerId,
      payment_method: paymentMethodId,
      off_session: 'true',
      confirm: 'true',
      description: description || undefined,
      metadata: { charge_reference: reference, app_customer_id: appCustomerId || '' },
    },
  })
}

// Refund a card payment (full or partial) by its PaymentIntent id. `reference`
// is the idempotency key so a double-submit collapses to one refund. Omit
// amountPence for a full refund. Returns the Stripe refund object.
export async function refundPayment({ paymentIntentId, amountPence, reference }) {
  return stripeApi('refunds', {
    idempotencyKey: reference,
    body: {
      payment_intent: paymentIntentId,
      amount: amountPence ? Math.round(amountPence) : undefined, // undefined = full
      metadata: { refund_reference: reference || '' },
    },
  })
}

// Verify a webhook per Stripe's scheme: header "t=<ts>,v1=<sig>[,v1=…]",
// signed payload = `${t}.${rawBody}`, HMAC-SHA256 with the webhook secret.
// Returns the parsed event on success, or null if verification fails.
export function verifyWebhook(rawBody, sigHeader, toleranceSec = 300) {
  if (!WEBHOOK_SECRET || !sigHeader) return null
  const parts = Object.fromEntries(
    String(sigHeader).split(',').map((p) => {
      const i = p.indexOf('=')
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()]
    })
  )
  const t = parts.t
  const v1s = String(sigHeader).split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3))
  if (!t || !v1s.length) return null
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(`${t}.${rawBody}`).digest('hex')
  const ok = v1s.some((sig) => {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  })
  if (!ok) return null
  if (toleranceSec && Math.abs(Math.floor(Date.now() / 1000) - Number(t)) > toleranceSec) return null
  try { return JSON.parse(rawBody) } catch { return null }
}

export const webhookConfigured = !!WEBHOOK_SECRET
