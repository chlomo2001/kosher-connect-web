// The morning digest, finally with a way to arrive.
//
// E1 from the Epos Now read (docs/IDEAS-EPOSNOW-2026-08-21.md): their low-stock
// alert is PUSHED daily by email; KC computed the same kind of thing and waited
// on a badge to be noticed. The deciding half (lib/dailyDigest.mjs) and the
// rendering half (lib/digestEmail.mjs) have been built and tested since 21 Aug
// — this is the missing third piece, the one that reads the tasks and hands the
// result to the mail gate.
//
// THE SEND STAYS HOLD-GATED. sendEmail() answers to MAIL_LIVE exactly as it
// does for receipts: unset → the digest is built, logged as HELD, and nothing
// leaves. TEST mode redirects it to the tester. So wiring this changes what is
// POSSIBLE, not what HAPPENS — flipping it live remains the owner's move, in
// Vercel env, as CLAUDE.md requires. Two switches, both his:
//
//   DIGEST_TO   who the morning digest is addressed to. Unset → this endpoint
//               reports { skipped: 'no-recipient' } and touches nothing. It is
//               an env var, not a settings row, because it is deploy
//               configuration in the same sense as MAIL_LIVE — and this
//               endpoint must not grow a reason to write to the database.
//   MAIL_LIVE   the house-wide send gate, unchanged.
//
// Scheduled at 06:30, deliberately AFTER the 06:00 sweep: the sweep raises the
// morning's tasks (overdue rentals, renewals, passports), and a digest that ran
// first would describe yesterday.
import crypto from 'node:crypto'
import { db } from '../../../lib/db.js'
import { resolveStaff } from '../../../lib/auth.js'
import { sendEmail, emailEnabled } from '../../../lib/email.js'
import { buildDigest } from '../../../lib/dailyDigest.mjs'
import { digestEmail } from '../../../lib/digestEmail.mjs'
import { displayDate } from '../../../lib/localDay.mjs'

const localDate = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export default async function handler(req, res) {
  // Auth: Vercel Cron bearer OR a signed-in staff member — the sweep's own
  // pattern, timing-safe compare included. Cookie runs must POST (SameSite=Lax
  // rides on a cross-site GET; see the sweep's note).
  const cronSecret = (process.env.CRON_SECRET || '').trim()
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  const a = Buffer.from(bearer)
  const b = Buffer.from(cronSecret)
  const isCron = !!cronSecret && a.length === b.length && crypto.timingSafeEqual(a, b)
  if (!isCron && req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Run the digest with POST.' })
  }
  if (!isCron && !(await resolveStaff(req))) {
    return res.status(401).json({ success: false, error: 'Not authorised.' })
  }

  const to = (process.env.DIGEST_TO || '').trim()
  if (!to) return res.status(200).json({ success: true, skipped: 'no-recipient', hint: 'set DIGEST_TO in Vercel env' })
  if (!emailEnabled) return res.status(200).json({ success: true, skipped: 'email-not-configured' })

  const today = localDate()
  const { data: tasks, error } = await db.from('tasks')
    .select('title, priority, reference, due_date, created_at, customer_id, snoozed_until, done')
    .eq('done', false)
  if (error) return res.status(500).json({ success: false, error: error.message })

  const digest = buildDigest(tasks || [], { today })
  // A quiet morning sends nothing at all — a digest that arrives every day
  // saying "nothing today" trains its reader to ignore the one that matters.
  if (digest.quiet) return res.status(200).json({ success: true, quiet: true, sent: false })

  const { subject, html } = digestEmail(digest, { date: displayDate(today) })
  const sent = await sendEmail({ to, subject, html, kind: 'daily_digest' })
  return res.status(200).json({
    success: true,
    total: digest.total,
    urgent: digest.urgent,
    groups: digest.groups.length,
    // Whatever the gate decided is reported as it happened: held / redirected /
    // sent. Nothing here overrides it.
    ...sent,
  })
}
