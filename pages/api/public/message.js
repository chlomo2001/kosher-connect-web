// Public "Send us a message" — the contact form on /welcome. POST { name,
// contact, message } where `contact` is a phone OR email (one field on the
// form). Mirrors /api/public/join: no new tables — each message lands as an
// OPEN task in the staff queue, deduped one-open-per-sender so double-clicks
// and resubmits don't flood Tasks. Staff auth deliberately NOT required.

import { db, tablesMode } from '../../../lib/db.js'
import { normalizeEmail } from '../../../lib/mappers.js'
import { phoneKey } from '../../../lib/ukPhone.mjs'

const cap = (v, n) => String(v || '').trim().slice(0, n)
// A name must carry at least one real letter (Latin or Hebrew) — blocks "/",
// "123", punctuation-only, etc. An email needs local@domain.tld; a phone needs
// at least 7 digits. This is the authoritative guard (the client mirrors it).
const hasLetter = (s) => /[a-zA-Z֐-׿]/.test(s)
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)
const digitCount = (s) => (String(s).match(/\d/g) || []).length

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const b = req.body || {}

  // Honeypot: real visitors never see the "company" field.
  if (b.company) return res.json({ success: true })

  const name = cap(b.name, 80)
  const contact = cap(b.contact, 120)
  const message = cap(b.message, 1000)
  if (name.length < 2 || !hasLetter(name)) {
    return res.status(400).json({ success: false, error: 'Please enter your name.' })
  }
  const looksEmail = /@/.test(contact)
  if (looksEmail ? !isEmail(contact) : digitCount(contact) < 7) {
    return res.status(400).json({ success: false, error: 'Please enter a valid phone number or email address.' })
  }

  const email = looksEmail ? contact : ''
  const phone = looksEmail ? '' : contact

  if (!tablesMode) {
    return res.status(503).json({ success: false, error: 'Please call us instead — 0161 531 1386.' })
  }

  try {
    const key = phone ? phoneKey(phone) : ''
    const emailNorm = email ? normalizeEmail(email) : ''
    const reference = `MSG-${key || emailNorm || name.toLowerCase().replace(/\s+/g, '-')}`

    const open = await db.select('tasks', `select=id&reference=eq.${encodeURIComponent(reference)}&done=is.false&limit=1`)
    if (!open.length) {
      const notes = [
        email ? `Email: ${email}` : `Phone: ${phone}`,
        message ? `Message: ${message}` : '(no message text)',
      ].filter(Boolean).join('\n')
      await db.insert('tasks', [{
        title: `New message: ${name}`,
        source: 'auto',
        priority: 'medium',
        raw_text: notes,
        reference,
      }])
    }
    return res.json({ success: true })
  } catch (e) {
    console.error('[api/public/message]', e)
    return res.status(503).json({ success: false, error: 'Please call us instead — 0161 531 1386.' })
  }
}
