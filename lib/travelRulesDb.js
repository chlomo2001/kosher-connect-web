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
  let rows
  try {
    rows = await db.select('travel_requirement_rules',
      'select=destination,nationality,auth_type,note,active&order=destination.asc,nationality.asc')
  } catch (e) {
    // The fallback stays — this feature must never hard-fail a booking, and
    // the built-ins are real rules, not an empty answer. Two things change.
    //
    // It says so. A database the app cannot reach is a different event from a
    // table that has not been migrated yet, and both used to pass in complete
    // silence, so the shop could be running on built-in rules instead of the
    // owner's edited ones with nothing anywhere to say why.
    //
    // And it is NOT cached. The old code stamped cacheAt on the way out of the
    // catch, so one failed read pinned the built-ins for a full minute — every
    // booking in that minute checked against rules the owner may have changed,
    // long after the database had come back.
    console.error('[travelRules] could not read the rules, using the built-in defaults:', e)
    return BUILTIN_RULES
  }
  cache = Array.isArray(rows) && rows.length ? rows : BUILTIN_RULES
  cacheAt = Date.now()
  return cache
}

export function clearTravelRulesCache() { cache = null; cacheAt = 0 }
