# Carrier email into the app — setup

Owner decision, 16 Aug 2026: **route B, Forward Email webhook.** Mail reaches
the app as it arrives instead of being swept for afterwards.

    Lebara  →  gitt.bilig+moshe@gmail.com  →  (Gmail auto-forward)
            →  sims-in@kosher-connect.com  →  (Forward Email webhook)
            →  POST /api/inbound/mail      →  sim_mail row, paired to a SIM

Why not read Gmail from the app directly: a Google OAuth app in **Testing** mode
expires its refresh token every 7 days — which is exactly what killed the July
sweep around 5 Aug — and getting out of Testing means Google verification plus a
CASA security assessment, because Gmail read access is a *restricted* scope.
Weeks of process and an annual cost, for one mailbox. This route needs none of
it.

## How the pairing works

**The recipient address is the key.** 535 of the shop's SIMs are registered at a
plus-addressed Gmail — `gitt.bilig+moshe@gmail.com`, `shevabruches111+14@…` —
and Gmail delivers every `base+anything@gmail.com` into `base@gmail.com`. That
is why it all lands in one mailbox, and it means the address on a message names
one SIM rather than one mailbox.

On today's 797 SIMs:

| | |
|---|---|
| address unique to one SIM → paired outright | **417** |
| shares an address with other SIMs → number narrows it | **317** |
| no address on record → number only | **63** |

The shared ones are the pool accounts; the five biggest carry 37, 31, 25, 23 and
16 SIMs each.

**Two things the code will not do.** It will not guess between candidates — a
wrong pairing files one customer's line under another's account. And it will not
pair on the `kosher-connect.com` forwarding address, which rides on every single
message and would otherwise match everything to nothing. Both have tests named
after them.

Every message lands in `sim_mail` with a confidence: `address`, `address+number`,
`number`, `ambiguous`, or `unknown`. The last is the valuable one — a number
live at a carrier that the app has never heard of, which the July sweep found
241 of and the August partial found 54 in a fortnight.

## Setting it up

**1. Generate a secret** and put it in Vercel env as `INBOUND_MAIL_SECRET`
(Project → Settings → Environment Variables → Production). Any long random
string; it never goes in the repo or in chat. Redeploy so the function picks it
up.

**2. Create the alias** — in your own app, **Settings → email addresses → add**:

| | |
|---|---|
| address | `sims-in` |
| forwards to | `https://<the production domain>/api/inbound/mail?key=<the secret>` |

An alias recipient is normally a mailbox; an https URL makes Forward Email POST
the parsed message to it instead of delivering it. Until 08-16 this screen
rejected anything without an `@` and the alias had to be made in Forward Email's
own dashboard — it now takes either.

The URL is stored EXACTLY as typed. Recipients used to be lowercased, which is
harmless for a mailbox and fatal here: the secret sits in `?key=`, and query
strings are case-sensitive, so folding the case leaves an alias that looks
right and 401s on every message. Treat that URL as a credential — the secret in
it is the entire gate, since Forward Email cannot sign requests for us.

**3. Turn on forwarding in the shop Gmail** (`5311386k@gmail.com`):
Settings → Forwarding and POP/IMAP → *Add a forwarding address* →
`sims-in@kosher-connect.com`. Google emails a confirmation code to that address;
it will arrive at the webhook rather than an inbox, so read it from the Vercel
function logs (or temporarily point the alias at your own mailbox to catch it).
Then choose **forward a copy and keep Gmail's copy in the Inbox** — keeping the
copy means nothing is lost if the webhook ever misbehaves.

If you would rather not forward everything, create a Gmail filter (`from:lebara
OR from:1pmobile OR …`) and forward only matching mail. Everything works the
same; the app simply sees less.

### Two hops, one business-only inbox (17 Aug)

The shop's SIM accounts are spread over seven of its own Gmail mailboxes —
gittbilig (336 SIMs), redfarbilig (86), shevabruches111 (64), heimishecentre
(59), hashomrimmcr (55), mendlhersh and shloimea1 (30). Those mailboxes already
forward their carrier mail into **5311386k@gmail.com**, which — unlike
gitt.bilig — is business-only.

So the shop's own suggestion is the right architecture: point the app at the
business-only inbox and let it forward **everything**, rather than maintaining a
carrier filter in seven mailboxes and missing one every time a new carrier
appears (giffgaff, Talk Home and Asda Mobile were all missing on 17 Aug).

It works because **the original recipient survives a Gmail forward.** A message
that reaches the app through two hops carries

    Delivered-To: 5311386k@gmail.com          ← the hub
    To:           gitt.bilig+moshe@gmail.com  ← the SIM

and `matchSimForMail` looks up EVERY recipient, so the hub — which no SIM is
registered at — contributes nothing and the real address does the work.

One thing that had to change for it: the row used to store `recipients[0]`,
which after a forward is the hub on every single message. `matchSimForMail` now
reports **which address matched**, and that is what is stored and shown, so the
queue says `gitt.bilig+moshe@gmail.com` rather than the hub 800 times.
`test/simMailMatch.test.mjs` covers both hops.

**4. Check it.** Send anything to `sims-in@kosher-connect.com` and look for a
row:

    select received_at, carrier, confidence, recipient, subject
    from sim_mail order by received_at desc limit 5;

`confidence = 'unknown'` on a test message is correct — it isn't about a SIM.

## What happens daily

The 06:00 sweep (`/api/cron/sweep`, section 6) turns the unpaired pile into two
rolling tasks, one per pile rather than one per message — Lebara alone mails
hundreds of times a month:

- **SIMNEW** — *"N numbers live at a carrier, not on the books"*, with the
  numbers in the notes. This is the 241-number problem, caught the day it
  happens.
- **SIMPAIR** — *"N carrier emails need pairing"*, for pool-address mail with no
  number in it.

Both close themselves when their pile empties.

## The screen

**Services → Carrier Mail.** Three views: *Needs a human* (the default and the
only one that is work), *Filed*, and *Everything*.

An `ambiguous` row arrives with its candidates — the SIMs registered at that
recipient address — so settling it is one click, and the click writes
`sim_id` + `resolved_at`. Candidates are recomputed on every read rather than
stored, so a SIM added after the message arrived still shows up for it.

An `unknown` row has nothing to pick, because the SIM genuinely is not on the
books; the row says so and the number is there to act on. **Dismiss** resolves
anything without pairing, for mail that is simply not about a SIM.

`resolved_at` is what empties the daily SIMPAIR task.
