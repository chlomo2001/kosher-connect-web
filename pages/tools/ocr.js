import { useRef, useState } from 'react'
import Head from 'next/head'
import ThemeToggle from '../../components/ThemeToggle'
import ToolDrop from '../../components/ToolDrop'
import { requireStaffCookie } from '../../lib/pageAuth'

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
  const [items, setItems] = useState([]) // { name, url, text?, error? }
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState('')
  const [progress, setProgress] = useState(0)
  const [copied, setCopied] = useState(false)
  const workerRef = useRef(null)

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

  async function onFiles(files) {
    if (busy) return
    setBusy(true); setCopied(false)
    try {
      const worker = await getWorker()
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
              const { data } = await worker.recognize(canvases[i])
              const t = (data.text || '').trim()
              parts.push(canvases.length > 1 ? `— Page ${i + 1} —\n${t}` : t)
            }
            const thumb = canvases[0].toDataURL('image/jpeg', 0.6)
            const note = truncated ? `\n\n(Only the first ${MAX_PDF_PAGES} of ${numPages} pages were read.)` : ''
            setItems((p) => [...p, { name: file.name, url: thumb, text: (parts.join('\n\n').trim() || '(no text found)') + note }])
          } else {
            const url = URL.createObjectURL(file)
            const { data } = await worker.recognize(file)
            setItems((p) => [...p, { name: file.name, url, text: (data.text || '').trim() || '(no text found)' }])
          }
        } catch (err) {
          console.error('[scan-reader]', file.name, err)
          const detail = err && err.message ? ` (${String(err.message).slice(0, 120)})` : ''
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
      <Head><title>Scan Reader · KosherConnect</title></Head>
      <div className="tool-shell">
        <ThemeToggle style={{ position: 'fixed', top: 16, right: 16, zIndex: 10 }} />
        <div className="tool-wrap">
          <div className="tool-head">
            <a href="/" className="tool-back">← Back to the app</a>
            <h1>Scan Reader</h1>
            <p>
              A customer sends a photo or PDF of a document — drop it here and the text comes out,
              ready to copy. Reads English and Hebrew, image or PDF (every page). Everything runs
              in your browser; the document is never uploaded anywhere.
            </p>
          </div>

          <div className="tool-card">
            <div className="tool-card-title">1 · Drop the scan</div>
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
              <div className="tool-card-title">2 · The text</div>
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
