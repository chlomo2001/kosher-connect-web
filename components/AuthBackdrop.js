import { useState, useRef, useEffect } from 'react'

// Branded "sunburst" auth background — the Stripe-hero effect done as a live
// <canvas> (crisp at any DPR, a few KB, no heavy GIF). Shared by the staff
// login and the customer portal sign-in.
//
// • Colours are BASED ON THE LOGO: its two dominant colours — azure blue
//   (#0060a8) and warm gold (#c09060) — drive every ray and dot, so the field
//   is "inspired by" the mark without ever forming it.
// • Six time-of-day phases (Pre-dawn → Night) the operator can pick, or "Auto"
//   which slowly drifts through them so the colours keep mixing.
// • The pointer acts as a moving light: rays bend around it (a lens/refraction
//   bulge) and a soft additive glow follows it — the "3D light" bend.
// • Theme-aware, pauses when the tab is hidden, and renders a single static
//   frame under prefers-reduced-motion.
const PHASES = [
  { id: 'predawn', label: 'Pre-dawn', core: '#3b5a86', line: '#0060a8', dot: '#a9b8d8' },
  { id: 'sunrise', label: 'Sunrise', core: '#e8b06a', line: '#1878a8', dot: '#d89858' },
  { id: 'daytime', label: 'Daytime', core: '#4aa0d8', line: '#0060a8', dot: '#c09060' },
  { id: 'dusk', label: 'Dusk', core: '#8f7fc4', line: '#1860a8', dot: '#c8a878' },
  { id: 'sunset', label: 'Sunset', core: '#e0894a', line: '#0a68b0', dot: '#d89858' },
  { id: 'night', label: 'Night', core: '#22345c', line: '#2a6fb0', dot: '#c09060' },
]

