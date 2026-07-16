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
// • A faint scene sits under the burst: flight-route arcs high in the sky and
//   telephone poles/wires receding to the horizon — travel + connectivity.
// • The pointer acts like a charge: nearby rays are repelled and part around
//   it (a static-electricity / magnet reorganisation), with a faint glow.
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
    const WHITE = [255, 255, 255], DARKBG = [6, 9, 18], GOLD = [212, 158, 96]

    // The logo mark, drawn as a faint low watermark once it has loaded.
    const logo = new Image()
    let logoReady = false
    logo.onload = () => { logoReady = true }
    logo.src = '/logo.png'

    const N = 210
    const rays = Array.from({ length: N }, (_, i) => ({
      a: Math.PI + (i + 0.5) / N * Math.PI + (Math.random() - 0.5) * 0.01,
      r: 0.42 + Math.random() * 0.58,
      lp: Math.random() * 6.283, tp: Math.random() * 6.283,
      ds: 1.1 + Math.random() * 1.6,
    }))

    // Faint "airline map" arcs high in the sky — clearly curved, dashed, with a
    // little plane gliding along, so they read as flight paths (not ray tips).
    // Positions kept as fractions so they survive resize.
    const arcs = Array.from({ length: 4 }, () => {
      const y = 0.07 + Math.random() * 0.15
      return {
        x1: -0.05 + Math.random() * 0.4, y1: y + (Math.random() - 0.5) * 0.06,
        x2: 0.6 + Math.random() * 0.48, y2: y + (Math.random() - 0.5) * 0.06,
        bow: 0.12 + Math.random() * 0.09, ph: Math.random() * 6.283,
        sp: 0.00011 + Math.random() * 0.00008,
      }
    })

    // Ground "provider network": scattered telephone poles with a wire mesh
    // between neighbours, plus one highlighted route that "navigates" to the
    // best-provider node — geometry built once, held as fractions.
    const NODEN = 12
    const nodes = Array.from({ length: NODEN }, (_, i) => {
      const fx = 0.04 + (i / (NODEN - 1)) * 0.92 + (Math.random() - 0.5) * 0.06
      return { fx: Math.min(0.97, Math.max(0.03, fx)), fy: 0.66 + Math.random() * 0.34 }
    })
    const edges = []; const seenE = new Set()
    for (let i = 0; i < NODEN; i++) {
      const near = nodes.map((n, j) => ({ j, d: Math.hypot(n.fx - nodes[i].fx, n.fy - nodes[i].fy) }))
        .filter((o) => o.j !== i).sort((a, b) => a.d - b.d)
      for (const { j } of near.slice(0, 2)) {
        const k = i < j ? i + '-' + j : j + '-' + i
        if (!seenE.has(k)) { seenE.add(k); edges.push([i, j]) }
      }
    }
    // Route: a greedy nearest-neighbour path threading pole to pole from a
    // near-left node, so it reads as an organic "best route" (its far end is
    // the highlighted best-provider node).
    const route = (() => {
      const start = nodes.map((n, i) => ({ i, s: n.fy - n.fx })).sort((a, b) => b.s - a.s)[0].i
      const seenN = new Set([start]); const path = [start]
      while (path.length < 6) {
        const c = nodes[path[path.length - 1]]; let best = -1, bd = Infinity
        for (let j = 0; j < NODEN; j++) {
          if (seenN.has(j)) continue
          const d = Math.hypot(nodes[j].fx - c.fx, nodes[j].fy - c.fy)
          if (d < bd) { bd = d; best = j }
        }
        if (best < 0) break; seenN.add(best); path.push(best)
      }
      return path
    })()

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

      // Faint logo mark tucked into the bottom-left corner — a calm patch of the
      // field, clear of the card and the busy ray convergence, so it reads as a
      // proper watermark rather than getting lost behind the sign-in box.
      if (logoReady) {
        const lw = Math.min(W, H) * 0.14
        const lh = lw * (logo.height / logo.width)
        const pad = Math.min(W, H) * 0.05
        ctx.save()
        ctx.globalAlpha = dk ? 0.11 : 0.08
        ctx.drawImage(logo, pad, H - pad - lh, lw, lh)
        ctx.restore()
      }

      // ── Faint flight paths high in the sky. Clearly curved + dashed, hollow
      //    "airport" rings at each end and a small plane gliding along, so they
      //    read as flights rather than continuations of the burst rays.
      ctx.save(); ctx.lineWidth = 1
      for (const ac of arcs) {
        const x1 = ac.x1 * W, y1 = ac.y1 * H, x2 = ac.x2 * W, y2 = ac.y2 * H
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - ac.bow * H
        ctx.setLineDash([7, 7]); ctx.strokeStyle = rgba(cur.line, dk ? 0.2 : 0.15)
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(mx, my, x2, y2); ctx.stroke()
        ctx.setLineDash([]); ctx.strokeStyle = rgba(cur.line, dk ? 0.42 : 0.34)
        ctx.beginPath(); ctx.arc(x1, y1, 2.4, 0, 6.283); ctx.stroke()
        ctx.beginPath(); ctx.arc(x2, y2, 2.4, 0, 6.283); ctx.stroke()
        const u = 0.5 + 0.5 * Math.sin(t * ac.sp + ac.ph)
        const bx = (1 - u) * (1 - u) * x1 + 2 * (1 - u) * u * mx + u * u * x2
        const by = (1 - u) * (1 - u) * y1 + 2 * (1 - u) * u * my + u * u * y2
        const ang = Math.atan2(2 * (1 - u) * (my - y1) + 2 * u * (y2 - my), 2 * (1 - u) * (mx - x1) + 2 * u * (x2 - mx))
        ctx.save(); ctx.translate(bx, by); ctx.rotate(ang)
        ctx.fillStyle = rgba(cur.dot, dk ? 0.85 : 0.7)
        ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(-3, 3); ctx.lineTo(-3, -3); ctx.closePath(); ctx.fill()
        ctx.restore()
      }
      ctx.restore()

      // ── Faint "provider network" on the ground: scattered telephone poles
      //    (double crossarms), a wire mesh between neighbours, and one gold
      //    route weaving to the best-provider node — "we find you the best line".
      const NX = (n) => n.fx * W, NY = (n) => n.fy * H
      const poleH = (n) => H * 0.13 * ((n.fy - 0.66) / 0.34) + 5
      const topY = (n) => NY(n) - poleH(n)
      ctx.lineWidth = 1; ctx.strokeStyle = rgba(cur.line, dk ? 0.1 : 0.08)
      for (const [i, j] of edges) {
        const a = nodes[i], b = nodes[j], ax = NX(a), ay = topY(a), bx = NX(b), by = topY(b)
        const sag = Math.min(30, Math.abs(bx - ax) * 0.14)
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + sag, bx, by); ctx.stroke()
      }
      for (const n of nodes) {
        const gx = NX(n), gy = NY(n), h = poleH(n), arm = 4 + h * 0.28
        ctx.strokeStyle = rgba(cur.line, dk ? 0.17 : 0.12); ctx.lineWidth = Math.max(1, h * 0.03)
        ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy - h); ctx.stroke()
        const a1 = gy - h * 0.86, a2 = gy - h * 0.68
        ctx.beginPath(); ctx.moveTo(gx - arm, a1); ctx.lineTo(gx + arm, a1); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(gx - arm * 0.7, a2); ctx.lineTo(gx + arm * 0.7, a2); ctx.stroke()
      }
      if (route.length >= 2) {
        ctx.strokeStyle = rgba(GOLD, dk ? 0.34 : 0.4); ctx.lineWidth = 1.2
        ctx.beginPath()
        route.forEach((idx, k) => { const n = nodes[idx]; k ? ctx.lineTo(NX(n), topY(n)) : ctx.moveTo(NX(n), topY(n)) })
        ctx.stroke()
        // Travelling pulse along the route.
        const s = (t * 0.00009) % 1, segF = s * (route.length - 1)
        const si = Math.min(route.length - 2, Math.floor(segF)), lf = segF - si
        const A = nodes[route[si]], B = nodes[route[si + 1]]
        ctx.fillStyle = rgba(GOLD, dk ? 0.85 : 0.72)
        ctx.beginPath(); ctx.arc(lerp(NX(A), NX(B), lf), lerp(topY(A), topY(B), lf), 2.2, 0, 6.283); ctx.fill()
        // Best-provider node: a soft pulsing ring at the far end.
        const dest = nodes[route[route.length - 1]], pr = 4 + 1.6 * (0.5 + 0.5 * Math.sin(t * 0.004))
        ctx.strokeStyle = rgba(GOLD, dk ? 0.7 : 0.6); ctx.lineWidth = 1.2
        ctx.beginPath(); ctx.arc(NX(dest), topY(dest), pr, 0, 6.283); ctx.stroke()
        ctx.fillStyle = rgba(GOLD, dk ? 0.85 : 0.72)
        ctx.beginPath(); ctx.arc(NX(dest), topY(dest), 1.7, 0, 6.283); ctx.fill()
      }

      ctx.lineWidth = 1
      const lineA = dk ? 0.24 : 0.16
      // The pointer is a repelling charge: rays near it are shoved radially
      // outward with a Gaussian falloff, so they part and reorganise around
      // the cursor — a static-electricity / magnet parting rather than a lens.
      const fieldR = Math.min(W, H) * 0.19
      const fieldR2 = fieldR * fieldR
      for (const ry of rays) {
        const len = ry.r * R * (1 + 0.06 * Math.sin(t * 0.0006 + ry.lp))
        let tx = cx + Math.cos(ry.a) * len, ty = cy + Math.sin(ry.a) * len
        let mxp = (cx + tx) / 2, myp = (cy + ty) / 2
        const dmx = mxp - px, dmy = myp - py, dm = Math.hypot(dmx, dmy) || 1
        const fM = Math.exp(-(dm * dm) / fieldR2)
        mxp += (dmx / dm) * fM * 155; myp += (dmy / dm) * fM * 155
        const dtx = tx - px, dty = ty - py, dt = Math.hypot(dtx, dty) || 1
        const fT = Math.exp(-(dt * dt) / fieldR2)
        tx += (dtx / dt) * fT * 96; ty += (dty / dt) * fT * 96
        ctx.strokeStyle = rgba(cur.line, lineA)
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.quadraticCurveTo(mxp, myp, tx, ty); ctx.stroke()
        const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 0.0011 + ry.tp))
        ctx.fillStyle = rgba(cur.dot, (dk ? 0.5 : 0.55) * tw + fT * 0.3)
        ctx.beginPath(); ctx.arc(tx, ty, ry.ds + fT * 1.4, 0, 6.2832); ctx.fill()
      }

      // A whisper of light on the pointer — just enough to read as warmth at
      // the parting, not a bright lamp.
      const gr = Math.min(W, H) * 0.26
      const glowC = mix(cur.line, WHITE, dk ? 0.15 : 0.4)
      ctx.globalCompositeOperation = 'lighter'
      const lg = ctx.createRadialGradient(px, py, 0, px, py, gr)
      lg.addColorStop(0, rgba(glowC, dk ? 0.1 : 0.13))
      lg.addColorStop(0.5, rgba(glowC, dk ? 0.03 : 0.045))
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
