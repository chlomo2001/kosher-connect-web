// Which way the money went on a ledger row.
//
// AHT item 3: "replace the text type word with a round colour-coded
// in/out/transfer/bank glyph". Half of that is right and half of it would lose
// information, so this does the right half.
//
// WHAT IS NOT DONE: the type word does not go. "Rental adj.", "Loss", "Void
// credit" and "Refund paid out" are four different things a glyph cannot tell
// apart, and replacing them with one shape would be a second, vaguer answer to
// "what is this row" — the fault this repo has paid for four times. The words
// stay; the badge joins them.
//
// WHAT IS DONE: the row already carried a direction mark, and it was wrong.
// Three renderers painted `amount >= 0 ? 'dot-green' : 'dot-blue'`, so the
// direction was read off the SIGN alone. Counted against Kc-Live on 28 Aug,
// that is not what the sign means:
//
//   refund          14 rows, ALL POSITIVE   a credit onto their balance
//   refund_payout    3 rows, ALL NEGATIVE   cash actually handed back
//
// Two rows a person reads as "refund" were painted opposite colours, and the
// one that is money genuinely leaving the shop got the same blue as an ordinary
// charge. Direction is a fact about the TYPE, with the sign as a tiebreak only
// where the type genuinely goes both ways.
//
// Four states, and they cover every entry_type in production:
//
//   in       money received            payment (254), top_up (1)
//   out      money handed back         refund_payout (3)
//   charge   charged to the account    booking (383), rental (25),
//                                      online_service, phone_sale, stock_sale,
//                                      sim_* — all negative, all of them
//   adjust   the balance moved, no     manual_adjustment (66, both signs),
//            cash changed hands        rental_adjustment (7, both),
//                                      rental_void (5), refund (14)
//
// Pure. Mirrored into public/main.js as KC_LEDGERDIR.

/** Money the shop received. */
const IN_TYPES = new Set(['payment', 'top_up'])

/** Money the shop handed back — cash out of the till, not a credit note. */
const OUT_TYPES = new Set(['refund_payout'])

/**
 * The balance moved but no cash did: a correction, a void, or a refund posted
 * as credit rather than paid out. Both signs occur and both are this.
 */
const ADJUST_TYPES = new Set([
  'manual_adjustment', 'rental_adjustment', 'rental_void', 'refund',
])

/**
 * ledgerDirection(entry) → 'in' | 'out' | 'charge' | 'adjust'
 *
 * `entry` needs `type` and, for the fallback only, `amount`.
 *
 * An entry_type nobody has taught this falls back to the sign, which is what
 * the app did for everything before — so a type added later is no worse off
 * than it is today, and never blank.
 */
export function ledgerDirection(entry) {
  const type = String((entry && entry.type) || '')
  if (IN_TYPES.has(type)) return 'in'
  if (OUT_TYPES.has(type)) return 'out'
  if (ADJUST_TYPES.has(type)) return 'adjust'
  if (KNOWN_CHARGES.has(type)) return 'charge'
  return (Number(entry && entry.amount) || 0) >= 0 ? 'in' : 'charge'
}

/**
 * Every type that is a charge raised against the customer. Listed rather than
 * inferred from the sign: a charge is a charge whichever way a correction to it
 * later points, and an explicit list is a thing a person can check against the
 * ledger.
 */
const KNOWN_CHARGES = new Set([
  'booking', 'rental', 'rental_loss', 'repair', 'online_service',
  'phone_sale', 'stock_sale', 'virtual_number', 'extra_charge',
  'sim_charge', 'sim_annual', 'sim_additional', 'sim_replacement', 'sim_service',
])

/**
 * How each direction is drawn and, more importantly, said.
 *
 * `label` is what a screen reader announces — the badge is a coloured shape,
 * and colour is never the only carrier of meaning (WCAG 1.4.1). `glyph` is a
 * plain character rather than an icon font so the badge survives the icon
 * sheet failing to load, which is the one thing a direction mark must not do.
 */
export const DIRECTIONS = {
  in: { glyph: '↓', label: 'Money in', tone: 'in' },
  out: { glyph: '↑', label: 'Money out', tone: 'out' },
  charge: { glyph: '•', label: 'Charged to the account', tone: 'charge' },
  adjust: { glyph: '⇄', label: 'Balance adjusted, no cash moved', tone: 'adjust' },
}

/** The direction, ready to draw. Never returns nothing. */
export function directionOf(entry) {
  const key = ledgerDirection(entry)
  return { key, ...DIRECTIONS[key] }
}
