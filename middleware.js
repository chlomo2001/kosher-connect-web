import { NextResponse } from 'next/server'

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
// content. Nothing is gated here any more.
//
// SHOP HOSTS (owner decision, 30 Jul 2026): the main domain serves the shop
// site directly, and app.kosher-connect.com stays the staff app. One Vercel
// project answers all three hostnames, so the split is made here by Host:
// on the main domain "/" is REWRITTEN to /welcome — a rewrite, not a redirect,
// so the customer keeps seeing kosher-connect.com in the address bar.
//
// Without this, pages/index.js would hand a signed-in staff member the
// dashboard on kosher-connect.com — the staff app on the shop's public
// address, which is the thing this decision was meant to avoid.
//
// Only "/" is matched. Every other path (/welcome, /join, /portal, /login, the
// APIs) is untouched and works identically on all three hostnames.
const SHOP_HOSTS = new Set(['kosher-connect.com', 'www.kosher-connect.com'])

export const config = { matcher: ['/'] }

export function middleware(req) {
  // Host carries the port on local dev (localhost:3000) — strip it, and lower
  // case it, because Host is not case-normalised by the client.
  const host = (req.headers.get('host') || '').split(':')[0].toLowerCase()
  if (SHOP_HOSTS.has(host)) return NextResponse.rewrite(new URL('/welcome', req.url))
  return NextResponse.next()
}
