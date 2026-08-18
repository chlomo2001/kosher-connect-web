// The stock categories a shop item can be filed under.
//
// Was a hardcoded four (phone / accessory / SIM / other). Owner, 18 Aug: "why
// so little option on stock types/categories? didnt we implement something
// about this from lightspeed?" — what was taken from Lightspeed on 17 Aug was
// the FILTER VIEW (search + category + brand), not the category list itself,
// which stayed thin. This is the list made sensible for what the shop actually
// sells. Owner-editable-in-Settings is the follow-up (see BACKLOG); this is the
// defaults it will start from.
//
// 'phone' IS LOAD-BEARING and must always exist with that key: a phone line on
// the till captures an IMEI (public/main.js), and a phone sale posts a
// 'phone_sale' ledger row rather than 'stock_sale' (pages/api/shop.js). The
// rest are labels and filter buckets with no behaviour behind them, so they are
// safe to add to, rename or reorder.
//
// Order is display order — this is the order the dropdown and the filter show.
export const STOCK_CATEGORIES = [
  ['phone', '📱 Phone'],
  ['sim', '💳 SIM'],
  ['charger', '🔌 Charger'],
  ['cable', '🔗 Cable'],
  ['earphones', '🎧 Earphones'],
  ['case', '🛡️ Case & cover'],
  ['powerbank', '🔋 Power bank'],
  ['memory', '💾 Memory card'],
  ['car', '🚗 Car accessory'],
  ['repairpart', '🔧 Repair part'],
  ['accessory', '🧩 Accessory'],
  ['other', '📦 Other'],
]

/** The valid keys, in display order — the server's allowlist. */
export const STOCK_CATEGORY_KEYS = STOCK_CATEGORIES.map(([k]) => k)

/** key → label, for the dropdown, the filter and the shelf. */
export const STOCK_CATEGORY_LABELS = Object.fromEntries(STOCK_CATEGORIES)

/** The one category with behaviour behind it — kept named so nothing loses it. */
export const LOAD_BEARING_CATEGORY = 'phone'

/**
 * One owner-typed category label, sanitised. No comma (it is the list
 * delimiter) and no angle brackets; whitespace collapsed; capped at 40 chars.
 * Emoji are kept — an owner may prefix one, the way the built-in categories do.
 */
export function cleanCategoryLabel(raw) {
  return String(raw || '').replace(/[<>,]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40).trim()
}

/**
 * The twelve defaults with the owner's own categories appended.
 *
 * `csv` is the comma-separated `stock_categories` setting. A custom category is
 * stored under its own LABEL as its key — the same as a repair stage — so an
 * item filed under "Gift wrap" carries category "Gift wrap", and renaming or
 * removing the Settings entry never silently reclassifies items already on it.
 *
 * A custom label that collides with a default (by key OR by label, case-
 * insensitively) is dropped: the defaults win, and 'phone' in particular — the
 * load-bearing one — can never be redefined out from under the till.
 */
// A label compared for collisions the way a person would read it: emoji and
// surrounding punctuation stripped, lower-cased. So "Case & cover" is recognised
// as the same as the built-in "🛡️ Case & cover" and is not added a second time.
const bareLabel = (s) => String(s || '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase()

export function mergeStockCategories(csv) {
  const merged = STOCK_CATEGORIES.map(([k, l]) => [k, l])
  const taken = new Set()
  for (const [k, label] of STOCK_CATEGORIES) { taken.add(k.toLowerCase()); taken.add(bareLabel(label)) }
  for (const raw of String(csv || '').split(',')) {
    const label = cleanCategoryLabel(raw)
    if (!label) continue
    const key = bareLabel(label)
    if (!key || taken.has(key)) continue
    taken.add(key)
    merged.push([label, label])
  }
  return merged
}

/** The full allowlist of keys — defaults plus the owner's — for validation. */
export function mergedStockCategoryKeys(csv) {
  return mergeStockCategories(csv).map(([k]) => k)
}

/** Just the owner's extra categories, cleaned and de-duplicated — for the
 *  Settings editor to show back what is saved. */
export function customStockCategories(csv) {
  return mergeStockCategories(csv).slice(STOCK_CATEGORIES.length).map(([, l]) => l)
}
