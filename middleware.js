// The public marketing pages are locked again while the Sky redesign of the
// homepage is built (owner decision, 21 Jul 2026): /welcome, /join and
// /phone-guide are only reachable with a staff session cookie; everyone else
// lands on sign-in. They were briefly opened for Google's OAuth homepage
// review — that's finished (the app is published), so they go back behind the
// gate until the new /welcome ships.
//
// Note: /privacy and /terms are deliberately NOT gated here, so the links on
// the Google consent screen (and the privacy policy Google requires) stay
// publicly reachable. The customer portal (Bearer-token auth) and the free
// tools also stay public. Cookie PRESENCE is the gate; real verification
// happens in the APIs, so the worst a forged cookie earns is marketing copy.
import { NextResponse } from 'next/server'

export const config = { matcher: ['/welcome', '/join', '/phone-guide'] }

export function middleware(req) {
  if (req.cookies.get('kc_session')) return NextResponse.next()
  return NextResponse.redirect(new URL('/login', req.url))
}
