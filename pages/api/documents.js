// Operator-side customer documents: list / upload / delete. Staff uploads are
// published immediately (visible to the customer in the portal). Customer
// uploads arrive as 'pending' here for review (see documents/review.js).
import { withStaff, tabAllowedFor } from '../../lib/auth.js'
import { db, tablesMode } from '../../lib/db.js'
import { storageEnabled, DOCS_BUCKET, putObject, removeObject } from '../../lib/storage.js'
import { decodeUpload, docStoragePath } from '../../lib/documents.js'

export const config = { api: { bodyParser: { sizeLimit: '12mb' } } }

async function handler(req, res) {
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Documents need the relational data layer.' })
  if (!(await tabAllowedFor(req.staff, 'customers'))) return res.status(403).json({ success: false, error: 'Not permitted.' })

  if (req.method === 'GET') {
    const customerId = String(req.query.customerId || '')
    if (!customerId) return res.status(400).json({ success: false, error: 'customerId required.' })
    const documents = await db.select('customer_documents',
      `select=id,filename,content_type,size_bytes,source,status,note,created_at&customer_id=eq.${encodeURIComponent(customerId)}&order=created_at.desc`)
    return res.json({ success: true, documents })
  }

  if (req.method === 'POST') {
    if (!storageEnabled) return res.status(503).json({ success: false, error: 'File storage isn’t configured.' })
    const { customerId, filename, contentType, dataBase64 } = req.body || {}
    if (!customerId) return res.status(400).json({ success: false, error: 'customerId required.' })
    let file
    try { file = decodeUpload({ filename, contentType, dataBase64 }) }
    catch (e) { return res.status(400).json({ success: false, error: e.message }) }
    const path = docStoragePath(customerId, file.safeName)
    await putObject(DOCS_BUCKET, path, file.bytes, file.contentType)
    const [document] = await db.insert('customer_documents', [{
      customer_id: customerId, storage_path: path, filename: file.safeName,
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
