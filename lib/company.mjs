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
// NUMBER SUPPLIED BY THE OWNER, 21 Aug. It could not be checked against
// Companies House from here — this environment's egress policy allows a fixed
// list of hosts and blocks the rest, so nothing can reach the register.
//
// PLACE OF REGISTRATION IS INFERRED from the number's shape: a bare 8-digit
// number is England and Wales, where Scotland is SC…, Northern Ireland NI… and
// so on. Worth an owner's glance rather than a silent assumption.
export const COMPANY = {
  tradingName: 'Kosher Connect',
  legalName: 'Hatsluche Ltd',
  number: '14138193',
  registeredIn: 'England and Wales',
  // The shop, and the address already printed everywhere. NOT asserted to be
  // the registered office — that is whatever Companies House holds, and this
  // module has no way to know whether the two are the same. If they differ, the
  // registered office is the one the disclosure rules ask for, and it wants
  // adding here as its own field rather than overwriting this one.
  tradingAddress: '421 Bury New Road, Salford M7 4ED',
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
