// AI task-prioritiser — reads the whole OPEN task queue and returns a single
// ranked action plan ("what to do first, and why"). This is the holistic,
// judgement layer on top of the deterministic per-task suggester in the UI:
// it weighs money-at-risk, travel/Shabbos timing, warm leads and staleness
// across the entire list at once.
//
// Read-only: it ranks and explains, it does not change any task. Customer
// phone numbers and emails are redacted before anything is sent to Gemini —
// they don't help the ranking and shouldn't leave the building.
import { withTab } from '../../../lib/auth.js'
import { db, tablesMode } from '../../../lib/db.js'
import { geminiGenerate, geminiEnabled } from '../../../lib/gemini.js'

const PRIORITY_TO_APP = { high: 'High', medium: 'Normal', low: 'Low' }
const EMBED = 'customers(legacy_id,first_name,last_name)'

const redact = (s) => String(s || '')
  .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, '‹email›')
  .replace(/\+?\d[\d ()\-]{6,}\d/g, '‹number›')
  .slice(0, 300)

function parseJsonLoose(s) {
  if (!s) return null
  let t = String(s).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  try { return JSON.parse(t) } catch {}
  const i = t.indexOf('{'), j = t.lastIndexOf('}')
  if (i >= 0 && j > i) { try { return JSON.parse(t.slice(i, j + 1)) } catch {} }
  return null
}

const custName = (r) => r.customers ? `${r.customers.first_name || ''} ${r.customers.last_name || ''}`.trim() : ''

async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).end()
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Tasks need the relational data layer.' })
  if (!geminiEnabled) return res.status(503).json({ success: false, error: 'AI isn’t configured yet — add GEMINI_API_KEY in Vercel.', notConfigured: true })

  const rows = await db.select('tasks', `select=*,${EMBED}&done=is.false&order=created_at.desc&limit=80`)
  const today = new Date().toISOString().slice(0, 10)
  const nowMs = Date.now()
  const open = rows.filter((r) => !(r.snoozed_until && r.snoozed_until > today))
  if (!open.length) return res.json({ success: true, focus: 'Your task list is clear. 🎉', ranked: [], count: 0 })

  const items = open.map((r) => {
    const ageDays = r.created_at ? Math.max(0, Math.round((nowMs - new Date(r.created_at).getTime()) / 86400000)) : undefined
    return {
      id: r.id,
      title: redact(r.title),
      type: r.source === 'manual' ? 'manual' : 'auto',
      priority: PRIORITY_TO_APP[r.priority] || 'Normal',
      customer: custName(r) || undefined,
      due: r.due_date || undefined,
      ageDays,
      note: r.raw_text ? redact(r.raw_text) : undefined,
    }
  })

  const prompt = `You are the operations manager for Kosher Connect, a kosher phone shop in Manchester (SIM plans; phone rentals for travel; Israeli/USA numbers; repairs; Kol Torah audio). Today is ${today}.

Turn the OPEN tasks below into ONE ranked action plan for the shopkeeper. Judge real business urgency, not the stored priority:
- Money at risk (balances owed, failed or due renewal payments, refunds) is urgent — larger or older amounts rank higher.
- Time-critical items rank high: a flight/travel date coming up, anything due today or overdue, and anything that must be finished before Shabbos or Yom Tov.
- New signups and unanswered customer messages should be handled the same day, while the lead is warm.
- Vague, routine or low-value tasks are "soon".
- A task open for many days that still matters should rise, not sink.

Buckets: "now" = money at risk or same-day/travel-critical; "today" = handle today; "soon" = this week or low priority. Every task goes in exactly one bucket, most urgent first within each.

Return ONLY a JSON object — no prose, no markdown fences:
{"focus":"<one short sentence: the single most important thing to do first>","tasks":[{"id":"<task id copied verbatim>","bucket":"now|today|soon","reason":"<max 12 words why>","action":"<max 8 words: the concrete next step>"}]}
Include every task id exactly once. Never invent tasks or facts beyond what is given.

TASKS (JSON):
${JSON.stringify(items)}`

  const g = await geminiGenerate([{ text: prompt }], { temperature: 0.2, feature: 'task prioritiser' })
  if (!g.ok) return res.status(502).json({ success: false, error: g.error || 'AI could not prioritise the tasks.' })

  const parsed = parseJsonLoose(g.text)
  if (!parsed || !Array.isArray(parsed.tasks)) {
    return res.status(502).json({ success: false, error: 'AI returned an unexpected format — try again.' })
  }

  const byId = new Map(open.map((r) => [String(r.id), r]))
  const seen = new Set()
  const ranked = []
  const push = (row, t) => ranked.push({
    id: String(row.id),
    title: row.title,
    customerId: row.customers?.legacy_id ?? null,
    customerName: custName(row),
    bucket: ['now', 'today', 'soon'].includes(t?.bucket) ? t.bucket : 'soon',
    reason: String(t?.reason || '').slice(0, 120),
    action: String(t?.action || '').slice(0, 80),
  })
  for (const t of parsed.tasks) {
    const id = String(t?.id || '')
    const row = byId.get(id)
    if (!row || seen.has(id)) continue
    seen.add(id); push(row, t)
  }
  // Anything the model skipped still gets shown (as 'soon'), so nothing is lost.
  for (const row of open) if (!seen.has(String(row.id))) push(row, { bucket: 'soon' })

  return res.json({ success: true, focus: String(parsed.focus || '').slice(0, 200), ranked, count: ranked.length })
}

export default withTab('tasks', handler)
