import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import ThemeToggle from '../components/ThemeToggle'
import AppStyles from '../components/AppStyles'
import { requireStaffCookie } from '../lib/pageAuth'
import { SCREENS, screensOf, manualProgress, manualStampLine } from '../lib/manual.mjs'
import { GUIDES } from '../lib/guides.mjs'

// /manual — the whole system, one screen at a time, on one printable page.
//
// The counter's other half. lib/guides.mjs answers "how do I do this job" from
// the ❓ button, in the middle of doing it; this is the reference you read
// BEFORE the shift, or print and keep by the till, or hand to someone starting
// on Sunday. Same source as docs/MANUAL.md — lib/manual.mjs — so there is one
// place to correct a sentence and no second copy to go stale.
//
// Staff-only, behind the same cookie gate as the tools pages: it describes how
// the shop is run, which is nobody's business but the shop's.

const Rows = ({ rows }) => (
  <ul style={{ margin: '0 0 14px', paddingLeft: 18, display: 'grid', gap: 6 }}>
    {rows.map(([label, text]) => (
      <li key={label}>
        <strong>{label}</strong> — {text}
      </li>
    ))}
  </ul>
)

const Heading = ({ children }) => (
  <div style={{ fontSize: 'var(--fs-small)', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '.04em', color: 'var(--muted)', margin: '0 0 6px' }}>{children}</div>
)

function Screen({ s, shots }) {
  const screenShot = shots[`screen-${s.id}`]
  return (
    <section id={s.id} className="kc-man-screen">
      <h3 style={{ margin: '0 0 4px', fontSize: 'var(--fs-title)' }}>
        {s.name}
        {s.path && <code style={{ marginLeft: 8, fontSize: 'var(--fs-small)', color: 'var(--muted)' }}>{s.path}</code>}
      </h3>
      <p style={{ margin: '0 0 14px', fontSize: 'var(--fs-body)' }}>{s.what}</p>

      {/* The picture before the prose. It is the app itself, shot against the
          seed by the same harness that audits geometry, so it cannot drift
          into describing a version of the screen that no longer exists. */}
      {screenShot && (
        <figure className="kc-man-shot">
          <img src={screenShot} alt={`The ${s.name} screen`} loading="lazy" />
          <figcaption>{s.name} — the screen as it opens, with example data.</figcaption>
        </figure>
      )}

      {s.status === 'draft' ? (
        <p className="kc-man-draft" style={{ margin: 0, padding: '8px 12px', borderRadius: 8,
          background: 'var(--bg-secondary)', color: 'var(--muted)', fontSize: 'var(--fs-small)' }}>
          Not written out in full yet — the sentence above is all this entry promises.
        </p>
      ) : (
        <>
          {s.parts.length > 0 && <><Heading>On the screen</Heading><Rows rows={s.parts} /></>}

          {s.example && (
            <div className="kc-man-example">
              <Heading>{s.example.title}</Heading>
              <ol>{s.example.steps.map((st, i) => <li key={i}>{st}</li>)}</ol>
            </div>
          )}

          {/* Each box gets its own photograph. These are where the decisions
              are actually made, so they are the pictures the manual most
              needed and the ones it never had. */}
          {s.dialogs.length > 0 && (
            <>
              <Heading>Boxes that open on top of it</Heading>
              {s.dialogs.map(([id, text]) => {
                const img = shots[`dialog-${id}`]
                return img ? (
                  <div className="kc-man-dialog" key={id}>
                    {/* The thumbnail is small enough that the box's own words
                        are not readable in it, which for a dialog is most of
                        the point — so it opens full size in a new tab. */}
                    <a href={img} target="_blank" rel="noreferrer" title="Open this box full size">
                      <img src={img} alt={`The ${id} box`} loading="lazy" />
                    </a>
                    <div style={{ fontSize: 'var(--fs-small)' }}>
                      {text}
                      <div style={{ marginTop: 6, fontSize: 'var(--fs-micro)', color: 'var(--muted)' }}>
                        <a href={img} target="_blank" rel="noreferrer">See it full size ↗</a>
                      </div>
                    </div>
                  </div>
                ) : (
                  <ul key={id} style={{ margin: '0 0 10px', paddingLeft: 18 }}><li>{text}</li></ul>
                )
              })}
            </>
          )}

          {s.rules.length > 0 && (
            <div className="kc-man-note is-rule">
              <Heading>Rules that bite here</Heading>
              <ul>{s.rules.map((r) => <li key={r}>{r}</li>)}</ul>
            </div>
          )}

          {s.wrong.length > 0 && (
            <div className="kc-man-note is-wrong">
              <Heading>When it goes wrong</Heading>
              <ul>{s.wrong.map(([label, text]) => (
                <li key={label}><strong>{label}</strong> — {text}</li>
              ))}</ul>
            </div>
          )}
        </>
      )}
    </section>
  )
}

