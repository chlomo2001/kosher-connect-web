// Operator download — cookie-authenticated, so a plain <a href> works: we look
// up the file and 302 to a short-lived signed URL.
import { withStaff, tabAllowedFor } from '../../../lib/auth.js'
import { db, tablesMode } from '../../../lib/db.js'
import { storageEnabled, DOCS_BUCKET, signedUrl } from '../../../lib/storage.js'

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  if (!tablesMode || !storageEnabled) return res.status(503).json({ success: false, error: 'Documents unavailable.' })
  if (!(await tabAllowedFor(req.staff, 'customers'))) return res.status(403).json({ success: false, error: 'Not permitted.' })
  const id = String(req.query.id || '')
  const rows = await db.select('customer_documents', `select=storage_path,status&id=eq.${encodeURIComponent(id)}`)
  if (!rows[0]) return res.status(404).json({ success: false, error: 'Not found.' })
  // A reject keeps the row but removes the stored file — signing that path
  // would throw. Old links get a clean "gone" instead of a 500.
  if (rows[0].status === 'rejected') return res.status(410).json({ success: false, error: 'This file was removed when the upload was rejected.' })
  const url = await signedUrl(DOCS_BUCKET, rows[0].storage_path, 120)
  res.redirect(302, url)
}

export default withStaff(handler)
