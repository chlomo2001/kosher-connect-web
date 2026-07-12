# BUSINESS_RULES.md
# Kosher Connect — Business Rules

_This is the authoritative source of business logic for the KC system.
Mechl: when in doubt, check here before asking. Eliezer: keep this updated._

---

## 1. Rental Pricing

### 1.1 Daily Rates by Phone Type

| Phone Type | Rate/Day | Min Charge | Max Charge (30 days) |
|---|---|---|---|
| USA | £3 | £20 | £45 |
| UK Standard (UK minutes only) | £2 | £15 | £40 |
| UK Unlimited (international minutes) | £2.50 | £20 | £45 |
| Israel | £3 | £20 | £50 |
| Canada | £3 | £25 | £45 |

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

### 1.3 Virtual Number Add-On

- £5 per week (minimum 1 week charge)
- £10 flat for a 30-day rental

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

### 2.1 Virtual Number clarification

The weekly virtual number add-on is **£5 per week of the rental** (weeks =
total calendar days ÷ 7, rounded up, minimum 1 week) — not a flat £5.
The 30-day option stays £10 flat.

---

_More sections to follow: Wallet rules, Permission rules._

