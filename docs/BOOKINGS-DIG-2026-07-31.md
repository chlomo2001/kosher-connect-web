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
| BNKYRW | *"received a refund from Wizz … £285"*, then 30 Jul 23:21 *"Refund sent £285"* | £285 | **yes — both legs, 16 min apart** |
| MN8VSZ | 29 Jul 23:28 *"cancelled your booking and refunded £90"* | £90 | no — asking where to send |
| FMLJ8J | 29 Jul 23:55 *"refunded £45"* | £45 | no — asking where to send |
| Tager (4 pax, LTN–TLV Jan 27) | 29 Jul 23:29 *"refunded £320"* | £320 | no — asking how |
| TLKCQC | 30 Jul, *"Wizzair has refunded £205… your balance is now £130"* | £205 | n/a — customer had not paid; **owed KC £130, since received** |

**BNKYRW — resolved: both legs happened, in that order.** The owner questioned
whether *"Refund sent £285"* meant Wizz sent it in rather than Shloime sending it
on, and rightly — that message names no sender. An earlier message in the same
thread settles it:

> *"Hi I have received a refund from Wizz for your booking in the amount of £285.
> Let me know where to [send it]"*

So Wizz refunded **£285 in**, Shloime asked where to forward it, the customer
supplied their account on 30 Jul at 23:05, and *"Refund sent £285"* followed at
23:21. Both legs, sixteen minutes apart. BNKYRW is state (a), settled.

This is the clearest evidence for the whole model: **the two legs are separate
events that can sit days apart**, which is exactly why one `Refunded?` boolean
cannot express the position and why the ledger needed `refund` and
`refund_payout` as distinct entries.

It also fixes the amount. Wizz returned £285 against a £345 fare on a booking
where the customer paid £495 — so the shortfall is real and is not only the
service fee.

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

