// Automation rules (#20) — owner-only CRUD. The rules are evaluated by the
// daily sweep (pages/api/cron/sweep.js). Actions are limited to 'create_task'
// for now; SMS/email land with Twilio.

import { withStaff } from '../../lib/auth.js'
import { db, tablesMode } from '../../lib/db.js'

export const TRIGGERS = {
  balance_over:        { label: 'Customer owes at least £N', unit: '£' },
  rental_overdue_days: { label: 'Rental overdue by N+ days', unit: 'days' },
  flight_in_days:      { label: 'Flight within N days', unit: 'days' },
  passport_in_days:    { label: 'Passport expires within N days', unit: 'days' },
  sim_renewal_in_days: { label: 'SIM renews within N days', unit: 'days' },
  checkin_due:         { label: 'We-do check-in within N days (not done)', unit: 'days' },
}
const PRIORITIES = ['high', 'medium', 'low']

const toApp = (r) => ({
  id: r.id,
  name: r.name,
  trigger: r.trigger,
  threshold: r.threshold === null ? null : Number(r.threshold),
  action: r.action,
  taskTitle: r.task_title || '',
  priority: r.priority,
  enabled: !!r.enabled,
})

async function handler(req, res) {
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Automations need the relational data layer.' })
  if (req.staff?.role !== 'owner') {
    return res.status(403).json({ success: false, error: 'Automations are admin-only.' })
  }

  try {
    if (req.method === 'GET') {
      const rows = await db.select('automation_rules', 'order=created_at.asc')
      return res.json({ success: true, rules: rows.map(toApp), triggers: TRIGGERS })
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const b = req.body || {}
      if (req.method === 'PUT' && !b.id) return res.status(400).json({ success: false, error: 'id is required.' })
      if (!b.name || !String(b.name).trim()) return res.status(400).json({ success: false, error: 'Give the rule a name.' })
      if (!TRIGGERS[b.trigger]) return res.status(400).json({ success: false, error: 'Unknown trigger.' })
      const threshold = Number(b.threshold)
      if (!Number.isFinite(threshold) || threshold < 0) return res.status(400).json({ success: false, error: 'Enter a valid threshold.' })
      const row = {
        name: String(b.name).trim(),
        trigger: b.trigger,
        threshold,
        action: 'create_task',
        task_title: b.taskTitle ? String(b.taskTitle).trim() : null,
        priority: PRIORITIES.includes(b.priority) ? b.priority : 'high',
        enabled: b.enabled === undefined ? true : !!b.enabled,
      }
      if (req.method === 'POST') {
        const [ins] = await db.insert('automation_rules', [row])
        return res.json({ success: true, rule: toApp(ins) })
      }
      const upd = await db.update('automation_rules', `id=eq.${encodeURIComponent(String(b.id))}`, row)
      if (!upd.length) return res.status(404).json({ success: false, error: 'Rule not found.' })
      return res.json({ success: true, rule: toApp(upd[0]) })
    }

    if (req.method === 'DELETE') {
      const { id } = req.query
      if (!id) return res.status(400).json({ success: false, error: 'id is required.' })
      await db.delete('automation_rules', `id=eq.${encodeURIComponent(String(id))}`)
      return res.json({ success: true })
    }

    return res.status(405).end()
  } catch (e) {
    console.error('[api/automations]', e)
    return res.status(500).json({ success: false, error: 'Storage error' })
  }
}

export default withStaff(handler)
