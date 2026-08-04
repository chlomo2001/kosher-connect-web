// Portal download — the customer authenticates with a Bearer token (which a
// plain <a> can't carry), so we return the signed URL as JSON and the page
// opens it. Only the owning customer, and only published staff docs or their
// own uploads, are ever signed.
import { db, tablesMode } from '../../../../lib/db.js'
import { resolvePortalCustomer } from '../../../../lib/portal.js'
import { storageEnabled, DOCS_BUCKET, signedUrl } from '../../../../lib/storage.js'

export default async function handler(req, res) {
  if (process.env.PORTAL_ENABLED !== '1') return res.status(404).json({ success: false, error: 'Not found.' })
  if (req.method !== 'GET') return res.status(405).end()
  if (!tablesMode || !storageEnabled) return res.status(503).json({ success: false, error: 'Unavailable.' })
  const cust = await resolvePortalCustomer(req)
  if (!cust) return res.status(401).json({ success: false, error: 'Please sign in again.' })

  const id = String(req.query.id || '')
  const rows = await db.select('customer_documents',
    `select=storage_path,customer_id,source,status&id=eq.${encodeURIComponent(id)}`)
  const doc = rows[0]
  if (!doc || doc.customer_id !== cust.id) return res.status(404).json({ success: false, error: 'Not found.' })
  // A rejected upload's stored file is deleted on review — the row survives
  // (so the customer sees why), but there is nothing left to sign.
  const allowed = (doc.source === 'staff' && doc.status === 'published') ||
    (doc.source === 'customer' && doc.status !== 'rejected')
  if (!allowed) return res.status(403).json({ success: false, error: 'Not available.' })

  const url = await signedUrl(DOCS_BUCKET, doc.storage_path, 120)
  return res.json({ success: true, url })
}
