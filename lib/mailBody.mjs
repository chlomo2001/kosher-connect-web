// Making an email readable on screen.
//
// Carrier and airline mail arrives as HTML and is flattened to text before it
// is stored. Every link survives that flattening as `Label ( https://… )`, and
// modern marketing links are 120-character tracking blobs — so a Jet2 booking
// confirmation opened in the app is a wall of
// `https://jet2email.com/c/AQi_qhAQ5NaHARjQi_-2ASCBrr0fKMvmshAFxs…` with a few
// real words lost inside it (owner, 19 Aug, with a screenshot of exactly that).
//
// The words are the point. The destination still matters — staff do click
// "Manage My Booking" — so nothing is thrown away: the URL moves off the page
// and onto the label, which becomes the link.
//
// Pure and rendering-free on purpose: it returns SEGMENTS, not HTML, so the
// browser copy in public/main.js can be held to it exactly (mailBodyMirror).

// A URL wrapped in its own brackets, the shape the flattener leaves behind.
// Non-greedy and bracket-free inside, so `( a ) ( b )` stays two links.
const BRACKETED = /\(\s*(https?:\/\/[^\s()]+)\s*\)/g
// A URL sitting alone with no bracket and no label — a footer link, usually.
const BARE = /(?<![("<])\bhttps?:\/\/[^\s<>()]+/g

/** The bit of a URL a human can actually judge: the host, minus any www. */
export function linkHost(url) {
  const m = String(url || '').match(/^https?:\/\/([^/?#]+)/i)
  return m ? m[1].replace(/^www\./i, '') : ''
}

/**
 * The label for a bracketed link: the trailing words just before it.
 *
 * `Essentials ( https://… )` gives "Essentials". A bracket that opens a line
 * has no label at all, and falls back to the host so the reader still knows
 * where it goes rather than seeing a bare word "link".
 */
function labelBefore(text) {
  // Stop at a line break or at the close of a previous link — anything further
  // back belongs to the sentence, not to this link.
  const tail = String(text).split(/\n|\)\s*/).pop() || ''
  const label = tail.trim()
  // A whole sentence is not a label. Long tails are left in the prose.
  if (!label || label.length > 60) return ''
  return label
}

/**
 * Split a flattened email into text and link segments.
 *
 * Returns `[{ type: 'text', text }, { type: 'link', text, href }, …]`.
 * Concatenating every `text` gives back a readable message with no URLs in it.
 */
// ── When the flattening never happened ────────────────────────────────────
//
// The comment at the top says carrier mail "is flattened to text before it is
// stored". Sometimes it is not: the owner opened a Ryanair itinerary on 28 Aug
// and got `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" …`
// and four hundred lines of `@media only screen{html{background-color:#E6EAED`.
// Whatever put that row in the mailbox stored the source.
//
// Fixed HERE rather than at ingest because the rows already exist and cannot be
// re-received. An email nobody can read is the same as an email that did not
// arrive.
const LOOKS_HTML = /<\s*(?:!doctype|html|head|body|table|tr|td|div|p|br|span|style|meta|a)\b/i

const ENTITY = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '\u2014', ndash: '\u2013', hellip: '\u2026', pound: '\u00a3', euro: '\u20ac',
  rsquo: '\u2019', lsquo: '\u2018', ldquo: '\u201c', rdquo: '\u201d',
}
function decodeEntities(t) {
  return String(t)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITY[name.toLowerCase()] ?? m)
}

/**
 * HTML in, readable text out. Anything that does not look like HTML comes back
 * untouched, so a properly flattened mail is not put through this twice.
 *
 * Anchors are turned into `Label ( href )` BEFORE the tags come off, which is
 * the exact shape mailBodySegments already knows how to read — so a link in a
 * raw-HTML mail ends up as the same tidy label-with-a-URL as one in a flattened
 * mail, rather than being thrown away with its tag.
 */
export function htmlToText(body) {
  const src = String(body == null ? '' : body)
  if (!LOOKS_HTML.test(src)) return src
  const text = src
    .replace(/<!--[\s\S]*?-->/g, ' ')
    // script/style/head carry no words for a reader — and style is most of the
    // bulk in an airline mail.
    .replace(/<(script|style|head|title)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a\s*>/gi, (m, href, inner) => {
      const label = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      return label ? ` ${label} ( ${href} ) ` : ` ( ${href} ) `
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|table|h[1-6]|li|ul|ol|section|header|footer)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
  return decodeEntities(text)
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/^[ \t]+|[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function mailBodySegments(body) {
  // Raw HTML gets flattened first; a mail that is already text passes straight
  // through, so this is safe to run on everything.
  const src = htmlToText(String(body == null ? '' : body))
  if (!src.trim()) return []
  const out = []
  const pushText = (t) => {
    if (!t) return
    const last = out[out.length - 1]
    if (last && last.type === 'text') last.text += t
    else out.push({ type: 'text', text: t })
  }

  let at = 0
  BRACKETED.lastIndex = 0
  for (let m = BRACKETED.exec(src); m; m = BRACKETED.exec(src)) {
    const before = src.slice(at, m.index)
    const label = labelBefore(before)
    // The label is being promoted to the link, so it leaves the prose. Cut at
    // where it STARTS, not by its length — the tail was trimmed, so slicing by
    // length leaves the whitespace behind and eats the label's first letter.
    const cutAt = label ? before.lastIndexOf(label) : before.length
    pushText(before.slice(0, cutAt))
    out.push({ type: 'link', text: label || linkHost(m[1]), href: m[1] })
    at = m.index + m[0].length
  }
  pushText(src.slice(at))

  // Bare URLs left in the tail text become links on their own host.
  const spread = []
  for (const seg of out) {
    if (seg.type !== 'text') { spread.push(seg); continue }
    let cut = 0
    BARE.lastIndex = 0
    for (let m = BARE.exec(seg.text); m; m = BARE.exec(seg.text)) {
      const lead = seg.text.slice(cut, m.index)
      if (lead) spread.push({ type: 'text', text: lead })
      spread.push({ type: 'link', text: linkHost(m[0]), href: m[0] })
      cut = m.index + m[0].length
    }
    const tail = seg.text.slice(cut)
    if (tail) spread.push({ type: 'text', text: tail })
  }

  // Pulling links out leaves the punctuation that held them: stray spaces
  // before a comma, and the blank-line canyons a stripped footer leaves.
  return spread.map((seg, i) => {
    if (seg.type !== 'text') return seg
    let t = seg.text
      .replace(/[ \t]+/g, ' ')
      .replace(/ +([,.;:!?])/g, '$1')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+\n/g, '\n')
    if (i === 0) t = t.replace(/^\s+/, '')
    if (i === spread.length - 1) t = t.replace(/\s+$/, '')
    return { type: 'text', text: t }
  }).filter(seg => seg.type !== 'text' || seg.text !== '')
}

/** The same message as plain text, links reduced to their labels. */
export function mailBodyText(body) {
  return mailBodySegments(body).map(s => s.text).join('')
}
