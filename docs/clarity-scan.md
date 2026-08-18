# Clarity scan — where the code says one thing and means another

Dated **18–19 August 2026** (port item B1). **Document only: no behaviour was
changed by this scan.** Implemented from the brief alone — the source repo is
not reachable from this session.

## How much of this ran, honestly

Seven lenses were planned. **Four completed** — names that lie, vocabulary
drift, money whose meaning is ambiguous, and the person is denormalised. Three
did not: state machines, silent defaults, and the shape of the plan, all lost
when the run hit a monthly spend limit. The adversarial refuter pass and the
synthesis agent died the same way, so **the refuting and the diagnosis below
are mine, done by reading the code the findings point at** — every claim in
this document was re-opened at its file and line before it was kept or killed.

That the "shape of the plan" lens never ran matters, because it was the lens
written to test the standing hypothesis. What follows tests that hypothesis
from the other four lenses' evidence instead, which is weaker but not nothing.

## The diagnosis

**The root cause is not one bad decision; it is two data models running at
once, with no rule about which is true.**

KC carries a *relational* model — typed columns, enums, foreign keys, `pools`,
`master_accounts`, `lines.pool_id`, `sim_mail.customer_id` — and a *display*
model: `legacy_extras` jsonb blobs, settings keys holding JSON arrays, and
plain English words used as values. Both are live. Neither is authoritative.
Every surviving finding sits on a seam between them:

- The rental filter that reads `status === 'out'` is the **display** word used
  where the **enum** says `active` — so it silently matches nothing.
- `pools`, `master_accounts` and `lines.pool_id` are the relational model,
  fully specified with FKs and RLS, and **no application code has ever read
  them**; the real pool registry is a JSON blob in `settings`.
- Customer merge re-parents a foreign key **the app never reads**, so the
  merge is structurally correct and practically invisible.
- The carrier account email — the routing identity that pairs most SIMs to
  their owner — lives in a blob, where nothing can index or defend it.
- `country_code` on rentals is a **tariff key**, not a country; `phones` in
  the app are `lines` in the database.

**Verdict on the standing hypothesis ("the plan has no shape" — the SIM blob).
Partly confirmed, and demoted.** The blob is real and the person-identity lens
found it independently. But it is one half of the split, not the cause of it:
the same seam produces money findings and status findings that have nothing to
do with `sims`. The blob is the symptom that hurts most, not the disease.

The practical consequence, which is what makes this worth writing down: **a
maintainer cannot tell which model to trust by reading either one.** The
database looks authoritative and is partly fiction; the app looks pragmatic and
is partly the only truth. Every finding below is a person, at some hour,
opening the wrong one.

## The spine

One sentence the whole app should be able to say about itself:

> **Kosher Connect remembers, for every person the shop deals with, what they
> have of ours, what they owe us, and what has to happen next.**

Held against that sentence: the till, rentals, SIMs, the wallet, tasks and the
carrier queue all serve it directly. The manual and guides serve it once
removed. The `pools` and `master_accounts` tables serve nothing — they are the
clearest "noise" the spine exposes, because they describe a memory the shop
does not actually keep.

## The one that is a live bug, not a rename

`public/main.js:9355` — `customerContextForAi` builds the account facts handed
to the AI reply drafter. It lists rentals matching
`r.status === 'out' || r.status === 'booked'`. **There is no `out` status**:
the enum is `('booked','active','overdue','returned')` (initial_schema.sql:13),
and a phone currently with a customer is `active`. So a customer who has a
phone out right now is described to the AI as having no rental, unless it is
already overdue (caught by the line above). The AI then drafts a reply on that
basis.

This is a one-word fix and I have deliberately **not** made it: B1 changes no
behaviour, and this is the AI drafting surface. It wants the owner's go-ahead
in the morning, and it is the single most valuable thing this scan found.
## Tier 1 — renames and comments. Zero behaviour change.

