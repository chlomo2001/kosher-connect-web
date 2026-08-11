// A real Stripe-hosted invoice for a house-account settlement that has
// ALREADY been charged via /api/charge-card. This never moves money — it
// only documents a charge that already happened — so it's owner-only for the
// same reason charge-card is (customer's real billing record), but safe to
// retry: a repeat call for the same customer-month reuses the same Stripe
// idempotency keys and returns the same invoice.
import { withStaff, requireOwner } from '../../lib/auth.js'
import { db, tablesMode } from '../../lib/db.js'
import { stripeEnabled, createHouseInvoice } from '../../lib/stripe.js'

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Needs the relational data layer.' })
  if (!stripeEnabled) return res.status(503).json({ success: false, error: 'Card payments aren’t switched on yet.' })
  if (requireOwner(req, res)) return

  const { customerId, ym, amount } = req.body || {}
  const amt = Math.round((Number(amount) || 0) * 100) / 100
  if (!customerId) return res.status(400).json({ success: false, error: 'customerId required.' })
  if (!/^\d{4}-\d{2}$/.test(String(ym || ''))) return res.status(400).json({ success: false, error: 'ym must be YYYY-MM.' })
  if (!(amt > 0)) return res.status(400).json({ success: false, error: 'Enter an amount greater than £0.' })

  const rows = await db.select('customers',
    `select=id,stripe_customer_id,first_name,last_name&legacy_id=eq.${encodeURIComponent(String(customerId))}`)
  const c = rows[0]
  if (!c) return res.status(404).json({ success: false, error: 'Customer not found.' })
  if (!c.stripe_customer_id) {
    return res.status(400).json({ success: false, error: 'No Stripe customer on file for this customer.' })
  }

  // Same clientRef shape as the charge itself (house-<YYYY-MM>), so a repeat
  // call for the same customer-month is provably the SAME settlement, not a
  // new one — every Stripe call inside createHouseInvoice keys off this.
  const reference = `house-invoice-${c.id}-${ym}`
  const name = `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'customer'
  const monthName = new Date(`${ym}-01T12:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  try {
    const invoice = await createHouseInvoice({
      customerId: c.stripe_customer_id,
      appCustomerId: c.id,
      amountPence: Math.round(amt * 100),
      description: `House account — settlement for ${monthName}`,
      reference,
    })
    return res.json({
      success: true,
      hostedInvoiceUrl: invoice.hosted_invoice_url || null,
      invoicePdf: invoice.invoice_pdf || null,
      number: invoice.number || null,
    })
  } catch (e) {
    console.error('[api/house-invoice]', name, e)
    const isStripeError = typeof e.message === 'string' && e.message.startsWith('[stripe]')
    return res.status(isStripeError ? 502 : 500).json({
      success: false,
      error: isStripeError ? (e.message || 'Stripe declined the invoice.') : 'Could not reach Stripe.',
    })
  }
}

export default withStaff(handler)
