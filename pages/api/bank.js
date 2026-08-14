// Bank reconciliation — statement uploads in, human-confirmed matches out.
//
// The rule this route exists to enforce (docs/OPEN-BANKING.md): a bank feed is
// a reconciliation source, not a posting source. Uploads land raw in
// bank_transactions, the matcher PROPOSES, and nothing reaches the ledger
// until a person picks a customer and clicks confirm. shouldAutoPost() in
// lib/bankMatch.mjs returning false is the same rule stated as code.
//
// Owner-only, both verbs. Until the shop has its own business account a
// statement necessarily carries personal movements (same reasoning as the
// table's RLS policy), and confirming writes money onto customer wallets.
//
// Undo is correction-forward: the ledger is append-only, so undoing a
// confirmed match posts an equal-and-opposite adjustment and reopens the bank
// row. Both entries stay visible on the customer's statement — that is the
// cost of a wrong confirm, and the reason confirm asks first.

import { withStaff, requireOwner } from '../../lib/auth.js'
import { db, tablesMode, selectAllPaged, STORAGE_ERROR } from '../../lib/db.js'
import { parseStatementCsv } from '../../lib/bankCsv.mjs'
import { proposeMatches } from '../../lib/bankMatch.mjs'
import { buildCandidates } from '../../lib/bankCandidates.mjs'
import { importableCharges } from '../../lib/stripeReconcile.mjs'
import { stripeEnabled, listCharges } from '../../lib/stripe.js'

