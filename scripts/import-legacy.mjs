// One-shot import: legacy blob store → relational tables.
//
// Reads the app-shaped arrays from the old key-value `store` table (or local
// ./data/*.json files) and pushes them through the SAME mappers/sync code the
// API routes use, so imported data is byte-identical to what live saves
// would produce.
//
// Usage:
//   SUPABASE_URL=https://<target>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<target service key> \
//   SOURCE_SUPABASE_URL=https://<source>.supabase.co \
//   SOURCE_SUPABASE_KEY=<source anon or service key> \
//   node scripts/import-legacy.mjs
//
// Omit SOURCE_* to read from ./data/*.json instead. Target vars are the same
// ones the API routes use — the import lands exactly where the app will read.
//
// Idempotent: upserts by legacy_id; re-running refreshes rather than
// duplicates. Import order respects FKs: customers → phones → rentals → sims.

import fs from 'node:fs'
import path from 'node:path'
import { tablesMode } from '../lib/db.js'
import { upsertCustomer, syncPhones, syncRentals, syncSims } from '../lib/tableStore.js'

const SRC_URL = (process.env.SOURCE_SUPABASE_URL || '').trim().replace(/\/$/, '')
const SRC_KEY = (process.env.SOURCE_SUPABASE_KEY || '').trim()

async function loadSource(name) {
  if (SRC_URL) {
    const res = await fetch(`${SRC_URL}/rest/v1/store?select=value&key=eq.${name}`, {
      headers: { apikey: SRC_KEY, Authorization: `Bearer ${SRC_KEY}` },
    })
    if (!res.ok) throw new Error(`source ${name}: HTTP ${res.status} ${await res.text()}`)
    const rows = await res.json()
    return rows[0]?.value || []
  }
  const file = path.join(process.cwd(), 'data', `${name}.json`)
  if (!fs.existsSync(file)) return []
  return JSON.parse(fs.readFileSync(file, 'utf-8'))
}

async function main() {
  if (!tablesMode) {
    console.error('Target not configured: set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.')
    process.exit(1)
  }

  const [customers, phones, rentals, sims] = await Promise.all(
    ['customers', 'phones', 'rentals', 'sims'].map(loadSource)
  )
  console.log(`source: ${customers.length} customers, ${phones.length} phones, ${rentals.length} rentals, ${sims.length} sims`)

  let ok = 0
  for (const c of customers) {
    await upsertCustomer(c)
    ok++
  }
  console.log(`customers: ${ok} upserted`)

  console.log('phones:', JSON.stringify(await syncPhones(phones)))
  console.log('rentals:', JSON.stringify(await syncRentals(rentals)))
  console.log('sims:', JSON.stringify(await syncSims(sims)))
  console.log('done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
