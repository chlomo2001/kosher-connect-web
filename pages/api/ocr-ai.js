// AI reading for the Scan Reader — sends one image to Google Gemini and returns
// the transcribed text. This is the OPT-IN, higher-accuracy path: unlike the
// default on-device reader, the image DOES leave the device (it goes to
// Google), so the UI warns not to use it for passports/IDs.
//
// The API key lives ONLY in the environment (GEMINI_API_KEY), never in code or
// the client. Staff-gated so this can't be used as an open Gemini proxy.
//
// Model resolution is self-healing: we try the configured/default model, and if
// Google returns 404 (the model name has been renamed or retired — this happens
// as Google rotates versions) we ask ListModels which models THIS key can use,
// pick the current flash one, cache it, and retry. So the tool keeps working
// across Google's model renames without a code change.
import { withStaff } from '../../lib/auth.js'

export const config = { api: { bodyParser: { sizeLimit: '15mb' } } }

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
const BASE = 'https://generativelanguage.googleapis.com/v1beta'
const PROMPT =
  'Transcribe ALL text in this image exactly as it appears, keeping line breaks and the reading order. ' +
  'The text may be English, Hebrew or Yiddish — transcribe each in its own script and correct direction. ' +
  'Output only the transcribed text, with no commentary, headings or explanation.'

// Cached across warm invocations once we know a model that works for this key.
let resolvedModel = null

// Ask Google which models this key can actually call, and pick the best flash
// model that supports generateContent. Newest version first.
async function discoverModel(key) {
  try {
    const r = await fetch(`${BASE}/models?key=${encodeURIComponent(key)}&pageSize=200`)
    if (!r.ok) return null
    const j = await r.json()
    const clean = (m) => String(m.name || '').replace(/^models\//, '')
    const usable = (j.models || []).filter((m) =>
      (m.supportedGenerationMethods || []).includes('generateContent'))
    const names = usable.map(clean)
    // Prefer plain "flash" models (fast + cheap, great at OCR); skip niche variants.
    const flash = names.filter((n) => /flash/i.test(n) && !/(vision|thinking|exp|-8b|lite|tts|image)/i.test(n))
    const pool = flash.length ? flash : names
    // Higher version numbers first (gemini-2.5-flash before gemini-2.0-flash, etc.)
    pool.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
    return pool[0] || null
  } catch {
    return null
  }
}

function generate(model, key, parts) {
  return fetch(`${BASE}/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0 } }),
  })
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
    let model = resolvedModel || DEFAULT_MODEL
    let r = await generate(model, key, parts)

    // Model name not found → discover a working one for this key and retry once.
    if (r.status === 404) {
      const good = await discoverModel(key)
      if (good && good !== model) {
        model = good
        r = await generate(model, key, parts)
      }
    }
    if (r.ok) resolvedModel = model // remember the known-good model

    if (!r.ok) {
      const detail = (await r.text().catch(() => '')).slice(0, 200)
      console.error('[api/ocr-ai] gemini', r.status, detail)
      const msg = r.status === 429
        ? 'The AI reader is over its Google quota — check the billing/limits on the Gemini project.'
        : r.status === 400 || r.status === 403
          ? 'The AI reader key was rejected — check GEMINI_API_KEY in the server settings.'
          : r.status === 404
            ? 'The AI reader could not find a usable Gemini model for this key — check the key’s project has the Generative Language API enabled.'
            : `The AI reader returned an error (${r.status}).`
      return res.status(502).json({ success: false, error: msg })
    }

    const j = await r.json()
    const text = (j?.candidates?.[0]?.content?.parts || []).map((p) => p.text).filter(Boolean).join('') || ''
    return res.json({ success: true, text })
  } catch (e) {
    console.error('[api/ocr-ai]', e)
    return res.status(502).json({ success: false, error: 'Could not reach the AI reader.' })
  }
}

export default withStaff(handler)
