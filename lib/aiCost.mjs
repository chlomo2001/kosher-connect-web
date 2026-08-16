// Turning metered tokens into money. Pure — no I/O, no database, no Gemini.
//
// Google bills per MILLION tokens, at a different rate for what you send and
// what you get back, and the rate depends on which model answered. The client
// falls through a candidate list when Google rotates model names, so a month's
// usage can genuinely span two models.
//
// These are published list prices, in US dollars per million tokens, recorded
// on 16 Aug 2026. They are the ONE thing in here that goes stale, which is why
// they sit in a named table with a date on them rather than inline in a sum: if
// the figure on the card ever looks wrong, this is the only place to look.
// Anything not listed falls back to FLASH_DEFAULT rather than reporting £0 —
// a silent zero would read as "free", which is the one answer that is certainly
// wrong.
export const PRICED_ON = '2026-08-16'

export const RATES_USD_PER_M = {
  'gemini-2.5-flash':    { in: 0.30, out: 2.50 },
  'gemini-2.0-flash':    { in: 0.10, out: 0.40 },
  'gemini-1.5-flash':    { in: 0.075, out: 0.30 },
  'gemini-flash-latest': { in: 0.30, out: 2.50 },
}
const FLASH_DEFAULT = { in: 0.30, out: 2.50 }

// Model names arrive with suffixes Google adds over time
// ("gemini-2.5-flash-001", "…-preview-09-2025"). Match the longest known prefix
// so a point release bills at its family's rate instead of falling back.
export function rateFor(model) {
  const m = String(model || '').toLowerCase()
  let best = null
  for (const name of Object.keys(RATES_USD_PER_M)) {
    if (m.startsWith(name) && (!best || name.length > best.length)) best = name
  }
  return best ? RATES_USD_PER_M[best] : FLASH_DEFAULT
}

// USD, not rounded — callers total many rows before converting, and rounding
// each row to the penny would lose most of the value of a metered call.
export function costUsd({ model, promptTokens = 0, outputTokens = 0 }) {
  const r = rateFor(model)
  return ((Number(promptTokens) || 0) * r.in + (Number(outputTokens) || 0) * r.out) / 1_000_000
}

// The shop thinks in pounds. The rate is a setting rather than a live FX call:
// this is a £2-a-month figure and a daily FX round-trip to make it £2.03 would
// be a worse trade than the approximation. Stated on the card so nobody reads
// it as exact.
export const USD_TO_GBP_DEFAULT = 0.79

export function toGbp(usd, rate = USD_TO_GBP_DEFAULT) {
  return Math.round((Number(usd) || 0) * (Number(rate) || USD_TO_GBP_DEFAULT) * 100) / 100
}

// Roll metered rows up per feature, biggest spender first — the order that
// answers "what is costing me money" without reading the numbers.
export function summarise(rows, { fxRate = USD_TO_GBP_DEFAULT } = {}) {
  const byFeature = new Map()
  let usd = 0
  let tokens = 0
  for (const r of rows || []) {
    const one = costUsd({ model: r.model, promptTokens: r.prompt_tokens, outputTokens: r.output_tokens })
    usd += one
    tokens += Number(r.total_tokens) || 0
    const key = r.feature || 'unknown'
    const f = byFeature.get(key) || { feature: key, calls: 0, tokens: 0, usd: 0 }
    f.calls += 1
    f.tokens += Number(r.total_tokens) || 0
    f.usd += one
    byFeature.set(key, f)
  }
  return {
    calls: (rows || []).length,
    tokens,
    usd,
    gbp: toGbp(usd, fxRate),
    features: [...byFeature.values()]
      .map((f) => ({ ...f, gbp: toGbp(f.usd, fxRate) }))
      .sort((a, b) => b.usd - a.usd || a.feature.localeCompare(b.feature)),
  }
}
