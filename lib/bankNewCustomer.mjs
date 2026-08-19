// Turning a bank row into a customer who is not in the book yet.
//
// The reconciliation screen guesses who sent money by matching the bank's
// counterparty against the customer list. When nobody matches, the operator
// used to be stuck: leave the row open, go to Customers, add the person, come
// back and find the row again. These two helpers let that happen in place —
// they decide what to prefill, and nothing else.

const EMAIL_RE = /[^\s<>()[\]:;,"]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+/i

// A typed name into first + last. Everything after the first word is the
// surname, so "Yechiel Chaim Halberstam" keeps "Chaim Halberstam" together
// rather than dropping the middle name — the shop's names routinely have
// three parts and losing one makes the customer unfindable later.
export function splitPersonName(input) {
  const parts = String(input == null ? '' : input).trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return { firstName: '', lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

// The payer's email, if the bank row carries one.
//
// Stripe rows arrive as counterparty "horowits" with the address in the
// description; a bank transfer usually has no address at all. Taking it when
// it is there means the new customer is reachable straight away, and it is
// the field the matcher will use next time money comes from the same person.
//
// Only an address that stands alone is used. A description like
// "REF hershl+fee@x.com pending" would still match a loose pattern, but the
// address is what the payment carries, not a sentence, so anything with
// surrounding words is left for a human rather than guessed at.
export function emailFromTransaction(txn) {
  for (const field of [txn?.description, txn?.counterparty]) {
    const s = String(field == null ? '' : field).trim()
    if (!s) continue
    const m = s.match(EMAIL_RE)
    if (m && m[0] === s) return s.toLowerCase()
  }
  return ''
}

// What the confirm dialog and the POST both need, from the typed name and the
// row. Returns null when there is no name to work with, so the caller has one
// thing to check rather than three.
export function newCustomerDraft(typedName, txn) {
  const { firstName, lastName } = splitPersonName(typedName)
  if (!firstName) return null
  const email = emailFromTransaction(txn)
  return { firstName, lastName, email, fullName: lastName ? `${firstName} ${lastName}` : firstName }
}
