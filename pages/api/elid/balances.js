// Live ELID balances, a page at a time — owner-only, read-only.
//
// There are 146 seeded ELID accounts and each balance is its own upstream call,
// so reading them all in one request would sit on ELID for the best part of a
// minute and lose the race with the function timeout. The caller asks for a
// slice instead (offset/limit) and fills the list in as the answers arrive,
// which also means a slow or flaky ELID degrades into "42 of 146 read" rather
// than one failed request with nothing to show.
//
// Nothing is stored. This is the live figure at the moment you asked, which is
// what a credit balance is for; a cached one would be a number that looks
// current and isn't.
import { withStaff } from '../../../lib/auth.js'
import { ELID_ACCOUNTS, elidIsInternal } from '../../../lib/elidAccounts.js'
import { elidEnabled, elidBalance } from '../../../lib/elid.js'

// Small enough to stay well inside the function timeout even when ELID is slow,
// big enough that the whole roster is four presses rather than fifteen.
const PAGE = 40
// ELID is someone else's box and this is a background curiosity, not a customer
// waiting at the counter. Eight at a time is brisk without being a hammer.
const CONCURRENCY = 8

async function pool(items, size, fn) {
  const out = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    for (;;) {
      const i = next++
      if (i >= items.length) return
      out[i] = await fn(items[i], i)
    }
  }))
  return out
}

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  if (req.staff?.role !== 'owner') return res.status(403).json({ success: false, error: 'Owner only.' })
  if (!elidEnabled) return res.status(503).json({ success: false, error: 'ELID isn’t configured.' })

  const total = ELID_ACCOUNTS.length
  const offset = Math.max(0, Math.min(total, parseInt(req.query.offset, 10) || 0))
  const limit = Math.max(1, Math.min(PAGE, parseInt(req.query.limit, 10) || PAGE))
  const slice = ELID_ACCOUNTS.slice(offset, offset + limit)

  const accounts = await pool(slice, CONCURRENCY, async (username) => {
    const r = await elidBalance(username)
    return {
      username,
      internal: elidIsInternal(username),
      // A failed read is reported as a failed read, never as a zero balance —
      // "£0.00" and "we couldn't ask" are very different things to look at.
      balance: r.ok ? r.balance : null,
      error: r.ok ? null : (r.error || 'read failed'),
    }
  })

  return res.json({
    success: true,
    total,
    offset,
    nextOffset: offset + slice.length < total ? offset + slice.length : null,
    accounts,
  })
}

export default withStaff(handler)