// Everything a screen's entry says, flattened once for the filter box. The
// filter reads the SAME objects the page renders — there is no second index
// to go stale, which is the manual's one law applied to its own search.
function screenText(s) {
  return [
    s.name, s.path, s.what,
    ...s.parts.flatMap((p) => p),
    ...s.dialogs.flatMap((d) => d),
    ...s.rules,
    ...s.wrong.flatMap((w) => w),
    ...(s.example ? [s.example.title, ...s.example.steps] : []),
  ].join(' ').toLowerCase()
}

// `shots` defaults to {} because the offline page harness renders this
// component without running getServerSideProps. A page that throws when a
// server-supplied prop is absent cannot be checked offline at all, and the
// pictures are an enhancement — their absence must degrade to the text page,
// which is the same contract test/manualShots.test.mjs already holds.
export default function Manual({ shots = {} }) {
  // Marks the page for the print rules in app.css. body and #__next are sized
  // and clipped for the app frame, and printing inherits that: the first
  // attempt printed exactly one page — the part of the manual on screen — and
  // dropped the other twenty-eight screens without a word.
  useEffect(() => {
    document.body.classList.add('kc-manual')
    return () => document.body.classList.remove('kc-manual')
  }, [])

  // The filter (owner, 23 Aug: "why is the manual still so uninteractive?").
  // Word-match against everything each entry says; empty query = the whole
  // manual, unchanged. Printing prints what is SHOWING — filter to one screen
  // and 🖨 gives you that screen's sheets for the till, not all twenty-nine.
  const [q, setQ] = useState('')
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  const hits = useMemo(() => {
    if (!words.length) return null
    const ok = new Set()
    for (const s of SCREENS) {
      const text = screenText(s)
      if (words.every((w) => text.includes(w))) ok.add(s.id)
    }
    return ok
  }, [q]) // eslint-disable-line react-hooks/exhaustive-deps

  const keep = (list) => (hits ? list.filter((s) => hits.has(s.id)) : list)
  const frame = keep(screensOf('frame'))
  const staff = keep(screensOf('staff'))
  const pages = keep(screensOf('public'))
  const shown = frame.length + staff.length + pages.length
  const { total, written, drafts } = manualProgress()

  return (
    <>
      <Head>
        <title>The manual — Kosher Connect</title>
        <meta name="robots" content="noindex" />
      </Head>
      <AppStyles />

      {/* The page is its own scroll container, like .tool-shell and
          .welcome-shell: body and #__next are overflow:hidden for the app
          frame, so a long standalone page is UNSCROLLABLE without this — every
          screen below the first one unreachable. /welcome shipped that bug
          once; this page shipped it again on 18 Aug. */}
      <div className="kc-man-shell">
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '24px 18px 60px' }}>
        <div className="kc-man-chrome" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          {/* A plain link, like every other page here: leaving the manual is a
              real navigation back into the app, not a client-side hop. */}
          <a href="/" className="btn btn-outline btn-sm">← Back to the app</a>
          <button className="btn btn-outline btn-sm" onClick={() => window.print()}>🖨 Print</button>
          <div style={{ marginLeft: 'auto' }}><ThemeToggle /></div>
        </div>

        <h1 style={{ margin: '0 0 6px' }}>The manual</h1>
        <p style={{ color: 'var(--muted)', margin: '0 0 4px' }}>
          Every screen in the system, what it is for, and what to do when it argues with you.
        </p>
        <p style={{ color: 'var(--muted)', fontSize: 'var(--fs-small)', margin: '0 0 20px' }}>
          Step-by-step answers for a job in front of you live in the app — press <strong>❓ How do I…?</strong> on
          any screen. Prices, free days and caps are not repeated here: they live in Settings, so there is only
          ever one price list. {written} of {total} screens are written out in full
          {drafts > 0 && `; ${drafts} are still short entries`}.
          {' '}<span className="kc-man-stamp">{manualStampLine()}</span>
        </p>

        {/* Repeats at the foot of EVERY printed sheet — position:fixed prints
            per page, which is the whole trick. A held printout can be checked
            against the live page without hunting for its first sheet. */}
        <div className="kc-man-stampfoot" aria-hidden="true">Kosher Connect manual · {manualStampLine()}</div>

        <div className="kc-man-filter" style={{ margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            className="form-input"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find in the manual — a screen, a button, a problem…"
            aria-label="Find in the manual"
            style={{ maxWidth: 420 }}
          />
          {q && (
            <>
              <span style={{ fontSize: 'var(--fs-small)', color: 'var(--muted)' }}>
                {shown === 0 ? 'Nothing mentions that.' : `${shown} of ${total} screens mention it.`}
              </span>
              <button className="btn btn-outline btn-sm" onClick={() => setQ('')}>Show everything</button>
            </>
          )}
        </div>

        {/* Common jobs — the Virtual Mail idea of a task-shaped strip before
            the reference (its navigation map opens with "Common shortcuts",
            then the full key-by-key map). DERIVED from lib/guides.mjs at
            render, never a second copy of any question or step — the guides
            answer these in the app under ❓, and this strip only says which
            jobs are already written out. Hidden in print for the same reason
            the contents is: on paper it points at a button paper doesn't
            have. */}
        <nav className="kc-man-jobs" style={{ margin: '0 0 18px', padding: '12px 14px', borderRadius: 10,
          border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          <Heading>Common jobs</Heading>
          <p style={{ margin: '0 0 8px', fontSize: 'var(--fs-small)', color: 'var(--muted)' }}>
            These {GUIDES.length} jobs are written out step by step inside the app — press
            <strong> ❓ How do I…?</strong> on any screen and ask in your own words. This page explains
            the screens; that button walks the job.
          </p>
          <div className="kc-man-toc-grid">
            {GUIDES.map((g) => <span key={g.id} className="kc-man-job">{g.q}</span>)}
          </div>
        </nav>

        <nav className="kc-man-toc" style={{ margin: '0 0 26px', padding: '12px 14px', borderRadius: 10,
          border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          <Heading>Contents</Heading>
          {/* Grouped the way the page below is grouped. Twenty-nine names in
              one grid is a list you read start to finish to find anything;
              the same names under the three headings they already sit under
              is a list you can aim at. The headings are the h2s further down,
              word for word, so the contents and the page agree. */}
          {[['The frame around every screen', frame],
            ['The staff app', staff],
            ['Pages with their own address', pages]].filter(([, g]) => g.length).map(([label, group]) => (
            <div key={label} className="kc-man-toc-group">
              <div className="kc-man-toc-label">{label}</div>
              <div className="kc-man-toc-grid">
                {group.map((s) => <a key={s.id} href={`#${s.id}`}>{s.name}</a>)}
              </div>
            </div>
          ))}
        </nav>

        {/* The chrome first: it is what someone is looking at before they have
            chosen a screen, and it is where the three help buttons are explained. */}
        {frame.length > 0 && <>
          <h2 style={{ margin: '0 0 12px' }}>The frame around every screen</h2>
          {frame.map((s) => <Screen key={s.id} s={s} shots={shots} />)}
        </>}

        {staff.length > 0 && <>
          <h2 style={{ margin: '26px 0 12px' }}>The staff app</h2>
          {staff.map((s) => <Screen key={s.id} s={s} shots={shots} />)}
        </>}

        {pages.length > 0 && <>
          <h2 style={{ margin: '26px 0 12px' }}>Pages with their own address</h2>
          {pages.map((s) => <Screen key={s.id} s={s} shots={shots} />)}
        </>}
      </div>
      </div>

    </>
  )
}

export async function getServerSideProps({ req }) {
  const gate = await requireStaffCookie(req)
  if (gate) return gate
  // Which pictures actually exist, read at request time rather than assumed.
  // A screen whose shot has not been taken yet simply reads as it always did,
  // instead of showing a broken image — the manual degrades to the old page
  // rather than to a worse one.
  // Imported HERE, not at module scope. A top-level `import fs from 'node:fs'`
  // is invisible to Next (it strips getServerSideProps from the client bundle)
  // but NOT to the offline page harness, which parses the module as written —
  // and it dropped /manual out of the harness entirely for a day. Server-only
  // modules belong inside the server-only function.
  const { default: fs } = await import('node:fs')
  const { default: path } = await import('node:path')
  let shots = {}
  try {
    const dir = path.join(process.cwd(), 'public/manual')
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.png')) shots[f.slice(0, -4)] = `/manual/${f}`
    }
  } catch { shots = {} }
  return { props: { shots } }
}
