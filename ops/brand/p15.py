import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *
ASSET = lambda n: os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets', n)
REPO  = lambda n: os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', n)
from reportlab.lib.utils import ImageReader
MARK = ImageReader(ASSET('mark.png')); MONO = ImageReader(ASSET('mark-mono.png'))

def cols(p, c, y, items, span=3):
    for i, (h, body) in enumerate(items):
        x, w = col(i * span, span)
        p.label(h, x, y, BLUE, 6.4, 'MonoB')
        p.para(body, x, y - 12, w, 9.8, 'Sans', 7.2, tint(INK, 0.76))

# ══ PLATE 11 — in code ═══════════════════════════════════════════════════
def in_code(c):
    p = Plate(c, '11', 'Where it lives',
              'A brand standard that is only a PDF drifts within a month. Everything on plates 03, '
              '04 and 06 is a value in a file, with a check that goes red when it moves.')
    top = H - MT - 100
    files = [
        ('styles/globals.css', ':root', 'The five brand values, the paper, the semantic set, the '
                                        'type ramp and every dark-theme twin. This is the source. '
                                        'Change a value here and it moves on every surface at once.'),
        ('docs/DESIGN.md', 'the contract', 'Which token, when. Spacing, radius, elevation, weights, '
                                           'sentence case. A deviation is either a bug or a change '
                                           'to this file — never a local exception.'),
        ('public/logo*.png', 'the assets', 'Four lockups and the monogram. Nothing in the product '
                                           'redraws the mark; every surface points at one of these.'),
        ('public/fonts/', 'the faces', 'Heebo and David Libre, self-hosted as woff2 subsets. No CDN, '
                                       'so no third party is told who reads the page.'),
    ]
    y = top
    for path, what, note in files:
        c.setFillColor(tint(BLUE, 0.06)); c.rect(ML, y - 34, CW, 34, stroke=0, fill=1)
        c.setFillColor(BLUE); c.setFont('MonoB', 8.4); c.drawString(ML + 12, y - 14, path)
        c.setFillColor(tint(INK, 0.45)); c.setFont('Mono', 6.4); c.drawString(ML + 12, y - 25, what)
        p.para(note, ML + 168, y - 12, CW - 180, 9.8, 'Sans', 7.4, tint(INK, 0.8))
        y -= 42

    cy = y - 12
    p.hair(ML, cy + 20, CW)
    p.label('WHAT CATCHES IT WHEN IT SLIPS', ML, cy + 26, tint(INK, 0.55), 6.6, 'MonoB')
    checks = [
        ('theme-pairs.mjs', 'A dark rule written in only one of its two forms — the light one — so '
                            'the surface never flips. Static, instant, runs on every ship.'),
        ('render.mjs --contrast', 'Measures what is actually PAINTED, compositing translucent fills '
                                  'down to the first opaque layer, because a wash over a card is '
                                  'where contrast quietly dies.'),
        ('cssTokens.test.mjs', 'A var() naming a token that was never defined does not fall back — it '
                               'poisons the whole declaration and the rule silently vanishes. Six '
                               'live faults came from that one typo class.'),
        ('icons.mjs', 'The 101 mask icons, checked five ways: every mask resolves, the ink follows '
                      'the button, and no markup has leaked into a text sink, an attribute or a '
                      'name a screen reader reads out.'),
    ]
    yy = cy
    for i, (h, body) in enumerate(checks):
        x, w = col((i % 2) * 6, 6)
        if i == 2: yy -= 52
        p.label(h, x, yy, INK, 6.6, 'MonoB')
        p.para(body, x, yy - 12, w, 9.8, 'Sans', 7.2, tint(INK, 0.76))

    ry = MB + 172
    c.setFillColor(CARD); c.rect(ML, ry - 8, CW, 76, stroke=0, fill=1)
    c.setStrokeColor(GOLD); c.setLineWidth(1.4); c.line(ML, ry - 8, ML, ry + 68)
    p.label('THE ONE THING THAT IS NOT AUTOMATED', ML + 16, ry + 54, GOLD_INK, 6.6, 'MonoB')
    p.para('Nothing here checks that the brand blue matches the LOGO — that comparison is a human '
           'looking at a file, and it is exactly the check that had not been made until this document '
           'was written (plate 05). The lesson generalises: a check only catches what somebody thought '
           'to write. When a rule in this standard turns out to matter, the useful next question is '
           'always "and what would notice if it stopped being true?"',
           ML + 16, ry + 40, CW - 32, 10.4, 'Sans', 7.9, tint(INK, 0.85))

    fy = MB + 92
    p.hair(ML, fy + 22, CW)
    p.label('CHANGING A BRAND VALUE  ·  THE WHOLE PROCEDURE', ML, fy + 28, tint(INK, 0.55), 6.6, 'MonoB')
    cols(p, c, fy, [
        ('01', 'Edit the value in styles/globals.css. Light and dark, in the same commit.'),
        ('02', 'Run the gate — the tests and a production build — and check its EXIT CODE, not its '
               'last line.'),
        ('03', 'Run the smoke sweep. Ninety seconds, and it renders every tab, every dialog and both '
               'public languages.'),
        ('04', 'Update this document, re-issue it, and say in the commit which plate changed. A '
               'standard nobody re-issues is a standard nobody believes.'),
    ])
    p.foot('PLATE 11  ·  WHERE IT LIVES  ·  THE PDF IS THE COPY, THE REPO IS THE ORIGINAL')
    c.showPage()

