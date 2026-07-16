import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import ThemeToggle from '../components/ThemeToggle'

export default function Login({ supabaseUrl, googleEnabled }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [ticket, setTicket] = useState('') // set → we're on the 2FA code step
  const [code, setCode] = useState('')
  const fxRef = useRef(null)

  // Branded "sunburst" background (the Stripe-hero effect, done as a live canvas
  // rather than a heavy GIF): thin rays fan up from the bottom over a soft
  // colour wash that slowly drifts through brand palettes, so the colours mix
  // over time. Crisp at any DPR, a few KB, theme-aware, and it freezes for
  // prefers-reduced-motion.
  useEffect(() => {
    const canvas = fxRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    const LIGHT = [
      { base: '#fdf7f0', core: '#ff8fc7', mid: '#ffd7a6', edge: '#efe7ff', line: '#6f5bff', dot: '#ff6bcb' }, // sunrise
      { base: '#f7f6ff', core: '#8b84ff', mid: '#c9b8ff', edge: '#eef1ff', line: '#635bff', dot: '#8b84ff' }, // daytime
      { base: '#f8efff', core: '#a98bff', mid: '#ffc2e6', edge: '#e6ecff', line: '#8b5cf6', dot: '#ff8ad1' }, // dusk
    ]
    const DARK = [
      { base: '#0a1020', core: '#5b4bd6', mid: '#241a4a', edge: '#0a1020', line: '#8b84ff', dot: '#ff8ad1' },
      { base: '#0a1226', core: '#4b57d6', mid: '#1e2452', edge: '#0a1226', line: '#7b84ff', dot: '#8b84ff' },
      { base: '#0d0a24', core: '#7a4bd6', mid: '#2c1a4e', edge: '#0d0a24', line: '#a98bff', dot: '#ff8ad1' },
    ]
    const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark'
    const toRgb = (h) => { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)] }
    const lerp = (a, b, f) => a + (b - a) * f
    const mix = (h1, h2, f) => { const a = toRgb(h1), b = toRgb(h2); return [Math.round(lerp(a[0], b[0], f)), Math.round(lerp(a[1], b[1], f)), Math.round(lerp(a[2], b[2], f))] }
    const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`
    const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`

    const N = 170
    const rays = Array.from({ length: N }, (_, i) => ({
      a: Math.PI + (i + 0.5) / N * Math.PI + (Math.random() - 0.5) * 0.012, // fan across the top
      r: 0.45 + Math.random() * 0.55,
      lp: Math.random() * Math.PI * 2,
      tp: Math.random() * Math.PI * 2,
      ds: 1.1 + Math.random() * 1.5,
    }))

    let W = 0, H = 0, cx = 0, cy = 0, R = 0
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = canvas.clientWidth; H = canvas.clientHeight
      canvas.width = Math.max(1, Math.round(W * dpr))
      canvas.height = Math.max(1, Math.round(H * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      cx = W / 2; cy = H * 1.02; R = Math.hypot(W, H) * 0.62
    }

    const palette = (t) => {
      const set = isDark() ? DARK : LIGHT
      const x = (t / 15000) % set.length
      const i = Math.floor(x), f = x - i, A = set[i], B = set[(i + 1) % set.length]
      return {
        base: mix(A.base, B.base, f), core: mix(A.core, B.core, f), mid: mix(A.mid, B.mid, f),
        edge: mix(A.edge, B.edge, f), line: mix(A.line, B.line, f), dot: mix(A.dot, B.dot, f),
      }
    }

    const draw = (t) => {
      const dk = isDark()
      const p = palette(t)
      ctx.fillStyle = rgb(p.base); ctx.fillRect(0, 0, W, H)
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R)
      g.addColorStop(0, rgba(p.core, dk ? 0.55 : 0.85))
      g.addColorStop(0.4, rgba(p.mid, dk ? 0.45 : 0.68))
      g.addColorStop(1, rgba(p.edge, 0))
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
      ctx.lineWidth = 1
      const lineA = dk ? 0.22 : 0.15
      for (const ry of rays) {
        const len = ry.r * R * (1 + 0.05 * Math.sin(t * 0.0005 + ry.lp))
        const tx = cx + Math.cos(ry.a) * len
        const ty = cy + Math.sin(ry.a) * len
        ctx.strokeStyle = rgba(p.line, lineA)
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(tx, ty); ctx.stroke()
        const tw = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 0.001 + ry.tp))
        ctx.fillStyle = rgba(p.dot, (dk ? 0.5 : 0.55) * tw)
        ctx.beginPath(); ctx.arc(tx, ty, ry.ds, 0, 6.2832); ctx.fill()
      }
    }

    resize()
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    let raf = 0
    const loop = (t) => { if (!document.hidden) draw(t); raf = requestAnimationFrame(loop) }
    const onResize = () => { resize(); if (reduce.matches) draw(0) }
    window.addEventListener('resize', onResize)
    if (reduce.matches) draw(0)
    else raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize) }
  }, [])

  function google() {
    if (!supabaseUrl) return
    const redirect = `${window.location.origin}/auth/google`
    window.location.href =
      `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirect)}`
  }

  async function submit(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (data.success && data.twofa) {
        setTicket(data.ticket)
      } else if (data.success) {
        window.location.href = '/'
        return
      } else {
        setError(data.error || 'Login failed.')
      }
    } catch {
      setError('Login failed — try again.')
    }
    setBusy(false)
  }

  async function submitCode(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, ticket }),
      })
      const data = await res.json()
      if (data.success) {
        window.location.href = '/'
        return
      }
      setError(data.error || 'Wrong code.')
      if (/start again/i.test(data.error || '')) { setTicket(''); setCode('') }
    } catch {
      setError('Verification failed — try again.')
    }
    setBusy(false)
  }

  return (
    <>
      <Head><title>Sign in · KosherConnect</title></Head>
      <div className="login-shell">
        <div className="login-mesh" aria-hidden="true" />
        <canvas className="login-fx" ref={fxRef} aria-hidden="true" />
        <ThemeToggle style={{ position: 'fixed', top: 16, right: 16, zIndex: 10 }} />
        <form className="login-card" onSubmit={ticket ? submitCode : submit}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <img src="/logo-full.png" alt="KosherConnect" style={{ height: 72, marginBottom: 10 }} />
            <div className="login-title">Welcome back</div>
            <div className="login-sub">{ticket ? 'Check your email for your code' : 'Sign in to KosherConnect'}</div>
          </div>
          {ticket ? (
            <>
              <div style={{ fontSize: 13, textAlign: 'center', marginBottom: 12, lineHeight: 1.5 }}>
                📬 A 6-digit code is on its way to<br /><strong>{email}</strong>
              </div>
              <input
                className="form-input" inputMode="numeric" placeholder="Enter the code" value={code}
                onChange={e => setCode(e.target.value)} autoFocus required
                style={{ width: '100%', marginBottom: 14, textAlign: 'center', letterSpacing: '0.3em', fontSize: 18 }}
              />
              {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 12 }}>{error}</div>}
              <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%', padding: '10px 16px' }}>
                {busy ? 'Checking…' : 'Verify code'}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => { setTicket(''); setCode(''); setError('') }}
                style={{ width: '100%', padding: '8px 16px', marginTop: 8, fontSize: 12 }}>
                ← Back
              </button>
            </>
          ) : (
            <>
              <input
                className="form-input" type="email" placeholder="Email" value={email}
                onChange={e => setEmail(e.target.value)} autoFocus required
                style={{ width: '100%', marginBottom: 10 }}
              />
              <input
                className="form-input" type="password" placeholder="Password" value={password}
                onChange={e => setPassword(e.target.value)} required
                style={{ width: '100%', marginBottom: 14 }}
              />
              {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 12 }}>{error}</div>}
              <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%', padding: '10px 16px' }}>
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
              {googleEnabled && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0', color: 'var(--muted)', fontSize: 12 }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} /> or <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  </div>
                  <button type="button" className="btn btn-outline" onClick={google}
                    style={{ width: '100%', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700 }}>G</span> Continue with Google
                  </button>
                </>
              )}
            </>
          )}
        </form>
      </div>
    </>
  )
}

// Already signed in → straight to the app. We VALIDATE the session here (not just
// cookie presence): a present-but-invalid cookie must be cleared and the form
// shown, otherwise the app shell renders, its boot 401s to /login, and this page
// would bounce it back to '/' forever. audit C9 (+ C20: honest cookie check).
export async function getServerSideProps({ req, res }) {
  const { authEnabled, resolveStaff, sessionCookie, readSessionCookie } = await import('../lib/auth.js')
  if (authEnabled && readSessionCookie(req)?.at) {
    const resolved = await resolveStaff(req).catch(() => null)
    if (resolved?.staff) {
      if (resolved.setCookie) res.setHeader('Set-Cookie', resolved.setCookie)
      return { redirect: { destination: '/', permanent: false } }
    }
    // Cookie present but not a valid staff session → clear it, show the form.
    res.setHeader('Set-Cookie', sessionCookie(null))
  }
  return {
    props: {
      supabaseUrl: (process.env.SUPABASE_URL || '').replace(/\/$/, ''),
      // Staff Google button appears when STAFF_GOOGLE=1 (after enabling the
      // Google provider in Supabase and allow-listing /auth/google).
      googleEnabled: process.env.STAFF_GOOGLE === '1',
    },
  }
}
