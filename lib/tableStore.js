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

import { db, selectAllPaged } from './db.js'
import {
  capName,
  customerToRow,
  customerRowFromTyped,
  customerDrift,
  phoneToRow,
  rentalToRow,
  rentalItemRows,
  simToRow,
  rowToApp,
} from './mappers.js'
import { gateFor, gateSummary } from './chargeGate.mjs'
import { londonDate } from './localDay.mjs'

const enc = encodeURIComponent

// ---------- generic helpers ----------

async function listApp(table, orderCol = 'created_at') {
  // Paged: sims is at 840 rows — an unpaged read would silently hide row #1001.
  const rows = await selectAllPaged(
    table,
    'legacy_extras',
    `legacy_id=not.is.null&order=${orderCol}.asc`
  )
  // #40 — a row with a null blob would vanish from the app silently. Drop it
  // (there's no app shape to show) but never quietly: log so it's detectable.
  const nullBlobs = rows.filter((r) => !r.legacy_extras).length
  if (nullBlobs) console.warn(`[${table}] ${nullBlobs} row(s) have null legacy_extras and were skipped`)
  return rows.map(rowToApp).filter(Boolean)
}

async function legacyIdMap(table) {
  // Paged: a truncated map makes syncSims/syncRentals skip rows as
  // "customer not synced" — edits would silently stop persisting past the cap.
  const rows = await selectAllPaged(table, 'id,legacy_id', 'legacy_id=not.is.null&order=id.asc')
  const map = new Map()
  for (const r of rows) map.set(String(r.legacy_id), r.id)
  return map
}

// Delete BY INTENT, not by absence. The old model deleted every row whose
// legacy_id was missing from the payload, so a stale or partial in-memory
// array (a failed reload, a second tab, an automation sweep racing the
// operator) silently wiped good records. Now the client sends the exact ids
// it deleted; a normal add/edit save (deletedIds empty) removes nothing.
async function deleteByIds(table, deletedIds) {
  const ids = [...new Set((deletedIds || []).map(String))].filter(Boolean)
  // #72 — one statement instead of N (was a DELETE per id).
  if (ids.length) await db.delete(table, `legacy_id=in.(${ids.map(enc).join(',')})`)
  return ids.length
}

// ---------- customers (per-record semantics) ----------

// #19 — customers now read from the TYPED columns (via customerRowFromTyped),
// with app-only fields merged from legacy_extras. The typed projection is no
// longer a write-only dead shadow. Any drift between the two is logged, not
// silently tolerated, so rot is detectable.
export async function listCustomers() {
  // Paged: 788 customers today — the 1000-row cap is one busy season away.
  const rows = await selectAllPaged(
    'customers',
    'legacy_id,first_name,last_name,phone_country_code,phone_number,has_whatsapp,' +
      'email_raw,email_normalized,address,passport_on_file,notes,created_at,legacy_extras',
    'legacy_id=not.is.null&order=created_at.asc'
  )
  const out = []
  let drifted = 0
  for (const row of rows) {
    if (!row.legacy_extras) { console.warn('[customers] row with null legacy_extras skipped'); continue }
    if (customerDrift(row).length) drifted++
    out.push(customerRowFromTyped(row))
  }
  if (drifted) console.warn(`[customers] ${drifted} row(s) show typed/legacy_extras drift — see customerDrift`)
  return out
}

// Read ONE customer by legacy id — the PUT path used to load all 788 rows
// (every legacy_extras blob included) just to find the record it was editing,
// and would 404 on any customer past the 1000-row cap.
export async function getCustomer(legacyId) {
  const rows = await db.select(
    'customers',
    'select=legacy_id,first_name,last_name,phone_country_code,phone_number,has_whatsapp,' +
      'email_raw,email_normalized,address,passport_on_file,notes,created_at,legacy_extras' +
      `&legacy_id=eq.${enc(String(legacyId))}`
  )
  if (!rows.length || !rows[0].legacy_extras) return null
  return customerRowFromTyped(rows[0])
}

