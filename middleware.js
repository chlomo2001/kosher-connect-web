// /welcome is PUBLIC (owner decision, 22 Jul 2026): both Google's OAuth review
// and Stripe's business verification need a publicly reachable page showing the
// business, its products/prices, contact details and policy links — and paused
// Stripe payouts hinge on it. /privacy, /terms and /refund stay open with it.
// The bare root ("/") sends logged-out visitors to /welcome (see pages/index.js).
//
// /join and /phone-guide were initially login-gated, but /welcome links to both
// (lead capture + the handset guide), so public visitors hit a staff login
// wall. Owner decision, 27 Jul 2026: ungate both. /api/public/join was already
// public with its own validation + dedupe, and the phone guide is marketing
// content. Nothing is gated here any more; the file stays (empty matcher) so
// the routing history remains documented in place.
export const config = { matcher: [] }

export function middleware() {}
