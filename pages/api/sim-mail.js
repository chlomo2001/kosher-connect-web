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
import { carrierMailKind, kindLabel } from '../../lib/carrierMail.mjs'

const enc = encodeURIComponent

let cache = { at: 0, sims: null }
const TTL_MS = 60_000

// One read of the SIM list, shaped for both candidate lookup and display.
async function simDirectory() {
  if (cache.sims && Date.now() - cache.at < TTL_MS) return cache.sims
  const rows = await selectAllPaged(
    'sims', 'id,legacy_id,customer_id,provider,status,legacy_extras', 'order=id.asc'
  )
  // renewalDate and status come along for the ranking below — a renewal notice
  // is about a plan that is renewing, which is a strong hint at WHICH plan.

  const byId = new Map()
  // The browser holds the app's own SIM ids (legacy_id), not the row UUIDs, so
  // every id that arrives from the client is resolved through here.
  const byLegacyId = new Map()
  for (const r of rows) {
    const entry = {
      id: r.id,
      legacyId: r.legacy_id ? String(r.legacy_id) : '',
      number: r.legacy_extras?.simNumber || '',
      provider: r.provider || r.legacy_extras?.provider || '',
      status: r.status || '',
      customerId: r.customer_id,
      customerName: r.legacy_extras?.customerName || '',
      renewalDate: r.legacy_extras?.renewalDate || '',
    }
    byId.set(String(r.id), entry)
    if (entry.legacyId) byLegacyId.set(entry.legacyId, entry)
  }
  const index = buildSimIndex(rows.map((r) => ({
    id: r.id,
    email: r.legacy_extras?.email || '',
    simNumber: r.legacy_extras?.simNumber || '',
  })))
  const sims = { byId, byLegacyId, index }
  cache = { at: Date.now(), sims }
  return sims
}

// WHICH OF THESE THIRTEEN? — put the likely ones first.
//
// A pool address can carry hundreds of SIMs, and the queue used to offer them
// in database order: a wall of equally-plausible chips, which is the same as
// offering no help at all. Three signals, cheap and honest:
//
//   1. the message names the number      → it IS that SIM, not a guess
//   2. the plan is live                  → a dead plan is not renewing
//   3. its renewal is near the email     → a renewal notice comes days before
//                                          the renewal it is about
//
// This RANKS. It never drops a candidate below the display cap on its own, and
// it never decides — a person still picks, which is the whole point of the
// queue. Ordering is a hint; hiding would be a lie.
function rankCandidates(list, m) {
  const named = new Set(m.numbers || [])
  const at = m.received_at ? Date.parse(m.received_at) : NaN
  const score = (c) => {
    let s = 0
    const tail = String(c.number || '').replace(/\D/g, '').slice(-10)
    if (tail && named.has(tail)) s += 100
    if (String(c.status || '').toLowerCase() === 'active') s += 10
    if (!Number.isNaN(at) && c.renewalDate) {
      const days = Math.abs(Date.parse(`${c.renewalDate}T12:00:00Z`) - at) / 86400000
      // Inside a fortnight is a real signal; beyond that it is noise, and a
      // linear score would keep sorting on it long after it stopped meaning
      // anything.
      if (days <= 14) s += 8 - Math.min(8, days / 2)
    }
    return s
  }
  return [...list].sort((a, b) => score(b) - score(a)
    || String(a.customerName || '').localeCompare(String(b.customerName || '')))
}