# ══ PLATE 12 — the checklist ═════════════════════════════════════════════
def colophon(c):
    c.setFillColor(INK); c.rect(0, 0, W, H, stroke=0, fill=1)
    c.setFont('Mono', 6.8); c.setFillColor(tint(HexColor('#ffffff'), 0.5))
    c.drawString(ML, H - MT + 16, 'KOSHER CONNECT  ·  BRAND STANDARD  ·  2026')
    c.drawRightString(W - MR, H - MT + 16, 'PLATE 12  ·  COLOPHON')
    c.setStrokeColor(tint(HexColor('#ffffff'), 0.22)); c.setLineWidth(0.6)
    c.line(ML, H - MT + 8, W - MR, H - MT + 8)
    c.setFillColor(HexColor('#ffffff')); c.setFont('Plate', 40)
    c.drawString(ML - 1.5, H - MT - 30, 'BEFORE IT GOES OUT')
    c.setFillColor(tint(HexColor('#ffffff'), 0.6)); c.setFont('Sans', 8.6)
    c.drawString(ML, H - MT - 48, 'Nine questions. If every answer is yes, it is ours.')

    qs = [
        'Is the mark one of the supplied files, unredrawn and unrecoloured?',
        'Is the gap in the arc open?',
        'Is there X of clear space on every side, X being a quarter of the monogram height?',
        'Is it at or above the minimum size for this substrate — 12 mm print, 28 px screen, 34 mm lockup?',
        'On a dark ground, is it the dark lockup rather than the light one placed hopefully?',
        'Is every colour one of the five, the two papers, or a semantic signal that earned its place?',
        'Does every piece of text clear 4.5:1 against what is actually behind it?',
        'Is it sentence case, in British English, with no manufactured urgency anywhere in it?',
        'If it is going to a press, has somebody approved a proof on the real stock?',
    ]
    y = H - MT - 92
    for i, q in enumerate(qs):
        c.setStrokeColor(tint(HexColor('#ffffff'), 0.35)); c.setLineWidth(0.7)
        c.rect(ML, y - 12, 11, 11, stroke=1, fill=0)
        c.setFillColor(GOLD); c.setFont('MonoB', 6.4)
        c.drawString(ML + 20, y - 3.5, '%02d' % (i + 1))
        c.setFillColor(tint(HexColor('#ffffff'), 0.88)); c.setFont('Sans', 9.2)
        c.drawString(ML + 42, y - 3.5, q)
        c.setStrokeColor(tint(HexColor('#ffffff'), 0.10)); c.setLineWidth(0.4)
        c.line(ML, y - 22, W - MR, y - 22)
        y -= 44

    # the colophon proper
    cy = y - 14
    c.setStrokeColor(tint(GOLD, 0.55)); c.setLineWidth(0.8)
    c.line(ML, cy + 16, ML + 132, cy + 16)
    blocks = [
        ('ISSUE', 'Issue 01 · 24 August 2026 · twelve plates. Supersedes nothing; nothing supersedes '
                  'it until an issue 02 says so on this page.'),
        ('SET IN', 'Big Shoulders and Instrument Sans for this document, Geist Mono for every measured '
                   'value. The Hebrew is David Libre, taken out of the product’s own font directory — '
                   'not a substitute.'),
        ('MEASURED WITH', 'Colours sampled pixel-by-pixel from logo-full.png. Contrast computed by the '
                          'WCAG 2.2 sRGB formula. Nothing on these plates was taken from memory or '
                          'from a previous document.'),
        ('OPEN QUESTION', 'Plate 05 — one blue or two — is unresolved and is the owner’s to settle. '
                          'Until it is, the product and the printed world disagree by a visible step.'),
    ]
    for i, (h, body) in enumerate(blocks):
        x, w = col(i * 3, 3)
        c.setFillColor(GOLD); c.setFont('MonoB', 6.4); c.drawString(x, cy, h)
        c.setFillColor(tint(HexColor('#ffffff'), 0.66)); c.setFont('Sans', 7.2)
        line, yy = '', cy - 12
        for word in body.split():
            t = (line + ' ' + word).strip()
            if pdfmetrics.stringWidth(t, 'Sans', 7.2) <= w:
                line = t
            else:
                c.drawString(x, yy, line); line, yy = word, yy - 9.8
        if line: c.drawString(x, yy, line)

    # the coin closes the book the way it opened it — blue on navy does not read
    coin_r = 34; ccx, ccy = W - MR - coin_r, MB + 30 + coin_r
    c.setFillColor(PAPER); c.circle(ccx, ccy, coin_r, stroke=0, fill=1)
    c.setStrokeColor(tint(GOLD, 0.5)); c.setLineWidth(0.6)
    c.circle(ccx, ccy, coin_r + 5, stroke=1, fill=0)
    m = 44
    c.drawImage(MARK, ccx - m / 2, ccy - m / 2, m, m * 280 / 279, mask='auto')
    c.setFont('Mono', 6.2); c.setFillColor(tint(HexColor('#ffffff'), 0.4))
    c.drawString(ML, MB + 34, 'HATSLUCHE LTD T/A KOSHER CONNECT  ·  421 BURY NEW ROAD, SALFORD M7 4ED')
    c.drawString(ML, MB + 22, '0161 531 1386  ·  KOSHER-CONNECT.COM')
    c.setStrokeColor(tint(HexColor('#ffffff'), 0.18)); c.setLineWidth(0.4)
    c.line(ML, MB + 48, W - MR, MB + 48)
    c.showPage()
