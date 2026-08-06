# Customer duplicates — production audit and cleanup, 2026-08-06

Kc-Live (`xsrtdwwzxdmnjdtjcdzd`). Audit first, then the owner's decisions applied.

**Customer count: 788 → 741.**

## Undo snapshot

Taken before any write. Restore from these:

| table | holds |
|---|---|
| `undo_20260806_customers` | all 788 customer rows as they were |
| `undo_20260806_links` | all 1,242 `(table, row_id, customer_id)` pointers as they were |
| `merge_map_20260806` | the 9 winner/loser pairs |
| `rental_placeholders_20260806` | the 39 deleted "Rental" rows incl. their phone numbers |
| `elid_map_20260806` | ELID id / username / balance as transcribed |

Integrity after: **1,242 links before, 1,242 after, 0 dangling.** The 7 rows with a
null `customer_id` (3 `tasks`, 4 `email_log`) were null before the work too.

## What the audit found

The 77 same-name clusters were mostly **not** duplicates — in 76 of 77 every member
had its own activity and its own phone. Real duplication came from one cause: the
same person imported once per source sheet, visible in the `legacy_id` prefix
(`pl-` phone plans 676, `wz-` Wizz 35, `tk-` 17, `sub-` subscriptions 17, `ua-` 6).
Matching base slugs across different prefixes found 15 people holding 34 rows.

Also confirmed: **zero duplicate phone numbers** — there is a unique constraint on
`(phone_country_code, phone_number)`, so they cannot occur. Zero duplicate emails
(`email_normalized` is non-null on only a handful of rows).

## 1. Nine merges applied

Kept the richer row, re-pointed all 15 FK tables, folded in phone/email/address
where the kept row was empty, deleted the empty row. 37 child records moved, none lost.

Chaim Shimon Lebrecht · Eliezer Rapaport · Fishel Thaler · Lipa Moshkowits ·
Mechl Lieber · Menachem Meir Glick · Menachem Simon · Moishe Grinfeld Antwerp ·
Nachmen Merlin

Each kept row now carries `notes = 'merged from <loser legacy_id>'`.

**Held back — Yochenen Domb.** The pair was `tk-yochenen-domb` + `pl-yochenen-domb-2`.
The owner's rule is that sheet-numbered rows (`-1`, `-2`) are separate people, and
the `pl-` side here is line "2". Not merged pending his word.

## 2. Tier 2 — left alone by decision

Owner confirmed these are **separate people**, not duplicates. No action, and they
should not be re-flagged: Mailech Sharf, Menachem Rosen, Yakov Mordche Friedman,
Yidl Samet, Pesachye Kraus.

## 3. Rental pool tidied

39 rows named "Rental" (no surname, 38 distinct phones) were not customers — they
were rental-pool SIMs that each got a placeholder record, because **`sims.customer_id`
is NOT NULL** and the import had nowhere else to put them. All 40 of their records
were `sims` and nothing else: Golan (Israel), Red Pocket / Tello / US Mobile (USA),
Lebara, Three, UK SIM — the international rental handsets.

Applied the light fix: one internal holder `Kosher Connect — Rental Pool`
(`legacy_id = internal-rental-pool`), all 40 SIMs re-pointed to it, the 39
placeholders deleted. Each placeholder's number was copied onto its SIM as
`legacy_extras.poolHolderNumber` first, so no number was lost.

**Still open (root cause).** `sims` has no typed number column at all — all 840 SIMs
keep their number in `legacy_extras.simNumber`, untyped JSON. The proper fix is a
migration making `sims.customer_id` nullable and adding a typed `sim_number`, so a
pool SIM needs no owner. Backlog, not done here.

## 4. ELID linked

The 35 `Imported from ELID` rows are **real customers**, not junk — they came
through ELID (elid.co.il), the VoIP/billing platform KC resells. The import had
brought names only.

All 35 matched an ELID account exactly (0 unmatched). Each now carries:

```
legacy_extras.elidUserId, .elidUsername, .elidBalanceGbpAsAt20260806
notes = 'ELID account <id> (<username>)'
```

**Balances are recorded as a dated reference only — nothing posted to the ledger.**
11 of the 35 are in debit, totalling **−£3,330.09** (largest: −660, −594, −480, −456,
−446, −400). Whether a negative ELID balance means the customer owes KC, or is KC's
prepaid float with ELID, is not something the data answers — owner to say before any
of it becomes a wallet or ledger entry.

### Not done, and why

- **No phone numbers.** The ELID users list shows ID, user, username, account type,
  tariff and balance — no numbers. The 35 still have none. Numbers live per-user
  under DIDs; that page has an **Export to CSV** button, which is the way to get them.
- **The wider reconciliation.** ELID holds roughly 150 accounts across 3 pages; only
  35 were ever imported. Several of the rest clearly belong to people already in KC
  under `pl-` (e.g. `fishel-thaler` 5858, `mechl lieber` 4771, `mechl- lieber` 5023,
  `Mechl-lieber-rental` 4992, `moishe-grinfeld-antwerp` 4888, `Satmar11` 5047) — so
  some KC customers have an ELID account nobody has linked. ELID also contains test
  accounts (`test test`, `test company`, `test_kc`, `not in use`) which must not be
  imported. A CSV export of the full users list would let this be done properly.
- **A device password and PIN were visible** in one of the supplied screenshots.
  Deliberately not transcribed here or anywhere in the repo, per the secrets rule.
