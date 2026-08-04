// myPOS ePOS API adapter — the till pushes a sale amount to the card terminal
// and polls for the outcome (the ePOS API has no webhooks; polling is the
// documented pattern). Spec: ePOS_Swagger.json from developers.mypos.com.
//
//   POST /epos/v1/payments        start a payment on a terminal (TID)
//   GET  /epos/v1/payments/{id}   status: InProgress | Success | Canceled |
//                                 Failed | Reversed | Rejected
//   DELETE /epos/v1/payments/{id} cancel a payment still in progress
//
// Env (Vercel only — absent means the feature is OFF and the till behaves
// exactly as before):
//   MYPOS_EPOS_MODE        'mock' | 'demo' | 'live'   (default: off)
//   MYPOS_EPOS_SESSION     X-Session token   (from the Partners Portal integration)
//   MYPOS_EPOS_PARTNER_ID  X-Partner-Id
//   MYPOS_EPOS_APP_ID      X-Application-Id
//   MYPOS_TERMINAL_ID      8-digit TID of the shop terminal
//
// 'mock' needs no credentials: payments are stateless make-believe (the id
// encodes its own creation time; ~6s later it reads Success, or Failed when
// the reference contains DECLINE). It exists so the whole till flow can be
// exercised before the Partners Portal integration is registered. Amounts are
// integer pence (the API's minor units); currency is GBP.

const MODE = (process.env.MYPOS_EPOS_MODE || '').trim().toLowerCase()
const BASES = {
  demo: 'https://demo-api-gateway.mypos.com',
  live: 'https://api-gateway.mypos.com',
}

export const eposMode = ['mock', 'demo', 'live'].includes(MODE) ? MODE : null

const SESSION = (process.env.MYPOS_EPOS_SESSION || '').trim()
const PARTNER = (process.env.MYPOS_EPOS_PARTNER_ID || '').trim()
const APP_ID = (process.env.MYPOS_EPOS_APP_ID || '').trim()
const TID = (process.env.MYPOS_TERMINAL_ID || '').trim()

// Enabled = a mode is chosen AND (mock, or all four credentials present).
export const eposEnabled =
  eposMode === 'mock' || (!!eposMode && !!(SESSION && PARTNER && APP_ID && TID))

// ── Pure helpers (unit-tested) ──────────────────────────────────────────────

// The till only cares about three shapes: still waiting, approved, or a
// terminal "no" with a reason it can show the operator.
export function mapEposStatus(status) {
  switch (String(status || '')) {
    case 'InProgress': return { done: false }
    case 'Success': return { done: true, approved: true }
    case 'Canceled': return { done: true, approved: false, error: 'Cancelled on the terminal' }
    case 'Reversed': return { done: true, approved: false, error: 'Payment was reversed' }
    case 'Rejected': return { done: true, approved: false, error: 'Rejected by the terminal' }
    case 'Failed': return { done: true, approved: false, error: 'Card declined or failed' }
    default: return { done: false, unknown: true }
  }
}

// Mock ids carry their own birth time so status needs no storage — serverless
// instances answering different polls all agree on the clock.
export function mockPaymentId(reference, now = Date.now()) {
  return `mock-${now}-${reference}`
}
export function mockStatusFor(paymentId, now = Date.now()) {
  const m = /^mock-(\d+)-(.*)$/.exec(String(paymentId || ''))
  if (!m) return null
  const elapsed = now - Number(m[1])
  if (elapsed < 6000) return 'InProgress'
  return /DECLINE/i.test(m[2]) ? 'Failed' : 'Success'
}

// ── HTTP calls ──────────────────────────────────────────────────────────────

async function eposFetch(path, opts = {}) {
  const r = await fetch(`${BASES[eposMode]}${path}`, {
    ...opts,
    headers: {
      'X-Session': SESSION,
      'X-Partner-Id': PARTNER,
      'X-Application-Id': APP_ID,
      ...(opts.body ? { 'Content-Type': 'application/json; x-api-version=1' } : {}),
      ...(opts.headers || {}),
    },
  })
  const text = await r.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { /* non-JSON error body */ }
  if (!r.ok) {
    const detail = (data && (data.detail || data.title)) || text.slice(0, 200) || `HTTP ${r.status}`
    throw new Error(`[mypos] ${r.status}: ${detail}`)
  }
  return data
}

// Start a payment on the shop terminal. reference is our PAY-SALE-… charge
// reference — it rides along so myPOS statements reconcile line-by-line with
// card_receipts, same as the wrapper lane.
export async function createEposPayment({ amountPence, reference, description }) {
  if (eposMode === 'mock') return { payment_id: mockPaymentId(reference), status: 'InProgress' }
  return eposFetch('/epos/v1/payments', {
    method: 'POST',
    body: JSON.stringify({
      reference_number: String(reference).slice(0, 50),
      amount: { value: amountPence, currency_code: 'GBP' },
      description: String(description || 'Kosher Connect till sale').slice(0, 100),
      terminal_id: TID,
      app_name: 'KosherConnect',
      app_version: '1',
    }),
  })
}

export async function getEposPayment(paymentId) {
  if (eposMode === 'mock') {
    const status = mockStatusFor(paymentId)
    return status ? { payment_id: paymentId, status } : null
  }
  return eposFetch(`/epos/v1/payments/${encodeURIComponent(paymentId)}`)
}

export async function cancelEposPayment(paymentId) {
  if (eposMode === 'mock') return { payment_id: paymentId, status: 'Canceled' }
  return eposFetch(`/epos/v1/payments/${encodeURIComponent(paymentId)}`, { method: 'DELETE' })
}
