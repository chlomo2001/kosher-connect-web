// Owner-managed @kosher-connect.com email addresses — a thin, owner-only
// proxy over the Forward Email API so Shloime can create/edit/disable
// aliases (reminder@, admin@, receipts@ …) without leaving the app.
//
//   GET                → { aliases: [...] }
//   POST {name, recipients, description}          → create alias
//        recipients may be mailboxes or an https:// webhook URL — the latter is
//        how carrier mail reaches /api/inbound/mail (docs/INBOUND-MAIL.md)
//   POST {op:'password', id}                       → generate SMTP password
//                        (returned ONCE — Forward Email never shows it again)
//   PUT  {id, recipients?, description?, enabled?} → update alias
//   DELETE ?id=<alias_id>                          → delete alias
//
// Needs FORWARDEMAIL_API_KEY (Forward Email → My Account → Security).
// MAIL_DOMAIN defaults to kosher-connect.com.

import { withStaff } from '../../lib/auth.js'
import { cleanRecipients, recipientProblem } from '../../lib/aliasRecipients.mjs'

const API = 'https://api.forwardemail.net/v1'
const DOMAIN = (process.env.MAIL_DOMAIN || 'kosher-connect.com').trim()
const KEY = (process.env.FORWARDEMAIL_API_KEY || '').trim()

async function fe(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      // API key as Basic-auth username, empty password.
      Authorization: `Basic ${Buffer.from(`${KEY}:`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch { /* HTML error page */ }
  if (!res.ok) {
    const msg = json?.message || `Forward Email returned HTTP ${res.status}`
    const err = new Error(msg)
    err.status = res.status
    throw err
  }
  return json
}

const toApp = (a) => ({
  id: a.id,
  name: a.name,
  address: `${a.name}@${DOMAIN}`,
  recipients: Array.isArray(a.recipients) ? a.recipients : [],
  description: a.description || '',
  enabled: a.is_enabled !== false,
  hasImap: !!a.has_imap,
})

// Recipients may be mailboxes OR an https webhook URL — see
// lib/aliasRecipients.mjs, which also explains why a URL must not be
// lowercased the way an email address is.

async function handler(req, res) {
  if (req.staff && req.staff.role !== 'owner') {
    return res.status(403).json({ success: false, error: 'Email addresses are admin-only.' })
  }
  if (!KEY) {
    return res.status(503).json({
      success: false,
      error: 'Add FORWARDEMAIL_API_KEY (Forward Email → My Account → Security) to manage addresses here.',
    })
  }

  try {
    if (req.method === 'GET') {
      const list = await fe(`/domains/${DOMAIN}/aliases?pagination=false`)
      const aliases = (Array.isArray(list) ? list : [])
        .map(toApp)
        .sort((a, b) => a.name.localeCompare(b.name))
      return res.json({ success: true, domain: DOMAIN, aliases })
    }

    const b = req.body || {}

    if (req.method === 'POST' && b.op === 'password') {
      if (!b.id) return res.status(400).json({ success: false, error: 'Alias id is required.' })
      const out = await fe(`/domains/${DOMAIN}/aliases/${encodeURIComponent(String(b.id))}/generate-password`, {
        method: 'POST', body: {},
      })
      // Shown once in the UI, never stored anywhere on our side.
      return res.json({ success: true, username: out?.username, password: out?.password })
    }

    if (req.method === 'POST') {
      const name = String(b.name || '').trim().toLowerCase()
      if (!/^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/.test(name)) {
        return res.status(400).json({ success: false, error: 'Alias name can use letters, numbers, dots and dashes.' })
      }
      const recipients = cleanRecipients(b.recipients)
      if (!recipients.length) {
        // Name the offending entry rather than "add at least one": pasting a
        // webhook URL used to fail with a message that suggested the field was
        // empty, which is how a correct URL reads as a mistake.
        const given = Array.isArray(b.recipients) ? b.recipients.join(',') : String(b.recipients || '')
        const first = given.split(/[,\s]+/).filter(Boolean)[0] || ''
        return res.status(400).json({
          success: false,
          error: recipientProblem(first) || 'Add a forwarding address or an https:// webhook URL.',
        })
      }
      const created = await fe(`/domains/${DOMAIN}/aliases`, {
        method: 'POST',
        body: { name, recipients, description: String(b.description || '').trim() || undefined, is_enabled: true },
      })
      return res.json({ success: true, alias: toApp(created) })
    }

    if (req.method === 'PUT') {
      if (!b.id) return res.status(400).json({ success: false, error: 'Alias id is required.' })
      const patch = {}
      if (b.recipients !== undefined) {
        const recipients = cleanRecipients(b.recipients)
        if (!recipients.length) {
          const given = Array.isArray(b.recipients) ? b.recipients.join(',') : String(b.recipients || '')
          const first = given.split(/[,\s]+/).filter(Boolean)[0] || ''
          return res.status(400).json({
            success: false,
            error: recipientProblem(first) || 'Keep at least one forwarding address or webhook URL.',
          })
        }
        patch.recipients = recipients
      }
      if (b.description !== undefined) patch.description = String(b.description || '').trim()
      if (b.enabled !== undefined) patch.is_enabled = !!b.enabled
      const updated = await fe(`/domains/${DOMAIN}/aliases/${encodeURIComponent(String(b.id))}`, {
        method: 'PUT', body: patch,
      })
      return res.json({ success: true, alias: toApp(updated) })
    }

    if (req.method === 'DELETE') {
      const id = String(req.query.id || '')
      if (!id) return res.status(400).json({ success: false, error: 'Alias id is required.' })
      await fe(`/domains/${DOMAIN}/aliases/${encodeURIComponent(id)}`, { method: 'DELETE' })
      return res.json({ success: true })
    }

    return res.status(405).end()
  } catch (e) {
    console.error('[api/email-aliases]', e.message)
    const status = e.status === 401 || e.status === 403 ? 502 : 500
    return res.status(status).json({
      success: false,
      error: e.status === 401 || e.status === 403
        ? 'Forward Email rejected the API key — check FORWARDEMAIL_API_KEY.'
        : (e.message || 'Could not reach Forward Email.'),
    })
  }
}

export default withStaff(handler)
