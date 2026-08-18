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
