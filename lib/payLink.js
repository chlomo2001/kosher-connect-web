// Mint a Stripe pay link that is TAGGED with the app customer, so paying it
// credits their wallet by itself (the payment_intent.succeeded webhook reads
// the metadata). Not pure — it talks to Stripe and to the customers table.
//
// This was inline in pages/api/payment-link.js and is now shared, because the
// rental receipt carries a pay button too and two copies of this would be two
// answers to "which Stripe customer is this, and what email does Stripe hold
// for them". The healing steps below are the reason that matters: get them
// wrong in one copy and Checkout shows the shop's own carrier-login Gmail,
// locked, on the customer's pay page.

import { db } from './db.js'
import {
  getOrCreateCustomer, createCheckoutLink, createOpenCheckoutLink, updateCustomerEmail,
} from './stripe.js'
import { isOwnAccountEmail } from './ownEmails.mjs'

/**
 * `customer` is a row with { id, stripe_customer_id, email_raw,
 * email_normalized, first_name, last_name }.
 *
 * Returns the Checkout session. Throws what Stripe threw — callers decide
 * whether that is fatal (the staff button) or merely a missing button (the
 * receipt).
 */
export async function mintPayLink(customer, { amount, description, reference, base, openAmount = false }) {
  const c = customer
  // Never hand Stripe one of OUR carrier-login Gmail aliases as the customer's
  // email — Checkout shows it locked on the pay page and the receipt goes to
  // the shop's inbox instead of the customer.
  const rawEmail = (c.email_raw || c.email_normalized || '').trim()
  const contactEmail = rawEmail && !isOwnAccountEmail(rawEmail) ? rawEmail : ''
  const name = `${c.first_name || ''} ${c.last_name || ''}`.trim()

  // Ensure a Stripe customer so the saved card (setup_future_usage) attaches to
  // the right person; persist the id so we don't remint it next time.
  const stripeCustomerId = await getOrCreateCustomer({
    existingId: c.stripe_customer_id, email: contactEmail || undefined, name, appCustomerId: c.id,
  })
  if (stripeCustomerId && stripeCustomerId !== c.stripe_customer_id) {
    await db.update('customers', `id=eq.${c.id}`, { stripe_customer_id: stripeCustomerId })
  }
  // Heal customers minted before the guard: point Stripe's stored email at the
  // real contact address, or clear it so Checkout asks. Best-effort — a failure
  // here should not block the link.
  if (stripeCustomerId) {
    try { await updateCustomerEmail(stripeCustomerId, contactEmail) } catch { /* non-fatal */ }
  }

  const args = {
    currency: 'gbp',
    appCustomerId: c.id,
    customerId: stripeCustomerId,
    reference,
    description: (description || `Payment — ${name || 'Kosher Connect'}`).slice(0, 200),
    successUrl: `${base}/welcome?paid=1`,
    cancelUrl: `${base}/welcome`,
  }
  return openAmount
    ? createOpenCheckoutLink({ ...args, suggestedPence: Math.round(amount * 100) })
    : createCheckoutLink({ ...args, amountPence: Math.round(amount * 100) })
}
