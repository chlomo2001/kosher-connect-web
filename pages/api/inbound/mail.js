// Inbound carrier email → the SIM it is about.
//
// Forward Email delivers here. The shop mailbox auto-forwards everything to an
// alias on kosher-connect.com whose recipient is this URL, so a Lebara renewal
// notice reaches the app the moment it arrives — no polling, no Gmail OAuth,
// and nothing to re-authorise every seven days (which is exactly what killed
// the July sweep).
//
// The pairing key is the ORIGINAL recipient. 535 SIMs are registered at a
// plus-addressed Gmail (`gitt.bilig+moshe@gmail.com`) and Gmail funnels the lot
// into one mailbox, so that address names a single SIM. lib/inboundMail drops
// the kosher-connect.com hop before matching — it appears on every message and
// would otherwise match everything to nothing.
//
// Anything that cannot be paired with certainty is STORED, not guessed at and
// not dropped: 'ambiguous' (a pool address, nothing to narrow it) and 'unknown'
// (a number live at a carrier that the app has never heard of — the July sweep
// found 241 of those) both land in sim_mail for the daily sweep to raise.
//
// Auth: a shared secret in the webhook URL (?key=…) or as the Basic-auth
// password, compared timing-safely. Forward Email cannot sign requests for us,
// so the secret in the URL is the whole gate — it lives in Vercel env as
// INBOUND_MAIL_SECRET and nowhere else.

import crypto from 'node:crypto'
import { db, tablesMode, selectAllPaged } from '../../../lib/db.js'
import { normaliseInbound, carrierOf } from '../../../lib/inboundMail.mjs'
import { buildSimIndex, matchSimForMail } from '../../../lib/simMailMatch.mjs'

// Bodies are parsed mail, not attachments — but a forwarded message with an
// inline image can still be chunky, and a 413 would make Forward Email retry
// forever.
export const config = { api: { bodyParser: { sizeLimit: '4mb' } } }

const HOP_DOMAIN = (process.env.MAIL_DOMAIN || 'kosher-connect.com').trim().toLowerCase()

function secretOk(req) {
  const want = (process.env.INBOUND_MAIL_SECRET || '').trim()
  if (!want) return false // fail closed: no secret configured, no ingest
  const fromQuery = String(req.query?.key || '')
  let fromBasic = ''
  const auth = req.headers.authorization || ''
  if (/^Basic\s+/i.test(auth)) {
    const decoded = Buffer.from(auth.replace(/^Basic\s+/i, ''), 'base64').toString('utf8')
    fromBasic = decoded.slice(decoded.indexOf(':') + 1)
  }
  return [fromQuery, fromBasic].some((given) => {
    const a = Buffer.from(String(given))
    const b = Buffer.from(want)
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  })
}

// The SIM index costs a full read of sims (797 rows today). Cached briefly so a
// burst of carrier mail doesn't re-read it per message; short enough that a SIM
// added at the counter starts pairing within the minute.
let cache = { at: 0, index: null }
const INDEX_TTL_MS = 60_000

async function simIndex() {
  if (cache.index && Date.now() - cache.at < INDEX_TTL_MS) return cache.index
  const rows = await selectAllPaged('sims', 'id,customer_id,legacy_extras', 'order=id.asc')
  const index = buildSimIndex(rows.map((r) => ({
    id: r.id,
    email: r.legacy_extras?.email || '',
    simNumber: r.legacy_extras?.simNumber || '',
  })))
  index.customerBySim = new Map(rows.map((r) => [String(r.id), r.customer_id]))
  cache = { at: Date.now(), index }
  return index
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only.' })
  if (!secretOk(req)) return res.status(401).json({ ok: false, error: 'Bad or missing key.' })
  if (!tablesMode) return res.status(503).json({ ok: false, error: 'Storage unavailable.' })

  try {
    const payload = req.body && typeof req.body === 'object' ? req.body : {}
    const mail = normaliseInbound(payload, { hopDomain: HOP_DOMAIN })

    // A payload we could read nothing out of is a shape we don't handle yet.
    // Log the keys — a silent 200 here would look like a working integration
    // that quietly files nothing.
    if (!mail.recipients.length && !mail.subject && !mail.snippet) {
      console.warn('[inbound/mail] unreadable payload, top-level keys:',
        Object.keys(payload).join(',') || '(none)')
    }

    const index = await simIndex()
    const match = matchSimForMail({
      to: mail.recipients.join(','),
      subject: mail.subject,
      snippet: mail.snippet,
    }, index)

    const inserted = await db.insertIgnoreDup('sim_mail', [{
      message_id: mail.messageId,
      ...(mail.receivedAt ? { received_at: mail.receivedAt } : {}),
      // The address that identified the SIM, not whichever hop happened to be
      // first on the envelope — see matchSimForMail. With the shop's mailboxes
      // forwarding into one business-only inbox, recipients[0] is the hub on
      // every single message, which tells a human nothing.
      recipient: match.matchedOn || mail.recipients[0] || null,
      from_address: mail.from || null,
      carrier: carrierOf(mail.from),
      subject: mail.subject || null,
      snippet: mail.snippet || null,
      confidence: match.confidence,
      numbers: match.numbers,
      sim_id: match.simId,
      customer_id: match.simId ? index.customerBySim.get(String(match.simId)) || null : null,
    }], 'message_id')

    // 200 on a duplicate too: a retry is not an error, and a non-2xx would have
    // Forward Email redeliver it indefinitely.
    return res.json({
      ok: true,
      stored: inserted.length > 0,
      duplicate: inserted.length === 0,
      confidence: match.confidence,
      paired: !!match.simId,
    })
  } catch (e) {
    console.error('[inbound/mail]', e)
    // 500 so Forward Email retries — a storage blip should not lose the message.
    return res.status(500).json({ ok: false, error: 'Could not file that message.' })
  }
}
