# Clarity scan — where the code says one thing and means another

Dated **18–19 August 2026** (port item B1). **Document only: no behaviour was
changed by this scan.** Implemented from the brief alone — the source repo is
not reachable from this session.

## How much of this ran, honestly

Seven lenses were planned. **All seven have now run.** Four completed on
18 August — names that lie, vocabulary drift, money whose meaning is ambiguous,
and the person is denormalised. The remaining three — state machines, silent
defaults, and the shape of the plan — were lost that night to a monthly spend
limit and were **run on 19 August**; their findings are the last three sections
before the refuter pass.

The adversarial refuter agent and the synthesis agent died with the first run
and were never revived, so **the refuting and the diagnosis are mine, done by
reading the code the findings point at** — every claim in this document was
re-opened at its file and line before it was kept or killed. Of the six
findings the last three lenses raised, **two were killed on refutation and one
had its citation corrected**; the tally is at the foot of the refuter section.

The source repo (`earothbart-ai/pixel-perfect-peek`) is **not reachable from
this environment** — cross-owner `add_repo` is refused — so the method here is
rebuilt from the brief's description of it, not copied from the original scan.

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

**Sharpened on 19 August by the shape-of-the-plan lens, and this is the version
to act on.** The sentence above says the two models run "with no rule about
which is true". That was wrong, and being wrong about it made the problem look
worse in one way and better in another. There *is* a rule. It is written down,
in the header of `lib/mappers.js:4-6`:

> "legacy_extras stores the COMPLETE app object, so reading back is an exact
> round-trip **regardless of how much the typed projection captures**. The
> typed columns exist for SQL, FK integrity, and the post-cutover world."

So the blob wins, deliberately, and the typed columns are a projection for a
cutover that has not happened. The real finding is what that means per table,
which nothing states anywhere:

| table | app READS | app WRITES | drift detectable? |
|---|---|---|---|
| `customers` | typed columns + blob | both | **yes** — `customerDrift`, `lib/mappers.js:149` |
| `sims` | **blob only** | both | no |
| `rentals` | **blob only** | both | no |
| `lines` | **blob only** | both | no |

`lib/tableStore.js:34-46` is the whole of it: `listApp()` selects the single
column `legacy_extras` and nothing else. For three of the four tables the
typed columns are **write-only** — the app fills them in and never reads them
back. So the diagnosis is not "no rule about which model is true"; it is:

> **One model is read and the other is written, and which is which changes per
> table, and that fact is recorded nowhere a maintainer would look.**

That is a better diagnosis because it explains a finding the first pass could
only describe. "Customer merge re-parents a foreign key the app never reads"
is not a curiosity — it is the *predicted* consequence of re-parenting a typed
column on `sims`, a table whose typed columns are never read.

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

## The one that was a live bug, not a rename — FIXED

> **Closed.** This was written as unfixed and called the most valuable thing the
> scan found. It was fixed in `604d53f` ("Fix the defects the audits found"),
> the same commit that settled two of the claims-audit held items — and this
> section went on saying "I have deliberately not made it" for two days after.
> Verified 21 Aug at `public/main.js:10443`: the filter is now
> `r.status === 'active' || r.status === 'booked'`, with a comment naming the
> enum. A scan that reports finished work as outstanding sends the reader
> chasing it, which is the same fault this file criticises elsewhere.
>
> What it said, kept because the reasoning is the point:

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
## A latent one, found on 20 August by checking a claim rather than trusting it

`public/main.js:2025` — `isShabbatOrHoliday(date, country)` **declares a
`country` parameter and never reads it.**

It matters now in a way it did not before. Two functions answer "was this day
free":

| | who asks | reads |
|---|---|---|
| `isShabbatOrHoliday(day, country)` | `calcRentalPrice` — decides what is **charged** | Shabbos, `DIASPORA_HOLIDAYS` |
| `freeDayReason(day)` | the named free days on screen, and since 20 Aug the **shaded cells in the emailed receipt's calendar** | Shabbos, `DIASPORA_HOLIDAYS` |

They agree — but by both happening to read the same map, not by construction.
The receipt now draws the shop's working for the customer, so the two agreeing
has stopped being an internal tidiness question and become a claim made to a
person about their bill.

