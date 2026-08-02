# /welcome design critique — 2 Aug 2026

**Method:** dual-agent (A: design-director review of `pages/welcome.js` + 4 production
screenshots · B: `impeccable` detector run + independent screenshot evidence), synthesised
and then verified by direct measurement against a local production build.

Commit under review: `c54b10d`. Detector: `.agents/skills/impeccable` v-vendored,
59 rules, exit 2, 45 findings.

---

## Headline

The page is **well-designed and unmistakably Kosher Connect's** — it passes the
design-specificity bar comfortably. It has **one serious robustness defect**: with
JavaScript disabled or slow, the entire contact form is invisible while the hero and
footer render normally. That is now measured, not inferred.

The detector contributed **nothing usable** — all 45 findings are false positives. See
"On the detector" below; this is a fact about the tool's setup, not about the page.

---

## Design Health Score — Nielsen's 10 heuristics

| # | Heuristic | Score | Note |
| --- | --- | --- | --- |
| 1 | Visibility of system status | 4/4 | Scrollspy, "Sending…", paid banner, back-to-top |
| 2 | Match to the real world | 4/4 | Shabbos/Yom Tov/Kol Torah/Eretz Yisroel; British English |
| 3 | User control & freedom | 4/4 | Dismissable banner, persistent lang toggle, reduced-motion honoured |
| 4 | Consistency & standards | 3/4 | Three different CTA labels all open the same generic form |
| 5 | Error prevention | 4/4 | Client mirrors server validation; honeypot; ≥7-digit check |
| 6 | Recognition over recall | 4/4 | Sticky nav, iconned tiles, plain labels |
| 7 | Flexibility & efficiency | 4/4 | `tel:` links, maps, lazy Places, mobile phone-chip strip |
| 8 | Aesthetic & minimalist design | 3/4 | Three bands share one 8-element stack; three-tier heading competes |
| 9 | Error recovery | 4/4 | Form error routes the user to the phone number |
| 10 | Help & documentation | 3/4 | Phone-guide link, but no FAQ and no proof behind the referral claim |

**37/40.** The no-JS defect below does not sit inside Nielsen's 10 — it is a robustness
failure, which is precisely why a heuristic score alone would have missed it.

---

## Verified defect: the contact form disappears without JavaScript

Every section below the hero starts at `opacity:0` and is revealed only when an
`IntersectionObserver` adds `.in`. The reveal is **subtractive** (JS required to show)
where it should be **additive** (shown by default, JS only enhances).

Measured against a local production build at 1440×900:

| Scenario | `.sk-reveal` hidden | Submit button | Message field | Hero | Footer |
| --- | --- | --- | --- | --- | --- |
| JS disabled | **16 / 16** | **opacity 0** | **opacity 0** | visible | visible |
| JS on, before scroll | 16 / 16 | — | — | visible | visible |
| JS on, scrolled through | 0 / 16 real* | visible | visible | visible | visible |

\* three elements measured <1.0 but already carried `.in` — caught mid-transition at the
600 ms mark, not a failure.

So: **the observer works correctly.** The defect is entirely the no-JS / pre-JS window.
A visitor without JS sees a polished hero and a footer with an invisible void between
them — including the only form on the page. The markup is present in the DOM (screen
readers and crawlers see it), which makes it worse in one specific way: a screen-reader
user is offered a form that a sighted person beside them cannot see.

This is exactly `plans/001-reveal-nojs-fallback.md`, already written and scoped. It was
filed as HIGH on theory; it is now HIGH on evidence.

---

## Where the two assessments agreed

Both flagged large blank regions across all four captures (desktop light, desktop dark,
mobile, Hebrew RTL) — reached independently, one from reading source, one from pixels
alone. Agreement across two isolated methods is the strongest signal in this report.

**They diagnosed it differently, and one was wrong.** B called it "a content/render
failure — sections whose inner content is failing to render." It isn't: the content
renders, it is transparent. A correctly identified the reveal mechanism. The measurement
above settles it in A's favour.

**A's stated evidence was also partly wrong.** A wrote that the observer "demonstrably
mis-fired" during capture. It didn't — scrolled captures reveal 16/16. The blanks in the
screenshots were an artifact of full-page capture, not a live observer bug. A's
*conclusion* was right and its *evidence* was not, which is why this needed verifying
rather than reporting.

---

## Priority issues (beyond the verified defect)

