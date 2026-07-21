// Portal "send us a request" — a signed-in customer types a free-text ask
// ("please call me about my SIM plan") and it lands as an OPEN task in the
// staff queue, linked to their customer record. Mirrors the /join pipeline:
// no email/SMS is sent, a person picks it up. Light abuse guard: at most 5
// open request tasks per customer at a time.
import { db, tablesMode } from '../../../lib/db.js'
import { resolvePortalCustomer } from '../../../lib/portal.js'

export default async function handler(req, res) {
  if (process.env.PORTAL_ENABLED !== '1') return res.status(404).json({ success: false, error: 'Not found.' })
  if (req.method !== 'POST') return res.status(405).end()
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Unavailable right now.' })
  const cust = await resolvePortalCustomer(req, 'id,first_name,last_name,phone_country_code,phone_number')
  if (!cust) return res.status(401).json({ success: false, error: 'Please sign in again.' })

  const message = String(req.body?.message || '').trim().slice(0, 500)
  if (!message) return res.status(400).json({ success: false, error: 'Type your request first.' })

  try {
    const open = await db.select('tasks',
      `select=id&customer_id=eq.${cust.id}&done=is.false&reference=like.REQ-*&limit=5`)
    if (open.length >= 5) {
      return res.status(429).json({ success: false, error: 'You already have several open requests — we’ll be in touch soon.' })
    }
    const name = `${cust.first_name || ''} ${cust.last_name || ''}`.trim() || 'customer'
    await db.insert('tasks', [{
      title: `Customer request: ${name}`,
      customer_id: cust.id,
      source: 'auto',
      priority: 'medium',
      raw_text: `${message}${cust.phone_number ? `\nPhone: ${cust.phone_country_code || ''} ${cust.phone_number}` : ''}`,
      reference: `REQ-${cust.id}-${Date.now()}`,
    }])
    return res.json({ success: true })
  } catch (e) {
    console.error('[api/portal/request]', e)
    return res.status(503).json({ success: false, error: 'That didn’t send — please call us instead.' })
  }
}
