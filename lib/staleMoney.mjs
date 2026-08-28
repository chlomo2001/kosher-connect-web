// Money already recorded is not overwritten by a browser tab that is behind.
//
// Task #48, and the bug that produced it. A rentals save posts the WHOLE array,
// so a tab left open on a phone at the back of the shop holds a complete copy
// of every rental as it stood when that tab last loaded. Correct a payment at
// the counter, then let the old tab save anything at all — a note, a return, a
// new hire — and its stale amountPaid goes back over the corrected one.
// syncRentals' ledger true-up then does its job faithfully: target minus
// posted, post the difference, and money the shop actually received is reversed
// by a rental_adjustment nobody asked for. Teitelbaum's ledger returned to -£90
// exactly that way, twice, and the second time was after it had been fixed by
// hand.
//
// The guard is deliberately narrow. Three cases, and only the third is wrong:
//
//   · the tab is current, or the rental is new      → save it
//   · the tab is behind but is not touching money   → save it
//   · the tab is behind AND the money differs       → keep what is stored
//
// The middle case carries the weight. On a whole-array save a tab is behind for
// every rental it did not itself just edit, which is nearly all of them;
// refusing those would refuse ordinary work. What is never ordinary is a
// payment moving on a rental whose stored copy has already moved on without
// this tab. That is not a correction — the operator making a correction is
// looking at the current figure — it is an overwrite by something that never
// saw it.
//
// Pure: no database, no clock. The caller reads the stored rows and acts on the
// report; this decides only which rows are suspect and what to put back.

/**
 * The money on a rental, as the ledger true-up will read it.
 *
 * Field by field rather than as a total, because "did the money change" has to
 * be true when a payment moves up and a price moves down by the same amount —
 * a net of zero over two different ledger buckets is two wrong entries, not
 * none.
 */
export const MONEY_FIELDS = ['amountPaid', 'price', 'lateFee', 'lostChargesTotal']

const money = (v) => Math.round((Number(v) || 0) * 100) / 100
const moneyOf = (r) => MONEY_FIELDS.map((k) => money(r && r[k])).join('|')

/**
 * @param appRentals the payload, as the client sent it
 * @param stored     Map<legacyId, { updated_at, extras }> read before any write
 * @returns { guarded, staleMoney } — the payload with stale money put back, and
 *          what was put back, so the client can be told rather than left
 *          holding figures the database does not have.
 */
export function guardStaleMoney(appRentals, stored) {
  const staleMoney = []
  const guarded = (appRentals || []).map((r) => {
    if (!r) return r
    const was = stored && stored.get ? stored.get(String(r.id)) : null
    // No stored row: this rental is being created here, and there is nothing to
    // be behind. No `_rev`: either the rental was made in this tab and never
    // loaded, or the client predates this field — and a payload that has never
    // carried a version cannot be judged by one. Refusing it would stop the
    // shop saving, which is a worse failure than the one being guarded.
    if (!was || !r._rev || !was.updated_at) return r
    // Timestamps compared as strings. Postgres hands them back in ISO-8601 with
    // a fixed offset, which sorts correctly as text, and no parse means no
    // timezone can move one across a boundary on the way.
    if (String(r._rev) >= String(was.updated_at)) return r
    const mine = was.extras || {}
    if (moneyOf(r) === moneyOf(mine)) return r

    staleMoney.push({
      id: r.id,
      sentPaid: money(r.amountPaid), keptPaid: money(mine.amountPaid),
      sentPrice: money(r.price), keptPrice: money(mine.price),
    })
    const kept = { ...r }
    for (const k of MONEY_FIELDS) kept[k] = mine[k]
    // The tender belongs to the payment it describes. Keeping the stored £60
    // while letting this tab's answer decide how it was taken would file the
    // shop's cash as a card payment, and cash-up counts on that answer.
    kept.paymentMethod = mine.paymentMethod === undefined ? null : mine.paymentMethod
    return kept
  })
  return { guarded, staleMoney }
}
