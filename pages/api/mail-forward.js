// Forwarding a carrier email to the customer it is about.
//
//   GET                → the approval queue: what would go, to whom, and why
//   POST { id }        → approve and send one
//
// Owner item 20, 19 August 2026. The owner chose "HOLD-gated, with an approval
// queue" over going live for a narrow set, so this endpoint's job is to make a
// forward VISIBLE before it is possible, not to decide anything on its own.
//
// Every decision lives in lib/mailForward.mjs, which sends nothing and knows
// nothing about email. This file adds the two things it cannot know: the
// customer's address, and whether the message has already been sent.
//
// The send goes through lib/email.js, so the shop's existing gate decides what
// actually happens: on HOLD it is built and logged and nothing leaves the
// building. That is deliberate — this ships without changing the gate, and the
// owner flips it when they have read a few in the queue and believe it.
import { withStaff } from '../../lib/auth.js'
import { db, tablesMode } from '../../lib/db.js'
import { emailEnabled } from '../../lib/email.js'
import { carrierMailKind } from '../../lib/carrierMail.mjs'
import { forwardPlan } from '../../lib/mailForward.mjs'
import { sendCarrierForward } from '../../lib/forwardSend.js'

const enc = encodeURIComponent
const LIMIT = 100

/** sim_mail rows that are filed on a SIM and not yet forwarded, newest first. */
async function pendingRows(onlyId = null) {
  const where = onlyId
    ? `id=eq.${enc(String(onlyId))}`
    : 'sim_id=not.is.null&forwarded_at=is.null'
  return db.select('sim_mail',
    `select=id,received_at,carrier,subject,snippet,numbers,sim_id,forwarded_at,forwarded_to` +
    `&${where}&order=received_at.desc&limit=${LIMIT}`)
}

/**
 * Attach the customer behind each SIM, with their address.
 *
 * Two hops, because sim_mail knows a SIM and a SIM knows a customer id — and
 * the email lives on the customer. Done in two batched reads rather than one
 * per message: the queue is a hundred rows at its worst.
 */
async function withCustomers(rows) {
  const simIds = [...new Set(rows.map((r) => r.sim_id).filter(Boolean))].map(String)
  if (!simIds.length) return new Map()
  const sims = await db.select('sims',
    `select=id,customer_id,legacy_extras&id=in.(${simIds.map(enc).join(',')})`).catch(() => [])
  const custIds = [...new Set(sims.map((s) => s.customer_id).filter(Boolean))].map(String)
  const customers = custIds.length
    ? await db.select('customers',
        `select=id,first_name,last_name,email_raw&id=in.(${custIds.map(enc).join(',')})`).catch(() => [])
    : []
  const byCustomer = new Map(customers.map((c) => [String(c.id), c]))
  const out = new Map()
  for (const s of sims) {
    const c = s.customer_id ? byCustomer.get(String(s.customer_id)) : null
    out.set(String(s.id), {
      id: s.id,
      number: s.legacy_extras?.simNumber || '',
      customerId: s.customer_id || null,
      customerName: c ? `${c.first_name || ''} ${c.last_name || ''}`.trim() : (s.legacy_extras?.customerName || ''),
      // email_raw is what the customer actually gave us. The normalised column
      // is a matching key and is not an address anybody should be written to.
      customerEmail: c ? (c.email_raw || '') : '',
    })
  }
  return out
}

/** One sim_mail row in the shape lib/mailForward.mjs expects. */
function toMessage(row, sims) {
  return {
    id: row.id,
    subject: row.subject || '',
    numbers: row.numbers || [],
    kind: carrierMailKind({ subject: row.subject, snippet: row.snippet }),
    sim: row.sim_id ? sims.get(String(row.sim_id)) || null : null,
  }
}

// The body builder lives in lib/forwardSend.js now — shared with the auto
// path (issue #15), so an approved forward and an automatic one read the same.

async function handler(req, res) {
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Needs the relational data layer.' })
  if (req.staff?.role !== 'owner') {
    return res.status(403).json({ success: false, error: 'Only the owner can forward carrier mail.' })
  }

  if (req.method === 'GET') {
    const rows = await pendingRows()
    const sims = await withCustomers(rows)
    const plans = rows.map((r) => {
      const plan = forwardPlan(toMessage(r, sims))
      return { ...plan, carrier: r.carrier || '', receivedAt: r.received_at, snippet: r.snippet || '' }
    })
    return res.json({
      success: true,
      // Said plainly so the queue can explain itself rather than looking empty
      // for reasons nobody can see.
      gate: emailEnabled ? 'configured' : 'not-configured',
      ready: plans.filter((p) => p.ready).length,
      blocked: plans.filter((p) => !p.ready).length,
      plans,
    })
  }

  if (req.method === 'POST') {
    const id = (req.body || {}).id
    if (id == null) return res.status(400).json({ success: false, error: 'Which message?' })
    const rows = await pendingRows(id)
    const row = rows[0]
    if (!row) return res.status(404).json({ success: false, error: 'That message is no longer there.' })
    if (row.forwarded_at) {
      return res.status(409).json({ success: false, error: `Already forwarded to ${row.forwarded_to || 'the customer'}.` })
    }
    const sims = await withCustomers(rows)
    const plan = forwardPlan(toMessage(row, sims))
    // The decision is re-made here rather than trusted from the browser: the
    // queue was drawn at some point in the past, and what qualified then may
    // not qualify now.
    if (!plan.ready) {
      return res.status(400).json({ success: false, error: plan.blockedBy || 'That message cannot be forwarded.' })
    }
    if (!emailEnabled) {
      return res.status(503).json({ success: false, error: 'Email is not configured yet.' })
    }

    // markHeld: the owner has APPROVED it, so even a HELD build is marked —
    // re-offering it tomorrow would ask them the same question again. (The
    // auto path marks only real sends; see lib/forwardSend.js.)
    const r = await sendCarrierForward({ row, to: plan.to, reason: plan.reason, markHeld: true })
    if (r && r.invalid) {
      return res.status(400).json({ success: false, error: `That address was refused: ${r.reason}.` })
    }
    if (r && r.error) {
      return res.status(502).json({ success: false, error: 'The mail provider refused that.' })
    }
    return res.json({
      success: true,
      held: !!(r && r.held),
      redirected: !!(r && r.redirectedTo),
      sentTo: (r && (r.sentTo || r.redirectedTo)) || plan.to.email,
    })
  }

  return res.status(405).end()
}

export default withStaff(handler)
