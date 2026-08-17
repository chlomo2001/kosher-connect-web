# Who owns what, and how to move it

Written 17 Aug 2026, after the owner asked whether everything could live under
the `earothbart-ai` GitHub account instead of `psic770-ai`.

This is a runbook for a decision that has not been made yet. Nothing in here
has been done. Read §1 and §2 before doing anything in §4 — the order matters,
and two of the steps have a way of going quietly wrong.

---

## 1 · Where things actually live today

Verified 17 Aug 2026 from the live accounts, not from memory.

| Thing | Where it is | Identifier |
| --- | --- | --- |
| Code | GitHub, user **psic770-ai** | `psic770-ai/kosher-connect-web`, repo id `1237931094`, private |
| Hosting | Vercel team **Touch Design projects** | project `kosher-connect-web` (`prj_Hmsj…q9DVg9K5`), team `team_Ulw6…AISLr` |
| Vercel login | `touchdesigns.studio@gmail.com` | the account that owns the team |
| Database | Supabase org **kosher-connect** | project **Kc-Live** `xsrtdwwzxdmnjdtjcdzd`, eu-west-2, active |
| Second database | same org | **Kc-staging** `rcpqgujtutvpfzfsgzql`, inactive |
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
nothing and can be thrown away. A duplicate of Kc-Live is ~1,800 real
customers, their numbers, addresses and passport records — a second thing that
can leak, and the shop's liability twice over. If the worry is safety, take a
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

### 4a · Duplicate the repo to another account — no risk, do this any time

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

### 4b · Transfer the GitHub repo — do the destination FIRST

The failure mode is that `main` silently stops deploying. Prepare the
destination before moving anything.

1. **Install the GitHub Apps on the destination account first**: Vercel, and
   Claude. github.com → destination account → Settings → Applications →
   Installed GitHub Apps.
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

**Before-state for comparison**, captured 17 Aug 2026: production deployment
`dpl_5F1iMxUheMSi9ycaXLSmrpBZrEuy`, commit `8927a50`, `READY`, built from
`psic770-ai`.

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

## 7 · Still to decide (owner)

- [ ] Who should own the Vercel team long term, and is
      `touchdesigns.studio@gmail.com` an account the business controls?
- [ ] Does the code move to `earothbart-ai`, or does `psic770-ai` stay the
      home with a copy elsewhere?
- [ ] Same question for future clients: their account or yours? (The
      recommendation above is theirs, with you as a member.)
- [ ] Is Kc-staging worth keeping? It is inactive and has been since May.

## Sources

- GitHub — [Transferring a repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository)
- Vercel — [Transferring a project](https://vercel.com/docs/projects/transferring-projects)
- Supabase — [Project Transfers](https://supabase.com/docs/guides/platform/project-transfer)
- This repo — `docs/LAUNCH-PHASE2.md §1`, the last time the Vercel↔GitHub link broke
