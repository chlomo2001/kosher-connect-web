# ── Quiet Signal — the shared plate system ────────────────────────────────
# Every page in the sheet is built from these primitives, which is the whole
# reason the pages look like one document: the grid, the margins, the tick
# scale and the caption register are declared once and never re-typed.
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.lib.colors import Color, HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

FONTS = '/root/.claude/skills/synced/canvas-design/canvas-fonts'
def _reg(name, file):
    pdfmetrics.registerFont(TTFont(name, os.path.join(FONTS, file)))
_reg('Plate',    'BigShoulders-Bold.ttf')
_reg('PlateLt',  'BigShoulders-Regular.ttf')
_reg('Sans',     'InstrumentSans-Regular.ttf')
_reg('SansB',    'InstrumentSans-Bold.ttf')
_reg('SansI',    'InstrumentSans-Italic.ttf')
_reg('Mono',     'GeistMono-Regular.ttf')
_reg('MonoB',    'GeistMono-Bold.ttf')
# The Hebrew is set in the product's OWN face — David Libre, lifted straight out
# of public/fonts and decompressed from woff2. A brand sheet for this shop that
# set its Hebrew in a substitute would be showing the wrong thing on the one
# page where it matters most.
pdfmetrics.registerFont(TTFont('Heb',  os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets/David400.ttf')))
pdfmetrics.registerFont(TTFont('HebB', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets/David700.ttf')))

def rtl(s):
    """Visual order for a Hebrew run. reportlab has no bidi engine, so the
    string is reversed here — correct for the isolated words this sheet sets,
    and the reason no mixed-direction sentence appears anywhere in it."""
    return s[::-1]

W, H = 595.276, 841.89          # A4 portrait — the shop can print it
ML, MR, MT, MB = 48, 48, 54, 46
CW = W - ML - MR                 # content width 499.276
COLS, GUT = 12, 10
COLW = (CW - GUT * (COLS - 1)) / COLS

def col(i, span=1):
    """Left edge of column i, and the width of `span` columns."""
    return ML + i * (COLW + GUT), span * COLW + (span - 1) * GUT

# ── the palette, and nothing outside it ──────────────────────────────────
INK      = HexColor('#0a2540')   # --kc-navy
BLUE     = HexColor('#07639e')   # the logo's own blue (see plate 06)
BLUE_TOK = HexColor('#0060a8')   # --kc-blue, as declared
GOLD     = HexColor('#c19161')   # --kc-gold
GOLD_INK = HexColor('#8d612b')   # --kc-gold-ink
PAPER    = HexColor('#f7f3ea')   # --bg
CARD     = HexColor('#fffdf8')   # --surface
RULE     = HexColor('#d9cfbb')
FAINT    = HexColor('#e9e0cf')
def tint(c, a):
    return Color(c.red, c.green, c.blue, alpha=a)

class Plate:
    """One page. Opens with the ground, the tick scale and the header."""
    def __init__(self, c, num, title, sub='', ground=PAPER, ink=INK, rule=RULE):
        self.c, self.num, self.ink, self.rule = c, num, ink, rule
        c.setFillColor(ground); c.rect(0, 0, W, H, stroke=0, fill=1)
        self.ticks()
        self.header(title, sub)

    def ticks(self):
        """The instrument's edge. Every fifth tick is long — the eye counts in
        fives without being told to, which is why a scale reads as a scale."""
        c = self.c
        c.setStrokeColor(tint(self.ink, 0.20)); c.setLineWidth(0.4)
        y, i = MB, 0
        while y <= H - MT:
            long = (i % 5 == 0)
            c.line(ML - 14, y, ML - (7 if long else 11), y)
            y += 12; i += 1

    def header(self, title, sub):
        c = self.c
        c.setFont('Mono', 6.6); c.setFillColor(tint(self.ink, 0.55))
        c.drawString(ML, H - MT + 16, 'KOSHER CONNECT  ·  BRAND STANDARD  ·  2026')
        c.drawRightString(W - MR, H - MT + 16, f'PLATE {self.num}')
        c.setStrokeColor(self.rule); c.setLineWidth(0.6)
        c.line(ML, H - MT + 8, W - MR, H - MT + 8)
        if title:
            # Auto-fit rather than trust: a long title at a fixed size runs off
            # the plate, and reportlab will happily draw it into the margin and
            # off the paper without a word of complaint.
            size = 40
            while pdfmetrics.stringWidth(title.upper(), 'Plate', size) > CW and size > 18:
                size -= 0.5
            c.setFillColor(self.ink); c.setFont('Plate', size)
            c.drawString(ML - 1.5, H - MT - 30, title.upper())
        if sub:
            c.setFillColor(tint(self.ink, 0.62)); c.setFont('Sans', 8.6)
            self.para(sub, ML, H - MT - 48, CW * 0.62, 12.4)

    def para(self, text, x, y, w, lead=12, font='Sans', size=8.6, color=None, align='l'):
        """Ragged-right, never justified. Returns the y it finished on."""
        c = self.c
        if color is not None: c.setFillColor(color)
        c.setFont(font, size)
        line, yy = '', y
        for word in text.split():
            trial = (line + ' ' + word).strip()
            if pdfmetrics.stringWidth(trial, font, size) <= w:
                line = trial
            else:
                (c.drawRightString(x + w, yy, line) if align == 'r' else c.drawString(x, yy, line))
                line, yy = word, yy - lead
        if line:
            (c.drawRightString(x + w, yy, line) if align == 'r' else c.drawString(x, yy, line))
        return yy - lead

    def label(self, text, x, y, color=None, size=6.6, font='Mono'):
        c = self.c
        c.setFillColor(color if color is not None else tint(self.ink, 0.55))
        c.setFont(font, size); c.drawString(x, y, text)

    def hair(self, x, y, w, color=None, lw=0.6):
        c = self.c
        c.setStrokeColor(color if color is not None else self.rule); c.setLineWidth(lw)
        c.line(x, y, x + w, y)

    def foot(self, text):
        c = self.c
        c.setStrokeColor(tint(self.ink, 0.18)); c.setLineWidth(0.4)
        c.line(ML, MB + 15, W - MR, MB + 15)
        c.setFont('Mono', 6); c.setFillColor(tint(self.ink, 0.45))
        c.drawString(ML, MB + 5, text)
        c.drawRightString(W - MR, MB + 5, f'{self.num}')


# ── glyph guard ──────────────────────────────────────────────────────────
# A character the chosen face does not carry renders as a box, and a box on a
# brand sheet is the most embarrassing possible defect. reportlab does not warn.
# Wrap the three text calls and check coverage against the actual cmap, so the
# document cannot be built with a missing glyph anywhere in it.
from fontTools.ttLib import TTFont as _TTF
_CMAP = {}
_FILES = {'Heb': os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets/David400.ttf'), 'HebB': os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets/David700.ttf'),
          'Plate': 'BigShoulders-Bold.ttf', 'PlateLt': 'BigShoulders-Regular.ttf',
          'Sans': 'InstrumentSans-Regular.ttf', 'SansB': 'InstrumentSans-Bold.ttf',
          'SansI': 'InstrumentSans-Italic.ttf', 'Mono': 'GeistMono-Regular.ttf',
          'MonoB': 'GeistMono-Bold.ttf'}
for _n, _f in _FILES.items():
    _path = _f if _f.startswith('/') else os.path.join(FONTS, _f)
    _CMAP[_n] = set(_TTF(_path).getBestCmap().keys())

MISSING = []
def install_glyph_guard():
    for meth in ('drawString', 'drawRightString', 'drawCentredString'):
        orig = getattr(rl_canvas.Canvas, meth)
        def wrap(self, x, y, text, *a, _o=orig, **kw):
            fn = self._fontname
            if fn in _CMAP:
                for ch in str(text):
                    if ch not in ('\n', '\t') and ord(ch) not in _CMAP[fn]:
                        MISSING.append((fn, ch, hex(ord(ch)), str(text)[:46]))
            return _o(self, x, y, text, *a, **kw)
        setattr(rl_canvas.Canvas, meth, wrap)

def report_glyphs():
    if not MISSING:
        print('glyph guard: every character is carried by the face it is set in')
        return 0
    seen = set()
    for fn, ch, cp, ctx in MISSING:
        k = (fn, ch)
        if k in seen: continue
        seen.add(k)
        print(f'  MISSING  {fn} has no {cp} {ch!r}   in: {ctx}')
    print(f'glyph guard: {len(seen)} missing glyph(s)')
    return len(seen)
