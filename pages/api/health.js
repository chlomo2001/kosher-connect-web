// Lightweight liveness/readiness probe. Public (no auth) so an uptime monitor
// can hit it, but it leaks nothing — only whether the app can reach its data
// layer. Returns 200 when healthy, 503 when the DB is unreachable.
import { db, tablesMode } from '../../lib/db.js'
import { emailEnabled } from '../../lib/email.js'

export default async function handler(req, res) {
  // `email` reports only whether receipts are configured (bool) — never any
  // secret — so the owner can confirm SMTP is wired without opening Vercel.
  const base = { email: emailEnabled, time: new Date().toISOString() }
  // No-DB mode is a valid, healthy configuration (the app runs on file storage).
  if (!tablesMode) {
    return res.status(200).json({ ok: true, mode: 'file', ...base })
  }
  try {
    // Cheapest possible round-trip: ask for a single settings key.
    await db.select('settings', 'select=key&limit=1')
    return res.status(200).json({ ok: true, mode: 'tables', ...base })
  } catch (e) {
    console.error('[api/health] db unreachable:', e)
    return res.status(503).json({ ok: false, mode: 'tables', ...base, error: 'database unreachable' })
  }
}
