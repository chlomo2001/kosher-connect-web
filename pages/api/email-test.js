// Settings → Messaging: "send a test email" — proves the Resend connection
// end-to-end without touching a customer record.
//
//   POST { to }  (an address the OWNER types — their own, typically)
//
// The counterpart to pages/api/sms-test.js, and it did not exist until 25 Aug:
// SMS could be proved with one button and email could only be proved by firing
// a real receipt at a real customer. That is a poor way to find out that the
// sending domain is unverified.
//
// The lib/email.js gate still applies, so the mode decides what happens:
//   HOLD → built + logged, nothing sent (the response says so);
//   TEST → goes to MAIL_TEST_TO regardless of `to`;
//   LIVE → goes to the address typed.
// Settings-tab permission required — the same bar as seeing the card at all.
//
// It sends through brandShell, not a plain line of text, on purpose. What is
// worth proving is not that bytes reach an inbox — it is that the real
// template renders there: the logo loads over https, the navy-to-gold keyline
// survives, and the footer carries the shop's own details. A plain-text test
// would pass on the day the branded one breaks.
import { withStaff, tabAllowedFor } from '../../lib/auth.js'
import { emailEnabled, sendEmail, emailStatus, brandShell, esc } from '../../lib/email.js'

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!(await tabAllowedFor(req.staff, 'settings'))) {
    return res.status(403).json({ success: false, error: 'Not permitted.' })
  }
  if (!emailEnabled) {
    return res.status(503).json({
      success: false,
      error: 'Email isn’t connected yet — add the Resend key in Vercel, then redeploy.',
    })
  }
  const status = emailStatus()
  const to = String(req.body?.to || '').trim()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return res.status(400).json({ success: false, error: 'Enter the address to email (e.g. you@example.com).' })
  }
  // The time is in the body so two tests minutes apart are told apart in a
  // crowded inbox, and so a cached or re-delivered copy is obvious.
  const when = new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' });
  try {
    const r = await sendEmail({
      to,
      kind: 'test',
      subject: 'Kosher Connect — test email',
      text: `The email connection works. Sent ${when} from the Kosher Connect app.`,
      html: brandShell({
        title: 'The email connection works',
        preheader: 'A test from the Kosher Connect app — no action needed.',
        bodyRows: `<tr><td style="padding:4px 0 10px">This is a test sent from Settings → Messaging. Nothing has been charged and no customer was contacted.</td></tr>
          <tr><td style="padding:0 0 4px;color:#5b6572">Sent ${esc(when)}</td></tr>`,
        footNote: 'If you were not expecting this, someone signed in to the shop app is checking the mail setup.',
      }),
    })
    // sendEmail refuses rather than throws for these two, and both are real
    // answers a person needs: a suppressed address will never receive anything
    // again until it is un-suppressed, and saying "sent" would be a lie.
    if (r.invalid) return res.status(400).json({ success: false, error: 'That is not a single valid address.' })
    if (r.suppressed) {
      return res.status(409).json({
        success: false,
        error: `That address is suppressed (${r.reason}) — it bounced or was marked as spam before, so nothing will reach it until that is cleared.`,
      })
    }
    return res.json({ success: true, provider: status.provider, mode: status.mode, ...r })
  } catch (e) {
    console.error('[api/email-test]', e)
    return res.status(502).json({
      success: false,
      error: `${status.provider || 'The mail provider'} refused the send: ${String(e.message || e).slice(0, 200)}`,
    })
  }
}

export default withStaff(handler)
