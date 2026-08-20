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
 * The `+tag` part of an address, or '' when there isn't one.
 *
 * On this shop's data the tag is usually the CUSTOMER: mail nobody could file
 * arrived at gitt.bilig+sidner@, +tchinagel@, +z.e.fried@, +ymshechter@. The
 * tag is not evidence — +v7@ and +2@ name nobody, and +rapaport1@ names eight
 * different people — so nothing is ever filed on it. It is worth exactly one
 * thing: typing the likely search into the box for whoever has to decide.
 */
export function addressTag(raw) {
  const key = mailboxKey(raw)
  if (!key) return ''
  const local = key.slice(0, key.lastIndexOf('@'))
  const plus = local.indexOf('+')
  return plus === -1 ? '' : local.slice(plus + 1)
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

/**
 * One `sims` row → the shape buildSimIndex wants.
 *
 * SHARED because it was written out three times — inbound/mail.js, sim-mail.js
 * and cron/sweep.js each built this object, and each one had to remember the
 * same list of places a SIM's addresses can live. They agreed only by everyone
 * copying the last one. The sweep's own comment says why that matters: reach a
 * different answer from the screen and it re-opens settled questions.
 *
 * THE MASTER ACCOUNT EMAIL IS ONE OF THOSE PLACES, and it was not on the list.
 * `master_accounts.account_email` is the carrier login a group of SIMs sits
 * under — 10 SIMs today, all Three — and for three of them it is a DIFFERENT
 * address from the one in the blob: the blob holds a pooled mailbox
 * (gittb.i.lig@, 253 SIMs) while the master account holds the one that names
 * the line. Twenty-two messages were sitting unresolved on 21 Aug at an address
 * the shop had written down, in a column nothing read.
 *
 * It goes in as an alsoknown-as rather than replacing anything: the primary
 * address stays the one shown on the SIM, and both index to the same line.
 *
 * Pass the row with `master_accounts(account_email)` embedded. Missing embed,
 * null FK and PostgREST's two shapes (object for to-one, array if it decides
 * otherwise) all resolve to no extra address rather than to a crash — a
 * matcher that throws files nothing at all.
 */
export function simMatchRow(row) {
  const extras = (row && row.legacy_extras) || {}
  const alt = Array.isArray(row && row.alt_emails) ? [...row.alt_emails] : []
  const ma = row && row.master_accounts
  const maEmail = (Array.isArray(ma) ? (ma[0] && ma[0].account_email) : (ma && ma.account_email)) || ''
  if (maEmail && !alt.some((a) => mailboxKey(a) === mailboxKey(maEmail))) alt.push(maEmail)
  return {
    id: row && row.id,
    email: extras.email || '',
    altEmails: alt,
    simNumber: extras.simNumber || '',
  }
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
    // One line can receive its carrier mail at more than one address. The shop
    // gives a customer's SIM a tagged address per carrier account, so mail for
    // the same phone arrives at gitt.bilig+a12@ from one carrier and
    // gitt.bilig+sidner@ from another — and until 19 Aug a SIM could claim only
    // the first, so the second could never be paired to anything.
    //
    // The primary address stays first and stays the one shown; the rest are
    // alsoknown-as. Every one of them indexes to the same SIM, so which address
    // a message happened to arrive at stops mattering.
    for (const addr of [s.email, ...(Array.isArray(s.altEmails) ? s.altEmails : [])]) {
      push(byAddress, mailboxKey(addr), id)
    }
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
  // key → the address AS WRITTEN, for anything a person will read. The key has
  // Gmail's dots stripped, which is right for identity and looks like a typo
  // on screen: gittbilig+moshe@ is not how anyone typed it.
  const asWritten = new Map()
  for (const r of recipients) {
    const k = mailboxKey(r)
    if (k && !asWritten.has(k)) {
      const angled = String(r).match(/<([^>]+)>/)
      asWritten.set(k, (angled ? angled[1] : r).trim().toLowerCase())
    }
  }
  const keys = [...asWritten.keys()]

  // THE NARROWEST ADDRESS WINS — do not pool them.
  //
  // This used to union the candidates from every recipient, and that quietly
  // broke the moment the shop's mailboxes started forwarding into one inbox.
  // A renewal notice arrives carrying BOTH the address that names one SIM and
  // the mailbox it was forwarded through:
  //
  //     shevabruches111+s9@gmail.com   1 SIM   ← the answer
  //     gitt.bilig@gmail.com         308 SIMs  ← the postbox it passed through
  //
  // Unioning those gives 309 candidates and a verdict of 'ambiguous' on a
  // message whose answer was sitting right there in the first line. Three real
  // messages were in the queue like that on 18 Aug, each one already solved.
  //
  // So each recipient is scored on how narrowly it identifies a SIM, and only
  // the narrowest is used. Ties are kept honest: two addresses that each name
  // ONE SIM but not the SAME SIM stay ambiguous rather than picking a winner
  // by header order.
  const scored = keys
    .map((k) => ({ k, ids: index.byAddress.get(k) || [] }))
    .filter((x) => x.ids.length)
    .sort((a, b) => a.ids.length - b.ids.length)
  const narrowest = scored.length ? scored[0].ids.length : 0
  const tied = scored.filter((x) => x.ids.length === narrowest)
  const candidates = [...new Set(tied.flatMap((x) => x.ids))]
  // SUBJECT, SNIPPET **AND BODY**.
  //
  // It read the first two only, and for an HTML-only email the snippet is the
  // <style> block — five hundred characters of CSS. So a Lebara auto-renew
  // reminder whose body says "Mobile Number: 07…" twice was filed as ambiguous
  // and put in front of a person with thirteen SIMs to choose between, while
  // the answer sat in the text nobody looked at. giffgaff worked only because
  // it puts the number in the SUBJECT line.
  const numbers = ukMobilesIn(`${mail?.subject || ''} ${mail?.snippet || ''} ${mail?.text || ''}`)

  // WHICH address did the work — not merely the first one on the envelope.
  //
  // A message can reach the app through two hops now: the shop's mailboxes
  // forward to one business-only inbox, and that forwards here. So a Lebara
  // renewal arrives carrying `Delivered-To: <the hub>` AND `To:
  // gitt.bilig+moshe@gmail.com`, and it is the second that identifies the SIM.
  // Matching was always fine — every recipient is looked up, and a hub address
  // no SIM is registered at simply contributes nothing. The DISPLAY was not:
  // storing recipients[0] meant every row in the queue read "sent to <the
  // hub>", which is the one fact that cannot help a person settle an ambiguous
  // one. So the matching key is reported back, and that is what gets stored.
  // …and the address REPORTED is the one that did the work, which is now the
  // narrowest rather than merely the first on the envelope.
  const matchedKey = scored.length ? scored[0].k : null;
  const matchedOn = matchedKey ? (asWritten.get(matchedKey) || matchedKey) : null;

  if (candidates.length === 1) {
    return { simId: candidates[0], confidence: 'address', numbers, candidates, matchedOn }
  }
  if (candidates.length > 1) {
    const narrowed = candidates.filter((id) =>
      numbers.some((n) => (index.byNumber.get(n) || []).includes(id)))
    if (narrowed.length === 1) {
      return { simId: narrowed[0], confidence: 'address+number', numbers, candidates, matchedOn }
    }
    return { simId: null, confidence: 'ambiguous', numbers, candidates, matchedOn }
  }
  const byNum = [...new Set(numbers.flatMap((n) => index.byNumber.get(n) || []))]
  if (byNum.length === 1) {
    return { simId: byNum[0], confidence: 'number', numbers, candidates: byNum, matchedOn }
  }
  return { simId: null, confidence: byNum.length ? 'ambiguous' : 'unknown', numbers, candidates: byNum, matchedOn }
}
