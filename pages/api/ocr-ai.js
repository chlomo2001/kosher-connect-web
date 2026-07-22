// AI reading for the Scan Reader — sends one image to Google Gemini and returns
// the transcribed text. This is the OPT-IN, higher-accuracy path: unlike the
// default on-device reader, the image DOES leave the device (it goes to
// Google), so the UI warns not to use it for passports/IDs.
//
// The API key lives ONLY in the environment (GEMINI_API_KEY), never in code or
// the client. Staff-gated so this can't be used as an open Gemini proxy.
//
// Model resolution is self-healing. Google constantly rotates model names and,
// increasingly, ships models that ONLY speak the newer "Interactions API" and
// reject the classic generateContent endpoint. So we don't trust a single name:
// we build an ordered list of candidate flash models (seed + whatever ListModels
// says this key can call), try them in turn, and SKIP any that answer "not found"
// or "only supports Interactions API" — falling through to one that actually
// transcribes. Genuine key/billing/quota errors stop immediately (no point
// hammering every model). The first model that works is cached for warm reuse.
import { withStaff } from '../../lib/auth.js'

export const config = { api: { bodyParser: { sizeLimit: '15mb' } } }

// Known-good, stable generateContent models, best-first. Used to order the
// candidates ListModels returns so we try a document-reading model before any
// bleeding-edge Interactions-only one. GEMINI_MODEL (if set) is tried first.
const PREFERRED = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-flash-latest']
const SEED_MODEL = process.env.GEMINI_MODEL || PREFERRED[0]
const BASE = 'https://generativelanguage.googleapis.com/v1beta'
const MAX_TRIES = 8
const PROMPT =
  'Transcribe ALL text in this image exactly as it appears, keeping line breaks and the reading order. ' +
  'The text may be English, Hebrew or Yiddish — transcribe each in its own script and correct direction. ' +
  'Output only the transcribed text, with no commentary, headings or explanation.'

// Cached across warm invocations once we know a model that works for this key.
let resolvedModel = null

// Ask Google which models this key can actually call; return flash models that
// advertise generateContent, ordered PREFERRED-first then newest-first. (The
// advertised support isn't always honoured — the caller still skips duds — but
// it's a good ordering.)
async function discoverModels(key) {
  try {
    const r = await fetch(`${BASE}/models?key=${encodeURIComponent(key)}&pageSize=200`)
    if (!r.ok) return []
    const j = await r.json()
    const clean = (m) => String(m.name || '').replace(/^models\//, '')
    const names = (j.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(clean)
    // Plain flash models are fast, cheap and great at OCR; skip niche variants.
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

function generate(model, key, parts) {
  return fetch(`${BASE}/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0 } }),
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

function fatalMessage(status, gStatus, gMessage) {
  const base = status === 429
    ? 'The AI reader has no Gemini quota/credits — top up the key’s project in AI Studio (Projects → your project → Buy credits).'
    : status === 400
      ? 'The AI reader key looks wrong — check GEMINI_API_KEY in Vercel matches the key shown in AI Studio.'
      : status === 403
        ? 'The AI reader was denied — usually the key’s Gemini project has no credits/billing, or the Generative Language API isn’t enabled for it.'
        : `The AI reader returned an error (${status}).`
  const reason = gMessage ? ` (Google: ${gStatus || status} — ${gMessage.slice(0, 160)})` : ''
  return base + reason
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const key = process.env.GEMINI_API_KEY
  if (!key) return res.status(503).json({ success: false, error: 'AI reading isn’t switched on yet (no GEMINI_API_KEY set in the server settings).' })

  const { imageBase64, mimeType } = req.body || {}
  if (!imageBase64) return res.status(400).json({ success: false, error: 'No image was received.' })
  const data = String(imageBase64).replace(/^data:[^;]+;base64,/, '')
  const parts = [{ inline_data: { mime_type: mimeType || 'image/jpeg', data } }, { text: PROMPT }]

  try {
    // Ordered candidates: the cached/known-good model first, then the seed, then
    // whatever ListModels offers. Discovery is lazy — only if the seeds are duds.
    const order = []
    const add = (m) => { if (m && !order.includes(m)) order.push(m) }
    add(resolvedModel); add(SEED_MODEL); PREFERRED.forEach(add)

    let discovered = false
    let lastBad = null // remember the last "bad model" reason if we exhaust the list

    for (let i = 0; i < MAX_TRIES; i++) {
      if (i >= order.length) {
        if (discovered) break
        discovered = true
        ;(await discoverModels(key)).forEach(add)
        if (i >= order.length) break
      }
      const model = order[i]
      const r = await generate(model, key, parts)

      if (r.ok) {
        resolvedModel = model // remember the known-good model
        const j = await r.json()
        const text = (j?.candidates?.[0]?.content?.parts || []).map((p) => p.text).filter(Boolean).join('') || ''
        return res.json({ success: true, text })
      }

      const { gStatus, gMessage } = await parseErr(r)
      console.error('[api/ocr-ai] gemini', model, r.status, gStatus, gMessage.slice(0, 200))

      if (isBadModel(r.status, gMessage)) {
        lastBad = { gStatus, gMessage }
        if (resolvedModel === model) resolvedModel = null // cached model went stale
        continue // try the next candidate
      }
      // Real key / billing / quota problem — stop and report it.
      return res.status(502).json({ success: false, error: fatalMessage(r.status, gStatus, gMessage) })
    }

    // Every candidate rejected the classic endpoint.
    const detail = lastBad?.gMessage ? ` (Google: ${lastBad.gStatus} — ${lastBad.gMessage.slice(0, 160)})` : ''
    return res.status(502).json({
      success: false,
      error: 'The AI reader could not find a Gemini model that reads documents for this key.' + detail,
    })
  } catch (e) {
    console.error('[api/ocr-ai]', e)
    return res.status(502).json({ success: false, error: 'Could not reach the AI reader.' })
  }
}

export default withStaff(handler)
