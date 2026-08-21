// Who the business legally is, written once.
//
// It was scattered: "Hatsluche Ltd" appears on /terms, /privacy, /refund,
// /welcome, /repair and in the LocalBusiness schema, and the COMPANY NUMBER
// appeared in none of them. A UK limited company has to disclose its registered
// name, its registered number and its place of registration on its website and
// on its business letters and order forms — and a receipt asking somebody for
// money is a business letter. So this is a compliance gap, not decoration.
//
// Found by reading an invoice the owner was sent (Simplifly Travel Ltd, via
// FreeAgent, 21 Aug): it carries "Company Registration Number: 16451411" in an
// "Other Information" block beside the payment details. KC's receipts carried
// neither.
//
// CONFIRMED against Companies House, 21 Aug — by the owner on the register
// itself, and independently here by search (the register's own listing at
// find-and-update.company-information.service.gov.uk/company/14138193). Direct
// fetching is blocked by this environment's egress policy, so search was the
// route. HATSLUCHE LTD, 14138193, private limited company, incorporated
// 27 May 2022, England and Wales. The place of registration was originally
// inferred from the number's shape — a bare 8-digit number is England and
// Wales, where Scotland is SC… and Northern Ireland NI… — and the inference
// held.
export const COMPANY = {
  tradingName: 'Kosher Connect',
  legalName: 'Hatsluche Ltd',
  number: '14138193',
  registeredIn: 'England and Wales',
  // The shop. Deliberately NOT called the registered office — and checking on
  // 21 Aug showed why that caution was worth keeping: **they are different
  // addresses.** Companies House holds 158 Cromwell Road, Salford M6 6DE as the
  // registered office; the shop trades from Bury New Road.
  //
  // That leaves the disclosure INCOMPLETE, because the rules ask for the
  // registered office and this is not it. The missing piece is deliberately not
  // filled in here: the registered office may be a private home, and publishing
  // somebody's home address on a live public website is the owner's decision to
  // make, not a gap for a script to close. Two ways out — publish it, or move
  // the registered office to an agent's address and publish that — and both are
  // his. Raised with him 21 Aug.
  tradingAddress: '421 Bury New Road, Salford M7 4ED',
  // registeredOffice: intentionally absent — see above.
  phoneShown: '0161 531 1386',
  phoneTel: '+441615311386',
  email: 'support@kosher-connect.com',
}

/** "Hatsluche Ltd · Registered in England and Wales, company number 14138193" */
export function registeredLine() {
  return `${COMPANY.legalName} · Registered in ${COMPANY.registeredIn}, company number ${COMPANY.number}`
}

/** The short form, for a place that has already named the company. */
export function companyNumberLine() {
  return `Company number ${COMPANY.number} · Registered in ${COMPANY.registeredIn}`
}

/**
 * The whole legal identifier as ONE English sentence, for a footer that
 * introduces it in either language.
 *
 * It exists because of a bidi bug. The Hebrew footer read
 * "…שם מסחרי של Hatsluche Ltd." — an English name and a full stop sitting at
 * the end of a right-to-left paragraph — and the browser put the stop on the
 * WRONG SIDE: ".Hatsluche Ltd". Adding the company number after it made the
 * displaced stop land mid-line where it was finally noticeable. Keeping every
 * English word, including its punctuation, inside one run wrapped in <bdi>
 * fixes it, so the Hebrew string now stops at "של" and this supplies the rest.
 */
export function legalIdentifier() {
  return `${COMPANY.legalName}. ${companyNumberLine()}.`
}
