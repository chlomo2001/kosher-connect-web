// /welcome is PUBLIC (owner decision, 22 Jul 2026): both Google's OAuth review
// and Stripe's business verification need a publicly reachable page showing the
// business, its products/prices, contact details and policy links — and paused
// Stripe payouts hinge on it. So /welcome (plus /privacy, /terms and the new
// /refund) stay open. The bare root ("/") sends logged-out visitors to /welcome
// too (see pages/index.js). /join and /phone-guide remain gated for now.
//
// The customer portal (Bearer-token auth) and the free tools also stay public.
// Cookie PRESENCE is the gate; real verification happens in the APIs, so the
// worst a forged cookie earns on a gated page is marketing copy.
import { NextResponse } from 'next/server'

export const config = { matcher: ['/join', '/phone-guide'] }

export function middleware(req) {
  if (req.cookies.get('kc_session')) return NextResponse.next()
  return NextResponse.redirect(new URL('/login', req.url))
}
