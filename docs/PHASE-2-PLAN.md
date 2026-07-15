# Phase 2 plan — payments & email

This is the build plan for the three things that are **scaffolded but not yet
live** in KosherConnect. Nothing here changes how the shop runs today; it
turns the manual/held pieces into wired integrations, one controlled step at a
time.

The shop's model is already settled and this plan keeps it:

- **myPOS (Nexgo K300) = card-present at the counter.** Already how cards are
  taken — this phase just links the terminal to the till so the amount isn't
  re-typed and the payment lands on the ledger by itself.
- **Stripe = stored-card / remote / recurring.** Card-on-file for deposits,
  no-shows, SIM direct-debits and anything charged when the customer isn't
  standing at the counter.
- **Email = receipts and reminders**, sent for real, safely.

Guiding rules that do not change in phase 2:

- **Sandbox / test first, always.** No live Stripe key and no live email
  cohort until the test path has been exercised end-to-end.
- **Card data never touches our database.** The card is read by the myPOS
  terminal or by Stripe's own hosted fields; we only ever store tokens and
  reference numbers.
- **The ledger stays the single source of truth.** Every real-world payment —
  terminal, Stripe, or cash — becomes one append-only ledger row, keyed by an
  idempotent `charge_reference`, exactly as today. Integrations *feed* the
  ledger; they don't replace it.

---

## Workstream A — myPOS Nexgo K300 ↔ the till

### Where it is now

The till records the **method** only. A staff member taps **💳 Card**, walks
to the K300, types the amount into the terminal by hand, and the sale is logged
as `card`. Two separate entries, no amount-match guarantee, no automatic
reconciliation. It works, but nothing links the two.

### The device decides the approach

The Nexgo K300 is a myPOS **Smart** terminal — an Android device. The myPOS
Smart SDK is an **on-device, app-to-app** integration: an Android app **running
on the terminal** starts a sale and reads the result back. A plain web page in a
browser cannot reach the card reader. So "one tap from the till" requires a thin
native app on the K300 that hosts the till and bridges to the SDK. This is the
standard and supported pattern for these devices.

The SDK contract we build against (confirmed from the myPOS Smart SDK):

- **Start a sale:** `MyPOSAPI.openPaymentActivity(activity, payment, REQUEST_CODE)`
  where `payment` carries `productAmount`, `currency(GBP)`, and
  `foreignTransactionId` — an external reference up to 128 chars. **This is our
  hook:** we pass our `charge_reference` as the `foreignTransactionId`.
- **Get the result** (`onActivityResult`): `transaction_approved`,
  `reference_number`, `STAN`, `authorization_code`, `response_code`,
  `card_brand`, and an obfuscated `pan` (last 4 only — no full card number ever
  leaves the terminal).

### Target architecture — "KosherConnect Till" wrapper on the K300

```
  Staff taps "Charge £120.00" in the web till (running in the wrapper's WebView)
        │  window.KCTill.charge(amountPence, chargeReference)     ← JS→native bridge
        ▼
  Wrapper calls MyPOSAPI.openPaymentActivity(amount, GBP, foreignTransactionId=chargeReference)
        │
        ▼
  Customer taps card on the K300 → myPOS authorises
        │  onActivityResult → { approved, reference_number, STAN, auth_code, brand, last4 }
        ▼
  Wrapper posts the result to the till:  POST /api/pos/card-result
        │  { chargeReference, approved, myposRef, stan, authCode, brand, last4, amount }
        ▼
  Server records ONE ledger row (method 'card') via db.insertIgnoreDup on chargeReference
        │  (double-tap / retry safe — same reference can only post once)
        ▼
  Till UI flips the sale to "Paid — card ****last4" automatically
```

### Steps

1. **Reference plumbing (web, no hardware needed).** Where the till today
   offers 💳 Card (`posMethodsHtml` in `public/main.js`, and the booking/repair
   payment selects), generate the `charge_reference` up front and, when the
   native bridge is present (`window.KCTill`), call it instead of just logging
   the method. When the bridge is absent (desktop browser, no terminal), fall
   back to today's manual behaviour unchanged.
2. **New endpoint `pages/api/pos/card-result.js`.** Accepts the terminal
   result, validates the amount against the pending sale, and posts the ledger
   row with `db.insertIgnoreDup(charge_reference, …)`. Stores the myPOS
   `reference_number` / `STAN` / `authorization_code` / `card_brand` / `last4`
   as ledger metadata so a card line can be matched to a myPOS settlement later.
   Idempotent by construction — a resent result never double-posts.
