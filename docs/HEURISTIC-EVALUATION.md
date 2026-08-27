# Heuristic evaluation — Nielsen's 10, across the five counter flows

**27 August 2026.** One evaluator, the whole staff app, held against Jakob
Nielsen's ten usability heuristics. Every claim below was checked against the
code or measured in a browser; nothing here is an impression.

The flows are the app's own, not ones invented for this document. They are the
list `ops/harness/paths.mjs` walks nightly, and the harness proves each is
reachable two ways — by navigating and by the command palette:

1. **Hire a phone out** — Rentals → New rental
2. **Take a phone back** — Rentals → Manage
3. **Take a payment** — Customers → Details → Take payment
4. **Sell something** — Shop → Sell (the till)
5. **Book a flight** — Tickets & Flights → New booking
6. **Book a repair** — Repairs → New repair *(added 27 Aug)*
7. **Cash up** — Shop → Cash-up *(added 27 Aug)*
8. **Answer a text** — Messages → Reply *(added 27 Aug)*

The last three were missing from the first pass, which is worth saying plainly:
this document claimed five flows and the owner's list named three the pass had
never opened. They are covered below, and one of them produced the largest
single finding in either pass.

## What this found

Seventeen things were examined closely on the first pass. **One was a defect
worth the word** — and it was about money. The second pass, over the three
flows the first had missed, found a second one of a different kind: a whole
class of number that changes on screen and is announced to nobody. The rest of this document is mostly a record of things
that turned out to be right, which is a duller read and the more useful one: a
heuristic evaluation that finds a fault under every heading is usually
describing its evaluator.

---

### 1. Visibility of system status — **pass**

- Every tab paints a skeleton rather than a blank while it loads, and
  `ops/harness/loading.mjs` fails the build if a tab flashes a ghost it did not
  need or a real wait fails to ghost all the way to the fold.
- Every counter flow ends on the same finishing card (`showDonePanel`) that
  states what was saved, what was charged, what is still owed and by which
  method — rather than closing silently.
- The half-successes are named, which is the hard part and the one most
  products skip: *"Payment saved, but the receipt email failed."*, *"SIM saved,
  but the setup fee was not billed to the wallet."*, and — when SMS is
  HOLD-gated — *"Reply written to the log — SMS is on HOLD, so nothing was
  sent. They are still waiting."*
- **Measured**: after tonight's work the app answers a press in 40–80ms at 4×
  CPU throttling (`ops/harness/vitals.mjs`). It was 280ms on Settings, which is
  a status-visibility failure before it is a performance one — the screen was
  not saying "heard you" until the whole tab had been built.

### 2. Match between the system and the real world — **pass**

- One money vocabulary, enforced rather than agreed: `ops/harness/money.mjs`
  reads what is actually painted on screen and fails on a second way of saying
  the same thing. Its first run found the customers list saying "£45.00 debt"
  in a vocabulary of its own.
- Hebrew dates sit beside the civil ones throughout, because that is what the
  customer will say on the phone.
- Scanned every user-facing string for developer language — `null`, `API`,
  `token`, `payload`, `422`, "invalid input", "record not found". **None.**
- Statuses are the shop's words: "Reserved — pickup due", "Overdue",
  "It's back", "Not paid yet — the airline is holding the seats".

### 3. User control and freedom — **pass, with one deliberate limit**

- Escape closes every dialog, and the modal layer walk in the nightly sweep
  proves it for every layer, including stacked ones.
- Undo exists as a real pattern (`kcUndoable`: the screen changes at once, the
  server delete is held six seconds, a press puts it back). It covers three
  actions: deleting a phone from stock, deleting a customer document, deleting
  a booking row.
- It does **not** cover the other fifteen destructive actions, and after
  reading them that is the right call rather than a gap. Deleting a rental
  reverses a wallet charge; the bulk deletes reverse several at once. Those
  confirms name the customers, show the combined amount, and say *"This can't
  be undone"* — which is true. An undo that had to un-reverse ledger entries
  would be a worse thing than an honest confirmation.

