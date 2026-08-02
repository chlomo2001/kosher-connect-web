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

## Corrections, same day (owner supplied the sheet screenshot)

Two "mailbox-only" claims above were **my search errors, both found in the app**:

1. **The 04/08 booking is `VU15UH` — Perel Ettel Pruzansky** (sheet row 29;
   same £245+£90 shape as TLKCQC, which is why the amounts mirrored). My
   travel-date query missed it because the import used placeholder dates.
   In the app as charge −335 / reversal +335; **ledger id 149 posted**
   (snapshot `zz_snapshot_ledger_wizz_20260802b` first): reinstate −£130 per
   the cancellation notice. The customer emailed a TSB transfer confirmation
   2 Aug 14:24; the **payment leg is deliberately unposted** until Shloime
   confirms receipt — one word and it goes on.
2. **"Sara Rptman" is Sara Rothman — `SW9PXJ`** (sheet row 27, £130+£45,
   cancelled). My name-regex didn't tolerate the "th". In the app as
   charge −175 / reversal +175 (unpaid). Her refund amount / balance is not
   in evidence yet — on the Gmail search list.

## Open items

1. **VU15UH payment leg** — £130, TSB proof sent 2 Aug, awaiting Shloime's
   "received".
2. **TMZZXC payout** — the customer supplied her account on 30 Jul; no "sent"
   confirmation is visible. Either the transfer happened off-thread (then post
   the `refund_payout` leg) or it is still owed after 3 days.
3. **Three customers have never answered "how do you want your refund"** —
   Tager (£320, asked 29 Jul), Lebrecht (£90, asked 29 Jul), Schwartz (£45,
   asked 29 Jul). Money sitting in KC's hands, aging.
4. **Sheet `New Balance` hints, unposted** — SPSHHD (Rotter) £160, SLW7XC
   (Lieber £65, Zieg £65). These look like TLKCQC/VU15UH-pattern balances
   after a Wizz refund, but the NB column is Shloime's recomputation, not
   evidence of the refund itself — awaiting the refund emails before posting.
5. ~~SLW7XC import defect~~ — **not a defect.** Checked 2 Aug: the app only
   ever billed the £45 fee per passenger (charges 55/56, 13 Jul), reversed as
   cancelled-unpaid on 30 Jul (ids 133/134), and the booking notes already
   flag the discrepancy: *"sheet shows £100 ticket + new balance £65 —
   confirm."* The in-app position (£0 both ways) is internally consistent;
   whether the £100 fares and the £65 balances are real debts is the same
   evidence question as item 4 — it rides on the Gmail search.
6. ~~USSGPK import gap~~ — **not a gap.** The booking was created *by* the
   30 Jul reconcile itself with the note *"cancelled before billing; no
   charge posted."* Zero ledger rows is the correct position for a booking
   that was never billed. Nothing to fix unless the mailbox shows Padwa
   actually paid.

## Round 2 — 2 Aug evening (owner ran the Gmail searches)

The owner ran the four search strings in `ch7023518` and sent five screenshots.
Snapshot `zz_snapshot_ledger_wizz_20260802c` (8 rows), then **ledger ids
150–153** posted — all TLKCQC-pattern balance reinstatements on
cancelled-unpaid bookings, each quoting Shloime's own 29 Jul email:

| Ref | Customer | Wizz refunded | Balance owed to KC | Ledger id |
|---|---|---|---|---|
| SPSHHD | Menachem Rotter | £250 | **£160** | 150 |
| SLW7XC | Mechel Lieber | £80 | **£65** | 151 |
| SLW7XC | Shulem Zieg | £80 | **£65** | 152 |
| SW9PXJ | Sara Rothman | £90 | **£85** | 153 |

SW9PXJ's evidence sat in a thread mislabelled TLKCQC; the £175−£90=£85 shape
fits only her booking, and the same correspondent asked "What about Sara
Rptman" in that thread. SLW7XC's £100 fares were confirmed verbatim
("£100 for the ticket and £45 for the service"), so both bookings' prices
were corrected £0 → £100 (open item 5 now fully closed).

Also settled by the searches:

- **TMZZXC payout (open item 2): confirmed still owed.** The 30 Jul thread
  still asks "how and where you want the refund", and the owner's
  `refund sent` search for Lemberger returned nothing. The £95 stays a live
  liability — correctly.
- **OKQKKS / ZMKWJP (Leifer, both in app).** OKQKKS is *not* cancelled
  (sheet "No", app Booked, £770 charge standing unpaid — consistent).
  Shloime's 29 Jul mail demands **£980** "(WizzAir refund for cancelled
  tickets)": £770 + ZMKWJP's £395 − an implied **£185** Wizz refund on
  ZMKWJP fits exactly, but the £185 is inferred, not seen — nothing posted.
- **LPJW7Q (Mordechai Menachem Grin)** — in app, Booked, £750 unpaid,
  matches the sheet. Nothing to do.

**New open items from round 2:**

7. **An unidentified "£170 refunded" sent mail (29 Jul)** — "Wizzair tickets
   have been cancelled; Wizzair has refunded £170", plural tickets, no ref in
   the snippet. Could be one of the six still-unposted paid bookings. Owner
   to open that thread and read the ref.
8. **OKQKKS thread breakdown** — confirm ZMKWJP's Wizz refund figure (£185
   implied) before reinstating Leifer's balance.
9. **The six paid bookings (IMPKJZ, IJEVNV, UGSJJB, DSCUFH, HWGC5D, XU2WWH)
   show no refund emails at all** — consistent with Ruchi's 26 Jul note
   ("received refunds for 70% of the customers… check each customer
   manually"). They stay state (c) except whichever turns out to be the £170.

Position after round 2: KC's liability to customers unchanged at **£550**
(+ VU15UH's £130 pending Shloime's "received"); customers now visibly owe KC
**£375** across SPSHHD/SLW7XC/SW9PXJ (+ £130 VU15UH).

## What "done" looks like from here

Each remaining (c) booking gets its `refund` entry when Wizz's money is seen;
each (b) booking gets its `refund_payout` when the transfer is confirmed. All
entry references follow `WIZZ-REFUND[-PAYOUT]-<booking uuid>` /
`WIZZ-BALANCE-<uuid>`, so re-running this reconcile is idempotent — the unique
`charge_reference` constraint rejects a duplicate leg by construction.
