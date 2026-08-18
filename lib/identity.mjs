// Which key means "the same" — stated once (port item A2, 18 Aug 2026).
//
// KC already carried three email normalisers and two phone ones, each grown
// for its own corner. This module is the statement of which key answers which
// question, built ON the ones that are right rather than minting a fourth:
//
//   mailboxKey (simMailMatch.mjs) — "which mailbox does this deliver to?"
//     The +tag is KEPT: at this shop a tag names a SIM
//     (shevabruches111+s9@gmail.com IS the routing). Gmail dots dropped,
//     googlemail folded into gmail; dots elsewhere are significant and stay.
//   personKey (here) — "is this the same human?" mailboxKey minus the tag.
//     The tag must NOT survive into person identity, or one customer with
//     nine SIM tags becomes nine people. The dot rule is Gmail-ONLY, unlike
//     mappers.js normalizeEmail which strips dots everywhere — a rule that
//     would merge two genuinely different addresses at another provider.
//   phoneKey (ukPhone.mjs) — "is this the same line?" Canonicalise
//     (07… / +447… / 00447… → +44…) then digits. The brief said last-9;
//     KC canonicalises the WHOLE number instead, which the SIM-mail matcher
//     is already built on, keeps Israeli numbers distinct, and cannot
//     collide two countries' tails. Written down here so nobody "fixes" it
//     to a tail later.
//   nameKey (here) — "could this be the same written name?" Sorted tokens,
//     case- and punctuation-blind, so "Grunfeld Mordche" meets
//     "Mordche Grunfeld" — transliterated Hebrew names swap order constantly.
//     It does NOT bridge spelling variants (Mordche/Mordechai): claiming that
//     is a matcher's job with a human confirming, not a key's.
//
// SQL later, deliberately. These keys are pure so they can become stored
// generated columns (customers.person_key, phone_key, name_key) with indexes,
// and matching moves into the database. findDuplicates below exists for tests
// and small batches — it is NOT wired to a live scan over the whole table,
// per the port plan; the existing 👥 Duplicates tool keeps its own path until
// the columns land.

import { phoneKey } from './ukPhone.mjs'
import { mailboxKey } from './simMailMatch.mjs'

export { phoneKey, mailboxKey }

/** Same human, whatever tag their address carried. Null when not an address. */
export function personKey(raw) {
  const k = mailboxKey(raw)
  if (!k) return null
  const at = k.lastIndexOf('@')
  const plus = k.indexOf('+')
  return plus !== -1 && plus < at ? k.slice(0, plus) + k.slice(at) : k
}

/** Order-, case- and punctuation-blind name key. '' when nothing is left. */
export function nameKey(raw) {
  const tokens = String(raw == null ? '' : raw)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')          // é → e; Hebrew points drop too
    .match(/[\p{L}\p{N}]+/gu) || []
  return tokens.sort().join(' ')
}

/**
 * Likely-duplicate pairs with a confidence and the reasons, key-bucketed so
 * it never goes O(n²). Customers: {id, firstName, lastName, name?, phone,
 * altPhone?, email}. Returns [{aId, bId, confidence, reasons}].
 *
 * Confidence is shaped for THIS community, not scraped from the brief:
 *   'high'   — two or more independent signals agree.
 *   'medium' — one contact signal (phone or email). A shared phone is NOT
 *              proof here: one family phone serving several real customers
 *              is everyday reality at the counter, and email accounts are
 *              shared the same way. Medium means "look", never "merge".
 *   'low'    — the written name alone. Same-name strangers are routine in a
 *              community drawing on one pool of names.
 */
export function findDuplicates(customers = []) {
  const buckets = new Map()   // signalKey → [customer ids]
  const byId = new Map()
  const add = (key, id) => {
    if (!key) return
    const list = buckets.get(key) || []
    if (!list.includes(id)) { list.push(id); buckets.set(key, list) }
  }

  for (const c of customers) {
    const id = String(c.id ?? '')
    if (!id) continue
    byId.set(id, c)
    const name = c.name || `${c.firstName || ''} ${c.lastName || ''}`
    const nk = nameKey(name)
    if (nk) add(`n:${nk}`, id)
    const pk = personKey(c.email)
    if (pk) add(`e:${pk}`, id)
    for (const ph of [c.phone, c.altPhone]) {
      const key = phoneKey(ph || '')
      if (key && key.replace(/\D/g, '').length >= 9) add(`p:${key}`, id)
    }
  }

  const pairSignals = new Map()   // "a|b" (sorted) → Set of signal kinds
  for (const [key, ids] of buckets) {
    if (ids.length < 2) continue
    const kind = key[0]           // n / e / p
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const pair = [ids[i], ids[j]].sort().join('|')
        const set = pairSignals.get(pair) || new Set()
        set.add(kind)
        pairSignals.set(pair, set)
      }
    }
  }

  const REASON = {
    p: 'same phone number',
    e: 'same email (person key — tag and Gmail dots ignored)',
    n: 'same name (word order ignored)',
  }
  const out = []
  for (const [pair, kinds] of pairSignals) {
    const [aId, bId] = pair.split('|')
    const reasons = [...kinds].sort().map(k => REASON[k])
    const confidence = kinds.size >= 2 ? 'high' : kinds.has('n') ? 'low' : 'medium'
    out.push({ aId, bId, confidence, reasons })
  }
  const rank = { high: 0, medium: 1, low: 2 }
  return out.sort((a, b) => rank[a.confidence] - rank[b.confidence] || a.aId.localeCompare(b.aId))
}
