---
name: kc-improve
description: >-
  KosherConnect's product-improvement loop — the working method for building KC:
  find the best next idea (UX friction, smoothness, a useful integration),
  prototype it on the branch, verify it against the objective gate + the visual
  harness, and present it for a human accept/reject. Human-in-the-loop by design
  (good UX is a judgment call). Use to run an improvement cycle, groom the
  backlog, or work through the Phase-2 kickoff.
---

# kc-improve loop

A loop in the article's sense — **discover → plan → execute → verify →
iterate** — but tuned for *product* work, not CI. The article is explicit that
UX / "done is a judgment call" work is a **bad fully-autonomous loop**, so this
one keeps a human at the accept gate. The loop does the boring 95% (find,
prototype, self-check); you keep judgment on the 5% that carries taste + risk.

## The five blocks (mapped)
- **Verifier (objective part):** `ops/loops/green-keeper/gate.sh` (tests ×2 TZ
  + build) stays green, **and** the offline visual harness renders the change in
  light + dark. No green gate → not shippable, full stop.
- **Verifier (judgment part):** a strict **reviewer sub-agent** scores the change
  against the UX checklist below; then a **human** accepts or rejects. The maker
  never grades its own work.
- **State / backlog:** `ops/loops/kc-improve/BACKLOG.md` — the idea queue + the
  log of what shipped, what was rejected, and why.
- **Skill:** this file.
- **Sub-agents:** an **idea-scout** (proposes), a **builder** (implements fast),
  a **reviewer** (strict, blocks/passes). Three roles, never the same context.
- **Automation:** run on demand per cycle. No unattended schedule — every cycle
  ends at a human accept.

## Run procedure (one idea per cycle)

### 1 — Discover
- Read `BACKLOG.md`. If thin, run an idea-scout pass: walk one surface of the
  app (a tab, a flow, the portal) and list concrete friction / smoothness /
  integration opportunities, ranked by value ÷ effort. Add them to the backlog;
  don't build yet.

### 2 — Plan
- Pick the **single** highest value ÷ effort item that isn't blocked on an owner
  decision. Write a one-paragraph spec: what changes, why, how we'll see it work.

### 3 — Execute (builder — fast)
- Branch off the guarded base. Make the smallest change that delivers the idea.
- Never touch money/auth/payments/migrations autonomously (see green-keeper's
  do-not-touch list) — those go through a human.

### 4 — Verify
- `bash ops/loops/green-keeper/gate.sh` must exit 0.
- Render the change in the **offline Playwright harness**, light + dark, and
  attach the screenshots. (Never launch the live server — the owner runs the
  live test.)
- Reviewer sub-agent scores against the **UX checklist**:
  - one clear primary action; nothing important is colour-only (a11y)
  - AA contrast in both themes; motion respects `prefers-reduced-motion`
  - matches existing tokens/idiom; no new inconsistency introduced
  - faster or fewer clicks than before; empty/error/loading states covered
  - reversible / low-blast-radius; no money or customer-facing charge affected

### 5 — Iterate / accept
- Present: what changed, the screenshots, gate result, reviewer notes.
- **Human accepts or rejects.** Log the outcome in `BACKLOG.md`. Accepted →
  commit + push (draft PR if it's cross-cutting). Rejected → capture why so the
  next idea is better aimed.

## Guardrails
- **Human owns "done."** The loop proposes and proves; the owner accepts.
- **Live testing is the owner's** ("don't kill the server") — the loop verifies
  offline (tests + harness) and hands over for the real-browser pass.
- **Comprehension debt:** every accepted change is explained in one plain
  sentence so the repo stays understandable.
- **The metric:** cost per accepted change. If under 50% accepted, the
  idea-scout is aiming badly — retune before churning more cycles.
