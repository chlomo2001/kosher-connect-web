// Which carrier mail is worth forwarding to the customer, and to whom.
//
// Owner's item 20, decided 19 August 2026: "build it HOLD-gated, with an
// approval queue". The app prepares each forward and shows exactly what would
// go and to whom; nothing sends until the owner flips the gate.
//
// This module is only the DECISION — which messages qualify, and whether we are
// certain enough about who they belong to. It sends nothing and knows nothing
// about email. That separation is the point: the rule for "important" is going
// to be argued about and changed, and it must be arguable without touching
// anything that can put a message in front of a customer.
//
// Two questions, deliberately separate, because they fail differently:
//
//   1. Is this message worth a customer's attention?  → forwardKind()
//   2. Are we CERTAIN it is theirs?                    → forwardTarget()
//
// A wrong answer to (1) is a customer receiving something dull. A wrong answer
// to (2) is one customer reading another customer's business, which is the
// failure this shop cannot have. So (2) refuses on anything short of a message
// already filed against a SIM whose customer has an address on record.

/**
 * The kinds a customer would actually want, and why each is on the list.
 *
 * Deliberately NOT the same as ACTIONABLE in carrierMail.mjs. That set answers
 * "does a member of STAFF have something to do"; this answers "would the person
 * whose line it is want to know". They overlap and they are not the same:
 *   • payment_failed is on both — their line is about to stop.
 *   • port_in_complete is on both — their number moved, and they will notice.
 *   • pac_issued is staff-actionable but NOT forwarded: a PAC being issued
 *     means the customer is LEAVING, and they asked for it. Forwarding it tells
 *     them something they already know, from a shop they are walking away from.
 *   • renewed is not staff-actionable at all and IS forwarded — nothing to do,
 *     but it is their money and the receipt is the news.
 */
export const FORWARD_KINDS = new Map([
  ['port_in_complete', 'Their number has moved to us — they will notice, and this is the confirmation.'],
  ['payment_failed', 'Their line is about to stop. The sooner they know, the cheaper it is to fix.'],
  ['renewed', 'It is their money and their plan; the carrier receipt is the news.'],
  ['expiry_warning', 'Something of theirs is about to run out while there is still time to act.'],
  // #15 part 3: a sign-in code. In the map so an OTP that misses the strict
  // auto conditions still lands in the approval queue instead of vanishing —
  // late is better than lost, even for a code.
  ['otp', 'Their sign-in code — it expires while it waits.'],
])

/**
 * The kinds that forward THEMSELVES on arrival (issue #15, owner's yes to all
 * three, 23 Aug) — the approval step deleted for exactly these, with the
 * certainty test (forwardTarget) kept exactly as it is. OTP is not here: its
 * auto path carries stricter conditions of its own (see inbound/mail.js).
 */
export const AUTO_FORWARD_KINDS = new Set([
  'port_in_complete', 'payment_failed', 'renewed', 'expiry_warning',
])

/** Is this kind of message worth putting in front of the customer at all? */
export function forwardKind(kind) {
  return FORWARD_KINDS.has(String(kind || ''))
}

/** Why it qualifies, for the approval queue to show. Empty when it does not. */
export function forwardReason(kind) {
  return FORWARD_KINDS.get(String(kind || '')) || ''
}

/**
 * Who this message may be forwarded to — or a plain reason why nobody.
 *
 * Certainty is the whole job. A forward is judged on what the message is
 * already FILED against, never on a fresh guess: the carrier-mail screen has a
 * matching step with a human in it, and this rides on that decision rather than
 * making a second, weaker one of its own behind their back.
 *
 * Returns `{ email, name, customerId }` or `{ error }`.
 */
export function forwardTarget(message) {
  if (!message) return { error: 'No message.' }
  const sim = message.sim
  // Not filed on a SIM at all: the queue is still asking a person which line
  // this belongs to, and a forward would be answering that question by
  // guessing — with somebody else's mail.
  if (!sim) return { error: 'Not filed on a SIM yet — nobody has said whose this is.' }
  if (!sim.customerId) return { error: 'That SIM is not linked to a customer.' }
  const email = String(sim.customerEmail || '').trim()
  if (!email || !email.includes('@')) {
    return { error: `No email on record for ${sim.customerName || 'that customer'}.` }
  }
  // A message that names numbers must name THIS SIM's number among them. A
  // carrier can put several lines in one email, and a forward is a private
  // thing: if the message is about lines belonging to more than one customer,
  // no single customer may have it.
  const numbers = Array.isArray(message.numbers) ? message.numbers.map(String) : []
  if (numbers.length > 1) {
    return { error: `This message covers ${numbers.length} numbers — it cannot go to one customer.` }
  }
  return {
    email,
    name: String(sim.customerName || '').trim(),
    customerId: sim.customerId,
    number: sim.number || null,
  }
}

/**
 * Everything the approval queue needs about one message.
 *
 * Always returns a row, even for a message that will never be forwarded —
 * the queue is a place to understand the rule, and a message silently absent
 * teaches nobody anything.
 */
export function forwardPlan(message) {
  const kind = String((message && message.kind) || 'other')
  const eligible = forwardKind(kind)
  const target = eligible ? forwardTarget(message) : { error: 'Not a kind worth forwarding.' }
  return {
    id: message && message.id,
    kind,
    subject: String((message && message.subject) || '(no subject)'),
    eligible,
    reason: eligible ? forwardReason(kind) : '',
    ready: eligible && !target.error,
    blockedBy: target.error || null,
    to: target.error ? null : { email: target.email, name: target.name, customerId: target.customerId },
  }
}

/** The plans that could actually be sent, for a queue that offers Approve. */
export function forwardable(messages = []) {
  return messages.map(forwardPlan).filter((p) => p.ready)
}
