#!/usr/bin/env node
// Finds identical blocks of code that appear in more than one place.
//
//   node find-duplicates.mjs [--min 8] [--ext js,mjs,css] [--top 40] [dir]
//
// Reports maximal repeated blocks (largest first) with file:line ranges and a
// preview. Blank lines and comment-only lines are ignored when matching, so a
// block still matches across cosmetic differences in spacing/commenting.
//
// This is a CANDIDATE finder, not a verdict: some duplication is deliberate
// (client mirrors of server modules in bundler-less apps, fixtures, vendored
// code). Classify every hit before acting on it.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, extname, relative } from 'node:path'

const args = process.argv.slice(2)
let min = 8
let top = 40
let exts = ['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.css', '.scss', '.py', '.rb', '.go', '.java', '.php', '.sql', '.sh']
let root = '.'
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--min') min = Number(args[++i])
  else if (args[i] === '--top') top = Number(args[++i])
  else if (args[i] === '--ext') exts = args[++i].split(',').map((e) => (e.startsWith('.') ? e : '.' + e))
  else root = args[i]
}

const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'out', 'coverage', 'vendor', '.cache'])

function* walk(dir) {
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) yield* walk(join(dir, e.name))
    } else if (e.isFile() && exts.includes(extname(e.name))) {
      yield join(dir, e.name)
    }
  }
}

const COMMENT_ONLY = /^(\/\/|\/\*|\*|#|--|<!--)/

// Per file: array of { text, line } for lines that count (non-blank, non-comment).
const files = new Map()
for (const path of walk(root)) {
  let src
  try {
    if (statSync(path).size > 2_000_000) continue
    src = readFileSync(path, 'utf8')
  } catch { continue }
  const raw = src.split('\n')
  if (raw.some((l) => l.length > 800)) continue // minified / generated bundles
  const norm = []
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i].trim()
    if (!t || COMMENT_ONLY.test(t)) continue
    norm.push({ text: t, line: i + 1 })
  }
  if (norm.length >= min) files.set(relative(root, path) || path, norm)
}

// Hash every window of `min` normalized lines.
const groups = new Map() // key -> [{ f, i }]
const keyAt = new Map()  // `${f}#${i}` -> key
for (const [f, norm] of files) {
  for (let i = 0; i + min <= norm.length; i++) {
    const key = norm.slice(i, i + min).map((l) => l.text).join('\n')
    keyAt.set(`${f}#${i}`, key)
    let g = groups.get(key)
    if (!g) groups.set(key, (g = []))
    g.push({ f, i })
  }
}

const sig = (locs) => locs.map((l) => `${l.f}#${l.i}`).sort().join('|')
const groupAt = (f, i) => {
  const key = keyAt.get(`${f}#${i}`)
  return key ? groups.get(key) : null
}
// True when every location shifted by d lands in one shared duplicate group
// covering exactly the shifted set — i.e. the block continues as a unit.
const shiftsAsUnit = (locs, d) => {
  const shifted = locs.map((l) => ({ f: l.f, i: l.i + d }))
  if (shifted.some((l) => l.i < 0)) return false
  const g = groupAt(shifted[0].f, shifted[0].i)
  return !!g && sig(g) === sig(shifted)
}

const blocks = []
for (const [key, locs] of groups) {
  if (locs.length < 2) continue
  if (shiftsAsUnit(locs, -1)) continue // not the start of the maximal block
  let len = min
  while (shiftsAsUnit(locs, len - min + 1)) len++
  // Noise gate: a block should contain some substantial lines, not just braces.
  const norm = files.get(locs[0].f)
  const lines = norm.slice(locs[0].i, locs[0].i + len)
  if (lines.filter((l) => l.text.length >= 10).length < 3) continue
  blocks.push({ locs, len, lines })
}

blocks.sort((a, b) => b.len * b.locs.length - a.len * a.locs.length)

if (!blocks.length) {
  console.log(`No repeated blocks of ${min}+ lines found.`)
  process.exit(0)
}
console.log(`${blocks.length} repeated block(s) of ${min}+ lines (largest first, top ${top}):\n`)
for (const b of blocks.slice(0, top)) {
  console.log(`== ${b.len} lines x ${b.locs.length} places`)
  for (const { f, i } of b.locs) {
    const norm = files.get(f)
    console.log(`   ${f}:${norm[i].line}-${norm[i + b.len - 1].line}`)
  }
  for (const l of b.lines.slice(0, 2)) console.log(`   | ${l.text.slice(0, 100)}`)
  console.log('')
}
