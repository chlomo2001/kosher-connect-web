// Table-backed storage for the operator app (transitional data layer).
//
// The front end keeps its existing contract: GET returns the app-shaped
// arrays, whole-array POST replaces the set. Under the hood every save is a
// diff-sync into the relational tables: upsert by legacy_id, delete rows
// whose legacy_id vanished from the payload, and (for rentals) project the
// per-item A-series state into rental_items.
//
// Rows whose foreign refs can't resolve (e.g. a rental pointing at a phone
// that was never synced) are SKIPPED and reported — never silently dropped
// without trace. The app keeps them in memory and re-sends on the next save,
// so a skip is self-healing once the missing parent arrives.

import { db } from './db.js'
import {
  customerToRow,
  phoneToRow,
  rentalToRow,
  rentalItemRows,
  simToRow,
  rowToApp,
} from './mappers.js'

const enc = encodeURIComponent

// ---------- generic helpers ----------

async function listApp(table, orderCol = 'created_at') {
  const rows = await db.select(
    table,
    `select=legacy_extras&legacy_id=not.is.null&order=${orderCol}.asc`
  )
  return rows.map(rowToApp).filter(Boolean)
}

async function legacyIdMap(table) {
  const rows = await db.select(table, 'select=id,legacy_id&legacy_id=not.is.null')
  const map = new Map()
  for (const r of rows) map.set(String(r.legacy_id), r.id)
  return map
}

async function deleteMissing(table, keptLegacyIds) {
  const existing = await db.select(table, 'select=legacy_id&legacy_id=not.is.null')
  const keep = new Set(keptLegacyIds.map(String))
  const gone = existing.map((r) => String(r.legacy_id)).filter((id) => !keep.has(id))
  for (const id of gone) {
    await db.delete(table, `legacy_id=eq.${enc(id)}`)
  }
  return gone.length
}

// ---------- customers (per-record semantics) ----------

export async function listCustomers() {
  return listApp('customers')
}

// Upsert one app-shaped customer. Unique indexes on normalized email / phone
// can collide with a different customer; on conflict we retry without the
// colliding normalized fields (raw values stay in extras — nothing is lost).
export async function upsertCustomer(appCustomer) {
  const row = customerToRow(appCustomer)
  try {
    await db.upsert('customers', [row], 'legacy_id')
  } catch (e) {
    if (!/duplicate key|23505/.test(String(e.message))) throw e
    console.warn(`[customers] unique collision for legacy_id=${row.legacy_id}; retrying without normalized keys`)
    await db.upsert(
      'customers',
      [{ ...row, email_normalized: null, phone_country_code: null, phone_number: null }],
      'legacy_id'
    )
  }
  return appCustomer
}

// Cascade order matters: the front end fire-and-forgets its rentals/sims
// saves, so this route deletes the dependents itself (same semantics the app
// applies to its in-memory arrays).
export async function deleteCustomer(legacyId) {
  const rows = await db.select('customers', `select=id&legacy_id=eq.${enc(String(legacyId))}`)
  if (!rows.length) return
  const uuid = rows[0].id
  await db.delete('rentals', `customer_id=eq.${uuid}`) // rental_items cascade via FK
  await db.delete('sims', `customer_id=eq.${uuid}`)
  await db.delete('customers', `id=eq.${uuid}`)
}

// ---------- phones → lines (whole-array sync) ----------

export async function listPhones() {
  return listApp('lines')
}

export async function syncPhones(appPhones) {
  const rows = appPhones.map(phoneToRow)
  if (rows.length) await db.upsert('lines', rows, 'legacy_id')
  const deleted = await deleteMissing('lines', appPhones.map((p) => p.id))
  return { synced: rows.length, deleted }
}

// ---------- rentals (whole-array sync + rental_items projection) ----------

export async function listRentals() {
  return listApp('rentals')
}

export async function syncRentals(appRentals) {
  const [customerIds, lineIds] = await Promise.all([
    legacyIdMap('customers'),
    legacyIdMap('lines'),
  ])

  const rows = []
  const skipped = []
  for (const r of appRentals) {
    const customerUuid = customerIds.get(String(r.customerId))
    const lineUuid = lineIds.get(String(r.phoneId))
    if (!customerUuid || !lineUuid) {
      skipped.push({ id: r.id, reason: !customerUuid ? `customer ${r.customerId} not synced` : `phone ${r.phoneId} not synced` })
      continue
    }
    rows.push(rentalToRow(r, customerUuid, lineUuid))
  }

  let stored = []
  if (rows.length) stored = await db.upsert('rentals', rows, 'legacy_id')

  // Project per-item state (A-series) into rental_items.
  const uuidByLegacy = new Map(stored.map((row) => [String(row.legacy_id), row.id]))
  const itemRows = []
  for (const r of appRentals) {
    const rentalUuid = uuidByLegacy.get(String(r.id))
    if (rentalUuid) itemRows.push(...rentalItemRows(r, rentalUuid))
  }
  if (itemRows.length) await db.upsert('rental_items', itemRows, 'rental_id,item')

  // Deletion: only remove rentals absent from the payload (skipped ones were
  // IN the payload — keep their previously-synced rows untouched).
  const deleted = await deleteMissing('rentals', appRentals.map((r) => r.id))

  if (skipped.length) console.warn('[rentals] skipped rows:', JSON.stringify(skipped))
  return { synced: rows.length, deleted, skipped }
}

// ---------- sims (whole-array sync) ----------

export async function listSims() {
  return listApp('sims')
}

export async function syncSims(appSims) {
  const customerIds = await legacyIdMap('customers')
  const rows = []
  const skipped = []
  for (const s of appSims) {
    const customerUuid = customerIds.get(String(s.customerId))
    if (!customerUuid) {
      skipped.push({ id: s.id, reason: `customer ${s.customerId} not synced` })
      continue
    }
    rows.push(simToRow(s, customerUuid))
  }
  if (rows.length) await db.upsert('sims', rows, 'legacy_id')
  const deleted = await deleteMissing('sims', appSims.map((s) => s.id))
  if (skipped.length) console.warn('[sims] skipped rows:', JSON.stringify(skipped))
  return { synced: rows.length, deleted, skipped }
}
