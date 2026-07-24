// Settings → Messaging: "send a test SMS" — proves the SMS provider
// connection (Textlocal or Twilio) end-to-end without touching a customer record.
//
//   POST { to }  (a phone number the OWNER types — their own, typically)
//
// The lib/sms.js gate still applies, so this is safe in every mode:
//   HOLD → built + logged, nothing sent (the response says so);
//   TEST → goes to SMS_TEST_TO regardless of `to`;
//   LIVE → goes to the number typed.
// Settings-tab permission required — the same bar as seeing the card at all.

import { withStaff, tabAllowedFor } from '../../lib/auth.js'
import { smsEnabled, sendSms, smsStatus } from '../../lib/sms.js'

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!(await tabAllowedFor(req.staff, 'settings'))) {
    return res.status(403).json({ success: false, error: 'Not permitted.' })
  }
  if (!smsEnabled) {
    return res.status(503).json({
      success: false,
      error: 'No SMS provider connected yet — add TEXTLOCAL_API_KEY (Textlocal) or the TWILIO_* keys in Vercel, then redeploy.',
    })
  }
  const provider = smsStatus().provider || 'SMS'
  const to = String(req.body?.to || '').replace(/[^\d+]/g, '')
  if (to.length < 7) return res.status(400).json({ success: false, error: 'Enter the number to text (e.g. +44 7…).' })
  try {
    const r = await sendSms({ to, body: 'KosherConnect test — the SMS connection works. 👍' })
    return res.json({ success: true, provider, ...r })
  } catch (e) {
    console.error('[api/sms-test]', e)
    return res.status(502).json({ success: false, error: `${provider} refused the send: ${String(e.message || e).slice(0, 200)}` })
  }
}

export default withStaff(handler)