// Upsert one app-shaped customer. Unique indexes on normalized email / phone
// can collide with a different customer; on conflict we retry without the
// colliding normalized fields (raw values stay in extras — nothing is lost).
export async function upsertCustomer(appCustomer) {
  // Capitalise here rather than in customerToRow: the typed columns and
  // legacy_extras must agree, and lib/mappers' drift check compares the two.
  // Fixing only the column would make every swept customer read as drifted.
  const c = {
    ...appCustomer,
    firstName: capName(appCustomer.firstName),
    // Left alone when absent — capName('') is '', and writing an empty string
    // where the record had nothing would change the shape of legacy_extras.
    ...(appCustomer.lastName ? { lastName: capName(appCustomer.lastName) } : {}),
  }
  const row = customerToRow(c)
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
  // The capitalised object, not the one that came in: the API hands this back
  // to the client, and returning the raw input would leave the form showing a
  // name the database no longer holds.
  return c
}

// Cascade order matters: the front end fire-and-forgets its rentals/sims
// saves, so this route deletes the dependents itself (same semantics the app
// applies to its in-memory arrays).
//
// A customer with ledger history is NOT deletable: the ledger is append-only
// and customer_id has no cascade, by design. The API turns this error into a
// friendly refusal BEFORE anything is touched.
export async function deleteCustomer(legacyId) {
  const rows = await db.select('customers', `select=id&legacy_id=eq.${enc(String(legacyId))}`)
  if (!rows.length) return
  const uuid = rows[0].id
  const money = await db.select('ledger', `select=id&customer_id=eq.${uuid}&limit=1`)
  if (money.length) {
    const err = new Error('This customer has money history in the ledger — deletion is not allowed. You can rename them instead.')
    err.code = 'MONEY_HISTORY'
    throw err
  }
  // EVERY other table still pointing here must be checked BEFORE the first
  // delete. These FKs have no ON DELETE, so a single leftover row (one open
  // auto-task was enough) used to fail the customers delete AFTER the rentals
  // and sims were already destroyed — a partial delete with no undo (sweep
  // 2026-08-02 #15). Refusing up front keeps it all-or-nothing.
  const DEPENDENTS = [
    ['tasks', 'open tasks'],
    ['virtual_numbers', 'virtual numbers'],
    ['repairs', 'repairs'],
    ['bookings', 'flight bookings'],
    ['sold_phones', 'sold phones'],
    ['stock_sales', 'shop sales'],
    ['service_orders', 'service orders'],
  ]
  const blocking = []
  for (const [table, label] of DEPENDENTS) {
    const hit = await db.select(table, `select=id&customer_id=eq.${uuid}&limit=1`)
    if (hit.length) blocking.push(label)
  }
  if (blocking.length) {
    const err = new Error(
      `This customer still has ${blocking.join(', ')} — remove those first, or rename the customer instead.`)
    err.code = 'HAS_RECORDS'
    throw err
  }
  await db.delete('rentals', `customer_id=eq.${uuid}`) // rental_items cascade via FK
  await db.delete('sims', `customer_id=eq.${uuid}`)
  await db.delete('customers', `id=eq.${uuid}`)
}

// ---------- phones → lines (whole-array sync) ----------

export async function listPhones() {
  return listApp('lines')
}

export async function syncPhones(appPhones, deletedIds = []) {
  const rows = appPhones.map(phoneToRow)
  if (rows.length) await db.upsert('lines', rows, 'legacy_id')
  const deleted = await deleteByIds('lines', deletedIds)
  return { synced: rows.length, deleted }
}

// ---------- rentals (whole-array sync + rental_items projection) ----------

export async function listRentals() {
  return listApp('rentals')
}

