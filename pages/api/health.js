// Lightweight liveness/readiness probe. Public (no auth) so an uptime monitor
// can hit it, but it leaks nothing — only whether the app can reach its data
// layer. Returns 200 when healthy, 503 when the DB is unreachable.
import { db, tablesMode } from '../../lib/db.js'
import { emailStatus } from '../../lib/email.js'
import { smsStatus } from '../../lib/sms.js'
import { stripeStatus } from '../../lib/stripe.js'
import { secretsEnabled } from '../../lib/secretbox.js'

export default async function handler(req, res) {
  // `email`/`sms` report whether each channel is configured and its send mode
  // (hold / test / live) — never any secret — so the owner can confirm the
  // wiring AND the safety gate without opening Vercel.
  // `vault` says whether the credential-vault key (SIM_CRED_KEY) is present
  // AND valid — on/off only, never the key itself. `env`/`project` identify
  // WHICH deployment answered — production vs preview vs a second project —
  // because env vars differ per environment and "works here, broken there"
  // is otherwise undiagnosable from the outside.
  const base = {
    email: emailStatus(),
    sms: smsStatus(),
    stripe: stripeStatus(),
    vault: secretsEnabled ? 'on' : 'off',
    env: process.env.VERCEL_ENV || 'local',
    project: process.env.VERCEL_PROJECT_PRODUCTION_URL || null,
    time: new Date().toISOString(),
  }
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
