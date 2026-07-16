// Server-only page login gate, shared by the app routes (pages/index.js and
// pages/[tab].js). Kept OUT of components/AppShell.js on purpose: that file is
// in the client bundle, and importing lib/auth.js (which uses node:crypto) from
// a client module breaks the webpack build. Only getServerSideProps imports
// this, so it stays server-side.
//
// When auth is enabled (tables mode), an unauthenticated browser goes to
// /login. Checks cookie PRESENCE only — every API call verifies the token
// properly, and main.js redirects to /login on any 401.
export async function requireStaffCookie(req) {
  const { authEnabled, readSessionCookie } = await import('./auth.js')
  // Parse the cookie properly rather than substring-matching 'kc_session=': a
  // substring test also accepts a forged/adjacent cookie like 'junk=kc_session=1'.
  // Still a presence check (the API layer verifies the token), just an honest one.
  // audit C20.
  if (authEnabled && !readSessionCookie(req)?.at) {
    return { redirect: { destination: '/login', permanent: false } }
  }
  return null
}
