// The business's OWN Gmail bases — carrier/service login addresses the shop
// opens FOR customers (dot/plus variants of these are never the customer's
// real contact address). One list for every server-side check; public/main.js
// mirrors it for the form because the browser has no bundler — change both
// together (same pattern as capName).
export const OWN_EMAIL_BASES = [
  'gittbilig', 'gittbili', // second is a typo'd sibling that's live on real accounts
  'kosherconnect', 'ch7023518', 'hashomrimmcr',
  'redfarbilig', 'shevabruches111', 'heimishecentre', 'elimelechgrunnfeld',
  'yehoishebroier', 'mendlhersh', 'shloimea1', 'shlomeshnek', 'shmuelbleier1',
  'eliezeroppmann', 'touchdesignsstudio',
]

export function isOwnAccountEmail(email) {
  const m = String(email || '').toLowerCase().trim().match(/^([^@]+)@(gmail|googlemail)\.com$/)
  if (!m) return false
  return OWN_EMAIL_BASES.includes(m[1].split('+')[0].replace(/\./g, ''))
}
