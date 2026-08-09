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
