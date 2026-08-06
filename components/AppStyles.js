// The staff app's own stylesheet, kept out of the bundle every visitor
// downloads. styles/globals.css (imported once in _app.js) carries the design
// tokens, the reset, the fonts and everything the public pages share; /app.css
// carries the sidebar, tables, till, modals — chrome that only exists behind a
// sign-in, and a little over half the CSS by weight.
//
// Any page that renders staff chrome must include this, or it will paint with
// tokens but no layout: the AppShell routes (/, /rentals, /customers/<id>) and
// the /tools/* converter pages, which use the app's controls without the shell.
//
// Why a bare <link> in the body rather than one in next/head: this sheet has to
// win ties against globals.css, because that is the order the rules were in
// when they lived in one file — `.kc-fs-sel` is written to override
// `.form-input`, and both are one class deep, so whichever sheet comes last
// decides. Next emits its own stylesheet LAST in <head>, after everything from
// next/head and _document, so there is no way to sit after it from there. A
// stylesheet at the top of <body> is in document order after the head, gets the
// cascade right, and still blocks paint the way a head stylesheet does.
//
// The file it points at is generated from styles/app.css at build time.
// Not hashed, so not immutable-cached — same reasoning as /main.js in
// next.config.js: a stable path with a long cache would pin a stale build.
export default function AppStyles() {
  return <link rel="stylesheet" href="/app.css" />
}
