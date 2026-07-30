# How the rental pool is actually run — and what the app should adopt

Written 30/07/2026 from `Kosher_Connect.xlsx` (owner-confirmed **current**), sheet
`Rental`: 114 lines. The other five sheets in that workbook are an August 2024
prototype (4 test customers, 3 stock rows, VLOOKUP scaffolding) and can be
ignored.

The point of this note is **not** an import plan. The pool has to end up in the
app either way. The point is that the sheet shows how its operator thinks, and
if the app disagrees with him on any of the points below, the migration hurts —
he has to clean 114 rows in Excel *before* he can start, which is exactly the
kind of tax that makes people keep the spreadsheet instead.

## What the sheet contains

| | |
|---|---|
| Lines | 114 (all with a number, none duplicated) |
| Status | 77 rented · 24 available · 9 permanent · 4 other (`not working`, `?`) |
| SIM/ICCID recorded | 90 (78%) |
| Wrap IMEI recorded | 23 (20%) |
| Carriers | US Mobile (~85), Lebara 11, Golan 7, Fizz 3, Lucky Mobile 2, Three 1 |
| Provider accounts | 24 distinct; one covers 72 of the 114 lines |

## Seven things the app has to accept

**1. The customer is a name he half-remembers, not a record.**
The holder lives in a free-text `details` column: usually a surname, and
**15 rows carry a literal `?`** (`?Erenfeld`, `??Schwalbe??`, or just `?`). He
records what he knows and marks his own uncertainty. Our `lines` table has no
place for "I think it's Erenfeld" — a hard customer FK forces him to resolve 15
unknowns before he can move. The app needs an unverified holder note that sits
next to the real link and can be promoted to it later.

**2. "Permanent" is a real state, not a long rental.**
9 lines are with someone indefinitely. In a two-state available/rented model
they read as rented-forever and poison every overdue count and every
availability figure. It needs its own status.

**3. The name stays after the phone comes back.**
**15 lines marked `available` still carry a customer name.** For him that column
is history, not current occupancy. Map it naively to "current holder" and 15
free lines will show as rented on day one — and he'll conclude the app is wrong.
Last-holder and current-holder are two different fields.

**4. The due date is aspirational.**
Of the 77 rented lines, 13 have **no** end date at all, and **43 have one that
has already passed** — 22 of those from 2025, the oldest 526 days ago. Nothing
in a spreadsheet ever moves a row out of "rented", so the state is sticky and
the dates rot quietly.

This is also the strongest argument for moving: *he cannot see this*. 43 overdue
lines is a dashboard card the app can show him the hour he migrates, and it is
worth real money — every one is either a phone to chase or a line to stop paying
for. Lead the migration with that, not with data hygiene.

**5. One column, several meanings.**
The unnamed first column mixes region (`USA`, `Canada`), product type
(`SIM only`), handset brand (`Etolk`/`Etalk`) and physical asset tags
(`Rental 220`, `rental 203`). `POOL DETAILS` similarly carries a carrier
sub-brand (`AT&T`, `Verizion`), a pool number (`Pool 3`), a payment note
(`paid 150 rubinstein`), a renewal note (`Yearly 6 sep 25`) and a stray IMEI.
Those are separate fields in the app — but the split has to happen *for* him
during import, not be handed back to him as homework.

**6. ID fields contain prose.**
The IMEI column has a row reading `sim?`; the account-email column has bare
phone numbers and the word `Default`. Any importer that assumes an IMEI is 15
digits will fail partway through 114 rows. Parse leniently, flag what didn't
fit, never drop it.

**7. Master accounts already match us.**
24 provider accounts, one dominant — that is exactly our `master_account_id`
model. Nothing to change; this part of his mental model and ours already agree,
which is worth saying out loud when he moves.

## The migration approach that follows

Import **as-is**, with everything above preserved — uncertain names as uncertain
names, undated rentals as undated, stale dates as stale — and land the messy
rows in a **needs-review** state inside the app. Then he works the exceptions in
the app, a row at a time, next to the customer records that can resolve them.

The mistake to avoid is a validating importer that rejects his data until it is
clean. That moves the cleanup *before* the migration, back into Excel, alone,
with none of the app's data to help him — which is how a migration becomes
something you never quite get round to finishing.

## State of the app today

`lines` holds **6** rows, 4 with no number at all: the placeholder seed from the
Wizz import, not a pool. Exactly one of the sheet's 114 numbers exists
(`13472632157`). `rentals` holds 1 row, which is the consequence: there is
nothing to rent out. Meanwhile `sims` (840) and `customers` (788) are real. The
rental side of the business is the gap.
