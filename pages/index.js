// "/" — the dashboard. The whole operator app is one shell (components/AppShell)
// driven by /main.js; every other screen has its own URL via pages/[tab].js.
import AppShell from '../components/AppShell'

export default function Home() {
  return <AppShell initialTab="dashboard" />
}

// Staff (with a session cookie) get the dashboard; everyone else is sent to the
// public /welcome page — so app.kosher-connect.com is a real public front door
// (what Google's OAuth review and Stripe's business verification look at), not
// a login wall. main.js / the APIs still enforce real auth on every action.
export async function getServerSideProps({ req }) {
  const { authEnabled, readSessionCookie } = await import('../lib/auth.js')
  if (authEnabled && !readSessionCookie(req)?.at) {
    return { redirect: { destination: '/welcome', permanent: false } }
  }
  return { props: {} }
}
