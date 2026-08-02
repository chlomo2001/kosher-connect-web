# Wizz refund reconcile — 2 Aug 2026

Closes the accounting question left open by `docs/BOOKINGS-DIG-2026-07-31.md`:
per-booking refund amounts are now on the ledger for every booking where the
evidence exists. Evidence = the owner's four screenshots of `ch7023518@gmail.com`
(2 Aug) plus the five screenshots already cited in the dig doc.

**Written to Kc-Live** (`xsrtdwwzxdmnjdtjcdzd`) under the standing approval of
28 Jul. Snapshot first, per the standing rule.

- Snapshot: `zz_snapshot_ledger_wizz_20260802` — 14 pre-state rows for the 7
  touched bookings.
- Inserted: **ledger ids 139–148** (10 entries). The ledger is append-only, so
  undo = owner-approved delete of exactly those ids; nothing was updated.
- No bank details are recorded here or in the ledger descriptions — deliberately.

## Position after the write

| Ref | Passenger | Paid KC | Wizz refunded | Passed on? | Ledger net | State |
|---|---|---|---|---|---|---|
| BNKYRW | Yocheved Kopilowitz | £495 | £285 | yes, 30 Jul ("Refund sent £285") | £0 | (a) settled, both legs |
| VU792E | Shimon Adler | £140 | £140 credited* | yes, at counter | £0 | (a) settled, both legs |
| TLKCQC | Abraham Diamant | — (balance £130 due) | £205 to KC | n/a — customer paid the £130, confirmed 30 Jul | £0 | settled |
| EHC93Y | Hershy Tager | £520 | **£320** | **no — awaiting instructions** | **+£320** | (b) KC holds it |
| TMZZXC | Osher Lemberger | £185 | **£95** | **no — account supplied 30 Jul, transfer unconfirmed** | **+£95** | (b) KC holds it |
| MN8VSZ | Moshe Amrom Lebrecht | £175 | **£90** | **no — awaiting instructions** | **+£90** | (b) KC holds it |
| FMLJ8J | Yisrael Schwartz | sheet says unpaid† | **£45** | **no — awaiting instructions** | **+£45** | (b) KC holds it |

\* VU792E: the customer-side truth (140 in credit, £140 handed over at the
counter) is what the ledger models; the Wizz-side amount was never seen and is
marked unverified in the entry description.

† FMLJ8J discrepancy, flagged: the flights sheet marks the customer unpaid
(which is why the 30 Jul reconcile reversed the charge), yet Shloime's 29 Jul
mail explicitly offers the £45 refund *to the customer*. The business's own
promise is what the ledger now reflects. If the customer in fact never paid
anything, the £45 should be reclassified — Shloime is the one who can say.

**Live liability now on the books: £550** (Tager £320 + Lemberger £95 +
Lebrecht £90 + Schwartz £45). Until today the app reported all of these as
settled at £0.

## Untouched — no refund evidence yet (state (c): claim on Wizz, no debt)

IMPKJZ (£410), IJEVNV (£380), UGSJJB (£140), DSCUFH (£235 paid part),
HWGC5D × 2 (Katz reversed-unpaid, Merlin £145), XU2WWH × 3 (Rothschild £360,
Myer Koppenheim £145, Boruch Tzvi Koppenheim reversed-unpaid). Nothing posted —
posting a guessed refund would be invention. The amounts, when Wizz pays, will
be in the same place the others were: `in:sent (refunded OR "received a
refund")` in ch7023518.

**XU2WWH sheet mystery — resolved.** The dig doc suspected a wrong reference on
one of the sheet's two XU2WWH rows. The app in fact holds **three** XU2WWH
bookings (Rothschild £360, two Koppenheims £145 each); the sheet's two rows are
Rothschild + the *paid* Koppenheim (Myer), and the third (Boruch Tzvi) was
reversed as unpaid on 30 Jul. One reference, one family/group booking, three
passengers — no wrong ref, no missing booking.

## Open items (mailbox-only — the app cannot see these)

1. **An unidentified cancelled booking is not in the app at all.** Screenshot 1
   (2 Aug): itinerary W9 5301 LTN→TLV dep 04/08/2026, return 17/08; Wizz
   refunded £205; customer owed a £130 balance and emailed a TSB transfer
   confirmation **today, 2 Aug 14:24**. No booking with that travel date exists
   in the app (the 03–05 Aug range is empty). The amounts mirror TLKCQC but the
   itinerary does not — it is a different booking, living only in the mailbox.
   Needs: the booking reference from that thread, then a booking record + the
   same entry pattern as TLKCQC.
2. **"What about for Sara Rptman?"** (Shloime, 30 Jul, TLKCQC thread) — no
   passenger or customer matching any spelling of that name exists in the app.
   Another mailbox-only person, presumably owing or owed on some booking.
3. **TMZZXC payout** — the customer supplied her account on 30 Jul; no "sent"
   confirmation is visible. Either the transfer happened off-thread (then post
   the `refund_payout` leg) or it is still owed after 3 days.
4. **Three customers have never answered "how do you want your refund"** —
   Tager (£320, asked 29 Jul), Lebrecht (£90, asked 29 Jul), Schwartz (£45,
   asked 29 Jul). Money sitting in KC's hands, aging.

## What "done" looks like from here

Each remaining (c) booking gets its `refund` entry when Wizz's money is seen;
each (b) booking gets its `refund_payout` when the transfer is confirmed. All
entry references follow `WIZZ-REFUND[-PAYOUT]-<booking uuid>` /
`WIZZ-BALANCE-<uuid>`, so re-running this reconcile is idempotent — the unique
`charge_reference` constraint rejects a duplicate leg by construction.
