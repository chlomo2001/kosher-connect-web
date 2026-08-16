// Where an @kosher-connect.com address delivers to. Pure — no I/O.
//
// Normally a mailbox. It can also be an https URL, which is how carrier mail
// reaches the app: Forward Email posts the message to /api/inbound/mail instead
// of dropping it in an inbox (docs/INBOUND-MAIL.md). Until now this screen
// rejected anything without an @, so the webhook alias could only be made in
// Forward Email's own dashboard.
//
// THE CASE TRAP. The old rule lowercased every recipient, which is correct and
// harmless for email — mailbox names are case-insensitive — and destroys a URL.
// Paths and query strings ARE case-sensitive, and the webhook URL carries the
// shared secret in `?key=`, so lowercasing it turns a working alias into one
// that silently 401s on every message. Emails are lowercased; URLs are kept
// exactly as typed.
//
// https only, never http: the secret rides in the query string, and over http
// it would cross the network in the clear.

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export const isWebhookRecipient = (v) => /^https:\/\/[^\s]+$/i.test(String(v || '').trim())

/** True for a plausible mailbox OR an https URL. */
export function isValidRecipient(v) {
  const s = String(v || '').trim()
  return EMAIL_RE.test(s) || isWebhookRecipient(s)
}

/**
 * Split, validate and normalise a recipients field.
 *
 * Accepts an array or a delimited string. Splitting is on commas and
 * WHITESPACE for emails — but a URL can contain neither, so that is safe.
 */
export function cleanRecipients(v) {
  const parts = Array.isArray(v) ? v : String(v || '').split(/[,\s]+/)
  return parts
    .map((r) => String(r).trim())
    .filter(isValidRecipient)
    // Mailboxes fold to lowercase as before; a URL is returned untouched.
    .map((r) => (isWebhookRecipient(r) ? r : r.toLowerCase()))
}

/**
 * Why a recipient was rejected, for a message worth reading. Returns null when
 * it is fine.
 */
export function recipientProblem(v) {
  const s = String(v || '').trim()
  if (!s) return 'Enter an address or an https:// webhook URL.'
  if (/^http:\/\//i.test(s)) return 'Use https:// — an http URL would send the secret in the clear.'
  if (/^[a-z]+:\/\//i.test(s) && !isWebhookRecipient(s)) return 'Only https:// URLs can receive mail.'
  if (!isValidRecipient(s)) return `"${s}" is neither an email address nor an https:// URL.`
  return null
}
