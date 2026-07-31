# Open banking — read-only spike

Status: **spike, nothing connected.** No provider account, no credentials, no
migration applied. This is the shape of the thing, plus the reasoning that fixes
that shape, so the decision is on the record before any money data arrives.

## Why this is not built like the Stripe integration

The instinct is "like Stripe, but the bank". It isn't, and the difference is the
whole design.

**Stripe tells you intent.** A webhook says: this customer, this amount, this
invoice, succeeded. That maps to a ledger entry almost one-to-one, because the
payment was created by us and already carries a customer and a reason.

**A bank feed tells you only that money moved.** A date, an amount, and a
mangled reference — `BGC BNKYRW/KOPILOWITZ`, or a name that isn't the customer's
because a spouse sent it, or nothing at all. The ledger cannot accept that: every
entry needs a `customer_id`, an `entry_type` and a sign. A feed supplies none of
the three reliably.

So the rule this design exists to enforce:

> **A bank feed is a reconciliation source, not a posting source.**

Transactions land raw, a matcher *proposes*, a human *confirms*, and only then
does anything reach the ledger. The ledger is append-only — a wrong auto-post
can never be deleted, only corrected forward, leaving both entries on a real
customer's statement forever.

The Wizz refunds are the argument in miniature. Money moved between Wizz, the
shop and eleven customers over two weeks, and even with the emails in front of
you it took work to say which movement belonged to whom. No matcher was going to
infer that unaided.

## What is here

| file | what it is |
|---|---|
| `supabase/migrations/20260731180000_bank_transactions.sql` | landing table — **not applied** |
| `lib/bankCsv.mjs` | statement CSV → rows for that table |
| `lib/bankMatch.mjs` | pure matcher: ranks candidates, explains itself, cannot post |
| `test/bankCsv.test.mjs`, `test/bankMatch.test.mjs` | 24 tests, including the guard rail |

**`bank_transactions`** keeps the provider's own transaction id as a unique key,
so re-polling a window inserts nothing new — the same idempotency idea the ledger
gets from `charge_reference`. Amounts use the ledger's sign convention (+ in,
− out) so a matched pair can be compared without a mental flip. `raw` keeps the
untouched provider payload, because matching rules will change and re-deriving
beats re-fetching from a provider that may no longer hold it.

Unlike the ledger this table is **mutable** — `match_state` is worked through as
someone triages. The immutable record stays the ledger's. A CHECK stops a row
claiming `confirmed` without saying what it matched.

**The matcher** scores four signals: a booking reference in the description
(decisive), an exact amount (common, not unique), counterparty name similarity
(reusing `nameMatch.mjs`, so TEITELBAUM on a statement finds Taitelbaum on file),
and date proximity (weak alone, useful for separating two people who owe the
same). It returns the reasons that fired, so the triage screen can say *why* —
which is what lets someone judge a proposal in a second rather than trusting it.

It also returns **`ambiguous`** when the top two candidates score within 15 of
each other. Two customers owing £45 against a bare £45 credit is the case where
a confident-looking UI gets someone to click a wrong match, so it is flagged
rather than ranked.

`shouldAutoPost()` returns `false` unconditionally and `AUTO_POST_SUPPORTED` is
`false`. Stated as code, and tested, so a later refactor toward auto-posting has
to delete them deliberately and answer for it.

## Provider

**GoCardless Bank Account Data** (formerly Nordigen) is the one to try first: a
genuinely free account-information tier covering UK banks, which suits a shop
this size. TrueLayer and Plaid are more polished and charge for it.

You do not need your own FCA authorisation — you connect under the provider's
licence, as their customer. Budget for **90-day consent expiry**: someone must
re-authenticate the connection roughly quarterly. That is an operational chore,
not a one-off setup, and it should be someone's named job.

## The blocker, and it is not technical

**There is no business bank account yet** (owner, 31 Jul) — the shop's money runs
through Shloime's personal account, the same arrangement that made "whose book is
this?" a real question about the Wizz bookings.

Connecting a feed to that account pulls **his personal transactions into KC's
database**. Every grocery shop and private transfer, sitting in a table the
system can read, for the sake of catching a few customer payments. That is a
privacy problem before it is a bookkeeping one, and no amount of filtering fixes
it — the filtering happens *after* the data has been stored.

So: **do not connect a live feed until the shop has its own account.** The work
here is the part that can be built safely in the meantime — the shape, the
matcher, the tests. It is also a concrete reason to open a business account
sooner rather than later, since a clean feed is worth real time every week.

## The CSV import — the part that works today

`lib/bankCsv.mjs` takes an exported statement and produces rows for the same
table a live feed would fill. No standing access, no consent to renew, no
personal transactions arriving unasked: the owner exports what he wants to
share, each time. When a business account exists the provider client drops in
alongside it and the matcher and table do not change.

Three things it has to get right, each a way to corrupt money data quietly:

**Every bank exports a different shape.** Some give one signed `Amount`; others
split `Paid In` / `Paid Out` where **both columns hold positive numbers** and the
column itself is the sign. Getting that wrong flips every debit into a credit.
Aliases are matched longest-first so `Transaction Date` isn't swallowed by
`Date`, and preamble lines above the header are skipped and reported.

**Dates are ambiguous.** `05/06/2026` is 5 June here and 6 May in a US export.
The order is decided **once per file** from the rows that can prove it — a value
above 12 can only be a day. Deciding per row would read half a file one way and
half the other. If nothing in the file proves it, UK order is assumed **and the
caller is warned**, because an unprovable file is exactly where a silent
month/day swap would hide. If rows disagree, that is reported as a conflict
rather than resolved.

**There is no transaction id.** So one is synthesised from account, date, amount
and description, plus an occurrence index among identical siblings. Re-importing
the same statement, or an overlapping window, yields the same ids and the unique
constraint absorbs them — which matters because this feeds an append-only
ledger. The occurrence index is what stops it overcorrecting: two genuine £20
cash withdrawals on one day are two movements and both survive.

Amounts parse the shapes banks really use — `£1,234.56`, `(50.00)`, `75.00-`,
`12.34 DR`. Rows without a readable date and amount (totals, blank lines) are
skipped and **counted in the warnings**, so a partial import never passes for a
complete one.

Not built: the upload screen. The parser is the part with the correctness risk
and it can be exercised from a script; the screen should be designed against a
real statement.

## Not built, deliberately

- No provider client. Untestable without credentials, and the interface is a
  day's work once an account exists.
- No API route. There is nothing to serve until transactions exist, and a route
  is where an auto-post would sneak in.
- No triage UI. It should be designed against real transactions, not imagined
  ones.
