# Who owns what, and how to move it

Written 17 Aug 2026, after the owner asked whether everything could live under
the `earothbart-ai` GitHub account instead of `psic770-ai`.

**Decided 26 Aug 2026** (issue #9). §7 held four open questions for nine days;
three are answered and written into §4 as an ordered plan, and the fourth does
not block this handover. Nothing in here has been DONE yet — every remaining
step needs a browser session as the owning account, which is why they are
written out rather than executed.

Read §1 and §2 before doing anything in §4 — the order matters, and two of the
steps have a way of going quietly wrong.

**The decisions, in one place:**

| | Decision | Why |
| --- | --- | --- |
| Code | **Transfer** `psic770-ai/kosher-connect-web` → `earothbart-ai` | A duplicate carries no issues and is fiction the moment it stops being pushed to. A transfer carries history, issues, webhooks and deploy keys, and old clone URLs redirect. |
| Hosting | **Keep the team, move its ownership** to the owner's account | Fewest moving parts: the project, its env vars and the domain never move, so there is no integration to re-add. Stays on Hobby — see the constraint below. |
| Kc-staging | **Delete it** | Paused since it was created in May, nothing points at it, and it may hold a copy of real customer rows. Rule 2: copy the code freely, never the data. |
| Future clients | Not decided, and does not block | The recommendation in §3 stands: one account per client, owned by the client, with you as a member. |

**The constraint that comes with staying on Hobby**, accepted knowingly on
26 Aug so it is not rediscovered later:

- Vercel's Hobby plan is for **personal, non-commercial** use. Hatsluche Ltd is
  a trading company. This is a terms question, not a technical one, and the
  answer to it is Pro whenever it is worth £20 a month.
- **Two cron jobs is the ceiling, and both are spent** — `/api/cron/sweep` at
  06:00 and `/api/cron/digest` at 06:30. A third scheduled job of any kind
  needs Pro first.
- **Runtime logs do not reliably capture cron invocations.** That is not a
  footnote: on 26 Aug the morning digest had been failing silently for five
  days and the logs could not show it, so the cause had to be found by
  elimination against the database. Whoever maintains this next should know
  the logs will not answer that class of question.

---

## 1 · Where things actually live today

Verified 17 Aug 2026 and **re-verified 26 Aug 2026** from the live accounts, not
from memory. Nothing had changed in between, except that the Vercel plan is
now written down: **Hobby**.

| Thing | Where it is | Identifier |
| --- | --- | --- |
| Code | GitHub, user **psic770-ai** | `psic770-ai/kosher-connect-web`, repo id `1237931094`, private |
| Hosting | Vercel team **Touch Design projects** (slug `touchdesigns-studio`, plan **hobby**) | project `kosher-connect-web` (`prj_Hmsj…q9DVg9K5`), team `team_Ulw6…AISLr` |
| Vercel login | `touchdesigns.studio@gmail.com` | the account that owns the team |
| Database | Supabase org **kosher-connect** (`bwksxzmfsjwzqehceskw`) | project **Kc-Live** `xsrtdwwzxdmnjdtjcdzd`, eu-west-2, `ACTIVE_HEALTHY`, Postgres 17.6 |
| Second database | same org | **Kc-staging** `rcpqgujtutvpfzfsgzql`, `INACTIVE` since it was created 11 May — **to be deleted**, §4e |
| Domain | `app.kosher-connect.com` → the Vercel project | |
| Secrets | Vercel env vars only — never in the repo | Supabase, Twilio, Stripe, Resend, Gemini |

**The thing worth noticing:** the Supabase organisation is already called
`kosher-connect` — that one is shaped like the business owns it. The Vercel
team is not: it is called *Touch Design projects* and is held by a Google
account that is not the owner's. Whoever controls `touchdesigns.studio@gmail.com`
controls the shop's hosting. If that is the owner under another hat, fine. If it
is a third party, Hatsluche Ltd's production site is sitting in someone else's
account, and that is worth settling before it is ever an argument.

## 2 · Two rules, and the reasoning

**Rule 1 — one live deployment per database.** Never point a second deployment
at Kc-Live. Not "briefly", not "just to test". The nightly sweep would run
twice, reminders and SMS would be built twice, and two schedulers would race on
the same ledger. The idempotency keys guard against double-*charging* from a
retried request; they do not guard against two cron jobs both waking up at
06:00. If a copy of the app needs somewhere to point, point it at Kc-staging.

**Rule 2 — copy the code freely, never copy the data.** A duplicate repo costs
nothing and can be thrown away. A duplicate of Kc-Live is 609 real customers
and 797 SIMs — their numbers, addresses and passport records — a second thing
that can leak, and the shop's liability twice over. (Counted 17 Aug 2026. An
earlier draft of this file said "~1,800 customers"; that figure was imported
ROWS across every table, not people.) If the worry is safety, take a
*backup*: dated, encrypted, deletable. A live second copy is not a backup, it
is an exposure.

