# Airline confirmations into the app — setup

Owner, 18 Aug 2026: *"can we add a filter to the ch702 gmail to forward all
airline tickets, so that when he books a ticket, he shouldnt have to enter in
the app manually… the app should match with customer name and suggest a task to
confirm this customer bought a ticket from x to x for this price? and take from
there to charge wallet etc."*

Yes. This is how it is wired.

    Wizz Air  →  ch7023518@gmail.com  →  (Gmail filter, airlines only)
              →  tickets-in@kosher-connect.com  →  (Forward Email webhook)
              →  POST /api/inbound/mail?kind=ticket
              →  ticket_mail row + a task: "Confirm ticket: Shmuel Bleier —
                 LTN → TLV, 12 Sept, £428.60"
              →  someone presses Confirm booking details
              →  the ordinary New Booking form, filled in
              →  save  →  bookings row + the wallet charge, exactly as at the counter

## Why it stops at "confirm"

Because the alternative is worse than typing. A parser that posted the wallet
charge itself would turn one bad regex into a customer billed for a stranger's
flight — and the mails it has to read are a moving target written by twenty
different airlines. So the app reads what it can, says what it could not, and a
person presses save. The typing disappears; the decision does not.

The same rule runs through the parser (`lib/ticketMail.mjs`): **it would rather
leave a field empty than fill it wrongly.** Every value is read from a label the
airline actually wrote. There is no "take the biggest number as the price" —
a mail full of baggage fees and compensation limits gets no price at all, and
the card says `price?` in red. A blank is a number someone types. A wrong one is
money that moves.

Four things it will not do:

| | |
|---|---|
| convert a currency | A €170 ticket does not go in the pounds box at a rate nobody chose. The amount goes in the notes and the box stays empty. |
| pick between two customers | The shop has three pairs of same-named customers. A tie preselects **nobody** and offers both. |
| keep what isn't ours | Mail on the tickets alias that is not ticket-shaped is dropped at the door — no row, no body, no task. The filter is fed from a personal mailbox; what the app does not need, it does not store. |
| book a cancellation | A cancellation email is flagged, and its main action is *Dealt with*, not *Book it*. |

## What lands where

`ticket_mail`, one row per message, holding what the mail appeared to say next
to what a person decided about it. `booking_id` is the join to the real booking,
set only when someone confirmed. Nothing in that table is money.

The task is what makes it visible: one `TICKET-<id>` task per message, raised at
ingest and closed the moment the ticket is booked or dismissed. It carries a
**✈️ Confirm booking details** button that opens the filled-in form directly, so
the task is a doorway rather than a note.

The queue itself sits at the top of **Tickets & Flights**, above the register,
because every card on it is a ticket the shop has bought and not yet charged
for.

## Setting it up

The webhook, the secret and the Forward Email alias all work exactly as they do
for carrier mail — read `docs/INBOUND-MAIL.md` first; only steps 2 and 3 differ.

**1. The alias.** In the app, **Settings → email addresses → add**:

| | |
|---|---|
| address | `tickets-in` |
| forwards to | `https://<the production domain>/api/inbound/mail?key=<the secret>&kind=ticket` |

Same `INBOUND_MAIL_SECRET` as the SIM alias — one secret, one endpoint. The URL
is stored exactly as typed, and it is a credential: the key in it is the whole
gate.

`kind=ticket` forces the ticket path for everything that comes down this alias.
Without it the endpoint still decides for itself from the content (a Wizz Air
sender, an e-ticket phrase), which is what happens to anything forwarded to
`sims-in` — so a ticket that came the wrong way still lands in the right queue.
The parameter only removes the guesswork for a mailbox that is *only* ever going
to send tickets.

**2. The Gmail filter, in `ch7023518@gmail.com`.**

First add the forwarding address: **Settings → Forwarding and POP/IMAP → Add a
forwarding address →** `tickets-in@kosher-connect.com`. Google sends a
confirmation link to it, which arrives at the webhook rather than an inbox — it
will appear as a card in the ticket queue, and **Read the email** shows the
link. (Or read it from `ticket_mail.body` directly.)

Then **Settings → Filters and Blocked Addresses → Create a new filter**, and put
this in **Has the words** (not the From box — the query below searches both):

    from:(wizzair.com OR ryanair.com OR easyjet.com OR elal.co.il OR elal.com OR
    britishairways.com OR ba.com OR lufthansa.com OR klm.com OR airfrance.com OR
    turkishairlines.com OR aerlingus.com OR jet2.com OR virginatlantic.com OR
    israir.co.il OR arkia.co.il OR swiss.com OR austrian.com OR
    brusselsairlines.com OR lot.com OR flypgs.com OR emirates.com OR
    edreams.com OR opodo.co.uk OR kiwi.com OR expedia.co.uk OR trip.com OR
    gotogate.com OR mytrip.com OR esky.co.uk OR travelup.com OR
    alternativeairlines.com OR budgetair.co.uk OR netflights.com OR
    ebookers.com OR cheapoair.com)
    OR subject:("booking reference" OR "e-ticket" OR "your flight" OR
    "flight confirmation" OR "boarding pass" OR itinerary OR PNR)

