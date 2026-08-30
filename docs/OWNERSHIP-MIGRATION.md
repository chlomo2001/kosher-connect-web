# Who owns what, and how to move it

Written 17 Aug 2026, after the owner asked whether everything could live under
the `earothbart-ai` GitHub account instead of `psic770-ai`.

**Rewritten 26 Aug 2026, evening**, on one fact that had been wrong in every
draft of this file: **Hatsluche Ltd is Shloime's. It is not the developer's.**

Everything before this — including the plan written earlier the same day — read
"the owner" as one person who was both the shop and the developer, and pointed
the handover at `earothbart-ai`. That would have moved the shop's software from
one third party to a different third party, and left the business still not
owning the thing it runs on. §3 of this file had the right answer written down
since 17 August; it was filed under *future clients*, so nobody applied it to
this one.

### Who's who

| | Who | What they hold today |
| --- | --- | --- |
| **The business** | Hatsluche Ltd t/a Kosher Connect — **Shloime** | Nothing. That is the problem this file exists to fix. |
| **The developer** | `earothbart-ai` / e.a.rothbart@gmail.com | Supabase org `kosher-connect`, and the Claude/GitHub side of the build |
| **A third party** | **Psic** — `psic770-ai` on GitHub, `touchdesigns.studio@gmail.com` on Vercel | The repository, and the Vercel **team** the production project sits inside |

### The decisions, in one place