The unused parameter is the hazard. It reads as though country already matters,
so the natural way to make Israeli rentals keep one day of yom tov instead of
two is to fill it in — at which point the price changes and the receipt's
calendar does not, and a customer is looking at a shaded day they were charged
for. Nothing would fail; the number and the picture would simply stop meaning
the same thing.

**Fixed 21 Aug on the owner's go-ahead ("do all").** The parameter is gone from
`isShabbatOrHoliday`, and from `countChargeableDays` — the late-fee counter,
which took a country from two call sites and binned it. `calcRentalPrice` keeps
its own `country`, which it genuinely needs for `rateFor`. Behaviour is
unchanged by construction: the argument was never read, so removing it cannot
alter a price. **And the rule was never in doubt** — BUSINESS_RULES.md:59, decided 12 Jul
2026: *"the full 2-day Yom Tov calendar applies to all rentals, including
Israel phones — guests renting for Eretz Yisroel keep both days of Yom Tov, so
there is no separate 1-day Israel calendar in pricing."* The parameter was not
an unfinished feature. It was a signature contradicting a decision the shop had
already taken and written down, sitting in the money path where somebody would
eventually believe it.

What was already in place before the fix: What HAS been done is behaviour-neutral: `test/freeDayAgreement.test.mjs`
walks every day of 2025–2027 against every country the form offers and asserts
the two answers are the same, plus pins the parameter as unused. Both mutations
were checked — teaching the pricer to honour `country`, and stopping the reader
naming yom tov — and each fails the suite. The drift can still be *chosen*; it
can no longer happen quietly.

## Tier 1 — renames and comments. Zero behaviour change.

