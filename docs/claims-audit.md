# Claims audit — what the app says it does, against what it writes

Dated **18–19 August 2026** (port item B3). Implemented from the brief alone —
the source repo is not reachable from this session.

A claim is any wording a person reads that says the system WILL or DID create,
change, send, verify, record or remember something. Each was traced to the
handler that would have to do it, and given a verdict:

- **true** — the write exists and does what the copy says.
- **overstated** — a write exists, but does less than the copy claims (the
  commonest and most dangerous shape: it reads as reassurance).
- **false** — no such write; the copy describes something the app cannot do.

**67 claims audited: 52 true, 14 overstated, 1 false.** A later sweep on 20 August added five more — four true, one overstated and reworded; see below. The 52 that hold are
listed at the end, because "we checked and it is true" is the point of an audit.

## How much of this ran

Five surfaces were swept (money screens, the manual, guides + toasts, public
pages, comms templates) and each accusation went to a defence pass that re-read
the code and could acquit it. On 18 August **the defence pass completed for
three surfaces and failed for two** — public pages and comms templates — when
the run hit a monthly spend limit; findings there were hand-checked instead.

**Completed 19 August.** The two unswept surfaces were defended properly, by
re-opening each held item at its line. The result is in the held list below and
it matters: **two of the six were already fixed**, by the commit that landed
alongside this audit (`604d53f`, "Fix the defects the audits found"). A held
list that names work already done sends the reader chasing it, so each item now
carries its status and the line that settles it.

Nothing here is reported as verified that was not.

## Later sweep — 20 August 2026

Five claims shipped on 20 August after the audit was written. Each was traced
the same way. Four hold; one did not.

| claim | where | verdict |
|---|---|---|
| "£X is still to pay, by \<date\>" | `pages/api/email.js` `buildRental` | **true** — the figure is the rental's own total less what was taken, and the date is computed server-side from `rental_pay_days`. It states a term, it does not claim a write. |
| "Pay £X online" → the money reaches their wallet | the receipt's Stripe button | **true** — the session carries `payment_intent_data[metadata][app_customer_id]` (`lib/stripe.js:248`) and `pages/api/stripe/webhook.js:32-44` posts a `payment` row keyed on `STRIPE-<pi>`, idempotent. |
| "We took £60.00 by Cash" | same builder, part-paid branch | **true** — the counter payment is recorded through one channel, the rental's `amountPaid`, which `trueUpRentalLedger` posts as `PAY-RENTAL-<uuid>`; `saveRentals` is awaited and its failure returns before the panel that offers the receipt (`public/main.js:4707-4714`). |
| "No payment method on X's plan — set one up before the next renewal" | `lib/carrierMail.mjs` `carrierMailTask` | **true** — the task row is written by `pages/api/inbound/mail.js` only when the message was actually stored (`inserted.length`), so a redelivery cannot raise it twice. |
| "There is nothing further to pay." | the receipt's paid-in-full branch | **overstated — reworded below.** |

### Added 20 August, later still — the receipt's calendar

| claim | where | verdict |
|---|---|---|
| "Shaded days are not charged — Shabbos." | `pages/api/email.js` `rentalCalendar` | **true, and now pinned.** The shading comes from the counter's own day walk (`rentalDayList`, same `freeDayReason` and same step as `calcRentalPrice`), which travels with the receipt rather than being re-derived on a server that has no yom tov table. The pricer's own predicate reads the same map; `test/freeDayAgreement.test.mjs` holds the two to the same answer for every day of 2025–2027. The hazard that makes the test worth having is written up in `docs/clarity-scan.md`. |

### The one that did not hold

The receipt's total is the RENTAL's price. It is not the customer's balance.
Owner-defined extras (`applyExtraCharges` → `/api/custom-charges`) post to the
same wallet moments after the receipt is built, and are not in that figure —
the done-panel toast says "Incl. …" about them and the email never did. So a
receipt could say "there is nothing further to pay" over a total that was
already short of what had just been charged.

