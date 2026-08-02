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
//   • 05x + 8 digits → +972…   Israeli mobile in national form (10 digits —
//     UK 05 corporate numbers are 11, so no UK number matches this shape)
//   • 0[23489] + 7 digits → +972…  Israeli landline (9 digits — UK nationals
//     are never shorter than 10, so this shape is never UK either)
//   • 0…   → +44…          when it looks like a UK national number (10–12 digits)
//   • a trunk zero left inside a country code (+44 (0)161…, +972 0 52…) is
//     dropped — it's a dialling annotation, not part of the number
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
    // Israeli nationals BEFORE the UK catch-all: this customer base carries
    // 05x mobiles daily, and the old 0→+44 rule silently corrupted them into
    // non-numbers that reached the shop phone's contacts (sweep 2026-08-02
    // #18). Both shapes are unreachable by any real UK number (see header).
    else if (/^05\d{8}$/.test(n)) n = '+972' + n.slice(1)
    else if (/^0[23489]\d{7}$/.test(n)) n = '+972' + n.slice(1)
    else if (n.startsWith('0') && digits.length >= 10 && digits.length <= 12) n = '+44' + n.slice(1)
  }

  // "+44 (0)161…" style keeps the trunk zero inside the country code once the
  // punctuation is stripped — drop it; no number has a 0 after +44 or +972.
  if (n.startsWith('+440')) n = '+44' + n.slice(4)
  else if (n.startsWith('+9720')) n = '+972' + n.slice(5)

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

// DISPLAY-ONLY grouping — storage stays canonical (+447974924585); this is
// what humans read on screen. UK mobiles get the memorable 4-3-3 split the
// owner asked for (+44 7974 924 585); UK landlines 3-3-4 (+44 161 531 1386);
// Israeli +972 and US +1 numbers get their usual grouping; anything else is
// shown normalized but ungrouped. NEVER feed the result back into storage —
// phoneKey/normalizeUkNumber both collapse it, so a round-trip is safe.
export function formatPhoneDisplay(raw) {
  const s = String(raw == null ? '' : raw).trim()
  if (!s) return ''
  if (/[A-Za-z]/.test(s)) return s                       // alphanumeric sender
  const n = normalizeUkNumber(s)
  if (!n.startsWith('+')) return s                        // short codes etc.
  const cc = ['+972', '+44', '+1'].find((c) => n.startsWith(c))
  if (!cc) return n
  const rest = n.slice(cc.length).replace(/\D/g, '')
  const group = (str, sizes) => {
    const out = []
    let i = 0
    for (const sz of sizes) {
      if (i >= str.length) break
      out.push(str.slice(i, i + sz))
      i += sz
    }
    if (i < str.length) out.push(str.slice(i))
    return out.join(' ')
  }
  if (cc === '+44' && rest.length === 10) return '+44 ' + (rest[0] === '7' ? group(rest, [4, 3, 3]) : group(rest, [3, 3, 4]))
  // Israeli mobiles carry a 2-digit prefix (+972 52 511 5445); landlines a
  // 1-digit area code (+972 2 500 5656) — the length tells them apart.
  if (cc === '+972' && rest.length === 9) return '+972 ' + group(rest, [2, 3, 4])
  if (cc === '+972' && rest.length === 8) return '+972 ' + group(rest, [1, 3, 4])
  if (cc === '+1' && rest.length === 10) return '+1 ' + group(rest, [3, 3, 4])
  return `${cc} ${rest}`
}
