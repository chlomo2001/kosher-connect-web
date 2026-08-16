// Carrier mail: what arrived, what it was about, and what still needs a human.
//
// /api/inbound/mail files every message against the SIM it names. This is the
// read side plus the two actions a person can take on the ones it could not
// settle alone:
//
//   GET  ?filter=pending|paired|all&limit=50
//   POST { id, simId }        → this message belongs to that SIM
//   POST { id, op:'resolve' } → nothing to do here, stop showing it
//
// 'pending' is the working queue: unresolved and unpaired — the 'ambiguous'
// (a pool address shared by up to 37 SIMs, nothing in the text to narrow it)
// and the 'unknown' (a number live at a carrier that the app has no record of,
// which the July sweep found 241 of).
//
// Ambiguous rows come back with CANDIDATES — the SIMs registered at that
// recipient address — so settling one is a click, not a search. They are
// recomputed from the current SIM list rather than stored, because a SIM added
// since the message arrived should show up as a candidate for it.

import { withStaff } from '../../lib/auth.js'
import { db, tablesMode, selectAllPaged } from '../../lib/db.js'
import { buildSimIndex, mailboxKey } from '../../lib/simMailMatch.mjs'

const enc = encodeURIComponent

let cache = { at: 0, sims: null }
const TTL_MS = 60_000

// One read of the SIM list, shaped for both candidate lookup and display.
async function simDirectory() {
  if (cache.sims && Date.now() - cache.at < TTL_MS) return cache.sims
  const rows = await selectAllPaged(
    'sims', 'id,customer_id,provider,status,legacy_extras', 'order=id.asc'
  )
  const byId = new Map()
  for (const r of rows) {
    byId.set(String(r.id), {
      id: r.id,
      number: r.legacy_extras?.simNumber || '',
      provider: r.provider || r.legacy_extras?.provider || '',
      status: r.status || '',
      customerId: r.customer_id,
      customerName: r.legacy_extras?.customerName || '',
    })
  }
  const index = buildSimIndex(rows.map((r) => ({
    id: r.id,
    email: r.legacy_extras?.email || '',
    simNumber: r.legacy_extras?.simNumber || '',
  })))
  const sims = { byId, index }
  cache = { at: Date.now(), sims }
  return sims
}

async function handler(req, res) {
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Storage unavailable.' })

  if (req.method === 'GET') {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50))
    const filter = String(req.query.filter || 'pending')
    const where = filter === 'paired' ? 'sim_id=not.is.null'
      : filter === 'all' ? ''
        : 'resolved_at=is.null&sim_id=is.null'   // pending — the working queue

    const rows = await db.select(
      'sim_mail',
      `select=*&${where ? `${where}&` : ''}order=received_at.desc&limit=${limit}`
    )
    const { byId, index } = await simDirectory()

    const messages = rows.map((m) => {
      const sim = m.sim_id ? byId.get(String(m.sim_id)) || null : null
      // Candidates only matter for a row a human still has to settle.
      let candidates = []
      if (!m.sim_id && !m.resolved_at) {
        const fromAddress = index.byAddress.get(mailboxKey(m.recipient) || '') || []
        const fromNumber = (m.numbers || []).flatMap((n) => index.byNumber.get(n) || [])
        candidates = [...new Set([...fromAddress, ...fromNumber])]
          .map((id) => byId.get(String(id)))
          .filter(Boolean)
          .slice(0, 12)
      }
      return {
        id: m.id,
        receivedAt: m.received_at,
        from: m.from_address || '',
        carrier: m.carrier || '',
        subject: m.subject || '',
        snippet: m.snippet || '',
        recipient: m.recipient || '',
        confidence: m.confidence,
        numbers: m.numbers || [],
        resolvedAt: m.resolved_at,
        sim, candidates,
      }
    })

    // Counts for the header — the whole table, not just this page.
    const [pending, paired, total] = await Promise.all([
      selectAllPaged('sim_mail', 'id', 'resolved_at=is.null&sim_id=is.null&order=id.asc'),
      selectAllPaged('sim_mail', 'id', 'sim_id=not.is.null&order=id.asc'),
      selectAllPaged('sim_mail', 'id', 'order=id.asc'),
    ])

    return res.json({
      success: true,
      counts: { pending: pending.length, paired: paired.length, total: total.length },
      messages,
    })
  }

  if (req.method === 'POST') {
    const { id, simId, op } = req.body || {}
    if (!id) return res.status(400).json({ success: false, error: 'A message id is required.' })
    const now = new Date().toISOString()

    if (op === 'resolve') {
      const rows = await db.update('sim_mail', `id=eq.${enc(id)}`, { resolved_at: now })
      if (!rows.length) return res.status(404).json({ success: false, error: 'No such message.' })
      return res.json({ success: true, resolved: true })
    }

    if (!simId) return res.status(400).json({ success: false, error: 'Pick a SIM, or resolve it.' })
    const { byId } = await simDirectory()
    const sim = byId.get(String(simId))
    if (!sim) return res.status(400).json({ success: false, error: 'That SIM no longer exists.' })

    const rows = await db.update('sim_mail', `id=eq.${enc(id)}`, {
      sim_id: sim.id,
      customer_id: sim.customerId || null,
      resolved_at: now,
    })
    if (!rows.length) return res.status(404).json({ success: false, error: 'No such message.' })
    return res.json({ success: true, paired: true, sim })
  }

  res.status(405).end()
}

export default withStaff(handler)
