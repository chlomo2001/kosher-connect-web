import { useState } from 'react'
import Head from 'next/head'
import ThemeToggle from '../../components/ThemeToggle'
import ToolDrop from '../../components/ToolDrop'
import { makeZip } from '../../lib/zipLite.mjs'
import { requireStaffCookie } from '../../lib/pageAuth'

// File Converter — the common image/PDF conversions, all IN THE BROWSER
// (canvas for images, self-hosted pdf.js for PDF→image, bundled pdf-lib for
// PDF assembly, zipLite for multi-file downloads). No upload, no CDN — the
// same privacy posture as the Scan Reader.

const IMG_TARGETS = [
  { mime: 'image/jpeg', ext: 'jpg', label: 'JPG' },
  { mime: 'image/png', ext: 'png', label: 'PNG' },
  { mime: 'image/webp', ext: 'webp', label: 'WEBP' },
]

function download(name, data, mime) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}
const stem = (n) => String(n).replace(/\.[^.]+$/, '') || 'file'

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const im = new Image()
    im.onload = () => { resolve(im); URL.revokeObjectURL(url) }
    im.onerror = () => { reject(new Error('image decode failed')); URL.revokeObjectURL(url) }
    im.src = url
  })
}

async function imageToBlob(file, mime, quality) {
  const im = await loadImage(file)
  const canvas = document.createElement('canvas')
  canvas.width = im.naturalWidth || im.width
  canvas.height = im.naturalHeight || im.height
  const ctx = canvas.getContext('2d')
  if (mime === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height) } // no black behind transparency
  ctx.drawImage(im, 0, 0)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), mime, quality))
}
async function u8(blob) { return new Uint8Array(await blob.arrayBuffer()) }

// pdf.js render (same self-hosted setup as the Scan Reader).
async function pdfPages(file, onPage) {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = '/ocr/pdf.worker.min.mjs'
  const data = new Uint8Array(await file.arrayBuffer())
  const pdf = await pdfjs.getDocument({
    data, cMapUrl: '/ocr/cmaps/', cMapPacked: true, standardFontDataUrl: '/ocr/standard_fonts/',
  }).promise
  const canvases = []
  for (let n = 1; n <= pdf.numPages; n++) {
    onPage && onPage(n, pdf.numPages)
    const page = await pdf.getPage(n)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width; canvas.height = viewport.height
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
    canvases.push(canvas)
  }
  return canvases
}

