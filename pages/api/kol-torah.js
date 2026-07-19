// Kol Torah module — catalogue, per-shul consignment, settlements, and
// conversion jobs. Phase 2 Track B (owner scoping: all four pieces).
//
// Money discipline is the house one:
//   • A settlement with a linked shul posts a stock_sale charge (−sold_value)
//     and a payment (+received) on that shul's wallet, keyed KT-SETTLE-<id> /
//     PAY-KT-SETTLE-<id> — idempotent via insertIgnoreDup + a claimKey around
//     the insert, so a double-submit can't settle twice.
//   • Collecting a priced job posts one online_service charge keyed
//     KT-JOB-<id>; payment is then taken through the normal wallet flow, so
//     an uncollected balance shows up as arrears like everything else.
//   • Consignment counts move through the guarded kt_adjust_stock RPC — the
//     same never-negative race-closer as shop stock.

import { withTab } from '../../lib/auth.js'
import { db, tablesMode } from '../../lib/db.js'
import { money } from '../../lib/money.mjs'

const JOB_KINDS = {
  cd_to_mp3: 'CD → MP3',
  cd_to_sd: 'CD → SD card',
  cd_copy: 'CD copying',
  audio_other: 'Audio work',
}
const METHODS = ['cash', 'card', 'bank_transfer', 'other']
const MOVE_KINDS = ['delivery', 'return', 'sold', 'adjust']

const str = (v, n) => {
  const t = String(v == null ? '' : v).trim()
  return t ? t.slice(0, n) : null
}
const cleanRef = (v) => (typeof v === 'string' && /^[\w-]{8,64}$/.test(v) ? v : null)
const custName = (c) => (c ? `${c.first_name || ''} ${c.last_name || ''}`.trim() : null)

async function customerUuidFor(legacyId) {
  if (!legacyId || legacyId === 'walkin') return null
  const rows = await db.select('customers', `select=id&legacy_id=eq.${encodeURIComponent(String(legacyId))}`)
  return rows[0]?.id || null
}

