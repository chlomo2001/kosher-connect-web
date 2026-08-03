// /customers/<id> — the Customer-360 profile page. Same auth gate and shell
// as pages/[tab].js, one segment deeper; /main.js reads the second path
// segment on boot and opens the full-page profile instead of the customers
// list. The id is deliberately NOT validated here (that would cost a DB
// round-trip per view before paint) — an unknown id renders the app's own
// "customer not found" state client-side.
import AppShell from '../../components/AppShell'
import { requireStaffCookie } from '../../lib/pageAuth'

export default function CustomerProfile() {
  return <AppShell initialTab="customers" />
}

export async function getServerSideProps({ req }) {
  const gate = await requireStaffCookie(req)
  if (gate) return gate
  return { props: {} }
}