Settled 26 Aug (issue #9). End state chosen: **the business owns everything,
and the developer stays on with full access as a member.** That is §3's
recommendation for a client, applied to this client.

| | Decision | Why |
| --- | --- | --- |
| Code | **Transfer** `psic770-ai/kosher-connect-web` → a new GitHub **organisation** owned by the business | A duplicate carries no issues and is fiction the moment it stops being pushed to. An org, not a personal account: an org can have more than one owner, so it survives any individual — and psic and the developer both stay members, so nobody is cut out. |
| Hosting | **Transfer the PROJECT** into a new Vercel team owned by the business | Not team ownership. The project sits inside *Touch Design projects*, which is Psic's studio team and holds Psic's other work — handing that over would hand over Psic's business, not the shop's. See §4c: a project transfer copies env vars but **drops integrations**, so the GitHub link must be remade after. |
| Database | **Transfer the Supabase org** to the business | Kc-Live is 609 customers — their numbers, addresses and passport records. That data belongs to Hatsluche Ltd, not to its developer. This is the one with actual GDPR weight behind it. |
| Kc-staging | **Delete it** | Paused since it was created in May, nothing points at it, and it may hold a copy of real customer rows. Rule 2: copy the code freely, never the data. |

### What "the business owns it" needs, practically

Shloime needs three logins, all under **his own email** — the developer is
creating the GitHub one on his behalf on 26 Aug:

1. **GitHub** — an account, then an organisation owned by it.
2. **Vercel** — an account, then a team for the project to move into.
3. **Supabase** — an account, added to the `kosher-connect` org as a member
   before the org can be transferred to him.

The developer is a member of all three afterwards, with full access. That is
the whole point of the shape: **an exit becomes removing a member, not
surgery.**

### The Hobby constraint, and who it now belongs to

Vercel's current plan is **Hobby**, and this now reads differently than it did
this morning — the plan question belongs to Shloime, because it is his company
and his £20 a month:

- Hobby is for **personal, non-commercial** use. Hatsluche Ltd is a trading
  company. That is a terms question, not a technical one.
- **Two cron jobs is the ceiling and both are spent** — `/api/cron/sweep` at
  06:00 and `/api/cron/digest` at 06:30. A third scheduled job of any kind
  needs Pro first.
- **Runtime logs do not reliably capture cron invocations.** Not a footnote: on
  26 Aug the morning digest had been failing silently for five days and the
  logs could not show it, so it had to be diagnosed by elimination against the
  database. Whoever maintains this should know the logs will not answer that
  class of question.

A new team created for the business starts on Hobby and can be upgraded when
Shloime decides.

**"Nothing in the move requires Pro" was wrong, and 30 Aug proved it.** With the
repo copied into the `hatsluche` org and Vercel asked to connect to it:

> The repository "Kosher-connect-web" is private and owned by an organization,
> which is not supported on the Hobby plan. Upgrade to Pro to continue.

**Hobby allows a private repo owned by a PERSON and refuses one owned by an
ORG.** `psic770-ai` is a personal user account — checked against GitHub the same
day, not assumed — so this project has been inside the rule by accident of who
held it. Moving the code to an organisation, which is the entire point of §4b
and the thing §7 decided, is precisely what trips the restriction.

So the plan question is no longer parallel to the move. **§4c is BLOCKED on it**,
and it is Shloime's decision because it is his company and his £20 a month. What
the money buys, in one place:

| | |
| --- | --- |
| The terms | Hobby is for personal, non-commercial use; Hatsluche Ltd trades |
| The org repo | The blocker above — there is no free way round it that keeps the code in an org |
| A third cron | Two is the Hobby ceiling and both are spent — sweep 06:00, digest 06:30 |
| Cron logs | Hobby does not reliably capture them; that cost five silent days of a failed digest in August |

**Do not upgrade "Touch Design projects" to unblock this.** That team is Psic's
studio (§4c's opening paragraph) and upgrading it means the business paying for
the contractor's team. The order is: business team created → project transferred
into it (§4c) → THAT team upgraded → then connect to `hatsluche`.

The free alternative, recorded because it will be suggested: put the repo in
Shloime's personal GitHub account rather than the org. Hobby accepts it. §4b
already rejected it and the reasons have not changed — one owner is one bus
factor, and access becomes another transfer rather than a membership. It trades
a monthly cost for a structural one.

---

Read §1 and §2 before doing anything in §4 — the order matters, and several of
the steps have a way of going quietly wrong. Nothing in here has been DONE:
every remaining step needs a browser session as the account that owns the thing
being moved, which is why they are written out rather than executed.

---

## 1 · Where things actually live today

Verified 17 Aug 2026 and **re-verified 26 Aug 2026** from the live accounts, not
from memory. Nothing had changed in between, except that the Vercel plan is
now written down: **Hobby**.

| Thing | Where it is | Identifier |
| --- | --- | --- |
| Code | GitHub, user **psic770-ai** — **Psic's** | `psic770-ai/kosher-connect-web`, repo id `1237931094`, private |
| Hosting | Vercel team **Touch Design projects** (slug `touchdesigns-studio`, plan **hobby**) | project `kosher-connect-web` (`prj_Hmsj…q9DVg9K5`), team `team_Ulw6…AISLr` |
| Vercel login | `touchdesigns.studio@gmail.com` — **Psic's**, confirmed 26 Aug | owns the team, which also holds Psic's other work — hence a project transfer, not a team handover |
| Database | Supabase org **kosher-connect** (`bwksxzmfsjwzqehceskw`) — in the **developer's** account | project **Kc-Live** `xsrtdwwzxdmnjdtjcdzd`, eu-west-2, `ACTIVE_HEALTHY`, Postgres 17.6 |
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

**This is that question, and Kosher Connect is that client.** Written on 17 Aug
as advice for *future* clients, because everyone — including the file — assumed
the developer and the shop were the same person. They are not: Hatsluche Ltd is
Shloime's. So the paragraph below is not future advice, it is the decision:

**one account per client, owned by the client, with you as a member.** Not for
tidiness — for *exit* (a client who leaves gets handed an account, rather than
needing surgery on a shared one) and for *blast radius* (a mistake in one
client's project cannot reach another's). Both Vercel and Supabase bill per
team/organisation, so per-client separation also puts each client's costs on
their own invoice, which is usually what you want when the client pays.

## 4 · The runbooks

Do these **one at a time**, on separate days if possible, verifying between.
Changing GitHub, Vercel and Supabase in one sitting means a broken deploy has
three possible causes.

### 4a · Duplicate into the org and repoint Vercel — a real alternative to §4b

**Revisited 30 Aug 2026.** The owner asked whether a duplicate would do, "and
then repointing to it". It would — and the rejection recorded on 26 Aug does not
land on that question, because it was written about a copy kept ALONGSIDE the
original: "diverges the first time work lands in one repo and not the other".
Once Vercel deploys from the copy, the copy IS the live one and that objection
dissolves. §7's tick stays as the record of what was decided on the day; this is
the variant, with what it actually costs.

**It reaches the same end state as §4b** — the code in an org the business owns,
deploying the shop's site — and it needs one thing less: psic never has to click
Transfer. What it does NOT skip is creating the org, which both routes need.

**Destination is the same as §4b** and this is the whole point: an organisation
owned by Shloime's account. A duplicate into the developer's own account would
move the code from the contractor's-adjacent account to the contractor's, which
is further from the business owning it than today. Confirmed 30 Aug: the org.

What a duplicate costs that a transfer does not:

| | |
| --- | --- |
| **Open issues stay behind** | 5 of them on 30 Aug, including **#9, the handover itself**. Nothing carries them; recreate the ones still live by hand. |
| **No redirect** | A transfer forwards the old URL. A duplicate leaves two repos, same name, same history, and nothing saying which is real. **Mitigation: archive `psic770-ai/kosher-connect-web` once a deploy from the new one is verified** — read-only and visibly labelled is not a redirect, but it is unambiguous. |
| **Claude's access** | This tooling is scoped per repo and the git remote points at the old address. After the move, `add_repo` the new one and repoint the remote, or pushes land in a repo nothing deploys from. The branch instruction in the session config needs the new address too. |

What it does **not** cost, checked on 30 Aug rather than assumed:

- **CI keeps working.** `.github/workflows/ci.yml` references no secrets at all,
  so there is nothing to re-add on the copy.
- **Env vars, the domain and deployment history are untouched.** They live on
  the Vercel *project*, and a Git relink does not move the project.

#### The steps

0. Create the org first (§4b's first paragraph), and an **empty** repo in it —
   no README, no .gitignore, or the push is refused.
1. Push everything, from a clone that is up to date:

   ```sh
   git remote add biz https://github.com/<org>/kosher-connect-web.git
   git push biz --all
   git push biz --tags
   ```

2. Vercel → project **kosher-connect-web** → **Settings → Git** → **Remove
   Connection** (the dialog confirms settings, env vars, domains and
   deployments are preserved) → **Connect Git Repository → GitHub →
   `<org>/kosher-connect-web`**.
3. **Verify with §5 before touching anything else** — a real deploy, not a green
   settings page. Its metadata must say `githubOrg: <org>`.
4. Recreate any still-live issues from the old repo, then **archive** it.
5. The Vercel project itself still belongs to Psic's team; moving it is §4c and
   is a separate day.

<details>
<summary>The original snapshot-only steps, superseded by the above</summary>

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

> Rule 2 is unchanged and still governs: **copy the code freely, never copy the
> data.** This whole section is about the repo. Kc-Live is not duplicated in any
> variant of any of this — it is transferred, once, in §4d.

### 4b · Transfer the GitHub repo to the business's ORGANISATION — destination FIRST

Destination is a GitHub **organisation** owned by Shloime's account, not
`earothbart-ai` and not a personal account of any kind. Create it first:
`github.com/organizations/plan` → **Free** → owned by Shloime's GitHub account.
Then invite the developer and psic as members.

Why an org rather than a personal account, in one line each: it can have more
than one owner, so the business is not one person's bus factor; membership is
how access is granted and removed, so an exit is a click rather than another
transfer; and it matches the Supabase side, which has been an org called
`kosher-connect` all along.

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
   name the **organisation**.
3. **Accept it as the destination.** A transfer into an org needs someone with
   permission there to accept — so Shloime's account, or the developer once he
   is an org owner. It is not complete until accepted.
4. Per GitHub's documentation, issues, pull requests, wiki, stars, watchers,
   commit history, webhooks, repo-level secrets, deploy keys and LFS objects
   all come with it, and links to the old address redirect — so an existing
   clone keeps working. What does **not** come: environment and
   organisation-level secrets, and GitHub App installations (hence step 1).
   The repo id (`1237931094`) does not change, which is why Vercel's link
   often survives.

### 4c · Vercel — after the repo has moved

**The chosen route is a PROJECT transfer, not a team handover.** An earlier
draft of this file said to move ownership of *Touch Design projects* to the
business. That was written believing the team existed for this project. It does
not: it is **Psic's studio team**, and handing it over would hand over Psic's
own business along with the shop's site.

So the project moves out, into a team the business owns.

1. **Create the destination first.** Shloime signs up to Vercel with his own
   email and creates a team for the business. A new team starts on Hobby; see
   the constraint at the top of this file for when that stops being the right
   answer.
2. **Vercel → project `kosher-connect-web` → Settings → General → Transfer
   Project.** Seconds to minutes. Do not deploy or edit settings while it runs.
3. **Expect the GitHub connection to be gone afterwards.** Vercel's own docs
   say env vars are copied but **integrations must be added again**, and for
   this project the integration *is* the GitHub connection. This is the step
   that silently stops `main` deploying, so treat §4c.1 below as required
   rather than a check.
4. **Check `app.kosher-connect.com`** still resolves to the project. A domain
   follows a project transfer, but verify rather than assume — the shop's
   address is the one thing customers see.
5. Add the developer to the new team as a member.

Do this **after** §4b, so the repo is already at its final address when the
GitHub connection is remade — otherwise it gets remade twice.

#### Relinking: how to do §4c.3, and the last time it was needed

0. **Removing the connection is not free, and nothing tells you.** Remove
   Connection unlinks immediately; from that moment pushes to `main` are
   ignored, with no error, no email and no failed build to notice. Verified
   30 Aug (§6a). So do not press it until the destination is ready to connect
   — and if you already have, reconnect to something before walking away,
   even if that means reconnecting to where you started.
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

### 4d · Supabase — the org moves, and this is the one with weight behind it

Decided 26 Aug. `kosher-connect` is named as though the business owns it; it
sits in the **developer's** Supabase account. Kc-Live holds 609 customers —
their numbers, addresses and passport records. That is Hatsluche Ltd's data,
and a data-protection question rather than a tidiness one: the controller
should be the business, not its contractor.

1. **Shloime signs up to Supabase** with his own email.
2. **Add him to `kosher-connect` as an Owner** (Organization → Team → Invite).
   A transfer needs the recipient to already be a member of the target org, so
   membership comes before the move whichever direction it runs.
3. **Transfer.** Supabase's org transfer is self-serve: you must own the source
   and be at least a member of the target. Do §4e first — deleting Kc-staging
   means one less thing to carry.
4. **Billing follows the org** — the old org is invoiced up to the transfer,
   the new one after it. The plan is set per organisation, and one org cannot
   mix paid and unpaid projects.
5. **Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are unchanged.** A
   transfer should not rotate them. Check rather than assume — `/api/health`
   answering `mode: tables` is the proof, because the probe reaches the
   database to say it.

Do this **last**. It is the step with the most to lose and the least to gain
from being early.

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

**Before-state for comparison**, captured **30 Aug 2026, 17:07 UTC**, minutes
before the repo was repointed — use this one; the 26 Aug and 17 Aug rows below
are superseded:

| | |
| --- | --- |
| Production deployment | `dpl_BHsPPRxLxtbvaxsVfLKa5gxEXcri` |
| Commit | `a3ed580` on `main` |
| State | `READY`, target `production`, `githubCommitOrg: psic770-ai` |
| Health | `ok: true`, `mode: tables`, `env: production` |
| Email | `resend`, `mode: live`, `webhook: armed` |
| SMS | `twilio`, `mode: live`, `deliveryTracking: on` |
| Stripe | `mode: live`, `keysMatch: true`, `webhook: true` |
| Also | `digest: on`, `ai.configured: true`, `vault: on` |

Every line of that health block is there to be compared against, not admired.
`keysMatch`, `webhook: armed` and `vault: on` are the three that fail QUIETLY —
a deploy stays green while live card payments, inbound mail or the encrypted
fields stop working, and the only symptom is at a counter days later.

**The copy that preceded the repoint**, verified 30 Aug 18:04 UTC. The mirror
push carried everything and the numbers were checked against the source rather
than assumed:

| | `psic770-ai` | `hatsluche` |
| --- | --- | --- |
| Commits on `main` | 1,262 | 1,262 |
| HEAD | `a3ed580` | `a3ed580` |
| Branches | 6 | 6 |
| Tags | 0 | 0 — none have ever existed, so nothing was lost |
| Visibility | Private | Private |

Made with the bare-mirror recipe rather than `push --all`, because no local
clone existed and `--mirror` carries every ref exactly:
`git clone --bare <source> && git push --mirror <destination>`, then delete the
bare clone. Safe here for one reason worth stating: `--mirror` makes the
destination match the source EXACTLY, deletions included, so it is only ever
run at a repo created empty moments earlier.

*(Superseded: 26 Aug 2026 — `dpl_EcRmkUHSaFQrJ3tQUu9C2ZwxXZPm`, commit
`04e115e`, `READY`, `psic770-ai`.)*

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

## 6a · Where this actually stands, 30 Aug 2026 18:10 UTC

Halfway, deliberately, and nothing is broken.

- [x] **The org exists** — `github.com/hatsluche`, 2 members.
- [x] **The code is in it** — `hatsluche/kosher-connect-web`, private, verified
      against the source rather than assumed: 1,262 commits, HEAD `a3ed580`,
      6 branches, 0 tags on both sides. Method and the case-fix are in §4a/§5.
- [ ] **Vercel is NOT repointed** — blocked on the plan (see the Hobby section)
      — **and the attempt left the project with NO Git connection at all.**
      Timed from the API rather than remembered:

      | 17:08:46 UTC | `f7c25ee` deploys — the last automatic one |
      | 17:17:05 UTC | Remove Connection pressed; `project.link` becomes `null` |
      | 17:28 UTC | `0e51978` pushed, **never deployed** |

      **This is the failure §4c.3 calls "the step that silently stops `main`
      deploying", and it fires on Remove Connection ALONE** — not only after a
      project transfer, which is the only place this file warned about it. There
      is no error and no notice: pushes are simply ignored. Production sat on
      `f7c25ee` while `main` moved on, and the only reason it cost nothing is
      that the commit left behind was documentation.

      Caught because the owner asked "didn't I disconnect it?" against my own
      claim that production was still deploying — a claim I had not checked.
      **Check `project.link` rather than assuming it; `list_projects` shows it
      in one line.**

      Recovery while the plan question is parked: reconnect to
      `psic770-ai/kosher-connect-web`. Hobby accepts it because that owner is a
      personal account, which is the whole reason the org broke it.
- [ ] **The old repo is NOT archived**, and must not be until Vercel has moved
      and a deploy is verified. Archiving first leaves no live repo.

Two consequences of the half-state, both easy to trip over:

1. **The copy goes stale the moment work lands in `psic770-ai`** — Rule 2's
   corollary, and it already has: the copy was made at `a3ed580` and the same
   session pushed `f7c25ee` an hour later. Re-run the mirror before repointing,
   and check the new repo's `main` shows the newer commit.
2. **A Claude session is locked to the owner it started with.** Adding a repo
   from a different owner is refused — "cross-tier adds are not supported in
   v1" — so the session that has been doing this work cannot push to
   `hatsluche` at all. After the repoint, work continues in a NEW session
   sourced from the new repo. Worth knowing before the switch, not after.

## 6b · The thing this file did not record, and it decided everything

**Which GitHub identity the Vercel app is installed as.** Not who owns the repo,
not who owns the Vercel team, not who owns the Supabase org — all three of which
are written down above. The installation is what actually decides whether `main`
deploys, and it was nowhere.

Found 30 Aug while trying to reconnect. The Vercel GitHub App is installed on
**`earothbart-ai`** — the developer's personal account, four days old — and the
repo it needs to see belongs to **`psic770-ai`**. Vercel's repository picker
lists what the installation can see, so it offered the new `hatsluche` repo and
not the one production had been building from for months.

`psic770-ai` does not appear in the developer's "Switch settings context", which
settles it: that is Psic's own personal account. Collaborator access is enough
to clone and push; it is not enough to configure an App installation on it. So:

> **The business cannot restore its own deploys without the contractor.**

Both roads out are blocked on somebody who is not the business — Psic for the
old repo, Shloime's £20 for the new one. That is precisely the dependency this
file exists to remove, and it appeared in the middle of removing it.

**It also reprices §7's open question.** Pro is not a subscription for nicer
logs; it is the price of the business not being locked out of its own software.
Alongside the terms, the third cron, and the cron logs that could not show a
five-day digest failure, that is now four reasons and one of them is structural.

**For whoever writes the next version of this file:** record the App
installation account beside the three ownerships. An installation is not
ownership and does not move with a transfer, which is exactly why it is the one
that surprises you.

## 7 · Decided, 26 Aug 2026

- [x] **Who owns it** — **Hatsluche Ltd (Shloime)**, across GitHub, Vercel and
      Supabase. The developer stays on as a member with full access. This
      replaces the earlier same-day answer of `earothbart-ai`, which was wrong
      for one reason: the business is not the developer's.
- [x] **Code** — into a business-owned GitHub **organisation**. Not a personal
      account; an org can have more than one owner and outlives any of them.
      *Transfer* (§4b) was the method decided on the day; on 30 Aug the owner
      asked about duplicating into that org and repointing Vercel instead, and
      §4a now carries that as a real alternative — same destination, same end
      state, one fewer person needed, at the cost of the open issues and the
      redirect. Either method satisfies this tick; the destination is the part
      that was decided.
- [x] **Hosting** — transfer the **project** into a business-owned Vercel team
      (§4c). Not the team: that team is Psic's studio.
- [x] **Database** — transfer the Supabase org to the business (§4d).
- [x] **Kc-staging** — delete (§4e).
- [ ] **Vercel plan** — Hobby today; Pro is the honest answer for a trading
      company. Shloime's call, and it does not block any step here.

### The order, and why

Each step needs the one before it to exist. Verify between them, so a broken
deploy has one possible cause instead of four.

| # | Step | Needs first | Who does it |
| --- | --- | --- | --- |
| 1 | Shloime gets a **GitHub** account, then creates the **organisation** | — | developer, on his behalf |
| 2 | Install the **Vercel** and **Claude** GitHub Apps **on the org** (§4b.1) | 1 | developer |
| 3 | **Delete Kc-staging** (§4e) | — | developer |
| 4 | **Transfer the repo** into the org, and accept it (§4b) | 1, 2 | developer + org owner |
| 5 | Shloime gets a **Vercel** account and creates a **team** | — | developer, on his behalf |
| 6 | **Transfer the project** into that team (§4c) | 4, 5 | Psic — it is his team it leaves |
| 7 | **Remake the GitHub connection** (§4c.1) — expect to need it | 6 | developer |
| 8 | **Prove it with a real deploy** (§5) | 7 | developer |
| 9 | Shloime gets a **Supabase** account, joins the org, then the org transfers (§4d) | 8 | developer + Shloime |

**Step 6 is the one that needs somebody else.** Psic owns the Vercel team, so
Psic has to run the project transfer. Everything else can be done by the
developer with the accounts he is creating. Worth asking him early rather than
discovering it at step 6.

**Nothing here is urgent enough to rush.** The shop keeps running throughout —
none of these steps takes the site down, and §6 says how to get back from each
one that can go wrong.

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
