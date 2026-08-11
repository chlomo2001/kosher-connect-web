// Passport MRZ (machine-readable zone) parser — the two 44-character lines at
// the bottom of every passport photo page (ICAO TD3). The Scan Reader feeds
// OCR text through this: the MRZ is fixed-width and check-digited, so parsing
// it beats guessing names and dates out of free-form OCR prose.
//
// Deliberately forgiving about OCR noise: spaces inside a line are stripped
// (tesseract loves inserting them around '<'), and the common letter/digit
// confusions are corrected per field (digits expected → O→0, I/L→1, S→5,
// B→8; letters expected → 0→O, 1→I).

const fixDigits = (s) => s.replace(/O/g, '0').replace(/[IL]/g, '1').replace(/S/g, '5').replace(/B/g, '8').replace(/Z/g, '2')
const fixLetters = (s) => s.replace(/0/g, 'O').replace(/1/g, 'I').replace(/8/g, 'B')

function yymmddToIso(yymmdd, { pastOnly = false } = {}) {
  if (!/^\d{6}$/.test(yymmdd)) return null
  const yy = Number(yymmdd.slice(0, 2))
  const mm = yymmdd.slice(2, 4)
  const dd = yymmdd.slice(4, 6)
  if (Number(mm) < 1 || Number(mm) > 12 || Number(dd) < 1 || Number(dd) > 31) return null
  // Century pivot: a birth date is always in the past; an expiry is assumed
  // 20xx (passports are valid ≤10 years, so a 19xx expiry cannot be current).
  const nowYY = new Date().getFullYear() % 100
  const century = pastOnly ? (yy > nowYY ? 1900 : 2000) : 2000
  return `${century + yy}-${mm}-${dd}`
}

// The MRZ check digit (weights 7-3-1; A=10..Z=35, '<'=0). Used to score
// candidate line pairs, not to reject outright — OCR noise fails checksums
// on perfectly readable documents, so a failed check lowers confidence
// instead of throwing the parse away.
function checkDigit(s) {
  const val = (ch) => ch === '<' ? 0 : /\d/.test(ch) ? Number(ch) : ch.charCodeAt(0) - 55
  const w = [7, 3, 1]
  let sum = 0
  for (let i = 0; i < s.length; i++) sum += val(s[i]) * w[i % 3]
  return String(sum % 10)
}

// parseMRZ(ocrText) → null, or:
// { surname, givenNames, passportNumber, nationality, dob, sex, expiry,
//   issuingCountry, checksumOk }
export function parseMRZ(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.toUpperCase().replace(/[\s«]/g, '').replace(/[^A-Z0-9<]/g, ''))
    .filter((l) => l.length >= 30)

  for (let i = 0; i < lines.length; i++) {
    const l1 = lines[i]
    if (!/^P[A-Z<]/.test(l1) || !l1.includes('<<')) continue
    const l2 = lines[i + 1]
    if (!l2 || !/\d/.test(l2)) continue

    // Line 1: P<ISSUER SURNAME<<GIVEN<NAMES<<<<…  (pad to 44)
    const a = l1.padEnd(44, '<')
    const issuingCountry = fixLetters(a.slice(2, 5)).replace(/</g, '')
    const nameField = a.slice(5)
    const sep = nameField.indexOf('<<')
    if (sep < 1) continue
    const clean = (s) => fixLetters(s).replace(/</g, ' ').replace(/\s+/g, ' ').trim()
    const surname = clean(nameField.slice(0, sep))
    const givenNames = clean(nameField.slice(sep + 2))
    if (!surname) continue

    // Line 2: NUMBER(9) CK NAT(3) DOB(6) CK SEX EXP(6) CK …
    const b = l2.padEnd(44, '<')
    const passportNumber = b.slice(0, 9).replace(/</g, '')
    const nationality = fixLetters(b.slice(10, 13)).replace(/</g, '')
    const dobRaw = fixDigits(b.slice(13, 19))
    const sex = b[20] === 'F' ? 'F' : b[20] === 'M' ? 'M' : ''
    const expRaw = fixDigits(b.slice(21, 27))
    const dob = yymmddToIso(dobRaw, { pastOnly: true })
    const expiry = yymmddToIso(expRaw)
    if (!dob && !expiry && !passportNumber) continue

    const checksumOk =
      checkDigit(b.slice(0, 9)) === fixDigits(b[9] || '') &&
      checkDigit(dobRaw) === fixDigits(b[19] || '') &&
      checkDigit(expRaw) === fixDigits(b[27] || '')

    return { surname, givenNames, passportNumber, nationality, dob, sex, expiry, issuingCountry, checksumOk }
  }
  return null
}