**It has not gone out wrong.** `custom_charges` is empty today, so no rental
extra exists to post. But an absolute claim about somebody's account was one
settings row away from being a lie, and "the table happens to be empty" is not
a defence a receipt should rest on.

- **Reworded now (copy, safe):** "Nothing further to pay **on this rental**."
- **Held for the owner:** putting the extras into the receipt's total, with
  their own rows. That changes what a customer is billed-as-shown, which is a
  money-read decision and not a finding — the same line the port plan draws
  around C1.

## Fixed in this commit (copy only)

Rewording a false claim is a copy change and safe. Eight went in:

| what it said | what it says now | why |
|---|---|---|
| Manual: a collected Kol Torah job can be put back with ↩ | Collected is final; ↩ works on Ready and Cancelled | `pages/api/kol-torah.js:313` — `collected: []`, the server refuses every transition out |
| Manual: 📤 Collected charges a priced job to their account | …to the account of a job filed against a real customer | `kol-torah.js:325` charges only `if (job.customer_id …)`; a typed name has no account |
| Manual: the scanned document never leaves the computer | On this device — the normal way — it never leaves… the ⚠ AI reading option is the exception | `pages/tools/ocr.js` has an opt-in mode that POSTs the image to Gemini |
| Guide: the log shows whether a message actually arrived | …whether the safety gate held it back | `/api/message-log` never selects `delivery_status`; the screen cannot show arrival |
| Log badge SENT = "delivered to the customer" | "handed to the provider — delivery is confirmed separately" | the 21267 episode: three weeks of accepted-then-rejected SMS all read SENT |
| Overdue-rental SMS: "reply to extend" | "call us on 0161 531 1386 to extend" | replies now land (the number went live tonight) but nothing routes them to a person |
| Receipt closing: "simply reply to this email" | "call us on 0161 531 1386" | `lib/email.js` `deliver()` sets no Reply-To; a reply goes to the send address |
| Repair booking SMS: "We'll message you when it's ready" | "We'll be in touch when it's ready — or call us any time" | Ready only opens a staff draft; nothing sends automatically |

Plus one honesty fix in the comm log: a text receipt sent in TEST mode recorded
itself as "Text receipt sent"; it now says it went to the test number.

## Held for the owner — these need a decision or a behaviour change, not copy

1. **The live `email_closing` setting still carries the old wording.** The code
   default is fixed, but the configured value in Settings wins, and it is the
   owner's own copy to word. Nothing is reaching customers meanwhile (email is
   TEST-gated), so this is not urgent — but it is the one fix that did not
   land tonight. Settings → Communications.
2. **"The card machine approved after the till gave up — the card will NOT be
   charged again."** True on the page, volatile across a refresh: the approval
   cache is in-memory only (`public/main.js:16137`), and `posSaleRef` resets
   when the till modal reopens, so a re-ring after a reload would send a fresh
   charge. The honest copy is "re-ring now, on this screen (don't refresh)";
   the real fix is to consult the `card_receipts` row before charging. **Money
   surface — held.**
3. ~~**"Logged to the customer timeline"** fires even when the save failed —
   `recordComm` swallows the error.~~ **FIXED — nothing to do.** Confirmed
   19 Aug at `public/main.js:10260-10274`: `recordComm` now awaits the save,
   returns whether it succeeded, and toasts "Could not save that to the
   timeline" on failure. Its own comment records what it used to do.
4. **The KC-<id> bank reference** is shown to customers on the portal and in
   the terms, but the bank matcher only knows booking references
   (`lib/bankCandidates.mjs`), so quoting it does not actually match the
   payment. Either teach the matcher the reference or soften the promise.
5. **The repair form's "Got it — we'll be in touch"** is true for a first
   submission; a second one while a task is still open is dropped rather than
   appended (`pages/api/public/repair.js:59`). The public message form already
   handles this correctly — copy that branch across.
