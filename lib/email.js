// Outbound email via SMTP (Forward Email, or any SMTP provider).
//
// Enabled only when SMTP_HOST + SMTP_USER + SMTP_PASS are all set. Without
// them `emailEnabled` is false and callers degrade gracefully (the receipt
// button tells staff email isn't configured rather than throwing).
//
// SAFETY GATE — configuring SMTP does NOT start sending to real customers.
// Having the credentials set is separate from being ARMED to send. There is
// a three-state control so real addresses are never mailed by accident:
//   • (default) HOLD  — nothing is sent. Receipts are built and logged only.
//   • TEST            — set MAIL_TEST_TO=you@example.com; EVERY receipt is
//                       redirected to that one address (never the customer),
//                       so you can check it looks right. Takes precedence.
//   • LIVE            — set MAIL_LIVE=true; receipts go to the real customer
//                       address on file. Only flip this when you're ready.
//
// Env vars (mirror the Forward Email alias you generated):
//   SMTP_HOST   e.g. smtp.forwardemail.net
//   SMTP_PORT   465 (SSL) or 587 (STARTTLS) — defaults to 465
//   SMTP_USER   the alias address, e.g. receipts@kosher-connect.com
//   SMTP_PASS   the generated alias password
//   MAIL_FROM   optional display From, e.g. "KosherConnect <receipts@kosher-connect.com>"
//               (defaults to SMTP_USER)
//   MAIL_TEST_TO  optional — redirect ALL mail here (test mode)
//   MAIL_LIVE     set to true/1/yes to actually send to real customers

import nodemailer from 'nodemailer'

const HOST = (process.env.SMTP_HOST || '').trim()
const PORT = parseInt(process.env.SMTP_PORT || '465', 10) || 465
const USER = (process.env.SMTP_USER || '').trim()
const PASS = (process.env.SMTP_PASS || '').trim()
const FROM = (process.env.MAIL_FROM || '').trim() || USER

export const emailEnabled = !!(HOST && USER && PASS)

// Read the gate fresh each call (cheap) so status reflects the current env.
const truthy = (v) => /^(1|true|yes|on)$/i.test(String(v || '').trim())
function mailGate() {
  const testTo = (process.env.MAIL_TEST_TO || '').trim()
  if (testTo) return { mode: 'test', testTo }
  if (truthy(process.env.MAIL_LIVE)) return { mode: 'live' }
  return { mode: 'hold' }
}
// Reportable status for /api/health and the receipt UI — no secrets.
export function emailStatus() {
  return { configured: emailEnabled, mode: emailEnabled ? mailGate().mode : 'unconfigured' }
}

let cached = null
function transport() {
  if (!emailEnabled) return null
  if (cached) return cached
  cached = nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: PORT === 465, // 465 = implicit TLS, 587 = STARTTLS
    auth: { user: USER, pass: PASS },
  })
  return cached
}

// sendEmail({to, subject, html, text}) → resolves to one of:
//   { ok:true, held:true }                    HOLD  — nothing sent
//   { ok:true, id, redirectedTo }             TEST  — sent to the tester only
//   { ok:true, id, sentTo }                   LIVE  — sent to the real address
// Throws only on a genuine SMTP failure (never on the safety hold).
export async function sendEmail({ to, subject, html, text }) {
  const t = transport()
  if (!t) throw new Error('email-not-configured')
  const gate = mailGate()

  if (gate.mode === 'hold') {
    // Safety hold: the receipt is fully built but NOT sent. Log so it's
    // auditable that a send was attempted and deliberately suppressed.
    console.log(`[email] HELD (not sent — MAIL_LIVE not set) intended-to=${to} subject="${subject}"`)
    return { ok: true, held: true }
  }

  const actualTo = gate.mode === 'test' ? gate.testTo : to
  const subjectOut = gate.mode === 'test' ? `[TEST → ${to}] ${subject}` : subject
  const info = await t.sendMail({
    from: FROM,
    to: actualTo,
    subject: subjectOut,
    text: text || undefined,
    html: html || undefined,
  })
  return gate.mode === 'test'
    ? { ok: true, id: info.messageId, redirectedTo: actualTo }
    : { ok: true, id: info.messageId, sentTo: actualTo }
}

// Basic HTML escaping for values interpolated into receipt markup.
export const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
