// Parse a whole-array sync POST body into { items, deletedIds }.
//
// Two accepted shapes so old and new clients both work:
//   • a bare array (legacy)         → delete nothing (deletedIds = [])
//   • { items: [...], deletedIds }  → delete BY INTENT: only the ids the
//                                     client actually removed.
// The bare-array path is now the SAFE default: an add/edit save that just
// sends the current array can no longer wipe rows that are merely absent.
export function parseSyncBody(body) {
  if (Array.isArray(body)) return { items: body, deletedIds: [] }
  if (body && typeof body === 'object') {
    const items = Array.isArray(body.items) ? body.items : []
    const deletedIds = Array.isArray(body.deletedIds) ? body.deletedIds : []
    return { items, deletedIds }
  }
  return { items: [], deletedIds: [] }
}
