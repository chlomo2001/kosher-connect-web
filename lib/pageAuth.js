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
  const { authEnabled } = await import('./auth.js')
  if (authEnabled && !(req.headers.cookie || '').includes('kc_session=')) {
    return { redirect: { destination: '/login', permanent: false } }
  }
  return null
}