| # | finding | file:line | current → proposed |
|---|---|---|---|
| 1 | ✅ **DONE 21 Aug** — isShabbatOrHoliday takes a `country` parameter it never reads — the calendar is deliberately country-blind | `public/main.js:1647` | function isShabbatOrHoliday(date, country) — callers at main.js:1862 (calcRentalPrice) and main.js:1972 (count → isShabbatOrHoliday(date) — drop the parameter at the definition and both call sites (zero behaviour change), o |
| 2 | ✅ **DONE** (`604d53f`) — display word 'out' leaked into a status comparison and silently matches nothing | `public/main.js:9253` | r.status === 'out' → r.status === 'active' |
| 3 | ✅ **DONE 21 Aug** (comment at `lib/mappers.js`, the inverting line) — who pays the SIM provider has three vocabularies: 'through-me'/'direct' (app), 'kc'/'customer' (DB), 'Through me'/'KC pa | `lib/mappers.js:273` | paymentType 'through-me'/'direct' ↔ paid_by 'kc'/'customer', linked only by an uncommented inversion → state the dictionary at both ends: a comment on the sim_payer enum ('app value through-me = kc, direct = custo |
| 4 | ✅ **DONE 23 Aug** (owner: "rename these") — 'reference' means airline PNR, ledger idempotency key and task dedupe key — two of them three lines apart in the same fi | `pages/api/ticket-mail.js:82` | app field `reference` = PNR on ticket-mail objects, idempotency key on ledger entries; bookings use bookingRef → in ticket-mail's toApp, name the PNR `bookingReference` (matching bookings) and update its main.js consumers ( |
| 5 | ✅ **DONE 23 Aug** — arrearsTotal is a negative number named as a positive quantity | `pages/api/ledger.js:231` | arrearsTotal: -350.00 (negative = customers owe £350), silently abs'd at every point of use → serve the magnitude at the boundary — `arrearsTotal: Math.abs(Number(totals.owed) \|\| 0)` — and drop the two  |
| 6 | ✅ **DONE 23 Aug** — 'Charged Out Today' lumps revenue charged (no cash moved) with refunds physically handed back | `public/main.js:9718` | 'Charged Out Today' = \|charges billed + refunds paid out\|, one figure, called 'charged' → relabel to 'Charged & paid out today' (or 'Billed today' if payouts get their own line); comment on cashup.js  |
| 7 | ✅ **DONE 22 Aug** (at the write site, `pages/api/inbound/mail.js` — the applied migration file is left untouched on purpose: editing an applied migration to fix prose invites checksum/`db diff` noise for zero runtime gain, and the write site is where a reader lands from the code) — sim_mail.recipient's column comment claims it is 'the address we PAIRED on', but for every row in the pending queue — th | `supabase/migrations/20260816160000_sim_mail.sql:21` | Comment at :21-23: '-- The address we PAIRED on: the original per-SIM recipient, never the kosher-connect.com  → Reword the comment (and mirror it at the write site): '-- The recipient that best identifies the SIM: the addr |
| 8 | ✅ **DONE 22 Aug** (comment at the SIM form's status options, `public/main.js` — where the maintainer tempted to add the option is standing; the applied migration is left untouched for the same reason as #7) — `sim_status.renewal_pending` is drawn by the customer portal in both languages and set by no code path | `supabase/migrations/20260712120000_initial_schema.sql:17` | enum value with no writer → comment the enum value: `-- renewal_pending: drawn by the portal (pages/portal.js:83,156,677); NOTHING sets it. Either give the SIM form the option or drop it — do not leave it half-built.` |
| 9 | ✅ **DONE 21 Aug** (comment at `getComputedStatus`, where it is computed — not in the applied migration) — `rental_status.overdue` is declared but never stored; it is computed from dates at read time | `supabase/migrations/20260712120000_initial_schema.sql:13` | enum value no row occupies → comment: `-- overdue is COMPUTED, never stored — see getComputedStatus (public/main.js:3056). A query filtering on it returns nothing, correctly.` |
| 10 | ~~A dead second default~~ — **WITHDRAWN 21 Aug: the column IS nullable** | `pages/api/kol-torah.js:236` | The finding said line 211 validates the method into `METHODS`, so `row.method \|\| 'cash'` is dead and misleads a reader into thinking the column is nullable. `kt_settlements.method` is declared `method text` — nullable, no default (`20260719220000_kol_torah.sql:64`) — and `postSettlementLedger` is also called on a row READ BACK from the table on the duplicate path (`:249`), not only on the one just inserted. So the fallback is a live guard on a re-run over an older row, and deleting it would have changed what a retry posts. **Keep it.** |
| 11 | ✅ **DONE 21 Aug** — the read/write split between typed columns and the blob is stated in one file's header and nowhere the maintainer of another file would look | `lib/tableStore.js:34` | `listApp()` selects `legacy_extras` alone, with no comment saying that is the whole model → comment at the select: `-- Reads the BLOB ONLY. sims/rentals/lines typed columns are write-only (see lib/mappers.js:4-6). customers is the exception — it reads typed and drift-checks.` |

> **Progress, 21 Aug.** Five of the eleven are done: 1, 2, 3, 9 and 11. One (10)
> was WITHDRAWN on inspection — see its row. The five left are 4 (the `reference`
> rename across a seam), 5 (`arrearsTotal` sign), 6 (a label change staff read),
> 7 and 8 (comments whose natural home is an APPLIED migration file). The last
> two are deliberately not done that way: a migration that has run is a
> historical record, and editing its text to teach a future reader something is
> the wrong place to teach it. 8 is already Issue #13.
>
> **Progress, 23 Aug.** Tier 1 is CLOSED. The owner approved 4, 5 and 6 in one
> word ("rename these") and they shipped together: the ticket-mail seam serves
> `bookingReference` and its thirteen main.js consumers follow; `arrearsTotal`
> serves the magnitude at the boundary and the two point-of-use `Math.abs`
> calls are gone; the wallet stat reads 'Charged & paid out today' with the
> why-both comment on cashup.js's summing loop. 8 stopped being a comment and
> became the real thing the same day — issue #13 shipped the form option plus
> the automatic flip.

### Why each one, in one line

- **isShabbatOrHoliday takes a `country` parameter it never reads — the calendar is deliberately country-blind** — The signature promises per-country holiday handling that money-deciding code (chargeable days, price) does not do. A maintainer adding an Israel rental feature would reasonably assume Israel rentals already use the 1-day calendar because the parameter is passed everywhere; the parameter is the lie, the comment is the truth, and the comment loses. Dropping the dead parameter makes the deliberate po
- **Display word 'out' leaked into a status comparison and silently matches nothing** — This is the naming hazard caught in the act: the app keeps two vocabularies for rental state (enum values vs display words) and one comparison picked from the wrong dictionary. Note this one-token fix is not behaviour-neutral — it repairs a silent gap where the AI draft never mentions a phone that is out but not yet overdue — which is exactly why the dual vocabulary is dangerous.
- **Who pays the SIM provider has three vocabularies: 'through-me'/'direct' (app), 'kc'/'customer' (DB), 'Through ** — Two-value enums with unrelated spellings on each side of a seam are where sign-flip bugs come from — the mapping only exists as `!== 'direct'`, and the default direction (unknown → KC fronts the renewal money and later charges the wallet) is a money decision that is currently invisible.
- **'reference' means airline PNR, ledger idempotency key and task dedupe key — two of them three lines apart in t** — The bare word is doing three jobs across the money and travel domains, and the codebase already shows the strain: one function defensively reads two spellings of the same field, and the PNR is assigned FROM a field named identically to the task dedupe key (`bookingReference: t.reference`, main.js:12099). One consistent camelCase name per concept at the API seam is a mechanical, migration-free swee
- **arrearsTotal is a negative number named as a positive quantity** — A field whose name reads 'total arrears' but whose value is negative is a trap for the next call site: printed raw it renders '−£350' as outstanding, and a `arrearsTotal > threshold` check silently never fires. The magnitude convention is what both existing consumers already reconstruct by hand.
- **'Charged Out Today' lumps revenue charged (no cash moved) with refunds physically handed back** — To the shop, 'charged out' reads as money that left — but most of the figure is invoicing that moved nothing, while the slice that DID leave the drawer (refund payouts) is hidden inside it. The codebase itself draws this exact distinction everywhere else (refunded vs paidOut in the revenue report, ledger.js:154-157), so the label is behind its own data model.
- **sim_mail.recipient's column comment claims it is 'the address we PAIRED on', but for every row in the pending ** — The column stores the app's best guess at WHO a message concerns, and the comment describes only the happy path; the unhappy path is the entire human queue. One sentence stops the next person from 'fixing' the fall-back at inbound/mail.js:265 as a bug.
- **`sim_status.renewal_pending` is drawn by the portal and set by nothing** — This is the half-built state in its purest form: the customer-facing half is complete, correct and bilingual, and no half exists that could ever produce it. The cost is not a broken screen — nothing looks broken — it is that the one SIM state the shop built a customer warning for cannot occur, so the warning is decoration. A comment is the cheap fix; deciding whether to finish it or drop it is the owner's, because giving the staff form a fourth option changes what staff see.
- **`rental_status.overdue` is declared but never stored** — Kept deliberately weak. The design is right; only the enum's silence about it is wrong, and a maintainer's wasted afternoon on a query that returns nothing is the whole cost. It is in Tier 1 rather than dropped because the comment costs one line and the confusion recurs for every new reader.
- **~~A dead second default on an already-guaranteed column~~ — WITHDRAWN.** The reasoning was right and the premise was not: the column is nullable, and the second caller the finding worried about already exists (the duplicate path re-posts from a row read back out of the table). Checked before acting on it, which is the only reason this document is not one deletion worse. It is the fourth claim in this file to be wrong on inspection — see the AI-drafter section, T2.2, and the `country` parameter.
- **The read/write split is documented in one file's header and nowhere else** — This is the single most valuable comment in the list. `lib/tableStore.js:34` is where a maintainer arrives when asking "where does a SIM come from", and it currently answers with a one-column select and no explanation. Every downstream confusion in this document — the unread FK, the write-only typed columns, the undetectable drift — is legible from that line once the line says what it is doing.

## Tier 2 — structural. Needs a migration or moves data, so each carries its counter-argument.

**None of these is approved.** They are held for the owner per the port plan;
several touch money or the schema, and the counter-argument is there because in
at least two cases I think it wins.

### T2.1 · email_log is the shop's whole message log — SMS out, SMS in, opt-outs — and its columns lie hardest for SMS rows

- **Where:** `lib/inboundSms.mjs:80`
- **Evidence:** lib/sms.js:102 inserts SMS sends into email_log; lib/sms.js:116 puts the SMS BODY in `subject` and the E.164 phone number in `to_email`. For inbound texts, lib/inboundSms.mjs:80–84 puts the SENDER's number in `to_email` ("`to_email` holds the OTHER party either way"), the shop's own receiving number in `actual_to`, and the message text in `subject`. Migration 20260818200000_email_log_inbound_statuses.sql then taught the check constraint the statuses the code grew ('received', 'opt_out', 'invalid') — the schema chasing a table name that stopped being true.
- **Argument for:** Every name on this table now asserts email-ness the rows don't have: someone querying `to_email` for an address audit gets phone numbers; a `subject` report gets SMS bodies; for inbound rows `to_email` is actually the FROM. The 2026-08-18 status migration proves people already trip on the drift — the constraint silently ate 'invalid' rows until today. The route (message-log.js), the UI ("message log"), and the comments all use the honest name; only the schema doesn't.
- **Counter-argument:** It's an append-only audit table wired into lib/email.js, lib/sms.js, pages/api/email/webhook.js, sms-status.js, sms-inbound.js, cron/sweep.js, message-log.js, and two merge_customers DB functions — a rename must land atomically with a deploy or in-flight Twilio/Resend webhooks write to a table that no longer exists. The reuse is explicitly documented at every writer ("same table as email so there is ONE place to see every message"), and a compatibility view costs almost nothing versus that risk. Living with well-commented wrong names on an audit trail is a defensible trade.

### T2.2 · The `pools` table and `lines.pool_id` FK describe a pool model no code has ever used — the real pools live in a settings JSON key

> **Corrected 21 Aug, and it was nearly an expensive mistake.** This finding
> named `master_accounts` alongside `pools` as an unused table. `pools` is
> genuinely empty and `lines.pool_id` is never set — but **`master_accounts`
> holds ten real Three accounts and ten SIMs point at them**, and
> `account_email` on those rows is the carrier login the line actually sits
> under. Acting on the finding as written would have dropped live data.
>
> Worse, it was live data nothing read: `buildSimIndex` was fed only
> `legacy_extras.email` and `alt_emails`, so for the three SIMs whose blob holds
> a POOLED mailbox (`gittb.i.lig@`, 253 lines) while the master account holds
> the address that names the line, the naming address was invisible to the
> carrier-mail matcher. Twenty-two messages were unresolved at one such address
> on the morning of 21 Aug. Fixed the same day — `simMatchRow` in
> `lib/simMailMatch.mjs`, no migration, nothing written.
>
> The lesson is the one this file keeps learning: a finding about dead code is
> a claim about what runs, and a row count is cheap to check.



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

## Lens 5 — state machines: states declared, states reachable, states drawn

Every enum in `supabase/migrations/20260712120000_initial_schema.sql` and its
later `add value` migrations, held against the code that writes each value and
the screens that draw it. Two survived refutation.

### S1 · `sim_status.renewal_pending` — the customer portal draws it in two languages and nothing can produce it

Declared at `supabase/migrations/20260712120000_initial_schema.sql:17` and
accepted at `lib/mappers.js:270`. The customer portal renders it fully: an
English label "Renewal due" (`pages/portal.js:83`), a Hebrew one "לחידוש"
(`pages/portal.js:156`), and a warning-coloured badge (`pages/portal.js:677`)
— it is grouped with `overdue` as one of the two states worth alarming a
customer about.

Nothing writes it. The staff SIM form offers three options — Active, Suspended,
Cancelled (`public/main.js:12309-12311`). No API route, no migration, no import
script sets it. A customer can never see the one SIM state the portal was built
to warn them about.

The interesting half is *why it reads as fine*: the portal's own code is
correct and complete. Nothing in the portal is broken. The gap is entirely
between two files that never mention each other.

### S2 · `rental_status.overdue` is declared but never stored — it is computed at read time

`rental_status` declares four values (`…initial_schema.sql:13`). Three are
stored. `overdue` appears nowhere else in the repository except that
declaration: `getComputedStatus` (`public/main.js:3056-3058`) derives it from
`toDate < today` every time it is asked.

Computing it is the right design — a stored `overdue` needs a nightly job and
goes stale between runs. The finding is not the design, it is that the enum
advertises a state a maintainer will reasonably believe rows occupy. A
`where status = 'overdue'` returns nothing, correctly and confusingly.

**Counter-argument, and it is a fair one:** an enum is a permitted set, not a
promise of occupancy. Kept as a Tier 1 comment only, not a migration — see
T1 additions. It is the weakest finding in this document and is recorded at
that strength deliberately.

## Lens 6 — silent defaults: where an absent value becomes a meaningful one

The lens the 18 August run most wanted, because it is written to catch the
class of bug fixed that afternoon: the ticket-mail classifier defaulted to
`confirmation`, so every unreadable airline email asserted a booking. The rule
that fix wrote down is the lens: **"a default that names a meaning is a
guess"** (`lib/ticketMail.mjs`, commit 96e0112).

Searching every `||`/`??` fallback onto a `method`, `kind`, `type`, `status`,
`category`, `confidence` or `source` across `lib/`, `pages/api/` and
`public/main.js` returns six candidates. Four are neutral by construction
(`'other'`, `'unknown'`, `'none'`, `''`) and are the pattern working. Two named
a meaning and were investigated; **both were killed** — see the refuter pass.

The lens's real result is therefore a negative one, and worth stating as such:
**no second instance of the ticket-mail bug is present.** `pages/api/cashup.js:45`
shows the codebase has internalised the rule — an absent method there becomes
the neutral `'unspecified'` rather than a plausible `'cash'`, and that string
exists for no other reason.

One piece of genuine dead code fell out: `pages/api/kol-torah.js:236` applies
`row.method || 'cash'` to a column that line 211 already guaranteed is
populated. Harmless, and worth a comment rather than a change.

## Lens 7 — the shape of the plan

This was the lens written to test the standing hypothesis, and it is the one
whose absence the 18 August run flagged as most costly. Its finding is in the
diagnosis above, because it changes the diagnosis: the two-model split is
**declared policy** (`lib/mappers.js:4-6`), not drift, and the app reads the
blob exclusively for three of the four tables that carry one
(`lib/tableStore.js:34-46`).

One further finding of its own:

### P1 · The drift detector covers one of the four tables, and reports to a server console

`customerDrift` (`lib/mappers.js:149`) compares a stored row's typed columns
against what the blob would derive, and is genuinely good: tested
(`test/customers.test.mjs:47,53`), and wired into the read path
(`lib/tableStore.js:88`).

Its output is `console.warn` (`lib/tableStore.js:91`). There is no
`simDrift`, `rentalDrift` or `lineDrift`.

So the one mechanism that can detect the central problem in this document
covers `customers` — the table that needs it *least*, being the only one whose
typed columns are read and therefore the only one where drift has a visible
symptom — and does not cover `sims`, `rentals` or `lines`, where drift is
undetectable in principle because nothing reads the typed side to compare.
Where it does run, it tells a log file.

**Counter-argument:** on the three blob-only tables, drift between a written-
but-never-read column and the blob has no user-visible consequence *today*.
That is true, and it is precisely the argument that makes the cutover the
brief's "post-cutover world" dangerous: the day anything starts reading those
columns, every one of them is of unknown age, and there is no record of when
they diverged. A detector is cheap now and archaeology later.

## The refuter pass — what did not survive

A scan whose refuter kills nothing was not refuted. **Six findings were opened
at their line and did not hold** — three from the first four lenses, three from
the last three. The 19 August additions are first because two of them are kills
of findings raised the same day, which is the pass working at full speed.

### From lenses 5–7 (19 August)

- **A Kol Torah settlement invents `method: 'cash'` when none was recorded** (`pages/api/kol-torah.js:236`)
  KILLED, and it took two corrections to kill properly. First the citation was
  wrong: line 236 defaults a column that line 211 already populated, so 236 is
  dead code and the invention, if any, happens at
  `const method = METHODS.includes(b.method) ? b.method : 'cash'` (line 211).
  Then the harm was wrong too. The claim was that an unmethoded settlement
  would flow into `cashExpected` (`lib/money.mjs:83-88`), which counts every
  `method === 'cash'` row into the expected drawer, leaving the person counting
  up short with no explanation — and cash-up does read every ledger row in the
  day window unfiltered (`pages/api/cashup.js:22`), so the mechanism is real.
  But the input cannot be absent: the settlement control is a fixed four-option
  `<select>` (`public/main.js:17904-17906`) whose values are exactly `METHODS`.
  'cash' is the first option, so it is a **visible** default the operator is
  looking at and can change — the opposite of a silent one. A direct API call
  could still trip line 211, but that is a threat model, not a clarity finding.

- **Restoring a parked till sale defaults its method to cash** (`public/main.js:17407`)
  KILLED for the same reason and more cheaply. `posMethod = target.method || 'cash'`
  restores a sale the operator parked minutes earlier and is standing in front
  of; the method buttons are re-rendered on the same line
  (`public/main.js:17410`). A default nobody can miss is a starting position,
  not a claim.

- **`rental_status.overdue` is declared but never stored** (`…initial_schema.sql:13`)
  SURVIVED, but barely, and is recorded at its real strength rather than
  written up as though it were a bug. See the counter-argument under S2: an
  enum is a permitted set, not a promise of occupancy. It earns a comment and
  nothing more. Noted here because a refuter pass that only reports kills
  hides the findings it merely weakened.

### From lenses 1–4 (18 August)

- **Recent print/online service orders are pushed into the customer card as `type: 'sim'`** (`public/main.js:6923`)
  KILLED. Read the array: within allActiveServices, `type` is consumed only as the CSS class at main.js:7033-7034, and the print row has no simId so it renders as a span, not a SIM button. The filtering risk the finding describes is real in this file but on a DIFFERENT array (`c.services`, filtered by type !== 'sim' at 6768 and 6996) — so the accusation attaches to the wrong line. A one-word comment would settle it; a rename is churn.

- **normalizeUkNumber recognises and rewrites Israeli numbers — the UK in the name undersells a multi-country normaliser** (`lib/ukPhone.mjs:26`)
  KILLED. The Israeli branches exist precisely BECAUSE the name's domain is a UK shop: they stop 05x mobiles being corrupted into +44 non-numbers (a real sweep finding, 2026-08-02 #18), and the file's header documents every branch in precedence order before any code. A function named for the shop's home market that carefully handles the one other market its customers use is not lying; renaming it would ripple through every caller for no gain.

- **buildSimIndex's input field is named `email`, the same identifier the codebase uses for the customer's contact identity — the two ** (`lib/simMailMatch.mjs:78`)
  KILLED as a duplicate. The module faithfully mirrors the app-level field name on `sims`; it cannot rename someone else's field. The genuine confusion — that a SIM's carrier-account address is an identity, not a contact detail — is already the tier-2 finding on the carrier account email, and fixing it there fixes this.

## What this scan did not look at

All seven lenses have now run, so the gap this section described on 18 August
is closed. What replaces it is narrower and should not be mistaken for
completeness:

- **The lenses are static reading, not a walk through the running app.** Every
  citation was opened at its line; none was confirmed by using the screen. The
  `renewal_pending` finding (S1) is the shape that survives this method well —
  two files that never mention each other — and a state that *is* set by
  something at runtime that greps do not reach would survive it badly.
- **The silent-defaults lens searched a fixed vocabulary** — fallbacks onto
  `method`, `kind`, `type`, `status`, `category`, `confidence`, `source`. A
  default that names a meaning under a field named something else was not
  looked for. The negative result in that section is bounded by that list.
- **Cosmetics remain out of scope**, as they were on 18 August.
- **Nothing here has been acted on.** This document changed no behaviour, by
  instruction. Tier 2 and the two surviving lens-5/7 findings need the owner
  before anything moves.

The tally, so the strength of the whole is legible: **six findings raised by
lenses 5–7, two killed, one corrected in its citation and kept at reduced
strength, three standing** (S1, P1, and the diagnosis sharpening that lens 7
produced).

