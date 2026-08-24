import { useState } from 'react'
import Head from 'next/head'
import ThemeToggle from '../../components/ThemeToggle'
import ToolDrop from '../../components/ToolDrop'
import AppStyles from '../../components/AppStyles'
import { requireStaffCookie } from '../../lib/pageAuth'
import { unzip, makeZip } from '../../lib/zipLite.mjs'
import { normalizeUkNumber } from '../../lib/ukPhone.mjs'
import { buildCard, rewriteVcfTels, parseVcf } from '../../lib/vcard.mjs'
import {
  parseSmsBackupXml, learnFigSchema, buildFigNdjson, parseNbf, parseNokiaIb,
} from '../../lib/smsFormats.mjs'

// Phone-to-phone transfer — the owner's whole migration chain as ONE wizard.
// Drop whatever the old phone gave you; the page detects the format and
// produces what the new phone needs:
//   SMS Backup & Restore XML ─┐
//   Nokia Messages.NBF       ─┴→ FIG Messenger backup ZIP (restore in-app)
//   Nokia 215 phonebook .IB  ──→ vCard .vcf
//   existing .vcf            ──→ .vcf with UK numbers fixed
// Optionally drop a FRESH backup from the target phone too — the FIG schema is
// learned from it (survives app updates); otherwise the known schema is used.
// Everything runs in the browser: no upload, no CDN, nothing leaves the page.

const KIND_LABEL = {
  'sms-xml': 'SMS Backup & Restore XML',
  nbf: 'Nokia Messages.NBF backup',
  ib: 'Nokia 215 phonebook (.IB)',
  vcf: 'vCard contacts (.vcf)',
}

function download(name, data, type) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a')
  a.href = url; a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}

