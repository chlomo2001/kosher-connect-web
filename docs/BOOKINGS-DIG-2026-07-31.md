# Bookings dig — 31 July 2026

Read-only. Nothing was written to the database.

Two things came out: a money question the owner raised that the app currently
answers wrongly either way, and three built features that no booking has ever
used.

---

## 1. "Paid" on a cancelled Wizz booking — the owner's question

**Owner, 31 July: "paid" could mean Wizz paid the refund** — not that the
customer paid us.

That matters because the 30/07 flights-sheet reconcile read every "paid" marker
as *the customer paid the shop*, and wrote a ledger `payment` entry for each one.

### What is in the ledger right now

11 cancelled bookings carry a note of the form
`paid £X before cancellation — refund due`. Every one of them has exactly:

| entry | date | amount |
|---|---|---|
| `booking` — the original charge | 2026-07-13 | −£X |
| `payment` — "Paid — reconciled from flights sheet 30/07/2026" | 2026-07-30 | +£X |

£3,280 charged, £3,190 recorded as paid, one £90 adjustment (the split case:
ticket paid, fee unpaid and reversed). **Net position on all 11: £0.00.**

So the app says these customers are square. The note on the same record says a
refund is due. Those two statements contradict each other, and the £0 is what
the balance, the statement and the portal all read from.

### The refund leg is missing regardless of which reading is right

This is the part that does not depend on the owner's answer.

The tell is the one booking noted `paid £140 — refunded at counter`. We *know*
that customer got their money back. Its ledger is still just charge + payment =
£0, with **no refund entry**. The reconcile never modelled a refund at all — so
a refund that has happened and a refund that is still owed look identical in the
app, and both look like "settled".

For contrast, the 14 `cancelled unpaid` bookings were handled correctly: charge
posted, then a `manual_adjustment` reversing it, net £0 — because there nothing
ever moved.

### What each reading would mean

**A — "paid" = the customer paid us.** The payment entries are right, but the
shop is holding money for a cancelled flight. There is a liability to the
customer that appears nowhere. Each of the 11 needs a refund-due credit, cleared
when the money actually goes back.

**B — "paid" = Wizz refunded the shop.** Then up to £3,190 of `payment` entries
assert customer payments that never happened. Those bookings should look like
the `cancelled unpaid` group — charge reversed — and any customer who *did* pay
needs a real refund recorded.

Under A the app understates what the shop owes. Under B it has invented income.

### Needed from the owner

For the 11 bookings (references: BNKYRW, IJEVNV, XU2WWH ×2, UGSJJB, HWGC5D,
MN8VSZ, DSCUFH, TMZZXC, EHC93Y, IMPKJZ), which is it — did the **customer** pay
the shop, or did **Wizz** pay the refund back to the shop? It may not be the same
answer for all 11; the sheet's wording is the only source and it is ambiguous.

Once that is settled, the fix is a small reconcile script plus a refund entry
type so the refund leg stops being invisible. **Do not correct these by hand
first** — the wrong reading would move real customer balances.

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
