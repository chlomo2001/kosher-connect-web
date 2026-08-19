// What the shop is allowed to SAY about money — and what it must refuse to say.
//
// Port item C1, taken at full scope by the owner on 19 August 2026. The source
// repo (earothbart-ai/pixel-perfect-peek) cannot be reached from this session,
// so this is built from the written brief rather than ported from code.
//
// Two functions, never one. `moneyState` looks at the figures and returns a
// typed state; `moneySentence` switches on that state to produce words. Data →
// decision → words, and never back. Rewording can therefore never change what
// the system believes, and the belief can be tested without reading a single
// sentence of copy.
//
// ── THE SIGN CONVENTION, stated once and tested ─────────────────────────────
//
// `balance` follows the ledger and the wallet screen: NEGATIVE means the
// customer owes the shop, POSITIVE means the shop is holding their money.
// (`customerOwed()` in public/main.js returns the positive MAGNITUDE of a debt,
// which is the opposite reading of the same fact — that is exactly why this is
// written down here.) Getting it backwards does not crash anything; it tells a
// customer who owes £45 that they are £45 in credit, which is plausible,
// wrong, and would be believed.

/** Every state the shop's money can be in, from a person's point of view. */
export const MONEY_STATES = [
  'unreliable',    // we cannot stand behind this figure — say so, quote nothing
  'refund_due',    // we owe them money back
  'in_credit',     // we are holding their money
  'settled',       // nothing outstanding either way
  'owes',          // they owe, recently
  'owes_overdue',  // they owe, and it has been long enough to be worth a call
]

// Half a penny. Below this a balance is rounding, not money.
const EPSILON = 0.005
// The brief's rule, and it matches how this shop actually works: past thirty
// days a debt stops being an invoice and becomes a phone call.
export const CHASE_AFTER_DAYS = 30

/**
 * The decision. No words come out of here, and none go in.
 *
 * `reliable` wins over everything: a figure we cannot stand behind must not be
 * described as settled, owed or in credit, because all three are claims.
 */
export function moneyState({ balance, oldestDebtDays = null, reliable = true, refundDue = 0 } = {}) {
  if (!reliable) return 'unreliable'
  const bal = Number(balance)
  if (!Number.isFinite(bal)) return 'unreliable'
  if (Number(refundDue) > EPSILON) return 'refund_due'
  if (bal > EPSILON) return 'in_credit'
  if (bal < -EPSILON) {
    const days = Number(oldestDebtDays)
    return Number.isFinite(days) && days >= CHASE_AFTER_DAYS ? 'owes_overdue' : 'owes'
  }
  return 'settled'
}

// ── The gaps/reliable shape ────────────────────────────────────────────────
//
// Every money result carries `gaps` and `reliable`. A missing input is NEVER
// treated as zero: it pushes a plain sentence onto `gaps` saying what is not
// known and why it matters. A figure taken from a rate table a person maintains
// is `{ amount, confirmed }`, and one unconfirmed input makes the WHOLE result
// provisional — not the line it came from, the answer.

/**
 * A figure read from a table a human maintains.
 *
 * `confirmed` means a named person checked it against reality, not that a row
 * exists. An unconfirmed rate is a guess with a database behind it.
 */
export function rate(amount, { confirmed = false, what = 'a rate' } = {}) {
  // `Number(null)` is 0, and so is `Number('')` and `Number([])`. Leaning on
  // Number.isFinite alone therefore turns a rate NOBODY HAS ENTERED into a
  // free one — which is the precise failure this whole module exists to
  // prevent, and it was sitting in the first draft of the function that
  // prevents it. Absence is checked before conversion, never after.
  const absent = amount === null || amount === undefined || amount === '' ||
    (typeof amount !== 'number' && typeof amount !== 'string')
  const n = Number(amount)
  return {
    amount: absent || !Number.isFinite(n) ? null : n,
    confirmed: !!confirmed,
    what: String(what),
  }
}

/**
 * Assemble a money answer from its inputs, refusing to be confident when it
 * has no right to be.
 *
 * ORDER OF OPERATIONS, stated because reversing it produces a different and
 * entirely plausible answer:
 *   1. Missing inputs are collected FIRST. A missing rate is not zero, and
 *      summing before checking would quietly turn "we don't know" into "£0".
 *   2. Unconfirmed inputs are collected SECOND. These have a number, so the
 *      total is arithmetically fine — it is the CONFIDENCE that is not.
 *   3. `reliable` is false if either list is non-empty. One unchecked rate
 *      makes the whole answer provisional, not just its own line.
 *   4. `amount` is returned regardless, so a caller can still show working —
 *      but `reliable` is what decides whether it may be quoted.
 */
