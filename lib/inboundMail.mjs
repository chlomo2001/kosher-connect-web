// Normalise an inbound webhook payload into the few fields pairing needs.
// Pure — no I/O.
//
// Written shape-agnostic on purpose. Forward Email posts a parsed message, but
// the exact nesting is theirs to change and their docs are not reachable from
// this environment to pin down; a rigid reader would break silently on the
// first payload that nests `to` one level deeper. So every field is read
// through a tolerant accessor that accepts the shapes a mail parser can
// plausibly produce:
//
//     to: 'a@b.com'
//     to: ['a@b.com', 'c@d.com']
//     to: { text: 'A <a@b.com>, c@d.com' }
//     to: { value: [{ address: 'a@b.com', name: 'A' }] }
//     headers: { to: '…', 'delivered-to': '…' }
//
// If a payload arrives in a shape none of these cover, the endpoint logs the
// top-level keys so the gap is visible rather than mysterious.

const MAX_SNIPPET = 600

/** Every address in a header value, whatever shape it arrived in. */
export function addressesOf(field) {
  if (!field) return []
  if (typeof field === 'string') return splitAddresses(field)
  if (Array.isArray(field)) return field.flatMap(addressesOf)
  if (typeof field === 'object') {
    if (typeof field.address === 'string') return [field.address.trim()]
    if (Array.isArray(field.value)) return field.value.flatMap(addressesOf)
    if (typeof field.text === 'string') return splitAddresses(field.text)
  }
  return []
}

// SPACES SEPARATE ADDRESSES TOO, and that is not a nicety.
//
// This split on commas and semicolons only. A `Delivered-To` arriving as
// `5311386k@gmail.com sims-in@kosher-connect.com` — two hops, one space — came
// back as a SINGLE 'address' containing a space. It has an `@`, so it passed
// the filter; it ENDS in the hop domain, so pairableRecipients dropped the
// whole thing, and the per-SIM address in front of the space went in the bin
// with it. 27 messages in the queue reached the matcher with no pairable
// address at all and were filed against the pooled postbox they passed
// through.
//
// A display name has spaces too — `Gitt Bilig <gitt.bilig+m@…>` — so the
// whitespace split only applies to a part with no angle brackets in it.
function splitAddresses(s) {
  return String(s)
    .split(/[,;]/)
    .flatMap((part) => (part.includes('<') ? [part] : part.trim().split(/\s+/)))
    .map((part) => {
      const angled = part.match(/<([^>]+)>/)
      return (angled ? angled[1] : part).trim()
    })
    .filter((a) => a.includes('@'))
}

// Case-insensitive lookup across the payload and its headers object, so
// `Delivered-To`, `delivered-to` and `deliveredTo` are all the same field.
function pick(payload, names) {
  const headers = payload?.headers && typeof payload.headers === 'object' ? payload.headers : {}
  const pools = [payload, headers]
  for (const name of names) {
    const want = name.toLowerCase().replace(/[^a-z]/g, '')
    for (const pool of pools) {
      for (const key of Object.keys(pool || {})) {
        if (key.toLowerCase().replace(/[^a-z]/g, '') === want) {
          const v = pool[key]
          if (v !== undefined && v !== null && v !== '') return v
        }
      }
    }
  }
  return undefined
}

const collapse = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim()

/**
 * The recipient addresses a message could be paired on, HOP EXCLUDED.
 *
 * This is the subtle part. The mail is addressed to `gitt.bilig+moshe@
 * gmail.com`, then forwarded through `something@kosher-connect.com` to get
 * here. The forwarding address appears in the recipient headers too — and it is
 * the same on every single message, so pairing on it would match everything to
 * nothing. Anything on the shop's own mail domain is therefore dropped before
 * matching: the original per-SIM address is what survives.
 */
export function pairableRecipients(payload, hopDomain) {
  const hop = String(hopDomain || '').trim().toLowerCase()
  const raw = [
    ...addressesOf(pick(payload, ['deliveredTo', 'delivered-to'])),
    ...addressesOf(pick(payload, ['to'])),
    ...addressesOf(pick(payload, ['cc'])),
    ...addressesOf(pick(payload, ['xForwardedTo', 'x-forwarded-to'])),
  ]
  const seen = new Set()
  const out = []
  for (const a of raw) {
    const addr = a.trim().toLowerCase()
    if (!addr.includes('@') || seen.has(addr)) continue
    seen.add(addr)
    if (hop && addr.endsWith(`@${hop}`)) continue
    out.push(addr)
  }
  return out
}

/** Body text, whichever field carries it, trimmed to a readable snippet. */
export function snippetOf(payload) {
  const text = pick(payload, ['text', 'textAsHtml', 'plain', 'body'])
  if (typeof text === 'string' && text.trim()) return collapse(text).slice(0, MAX_SNIPPET)
  const html = pick(payload, ['html'])
  if (typeof html === 'string' && html.trim()) {
    // Strip <style> and <script> CONTENTS, not merely their tags. Removing tags
    // alone leaves the stylesheet as text, and a marketing email opens with
    // hundreds of characters of it — so every Lebara message in the carrier
    // queue had a snippet reading "* { box-sizing: border-box; } body { margin:
    // 0 }" instead of a word of the message. bodyTextOf has always done this;
    // this one did not, and it is the half the matcher reads.
    return collapse(html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, ' '))
      .slice(0, MAX_SNIPPET)
  }
  return ''
}

