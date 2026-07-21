// The public marketing pages (/welcome, /join, /phone-guide) are now open to
// everyone — owner decision, "Option A", 21 Jul 2026 — so the site has a real
// public homepage that Google can review for OAuth verification.
//
// Nothing is gated here any more: the staff app (pages/index.js and the other
// tabs) enforces its own auth in getServerSideProps, and the customer portal
// uses Bearer-token auth in its APIs. The matcher is empty, so this middleware
// never runs; the file is kept (rather than deleted) to document the change.
import { NextResponse } from 'next/server'

export const config = { matcher: [] }

export function middleware() {
  return NextResponse.next()
}
