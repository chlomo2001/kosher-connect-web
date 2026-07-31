// Comparing the repo's migrations against a database's ledger.
//
// The trap this exists to remove: **the version numbers do not match, by
// design.** Migrations applied through the Supabase MCP `apply_migration` are
// stamped with the timestamp of the moment they ran, not the one in the repo
// filename — so `20260719240000_customers_passport_on_file.sql` is recorded as
// version `20260731171234`. Diffing by version reports every migration as drift
// and hides the one that genuinely is. The **name** is the stable key, and
// that's what this compares.
//
// (Reconciled 31 Jul against Kc-Live: 59/59 by name, both directions empty,
// while every single version differed. That is the expected shape.)

// `supabase/migrations/20260719240000_customers_passport_on_file.sql`
//   → `customers_passport_on_file`
export function migrationName(file) {
  return String(file)
    .replace(/^.*[/\\]/, '')      // strip any directory
    .replace(/\.sql$/i, '')       // strip the extension
    .replace(/^\d+_/, '')         // strip the leading version stamp
}

// Accepts what the tools actually hand back, so no one has to reshape it:
//   {migrations: [{version, name}]} — Supabase MCP list_migrations
//   [{version, name}] / [{name}]    — a bare array
//   "a\nb\nc"                       — newline-separated names
export function parseDbMigrations(input) {
  if (input == null) return []
  let data = input
  if (typeof data === 'string') {
    const text = data.trim()
    if (!text) return []
    if (text.startsWith('{') || text.startsWith('[')) {
      try { data = JSON.parse(text) } catch { data = null }
      if (data == null) throw new Error('Database migration list is not valid JSON.')
    } else {
      return text.split('\n').map((l) => l.trim()).filter(Boolean)
    }
  }
  const rows = Array.isArray(data) ? data : (Array.isArray(data?.migrations) ? data.migrations : null)
  if (!rows) throw new Error('Expected {migrations: [...]}, an array, or newline-separated names.')
  return rows
    .map((r) => (typeof r === 'string' ? r : r?.name))
    .filter((n) => typeof n === 'string' && n.length > 0)
}

const duplicates = (names) => {
  const seen = new Map()
  for (const n of names) seen.set(n, (seen.get(n) || 0) + 1)
  return [...seen.entries()].filter(([, c]) => c > 1).map(([n]) => n).sort()
}

// Two-way comparison. `missingInDb` is the one that matters day to day —
// migrations the repo has that the database has never recorded.
export function diffMigrations(repoFiles, dbInput) {
  const repo = (repoFiles || []).map(migrationName)
  const db = parseDbMigrations(dbInput)
  const dbSet = new Set(db)
  const repoSet = new Set(repo)

  const missingInDb = repo.filter((n) => !dbSet.has(n)).sort()
  const extraInDb = db.filter((n) => !repoSet.has(n)).sort()
  // A repeated name would make name-matching ambiguous — the whole method rests
  // on names being unique, so say so loudly rather than compare on sand.
  const duplicateNames = [...new Set([...duplicates(repo), ...duplicates(db)])].sort()

  return {
    repoCount: repo.length,
    dbCount: db.length,
    missingInDb,
    extraInDb,
    duplicateNames,
    ok: missingInDb.length === 0 && extraInDb.length === 0 && duplicateNames.length === 0,
  }
}

export function formatDrift(result, label = 'database') {
  const lines = [`repo: ${result.repoCount}   ${label}: ${result.dbCount}`]
  if (result.duplicateNames.length) {
    lines.push('', `DUPLICATE NAMES (name matching is unreliable until fixed):`)
    for (const n of result.duplicateNames) lines.push(`  ! ${n}`)
  }
  lines.push('', `In repo, NOT applied to ${label}:`)
  lines.push(...(result.missingInDb.length ? result.missingInDb.map((n) => `  + ${n}`) : ['  (none)']))
  lines.push('', `Applied to ${label}, NOT in repo:`)
  lines.push(...(result.extraInDb.length ? result.extraInDb.map((n) => `  - ${n}`) : ['  (none)']))
  lines.push('', result.ok ? 'DRIFT: none — repo and database agree by name.' : 'DRIFT: see above.')
  return lines.join('\n')
}