export async function syncRentals(appRentals, deletedIds = []) {
  const [customerIds, lineIds] = await Promise.all([
    legacyIdMap('customers'),
    legacyIdMap('lines'),
  ])

  // ── Charge Gate (lib/chargeGate.mjs) ──────────────────────────────────
  // A rental may not arrive here CLOSED unless its gate is satisfied. The
  // browser blocks the button, but the browser is not the boundary: this
  // endpoint takes a whole array from a client that could be a stale tab, a
  // replayed request, or a second device that never saw the gate at all.
  //
  // A blocked close is NOT a rejected save. Rejecting the payload would throw
  // away every other edit in it, which is the same reasoning that made the
  // double-booking backstop report rather than refuse (#8). So the close alone
  // is undone — the rental goes back to active or overdue, exactly where it
  // was — and the refusal is reported so the client can say why.
  const today = londonDate()
  const gateRefused = []
  const gated = appRentals.map((r) => {
    if (!r || r.status !== 'returned') return r
    const gate = gateFor(r, { today, verifications: r.gateVerifications || [] })
    if (gate.canClose) return r
    gateRefused.push({ id: r.id, reason: gateSummary(gate) })
    return { ...r, status: r.toDate && r.toDate < today ? 'overdue' : 'active' }
  })
  if (gateRefused.length) console.warn('[rentals] charge gate refused close:', JSON.stringify(gateRefused))

  const rows = []
  const skipped = []
  for (const r of gated) {
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
  for (const r of gated) {
    const rentalUuid = uuidByLegacy.get(String(r.id))
    if (rentalUuid) itemRows.push(...rentalItemRows(r, rentalUuid))
  }
  if (itemRows.length) await db.upsert('rental_items', itemRows, 'rental_id,item')

  // Money: true-up each rental's ledger position (idempotent — safe to run
  // on every whole-array save).
  const ledgerPosted = await trueUpRentalLedger(gated, uuidByLegacy, customerIds)

  // Deletion by intent: only the rentals the client explicitly deleted. A
  // stale/partial payload (or a skipped row) can no longer wipe a rental.
  // Money history survives: reversed to zero before the row is removed.
  const deleted = await deleteRentalsByIds(deletedIds)

  // #8 — server-side double-booking backstop. The browser guards this
  // (phoneConflicts), but two tabs racing can each pass their own check and
  // both write. We detect any overlapping non-returned rentals on the SAME
  // phone in the stored set and surface them as `conflicts` so the client can
  // warn — without rejecting the whole save (which would risk data loss on a
  // legitimate whole-array sync).
  const conflicts = detectRentalOverlaps(gated)
  if (conflicts.length) console.warn('[rentals] double-booking overlaps:', JSON.stringify(conflicts))

  if (skipped.length) console.warn('[rentals] skipped rows:', JSON.stringify(skipped))
  return { synced: rows.length, deleted, skipped, ledgerPosted, conflicts, gateRefused }
}

// Two inclusive date windows overlap when each starts on or before the other
// ends. Returned rentals never block a phone; reservations (booked) do.
function detectRentalOverlaps(appRentals) {
  const live = appRentals.filter(
    (r) => r && r.phoneId && r.fromDate && r.toDate &&
      r.status !== 'returned' && r.status !== 'cancelled'
  )
  const byPhone = new Map()
  for (const r of live) {
    const k = String(r.phoneId)
    if (!byPhone.has(k)) byPhone.set(k, [])
    byPhone.get(k).push(r)
  }
  const conflicts = []
  for (const [phoneId, list] of byPhone) {
    list.sort((a, b) => String(a.fromDate).localeCompare(String(b.fromDate)))
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (list[j].fromDate > list[i].toDate) break // sorted — no later one can overlap i
        if (list[i].fromDate <= list[j].toDate && list[i].toDate >= list[j].fromDate) {
          conflicts.push({
            phoneId,
            a: { id: list[i].id, customer: list[i].customerName, from: list[i].fromDate, to: list[i].toDate },
            b: { id: list[j].id, customer: list[j].customerName, from: list[j].fromDate, to: list[j].toDate },
          })
        }
      }
    }
  }
  return conflicts
}

// ---------- rental money → append-only ledger (step 3 of the port) ----------
//
// Each rental owns a set of deterministic charge references keyed by its
// ROW UUID (a re-created rental gets fresh refs — no cross-generation
// collisions):
//   RENTAL-<uuid>            base charge (−price), entry_type 'rental'
//   RENTAL-ADJ-<uuid>-<n>    price edits, 'rental_adjustment' (either sign)
//   RENTAL-LATE-<uuid>       late fee frozen at return (−), 'rental'
//   RENTAL-LATE-ADJ-<uuid>-<n>
//   RENTAL-LOSS-<uuid>       lost-item charges (−), 'rental_loss'
//   RENTAL-LOSS-ADJ-<uuid>-<n>
//   PAY-RENTAL-<uuid>[-<n>]  payments recorded on the rental (+), 'payment'
//   PAY-RENTAL-ADJ-<uuid>-<n> payment corrections, 'rental_adjustment'
//   RENTAL-REVERSAL-<uuid>   zeroing entry posted when the rental is deleted
//
// Algorithm per bucket: target − already-posted = delta; post the delta (or
// the base entry if nothing is posted yet). Deterministic refs + ON CONFLICT
// DO NOTHING make re-runs and races harmless; a lost race self-heals on the
// next sync. Live (unfrozen) late fees are NOT posted — only the fee frozen
// at return, matching the app's own money display.

