# Twilio — going live with an alphanumeric sender

Owner decision, 16 Aug 2026: **"KosherCnct" alphanumeric sender only.** No
Twilio phone number. That choice is what this runbook is written around, and it
has one consequence worth stating plainly before the steps: **an alphanumeric
sender cannot receive replies.** A customer who answers a KC text is texting
into nothing — no bounce, no error, the message simply never arrives. Every
message the app sends must therefore tell people how to reach a human
(0161 531 1386), because "just reply" will not be true.

The upside is that it removes the whole regulatory path: no number purchase, so
no Twilio Regulatory Bundle, so **no photo ID and no proof of address** for
Shloime or for 421 Bury New Road.

## Where we are

| | |
|---|---|
| App code | done — `lib/sms.js`, `/api/sms`, `/api/sms-test`, Settings → Messaging |
| Credentials in Vercel | present (health 08-04: `sms: configured, provider twilio, mode test`) |
| Twilio account | **trial** — console screenshot 08-16, £11.71 credit, registered `tech@kosher-connect.com`, opened 20 Jul |
| Send gate | TEST — every message goes to `SMS_TEST_TO`, never a customer |

The account is the blocker, not the app. **Alphanumeric Sender IDs are not
available on trial accounts**, so step 1 is not optional for this route.

## The order that matters

Upgrade → register the sender ID → create the Messaging Service → add the
sender to its pool → point the app at it. A Messaging Service can be created at
any time (and one already exists: `KosherConnect`, SID `MG541b51d6…`), but its
sender pool will refuse an alphanumeric sender while the account is on trial.

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
