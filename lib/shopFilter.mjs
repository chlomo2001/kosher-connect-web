// Narrowing the stock list by several things at once. Pure, no DOM.
//
// The Shop tab has had one dropdown (all / low / in stock) and NO search box,
// which is fine for a shelf of twenty and useless for one of two hundred. The
// Lightspeed products screen the owner sent puts a row of narrowing controls
// above the table — name, category, brand — and that is what this supports.
//
// The rule throughout: an empty facet narrows NOTHING. A filter that quietly
// excludes rows because a control was left on its default is how stock goes
// missing from a list and gets re-ordered by mistake.

/** Everything on an item that someone might type to find it. */
export function stockHaystack(item = {}) {
  return [item.company, item.model, item.code, item.barcode, item.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

/**
 * Does this item survive the facets?
 *
 * facets = { q, category, brand }
 *   q         free text — matched against brand, model, code and barcode
 *   category  a category value, or 'all'
 *   brand     a company name, or 'all'
 *
 * Text matching is word-by-word AND: "sam 20" finds a Samsung A20 whichever
 * order the words were typed, and does not find a Samsung A10.
 */
export function matchStockItem(item, facets = {}) {
  const { q = '', category = 'all', brand = 'all' } = facets || {}

  if (category && category !== 'all' && String(item?.category || '') !== String(category)) return false
  if (brand && brand !== 'all' && String(item?.company || '') !== String(brand)) return false

  const words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const hay = stockHaystack(item)
  return words.every(w => hay.includes(w))
}

/** The facets, applied. Never mutates the input. */
export function filterStock(items = [], facets = {}) {
  return (Array.isArray(items) ? items : []).filter(i => matchStockItem(i, facets))
}

/**
 * The brands actually on the shelf, for the dropdown — sorted, de-duplicated,
 * and only ones that exist. Offering a brand with nothing behind it is
 * offering a dead end.
 */
export function stockBrands(items = []) {
  const seen = new Set()
  for (const i of (Array.isArray(items) ? items : [])) {
    const b = String(i?.company || '').trim()
    if (b) seen.add(b)
  }
  return [...seen].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

/** Is anything narrowing the list right now? Drives the "clear" affordance. */
export function facetsActive(facets = {}) {
  const { q = '', category = 'all', brand = 'all' } = facets || {}
  return !!String(q || '').trim() || (category && category !== 'all') || (brand && brand !== 'all')
}
