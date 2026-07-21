// The public marketing pages are locked while the new site is designed
// (owner decision, 21 Jul 2026): /welcome, /join and /phone-guide are only
// reachable with a staff session cookie — everyone else lands on sign-in.
// The customer portal (Bearer-token auth, untouched by this matcher) and the
// free tools stay public. Cookie PRESENCE is the gate (real verification
// happens in the APIs); the worst a forged cookie earns is marketing copy.
import { NextResponse } from 'next/server'

export const config = { matcher: ['/welcome', '/join', '/phone-guide'] }

export function middleware(req) {
  if (req.cookies.get('kc_session')) return NextResponse.next()
  return NextResponse.redirect(new URL('/login', req.url))
}
