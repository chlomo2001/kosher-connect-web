// The message log — every email and SMS the system BUILT, whatever happened
// to it (held by the safety gate, redirected to the test inbox, sent live,
// failed, bounced…). Read-only over email_log, which both lib/email.js and
// lib/sms.js write to, so this is the one audit trail for every channel.
// Read by the Messages inbox and by the Settings log; either tab grant opens
// it. It shows customer contact details in bulk, so it is never ungated.
import { withStaff, tabAllowedFor } from '../../lib/auth.js'
import { db, tablesMode } from '../../lib/db.js'
import { needsAnswer, isAnswered, unanswered } from '../../lib/replyQueue.mjs'

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
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

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 300)
  // The dashboard asks this on every paint and only wants the number. Reading
  // 300 log entries and their customer joins to answer "how many are waiting"
  // is the kind of cost that gets a useful count quietly removed later.
  const countOnly = req.query.countOnly === '1' || req.query.countOnly === 'true'
  try {
    if (countOnly) {
      const [inb, rep] = await Promise.all([
        db.select('email_log', 'select=id,kind,status,created_at&kind=eq.sms_in&limit=2000').catch(() => []),
        db.select('email_log', 'select=replies_to,status&replies_to=not.is.null&limit=2000').catch(() => []),
      ])
      const waiting = unanswered(
        inb.map((r) => ({ id: r.id, kind: r.kind, status: r.status, at: r.created_at })),
        rep.map((r) => ({ repliesTo: r.replies_to, status: r.status })),
      )
      return res.json({
        success: true,
        waiting: waiting.length,
        waitingSince: waiting.length ? waiting[0].at : null,
      })
    }
    const rows = await db.select('email_log',
      `select=id,created_at,kind,to_email,actual_to,subject,status,provider,error,replies_to,customers(first_name,last_name)`
      + `&order=created_at.desc&limit=${limit}`)

    // Every reply ever recorded, not just the ones on this page. The log is
    // read newest-first with a limit, so an answer sent today and the question
    // it answers can easily fall on different pages — counting only what is on
    // screen would report an answered question as waiting, on a screen whose
    // whole job is to be trusted about that.
    const replyRows = await db.select('email_log',
      'select=id,replies_to,status&replies_to=not.is.null&limit=2000').catch(() => [])
    const replies = replyRows.map((r) => ({ repliesTo: r.replies_to, status: r.status }))

    const entries = rows.map((r) => ({
      id: r.id,
      at: r.created_at,
      channel: r.provider === 'twilio' ? 'sms' : 'email',
      kind: r.kind || '',
      to: r.to_email,
      actualTo: r.actual_to || null,
      subject: r.subject || '',
      status: r.status,
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
      'select=id,kind,status,created_at&kind=eq.sms_in&limit=2000').catch(() => [])
    const waiting = unanswered(
      allInbound.map((r) => ({ id: r.id, kind: r.kind, status: r.status, at: r.created_at })),
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