3. **The wrapper app** ("KosherConnect Till", Android). A single-activity
   WebView that loads the till URL, plus a `@JavascriptInterface` bridge
   (`charge`, and a result callback) that calls the myPOS Smart SDK. ~1 screen
   of Kotlin/Java. Reads amount in pence, currency GBP, reference = our
   `charge_reference`; returns the result object to JS.
4. **Reconciliation view.** A small settlement report that lists card ledger
   rows next to their myPOS references so end-of-day card totals can be tied to
   the myPOS payout.

### Real-world dependencies to flag before starting

- **Distributing the app to the K300** goes through the **myPOS app
  catalogue / developer programme** — custom apps on Smart terminals are
  reviewed and signed by myPOS, they aren't freely sideloaded. Time-to-live
  depends on that review, not on our code. Confirm access to the myPOS
  developer programme early.
- **GBP + UK account.** Confirm the terminal's myPOS account is GBP so
  `currency(GBP)` matches settlement.
- **Refunds/voids** have their own SDK activity — scope whether phase 2
  includes card refunds from the till or leaves them on the terminal's own menu.

### If a native wrapper isn't wanted

The fallback is **not** a counter card-present flow — myPOS does not offer a
public "push this amount to that terminal" REST call for smart devices. The
no-app alternative is a **payment link / QR** (myPOS Checkout): the customer
pays on their own phone and a webhook confirms it. Fine for remote/deposit
cases, but it's really the Stripe lane below, not the counter lane. For a smooth
counter tap, the wrapper is the route.

---

## Workstream B — Stripe (stored-card / remote / recurring)

### Where it is now

Deliberately prepped, not live:

- `customers.stripe_pm_id` column exists (owner-only, excluded from staff views).
- Booking and repair payment menus offer **"Paid now — card on file (Stripe)"**.
- The server maps `card_on_file` → `'card'` on the ledger
  (`pages/api/bookings.js`, `pages/api/repairs.js`).

There are **no keys, no Stripe client, no PaymentIntent, no webhook** — nothing
charges a card. `card_on_file` today just records a `card` row like any other.

### Target flow

1. **Save a card (customer present, once):** client uses Stripe's hosted
   **Payment Element** → **SetupIntent** → we store the resulting Customer id and
   payment-method id. Card details go straight to Stripe from the browser and
   never reach our server or DB.
2. **Charge card-on-file (customer not present):** server creates an
   **off-session PaymentIntent** against the saved payment method. Only on a
   `succeeded` result do we post the ledger row — the existing
   `card_on_file` path becomes a real charge instead of a bare record.
3. **Webhook** (`/api/stripe/webhook`) with **signature verification** on the
   raw body — the source of truth for `payment_intent.succeeded`,
   `…payment_failed`, refunds and disputes. Ledger writes are idempotent on the
   PaymentIntent id.

### Steps

1. **Stripe account + sandbox keys.** `STRIPE_SECRET_KEY=sk_test_…`,
   `STRIPE_PUBLISHABLE_KEY=pk_test_…`, `STRIPE_WEBHOOK_SECRET=whsec_…`. **Test
   keys only** until the whole path is proven.
2. **`lib/stripe.js`** — server Stripe client, created only when the secret key
   is present (same "degrade gracefully when unconfigured" pattern as
   `lib/email.js`).
3. **Migration — add `customers.stripe_customer_id`** (owner-only, alongside the
   existing `stripe_pm_id`). A Stripe **Customer** is needed to attach a saved
   card and to charge off-session; `stripe_pm_id` alone isn't enough. Add a
   small **`stripe_events`** table for webhook idempotency.
4. **`pages/api/stripe/setup-intent.js`** — creates/reuses the Stripe Customer,
   returns a SetupIntent client secret for the Payment Element.
5. **Client card-save UI** — a small component using Stripe.js + Payment
   Element (hosted fields). On success, persist `stripe_customer_id` /
   `stripe_pm_id`.
6. **`pages/api/stripe/charge.js`** — off-session PaymentIntent against the
   saved method; on `succeeded`, post the ledger row (idempotent on the
   PaymentIntent id). Wire the `card_on_file` branches in `bookings.js` /
   `repairs.js` to call this instead of recording a bare `card` line.
7. **`pages/api/stripe/webhook.js`** — **raw-body** route (disable Next's body
   parser for it) + `stripe.webhooks.constructEvent` signature check.
   Reconciles success/failure/refund to the ledger; dedupes on `stripe_events`.

### Things that will bite if ignored

