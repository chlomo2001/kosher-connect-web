// Automation rules (#20) — owner-only CRUD. The rules are evaluated by the
// daily sweep (pages/api/cron/sweep.js).
//
// Actions were limited to 'create_task' until 26 Aug, when the owner asked for
// the passport and SIM-renewal reminders to reach the customer rather than the
// task list. 'send_sms' joins it — for those two triggers only (SMS_TRIGGERS in
// lib/autoSms.mjs), because they are the two where the fact is objective and
// the message is welcome. A rule that asks to text about a debt is refused
// here: money chasing stays a task for a human.
//
// Setting the action does NOT arm anything. See the four locks in
// lib/autoSms.mjs — without AUTO_SMS_LIVE the sweep composes the message,
// records what it would have sent, and sends nothing.

import { withStaff } from '../../lib/auth.js'
import { db, tablesMode, STORAGE_ERROR } from '../../lib/db.js'
import { RULE_ACTIONS, SMS_TRIGGERS } from '../../lib/autoSms.mjs'

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
      // smsTriggers so the form can offer "text the customer" only where it is
      // allowed, rather than offering it everywhere and refusing on save.
      return res.json({ success: true, rules: rows.map(toApp), triggers: TRIGGERS, smsTriggers: SMS_TRIGGERS })
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const b = req.body || {}
      if (req.method === 'PUT' && !b.id) return res.status(400).json({ success: false, error: 'id is required.' })
      if (!b.name || !String(b.name).trim()) return res.status(400).json({ success: false, error: 'Give the rule a name.' })
      if (!TRIGGERS[b.trigger]) return res.status(400).json({ success: false, error: 'Unknown trigger.' })
      // A blank threshold must not slide through as 0 — Number('') === 0, and
      // a rule that "fires at 0 days" is almost never what a blank field meant.
      if (b.threshold === '' || b.threshold == null) {
        return res.status(400).json({ success: false, error: 'Enter a valid threshold.' })
      }
      const threshold = Number(b.threshold)
      if (!Number.isFinite(threshold) || threshold < 0) return res.status(400).json({ success: false, error: 'Enter a valid threshold.' })
      // The action, and the one pairing this endpoint refuses. A rule may text
      // only about a passport or a SIM renewal — the two the owner chose on
      // 26 Aug because the fact is objective and the customer is glad to hear
      // it. "Text everyone who owes £50" is exactly the rule somebody would
      // write at the end of a long week, and exactly the one that costs a
      // relationship when the ledger is a day behind the cash drawer.
      const action = RULE_ACTIONS.includes(b.action) ? b.action : 'create_task'
      if (action === 'send_sms' && !SMS_TRIGGERS.includes(b.trigger)) {
        return res.status(400).json({
          success: false,
          error: 'Only a passport or SIM-renewal rule can text the customer. Everything else raises a task for a person to handle.',
        })
      }
      const row = {
        name: String(b.name).trim(),
        trigger: b.trigger,
        threshold,
        action,
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
    return res.status(500).json({ success: false, error: STORAGE_ERROR })
  }
}

export default withStaff(handler)
