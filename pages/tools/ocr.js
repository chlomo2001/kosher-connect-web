import { useRef, useState } from 'react'
import Head from 'next/head'
import ThemeToggle from '../../components/ThemeToggle'
import ToolDrop from '../../components/ToolDrop'
import AppStyles from '../../components/AppStyles'
import { requireStaffCookie } from '../../lib/pageAuth'
import { parseMRZ } from '../../lib/mrz.mjs'
import { capName } from '../../lib/mappers.js'

// Scan Reader (OCR) — drop a photo or scan a customer sent in and get its
// text out, ready to copy. English + Hebrew. Everything runs IN THE BROWSER
// (tesseract.js, self-hosted assets under /public/ocr) — no upload, no CDN,
// the document never leaves the machine.

const LANGS = ['eng', 'heb']

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
  const a = document.createElement('a')
  a.href = url; a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}

export default function ScanReader() {
  const [items, setItems] = useState([]) // { name, url, text?, error?, mrz?, fileDataUrl?, fileType?, saved?, dismissed? }
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState('')
  const [progress, setProgress] = useState(0)
  const [copied, setCopied] = useState(false)
  const [mode, setMode] = useState('device') // 'device' (private tesseract) | 'ai' (Gemini)
  const [customers, setCustomers] = useState(null) // lazy: loaded when a passport is detected
  const workerRef = useRef(null)

  // The passport flow needs the customer list; fetch once, on first detection.
  async function loadCustomers() {
    if (customers) return customers
    try {
      const r = await fetch('/api/customers')
      const list = await r.json()
      const sorted = (Array.isArray(list) ? list : []).sort((a, b) =>
        `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
      setCustomers(sorted)
      return sorted
    } catch { setCustomers([]); return [] }
  }

  function patchItem(idx, patch) {
    setItems((p) => p.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  // Save the scan into the customer's documents and file the extracted
  // passport details (DOB, expiry, number → owner data on the customer;
  // passport_on_file flips on). "new" first creates the customer from the
  // passport's own name fields.
  async function savePassportTo(idx) {
    const it = items[idx]
    const m = it.mrzEdit || it.mrz
    let customerId = it.saveTarget
    if (!customerId) return
    patchItem(idx, { saving: true, saveError: '' })
    try {
      if (customerId === 'new') {
        const r = await fetch('/api/customers', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ firstName: capName((m.givenNames || '').toLowerCase()), lastName: capName((m.surname || '').toLowerCase()) }),
        })
        const j = await r.json()
        if (!j.success) throw new Error(j.error || 'Could not create the customer')
        customerId = j.customer.id
        setCustomers(null) // stale now
      }
      // 1 · file the details on the customer (partial PUT merges server-side)
      const pr = await fetch('/api/customers', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: customerId,
          dob: m.dob || undefined,
          passportNumber: m.passportNumber || undefined,
          passportExpiry: m.expiry || undefined,
          passportOnFile: true,
        }),
      })
      const pj = await pr.json()
      if (!pj.success) throw new Error(pj.error || 'Could not save the details')
      // 2 · attach the scan itself to the customer's documents
      if (it.fileDataUrl) {
        const dr = await fetch('/api/documents', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId,
            filename: it.name || 'passport-scan.jpg',
            contentType: it.fileType || 'image/jpeg',
            dataBase64: String(it.fileDataUrl).split(',')[1] || '',
          }),
        })
        const dj = await dr.json()
        if (!dj.success) throw new Error(dj.error || 'Details saved, but the scan upload failed')
      }
      patchItem(idx, { saving: false, saved: true, savedName: pj.customer ? `${pj.customer.firstName} ${pj.customer.lastName || ''}`.trim() : '' })
    } catch (e) {
      patchItem(idx, { saving: false, saveError: String(e.message || e) })
    }
  }

  async function getWorker() {
    if (workerRef.current) return workerRef.current
    const { createWorker } = await import('tesseract.js')
    setStage('Loading the reader (first time only)…')
    workerRef.current = await createWorker(LANGS, 1, {
      workerPath: '/ocr/worker.min.js',
      corePath: '/ocr/tesseract-core-simd-lstm.wasm.js',
      langPath: '/ocr/lang',
      gzip: false,
      logger: (m) => {
        if (m.status === 'recognizing text') { setStage('Reading…'); setProgress(Math.round(m.progress * 100)) }
      },
    })
    return workerRef.current
  }

  const MAX_PDF_PAGES = 50

  // Render each PDF page to a canvas in the browser (pdf.js, self-hosted worker
  // under /public/ocr) so the same OCR path can read it. Nothing is uploaded.
  async function pdfToCanvases(file, onPage) {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = '/ocr/pdf.worker.min.mjs'
    const data = new Uint8Array(await file.arrayBuffer())
    // cMapUrl + standardFontDataUrl let pdf.js render PDFs that embed CJK/Hebrew
    // character maps or reference the standard 14 fonts — without them, those
    // PDFs throw and the read fails. All self-hosted under /public/ocr.
    const pdf = await pdfjs.getDocument({
      data,
      cMapUrl: '/ocr/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: '/ocr/standard_fonts/',
    }).promise
    const total = Math.min(pdf.numPages, MAX_PDF_PAGES)
    const canvases = []
    for (let n = 1; n <= total; n++) {
      onPage(n, total)
      const page = await pdf.getPage(n)
      const viewport = page.getViewport({ scale: 2 }) // 2× so small print reads
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width; canvas.height = viewport.height
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
      canvases.push(canvas)
    }
    return { canvases, truncated: pdf.numPages > MAX_PDF_PAGES, numPages: pdf.numPages }
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(fr.result)
      fr.onerror = () => reject(new Error('read failed'))
      fr.readAsDataURL(file)
    })
  }
  // AI path: one image to the server, which calls Gemini and returns the text.
  async function aiRead(imageBase64, mimeType) {
    const r = await fetch('/api/ocr-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64, mimeType }) })
    const j = await r.json().catch(() => ({}))
    if (!j.success) throw new Error(j.error || 'AI reading failed')
    return (j.text || '').trim()
  }

  async function onFiles(files) {
    if (busy) return
    setBusy(true); setCopied(false)
    const ai = mode === 'ai'
    try {
      const worker = ai ? null : await getWorker()
      for (const file of files) {
        const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
        const isImage = /^image\//.test(file.type)
        if (!isPdf && !isImage) {
          setItems((p) => [...p, { name: file.name, error: 'Not a photo or PDF — drop a JPG/PNG image or a PDF.' }])
          continue
        }
        setStage(`Reading ${file.name}…`); setProgress(0)
        try {
          if (isPdf) {
            setStage(`Opening ${file.name}…`)
            const { canvases, truncated, numPages } = await pdfToCanvases(file, (n, total) => setStage(`Reading ${file.name} — page ${n} of ${total}…`))
            if (!canvases.length) { setItems((p) => [...p, { name: file.name, error: 'That PDF had no readable pages.' }]); continue }
            const parts = []
            for (let i = 0; i < canvases.length; i++) {
              setStage(`Reading ${file.name} — page ${i + 1} of ${canvases.length}…`); setProgress(0)
              let t
              if (ai) t = await aiRead(canvases[i].toDataURL('image/jpeg', 0.9), 'image/jpeg')
              else { const { data } = await worker.recognize(canvases[i]); t = (data.text || '').trim() }
              parts.push(canvases.length > 1 ? `— Page ${i + 1} —\n${t}` : t)
            }
            const thumb = canvases[0].toDataURL('image/jpeg', 0.6)
            const note = truncated ? `\n\n(Only the first ${MAX_PDF_PAGES} of ${numPages} pages were read.)` : ''
            const fullText = (parts.join('\n\n').trim() || '(no text found)') + note
            const mrz = parseMRZ(fullText)
            if (mrz) loadCustomers()
            const pdfDataUrl = await fileToDataUrl(file)
            setItems((p) => [...p, { name: file.name, url: thumb, text: fullText, mrz,
              fileDataUrl: pdfDataUrl, fileType: file.type || 'application/pdf' }])
          } else {
            const url = URL.createObjectURL(file)
            let t
            const dataUrl = await fileToDataUrl(file)
            if (ai) t = await aiRead(dataUrl, file.type || 'image/jpeg')
            else { const { data } = await worker.recognize(file); t = (data.text || '').trim() }
            const mrz = parseMRZ(t)
            if (mrz) loadCustomers()
            setItems((p) => [...p, { name: file.name, url, text: t || '(no text found)', mrz,
              fileDataUrl: dataUrl, fileType: file.type || 'image/jpeg' }])
          }
        } catch (err) {
          console.error('[scan-reader]', file.name, err)
          const raw = err && err.message ? String(err.message) : ''
          // Network-level failures surface as browser jargon ("Failed to
          // fetch", Safari's "Load failed", chunk-load errors after a deploy).
          // Say the thing the user can act on; keep real server messages.
          const network = /failed to fetch|load failed|networkerror|dynamically imported module|chunkload/i.test(raw)
          const detail = network ? ' — check your connection and try again' : raw ? ` (${raw.slice(0, 120)})` : ''
          setItems((p) => [...p, { name: file.name, error: (isPdf ? 'Could not read this PDF' : 'Could not read this image') + detail }])
        }
      }
    } catch {
      setItems((p) => [...p, { name: 'reader', error: 'The reader failed to load — refresh and try again.' }])
    } finally {
      setBusy(false); setStage(''); setProgress(0)
    }
  }

  const allText = items.filter((i) => i.text).map((i) => (items.length > 1 ? `── ${i.name} ──\n${i.text}` : i.text)).join('\n\n')

  return (
    <>
      <Head><title>Scan Reader · Kosher Connect</title><meta name="robots" content="noindex, nofollow" /></Head>
      <AppStyles />
      <div className="tool-shell">
        <ThemeToggle style={{ position: 'fixed', top: 16, right: 16, zIndex: 10 }} />
        <div className="tool-wrap">
          <div className="tool-head">
            <a href="/" className="tool-back">← Back to the app</a>
            <h1>Scan Reader</h1>
            <p>
              A customer sends a photo or PDF of a document — drop it here and the text comes out,
              ready to copy. Reads English and Hebrew, image or PDF (every page). By default it runs
              entirely in your browser — nothing is uploaded.
            </p>
          </div>

          <div className="tool-card">
            <div className="tool-card-title">1 · Reading mode</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className={`btn ${mode === 'device' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setMode('device')}>🔒 On this device (private)</button>
              <button className={`btn ${mode === 'ai' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setMode('ai')}>✨ AI reading (higher accuracy)</button>
            </div>
            {mode === 'ai' && (
              <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, fontSize: 13, lineHeight: 1.5, background: 'rgba(234,179,8,0.12)', border: '1px solid #eab308' }}>
                ⚠ AI reading <strong>uploads the document to Google</strong> to read it — far more accurate, especially for Hebrew and messy scans, but the file leaves this device.
                <strong> Don’t use it for passports, ID cards or other sensitive personal documents</strong> — use “On this device” for those.
              </div>
            )}
          </div>

          <div className="tool-card">
            <div className="tool-card-title">2 · Drop the scan</div>
            <ToolDrop id="tool-ocr-file" multiple accept="image/*,application/pdf,.pdf"
              main={busy ? (stage || 'Working…') : 'Drop photos, scans or PDFs here — or click to choose'}
              sub="JPG / PNG / WEBP photos or PDF files. Clear, straight scans read best."
              describedBy="tool-ocr-hint" onFiles={onFiles} />
            <div className="tool-hint" id="tool-ocr-hint">
              Multi-page PDFs are read page by page (up to 50 pages).
              {busy && progress > 0 ? ` · ${progress}%` : ''}
            </div>
          </div>

          {items.length > 0 && (
            <div className="tool-card">
              <div className="tool-card-title">3 · The text</div>
              {items.map((it, idx) => (
                <div key={idx} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    {it.url && <img src={it.url} alt="" style={{ width: 46, height: 46, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />}
                    <strong style={{ fontSize: 13 }}>{it.name}</strong>
                  </div>
                  {it.error
                    ? <div className="tool-msg">{it.error}</div>
                    : <textarea className="form-input" readOnly value={it.text} rows={Math.min(14, Math.max(4, it.text.split('\n').length + 1))}
                        dir="auto" style={{ width: '100%', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.6, resize: 'vertical' }} />}
                  {it.mrz && !it.dismissed && (
                    <div style={{ marginTop: 10, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                      {it.saved ? (
                        <div style={{ fontSize: 14 }}>✅ Saved to <strong>{it.savedName || 'the customer'}</strong> — scan filed under their documents, passport details on their record.</div>
                      ) : (
                        <>
                          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
                            🛂 Passport detected — save it to a customer?
                            {!it.mrz.checksumOk && <span style={{ color: 'var(--muted)', fontWeight: 400 }}> (check the fields — the scan was hard to read)</span>}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 10 }}>
                            {[['surname', 'Surname'], ['givenNames', 'First name(s)'], ['passportNumber', 'Passport №'], ['dob', 'Date of birth'], ['expiry', 'Passport expiry']].map(([k, label]) => (
                              <label key={k} style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12, color: 'var(--muted)' }}>{label}
                                <input className="form-input" type={k === 'dob' || k === 'expiry' ? 'date' : 'text'}
                                  value={(it.mrzEdit || it.mrz)[k] || ''}
                                  onChange={(e) => patchItem(idx, { mrzEdit: { ...(it.mrzEdit || it.mrz), [k]: e.target.value } })}
                                  style={{ padding: '6px 8px', fontSize: 13 }} />
                              </label>
                            ))}
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            <select className="form-input" style={{ maxWidth: 280, padding: '7px 8px', fontSize: 13 }}
                              value={it.saveTarget || ''} onChange={(e) => patchItem(idx, { saveTarget: e.target.value })}>
                              <option value="">— pick the customer —</option>
                              <option value="new">➕ New customer from this passport</option>
                              {(customers || []).map((c) => (
                                <option key={c.id} value={c.id}>{c.firstName} {c.lastName || ''}</option>
                              ))}
                            </select>
                            <button className="btn btn-primary" disabled={!it.saveTarget || it.saving}
                              onClick={() => savePassportTo(idx)}>{it.saving ? 'Saving…' : '💾 Save scan + details'}</button>
                            <button className="btn btn-outline" onClick={() => patchItem(idx, { dismissed: true })}>Not relevant</button>
                          </div>
                          {it.saveError && <div className="tool-msg" style={{ marginTop: 8 }}>{it.saveError}</div>}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {allText && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" onClick={async () => {
                    try { await navigator.clipboard.writeText(allText); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* select manually */ }
                  }}>{copied ? '✓ Copied' : 'Copy all text'}</button>
                  <button className="btn btn-outline" onClick={() => download('scan-text.txt', allText)}>Download .txt</button>
                  <button className="btn btn-outline" onClick={() => setItems([])}>Clear</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export async function getServerSideProps({ req }) {
  const gate = await requireStaffCookie(req)
  if (gate) return gate
  return { props: {} }
}
