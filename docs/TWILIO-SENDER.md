# Twilio — going live (a real number, since 18 Aug)

**The 16 Aug decision ("KosherCnct alphanumeric only, no number") is
superseded.** On 18 Aug 2026 the owner **bought a Twilio phone number**, and the
account's UK Regulatory Bundle — *United Kingdom: Mobile - Business*, SID
`BUb9a351c20ba7f5035e68e9d18826eb5d` — was **approved** the same evening
(Twilio's approval mail, 19:29). That flips the trade-offs this runbook was
written around:

- **Replies become possible.** A number can receive; an alphanumeric sender
  cannot. "Reply STOP / reply YES" copy can become true again — but ONLY once
  inbound messages actually land somewhere (see step 5). Until then the
  opt-out wording stays "call 0161 531 1386".
- **The regulatory path is already paid for.** The bundle the alphanumeric
  route existed to avoid is done and approved. Sunk and cleared — no reason
  left to avoid the number.
- The alphanumeric sender `KosherCnct` still sits in the sender pool and can
  ride alongside the number later (branded outbound, number for two-way) —
  that's a refinement, not a go-live requirement. The registration queue in
  step 2b applies to it, not to the number.

## Where we are (18 Aug, evening)

| | |
|---|---|
| App code | done — `lib/sms.js`, `/api/sms`, `/api/sms-test`, Settings → Messaging |
| Credentials in Vercel | present (health 08-04: `sms: configured, provider twilio, mode test`) |
| Twilio account | **still trial** — this is now THE blocker for real sends |
| Number | **bought 18 Aug** (console: `PNccde9202…`, IE1/US1 region tabs — config lives in US1, the Active one; IE1 is an empty EU data-residency slot, leave it) |
| Regulatory bundle | **approved AND assigned to the number** (owner, 18 Aug ~20:00) |
| Send gate | TEST — every message goes to `SMS_TEST_TO`, never a customer |

## The go-live order, revised for the number

1. ~~Assign the approved bundle to the number~~ — **done, 18 Aug** (owner
   assigned it right after the approval mail). The number is regulatorily
   complete.
2. **Upgrade off trial** (step 1 below, unchanged). **This is the one remaining
   hard blocker**: a trial account can only text verified handsets, so
   customers are unreachable by construction.
3. **Point the app at the number**: either add the number to the
   `KosherConnect` Messaging Service sender pool (preferred — the `MG…` SID is
   already the app's config shape, step 3 below), or set `TWILIO_FROM` to the
   number in Vercel. No code change either way.
4. **Prove it in TEST mode** (step 4 below) — the handset should show the new
   number as sender.
5. **Inbound (replies)** — nothing in the app receives SMS yet. Before any
   outgoing copy says "just reply", the number's Messaging webhook must point
   at an endpoint that files the reply (the natural shape: an `/api/sms-inbound`
   that logs into the comm history the way `/api/sms-status` files delivery
   verdicts, signature-verified the same way). Until that exists, replies land
   in the Twilio console only — better than the alphanumeric black hole, but
   not something to invite.
6. **Go live on the owner's word only** (step 5 below, unchanged).

Everything below is the original runbook: still-accurate mechanics, plus the
alphanumeric findings kept for the record (they matter again if `KosherCnct`
is ever added as a branded outbound sender).

## What is actually true, tested in the console (08-16)

Two claims in an earlier version of this page were wrong, and the console
settled both:

- **"The sender pool refuses an alphanumeric sender on a trial account."**
  FALSE. `KosherCnct` was added to the `KosherConnect` service's sender pool
  while the account was still on trial. It shows as type *Alpha Sender ID*,
  tagged "Generic for all countries".
- **"The UK requires pre-registration before you can send."** NOT ESTABLISHED.
  Twilio's reachable documentation says the UK *supports* pre-registration
  "to achieve higher delivery rates and reduced filtering", which reads as
  strongly recommended rather than a gate. The authoritative country table is
  on twilio.com, which this environment cannot reach.

What remains true and sourced: **Twilio's support documentation says
alphanumeric Sender IDs are not supported on trial accounts.** Configuring one
evidently is allowed. Whether a trial account can SEND with one is the open
question, and the cheapest way to answer it is to try — see step 4.

A trial account can also only send to VERIFIED numbers, so `SMS_TEST_TO` must be
a verified caller ID for any trial-mode test to prove anything.

## Step 1 — upgrade off trial

Console top bar: the green **`Trial: £11.71  Upgrade`** pill — click *Upgrade*.
(Same destination: **Admin ▸ Billing**.) It asks for a card and a first
payment; Twilio's minimum top-up is around £20 and the £11.71 trial credit
survives the upgrade.

Skip the "verify a phone number" step people usually do first — that exists to
let a *trial* account text a known handset. Once upgraded it is pointless.

## Step 2 — create the Messaging Service

Console ▸ **Messaging ▸ Services ▸ Create Messaging Service**.

1. Name it `Kosher Connect`; use case **Notify my users**.
2. **Sender Pool ▸ Add Senders ▸ Alphanumeric Sender ID**.
3. Enter `KosherCnct`.
   Rules: 1–11 characters, letters/digits/spaces, at least one letter.
   `KosherCnct` is 10 — fine. It is also case-preserving, so type it exactly as
   it should appear on the handset.
4. Finish the wizard. Nothing else in it matters for our use.

## Step 2b — REGISTER the sender ID (the UK is a pre-registration country)

Confirmed against Twilio's own docs, 08-16: the UK requires an alphanumeric
sender ID to be registered and vetted with the carriers BEFORE it can send.
This is not the same as adding it to a sender pool, and it is not instant.

Console ▸ **Numbers and Senders ▸ Alphanumeric senders ▸ Set up a new
alphanumeric sender ID**. It asks for the business (Hatsluche Ltd t/a Kosher
Connect, 421 Bury New Road) and what the messages will say. Then it waits on
carrier vetting — allow days, not minutes.

Plan around it: if SMS is wanted by a particular date, this is the step with a
queue in it, and it can only start once the account is off trial.

## Step 3 — point the app at it

Copy the Messaging Service SID (starts `MG…`) into Vercel:

    TWILIO_MESSAGING_SERVICE_SID = MG…

and redeploy. No code change: `lib/sms.js` already prefers the Messaging
Service over `TWILIO_FROM` when both are set.

## Step 4 — prove it, still safely

`SMS_TEST_TO` is still set, so the app is in TEST mode: Settings ▸ Messaging ▸
**send test SMS** delivers to that one number with a `[TEST → …]` prefix and
cannot reach a customer whatever anyone clicks. Send one. The handset should
show **KosherCnct** as the sender, not a number — that is the proof the sender
pool is wired.

## Step 5 — go live, on the owner's word only

Remove `SMS_TEST_TO`, set `SMS_LIVE=true`, redeploy. Standing rule (08-04):
this waits until Shloime is actually working in the app. Until then TEST mode
is the safety, and it is a good one — it cannot be bypassed from the UI.

Before flipping it, re-read the outgoing templates for "reply" wording: with an
alphanumeric sender, `Reply STOP` and `Reply YES` are both untrue. Opt-out has
to read "call 0161 531 1386".


## Delivery tracking (built 08-16, after the 21267 episode)

`email_log.status` only ever said what THIS APP did — held, redirected, sent.
Twilio returning a message SID means "accepted", not "delivered", and for three
weeks every message was accepted and then rejected with **21267 — Alphanumeric
Sender ID cannot be used as the 'From' number on trial accounts**. Two of those
were real rental reminders. The log said `redirected` for all of them.

So the app now asks Twilio to report back:

- `lib/sms.js` sets `StatusCallback` on every send, pointing at
  `<PUBLIC_BASE_URL>/api/sms-status`. With no `PUBLIC_BASE_URL` (and no
  `VERCEL_URL`) no callback is attached and sending is unaffected — losing
  observability must never be able to stop the shop texting anyone.
- `/api/sms-status` verifies **Twilio's own signature** using the account auth
  token, so there is no new shared secret. The signature covers the URL as well
  as the body, so it cannot be replayed against another endpoint.
- The verdict lands in `email_log.delivery_status` / `delivery_error` /
  `delivered_at`, kept SEPARATE from our own `status` so a delivery result
  cannot erase the fact that a message was a test redirect.
- The 06:00 sweep raises a rolling **SMSFAIL** task while anything failed to
  arrive in the last seven days — one task, not one per message, because a
  broken sender fails every message at once.

`/api/health` now reports `sms.deliveryTracking: on|off` so this can be checked
rather than assumed.

**Set `PUBLIC_BASE_URL=https://app.kosher-connect.com` in Vercel** to turn it on.
