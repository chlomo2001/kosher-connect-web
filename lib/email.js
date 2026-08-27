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
import { COMPANY, companyNumberLine, registeredOfficeLine } from './company.mjs'

const HOST = (process.env.SMTP_HOST || '').trim()
const PORT = parseInt(process.env.SMTP_PORT || '465', 10) || 465
const USER = (process.env.SMTP_USER || '').trim()
const PASS = (process.env.SMTP_PASS || '').trim()
const RESEND_KEY = (process.env.RESEND_API_KEY || '').trim()
// A BARE ADDRESS HAS NO NAME ON IT. MAIL_FROM is set to the address alone, so
// every receipt the shop has ever sent arrived from "receipts" — the bit in
// front of the @ — which is what a mail client falls back to when there is no
// display name. The owner's test on 25 Aug sat in his inbox between "Uber
// Receipts" and "Find A Minyan", signed by nobody (26 Aug).
//
// Fixed here rather than by reformatting the env var, because the shop's name
// is not deploy configuration — it is the shop's name, it already lives in
// lib/company.mjs, and an env var somebody has to remember to punctuate
// correctly is a thing that goes wrong again the next time it is set. An
// address that ALREADY carries a name is left exactly as it is.
const withDisplayName = (addr, label) => {
  if (!addr || addr.includes('<')) return addr
  // Quoted and escaped: a display name is a phrase, and quoting it is the form
  // every provider accepts whatever the shop is one day renamed to.
  const name = String(COMPANY.tradingName || '').replace(/["\\]/g, '').trim()
  const shown = [name, label].filter(Boolean).join(' — ').replace(/["\\]/g, '')
  return shown ? `"${shown}" <${addr}>` : addr
}

const FROM = withDisplayName((process.env.MAIL_FROM || '').trim() || USER)

// Internal post is not customer post. MAIL_FROM is `receipts@…`, which is the
// right address for a receipt and the wrong one for the owner's 06:30 digest —
// it arrived on 27 Aug looking like a receipt, from "receipts" (owner, same
// morning). One address is all the provider has verified, so the ADDRESS stays
// and the display name says which kind of post this is; that is the half a mail
// client actually shows in a list. MAIL_FROM_INTERNAL overrides the address
// outright for whoever later verifies a second one — until then it is unset and
// nothing changes.
const INTERNAL_KINDS = new Set(['daily_digest', 'staff', 'carrier_forward', 'test'])
const LABELS = { daily_digest: 'morning digest', carrier_forward: 'carrier post', test: 'test' }
const fromFor = (kind) => {
  if (!INTERNAL_KINDS.has(kind)) return FROM
  const addr = (process.env.MAIL_FROM_INTERNAL || '').trim() || (process.env.MAIL_FROM || '').trim() || USER
  return withDisplayName(addr, LABELS[kind] || null)
}

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
//
// `webhook` is here because its absence is invisible until it costs you: with
// no RESEND_WEBHOOK_SECRET the delivery route answers 503, Resend sees every
// event fail and eventually disables the endpoint (it did, on 2026-07-20) — and
// with it goes bounce and spam-complaint quarantine, so a dead address would
// keep being mailed once the gate is lifted. A boolean, never the secret.
export function emailStatus() {
  return {
    configured: emailEnabled,
    provider: PROVIDER,
    mode: emailEnabled ? mailGate().mode : 'unconfigured',
    webhook: (process.env.RESEND_WEBHOOK_SECRET || '').trim() ? 'armed' : 'not-configured',
    // WHOSE NAME the recipient will see in their inbox list. The SMS row has
    // said which sender it will use for weeks; email said nothing, so "signed
    // by nobody" was only discoverable by sending one and looking.
    senderName: emailEnabled ? (FROM.match(/^"?([^"<]+?)"?\s*</)?.[1] || null) : null,
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
// `kind` picks the sender: staff post says what it is, customer post is the shop.
async function deliver({ to, subject, html, text, kind }) {
  const from = fromFor(kind)
  if (PROVIDER === 'resend') {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html: html || undefined, text: text || undefined }),
      signal: AbortSignal.timeout(15000),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(`[resend] HTTP ${res.status} ${body?.message || body?.name || ''}`)
    return body.id || null
  }
  const info = await transport().sendMail({
    from,
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
// `forceLive` — the ONE sanctioned crack in the HOLD gate (issue #15 part 3,
// owner's explicit yes, 23 Aug): an OTP that waits for a human is an expired
// OTP. It bypasses ONLY the hold state; TEST mode still redirects (a tester
// wants to see these too), suppression still refuses, and every send is still
// logged. Callers may pass it only for the OTP forward path, and only when the
// settings switch otp_forward_live says so — the decision lives on the record
// there, not scattered through call sites.
export async function sendEmail({ to, subject, html, text, kind, customerId, forceLive = false }) {
  if (!emailEnabled) throw new Error('email-not-configured')
  const gate = mailGate()
  const toNorm = normalizeEmail(to)
  // Exactly ONE well-formed address (sweep 2026-08-02 #26): nodemailer parses
  // a comma-separated `to`, so an unvalidated stored address like
  // "his@x.com,hers@y.com" would fan a receipt out to a second recipient.
  if (!toNorm || /[,;\s]/.test(toNorm) || !/^[^@]+@[^@]+\.[^@]+$/.test(toNorm)) {
    console.warn(`[email] refused: not a single valid address (kind=${kind || '?'})`)
    return { ok: false, invalid: true, reason: 'not a single valid email address' }
  }
  const base = { kind: kind || null, to_email: toNorm, subject, customer_id: customerId || null }

  const suppressedFor = await suppressionFor(toNorm)
  if (suppressedFor) {
    await logSend({ ...base, status: 'suppressed', error: `suppressed: ${suppressedFor}` })
    return { ok: false, suppressed: true, reason: suppressedFor }
  }

  if (gate.mode === 'hold' && forceLive) {
    console.log(`[email] HOLD bypassed for ${kind || '?'} (forceLive — otp_forward_live) to=${toNorm}`)
    gate.mode = 'live'
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
    const id = await deliver({ to: actualTo, subject: subjectOut, html, text, kind })
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

// ─── Branded email shell ────────────────────────────────────────────────────
// One shell for every customer-facing email: the KC wordmark over a navy
// band with the gold keyline, the message card, and a proper business footer
// (address, phone, email). Table-based with inline styles — the only layout
// language every mail client still respects. Callers pass pre-escaped rows.
// The legal identity lives in one place — see lib/company.mjs for why the
// company number belongs on a receipt at all.
const BRAND = {
  navy: '#0a2540',
  gold: '#d49e60',
  ink: '#1f2430',
  muted: '#64748b',
  faint: '#94a3b8',
  hair: '#e8ecf1',
  logoUrl: 'https://www.kosher-connect.com/logo-full-tight.png',
  address: '421 Bury New Road, Salford M7 4ED (door left of Toy Zone, first floor up)',
  phoneShown: '+44 161 531 1386',
  phoneTel: '+441615311386',
  // Footer reply-to for every customer email. support@, not admin@ — see the
  // note on EMAIL in pages/welcome.js.
  email: 'support@kosher-connect.com',
}

// `closing` is the last line in the footer. It comes from Settings now (see
// pages/api/email.js emailCopy) — the literal below stays as the fallback so a
// missing setting can never ship a footer with nothing in it.
const CLOSING_DEFAULT = 'Thank you for choosing Kosher Connect. If anything on this receipt looks wrong, call us on 0161 531 1386 and we\u2019ll put it right.'

export function brandShell({ title, preheader, bodyRows, footNote, closing }) {
  return `<!doctype html><html><body style="margin:0;background:#f2f4f7;padding:28px 12px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.ink}">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${esc(preheader)}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
      <tr><td style="padding:0 6px 14px" align="center">
        <img src="${BRAND.logoUrl}" alt="Kosher Connect" width="168" style="display:block;height:auto;max-width:168px">
      </td></tr>
      <tr><td>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ${BRAND.hair}">
          <tr><td style="background:${BRAND.navy};padding:0;font-size:0;line-height:0;height:4px">
            <div style="height:4px;background:linear-gradient(90deg,${BRAND.navy},${BRAND.gold});"></div></td></tr>
          <tr><td style="padding:26px 32px 6px;font-size:19px;font-weight:600;color:${BRAND.navy};letter-spacing:-0.2px">${esc(title)}</td></tr>
          <tr><td style="padding:0 32px 10px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.55">${bodyRows}</table>
          </td></tr>
          <tr><td style="padding:14px 32px 24px;font-size:12px;color:${BRAND.faint};line-height:1.6;border-top:1px solid ${BRAND.hair}">
            ${footNote ? `${footNote}<br>` : ''}${esc(closing || CLOSING_DEFAULT)}
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:18px 10px 0;text-align:center;font-size:12px;color:${BRAND.faint};line-height:1.7">
        <strong style="color:${BRAND.muted}">Kosher Connect</strong> · Kosher phones, SIM plans, travel rentals &amp; Kol Torah audio<br>
        ${esc(BRAND.address)}<br>
        <a href="tel:${BRAND.phoneTel}" style="color:${BRAND.muted};text-decoration:none">${esc(BRAND.phoneShown)}</a> ·
        <a href="mailto:${BRAND.email}" style="color:${BRAND.muted};text-decoration:none">${esc(BRAND.email)}</a><br>
        <span style="font-size:11px">Kosher Connect is a trading name of ${esc(COMPANY.legalName)}. ${esc(companyNumberLine())}.<br>
        ${esc(registeredOfficeLine())} — not the shop; come to the address above.</span>
      </td></tr>
    </table>
  </td></tr></table></body></html>`
}
