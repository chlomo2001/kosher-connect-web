// AI reading for the Scan Reader — sends one image to Google Gemini and returns
// the transcribed text. This is the OPT-IN, higher-accuracy path: unlike the
// default on-device reader, the image DOES leave the device (it goes to
// Google), so the UI warns not to use it for passports/IDs.
//
// The key handling and self-healing model resolution live in lib/gemini.js and
// are shared with the reply drafter. Staff-gated so this can't be an open proxy.
import { withStaff } from '../../lib/auth.js'
import { geminiGenerate } from '../../lib/gemini.js'

export const config = { api: { bodyParser: { sizeLimit: '15mb' } } }

const PROMPT =
  'Transcribe ALL text in this image exactly as it appears, keeping line breaks and the reading order. ' +
  'The text may be English, Hebrew or Yiddish — transcribe each in its own script and correct direction. ' +
  'Output only the transcribed text, with no commentary, headings or explanation.'

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { imageBase64, mimeType } = req.body || {}
  if (!imageBase64) return res.status(400).json({ success: false, error: 'No image was received.' })
  const data = String(imageBase64).replace(/^data:[^;]+;base64,/, '')
  const parts = [{ inline_data: { mime_type: mimeType || 'image/jpeg', data } }, { text: PROMPT }]

  const out = await geminiGenerate(parts, { temperature: 0, feature: 'AI reader' })
  if (out.ok) return res.json({ success: true, text: out.text })
  return res.status(out.notConfigured ? 503 : 502).json({ success: false, error: out.error })
}

export default withStaff(handler)
