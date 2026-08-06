# Duplicate customers — production audit, 2026-08-06

Read-only analysis of `customers` on Kc-Live (`xsrtdwwzxdmnjdtjcdzd`). No writes made.

**788 customer rows total.** Activity = row count across all 15 tables with a
FK onto `customers` (bookings, customer_documents, email_log, kt_jobs, kt_shuls,
ledger, rentals, repairs, service_orders, sims, sold_phones, stock_sales, tasks,
travel_authorisations, virtual_numbers).

## Headline

The 77 same-name clusters are mostly **not** duplicates. In 76 of 77, every
member has its own activity and its own phone — different people sharing a
common surname. The real duplication is much smaller and has a specific cause:
the same person imported once per source spreadsheet.

`legacy_id` prefixes carry the provenance:

| prefix | rows | with phone | source |
|---|---|---|---|
| `pl-`  | 676 | 608 | All phone plans sheet |
| `wz-`  | 35  | 17  | Wizz import |
| `tk-`  | 17  | 0   | (third sheet) |
| `sub-` | 17  | 0   | Subscriptions sheet |
| `ua-`  | 6   | 6   | (user accounts) |

Matching on the base slug across *different* prefixes finds **15 people holding
34 rows**.

## Tier 1 — 10 safe merges (20 rows → 10)

Cross-sheet, no conflicting phone: one row carries the phone, its twin has none
(or neither has one). Keep the higher-activity row, fold the other in.

| person | rows | note |
|---|---|---|
| Chaim Shimon Lebrecht | `wz-` (4) + `tk-` (3) | neither has a phone |
| Eliezer Rapaport | `pl-` (3, phone+email) + `tk-` (2, empty) | |
| Fishel Thaler | `pl-` (1, phone) + `sub-` (1) | |
| Lipa Moshkowits | `pl-` (1, phone) + `sub-` (1) | |
| Mechl Lieber | `pl-` (2, phone) + `sub-` (1) | |
| Menachem Meir Glick | `pl-` (2, phone) + `sub-` (1) | |
| Menachem Simon | `pl-` (5, phone) + `sub-` (1) | |
| Moishe Grinfeld Antwerp | `pl-` (3, phone) + `sub-` (1) | `sub` first_name has a trailing `-` |
| Nachmen Merlin | `wz-` (4) + `pl-` (1, phone) | |
| Yochenen Domb | `tk-` (4) + `pl-…-2` (1, phone) | `pl` row is line "2" — least certain of the ten |

## Tier 2 — 5 needing the owner's call (14 rows)

Phones conflict. Pattern: the `sub-`/`ua-` row is very likely a duplicate, but
*which* line it belongs to is ambiguous, and the `pl-…-1`/`-2` rows are
deliberately separate lines.

- **Mailech Sharf** — `pl-1` (phone A), `pl-2` (phone B), `sub-` (no phone)
- **Menachem Rosen** — `pl-` (phone A), `pl-2` (phone B), `sub-` (no phone)
- **Yakov Mordche Friedman** — `pl-` + `ua-`, different phones, email only on `ua-`
- **Yidl Samet** — `ua-` + `pl-`, different phones
- **Pesachye Kraus** — `pl-1`, `pl-2`, `pl-`, `ua-` — four distinct phones

## Explicitly NOT duplicates

- **39 rows named "Rental"** (no surname, 38 distinct phones, created 2026-07-13).
  All 40 of their activity rows are `sims` and nothing else. These are
  rental-pool SIMs that each got a placeholder customer record in the Three.xlsx
  import — 39 real-but-unnamed lines, not 39 copies of one person. Merging them
  would be wrong; they need renaming or moving off `customers` entirely.
- **Same-sheet numbered lines** — `…-1`/`-2`, `satmar-37`/`satmar-11`,
  `yehoishe-gross`/`-2`, `burech-tzvi-kopenhaim-1`/`-2`,
  `mordche-y-goldberg-shvester-1`/`-2`. The source sheet separated these on
  purpose; they are distinct plan lines.
- **40 two-member clusters with two distinct phones, both active** — same name,
  different people.

## Separate finding — 35 dormant ELID rows

35 rows created 2026-07-23, `notes = "Imported from ELID (…)"`, numeric
`legacy_id`. Every one has **no phone, no email, and zero activity across all 15
tables**. Name-only shells from an import that was never finished. Includes
`Sholom-Shapiro` / `Sholom-Shapiro2` / `Shulem-Shapiro`, which the ELID source
itself held as separate entries.

Options: finish the import (attach phones), or retire them — they are currently
4.4% of the customer list and match nothing.

## Other signals checked and cleared

- **Duplicate emails: zero.** `email_normalized` is non-null on only a handful of
  rows, so email is not a usable dedupe key on this data.
- **Duplicate phones: zero.** No two customers share a normalised phone number.

## Suggested order of work

1. Retire or rename the 39 "Rental" placeholders (biggest distortion of the list).
2. Merge Tier 1's ten pairs.
3. Put Tier 2's five in front of the owner one at a time.
4. Decide the 35 ELID shells: finish or delete.

Any merge needs an undo snapshot first, and must re-point all 15 FK tables
before deleting the losing row.