const money = (v) => Math.round((Number(v) || 0) * 100) / 100

function bucketTargets(r) {
  const returned = r.status === 'returned'
  const reserved = r.status === 'booked'
  return {
    // Reservations don't charge until pickup (status flips to active); null
    // leaves whatever is already posted untouched.
    charge: reserved ? null : -money(r.price),
    late: returned ? -money(r.lateFee) : null,
    loss: -money(r.lostChargesTotal),
    pay: money(r.amountPaid),
  }
}

async function trueUpRentalLedger(appRentals, uuidByLegacy, customerIds) {
  const relevant = appRentals.filter((r) => uuidByLegacy.has(String(r.id)))
  if (!relevant.length) return 0

  // #72 — scope the read to the rentals actually in this payload, not every
  // rental-linked ledger row ever posted. Cost is now proportional to the
  // save, not to lifetime history.
  const uuids = relevant.map((r) => uuidByLegacy.get(String(r.id))).filter(Boolean)
  if (!uuids.length) return 0
  const postedRows = await db.select(
    'ledger',
    `select=charge_reference,amount,related_rental_id&related_rental_id=in.(${uuids.map(enc).join(',')})`
  )
  const byRental = new Map()
  for (const e of postedRows) {
    if (!byRental.has(e.related_rental_id)) byRental.set(e.related_rental_id, [])
    byRental.get(e.related_rental_id).push(e)
  }

  const inserts = []
  for (const r of relevant) {
    const uuid = uuidByLegacy.get(String(r.id))
    const entries = byRental.get(uuid) || []
    const targets = bucketTargets(r)
    const label = `rental ${r.customerName || ''} ${r.fromDate || ''}→${r.toDate || ''}`.trim()

    const bucket = (baseRef, adjRef, target, baseType, desc, positiveType = null) => {
      if (target === null) return
      const mine = entries.filter(
        (e) => e.charge_reference === baseRef || e.charge_reference.startsWith(`${adjRef}-`)
          || (positiveType && e.charge_reference.startsWith(`${baseRef}-`))
      )
      const posted = money(mine.reduce((s, e) => s + Number(e.amount), 0))
      const delta = money(target - posted)
      if (Math.abs(delta) < 0.005) return
      if (!mine.length) {
        inserts.push({
          customer_id: null, // filled below
          _customerLegacy: r.customerId,
          charge_reference: baseRef,
          entry_type: baseType,
          amount: delta,
          description: desc,
          related_rental_id: uuid,
        })
        return
      }
      // Something already posted → append a delta entry. Payments growing get
      // a 'payment' row (sign +); everything else is a signed adjustment.
      const n = mine.length
      const usePayment = positiveType && delta > 0
      inserts.push({
        customer_id: null,
        _customerLegacy: r.customerId,
        charge_reference: usePayment ? `${baseRef}-${n}` : `${adjRef}-${n}`,
        entry_type: usePayment ? positiveType : 'rental_adjustment',
        amount: delta,
        description: `${desc} (update)`,
        related_rental_id: uuid,
      })
    }

    if (targets.charge < 0 || entries.length) {
      bucket(`RENTAL-${uuid}`, `RENTAL-ADJ-${uuid}`, targets.charge, 'rental', `Rental charge — ${label}`)
    }
    bucket(`RENTAL-LATE-${uuid}`, `RENTAL-LATE-ADJ-${uuid}`, targets.late, 'rental', `Late return fee — ${label}`)
    if (targets.loss < 0 || entries.some((e) => e.charge_reference.startsWith(`RENTAL-LOSS-${uuid}`))) {
      bucket(`RENTAL-LOSS-${uuid}`, `RENTAL-LOSS-ADJ-${uuid}`, targets.loss, 'rental_loss', `Lost items — ${label}`)
    }
    if (targets.pay > 0 || entries.some((e) => e.charge_reference.startsWith(`PAY-RENTAL-${uuid}`))) {
      bucket(`PAY-RENTAL-${uuid}`, `PAY-RENTAL-ADJ-${uuid}`, targets.pay, 'payment', `Rental payment — ${label}`, 'payment')
    }
  }
  if (!inserts.length) return 0

  const ready = inserts
    .map(({ _customerLegacy, ...e }) => ({ ...e, customer_id: customerIds.get(String(_customerLegacy)) }))
    .filter((e) => e.customer_id && Math.abs(e.amount) >= 0.005)
  if (ready.length) await db.insertIgnoreDup('ledger', ready, 'charge_reference')
  return ready.length
}

