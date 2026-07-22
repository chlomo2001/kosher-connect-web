// AI reply drafter — staff paste a customer's incoming message and Gemini drafts
// a reply in Kosher Connect's voice, using the customer context the caller
// supplies (balance, overdue rentals, SIM renewals, upcoming flights). It NEVER
// sends anything: the draft comes back for staff to read, edit and copy — the
// same HOLD as the template reminder/SMS drafts.
//
// Privacy: the message text goes to Google (same as the Scan Reader's AI path),
// so the UI warns staff not to paste passport/ID numbers. Key handling and model
// resolution are shared via lib/gemini.js. Staff-gated.
import { withStaff } from '../../lib/auth.js'
import { geminiGenerate } from '../../lib/gemini.js'

const TONES = {
  friendly: 'warm and friendly, but professional',
  formal: 'polite and formal',
  brief: 'short and to the point',
}
const LANGS = {
  auto: 'Reply in the SAME language the customer wrote in (English, Hebrew or Yiddish).',
  en: 'Reply in English.',
  he: 'Reply in Hebrew.',
  yi: 'Reply in Yiddish.',
}

const cap = (v, n) => String(v == null ? '' : v).slice(0, n)

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const b = req.body || {}
  const incoming = cap(b.incoming, 4000).trim()
  if (!incoming) return res.status(400).json({ success: false, error: 'Paste the customer’s message first.' })
  const context = cap(b.context, 2000).trim()
  const name = cap(b.customerName, 80).trim()
  const tone = TONES[b.tone] || TONES.friendly
  const langLine = LANGS[b.lang] || LANGS.auto

  const prompt = [
    'You are drafting a reply on behalf of Kosher Connect, a friendly kosher phone and telecom shop in Salford, UK',
    '(phones, SIM plans, phone rentals, virtual/international numbers, repairs and travel bookings).',
    `Write a ${tone} reply to the customer's message below.`,
    langLine,
    'Guidelines:',
    '- Use the account context ONLY where it is relevant to what they asked. Do not dump it at them.',
    '- Never invent facts, prices, dates, promises or policies that are not in the context or the message. If you are unsure, say the team will check and get back to them.',
    '- Do not ask them to pay through any link or share card/passport details by message.',
    '- No subject line and no placeholders like [name]. If you greet them, use their first name if given.',
    '- Sign off as "Kosher Connect".',
    'Output only the reply text, ready to send.',
    '',
    name ? `Customer first name: ${name.split(/\s+/)[0]}` : 'Customer name: unknown',
    context ? `Account context:\n${context}` : 'Account context: none supplied.',
    '',
    'Customer message:',
    incoming,
  ].join('\n')

  const out = await geminiGenerate([{ text: prompt }], { temperature: 0.5, feature: 'reply drafter' })
  if (out.ok) return res.json({ success: true, draft: out.text.trim() })
  return res.status(out.notConfigured ? 503 : 502).json({ success: false, error: out.error })
}

export default withStaff(handler)