A corollary that catches people out: **a duplicate repo is a snapshot, not a
second home.** The shop only ever runs from whichever repo Vercel is watching.
The moment work goes to one and not the other they diverge, and the copy
quietly becomes fiction.

## 3 · The decision to make first

Not a technical question. Who should own the shop's software and hosting?

- **The business (Hatsluche Ltd)** — an account in the business's name, billed
  to the business, that survives any individual. Right answer for a system the
  shop depends on daily.
- **The owner personally** (`earothbart-ai`) — fine while owner and business
  are the same thing, which today they nearly are.
- **A third party** — this is where it partly sits now, and it is the one
  answer to move away from.

For future clients, the same question with a different answer: **one
account per client, owned by the client, with you as a member.** Not for
tidiness — for *exit* (a client who leaves gets handed an account, rather than
needing surgery on a shared one) and for *blast radius* (a mistake in one
client's project cannot reach another's). Both Vercel and Supabase bill per
team/organisation, so per-client separation also puts each client's costs on
their own invoice, which is usually what you want when the client pays.

## 4 · The runbooks

Do these **one at a time**, on separate days if possible, verifying between.
Changing GitHub, Vercel and Supabase in one sitting means a broken deploy has
three possible causes.

### 4a · Duplicate the repo — NOT the chosen route, kept for reference

Superseded by the 26 Aug decision to transfer (§4b). Left here because it is
still the right move for a one-off snapshot, and because the reason it was
rejected is worth keeping: a duplicate carries **no issues**, deploys nothing,
and diverges the first time work lands in one repo and not the other.

<details>
<summary>The duplicate steps, if ever needed</summary>


Gets you "everything is on my account" without touching production. Nothing is
removed from `psic770-ai`.

1. Create an **empty** `kosher-connect-web` under the destination account — no
   README, no .gitignore, or the push will be refused.
2. On the Mac:

   ```sh
   cd ~/Projects/kosher-connect/repo
   git remote add ea https://github.com/earothbart-ai/kosher-connect-web.git
   git push ea --all
   git push ea --tags
   ```

3. Keep it fresh later with `git push ea main`. Remember Rule 2's corollary:
   this copy does not deploy anything and will go stale the moment it is not
   pushed to.

</details>

### 4b · Transfer the GitHub repo — do the destination FIRST

The failure mode is that `main` silently stops deploying. Prepare the
destination before moving anything.

1. **Install the GitHub Apps on the destination account first**: Vercel, and
   Claude. github.com → destination account → Settings → Applications.

   **"Authorized" is not "Installed", and the difference is the whole step.**
   Checked on 26 Aug, `earothbart-ai` had Claude under *Installed GitHub Apps*
   and Vercel only under *Authorized GitHub Apps*, marked "Never used" — a
   leftover from signing in to Vercel with GitHub once. An authorization is
   account-level OAuth and grants nothing over repositories; an installation is
   what lets the app reach them. Transferring with Vercel merely authorised
   produces exactly the failure this step exists to prevent: `main` stops
   deploying, the site keeps serving the last good build, and nothing says why.

   Install Vercel from `github.com/apps/vercel` → **Install** → the destination
   account. An installation is per-account, so the one on `psic770-ai` — the
   one deploying the shop today — does not travel with the repo.

   Then press **Configure** on each and check **Repository access**. "Only
   select repositories" is the same silent failure by a different route: the
   transferred repo will not be in scope until it is added by hand. Either set
   All repositories, or add `kosher-connect-web` once the transfer has landed.
2. Repo → **Settings → Danger Zone → Transfer ownership**. Type the repo name,
   name the destination.
3. **Log in as the destination account and accept the invitation.** A
   user-to-user transfer is not complete until the recipient accepts.
4. Per GitHub's documentation, issues, pull requests, wiki, stars, watchers,
   commit history, webhooks, repo-level secrets, deploy keys and LFS objects
   all come with it, and links to the old address redirect — so an existing
   clone keeps working. What does **not** come: environment and
   organisation-level secrets, and GitHub App installations (hence step 1).
   The repo id (`1237931094`) does not change, which is why Vercel's link
   often survives.

### 4c · Vercel — after the repo has moved