// Delete rentals BY INTENT (the ids the client actually deleted). Each row's
// ledger position is zeroed first (a reversal entry), then the row is deleted;
// the FK detaches its history (related_rental_id → NULL) so the customer keeps
// every entry. Absent-from-payload rentals are left untouched — see
// deleteByIds for why.
async function deleteRentalsByIds(deletedIds) {
  const ids = [...new Set((deletedIds || []).map(String))].filter(Boolean)
  if (!ids.length) return 0
  // Resolve only the legacy_ids being deleted, not the whole rentals table. audit U6.
  const existing = await db.select('rentals',
    `select=id,legacy_id&legacy_id=in.(${ids.map((id) => enc(id)).join(',')})`)
  const uuidByLegacy = new Map(existing.map((r) => [String(r.legacy_id), r.id]))
  let removed = 0
  for (const legacyId of ids) {
    const uuid = uuidByLegacy.get(String(legacyId))
    if (!uuid) continue // already gone
    const entries = await db.select('ledger', `select=amount,customer_id&related_rental_id=eq.${uuid}`)
    const net = money(entries.reduce((s, e) => s + Number(e.amount), 0))
    if (entries.length && Math.abs(net) >= 0.005) {
      await db.insertIgnoreDup('ledger', [{
        customer_id: entries[0].customer_id,
        charge_reference: `RENTAL-REVERSAL-${uuid}`,
        entry_type: net < 0 ? 'rental_void' : 'rental_adjustment',
        amount: money(-net),
        description: `Rental deleted — ledger position reversed`,
        related_rental_id: uuid,
      }], 'charge_reference')
    }
    // Auto/optional extra charges (and their immediate payments) are keyed
    // EXTRA-…-<rentalLegacyId> / PAY-EXTRA-…-<rentalLegacyId> with NO
    // related_rental_id, so the reversal above misses them — the customer
    // would keep owing an extra for a deleted rental. Net them and reverse.
    const extras = await db.select('ledger',
      `select=charge_reference,amount,customer_id&charge_reference=like.*EXTRA-*-${enc(String(legacyId))}`)
    const mine = extras.filter((e) => {
      const ref = String(e.charge_reference)
      return ref.endsWith(`-${legacyId}`) && (ref.startsWith('EXTRA-') || ref.startsWith('PAY-EXTRA-'))
    })
    const exNet = money(mine.reduce((s, e) => s + Number(e.amount), 0))
    if (mine.length && Math.abs(exNet) >= 0.005) {
      await db.insertIgnoreDup('ledger', [{
        customer_id: mine[0].customer_id,
        charge_reference: `EXTRA-REVERSAL-${uuid}`,
        entry_type: 'rental_adjustment', // either-sign
        amount: money(-exNet),
        description: `Rental deleted — extra charges reversed`,
        related_rental_id: uuid,
      }], 'charge_reference')
    }
    await db.delete('rentals', `id=eq.${uuid}`)
    removed++
  }
  return removed
}

// ---------- sims (whole-array sync) ----------

export async function listSims() {
  return listApp('sims')
}

export async function syncSims(appSims, deletedIds = []) {
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
  const deleted = await deleteByIds('sims', deletedIds)
  if (skipped.length) console.warn('[sims] skipped rows:', JSON.stringify(skipped))
  return { synced: rows.length, deleted, skipped }
}
