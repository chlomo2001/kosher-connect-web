// Portal-side documents: the customer sees staff-published docs plus their own
// uploads (any status, so they can see 'pending'), and can upload files back —
// which land as 'pending' for staff to approve.
import { db, tablesMode } from '../../../lib/db.js'
import { resolvePortalCustomer } from '../../../lib/portal.js'
import { storageEnabled, DOCS_BUCKET, putObject } from '../../../lib/storage.js'
import { decodeUpload, docStoragePath } from '../../../lib/documents.js'

// base64(10MB) ≈ 13.3MB, so a 12mb cap rejected legitimate ~9MB files before the
// friendly 10MB decoded check could run. 15mb gives headroom so decodeUpload's
// MAX_DOC_BYTES check is the authoritative limit. audit C12.
export const config = { api: { bodyParser: { sizeLimit: '15mb' } } }

export default async function handler(req, res) {
  if (process.env.PORTAL_ENABLED !== '1') return res.status(404).json({ success: false, error: 'Not found.' })
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Portal unavailable.' })
  const cust = await resolvePortalCustomer(req)
  if (!cust) return res.status(401).json({ success: false, error: 'Please sign in again.' })

  if (req.method === 'GET') {
    const documents = await db.select('customer_documents',
      `select=id,filename,content_type,size_bytes,source,status,note,created_at` +
      `&customer_id=eq.${cust.id}` +
      `&or=(and(source.eq.staff,status.eq.published),source.eq.customer)` +
      `&order=created_at.desc`)
    return res.json({ success: true, documents })
  }

  if (req.method === 'POST') {
    if (!storageEnabled) return res.status(503).json({ success: false, error: 'Uploads aren’t available right now.' })
    let file
    try { file = decodeUpload(req.body || {}) }
    catch (e) { return res.status(400).json({ success: false, error: e.message }) }
    const path = docStoragePath(cust.id, file.safeName)
    await putObject(DOCS_BUCKET, path, file.bytes, file.contentType)
    const [document] = await db.insert('customer_documents', [{
      customer_id: cust.id, storage_path: path, filename: file.safeName,
      content_type: file.contentType, size_bytes: file.size,
      source: 'customer', status: 'pending', uploaded_by: 'customer',
    }])
    return res.json({ success: true, document })
  }

  return res.status(405).end()
}
