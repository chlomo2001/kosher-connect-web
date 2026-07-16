# Loops

Autonomous agent loops for KosherConnect, built the way the "loops replaced
prompt engineering" playbook prescribes: each loop owns **one narrow job**,
runs against an **objective gate** (a test/build that passes or fails, not an
agent's opinion), keeps **state** on the side, and has a **hard stop**.

The rule we follow: get one manual run reliable → save it as a skill →
wrap it in a loop with a gate + stop → *only then* put it on a schedule.
Start with one loop, not ten.

## Loop #1 — green-keeper  ✅ built (manual-run stage)
Keeps the guarded branch shippable. Gate = `ops/loops/green-keeper/gate.sh`
(`npm test` ×2 TZ + `npm run build`). Skill = `.claude/skills/green-keeper/`.
State = `ops/loops/green-keeper/STATE.md`. Draft-PR only; money/auth/payments
never auto-merged. **Not yet scheduled** — run it by hand a few times first.

## Roadmap (add only after #1 is boringly reliable)
- **#2 — nightly reconciliation report** *(business, read-only, safe)*:
  gate = "does every customer's wallet-ledger balance equal the balance
  derived from their rentals/SIMs/VN charges, and does the day's cash
  reconcile?" (objective, via `pages/api/health.js` + `lib/money.mjs`). On a
  mismatch it drafts a report — it never mutates money. This is the highest-
  value *business* loop; it just needs its gate wired to real data.
- **#3 — morning chase-drafts** *(business)*: overdue rentals, arrears, SIM
  renewals due this week → drafts (no-send) the reminders/tasks for a human to
  approve. Gate = the drafts reconcile against the live sweep output.

## The one metric that says if a loop is working
**Cost per accepted change.** If the accepted-change rate is under 50%, you're
doing the review the loop was meant to remove — tighten the skill, don't add
another loop.
