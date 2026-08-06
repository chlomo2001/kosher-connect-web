# ELID import — 2026-08-06

ELID (elid.co.il) is the VoIP/billing platform Kosher Connect resells. Source for
this round was owner-supplied screenshots of four ELID screens: Users, Subscriptions,
Devices (5 pages) and DIDs (2 pages). There is **no CSV export** — Bulk Management is
an update form, and the per-user DIDs page exports one user at a time. Everything
below was transcribed by eye and then validated against data already held.

## Transcription and how it was validated

| staging table | rows |
|---|---|
| `elid_map_20260806` | 35 users — id, username, balance |
| `elid_devices_20260806` | 216 devices — acc, user, description |
| `elid_dids_20260806` | 95 DIDs — id, number, owner |

**Validation:** 170 of the 216 device Descriptions are phone numbers. Of the 99 UK
ones, **23 match a customer phone already in the database, digit for digit.** Twelve-digit
strings do not match by chance, so the transcription is sound. That also settles what
the Description column *is*: the customer's own number, not a label.

## What was written

**Seven phone numbers** onto customers who had none — Eliezer Zanbel, Elye Abitan,
Mayer Gottesman, Nuchem Danstiger, Sholom Shapiro, Yakov Tsan, Yisroel Tsuker. Each
had exactly one UK number in ELID and no collision with an existing customer. Marked
`notes = 'phone from ELID device list 2026-08-06'`.

**74 virtual numbers** into `virtual_numbers` — 57 matched to a customer by name or
ELID username, 13 Phone-Rentals DIDs onto the rental pool holder, 4 `Menachem-simon Home`
onto Menachem Simon. All carry `platform = 'ELID'`, the source DID id in notes, and
**`billing_enabled = false`**.

**One name corrected.** `pl-thaler-i-m-paying` — first name "Thaler I'm", last name
"Paying" — was a sheet annotation that became a customer. Owner: it records that
Shloime pays that line by card. Renamed to Fishel Thaler, annotation moved to notes.
Left as a separate record from `pl-fishel-thaler`; the two numbers differ by one digit
(…283 vs …299) and are two lines.

## Held back deliberately

- **mrs-feld's number.** `447311492603` appears on *two* devices — hers and a
  Phone-Rentals one. Can't tell whose it is.
- **Three customers with two UK numbers each** — Elchonon Houchauser, Sholom Shapiro2,
  Yoel Horowits. No basis to pick.
- **Fifteen customers whose only ELID number is foreign** (US, Israeli, Belgian).
  A `447…` is safely their mobile; a `1…` or `972…` is at least as likely to be the
  destination their virtual number forwards to. Needs a person to say which.
- **Nine of the 35 have no number anywhere** — their Descriptions read "Calling card",
  "Home", "Getsy" and similar.
- **Twelve DIDs whose owner is ambiguous.** Surnames with many candidates in the
  customer list (Glick ×8, Gross ×9, Grinfeld ×15, Padwa ×6, Rotter ×3, Horowits ×2),
  plus `yehoishe lebowits` who matches nobody. Also `chaskel lamm` → probably
  **Yechezkel Lamm** (Chaskel is the diminutive), but that is an inference, not a match.
- **Nine DIDs with no owner** — four Free, five routed to IVRs (Prime Plus Mortgage,
  Home Corner, Yeshaye Dimand, Noson Knepler, a test access number).
- **The three pre-existing `virtual_numbers` rows** on `+44 20 7000 100X`. Those numbers
  match no DID in ELID — they are placeholders. Left untouched pending the owner's word.

## The price book

Every subscription bills on day 1, charged at Period Start against the ELID balance,
nearly all "Until canceled".

| service | £/month |
|---|---|
| 3000 minute UK Belgium USA Israel | 25 |
| Forward to Belgium Mobile 2000 | 15 |
| Israel 1000 minute | 13 |
| UK mobile, call forwarding, 1500 minute | 10 |
| Belgium 1000 minute | 10 |
| USA 1000 | 8 |
| 100 Israel only | 3 |
| 300 minute USA | 3 |

Roughly **£772/month** of recurring revenue across ~30 accounts, of which the app
currently bills nothing.

## The negative balances — solved, pending one confirmation

−£3,330.09 across 11 accounts. Multiplying each debtor's monthly subscription total by
months elapsed since it started reproduces the balance to the penny:

| account | £/mo | since | balance | months | residual |
|---|---|---|---|---|---|
| nuchem-danstiger | 55 | Sep 2025 | −660 | 12.00 | 0.00 |
| mendl horowits | 33 | Nov 2024 | −594 | 18.00 | 0.00 |
| sholom-shapiro | 40 | Sep 2025 | −480 | 12.00 | 0.00 |
| Elye-abitan | 38 | Sep 2025 | −456 | 12.00 | 0.00 |
| Binem-feldmanj | 25 | May 2025 | −400 | 16.00 | 0.00 |
| yisroel-tsuker | 10 | Dec 2025 | −90 | 9.00 | 0.00 |
| mrs-feld | 38 | Sep 2025 | −446.03 | 11.74 | −9.97 |

Six of seven land on a whole number of months with zero residual. A single payment
posted in ELID over 12 or 18 months would break that. **No payment has ever been
posted on these accounts** — which points to the customers paying in the shop and
nobody feeding it back into ELID.

**Not confirmed.** Owner is asking Shloime. Until then no balance touches the wallet
ledger; they sit in `legacy_extras.elidBalanceGbpAsAt20260806` as a dated reference.

## Note on the source material

The supplied Devices screenshots have PIN and Password columns struck through, but
the marks do not cover every cell — at least one account's password is legible. No
credential from these screenshots has been transcribed into the database, this repo,
or chat. The owner has been told to rotate it.