**The chosen route is ownership of the existing team, not a project move.** The
project, its environment variables and `app.kosher-connect.com` all stay
exactly where they are, so there is no integration to re-add and §4c.2 below
does not apply. Do this AFTER §4b, and expect §4c.1 to be the only thing that
needs attention.

To hand the team over: Vercel → **Touch Design projects** → Settings → Members.
Invite the owner's account, then promote it to **Owner**. Vercel requires the
new owner to accept before the old one can step down, so both accounts must be
signed in at some point. The old account can then be removed, or left as a
member — leaving it as a member is the safer default until §5 has passed.

Note the team is on **Hobby**, which means it has no seats for real team
members. If adding the owner's account is refused for that reason, that is the
plan telling you it wants Pro; see the constraint at the top of this file.

#### The original notes on relinking, still true

1. Vercel → project **kosher-connect-web** → **Settings → Git**.
   - Shows the repo at its new address → nothing to do.
   - Shows *"Project Link not found"* → this exact thing happened before
     (see `docs/LAUNCH-PHASE2.md §1`). **Remove Connection** — the dialog
     itself confirms settings, env vars, domains and deployments are preserved
     — then **Connect Git Repository → GitHub → \<new owner\>/kosher-connect-web**.
2. To move the Vercel **project** to a different team: Project → Settings →
   General → **Transfer Project**. Seconds to minutes; no new deployments or
   settings edits while it runs. Env vars are copied — **but integrations must
   be added again afterwards**, which for this project means the GitHub
   connection. Expect to redo §4c.1 after a project transfer.
3. Check the domain `app.kosher-connect.com` still points at the project.

### 4d · Supabase — last, and only if the org itself must move

The org is already `kosher-connect`, so this may never be needed.

Project transfer between organisations is self-serve: you must own the source
org and be at least a member of the target. Billing follows the org — the old
org is invoiced for usage up to the transfer, the new one after it. Note that
the plan is set per organisation and a single org cannot mix paid and unpaid
projects.

**Before any of it**: take a backup, and check the connection details the app
uses (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) are unchanged afterwards. A
transfer should not rotate them; verify rather than assume.

### 4e · Delete Kc-staging — independent of everything above

Decided 26 Aug. It has been `INACTIVE` since it was created on 11 May, nothing
points at it, and an unused paused database that may hold a copy of real
customer rows is an exposure with no upside — Rule 2, from §2.

Supabase → organisation **kosher-connect** → project **Kc-staging**
(`rcpqgujtutvpfzfsgzql`) → Settings → General → **Delete project**. It asks for
the project name typed out. This is not reversible.

There is deliberately no "check what is in it first" step. It is paused, so
reading it means restoring it — bringing a possible second copy of customer
data back online in order to decide whether to delete it, which is the wrong
way round. Deleting removes the exposure whatever it holds.

**If a test database is wanted later**, create a fresh empty one rather than
keeping this. Rule 1 in §2 is why one should exist at all: so nothing ever has
a reason to point a second deployment at Kc-Live.

## 5 · How to know it actually worked

A green settings page proves nothing. The test is a real deploy:

1. Push any trivial commit to `main`.
2. A **new production deployment** appears, `state: READY`, and its metadata
   says `githubOrg: <new owner>`.
3. `https://app.kosher-connect.com/api/health` still answers with
   `"ok": true`, `email.configured`, `sms.configured`, `stripe.configured`,
   `vault: "on"`. If any of those flipped, an env var did not survive.
4. Sign in to the staff app and open one customer. That exercises the database
   connection, not just the build.

Claude can check 1–3 through the Vercel and Supabase tools; ask.

**Before-state for comparison**, captured **26 Aug 2026, 14:03 UTC** — use this
one, the 17 Aug row below is superseded:

| | |
| --- | --- |
| Production deployment | `dpl_EcRmkUHSaFQrJ3tQUu9C2ZwxXZPm` |
| Commit | `04e115e` on `main` |
| State | `READY`, built from `psic770-ai` |
| Health | `ok: true`, `mode: tables`, `email` live, `sms` live, `stripe` live, `digest: "on"`, `vault: "on"`, `env: production` |

If `/api/health` comes back with any of those flipped after a move, an
environment variable did not survive — that is the whole reason the probe
reports them.

*(Superseded: 17 Aug 2026 — `dpl_5F1iMxUheMSi9ycaXLSmrpBZrEuy`, commit
`8927a50`, `READY`, `psic770-ai`.)*

## 6 · If it goes wrong

