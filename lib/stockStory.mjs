// The story of a stock count — E4 from the Epos Now read.
//
// They report stock history and discrepancy as a TRAIL; KC's shelf number
// changed silently. The number on a stock item is the END of a story the
// database already holds most of: goods-in lines put stock on the shelf
// (goods_in_lines.item_id), sales take it off (stock_sales.stock_item_id).
// This module tells that story and — the part worth having — says when the
// story and the shelf DISAGREE.
//
// What it deliberately does NOT do: invent a movements table. The trail is
// DERIVED from records that already exist, so there is no migration, no second
// write path, and no new way for the story to drift from the truth — the
// lesson this repo has paid for four times is that a second copy of a fact
// rots. The price of deriving is honest and stated: hand edits to the quantity
// and supplier returns are not itemised, so they surface only in the opening
// figure below.
//
// Pure. Mirrored into public/main.js as KC_STOCKSTORY; the mirror test holds
// the two identical.

/**
 * buildStockStory({ quantityNow, sales, goodsIn }) →
 *   { moves, totalIn, totalOut, opening, impossible }
 *
 * sales:   [{ qty, created_at, who }]        — who is display-only
 * goodsIn: [{ qty, delivery_date, supplier }]
 *
 * moves are newest first. `opening` is what the records imply the count was
 * before the earliest of them: quantityNow − (in − out). It is the honest
 * remainder — hand edits and anything unrecorded live inside it.
 *
 * `impossible` is the discrepancy signal: an opening below zero cannot have
 * happened (a shelf cannot start at −3), so the records and the shelf number
 * PROVABLY disagree by at least that much. That is E4's "discrepancy as a
 * trail" without a stocktake table: not every lie is caught, but a caught one
 * is certain.
 */
function buildStockStory({ quantityNow, sales, goodsIn }) {
  const moves = []
  for (const g of goodsIn || []) {
    const qty = Math.max(0, Math.round(Number(g.qty) || 0))
    if (!qty) continue
    moves.push({ when: String(g.delivery_date || '').slice(0, 10), kind: 'in', qty,
      label: g.supplier ? `Goods in — ${g.supplier}` : 'Goods in' })
  }
  for (const s of sales || []) {
    const qty = Math.max(0, Math.round(Number(s.qty) || 0))
    if (!qty) continue
    moves.push({ when: String(s.created_at || '').slice(0, 10), kind: 'out', qty,
      label: s.who ? `Sold — ${s.who}` : 'Sold' })
  }
  // Newest first; a tie reads better with the sale after the delivery that
  // made it possible, so 'out' sorts above 'in' on the same day.
  moves.sort((a, b) => b.when.localeCompare(a.when) ||
    (a.kind === b.kind ? 0 : a.kind === 'out' ? -1 : 1))

  const totalIn = moves.filter((m) => m.kind === 'in').reduce((n, m) => n + m.qty, 0)
  const totalOut = moves.filter((m) => m.kind === 'out').reduce((n, m) => n + m.qty, 0)
  const now = Math.round(Number(quantityNow) || 0)
  const opening = now - (totalIn - totalOut)
  return { moves, totalIn, totalOut, opening, impossible: opening < 0 ? -opening : 0 }
}

/**
 * The reconciliation, said in words a person checks against the shelf.
 * One sentence, because the dialog shows the moves themselves above it.
 */
function stockStoryLine({ totalIn, totalOut, opening, impossible }, quantityNow) {
  const now = Math.round(Number(quantityNow) || 0)
  if (impossible) {
    return `The records do not add up: ${totalIn} in and ${totalOut} out ` +
      `cannot end at ${now} — at least ${impossible} of movement was never recorded ` +
      `(a hand edit to the count, or a sale or return that bypassed the till).`
  }
  if (!totalIn && !totalOut) {
    return `No recorded movements. The count of ${now} is where the story starts.`
  }
  return `${totalIn} in, ${totalOut} out, ${now} on the shelf — which puts the count ` +
    `before these records at ${opening}. Hand edits and supplier returns are not ` +
    `itemised; they live inside that figure.`
}

export { buildStockStory, stockStoryLine }
