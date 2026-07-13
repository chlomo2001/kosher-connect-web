// Outbound email via SMTP (Forward Email, or any SMTP provider).
//
// Enabled only when SMTP_HOST + SMTP_USER + SMTP_PASS are all set. Without
// them `emailEnabled` is false and callers degrade gracefully (the receipt
// button tells staff email isn't configured rather than throwing).
//
// Env vars (mirror the Forward Email alias you generated):
//   SMTP_HOST   e.g. smtp.forwardemail.net
//   SMTP_PORT   465 (SSL) or 587 (STARTTLS) — defaults to 465
//   SMTP_USER   the alias address, e.g. receipts@kosher-connect.com
//   SMTP_PASS   the generated alias password
//   MAIL_FROM   optional display From, e.g. "KosherConnect <receipts@kosher-connect.com>"
//               (defaults to SMTP_USER)

import nodemailer from 'nodemailer'

const HOST = (process.env.SMTP_HOST || '').trim()
const PORT = parseInt(process.env.SMTP_PORT || '465', 10) || 465
const USER = (process.env.SMTP_USER || '').trim()
const PASS = (process.env.SMTP_PASS || '').trim()
const FROM = (process.env.MAIL_FROM || '').trim() || USER

export const emailEnabled = !!(HOST && USER && PASS)

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

// sendEmail({to, subject, html, text}) → { ok, id } | throws on SMTP failure.
export async function sendEmail({ to, subject, html, text }) {
  const t = transport()
  if (!t) throw new Error('email-not-configured')
  const info = await t.sendMail({
    from: FROM,
    to,
    subject,
    text: text || undefined,
    html: html || undefined,
  })
  return { ok: true, id: info.messageId }
}

// Basic HTML escaping for values interpolated into receipt markup.
export const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
