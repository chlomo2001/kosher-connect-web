# Backlog

What is waiting, why it is waiting, and who has to move it. The 03:00 UX loop
grounds on this file, so an item here is either **loop-safe** (pure, testable,
changes nothing a person has already learned to read) or **owner-held** (it
changes what staff see or how money reads, and that is a judgement, not a
finding).

An item does not leave this file because it was built. It leaves when the thing
it describes is true in the running app.

---

## From the AHT / Yordex portal reference (2026-08-18)

Source: `docs/DESIGN-NOTES-AHT.md`. The owner asked on 18 Aug for that portal to
be weighed for UX. The note ranks nine lifts; this is where they wait.

> **1 · Hebrew dates** has left this list. It waited here for a placement
> decision, the owner made it on 19 Aug — "the counter screens" — and it
> shipped the same day (`bc3e273`): a SIM's renewal, a rental's due-back day, a
> flight's travel date and the day a repair came in, held by
> `test/hebrewOnScreen.test.mjs`. It is recorded here for one line only because
> this file said "Nothing is wired in" for a day after it was, and a waiting
> list that names finished work sends the reader chasing it.

### Loop-safe — the 03:00 loop may take these

- **3 · Direction badges for ledger/till type.** Replace the text type word with
  a round colour-coded in/out/transfer/bank glyph. Pure display; amounts are
  already coloured, so this extends an existing convention rather than
  inventing one. Verify at 390px and 320px, both themes, three text sizes.
- **4 · "(N loaded)" count in list search boxes.** Tells staff how much is in
  hand before they trust a search. Cheap and honest.
- **8 · Live "Preview" pattern.** Show the computed result inline as settings
  change — the receipt text, the SMS draft, the public portal string, as the
  owner edits it. Read-only rendering of something the app already computes.

### Owner-held — do not start without a decision

- **2 · בעזהשי״ת (or a chosen phrase) in the header / on printed documents.**
  Tiny to build. The owner picks the phrase and the placement; neither is a
  thing to infer.
- **5 · Running-balance column in the Wallet/ledger view.** Each row showing the
  balance after it is high utility and read-side only — it posts nothing. It is
  still a **money-read change**: the same figures, presented so they carry a new
  meaning. Owner-judge before/after on the dev branch.
- **6 · Grouped sidebar with sub-labels.** The owner re-ordered the sidebar on
  17 Aug. Grouping is a navigation decision, not a finding — the same rule the
  port plan applies to any nav cut.
- **7 · Wizard stepper for multi-step flows.** New Booking, New Rental, a POS
  order. The component is loop-eligible; adopting it per flow is judgement,
  because a stepper on a flow staff already do fast is a cost, not a help.
- **9 · Share affordance ("Send this to the customer").** The button is safe.
  The send stays HOLD-gated until the owner flips live comms on, and the button
  must not imply otherwise — see `docs/claims-audit.md`.

### Not being lifted

Currency tabs (GBP-first; not worth the surface), the Yordex visual skin, and
anything React or Tailwind. The ideas travel; the stack does not.

### Not a change — a calibration point

The portal's default is spacious, large-type: a big hero number, roomy rows,
clear hierarchy, comfortable without a Simple Mode being on. Worth holding our
type ramp and spacing against when that sweep continues. Nothing to build.

---

## From the Redburry port brief (2026-08-18)

Source: `docs/PORT-PLAN-2026-08-18.md`, and the brief itself. **The source repo
`earothbart-ai/pixel-perfect-peek` is not reachable from this environment** —
cross-owner `add_repo` is refused — so every item was implemented from the
brief's description alone, and the appendix items below are recorded from the
brief's account of them rather than from reading the code.

### Owner-held, named in the brief as needing a go-ahead

- **B1 Tier 2 — the structural findings.** Thirteen of them, each with its
  counter-argument, in `docs/clarity-scan.md`. Several touch money or the
  schema. None is approved.
- **B2 — next-action rows on every screen**, and the tap-count table. Changes
  what every screen says at the top.
- **C1 — the money decision/wording split**, `gaps[]`/`reliable`, and the check
  harness. Reaches into `public/main.js` pricing.
- **Any navigation cut.** The brief's 21→5 is their number, not a law.

### The brief's own appendix — filed so nobody re-derives them

SSRF allowlist and encoding traps for any server-side fetch of a supplier or
tariff sheet; append-only audit triggers with soft deletes and FK indexes;
`RbUnavailable`-style in-place failure for a section whose query died; warning-
not-refusal clash detection for repairs, bookings and rental returns; demo-data
purge coverage; a `runAction` write wrapper with a retry cap; error translation
at the boundary; a PWA with an explicit never-cache gate for tokened paths; and
an authenticated route-walk smoke test. Each is described in the brief at
enough length to build from.
