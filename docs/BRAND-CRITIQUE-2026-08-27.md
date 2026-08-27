# Honest criticism of the brand standard

**27 August 2026.** Asked for fixable criticism of the renewed sheet, judged on
the sector, colour psychology, and current practice — and asked whether
`impeccable` was the right tool for it.

## On the tooling question, first

**`impeccable` is not the right tool for this, and it has already been tried
here.** Its own remit is frontend interfaces — "websites, landing pages,
dashboards, product UI… not for backend-only or non-UI tasks". A brand standard
is a print document and a positioning argument; the parts of impeccable that
would apply (typography, spacing, colour, hierarchy) apply to *how the PDF is
set*, not to whether the strategy is right.

More to the point, `docs/CRITIQUE-WELCOME-2026-08-02.md` records what happened
when its detector was run on `/welcome`: **45 findings, 45 false positives.**
The value in that exercise came from the human-style critique alongside it, not
from the tool. Recommending it again for a harder, less-suited target would be
repeating that.

`hallmark` is closer in spirit — it does audits and design extraction — but it
is also aimed at pages. There is no skill here for "is this brand strategy
right for a kosher telecom shop in Salford", and pretending otherwise would be
worse than saying so.

So this is a direct critique. Where it is a matter of taste it says so.

## Did we implement what the last critique taught us?

Checked against the code rather than remembered. Five priority issues from
2 Aug:

| Finding | Status |
| --- | --- |
| Contact form invisible with JS off — the one verified defect | **Fixed.** The reveal's hidden state is armed *by* JS (`welcome.js:458`), so a no-JS visitor never gets content hidden on them. Hardened again for engines without IntersectionObserver |
| Hero and Band 1 open with the same sentence | **Fixed.** The opener appears once |
| Three CTAs all land in an empty "How can we help?" box | **Fixed.** Every band and tile carries its own `prefill`, in both languages |
| WhatsApp gated off — the community's default channel | **Fixed.** `wa.me` link plus WhatsApp as a contact preference |
| Not one photograph of the shop or the person behind the counter | **Open** |

Four of five. The fifth is below, because it is the one that matters and I made
it worse this afternoon.

---

## 1. I canonised the missing photograph as a principle

`standard.json` now says, in my words:

> The absence of stock photography is a decision, not a gap. Community norms
> around imagery rule out the lifestyle photography most retail brands lean on.

Half of that is true and the other half is a rationalisation, written today,
of an omission the 2 August critique had already flagged:

> **Faceless in a face-to-face community.** No photograph anywhere above the
> map — no shop front, no owner, no handset. This is a level-2 local shop in a
> relationship-driven community; one warm, real photo would not break the flat
> Sky aesthetic and is the highest-trust, lowest-cost asset available.

Community norms constrain photographs **of people**. They do not rule out a
photograph of **421 Bury New Road**, of a counter, or of a handset in a hand.
Those are the highest-trust asset available to a shop whose entire positioning
is "you can hand me your number and your money", and there are none.

**Fix:** narrow the principle in `standard.json` to what is actually true — no
stock photography, no models, no faces without consent — and say explicitly
that a real photograph of the premises or the product is wanted, not excluded.
Then take one. This is the single highest-value change on the list and it costs
a phone and ten minutes.

## 2. The document's palette breaks the document's own philosophy

`PHILOSOPHY.md` is unambiguous:

> **Colour is finite and consequential.** Four or five values, no more.

Plate 03 carries five brand values, two paper values, six semantic signals with
six darker ink twins, and a six-value dark set. Around twenty.

The plate defends this — "the semantic set is not brand colour, it is a signal
system" — and that defence is sound. But the philosophy states a hard number
and the standard exceeds it fourfold without acknowledging the tension, which
is exactly the kind of thing a reader notices and quietly discounts the rest
for.

**Fix:** one sentence on plate 03 conceding it. "Five carry the brand; the
signal set is a separate instrument and is counted separately." Cheap, and it
converts an apparent contradiction into a deliberate distinction.

