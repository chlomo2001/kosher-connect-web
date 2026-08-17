// Does this customer answer to what was typed? One predicate, three callers.
//
// The Customers tab, the customer picker and the command palette each grew
// their own version of "does this person match", which is how the same query
// came to find someone in one box and not in the next. This is the one they
// all use now.
//
// The part that is not obvious: **a merged-away spelling still has to find
// him.** When two records of one man are merged, the losing spelling is kept
// on the survivor as `aka` — Shmuel Bleier was also filed as "Shmiel Y
// Bleier", and the shop had been typing "Shmiel" for a year. Search that only
// reads the surviving name makes the old spelling a dead end, which is a
// worse outcome than the duplicate was.
//
// Pure — no I/O, no DOM. Mirrored into public/main.js; test/customerSearch
// lifts that copy and compares the two.

/**
 * Phone search that survives formatting: "07871 385566" must find a customer
 * stored as "+44 7871385566". Engages only when the query holds 3+ digits.
 */
export function phoneDigitsMatch(query, customer) {
  const qd = String(query == null ? '' : query).replace(/\D/g, '')
  if (qd.length < 3 || !customer) return false
  const hay = String(customer.phone || '').replace(/\D/g, '')
  if (!hay) return false
  if (hay.includes(qd)) return true
  return qd.startsWith('0') && hay.includes('44' + qd.slice(1))
}

/** Every name this person is filed under — the current one first. */
export function customerNames(c) {
  const out = [`${c?.firstName || ''} ${c?.lastName || ''}`.trim()]
  const aka = c?.aka
  for (const n of (Array.isArray(aka) ? aka : aka ? [aka] : [])) {
    const v = String(n || '').trim()
    if (v && !out.some((x) => x.toLowerCase() === v.toLowerCase())) out.push(v)
  }
  return out.filter(Boolean)
}

/**
 * The one match. `query` is what was typed; matching is case-insensitive and
 * substring, on any name the person is filed under, their email, or their
 * number in any formatting.
 */
export function customerMatches(query, c) {
  const q = String(query == null ? '' : query).toLowerCase().trim()
  if (!q) return true
  if (!c) return false
  if (customerNames(c).some((n) => n.toLowerCase().includes(q))) return true
  if (String(c.email || '').toLowerCase().includes(q)) return true
  return phoneDigitsMatch(q, c)
}
