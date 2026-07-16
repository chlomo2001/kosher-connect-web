// Operator-side customer documents: list / upload / delete. Staff uploads are
// published immediately (visible to the customer in the portal). Customer
// uploads arrive as 'pending' here for review (see documents/review.js).
import { withStaff, tabAllowedFor } from '../../lib/auth.js'
import { db, tablesMode } from '../../lib/db.js'
import { storageEnabled, DOCS_BUCKET, putObject, removeObject } from '../../lib/storage.js'
import { decodeUpload, docStoragePath } from '../../lib/documents.js'

// base64(10MB) ≈ 13.3MB, so a 12mb cap rejected legitimate ~9MB files before the
// friendly 10MB decoded check could run. 15mb gives headroom so decodeUpload's
// MAX_DOC_BYTES check is the authoritative limit. audit C12.
export const config = { api: { bodyParser: { sizeLimit: '15mb' } } }

// The operator app keys customers by legacy id; customer_documents.customer_id
// is the customers UUID. Resolve one to the other (same as pages/api/email.js).
async function customerUuid(legacyId) {
  const rows = await db.select('customers', `select=id&legacy_id=eq.${encodeURIComponent(String(legacyId))}`)
  return rows[0]?.id || null
}

async function handler(req, res) {
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Documents need the relational data layer.' })
  if (!(await tabAllowedFor(req.staff, 'customers'))) return res.status(403).json({ success: false, error: 'Not permitted.' })

  if (req.method === 'GET') {
    const customerId = String(req.query.customerId || '')
    if (!customerId) return res.status(400).json({ success: false, error: 'customerId required.' })
    const uuid = await customerUuid(customerId)
    if (!uuid) return res.json({ success: true, documents: [] })
    const documents = await db.select('customer_documents',
      `select=id,filename,content_type,size_bytes,source,status,note,created_at&customer_id=eq.${uuid}&order=created_at.desc`)
    return res.json({ success: true, documents })
  }

  if (req.method === 'POST') {
    if (!storageEnabled) return res.status(503).json({ success: false, error: 'File storage isn’t configured.' })
    const { customerId, filename, contentType, dataBase64 } = req.body || {}
    if (!customerId) return res.status(400).json({ success: false, error: 'customerId required.' })
    const uuid = await customerUuid(customerId)
    if (!uuid) return res.status(404).json({ success: false, error: 'Customer not found.' })
    let file
    try { file = decodeUpload({ filename, contentType, dataBase64 }) }
    catch (e) { return res.status(400).json({ success: false, error: e.message }) }
    const path = docStoragePath(uuid, file.safeName)
    await putObject(DOCS_BUCKET, path, file.bytes, file.contentType)
    const [document] = await db.insert('customer_documents', [{
      customer_id: uuid, storage_path: path, filename: file.safeName,
      content_type: file.contentType, size_bytes: file.size,
      source: 'staff', status: 'published', uploaded_by: req.staff?.id || 'staff',
    }])
    return res.json({ success: true, document })
  }

  if (req.method === 'DELETE') {
    const id = String(req.query.id || '')
    if (!id) return res.status(400).json({ success: false, error: 'id required.' })
    const rows = await db.select('customer_documents', `select=storage_path&id=eq.${encodeURIComponent(id)}`)
    if (rows[0]) {
      if (storageEnabled) await removeObject(DOCS_BUCKET, rows[0].storage_path).catch(() => {})
      await db.delete('customer_documents', `id=eq.${encodeURIComponent(id)}`)
    }
    return res.json({ success: true })
  }

  return res.status(405).end()
}

export default withStaff(handler)
