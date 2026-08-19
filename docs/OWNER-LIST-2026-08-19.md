# Owner's list, 19 August 2026 — status

Twenty-two items (twenty-one from the draft, plus #22 raised in chat), plus the
ported B2. Fifteen shipped. Updated as each shipped; the triage that follows is the original reading, corrected
where the owner said it was wrong.

## Done and on main

| # | item | commit |
|---|---|---|
| 3 | Promotion emails never reach the queue | `604d53f` |
| 5 | Manual updated with every change | already enforced by the gate |
| 7 | Only rearranges after a grip | `80cc75b` + `c5bc3d2` |
| 8 | Expand line sits too low | `c5bc3d2` — same root cause as 7 |
| 9 | "Why both?" — the ✕ beside a Close button | `175f23e` |
| 10 | One dropdown style, and where the choices are edited | `1fb0b55` |
| 13 | All Abish friends are the same person | `ddc0586` |
| 14 | Card overflows at extra-large text | `8cd2ff2` |
| 15 | Overdue link drops the filter | `175f23e` |
| 16 | Confirm Data shows one at a time | `daf129b` |
| 17 | Common questions on the welcome page | `92d034d` |
| 19 | "Open" and "login details" too near | `bf3752a` |
| 21 | The reply in SMS in settings isn't doing anything | `c5a0ea0` |
| 2 / 6 | Save or suggest as a task, wherever text lands | `1249160` |
| B2 | Next action on every screen + tap-count table | `c02a31f` |

## Answered — no work needed unless you want it changed

| # | question | short answer |
|---|---|---|
| 11 | Stripe timestamps | Stripe events carry their own `created`; our ledger stamps server time. Say which you want shown if they should agree. |
| 18 | "Default payment method" | The card the app would use for an off-session charge. It does not make anything charge by itself. |

## Waiting on a decision from you

| # | ask | what is blocked |
|---|---|---|
| 1 | Edit or delete the history log | An append-only log is evidence; an editable one is notes. Which? |
| 12 | Auto-renew as "needs attention" | Agreed it reads wrong; moving it changes what the dashboard nags about. |
| 4 | A folder per customer for documents | The folder view is a UI job; whether the customer sees it in the portal is a privacy decision. |
| 20 | Forward important carrier mail to the customer | A live customer send — HOLD-gated, needs your go-live word, and needs a rule for "important" plus certainty about the pairing. |
| 22 | Open an extra card when one is gripped aside | Raised in chat; not yet specified enough to build. |
| — | C1 (money wording / refuse-to-be-confident) | Held by your own brief; you chose to keep it held on 19 Aug. |

## ⚠ Still needs you, outside the app

**Google sign-in on the portal is broken in production.** Supabase → Authentication
→ URL Configuration: set Site URL to `https://app.kosher-connect.com` and add
`https://app.kosher-connect.com/portal` to the redirect allow-list. Staff sign-in
works, which confirms `/auth/google` was allow-listed once and the portal
callback never was. Until this is done no customer can sign in with Google.

**Two saved Gmail drafts hold live secret keys** — a Stripe live key pair and a
Resend API key. Worth deleting the drafts and rotating the keys.

---

## Answers to the questions asked (no work needed)

| # | question | answer |
|---|---|---|
| 1 | How do I edit or delete the history log? | You can't today — the customer timeline (`recordComm`) is append-only by design, and nothing in the UI edits or removes an entry. If entries should be correctable, that is a decision: an append-only log is evidence, an editable one is notes. Say which you want. |
| 5 | Remember to update the manual after every change | Already enforced, not just remembered: `test/manual.test.mjs` fails the gate when a tab, dialog or primary button changes without its manual entry. Kept true again tonight. |
| 11 | Timestamps at Stripe — pull from? | Stripe events carry their own `created`; the app stamps its ledger rows with our server time. If a receipt and the wallet ever disagree by a few seconds, that is why. Worth confirming which one you want shown. |
| 12 | Why is auto-renew a "needs attention"? It's just auto | Agreed, and it looks wrong. Needs-attention is meant for things a person must act on; an auto-renewal that will happen by itself is news, not work. Proposed: move it out of Needs attention into the day's summary. **Your call — it changes what the dashboard nags about.** |
| 18 | Where is "default payment method" seen, and what does it mean? | It is the card/bank the app would use for an off-session charge. It is set per customer and shown on the customer card; it does not make anything charge automatically. If that is not what you expected it to mean, the label is the problem, not the setting. |

## Bugs and gaps — concrete, actionable

| # | item | what it actually is |
|---|---|---|
| 21 | The reply in SMS in settings isn't doing anything | **Not a broken button — there is no reply control at all.** Inbound texts now land and show as ↩ REPLY (live since tonight), but nothing lets you answer one from the app. This is the natural next piece of the inbound work: a reply box on the message log that sends through the same HOLD-gated path. |
| 16 | Confirm data only showing one at a time | **[needs the screenshot]** — which screen? If it is the travel/passport confirm step, it may be paging one passenger at a time by design. |
| 15 | The overdue link goes to the plain SIMs tab with no way to filter the overdue ones | Real gap: the dashboard's overdue line navigates to SIMs but drops the filter. Saved views exist, so the fix is to open SIMs with the overdue filter applied rather than bare. |
| 13 | All Abish friends are the same person — different lines | This is exactly what `lib/identity.mjs` (built tonight) is for: `findDuplicates` buckets by person key, phone and name and grades the confidence. It is deliberately not wired to a live scan yet. Wiring it to the 👥 Duplicates tool is the follow-up — and it will find these. |
| 17 | "Common questions" gives wrong guesses and answers | The ? panel now leads with the current screen's guides, but the ranking inside is still crude. Needs a pass with real questions — worth collecting a handful of wrong ones as evidence. |
| 3 | Promotion emails should be filtered to never arrive in the app | Half-built already: `carrierMailKind` and `ticketKind` both classify marketing, and the ticket queue drops it. The carrier queue still files it. Making marketing never reach the queue is a small, safe change. |

## UI polish — loop-safe, filed to the backlog

| # | item | note |
|---|---|---|
| 7 | Auto-reorganises only after a click, and even then not the same size | **[needs the screenshot]** — sounds like a layout that settles only on a resize/reflow event. |
| 8 | The expand line sits too low; each card should auto-calculate its height the way it does a second after using the gripper | **[needs the screenshot]** — the "it gets it right after the gripper" detail is the clue: the correct height is computed, just not on first paint. |
| 9 | Why both? | **[needs the screenshot]** — two controls doing one job. |
| 10 | The odd-styled dropdown — one style throughout the app, and where are these editable? | Real inconsistency: some selects are native, some are custom. Worth one sweep. "Where editable" depends which list it is — most are Settings lists (repair stages, void reasons, stock categories). |
| 14 | At extra-large text the card overflows | Follows tonight's text-size work. A genuine Simple Mode bug: the card is sized for the standard ramp. |
| 19 | "Open" and "login details" are too near — not proportional | Spacing on that row. |

## Bigger asks — need a decision before building

| # | ask | why it is not a quick job |
|---|---|---|
| 20 | Every important carrier mail should be forwarded to the customer's email on file, with the body — login code, successful renewal, needs attention | This is a **live customer send**, so it sits behind the HOLD gate and your go-live word. It also needs a rule for "important" (the `carrierMailKind` classes are the natural basis: `port_in_complete`, `pac_issued`, `payment_failed`, plus a login-code class we do not have yet) and a guard against forwarding a message to the wrong person — the pairing has to be certain, not probable. Worth doing, carefully. |
| 2 / 6 | Why not save/suggest as a task? Where else does text land besides Settings → Text — carrier mail? Why not taskable? | The same idea twice: anything that arrives should be able to become a task in one click. Carrier mail already raises tasks for actionable kinds; SMS and other inbound do not. A general "make this a task" affordance is the right shape. |
| 4 | A folder per customer for documents, for us or for them | Customer documents already exist and are attached per customer. What is missing is the *folder* view, and the question of whether the customer sees it in the portal — that second half is a privacy decision, not a UI one. |


## ⚠ Found live, 19 Aug 00:56 — Google sign-in on the portal is broken in production

The owner pressed **Continue with Google** on the portal and landed on
`http://localhost:3000/#access_token=…` — "This site can't be reached".

**It is not our code.** Both sign-in buttons build the redirect from the page
they are on:

- `pages/portal.js:576` → `${window.location.origin}/portal`
- `pages/login.js:15` → `${window.location.origin}/auth/google`

and the portal already reads the returned token out of the URL fragment
(`pages/portal.js:348`), so the app half is complete.

**It is Supabase's URL configuration.** Supabase only honours `redirect_to`
when the URL is on the project's allow-list; when it is not, it silently falls
back to the project's **Site URL**. Landing on the *root* of `localhost:3000`
— not on `/portal` — is exactly that fallback, which tells us two things:

1. **Site URL is still `http://localhost:3000`**, left from development.
2. **`https://app.kosher-connect.com/portal` is not in the allow-list.**

If staff Google sign-in works today, then `/auth/google` was allow-listed at
some point and the portal callback was simply never added.

**The fix (owner, Supabase dashboard → Authentication → URL Configuration):**

- **Site URL** → `https://app.kosher-connect.com`
- **Redirect URLs** → add `https://app.kosher-connect.com/portal`,
  `https://app.kosher-connect.com/auth/google`, and — if customers ever reach
  the portal on the www domain — the same two under
  `https://www.kosher-connect.com`. Keep `http://localhost:3000/**` for
  development.

There is no MCP tool for auth configuration, so this cannot be done from here;
it is a two-minute dashboard change. Until it is made, **no customer can sign
in to the portal with Google** — they land on a dead localhost page.

Minor, for completeness: the failed URL carried a real access token in its
fragment. It was never loaded by any server, it is short-lived, and it is now
only in that browser's history — worth clearing that history entry, not worth
alarm.

## One thing I noticed while reading the drafts

Two of your saved Gmail drafts hold **live secret keys** in plain text — a
Stripe live key pair and a Resend API key. The working agreement is that secrets
live only in Vercel env vars; a draft is a copy that syncs to every device on
the account and survives in Gmail's history. Worth deleting those drafts and
rotating the keys, since they have been sitting in a mailbox. I have not copied
the values anywhere.