→ **Create filter** → tick **Forward it to** `tickets-in@kosher-connect.com` →
**Create filter**.

**The second half of that query is the important half.** Owner, 18 Aug:
*"sometimes its booked via 3rd party like wiki.com and much more."* A list of
senders can never be complete — the shop books through whoever is cheapest that
week — so the subject terms are what catch an agent nobody has heard of. The
sender list is not there to decide what gets forwarded; it is there so a
recognised agent gets its NAME on the booking.

**And a broad filter out of a personal mailbox is safe here, by design.** The
subject terms will occasionally catch a hotel, a restaurant or an Amazon order.
Anything arriving on the tickets alias that is not ticket-shaped is **dropped at
the door** — nothing stored, no row, no body, no task. A false positive costs one
wasted webhook call and leaves no trace of private post in the shop's database.
The single exception is Google's own forwarding confirmation, which is not
ticket-shaped and is the one message that has to be readable: it carries the
code that turns the forward on.

If you start using an agent regularly, tell me its domain and it goes on the
list — that only improves the name on the booking; the mail was already getting
through.

**3. Check it.** Book something, or forward yourself an old confirmation, and
look:

    select received_at, airline, booking_reference, origin, destination,
           travel_date, price, currency, confidence, customer_confidence
    from ticket_mail order by id desc limit 10;

`confidence` is how much of the mail parsed — `full` means reference, route,
date and price all came out, and the card is one click from being a booking.

## When it reads something wrong

Fix the booking on the form and press save — the app's record is what matters
and it was never going to be the email. Then say what it got wrong, and the
parser gets a test: `test/ticketMail.test.mjs` is where every airline's layout
is pinned down, and `ops/harness/tickets.mjs` drives the whole path from card to
form offline, so a fix for one airline cannot quietly break another.

## One journey, several emails, several payers

Two things a real booking does that one email cannot express, both on the card:

**➕ Add to a booking** — a self-transfer journey arrives as two or four
separate confirmations. The first is confirmed as the booking; the rest are
**flights on it**, not bookings of their own. Attaching appends a
`booking_legs` row carrying that email's own airline and its own PNR, and
settles the card. **No money moves** — the wallet charge was posted when the
booking was made, and the modal says so in those words. A flight dated later
than the day the trip starts is guessed to be the way home, which a person can
change in one click.

**👥 Split across payers** — shown only when the email names more than one
passenger. One booking per payer, each with its own wallet charge, sharing the
reference: exactly what the register shows the shop already doing by hand
(`XU2WWH` is three bookings, three customers, one PNR). The fee rule is chosen
at that moment, because the owner's answer on 18 Aug was that it depends:

| | |
|---|---|
| A fee each | Every payer carries the full fee — what the register shows today |
| Split it evenly | One fee for the trip, divided |
| All on the first payer | Whoever asked for the trip carries it |

Two details worth knowing. **The odd penny goes to the first payer** — £100.01
across three is 33.35 / 33.33 / 33.33, and it has to be somebody, deterministically.
And **each booking gets its own idempotency token**, so a partial failure is
safe to retry: the ones that succeeded stay exactly one charge each, and the
toast says which landed rather than silently re-running the lot.

## A return date changes what the checks mean

Once a booking has a way home, "is this passport valid?" is a different
question. Everything that guards a trip — the passport rule, the ESTA/ETA
coverage, the booking gate, the nightly reminder — now judges the **last day of
the journey**, not the departure. A document that expires while the customer is
abroad strands them there; the old rule called it valid.

One-way bookings are untouched: with no return date the last day of the trip is
the travel date, which is what every one of those rules already compared
against. `tripEnd()` in `lib/travelRules.mjs` is the single statement of it.

## What is not built

- *(built 18 Aug — the return check-in reminder, see BACKLOG.md)*
- **No refunds.** A cancellation email raises a high-priority task and stops.
  What happens to the customer's money is a decision, and the July Wizz Air
  reconcile is the reason it will stay one.
- **No attachments.** Airlines put the itinerary in the body; the ones that
  attach a PDF instead will parse `thin` and need typing. If that turns out to
  be common, the OCR path already in the app is where it would go.
