// Shared Google Gemini client for the app's AI features (Scan Reader OCR and the
// customer-reply drafter). The API key lives ONLY in the environment
// (GEMINI_API_KEY), never in code or the client, and every caller is staff-gated
// so this can't become an open Gemini proxy.
//
// Model resolution is self-healing. Google constantly rotates model names and,
// increasingly, ships models that ONLY speak the newer "Interactions API" and
// reject the classic generateContent endpoint. So we don't trust a single name:
// we build an ordered list of candidate flash models (seed + whatever ListModels
// says this key can call), try them in turn, and SKIP any that answer "not found"
// or "only supports Interactions API" — falling through to one that actually
// responds. Genuine key/billing/quota errors stop immediately (no point hammering
// every model). The first model that works is cached for warm reuse.
const PREFERRED = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-flash-latest']
const SEED_MODEL = process.env.GEMINI_MODEL || PREFERRED[0]
const BASE = 'https://generativelanguage.googleapis.com/v1beta'
const MAX_TRIES = 8

export const geminiEnabled = !!process.env.GEMINI_API_KEY

// Meter our own usage. Google reports no spend or quota through this endpoint —
// that lives in Cloud billing, behind a service account with far wider reach
// than the key here — but every response carries `usageMetadata` with the exact
// token counts for the call, and we used to drop it.
//
// Fire-and-forget, and deliberately so: a meter must never be able to break the
// thing it measures. If the write fails (table missing, database down) the AI
// answer still goes back to whoever asked for it, and the only casualty is one
// row of accounting.
async function meter(feature, model, usage) {
  if (!usage) return
  try {
    const { db, tablesMode } = await import('./db.js')
    if (!tablesMode) return
    await db.insert('ai_usage', [{
      feature: String(feature || 'unknown').slice(0, 60),
      model: String(model || '').slice(0, 60),
      prompt_tokens: Number(usage.promptTokenCount) || 0,
      output_tokens: Number(usage.candidatesTokenCount) || 0,
      total_tokens: Number(usage.totalTokenCount) || 0,
    }])
  } catch (e) {
    console.error('[lib/gemini] meter', e?.message)
  }
}

// Cached across warm invocations once we know a model that works for this key.
let resolvedModel = null

// Ask Google which models this key can actually call; return flash models that
// advertise generateContent, ordered PREFERRED-first then newest-first.
async function discoverModels(key) {
  try {
    const r = await fetch(`${BASE}/models?key=${encodeURIComponent(key)}&pageSize=200`)
    if (!r.ok) return []
    const j = await r.json()
    const clean = (m) => String(m.name || '').replace(/^models\//, '')
    const names = (j.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(clean)
    const flash = names.filter((n) =>
      /flash/i.test(n) && !/(vision|thinking|exp|-8b|lite|tts|image|audio|live|native|preview)/i.test(n))
    const pool = flash.length ? flash : names
    pool.sort((a, b) => b.localeCompare(a, undefined, { numeric: true })) // newest first
    const pref = PREFERRED.filter((p) => pool.includes(p))
    return [...pref, ...pool.filter((n) => !pref.includes(n))]
  } catch {
    return []
  }
}

function callModel(model, key, parts, generationConfig) {
  return fetch(`${BASE}/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }], generationConfig }),
  })
}

// A response that means "wrong model, try another" rather than a fatal key/
// billing problem: 404 not-found, or a 400 whose message says the model doesn't
// do generateContent (e.g. "This model only supports Interactions API").
function isBadModel(status, gMessage) {
  if (status === 404) return true
  if (status === 400 && /interactions api|only supports|not supported|is not found|not found for/i.test(gMessage)) return true
  return false
}

async function parseErr(r) {
  const raw = await r.text().catch(() => '')
  try { const ej = JSON.parse(raw); return { gStatus: ej?.error?.status || '', gMessage: ej?.error?.message || '' } }
  catch { return { gStatus: '', gMessage: '' } }
}

// Human-readable message for a genuine (non-model) failure, tuned to what the
// owner can actually fix. `feature` names the caller ("AI reader", "reply
// drafter") so the message reads naturally.
function fatalMessage(feature, status, gStatus, gMessage) {
  const base = status === 429
    ? `The ${feature} has no Gemini quota/credits — top up the key’s project in AI Studio (Projects → your project → Buy credits).`
    : status === 400
      ? `The ${feature} key looks wrong — check GEMINI_API_KEY in Vercel matches the key shown in AI Studio.`
      : status === 403
        ? `The ${feature} was denied — usually the key’s Gemini project has no credits/billing, or the Generative Language API isn’t enabled for it.`
        : `The ${feature} returned an error (${status}).`
  const reason = gMessage ? ` (Google: ${gStatus || status} — ${gMessage.slice(0, 160)})` : ''
  return base + reason
}

// Run one generateContent turn against whichever model works for this key.
//   parts: the Gemini `parts` array (text and/or inline_data).
//   opts.temperature: sampling temperature (default 0).
//   opts.feature: label used in error messages.
// Returns { ok:true, text } or { ok:false, error } (error is owner-readable).
export async function geminiGenerate(parts, { temperature = 0, feature = 'AI feature' } = {}) {
  const key = process.env.GEMINI_API_KEY
  if (!key) return { ok: false, error: `${feature} isn’t switched on yet (no GEMINI_API_KEY set in the server settings).`, notConfigured: true }

  const generationConfig = { temperature }
  const order = []
  const add = (m) => { if (m && !order.includes(m)) order.push(m) }
  add(resolvedModel); add(SEED_MODEL); PREFERRED.forEach(add)

  let discovered = false
  let lastBad = null

  for (let i = 0; i < MAX_TRIES; i++) {
    if (i >= order.length) {
      if (discovered) break
      discovered = true
      ;(await discoverModels(key)).forEach(add)
      if (i >= order.length) break
    }
    const model = order[i]
    let r
    try {
      r = await callModel(model, key, parts, generationConfig)
    } catch (e) {
      console.error('[lib/gemini] fetch', model, e?.message)
      return { ok: false, error: `Could not reach the ${feature}.` }
    }

    if (r.ok) {
      resolvedModel = model
      const j = await r.json()
      const text = (j?.candidates?.[0]?.content?.parts || []).map((p) => p.text).filter(Boolean).join('') || ''
      // Not awaited: the caller is waiting on this answer, and the meter is the
      // least important thing in the request.
      meter(feature, model, j?.usageMetadata)
      return { ok: true, text }
    }

    const { gStatus, gMessage } = await parseErr(r)
    console.error('[lib/gemini]', feature, model, r.status, gStatus, gMessage.slice(0, 200))

    if (isBadModel(r.status, gMessage)) {
      lastBad = { gStatus, gMessage }
      if (resolvedModel === model) resolvedModel = null // cached model went stale
      continue
    }
    return { ok: false, error: fatalMessage(feature, r.status, gStatus, gMessage) }
  }

  const detail = lastBad?.gMessage ? ` (Google: ${lastBad.gStatus} — ${lastBad.gMessage.slice(0, 160)})` : ''
  return { ok: false, error: `The ${feature} could not find a Gemini model that works for this key.` + detail }
}
