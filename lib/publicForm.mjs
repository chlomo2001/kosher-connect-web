// Shared input guards for the public, unauthenticated forms
// (/api/public/message and /api/public/repair). This is the authoritative
// validation — the client-side forms mirror it for instant feedback, but only
// this copy is enforced. One copy on purpose: the two endpoints promise the
// same contract ("a name has a real letter, a contact is a plausible phone or
// email"), and carrying the rules twice let them drift.
//
// A name must carry at least one real letter (Latin or Hebrew) — blocks "/",
// "123", punctuation-only, etc. An email needs local@domain.tld; a phone needs
// at least 7 digits (checked by the caller via digitCount).
export const cap = (v, n) => String(v || '').trim().slice(0, n)
export const hasLetter = (s) => /[a-zA-Z֐-׿]/.test(s)
export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)
export const digitCount = (s) => (String(s).match(/\d/g) || []).length

// Best-effort match of a public submission against existing customers — a
// hint for staff, never revealed to the sender (these endpoints must not
// become membership oracles). Email first (exact on the normalized column),
// then phone: fetch the handful of customers sharing the last four digits and
// compare full phoneKeys in memory, because the stored number's formatting is
// not trustworthy enough for an exact SQL match. Advisory by design: any DB
// hiccup returns null rather than failing the submission.
export async function findCustomerMatch(db, phoneKey, emailNorm, key) {
  let match = null
  try {
    if (emailNorm) {
      const rows = await db.select('customers',
        `select=legacy_id,first_name,last_name&email_normalized=eq.${encodeURIComponent(emailNorm)}&limit=1`)
      if (rows.length) match = rows[0]
    }
    if (!match && key && key.length >= 7) {
      const tail = key.slice(-4)
      const rows = await db.select('customers',
        `select=legacy_id,first_name,last_name,phone_country_code,phone_number&phone_number=ilike.*${encodeURIComponent(tail)}*&limit=25`)
      match = rows.find((r) => phoneKey(`${r.phone_country_code || ''} ${r.phone_number || ''}`) === key) || null
    }
  } catch { /* matching is advisory */ }
  return match
}
