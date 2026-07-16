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
  const wantCols = columns.includes('email_raw') ? columns : `${columns},email_raw`
  const rows = await db.select(
    'customers',
    `select=${wantCols}&email_normalized=eq.${encodeURIComponent(norm)}`
  )
  if (rows.length <= 1) return rows[0] || null
  // Several customers collapse to one normalized email (dots/+ are significant
  // outside Gmail), so a lossy match could hand one person another's account.
  // Require the verified RAW email to match exactly. audit C8 / U1.
  const wanted = String(user.email || '').trim().toLowerCase()
  return rows.find((r) => String(r.email_raw || '').trim().toLowerCase() === wanted) || null
}
