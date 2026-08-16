// One spelling per carrier. Pure — no I/O.
//
// SIM provider is free text typed at the counter, and it drifted: `Lebara` 327
// rows and `lebara` 177, `three` 63 and `Three` 35, `giffgaf` / `giffgaff` /
// `Giffgaff` / `giffgaft`. Every per-provider count is wrong unless the caller
// remembers to lowercase, and the SIMs list shows the same carrier twice.
//
// The rule is deliberately EXACT-MATCH, not fuzzy: a value is canonicalised
// only if its squashed key (lowercase, letters and digits only) is in the table
// below. Anything else is returned untouched. That is what protects the values
// that are not carrier names but notes —
//
//     'Lebara Local x2'      two lines on one record
//     'Lebara .. 1pmobile'   moved from one carrier to the other
//     'Lebara International' a different plan, not a different carrier
//     'GCS336096'  'sichul'  'ukraine 24'  'Bussiness phone system + internet'
//
// — which a prefix or fuzzy match would flatten into "Lebara" and quietly
// destroy. Losing "x2" loses a line the shop bills for. Better to leave a
// handful of odd values alone than to lose one.
//
// Casing follows the brand: giffgaff and spusu really are lowercase; 1pMobile
// really has the capital M.
const CANON = {
  lebara: 'Lebara',
  onepmobile: '1pMobile',
  '1pmobile': '1pMobile',
  three: 'Three',
  smarty: 'Smarty',
  tello: 'Tello',
  giffgaff: 'giffgaff',
  giffgaf: 'giffgaff',   // typo on 5 rows
  giffgaft: 'giffgaff',  // typo on 3 rows
  talkhome: 'Talk Home',
  asda: 'Asda Mobile',
  asdamobile: 'Asda Mobile',
  usmobile: 'US Mobile',
  usmobilesimcard: 'US Mobile',
  spusu: 'spusu',
  golan: 'Golan',
  redpocket: 'Red Pocket',
  redpoced: 'Red Pocket',   // typo on 3 rows
  redpocked: 'Red Pocket',  // typo on 2 rows
  uksim: 'UK SIM',
  homelandline: 'Home Landline',
}

// Squash to a comparison key: case, spaces and punctuation all stop mattering,
// so "Red Pocket", "red pocket" and "redpocket" are one carrier.
export const providerKey = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '')

// The canonical spelling, or the original value unchanged when we do not
// recognise it. Never returns a guess.
export function canonProvider(v) {
  if (v === null || v === undefined) return v
  const s = String(v).trim()
  if (!s) return v
  return CANON[providerKey(s)] || s
}

// True when canonicalising would actually change the stored text — used to
// keep updates to the rows that need them.
export const providerNeedsFix = (v) => typeof v === 'string' && canonProvider(v) !== v

// The distinct canonical names, for a datalist or a report.
export const CANON_NAMES = [...new Set(Object.values(CANON))].sort((a, b) =>
  a.localeCompare(b, 'en-GB', { sensitivity: 'base' }))