| # | finding | file:line | current → proposed |
|---|---|---|---|
| 1 | isShabbatOrHoliday takes a `country` parameter it never reads — the calendar is deliberately country-blind | `public/main.js:1647` | function isShabbatOrHoliday(date, country) — callers at main.js:1862 (calcRentalPrice) and main.js:1972 (count → isShabbatOrHoliday(date) — drop the parameter at the definition and both call sites (zero behaviour change), o |
| 2 | Display word 'out' leaked into a status comparison and silently matches nothing | `public/main.js:9253` | r.status === 'out' → r.status === 'active' |
| 3 | Who pays the SIM provider has three vocabularies: 'through-me'/'direct' (app), 'kc'/'customer' (DB), 'Through me'/'KC pa | `lib/mappers.js:273` | paymentType 'through-me'/'direct' ↔ paid_by 'kc'/'customer', linked only by an uncommented inversion → state the dictionary at both ends: a comment on the sim_payer enum ('app value through-me = kc, direct = custo |
| 4 | 'reference' means airline PNR, ledger idempotency key and task dedupe key — two of them three lines apart in the same fi | `pages/api/ticket-mail.js:82` | app field `reference` = PNR on ticket-mail objects, idempotency key on ledger entries; bookings use bookingRef → in ticket-mail's toApp, name the PNR `bookingReference` (matching bookings) and update its main.js consumers ( |
| 5 | arrearsTotal is a negative number named as a positive quantity | `pages/api/ledger.js:231` | arrearsTotal: -350.00 (negative = customers owe £350), silently abs'd at every point of use → serve the magnitude at the boundary — `arrearsTotal: Math.abs(Number(totals.owed) \|\| 0)` — and drop the two  |
| 6 | 'Charged Out Today' lumps revenue charged (no cash moved) with refunds physically handed back | `public/main.js:9718` | 'Charged Out Today' = \|charges billed + refunds paid out\|, one figure, called 'charged' → relabel to 'Charged & paid out today' (or 'Billed today' if payouts get their own line); comment on cashup.js  |
| 7 | sim_mail.recipient's column comment claims it is 'the address we PAIRED on', but for every row in the pending queue — th | `supabase/migrations/20260816160000_sim_mail.sql:21` | Comment at :21-23: '-- The address we PAIRED on: the original per-SIM recipient, never the kosher-connect.com  → Reword the comment (and mirror it at the write site): '-- The recipient that best identifies the SIM: the addr |

### Why each one, in one line

- **isShabbatOrHoliday takes a `country` parameter it never reads — the calendar is deliberately country-blind** — The signature promises per-country holiday handling that money-deciding code (chargeable days, price) does not do. A maintainer adding an Israel rental feature would reasonably assume Israel rentals already use the 1-day calendar because the parameter is passed everywhere; the parameter is the lie, the comment is the truth, and the comment loses. Dropping the dead parameter makes the deliberate po
- **Display word 'out' leaked into a status comparison and silently matches nothing** — This is the naming hazard caught in the act: the app keeps two vocabularies for rental state (enum values vs display words) and one comparison picked from the wrong dictionary. Note this one-token fix is not behaviour-neutral — it repairs a silent gap where the AI draft never mentions a phone that is out but not yet overdue — which is exactly why the dual vocabulary is dangerous.
- **Who pays the SIM provider has three vocabularies: 'through-me'/'direct' (app), 'kc'/'customer' (DB), 'Through ** — Two-value enums with unrelated spellings on each side of a seam are where sign-flip bugs come from — the mapping only exists as `!== 'direct'`, and the default direction (unknown → KC fronts the renewal money and later charges the wallet) is a money decision that is currently invisible.
- **'reference' means airline PNR, ledger idempotency key and task dedupe key — two of them three lines apart in t** — The bare word is doing three jobs across the money and travel domains, and the codebase already shows the strain: one function defensively reads two spellings of the same field, and the PNR is assigned FROM a field named identically to the task dedupe key (`bookingReference: t.reference`, main.js:12099). One consistent camelCase name per concept at the API seam is a mechanical, migration-free swee
- **arrearsTotal is a negative number named as a positive quantity** — A field whose name reads 'total arrears' but whose value is negative is a trap for the next call site: printed raw it renders '−£350' as outstanding, and a `arrearsTotal > threshold` check silently never fires. The magnitude convention is what both existing consumers already reconstruct by hand.
- **'Charged Out Today' lumps revenue charged (no cash moved) with refunds physically handed back** — To the shop, 'charged out' reads as money that left — but most of the figure is invoicing that moved nothing, while the slice that DID leave the drawer (refund payouts) is hidden inside it. The codebase itself draws this exact distinction everywhere else (refunded vs paidOut in the revenue report, ledger.js:154-157), so the label is behind its own data model.
- **sim_mail.recipient's column comment claims it is 'the address we PAIRED on', but for every row in the pending ** — The column stores the app's best guess at WHO a message concerns, and the comment describes only the happy path; the unhappy path is the entire human queue. One sentence stops the next person from 'fixing' the fall-back at inbound/mail.js:265 as a bug.

## Tier 2 — structural. Needs a migration or moves data, so each carries its counter-argument.

**None of these is approved.** They are held for the owner per the port plan;
several touch money or the schema, and the counter-argument is there because in
at least two cases I think it wins.

### T2.1 · email_log is the shop's whole message log — SMS out, SMS in, opt-outs — and its columns lie hardest for SMS rows

- **Where:** `lib/inboundSms.mjs:80`
- **Evidence:** lib/sms.js:102 inserts SMS sends into email_log; lib/sms.js:116 puts the SMS BODY in `subject` and the E.164 phone number in `to_email`. For inbound texts, lib/inboundSms.mjs:80–84 puts the SENDER's number in `to_email` ("`to_email` holds the OTHER party either way"), the shop's own receiving number in `actual_to`, and the message text in `subject`. Migration 20260818200000_email_log_inbound_statuses.sql then taught the check constraint the statuses the code grew ('received', 'opt_out', 'invalid') — the schema chasing a table name that stopped being true.
- **Argument for:** Every name on this table now asserts email-ness the rows don't have: someone querying `to_email` for an address audit gets phone numbers; a `subject` report gets SMS bodies; for inbound rows `to_email` is actually the FROM. The 2026-08-18 status migration proves people already trip on the drift — the constraint silently ate 'invalid' rows until today. The route (message-log.js), the UI ("message log"), and the comments all use the honest name; only the schema doesn't.
- **Counter-argument:** It's an append-only audit table wired into lib/email.js, lib/sms.js, pages/api/email/webhook.js, sms-status.js, sms-inbound.js, cron/sweep.js, message-log.js, and two merge_customers DB functions — a rename must land atomically with a deploy or in-flight Twilio/Resend webhooks write to a table that no longer exists. The reuse is explicitly documented at every writer ("same table as email so there is ONE place to see every message"), and a compatibility view costs almost nothing versus that risk. Living with well-commented wrong names on an audit trail is a defensible trade.

### T2.2 · The `pools`, `master_accounts` tables and `lines.pool_id` FK describe a pool model no code has ever used — the real pools live in a settings JSON key

- **Where:** `supabase/migrations/20260712120000_initial_schema.sql:99`
- **Evidence:** grep across all .js/.mjs for `pools`, `pool_id`, `master_account` finds zero application code touching them (only the schema and RLS migrations). The live pool registry is the settings row `rental_pools` — a JSON array validated in pages/api/settings.js:350–382 ("Rental phone pools — name + activation window") and written by saveRentalPools (public/main.js:5035), while each phone's pool membership is a name string (`pool: 'Pool 3'`) inside lines.legacy_extras via the importer (lib/rentalPoolImport.mjs:286) — lib/mappers.js never writes pool_id.
- **Argument for:** The schema names assert "pools are relational data, joined from lines" — anyone (including the Supabase assistant the owner has standing approval to run SQL through) who queries `select * from pools` gets zero rows and could conclude the shop has no pools, while the 114-line USA pool optimiser is running fine off a settings blob. A table named for a job another structure actually does is exactly the kind of name that misleads at 9pm during an incident.
- **Counter-argument:** These tables read like the intended end-state of the documented transitional port (legacy_extras → typed columns, see tableStore.js's own header); dropping them now means re-creating them, their FKs and RLS at cutover, and empty tables misbehave in no way today. If the relational pool cutover is genuinely still planned, a SCHEMA.md note is the right fix and the drop is churn.

### T2.3 · rental_status 'booked' vs the flight-booking vocabulary: UI says Reserved, DB says booked, and 'booking' means flights everywhere else

- **Where:** `supabase/migrations/20260712120000_initial_schema.sql:13`
- **Evidence:** rental_status enum has 'booked', but every user-facing surface renders it as 'Reserved': main.js:2695 badge '📅 Reserved', 2552 '(reserved)', 4117 ', reserved', the creating variable is `isReservation` (3893, 4246) and the action is `startReservation` (2727, 4373). Meanwhile 'booking/Booked' is the flight vocabulary: bookings table (initial_schema.sql:332), ledger entry_type 'booking' (labelled '✈️ Flight' in main.js:8930), BOOKING_STATUSES = ['Booked', 'Ticketed', ...] (main.js:11818), and ticket-mail settle op 'booked' (main.js:12336). A grep for 'booked' returns two unrelated domains interleaved.
- **Argument for:** The code already thinks in 'reserved' (isReservation, startReservation, every label) — only the stored value disagrees. Finding 1 (`status === 'out'`) proves this codebase does mispick from parallel status vocabularies, and 'booked' is the value with an active collision against a whole second domain (flights).
- **Counter-argument:** The rename is not just ALTER TYPE: the app syncs whole rental arrays whose status strings also live inside `legacy_extras` blobs (rowToApp reads the blob back, lib/mappers.js:299), so old blobs saying 'booked' must be migrated or tolerated, and every one of the ~17 comparison sites must flip atomically with the deploy. The display map already quarantines the word to developer-only surfaces, so the payoff is grep hygiene, and a botched sweep risks the availability calendar and clash detection for it.

### T2.4 · One rentable phone, two names and two dictionaries: app/API 'phones' vs DB 'lines' — and '_lines' also means order line items

- **Where:** `lib/mappers.js:182`
- **Evidence:** The frontend and API layer say phone: `phones` array, `saveAllPhones`, `/api/phones` (main.js:68,390; pages/api/phones.js). The DB says line: table `lines`, `line_status`, `rentals.line_id` (initial_schema.sql:109). phoneToRow additionally translates field names: app company→carrier, country→region, simId→iccid, imei→wrap_imei (mappers.js:182-197). Meanwhile `purchase_order_lines` (20260817190000) and `goods_in_lines` (20260803220000) use 'lines' for order line items, and main.js uses `lines` for lines of text (e.g. customerContextForAi:9246). Grepping either word finds half the concept plus noise from the other meanings.
- **Argument for:** A maintainer tracing 'why does this phone show available?' must know four column aliases and that the table is called lines; a maintainer reading purchase_order_lines must know that `lines` (bare) is something entirely different. The concept crosses the seam five times with a different name each time.
- **Counter-argument:** 'Line' is the telecom-correct term (the rentable thing is a number/ICCID, not a handset — device_stock_item_id is separate), the mapper at lib/mappers.js:165 is a single, well-commented seam, and a table rename cascades through FKs (rentals.line_id, lines_current_rental_fk, pools), RLS, tableStore and the sync contract. `rental_lines` would also sit confusingly next to the existing `rental_items` (per-rental equipment). The real cost today is only grep-ability, which the mapper comment largely pays.

### T2.5 · rentals.country_code is a tariff key, not a country code — and the app field 'country' holds a different value set

- **Where:** `supabase/migrations/20260712120000_initial_schema.sql:163`
- **Evidence:** rental_rates.country_code holds 'USA', 'UK-UKmins', 'UK-Intl', 'Israel', 'Canada', 'USA-NoSIM' (seed 20260712120200:8-9; mappers.js rentalCountryCode:205-210) — two rows for one country split by minutes plan, and one keyed on whether a SIM was handed over. The app rental field `country` holds UK/USA/Israel/EU/Canada and needs a translator (`rentalCountryCode` in mappers.js, `pricedCountryCode` in main.js) plus the extra inputs ukPlan and simGiven to produce the 'country_code'. rentals.country_code and damage_rates.country_code FK onto it.
- **Argument for:** The name asserts ISO-style semantics the values deliberately violate: 'USA-NoSIM' is not a country, and one country legitimately maps to two codes. Anyone joining rentals to an external country dimension, or asserting one-code-per-country, is set up to be wrong — the misdirection lives in the schema itself where comments are least often read.
- **Counter-argument:** It is a primary key with two FKs, seed files, settings UI and two translator functions — a wide, purely cosmetic migration. The translator names (rentalCountryCode, pricedCountryCode) and the seed values themselves make the tariff nature obvious within a minute of reading, and display_name already carries the human label, so the realised confusion may never exceed that minute.

### T2.6 · "Money in today" is a different 'money in' from the sparkline drawn directly beneath it

- **Where:** `supabase/migrations/20260719160000_money_aggregates.sql:38`
- **Evidence:** ledger_day_flow.money_in = sum(amount) filter (amount > 0) — every positive ledger row, so it includes 'refund' (credit minted, no money arrived), 'rental_void', and positive manual_adjustments. But ledger_daily_series.received (20260817160000_ledger_daily_series.sql:33) and ledger_revenue_since.received count only entry_type in ('payment','top_up'). The dashboard hero (public/main.js:19704-19709) prints todayIn (day_flow) with the 'received' sparkline directly under it, and pages/api/ledger.js:93-95 explicitly promises "the sparkline under a figure has to be that figure's own history, not a second definition of 'money in'" — yet it is exactly a second definition. weekOnWeekHtml and the mont
- **Argument for:** The owner can see '£200 in today' above a flat sparkline on a day when the only positive row was a £200 refund credit — the two disagree by exactly the credits the shop minted, and the week-on-week and monthly-target figures inherit the looser definition. One number labelled 'Money in today' should mean money that came in.
- **Counter-argument:** money_in-as-all-positive-rows is the honest wallet-flow view: it reconciles exactly against the Recent activity feed shown on the same Wallet tab (which lists every entry), and refunds/voids are rare enough that the two definitions usually agree to the penny. Changing it needs a migration and makes todayIn stop matching the feed it sits beside.

### T2.7 · ledger_daily_series.charged includes refund_payout despite its own must-agree comment

- **Where:** `supabase/migrations/20260817160000_ledger_daily_series.sql:32`
- **Evidence:** charged = sum(-amount) filter (amount < 0) with no entry_type exclusion. The comment above it (lines 29-31) says "Same split as ledger_revenue_since: ... The two copies must agree, so if one changes the other has to" — but 20260731100100_refund_payout_sign.sql:38-39 changed ledger_revenue_since to exclude refund_payout from charged precisely because "charged sums every money-out row, which would book a refund payout as revenue earned — the exact opposite of what happened". The daily series never got the same fix.
- **Argument for:** A £50 cash refund handed back shows as £50 of 'charged' on the trend for that day while the revenue report for the same window shows £0 — the two figures the comment insists must agree already disagree, in the direction the 20260731 migration called 'the exact opposite of what happened'.
- **Counter-argument:** The charged series is not currently rendered anywhere — dashSparkHtml is only ever called with 'received' (public/main.js:19709) — so today no user sees the wrong number; a migration purely to fix an unused column can wait until the charged trend ships.

### T2.8 · Cash-up 'money in by method' counts refund credits and adjustments that brought no money in

- **Where:** `pages/api/cashup.js:43`
- **Evidence:** summarize() puts EVERY positive ledger row into totalIn and the per-method breakdown; rows with no method land under 'unspecified' (rendered as '— no method recorded' in the cash-up modal, public/main.js:9754). But ledger.js:288-296 deliberately forces method=null on refund and adjustment rows, and rental_void rows carry no method either — so a £100 refund credit or void appears on the Z-report as £100 of money in, '— no method recorded', even though the drawer and the card machine saw nothing. The file header (cashup.js:2) promises "the day's money-in broken down by method".
- **Argument for:** At the end of the day the person counting the till reads that list as 'what we took today by tender'. A refund credit inflating it — under a label that sounds like sloppy record-keeping rather than a non-cash event — sends them hunting for money that never existed. expectedCash is already immune (cash-method only), so the breakdown is the one part still using the loose definition.
- **Counter-argument:** Showing every positive row means the modal's total reconciles exactly with the Wallet tab's 'Money In Today' (same day_flow definition) and with the raw ledger; hiding method-less credits from the day screen would also hide the day a helper's minted credit appears — the one screen an owner glances at nightly. And forced-null methods (ledger.js:290-292) mean the corruption is bounded to the 'unspecified' row.

### T2.9 · 'wallet' is an accepted tender method for money-in, which is self-referential

- **Where:** `pages/api/ledger.js:32`
- **Evidence:** METHODS includes 'wallet', so POST /api/ledger accepts a positive 'payment' or 'top_up' tendered 'from the wallet' — but a positive ledger row IS wallet credit, so such a row mints credit while claiming the money came from the very balance it increases. The file already states the principle for payouts (lines 33-35: "the wallet credit IS the thing being settled, so tendering it against itself would book the payout twice") but only applies it one way. No client sends it: openWalletModal offers cash/card/bank_transfer/voucher/other (public/main.js:9550-9556), shop.js:19 and service-orders.js:17 and kol-torah.js:25 all define METHODS without 'wallet', and shop.js:310-312 deliberately posts NO p
- **Argument for:** The one row shape this validation permits is exactly the double-credit the payout comment warns about, mirrored: an API caller (or future screen wired to the server's list rather than the modal's) can book £50 'paid from wallet' that both raises the balance £50 and shows as £50 money in on the Z-report under a tender no drawer or terminal ever saw.
- **Counter-argument:** The payment_method enum (20260712120000_initial_schema.sql:10) contains 'wallet' because charge-side rows may one day want to record 'settled from credit' against a specific invoice; tightening validation is a server behaviour change that could break an unknown caller, and since no current screen sends it the hole is theoretical until someone scripts against the API.

### T2.10 · Cash rental deposits sit in the drawer but outside the ledger, so the Z-report can't see them

- **Where:** `public/main.js:4340`
- **Evidence:** "#26 — optional refundable deposit, tracked as held (not a wallet charge)" — depositHeld lives only on the rental record; no ledger row, no method, is ever written. expectedCash (lib/money.mjs:83-89, wired via pages/api/cashup.js:54) is opening float + net cash-method ledger rows. So a £50 deposit taken in cash physically enters the till but expectedCash excludes it: the count reads £50 'over' the day it's taken and £50 'short' the day it's refunded, and nothing in the cash-up modal (main.js:9787-9798) mentions deposits at all.
- **Argument for:** The gate checklist treats the deposit seriously (main.js:964-968 blocks closing a rental until it's settled), but the till reconciliation — the other place that money physically exists — has no idea it exists. A variance caused by a deposit is indistinguishable from theft or a mis-key, which defeats the point of counting.
- **Counter-argument:** Keeping deposits out of the ledger is a documented, deliberate choice (main.js:5439: 'money the shop is holding that belongs to somebody else') — posting them would distort the customer balance and every revenue aggregate unless every reader learns to exclude the new types, which is a lot of migration surface; deposits may also usually be taken by card or kept out of the drawer, making the drift rare in practice. The one-line label fix costs nothing and removes the ambiguity at the point of use.

### T2.11 · Customer merge re-parents the FK the app never reads; SIMs and rentals keep belonging to the deleted duplicate and their edits silently stop syncing

- **Where:** `lib/tableStore.js:521`
- **Evidence:** public/main.js:11036 renders SIM ownership as custNameLink(s.customerId, capName(s.customerName)) straight from the blob, so a merged-away customer's SIMs display under a ghost record whose link opens nothing. Worse: syncSims (lib/tableStore.js:519-523) resolves s.customerId via legacyIdMap('customers'); the duplicate's row was deleted by the merge, so every moved SIM is skipped with reason `customer <id> not synced` — the skip is only a server console.warn (:528), meaning any later edit to those SIMs never persists. syncRentals has the identical skip at :244.
- **Argument for:** This is the one place where the typed projection and the app-visible truth actively disagree about WHO owns a record, and the failure is silent: the shop merges Shmiel into Shmuel, the toast says '3 sims moved', and the SIM tab keeps saying Shmiel while the database says Shmuel and edits quietly vanish. 470 of 609 customers hold a shop-run SIM, and duplicates-to-merge are common (the sheet import made a row per line).
- **Counter-argument:** The transitional-bridge migration (20260712120500) is explicit that the blobs die at cutover, when main.js reads typed columns — so both fixes are throwaway work against the stated plan, and overriding blob fields on read partially breaks the 'blob round-trips exactly' contract that the strangler port depends on: the next whole-array sync writes the derived name back into the blob, which is exactly the double-write the provider-canonical migration had to reason carefully about.

### T2.12 · sim_mail.customer_id is a pair-time copy of the SIM's owner that nothing ever reads — it already needed one bug-fix migration and still goes stale on SIM re-assignment

- **Where:** `pages/api/inbound/mail.js:276`
- **Evidence:** Migration 20260817200000_merge_customers_sim_mail.sql exists solely because this copy went stale: 'the duplicate's carrier mail quietly lost its customer' when merge_customers() didn't know about the table. The same staleness class is still open — saveSimForm (public/main.js:11197, applied on edit at :11239) lets staff move an existing SIM to a different customer, which updates sims.customer_id on the next sync but leaves every already-filed sim_mail row pointing at the old owner.
- **Argument for:** A denormalised person-reference that is written in two places, has already consumed a production bug and a migration to keep consistent, and is consumed by zero code paths is pure liability: the next feature that innocently reads it ('show this customer's carrier mail') inherits the stale rows from every SIM that ever changed hands.
- **Counter-argument:** The copy is the only thing that keeps a message owned at all once its SIM row is deleted (sims are deletable via syncSims deleteByIds, and sim_id then nulls out) — so it is deliberate provision, not an accident; and since nothing reads it yet, the staleness has zero user-visible cost today, while a join-on-read costs an extra lookup on the hottest queue in the app.

### T2.13 · The carrier account email — the routing identity that pairs 734 of 797 SIMs to their mail — exists only inside the legacy_extras blob, with no typed column

- **Where:** `supabase/migrations/20260712120000_initial_schema.sql:255`
- **Evidence:** lib/simMailMatch.mjs:3-5 states the stakes: '734 of 797 SIMs carry the address their carrier account is registered under (legacy_extras.email)' — it is the primary pairing key, ahead of the phone number. The precedent is migration 20260816140000_sim_provider_canonical.sql, which promoted/canonicalised provider and documents (:9, :32-43) that any fix must land in BOTH the column and the blob because the app round-trips from the blob — email today has not even the column half of that pair.
- **Argument for:** A maintainer looking at the sims table in Supabase cannot see, filter or index the one field that decides where every piece of carrier mail lands; 'which SIMs share this mailbox' — the question behind every ambiguous queue row — is unanswerable in SQL. The provider column shows the team already decided routing-relevant SIM identity belongs in the typed projection.
- **Counter-argument:** All three readers share one access pattern through buildSimIndex, and the matching itself needs mailboxKey's Gmail dot/plus normalisation, which a raw SQL column would not give you anyway — so the column buys an index nobody currently queries, at the price of committing to the column+blob double-write dance that the provider migration shows is easy to get wrong; the cheapest correct moment to type it is cutover, when the blob dies.

## The refuter pass — what did not survive

A scan whose refuter kills nothing was not refuted. Three findings were opened
at their line and did not hold:

- **Recent print/online service orders are pushed into the customer card as `type: 'sim'`** (`public/main.js:6923`)
  KILLED. Read the array: within allActiveServices, `type` is consumed only as the CSS class at main.js:7033-7034, and the print row has no simId so it renders as a span, not a SIM button. The filtering risk the finding describes is real in this file but on a DIFFERENT array (`c.services`, filtered by type !== 'sim' at 6768 and 6996) — so the accusation attaches to the wrong line. A one-word comment would settle it; a rename is churn.

- **normalizeUkNumber recognises and rewrites Israeli numbers — the UK in the name undersells a multi-country normaliser** (`lib/ukPhone.mjs:26`)
  KILLED. The Israeli branches exist precisely BECAUSE the name's domain is a UK shop: they stop 05x mobiles being corrupted into +44 non-numbers (a real sweep finding, 2026-08-02 #18), and the file's header documents every branch in precedence order before any code. A function named for the shop's home market that carefully handles the one other market its customers use is not lying; renaming it would ripple through every caller for no gain.

- **buildSimIndex's input field is named `email`, the same identifier the codebase uses for the customer's contact identity — the two ** (`lib/simMailMatch.mjs:78`)
  KILLED as a duplicate. The module faithfully mirrors the app-level field name on `sims`; it cannot rename someone else's field. The genuine confusion — that a SIM's carrier-account address is an identity, not a contact detail — is already the tier-2 finding on the carrier account email, and fixing it there fixes this.

## What this scan did not look at

State machines, silent defaults, and the shape of the plan — three of the seven
lenses — never ran. The silent-defaults lens in particular was written to hunt
the class of bug that produced the ticket-mail `confirmation` default fixed on
18 August; others of that shape are likely still standing and unfound. This
document should not be read as a complete map.

