// Public signup — the native replacement for the owner's Google "join" form.
// POST { firstName, lastName, phone, email, message } from /join.
//
// No new tables (live-DB migrations wait for the owner's go-ahead): each
// signup lands as an OPEN task in the staff queue, deduped two ways —
//   • against customers (by normalized email / phone key), so staff see
//     "possibly existing customer" instead of typing a duplicate; and
//   • against itself via the one-open-task-per-reference rule (SIGNUP-<key>),
//     so resubmits and double-clicks can't flood Tasks.
// Staff auth deliberately NOT required — this is the customer-facing side.

import { db, tablesMode } from '../../../lib/db.js'
import { normalizeEmail } from '../../../lib/mappers.js'
import { phoneKey } from '../../../lib/ukPhone.mjs'

const cap = (v, n) => String(v || '').trim().slice(0, n)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const b = req.body || {}

  // Honeypot: real visitors never see the "company" field. Pretend success.
  if (b.company) return res.json({ success: true })

  const firstName = cap(b.firstName, 60)
  const lastName = cap(b.lastName, 60)
  const phone = cap(b.phone, 30)
  const email = cap(b.email, 120)
  const message = cap(b.message, 1000)
  if (!firstName || !phone) {
    return res.status(400).json({ success: false, error: 'Name and phone are required.' })
  }

  if (!tablesMode) {
    return res.status(503).json({ success: false, error: 'Please call us instead — 0161 531 1386.' })
  }

  try {
    const key = phoneKey(phone)
    const emailNorm = normalizeEmail(email)

    // Best-effort match against existing customers — a hint for staff, never
    // revealed to the visitor (this endpoint must not be a membership oracle).
    let match = null
    try {
      if (emailNorm) {
        const rows = await db.select('customers',
          `select=legacy_id,first_name,last_name&email_normalized=eq.${encodeURIComponent(emailNorm)}&limit=1`)
        if (rows.length) match = rows[0]
      }
      if (!match && key && key.length >= 7) {
        const tail = key.slice(-4)
        const rows = await db.select('customers',
          `select=legacy_id,first_name,last_name,phone_country_code,phone_number&phone_number=ilike.*${encodeURIComponent(tail)}*&limit=25`)
        match = rows.find((r) => phoneKey(`${r.phone_country_code || ''} ${r.phone_number || ''}`) === key) || null
      }
    } catch { /* matching is advisory */ }

    const name = `${firstName} ${lastName}`.trim()
    const reference = `SIGNUP-${key || emailNorm || name.toLowerCase().replace(/\s+/g, '-')}`

    // One open signup task per person — a resubmit refreshes nothing, it's
    // already in the queue.
    const open = await db.select('tasks', `select=id&reference=eq.${encodeURIComponent(reference)}&done=is.false&limit=1`)
    if (!open.length) {
      const notes = [
        `Phone: ${phone}`,
        email ? `Email: ${email}` : null,
        message ? `Asked for: ${message}` : null,
        match
          ? `⚠ Possibly an existing customer: ${`${match.first_name || ''} ${match.last_name || ''}`.trim()} (#${match.legacy_id}) — open their card before creating a new one.`
          : 'No match in customers — likely a NEW customer.',
      ].filter(Boolean).join('\n')
      await db.insert('tasks', [{
        title: `New signup: ${name}`,
        source: 'auto',
        priority: 'medium',
        raw_text: notes,
        reference,
      }])
    }
    return res.json({ success: true })
  } catch (e) {
    console.error('[api/public/join]', e)
    return res.status(503).json({ success: false, error: 'Please call us instead — 0161 531 1386.' })
  }
}
