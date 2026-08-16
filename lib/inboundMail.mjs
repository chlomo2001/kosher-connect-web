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

function splitAddresses(s) {
  return String(s)
    .split(/[,;]/)
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
    return collapse(html.replace(/<[^>]*>/g, ' ')).slice(0, MAX_SNIPPET)
  }
  return ''
}

/**
 * Payload → { messageId, recipients, from, subject, snippet, receivedAt }.
 *
 * messageId falls back to a deterministic composite when the payload has no
 * Message-Id: the unique index on it is what makes redelivery safe, so it must
 * never be empty and never be random.
 */
export function normaliseInbound(payload, { hopDomain } = {}) {
  const recipients = pairableRecipients(payload, hopDomain)
  const from = addressesOf(pick(payload, ['from']))[0] || ''
  const subject = collapse(pick(payload, ['subject'])).slice(0, 500)
  const snippet = snippetOf(payload)
  const dateRaw = pick(payload, ['date', 'receivedAt'])
  const parsed = dateRaw ? new Date(dateRaw) : null
  const receivedAt = parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : null

  let messageId = collapse(pick(payload, ['messageId', 'message-id'])).replace(/^<|>$/g, '')
  if (!messageId) messageId = `no-id:${from}:${recipients[0] || ''}:${subject}:${receivedAt || ''}`

  return { messageId: messageId.slice(0, 500), recipients, from, subject, snippet, receivedAt }
}

/** Which carrier sent it — from the sender, so a forwarding hop can't fool it. */
export function carrierOf(fromAddress) {
  const f = String(fromAddress || '').toLowerCase()
  const names = [
    ['lebara', 'Lebara'], ['1pmobile', '1pMobile'], ['usmobile', 'US Mobile'],
    ['us-mobile', 'US Mobile'], ['smarty', 'Smarty'], ['tello', 'Tello'],
    ['three', 'Three'], ['asda', 'Asda Mobile'], ['giffgaff', 'giffgaff'],
    ['talkhome', 'Talk Home'], ['talk-home', 'Talk Home'], ['spusu', 'spusu'],
  ]
  for (const [needle, name] of names) if (f.includes(needle)) return name
  return null
}
