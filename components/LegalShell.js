import ThemeToggle from './ThemeToggle'
import SkipLink from './SkipLink'

// Shared chrome for the public legal pages (privacy, terms). Brand-styled,
// theme-aware, self-contained — no auth, so Google's review and customers can
// reach them.
export function LegalShell({ title, updated, children }) {
  return (
    <div className="legal-wrap">
      <SkipLink />
      <header className="legal-top">
        <a className="legal-home" href="/welcome">← Kosher Connect</a>
        {/* Every other public page offers the theme toggle; these three did
            not, and they are the pages a search result drops someone straight
            into. In the header row rather than position:fixed, which is how
            the other public pages carry it and how it ended up sitting on top
            of /repair's "My account" button. */}
        <ThemeToggle />
      </header>
      <main className="legal-main" id="main">
        <h1>{title}</h1>
        <p className="legal-updated">Last updated: {updated}</p>
        {children}
      </main>
      <footer className="legal-foot">
        <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/refund">Refunds</a> · <a href="/welcome">Home</a>
        <div className="legal-legal">Kosher Connect is a trading name of Hatsluche Ltd · 421 Bury New Road, Salford M7 4ED · 0161 531 1386</div>
      </footer>
    </div>
  )
}

export const LEGAL_CSS = `
  /* --link is the only blue here, and it flips. There used to be a second,
     --ink, that did not — every dark rule had to remember to override it by
     hand, and .legal-home never did (3.04:1). One token, no remembering. */
  :root{--gold:#c19161;--text:#1a2230;--muted:#5b6472;--line:#e4e8ef;--paper:#ffffff;--canvas:#f6f8fb;--link:#07639e}
  /* Dark arrives two different ways and this page has to answer to both.
     (1) The customer pressed the site's theme toggle: _document.js writes
     data-theme="dark" on <html> before first paint, and their OS may well
     still be light. (2) No choice stored and the OS is dark.
     Only (2) used to be covered, which broke the pages for everyone in (1):
     globals.css redefines --text under :root[data-theme="dark"] and wins on
     specificity over this block's bare :root, so the card kept its white
     --paper and took the dark theme's pale ink — the privacy policy rendered
     at 1.14:1, i.e. blank. Keep the two selectors in step. */
  :root[data-theme="dark"]{--text:#e7edf9;--muted:#9aa6c0;--line:#26314c;--paper:#0d1424;--canvas:#080d1a;--link:#4aa3e0;color-scheme:dark}
  @media (prefers-color-scheme:dark){:root:not([data-theme]){--text:#e7edf9;--muted:#9aa6c0;--line:#26314c;--paper:#0d1424;--canvas:#080d1a;--link:#4aa3e0;color-scheme:dark}}
  *{box-sizing:border-box}
  /* The app frame in globals.css pins html/body/#__next with height:100% and
     overflow:hidden (for the SPA). These legal pages use normal document
     scroll, so undo that here or the content is clipped and won't scroll. */
  html,body{height:auto;overflow-x:hidden;overflow-y:auto}
  #__next{display:block;height:auto;overflow:visible}
  body{margin:0;background:var(--canvas);color:var(--text);
    font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;line-height:1.7;font-size:16px}
  .legal-wrap{max-width:760px;margin:0 auto;padding:0 22px}
  .legal-top{padding:20px 0;display:flex;align-items:center;justify-content:space-between;gap:12px}
  /* The toggle's own rules come from globals.css, whose tokens only go dark
     under [data-theme="dark"] — on a dark OS with no choice stored this page
     is dark and those are not. Point it at this sheet's palette instead, so
     it matches in all four theme states. */
  .theme-toggle{background:var(--paper);border-color:var(--line);color:var(--text)}
  .legal-home{color:var(--link);font-weight:700;text-decoration:none;font-size:15px}
  .legal-home:hover{text-decoration:underline}
  .legal-main{background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:34px 30px;margin-bottom:24px}
  .legal-main h1{font-size:30px;letter-spacing:-.02em;margin:0 0 4px}
  .legal-updated{color:var(--muted);font-size:14px;margin:0 0 24px}
  .legal-main h2{font-size:19px;letter-spacing:-.01em;margin:28px 0 8px;color:var(--link)}
  .legal-main p,.legal-main li{color:var(--text)}
  .legal-main ul{padding-left:20px}
  .legal-main li{margin:6px 0}
  .legal-main a{color:var(--link);text-decoration:underline}
  .legal-foot{text-align:center;color:var(--muted);font-size:14px;padding:0 0 40px}
  .legal-foot a{color:var(--muted);text-decoration:none;margin:0 2px}
  .legal-foot a:hover{color:var(--link);text-decoration:underline}
  .legal-legal{font-size:12.5px;margin-top:10px;line-height:1.6}
  /* WCAG 2.5.5 — 44x44 on a coarse pointer. These six stand alone on their own
     line (the footer's separator is a middot, not prose), so the inline
     exemption the in-sentence tel:/mailto: links get does not reach them.
     Coarse pointer and min-height only: type, colour and spacing unchanged,
     and the desktop layout is untouched.
     It was 24 — the AA floor — until 26 Aug. globals.css sets 44 for this same
     list now, and loses: this sheet is a styled-jsx block, which the framework
     emits after the stylesheets. Restated here, where it can win. */
  @media (pointer:coarse){
    .legal-home,.legal-foot a{display:inline-flex;align-items:center;justify-content:center;min-height:44px}
    /* "Terms" and "Home" are 41px wide at this type size — a target short in
       the direction the height fix never looked at. */
    .legal-foot a{min-width:44px}
  }
`
