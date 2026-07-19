// Outbound email — Resend (preferred) or SMTP (Forward Email, or any provider).
//
// Provider selection:
//   • RESEND_API_KEY + MAIL_FROM set → Resend HTTP API (delivery + bounce
//     webhooks land on /api/email/webhook).
//   • otherwise SMTP_HOST + SMTP_USER + SMTP_PASS → nodemailer, as before.
// Without either, `emailEnabled` is false and callers degrade gracefully (the
// receipt button tells staff email isn't configured rather than throwing).
//
// SAFETY GATE — configuring a provider does NOT start sending to real
// customers. Having credentials set is separate from being ARMED to send.
// There is a three-state control so real addresses are never mailed by
// accident:
//   • (default) HOLD  — nothing is sent. Receipts are built and logged only.
//   • TEST            — set MAIL_TEST_TO=you@example.com; EVERY receipt is
//                       redirected to that one address (never the customer),
//                       so you can check it looks right. Takes precedence.
//   • LIVE            — set MAIL_LIVE=true; receipts go to the real customer
//                       address on file. Only flip this when you're ready.
//
// Every attempt — held, sent, redirected, failed, suppressed — is recorded in
// the email_log table, and addresses in email_suppressions (hard bounces, spam
// complaints) are refused before any send. Log writes never break a send.
//
// Env vars:
//   RESEND_API_KEY  Resend secret (re_…) — preferred provider when set
//   MAIL_FROM       display From, e.g. "KosherConnect <receipts@mail.kosher-connect.com>"
//                   (required for Resend; defaults to SMTP_USER on SMTP)
//   SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS   the SMTP fallback
//   MAIL_TEST_TO    optional — redirect ALL mail here (test mode)
//   MAIL_LIVE       set to true/1/yes to actually send to real customers

import nodemailer from 'nodemailer'
import { db, tablesMode } from './db.js'
import { normalizeEmail } from './emailGuards.mjs'

const HOST = (process.env.SMTP_HOST || '').trim()
const PORT = parseInt(process.env.SMTP_PORT || '465', 10) || 465
const USER = (process.env.SMTP_USER || '').trim()
const PASS = (process.env.SMTP_PASS || '').trim()
const RESEND_KEY = (process.env.RESEND_API_KEY || '').trim()
const FROM = (process.env.MAIL_FROM || '').trim() || USER

const smtpReady = !!(HOST && USER && PASS)
const resendReady = !!(RESEND_KEY && FROM)
const PROVIDER = resendReady ? 'resend' : smtpReady ? 'smtp' : null

export const emailEnabled = !!PROVIDER

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
  return {
    configured: emailEnabled,
    provider: PROVIDER,
    mode: emailEnabled ? mailGate().mode : 'unconfigured',
  }
}

let cached = null
function transport() {
  if (!smtpReady) return null
  if (cached) return cached
  cached = nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: PORT === 465, // 465 = implicit TLS, 587 = STARTTLS
    auth: { user: USER, pass: PASS },
  })
  return cached
}

// Deliver via the selected provider; returns the provider message id (or null).
async function deliver({ to, subject, html, text }) {
  if (PROVIDER === 'resend') {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], subject, html: html || undefined, text: text || undefined }),
      signal: AbortSignal.timeout(15000),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(`[resend] HTTP ${res.status} ${body?.message || body?.name || ''}`)
    return body.id || null
  }
  const info = await transport().sendMail({
    from: FROM,
    to,
    subject,
    text: text || undefined,
    html: html || undefined,
  })
  return info.messageId || null
}

// Audit trail — one row per attempt. Never allowed to break the send itself.
async function logSend(row) {
  if (!tablesMode) return
  try {
    await db.insert('email_log', [{ provider: PROVIDER, ...row }])
  } catch (e) {
    console.error('[email] log write failed:', e.message)
  }
}

// A bounced/complained address must not be mailed again. Fail-open by design:
// if this read errors the send proceeds (a DB outage already breaks the routes
// that build receipts, and in HOLD mode nothing sends regardless).
async function suppressionFor(email) {
  if (!tablesMode) return null
  try {
    const rows = await db.select('email_suppressions', `email=eq.${encodeURIComponent(email)}&select=reason`)
    return rows.length ? rows[0].reason : null
  } catch (e) {
    console.error('[email] suppression check failed:', e.message)
    return null
  }
}

// sendEmail({to, subject, html, text, kind, customerId}) → resolves to one of:
//   { ok:false, suppressed:true, reason }     address bounced/complained before
//   { ok:true, held:true }                    HOLD  — nothing sent
//   { ok:true, id, redirectedTo }             TEST  — sent to the tester only
//   { ok:true, id, sentTo }                   LIVE  — sent to the real address
// Throws only on a genuine provider failure (never on the safety hold).
// kind/customerId are audit-log fields; customerId is the customers.id uuid.
export async function sendEmail({ to, subject, html, text, kind, customerId }) {
  if (!emailEnabled) throw new Error('email-not-configured')
  const gate = mailGate()
  const toNorm = normalizeEmail(to)
  const base = { kind: kind || null, to_email: toNorm, subject, customer_id: customerId || null }

  const suppressedFor = await suppressionFor(toNorm)
  if (suppressedFor) {
    await logSend({ ...base, status: 'suppressed', error: `suppressed: ${suppressedFor}` })
    return { ok: false, suppressed: true, reason: suppressedFor }
  }

  if (gate.mode === 'hold') {
    // Safety hold: the receipt is fully built but NOT sent. Log so it's
    // auditable that a send was attempted and deliberately suppressed.
    console.log(`[email] HELD (not sent — MAIL_LIVE not set) intended-to=${toNorm} subject="${subject}"`)
    await logSend({ ...base, status: 'held' })
    return { ok: true, held: true }
  }

  const actualTo = gate.mode === 'test' ? gate.testTo : toNorm
  const subjectOut = gate.mode === 'test' ? `[TEST → ${toNorm}] ${subject}` : subject
  try {
    const id = await deliver({ to: actualTo, subject: subjectOut, html, text })
    await logSend({
      ...base,
      status: gate.mode === 'test' ? 'redirected' : 'sent',
      actual_to: actualTo,
      provider_id: id,
    })
    return gate.mode === 'test'
      ? { ok: true, id, redirectedTo: actualTo }
      : { ok: true, id, sentTo: actualTo }
  } catch (e) {
    await logSend({ ...base, status: 'failed', actual_to: actualTo, error: String(e.message || e).slice(0, 500) })
    throw e
  }
}

// Basic HTML escaping for values interpolated into receipt markup.
export const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
