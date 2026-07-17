// Canonical UK phone-number normalisation — ONE tested implementation of the
// rule the owner's converter tools each re-implemented slightly differently
// (six divergent copies across the Excel/CSV/VCF/NBF chain). Everything in KC
// that rewrites a phone number for export/transfer goes through here.
//
// Rules (superset of the owner's tools, in precedence order):
//   • empty → ''
//   • anything containing a letter is an alphanumeric sender ID (banks, shops)
//     and is returned trimmed but otherwise untouched
//   • punctuation (spaces, dots, dashes, brackets) is stripped; leading + kept
//   • 00…  → +…            (international dial prefix)
//   • +44… → +44…          (already canonical)
//   • 44…  → +44…          (bare country code)
//   • 0…   → +44…          when it looks like a UK national number (10–12 digits)
//   • anything else (+1…, +972…, short codes) passes through unchanged
//
// mode shapes the OUTPUT of numbers that ended up +44-canonical:
//   'plus44' (default) → +44xxxxxxxxxx     '0044' → 0044xxxxxxxxxx
//   'national'         → 0xxxxxxxxxx       'keep' → skip conversion entirely
export function normalizeUkNumber(raw, { mode = 'plus44' } = {}) {
  const s = String(raw == null ? '' : raw).trim()
  if (!s) return ''
  if (/[A-Za-z]/.test(s)) return s                       // alphanumeric sender
  if (mode === 'keep') return s.replace(/\s+/g, ' ')

  let n = s.replace(/[\s().\-]/g, '')
  if (n.startsWith('00')) n = '+' + n.slice(2)

  const digits = n.replace(/\D/g, '')
  if (!n.startsWith('+')) {
    if (n.startsWith('44') && digits.length >= 11) n = '+' + n
    else if (n.startsWith('0') && digits.length >= 10 && digits.length <= 12) n = '+44' + n.slice(1)
  }

  if (n.startsWith('+44')) {
    if (mode === '0044') return '0044' + n.slice(3)
    if (mode === 'national') return '0' + n.slice(3)
  }
  return n
}

// The digits-only comparison key the dedupe/thread logic uses: same number in
// any format (07…, +447…, 00447…) collapses to one key.
export function phoneKey(raw) {
  const n = normalizeUkNumber(raw)
  return /[A-Za-z]/.test(n) ? n.trim().toUpperCase() : n.replace(/\D/g, '')
}
