// Till ↔ card terminal via the myPOS ePOS API (cloud lane — no Android
// wrapper needed). The till starts a payment here, polls it until the
// terminal answers, and the money/reconciliation story is unchanged: an
// approved outcome is recorded through /api/pos/card-result exactly like the
// wrapper lane, keyed by the same charge reference.
//
//   GET                → { enabled, mode }   (till probe: is the lane on?)
//   GET ?paymentId=…   → { status, approved, done, error? }
//   POST {op:'charge'} → { paymentId }       start payment on the shop TID
//   POST {op:'cancel'} → { success }         give up while still in progress
//
// Feature-gated by MYPOS_EPOS_MODE env (see lib/mypos.mjs): absent = 404s,
// till shows the manual card flow it always had.

import { withStaff, tabAllowedFor } from '../../../lib/auth.js'
import {
  eposEnabled, eposMode, mapEposStatus,
  createEposPayment, getEposPayment, cancelEposPayment,
} from '../../../lib/mypos.mjs'

async function handler(req, res) {
  if (!(await tabAllowedFor(req.staff, 'shop'))) {
    return res.status(403).json({ success: false, error: 'Not permitted.' })
  }

  if (req.method === 'GET') {
    const paymentId = String(req.query.paymentId || '')
    if (!paymentId) return res.json({ success: true, enabled: eposEnabled, mode: eposMode })
    if (!eposEnabled) return res.status(404).json({ success: false, error: 'Terminal lane is off.' })
    try {
      const p = await getEposPayment(paymentId)
      if (!p) return res.status(404).json({ success: false, error: 'Unknown payment.' })
      const mapped = mapEposStatus(p.status)
      return res.json({ success: true, status: p.status, ...mapped, paymentId })
    } catch (e) {
      console.error('[api/pos/terminal] status', e)
      return res.status(502).json({ success: false, error: 'Could not reach myPOS.' })
    }
  }

  if (req.method === 'POST') {
    if (!eposEnabled) return res.status(404).json({ success: false, error: 'Terminal lane is off.' })
    const { op } = req.body || {}

    if (op === 'charge') {
      const { chargeReference, amountPence } = req.body || {}
      // Same reference shape card_receipts accepts; pence as a bounded integer
      // (mirrors sanitizeCardResult's £100k ceiling).
      if (!/^[\w-]{8,128}$/.test(String(chargeReference || ''))) {
        return res.status(400).json({ success: false, error: 'Bad or missing chargeReference.' })
      }
      const pence = Number(amountPence)
      if (!Number.isInteger(pence) || pence <= 0 || pence >= 10000000) {
        return res.status(400).json({ success: false, error: 'Bad amount.' })
      }
      try {
        const p = await createEposPayment({
          amountPence: pence,
          reference: chargeReference,
          description: `KC till sale ${chargeReference}`,
        })
        return res.json({ success: true, paymentId: p.payment_id })
      } catch (e) {
        console.error('[api/pos/terminal] charge', e)
        return res.status(502).json({ success: false, error: 'The card machine could not be started.' })
      }
    }

    if (op === 'cancel') {
      const paymentId = String(req.body?.paymentId || '')
      if (!paymentId) return res.status(400).json({ success: false, error: 'paymentId required.' })
      try {
        await cancelEposPayment(paymentId)
        return res.json({ success: true })
      } catch (e) {
        // Best-effort: a payment that already finished can't be cancelled —
        // the poll will pick up its real outcome.
        return res.json({ success: true, note: 'Cancel not accepted (may have already finished).' })
      }
    }

    return res.status(400).json({ success: false, error: 'Unknown op.' })
  }

  return res.status(405).end()
}

export default withStaff(handler)
