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

Three things it will not do:

| | |
|---|---|
| convert a currency | A €170 ticket does not go in the pounds box at a rate nobody chose. The amount goes in the notes and the box stays empty. |
| pick between two customers | The shop has three pairs of same-named customers. A tie preselects **nobody** and offers both. |
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

Then **Settings → Filters and Blocked Addresses → Create a new filter**, and in
the **From** box paste:

    wizzair.com OR ryanair.com OR easyjet.com OR elal.co.il OR elal.com OR
    britishairways.com OR ba.com OR lufthansa.com OR klm.com OR airfrance.com
    OR turkishairlines.com OR aerlingus.com OR jet2.com OR virginatlantic.com
    OR israir.co.il OR arkia.co.il OR swiss.com OR austrian.com OR
    brusselsairlines.com OR lot.com OR flypgs.com OR emirates.com OR
    edreams.com OR opodo.co.uk OR kiwi.com OR expedia.co.uk

→ **Create filter** → tick **Forward it to** `tickets-in@kosher-connect.com` →
**Create filter**.

This is a personal mailbox, so a filter is the right shape here — unlike the
SIM hub, where forwarding everything is what stops a new carrier being missed.
Nothing that is not from an airline leaves the mailbox.

**A second filter is worth adding for the agents you book through by name**, if
any of them mail from an address that is not on that list. Subject terms work
too: `subject:("booking confirmation" OR "e-ticket" OR "your flight")` — but
keep those in their own filter, because a subject match is where a hotel
confirmation would sneak in.

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

## What is not built

- **No return legs.** A booking holds one travel date, so a return is a second
  booking. The card says so when the mail mentions one; it does not raise it.
- **No refunds.** A cancellation email raises a high-priority task and stops.
  What happens to the customer's money is a decision, and the July Wizz Air
  reconcile is the reason it will stay one.
- **No attachments.** Airlines put the itinerary in the body; the ones that
  attach a PDF instead will parse `thin` and need typing. If that turns out to
  be common, the OCR path already in the app is where it would go.
