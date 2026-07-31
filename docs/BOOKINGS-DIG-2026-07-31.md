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

### Two things the data could not answer — both now moved (31 Jul, owner)

**Q2, whose book is this — ANSWERED. It is KC's.** The owner: *"shloime as the
owner of this business, is using it as part of kc. yes we know this has to
change, but that's the case today."* So Shlomo Grinfeld's account and his sheet
are being used as part of Kosher Connect. These bookings belong in KC's ledger,
and the reversal is the right shape of correction rather than an unwind. (That
the personal account is doing the shop's work is a known problem the owner has
flagged for later — it does not change today's accounting.)

**Q1, is `Refunded?` stale — YES, confirmed, and it hides more than staleness.**
Five owner screenshots (29–30 Jul, from `ch7023518@gmail.com`) show Wizz money
already returned on bookings the sheet still marks FALSE:

| booking | evidence (owner's sent mail) | Wizz refunded | reached the customer? |
|---|---|---|---|
| BNKYRW | 30 Jul 23:21 *"Refund sent £285"* | — | **probably — see caveat** |
| MN8VSZ | 29 Jul 23:28 *"cancelled your booking and refunded £90"* | £90 | no — asking where to send |
| FMLJ8J | 29 Jul 23:55 *"refunded £45"* | £45 | no — asking where to send |
| Tager (4 pax, LTN–TLV Jan 27) | 29 Jul 23:29 *"refunded £320"* | £320 | no — asking how |
| TLKCQC | 30 Jul, *"Wizzair has refunded £205… your balance is now £130"* | £205 | n/a — customer had not paid; **owed KC £130, since received** |

**Caveat on BNKYRW — "Refund sent" is read, not proven.** *"Refund sent £285"*
does not name a sender. It could mean Shloime sent £285 to the customer, or that
Wizz sent £285 in. Three things favour the first: the customer had supplied their
account details 16 minutes earlier (*"You can send the payment for the Kopilowitz
booking — BNKYRW — to this account"*), they replied *"תודה רבה על עזרתך"* —
thanking him for his help, which reads like a completed act rather than news of
one pending; and Shloime's wording is consistent elsewhere — when Wizz is the
payer he names it (*"Wizzair … refunded £45"*) and then asks where to send the
money, which he does not do here because he had just been told.

That is a strong reading, not a fact. **It is settled by one look at the bank
statement**: an outbound £285 around 30 Jul confirms it; its absence means KC is
holding £285 and BNKYRW belongs in state (b) below, not (a).

Either way the conclusion below is unaffected: £285 ≠ the £495 the customer paid,
so the refund still is not the payment. Only BNKYRW's *state* turns on it.

### What this changes: the £3,190 is not the liability

**The amount Wizz refunds is not the amount the customer paid.** Both bookings
where we can see the two figures side by side show a shortfall:

- **MN8VSZ** — customer paid £175 (£130 fare + £45 fee); Wizz refunded **£90**.
- **BNKYRW** — customer paid £495 (£345 fare + £150 fee); refund sent **£285**.

In each case the refund is smaller than the fare alone, so it is not simply
"fee retained, fare returned" — Wizz is refunding part of the fare too.
Reversing what the customer paid would therefore **over-credit every one of
them**. The figure that belongs in the ledger is the refund actually received
per booking, and that number exists only in the refund email for that booking.

### Three states, not one

The sheet's single `Refunded?` FALSE collapses three genuinely different
positions, and only one of them is a debt to a customer:

- **(a) refunded and passed on** — settled. `refund` + `refund_payout`, nets to
  zero with both legs on file. BNKYRW.
- **(b) refunded, KC holding it, waiting on the customer's bank details** —
  **this is the live liability**: customer money physically in KC's hands.
  `refund` posted, no payout, so the balance stands positive. MN8VSZ, FMLJ8J,
  Tager — three in five screenshots, so likely the largest group.
- **(c) Wizz has not refunded** — KC owes the customer nothing yet; KC has a
  claim on Wizz. Nothing to post.

The refund leg shipped 31 Jul records all three correctly. What it cannot do is
invent the per-booking amount.

### Blocked on the numbers, not on a decision any more

Q2 is closed and Q1 is answered in principle. What remains is arithmetic that
only the refund emails hold: **the refund amount per booking, and whether it has
been passed on.** Those live in `ch7023518@gmail.com`, which this session cannot
read — the connected mailbox is `e.a.rothbart@gmail.com`. Either Shloime
supplies the per-booking figures, or that mailbox gets connected.

Also unresolved in the sheet itself: **`XU2WWH` appears twice** in the eleven,
at £360 and £145. A reversal keyed on booking reference would be ambiguous
until that is explained — two bookings under one reference, or a data error.

Deliberately not recorded here: the customer and payee bank details visible in
that correspondence. They are not needed for the ledger correction.

### Not applied

No reversal has been posted, and the plan has changed since this was written:
**do not reverse the £3,190.** That is what customers paid, not what is owed
back — see above. Post per booking, for the refund actually received, in the
state that booking is actually in. Snapshot first (standing rule for bulk data
writes), and reference the sheet row and the refund email each figure came from.

The refund leg is no longer missing — `refund_payout` shipped 31 Jul, so a
refund KC still owes and one it has settled are now distinguishable on the
record.

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
