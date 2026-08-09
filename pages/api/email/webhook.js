// Resend delivery webhook — bounces and spam complaints quarantine the
// address (email_suppressions) so it is never mailed again, and delivery
// outcomes are reconciled onto the email_log row for that message.
//
// Signature (Svix scheme) is verified against the RAW body — that IS the
// authentication for this route. Inert until RESEND_WEBHOOK_SECRET is set,
// matching the "configured ≠ armed" discipline of the rest of the email stack.

import { db, tablesMode } from '../../../lib/db.js'
import { verifySvixSignature, normalizeEmail } from '../../../lib/emailGuards.mjs'
import { readRaw } from '../../../lib/rawBody.js'

export const config = { api: { bodyParser: false } }

// Quarantine every recipient of a bounced/complained message, then flip the
// original email_log row (matched on the provider message id). Both writes are
// idempotent, so Resend's retries and duplicate deliveries are harmless.
async function quarantine(data, reason, status) {
  const detail = String(data?.bounce?.message || data?.bounce?.subType || data?.type || reason).slice(0, 300)
  const addresses = (Array.isArray(data?.to) ? data.to : [data?.to]).map(normalizeEmail).filter(Boolean)
  if (addresses.length) {
    await db.insertIgnoreDup(
      'email_suppressions',
      addresses.map((email) => ({ email, reason, detail })),
      'email'
    )
  }
  if (data?.email_id) {
    const flipped = await db.update('email_log', `provider_id=eq.${encodeURIComponent(data.email_id)}`, { status })
    if ((!flipped || !flipped.length) && addresses.length) {
      // No matching send on record (e.g. sent before logging existed) — still
      // leave an audit row so the quarantine is visible in the log.
      await db.insert('email_log', [{ to_email: addresses[0], status, provider: 'resend', provider_id: data.email_id, subject: data?.subject || null }])
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const secret = (process.env.RESEND_WEBHOOK_SECRET || '').trim()
  if (!secret) return res.status(503).json({ error: 'Email webhook not configured.' })
  if (!tablesMode) return res.status(503).json({ error: 'Relational data layer unavailable.' })

  let raw
  try {
    raw = await readRaw(req)
  } catch {
    return res.status(413).json({ error: 'Payload too large.' })
  }
  const ok = verifySvixSignature({
    secret,
    id: req.headers['svix-id'],
    timestamp: req.headers['svix-timestamp'],
    payload: raw,
    signatureHeader: req.headers['svix-signature'],
  })
  if (!ok) return res.status(400).json({ error: 'Invalid signature.' })

  let event
  try {
    event = JSON.parse(raw)
  } catch {
    return res.status(400).json({ error: 'Invalid payload.' })
  }

  const data = event?.data || {}
  try {
    if (event.type === 'email.bounced') {
      await quarantine(data, 'bounce', 'bounced')
    } else if (event.type === 'email.complained') {
      await quarantine(data, 'complaint', 'complained')
    } else if (event.type === 'email.delivered' && data.email_id) {
      // Only lift sent/redirected → delivered; never overwrite a bounce or
      // complaint that happened to be processed first.
      await db.update(
        'email_log',
        `provider_id=eq.${encodeURIComponent(data.email_id)}&status=in.(sent,redirected)`,
        { status: 'delivered' }
      )
    }
    // Other event types (email.sent, opened, clicked, delivery_delayed) are
    // deliberately ignored — the log already records the send.
  } catch (e) {
    console.error('[email/webhook]', e)
    // Non-200 makes Resend retry — correct for a transient DB failure.
    return res.status(500).json({ error: 'Processing failed.' })
  }

  return res.json({ received: true })
}
