// Staff review of a customer-uploaded document: approve (publish) or reject.
// A reject KEEPS the row — status 'rejected', plus an optional note the
// customer sees in their portal — and only removes the stored file. The
// record must survive, or the customer's "awaiting review" item silently
// vanishes with no explanation (owner-reported, 08-04). Removing the record
// entirely stays a separate, deliberate act (DELETE /api/documents).
import { withStaff, tabAllowedFor } from '../../../lib/auth.js'
import { db, tablesMode } from '../../../lib/db.js'
import { storageEnabled, DOCS_BUCKET, removeObject } from '../../../lib/storage.js'

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Documents need the relational data layer.' })
  if (!(await tabAllowedFor(req.staff, 'customers'))) return res.status(403).json({ success: false, error: 'Not permitted.' })

  const { id, action, note } = req.body || {}
  if (!id || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ success: false, error: 'id and action (approve|reject) required.' })
  }

  // Both verdicts only apply to a doc still awaiting review — two staff can
  // have the same pending card on screen, and the loser of that race must get
  // a conflict, not silently flip the other's verdict (a late approve would
  // republish a rejected doc whose file is already gone). The guarded update
  // runs FIRST; the reject only deletes the stored file after it has won the
  // row, so a lost race never removes a published document's file.
  const pendingOnly = `id=eq.${encodeURIComponent(id)}&status=eq.pending`

  if (action === 'approve') {
    const updated = await db.update('customer_documents', pendingOnly, { status: 'published' })
    if (!updated.length) return res.status(409).json({ success: false, error: 'Already reviewed — refresh to see its current state.' })
    return res.json({ success: true, status: 'published' })
  }

  const reason = String(note || '').trim().slice(0, 300) || null
  const updated = await db.update('customer_documents', pendingOnly, { status: 'rejected', note: reason })
  if (!updated.length) return res.status(409).json({ success: false, error: 'Already reviewed — refresh to see its current state.' })
  if (storageEnabled && updated[0].storage_path) await removeObject(DOCS_BUCKET, updated[0].storage_path).catch(() => {})
  return res.json({ success: true, status: 'rejected' })
}

export default withStaff(handler)
