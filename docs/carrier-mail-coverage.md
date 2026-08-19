# Why a carrier email did not reach the app

Raised by the owner at 03:20 on 19 August 2026, with a screenshot: a Cellular
Israel order confirmation (`Re: Your Cellular Israel phone numbers for order
#000029649`, from `info@cellularisrael.com`, 03:12) sitting in Gmail and nowhere
in the app.

## What was actually wrong

**The app has never received a single email from Cellular Israel.** Not that one
— any of them. Checked against production:

| sender | messages ever | most recent |
|---|---:|---|
| `LebaraMobile@lebara.com` | 21 | 18 Aug |
| `hello@usmobile.com` | 8 | 18 Aug |
| `penny@1pmobile.com` | 5 | 18 Aug |
| `team@smarty.co.uk` | 3 | 19 Aug |
| `Care@lebara.com`, `office@spusu.co.uk`, giffgaff ×2 | 1–2 each | 18 Aug |
| **`*@cellularisrael.com`** | **0** | **never** |

Forty messages arrived in the last twenty-four hours, so nothing is broken: mail
is flowing. The pattern in that table is the answer — every sender the app knows
is a **UK** carrier, plus US Mobile. The Israeli side of the shop has never been
forwarded at all.

## The cause is a mailbox rule, not code

The app cannot read a mailbox. It receives what Gmail **forwards** to it, and
nothing else. `pages/api/inbound/mail.js` accepts any sender — it only ever
turns away a message that is not a ticket, or that classifies as marketing — so
a Cellular Israel email would have been stored the moment it arrived. It never
arrived.

**The fix is a Gmail filter, and only the owner can make it.** In the mailbox
that forwards to the app, add a rule forwarding mail from `cellularisrael.com`
the same way Lebara and US Mobile are already forwarded. Worth doing for every
Israeli supplier at the same time, since none of them is covered today.

There is no way for the app to notice this by itself. Software cannot report
mail it was never sent, which is exactly why it went unnoticed for however long
it has been true.

## What was fixed in code

`carrierOf()` in `lib/inboundMail.mjs` named twelve carriers, all of them UK.
`lib/rentalPoolImport.mjs` has known about Golan and Fizz since the pool import
was written — two lists of the same carriers, one of them short, and the short
one is the one that labels incoming mail. So a Cellular Israel message, once
forwarded, would have landed with no carrier name against it.

Added: Cellular Israel, Golan, Pelephone, Cellcom, Partner, Hot Mobile, 019
Mobile, Fizz and Lucky Mobile.

**Naming a carrier here does not make its mail arrive.** It only means that when
the forwarding rule is added, the message lands labelled instead of blank.

## Worth knowing about that particular email

It is a **reply in a thread the shop started** — "On 8/18/2026, c b wrote: I want
to reactivate the SIM…". Gmail filters written around carrier newsletters and
order confirmations often miss replies, because the sender, the subject and the
labels all differ from the first message in the thread. If the forwarding rule
is written on the subject line rather than the sender domain, replies will keep
being missed even after Cellular Israel is added. Match on the **sender domain**.