export default function AuthBackdrop() {
  const canvasRef = useRef(null)
  const phaseRef = useRef('auto')
  const [phase, setPhase] = useState('auto')
  useEffect(() => { phaseRef.current = phase }, [phase])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    const toRgb = (h) => { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)] }
    const RGB = PHASES.map((p) => ({ core: toRgb(p.core), line: toRgb(p.line), dot: toRgb(p.dot) }))
    const lerp = (a, b, f) => a + (b - a) * f
    const lerpC = (a, b, f) => [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)]
    const mix = (a, b, f) => [Math.round(lerp(a[0], b[0], f)), Math.round(lerp(a[1], b[1], f)), Math.round(lerp(a[2], b[2], f))]
    const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`
    const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`
    const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark'
    const WHITE = [255, 255, 255], DARKBG = [6, 9, 18]

    const N = 210
    const rays = Array.from({ length: N }, (_, i) => ({
      a: Math.PI + (i + 0.5) / N * Math.PI + (Math.random() - 0.5) * 0.01,
      r: 0.42 + Math.random() * 0.58,
      lp: Math.random() * 6.283, tp: Math.random() * 6.283,
      ds: 1.1 + Math.random() * 1.6,
    }))

    let W = 0, H = 0, cx = 0, cy = 0, R = 0
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = canvas.clientWidth; H = canvas.clientHeight
      canvas.width = Math.max(1, Math.round(W * dpr))
      canvas.height = Math.max(1, Math.round(H * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      cx = W / 2; cy = H * 1.03; R = Math.hypot(W, H) * 0.64
    }

    // Smoothed pointer — idles high-centre when the cursor isn't over the shell.
    let px = 0, py = 0, tpx = 0, tpy = 0, haveP = false
    const idleP = () => { tpx = cx; tpy = cy - H * 0.42 }
    const onMove = (e) => { const r = canvas.getBoundingClientRect(); tpx = e.clientX - r.left; tpy = e.clientY - r.top; haveP = true }
    const onLeave = () => { haveP = false; idleP() }

    // Displayed palette eases toward the target, so phase changes cross-fade.
    let cur = null
    const target = (t) => {
      const ph = phaseRef.current
      if (ph === 'auto') {
        const x = (t / 8000) % RGB.length, i = Math.floor(x), f = x - i, A = RGB[i], B = RGB[(i + 1) % RGB.length]
        return { core: lerpC(A.core, B.core, f), line: lerpC(A.line, B.line, f), dot: lerpC(A.dot, B.dot, f) }
      }
      const idx = Math.max(0, PHASES.findIndex((p) => p.id === ph)); const A = RGB[idx]
      return { core: A.core.slice(), line: A.line.slice(), dot: A.dot.slice() }
    }

    const draw = (t) => {
      const dk = isDark()
      const tg = target(t)
      if (!cur) cur = { core: tg.core.slice(), line: tg.line.slice(), dot: tg.dot.slice() }
      cur.core = lerpC(cur.core, tg.core, 0.04)
      cur.line = lerpC(cur.line, tg.line, 0.04)
      cur.dot = lerpC(cur.dot, tg.dot, 0.04)
      px = lerp(px, tpx, 0.08); py = lerp(py, tpy, 0.08)

      const base = dk ? mix(cur.core, DARKBG, 0.86) : mix(cur.core, WHITE, 0.9)
      const midWash = mix(cur.core, base, 0.45)
      ctx.fillStyle = rgb(base); ctx.fillRect(0, 0, W, H)
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R)
      g.addColorStop(0, rgba(cur.core, dk ? 0.62 : 0.92))
      g.addColorStop(0.36, rgba(midWash, dk ? 0.5 : 0.72))
      g.addColorStop(1, rgba(base, 0))
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)

      // Faint "KC" monogram woven into the field — the rays draw over it, so
      // it reads as part of the burst rather than a sticker on top.
      ctx.save()
      ctx.font = `800 ${Math.round(Math.min(W, H) * 0.5)}px Inter, system-ui, sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillStyle = rgba(mix(cur.line, base, 0.5), dk ? 0.09 : 0.07)
      ctx.fillText('KC', cx, H * 0.46)
      ctx.restore()

      ctx.lineWidth = 1
      const lineA = dk ? 0.24 : 0.16
      const bendK = Math.min(W, H) * 0.34
      for (const ry of rays) {
        const len = ry.r * R * (1 + 0.06 * Math.sin(t * 0.0006 + ry.lp))
        const tx = cx + Math.cos(ry.a) * len, ty = cy + Math.sin(ry.a) * len
        const mxp = (cx + tx) / 2, myp = (cy + ty) / 2
        // Repel the ray's midpoint away from the pointer → a lens-like bulge.
        const dxp = mxp - px, dyp = myp - py, dist = Math.hypot(dxp, dyp) || 1
        const pull = 74 / (1 + dist / bendK)
        const cxp = mxp + (dxp / dist) * pull, cyp = myp + (dyp / dist) * pull
        ctx.strokeStyle = rgba(cur.line, lineA)
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.quadraticCurveTo(cxp, cyp, tx, ty); ctx.stroke()
        const near = Math.max(0, 1 - dist / (bendK * 1.4))
        const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 0.0011 + ry.tp))
        ctx.fillStyle = rgba(cur.dot, (dk ? 0.5 : 0.55) * tw + near * 0.35)
        ctx.beginPath(); ctx.arc(tx, ty, ry.ds + near * 1.5, 0, 6.2832); ctx.fill()
      }

      // The "3D light": a soft additive glow that follows the pointer.
      const gr = Math.min(W, H) * 0.3
      const glowC = mix(cur.line, WHITE, dk ? 0.15 : 0.4)
      ctx.globalCompositeOperation = 'lighter'
      const lg = ctx.createRadialGradient(px, py, 0, px, py, gr)
      lg.addColorStop(0, rgba(glowC, dk ? 0.22 : 0.3))
      lg.addColorStop(0.5, rgba(glowC, dk ? 0.08 : 0.1))
      lg.addColorStop(1, rgba(glowC, 0))
      ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(px, py, gr, 0, 6.2832); ctx.fill()
      ctx.globalCompositeOperation = 'source-over'
    }

    resize(); idleP(); px = tpx; py = tpy
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    const shell = canvas.parentElement
    let raf = 0
    const loop = (t) => { if (!document.hidden) draw(t); raf = requestAnimationFrame(loop) }
    const onResize = () => { resize(); if (!haveP) idleP(); if (reduce.matches) draw(0) }
    window.addEventListener('resize', onResize)
    if (!reduce.matches && shell) {
      shell.addEventListener('pointermove', onMove)
      shell.addEventListener('pointerleave', onLeave)
    }
    if (reduce.matches) draw(0)
    else raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      if (shell) { shell.removeEventListener('pointermove', onMove); shell.removeEventListener('pointerleave', onLeave) }
    }
  }, [])

  return (
    <>
      <canvas className="login-fx" ref={canvasRef} aria-hidden="true" />
      <div className="fx-switch" role="group" aria-label="Background mood">
        {[{ id: 'auto', label: 'Auto' }, ...PHASES].map((p) => (
          <button
            key={p.id} type="button"
            className={'fx-item' + (phase === p.id ? ' active' : '')}
            aria-pressed={phase === p.id}
            onClick={() => setPhase(p.id)}
          >
            <span
              className="fx-dot"
              style={{ background: p.id === 'auto' ? 'conic-gradient(#0060a8,#c09060,#e0894a,#3b5a86,#0060a8)' : p.core }}
            />
            {p.label}
          </button>
        ))}
      </div>
    </>
  )
}
