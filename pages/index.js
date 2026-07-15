// "/" — the dashboard. The whole operator app is one shell (components/AppShell)
// driven by /main.js; every other screen has its own URL via pages/[tab].js.
import AppShell from '../components/AppShell'
import { requireStaffCookie } from '../lib/pageAuth'

export default function Home() {
  return <AppShell initialTab="dashboard" />
}

export async function getServerSideProps({ req }) {
  const gate = await requireStaffCookie(req)
  if (gate) return gate
  return { props: {} }
}
