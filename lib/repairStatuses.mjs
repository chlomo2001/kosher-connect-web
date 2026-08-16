// The states a repair can be in. Pure — no I/O.
//
// Five of them are SYSTEM statuses and cannot be renamed, removed or reordered,
// because they are not labels — they are wired into behaviour:
//
//   Collected  posts the repair charge to the wallet (REPAIR-<id>, once) and
//              stamps closed_at. Rename it and the till stops charging.
//   Cancelled  closes the job WITHOUT charging.
//   Ready      is what the customer card reads to offer "ready for collection".
//   Open       every repair starts here.
//   In Progress  the default middle state.
//
// Everything else in the app asks "is this repair still open?" by testing that
// the status is NEITHER Collected NOR Cancelled. That negative test is what
// makes owner-added statuses safe: a new "Waiting for part" is automatically an
// open job everywhere — customer badges, the open-repairs count, the dashboard
// — with no code change and no risk to the money path.
//
// So the owner can add, rename, reorder and delete their OWN stages freely, and
// the five that carry meaning stay put. That is the whole design.

export const SYSTEM_STATUSES = ['Open', 'In Progress', 'Ready', 'Collected', 'Cancelled']

// The two that close a job. Everything else — system or custom — is open.
export const CLOSED_STATUSES = ['Collected', 'Cancelled']

export const isOpenStatus = (s) => !!s && !CLOSED_STATUSES.includes(String(s))

/** Does this name collide with a system status? Case/spacing-insensitive. */
export const isSystemStatus = (name) => {
  const k = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ')
  return SYSTEM_STATUSES.some((s) => s.toLowerCase() === k)
}

/**
 * Clean a comma-separated list of owner-added stages.
 *
 * Same sanitising as the provider and void-reason lists: punctuation stripped,
 * 40 characters, de-duplicated. Additionally drops anything that collides with
 * a system status — two "Collected"s in one dropdown, one of which silently
 * does not charge, is the worst outcome available here.
 *
 * Returns { list, warnings } so a rejected entry can be explained rather than
 * vanishing.
 */
export function cleanStages(csv) {
  const seen = new Set()
  const list = []
  const warnings = []
  for (const raw of String(csv || '').split(',')) {
    const name = raw.replace(/[^\w .+\-\/&']/g, '').trim().slice(0, 40).trim()
    if (!name) continue
    if (isSystemStatus(name)) {
      warnings.push(`"${name}" is a built-in status and cannot be added again.`)
      continue
    }
    const k = name.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    list.push(name)
  }
  return { list, warnings }
}

/**
 * The full ordered list a dropdown should show: the owner's stages sit between
 * "In Progress" and "Ready", which is where a real repair actually waits —
 * after someone has looked at it, before it is done.
 */
export function orderedStatuses(customList = []) {
  const custom = (customList || []).filter((s) => s && !isSystemStatus(s))
  return ['Open', 'In Progress', ...custom, 'Ready', 'Collected', 'Cancelled']
}

/** Parse the stored CSV straight into the ordered list. */
export const statusesFromCsv = (csv) =>
  orderedStatuses(String(csv || '').split(',').map((s) => s.trim()).filter(Boolean))
