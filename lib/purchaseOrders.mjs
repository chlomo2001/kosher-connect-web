// Purchase orders — what was ordered from a supplier, and what actually came.
//
// The shop already tracks the two ENDS of this: suppliers, and goods-in when a
// delivery lands. What was missing is the middle — the order itself — which is
// the only place three questions can be answered: what is on its way, when was
// it promised, and did the delivery match what was ordered.
//
// The money rule that shapes everything here: a purchase order is NOT a
// financial event. Ordering costs nothing, and nothing is posted anywhere.
// Only RECEIVING moves anything, and what it moves is stock, not the ledger —
// what the shop owes a wholesaler is a supplier balance, which goods-in
// already handles. Keeping that line clean is what stops a draft order
// quietly inflating the stock on hand.

export const PO_STATUSES = ['draft', 'ordered', 'received', 'cancelled']

// Where a status can go next. Received and cancelled are terminal: an order
// that has arrived cannot un-arrive, and re-receiving it would add its
// quantities to the shelf a second time.
const NEXT = {
  draft: ['ordered', 'cancelled'],
  ordered: ['received', 'cancelled'],
  received: [],
  cancelled: [],
}

export function canMove(from, to) {
  return !!NEXT[from]?.includes(to)
}

export const round2 = (v) => {
  const n = Number(v) || 0
  return (n < 0 ? -1 : 1) * Math.round(Math.abs(n) * 100 + 1e-7) / 100
}

/** One line: quantity × unit cost. */
export function lineTotal(line = {}) {
  return round2((Number(line.qty) || 0) * (Number(line.unitCost) || 0))
}

/** What the whole order comes to. */
export function orderTotal(lines = []) {
  return round2((Array.isArray(lines) ? lines : []).reduce((sum, l) => sum + lineTotal(l), 0))
}

/**
 * Is this order fit to save?
 *
 * Deliberately strict about quantity and loose about everything else: a line
 * with no quantity is not an order for nothing, it is a mistake, and it would
 * land on the shelf as a no-op that someone later reads as "delivered".
 * A missing cost IS allowed — the shop often orders before the invoice — and
 * shows as an unknown rather than a zero.
 */
export function validateOrder({ supplierId, lines } = {}) {
  if (!supplierId) return 'Choose a supplier.'
  const list = Array.isArray(lines) ? lines : []
  if (!list.length) return 'Add at least one line.'
  for (const l of list) {
    if (!l.stockItemId && !String(l.description || '').trim()) return 'Every line needs an item or a description.'
    const q = Number(l.qty)
    if (!Number.isFinite(q) || q <= 0) return 'Every line needs a quantity of at least 1.'
    if (!Number.isInteger(q)) return 'Quantities are whole numbers.'
    if (l.unitCost != null && l.unitCost !== '' && !(Number(l.unitCost) >= 0)) return 'A cost cannot be negative.'
  }
  return null
}

/**
 * What receiving this order does to the shelf: item id → how many to add.
 *
 * Lines with no stock item are skipped — a free-text line ("box of assorted
 * cables") is a note to a human, not something the app can count onto a shelf,
 * and inventing a row for it would be worse than leaving it to be added
 * properly.
 */
export function stockDelta(lines = []) {
  const delta = new Map()
  for (const l of (Array.isArray(lines) ? lines : [])) {
    if (!l.stockItemId) continue
    const q = Math.trunc(Number(l.qty) || 0)
    if (q <= 0) continue
    delta.set(l.stockItemId, (delta.get(l.stockItemId) || 0) + q)
  }
  return delta
}

/** How an order reads in one line, for a list. */
export function orderSummary(po = {}) {
  const lines = po.lines || []
  const items = lines.reduce((n, l) => n + (Math.trunc(Number(l.qty) || 0)), 0)
  return `${lines.length} line${lines.length === 1 ? '' : 's'} · ${items} item${items === 1 ? '' : 's'}`
}

/** Overdue = ordered, promised for a date that has passed, and not here yet. */
export function isOverdue(po = {}, today = '') {
  return po.status === 'ordered' && !!po.expectedAt && !!today && po.expectedAt < today
}