- **`main` stops deploying** → §4c.1. Nothing is lost; the site keeps serving
  the last good deployment while the connection is broken. This is a deploy
  outage, not a shop outage.
- **A deploy goes out broken** → Vercel → Deployments → the previous
  production deployment → **Rollback**. Instant, and independent of GitHub.
- **The transfer was a mistake** → a repo can be transferred back the same way.
- **Wrong deployment writing to Kc-Live** → delete the second Vercel project or
  clear its Supabase env vars *first*, then work out what it wrote. Rule 1
  exists to keep this hypothetical.

## 7 · Decided, 26 Aug 2026

- [x] **Who owns the Vercel team** — the owner's account. The team and project
      stay put; ownership moves within them (§4c). Remains on Hobby, with the
      constraint written at the top of this file.
- [x] **Does the code move** — yes, a transfer to `earothbart-ai`, not a
      duplicate (§4b). The tracker was the deciding factor.
- [x] **Is Kc-staging worth keeping** — no. Delete (§4e).
- [ ] **Future clients: their account or yours** — still open, and it does not
      block this handover. §3's recommendation stands: one account per client,
      owned by the client, with you as a member, for exit and for blast radius.

### The order to do them in

Separate sittings where possible, verifying between, so a broken deploy has one
possible cause rather than three.

1. **§4e — delete Kc-staging.** Touches nothing else; do it whenever.
2. **§4b — install the Vercel and Claude GitHub Apps on `earothbart-ai`
   FIRST**, then transfer the repo, then accept the invitation as the
   destination account. The transfer is not complete until it is accepted.
3. **§4c.1 — check Vercel → project → Settings → Git.** New address shown means
   nothing to do; "Project Link not found" means relink, and the dialog itself
   confirms env vars, domains and deployments are preserved.
4. **§5 — prove it with a real deploy**, not a green settings page.
5. **§4c — hand over the Vercel team**, once the deploy has proved itself from
   the new repo home. Last on purpose: it is the step with the least to verify
   and the most to undo if something earlier went wrong.

## 8 · What runs on a schedule — and what was switched off

Part of what is being handed over is a set of things that run without anybody
asking. Written down 26 Aug so the next person does not have to discover them.

**Still running, and part of the product** — declared in `vercel.json`, so they
travel with the repo and need no account of anyone's:

| Job | When (UTC) | What it does |
| --- | --- | --- |
| `/api/cron/sweep` | 06:00 daily | Raises the morning's tasks: overdue rentals, renewals, passports, low stock, KC's own subscription renewals. |
| `/api/cron/digest` | 06:30 daily | Emails everything still waiting, in one message, to `DIGEST_TO`. Deliberately after the sweep, or it would describe yesterday. Sends nothing on a morning with nothing open. |

Both are gated: the digest goes only through `sendEmail`, which answers to
`MAIL_LIVE` exactly as receipts do. **Two is also the ceiling** on the Hobby
plan — see the constraint at the top of this file.

**Switched off 26 Aug, at the owner's instruction, for handover.** These were
Claude Code scheduled runs living in the owner's own Claude account, not in the
repo or in Vercel — so they would have kept firing after a handover, against a
repo the new owner controlled:

| Job | Was | Why it is off |
| --- | --- | --- |
| KC overnight UX/UI improvement loop | 03:00 daily | It shipped several UX items a night, committing and pushing to the dev branch unattended. Useful during development; a surprise after handover. |
| KC nightly full audit | 00:00 daily | Ran the 30-check sweep and could commit small visual fixes. Also reported to nobody: its notifications were `push: false, email: false`, so a year of findings would have landed in fresh sessions no one opened. |

Both are **disabled, not deleted**, and renamed with `STOPPED 26 Aug` so it is
obvious why. Re-enabling either is one toggle in the Claude Routines list. A
third, "KC overnight — Redburry port", finished on 21 Aug and has been off
since; it can be deleted whenever.

**The full sweep still exists and still matters** — `bash
ops/harness/audit-all.sh`, about 17 minutes, 30 checks. It is now a thing
somebody runs rather than a thing that happens. `--smoke` (~90s) before a ship
is the per-change version, and `ops/loops/green-keeper/gate.sh` is the gate that
must exit 0. See `ops/harness/README.md`.

## Sources

- GitHub — [Transferring a repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository)
- Vercel — [Transferring a project](https://vercel.com/docs/projects/transferring-projects)
- Supabase — [Project Transfers](https://supabase.com/docs/guides/platform/project-transfer)
- This repo — `docs/LAUNCH-PHASE2.md §1`, the last time the Vercel↔GitHub link broke
