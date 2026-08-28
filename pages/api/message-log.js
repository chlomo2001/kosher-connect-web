// The message log — every email and SMS the system BUILT, whatever happened
// to it (held by the safety gate, redirected to the test inbox, sent live,
// failed, bounced…). Read-only over email_log, which both lib/email.js and
// lib/sms.js write to, so this is the one audit trail for every channel.
// Read by the Messages inbox and by the Settings log; either tab grant opens
// it. It shows customer contact details in bulk, so it is never ungated.
import { withStaff, tabAllowedFor } from '../../lib/auth.js'
import { db, tablesMode } from '../../lib/db.js'
import { needsAnswer, isAnswered, unansweredThreads } from '../../lib/replyQueue.mjs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end()
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Needs the relational data layer.' })
  // Two screens read this: the Messages inbox, where answering a customer is
  // counter work, and the Settings log, which is the audit trail for every
  // channel. Either grant is enough — gating the inbox on Settings would mean
  // a helper trusted to answer the phone could not read the texts.
  const mayRead = (await tabAllowedFor(req.staff, 'messages'))
    || (await tabAllowedFor(req.staff, 'settings'))
  if (!mayRead) {
    return res.status(403).json({ success: false, error: 'Not permitted.' })
  }

  // ── "Seen it, nothing needed" ───────────────────────────────────────────
  //
  // Owner, 28 Aug: "sms recieved should have an option to ignore and not come
  // up as waiting anymore. like ive seen it, ok, nothing needed."
  //
  // Until now the ONLY way out of the waiting queue was a delivered reply, so
  // a text that wants no answer — an "ok", a thank-you, two pieces of referral
  // spam — sat there for ever and the red count on the sidebar lied a little
  // more each week. A count nobody can bring to zero is a count people stop
  // reading, which costs the one customer who is genuinely waiting.
  //
  // Deliberately its own status rather than a delete: the message stays in the
  // log, stays in the conversation, and stays readable. Only its claim on
  // somebody's attention is released.
  //
  // Only 'received' rows may be marked. A STOP is already out of the queue, an
  // outbound is not in it, and one already seen is a no-op — so a double press,
  // or two people pressing at once, changes nothing the second time.
  if (req.method === 'POST') {
    const { id, op } = req.body || {}
    if (op !== 'seen') return res.status(400).json({ success: false, error: 'Unknown action.' })
    if (!UUID.test(String(id || ''))) return res.status(400).json({ success: false, error: 'That message id is not one of ours.' })
    const rows = await db.update('email_log',
      `id=eq.${encodeURIComponent(String(id))}&kind=eq.sms_in&status=eq.received`,
      { status: 'seen' })
    if (!rows || !rows.length) {
      return res.status(400).json({ success: false, error: 'That message is not an unanswered text — nothing to mark.' })
    }
    return res.json({ success: true, id: rows[0].id })
  }

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 300)
  // The dashboard asks this on every paint and only wants the number. Reading
  // 300 log entries and their customer joins to answer "how many are waiting"
  // is the kind of cost that gets a useful count quietly removed later.
  const countOnly = req.query.countOnly === '1' || req.query.countOnly === 'true'
  try {
    if (countOnly) {
      const [inb, rep] = await Promise.all([
        db.select('email_log', 'select=id,kind,status,created_at,to_email&kind=eq.sms_in&limit=2000').catch(() => []),
        db.select('email_log', 'select=replies_to,status,delivery_status&replies_to=not.is.null&limit=2000').catch(() => []),
      ])
      // Per CONVERSATION, not per message. Answering somebody's latest text
      // answers them; the older ones stay in the thread and stop being a
      // summons. See lib/replyQueue.mjs — the old per-message count flagged a
      // thread nobody could clear, because the reply box answers the newest.
      const waiting = unansweredThreads(
        inb.map((r) => ({ id: r.id, kind: r.kind, status: r.status, at: r.created_at, to: r.to_email })),
        // delivery_status too: a reply the carrier refused leaves the customer
        // waiting, and without it the count says they were answered.
        rep.map((r) => ({ repliesTo: r.replies_to, status: r.status, deliveryStatus: r.delivery_status })),
      )
      return res.json({
        success: true,
        waiting: waiting.length,
        waitingSince: waiting.length ? waiting[0].at : null,
      })
    }
    const rows = await db.select('email_log',
      `select=id,created_at,kind,to_email,actual_to,subject,status,provider,error,replies_to,`
      + `delivery_status,delivered_at,delivery_error,customers(first_name,last_name)`
      + `&order=created_at.desc&limit=${limit}`)

    // Every reply ever recorded, not just the ones on this page. The log is
    // read newest-first with a limit, so an answer sent today and the question
    // it answers can easily fall on different pages — counting only what is on
    // screen would report an answered question as waiting, on a screen whose
    // whole job is to be trusted about that.
    const replyRows = await db.select('email_log',
      'select=id,replies_to,status,delivery_status&replies_to=not.is.null&limit=2000').catch(() => [])
    const replies = replyRows.map((r) => ({
      repliesTo: r.replies_to, status: r.status, deliveryStatus: r.delivery_status }))

    const entries = rows.map((r) => ({
      id: r.id,
      at: r.created_at,
      channel: r.provider === 'twilio' ? 'sms' : 'email',
      kind: r.kind || '',
      to: r.to_email,
      actualTo: r.actual_to || null,
      subject: r.subject || '',
      status: r.status,
      // Two different stories about one message, kept apart on purpose: status
      // is what WE did (built it, held it, handed it to Twilio) and delivery is
      // what the CARRIER did with it afterwards. Collapsing them would lose the
      // distinction the whole /api/sms-status callback exists to record.
      deliveryStatus: r.delivery_status || null,
      deliveredAt: r.delivered_at || null,
      deliveryError: r.delivery_error || null,
      error: r.error || null,
      repliesTo: r.replies_to || null,
      customerName: r.customers
        ? `${r.customers.first_name || ''} ${r.customers.last_name || ''}`.trim()
        : null,
    }))
    for (const e of entries) {
      e.awaitingAnswer = needsAnswer(e) && !isAnswered(e, replies)
    }

    // The count is over the WHOLE log, not this page, for the same reason.
    const allInbound = await db.select('email_log',
      'select=id,kind,status,created_at,to_email&kind=eq.sms_in&limit=2000').catch(() => [])
    const waiting = unansweredThreads(
      allInbound.map((r) => ({ id: r.id, kind: r.kind, status: r.status, at: r.created_at, to: r.to_email })),
      replies,
    )

    return res.json({
      success: true,
      entries,
      waiting: waiting.length,
      // The oldest one, so a screen can say how long somebody has been ignored
      // rather than only how many are.
      waitingSince: waiting.length ? waiting[0].at : null,
    })
  } catch (e) {
    console.error('[api/message-log]', e)
    return res.status(502).json({ success: false, error: 'Could not read the message log.' })
  }
}

export default withStaff(handler)