6. ~~**The receipt "✉️ Receipt sent" chip** sets `emailed = true` on the TEST
   branch too.~~ **FIXED — nothing to do.** Confirmed 19 Aug at
   `public/main.js:17475-17485`: the three outcomes are now distinct — held
   sets nothing, TEST sets `emailed = 'test'` with the comment "the customer
   got nothing — say so on the chip", and only a real send sets `true`. The
   chip reads "✉️ Sent to the test inbox" for the middle case
   (`public/main.js:17336`).

### Still standing, re-confirmed 19 August

- **#2 (card approval across a refresh)** stands. `kcTillApproved` is still an
  in-memory object (`public/main.js:17505`), so a reload loses the approval;
  `card_receipts` is written at approval time (`public/main.js:17602`) but
  never consulted before charging, which was the proposed real fix.
- **#4 (the KC-<id> bank reference)** stands. `lib/bankCandidates.mjs:25` reads
  `booking_reference` and nothing else, so a customer quoting the reference the
  portal gave them still does not match their payment.
- **#5 (a repeat repair enquiry)** stands, and is the sharpest of the six.
  `pages/api/public/repair.js:59` wraps the insert in `if (!open.length)` and
  returns `{ success: true }` regardless (line 78), so a second enquiry while a
  task is open is discarded while the customer is told "Got it — we'll be in
  touch." The sibling endpoint already does this correctly — `message.js:78-84`
  appends a repeat send to the still-open task — so the fix is to copy that
  branch across, not to invent anything.
- **#1 (the live `email_closing` setting)** cannot be checked from a checkout:
  it is a value in the Settings table, not in code, and it is the owner's copy
  to word.

## Overstated or false — the full list