export function moneyResult({ amount = 0, inputs = [], notes = [] } = {}) {
  const gaps = []
  for (const input of inputs) {
    if (!input) continue
    if (input.amount === null || !Number.isFinite(Number(input.amount))) {
      gaps.push(`We do not have ${input.what} on record, and it is part of this figure.`)
    }
  }
  for (const input of inputs) {
    if (!input || input.amount === null) continue
    if (!input.confirmed) {
      gaps.push(`${sentenceCase(input.what)} has not been checked by anybody since it was entered.`)
    }
  }
  for (const note of notes) if (note) gaps.push(String(note))
  const total = Number(amount)
  return {
    amount: Number.isFinite(total) ? total : null,
    gaps,
    reliable: gaps.length === 0 && Number.isFinite(total),
  }
}

const sentenceCase = (s) => {
  const t = String(s || '').trim()
  return t ? t[0].toUpperCase() + t.slice(1) : t
}

// ── The words ──────────────────────────────────────────────────────────────
//
// Three audiences, and the same fact is a different sentence to each. They live
// together so they cannot drift apart: the day the staff line says one thing
// and the customer's says another is the day somebody is told something untrue
// at the counter.

export const AUDIENCES = ['staff', 'customer', 'consignor']

/** £1,234.50 — always two decimals, always the symbol, never a bare number. */
export function gbp(n) {
  const v = Math.abs(Number(n) || 0)
  return '£' + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const SAY = {
  unreliable: {
    staff: () => 'Not a reliable figure yet — see what is missing below. Do not quote this to anyone.',
    customer: () => 'We are checking this. Please ask us rather than relying on a figure here.',
    consignor: () => 'Not a reliable figure yet — we are checking it before we settle with you.',
  },
  refund_due: {
    staff: (c) => `${gbp(c.refundDue)} to refund. Nothing has left the account yet.`,
    customer: (c) => `We owe you ${gbp(c.refundDue)} back. We are sending it — nothing for you to do.`,
    consignor: (c) => `${gbp(c.refundDue)} is due back to you.`,
  },
  in_credit: {
    staff: (c) => `${gbp(c.balance)} in credit — the shop is holding their money.`,
    customer: (c) => `You are ${gbp(c.balance)} in credit with us. It comes off what you buy next — nothing to pay.`,
    consignor: (c) => `${gbp(c.balance)} of yours is with us, ready for the next settlement.`,
  },
  settled: {
    staff: () => 'Settled — nothing owed either way.',
    customer: () => 'Nothing to pay. Your account is settled.',
    consignor: () => 'Settled — everything sold has been paid over to you.',
  },
  owes: {
    staff: (c) => `Owes ${gbp(c.balance)}${dayTail(c)}.`,
    customer: (c) => `${gbp(c.balance)} is outstanding on your account. You can pay it next time you are in, or ask us for a link.`,
    consignor: (c) => `${gbp(c.balance)} is outstanding against your account with us.`,
  },
  owes_overdue: {
    // The brief's rule: escalate lateness in WORDS, not in punctuation.
    staff: (c) => `Owes ${gbp(c.balance)}${dayTail(c)} — worth a phone call.`,
    customer: (c) => `${gbp(c.balance)} has been outstanding for a while now. Please settle it when you can, or tell us if something is wrong with it.`,
    consignor: (c) => `${gbp(c.balance)} has been outstanding for a while — worth a word with us.`,
  },
}

const dayTail = (c) => {
  const d = Number(c && c.oldestDebtDays)
  return Number.isFinite(d) && d > 0 ? ` for ${d} day${d === 1 ? '' : 's'}` : ''
}

/**
 * The sentence for a state, from one reader's side.
 *
 * Never says "certain". The strongest thing said anywhere here is a plain
 * statement of fact, because a confidence label teaches the reader to stop
 * reading — and what is being read is somebody's money.
 */
export function moneySentence(state, ctx = {}, audience = 'staff') {
  const who = AUDIENCES.includes(audience) ? audience : 'staff'
  const forState = SAY[state] || SAY.unreliable
  return forState[who](ctx)
}

/**
 * The whole journey in one call: figures in, state and sentence out.
 *
 * Callers that only want words still get the state, so a screen can style by
 * state without parsing the sentence it was given.
 */
export function moneySay(ctx = {}, audience = 'staff') {
  const state = moneyState(ctx)
  return { state, audience, text: moneySentence(state, ctx, audience) }
}

/**
 * Most-overdue first, the brief's rule for a chasing list.
 *
 * Anything unreliable sorts to the TOP rather than the bottom: a figure nobody
 * can stand behind is the one that needs a person soonest, and burying it under
 * the debts is how it stays unchecked forever.
 */
export function chaseOrder(rows = []) {
  const rank = { unreliable: 0, owes_overdue: 1, owes: 2, refund_due: 3, in_credit: 4, settled: 5 }
  return [...rows].sort((a, b) => {
    const sa = moneyState(a), sb = moneyState(b)
    if (rank[sa] !== rank[sb]) return rank[sa] - rank[sb]
    const da = Number(a.oldestDebtDays) || 0, db = Number(b.oldestDebtDays) || 0
    if (da !== db) return db - da
    return (Number(a.balance) || 0) - (Number(b.balance) || 0)
  })
}
