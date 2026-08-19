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
export function mailBodySegments(body) {
  const src = String(body == null ? '' : body)
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
