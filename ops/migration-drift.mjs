#!/usr/bin/env node
// Is every migration in the repo actually recorded in a given database?
//
// Compares BY NAME, not by version — see lib/migrationDrift.mjs for why the
// versions legitimately differ and why diffing on them is misleading.
//
// Usage — paste or pipe the output of the Supabase MCP `list_migrations`:
//
//   node ops/migration-drift.mjs < live-migrations.json
//   pbpaste | node ops/migration-drift.mjs --label Kc-Live
//
// Exits 0 when the two agree, 1 when they drift (so it can gate a deploy).

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { diffMigrations, formatDrift } from '../lib/migrationDrift.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const labelFlag = process.argv.indexOf('--label')
const label = labelFlag > -1 ? (process.argv[labelFlag + 1] || 'database') : 'database'

const repoFiles = readdirSync(join(root, 'supabase', 'migrations')).filter((f) => f.endsWith('.sql'))

let stdin = ''
try {
  stdin = readFileSync(0, 'utf8')
} catch {
  // No stdin at all (a bare TTY run) — fall through to the usage message below.
}
if (!stdin.trim()) {
  console.error(`Nothing on stdin.

Pipe in the database's migration list — the Supabase MCP list_migrations output
pastes in as-is:

  node ops/migration-drift.mjs < live-migrations.json

The repo currently has ${repoFiles.length} migrations.`)
  process.exit(2)
}

let result
try {
  result = diffMigrations(repoFiles, stdin)
} catch (e) {
  console.error(`Could not read the migration list: ${e.message}`)
  process.exit(2)
}

console.log(formatDrift(result, label))
process.exit(result.ok ? 0 : 1)