- **SCA / 3-D Secure.** Off-session charges can come back
  `authentication_required` (bank wants the customer). Handle it: flag the
  charge and ask the customer to re-authorise next time they're present, rather
  than silently failing. Save the card **with the customer present** so the
  mandate is captured up front.
- **PCI stays trivial** *only* if we always use Stripe's hosted fields
  (Payment Element / Elements). No raw PAN in our forms, logs, or DB — this is
  the same non-negotiable as the terminal lane.
- **Idempotency everywhere** — Stripe retries webhooks; use PaymentIntent ids +
  the `stripe_events` table so a replay can't double-post.

---

## Workstream C — email delivery (make it real)

### Where it is now

`lib/email.js` is a genuine SMTP scaffold (nodemailer) with a **three-state
safety gate** that we keep:

- **HOLD** (default) — receipts are fully built and logged, **nothing is sent**.
- **TEST** — `MAIL_TEST_TO` redirects *every* message to one test address.
- **LIVE** — `MAIL_LIVE=true` sends to the real customer address on file.

`pages/api/email.js` sends **on-demand receipts** (sale / payment), resolves the
recipient **server-side** from the customer record (the client can't choose a
destination), and refuses to send to the shop's own account/login emails.

What's missing to call it "established":

- **Deliverability.** No dedicated sending domain, and no SPF / DKIM / DMARC
  story documented. Without these, mail to real customers lands in spam or is
  rejected — the single biggest reason "email isn't established enough."
- **No send log / audit table.** We can't see what went out, to whom, or
  whether it bounced.
- **No bounce / complaint handling.** A hard-bounce or spam-complaint should
  quarantine that address, not keep retrying.
- **Coverage.** Only receipts are wired. Portal magic-link sign-in
  (`pages/api/portal/request-link.js`) and reminder drafts also depend on real
  delivery.

### Steps

1. **Pick the sending path.** Either keep SMTP (Forward Email) **or** move to a
   transactional provider with delivery + bounce webhooks (Resend / Postmark /
   SES). Decision below — the provider choice drives steps 2 and 4.
2. **Dedicated sending domain + DNS.** e.g. `mail.kosher-connect.com`. Publish
   **SPF**, **DKIM**, and a **DMARC** record; verify the domain with the
   provider. This is the step that actually fixes inbox placement.
3. **`email_log` table** — one row per send attempt: to, subject, kind, status
   (`held` / `sent` / `bounced` / `complained`), provider message id, timestamp.
   Makes sends auditable and is the backing store for suppression.
4. **Bounce / complaint handling** — if the provider supports webhooks, a
   `pages/api/email/webhook.js` that marks bounced/complained addresses and
   **suppresses** future sends to them. Keep the existing server-side recipient
   resolution and the own-account-email guard.
5. **Controlled go-live.** Walk the existing gate deliberately:
   **HOLD → TEST** (`MAIL_TEST_TO`, verify rendering + headers) **→ LIVE for a
   small cohort** → full. No flipping straight to LIVE.
6. **Extend coverage** once trusted: portal magic-link and reminder emails ride
   the same hardened path and log table.

---

## Suggested sequence

1. **Email first.** Smallest, lowest-risk, unblocks receipts + portal sign-in,
   and the domain-auth work has lead time (DNS propagation). Mostly config +
   one table + one webhook.
2. **myPOS K300 wrapper** in parallel — its long pole is the myPOS developer-
   programme access and app review, so start that clock early. The web-side
   reference plumbing and `/api/pos/card-result` can be built and tested with a
   stub before the hardware app is approved.
3. **Stripe last** of the three — most surface area (SetupIntent + off-session
   PaymentIntent + webhook + SCA handling) and it's the least urgent, since
   card-present at the counter already works via myPOS.

## Open decisions (need Shloime)

- **A — myPOS:** confirm access to the myPOS developer programme for a custom
  Smart-terminal app, and confirm the K300's account currency is GBP. Are card
  **refunds from the till** in scope, or left on the terminal menu?
- **B — Stripe:** confirm we're opening a Stripe account (sandbox first). Which
  cases go card-on-file first — deposits, no-shows, SIM direct-debits?
- **C — email:** **SMTP (Forward Email)** or a **transactional provider**
  (Resend / Postmark / SES) with bounce webhooks? And the sending
  domain/subdomain to set up DNS for.

## What is explicitly NOT in this plan

- No live keys, no live customer email cohort, and no card data in the database —
  test/sandbox and hosted card fields throughout.
- No change to the counter workflow until the terminal link is proven; the
  manual method-select fallback stays until then.
