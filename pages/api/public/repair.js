// Public repair booking — POST { name, contact, device, issue } from /repair.
// Same contract as /api/public/message (the one other public form): no new
// tables, no auth — each enquiry lands as an OPEN task in the staff queue,
// deduped one-open-per-sender so a double-click or resubmit doesn't flood
// Tasks. Staff triage it and open a real Repairs job when the phone arrives —
// the public never writes into the repairs workflow itself.

import { db, tablesMode } from '../../../lib/db.js'
import { normalizeEmail } from '../../../lib/mappers.js'
import { phoneKey } from '../../../lib/ukPhone.mjs'
import { rateLimit } from '../../../lib/rateLimit.js'
import { cap, hasLetter, isEmail, digitCount, findCustomerMatch } from '../../../lib/publicForm.mjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!rateLimit(req, { burst: 5, perMinute: 2 })) {
    return res.status(429).json({ success: false, error: 'Too many requests — please wait a minute, or call 0161 531 1386.', code: 'rate' })
  }
  const b = req.body || {}

  // Honeypot: real visitors never see the "company" field.
  if (b.company) return res.json({ success: true })

  const name = cap(b.name, 80)
  const contact = cap(b.contact, 120)
  const device = cap(b.device, 80)
  const issue = cap(b.issue, 600)
  if (name.length < 2 || !hasLetter(name)) {
    return res.status(400).json({ success: false, error: 'Please enter your name.', code: 'name' })
  }
  const looksEmail = /@/.test(contact)
  if (looksEmail ? !isEmail(contact) : digitCount(contact) < 7) {
    return res.status(400).json({ success: false, error: 'Please enter a valid phone number or email address.', code: 'contact' })
  }
  if (!device || !(hasLetter(device) || digitCount(device) > 0)) {
    return res.status(400).json({ success: false, error: 'Please tell us which phone or device it is.', code: 'device' })
  }
  if (issue.length < 3) {
    return res.status(400).json({ success: false, error: 'Please describe what’s wrong.', code: 'device' })
  }

  const phone = looksEmail ? '' : contact
  const email = looksEmail ? contact : ''

  if (!tablesMode) {
    return res.status(503).json({ success: false, error: 'Please call us instead — 0161 531 1386.', code: 'offline' })
  }

  try {
    const key = phone ? phoneKey(phone) : ''
    const emailNorm = email ? normalizeEmail(email) : ''
    const reference = `REPAIR-${key || emailNorm || name.toLowerCase().replace(/\s+/g, '-')}`

    // Best-effort match against existing customers — a hint for staff, never
    // revealed to the sender (this endpoint must not become a membership
    // oracle — same rule as /api/public/message).
    const match = await findCustomerMatch(db, phoneKey, emailNorm, key)

    const open = await db.select('tasks', `select=id&reference=eq.${encodeURIComponent(reference)}&done=is.false&limit=1`)
    if (!open.length) {
      const notes = [
        phone ? `Phone: ${phone}` : null,
        email ? `Email: ${email}` : null,
        `Device: ${device}`,
        `Problem: ${issue}`,
        match
          ? `⚠ Possibly an existing customer: ${`${match.first_name || ''} ${match.last_name || ''}`.trim()} (#${match.legacy_id}) — open their card before creating a new one.`
          : 'No match in customers — likely a NEW customer.',
        'When the device comes in, open a Repairs job for it — this task is only the enquiry.',
      ].filter(Boolean).join('\n')
      await db.insert('tasks', [{
        title: `🔧 Repair enquiry: ${name} — ${device}`,
        source: 'auto',
        priority: 'medium',
        raw_text: notes,
        reference,
      }])
    }
    return res.json({ success: true })
  } catch (e) {
    console.error('[api/public/repair]', e)
    return res.status(503).json({ success: false, error: 'Please call us instead — 0161 531 1386.', code: 'offline' })
  }
}