export default function Converter() {
  const [files, setFiles] = useState([])
  const [imgTarget, setImgTarget] = useState('image/jpeg')
  const [pdfTarget, setPdfTarget] = useState('image/jpeg')
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')

  const images = files.filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|bmp)$/i.test(f.name))
  const pdfs = files.filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name))

  function onFiles(list) { setFiles((p) => [...p, ...Array.from(list)]); setMsg('') }
  function clearAll() { setFiles([]); setMsg('') }

  async function run(label, fn) {
    if (busy) return
    setBusy(label); setMsg('')
    try { await fn() } catch (e) {
      console.error('[convert]', e)
      const raw = String((e && e.message) || 'failed')
      // Browser network jargon → something the user can act on (same rule as
      // the Scan Reader); real converter messages pass through untouched.
      const network = /failed to fetch|load failed|networkerror|dynamically imported module|chunkload/i.test(raw)
      setMsg(`Couldn’t ${label.toLowerCase()} — ${network ? 'check your connection and try again' : raw}.`)
    }
    finally { setBusy('') }
  }

  // ── Image → image format ──
  const convertImages = () => run('Convert images', async () => {
    const t = IMG_TARGETS.find((x) => x.mime === imgTarget)
    const q = imgTarget === 'image/png' ? undefined : 0.92
    const out = []
    for (const f of images) out.push({ name: `${stem(f.name)}.${t.ext}`, blob: await imageToBlob(f, imgTarget, q) })
    if (out.length === 1) return download(out[0].name, out[0].blob)
    const entries = []
    for (const o of out) entries.push({ name: o.name, data: await u8(o.blob) })
    download('converted-images.zip', makeZip(entries), 'application/zip')
  })

  // ── Images → one PDF ──
  const imagesToPdf = () => run('Combine into PDF', async () => {
    const { PDFDocument } = await import('pdf-lib')
    const doc = await PDFDocument.create()
    for (const f of images) {
      const png = await u8(await imageToBlob(f, 'image/png'))
      const img = await doc.embedPng(png)
      const page = doc.addPage([img.width, img.height])
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height })
    }
    download('combined.pdf', await doc.save(), 'application/pdf')
  })

  // ── PDF → images ──
  const pdfToImages = () => run('PDF to images', async () => {
    const t = IMG_TARGETS.find((x) => x.mime === pdfTarget)
    const entries = []
    for (const f of pdfs) {
      setMsg(`Rendering ${f.name}…`)
      const canvases = await pdfPages(f, (n, tot) => setMsg(`Rendering ${f.name} — page ${n}/${tot}…`))
      for (let i = 0; i < canvases.length; i++) {
        const blob = await new Promise((res) => canvases[i].toBlob(res, pdfTarget, pdfTarget === 'image/png' ? undefined : 0.92))
        entries.push({ name: `${stem(f.name)}-p${i + 1}.${t.ext}`, data: await u8(blob) })
      }
    }
    if (entries.length === 1) return download(entries[0].name, entries[0].data, t.mime)
    download('pdf-images.zip', makeZip(entries), 'application/zip')
  })

  // ── Merge PDFs ──
  const mergePdfs = () => run('Merge PDFs', async () => {
    const { PDFDocument } = await import('pdf-lib')
    const out = await PDFDocument.create()
    for (const f of pdfs) {
      const src = await PDFDocument.load(await f.arrayBuffer())
      const pages = await out.copyPages(src, src.getPageIndices())
      pages.forEach((p) => out.addPage(p))
    }
    download('merged.pdf', await out.save(), 'application/pdf')
  })

  // ── Split PDF → one file per page ──
  const splitPdf = () => run('Split PDF', async () => {
    const { PDFDocument } = await import('pdf-lib')
    const entries = []
    for (const f of pdfs) {
      const src = await PDFDocument.load(await f.arrayBuffer())
      const n = src.getPageCount()
      for (let i = 0; i < n; i++) {
        const one = await PDFDocument.create()
        const [pg] = await one.copyPages(src, [i])
        one.addPage(pg)
        entries.push({ name: `${stem(f.name)}-p${i + 1}.pdf`, data: await one.save() })
      }
    }
    if (entries.length === 1) return download(entries[0].name, entries[0].data, 'application/pdf')
    download('split-pages.zip', makeZip(entries), 'application/zip')
  })

  const B = ({ on, children }) => (
    <button className="btn btn-primary" disabled={!!busy} onClick={on}
      style={{ opacity: busy ? 0.6 : 1 }}>{children}</button>
  )
  const sel = (val, set) => (
    <select className="form-input" value={val} onChange={(e) => set(e.target.value)} style={{ width: 'auto', display: 'inline-block' }}>
      {IMG_TARGETS.map((t) => <option key={t.mime} value={t.mime}>{t.label}</option>)}
    </select>
  )

  return (
    <>
      <Head><title>File Converter · Kosher Connect</title></Head>
      <div className="tool-shell">
        <ThemeToggle style={{ position: 'fixed', top: 16, right: 16, zIndex: 10 }} />
        <div className="tool-wrap">
          <div className="tool-head">
            <a href="/" className="tool-back">← Back to the app</a>
            <h1>File Converter</h1>
            <p>Convert images and PDFs — swap image formats, turn images into a PDF, pull images out of a PDF,
              or merge and split PDFs. Everything runs in your browser; nothing is uploaded anywhere.</p>
          </div>

          <div className="tool-card">
            <div className="tool-card-title">1 · Drop your files</div>
            <ToolDrop id="tool-convert-file" multiple accept="image/*,application/pdf,.pdf"
              main={busy ? (msg || `${busy}…`) : 'Drop images or PDFs here — or click to choose'}
              sub="JPG / PNG / WEBP / GIF images, or PDF files."
              describedBy="tool-convert-hint" onFiles={onFiles} />
            <div className="tool-hint" id="tool-convert-hint">
              {files.length ? `${images.length} image(s), ${pdfs.length} PDF(s) ready.` : 'Add as many files as you like.'}
              {files.length ? <> · <a href="#" onClick={(e) => { e.preventDefault(); clearAll() }}>clear</a></> : null}
            </div>
          </div>

          {images.length > 0 && (
            <div className="tool-card">
              <div className="tool-card-title">Images ({images.length})</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <span>Convert to {sel(imgTarget, setImgTarget)}</span>
                <B on={convertImages}>Convert image{images.length > 1 ? 's' : ''}</B>
                <B on={imagesToPdf}>Combine into one PDF</B>
              </div>
            </div>
          )}

          {pdfs.length > 0 && (
            <div className="tool-card">
              <div className="tool-card-title">PDFs ({pdfs.length})</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <span>Pages to {sel(pdfTarget, setPdfTarget)}</span>
                <B on={pdfToImages}>PDF → images</B>
                {pdfs.length > 1 && <B on={mergePdfs}>Merge into one PDF</B>}
                <B on={splitPdf}>Split into single pages</B>
              </div>
            </div>
          )}

          {msg && <div className="tool-card"><div className="tool-msg">{msg}</div></div>}
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
