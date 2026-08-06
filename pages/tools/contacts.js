import { useState } from 'react'
import Head from 'next/head'
import ThemeToggle from '../../components/ThemeToggle'
import ToolDrop from '../../components/ToolDrop'
import AppStyles from '../../components/AppStyles'
import { requireStaffCookie } from '../../lib/pageAuth'
import { parseVcf, buildCard, parseCard, dedupeCards, rewriteVcfTels } from '../../lib/vcard.mjs'
import { parseCsv, parseXlsx } from '../../lib/sheetLite.mjs'
import { normalizeUkNumber, phoneKey } from '../../lib/ukPhone.mjs'

// Contacts Converter — one page replacing five of the owner's stand-alone
// tools (excel→vcf ×3 generations, vcf-merger, vcard_cleaner): drop Excel/CSV
// contact lists and existing VCF files, map the columns, normalise UK numbers,
// merge everything and download one deduplicated vCard file.
// Everything runs IN THE BROWSER — no upload, no CDN, nothing leaves the page.

const COLUMN_ROLES = [
  ['ignore', 'Ignore'], ['first', 'First name'], ['last', 'Last name'],
  ['full', 'Full name'], ['phone', 'Phone'],
]

const guessRole = (header) => {
  const h = String(header || '').toLowerCase()
  if (/phone|mobile|tel|number/.test(h)) return 'phone'
  if (/first/.test(h)) return 'first'
  if (/last|surname|family/.test(h)) return 'last'
  if (/name|contact/.test(h)) return 'full'
  return 'ignore'
}

const splitPhones = (cell) => String(cell || '').split(/[,;\n]/).map((s) => s.trim()).filter(Boolean)

function download(name, text, type = 'text/vcard') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url; a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}

