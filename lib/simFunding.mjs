// Can the shop actually collect what a "through me" plan costs? Pure — no I/O.
//
// "Through me" means the shop pays the network and bills the customer
// (BUSINESS_RULES.md: provider cost + max(10%, £2)). That is a promise the
// customer makes to pay us monthly — and until they have a card on file or a
// live Direct Debit mandate, it is a promise with nothing behind it. The plan
// still renews. The network still takes its money. The shop is simply funding
// somebody's phone bill and nothing on any screen says so.
//
// Owner, 20 Aug, on why this is worth a filter: "a plan marked Through me
// whose customer has no saved card and no DD mandate is a line the shop is
// quietly funding."
//
// A PENDING mandate is deliberately its own answer. Bacs activates about two
// business days after setup, so 'pending' is a customer who has done their
// part and a clock that is running — the opposite of a customer who has done
// nothing. Rolling the two together would put work in front of staff that
// resolves itself by Thursday, which is how a list of problems becomes a list
// people scroll past.

/** Plans in a state that will never bill again collect nothing, and owe nothing. */
const DEAD = new Set(['cancelled'])

/**
 * How a through-me plan gets paid for.
 *
 * `sim`    the app-shaped plan — { paymentType, status }
 * `method` what the customer has on file — { card: bool, dd: 'active'|'pending'|… }
 *          Absent/unknown is treated as nothing, which is the safe direction:
 *          it flags a line for a human to look at rather than quietly passing it.
 *
 * Returns:
 *   'not-billed'  the customer pays the network themselves, or the plan is dead
 *   'card'        a saved card
 *   'dd'          a live Direct Debit mandate
 *   'dd-pending'  a mandate set up and not yet active — in hand, not a gap
 *   'none'        nothing to collect from. THIS is the one that means work.
 */
export function simFundingState(sim, method) {
  if (!sim || sim.paymentType === 'direct') return 'not-billed'
  if (DEAD.has(String(sim.status || ''))) return 'not-billed'
  const dd = String(method?.dd || '')
  if (dd === 'active') return 'dd'
  if (method?.card) return 'card'
  // Pending ranks BELOW a card on purpose: a customer with both can be charged
  // today, and the screen should say so rather than say "wait for Bacs".
  if (dd === 'pending') return 'dd-pending'
  return 'none'
}

/** The plans the shop is funding with no way to collect. */
export const simUnfunded = (sim, method) => simFundingState(sim, method) === 'none'

/** How the state reads on screen. '' where there is nothing worth saying. */
export function fundingLabel(state) {
  if (state === 'none') return 'nothing to collect from'
  if (state === 'dd-pending') return 'DD setting up'
  return ''
}
