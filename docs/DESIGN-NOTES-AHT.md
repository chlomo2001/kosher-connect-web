# Design reference — the AHT / Yordex charity portal

Owner shared five screens of `portal.aht.org` (Amud Hatzdokoh Trust, a Yordex
white-label) on 18 Aug 2026 with the note: *"take this into consideration in
terms of the visual sizes / UX-UI and any good idea we can implement."*

This is a **reference, not a spec.** The portal serves the same community we do,
so a few of its choices are almost tailor-made for us; others are worth stealing
on their merits. Below: what it does, then a ranked, KC-specific take on what to
lift — with the fit, the effort, and whether it's safe for an autonomous loop or
needs the owner's eye.

**Loop rule reminder.** Anything visual that changes how *money reads* or how
*navigation is grouped* is an owner-judge before/after prototype and stays on the
dev branch until the owner's verdict (CLAUDE.md deploy ritual). Pure display
polish with no money/nav/auth surface is loop-eligible.

---

## What the portal does well (observed)

**Ledger / transactions screen**
- A **Hebrew-date column** sits right beside the Gregorian date on every row
  (`ג׳ כי תצא, ה׳ אלול תשפ״ו`). Not decoration — it's a first-class column.
- **בעזהשי״ת** centred in the header. A quiet cultural touch that costs nothing.
- A big **£0.00 · Available Balance** hero number, generous whitespace around it,
  a `?` help affordance next to the label.
- A **Balance details** side-panel: *Current Balance* `+£2,395` in green,
  *Pending Transactions* `−£2,395` in red — signed and colour-coded.
- The **Type** column is a round, colour-coded **direction badge** (transfer =
  teal double-arrow, money-in = green down-arrow, money-out = up-arrow, bank =
  building glyph) instead of a text word.
- A **running Balance column** on every row — the account balance *after* that
  line, like a bankbook.
- **Amount** is signed and colour-coded; a **"Processed" status pill** carries a
  small progress glyph.
- Search box shows a live **"(46 loaded)"** count; **Filters** and **Export**
  sit top-right of the table.
- Descriptions that link to a related record carry a chain glyph.

**Sidebar** — grouped under subheadings: `VIEWS`, `ACTIONS` (with `DONOR` /
`RECIPIENT` / `OTHER` sub-labels). Nav items are chunked by intent, not a flat list.

**"How to Donate" modal** — **currency tabs** (GBP / USD / EUR / ILS) switch the
whole payment block; a **"Send this information to a donor"** share affordance at
the top; the reference number is emphasised.

**Voucher Order** — a **3-step wizard stepper** (Select → Details → Submit) with
numbered circles, the active one filled; helper text under the field; Next
bottom-right.

**Account Settings** — **toggles with inline `?` help**, and a live **Preview**
of the exact string a donor will see (`505268 | Individual England | CG`) that
updates as you flip the toggles.

---

## What to lift, ranked (value ÷ effort)

### Tier 1 — high value, fits our community, mostly display-only

1. **Hebrew dates beside Gregorian** — the standout. Our audience keeps time by
   the Hebrew calendar; a bookbook, a rental history, a cash-up, a receipt that
   shows `ה׳ אלול תשפ״ו` next to `18 Aug 26` is genuine utility, not polish.
   *Effort:* the display is trivial; the **converter is the work** and must be
   correct — a wrong Hebrew date to this readership is worse than none. Build it
   as a pure `lib/hebrewDate.mjs` with a real test table (leap years, Adar I/II,
   Rosh Hashana boundary, the molad edge), mirror into `main.js` the way we do
   pricing. **Owner-judge placement** (which screens, subline vs column, on by
   default?), but the converter itself is loop-safe to build and test first.
2. **בעזהשי״ת (or a chosen phrase) in the app header / on printed docs** — a
   one-line cultural touch. Tiny. **Owner picks the phrase and placement.**
3. **Direction badges for ledger/till type** — replace the text type word with a
   round colour-coded in/out/transfer/bank glyph. Faster to scan a column of
   money. Pure display, loop-safe. (We already colour amounts; this extends it.)
4. **"(N loaded)" count in list search boxes** — cheap, honest, tells staff how
   much is in hand before they trust a search. Loop-safe.

### Tier 2 — good, needs the owner's eye or a touch more effort

5. **Running-balance column in the Wallet/ledger view** — each row shows the
   balance after it. High utility, but it's a **money-read change** → owner-judge
   before/after, dev branch only. (Read-side only; posts nothing.)
6. **Grouped sidebar with sub-labels** — chunk nav by intent. The owner
   re-ordered the sidebar on 17 Aug, and grouping is a navigation *decision*, not
   a finding — **held for the owner**, same caution as the port plan's nav rule.
7. **Wizard stepper for multi-step flows** — New Booking, New Rental, a POS
   order. Numbered progress + a disabled-until-valid Next reduces "am I done?"
   uncertainty. Loop-eligible as a component; adopt per-flow with judgment.
8. **Live "Preview" pattern** — show the computed result inline as settings
   change. We have exact analogues: preview the **receipt text**, the **SMS
   draft**, or the **public account/portal string** as the owner edits it. Loop-safe.
9. **Share affordance** ("Send this to the customer") — a reusable button that
   hands a block of details (payment info, booking summary) to a customer via the
   existing HOLD-gated comms. The *button* is safe; the *send* stays HOLD-gated.

### On "visual sizes" specifically

The portal's default is **spacious and large-type** — a big hero number, roomy
rows, clear hierarchy. That's a useful calibration point for our spacing/type
ramp and the Simple-Mode work: it reads comfortably without Simple Mode even
being on. Not a change in itself — a reference to check our comfortable default
against when the type-ramp/spacing sweep continues.

### Deliberately not lifting

Currency tabs (we're GBP-first; not worth the surface), the Yordex visual skin,
anything React/Tailwind. The *ideas* travel; the stack does not.

---

## For the loops

- **03:00 UX/UI loop** grounds on `BACKLOG.md`; the Tier-1 loop-safe items are
  filed there under "From the AHT / Yordex portal reference (2026-08-18)".
  (Written 18 Aug as though already true; `BACKLOG.md` did not exist until
  19 Aug, when the items were actually filed. Recorded rather than quietly
  corrected — a document asserting a filing that had not happened is the same
  failure `docs/claims-audit.md` exists to catch, and it caught this one.)
- **Hebrew-date converter** is the one item worth starting ahead of a placement
  decision, because the converter is pure, testable, and useful regardless of
  where it lands. Build + test the lib first; hold the *where* for the owner.
</content>
</invoke>
