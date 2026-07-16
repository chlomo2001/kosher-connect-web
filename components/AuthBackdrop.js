import { useState, useRef, useEffect } from 'react'
import WORLD from './worldOutline'

// Branded auth background — a slowly-rotating wireframe globe with real
// continent outlines as the centrepiece, a soft sunburst halo of light behind
// it, and intercontinental arcs (flights + provider links) connecting hub
// cities around the world. Live <canvas>, a few KB, crisp at any DPR.
//
// • Colours are BASED ON THE LOGO: azure blue (#0060a8) + warm gold (#c09060)
//   drive the atmosphere, coastlines and connections.
// • Six time-of-day phases (Pre-dawn → Night) the operator can pick, or "Auto"
//   which slowly drifts through them.
// • The pointer is a moving light: the halo rays part around it and a soft glow
//   follows it.
// • Theme-aware, pauses when hidden, single static frame under reduced-motion.
const PHASES = [
  { id: 'predawn', label: 'Pre-dawn', core: '#3b5a86', line: '#0060a8', dot: '#a9b8d8' },
  { id: 'sunrise', label: 'Sunrise', core: '#e8b06a', line: '#1878a8', dot: '#d89858' },
  { id: 'daytime', label: 'Daytime', core: '#4aa0d8', line: '#0060a8', dot: '#c09060' },
  { id: 'dusk', label: 'Dusk', core: '#8f7fc4', line: '#1860a8', dot: '#c8a878' },
  { id: 'sunset', label: 'Sunset', core: '#e0894a', line: '#0a68b0', dot: '#d89858' },
  { id: 'night', label: 'Night', core: '#22345c', line: '#2a6fb0', dot: '#c09060' },
]

