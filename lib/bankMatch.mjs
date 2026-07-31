// Proposing which customer a bank transaction belongs to. Pure, no I/O.
//
// This module deliberately cannot post to the ledger. It ranks candidates and
// explains itself; a human decides. The whole reason the open-banking work is
// shaped this way is that a bank feed knows an amount and a date and a garbled
// reference — it does not know whose money it is. Guessing wrong writes a
// stranger's payment onto a customer's wallet, in an append-only table.
//
// Signals, strongest first:
//   1. an exact reference hit — a booking ref in the description is decisive
//   2. amount equal to something outstanding, which is common but not unique
//   3. the counterparty name resembling a customer's
//   4. date proximity to the thing it would settle
//
// Nothing here is worth much alone. A £45 credit matches half the shop; a name
// match with no amount match is a coincidence waiting to happen. Confidence
// comes from signals agreeing, and `AUTO_CONFIRM` stays false at every level —
// see shouldAutoPost.

import { namesSimilar } from './nameMatch.mjs'

const money = (v) => Math.round((Number(v) || 0) * 100) / 100
const DAY = 86400000

// A booking ref is 6 chars of upper alnum (EHC93Y, BNKYRW). Bank descriptions
// arrive shouty and punctuated — "BGC BNKYRW/KOPILOWITZ" — so scan tokens.
//
// Refs can be all letters (BNKYRW, IMPKJZ, DSCUFH), so "must contain a digit"
// is not available as a filter, and plenty of six-letter banking words look
// exactly like one. Hence the stop list. It will never be complete: the real
// protection is that scoreCandidate only counts a ref that also appears in the
// candidate's own known refs, so a stray FASTER matches nothing.
const REF_RE = /\b[A-Z0-9]{6}\b/g
const NOT_A_REF = new Set([
  'FASTER', 'PAYMEN', 'CREDIT', 'DEBITS', 'DIRECT', 'ONLINE', 'MOBILE', 'BANKED',
  'CHEQUE', 'CHARGE', 'REFUND', 'SALARY', 'MONTHL', 'STANDI', 'ORDERS', 'TRANSF',
  'DEPOSI', 'INTERE', 'ACCOUN', 'BALANC', 'INWARD', 'RETURN', 'REVERS', 'CARDPY',
])
export function refsIn(text) {
  const found = String(text || '').toUpperCase().match(REF_RE) || []
  return [...new Set(found.filter((r) => (
    // All-digit runs are sort codes, dates and amounts.
    /[A-Z]/.test(r) && !NOT_A_REF.has(r)
  )))]
}

// Scores one candidate against one transaction. Returns the signals that fired
// so the UI can say WHY, which is what makes a human able to judge it quickly.
export function scoreCandidate(txn, candidate, opts = {}) {
  const windowDays = opts.windowDays ?? 30
  const reasons = []
  let score = 0

  const txnAmount = money(txn.amount)
  const expected = candidate.expectedAmount == null ? null : money(candidate.expectedAmount)

  // 1. Reference match — the only signal strong enough to carry a match alone.
  const txnRefs = refsIn(`${txn.description || ''} ${txn.counterpartyName || ''}`)
  const candRefs = (candidate.references || []).map((r) => String(r).toUpperCase())
  const refHit = txnRefs.find((r) => candRefs.includes(r))
  if (refHit) {
    score += 60
    reasons.push(`reference ${refHit} appears in the bank description`)
  }

  // 2. Amount. Exact is meaningful; same-sign-but-different tells us little and
  // is scored at zero rather than negatively — a part payment is still a match.
  if (expected != null && txnAmount !== 0) {
    if (money(Math.abs(txnAmount)) === money(Math.abs(expected))) {
      score += 25
      reasons.push(`amount ${Math.abs(txnAmount).toFixed(2)} matches exactly`)
    } else if (Math.abs(Math.abs(txnAmount) - Math.abs(expected)) <= 0.02) {
      score += 20
      reasons.push('amount matches within rounding')
    }
    // Direction disagreeing is a genuine red flag: money in cannot settle a
    // refund we owe out.
    if (expected !== 0 && Math.sign(txnAmount) !== Math.sign(expected)) {
      score -= 40
      reasons.push('direction disagrees — money moved the wrong way for this')
    }
  }

  // 3. Name. Reuses the transliteration-aware matcher, so Teitelbaum on the
  // statement still finds Taitelbaum on file.
  if (txn.counterpartyName && candidate.name && namesSimilar(txn.counterpartyName, candidate.name)) {
    score += 20
    reasons.push(`counterparty resembles ${candidate.name}`)
  }

  // 4. Date proximity, tapering across the window. Weak on its own; useful for
  // separating two customers who owe the identical amount.
  if (txn.bookedAt && candidate.dueAt) {
    const days = Math.abs(new Date(txn.bookedAt) - new Date(candidate.dueAt)) / DAY
    if (days <= windowDays) {
      const near = Math.round(10 * (1 - days / windowDays))
      if (near > 0) {
        score += near
        reasons.push(`${Math.round(days)} day${Math.round(days) === 1 ? '' : 's'} from the expected date`)
      }
    }
  }

  return { candidate, score: Math.max(0, score), reasons }
}

// Bands, not a raw number, because a raw number invites someone to threshold it
// into an auto-post later. Every band still requires a human.
export function confidenceOf(score) {
  if (score >= 80) return 'strong'
  if (score >= 45) return 'possible'
  if (score > 0) return 'weak'
  return 'none'
}

// Ranked proposals for one transaction. `ambiguous` is the important flag: two
// candidates scoring alike is the exact case where a confident-looking UI would
// get someone to click through a wrong match.
export function proposeMatches(txn, candidates, opts = {}) {
  const limit = opts.limit ?? 5
  const scored = (candidates || [])
    .map((c) => scoreCandidate(txn, c, opts))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || String(a.candidate.customerId).localeCompare(String(b.candidate.customerId)))

  const top = scored[0] || null
  const runnerUp = scored[1] || null
  const ambiguous = !!(top && runnerUp && top.score - runnerUp.score < 15)

  return {
    proposals: scored.slice(0, limit).map((s) => ({ ...s, confidence: confidenceOf(s.score) })),
    best: top ? { ...top, confidence: confidenceOf(top.score) } : null,
    ambiguous,
    // What the triage screen should show as the default action.
    suggestedState: top ? 'proposed' : 'unmatched',
  }
}

// The guard rail, stated as code so it survives a later refactor: nothing is
// ever posted to the ledger without a person. If a future change wants
// auto-posting it has to delete this function and answer for it in review.
export const AUTO_POST_SUPPORTED = false
export function shouldAutoPost() {
  return false
}