// Same idempotency-token shape the rest of the app uses (kcRef()).
const validRef = (v) => (typeof v === 'string' && /^[\w-]{8,64}$/.test(v)) ? v : null
// An account label is a human word ("Revolut main", "Savings"), not free HTML.
const validLabel = (v) => {
  const s = String(v || '').trim().replace(/\s+/g, ' ')
  return /^[\w][\w .&'()-]{1,39}$/.test(s) ? s : null
}

// Bound the proposal work: score only this many un-triaged rows per GET.
const PROPOSE_CAP = 200
// One Stripe pull walks at most this many charges (5 pages of 100). The shop's
// whole history is under 300, so this reaches the beginning in one press and
// still cannot become an unbounded loop against someone else's API.
const STRIPE_PAGE_CAP = 5
// Same single-entry ceiling as every other money-in path.
const MAX_CONFIRM = 5000

async function loadCandidates() {
  const [customers, balances, bookings] = await Promise.all([
    selectAllPaged('customers', 'id,legacy_id,first_name,last_name,email_normalized,email_raw', 'order=id.asc'),
    db.select('customer_balances', 'select=customer_id,balance&balance=neq.0&limit=1000'),
    db.select('bookings', 'select=customer_id,booking_reference,travel_date&order=created_at.desc&limit=500'),
  ])
  return buildCandidates({ customers, balances, bookings })
}

const toAppTxn = (r) => ({
  id: r.id,
  accountRef: r.account_ref,
  provider: r.provider,
  bookedAt: String(r.booked_at || '').slice(0, 10),
  amount: Number(r.amount),
  currency: r.currency,
  description: r.description || '',
  counterparty: r.counterparty_name || '',
  state: r.match_state,
  note: r.note || '',
  matchedLedgerId: r.matched_ledger_id || null,
  matchedAt: r.matched_at || null,
})

async function handler(req, res) {
  if (!tablesMode) {
    return res.status(503).json({ success: false, error: 'Bank reconciliation needs the relational data layer.' })
  }
  if (requireOwner(req, res)) return

  try {
    if (req.method === 'GET') {
      const rows = await db.select('bank_transactions', 'select=*&order=booked_at.desc,created_at.desc&limit=1000')

      const counts = { unmatched: 0, proposed: 0, confirmed: 0, ignored: 0 }
      const accounts = new Map()
      for (const r of rows) {
        counts[r.match_state] = (counts[r.match_state] || 0) + 1
        const a = accounts.get(r.account_ref) || { ref: r.account_ref, count: 0, open: 0, latest: null }
        a.count++
        if (r.match_state === 'unmatched' || r.match_state === 'proposed') a.open++
        const day = String(r.booked_at || '').slice(0, 10)
        if (!a.latest || day > a.latest) a.latest = day
        accounts.set(r.account_ref, a)
      }

      // Propose for the open rows only, newest first, bounded. The matcher
      // returns its reasons so the screen can say WHY — a proposal without a
      // why is just a button someone will click.
      const open = rows.filter((r) => r.match_state === 'unmatched' || r.match_state === 'proposed')
      const candidates = open.length ? await loadCandidates() : []
      const proposals = new Map()
      for (const r of open.slice(0, PROPOSE_CAP)) {
        const p = proposeMatches(
          { amount: Number(r.amount), bookedAt: String(r.booked_at || '').slice(0, 10), description: r.description, counterpartyName: r.counterparty_name, email: r.raw?.email || null },
          candidates, { limit: 3 }
        )
        proposals.set(r.id, {
          ambiguous: p.ambiguous,
          proposals: p.proposals.map((s) => ({
            customerId: s.candidate.customerId,
            customerUuid: s.candidate.customerUuid,
            name: s.candidate.name,
            confidence: s.confidence,
            reasons: s.reasons,
          })),
        })
      }

      // The customer list for the manual picker (id + name only).
      const candidateIndex = (candidates.length ? candidates : await loadCandidates())
        .map((c) => ({ customerId: c.customerId, customerUuid: c.customerUuid, name: c.name }))

      return res.json({
        success: true,
        transactions: rows.map((r) => ({ ...toAppTxn(r), match: proposals.get(r.id) || null })),
        accounts: [...accounts.values()].sort((a, b) => a.ref.localeCompare(b.ref)),
        counts,
        customers: candidateIndex,
        proposeCapped: open.length > PROPOSE_CAP ? open.length - PROPOSE_CAP : 0,
      })
    }

    if (req.method === 'POST') {
      const b = req.body || {}

      if (b.op === 'upload') {
        const label = validLabel(b.accountLabel)
        if (!label) return res.status(400).json({ success: false, error: 'Give the account a short label (letters and numbers), e.g. "Revolut main".' })
        const csv = String(b.csv || '')
        if (!csv.trim()) return res.status(400).json({ success: false, error: 'The file is empty.' })
        if (csv.length > 2_000_000) return res.status(400).json({ success: false, error: 'That file is over 2 MB — export a shorter window.' })

        const { rows, warnings } = parseStatementCsv(csv, { accountRef: label })
        if (!rows.length) {
          return res.status(400).json({ success: false, error: warnings[0] || 'Nothing readable in that file.', warnings })
        }
        const inserted = await db.insertIgnoreDup('bank_transactions', rows.map((r) => ({
          provider: r.provider,
          provider_txn_id: r.providerTxnId,
          account_ref: r.accountRef,
          booked_at: r.bookedAt,
          amount: r.amount,
          currency: r.currency,
          description: r.description,
          counterparty_name: r.counterpartyName,
          raw: r.raw,
        })), 'provider,provider_txn_id')
        return res.json({
          success: true,
          parsed: rows.length,
          inserted: inserted.length,
          duplicates: rows.length - inserted.length,   // overlap with an earlier upload — absorbed, by design
          warnings,
        })
      }

      // Pull settled card payments out of Stripe and into the triage queue.
      //
      // This does not post anything. Stripe is a reconciliation source exactly
      // as a bank feed is: it knows £45 arrived on a Tuesday under whatever
      // name the payer typed into a hosted checkout, and nothing about which
      // customer that is. The rows land 'unmatched' and a person decides, which
      // is the same rule the whole table exists to enforce.
      //
      // Safe to press repeatedly: unique(provider, provider_txn_id) absorbs
      // charges already pulled, and anything the webhook already posted is
      // filtered out by its ledger reference before it is even offered.
      if (b.op === 'import-stripe') {
        if (!stripeEnabled) return res.status(503).json({ success: false, error: 'Stripe isn’t switched on yet.' })
        const refRows = await selectAllPaged('ledger', 'charge_reference', 'charge_reference=like.STRIPE-*&order=charge_reference.asc')
        const ledgerRefs = new Set(refRows.map((r) => r.charge_reference))

        const charges = []
        let after = null
        try {
          for (let page = 0; page < STRIPE_PAGE_CAP; page++) {
            const { charges: batch, hasMore } = await listCharges({ limit: 100, startingAfter: after })
            charges.push(...batch)
            if (!hasMore || !batch.length) break
            after = batch[batch.length - 1].id
          }
        } catch (e) {
          console.error('[api/bank] stripe pull', e.message)
          // A restricted key without the Charges permission is the likely
          // cause, and it is fixable in the Stripe dashboard — say so rather
          // than reporting a storage fault.
          return res.status(502).json({
            success: false,
            error: /permission|scope|restricted/i.test(String(e.message))
              ? 'Stripe refused to list charges — the restricted key needs read access to Charges.'
              : 'Could not reach Stripe.',
          })
        }

        const { rows, skipped } = importableCharges(charges, ledgerRefs)
        const inserted = rows.length ? await db.insertIgnoreDup('bank_transactions', rows.map((r) => ({
          provider: r.provider,
          provider_txn_id: r.providerTxnId,
          account_ref: r.accountRef,
          booked_at: r.bookedAt,
          amount: r.amount,
          currency: r.currency,
          description: r.description,
          counterparty_name: r.counterpartyName,
          raw: r.raw,
        })), 'provider,provider_txn_id') : []

        return res.json({
          success: true,
          scanned: charges.length,
          importable: rows.length,
          inserted: inserted.length,
          alreadyHere: rows.length - inserted.length,   // pulled by an earlier press
          skipped,
        })
      }

      if (b.op === 'confirm') {
        const token = validRef(b.clientRef)
        if (!token) return res.status(400).json({ success: false, error: 'Missing idempotency token — refresh and try again.' })
        const txnRows = await db.select('bank_transactions', `id=eq.${encodeURIComponent(String(b.txnId))}&limit=1`)
        const txn = txnRows[0]
        if (!txn) return res.status(404).json({ success: false, error: 'That transaction is gone — refresh.' })
        if (txn.match_state === 'confirmed') return res.status(409).json({ success: false, error: 'Already confirmed — refresh to see it.' })
        const amount = Number(txn.amount)
        // v1 confirms money IN as a customer payment. Money out is tracked and
        // ignorable, but posting outbound legs (refund payouts) stays manual —
        // an outbound bank row could be rent as easily as a refund.
        if (!(amount > 0)) return res.status(400).json({ success: false, error: 'Only money coming IN can be confirmed as a customer payment.' })
        if (amount > MAX_CONFIRM) return res.status(400).json({ success: false, error: `Entries are capped at £${MAX_CONFIRM} — record this one from the customer card in parts.` })

        const cust = await db.select('customers', `select=id,legacy_id,first_name,last_name&legacy_id=eq.${encodeURIComponent(String(b.customerId))}&limit=1`)
        if (!cust.length) return res.status(400).json({ success: false, error: `Customer ${b.customerId} not found.` })

        // A Stripe row is a card payment, and it posts under the reference the
        // WEBHOOK would have used (STRIPE-<payment intent>), not this request's
        // token. That is deliberate: it makes the charge itself the unit of
        // idempotency, so if the webhook ever delivers the same payment later —
        // a replay, a re-subscribed endpoint — insertIgnoreDup sees the
        // reference and the money cannot land on the wallet twice.
        const isStripe = txn.provider === 'stripe'
        const stripeRef = isStripe ? String(txn.raw?.ledger_reference || '') : ''
        const reference = /^STRIPE-.+/.test(stripeRef) ? stripeRef : `BANK-${token}`
        const desc = [isStripe ? 'Card payment via Stripe' : 'Bank', txn.account_ref,
          txn.counterparty_name || txn.description || null]
          .filter(Boolean).join(' · ').slice(0, 200)
        const inserted = await db.insertIgnoreDup('ledger', [{
          customer_id: cust[0].id,
          charge_reference: reference,
          entry_type: 'payment',
          amount,
          method: isStripe ? 'card' : 'bank_transfer',
          description: desc,
          created_by: req.staff?.id || null,
        }], 'charge_reference')
        const mintedHere = !!(inserted && inserted.length)
        let entry = inserted && inserted[0]
        if (!entry) {
          // Look up the reference we actually posted under — for a Stripe row
          // that is the charge's, not this request's token.
          const existing = await db.select('ledger', `charge_reference=eq.${encodeURIComponent(reference)}&limit=1`)
          entry = existing[0]
        }
        if (!entry) return res.status(500).json({ success: false, error: STORAGE_ERROR })
        // The charge's reference was already on the ledger against SOMEONE
        // ELSE. Only reachable on a Stripe row whose webhook landed between the
        // import and this press: the money is on that customer's wallet and
        // nothing here has changed it, but confirming would mark this row as
        // belonging to the person the operator picked, which is now a lie. Say
        // what happened instead of quietly claiming it.
        if (!mintedHere && String(entry.customer_id) !== String(cust[0].id)) {
          return res.status(409).json({
            success: false,
            error: 'That payment reached the wallet already, under a different customer — refresh and check before matching it again. Nothing was double-counted.',
          })
        }

        // Claim the bank row — guarded so a double-submit can't re-point it.
        const updated = await db.update('bank_transactions',
          `id=eq.${encodeURIComponent(txn.id)}&match_state=neq.confirmed`, {
            match_state: 'confirmed',
            matched_ledger_id: entry.id,
            matched_by: req.staff?.id || null,
            matched_at: new Date().toISOString(),
            note: b.note ? String(b.note).slice(0, 300) : null,
          })
        if (!updated.length) {
          // The row is already confirmed. Two very different ways to get here:
          // a RETRY of this same request (row points at OUR entry — answer
          // success again, nothing to fix), or a genuine race with a different
          // confirm — then the entry minted here must not stand, and only an
          // entry minted HERE may be reversed (reversing on a retry, where the
          // insert was a dedup no-op, would undo the original confirm).
          const fresh = await db.select('bank_transactions', `id=eq.${encodeURIComponent(txn.id)}&limit=1`)
          if (fresh[0] && fresh[0].matched_ledger_id === entry.id) {
            return res.json({ success: true, txn: toAppTxn(fresh[0]) })
          }
          if (mintedHere) {
            await db.insertIgnoreDup('ledger', [{
              customer_id: cust[0].id,
              charge_reference: `BANKUNDO-${token}`,
              entry_type: 'manual_adjustment',
              amount: -amount,
              method: null,
              description: `Reversal — bank row was confirmed twice (${desc})`.slice(0, 200),
              created_by: req.staff?.id || null,
            }], 'charge_reference')
          }
          return res.status(409).json({ success: false, error: 'Someone confirmed that row first — refresh. Nothing was double-counted.' })
        }
        return res.json({ success: true, txn: toAppTxn(updated[0]) })
      }

      if (b.op === 'ignore' || b.op === 'reopen') {
        const wanted = b.op === 'ignore' ? 'ignored' : 'unmatched'
        const updated = await db.update('bank_transactions',
          `id=eq.${encodeURIComponent(String(b.txnId))}&match_state=neq.confirmed`, {
            match_state: wanted,
            note: b.note ? String(b.note).slice(0, 300) : null,
          })
        if (!updated.length) return res.status(409).json({ success: false, error: 'That row is confirmed — undo the match first.' })
        return res.json({ success: true, txn: toAppTxn(updated[0]) })
      }

      if (b.op === 'undo') {
        const token = validRef(b.clientRef)
        if (!token) return res.status(400).json({ success: false, error: 'Missing idempotency token — refresh and try again.' })
        const txnRows = await db.select('bank_transactions', `id=eq.${encodeURIComponent(String(b.txnId))}&limit=1`)
        const txn = txnRows[0]
        if (!txn) return res.status(404).json({ success: false, error: 'That transaction is gone — refresh.' })
        if (txn.match_state !== 'confirmed' || !txn.matched_ledger_id) {
          return res.status(400).json({ success: false, error: 'Nothing to undo — that row is not confirmed.' })
        }
        const entryRows = await db.select('ledger', `id=eq.${encodeURIComponent(txn.matched_ledger_id)}&limit=1`)
        const entry = entryRows[0]
        if (!entry) return res.status(500).json({ success: false, error: 'The matched ledger entry is missing — check the ledger before retrying.' })

        // Append-only ledger: undo = post the opposite, then reopen the row.
        await db.insertIgnoreDup('ledger', [{
          customer_id: entry.customer_id,
          charge_reference: `BANKUNDO-${token}`,
          entry_type: 'manual_adjustment',
          amount: -Number(entry.amount),
          method: null,
          description: `Undo bank match — ${entry.description || entry.charge_reference}`.slice(0, 200),
          created_by: req.staff?.id || null,
        }], 'charge_reference')
        const updated = await db.update('bank_transactions',
          `id=eq.${encodeURIComponent(txn.id)}&match_state=eq.confirmed`, {
            match_state: 'unmatched',
            matched_ledger_id: null,
            matched_by: null,
            matched_at: null,
            note: b.note ? String(b.note).slice(0, 300) : null,
          })
        if (!updated.length) return res.status(409).json({ success: false, error: 'That row changed underneath you — refresh.' })
        return res.json({ success: true, txn: toAppTxn(updated[0]) })
      }

      return res.status(400).json({ success: false, error: 'op must be upload, confirm, ignore, reopen or undo.' })
    }

    return res.status(405).end()
  } catch (e) {
    console.error('[api/bank]', e)
    if (/relation "bank_transactions" does not exist|42P01/.test(String(e.message))) {
      return res.status(503).json({ success: false, error: 'The bank_transactions table is not set up yet — apply the 20260731180000_bank_transactions migration first.' })
    }
    return res.status(500).json({ success: false, error: STORAGE_ERROR })
  }
}

export default withStaff(handler)
