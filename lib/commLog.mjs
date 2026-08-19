// Correcting a customer timeline entry without erasing what it said.
//
// Owner's item 1, decided 19 August 2026: "correct it, never erase it". The
// timeline has been append-only since it was built, which makes it evidence —
// but it also meant a note typed against the wrong customer, or a call logged
// with the wrong outcome, stayed wrong for ever and the only remedy was to add
// a second entry contradicting the first.
//
// The shape here keeps both properties at once. `text` is the ORIGINAL and is
// never overwritten; a correction is appended to a list. What a screen shows is
// the latest correction, with the original still readable underneath and the
// name of whoever changed it. Nothing is destroyed, and nothing is hidden.
//
// The alternative — editing `text` in place and keeping an audit trail
// elsewhere — was rejected because the two halves can be separated. A log whose
// evidence lives in a different table is one careless migration from being just
// notes.

/** The most a correction may say. Long enough for a real one, short enough not to become an essay. */
export const MAX_CORRECTION = 500

/**
 * Correct an entry. Returns a NEW entry; the one passed in is not touched.
 *
 * Throws rather than silently returning the original when there is nothing to
 * record — a correction that quietly did nothing is worse than an error,
 * because the person who typed it believes it landed.
 */
export function correctEntry(entry, { text, by, at } = {}) {
  if (!entry || typeof entry !== 'object') throw new Error('correctEntry: no entry')
  const corrected = String(text == null ? '' : text).trim().slice(0, MAX_CORRECTION)
  if (!corrected) throw new Error('correctEntry: a correction must say something')
  if (corrected === currentText(entry)) throw new Error('correctEntry: that is what it already says')
  const corrections = Array.isArray(entry.corrections) ? entry.corrections.slice() : []
  corrections.push({
    at: at || new Date().toISOString(),
    by: String(by || 'staff'),
    text: corrected,
  })
  // `text` is deliberately carried through untouched. It is the original, and
  // it stays the original however many times the entry is corrected.
  return { ...entry, corrections }
}

/** What the entry says NOW — the latest correction, or the original. */
export function currentText(entry) {
  if (!entry) return ''
  const list = Array.isArray(entry.corrections) ? entry.corrections : []
  const last = list.length ? list[list.length - 1] : null
  return String((last && last.text) || entry.text || '')
}

/**
 * Everything a screen needs to show one entry honestly.
 *
 * `original` is only returned when it DIFFERS from what the entry now says, so
 * an uncorrected entry does not render its own text twice.
 */
export function entryView(entry) {
  const list = Array.isArray(entry && entry.corrections) ? entry.corrections : []
  const current = currentText(entry)
  const original = String((entry && entry.text) || '')
  const last = list.length ? list[list.length - 1] : null
  return {
    current,
    original: list.length && original !== current ? original : null,
    corrected: list.length > 0,
    correctedBy: last ? String(last.by || 'staff') : null,
    correctedAt: last ? last.at : null,
    // Every version, oldest first, for anyone who wants the whole story.
    history: list.length ? [{ at: entry.at, by: entry.by || 'staff', text: original }, ...list] : [],
  }
}

/** Was this entry ever corrected? Cheap check for a list that renders many. */
export function isCorrected(entry) {
  return !!(entry && Array.isArray(entry.corrections) && entry.corrections.length)
}
