import Head from 'next/head'
import ThemeToggle from '../components/ThemeToggle'
import AppStyles from '../components/AppStyles'
import { requireStaffCookie } from '../lib/pageAuth'
import { SCREENS, screensOf, manualProgress } from '../lib/manual.mjs'

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

function Screen({ s }) {
  return (
    <section id={s.id} className="kc-man-screen">
      <h3 style={{ margin: '0 0 4px', fontSize: 'var(--fs-title)' }}>
        {s.name}
        {s.path && <code style={{ marginLeft: 8, fontSize: 'var(--fs-small)', color: 'var(--muted)' }}>{s.path}</code>}
      </h3>
      <p style={{ margin: '0 0 12px' }}>{s.what}</p>

      {s.status === 'draft' ? (
        <p className="kc-man-draft" style={{ margin: 0, padding: '8px 12px', borderRadius: 8,
          background: 'var(--bg-secondary)', color: 'var(--muted)', fontSize: 'var(--fs-small)' }}>
          Not written out in full yet — the sentence above is all this entry promises.
        </p>
      ) : (
        <>
          {s.parts.length > 0 && <><Heading>On the screen</Heading><Rows rows={s.parts} /></>}
          {s.dialogs.length > 0 && <><Heading>Boxes that open on top of it</Heading><Rows rows={s.dialogs} /></>}
          {s.rules.length > 0 && (
            <>
              <Heading>Rules that bite here</Heading>
              <ul style={{ margin: '0 0 14px', paddingLeft: 18, display: 'grid', gap: 6 }}>
                {s.rules.map((r) => <li key={r}>{r}</li>)}
              </ul>
            </>
          )}
          {s.wrong.length > 0 && <><Heading>When it goes wrong</Heading><Rows rows={s.wrong} /></>}
        </>
      )}
    </section>
  )
}

export default function Manual() {
  const frame = screensOf('frame')
  const staff = screensOf('staff')
  const pages = screensOf('public')
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
        </p>

        <nav className="kc-man-toc" style={{ margin: '0 0 26px', padding: '12px 14px', borderRadius: 10,
          border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          <Heading>Contents</Heading>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
            {SCREENS.map((s) => <a key={s.id} href={`#${s.id}`}>{s.name}</a>)}
          </div>
        </nav>

        {/* The chrome first: it is what someone is looking at before they have
            chosen a screen, and it is where the three help buttons are explained. */}
        <h2 style={{ margin: '0 0 12px' }}>The frame around every screen</h2>
        {frame.map((s) => <Screen key={s.id} s={s} />)}

        <h2 style={{ margin: '26px 0 12px' }}>The staff app</h2>
        {staff.map((s) => <Screen key={s.id} s={s} />)}

        <h2 style={{ margin: '26px 0 12px' }}>Pages with their own address</h2>
        {pages.map((s) => <Screen key={s.id} s={s} />)}
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
