# Two-way SMS — buying the number and turning replies on

Owner decision, 17 Aug 2026: Shloime wants customers to be able to **reply** to
the shop's texts.

## Why a number is required

An alphanumeric sender ID — `KosherCnct`, which the account already has — is a
**display name, not a phone number**. There is no handset behind it, so a
customer's phone has nothing to reply to. The reply is not lost; it is
impossible.

So the choice is per message, and it cannot be had both ways:

| | Shows as | Can they reply? |
| --- | --- | --- |
| Alphanumeric sender | `KosherCnct` | **No. Ever.** |
| A real number | `+44 …` | Yes |

## Order of work — the endpoint FIRST

**Done (17 Aug): `pages/api/sms-inbound.js` is built and deployed.**

Twilio does **not** retry an inbound webhook the way it retries a status
callback. A reply that arrives with no endpoint behind it is gone. The endpoint
was therefore built before the number, not after — it costs nothing to have it
waiting.

What it does: verifies Twilio's signature over this exact URL (the account auth
token, no new secret), matches the sender to a customer on the last nine digits
of the number, and writes the message into `email_log` beside everything the
shop sends — so one screen holds the whole conversation. An unmatched or
ambiguous sender is logged unmatched rather than filed against a guess.

What it deliberately does **not** do: reply. It answers Twilio with an empty
TwiML document, the documented "received, no auto-reply". Live sends are
HOLD-gated until the owner turns them on, and an auto-responder would be a send
nobody approved, going out at whatever hour the customer texted.

## Buying the number

1. Twilio Console → **Phone Numbers → Buy a number** → country **United
   Kingdom** → tick the **SMS** capability.
2. Twilio states at the point of purchase which **UK regulatory bundle** the
   number needs — an address, and for some number types identification. This
   is the step with a queue: allow a day or two for approval. Start it before
   you need the number, not on the morning you do.
3. Number type: a **mobile-style** number (`+44 7…`) is what a customer expects
   to reply to. A local number can carry SMS on Twilio, but a text from an
   0161 number reads oddly to a UK customer and some carriers treat it less
   kindly.
4. Cost is a small monthly rental plus per-message. Check the console for
   today's figure rather than trusting a number written down here.

## Wiring it up

1. **Sender pool.** Add the number to Messaging Service `MG…6a7632`.

   Then decide, and decide deliberately: if both `KosherCnct` and the number
   sit in one pool, **Twilio chooses** which goes out, and a message sent as
   the alphanumeric ID cannot be replied to. For anything that expects an
   answer, the pool should hold **the number only**. If the brand name is
   wanted later for one-way announcements, that is a second Messaging Service —
   not a mixed pool.

2. **Point the number at the app.** The number's settings → Messaging →
   *A message comes in* → **Webhook**, `HTTP POST`:

   ```
   https://app.kosher-connect.com/api/sms-inbound
   ```

   (Or set it on the Messaging Service's Integration tab, which covers every
   number in the service.)

3. **Test it.** Text the number from your own phone. Within seconds:
   - Settings → Messaging → the message log shows a row badged **↩ REPLY**,
     with your name against it if your mobile is on your customer record.
   - The Vercel runtime log shows one `[sms-inbound]` line.

   If the log shows nothing, check Twilio's Debugger — a 403 there means the
   webhook URL Twilio called and the URL it signed disagree (usually a
   trailing slash or `http` vs `https`).

## STOP, and what it means

A customer replying `STOP` is an opt-out. **Twilio's Messaging Service enforces
it** — it refuses further sends to that number, and a later send fails with
error 21610. Our endpoint records it as `↩ STOP` in the log so a person knows
*why* the reminders stopped and can ring them instead if it matters. It does
not need to re-implement the block, and should not try to.

`START` puts them back on, also handled by Twilio.

## What is still missing, honestly

Replies land in the message log and in the Vercel log. There is **no screen
that says "3 replies are waiting for an answer"** yet, and no way to reply from
inside the app — answering means picking up a phone or using the drafts.

That is the right next piece of work once the number exists and there is real
traffic to shape it around. Building an inbox before a single reply has arrived
would be guessing at what the shop needs from it.

## Related

- `pages/api/sms-inbound.js` — the endpoint
- `lib/inboundSms.mjs` + `test/inboundSms.test.mjs` — matching, stop words, log shape
- `pages/api/sms-status.js` — the outbound half: did the message arrive?
- `docs/TWILIO-SENDER.md` — the alphanumeric sender ID, and the 21267 story