/**
 * The message body at readable length, LINE BREAKS KEPT.
 *
 * `snippetOf` collapses whitespace and stops at 600 characters, which is right
 * for "what did this carrier say" and useless for reading a ticket: an
 * itinerary is a layout, and the parser leans on lines — a passenger list ends
 * where the blank line is, a time belongs to the leg printed above it. So this
 * is the same text, unflattened and much longer.
 *
 * Blank lines are squeezed and trailing spaces dropped, because an HTML mail
 * converted to text is mostly empty rows and they push the interesting part
 * past the cap.
 */
export function bodyTextOf(payload, max = 20000) {
  const text = pick(payload, ['text', 'plain', 'body'])
  let out = typeof text === 'string' && text.trim() ? text : ''
  if (!out) {
    const html = pick(payload, ['html', 'textAsHtml'])
    if (typeof html === 'string' && html.trim()) {
      out = html
        .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|tr|li|h\d|table)>/gi, '\n')
        .replace(/<td[^>]*>/gi, '\t')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    }
  }
  return out
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max)
}

/**
 * Payload → { messageId, recipients, from, subject, snippet, text, receivedAt }.
 *
 * messageId falls back to a deterministic composite when the payload has no
 * Message-Id: the unique index on it is what makes redelivery safe, so it must
 * never be empty and never be random.
 */
/**
 * EVERY recipient the message arrived with, hops included — the route it took.
 *
 * pairableRecipients deliberately throws the hops away, because pairing on one
 * would match everything to nothing. But the hops are the only evidence of HOW
 * a message reached the app, and with the shop's seven mailboxes forwarding
 * into one hub and the hub forwarding here, that is a live question: a message
 * that came the long way carries the hub in this list, a direct one does not.
 */
export function deliveryRoute(payload) {
  const raw = [
    ...addressesOf(pick(payload, ['deliveredTo', 'delivered-to'])),
    ...addressesOf(pick(payload, ['to'])),
    ...addressesOf(pick(payload, ['cc'])),
    ...addressesOf(pick(payload, ['xForwardedTo', 'x-forwarded-to'])),
    ...addressesOf(pick(payload, ['xForwardedFor', 'x-forwarded-for'])),
  ]
  const seen = new Set()
  const out = []
  for (const a of raw) {
    const addr = a.trim().toLowerCase()
    if (!addr.includes('@') || seen.has(addr)) continue
    seen.add(addr)
    out.push(addr)
  }
  return out
}

export function normaliseInbound(payload, { hopDomain } = {}) {
  const recipients = pairableRecipients(payload, hopDomain)
  const route = deliveryRoute(payload)
  const from = addressesOf(pick(payload, ['from']))[0] || ''
  const subject = collapse(pick(payload, ['subject'])).slice(0, 500)
  const snippet = snippetOf(payload)
  const text = bodyTextOf(payload)
  const dateRaw = pick(payload, ['date', 'receivedAt'])
  const parsed = dateRaw ? new Date(dateRaw) : null
  const receivedAt = parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : null

  let messageId = collapse(pick(payload, ['messageId', 'message-id'])).replace(/^<|>$/g, '')
  if (!messageId) messageId = `no-id:${from}:${recipients[0] || ''}:${subject}:${receivedAt || ''}`

  return { messageId: messageId.slice(0, 500), recipients, route, from, subject, snippet, text, receivedAt }
}

/** Which carrier sent it — from the sender, so a forwarding hop can't fool it. */
export function carrierOf(fromAddress) {
  const f = String(fromAddress || '').toLowerCase()
  // The UK list came first, because UK mail is what was arriving. The Israeli
  // and Canadian suppliers were missing entirely — this shop rents Israel
  // handsets constantly, and lib/rentalPoolImport.mjs has known about Golan and
  // Fizz since the pool import was written. Two lists of the same carriers, one
  // of them short, is how a Cellular Israel order confirmation arrives with no
  // carrier name against it (owner, 19 Aug 03:20).
  //
  // Naming a carrier here does NOT make its mail arrive. Nothing reaches the
  // app that Gmail has not forwarded to it, and that is a filter on the
  // mailbox, not a line of code — see docs/carrier-mail-coverage.md.
  const names = [
    ['lebara', 'Lebara'], ['1pmobile', '1pMobile'], ['usmobile', 'US Mobile'],
    ['us-mobile', 'US Mobile'], ['smarty', 'Smarty'], ['tello', 'Tello'],
    ['three', 'Three'], ['asda', 'Asda Mobile'], ['giffgaff', 'giffgaff'],
    ['talkhome', 'Talk Home'], ['talk-home', 'Talk Home'], ['spusu', 'spusu'],
    // Israel — the rentals side of the shop.
    ['cellularisrael', 'Cellular Israel'], ['cellular-israel', 'Cellular Israel'],
    ['golantelecom', 'Golan'], ['golan', 'Golan'],
    ['pelephone', 'Pelephone'], ['cellcom', 'Cellcom'], ['partner', 'Partner'],
    ['hotmobile', 'Hot Mobile'], ['019mobile', '019 Mobile'],
    // Canada and the rest of the pool list.
    ['fizz', 'Fizz'], ['luckymobile', 'Lucky Mobile'], ['lucky-mobile', 'Lucky Mobile'],
  ]
  for (const [needle, name] of names) if (f.includes(needle)) return name
  return null
}
