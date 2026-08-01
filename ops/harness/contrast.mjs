// Shared contrast measurement for both harnesses.
//
// Colour is the one thing here that a missing webfont cannot distort — glyph
// widths change, ink and fill do not — so unlike width, a finding from this is
// worth acting on directly.
//
// It measures each run of text against what is actually PAINTED behind it,
// compositing translucent fills down to the first opaque ancestor. A wash of a
// hue over a card is exactly where this goes wrong, and getComputedStyle on its
// own will happily report a background of `rgba(...)` and tell you nothing.

// Runs inside the page. Returns [{text, ratio, need, size, sel}].
export function measureInPage(rootSelector) {
  const root = document.querySelector(rootSelector) || document.body
  // Chromium reports some colours as `color(srgb 0.88 0.44 0.54)` — 0–1
  // channels, not 0–255. Dividing those by 255 makes anything look black; it
  // invented a 1.28:1 failure on a button that measures 5.45:1.
  const parts = (c) => {
    const nums = (String(c).match(/[\d.]+/g) || []).map(Number)
    if (!nums.length) return []
    if (/^color\(/i.test(String(c).trim())) {
      const [r, g, b, a] = nums
      return [r * 255, g * 255, b * 255, a === undefined ? 1 : a]
    }
    return nums
  }
  const lum = (col) => {
    const [r, g, b] = parts(col).slice(0, 3).map((v) => {
      const c = v / 255
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  // Returns null when something in the stack is a gradient or an image: the
  // painted colour behind the text is then not a colour we can read off the
  // computed style, and guessing produced ten confident, entirely false
  // failures on /welcome's hero — light text on a dark gradient, reported as
  // 1:1 because the walker skipped the gradient and found a pale ancestor.
  const backdrop = (el) => {
    let layers = []
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n)
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null
      const p = parts(cs.backgroundColor)
      if (!p.length) continue
      const a = p.length > 3 ? p[3] : 1
      if (a === 0) continue
      layers.push([p[0], p[1], p[2], a])
      if (a === 1) break
    }
    if (!layers.length) layers = [[255, 255, 255, 1]]
    let out = layers[layers.length - 1].slice(0, 3)
    for (let i = layers.length - 2; i >= 0; i--) {
      const [r, g, b, a] = layers[i]
      out = [a * r + (1 - a) * out[0], a * g + (1 - a) * out[1], a * b + (1 - a) * out[2]]
    }
    return `rgb(${out.join(',')})`
  }
  const out = []
  root.querySelectorAll('*').forEach((el) => {
    const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim()
    if (text.length < 2) return
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.15) return
    // A decorative layer is not content; skip those subtrees.
    if (el.closest('[aria-hidden="true"]')) return
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) return
    const size = parseFloat(cs.fontSize)
    const bold = Number(cs.fontWeight) >= 700
    const large = size >= 24 || (size >= 18.66 && bold)
    const need = large ? 3 : 4.5
    const behind = backdrop(el)
    if (behind === null) return                    // unmeasurable, not a pass
    const L1 = lum(cs.color), L2 = lum(behind)
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
    if (ratio < need) {
      out.push({ text: text.slice(0, 34), ratio: Number(ratio.toFixed(2)), need, size,
        sel: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).toString().trim().split(/\s+/)[0] : '') })
    }
  })
  return out
}

export async function measure(page, rootSelector = 'body') {
  return page.evaluate(measureInPage, rootSelector)
}

// One line per distinct finding, worst first. Returns how many there were.
export function report(findings, label) {
  const seen = new Map()
  for (const f of findings) {
    const key = `${f.sel}|${f.ratio}`
    if (!seen.has(key)) seen.set(key, { ...f, where: new Set() })
    if (f.where) seen.get(key).where.add(f.where)
  }
  const rows = [...seen.values()].sort((a, b) => a.ratio - b.ratio)
  for (const r of rows) {
    const where = r.where.size ? `  [${[...r.where].join(' ')}]` : ''
    console.log(`✗ ${String(r.ratio).padStart(5)}:1 (needs ${r.need}) ${Math.round(r.size)}px ${r.sel.padEnd(24)} "${r.text}"${where}`)
  }
  console.log(rows.length ? `\n${rows.length} distinct contrast failure(s) in ${label}` : `\nno contrast failures in ${label}`)
  return rows.length
}
