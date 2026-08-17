# One folder per project

Run this once per project and every project on the machine has the same shape.
The value is the sameness: you never wonder where the price list went.

    # macOS / Linux
    bash ops/new-project/new-project.sh kosher-connect
    bash ops/new-project/new-project.sh kosher-connect https://github.com/psic770-ai/kosher-connect-web.git

    # Windows PowerShell
    .\ops\new-project\new-project.ps1 kosher-connect
    .\ops\new-project\new-project.ps1 kosher-connect https://github.com/psic770-ai/kosher-connect-web.git

Pass a git URL and it clones into `repo/` for you; leave it off and `repo/` is
an empty folder waiting for one. Both scripts are safe to run twice — an
existing file is kept, never overwritten — so running it again on an old
project just fills in whatever is missing.

Everything lands under `~/Projects` unless `PROJECTS_ROOT` says otherwise.

## What it makes

    ~/Projects/<name>/
      README.md      ten lines: what this is, where it is deployed, who to call
      repo/          the git clone. The only folder Claude works in.
      owner/         yours. Never committed.
        decisions.md dated one-liners
        suppliers/   price lists, contracts, invoices
        screenshots/ name them by date: 2026-08-17-till-overflow.png
      handover/      what a new person or the accountant would need
      scratch/       throwaway. Safe to delete without thinking.

## The one rule that matters

**Anything Claude needs to know goes in `repo/` — `CLAUDE.md` for standing
rules, `docs/` for the rest.** A decision that lives only in
`owner/decisions.md` is invisible to it and gets re-litigated. `owner/` sits
outside the clone on purpose, so there is no `.gitignore` to maintain and no
way to commit a supplier contract by accident.
