// Server-side loader for the owner-editable travel requirement rules. Kept
// separate from the pure lib/travelRules.mjs (which does the matching) so that
// module stays I/O-free and unit-testable. Falls back to the built-in defaults
// if the table is missing or empty, so the feature works before the migration
// is applied and never hard-fails.
import { db } from './db.js'
import { BUILTIN_RULES } from './travelRules.mjs'

let cache = null
let cacheAt = 0
const TTL = 60000 // 60s — rules change rarely; avoids a query per booking/sweep row

export async function loadTravelRules() {
  if (cache && Date.now() - cacheAt < TTL) return cache
  try {
    const rows = await db.select('travel_requirement_rules',
      'select=destination,nationality,auth_type,note,active&order=destination.asc,nationality.asc')
    cache = Array.isArray(rows) && rows.length ? rows : BUILTIN_RULES
  } catch {
    cache = BUILTIN_RULES
  }
  cacheAt = Date.now()
  return cache
}

export function clearTravelRulesCache() { cache = null; cacheAt = 0 }