| verdict | claim | where | what the code actually does |
|---|---|---|---|
| overstated | The card machine approved after the till gave up — re-ring the SAME items to record the sale; the card will NOT be charged again. | `public/main.js:16142` | public/main.js:16049-16053 — kcTillCharge returns the cached kcTillApproved[ref] result (or a mismatch block) instead of re-charging, so the promise holds on this page. But kcTillApproved and posSaleRef are in-memory JS only (main.js:16035-16036); if the opera |
| false | A job was marked collected too soon — Put it back with ↩. The money follows the status, so leaving it wrong leaves a charge on somebody who has not ha | `lib/manual.mjs:403` | pages/api/kol-torah.js:312-320 — the allowed-transitions map is `collected: []` ('money has moved — no silent un-collect'), so the server refuses collected→anything; public/main.js:16349-16357 shows ↩ only on ready/cancelled jobs, never collected; no ledger re |
| overstated | 📤 Collected when it goes out — which charges a priced job to their account | `lib/manual.mjs:389` | pages/api/kol-torah.js:325-333 — the charge posts only `if (to === 'collected' && job.customer_id && money(job.price) > 0)`. But job-save (kol-torah.js:278-282) accepts a typed customer_name with no customer record, so a priced job for a name-only customer is  |
| overstated | The document never leaves the computer. These are usually somebody's private papers, and that is exactly why this is not a website that wants an uploa | `lib/manual.mjs:681` | pages/tools/ocr.js:31,161-163,255-261 — the screen has TWO modes: the default on-device tesseract path (true to the claim) and an opt-in '⚠ AI reading' mode that POSTs the image to /api/ocr-ai, which sends it to Google Gemini (pages/api/ocr-ai.js:1-4: 'the ima |
| overstated | Settings → Messaging shows every message the system built or sent, and whether it actually arrived. | `lib/guides.mjs:172 (reminder-sms guide)` | pages/api/sms-status.js:73-78 does write delivery_status/delivery_error/delivered_at onto email_log, but pages/api/message-log.js:19-21 selects only `status` (send-time) and never those columns — so the screen can show HELD/SENT/TEST but never the carrier's de |
| overstated | sent: ['SENT', 'badge-active', 'delivered to the customer'] | `public/main.js:21006 (Messaging log badge tooltip)` | pages/api/sms-status.js:1-9 documents that 'sent' means only "Twilio accepted this" — for three weeks every SMS was rejected (error 21267) while the log said sent; the delivery verdict lives in the separate delivery_status column the log endpoint does not retu |
| overstated | Logged to the customer timeline. | `public/main.js:9169 (call/note log toast)` | public/main.js:9129-9137 — recordComm appends locally then `await window.api.updateCustomer(c).catch(() => null)`; the swallowed catch means the success toast at :9169 fires even when the save never reached the server, so a network failure silently loses the n |
| overstated | Paying by bank transfer? Please use the reference KC-<id> so we can match your payment. | `pages/portal.js:54 (bankRef1/bankRef2, rendered at portal.js:744-748)` | pages/api/portal/me.js:117 is the ONLY place `KC-${extras.id}` exists in the codebase (repo-wide grep). The matcher's candidate references are booking refs only — lib/bankCandidates.mjs:23-33 (REF_SHAPE booking_reference set) fed to lib/bankMatch.mjs:72-76 ('a |
| overstated | Your balance is tracked in your account wallet; you can pay by cash, card or bank transfer (please quote the payment reference we give you so it reach | `pages/terms.js:25 (§3 Prices and payment)` | (a) is true — ledger table plus customer_balances view, surfaced at pages/api/portal/me.js:45,60 and the portal statement at me.js:85-102. (b) is the same gap as the portal bankRef claim: the KC- reference is generated at pages/api/portal/me.js:117 and consume |
| overstated | Got it — we'll be in touch. / We reply during opening hours, usually the same day. | `pages/repair.js:30-31 (okTitle/okWhen, success card after submitting the repair form)` | pages/api/public/repair.js:59-78 — the insert runs only `if (!open.length)`: while a REPAIR-<sender> task is still open, a second submission from the same phone/email (say a different device, or 'actually it also won't charge') is silently DISCARDED yet still  |
| overstated | Please return it, or reply to extend — late fees may apply. | `public/main.js:9460` | lib/sms.js:13-15 — the configured sender is the 'KosherCnct' alphanumeric Messaging Service, and pages/api/sms-inbound.js:3-7 states plainly that with that sender 'a reply is impossible rather than merely unread' until the Twilio number is bought; once a numbe |
| overstated | simply reply to this email or call us and we’ll put it right. | `lib/email.js:219 (same copy seeded at pages/api/email.js:37 and supabase/migrations/20260813120000_email_copy_settings.sql:23)` | lib/email.js:88-108 — deliver() sends with from: MAIL_FROM only and sets NO Reply-To header, so a customer's reply goes to the send address (example in lib/email.js:27 is receipts@mail.kosher-connect.com); the only inbound-mail code, pages/api/inbound/mail.js: |
| overstated | We'll message you when it's ready. | `public/main.js:14022` | public/main.js:14038-14039 — moving a repair to Ready only OPENS a draft modal for staff; that modal (14054-14062) offers Copy and WhatsApp only and says itself 'nothing is sent from here' (14056); there is no automated send anywhere (pages/api/cron/sweep.js o |
| overstated | recordComm(... text: res.held ? 'Text receipt built (HOLD, not sent)' : 'Text receipt sent') | `public/main.js:4177` | public/main.js:4174-4177 — the ternary only distinguishes held; in TEST mode (res.redirected) it still records 'Text receipt sent', but lib/sms.js:137-149 shows a redirected send goes to SMS_TEST_TO, never the customer — so the timeline permanently claims a te |
| overstated | ${posLastSale.emailed ? '✉️ Receipt sent' : '✉️ Email receipt'} | `public/main.js:15968` | public/main.js:16109-16111 — posLastSale.emailed is set true on the redirected (TEST-mode) branch too, where lib/email.js:168-180 shows the mail went to MAIL_TEST_TO with a '[TEST → …]' subject and the customer received nothing; the button then reads 'Receipt  |

## The 52 that hold

These were checked and the write is there. Money claims dominate, which is the right place for an audit to find good news.

| claim | where | the write |
|---|---|---|
| Sold ${res.lines} item${...} — ${fmtGbp(res.total)}${walletNote}. | `public/main.js:16286` | pages/api/shop.js:282 (stock_sales insert), 254-267 (atomic guarded stock decrement via adjust_stock_qty), and 339 (single atomic insertIgnoreDup of all ledger charge+payment rows) |
| Sale already recorded — no double charge. | `public/main.js:16250` | pages/api/shop.js:174-183 — duplicate is only reported after verifying the SALE-<clientRef>-0 charge_reference actually exists on the ledger; shop.js:217-227 claims the idempotency |
| No answer from the card machine — nothing was recorded. Check the terminal and try again. | `public/main.js:16205` | public/main.js:16203-16206 — saveSale returns before the /api/shop POST is ever sent when kcTillCharge resolves null (3-min timeout, main.js:16060), so no server write occurs. The  |
| Heads up: only ${fmtGbp(res.walletApplied)} credit was available — ${fmtGbp(res.walletShortfall)} left on the  | `public/main.js:16290` | lib/money.mjs:120-128 — settleSale caps walletApplied at the real pre-basket credit and computes the shortfall; pages/api/shop.js:300-334 posts the FULL charges but a payment only  |
| Recorded — wallet balance now ${fmtGbp(res.balance)}. | `public/main.js:9522` | pages/api/ledger.js:316-337 — insertIgnoreDup into ledger with a stable <PREFIX>-<clientRef> charge_reference (idempotent on retry, returning the existing row), then the balance is |
| Charged £${amount.toFixed(2)} to card on file ✔ | `public/main.js:7591` | The toast is gated on d.status === 'succeeded' (main.js:7587); pages/api/charge-card.js:51-56 returns that status only after the Stripe PaymentIntent succeeds and the STRIPE-<pi.id |
| Refunded ${fmtGbp(j.amount \|\| amount)} to the card. | `public/main.js:9089` | pages/api/refund-card.js:68-87 — refundPayment is called on the original PaymentIntent (capped at what remains unrefunded, lines 51-66), failed/canceled statuses are rejected with  |
| Creates a Stripe pay-by-card link tied to this customer. When they pay, it's credited to their wallet automati | `public/main.js:7814` | lib/stripe.js:248 (and 293 for open-amount links) stamps payment_intent_data[metadata][app_customer_id]; pages/api/stripe/webhook.js:32-44 posts exactly one STRIPE-<pi.id> 'payment |
| Posts as a payment (bank transfer) on their wallet." … then "Matched — payment is on the ledger. | `public/main.js:10014 and public/main.js:10023` | pages/api/bank.js:250-258 — insertIgnoreDup of the payment row (method bank_transfer, or 'card' with the webhook's own STRIPE- reference for Stripe rows so a later webhook replay c |
| Undone — correction posted, row reopened. | `public/main.js:10097` | pages/api/bank.js:342-358 — inserts the BANKUNDO-<token> adjustment of -amount (idempotent on charge_reference), then flips the row's match_state back to unmatched with the matched |
| Till counted — balances exactly. ✓ (or "Till counted — ±£X over/short.") | `public/main.js:9747-9749` | pages/api/cashup.js:93-107 — expected cash is recomputed server-side from the day's ledger (cashExpected, netting cash by sign plus the opening float) and upserted into till_counts |
| Charged ${fmtGbp(res.order.total)} — wallet balance ${fmtGbp(res.balance)}. | `public/main.js:14653` | pages/api/service-orders.js:113-119 (SVC-<ref> charge insert), 124-131 (PAY-SVC-<ref> payment when paidNow), balance re-read from customer_balances at 140-141 before success; the d |
| Settling a shul that is linked to a customer record puts the money through the books like any other payment, s | `lib/manual.mjs:397` | pages/api/kol-torah.js:219-268 — postSettlementLedger inserts both rows into `ledger` (idempotent via insertIgnoreDup on charge_reference), with a claimKey + self-heal path so a re |
| take the money, and the stock and the day's takings both move at once | `lib/manual.mjs:353` | pages/api/shop.js:141-339 — the sale op decrements each line through the adjust_stock_qty RPC (line 256, never-negative, with rollback at 244 on failure) and posts all money — phon |
| Switching billing on is what makes it charge; it does not follow from the number merely existing. | `lib/manual.mjs:414` | pages/api/cron/sweep.js:574-621 — the nightly vn-billing section selects virtual_numbers where billing_enabled=true, status=Active, customer_id set, monthly_price>0 and next_billin |
| Pay by card — Clears what they owe through Stripe. It says plainly when card payment is not switched on rather | `lib/manual.mjs:564` | pages/api/portal/pay.js:1-55 — creates the PaymentIntent for the owed amount and returns 503 with plain wording when Stripe/webhook/keys are not set (lines 14-21, including refusin |
| A message sent from here becomes a task. Nobody has to be watching an inbox for it to be picked up. | `lib/manual.mjs:551` | pages/api/public/message.js:97-104 — inserts a `tasks` row (source 'auto', reference MSG-<sender>) with the message, contact details and a customer-match hint; a repeat from the sa |
| What happens next — The request lands as a task in the shop. A real repair ticket is opened when the phone act | `lib/manual.mjs:603` | pages/api/public/repair.js:71-77 — inserts a `tasks` row (title '🔧 Repair enquiry…', reference REPAIR-<sender>, deduped one-open-per-sender) and writes nothing into the repairs wor |
| A completed port, a PAC code and a payment problem each raise a task by themselves, because each one means som | `lib/manual.mjs:497` | pages/api/inbound/mail.js:287-303 — for stored messages whose kind is in ACTIONABLE, inserts a task (payment_failed at high priority, reference SIMMAIL-<id>); lib/carrierMail.mjs:9 |
| "not the same" is remembered, so the pair never asks again | `lib/manual.mjs:158` | pages/api/customers/not-duplicate.js:34-39 — inserts an order-normalised row into customer_dupe_dismissals (idempotent, with who dismissed it); pages/api/customers/duplicates.js:65 |
| log-comm — Records a call, a text or a conversation on their history, so the next person picking up the phone  | `lib/manual.mjs:154` | public/main.js:9121-9133 — logComm appends {at, type, text, by} to c.commLog and recordComm persists it via window.api.updateCustomer, so the entry survives on the customer record  |
| hold builds the message and sends nothing, test sends everything to the shop's own address or number whatever  | `lib/manual.mjs:523` | lib/sms.js:49-51,130-148 — default HOLD (nothing sent, status 'held' logged to email_log), SMS_TEST_TO redirects every message to the test number, SMS_LIVE=true sends real; lib/ema |
| The code step — After the password, a code sent to the email address. Two steps, because one is what a stolen  | `lib/manual.mjs:621` | pages/api/auth/login.js:63-73 — after the password verifies, sendEmailOtp runs and the response fails loudly if the send fails; lib/auth.js:105-113 — the code goes through the Supa |
| Recorded — wallet balance now ${fmtGbp(res.balance)}. | `public/main.js:9522` | pages/api/ledger.js:316-337 — insertIgnoreDup into `ledger` with idempotent charge_reference (PAY-/TOPUP-/RFDOUT-<token>), balance returned from the customer_balances view; toast f |
| Press Save. The payment goes on their record and their balance updates at once. | `lib/guides.mjs:65 (take-payment guide)` | public/main.js:9515-9516 calls addLedgerEntry(kind 'payment') → pages/api/ledger.js:257-337 inserts the ledger row and returns the fresh balance (balance is never stored, summed fr |
| Press Pay. The stock comes down and the sale is on the day's takings immediately. | `lib/guides.mjs:78 (till-sale guide)` | pages/api/shop.js:7 and :229-256 — atomic guarded adjust_stock_qty decrement per line before posting SALE-<uuid> ledger rows (phone_sale/stock_sale), with unwind on failure; taking |
| Marking it Collected is what charges the customer's wallet — nothing is charged before that. | `lib/guides.mjs:115 (new-repair guide)` | pages/api/repairs.js:177-207 — REPAIR-<id> charge posted idempotently only when patch.status === 'Collected' and total > 0; cancellation reverses via REPAIR-REVERSAL-<id> (repairs. |
| Save. Any difference between the two is recorded as a variance — that record is the whole point, so do not adj | `lib/guides.mjs:150 (cash-up guide)` | pages/api/cashup.js:93-107 — upsert into till_counts {count_date, expected, counted, notes, created_by}; the variance is returned on POST (:106) and read back on GET (:81), derived |
| Undone — correction posted, row reopened. | `public/main.js:10097 (bank-match undo toast; confirm dialog at 10088 promises the same)` | pages/api/bank.js:341-360 — inserts BANKUNDO-<token> manual_adjustment for -amount into `ledger`, then updates bank_transactions to match_state 'unmatched' with a 409 if the row ch |
| No answer from the card machine — nothing was recorded. Check the terminal and try again. | `public/main.js:16205 (POS card charge)` | public/main.js:16199-16230 — the /api/shop sale POST (:16218) is only reached after an approved tillResult; the timeout path returns at :16206 before any write, and the kept approv |
| Take the payment if there is one owing, then Save. The phone goes back into stock straight away. | `lib/guides.mjs:55 (return-phone guide; late-days claim at :53)` | public/main.js:4569-4573 (and bulk path :2955-2957) set phone.status='available', clear currentRental, savePhones + saveRentals; the late charge is posted server-side as RENTAL-LAT |
| SMS sent to ${r.customerName \|\| 'the customer'} ✔ | `public/main.js:9399 (rental status SMS)` | public/main.js:9396-9399 shows this toast only when res.held and res.redirected are both false — the HOLD and TEST branches show a warning instead; lib/sms.js:109-148 returns held/ |
| Texts are held until the shop turns sending on, so a draft is exactly that until then. | `lib/guides.mjs:171 (reminder-sms guide)` | lib/sms.js:49-51 and :132-134 — without SMS_TEST_TO/SMS_LIVE every send is logged status 'held' and returns {ok:true, held:true}; the guide states the gate plainly, so this is the  |
| Saved ✔ The public guide updates within a few minutes. | `public/main.js:21327 (phone guide editor)` | pages/api/phone-guide.js:52-77 inserts/updates phone_models; the public read is cached s-maxage=300 (pages/api/public/phone-guide.js:9), so 'within a few minutes' is exactly right |
| Card saved for ${escName(name) \|\| 'this customer'}. It attaches within a few seconds. | `public/main.js:7789 (save card on file)` | public/main.js:7775-7786 — confirmCardSetup succeeded before the toast, and pages/api/stripe/webhook.js:62-73 writes stripe_pm_id (or Bacs mandate columns) to `customers` on setup_ |
| Payment received — thank you! … Your payment went through and will show on your account shortly. | `pages/welcome.js:177-178 (paidTitle/paidBody, shown on /welcome?paid=1)` | pages/api/stripe/webhook.js:32-44 — on payment_intent.succeeded, db.insertIgnoreDup('ledger', [{entry_type:'payment', charge_reference:`STRIPE-${pi.id}`, …}]) keyed on the PaymentI |
| ✓ Payment received — thank you. Your balance will update shortly. / Your payment is processing — we'll update  | `pages/portal.js:27 and pages/portal.js:34 (paidNote / payProcessing)` | pages/api/stripe/webhook.js:37-44 posts the ledger row (idempotent on charge_reference); pages/api/portal/me.js:45,60 reads balance from the customer_balances view over that ledger |
| Approved refunds go back to your original payment method — a card refund returns to the same card, and a walle | `pages/refund.js:49-51 (§6 How refunds are made)` | pages/api/refund-card.js:1-60+ — owner-only endpoint refunds only a recorded STRIPE-<pi> ledger 'payment' row via refundPayment, caps partial refunds against what remains (lines 46 |
| Your balance and renewal dates are always on your account page. | `pages/welcome.js:153 (FAQ answer, 'How do I top up…'; Hebrew twin at welcome.js:274)` | pages/api/portal/me.js:40-118 returns balance (customer_balances, line 60), sims with renewal dates, and a per-line statement with running balanceAfter (lines 85-102); pages/portal |
| Thanks — we've got it. We reply during opening hours, usually the same day. | `pages/welcome.js:132 (fOk, shown after the 'Send us a message' form succeeds)` | pages/api/public/message.js:97-103 inserts a 'New message: <name>' task with the contact details and message; message.js:78-84 appends repeat sends from the same sender to the stil |
| We only use these details to reply to you. | `pages/welcome.js:141 (fPrivacy, beneath the contact form)` | pages/api/public/message.js:87-103 — details are written solely into the task's raw_text for staff to reply from; the only other touch is a read-only lookup against existing custom |
| ✓ Got it — we'll be in touch. | `pages/portal.js:79 (reqSent, after the signed-in 'send us a request' box)` | pages/api/portal/request.js:26-33 inserts a 'Customer request: <name>' task with customer_id, the message, and the customer's phone, under a unique REQ-<id>-<timestamp> reference ( |
| Sent — we'll review it shortly. | `pages/portal.js:72 (upSent, after a customer document upload)` | pages/api/portal/documents.js:34-41 — putObject writes the file to the docs bucket and a customer_documents row is inserted with status:'pending', source:'customer', which the staf |
| No password needed — we email you a secure one-time sign-in link. / 📬 If that email belongs to a Kosher Connec | `pages/portal.js:82 (reassure) and pages/portal.js:88 (sent)` | pages/api/portal/request-link.js:33 → lib/auth.js:189-191 — sendMagicLink calls the Supabase auth OTP endpoint (create_user:true), a real email send via Supabase's mailer, not the  |
| Signing in with Google is optional and only confirms your name and email address … We never see or access your | `pages/welcome.js:162 (appBody2, the app-purpose section)` | pages/api/auth/google-complete.js:12-18 — the server only ever calls Supabase's /auth/v1/user for the signed-in identity (id, email, provider); a repo-wide grep finds no gmail/driv |
| ✓ A card is saved on file. | `pages/portal.js:36 (cardOnFile)` | pages/api/stripe/webhook.js:47-53 and 62-73 — payment_intent.succeeded and setup_intent.succeeded both write stripe_pm_id onto customers (failures deliberately throw so Stripe retr |
| Payment received — thank you ... Amount received | `pages/api/email.js:121-124` | public/main.js:9618-9648 — window.api.addLedgerEntry() must succeed (line 9622 returns on failure) BEFORE the kind:'payment' email is posted at 9627-9638, so the receipt always fol |
| Estimate £X, payable on collection. | `public/main.js:14022` | lib/repairStatuses.mjs:7-8 — 'Collected posts the repair charge to the wallet (REPAIR-<id>, once)'; public/main.js:14030-14032 — changeRepairStatus('Collected') routes any repair w |
| Hi ${customer.firstName}, ${created.length} phones are booked ${fmtDate(from)} → ${fmtDate(to)}. Total ${fmtGb | `public/main.js:4040` | public/main.js:4003-4021 — the done-panel carrying this draft is only shown after saveRentals(rentals) succeeds (failure at 4004-4008 rolls the created rows back and returns), so t |
| Receipt emailed to ${res.sentTo}. | `public/main.js:4140 (same pattern at 9142, 9643, 16114)` | public/main.js:4135-4139 branches held and redirected off first with warning toasts quoting the server's gate note, so this success toast is reached only on the live path; lib/emai |
| SMS sent to ${r.customerName \|\| 'the customer'} ✔ | `public/main.js:9501` | public/main.js:9498-9500 handles held and redirected first with the server's own warning notes (pages/api/sms.js:59-64), so this toast fires only when lib/sms.js:139-149 actually d |
| Kosher Connect test — the SMS connection works. 👍 | `pages/api/sms-test.js:30` | lib/sms.js:131-149 — in HOLD mode the message is only logged and no reader ever sees the claim; in TEST/LIVE it is read only after Twilio actually accepted and delivered it, so the |
