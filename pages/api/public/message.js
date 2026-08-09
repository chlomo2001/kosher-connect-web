// Public "Send us a message" — the one public form, on /welcome. POST { name,
// contact, message } where `contact` is a phone OR email (one field on the
// form), plus the optional { email, address, preferredContact } this absorbed
// from /join. No new tables — each message lands as an OPEN task in the staff
// queue, deduped one-open-per-sender so double-clicks and resubmits don't
// flood Tasks. Staff auth deliberately NOT required.
//
// /join used to be a second page with its own endpoint filing the identical
// task under a SIGNUP- reference. Two public forms doing one job cost the
// visitor a choice and staff a second task type, so the useful parts moved
// here: the extra fields above, and the existing-customer lookup below.

import { db, tablesMode } from '../../../lib/db.js'
import { normalizeEmail } from '../../../lib/mappers.js'
import { phoneKey } from '../../../lib/ukPhone.mjs'
import { rateLimit } from '../../../lib/rateLimit.js'
import { WHATSAPP_ENABLED } from '../../../lib/flags.js'
import { cap, hasLetter, isEmail, digitCount, findCustomerMatch } from '../../../lib/publicForm.mjs'

// "Best way to reach you" chips — anything else is dropped. WhatsApp is only
// accepted while the channel is on; with it off the chip isn't offered, so a
// request still carrying it is stale or hand-made and must not queue a staff
// task telling them to reach the customer a way we've stopped using.
const PREFERRED_CONTACT = {
  call: 'Call',
  text: 'Text message',
  email: 'Email',
  ...(WHATSAPP_ENABLED ? { whatsapp: 'WhatsApp' } : {}),
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  // The dedup key is the sender's own phone/email — a script varying digits
  // makes one open task each. Throttle before it can bury the staff queue.
  if (!rateLimit(req, { burst: 5, perMinute: 2 })) {
    return res.status(429).json({ success: false, error: 'Too many requests — please wait a minute, or call 0161 531 1386.', code: 'rate' })
  }
  const b = req.body || {}

  // Honeypot: real visitors never see the "company" field.
  if (b.company) return res.json({ success: true })

  const name = cap(b.name, 80)
  const contact = cap(b.contact, 120)
  const message = cap(b.message, 1000)
  if (name.length < 2 || !hasLetter(name)) {
    return res.status(400).json({ success: false, error: 'Please enter your name.', code: 'name' })
  }
  const looksEmail = /@/.test(contact)
  if (looksEmail ? !isEmail(contact) : digitCount(contact) < 7) {
    return res.status(400).json({ success: false, error: 'Please enter a valid phone number or email address.', code: 'contact' })
  }

  // The optional extras. `email` may arrive both as the contact field and as
  // its own box; prefer the dedicated one and don't record it twice.
  const extraEmail = cap(b.email, 120)
  const address = cap(b.address, 200)
  const preferredContact = PREFERRED_CONTACT[cap(b.preferredContact, 20).toLowerCase()] || ''

  const phone = looksEmail ? '' : contact
  const email = (looksEmail ? contact : '') || (isEmail(extraEmail) ? extraEmail : '')

  if (!tablesMode) {
    return res.status(503).json({ success: false, error: 'Please call us instead — 0161 531 1386.', code: 'offline' })
  }

  try {
    const key = phone ? phoneKey(phone) : ''
    const emailNorm = email ? normalizeEmail(email) : ''
    const reference = `MSG-${key || emailNorm || name.toLowerCase().replace(/\s+/g, '-')}`

    // Best-effort match against existing customers — a hint for staff so they
    // open the right card instead of typing a duplicate. Never revealed to the
    // sender: this endpoint must not become a membership oracle.
    const match = await findCustomerMatch(db, phoneKey, emailNorm, key)

    const open = await db.select('tasks', `select=id,raw_text&reference=eq.${encodeURIComponent(reference)}&done=is.false&limit=1`)
    if (open.length) {
      // Same sender, task still open: append rather than discard. Dropping it
      // while replying "we've got it" cost exactly the follow-ups that matter
      // most ("my flight moved to Tuesday").
      const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
      const addition = `\n\n— follow-up ${stamp} —\n${message || '(no message text)'}`
      await db.update('tasks', `id=eq.${encodeURIComponent(String(open[0].id))}`, { raw_text: `${open[0].raw_text || ''}${addition}` })
    }
    if (!open.length) {
      const notes = [
        phone ? `Phone: ${phone}` : null,
        email ? `Email: ${email}` : null,
        preferredContact ? `Prefers: ${preferredContact}` : null,
        address ? `Address: ${address}` : null,
        message ? `Message: ${message}` : '(no message text)',
        match
          ? `⚠ Possibly an existing customer: ${`${match.first_name || ''} ${match.last_name || ''}`.trim()} (#${match.legacy_id}) — open their card before creating a new one.`
          : 'No match in customers — likely a NEW customer.',
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
    return res.status(503).json({ success: false, error: 'Please call us instead — 0161 531 1386.', code: 'offline' })
  }
}
