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

// Hub cities (lon, lat). Indices: 0 NYC, 1 London, 2 Tel-Aviv, 3 Dubai,
// 4 Tokyo, 5 LA, 6 São Paulo, 7 Sydney, 8 Joburg, 9 Mumbai, 10 Paris,
// 11 Beijing, 12 Moscow, 13 Singapore.
const CITIES = [
  [-74, 40.7], [-0.1, 51.5], [34.8, 32.1], [55.3, 25.2], [139.7, 35.7],
  [-118.2, 34], [-46.6, -23.5], [151.2, -33.9], [28, -26.2], [72.8, 19],
  [2.3, 48.9], [116.4, 39.9], [37.6, 55.7], [103.8, 1.35],
]
// Flight routes [i, j] — carry a little plane, drawn airport-to-airport (from
// the ground node, no signal pulse). A distinct set from the signal network.
const FLIGHTS = [
  [0, 1], [1, 3], [3, 4], [5, 0], [3, 7], [9, 13], [2, 10], [4, 7],
]
// Signal links [i, j, kind] — carry a travelling pulse, drawn tower-to-tower
// (tip-to-tip, off the mast top). kind: 0 = data, 1 = gold "best route",
// 2 = AUDIO (Kol Torah — Tel Aviv → London carries music notes, not dots).
const SIGNALS = [
  [2, 3, 1], [2, 1, 2], [3, 9, 0], [13, 11, 0], [8, 2, 1], [12, 1, 0],
  [4, 13, 0], [6, 0, 0], [11, 4, 0], [5, 6, 0], [1, 10, 0],
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
    const D2R = Math.PI / 180

    const logo = new Image()
    let logoReady = false
    logo.onload = () => { logoReady = true }
    logo.src = '/logo.png'

    // Engraved sunburst behind the globe — many THIN rays (etching-style, no
    // soft halo), radiating from the globe centre.
    const N = 260
    const rays = Array.from({ length: N }, (_, i) => ({
      a: (i + 0.5) / N * 6.283 + (Math.random() - 0.5) * 0.015,
      r: 0.7 + Math.random() * 0.7, lp: Math.random() * 6.283,
      tp: Math.random() * 6.283, ds: 0.5 + Math.random() * 0.8,
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
      ctx.lineWidth = 0.55                                        // etching-thin
      for (const ry of rays) {
        const ca = Math.cos(ry.a), sa = Math.sin(ry.a)
        const sx = gx + ca * rim, sy = gy + sa * rim              // start at the globe rim
        const len = Rg * 0.1 + ry.r * RR * (0.55 + 0.05 * Math.sin(t * 0.0006 + ry.lp))
        let tx = gx + ca * (rim + len), ty = gy + sa * (rim + len)
        let mxp = (sx + tx) / 2, myp = (sy + ty) / 2
        const dmx = mxp - px, dmy = myp - py, dm = Math.hypot(dmx, dmy) || 1, fM = Math.exp(-(dm * dm) / fieldR2)
        mxp += (dmx / dm) * fM * 150; myp += (dmy / dm) * fM * 150
        ctx.strokeStyle = rgba(cur.line, dk ? 0.18 : 0.09)
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(mxp, myp, tx, ty); ctx.stroke()
        const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 0.0011 + ry.tp))
        ctx.fillStyle = rgba(cur.dot, (dk ? 0.42 : 0.36) * tw)
        ctx.beginPath(); ctx.arc(tx, ty, ry.ds, 0, 6.2832); ctx.fill()
      }

      // 1b) CD-satellite — the audio line as part of the scene: a small disc
      //     orbiting the globe like a satellite (grooved rings + a gold sheen
      //     that sweeps as it spins). Far half draws behind the globe.
      const su = t * 0.00009, tilt = -0.42
      const eA = Rg * 1.32, eB = Rg * 0.34
      const ex = Math.cos(su) * eA, ey = Math.sin(su) * eB
      const sat = {
        x: gx + ex * Math.cos(tilt) - ey * Math.sin(tilt),
        y: gy + ex * Math.sin(tilt) + ey * Math.cos(tilt),
        front: Math.sin(su) > 0,
        r: Math.min(W, H) * 0.028,
      }
      // faint orbit path so the disc reads as a satellite, not a floater
      ctx.save(); ctx.translate(gx, gy); ctx.rotate(tilt)
      ctx.strokeStyle = rgba(cur.line, dk ? 0.08 : 0.06); ctx.lineWidth = 0.6
      ctx.setLineDash([2, 6]); ctx.beginPath(); ctx.ellipse(0, 0, eA, eB, 0, 0, 6.2832); ctx.stroke()
      ctx.setLineDash([]); ctx.restore()
      const drawSat = () => {
        const { x, y, r } = sat
        ctx.save(); ctx.lineCap = 'round'
        ctx.fillStyle = rgb(base)                                  // occlude what's behind
        ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill()
        ctx.strokeStyle = rgba(cur.line, dk ? 0.55 : 0.45); ctx.lineWidth = 1
        for (const rr of [1, 0.66, 0.3]) { ctx.beginPath(); ctx.arc(x, y, r * rr, 0, 6.2832); ctx.stroke() }
        ctx.fillStyle = rgba(cur.line, dk ? 0.5 : 0.4)
        ctx.beginPath(); ctx.arc(x, y, r * 0.08, 0, 6.2832); ctx.fill()
        const sweep = t * 0.0012                                   // spinning gold sheen
        ctx.strokeStyle = rgba(GOLD, dk ? 0.75 : 0.6); ctx.lineWidth = 1.6
        ctx.beginPath(); ctx.arc(x, y, r * 0.82, sweep, sweep + 0.9); ctx.stroke()
        ctx.strokeStyle = rgba(GOLD, dk ? 0.35 : 0.28); ctx.lineWidth = 1
        ctx.beginPath(); ctx.arc(x, y, r * 0.5, sweep + 2.4, sweep + 3.0); ctx.stroke()
        ctx.restore()
      }
      if (!sat.front) drawSat()

      // 2) Globe disc — the OCEAN: a subtly tinted sphere (a warm gold sheen on
      //    dark, a cool azure on light). Kept dim so the land + network read
      //    clearly over it.
      ctx.save(); ctx.beginPath(); ctx.arc(gx, gy, Rg, 0, 6.2832); ctx.clip()
      const oceanHue = dk ? GOLD : cur.line
      const ocean = mix(cur.core, oceanHue, dk ? 0.4 : 0.32)
      const gg = ctx.createRadialGradient(gx - Rg * 0.35, gy - Rg * 0.35, Rg * 0.1, gx, gy, Rg * 1.15)
      gg.addColorStop(0, rgba(ocean, dk ? 0.34 : 0.44))
      gg.addColorStop(0.55, rgba(mix(midWash, oceanHue, dk ? 0.24 : 0.2), dk ? 0.2 : 0.34))
      gg.addColorStop(1, rgba(base, dk ? 0.06 : 0.08))
      ctx.fillStyle = gg; ctx.fillRect(gx - Rg, gy - Rg, Rg * 2, Rg * 2)

      // 3) Graticule (parallels + meridians), clipped to the globe.
      ctx.strokeStyle = rgba(cur.line, dk ? 0.2 : 0.2); ctx.lineWidth = 1
      const strokePath = (samples) => {
        ctx.beginPath(); let pen = false
        for (const [lon, lat] of samples) { const p = project(lon, lat); if (p.vis) { pen ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); pen = true } else pen = false }
        ctx.stroke()
      }
      for (let lat = -60; lat <= 60; lat += 30) { const s = []; for (let lon = -180; lon <= 180; lon += 6) s.push([lon, lat]); strokePath(s) }
      for (let lon = -180; lon < 180; lon += 30) { const s = []; for (let lat = -90; lat <= 90; lat += 6) s.push([lon, lat]); strokePath(s) }

      // 4) Continents — the real map, rotating with the globe. Each ring is
      //    filled a touch (so LAND reads distinct from the tinted ocean) then
      //    outlined with quadratic midpoint smoothing (curved coasts, not boxy).
      //    Runs are split at the horizon so only the near face draws.
      const landFill = dk ? mix(cur.core, DARKBG, 0.5) : WHITE
      const runsOf = (samples) => {
        const runs = []; let run = []
        for (const [lon, lat] of samples) { const p = project(lon, lat); if (p.vis) run.push(p); else { if (run.length >= 2) runs.push(run); run = [] } }
        if (run.length >= 2) runs.push(run)
        return runs
      }
      const smoothPath = (run) => {
        ctx.moveTo(run[0].x, run[0].y)
        for (let k = 1; k < run.length - 1; k++) {
          const mx = (run[k].x + run[k + 1].x) / 2, my = (run[k].y + run[k + 1].y) / 2
          ctx.quadraticCurveTo(run[k].x, run[k].y, mx, my)
        }
        ctx.lineTo(run[run.length - 1].x, run[run.length - 1].y)
      }
      ctx.lineJoin = 'round'; ctx.lineCap = 'round'
      const RINGS = WORLD.map(runsOf)
      ctx.fillStyle = rgba(landFill, dk ? 0.22 : 0.26)                     // land tint
      for (const runs of RINGS) for (const run of runs) { ctx.beginPath(); smoothPath(run); ctx.closePath(); ctx.fill() }
      ctx.strokeStyle = rgba(dk ? mix(cur.line, WHITE, 0.55) : mix(cur.line, DARKBG, 0.2), dk ? 0.85 : 0.8)  // coastline
      ctx.lineWidth = 1.2
      for (const runs of RINGS) for (const run of runs) { ctx.beginPath(); smoothPath(run); ctx.stroke() }
      ctx.lineJoin = 'miter'; ctx.lineCap = 'butt'
      ctx.restore()

      // 5) Crisp limb only — no soft outer glow (the engraved rays ARE the
      //    halo now; a gradient wash on top muddied them).
      ctx.strokeStyle = rgba(cur.line, dk ? 0.38 : 0.3); ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(gx, gy, Rg, 0, 6.2832); ctx.stroke()

      // 6) Cell-towers / telephone poles at each hub — a vertical post with two
      //    cross-arms and insulator nubs (a real utility pole, not a plus sign),
      //    the antenna at the top broadcasting signal waves. Tower tips are
      //    captured so the phone network can run tower-top to tower-top.
      const proj = CITIES.map(([lo, la]) => project(lo, la))
      const mast = Math.min(W, H) * 0.04
      const tips = proj.map((p) => {
        if (!p.vis) return null
        const dx = p.x - gx, dy = p.y - gy, d = Math.hypot(dx, dy) || 1
        return { x: p.x + (dx / d) * mast, y: p.y + (dy / d) * mast, ux: dx / d, uy: dy / d, base: p }
      })
      ctx.lineCap = 'round'
      tips.forEach((tp, i) => {
        if (!tp) return
        const { base, ux, uy } = tp, perpx = -uy, perpy = ux
        ctx.strokeStyle = rgba(cur.line, dk ? 0.5 : 0.42); ctx.lineWidth = 1.3
        ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(tp.x, tp.y); ctx.stroke()      // post
        ctx.lineWidth = 1; ctx.strokeStyle = rgba(cur.line, dk ? 0.46 : 0.38)
        for (const [h, w] of [[0.82, 0.3], [0.6, 0.22]]) {                                     // two cross-arms
          const cx = base.x + ux * mast * h, cy = base.y + uy * mast * h, aw = mast * w
          const e1x = cx - perpx * aw, e1y = cy - perpy * aw, e2x = cx + perpx * aw, e2y = cy + perpy * aw
          ctx.beginPath(); ctx.moveTo(e1x, e1y); ctx.lineTo(e2x, e2y); ctx.stroke()
          ctx.fillStyle = rgba(cur.dot, dk ? 0.6 : 0.5)                                        // insulator nubs
          for (const [ex, ey] of [[e1x, e1y], [e2x, e2y]]) { ctx.beginPath(); ctx.arc(ex, ey, 1.1, 0, 6.2832); ctx.fill() }
        }
        const baseA = Math.atan2(uy, ux)                                                       // waves off the top
        for (let s = 0; s < 2; s++) {
          const ph = ((t * 0.001 + i * 0.5 + s * 0.5) % 1 + 1) % 1
          ctx.strokeStyle = rgba(cur.dot, (dk ? 0.34 : 0.28) * (1 - ph))
          ctx.beginPath(); ctx.arc(tp.x, tp.y, mast * (0.22 + ph * 0.8), baseA - 0.6, baseA + 0.6); ctx.stroke()
        }
        ctx.fillStyle = rgba(cur.dot, dk ? 0.85 : 0.72)
        ctx.beginPath(); ctx.arc(tp.x, tp.y, 1.6, 0, 6.2832); ctx.fill()
      })
      ctx.lineCap = 'butt'

      // A lifted quadratic control point (a great-circle-ish bow off the globe).
      const arcCtrl = (a, b) => {
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
        const dx = mx - gx, dy = my - gy, d = Math.hypot(dx, dy) || 1
        const lift = Rg * 0.22 + d * 0.15
        return { cx: mx + (dx / d) * lift, cy: my + (dy / d) * lift }
      }
      const bez = (a, cx, cy, b, u) => ({
        x: (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * cx + u * u * b.x,
        y: (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * cy + u * u * b.y,
      })

      // 7) Flight routes — AIRPORT to AIRPORT (ground node to ground node): a
      //    dashed bow with a little plane tracing it. No signal pulse here.
      const flightCol = mix(cur.line, WHITE, dk ? 0.6 : 0.2)   // pale silver contrail — NOT gold
      FLIGHTS.forEach(([i, j], li) => {
        const a = proj[i], b = proj[j]
        if (!a || !b || !a.vis || !b.vis) return
        const { cx, cy } = arcCtrl(a, b)
        ctx.setLineDash([5, 7]); ctx.strokeStyle = rgba(flightCol, dk ? 0.36 : 0.3); ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(cx, cy, b.x, b.y); ctx.stroke()
        ctx.setLineDash([])
        const u = ((t * 0.00009 + li * 0.17) % 1 + 1) % 1, pt = bez(a, cx, cy, b, u)
        const dxdu = 2 * (1 - u) * (cx - a.x) + 2 * u * (b.x - cx)
        const dydu = 2 * (1 - u) * (cy - a.y) + 2 * u * (b.y - cy)
        const sp = 6.5
        ctx.save(); ctx.translate(pt.x, pt.y); ctx.rotate(Math.atan2(dydu, dxdu)); ctx.scale(sp, sp)
        ctx.lineWidth = 1 / sp; ctx.strokeStyle = rgba(flightCol, dk ? 0.9 : 0.7)
        ctx.beginPath(); PLANE.forEach(([qx, qy], k) => (k ? ctx.lineTo(qx, qy) : ctx.moveTo(qx, qy)))
        ctx.closePath(); ctx.stroke(); ctx.restore()
      })

      // 8) Signal network — TOWER-TOP to TOWER-TOP (tip to tip): a bow carrying
      //    a travelling pulse. No plane. Gold links = "best route"; the AUDIO
      //    link broadcasts Kol Torah — tiny quavers travel it instead of dots.
      const drawNote = (x, y, alpha) => {
        ctx.save(); ctx.translate(x, y); ctx.scale(1.15, 1.15)
        ctx.strokeStyle = rgba(GOLD, alpha); ctx.fillStyle = rgba(GOLD, alpha); ctx.lineWidth = 1
        ctx.beginPath(); ctx.ellipse(0, 2.2, 2.1, 1.5, -0.45, 0, 6.2832); ctx.fill()   // head
        ctx.beginPath(); ctx.moveTo(1.9, 1.6); ctx.lineTo(1.9, -3.6); ctx.stroke()      // stem
        ctx.beginPath(); ctx.moveTo(1.9, -3.6); ctx.quadraticCurveTo(4.4, -2.8, 4.6, -0.6); ctx.stroke() // flag
        ctx.restore()
      }
      SIGNALS.forEach(([i, j, kind], li) => {
        const a = tips[i], b = tips[j]
        if (!a || !b) return
        const gold = kind >= 1
        const { cx, cy } = arcCtrl(a, b)
        ctx.setLineDash([2, 5]); ctx.strokeStyle = rgba(gold ? GOLD : cur.line, gold ? (dk ? 0.5 : 0.44) : (dk ? 0.34 : 0.28))
        ctx.lineWidth = gold ? 1.3 : 1
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(cx, cy, b.x, b.y); ctx.stroke()
        ctx.setLineDash([])
        if (kind === 2) {
          for (let s = 0; s < 2; s++) {                            // two phase-offset quavers
            const u = ((t * 0.00013 + li * 0.11 + s * 0.5) % 1 + 1) % 1
            const pt = bez(a, cx, cy, b, u)
            drawNote(pt.x, pt.y, (dk ? 0.9 : 0.75) * Math.sin(Math.PI * u))
          }
        } else {
          const u = ((t * (gold ? 0.0002 : 0.00015) + li * 0.11) % 1 + 1) % 1, pt = bez(a, cx, cy, b, u)
          ctx.fillStyle = rgba(gold ? GOLD : cur.dot, dk ? 0.92 : 0.8)
          ctx.beginPath(); ctx.arc(pt.x, pt.y, gold ? 2.3 : 1.8, 0, 6.2832); ctx.fill()
        }
      })

      // 9) The CHARGER line, in-scene: the world plugged in. A thin cable rises
      //    from the bottom-left edge to the globe's lower-left rim, ends in a
      //    small connector, and gold power ticks flow INTO the globe. Reads as
      //    "we keep the world charged" instead of a pasted-on cable doodle.
      {
        const plugA = Math.PI * 0.78                               // lower-left of the rim
        const pxr = gx + Math.cos(plugA) * (Rg + 3), pyr = gy + Math.sin(plugA) * (Rg + 3)
        const nx = Math.cos(plugA), ny = Math.sin(plugA)           // rim normal (outward)
        const sx0 = Math.max(0, gx - Rg * 1.55), sy0 = H + 8       // enters from bottom edge
        const c1x = sx0 + (pxr - sx0) * 0.15, c1y = sy0 - (sy0 - pyr) * 0.55
        const c2x = pxr + nx * Rg * 0.45, c2y = pyr + ny * Rg * 0.45
        ctx.lineCap = 'round'
        ctx.strokeStyle = rgba(flightCol, dk ? 0.34 : 0.26); ctx.lineWidth = 1.4
        ctx.beginPath(); ctx.moveTo(sx0, sy0); ctx.bezierCurveTo(c1x, c1y, c2x, c2y, pxr, pyr); ctx.stroke()
        // connector head: a small lozenge seated on the rim, aligned to the normal
        ctx.save(); ctx.translate(pxr, pyr); ctx.rotate(Math.atan2(ny, nx) + Math.PI / 2)
        ctx.strokeStyle = rgba(cur.line, dk ? 0.6 : 0.45); ctx.lineWidth = 1.2
        const cw = 4.6, ch = 7
        ctx.beginPath()
        ctx.moveTo(-cw / 2, 0); ctx.lineTo(-cw / 2, ch * 0.65); ctx.arcTo(-cw / 2, ch, 0, ch, 2.4)
        ctx.arcTo(cw / 2, ch, cw / 2, ch * 0.65, 2.4); ctx.lineTo(cw / 2, 0)
        ctx.stroke(); ctx.restore()
        // power ticks flowing along the cable toward the globe
        const cbez = (u) => {
          const a = 1 - u
          return {
            x: a * a * a * sx0 + 3 * a * a * u * c1x + 3 * a * u * u * c2x + u * u * u * pxr,
            y: a * a * a * sy0 + 3 * a * a * u * c1y + 3 * a * u * u * c2y + u * u * u * pyr,
          }
        }
        for (let s = 0; s < 3; s++) {
          const u = ((t * 0.00016 + s / 3) % 1 + 1) % 1
          const pt = cbez(u)
          ctx.fillStyle = rgba(GOLD, (dk ? 0.8 : 0.65) * (0.35 + 0.65 * u))
          ctx.beginPath(); ctx.arc(pt.x, pt.y, 1.5, 0, 6.2832); ctx.fill()
        }
        // charge glimmer where the connector meets the rim
        const gl = 0.5 + 0.5 * Math.sin(t * 0.003)
        ctx.strokeStyle = rgba(GOLD, (dk ? 0.5 : 0.4) * gl); ctx.lineWidth = 1.4
        ctx.beginPath(); ctx.arc(gx, gy, Rg, plugA - 0.09, plugA + 0.09); ctx.stroke()
        ctx.lineCap = 'butt'
      }

      // 9b) Near half of the CD-satellite passes in FRONT of the globe.
      if (sat.front) drawSat()

      // 10) Faint logo watermark, top-left.
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