async function handler(req, res) {
  if (!tablesMode) {
    return res.status(503).json({ success: false, error: 'Relational data layer unavailable.' })
  }

  if (req.method === 'GET') {
    const [titles, shuls, stock, jobs, settlements] = await Promise.all([
      db.select('kt_titles', 'order=name.asc'),
      db.select('kt_shuls', 'select=*,customers(legacy_id,first_name,last_name)&order=name.asc'),
      db.select('kt_stock', 'select=shul_id,title_id,qty'),
      db.select('kt_jobs', 'select=*,customers(legacy_id,first_name,last_name)&order=created_at.desc&limit=200'),
      db.select('kt_settlements', 'select=*,kt_shuls(name)&order=created_at.desc&limit=100'),
    ])
    return res.json({
      success: true,
      titles: titles.map((t) => ({
        id: t.id, code: t.code, name: t.name, speaker: t.speaker,
        price: Number(t.price), active: t.active, notes: t.notes,
      })),
      shuls: shuls.map((s) => ({
        id: s.id, name: s.name, contact: s.contact, active: s.active, notes: s.notes,
        customerId: s.customers?.legacy_id || null, customerName: custName(s.customers),
      })),
      stock: stock.map((r) => ({ shulId: r.shul_id, titleId: r.title_id, qty: r.qty })),
      jobs: jobs.map((j) => ({
        id: j.id, kind: j.kind, details: j.details, qty: j.qty, price: Number(j.price),
        status: j.status, createdAt: j.created_at, readyAt: j.ready_at, collectedAt: j.collected_at,
        customerId: j.customers?.legacy_id || null,
        customerName: custName(j.customers) || j.customer_name || 'Walk-in',
      })),
      settlements: settlements.map((x) => ({
        id: x.id, shulId: x.shul_id, shulName: x.kt_shuls?.name || '—',
        soldValue: Number(x.sold_value), received: Number(x.received),
        method: x.method, note: x.note, createdAt: x.created_at,
      })),
    })
  }

  if (req.method !== 'POST') return res.status(405).end()
  const b = req.body || {}

  // ── Catalogue ──────────────────────────────────────────────────────────
  if (b.op === 'title-save') {
    const name = str(b.name, 120)
    if (!name) return res.status(400).json({ success: false, error: 'The title needs a name.' })
    const price = money(b.price)
    if (!(price >= 0)) return res.status(400).json({ success: false, error: 'Price can’t be negative.' })
    const row = {
      code: str(b.code, 20), name, speaker: str(b.speaker, 120),
      price, active: b.active !== false, notes: str(b.notes, 500),
    }
    if (b.id) {
      const updated = await db.update('kt_titles', `id=eq.${encodeURIComponent(String(b.id))}`, row)
      if (!updated.length) return res.status(404).json({ success: false, error: 'Title not found.' })
      return res.json({ success: true, title: updated[0] })
    }
    const [title] = await db.insert('kt_titles', [row])
    return res.json({ success: true, title })
  }

  // ── Shuls ──────────────────────────────────────────────────────────────
  if (b.op === 'shul-save') {
    const name = str(b.name, 120)
    if (!name) return res.status(400).json({ success: false, error: 'The shul needs a name.' })
    // Optional wallet link: pick an existing customer record (created through
    // the normal + New Customer flow) so settlements ride the ledger.
    let customer_id = null
    if (b.customerId) {
      customer_id = await customerUuidFor(b.customerId)
      if (!customer_id) return res.status(400).json({ success: false, error: 'That customer record wasn’t found.' })
    }
    const row = {
      name, contact: str(b.contact, 200), customer_id,
      active: b.active !== false, notes: str(b.notes, 500),
    }
    if (b.id) {
      const updated = await db.update('kt_shuls', `id=eq.${encodeURIComponent(String(b.id))}`, row)
      if (!updated.length) return res.status(404).json({ success: false, error: 'Shul not found.' })
      return res.json({ success: true, shul: updated[0] })
    }
    const [shul] = await db.insert('kt_shuls', [row])
    return res.json({ success: true, shul })
  }

  // ── Consignment movements ──────────────────────────────────────────────
  if (b.op === 'move') {
    const kind = MOVE_KINDS.includes(b.kind) ? b.kind : null
    if (!kind) return res.status(400).json({ success: false, error: 'Unknown movement kind.' })
    const qty = parseInt(b.qty, 10)
    if (!Number.isFinite(qty) || qty === 0 || Math.abs(qty) > 10000) {
      return res.status(400).json({ success: false, error: 'Quantity must be a whole number.' })
    }
    // delivery adds; return/sold remove; adjust takes the sign as typed.
    const delta = kind === 'delivery' ? Math.abs(qty) : kind === 'adjust' ? qty : -Math.abs(qty)
    const left = await db.rpc('kt_adjust_stock', {
      p_shul: String(b.shulId), p_title: String(b.titleId), p_delta: delta,
    })
    if (left === null || left === undefined) {
      return res.status(400).json({ success: false, error: 'That would take the shul below zero stock — check the count.' })
    }
    await db.insert('kt_movements', [{
      shul_id: String(b.shulId), title_id: String(b.titleId),
      delta, kind, note: str(b.note, 300),
    }])
    return res.json({ success: true, qty: left })
  }

  // ── Settlement — money collected from a shul ───────────────────────────
  if (b.op === 'settle') {
    const soldValue = money(b.soldValue)
    const received = money(b.received)
    if (!(soldValue >= 0) || !(received >= 0) || (soldValue === 0 && received === 0)) {
      return res.status(400).json({ success: false, error: 'Enter the £ sold and/or the £ collected.' })
    }
    const clientRef = cleanRef(b.clientRef)
    if (!clientRef) return res.status(400).json({ success: false, error: 'Missing request token — refresh and try again.' })
    const method = METHODS.includes(b.method) ? b.method : 'cash'
    const shuls = await db.select('kt_shuls', `id=eq.${encodeURIComponent(String(b.shulId))}&select=id,name,customer_id`)
    if (!shuls.length) return res.status(404).json({ success: false, error: 'Shul not found.' })
    const shul = shuls[0]

    const claimed = await db.claimKey(`KT-SETTLE-${clientRef}`, { scope: 'kt_settlement' })
    if (!claimed) {
      const dup = await db.select('kt_settlements', `client_ref=eq.${encodeURIComponent(clientRef)}&select=id&limit=1`)
      if (dup.length) return res.json({ success: true, duplicate: true })
      return res.status(409).json({ success: false, error: 'That settlement is still being processed — give it a second.' })
    }
    let settlement
    try {
      ;[settlement] = await db.insert('kt_settlements', [{
        shul_id: shul.id, sold_value: soldValue, received, method,
        note: str(b.note, 500), client_ref: clientRef,
      }])
      if (shul.customer_id) {
        const rows = []
        if (soldValue > 0) rows.push({
          customer_id: shul.customer_id,
          charge_reference: `KT-SETTLE-${settlement.id}`,
          entry_type: 'stock_sale',
          amount: money(-soldValue),
          description: `Kol Torah consignment — CDs sold at ${shul.name}`,
        })
        if (received > 0) rows.push({
          customer_id: shul.customer_id,
          charge_reference: `PAY-KT-SETTLE-${settlement.id}`,
          entry_type: 'payment',
          amount: received,
          method,
          description: `Kol Torah settlement — ${shul.name}`,
        })
        if (rows.length) await db.insertIgnoreDup('ledger', rows, 'charge_reference')
      }
    } catch (e) {
      try { await db.releaseKey(`KT-SETTLE-${clientRef}`) }
      catch (e2) { console.error('[api/kol-torah] settle unwind: key not released', clientRef, e2) }
      throw e
    }
    return res.json({ success: true, settlement })
  }

  // ── Conversion jobs ────────────────────────────────────────────────────
  if (b.op === 'job-save') {
    if (!JOB_KINDS[b.kind]) return res.status(400).json({ success: false, error: 'Pick what kind of job it is.' })
    const qty = Math.max(1, parseInt(b.qty, 10) || 1)
    const price = money(b.price)
    if (!(price >= 0)) return res.status(400).json({ success: false, error: 'Price can’t be negative.' })
    const customer_id = await customerUuidFor(b.customerId)
    const customer_name = str(b.customerName, 120)
    if (!customer_id && !customer_name) {
      return res.status(400).json({ success: false, error: 'Pick a customer or type a name.' })
    }
    const clientRef = cleanRef(b.clientRef)
    if (clientRef) {
      const claimed = await db.claimKey(`KT-JOB-NEW-${clientRef}`, { scope: 'kt_job', customerId: customer_id })
      if (!claimed) {
        const dup = await db.select('kt_jobs', `client_ref=eq.${encodeURIComponent(clientRef)}&select=id&limit=1`)
        if (dup.length) return res.json({ success: true, duplicate: true })
        return res.status(409).json({ success: false, error: 'That job is still being saved — give it a second.' })
      }
    }
    try {
      const [job] = await db.insert('kt_jobs', [{
        customer_id, customer_name, kind: b.kind,
        details: str(b.details, 500), qty, price, client_ref: clientRef,
      }])
      return res.json({ success: true, job })
    } catch (e) {
      if (clientRef) {
        try { await db.releaseKey(`KT-JOB-NEW-${clientRef}`) }
        catch (e2) { console.error('[api/kol-torah] job unwind: key not released', clientRef, e2) }
      }
      throw e
    }
  }

  if (b.op === 'job-status') {
    const to = String(b.status || '')
    const jobs = await db.select('kt_jobs', `id=eq.${encodeURIComponent(String(b.id))}`)
    if (!jobs.length) return res.status(404).json({ success: false, error: 'Job not found.' })
    const job = jobs[0]
    const allowed = {
      open: ['ready', 'collected', 'cancelled'],
      ready: ['open', 'collected', 'cancelled'],
      collected: [],   // money has moved — no silent un-collect
      cancelled: ['open'],
    }
    if (!(allowed[job.status] || []).includes(to)) {
      return res.status(400).json({ success: false, error: `A ${job.status} job can’t become ${to}.` })
    }
    const patch = { status: to }
    if (to === 'ready') patch.ready_at = new Date().toISOString()
    if (to === 'collected') patch.collected_at = new Date().toISOString()
    const updated = await db.update('kt_jobs', `id=eq.${encodeURIComponent(String(job.id))}`, patch)
    // Collecting a priced job for a known customer charges their wallet — one
    // idempotent row, so a repeat collect click can't double-charge.
    if (to === 'collected' && job.customer_id && money(job.price) > 0) {
      await db.insertIgnoreDup('ledger', [{
        customer_id: job.customer_id,
        charge_reference: `KT-JOB-${job.id}`,
        entry_type: 'online_service',
        amount: money(-job.price),
        description: `Kol Torah — ${JOB_KINDS[job.kind]}${job.qty > 1 ? ` × ${job.qty}` : ''}`,
      }], 'charge_reference')
    }
    return res.json({ success: true, job: updated[0] })
  }

  return res.status(400).json({ success: false, error: 'Unknown operation.' })
}

export default withTab('koltorah', handler)
