// Fuzzy, transliteration-aware name matching — the server-side twin of the
// logic in public/main.js (used by the ELID importer). Collapses the common
// Heimishe spelling variants (taitelbaum≈teitelbaum, ck≈k, tz≈ts, w≈v, ei≈ai≈i)
// so the same person spelled two ways still matches. Pure functions, no I/O.

export function lev(a, b) {
  a = String(a); b = String(b)
  const m = a.length, n = b.length
  if (!m) return n
  if (!n) return m
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
    }
    prev = cur
  }
  return prev[n]
}

export function canon(t) {
  let x = String(t).toLowerCase().replace(/[^a-z]/g, '')
  if (!x) return ''
  x = x.replace(/sch/g, 'sh').replace(/ck/g, 'k').replace(/ph/g, 'f')
    .replace(/tz/g, 'ts').replace(/th/g, 't').replace(/ch/g, 'k').replace(/sh/g, 's')
    .replace(/w/g, 'v').replace(/y/g, 'i')
    .replace(/ei|ie|ai|ay|ey|ee|ea/g, 'i').replace(/ou|oo|au|oi/g, 'o')
    .replace(/(.)\1+/g, '$1')
  return x
}

const STOP = new Set(['mr', 'mrs', 'reb', 'rav', 'harav', 'new', 'home', 'rental', 'rentals', 'phone', 'usa', 'us', 'uk', 'london', 'antwerp', 'manchester', 'mcr', 'playground', 'callingcard', 'callcard', 'zone', 'work', 'corner', 'company', 'test', 'kosher', 'connect'])

export function toks(s) {
  return String(s || '').toLowerCase().split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !/^\d+$/.test(t) && !STOP.has(t))
}

function tokHit(u, c) {
  const uc = canon(u), cc = canon(c)
  if (!uc || !cc) return { hit: false, strong: false }
  const strong = uc === cc || (Math.min(uc.length, cc.length) >= 4 && lev(uc, cc) <= 1)
  const hit = strong || uc.startsWith(cc) || cc.startsWith(uc) ||
    (Math.min(uc.length, cc.length) >= 4 && lev(uc, cc) <= 2)
  return { hit, strong }
}

// Do two full names look like the same person? Requires two matching name
// tokens (or one strong single-token) so a shared first name alone never
// counts. Returns { match, score, strong }.
export function namesSimilar(nameA, nameB) {
  const a = toks(nameA), b = toks(nameB)
  if (!a.length || !b.length) return { match: false, score: 0, strong: 0 }
  const short = a.length <= b.length ? a : b
  const long = a.length <= b.length ? b : a
  let matched = 0, strong = 0
  for (const st of short) {
    let hitAny = false, strongAny = false
    for (const lt of long) { const r = tokHit(st, lt); if (r.hit) hitAny = true; if (r.strong) strongAny = true }
    if (hitAny) matched++
    if (strongAny) strong++
  }
  const match = (short.length >= 2 && matched >= 2 && strong >= 1) || (short.length === 1 && strong >= 1)
  return { match, score: strong * 10 + matched, strong }
}