2. **Hero and Band 1 say the same sentence twice.** `heroBody` (l.57) and the Mobile band
   body (l.66) both open "Most people are quietly on the wrong SIM… bring us your bill…
   same coverage, same number." Within one scroll it reads as a copy-paste slip and
   wastes the first band. The hero should state the promise; the band should deliver the
   mechanism and the £20/£20 economics.

3. **CTA labels promise doors the form doesn't open.** "Bring us your bill", "Plan your
   trip" and "Get your number" all resolve to `#contact` and land the visitor in an empty
   "How can we help?" textarea. Someone who clicked "Plan your trip" must re-explain
   themselves. Pre-fill the message (or a hidden subject) per band.

4. **Faceless in a face-to-face community.** No photograph anywhere above the map — no
   shop front, no owner, no handset. This is a level-2 local shop in a
   relationship-driven community; one warm, real photo would not break the flat Sky
   aesthetic and is the highest-trust, lowest-cost asset available.

5. **Repetitive band rhythm.** Three bands, one identical centred 8-element stack, with a
   blue accent and gold italic subline that frequently read as extra headlines fighting
   the h2. Collapse to h2 + one supporting line, vary one band's layout, anchor each with
   its service icon.

---

## Persona red flags

- **Orthodox-community visitor** — register is excellent, but nothing *visual* signals
  "one of us". The optional **home-address** field on a phone enquiry may read as
  intrusive with no reason given. WhatsApp being gated off removes this community's
  default low-friction channel.
- **Older / less-technical visitor** — the no-JS defect hits hardest here (slow device =
  blank middle). Pricing and chips drop to 13.5 px, making the single most scannable fact
  the smallest type in the band. The hero "Call" button and "Prefer to call?" line are
  the rescue; keep them prominent.
- **Hebrew-first visitor** — RTL execution is clean and the headline is *transcreated*
  ("why pay double?") rather than translated, which is thoughtful. But the second
  language is **Modern Israeli Hebrew** while Heimishe Manchester is largely
  **Yiddish-first**; "סלולר"/"חבילה" is Ivrit register and may read slightly foreign.

---

## Three questions for the owner

1. The audience skews **Yiddish-first**, yet the second language is Modern Israeli
   Hebrew. Is that the register that earns trust, or should it be Yiddish?
2. Every button funnels to a **text form**, but this community moves on phone and
   WhatsApp. Is the form really the conversion path — or is it the phone number?
3. There is **not one photograph** of the shop or the person behind the counter. In a
   buy-from-someone-you-know community, is the faceless Sky look helping — or is it the
   main thing holding the page back?

---

## On the detector: 45 findings, 45 false positives

| type | count | verdict |
| --- | --- | --- |
| `design-system-color` | 33 | false positive — all |
| `design-system-font-size` | 11 | false positive — all |
| `broken-image` | 1 | false positive |

The colour and font-size rules mean "this value is not in DESIGN.md". **There is no KC
DESIGN.md**, so the skill fell back to its own bundled *sample* — a Stripe clone called
"Stripi" (Söhne, `#533afd`). It graded Kosher Connect's genuine green/navy brand ramp and
fluid clamp-based type scale against a demo file with no relationship to this business.

The `broken-image` hit is `pages/welcome.js:700`, which is **a CSS comment**:

```
Background-image (not two <img>s) so only the theme's own file is ever fetched. */
```

The rule's regex matched the literal string `<img>` inside the comment. The logo is a CSS
`background:url(/logo-full-tight.png)` with a dark-mode swap, and renders correctly in
all four screenshots.

Deterministic means *consistent*, not *correct*: with the wrong baseline, a clean rule
engine produces 45 confident wrong answers. `$impeccable init` + `document` would capture
KC's real product context and generate a DESIGN.md from our own code, after which these
rules become meaningful. That is an interactive session about the business — owner's
call, not something to invent.

---

## Recommended sequence

1. **`plans/001`** — the only correctness issue, now evidence-backed. ~4 small edits.
2. **`plans/002`** — motion tokens + strong ease-out; rewrites the same `.sk-reveal` rule,
   so it must follow 001.
3. **Issue 2 (duplicate sentence)** — pure copy, no risk, immediate clarity win.
4. **Issue 3 (CTA → prefilled form)** — small, and it is the direct conversion fix.
5. **`plans/003`** — hover-lift gating; independent, any time.

Issues 4 and 5 and the three questions are the owner's judgement, not engineering.
