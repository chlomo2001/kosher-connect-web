# Epos Now — structure, system, ideas (21 August 2026)

Owner, 20 Aug: *"epos now .com has so much more than us.. put it in the
overnight loop to steal ideas and structure and system."* The standing task is
in `ops/loops/kc-improve/BACKLOG.md`; this is its first run.

## How much of this ran, and how

**Read via search, not by reading their pages.** This environment's network
policy allows a fixed list of hosts (npm, PyPI, Anthropic and a few package
registries) and blocks everything else at the egress proxy —
`www.eposnow.com`, `support.eposnow.com` and the review sites all return
`EGRESS_BLOCKED`. Web *search* goes through a different route and works, so
what follows is built from search results quoting their own support and
product pages, plus third-party reviews.

What that costs: **I have their vocabulary and their feature list, but not
their page structure or their wording.** The brief's first ask — "how they cut
the product into areas, what lives on one screen vs many" — is the part I can
answer least well, and I have said so at each point rather than inferring a
layout from a feature list. Anyone who can open the site should re-run item 1.

Not copied: their words. The wording on KC's screens is the shop's own voice
and a deliberate thing.

---

## 1 · Structure — what they cut the product into

The division that shows through consistently is **Back Office vs Front Till**,
and it is a harder line than KC draws. The till is a device that sells; the
Back Office is a separate application — web and app, on-site or off — holding
"product, inventory, customer, and employee management"
([support](https://support.eposnow.com/s/article/Accessing-your-Epos-Now-back-office?language=en_US)).

**KC has no such line, and mostly should not.** One person runs the counter and
the books, often in the same minute. But it is worth noticing what the split
buys them: the till screen carries nothing a customer must not see, and every
report, price change and staff setting lives somewhere a customer cannot be
looking at. KC's app is one surface for both.

The other visible cut is **apps**. Loyalty, Multi Site Manager and the rest are
sold as separate apps rather than being in the product — which reviewers
report as the main disappointment: "many of the features it advertised were not
actually included and only offered via third-party integrations"
([Merchant Maverick](https://www.merchantmaverick.com/reviews/epos-now-retail/)).
That is a structural choice worth *not* copying.

## 2 · System — the workflows that join screens up

| Theirs | What it is | Where KC stands |
|---|---|---|
| **End of Day report** + Bookkeeping report | Automated collection at end of shift and end of day ([support](https://support.eposnow.com/s/article/Our-reports-explained?language=en_US)) | KC has a cash-up screen with an expected/counted variance. Theirs runs **per shift as well as per day** — see idea E3. |
| **Stock warnings, discrepancies, stock history, changes** as named reports | A stock *profile* rather than a number | KC has a low-stock threshold and a badge. No history, no discrepancy trail. |
| **Daily low-stock alert email** | Push, not pull — "daily alerts notifying users of low stock" | KC's badge waits to be looked at. See E1. |
| **Roles, then users** | A role carries permissions; a user gets a role, and a location, or "show staff at all locations" ([support](https://support.eposnow.com/s/article/Add-Roles)) | KC has per-tab permissions per staff member. Theirs is the same idea one level up. Not worth changing for one shop. |
| **Offline mode** | Till keeps selling with no internet; data syncs when it returns | KC is online-only. Already on the backlog as P3·L. Their version is the proof it is expected of a till. |
| **Customer Credit** | A credit *limit* per customer, a balance owed, and an account statement with a date range and a due date | **The closest thing to KC's wallet, and the one place they are ahead.** See E2. |
| **Multi Site Manager** | Restricted-access accounts, per-location reporting | Not applicable — one shop. |

## 3 · Ideas worth having

Each with why it fits KC. **None of these was built tonight** — that is the
standing task's own rule, and it is the right one: what suits a 400-till chain
often does not suit a shop where one person knows every customer's name.

- **E1 · The shop is told, rather than having to look.** Their low-stock alert
  arrives daily by email. KC computes the same thing and waits on a dashboard
  badge for somebody to notice. The pattern generalises past stock: the
  nightly sweep already knows about SIMs renewing, rentals overdue, plans with
  no payment method and carrier mail nobody has filed. One quiet morning email
  — "here is what today needs" — would put all of it in front of the owner
  without him opening the app. **Loop-safe to build the digest; 🔒 to send it,
  because live email is HOLD-gated.**
  Source: [stock control](https://publicreport.uk/tech/epos-now-back-office/)

- **E2 · A credit limit, and a real statement.** Their Customer Credit carries a
  *limit* and produces an account statement over a date range with an amount
  due and a due date. KC's wallet has the balance and the ledger, and since
  20 Aug a mini statement in the portal — but nothing stops an account running
  away, and nothing produces "here is what you owe, as at today". The limit is
  the more interesting half: 38 imported bookings worth £10,925 carry no charge
  (#12), and the shop has no line at which somebody says stop. **🔒 — money.**
  Source: [Customer Credit](https://support.eposnow.com/s/article/Customer-Credit?language=en_US)

- **E3 · Cash up per shift, not only per day.** Their end-of-day collection runs
  at end of *shift* too. KC's till_counts is one row per date. Two people on one
  day is one variance nobody can attribute. Small change to the table, real
  change to what a discrepancy tells you. **🔒 — money.**

- **E4 · Stock history and discrepancy as a trail, not a number.** They report
  stock *changes* over time. KC knows current stock and nothing about how it got
  there, so "we are three short" has no answer. **Loop-safe** — read-side only,
  built on writes the app already makes.

- **E5 · Loyalty is a customer TYPE, not a flag.** Their loyalty setup creates
  customer types and assigns cards to them. KC has no customer categories at
  all — no way to say "Kol Torah customers", "trade", "staff family". That is
  the more useful half of the idea for this shop; the points scheme is not.
  **Loop-safe to model, 🔒 to let it change a price.**
  Source: [Loyalty](https://support.eposnow.com/s/article/Apps-Loyalty?language=en_US)

- **E6 · The customer must be attached BEFORE the sale, or the sale is
  anonymous.** Their loyalty docs are blunt about it: pick the customer first or
  the points are lost. KC's till has the same trap — a walk-in sale saved
  without a customer cannot be attached afterwards, and that is exactly how a
  wallet ends up not matching a drawer. Worth a guard rather than a warning.
  **Loop-safe.**

## What they are simply better at

Saying it plainly, because that is the point of looking:

- **Reporting is a product area for them and a side effect for us.** They ship
  named reports — stock warnings, discrepancies, history, margins, staff
  performance — all exportable. KC has a dashboard and a monthly statement.
- **The customer account has a limit.** KC's wallet will let anyone owe
  anything for ever.
- **The till survives losing the internet.** KC's does not.

And what they are worse at, which is worth knowing before copying anything:
reviewers consistently report advertised features turning out to be paid
third-party apps, long contracts, and support that does not answer
([Capterra](https://www.capterra.com/p/152638/Epos-Now/reviews/),
[Sonary](https://sonary.com/b/epos-now/epos-now+pos/)). The lesson for KC is
about **structure, not packaging**: take the shape of Customer Credit, not the
idea of selling it separately.

## Sources

- [Epos Now Back Office — features guide](https://publicreport.uk/tech/epos-now-back-office/)
- [Our reports explained — Epos Now Support](https://support.eposnow.com/s/article/Our-reports-explained?language=en_US)
- [Customer Credit — Epos Now Support](https://support.eposnow.com/s/article/Customer-Credit?language=en_US)
- [Adding Staff Roles](https://support.eposnow.com/s/article/Add-Roles) · [Adding Staff Users](https://support.eposnow.com/s/article/Add-Users)
- [Accessing your Back Office and Till App](https://support.eposnow.com/s/article/Accessing-your-Epos-Now-back-office?language=en_US)
- [Loyalty app](https://support.eposnow.com/s/article/Apps-Loyalty?language=en_US)
- [Multi Site Manager](https://www.eposnow.com/us/store/software/apps/multi-site-manager/)
- [Epos Now Payments — Offline Mode](https://support.eposnow.com/s/article/Epos-Now-Payments-Offline-Payments?language=en_US)
- [Capterra reviews](https://www.capterra.com/p/152638/Epos-Now/reviews/) · [Merchant Maverick](https://www.merchantmaverick.com/reviews/epos-now-retail/) · [Sonary](https://sonary.com/b/epos-now/epos-now+pos/)
