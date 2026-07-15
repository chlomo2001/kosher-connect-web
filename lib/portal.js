// Resolve the signed-in portal customer from the Bearer token, mirroring the
// logic in pages/api/portal/me.js so the documents + pay endpoints identify the
// customer the same way. The PORTAL_ENABLED gate stays each route's job.
import { db } from './db.js'
import { verifyPortalToken } from './auth.js'
import { normalizeEmail } from './mappers.js'

// Returns { id, legacy_extras } for the customer, or null if the token is
// invalid or matches no customer. `columns` lets a caller pull extra fields
// (e.g. stripe_customer_id, email) in the same round-trip.
export async function resolvePortalCustomer(req, columns = 'id,legacy_extras') {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
  const user = await verifyPortalToken(token)
  if (!user) return null
  const norm = normalizeEmail(user.email)
  if (!norm) return null
  const rows = await db.select(
    'customers',
    `select=${columns}&email_normalized=eq.${encodeURIComponent(norm)}`
  )
  return rows[0] || null
}
