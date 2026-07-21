// AI reading for the Scan Reader — sends one image to Google Gemini and returns
// the transcribed text. This is the OPT-IN, higher-accuracy path: unlike the
// default on-device reader, the image DOES leave the device (it goes to
// Google), so the UI warns not to use it for passports/IDs.
//
// The API key lives ONLY in the environment (GEMINI_API_KEY), never in code or
// the client. Staff-gated so this can't be used as an open Gemini proxy.
import { withStaff } from '../../lib/auth.js'

export const config = { api: { bodyParser: { sizeLimit: '15mb' } } }

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
const PROMPT =
  'Transcribe ALL text in this image exactly as it appears, keeping line breaks and the reading order. ' +
  'The text may be English, Hebrew or Yiddish — transcribe each in its own script and correct direction. ' +
  'Output only the transcribed text, with no commentary, headings or explanation.'

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const key = process.env.GEMINI_API_KEY
  if (!key) return res.status(503).json({ success: false, error: 'AI reading isn’t switched on yet (no GEMINI_API_KEY set in the server settings).' })

  const { imageBase64, mimeType } = req.body || {}
  if (!imageBase64) return res.status(400).json({ success: false, error: 'No image was received.' })
  const data = String(imageBase64).replace(/^data:[^;]+;base64,/, '')

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ inline_data: { mime_type: mimeType || 'image/jpeg', data } }, { text: PROMPT }] }],
          generationConfig: { temperature: 0 },
        }),
      }
    )
    if (!r.ok) {
      const detail = (await r.text().catch(() => '')).slice(0, 200)
      console.error('[api/ocr-ai] gemini', r.status, detail)
      const msg = r.status === 429
        ? 'The AI reader is over its Google quota — enable billing on the Gemini project, or wait for the free-tier limit to reset.'
        : r.status === 400 || r.status === 403
          ? 'The AI reader key was rejected — check GEMINI_API_KEY in the server settings.'
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
