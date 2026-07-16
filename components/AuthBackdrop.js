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
// • A faint scene sits under the burst: a wireframe globe with aeroplane
//   outlines orbiting it (travel) and a well-connected pole/wire "provider
//   network" on the ground with several signals routing to the best line.
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

    // A faint wireframe globe with small aeroplane OUTLINES of varying size
    // orbiting it — the travel motif, up in the sky. Held as fractions.
    const globe = { fx: 0.2, fy: 0.2, fr: 0.1 }
    const planes = Array.from({ length: 7 }, (_, i) => ({
      orbit: 1.35 + (i % 3) * 0.5 + Math.random() * 0.25,     // × globe radius
      a0: Math.random() * 6.283, sp: 0.00007 + Math.random() * 0.00009,
      dir: i % 2 ? 1 : -1, size: 6 + Math.random() * 9,
    }))
    // Unit aeroplane outline (nose at +x), built from a half-silhouette mirrored.
    const PLANE_HALF = [
      [1.0, 0], [0.2, 0.1], [-0.05, 0.52], [-0.22, 0.52], [-0.27, 0.13],
      [-0.62, 0.13], [-0.74, 0.42], [-0.86, 0.42], [-0.9, 0],
    ]
    const PLANE = PLANE_HALF.concat(PLANE_HALF.slice(1, -1).reverse().map(([x, y]) => [x, -y]))

    // Ground "provider network": scattered poles with a well-connected wire mesh
    // (nearest neighbours + some long crossing links = crossdimensional
    // intersections), and several routes each carrying their own signal pulse.
    const NODEN = 15
    const nodes = Array.from({ length: NODEN }, (_, i) => {
      const fx = 0.03 + (i / (NODEN - 1)) * 0.94 + (Math.random() - 0.5) * 0.07
      return { fx: Math.min(0.98, Math.max(0.02, fx)), fy: 0.64 + Math.random() * 0.36 }
    })
    const edges = []; const seenE = new Set()
    const addEdge = (i, j) => {
      if (i === j) return
      const k = i < j ? i + '-' + j : j + '-' + i
      if (!seenE.has(k)) { seenE.add(k); edges.push([i, j]) }
    }
    for (let i = 0; i < NODEN; i++) {
      const near = nodes.map((n, j) => ({ j, d: Math.hypot(n.fx - nodes[i].fx, n.fy - nodes[i].fy) }))
        .filter((o) => o.j !== i).sort((a, b) => a.d - b.d)
      for (const { j } of near.slice(0, 3)) addEdge(i, j)     // denser mesh
    }
    for (let n = 0; n < 6; n++) {                              // long crossing links
      addEdge(Math.floor(Math.random() * NODEN), Math.floor(Math.random() * NODEN))
    }
    // Several routes, each a greedy nearest-neighbour chain from a different seed,
    // so multiple signals travel different paths (not one repeating dot).
    const chain = (start) => {
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
    }
    const byScore = (f) => nodes.map((n, i) => ({ i, s: f(n) })).sort((a, b) => b.s - a.s)[0].i
    const routes = [
      { path: chain(byScore((n) => n.fy - n.fx)), sp: 0.00010, dir: 1, gold: true },   // near-left → best provider
      { path: chain(byScore((n) => n.fy + n.fx)), sp: 0.00014, dir: -1, gold: false },  // near-right, reverse
      { path: chain(byScore((n) => n.fy * 0.4 - Math.abs(n.fx - 0.5))), sp: 0.00008, dir: 1, gold: false },
    ]

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

      // Faint logo mark tucked into the top-right corner — a calm patch of the
      // field, clear of the card and the busy ray convergence, so it reads as a
      // proper watermark rather than getting lost behind the sign-in box.
      if (logoReady) {
        const lw = Math.min(W, H) * 0.13
        const lh = lw * (logo.height / logo.width)
        const pad = Math.min(W, H) * 0.05
        ctx.save()
        ctx.globalAlpha = dk ? 0.11 : 0.08
        ctx.drawImage(logo, W - pad - lw, pad, lw, lh)
        ctx.restore()
      }

      // ── Faint wireframe globe with aeroplane OUTLINES of varying size orbiting
      //    it — the travel motif, kept up in the sky and away from the rays.
      const gX = globe.fx * W, gY = globe.fy * H, gR = globe.fr * Math.min(W, H)
      ctx.save(); ctx.lineWidth = 1; ctx.strokeStyle = rgba(cur.line, dk ? 0.2 : 0.15)
      ctx.beginPath(); ctx.arc(gX, gY, gR, 0, 6.283); ctx.stroke()
      for (let k = -2; k <= 2; k++) {                          // latitudes
        const yy = gY + (k / 3) * gR, rx = gR * Math.cos(Math.asin(Math.max(-1, Math.min(1, (k / 3)))))
        ctx.beginPath(); ctx.ellipse(gX, yy, rx, rx * 0.16, 0, 0, 6.283); ctx.stroke()
      }
      for (let k = 0; k < 3; k++) {                            // meridians
        ctx.beginPath(); ctx.ellipse(gX, gY, gR * (0.34 + k * 0.33), gR, 0, 0, 6.283); ctx.stroke()
      }
      // planes on faint orbits
      const drawPlane = (x, y, s, ang, a) => {
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s)
        ctx.lineWidth = 1 / s; ctx.strokeStyle = rgba(cur.dot, a)
        ctx.beginPath()
        PLANE.forEach(([px2, py2], i) => (i ? ctx.lineTo(px2, py2) : ctx.moveTo(px2, py2)))
        ctx.closePath(); ctx.stroke(); ctx.restore()
      }
      for (const p of planes) {
        const orb = gR * p.orbit, ang = p.a0 + t * p.sp * p.dir
        const x = gX + Math.cos(ang) * orb, y = gY + Math.sin(ang) * orb * 0.7
        ctx.setLineDash([2, 6]); ctx.strokeStyle = rgba(cur.line, dk ? 0.09 : 0.07)
        ctx.beginPath(); ctx.ellipse(gX, gY, orb, orb * 0.7, 0, 0, 6.283); ctx.stroke(); ctx.setLineDash([])
        drawPlane(x, y, p.size, ang + p.dir * Math.PI / 2, dk ? 0.6 : 0.5)
      }
      ctx.restore()

      // ── Faint "provider network" on the ground: scattered double-crossarm
      //    poles, a well-connected wire mesh (neighbours + long crossing links),
      //    and several routes each carrying their own signal — "we navigate you
      //    to the best line". The primary (gold) route ends at the best provider.
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
      for (const rt of routes) {
        if (rt.path.length < 2) continue
        const col = rt.gold ? GOLD : cur.dot
        ctx.strokeStyle = rgba(col, rt.gold ? (dk ? 0.34 : 0.4) : (dk ? 0.24 : 0.2)); ctx.lineWidth = rt.gold ? 1.2 : 1
        ctx.beginPath()
        rt.path.forEach((idx, k) => { const n = nodes[idx]; k ? ctx.lineTo(NX(n), topY(n)) : ctx.moveTo(NX(n), topY(n)) })
        ctx.stroke()
        const s = ((t * rt.sp * rt.dir) % 1 + 1) % 1, segF = s * (rt.path.length - 1)
        const si = Math.min(rt.path.length - 2, Math.floor(segF)), lf = segF - si
        const A = nodes[rt.path[si]], B = nodes[rt.path[si + 1]]
        ctx.fillStyle = rgba(col, dk ? 0.85 : 0.72)
        ctx.beginPath(); ctx.arc(lerp(NX(A), NX(B), lf), lerp(topY(A), topY(B), lf), rt.gold ? 2.4 : 1.9, 0, 6.283); ctx.fill()
      }
      // Best-provider node: a soft pulsing ring at the gold route's far end.
      const gr0 = routes.find((r) => r.gold && r.path.length >= 2)
      if (gr0) {
        const dest = nodes[gr0.path[gr0.path.length - 1]], pr = 4 + 1.6 * (0.5 + 0.5 * Math.sin(t * 0.004))
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
