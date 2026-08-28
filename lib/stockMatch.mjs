// Which stock item is this delivery line about?
//
// The goods-in form has always carried a stock-item picker, and its first
// option is "✍️ Not in stock list" — so the path of least resistance produces
// an UNLINKED line. Production, read 28 Aug: the shop has recorded exactly one
// delivery, `goods_in_lines` holds exactly one row, and its `item_id` is null.
// The description on it is "QLYX Q8". There is a stock item whose company is
// QLYX and whose model is Q8. The app had the answer and never offered it.
//
// That is not cosmetic. An unlinked line does two things silently:
//
//   · the shelf is not moved — /api/goods-in skips the quantity bump on a line
//     with no item_id, so a recorded delivery leaves stock exactly as it was
//   · the trail cannot show it — lib/stockStory.mjs derives "in" from
//     goods_in_lines.item_id, so the one delivery this shop has ever recorded
//     is invisible on the very screen built to show deliveries
//
// So: match the typed description against the stock list, and link it.
//
// EXACT, NEVER FUZZY, AND NEVER AMBIGUOUS. A wrong link moves the wrong
// shelf and prices the wrong item, which is worse than no link at all — the
// operator can always pick by hand, and this only ever fills in an answer that
// is not in question. Two items matching one description returns null and asks.
//
// Pure. Mirrored into public/main.js as KC_STOCKMATCH; the mirror test holds
// the two identical.

/**
 * Everything a person might type for one item, flattened.
 *
 * Case, punctuation and runs of space are noise: "QLYX Q8", "qlyx  q8" and
 * "QLYX-Q8" are one answer. Nothing else is normalised — no stemming, no
 * abbreviation table, no edit distance. Every one of those invents a match the
 * typist did not make.
 */
export function normaliseStockText(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** The names one stock item answers to. */
export function stockItemNames(item) {
  if (!item) return []
  const join = (...parts) => parts.filter(Boolean).join(' ')
  return [...new Set([
    join(item.company, item.model),
    item.model,
    item.description,
    item.itemCode, item.item_code,
    item.barcode,
  ].map(normaliseStockText).filter(Boolean))]
}

/**
 * matchStockItem(description, items) → item | null
 *
 * `items` is the app's stock list. Inactive items are never matched: a line
 * arriving for something the shop has retired is a question, not an answer.
 *
 * Returns null when nothing matches AND when more than one does — the second
 * is the case worth being careful about, because two items sharing a name is
 * exactly when a guess is most confident and most wrong.
 */
export function matchStockItem(description, items) {
  const want = normaliseStockText(description)
  if (!want) return null
  const hits = (items || []).filter((i) => i && i.active !== false && stockItemNames(i).includes(want))
  return hits.length === 1 ? hits[0] : null
}