### 4. Consistency and standards — **pass**

- One customer picker, built by one function, used in eleven places, and
  `ops/harness/picker.mjs` fails if any of them drifts.
- One icon voice, one type ramp, one spacing scale, one set of dark tokens —
  each with a sweep behind it (`icons.mjs`, `brand.mjs`, `theme-pairs.mjs`).
- **Checked every confirmation button label.** Not one says "OK", "Yes",
  "Confirm", "Continue" or "Submit" on its own; each names its own act —
  "Charge booking", "Delete rental", "Mark collected", "It's back", "Put it on
  account anyway". That is the textbook rule and it is unusual to find it kept
  across ninety dialogs.
- One inconsistency found and left: two dialogs with the identical title "Undo
  this match?" label their button "Undo match" and "Undo the match". A word.
  Recorded rather than changed — at this stage a cosmetic string edit buys less
  than the risk of touching it.

### 5. Error prevention — **pass**

- Every write that moves money is guarded twice: an in-flight lock on the
  client (`kcBeginWrite`) so a double-press cannot post twice, and a
  `clientRef` token so a retry that does reach the server collapses to one
  charge. **Checked all fifteen guard sites release the lock in a `finally`**,
  including the path where somebody opens the confirm and then cancels — a
  guard leaked there would leave the button dead for the rest of the session.
- Passport questions are asked *before* the money question on a booking:
  "there is no point confirming a charge for a trip that cannot happen".
- Confirmations show the amount, not just the act.
- The one genuinely clever one: the card charge sends `house-${ym}` as its
  idempotency key, so a repeat press *or a re-run of the same monthly
  settlement* collapses to a single charge.

### 6. Recognition rather than recall — **pass**

- The command palette (Ctrl/⌘-K) searches customers, screens and jobs by name.
- Every screen carries a next-action row: standing here, what does this person
  do next — computed from that screen's own data, and saying so plainly when
  the answer is "nothing".
- Saved views keep a filter+sort combination by name rather than asking anyone
  to rebuild it.
- Letter-jump in long lists, and it is documented in the ⌨ shortcuts help
  rather than left to be discovered.

### 7. Flexibility and efficiency of use — **pass**

Each of the five flows has a fast path and a learnable path, and the nightly
sweep walks **both** — 19 steps navigating, 20 by palette. A shortcut that
quietly breaks is worse than no shortcut, so it is checked rather than trusted.

### 8. Aesthetic and minimalist design — **pass**

- Row actions above the first two live behind a `⋯` menu, decided from the data
  rather than by taste: of 77 virtual numbers every one was Active and none had
  ever been deactivated, so Billing stays on the row and the rest fold away.
- Toasts were silenced for changes already visible on screen (a success message
  for something the reader can see is noise, not feedback).
- Empty states are results, not blank space: where nothing is outstanding the
  screen says so and *loses* the button.

### 9. Recognise, diagnose and recover from errors — **one real defect, fixed**

This is where the evaluation earned its keep.

