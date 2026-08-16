// Is the number we call them on one of the lines we run for them? Pure.
//
// The shop has two different ideas both stored as "a phone number":
//
//   contact number — how you reach the person
//   SIM number     — a line the shop provides and bills them for
//
// They are usually the SAME number, and the app has never said which is which.
// On today's data: of 609 customers, 440 have a contact number that IS one of
// their SIMs with us, only 4 have SIMs and a contact number from somewhere
// else, and 143 have no contact number at all.
//
// That 143 is the important pile. A customer with three active SIMs and an
// empty phone field looks reachable — there are numbers all over their record
// — but every one of them is a line we sell them, not necessarily a handset
// they answer. Chaim Shimon Lebrecht is the case that surfaced this: three
// Lebara SIMs, no contact number, and the number he actually answers was never
// written down anywhere in the app.
//
// Comparison is on the last 10 digits, the same key used everywhere else in KC,
// so 07…, +447…, 447… and 00447… all meet.

export const tail10 = (v) => {
  const digits = String(v == null ? '' : v).replace(/\D/g, '')
  return digits.length >= 10 ? digits.slice(-10) : ''
}

/**
 * How does this customer's contact number relate to the SIMs we run for them?
 *
 *   { kind: 'none' }     no contact number on record — we cannot ring them,
 *                        however many of our SIMs they hold
 *   { kind: 'ours' }     the contact number IS one of our SIMs (+ which one)
 *   { kind: 'outside' }  they answer a number we do not provide
 *
 * `sims` is the customer's own SIMs: [{ id, simNumber, provider, status }].
 */
export function classifyContact(contactNumber, sims = []) {
  const contact = tail10(contactNumber)
  if (!contact) return { kind: 'none', contact: '' }
  const hit = (sims || []).find((s) => tail10(s?.simNumber || s?.number) === contact)
  if (hit) {
    return {
      kind: 'ours',
      contact,
      simId: hit.id ?? null,
      provider: hit.provider || '',
      status: hit.status || '',
    }
  }
  return { kind: 'outside', contact }
}

/** Is this particular SIM the number the customer actually answers on? */
export const isContactSim = (sim, contactNumber) => {
  const c = tail10(contactNumber)
  return !!c && tail10(sim?.simNumber || sim?.number) === c
}

/** One short phrase for the UI, so every surface says the same thing. */
export function contactLabel(result) {
  if (!result || result.kind === 'none') return 'No contact number on record'
  if (result.kind === 'ours') {
    return result.provider ? `Also their ${result.provider} SIM with us` : 'Also a SIM with us'
  }
  return 'Their own line — not a SIM we provide'
}
