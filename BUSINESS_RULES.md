# BUSINESS_RULES.md
# Kosher Connect — Business Rules

_This is the authoritative source of business logic for the KC system.
Mechl: when in doubt, check here before asking. Eliezer: keep this updated._

---

## 1. Rental Pricing

### 1.1 Daily Rates by Phone Type

Source of truth: the customer price list (30 Jun 2026), confirmed 12 Jul 2026.
"Monthly" on the customer list = the 30-day cap.

| Phone Type | Rate/Day | Min Charge | Max Charge (30 days) |
|---|---|---|---|
| USA | £3 | £20 | £50 |
| UK Standard (UK minutes only) | £2 | £20 | £35 |
| UK Unlimited (international minutes) | £2 | £25 | £40 |
| Israel | £3 | £20 | £50 |
| Canada | £3 | £25 | £50 |
| EU (internal grouping, not on the list) | £3 | £20 | £45 |

### 1.2 Chargeable Days

Shabbos and Yom Tov days are **excluded** from chargeable days. The cap works
per calendar window (resolved 12 Jul 2026, replacing the old "once capped all
30 days count" sheet wording):

```
charge = min( max(chargeable_days × rate, min_charge),
              cap × ceil(calendar_days / 30) )
```

Two day-counts: **chargeable** days (Shabbos/Yom Tov excluded) set the £;
**calendar** days (everything included) set how many 30-day cap windows the
rental spans — so a 60-day rental caps at 2× the cap, not 1×. The window
length is per-country (`cap_period_days`, default 30, editable in Settings).

Days excluded from chargeable day count (phone use is forbidden):

- Shabbos (every Saturday)
- Rosh Hashanah (2 days)
- Yom Kippur (1 day)
- First 2 days of Sukkos
- 2 days of Simchas Torah
- First 2 days of Pesach
- Last 2 days of Pesach
- 2 days of Shavuos

All other Jewish holidays (e.g. Chol Hamoed, Rosh Chodesh, Tisha B'Av) are **chargeable**.

**One calendar for everyone (decided 12 Jul 2026):** the full 2-day Yom Tov
calendar applies to **all** rentals, including Israel phones — guests renting
for Eretz Yisroel keep both days of Yom Tov, so there is no separate 1-day
Israel calendar in pricing.

### 1.3 Virtual Number Add-On

Per-country (customer price list, 30 Jun 2026), minimum 1 week:

| Rental country | Per week | Per 30 days |
|---|---|---|
| USA, Canada, EU | £5 | £10 |
| Israel, UK | £7 | £15 |

### 1.4 Late Return Fee

- £1 per chargeable day after the agreed return date
- Shabbos/Yom Tov days are excluded from late fee calculation (same rules as above)

### 1.5 Discounts

- Can be applied as a percentage (%) or fixed amount (£)
- Applied to the total rental charge, not per-day rate

### 1.6 Damage / Loss Charges

| Item | UK | USA & Israel |
|---|---|---|
| Missing charger/plug | £5 | £10 |
| Lost/broken phone handset | £45 | £100 (Israel: £120) |
| SIM card | £10 | £10 |

---

## 2. SIM Fees (confirmed 12 Jul 2026)

All SIM fees are driven by Settings keys (editable in the Settings tab):

| Charge | £ | Settings key |
|---|---|---|
| Activation / initial setup | £20 | `sim_activation_fee` |
| Annual fee | £20 | `sim_annual_fee` |
| Service | £5 | `sim_service_fee` |
| Replacement (after free allowance of 2) | £10 | `sim_replacement_fee` |
| Monthly DD (through-me plans) | provider cost + max(10%, £2) | `collect_later_late_pct`, `collect_later_late_min` |

After-sale service is **free for USA and Canada SIMs** (customer price list) —
zero the amount in the charge modal for those. UK SIMs pay the £5.

### 2.2 Not yet modeled in the app (from the customer price list)

- Multi-item discounts: 3rd rental phone onwards 15% off; 3+ SIM plans 10% off
- Repair "Purchased at KC" price tier (~£5–15 less per job) + 30-day warranty
  terms (charging port excluded for QIN/FIG); 24-working-hour turnaround
- Ticket per-passenger tiers (each passenger up to 5 / 6+ rates)
- Online-service second-application discounts (e.g. ESTA £45, passport £20)
- Products: USA phone without SIM (£2/day, min £15, £30/mo), SIM-only
  monthlies (USA £35, UK local £15, UK intl £25), TomTom update (£25, £10
  after-sale), standalone virtual-number bundle matrix

### 2.1 Virtual Number clarification

The weekly virtual number add-on is **£5 per week of the rental** (weeks =
total calendar days ÷ 7, rounded up, minimum 1 week) — not a flat £5.
The 30-day option stays £10 flat.

---

## 3. Wallet rules (append-only ledger)

Every pound the business is owed or holds lives in ONE place: the ledger.
Balances are always computed (never stored); the database enforces the sign
of every entry type and refuses any edit or deletion of a posted row.

- **Charges post automatically** from their owning feature: bookings at
  creation, repairs at collection, rentals on every save (base charge at
  creation, late fee frozen at return, lost-item charges at return).
- **Rental payments** are recorded on the rental (Manage → amount paid) and
  flow into the wallet as `PAY-RENTAL` entries. Use the Wallet tab's
  "Record Money" for everything else (booking payments, top-ups, refunds,
  corrections) — don't record the same rental payment in both places.
- **Live late fees** appear in the wallet only once frozen at return; while
  a rental is overdue the accruing fee shows on the rental itself.
- **Mistakes are corrected forward**: post an adjustment or refund. Nothing
  is ever edited or deleted.
- **Deleting things**: deleting a rental reverses its ledger position and
  keeps the history on the customer (marked "Rental deleted"). A customer
  with any money history can NOT be deleted — rename them instead.

_More sections to follow: Permission rules._