async function handler(req, res) {
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Storage unavailable.' })

  if (req.method === 'GET') {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50))

    // One SIM's mail, for its record card. Answered from the app's own id.
    if (req.query.simLegacyId) {
      const { byLegacyId } = await simDirectory()
      const sim = byLegacyId.get(String(req.query.simLegacyId))
      if (!sim) return res.json({ success: true, messages: [] })
      const rows = await db.select(
        'sim_mail',
        `select=id,received_at,from_address,carrier,subject,confidence&sim_id=eq.${enc(sim.id)}` +
          `&order=received_at.desc&limit=${limit}`
      )
      return res.json({
        success: true,
        messages: rows.map((m) => ({
          id: m.id, receivedAt: m.received_at, from: m.from_address || '',
          carrier: m.carrier || '', subject: m.subject || '', confidence: m.confidence,
        })),
      })
    }

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
      let candidatesTotal = 0
      if (!m.sim_id && !m.resolved_at) {
        // A tagged address that nothing is registered at falls back to its
        // base: mail to gitt.bilig+kalush@ where only gitt.bilig@ is on record
        // used to offer NOTHING — a dead end reading "not on the books" — when
        // the postbox behind it has candidates to choose from. The tag is a
        // narrower answer when it exists; when it does not, the postbox beats
        // an empty screen.
        const key = mailboxKey(m.recipient) || ''
        const baseKey = key.includes('+') ? `${key.slice(0, key.indexOf('+'))}@${key.split('@')[1]}` : ''
        const fromAddress = index.byAddress.get(key)
          || (baseKey ? index.byAddress.get(baseKey) : null) || []
        const fromNumber = (m.numbers || []).flatMap((n) => index.byNumber.get(n) || [])
        const all = [...new Set([...fromAddress, ...fromNumber])]
          .map((id) => byId.get(String(id)))
          .filter(Boolean)
        candidatesTotal = all.length
        candidates = rankCandidates(all, m).slice(0, 12)
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
        // Worked out on READ, not stored: it costs nothing, it needs no
        // migration, and it labels the mail that arrived before any of this
        // existed — which is the queue the owner is actually looking at.
        kind: carrierMailKind({ subject: m.subject, snippet: m.snippet }),
        kindLabel: kindLabel(carrierMailKind({ subject: m.subject, snippet: m.snippet })),
        sim, candidates, candidatesTotal,
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
    const { id, ids, simId, op } = req.body || {}
    const now = new Date().toISOString()

    // Clearing a run of them at once — the same reasoning as the ticket queue:
    // a pile of identical carrier circulars is one decision made twenty times,
    // and a queue that costs twenty presses to clear stops being cleared. One
    // statement, so they cannot half-succeed. PAIRING still goes one at a time:
    // which SIM a message belongs to is a different answer every row.
    if (op === 'resolve' && Array.isArray(ids)) {
      const clean = [...new Set(ids.map((v) => String(v).trim()))].filter((v) => /^\d{1,18}$/.test(v))
      if (!clean.length) return res.status(400).json({ success: false, error: 'No message ids to clear.' })
      if (clean.length > 200) return res.status(400).json({ success: false, error: 'Too many at once.' })
      const rows = await db.update('sim_mail', `id=in.(${clean.map(enc).join(',')})&resolved_at=is.null`, { resolved_at: now })
      return res.json({ success: true, resolved: rows.length })
    }

    if (!id) return res.status(400).json({ success: false, error: 'A message id is required.' })

    if (op === 'resolve') {
      const rows = await db.update('sim_mail', `id=eq.${enc(id)}`, { resolved_at: now })
      if (!rows.length) return res.status(404).json({ success: false, error: 'No such message.' })
      return res.json({ success: true, resolved: true })
    }

    // Undo a match (owner, 19 Aug: "any way to undo a non needs a human
    // match?"). Sends the message back to the queue for a person to decide.
    //
    // `unpaired_at` is what makes it hold. Clearing sim_id alone would leave
    // the row in exactly the state the nightly sweep hunts for — resolved_at
    // null AND sim_id null — so the next run would re-file it on the same wrong
    // SIM and the undo would quietly undo itself. The sweep skips these.
    if (op === 'unpair') {
      const rows = await db.update('sim_mail', `id=eq.${enc(id)}&sim_id=not.is.null`, {
        sim_id: null,
        customer_id: null,
        resolved_at: null,
        unpaired_at: now,
        unpaired_by: req.staff?.fullName || req.staff?.email || 'staff',
        // The old verdict must not survive as an explanation of the new state.
        confidence: 'unpaired',
      })
      if (!rows.length) {
        return res.status(404).json({ success: false, error: 'That message is not filed on a SIM.' })
      }
      return res.json({ success: true, unpaired: true })
    }

    const { simLegacyId } = req.body || {}
    if (!simId && !simLegacyId) {
      return res.status(400).json({ success: false, error: 'Pick a SIM, or resolve it.' })
    }
    const { byId, byLegacyId } = await simDirectory()
    // A SIM created seconds ago would miss the 60s directory cache, so a miss
    // on the legacy id retries against fresh data before giving up — this path
    // runs right after "add it as a new SIM".
    let sim = simId ? byId.get(String(simId)) : byLegacyId.get(String(simLegacyId))
    if (!sim && simLegacyId) {
      cache = { at: 0, sims: null }
      const fresh = await simDirectory()
      sim = fresh.byLegacyId.get(String(simLegacyId))
    }
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
