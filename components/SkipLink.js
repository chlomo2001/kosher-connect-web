// "Skip to content" — WCAG 2.4.1 Bypass Blocks (Level A).
//
// Added 26 Aug 2026. Until then every public page put the brand link and five
// nav links in front of the content, and a keyboard or screen-reader user went
// through all of them on every page, every time. That is the whole of 2.4.1,
// and it was the only Level A failure in the app.
//
// ONE COMPONENT, not nine copies. The pages have four different shells between
// them — welcome's own, the w-wrap topbar shared by the guide and the repair
// form, the tools shell, and the manual — and a link repeated in four places
// is a link that ends up saying four different things.
//
// It is invisible until focused, which is deliberate rather than sneaky: a
// permanently visible skip link is fine and some sites do it, but this one sits
// on a shop's front page and the design has no room for it. Focus brings it
// back. It must never be `display: none` or hidden from the accessibility tree
// — that is the classic way this control gets built and then does nothing.
export default function SkipLink({ href = '#main', children = 'Skip to content' }) {
  return <a className="kc-skip" href={href}>{children}</a>
}
