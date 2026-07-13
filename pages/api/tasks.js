// Tasks — tables-native to-do list.
//
// Besides manual tasks, this table receives the keyed auto-tasks the system
// raises (reference column: BALANCE-<id> arrears, passport expiry, overdue
// rentals). One OPEN task per reference is enforced by a partial unique
// index, so closed keys can be re-raised later.

import { withStaff } from '../../lib/auth.js'
import { db, tablesMode } from '../../lib/db.js'

const PRIORITY_TO_DB = { High: 'high', Normal: 'medium', Low: 'low' }
const PRIORITY_TO_APP = { high: 'High', medium: 'Normal', low: 'Low' }

const EMBED = 'customers(legacy_id,first_name,last_name)'

function toApp(row) {
  return {
    id: row.id,
    title: row.title,
    customerId: row.customers?.legacy_id ?? null,
    customerName: row.customers
      ? `${row.customers.first_name || ''} ${row.customers.last_name || ''}`.trim()
      : '',
    dueDate: row.due_date || '',
    source: row.source,
    priority: PRIORITY_TO_APP[row.priority] || 'Normal',
    done: !!row.done,
    doneAt: row.done_at,
    notes: row.raw_text || '',
    reference: row.reference || '',
    snoozedUntil: row.snoozed_until || '',
    suggestionRejected: PRIORITY_TO_APP[row.suggestion_rejected] || '',
    createdAt: row.created_at,
  }
}

async function handler(req, res) {
  if (!tablesMode) {
    return res.status(503).json({ success: false, error: 'Tasks need the relational data layer.' })
  }

  try {
    if (req.method === 'GET') {
      const rows = await db.select(
        'tasks',
        `select=*,${EMBED}&order=done.asc,due_date.asc.nullslast,created_at.desc&limit=200`
      )
      return res.json(rows.map(toApp))
    }

    if (req.method === 'POST') {
      const b = req.body || {}
      if (!b.title || !String(b.title).trim()) {
        return res.status(400).json({ success: false, error: 'Title is required.' })
      }
      let customerUuid = null
      if (b.customerId) {
        const rows = await db.select(
          'customers',
          `select=id&legacy_id=eq.${encodeURIComponent(String(b.customerId))}`
        )
        customerUuid = rows.length ? rows[0].id : null
      }
      const [row] = await db.insert('tasks', [{
        title: String(b.title).trim(),
        customer_id: customerUuid,
        due_date: b.dueDate || null,
        source: 'manual',
        priority: PRIORITY_TO_DB[b.priority] || 'medium',
        raw_text: b.notes || null,
      }])
      const [full] = await db.select('tasks', `select=*,${EMBED}&id=eq.${row.id}`)
      return res.json({ success: true, task: toApp(full) })
    }

    if (req.method === 'PUT') {
      const { id, done, priority, snoozedUntil, suggestionRejected } = req.body || {}
      if (!id) return res.status(400).json({ success: false, error: 'Task id is required.' })
      const patch = {}
      if (done !== undefined) {
        patch.done = !!done
        patch.done_at = done ? new Date().toISOString() : null
      }
      if (priority !== undefined) {
        if (!PRIORITY_TO_DB[priority]) return res.status(400).json({ success: false, error: 'Priority must be High, Normal, or Low.' })
        patch.priority = PRIORITY_TO_DB[priority]
        patch.suggestion_rejected = null // a fresh choice resets the dismissal
      }
      if (snoozedUntil !== undefined) {
        patch.snoozed_until = /^\d{4}-\d{2}-\d{2}$/.test(String(snoozedUntil || '')) ? snoozedUntil : null
      }
      if (suggestionRejected !== undefined) {
        patch.suggestion_rejected = PRIORITY_TO_DB[suggestionRejected] || null
      }
      if (!Object.keys(patch).length) return res.status(400).json({ success: false, error: 'Nothing to update.' })
      const updated = await db.update('tasks', `id=eq.${encodeURIComponent(String(id))}`, patch)
      if (!updated.length) return res.status(404).json({ success: false, error: 'Task not found.' })
      const [full] = await db.select('tasks', `select=*,${EMBED}&id=eq.${updated[0].id}`)
      return res.json({ success: true, task: toApp(full) })
    }

    return res.status(405).end()
  } catch (e) {
    console.error('[api/tasks]', e)
    return res.status(500).json({ success: false, error: 'Storage error' })
  }
}

export default withStaff(handler)