// Hub cities (lon, lat) and the intercontinental links between them.
const CITIES = [
  [-74, 40.7], [-0.1, 51.5], [34.8, 32.1], [55.3, 25.2], [139.7, 35.7],
  [-118.2, 34], [-46.6, -23.5], [151.2, -33.9], [28, -26.2], [72.8, 19],
  [2.3, 48.9], [116.4, 39.9], [37.6, 55.7], [103.8, 1.35],
]
// [i, j, gold?] — a couple of "flight" links carry a little plane.
const LINKS = [
  [2, 1, 1], [2, 0, 0], [2, 3, 0], [1, 0, 0], [1, 10, 0], [3, 9, 0],
  [3, 13, 0], [13, 4, 0], [11, 4, 0], [0, 5, 0], [0, 6, 0], [9, 13, 0],
  [8, 2, 0], [7, 13, 0], [12, 1, 0], [2, 4, 0],
]
const FLIGHT_LINKS = [1, 3, 7, 9, 14]  // indices into LINKS that carry a plane

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
    const D2R = Math.PI / 180

    const logo = new Image()
    let logoReady = false
    logo.onload = () => { logoReady = true }
    logo.src = '/logo.png'

    // Soft sunburst halo behind the globe — rays radiate from the globe centre.
    const N = 170
    const rays = Array.from({ length: N }, (_, i) => ({
      a: (i + 0.5) / N * 6.283 + (Math.random() - 0.5) * 0.02,
      r: 0.7 + Math.random() * 0.7, lp: Math.random() * 6.283,
      tp: Math.random() * 6.283, ds: 0.9 + Math.random() * 1.4,
    }))
    // Small aeroplane outline (nose at +x), a half-silhouette mirrored.
    const PH = [[1, 0], [0.2, 0.1], [-0.05, 0.52], [-0.22, 0.52], [-0.27, 0.13], [-0.62, 0.13], [-0.74, 0.42], [-0.86, 0.42], [-0.9, 0]]
    const PLANE = PH.concat(PH.slice(1, -1).reverse().map(([x, y]) => [x, -y]))

    let W = 0, H = 0
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = canvas.clientWidth; H = canvas.clientHeight
      canvas.width = Math.max(1, Math.round(W * dpr))
      canvas.height = Math.max(1, Math.round(H * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    let px = 0, py = 0, tpx = 0, tpy = 0, haveP = false
    const idleP = () => { tpx = W / 2; tpy = H * 0.32 }
    const onMove = (e) => { const r = canvas.getBoundingClientRect(); tpx = e.clientX - r.left; tpy = e.clientY - r.top; haveP = true }
    const onLeave = () => { haveP = false; idleP() }

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

      // Globe geometry: big and central — the backbone of the scene.
      const gx = W / 2, gy = H * 0.5, Rg = Math.min(W, H) * 0.46
      const lam0 = t * 0.00003, phi0 = 0.36
      const sinP = Math.sin(phi0), cosP = Math.cos(phi0)
      const project = (lon, lat) => {
        const lam = lon * D2R - lam0, phi = lat * D2R, cphi = Math.cos(phi), sphi = Math.sin(phi)
        const cosc = sinP * sphi + cosP * cphi * Math.cos(lam)
        return { x: gx + Rg * cphi * Math.sin(lam), y: gy - Rg * (cosP * sphi - sinP * cphi * Math.cos(lam)), vis: cosc >= 0 }
      }

      // 1) Sunburst halo behind the globe (rays from the globe centre), parted
      //    by the pointer like a charge (static-electricity magnet).
      const RR = Math.hypot(W, H) * 0.55, fieldR = Math.min(W, H) * 0.17, fieldR2 = fieldR * fieldR
      const rim = Rg * 0.98
      ctx.lineWidth = 1
      for (const ry of rays) {
        const ca = Math.cos(ry.a), sa = Math.sin(ry.a)
        const sx = gx + ca * rim, sy = gy + sa * rim              // start at the globe rim
        const len = Rg * 0.1 + ry.r * RR * (0.55 + 0.05 * Math.sin(t * 0.0006 + ry.lp))
        let tx = gx + ca * (rim + len), ty = gy + sa * (rim + len)
        let mxp = (sx + tx) / 2, myp = (sy + ty) / 2
        const dmx = mxp - px, dmy = myp - py, dm = Math.hypot(dmx, dmy) || 1, fM = Math.exp(-(dm * dm) / fieldR2)
        mxp += (dmx / dm) * fM * 150; myp += (dmy / dm) * fM * 150
        ctx.strokeStyle = rgba(cur.line, dk ? 0.14 : 0.1)
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(mxp, myp, tx, ty); ctx.stroke()
        const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 0.0011 + ry.tp))
        ctx.fillStyle = rgba(cur.dot, (dk ? 0.4 : 0.42) * tw)
        ctx.beginPath(); ctx.arc(tx, ty, ry.ds, 0, 6.2832); ctx.fill()
      }

      // 2) Globe disc — a lit atmosphere so the sphere reads over the halo.
      ctx.save(); ctx.beginPath(); ctx.arc(gx, gy, Rg, 0, 6.2832); ctx.clip()
      const gg = ctx.createRadialGradient(gx - Rg * 0.35, gy - Rg * 0.35, Rg * 0.1, gx, gy, Rg * 1.15)
      gg.addColorStop(0, rgba(cur.core, dk ? 0.55 : 0.5))
      gg.addColorStop(0.6, rgba(midWash, dk ? 0.28 : 0.3))
      gg.addColorStop(1, rgba(base, dk ? 0.1 : 0.05))
      ctx.fillStyle = gg; ctx.fillRect(gx - Rg, gy - Rg, Rg * 2, Rg * 2)

      // 3) Graticule (parallels + meridians), clipped to the globe.
      ctx.strokeStyle = rgba(cur.line, dk ? 0.16 : 0.13); ctx.lineWidth = 1
      const strokePath = (samples) => {
        ctx.beginPath(); let pen = false
        for (const [lon, lat] of samples) { const p = project(lon, lat); if (p.vis) { pen ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); pen = true } else pen = false }
        ctx.stroke()
      }
      for (let lat = -60; lat <= 60; lat += 30) { const s = []; for (let lon = -180; lon <= 180; lon += 6) s.push([lon, lat]); strokePath(s) }
      for (let lon = -180; lon < 180; lon += 30) { const s = []; for (let lat = -90; lat <= 90; lat += 6) s.push([lon, lat]); strokePath(s) }

      // 4) Continent outlines — the real map, rotating with the globe.
      ctx.strokeStyle = rgba(cur.line, dk ? 0.4 : 0.32); ctx.lineWidth = 1.1
      for (const ring of WORLD) strokePath(ring)
      ctx.restore()

      // 5) Rim + soft outer atmosphere glow.
      const atm = ctx.createRadialGradient(gx, gy, Rg * 0.92, gx, gy, Rg * 1.14)
      atm.addColorStop(0, rgba(cur.line, dk ? 0.18 : 0.12)); atm.addColorStop(1, rgba(cur.line, 0))
      ctx.fillStyle = atm; ctx.beginPath(); ctx.arc(gx, gy, Rg * 1.14, 0, 6.2832); ctx.fill()
      ctx.strokeStyle = rgba(cur.line, dk ? 0.34 : 0.26); ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(gx, gy, Rg, 0, 6.2832); ctx.stroke()

      // 6) Intercontinental connections — arcs lifting off the globe between
      //    hub cities (flights + provider links). Only when both ends face us.
      const proj = CITIES.map(([lo, la]) => project(lo, la))
      LINKS.forEach(([i, j, gold], li) => {
        const a = proj[i], b = proj[j]
        if (!a.vis || !b.vis) return
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
        const dx = mx - gx, dy = my - gy, d = Math.hypot(dx, dy) || 1
        const lift = Rg * 0.22 + d * 0.15
        const cxp = mx + (dx / d) * lift, cyp = my + (dy / d) * lift
        const col = gold ? GOLD : cur.dot
        ctx.setLineDash([6, 6]); ctx.strokeStyle = rgba(col, gold ? (dk ? 0.5 : 0.46) : (dk ? 0.3 : 0.26))
        ctx.lineWidth = gold ? 1.4 : 1
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(cxp, cyp, b.x, b.y); ctx.stroke()
        ctx.setLineDash([])
        // travelling signal pulse
        const u = ((t * (gold ? 0.00016 : 0.00012) + li * 0.13) % 1 + 1) % 1
        const bx = (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * cxp + u * u * b.x
        const by = (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * cyp + u * u * b.y
        ctx.fillStyle = rgba(col, dk ? 0.9 : 0.78)
        ctx.beginPath(); ctx.arc(bx, by, gold ? 2.4 : 1.9, 0, 6.2832); ctx.fill()
        // a small plane outline on flight links
        if (FLIGHT_LINKS.includes(li)) {
          const dxdu = 2 * (1 - u) * (cxp - a.x) + 2 * u * (b.x - cxp)
          const dydu = 2 * (1 - u) * (cyp - a.y) + 2 * u * (b.y - cyp)
          const ang = Math.atan2(dydu, dxdu), s = 6
          ctx.save(); ctx.translate(bx, by); ctx.rotate(ang); ctx.scale(s, s)
          ctx.lineWidth = 1 / s; ctx.strokeStyle = rgba(cur.dot, dk ? 0.75 : 0.62)
          ctx.beginPath(); PLANE.forEach(([qx, qy], k) => (k ? ctx.lineTo(qx, qy) : ctx.moveTo(qx, qy)))
          ctx.closePath(); ctx.stroke(); ctx.restore()
        }
      })
      // 7) City nodes.
      for (const p of proj) {
        if (!p.vis) continue
        ctx.fillStyle = rgba(cur.dot, dk ? 0.8 : 0.7)
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, 6.2832); ctx.fill()
      }

      // 8) Faint logo watermark, top-left.
      if (logoReady) {
        const lw = Math.min(W, H) * 0.13, lh = lw * (logo.height / logo.width), pad = Math.min(W, H) * 0.05
        ctx.save(); ctx.globalAlpha = dk ? 0.11 : 0.08
        ctx.drawImage(logo, pad, pad, lw, lh); ctx.restore()
      }

      // 9) Pointer glow — a whisper of light on the cursor.
      const gr = Math.min(W, H) * 0.24, glowC = mix(cur.line, WHITE, dk ? 0.15 : 0.4)
      ctx.globalCompositeOperation = 'lighter'
      const lg = ctx.createRadialGradient(px, py, 0, px, py, gr)
      lg.addColorStop(0, rgba(glowC, dk ? 0.1 : 0.13)); lg.addColorStop(0.5, rgba(glowC, dk ? 0.03 : 0.045)); lg.addColorStop(1, rgba(glowC, 0))
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
