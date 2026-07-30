# Letting the app read the shop's email

Written 30/07/2026, after the Lebara renewal-date backfill (362 reminder emails
swept by hand, 311 SIMs dated) and the flights cancellation event (39 bookings
reconciled from a spreadsheet). Both were things the app could have known the
day the email arrived. This is how to make that automatic.

## What "knowing" would actually buy us

* **SIM renewals.** Lebara's auto-renew reminder names the mobile number and the
  date. Parsed on arrival, `sims.next_renewal_date` stays true by itself instead
  of drifting until someone sweeps the mailbox.
* **Failed payments / plan changes.** Currently invisible until a customer
  complains. They become a task on that customer the moment the email lands.
* **Airline schedule changes and cancellations.** The TLV-route cancellations
  reached us as a spreadsheet days later. The airline emailed at the time — that
  email could flag the affected bookings the same hour.

## Route A — forward the mail to the app (recommended)

Gmail filter forwards the handful of senders we care about to an address on our
own domain; our email provider posts each one to the app; a parser per sender
turns it into a field update or a task.

```
Gmail (5311386k@gmail.com)
  └─ filter: from:(lebara | airline | provider…)  → forward to feed@kosher-connect.com
       └─ Forward Email  → POST /api/inbound/email  (signed)
            └─ parser registry → sims.next_renewal_date / bookings flag / task
                 └─ inbound_email row (audit: sender, subject, matched entity, action)
```

**Why this one.** No Google verification, no OAuth token to expire, no restricted
scopes, and it works the same for any sender we add later. Cost is nil — we
already own the domain and already run Forward Email. Roughly a day's work for
the endpoint plus the Lebara parser; about an hour per additional sender.

**Things it needs to get right:**

* Gmail makes you confirm a forwarding address once (it emails a code to it) —
  so the first step is a real mailbox/alias at `feed@kosher-connect.com`.
* The endpoint must verify the provider's webhook signature and only accept mail
  that our own filter forwarded. An open inbound endpoint is a way to feed the
  app forged "your renewal date is…" emails.
* Store the extracted fields and a message id, not whole bodies. Some of this
  mail contains customer PII, and passport numbers stay out of logs entirely.
* Anything the parser can't match to a SIM or booking becomes a task for a human
  rather than a silent no-op — that is how the 51 unmatched numbers in the
  backfill would have surfaced.

## Route B — read Gmail directly through the API

The app holds its own Google token and polls, e.g. every 30 minutes off the
existing Vercel cron. Better than Route A in one respect: it can search *history*,
so it could backfill years of past emails the way I did by hand, not just watch
new ones.

The blocker is scope. `gmail.readonly` is a **restricted** scope. For an app on
an ordinary Gmail account that means Google's annual third-party security
assessment before it can leave testing mode — real money, yearly. In testing
mode the refresh tokens expire every 7 days, which is exactly why the CLI
credentials we set up need re-authorising around 05/08/2026.

**This changes completely if the shop moves onto Google Workspace.** An app
marked Internal in a Workspace org skips verification altogether, and Route B
becomes the better option — a few hours' work, no forwarding to maintain, and
history search included. Worth revisiting the moment Workspace is on the table.

## Route C — status quo

Sweep the mailbox by hand when something looks stale. It works, it's what we did
this week, and it is fine at this volume — but it only happens when someone
thinks to do it, which is the failure mode both of this week's clean-ups shared.

## Recommendation

Route A now, Route B later if Workspace happens. Start with the Lebara reminder
parser alone: it's the highest-volume sender, it maps to one field we've just
proved we can populate, and it is the one that silently rots between sweeps.
