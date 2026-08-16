// Pair an incoming carrier email to the SIM it is about. Pure — no I/O.
//
// THE KEY WAS ALREADY IN THE DATA. 734 of 797 SIMs carry the address their
// carrier account is registered under (`legacy_extras.email`), and 535 of those
// are plus-addressed — `gitt.bilig+moshe@gmail.com`, `shevabruches111+14@…`.
// Gmail delivers every `base+anything@gmail.com` to `base@gmail.com`, which is
// why all of it lands in one mailbox and why the recipient header is a genuine
// per-SIM identifier rather than a mailbox name.
//
// THE TAG IS THE WHOLE POINT — and it is the trap. mappers.normalizeEmail()
// strips `+tag`, which is right for sign-in identity (one human, one login) and
// catastrophic here: 253 different SIMs sit under `gitt.bilig`, and stripping
// the tag collapses all 253 into one. Hence a separate key function below.
// Dots ARE stripped, because Gmail ignores them and the shop has written the
// same account four ways (`red.far.bilig` / `redfarbilig`).
//
// Coverage on today's data:
//   417 SIMs  address is unique to that SIM        → paired by address alone
//   317 SIMs  share an address with other SIMs     → need the number too; the
//             biggest pool addresses carry 37, 31, 25, 23 and 16 SIMs each
//    63 SIMs  no address on record                 → number only
//
// So the rule is address first, number to disambiguate, and anything left over
// goes to a human rather than being guessed at.

const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com'])

/**
 * Routing key for an address: what Gmail actually delivers on, tag INTACT.
 * Accepts a bare address or a header form — `Gitt Bilig <gitt.bilig+m@…>`.
 * Returns null for anything that isn't an address.
 */
export function mailboxKey(raw) {
  let s = String(raw == null ? '' : raw).trim().toLowerCase()
  const angled = s.match(/<([^>]+)>/)          // display-name form
  if (angled) s = angled[1].trim()
  if (!s.includes('@')) return null
  const at = s.lastIndexOf('@')
  let local = s.slice(0, at)
  const domain = s.slice(at + 1)
  if (!local || !domain) return null
  const plus = local.indexOf('+')
  const tag = plus === -1 ? '' : local.slice(plus + 1)
  let base = plus === -1 ? local : local.slice(0, plus)
  // Dots are noise at Gmail, significant everywhere else.
  if (GMAIL_DOMAINS.has(domain)) base = base.replace(/\./g, '')
  if (!base) return null
  const d = GMAIL_DOMAINS.has(domain) ? 'gmail.com' : domain
  return tag ? `${base}+${tag}@${d}` : `${base}@${d}`
}

/**
 * UK mobiles anywhere in a piece of text, as last-10 digits — the same key the
 * app's SIM numbers are compared on, so 07…, +447…, 447… and 00447… all meet.
 */
export function ukMobilesIn(text) {
  const out = []
  const re = /(?:\+?44|0044|0)\s?7\d{3}\s?\d{3}\s?\d{3}/g
  let hit
  while ((hit = re.exec(String(text == null ? '' : text))) !== null) {
    const tail = hit[0].replace(/\D/g, '').slice(-10)
    if (tail.length === 10 && tail[0] === '7' && !out.includes(tail)) out.push(tail)
  }
  return out
}

/** Index the SIM list once, then match many messages against it. */
export function buildSimIndex(sims) {
  const byAddress = new Map()
  const byNumber = new Map()
  const push = (map, k, id) => {
    if (!k) return
    const at = map.get(k)
    if (at) { if (!at.includes(id)) at.push(id) } else map.set(k, [id])
  }
  for (const s of sims || []) {
    const id = String(s.id)
    push(byAddress, mailboxKey(s.email), id)
    const digits = String(s.simNumber || '').replace(/\D/g, '')
    if (digits.length >= 10) push(byNumber, digits.slice(-10), id)
  }
  return { byAddress, byNumber }
}

/**
 * Which SIM is this message about?
 *
 * `mail` is { to, deliveredTo, cc, subject, snippet } — all optional strings;
 * recipient fields may hold several addresses.
 *
 * Returns { simId, confidence, numbers, candidates }:
 *   'address'         one SIM registered at that address — the strong case
 *   'address+number'  a shared pool address, narrowed by the number in the text
 *   'number'          no address match, but the number is on the books
 *   'ambiguous'       a pool address and nothing in the text to narrow it
 *   'unknown'         nothing matched — `numbers` is the lead worth chasing,
 *                     this is where a SIM the shop never wrote down shows up
 *
 * simId is null for the last two. Guessing between candidates is deliberately
 * not done: a wrong pairing writes one customer's line onto another's account.
 */
export function matchSimForMail(mail, index) {
  const recipients = [mail?.deliveredTo, mail?.to, mail?.cc]
    .filter(Boolean).join(',').split(/[,;]/)
  const keys = [...new Set(recipients.map(mailboxKey).filter(Boolean))]

  const candidates = [...new Set(keys.flatMap((k) => index.byAddress.get(k) || []))]
  const numbers = ukMobilesIn(`${mail?.subject || ''} ${mail?.snippet || ''}`)

  if (candidates.length === 1) {
    return { simId: candidates[0], confidence: 'address', numbers, candidates }
  }
  if (candidates.length > 1) {
    const narrowed = candidates.filter((id) =>
      numbers.some((n) => (index.byNumber.get(n) || []).includes(id)))
    if (narrowed.length === 1) {
      return { simId: narrowed[0], confidence: 'address+number', numbers, candidates }
    }
    return { simId: null, confidence: 'ambiguous', numbers, candidates }
  }
  const byNum = [...new Set(numbers.flatMap((n) => index.byNumber.get(n) || []))]
  if (byNum.length === 1) {
    return { simId: byNum[0], confidence: 'number', numbers, candidates: byNum }
  }
  return { simId: null, confidence: byNum.length ? 'ambiguous' : 'unknown', numbers, candidates: byNum }
}
