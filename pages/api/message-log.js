// The message log — every email and SMS the system BUILT, whatever happened
// to it (held by the safety gate, redirected to the test inbox, sent live,
// failed, bounced…). Read-only over email_log, which both lib/email.js and
// lib/sms.js write to, so this is the one audit trail for every channel.
// Settings-tab gated: it shows customer contact details in bulk, so it follows
// the same permission as the rest of the Settings screen.
import { withStaff, tabAllowedFor } from '../../lib/auth.js'
import { db, tablesMode } from '../../lib/db.js'

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Needs the relational data layer.' })
  if (!(await tabAllowedFor(req.staff, 'settings'))) {
    return res.status(403).json({ success: false, error: 'Not permitted.' })
  }

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 300)
  try {
    const rows = await db.select('email_log',
      `select=id,created_at,kind,to_email,actual_to,subject,status,provider,error,customers(first_name,last_name)`
      + `&order=created_at.desc&limit=${limit}`)
    return res.json({
      success: true,
      entries: rows.map((r) => ({
        id: r.id,
        at: r.created_at,
        channel: r.provider === 'twilio' ? 'sms' : 'email',
        kind: r.kind || '',
        to: r.to_email,
        actualTo: r.actual_to || null,
        subject: r.subject || '',
        status: r.status,
        error: r.error || null,
        customerName: r.customers
          ? `${r.customers.first_name || ''} ${r.customers.last_name || ''}`.trim()
          : null,
      })),
    })
  } catch (e) {
    console.error('[api/message-log]', e)
    return res.status(502).json({ success: false, error: 'Could not read the message log.' })
  }
}

export default withStaff(handler)
