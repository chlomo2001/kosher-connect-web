// The Charge Gate — the questions that must be answered before a rental can be
// closed and charged. Pure, dependency-free, unit-tested: no DOM, no network,
// every input a parameter. Same shape as lib/rentalMath.mjs, for the same
// reason — this decides money, so it has to be testable on its own.
//
// WHAT THIS IS FOR
//
// saveManageRental used to carry the line "No hard block on undecided items —
// undecided items show ⚠️ badge". That is the whole problem in one comment. A
// rental could be closed with the charger neither returned nor written off, and
// the app recorded the ambiguity as a badge on a row nobody goes back to. The
// customer walks out, the charger is gone, and six weeks later there is no
// answer to "was it returned?" — only a ⚠️.
//
// So the gate asks the questions at the only moment anyone can still answer
// them: while the customer is standing at the counter. It does not decide what
// to charge — rentalMath does that — it decides whether the app knows enough to
// charge at all.
//
// DELIBERATELY RENTAL-CLOSE ONLY. Not a general-purpose approval framework, not
// a rules engine, not applied to SIMs or the till. Every check below is a
// question about handing a phone back. If a second surface ever needs a gate,
// it should get its own function rather than a `type` parameter here.

// A check that BLOCKS cannot be overridden — the close does not happen until
// the answer exists. A check that needs VERIFICATION can proceed, but only once
// a named member of staff has said so on the record.
export const BLOCK = 'block'
export const VERIFY = 'verify'
export const PASS = 'pass'

// The equipment keys a rental can hand over. plug+cable are one charger to the
// operator (see uiItemStatus in public/main.js) and are judged together here
// too, so the gate can never block on a key the UI has no control for.
const ITEM_LABELS = { phone: 'the phone', sim: 'the SIM', charger: 'the charger' }

function itemStatus(rental, key) {
  const st = rental.itemStatus || {}
  const legacy = rental.returnedItems || {}
  if (key === 'charger') {
    // Undecided if EITHER half is undecided: half an answer is not an answer.
    const parts = ['plug', 'cable'].map((k) =>
      st[k] !== undefined ? st[k] : (legacy[k] === true ? 'returned' : 'undecided'))
    if (parts.includes('undecided')) return 'undecided'
    return parts.includes('lost') ? 'lost' : 'returned'
  }
  if (st[key] !== undefined) return st[key]
  return legacy[key] === true ? 'returned' : 'undecided'
}

function wasGiven(rental, key) {
  const eq = rental.equipmentGiven
  // No record at all means the old default: everything went out with the phone.
  if (!eq) return true
  if (key === 'charger') return (eq.plug ?? false) || (eq.cable ?? false)
  return eq[key] ?? false
}

function lostAmount(rental, key) {
  const lost = rental.lostCharges || {}
  if (key === 'charger') return Number(lost.plug) || Number(lost.cable) || 0
  return Number(lost[key]) || 0
}

const round2 = (v) => Math.round(((Number(v) || 0) + Number.EPSILON) * 100) / 100

