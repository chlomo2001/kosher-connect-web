// Pure validation for terminal (myPOS) card results — testable without DB.
//
// The one non-negotiable: no matter what a terminal, wrapper bug, or crafted
// request sends, nothing longer than the last 4 digits of a card number is
// ever stored. Everything else is length-clamped free text straight from the
// myPOS SDK result.

export function sanitizeCardResult(b = {}) {
  const ref = typeof b.chargeReference === 'string' ? b.chargeReference.trim() : ''
  if (!/^[\w-]{8,128}$/.test(ref)) return { ok: false, error: 'Bad or missing chargeReference.' }

  const approved = b.approved === true
  const amount = Number(b.amount)
  const amountOk = Number.isFinite(amount) && amount > 0 && amount < 100000
  if (approved && !amountOk) return { ok: false, error: 'An approved result needs a valid amount.' }

  const digits = String(b.last4 == null ? '' : b.last4).replace(/\D/g, '')
  const s = (v, n) => {
    const t = String(v == null ? '' : v).trim()
    return t ? t.slice(0, n) : null
  }
  return {
    ok: true,
    row: {
      charge_reference: ref,
      approved,
      amount: amountOk ? Math.round(amount * 100) / 100 : null,
      mypos_ref: s(b.myposRef, 64),
      stan: s(b.stan, 32),
      auth_code: s(b.authCode, 32),
      card_brand: s(b.brand, 24),
      last4: digits ? digits.slice(-4) : null,
      error: approved ? null : s(b.error, 200),
    },
  }
}
