# The next action on every screen — and what it costs in taps

Port item B2, shipped 19 August 2026. The source repo is
`earothbart-ai/pixel-perfect-peek`, which this session **cannot reach**
(`add_repo` refuses cross-owner adds), so everything here is implemented from
the written brief rather than ported from code.

The question asked of each screen: *standing here, what does this person do
next, and how many taps is it?* Where the honest answer was "read the page and
work it out", the screen now says it — one row at the top, phrased as a verb,
computed from that screen's own data.

## The count

Counted from the moment the screen finishes loading to the moment the action is
underway. **A tap that only scrolls is not counted; a tap that hunts for the
right row is.** That second rule is the whole reason the numbers are not
flattering-by-definition: on a list of 290 SIM plans, "find the late ones" was
never one tap even though the filter was one control away.

After is always **1** — the row's own button — and the harness
(`ops/harness/nextaction.mjs`) presses it and checks where it lands, so the 1 is
measured rather than assumed.

| Screen | Next action | Taps before | Taps after |
|---|---|---:|---:|
| Dashboard | Chase the phones that are overdue back | 2 (read the feed, click the line) | 1 |
| Customers | Show the customers with no way to reach them | 3 (open the filter, find "unreachable", apply) | 1 |
| Phone Rentals | Show the phones overdue back | 3 (open status dimension, pick Overdue, apply) | 1 |
| SIM Plans | Show the plans past their renewal date | 3 (open Status, pick Late, apply) | 1 |
| Tickets & Flights | Show the passengers flying soon and not checked in | 3 (filter to Upcoming, then read the check-in column) | 1 |
| Tickets & Flights | Read the airline emails waiting | 2 (scroll to the panel, press Read) | 1 |
| Wallet | Show the customers in arrears | 3 (leave for Customers, filter, apply) | 1 |
| Repairs | Tell the customers whose repair is ready | 3 (open the filter, pick Waiting for collection, apply) | 1 |
| Shop | Show the stock that is low or out | 3 (open the filter, pick Low, apply) | 1 |
| Shop | Show the supplier returns still open | 2 (scroll past the stock table to find the section) | 1 |
| Tasks | Start at the top of what is due | 3 (open the filter, pick Overdue, apply) | 1 |
| Confirm Data | Work the batch | 1 (it is the screen) | 1 |
| Carrier Mail | Show the mail nobody has dealt with | 1 (it is the default filter) | 1 |
| Online & Print · Kol Torah · Virtual Numbers · Settings | — | — | — |

Two rows are honestly **1 → 1**: Confirm Data and Carrier Mail already open on
exactly the thing that is outstanding. They keep a row anyway, because the value
there is not the saved tap — it is being told the queue is 1,861 long, or that
it is empty, without counting rows.

The last line is not an omission. Online & Print, Kol Torah, Virtual Numbers and
Settings are places you go to do a thing, not queues that fill up on their own.
A row inventing work for them would be noise, and noise is how a summary row
becomes furniture nobody reads.

## Deliberately not made one tap

The brief asks for this section, and for a shop the answers are all about money
and about promises made on somebody's behalf.

- **No one-tap "take payment" anywhere.** A payment row on a summary is a
  payment taken without the screen that says who is paying, how much, and by
  what method. Money must never be one press away from a list.
- **No one-tap "pay the consignor" on Kol Torah.** Same reason, and worse: it
  pays a third party out of the shop's account on the strength of a number
  nobody has opened.
- **No one-tap "text them all" on the overdue or arrears rows.** The rows are
  the point — "1 customer in arrears" invites you to look at *who* before
  anybody is contacted. A bulk send from a count is how the wrong person gets
  chased, and live sends are HOLD-gated regardless.
- **No one-tap "confirm all" from the Confirm Data row.** Confirming means "I
  know this is right", not "I have read it". The batch screen has a bulk button
  limited to the twelve records actually on it; a summary row could answer for
  1,861 records nobody has looked at, which would empty the word out.
- **No "mark all collected" on Repairs.** A repair leaves with a person. The
  action is telling them, not closing the ticket.
- **No second count on the dashboard.** Its metric cards already carry these
  numbers, and the row reads from the SAME expressions rather than its own — a
  second count is a second thing to keep true, and the day they disagree is the
  day both stop being believed.

## How it is held together

- **The row decides nothing.** `lib/nextAction.mjs` turns counts into words;
  each screen passes in the counts it already computes for its own headline
  numbers. Data → decision → words, never words back to decision.
- **The broken state is unwritable.** `nextAction()` throws rather than return a
  row that names an action and offers no way to do it — the shape the brief says
  six of the source app's screens shipped. `test/nextActionMirror.test.mjs`
  holds every action a screen can *name* against the table of what actions
  actually *do*, in both directions, so a dead button fails a test instead of
  reaching a counter.
- **Going there means going there.** `focusPanel()` scrolls the panel into view
  **and** moves keyboard focus into it — the first focusable control inside, or
  the panel itself with `tabindex="-1"`. An action that only scrolls is the same
  dead end for anyone not using a mouse.
- **Verified where it runs.** `ops/harness/nextaction.mjs` opens all fifteen
  staff screens, checks each row is either "clear with no button" or "a sentence
  with a button", presses all thirteen actions and checks each lands on the
  right tab with the keyboard moved with it. Green at 390px and 1280px, in light
  and dark, at all three text sizes — twelve combinations.