// The whole gate for one rental.
//
//   rental        the rental as the operator is about to save it
//   today         'YYYY-MM-DD', the shop's local day (never a UTC round-trip)
//   verifications ids already signed off for this rental, e.g. ['balance']
//
// Returns { checks, blockers, needsVerification, canClose }. `checks` is always
// the full list in a stable order, including the ones that pass — a gate that
// only shows problems teaches staff nothing about what it checked.
export function gateFor(rental, { today, verifications = [] } = {}) {
  const r = rental || {}
  const signed = new Set(verifications)
  const checks = []
  const add = (id, state, label, detail) => checks.push({ id, state, label, detail })

  // 1. Equipment. Every item that went out has to come back or be written off.
  //    This is the check the whole gate exists for.
  const undecided = []
  const unpriced = []
  for (const key of ['phone', 'sim', 'charger']) {
    if (!wasGiven(r, key)) continue
    const st = itemStatus(r, key)
    if (st === 'undecided') undecided.push(ITEM_LABELS[key])
    else if (st === 'lost' && !(lostAmount(r, key) > 0)) unpriced.push(ITEM_LABELS[key])
  }
  if (undecided.length) {
    add('equipment', BLOCK, 'Equipment accounted for',
      `Still undecided: ${undecided.join(', ')}. Mark each one returned or lost.`)
  } else if (unpriced.length) {
    // Written off but not priced is the same hole in a different shape: the
    // charge never happens and the loss never lands anywhere.
    add('equipment', BLOCK, 'Equipment accounted for',
      `Marked lost with no charge: ${unpriced.join(', ')}. Put a figure on it, or £0 if you are waiving it.`)
  } else {
    add('equipment', PASS, 'Equipment accounted for', 'Every item that went out is settled.')
  }

  // 2. Dates. A close cannot predate the pickup, and closing a rental into the
  //    future means the late-fee count is measuring nothing.
  if (r.fromDate && r.toDate && r.toDate < r.fromDate) {
    add('dates', BLOCK, 'Dates make sense', 'The return date is before the pickup date.')
  } else if (today && r.toDate && r.toDate > today) {
    add('dates', VERIFY, 'Dates make sense',
      `Closing a rental that runs until ${r.toDate}. Confirm the phone is back early.`)
  } else {
    add('dates', PASS, 'Dates make sense', 'Pickup and return dates are in order.')
  }

  // 3. Deposit. Money the shop is holding that belongs to somebody else. If it
  //    is not released or applied at close, it stays held against a rental that
  //    no longer exists, which is how a deposit quietly becomes takings.
  const deposit = Number(r.depositHeld) || 0
  if (deposit > 0 && !r.depositSettled) {
    add('deposit', BLOCK, 'Deposit settled',
      `${deposit.toFixed(2)} is still held. Refund it or apply it to the bill.`)
  } else if (deposit > 0) {
    add('deposit', PASS, 'Deposit settled', 'The deposit has been refunded or applied.')
  } else {
    add('deposit', PASS, 'Deposit settled', 'No deposit was taken.')
  }

  // 4. Balance. Owing money at close is a normal, allowed outcome — this shop
  //    runs accounts. What is not allowed is it happening without anybody
  //    noticing, so it needs a name against it rather than a block.
  const owed = round2((Number(r.price) || 0) + (Number(r.lateFee) || 0) +
    (Number(r.lostChargesTotal) || 0) - (Number(r.amountPaid) || 0))
  if (owed > 0) {
    add('balance', signed.has('balance') ? PASS : VERIFY, 'Balance agreed',
      `£${owed.toFixed(2)} will stay on the customer's account.`)
  } else if (owed < 0) {
    add('balance', signed.has('balance') ? PASS : VERIFY, 'Balance agreed',
      `£${Math.abs(owed).toFixed(2)} overpaid — it will sit as credit on the account.`)
  } else {
    add('balance', PASS, 'Balance agreed', 'Paid in full.')
  }

  // A signed-off VERIFY becomes a PASS wherever the check consults `signed`.
  // The date check does not, because "the phone is back early" is a statement
  // about this moment: it is re-asked every time the dates change.
  for (const c of checks) {
    if (c.state === VERIFY && signed.has(c.id)) c.state = PASS
  }

  const blockers = checks.filter((c) => c.state === BLOCK)
  const needsVerification = checks.filter((c) => c.state === VERIFY)
  return {
    checks,
    blockers,
    needsVerification,
    canClose: blockers.length === 0 && needsVerification.length === 0,
  }
}

// The one-line summary for a log or an API error. Kept here so the server and
// the client word a refusal identically.
export function gateSummary(gate) {
  if (gate.blockers.length) {
    return `Cannot close yet — ${gate.blockers.map((c) => c.label.toLowerCase()).join('; ')}.`
  }
  if (gate.needsVerification.length) {
    return `Needs a sign-off — ${gate.needsVerification.map((c) => c.label.toLowerCase()).join('; ')}.`
  }
  return 'Ready to close.'
}