const fmtDay = (ms) => {
  const n = Number(ms)
  if (!n) return '—'
  const d = new Date(n)
  return isNaN(d) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function TransferWizard() {
  const [source, setSource] = useState(null)   // { kind, name, messages? contacts? text? }
  const [sample, setSample] = useState(null)   // { name, schema }
  const [mode, setMode] = useState('plus44')
  const [markUnread, setMarkUnread] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [done, setDone] = useState('')

  async function detect(file) {
    const name = file.name
    const ext = name.toLowerCase().split('.').pop()
    if (ext === 'ib') {
      const contacts = parseNokiaIb(new Uint8Array(await file.arrayBuffer()))
      if (!contacts.length) throw new Error('No contacts found — is this the phonebook .IB file?')
      return { kind: 'ib', name, contacts }
    }
    if (ext === 'vcf' || ext === 'vcard') {
      const text = await file.text()
      const cards = parseVcf(text)
      if (!cards.length) throw new Error('No vCards found in this file.')
      return { kind: 'vcf', name, text, count: cards.length }
    }
    if (ext === 'xml' || /xml/.test(file.type)) {
      const messages = parseSmsBackupXml(await file.text())
      return { kind: 'sms-xml', name, messages }
    }
    // Anything else: try it as a ZIP (NBF backups are ZIPs whatever the name).
    const entries = await unzip(await file.arrayBuffer())
    if (entries.some((e) => e.name.startsWith('predefmessages/'))) {
      const messages = await parseNbf(entries)
      return { kind: 'nbf', name, messages }
    }
    const nd = entries.find((e) => e.name.toLowerCase().endsWith('.ndjson'))
    if (nd) throw new Error('This looks like a FIG backup of the NEW phone — drop it in the "target phone sample" box below instead.')
    throw new Error('Could not recognise this file. Expected SMS XML, Messages.NBF, a Nokia .IB, or a .vcf.')
  }

  async function onFile(files) {
    const file = files[0]
    if (!file) return
    setMsg(''); setDone(''); setBusy(true)
    try { setSource(await detect(file)) }
    catch (err) { setSource(null); setMsg(`${file.name}: ${err.message}`) }
    finally { setBusy(false) }
  }

  async function onSample(files) {
    const file = files[0]
    if (!file) return
    setMsg('')
    try {
      const entries = await unzip(await file.arrayBuffer())
      const nd = entries.find((en) => en.name.toLowerCase().endsWith('.ndjson'))
      if (!nd) throw new Error('No .ndjson inside — this doesn’t look like a FIG Messenger backup.')
      const text = new TextDecoder().decode(await nd.bytes())
      setSample({ name: file.name, schema: learnFigSchema(text), arcname: nd.name })
    } catch (err) { setSample(null); setMsg(`${file.name}: ${err.message}`) }
  }

  function stats() {
    if (!source?.messages) return null
    const ms = source.messages
    const dates = ms.map((m) => Number(m.date)).filter(Boolean)
    const addrs = new Set(ms.map((m) => normalizeUkNumber(m.address)))
    return {
      count: ms.length,
      threads: addrs.size,
      received: ms.filter((m) => m.type === '1').length,
      sent: ms.filter((m) => m.type === '2').length,
      from: dates.length ? fmtDay(Math.min(...dates)) : '—',
      to: dates.length ? fmtDay(Math.max(...dates)) : '—',
    }
  }

  function convert() {
    setBusy(true); setDone('')
    try {
      const norm = (a) => normalizeUkNumber(a, { mode })
      if (source.kind === 'sms-xml' || source.kind === 'nbf') {
        const schema = sample?.schema
        const { ndjson, count, threads } = buildFigNdjson(source.messages, schema, { normalizeAddress: norm, markUnread })
        const arcname = (sample?.arcname || 'messages.ndjson').split('/').pop()
        const zip = makeZip([{ name: arcname, data: ndjson }])
        download('messages.zip', zip, 'application/zip')
        setDone(`FIG backup written: ${count} messages in ${threads} conversations${sample ? ` (format learned from ${sample.name})` : ' (standard FIG format)'} — restore it in FIG Messenger on the new phone.`)
      } else if (source.kind === 'ib') {
        const cards = source.contacts.map((c) => buildCard({
          fullName: c.name, phones: c.phones.map(norm),
        }))
        download('nokia-phonebook.vcf', cards.join('\r\n') + '\r\n', 'text/vcard')
        setDone(`${cards.length} contacts written to nokia-phonebook.vcf — import it in the new phone’s contacts app.`)
      } else if (source.kind === 'vcf') {
        const { text, found, changed } = rewriteVcfTels(source.text, norm)
        download('contacts-fixed.vcf', text, 'text/vcard')
        setDone(`${found} phone lines checked, ${changed} normalised — everything else preserved byte-for-byte.`)
      }
    } catch (err) { setMsg(err.message) }
    finally { setBusy(false) }
  }

  const s = stats()
  const smsFlow = source && (source.kind === 'sms-xml' || source.kind === 'nbf')

  return (
    <>
      <Head><title>Phone-to-phone transfer · Kosher Connect</title><meta name="robots" content="noindex, nofollow" /></Head>
      <AppStyles />
      <div className="tool-shell">
        <ThemeToggle style={{ position: 'fixed', top: 16, right: 16, zIndex: 10 }} />
        <div className="tool-wrap">
          <div className="tool-head">
            <a href="/" className="tool-back">← Back to the app</a>
            <h1>Phone-to-phone transfer</h1>
            <p>
              Moving a customer onto a kosher phone? Drop whatever the old phone exported —
              the format is detected and converted to what the new phone needs.
              Everything runs in your browser; nothing is uploaded anywhere.
            </p>
          </div>

          <div className="tool-card">
            <div className="tool-card-title">1 · The old phone’s file</div>
            <ToolDrop id="tool-transfer-file"
              main="Drop the exported file here — or click to choose"
              sub="SMS Backup & Restore .xml · Nokia Messages.NBF · Nokia 215 phonebook .IB · any .vcf"
              describedBy="tool-transfer-hint" onFiles={onFile} />
            <div className="tool-hint" id="tool-transfer-hint">
              The format is detected automatically — just drop whatever the old phone gave you.
            </div>
            <div role="alert">{msg && <div className="tool-msg">{msg}</div>}</div>
            {source && (
              <div className="tool-detect">
                <b>{KIND_LABEL[source.kind]}</b> — {source.name}
                {s && (
                  <div className="tool-stats">
                    <span><b>{s.count}</b> messages</span>
                    <span><b>{s.threads}</b> conversations</span>
                    <span><b>{s.received}</b> received · <b>{s.sent}</b> sent</span>
                    <span>{s.from} → {s.to}</span>
                  </div>
                )}
                {source.kind === 'ib' && <div className="tool-stats"><span><b>{source.contacts.length}</b> contacts</span></div>}
                {source.kind === 'vcf' && <div className="tool-stats"><span><b>{source.count}</b> contacts</span></div>}
              </div>
            )}
          </div>

          {smsFlow && (
            <div className="tool-card">
              <div className="tool-card-title">2 · Target phone sample <span className="tool-optional">(optional, recommended)</span></div>
              <p className="tool-hint" style={{ margin: '0 0 12px' }} id="tool-transfer-sample-hint">
                Make a fresh backup in FIG Messenger on the NEW phone and drop it here —
                the exact message format is learned from it, so this keeps working even
                after app updates. Without it the standard FIG format is used.
              </p>
              <ToolDrop id="tool-transfer-sample" accept=".zip"
                main="Drop the FIG backup .zip here — or click to choose"
                describedBy="tool-transfer-sample-hint" onFiles={onSample} />
              <div role="status" aria-live="polite">{sample && <div className="tool-msg">Format learned from {sample.name} ({sample.schema.keys.length} fields).</div>}</div>
            </div>
          )}

          {source && (
            <div className="tool-card">
              <div className="tool-card-title">{smsFlow ? '3' : '2'} · Convert</div>
              <div className="tool-options">
                <label>UK numbers
                  <select className="form-input" value={mode} onChange={(e) => setMode(e.target.value)}>
                    <option value="plus44">→ +44 (international, recommended)</option>
                    <option value="national">→ 07… (national)</option>
                    <option value="keep">Keep as they are</option>
                  </select>
                </label>
                {smsFlow && (
                  <label className="tool-check">
                    <input type="checkbox" checked={markUnread} onChange={(e) => setMarkUnread(e.target.checked)} />
                    Mark all messages as unread on the new phone
                  </label>
                )}
              </div>
              <button className="btn btn-primary" onClick={convert} disabled={busy}>
                {busy ? 'Converting…' : smsFlow ? 'Download FIG backup (messages.zip)' : source.kind === 'ib' ? 'Download contacts .vcf' : 'Download fixed .vcf'}
              </button>
              <div role="status" aria-live="polite">{done && <div className="tool-msg tool-msg-ok">{done}</div>}</div>
            </div>
          )}

          <div className="tool-foot">
            Merging contact lists from Excel or several files? Use the <a href="/tools/contacts">contacts converter</a>.
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
