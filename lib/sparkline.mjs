// The shape of the last N days, as an SVG path. Pure, no DOM.
//
// A sparkline is a small claim with a large failure mode: drawn carelessly it
// implies a trend that isn't in the numbers. The rules here exist for that
// reason.
//
//   · The baseline is ALWAYS zero, never the minimum. A line scaled from its
//     own low point turns £120, £125, £130 into a dramatic climb; from zero it
//     reads as the flat week it was.
//   · A flat run draws a flat line, not a division by zero.
//   · One point is a dot, not a line. Nothing can be inferred from one day and
//     the drawing should not pretend otherwise.
//   · Empty in, empty out — the caller draws nothing rather than an axis with
//     no data on it, which reads as "zero every day".

/** Round to 2dp for a compact path string; SVG does not need more. */
const r2 = (n) => Math.round(n * 100) / 100

/**
 * points → { d, dots, max, last, first }
 *
 * `d`     the path, in a viewBox of `width` × `height` (y is flipped for SVG)
 * `dots`  [{x, y}] for the last point, so a caller can mark "today"
 * `max`   the scale used, which a caller may want to label
 *
 * A zero-height band is left at the top so the tallest point is not clipped by
 * the stroke's own width.
 */
export function sparklinePath(values, { width = 120, height = 28, pad = 2 } = {}) {
  const nums = (Array.isArray(values) ? values : [])
    .map(v => Number(v) || 0)
    .filter(v => Number.isFinite(v))
  if (!nums.length) return { d: '', dots: [], max: 0, first: null, last: null, count: 0 }

  const max = Math.max(0, ...nums)
  const usable = Math.max(1, height - pad * 2)
  // Baseline zero, always. A flat run sits on the floor rather than filling
  // the box, which is the honest picture of a week where nothing moved.
  const y = (v) => r2(pad + usable - (max > 0 ? (v / max) * usable : 0))

  if (nums.length === 1) {
    const only = { x: r2(width / 2), y: y(nums[0]) }
    return { d: '', dots: [only], max, first: nums[0], last: nums[0], count: 1 }
  }

  const step = width / (nums.length - 1)
  const pts = nums.map((v, i) => ({ x: r2(i * step), y: y(v) }))
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ')
  return { d, dots: [pts[pts.length - 1]], max, first: nums[0], last: nums[nums.length - 1], count: nums.length }
}

/**
 * What the line is worth saying in words — for the screen-reader label, and
 * because a picture of a trend that nobody can read is decoration.
 */
export function sparklineLabel(values, { unit = '', days = null } = {}) {
  const nums = (Array.isArray(values) ? values : []).map(v => Number(v) || 0)
  if (!nums.length) return 'No data yet'
  const span = days || nums.length
  const total = nums.reduce((a, b) => a + b, 0)
  const peak = Math.max(...nums)
  return `${span} days, ${unit}${r2(total)} in total, best day ${unit}${r2(peak)}`
}