export default function ContactsConverter() {
  const [pool, setPool] = useState([])          // { fn, first, last, phones[], raw?, source }
  const [pending, setPending] = useState(null)  // spreadsheet awaiting mapping
  const [mode, setMode] = useState('plus44')
  const [dedupe, setDedupe] = useState(true)
  const [msg, setMsg] = useState('')
  const [result, setResult] = useState(null)

  async function onFiles(files) {
    setMsg(''); setResult(null)
    for (const file of files) {
      const ext = file.name.toLowerCase().split('.').pop()
      try {
        if (ext === 'vcf' || ext === 'vcard') {
          const text = await file.text()
          const cards = parseVcf(text)
          if (!cards.length) throw new Error('No vCards found in this file.')
          setPool((p) => [...p, ...cards.map((c) => ({ fn: c.fn, phones: c.tels, raw: c.raw, source: file.name }))])
        } else if (ext === 'csv' || ext === 'txt') {
          const rows = parseCsv(await file.text())
          if (!rows.length) throw new Error('The file is empty.')
          openMapping(file.name, rows)
        } else if (ext === 'xlsx') {
          const rows = await parseXlsx(await file.arrayBuffer())
          if (!rows.length) throw new Error('The sheet is empty.')
          openMapping(file.name, rows)
        } else if (ext === 'xls') {
          throw new Error('Legacy .xls isn’t supported — open it in Excel and save as .xlsx or .csv, then drop it here.')
        } else {
          throw new Error(`Unsupported file type ".${ext}" — use .xlsx, .csv or .vcf.`)
        }
      } catch (err) {
        setMsg(`${file.name}: ${err.message}`)
      }
    }
  }

  function openMapping(name, rows) {
    setPending((prev) => {
      if (prev) { setMsg('Finish mapping the current spreadsheet first, then add the next one.'); return prev }
      const headerish = rows[0].some((c) => /[A-Za-z]/.test(c)) && !rows[0].some((c) => /^\+?\d{7,}$/.test(c.replace(/[\s()-]/g, '')))
      const width = Math.max(...rows.slice(0, 25).map((r) => r.length))
      const roles = Array.from({ length: width }, (_, i) => (headerish ? guessRole(rows[0][i]) : 'ignore'))
      if (!headerish && !roles.includes('phone')) {
        // No headers to guess from: assume col A = name, B = phone (his lists' shape).
        roles[0] = 'full'
        if (width > 1) roles[1] = 'phone'
      }
      return { name, rows, roles, hasHeader: headerish }
    })
  }

  function addMapped() {
    const { name, rows, roles, hasHeader } = pending
    const body = hasHeader ? rows.slice(1) : rows
    const entries = []
    let skipped = 0
    for (const row of body) {
      let first = '', last = '', full = ''
      const phones = []
      roles.forEach((role, i) => {
        const cell = row[i] || ''
        if (role === 'first') first = first || cell
        else if (role === 'last') last = last || cell
        else if (role === 'full') full = full || cell
        else if (role === 'phone') phones.push(...splitPhones(cell))
      })
      if (!phones.length) { skipped++; continue }
      entries.push({ fn: (full || `${first} ${last}`.trim()), first, last, phones, source: name })
    }
    setPool((p) => [...p, ...entries])
    setPending(null)
    setMsg(`${name}: added ${entries.length} contact${entries.length === 1 ? '' : 's'}${skipped ? `, skipped ${skipped} row${skipped === 1 ? '' : 's'} without a phone` : ''}.`)
  }

  const removeSource = (src) => { setPool((p) => p.filter((e) => e.source !== src)); setResult(null) }

  function buildOutput() {
    const norm = (v) => normalizeUkNumber(v, { mode })
    let changed = 0
    const blocks = pool.map((e) => {
      if (e.raw) {
        const r = rewriteVcfTels(e.raw, norm)
        changed += r.changed
        return r.text
      }
      const phones = e.phones.map((p) => {
        const n = norm(p)
        if (n !== p) changed++
        return n
      })
      return buildCard({ first: e.first || '', last: e.last || '', fullName: e.fn, phones })
    })
    let cards = blocks.map((b) => parseCard(b))
    let removed = 0
    if (dedupe) ({ kept: cards, removed } = dedupeCards(cards, phoneKey))
    const text = cards.map((c) => c.raw).join('\r\n') + '\r\n'
    setResult({ total: blocks.length, kept: cards.length, removed, changed })
    download('contacts-merged.vcf', text)
  }

  const sources = [...new Set(pool.map((e) => e.source))]

  return (
    <>
      <Head><title>Contacts Converter · Kosher Connect</title></Head>
      <AppStyles />
      <div className="tool-shell">
        <ThemeToggle style={{ position: 'fixed', top: 16, right: 16, zIndex: 10 }} />
        <div className="tool-wrap">
          <div className="tool-head">
            <a href="/" className="tool-back">← Back to the app</a>
            <h1>Contacts Converter</h1>
            <p>
              Drop Excel, CSV or vCard files → map the columns → UK numbers become +44 →
              one merged, de-duplicated .vcf ready to import on any phone.
              Everything runs in your browser; nothing is uploaded anywhere.
            </p>
          </div>

          <div className="tool-card">
            <div className="tool-card-title">1 · Add files</div>
            <ToolDrop id="tool-contacts-file" multiple accept=".csv,.txt,.xlsx,.xls,.vcf,.vcard"
              main="Drop files here — or click to choose"
              sub=".xlsx / .csv contact lists and existing .vcf files, in any mix"
              describedBy="tool-contacts-hint" onFiles={onFiles} />
            <div className="tool-hint" id="tool-contacts-hint">Old .xls? Re-save it as .xlsx or .csv first, then drop it here.</div>
            <div role="alert">{msg && <div className="tool-msg">{msg}</div>}</div>
          </div>

          {pending && (
            <div className="tool-card">
              <div className="tool-card-title">Map the columns of “{pending.name}”</div>
              <label className="tool-check">
                <input type="checkbox" checked={pending.hasHeader}
                  onChange={(e) => setPending({ ...pending, hasHeader: e.target.checked })} />
                First row is headers
              </label>
              <div className="tool-scroll">
                <table className="tool-table">
                  <thead>
                    <tr>
                      {pending.roles.map((role, i) => (
                        <th key={i}>
                          <select className="form-input" value={role}
                            aria-label={`Column ${i + 1}${pending.hasHeader && pending.rows[0] && pending.rows[0][i] ? ` (${pending.rows[0][i]})` : ''} — map to`}
                            onChange={(e) => {
                              const roles = [...pending.roles]; roles[i] = e.target.value
                              setPending({ ...pending, roles })
                            }}>
                            {COLUMN_ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pending.rows.slice(0, 6).map((row, r) => (
                      <tr key={r} className={r === 0 && pending.hasHeader ? 'tool-row-header' : ''}>
                        {pending.roles.map((_, c) => <td key={c}>{row[c] || ''}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="tool-actions">
                <button className="btn btn-outline" onClick={() => setPending(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={addMapped}
                  disabled={!pending.roles.includes('phone')}>
                  Add to the pool
                </button>
              </div>
              {!pending.roles.includes('phone') && <div className="tool-hint">Mark at least one column as Phone.</div>}
            </div>
          )}

          {pool.length > 0 && (
            <div className="tool-card">
              <div className="tool-card-title">2 · Pool — {pool.length} contact{pool.length === 1 ? '' : 's'}</div>
              <div className="tool-chips">
                {sources.map((s) => (
                  <span key={s} className="tool-chip">
                    {s} ({pool.filter((e) => e.source === s).length})
                    <button onClick={() => removeSource(s)} title={`Remove ${s}`} aria-label={`Remove ${s}`}>✕</button>
                  </span>
                ))}
              </div>
              <div className="tool-scroll" style={{ maxHeight: 260 }}>
                <table className="tool-table">
                  <thead><tr><th>Name</th><th>Numbers</th><th>From</th></tr></thead>
                  <tbody>
                    {pool.slice(0, 50).map((e, i) => (
                      <tr key={i}><td>{e.fn || <i>—</i>}</td><td>{e.phones.join(' · ')}</td><td>{e.source}</td></tr>
                    ))}
                  </tbody>
                </table>
                {pool.length > 50 && <div className="tool-hint">…and {pool.length - 50} more.</div>}
              </div>
            </div>
          )}

          {pool.length > 0 && (
            <div className="tool-card">
              <div className="tool-card-title">3 · Convert &amp; download</div>
              <div className="tool-options">
                <label>UK numbers
                  <select className="form-input" value={mode} onChange={(e) => setMode(e.target.value)}>
                    <option value="plus44">→ +44 (international, recommended)</option>
                    <option value="0044">→ 0044…</option>
                    <option value="national">→ 07… / 01… (national)</option>
                    <option value="keep">Keep as they are</option>
                  </select>
                </label>
                <label className="tool-check">
                  <input type="checkbox" checked={dedupe} onChange={(e) => setDedupe(e.target.checked)} />
                  Remove duplicates (same name + same numbers)
                </label>
              </div>
              <button className="btn btn-primary" onClick={buildOutput}>⬇ Download merged .vcf</button>
              <div role="status" aria-live="polite">
                {result && (
                  <div className="tool-msg">
                    {result.kept} contact{result.kept === 1 ? '' : 's'} written
                    {result.removed ? ` · ${result.removed} duplicate${result.removed === 1 ? '' : 's'} removed` : ''}
                    {result.changed ? ` · ${result.changed} number${result.changed === 1 ? '' : 's'} normalised` : ''}.
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="tool-card">
            <div className="tool-card-title">Export KC customers</div>
            <p className="tool-hint" style={{ margin: '0 0 12px' }}>
              Download the whole customer base as a vCard file with +44-normalised numbers —
              for setting up a shop phone. Owner sign-in required.
            </p>
            <a className="btn btn-outline" href="/api/customers-vcf">⬇ customers.vcf</a>
          </div>

          <div className="tool-foot">
            Looking to move SMS or a Nokia phonebook? Use the <a href="/tools/transfer">phone-to-phone transfer</a> tool.
          </div>
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
