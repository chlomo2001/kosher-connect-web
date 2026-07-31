# Bookings dig — 31 July 2026

Read-only. Nothing was written to the database.

Two things came out: a £3,190 debt to eleven customers that the app reports as
settled, and three built features that no booking has ever used.

The first started as an ambiguity the owner raised about the word "paid" and was
resolved against the source spreadsheet — the reconcile had read it correctly,
and the real problem sat one column further along.

---

## 1. The cancelled Wizz bookings — RESOLVED, and the app is understating a debt

**Owner, 31 July: "paid" could mean Wizz paid the refund** — not that the
customer paid us. Worth challenging, and now answered from the source.

### The source, and what its columns actually mean

The "flights sheet 30/07" the reconcile read is a Google Sheet, **`Wizz AIr
Tickets`, owned by ch7023518@gmail.com (Shlomo Grinfeld)**, shared with the
owner on 29 July with the note *"Crazy, I need to collect so much money now."*

Its columns settle the ambiguity outright — there is no single "paid" column:

| column | meaning |
|---|---|
| `Ticket price` / `Paid 1?` | the fare, and whether **the customer paid it** |
| `Service fee` / `Paid 2?` | the booking fee, and whether **the customer paid it** |
| `Cancelled` | Wizz cancelled the booking |
| `Refunded?` | whether **Wizz has paid the money back** — a separate column |
| `New Balance` | recomputed balance, populated on only 3 rows |

So the reconcile was right: "paid" meant the customer paid the shop. The proof
it understood the two columns rather than summing blindly is DSCUFH — the
sheet's only split row, `Paid 1? TRUE / Paid 2? FALSE`, which the reconcile
recorded as "ticket £235 paid; £90 fee unpaid — reversed".

### Why the answer still matters: `Refunded?` is FALSE on all eleven

| Ref | Ticket | Fee | Paid 1 | Paid 2 | Paid to us | Refunded? |
|---|---|---|---|---|---|---|
| EHC93Y | £400 | £120 | TRUE | TRUE | £520 | FALSE |
| BNKYRW | £345 | £150 | TRUE | TRUE | £495 | FALSE |
| IMPKJZ | £310 | £100 | TRUE | TRUE | £410 | FALSE |
| IJEVNV | £230 | £150 | TRUE | TRUE | £380 | FALSE |
| XU2WWH | £300 | £60  | TRUE | TRUE | £360 | FALSE |
| DSCUFH | £235 | £90  | TRUE | FALSE| £235 | FALSE |
| TMZZXC | £135 | £50  | TRUE | TRUE | £185 | FALSE |
| MN8VSZ | £130 | £45  | TRUE | TRUE | £175 | FALSE |
| XU2WWH | £100 | £45  | TRUE | TRUE | £145 | FALSE |
| HWGC5D | £100 | £45  | TRUE | TRUE | £145 | FALSE |
| UGSJJB | £95  | £45  | TRUE | TRUE | £140 | FALSE |
| | | | | **£3,190** | |

**£3,190 — exactly the ledger's payment total for these eleven.** Sheet and app
agree to the penny, which is the strongest evidence the import was faithful.

The one row in the whole sheet with `Refunded? TRUE` is VU792E (£100 + £40) —
and that is precisely the booking our notes call "paid £140 — refunded at
counter". The two sources agree there too.

### The defect

Eleven cancelled flights. £3,190 of customer money held. Wizz has not refunded.
**Every one nets to £0 in the ledger, so the app reports all eleven settled.**

The charge is still standing against the customer's payment. It should not be:
the flight is cancelled and the customer is not receiving what they paid for.
The `cancelled unpaid` group models this correctly — charge posted, then a
`manual_adjustment` reversing it — because there nothing ever moved. The paid
group is missing that reversal, and the missing reversal is what hides the debt.

Reversing the eleven booking charges for the amounts actually paid moves each
from £0 to **+£X owed to the customer**, £3,190 in total. A later refund entry
takes it back to zero when the money is handed over.

### Two things the data cannot answer

1. **`Refunded?` is probably already stale.** The sheet was last modified 29
   July; the owner's sent mail from around then says *"yesterday I received
   refunds for 70% of the customers"* and asks customers where to send the
   money. So Wizz money is arriving now, and the sheet has not caught up.
2. **Whose book is this?** Those emails tell customers *"Please arrange payment
   to Chlomo Grinfeld, 230120 17316507"* — his account, his sheet. If Kosher
   Connect is not the principal on these bookings, then carrying them as KC
   charges and KC payments mirrors someone else's ledger, and the correction is
   a different one. **Needs the owner before anything is written.**

### Not applied

No reversal has been posted. It moves eleven real customer balances by £3,190
and hangs on question 2 above. When it is approved: snapshot first (standing
rule for bulk data writes), then one reversal per booking, referencing the
sheet row it came from.

Also still true regardless: **the ledger has no refund leg**. Once Wizz money
reaches a customer there is no entry type that records it going out, so a
settled refund and an owed refund will keep looking identical.

---

## 2. Three features built, never used on a single booking

101 bookings on file, 41 of them still to travel.

| field | ever set | where it lives in the UI |
|---|---|---|
| `checkin_done` | **0 of 101** | Edit Booking → check-in section (who checks in, date, done tick, row badge) |
| `destination_country` | **0 of 101** | 🛂 Travel requirements modal — the whole per-passenger visa/passport guidance hangs off it |
| `passport_expiry` | 28 of 101 | passenger sub-table |

The check-in feature is complete — "we do it / customer does it", a check-in
date, a done tick, and a row badge with three states. Nobody has ticked it once.
The travel-requirements screen can't say anything at all until a destination is
picked, and no booking has one, so that screen has never shown a passenger a
single requirement.

Two readings again, and this one is the owner's call: either the shop does track
check-in and the field is too buried to reach, or it doesn't work that way and
the field is clutter on a form that already asks a lot. Worth 30 seconds of his
time before anyone builds on top of them.

Also: **36 of the 41 upcoming bookings have no passport on file.** No upcoming
trip has a passport that expires before its travel date, so nothing is on fire —
but the passenger data is thin enough that the travel-requirements feature would
have little to work with even if a destination were set.
