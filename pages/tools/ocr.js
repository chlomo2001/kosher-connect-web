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

  async function onFiles(files) {
    if (busy) return
    setBusy(true); setCopied(false)
    try {
      const worker = await getWorker()
      for (const file of files) {
        if (!/^image\//.test(file.type)) {
          setItems((p) => [...p, { name: file.name, error: 'Not an image — for a PDF scan, screenshot the page (or export it as JPG) and drop that.' }])
          continue
        }
        const url = URL.createObjectURL(file)
        setStage(`Reading ${file.name}…`); setProgress(0)
        try {
          const { data } = await worker.recognize(file)
          setItems((p) => [...p, { name: file.name, url, text: (data.text || '').trim() || '(no text found)' }])
        } catch {
          setItems((p) => [...p, { name: file.name, url, error: 'Could not read this image.' }])
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
              A customer sends a photo of a document — drop it here and the text comes out,
              ready to copy. Reads English and Hebrew. Everything runs in your browser;
              the document is never uploaded anywhere.
            </p>
          </div>

          <div className="tool-card">
            <div className="tool-card-title">1 · Drop the scan</div>
            <ToolDrop id="tool-ocr-file" multiple accept="image/*"
              main={busy ? (stage || 'Working…') : 'Drop photos or scans here — or click to choose'}
              sub="JPG / PNG / WEBP photos of documents. Clear, straight photos read best."
              describedBy="tool-ocr-hint" onFiles={onFiles} />
            <div className="tool-hint" id="tool-ocr-hint">
              PDF scan? Screenshot the page (or export it as JPG) and drop that.
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
