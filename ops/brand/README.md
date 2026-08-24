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

## Where the values come from

Nothing here is typed from memory. Colours are sampled pixel-by-pixel out of
`public/logo-full.png`; contrast ratios are computed by the WCAG 2.2 sRGB
formula; the type ramp and the tokens are read from `styles/globals.css` and
`docs/DESIGN.md`. If a value in the product changes, this document is wrong
until it is rebuilt — which is the intended relationship.

## The open question

Plate 05 records a finding rather than a rule: the logo's blue is `#07639e` and
the product paints `#0060a8`. That is a visible step in flat colour and it is
the owner's to settle. When it is settled, fix the value, fix the misleading
comment in `styles/globals.css`, and re-cut this document.
