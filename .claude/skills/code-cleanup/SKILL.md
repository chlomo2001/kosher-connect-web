---
name: code-cleanup
description: Find and safely remove dead code, duplicated code, unused files and unused dependencies from a codebase without changing behaviour. Use this whenever the user asks to clean up, tidy, de-duplicate, slim down, "get rid of code we don't need", remove old/unused/dead code, or asks whether something is still used — even if they only name a single file, and even if they never say the words "dead code". Also reach for it before a big refactor when the user wants the ground cleared first.
---

# Code Cleanup

Reduce a codebase by removing what is genuinely not needed — dead code,
duplicated logic, unused files, unused dependencies — while changing nothing
about how the software behaves.

## The two rules everything else follows from

1. **Deleting code fails silently.** Nothing goes wrong at delete time; it goes
   wrong weeks later, at the one moment the code was needed, for whoever is
   standing there then. So a deletion needs *positive proof* the code is dead —
   "I couldn't see anything using it" is not proof, it's the absence of a quick
   look finding anything.
2. **Every removal must be revertible on its own.** One logical removal per
   commit, tests run between commits. A single 2,000-line "cleanup" commit
   turns the first regression into an all-or-nothing revert.

## Step 0 — Baseline before touching anything

Run the project's test suite and build (check `package.json` scripts, a
`Makefile`, CI config, or the project's own docs for the blessed command — some
repos have a single gate script that is the definition of "green"). If the
baseline is not green, stop and tell the user: you cannot attribute a later
failure to your own change if you started from a broken tree.

Record what green looks like (test count, build output) so you can tell a
pass from a quieter failure.

## Step 1 — Learn how this codebase references code

This is the step that prevents almost every cleanup disaster, and it is
skipped almost every time. Before hunting for dead code, answer:

- **Is there a bundler / import graph?** If not (plain `<script src>` apps,
  server templates), functions are reached by *name at runtime* and no import
  will ever mention them.
- **Is anything referenced by string?** `onclick="save()"` in an HTML
  template literal, `window[name]()`, event maps, route tables, CMS config,
  test fixtures that name functions. A grep for `save(` misses `"save"`.
- **Are any files generated from other files?** Look for build scripts and
  header comments like "generated — do not edit". The generated file is never
  the thing to edit or judge; its source is.
- **Which directories are records, not code?** Database migrations, seed
  data, changelogs, vendored libraries. These can look "old" and "duplicated"
  and must not be touched (see "Never delete" below).
- **Is any duplication deliberate?** In bundler-less apps, client code often
  *mirrors* a server module line-for-line because it cannot import it. Look
  for comments saying "mirror", "keep in sync", "canonical copy", and for
  tests that compare two copies.

Write the answers down as a short list of *reference forms you must search
for* before any deletion — e.g. `name(`, `'name'`, `"name"`, `` `name ``,
`window[`, appearance in HTML/CSS/config/docs/tests. Every candidate below
gets checked against this whole list, not just the first entry.

## Step 2 — Inventory candidates

Cast a wide net. This list is *candidates*, not a kill list.

- **Duplicates**: run the bundled finder from the repo root:
  `node <skill-dir>/scripts/find-duplicates.mjs --min 8 .`
  It reports identical blocks that appear in more than one place, largest
  first, with file:line ranges.
- **Dead code**: exports nothing imports; functions whose name appears
  exactly once in the repo (its own definition); files nothing references;
  variables assigned and never read; commented-out code blocks; CSS
  selectors that match no markup; feature flags that are permanently off.
- **Dead weight around the code**: `package.json` dependencies never
  imported; scripts nothing calls; config for tools no longer present.

If the language has a good detector (`knip`, `ts-prune`, `vulture`,
`deadcode`, coverage reports), use it as a *source of candidates* — never as
proof. Detectors do not know about Step 1's string references.

## Step 3 — Prove each candidate, then classify

For each candidate, do the work:

- Search **every reference form** from Step 1, across the whole repo —
  including tests, docs, config, SQL, and HTML/templates.
- Check the **tests**: a test that exercises it is a live reference. (If the
  *only* reference is a test that exists purely to cover it, that pair is a
  question for the user, not a deletion.)
- Check **git history** (`git log --follow -- <file>`, `git log -S<name>`):
  something added last week is probably scaffolding for work in flight;
  something untouched for years with zero references is a stronger case.
- Read the **comments around it**. People write "keep in sync with X" and
  "used by the cron job" precisely to stop this deletion.

Then classify:

- **DEAD** — proven unreferenced in every form. Safe to remove.
- **DUPLICATE** — same logic in two places *and* every consumer can genuinely
  share one copy at runtime. Safe to consolidate.
- **DELIBERATE** — duplication or apparent-deadness that is load-bearing:
  client mirrors of server modules, vendored code, fixtures, generated
  output, sync'd tables. Leave it. If nothing guards the two copies against
  drifting apart, offer a small test that compares them — that is the real
  fix for deliberate duplication, not deletion.
- **UNSURE** — anything you could not prove either way. Never touch these;
  they go in the report as questions.

The honest failure mode here is optimism: wanting the satisfying big number
of deleted lines. The number that actually matters is zero — the number of
behaviour changes.

## Step 4 — Remove, in small verified steps

- One logical removal (or one consolidation) per commit, with a message that
  says what the evidence of deadness was. Run the tests after each.
- Consolidating a true duplicate: pick the copy in the more canonical
  location, repoint all references, delete the other, test.
- Anything generated: change the source and re-run the generator; never
  hand-edit or delete the output.
- If the suite goes red at any point, revert that one commit — do not patch
  forward. The revert is the whole reason the commits are small.
- Finish with the project's full gate (build included), not just the unit
  tests.

## Step 5 — Report

End with a report in exactly this shape, and never blur the categories:

```
## Removed        (proven dead — N lines across M files, evidence per item)
## Consolidated   (true duplicates merged, and where the single copy now lives)
## Left alone     (deliberate duplication / live code that looked dead — and why)
## Needs your decision  (UNSURE items, each as a one-line question)
```

Presenting an UNSURE item as removed, or padding "Removed" with things you
merely *suspect* are dead, is the one way this job can make the codebase
worse while looking like progress.

## Never delete

- **Database migrations and seed files** — they are history, not code; old
  ones are *supposed* to look obsolete.
- **Generated files** — fix the generator's input instead.
- **Vendored code and licence headers.**
- **Deliberate mirrors** — consolidating them breaks the runtime that
  couldn't import in the first place.
- **Anything you could not positively prove.** When the proof isn't there,
  the item is a question in the report, not a deletion.