**The eleven were all cancelled together.** Wizz sent *"Important Update
Regarding Your Reservation"* on **23 July** for ten references — EHC93Y, BNKYRW,
IMPKJZ, IJEVNV, XU2WWH, DSCUFH, TMZZXC, MN8VSZ, HWGC5D, UGSJJB — one per
reference, i.e. every distinct ref in the eleven. Bookings were made 8–12 Jul,
a second run of Wizz invoices lands 20–21 Jul (alongside *"Important information
regarding your flight change booking"*), then the cancellations on 23 Jul. So
this is one event, not eleven separate mishaps.

**`XU2WWH` — the mail says one reservation, the sheet says two rows.** There is
a single 23 Jul cancellation for XU2WWH and a single invoice per run (BWUK21691218
on 9 Jul, BWUK21843070 on 21 Jul). Nothing in the mailbox suggests two bookings
under that reference. That points to one of the sheet's two rows (£360 / £145)
carrying the **wrong reference** rather than there being a genuine duplicate —
which would mean one of the eleven is a booking we cannot yet identify. Resolve
before any ref-keyed write.

**Where the exact amounts live.** Only two are known so far (BNKYRW £285,
MN8VSZ £90), both from Shloime's own messages to customers. The rest are in the
same place — his sent mail — and in the Wizz credit-note PDFs from the 21/23 Jul
run. The search that surfaces them by amount, since the figure appears in the
snippet:

```
in:sent (refunded OR "received a refund") newer_than:20d
```

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


---

## Where the refund figures actually live — found 21 Aug 2026

The blocker was recorded as "the per-booking refund amount lives in
`ch7023518@gmail.com`, which sessions can't read". Half right. The owner ran the
searches on that mailbox and screenshotted the results, and the shape of the
answer is not what either of us assumed.

**There is no "refund" email.** Searching `refund OR refunded OR "credit note"`
returns the batch below not because those words appear, but because Wizz's mail
matches on other grounds. What is actually there is two events:

**23 July 2026 — a mass reservation event.** A batch of
`⚠️ Important Update Regarding Your Reservation <REF>`, one per booking. Reads
as a cancellation across a route or a date. Refs visible in the screenshot:
SLW7XC, ZMKWJP, SPSHHD, JQEQVQ, VU792E, FMLJ8J, XU2WWH, UGSJJB, IMPKJZ, HWGC5D,
DSCUFH, IKFP7P, GPEQ2A, KU5R4B, BNKYRW, TMZZXC, USSGPK, MN8VSZ — and the list
continues past the fold ("1–100 of many").

**3 August 2026 — the documents.** `Wizz Air electronic invoice <NO> / <REF>`,
one per booking, each with a **PDF attached**. Pairs read off the screenshot:

| Invoice | Ref |
|---|---|
| DWAM-54418413 | FMLJ8J |
| DWAM-54418414 | TMZZXC |
| BWUK21991118 | IMPKJZ |
| BWUK21991615 | MN8VSZ |
| BWUK21991046 | HWGC5D |
| BWUK21992246 | TLKCQC |
| BWUK21991944 | UGSJJB |
| BWUK21992332 | XU2WWH |
| BWUK21991585 | VU792E |
| BWUK21990870 | IJEVNV |
| BWUK21990192 | DSCUFH |

### The amount is ONLY in the PDF

Checked, not assumed. A 2023 Wizz electronic invoice sits in the CONNECTED
mailbox (`earothbart@gmail.com`, BWUK-8867645 / EJ1LVA) and can be read in full:
the body is boilerplate — "In the attachment, you will find the electronic
invoice corresponding to your reservation" — and carries **no figure of any
kind**. Same template, seven digits of invoice number apart.

So forwarding these emails to the connected mailbox would NOT unblock this. The
Gmail tools available here expose attachment metadata (filename, id, mime type)
and have no way to fetch the bytes. **The PDFs have to be uploaded to chat**, the
way the Simplifly invoice was.

### Two things the screenshots settled, and one they raised

- **`XU2WWH` appears ONCE in the invoice list** (BWUK21992332), against TWO rows
  in the sheet (£360 and £145). If there is genuinely only one invoice for that
  ref, the two rows are two passengers on ONE booking, not two bookings — which
  dissolves the ambiguity that has been blocking a ref-keyed reversal. Worth
  scrolling the 85 results for a second XU2WWH before relying on it.
- **The 23 July batch contains refs that are not among the eleven** — SLW7XC,
  ZMKWJP, SPSHHD, JQEQVQ, IKFP7P, GPEQ2A, KU5R4B, USSGPK, and more below the
  fold. Either those are KC bookings the sheet does not carry, in which case the
  liability is larger than eleven, or they are not KC's at all. **Nobody should
  reconcile the eleven until that is known**, because "we owe eleven customers"
  and "we owe nineteen" are different problems.
- The searches themselves are worth keeping:
  `from:wizzair.com subject:"electronic invoice" after:2026/07/20` isolates the
  document batch; the eleven refs OR-ed together finds everything per booking.


## What one PNR's invoices actually say — 21 Aug 2026

Three invoices opened for **XU2WWH**, and they break the reconciliation plan
that has been assumed since 31 July. Not one invoice per booking. Not GBP. Not
one customer per PNR.

| Invoice | Invoice date | Performance | Lines | Total |
|---|---|---|---|---|
| BWUK21691218 | 2026.07.09 | 2026.07.08 | WIZZ Discount Club Group €59.99 · Flight LGW-TLV / TLV-LTN €426.37 | **+€486.36** |
| BWUK21843070 | 2026.07.21 | 2026.07.20 | Flight LGW-TLV / TLV-LTN | **+€8,385.75** |
| BWUK21992332 | 2026.08.03 | 2026.07.23 | Flight TLV-LTN | **−€8,811.15** |

Net across the three: **+€60.96**.

Flight tickets total €426.37 + €8,385.75 = **€8,812.12**; the credit is
**€8,811.15**. So the flights came back essentially in full, and what Wizz kept
is the Discount Club fee: €60.96 − €59.99 = **€0.97**, a fare rounding. Checked
with a calculator rather than by eye, because the whole point of this section is
that the numbers are not what anyone assumed.

### Four traps, each of which would produce a wrong reversal

1. **There is more than one invoice per PNR, and they are not all charges.**
   XU2WWH has at least three — two positive, one negative. "The invoice for the
   booking" is not a thing. Only the **net across every invoice carrying that
   PNR** means anything, and the 3 August batch is the credit leg alone.

2. **The invoices are in EUR. KC's ledger is GBP.** Every figure above is euro.
   What actually landed back on a card is a sterling amount at that day's rate
   plus whatever the card issuer took, and it will not equal the euro figure.
   A reversal posted from these numbers would be wrong in the third place before
   anyone even asks which customer it belongs to.

3. **One PNR can carry several KC customers.** €8,812 of flight tickets on a
   single reference, booked as "WIZZ Discount Club **Group**", is not one
   passenger. This finally explains the thing that has blocked a ref-keyed
   reversal since 31 July: XU2WWH appears **twice** in the sheet (£360 and £145)
   because those are **two KC customers on one group booking**, not two
   bookings and not a duplicate. The ambiguity was real and the answer is
   benign.
   It also means **the per-PNR credit cannot be divided among customers without
   knowing who was on it.** €8,811.15 back on one reference says nothing on its
   own about what any individual is owed.

4. **The Discount Club fee is not refunded.** Whatever share of it a customer
   paid, they are not getting back, and a reversal of "what they paid" would
   over-credit them by that share.

### What follows

The 31 July plan — reverse the eleven booking charges for the amounts paid —
was already known to over-credit. These invoices show it is worse than that: the
inputs are in the wrong currency, at the wrong granularity, and incomplete
without the positive legs.

**What is actually needed per PNR**, before any ledger entry:
its full invoice set (not just the 3 August credit), the net in EUR, the
sterling that reached the card, and **which KC customers were on it and for how
much each**. The last one is KC's own data, not Wizz's.

Nothing should be posted until that exists for every reference — and the
question of whether the eleven are even the whole set is still open (the 23 July
batch carries refs the sheet does not).


## The updated sheet answers most of it — 21 Aug 2026

The owner shared the current Wizz tickets spreadsheet. It has moved a long way
past the eleven rows the 31 July dig was built on. **Not committed** — it holds
customer names, phone numbers and email addresses, and belongs in the sheet, not
in the repo. Figures only below.

**39 booking rows · 109 passengers · £11,450 tickets + £3,395 fees = £14,845.**

### The liability is 25 rows, not eleven — and it is £6,690, not £3,190

Cancelled and not yet refunded:

| | |
|---|---|
| rows | **25** |
| passengers | **47** |
| tickets | £4,860.00 |
| service fees | £1,830.00 |
| **total** | **£6,690.00** |

Only two are settled — `EHC93Y` and `VU792E`, both marked `Refunded? = True`.

### The "are the eleven the whole set?" question is ANSWERED: they were not

Every reference that appeared in Wizz's 23 July batch but was missing from the
old dig is now in the sheet — `SLW7XC`, `ZMKWJP`, `SPSHHD`, `JQEQVQ`, `IKFP7P`,
`GPEQ2A`, `KU5R4B`, `USSGPK`. That was the right thing to have held the
reconciliation for: acting on eleven would have missed fourteen.

### The urgent thing is not the ledger

**CORRECTED, same day.** The first version of this section said "14 of the 25
have not been contacted" — read straight off column Q and stated as fact. The
owner's reaction was "maybe the contacted one is stale, I think he forwarded
emails to all of them", and checking says he is right to doubt it, though not
only in the direction he meant.

The sheet has TWO columns for this — J `Email Sent?` and Q `Contacted` — and
**they disagree on 12 of the 25**:

| `Email Sent?` | `Contacted` | rows | pax | value | references |
|---|---|---|---|---|---|
| False | False | **8** | 14 | £2,090 | HWGC5D, JQEQVQ, KU5R4B, USSGPK, XU2WWH ×3, ZMKWJP |
| True | False | 6 | 12 | £1,690 | DSCUFH, GPEQ2A, HWGC5D, IKFP7P, IMPKJZ, UGSJJB |
| False | True | 6 | 12 | £1,660 | BNKYRW, FMLJ8J, SLW7XC ×2, SPSHHD, TLKCQC |
| True | True | 5 | 9 | £1,250 | IJEVNV, MN8VSZ, SW9PXJ, TMZZXC, VU15UH |

Almost uncorrelated, which means **neither column can be trusted on its own**
and the honest answer is a range, not a number:

- **8 rows have neither flag** — no email recorded, not marked contacted. These
  are the ones most likely genuinely untold. £2,090, 14 passengers. Treat this
  as the floor and start here.
- **6 have an email but no tick** — the owner's hunch, and the likeliest stale
  column.
- **6 are ticked with no email** — probably rung rather than emailed, which is
  a perfectly good way to contact somebody and not evidence of anything wrong.

So somewhere between **8 and 14** still need telling, and the sheet cannot say
which. It is still a phone-call list and it still outranks every accounting
question below — but the list is 8 certain, not 14.

**What would settle it:** Shloime's Sent folder, searched for the references —
`in:sent (HWGC5D OR JQEQVQ OR KU5R4B OR USSGPK OR XU2WWH OR ZMKWJP)`. The
forwards are not in the connected mailbox (checked: searching those references
and `wizz cancelled/refund` over the last 60 days returns nothing), so they went
from his account and no session here can see them.

**And the lesson is the one this repo keeps relearning.** Two columns recording
the same fact, updated by hand, at different times, is a second answer to one
question — and this codebase has been bitten by that four times in a fortnight.
Whichever survives, one of them should go.

### And the Wizz invoices turn out NOT to be needed for it

The scale settles it. Wizz credited **€8,811.15** on `XU2WWH` (≈ £7,600). KC's
sheet records **£650** across 5 passengers on that same reference — three rows,
£360 + £145 + £145. More than ten times apart, at any exchange rate. So either
the PNR carries many passengers who are not KC's, or the sheet's "ticket price"
is not the fare. Either way **the euro credit cannot be passed through to KC
customers pro-rata**, and trying was always going to produce nonsense.

The way out is that it does not have to be. **Two separate ledgers:**

- **KC ↔ its customers.** What each is owed is what they paid KC, which is in
  KC's own sheet: £6,690. This needs no Wizz document at all.
- **Shloime ↔ Wizz.** What Wizz credits against a group PNR is a wholesale
  matter on the reseller side — the same two-layer shape as ELID.

Conflating them is what made this look unanswerable for three weeks.

### The one decision left, and it is the owner's

Of the £6,690, **£1,830 is service fees** — KC's own work, already done, on
flights Wizz cancelled. Refundable or not is a business call, not an arithmetic
one:

- fees refunded → the liability is **£6,690**
- fees retained → the liability is **£4,860**

Nothing should be posted to any wallet until that is answered, and until the
fourteen have been rung.
