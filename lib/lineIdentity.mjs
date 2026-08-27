// What makes two phone lines the same line — and what is allowed to repeat.
//
// Shloime, testing on 27 August: the Phone Rentals inventory had the same
// number listed twice (+1 845 828 1823, both in Pool 37, both available). He
// deleted one by hand and asked why it was possible. It was possible because
// nothing anywhere said it was not: `lines` carries exactly one unique
// constraint, on `legacy_id`, which is an id this app generates. The number —
// the thing that actually identifies a line to a carrier and to a customer —
// had none.
//
// His rule, in his words: "Phone number and ICID (numbers only) has to be
// unique - no double, email address (must include @) and pool can be double."
//
// DIGITS ONLY is the important half. "+1 845 828 1823", "1 845 828 1823" and
// "18458281823" are one line at US Mobile and three different strings here, so
// comparing what was typed would catch only the laziest duplicate. Everything
// below compares digits.
//
// A pool repeating is not a mistake — a pool is a group and groups have
// members. An email repeating is not a mistake either: one carrier login runs
// many lines, which is the whole point of a master account. An email without an
// @ IS a mistake, and it is the kind that is only discovered when a password
// reset goes nowhere.

/** Digits only, or '' — the form in which two identifiers are compared. */
export const digits = (v) => String(v ?? '').replace(/\D/g, '')

/** An email the shop could actually send to. Empty is allowed; malformed is not. */
export function emailLooksReal(v) {
  const s = String(v ?? '').trim()
  if (!s) return true                    // not given is not the same as wrong
  return /^[^@\s]+@[^@\s]+$/.test(s)
}

/**
 * Every clash in a set of lines, against each other and against what is stored.
 *
 * `incoming` and `existing` are app-shaped phone objects: { id, number, simId,
 * email }. `existing` rows sharing an id with an incoming one are ignored —
 * saving a line over itself is not a duplicate of itself, and the first draft
 * of this refused every edit for exactly that reason.
 *
 * Returns [] when clean. Each finding is a sentence a person can act on: it
 * names the number, because "duplicate ICCID" tells nobody which phone to go
 * and look at.
 */
export function lineClashes(incoming, existing = []) {
  const out = []
  const seen = { number: new Map(), iccid: new Map() }

  const label = (p) => p?.number || p?.simId || p?.id || 'a line'
  const ids = new Set(incoming.map((p) => String(p?.id)))

  // Stored lines first, so a clash is reported against the one already there.
  for (const p of existing) {
    if (ids.has(String(p?.id))) continue
    const n = digits(p?.number); if (n) seen.number.set(n, p)
    const i = digits(p?.simId); if (i) seen.iccid.set(i, p)
  }

  for (const p of incoming) {
    const n = digits(p?.number)
    if (n) {
      const clash = seen.number.get(n)
      if (clash) out.push(`${p.number} is already on another line — a phone number can only be on one.`)
      else seen.number.set(n, p)
    }
    const i = digits(p?.simId)
    if (i) {
      const clash = seen.iccid.get(i)
      if (clash) out.push(`ICCID ${p.simId} is already on ${label(clash)} — one SIM cannot be in two phones.`)
      else seen.iccid.set(i, p)
    }
    if (!emailLooksReal(p?.email)) {
      out.push(`"${String(p.email).trim()}" on ${label(p)} is not an email address — it needs an @.`)
    }
  }
  return out
}
