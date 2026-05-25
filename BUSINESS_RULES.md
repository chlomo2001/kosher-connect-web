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

Shabbos and Yom Tov days are **excluded** from chargeable days, **except** when the rental has hit the monthly cap — in that case all 30 days count regardless.

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

_More sections to follow: Wallet rules, Permission rules, SIM/plan rules._

