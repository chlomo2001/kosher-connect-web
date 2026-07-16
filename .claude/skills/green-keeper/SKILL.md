---
name: green-keeper
description: >-
  KosherConnect's first autonomous loop. Keeps the guarded branch shippable:
  discovers red tests/build or a safe dependency drift, fixes it on a fresh
  branch, verifies against an objective gate (npm test ×2 TZ + build), and
  opens a DRAFT PR for a human to merge. Money/auth/payments are never
  auto-merged. Use when asked to run the green-keeper loop, keep CI green,
  or babysit the money test net.
---

# Green-Keeper loop

A loop in the sense of the article: **discover → plan → execute → verify →
iterate**, working toward a goal with nobody in the chair, exiting only when
the goal is met or a hard cap fires. It is deliberately one narrow job.

The article's five blocks, mapped to this repo:

| Block | Article | Here |
|-------|---------|------|
| **Verifier** (the heart) | a test/build that fails bad work, no opinion | `ops/loops/green-keeper/gate.sh` → `npm test` (default + `TZ=Asia/Jerusalem`) + `npm run build` |
| **State** | memory outside the chat | `ops/loops/green-keeper/STATE.md` (read first, append last) |
| **Skill** | project knowledge re-read each run | this file |
| **Sub-agents** | maker ≠ checker | a **fixer** writes the change; a separate strict **reviewer** must approve before any PR |
| **Connectors** | opens PR / pings channel | GitHub MCP draft PR (+ optional Slack ping) |
| **Automation** | the heartbeat | a nightly Routine / `/loop` — *added only after manual runs are reliable* |

## The goal
The guarded branch (see `STATE.md` → base branch) is **green**: `gate.sh`
exits 0. Secondary: no easy, safe dependency drift left on the table.

## Run procedure

### 1 — Discover
- `git fetch` the base branch; read `ops/loops/green-keeper/STATE.md` in full.
- Run `bash ops/loops/green-keeper/gate.sh`.
  - **Green** → check `npm outdated` for a *single* safe bump (patch/minor,
    not a money/auth/build-critical dep). No safe bump? **Exit quietly** —
    append a one-line "all green, nothing to do" entry to `STATE.md`, no PR.
  - **Red** → capture the exact failing check + output. This is the work.

### 2 — Plan
- Write the smallest change that could turn the gate green (or the one dep
  bump). One concern per run. If the fix touches a **do-not-touch** path
  (`STATE.md` list), the plan is "draft PR labelled `needs-human`, do not mark
  ready" — never an autonomous fix.

### 3 — Execute (fixer sub-agent — fast)
- Branch off the base: `git checkout -B green-keeper/<short-slug> <base>`.
- Make the minimal edit. Never force-push shared history. Never touch card
  data, secrets, or `.env`.

### 4 — Verify (the gate — no opinion)
- Re-run `bash ops/loops/green-keeper/gate.sh`. It **must** exit 0.
- Then a **reviewer sub-agent** (separate, strict — the maker is too generous
  on its own work) checks: is the diff minimal, does it touch a do-not-touch
  path, could it change money math or a customer-facing charge? Reviewer can
  only *block or pass*, it cannot rewrite.

### 5 — Iterate / stop
Two exits, always:
- **Goal met**: gate green **and** reviewer passes → open a **draft** PR
  (title `green-keeper: <what>`, body = failing check → fix → gate output),
  append the result to `STATE.md`, stop. Money/auth/payments PRs stay draft +
  `needs-human`; everything else is still human-merged for now.
- **Hard cap**: 3 fix attempts without a green gate, OR the token/time budget
  is hit → **stop**, append the diagnosis + where you're stuck to `STATE.md`,
  leave the branch for a human. Do not keep grinding.

## Guardrails (KosherConnect-specific — do not skip)
- **Never auto-merge.** The loop opens PRs; a human merges. Especially money.
- **Do-not-touch autonomously**: the paths listed in `STATE.md`. Propose via
  draft PR only.
- **The gate is the only truth.** If a change "looks right" but the gate is
  red, it is wrong. Do not weaken or skip the gate to pass.
- **Comprehension debt** (the article's silent failure): every PR body must
  say in one plain sentence what changed and why, so a human can understand
  the repo without reading the loop's mind.
- **Ralph-Wiggum guard**: "done" means `gate.sh` exited 0 this run — not the
  agent's say-so.

## Manual run (do this first, several times, before scheduling)
```
bash ops/loops/green-keeper/gate.sh        # just the gate
```
Then invoke this skill and let it run the full procedure once. Watch where it
overreaches or misses. Tighten this file. Only when a manual run is boringly
reliable, wrap it in a nightly Routine (the heartbeat).
