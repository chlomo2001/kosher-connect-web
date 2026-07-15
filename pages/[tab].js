// "/rentals", "/customers", "/settings" … — every operator tab gets its own
// URL. Exact routes (/login, /portal, /api/*) still win over this dynamic one.
// Unknown single-segment paths 404; /dashboard canonicalises to "/". The page
// renders the same shell as index.js — /main.js reads location.pathname on boot
// to open the right tab, and keeps the URL in step as you navigate.
import AppShell, { TAB_IDS } from '../components/AppShell'
import { requireStaffCookie } from '../lib/pageAuth'

export default function Tab({ initialTab }) {
  return <AppShell initialTab={initialTab} />
}

export async function getServerSideProps({ req, params }) {
  const tab = String(params.tab || '').toLowerCase()
  // Dashboard lives at "/", so keep a single canonical URL for it.
  if (tab === 'dashboard') return { redirect: { destination: '/', permanent: false } }
  if (!TAB_IDS.includes(tab)) return { notFound: true }
  const gate = await requireStaffCookie(req)
  if (gate) return gate
  return { props: { initialTab: tab } }
}
