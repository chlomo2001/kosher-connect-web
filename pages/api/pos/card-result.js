// Terminal card result → one card_receipts row, joined to the ledger payment
// by charge_reference. Phase 2 Workstream A step 2: the K300 wrapper's bridge
// reports the myPOS result to the till page, which posts it here. Recording is
// idempotent by construction — the partial unique index allows exactly one
// approved row per reference, so a resent result never double-posts. This
// endpoint records reconciliation metadata only; the money itself is the
// ledger row the sale already wrote.

import { withStaff } from '../../../lib/auth.js'
import { db, tablesMode } from '../../../lib/db.js'
import { sanitizeCardResult } from '../../../lib/posCard.mjs'

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!tablesMode) {
    return res.status(503).json({ success: false, error: 'Relational data layer unavailable.' })
  }
  const parsed = sanitizeCardResult(req.body || {})
  if (!parsed.ok) return res.status(400).json({ success: false, error: parsed.error })

  try {
    await db.insert('card_receipts', [parsed.row])
  } catch (e) {
    // A resent approved result trips card_receipts_approved_ref (HTTP 409):
    // that's a retry of something already recorded, not a failure.
    if (parsed.row.approved && /HTTP 409|duplicate key/i.test(String(e.message || e))) {
      return res.json({ success: true, duplicate: true })
    }
    console.error('[api/pos/card-result]', e)
    return res.status(500).json({ success: false, error: 'Could not record the terminal result.' })
  }
  return res.json({ success: true })
}

export default withStaff(handler)
