// Shared chrome for the public legal pages (privacy, terms). Brand-styled,
// theme-aware, self-contained — no auth, so Google's review and customers can
// reach them.
export function LegalShell({ title, updated, children }) {
  return (
    <div className="legal-wrap">
      <header className="legal-top">
        <a className="legal-home" href="/welcome">← Kosher Connect</a>
      </header>
      <main className="legal-main">
        <h1>{title}</h1>
        <p className="legal-updated">Last updated: {updated}</p>
        {children}
      </main>
      <footer className="legal-foot">
        <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/refund">Refunds</a> · <a href="/welcome">Home</a>
        <div className="legal-legal">Kosher Connect is a trading name of Hatzluche Ltd · 421 Bury New Road, Salford M7 4ED · 0161 531 1386</div>
      </footer>
    </div>
  )
}

export const LEGAL_CSS = `
  :root{--ink:#07639e;--gold:#c19161;--text:#1a2230;--muted:#5b6472;--line:#e4e8ef;--paper:#ffffff;--canvas:#f6f8fb}
  @media (prefers-color-scheme:dark){:root{--text:#e7edf9;--muted:#9aa6c0;--line:#26314c;--paper:#0d1424;--canvas:#080d1a}}
  *{box-sizing:border-box}
  body{margin:0;background:var(--canvas);color:var(--text);
    font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;line-height:1.7;font-size:16px}
  .legal-wrap{max-width:760px;margin:0 auto;padding:0 22px}
  .legal-top{padding:20px 0}
  .legal-home{color:var(--ink);font-weight:700;text-decoration:none;font-size:15px}
  .legal-home:hover{text-decoration:underline}
  .legal-main{background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:34px 30px;margin-bottom:24px}
  .legal-main h1{font-size:30px;letter-spacing:-.02em;margin:0 0 4px}
  .legal-updated{color:var(--muted);font-size:14px;margin:0 0 24px}
  .legal-main h2{font-size:19px;letter-spacing:-.01em;margin:28px 0 8px;color:var(--ink)}
  @media (prefers-color-scheme:dark){.legal-main h2{color:#4aa3e0}}
  .legal-main p,.legal-main li{color:var(--text)}
  .legal-main ul{padding-left:20px}
  .legal-main li{margin:6px 0}
  .legal-main a{color:var(--ink);text-decoration:underline}
  @media (prefers-color-scheme:dark){.legal-main a{color:#4aa3e0}}
  .legal-foot{text-align:center;color:var(--muted);font-size:14px;padding:0 0 40px}
  .legal-foot a{color:var(--muted);text-decoration:none;margin:0 2px}
  .legal-foot a:hover{color:var(--ink);text-decoration:underline}
  .legal-legal{font-size:12.5px;margin-top:10px;line-height:1.6}
`
