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

  if (action === 'approve') {
    await db.update('customer_documents', `id=eq.${encodeURIComponent(id)}`, { status: 'published' })
    return res.json({ success: true, status: 'published' })
  }

  const reason = String(note || '').trim().slice(0, 300) || null
  const rows = await db.select('customer_documents', `select=storage_path&id=eq.${encodeURIComponent(id)}`)
  if (rows[0] && storageEnabled) await removeObject(DOCS_BUCKET, rows[0].storage_path).catch(() => {})
  await db.update('customer_documents', `id=eq.${encodeURIComponent(id)}`, { status: 'rejected', note: reason })
  return res.json({ success: true, status: 'rejected' })
}

export default withStaff(handler)