## 3. The sector case is right but is never made out loud

Colour psychology, honestly: navy reads competence, stability and discretion —
it is the finance and insurance default for good reason, and the association is
one of the better-evidenced ones. Warm tan reads craft, age and human hand. The
pairing is well judged for a business whose product is trust.

What makes it *interesting* is the sector contrast, and the document never
says it. UK telecom is loud and saturated — EE yellow, Vodafone red, Three's
black and orange, O2's pop blue. All of them shout, because they are selling on
price and reach to strangers. Kosher Connect's navy on warm ivory reads like a
private bank or a good bookseller, and **against the category that is the whole
point**: a shop selling to people who will repeat what they hear should not
look like a network selling to people who will never meet it.

Right now a reader has to infer that. The standard asserts restraint as taste
when it could evidence it as strategy.

**Fix:** a short block on the colour plate — the category is loud, we are not,
here is why that is a commercial decision rather than a quiet one.

## 4. Warm ivory is the strongest move in the system and is under-argued

`#F7F3EA` instead of white is doing more psychological work than the blue. It
reads as paper, and paper reads as *record* — which is precisely what a shop
holding your number, your travel and your money wants to feel like. The plate
justifies it on eye strain ("never pure white, and the reason is a nine-hour
shift"), which is a real reason and the smaller one.

**Fix:** say the bigger one. It is the cheapest credibility in the palette.

## 5. Plate 07 is a third empty at the foot

`WORDS` is the best-argued plate in the document and it stops two-thirds down,
leaving a large void under the callout. The philosophy permits this — "balance
is achieved by weighting a heavy mass against a large void" — but the other
plates are dense, so on this one it reads as a page that ran out rather than
one that was composed.

**Fix:** either fill it (the "say this / not that" table is the most useful
thing in the standard and could carry four more rows — Hebrew register, how to
write a price, how to name a service, what never to put in an SMS), or pull the
callout down so the void sits *between* masses instead of after them.

## 6. Marketing is positioning, not yet a plan

`standard.json` now carries the promise, why it is not price, the proof-over-
claims rule and the never-say list. That is positioning, and it is sound. It is
not a marketing strategy: there is nothing on what the shop actually *does* —
the referral moment, what goes in the window, what a customer gets handed when
they walk out, whether there is anything to send someone who asks "what do you
do?".

For this business that plan is probably four lines long, because the channel is
word of mouth and the product is the campaign. But four lines written down
beats an assumption.

**Fix:** a thirteenth plate, or a `marketing` block in `standard.json`. Worth
doing with Shloime rather than for him — he knows who refers whom.

---

## What is genuinely good, so the above is read in proportion

- **The enforcement idea.** A standard that fails a build when the product
  disagrees is rarer than it should be, and it is now bidirectional.
- **The semantic set as an explicitly separate instrument** from brand colour.
  Most brand sheets conflate the two and then wonder why every screen is a
  rainbow.
- **"GOLD DOES NOT SPEAK"** with the measured 2.80:1 next to it. A rule with a
  number attached survives an argument.
- **Plate 07's callout.** "And if you're already on a good one, we'll tell
  you." That is the business in a sentence and the plate is right that nothing
  in the brand may contradict it.
- **The Hebrew set in the product's own David Libre**, caught by a glyph guard
  rather than by someone noticing boxes on a printed sheet.

## Fixed while writing this

The inversion done this afternoon left three claims on the plates false, all of
them mine:

- The frontispiece said every value was "measured from the assets themselves".
  It is now decided in `standard.json` and checked against the product.
- Plate 03's footer said "SAMPLED FROM logo-full.png AND styles/globals.css".
  Now "DECIDED IN docs/brand/standard.json · ENFORCED BY brandTokens.mjs".
- "ONE BRAND, ONE PLACE" said every surface reads its values from
  `globals.css`, which is now the consumer rather than the source.

The cover date moved to 27 August. Rebuilt; glyph guard and collision check
both clean.
