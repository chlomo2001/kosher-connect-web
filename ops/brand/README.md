# The brand standard, and how to re-cut it

`docs/brand/KOSHER-CONNECT-BRAND-STANDARD.pdf` is a **build artefact**. This
directory is the source, and plate 11 of the document says so in as many words:
the PDF is the copy, the repo is the original. A standard that only exists as a
PDF drifts within a month, because the next person edits the PDF.

```bash
pip install reportlab pypdfium2 fonttools brotli
python3 ops/brand/prepare.py     # trims the logo, cuts the mono version, unpacks the Hebrew faces
python3 ops/brand/build.py       # writes docs/brand/KOSHER-CONNECT-BRAND-STANDARD.pdf
python3 ops/brand/check.py       # every plate: no text overlaps, nothing off the page
```

## Two checks run on every build, and both have caught real defects

**The glyph guard** (in `kit.py`) wraps reportlab's three text calls and
validates every character against the actual cmap of the face it is set in.
reportlab does not warn — it draws a box — and a box on a brand sheet is the
most embarrassing possible defect. On the first run it caught `Δ`, which none of
the display faces carry, and the entire Hebrew specimen, which none of them
carry either. The Hebrew is now set in **the product's own David Libre**,
unpacked from `public/fonts` at build time, rather than in a substitute.

**The collision check** (`check.py`) reads the finished PDF back, stitches
characters into runs, and fails on any two runs whose boxes intersect or any run
that crosses the margin. Twelve plates is too many to eyeball reliably and every
collision in this document was the same shape — a fixed-position label meeting a
paragraph that grew. It found the cover's eyebrow sitting invisibly *behind* the
word BRAND, which no amount of looking had noticed.

## Which way round this runs — changed 27 Aug 2026

**`docs/brand/standard.json` decides. Everything else answers to it.**

This used to run the other way, and the paragraph here said so: colours were
sampled out of `public/logo-full.png`, the tokens were read from
`styles/globals.css`, and "if a value in the product changes, this document is
wrong until it is rebuilt — which is the intended relationship".

The owner asked for that inverted:

> i dont realy want the 'site' to tell the branding sheet the brand, i want the
> pdf/whtever sheet to be the main doc deciding branding and marketing, and work
> the other way round.

He is right, and the old arrangement was worse than the sentence admitted. In
practice `kit.py` held the palette as Python literals with comments naming the
CSS tokens they mirrored — so the standard was neither derived nor
authoritative, it was a **hand-transcribed copy** that could disagree with the
product in silence. It already had: `BLUE_TOK` sat at `#0060a8` commented
"`--kc-blue`, as declared" months after the owner moved `--kc-blue` to
`#07639e`, and nothing noticed because nothing read it.

So there is now one authored file and two consumers:

```
                    docs/brand/standard.json
                    (the decisions, edited by hand)
                       │                    │
       typeset from it │                    │ checked against it
                       ▼                    ▼
   KOSHER-CONNECT-BRAND-STANDARD.pdf    styles/globals.css
```

`ops/brand/kit.py` reads the palette out of it rather than declaring it.
`ops/harness/brandTokens.mjs` fails if `:root` declares any brand token at a
value the standard did not choose — and it runs in `--smoke`, so the drift
above cannot happen twice. Verified by putting the old blue back: it names the
token, both values, and what the colour is for.

**Changing the brand is now a two-line diff and a rebuild.** Edit the hex in
`standard.json`, run `build.py`, change `globals.css` to match. Changing
`globals.css` alone is a gate failure, which is the point: the site no longer
gets to tell the sheet what the brand is.

The logo has not stopped mattering — it is where `#07639e` came from, and
plate 05 is the record of that. But it is now **provenance rather than input**.
Nothing re-samples it at build time, because a mark that gets re-exported one
day with slightly different compression should not silently restyle the app.

### What the standard also carries now

The palette was never the whole brand, and the file says so. `standard.json`
holds the positioning (the promise, and why it is not price), the psychology
behind the restraint, the voice rules, and the accessibility floor — the last
of these pinned to what actually enforces it, so the document cannot promise
AAA while the harness quietly measures AA.

## The question that was open, and is not any more

Plate 05 recorded a finding: the logo's blue is `#07639e` and the product was
painting `#0060a8` — a visible step in flat colour, and the comment in
`styles/globals.css` had it backwards, calling the logo's own value a "near-miss
copy". The owner settled it on 24 August 2026: `--kc-blue` moved to `#07639e`,
the comment was corrected, and the plate now reads as a record rather than a
question. Contrast moved by less than a hundredth and nothing else changed,
which is what a token layer is for.

The general lesson is on plate 11 and is worth keeping: nothing in the harness
compares the brand tokens to the LOGO FILE. That check is a human looking at a
picture, and it is exactly the one nobody had made. When a rule here turns out
to matter, ask what would notice if it stopped being true.

## The enforcement half

`ops/harness/brand.mjs` checks the standard's claims against the code and runs
in `--smoke`. Plate 11 argues that a standard nobody enforces drifts within a
month; it would be a poor document if that did not apply to itself.

What it holds today, and what it found on its first run:

| Claim | Plate | First run |
| --- | --- | --- |
| Sentence case on stat labels and buttons | 06 | **25 stat labels in Title Case** |
| `--kc-gold` is decoration, never text ink | 03 | clean |
| No literal hex outside flags, print and `var()` fallbacks | 03 | one — an iframe background |
| An outbound SMS carries no emoji | 08 | clean |

The sentence-case drift is worth understanding rather than just fixing: it was
invisible, because `.stat-label` carries `text-transform: uppercase`, so the
source could say "Money In Today" for months while every screen showed
"MONEY IN TODAY". A rule that cannot be seen breaking is a rule that breaks.

**Deliberately out of scope:** nav and tab names. "Kol Torah", "SIM Plans",
"Phone Rentals" are feature names rather than sentences, `lib/manual.mjs` names
them, and `test/manual.test.mjs` already guards them.

**Not covered here, and covered elsewhere:** contrast (the nightly
`--contrast` sweep measures what is actually painted), focus states
(`focus.mjs`), touch targets (`--targets`), and the icon rules (`icons.mjs`).
The claims this file checks are the ones nothing else was watching.
