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
  // The shop — where a customer actually goes. NOT the registered office; the
  // two are different, which is why this field is named for what it is.
  tradingAddress: '421 Bury New Road, Salford M7 4ED',
  // The registered office, which is what the trading-disclosure rules ask for
  // and the shop address does not satisfy. It is the ACCOUNTANT'S address —
  // ordinary practice for a small company here, and the reason it can be
  // published: the objection to filling this in was that a registered office is
  // often somebody's home, and this one is not (owner, 21 Aug).
  //
  // Kept apart from tradingAddress on purpose, and always labelled where it is
  // printed. An unlabelled second address on a shop's website is an invitation
  // to turn up at the wrong door.
  registeredOffice: '158 Cromwell Road, Salford M6 6DE',
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

/**
 * The full disclosure: name, number, place of registration, registered office.
 *
 * What the rules actually ask a company to publish. `legalIdentifier()` is the
 * short form for a footer that also links to the legal pages; this is the long
 * form for those pages themselves, and for a receipt — which is a business
 * letter, and has no linked page to defer to.
 */
export function registeredOfficeLine() {
  return `Registered office: ${COMPANY.registeredOffice}`
}