**The card charge said the wrong thing when the connection dropped.** The
`catch` around `/api/charge-card` showed *"Charge failed."* — but a dropped
connection is not a declined card. The request may well have reached Stripe and
the card may well be charged; the only thing that certainly failed is hearing
back. "Charge failed." reads as an instruction to charge again, and the success
path six lines above already knew to say the opposite (*"Payment processing —
the card issuer hasn't answered yet. Check this customer's wallet in a minute;
don't charge again."*). It now reads:

> The connection dropped before the card answered — check this customer's
> wallet before charging again.

The refund had the same shape in the other direction and now says the same
kind of thing. So does the customer **merge**, which cannot be undone at all:

> The connection dropped during the merge — reopen the customer to see whether
> it went through before trying again.

Fourteen further messages were dead ends — "Failed.", "Delete failed.", "Could
not update.", "Copy failed", "Could not reach the server." — each now naming
what did *not* happen and what to do about it. The floating help timer's
failure was actively misleading: it read as though the timer had stopped, when
all that failed was opening a second window, so it now says the timer on the
page is still running.

### 10. Help and documentation — **pass**

`/manual` describes all twenty-seven screens and both public journeys, is
generated from `lib/manual.mjs` so it cannot drift, and `test/manual.test.mjs`
fails the build when a new tab, a new dialog or a renamed primary button is not
described. Sixty screenshots of the real app sit beside the words. It carries no
prices — those live in Settings, so the shop has one price list.

---

## Second pass — book a repair, cash up, answer a text (27 Aug)

### The finding: four numbers nobody hears

WCAG **4.1.3 Status Messages** is Level AA, and it is the one criterion this
app was failing without knowing it. The rule is not about labels: it is about a
value that changes as a result of what somebody did, presented without moving
focus. A sighted user watches it update. A screen-reader user hears their own
keystrokes and never the answer.

Four computed readouts had no live region, and each was the point of its screen:

| | tells the person | flow |
|---|---|---|
| `cuVariance` | whether the till is **over or short** | cash up |
| `posChange` | the **change due** to the customer at the counter | sell at the till |
| `rpTotal` | the repair total as services are ticked | book a repair |
| `bkFeeBreakdown` | the booking fee as the form is filled | book a flight |

The customer-facing pages were already right — `/portal`, `/repair` and
`/welcome` carry eight `role="status"` regions between them. The staff app had
five in twenty-six thousand lines, and not one of them was on a number. That is
the shape of the miss: the public side was audited and the counter was not.

All four now carry `role="status"`, and `test/liveRegions.test.mjs` holds them
there. The test is deliberately a **list, not a rule** — nothing in the source
distinguishes a status message from ordinary content, so the judgement was made
once and written down. What the test prevents is the judgement being quietly
undone.

`plAmountLabel` was examined and deliberately left alone: it is a `<label>`
whose text swaps when a checkbox is ticked, which the label association already
announces. A live region there would say it twice.

### Cash up — otherwise strong

- **H1**: the variance is computed as you type, the opening float and expected
  cash are both on screen, and counting an earlier day carries its own banner
  saying today's figures are not shown. Little else in the app is this clear.
- **H2**: "opening float", "expected cash in till", "over", "short" — counter
  language throughout, not accountancy.
- **H5**: `POST /api/cashup` upserts on the date, so a double-press cannot
  double-count. This is the one money write in the app without an in-flight
  lock, and it does not need one.
- **H9**: two dead ends fixed. "Could not save the count." now says the figure
  is still in the box — which matters when somebody is standing at an open till
  holding the cash.

### Answer a text — the best-guarded flow in the app

- **H5, and the strongest example of it anywhere here**: somebody who texted
  STOP gets no Reply button. Not disabled — *absent*. The comment in the source
  says why: "answering a person who has just asked to be left alone is the one
  message this shop must not send, so the control is not there to be pressed."
- They still get a **Task** button, because taking somebody off a list is work.
  Refusing the wrong action without refusing the person is a distinction most
  software does not make.
- **H2**: `sms_in` is a column value. It reads "from a customer" — the source
  notes it "sat under the channel looking like a fault code" until somebody
  fixed it.
- **H1**: an unanswered inbound text carries "waiting for an answer" in red, and
  answering the last one refreshes the dashboard row, so the app stops claiming
  somebody is waiting the moment they are not.

### Book a repair — no finding beyond the total

The staff side reuses the same customer picker, the same confirm shape and the
same charge guard as every other flow, which is the point of having them. The
public form (`/repair`) was already covered by the first pass and carries a
per-code error message for each way it can fail.

---

## The one thing this document cannot tell you

A heuristic evaluation is one person applying rules. It is good at finding
**violations** and blind to **friction**: the step that is technically fine and
still takes four seconds too long every single time. Only somebody standing at
the counter can report that.

`docs/USABILITY-TESTING.md` is the instrument for it — the task script, the
System Usability Scale, the Single Ease Question and the short VisAWI. It needs
Shloime and a member of counter staff, and it is the piece of this quality
programme that cannot be done from a keyboard.
