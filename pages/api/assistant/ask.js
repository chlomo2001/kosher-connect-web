// In-house AI assistant — the "tell Gemini what you want to do" planner.
// It ONLY plans: it turns a staff member's plain-language request into one
// structured action, and never touches data or money itself. The client then
// answers read requests from the data it already holds, and for any WRITE it
// shows a confirm card and runs it through the app's existing, vetted flow
// (money actions stay owner-only there). So Gemini can propose, but only a
// human tap makes anything happen.
import { withStaff } from '../../../lib/auth.js'
import { geminiGenerate, geminiEnabled } from '../../../lib/gemini.js'

function parseJsonLoose(s) {
  if (!s) return null
  let t = String(s).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  try { return JSON.parse(t) } catch {}
  const i = t.indexOf('{'), j = t.lastIndexOf('}')
  if (i >= 0 && j > i) { try { return JSON.parse(t.slice(i, j + 1)) } catch {} }
  return null
}

const ACTIONS = new Set([
  'who_owes', 'customer_info', 'overdue_rentals', 'todays_takings',
  'draft_reminder', 'create_payment_link', 'add_task', 'mark_task_done', 'none',
])
const WRITES = new Set(['draft_reminder', 'create_payment_link', 'add_task', 'mark_task_done'])

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!geminiEnabled) return res.status(503).json({ success: false, error: 'AI isn’t configured yet — add GEMINI_API_KEY in Vercel.', notConfigured: true })

  const message = String(req.body?.message || '').trim().slice(0, 500)
  if (!message) return res.status(400).json({ success: false, error: 'Ask me something.' })

  const today = new Date().toISOString().slice(0, 10)
  const prompt = `You are the in-house assistant for Kosher Connect, a kosher phone shop in Manchester (SIM plans; travel phone rentals; Israeli/USA numbers; repairs; Kol Torah audio). A staff member typed a request. Today is ${today}.

Map it to EXACTLY ONE action from this list and return JSON. Do not perform anything — you only plan; the app asks the human to confirm any change.

READ actions (answer a question):
- "who_owes" — list customers who owe money. args: {}
- "customer_info" — one customer's balance & status. args: { "name": "<customer name they mentioned>" }
- "overdue_rentals" — rental phones past their return date. args: {}
- "todays_takings" — today's till takings. args: {}

WRITE actions (the app will ask the human to confirm before doing it):
- "draft_reminder" — open a reminder draft for a customer (never auto-sent). args: { "name": "<customer>", "note": "<optional what it's about>" }
- "create_payment_link" — a Stripe payment link for a customer (owner only). args: { "name": "<customer>", "amount": <pounds as a number, optional>, "description": "<optional>" }
- "add_task" — add a to-do. args: { "title": "<the task>", "name": "<optional customer to link>" }
- "mark_task_done" — mark an open task finished. args: { "task": "<words identifying the task>" }

If the request doesn't fit any action, use "none" and put a helpful sentence in "reply".

Return ONLY this JSON, no prose, no fences:
{"action":"<one action name>","args":{...},"confirm":<true if it is a WRITE action, else false>,"reply":"<one short friendly sentence to show the staff member>"}

Request: ${JSON.stringify(message)}`

  const g = await geminiGenerate([{ text: prompt }], { temperature: 0.1, feature: 'assistant planner' })
  if (!g.ok) return res.status(502).json({ success: false, error: g.error || 'The assistant could not answer.' })

  const p = parseJsonLoose(g.text)
  if (!p) return res.status(502).json({ success: false, error: 'The assistant returned an unexpected format — try rephrasing.' })

  const action = ACTIONS.has(p.action) ? p.action : 'none'
  const plan = {
    action,
    args: (p.args && typeof p.args === 'object') ? p.args : {},
    confirm: WRITES.has(action), // authoritative: never trust the model to say a write is safe
    reply: String(p.reply || '').slice(0, 240),
  }
  return res.json({ success: true, plan })
}

export default withStaff(handler)
