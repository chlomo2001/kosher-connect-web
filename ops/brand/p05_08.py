import sys, os, math; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *
ASSET = lambda n: os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets', n)
REPO  = lambda n: os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', n)

def _lin(v):
    v = v / 255.0
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
def lum(h):
    r, g, b = (int(h[i:i+2], 16) for i in (1, 3, 5))
    return 0.2126*_lin(r) + 0.7152*_lin(g) + 0.0722*_lin(b)
def ratio(a, b):
    la, lb = lum(a), lum(b); hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)
def cmyk(h):
    r, g, b = (int(h[i:i+2], 16) / 255 for i in (1, 3, 5))
    k = 1 - max(r, g, b)
    if k >= 1: return (0, 0, 0, 100)
    return tuple(round(v * 100) for v in ((1-r-k)/(1-k), (1-g-k)/(1-k), (1-b-k)/(1-k), k))
def rgbs(h): return tuple(int(h[i:i+2], 16) for i in (1, 3, 5))

# ══ PLATE 03 — the palette ═══════════════════════════════════════════════
def palette(c):
    p = Plate(c, '03', 'Colour',
              'Five values carry the brand and two carry the paper. The semantic set below is not '
              'brand colour — it is a signal system, and it answers to meaning rather than to taste.')
    SW = [
        ('#0a2540', 'kc-navy', 'INK', 'Body copy, headings, the sidebar track, deep button states. '
                                      'The default. If a colour has no reason, it is this one.'),
        ('#07639e', 'kc-blue', 'ACTION', 'Links, primary buttons, eyebrows, the one thing on a '
                                         'screen you are meant to press. Spend it sparingly. This '
                                         'is the logo’s own blue — see plate 05.'),
        ('#57a6e6', 'kc-blue-bright', 'ON DARK', 'The same blue lifted until it clears AA on a '
                                                 'near-black card. Dark mode is a second set of '
                                                 'values, not a filter over the first.'),
        ('#c19161', 'kc-gold', 'WARMTH', 'DECORATION ONLY. Rules, the second word of the lockup, '
                                         'a band edge. Never text: it measures 2.80:1 on white.'),
        ('#8d612b', 'kc-gold-ink', 'GOLD INK', 'The same gold darkened until 17 px copy clears AA. '
                                               'This is the one that may hold words.'),
    ]
    top = H - MT - 96
    sw_w = (CW - 4 * 12) / 5; sw_h = 128
    for i, (hexv, tok, role, note) in enumerate(SW):
        x = ML + i * (sw_w + 12); y = top - sw_h
        c.setFillColor(HexColor(hexv)); c.rect(x, y, sw_w, sw_h, stroke=0, fill=1)
        if hexv == '#c19161':
            c.setStrokeColor(tint(INK, 0.25)); c.setLineWidth(0.5); c.rect(x, y, sw_w, sw_h, stroke=1, fill=0)
        ink_on = HexColor('#ffffff') if ratio(hexv, '#ffffff') > 3.4 else INK
        c.setFillColor(tint(ink_on, 0.92)); c.setFont('MonoB', 8); c.drawString(x + 9, y + 14, hexv.upper())
        c.setFillColor(tint(ink_on, 0.6)); c.setFont('Mono', 5.8); c.drawString(x + 9, y + 5, 'rgb %d %d %d' % rgbs(hexv))
        c.setFillColor(tint(ink_on, 0.82)); c.setFont('Plate', 14); c.drawString(x + 9, y + sw_h - 19, role)
        yy = y - 14
        p.label('--' + tok, x, yy, BLUE, 6.4, 'MonoB')
        ny = p.para(note, x, yy - 12, sw_w, 9.8, 'Sans', 7.2, tint(INK, 0.76))
        p.label('CMYK %d %d %d %d' % cmyk(hexv), x, ny, tint(INK, 0.45), 5.8)

    # ── the two grounds: swatch above, note below, never beside ──────────
    gy = top - sw_h - 128
    p.hair(ML, gy + 20, CW)
    p.label('THE PAPER  ·  never pure white, and the reason is a nine-hour shift',
            ML, gy + 26, tint(INK, 0.55), 6.6, 'MonoB')
    grounds = [
        ('#f7f3ea', 'bg', 'The canvas. A whisper of the logo’s gold in off-white. Pure white glares '
                          'over a long day; this stays bright without the glare.'),
        ('#fffdf8', 'surface', 'Cards, a touch brighter than the canvas so they lift off it without '
                               'needing a shadow to say so.'),
    ]
    for i, (hexv, tok, note) in enumerate(grounds):
        x, w = col(i * 3, 3)
        c.setFillColor(HexColor(hexv)); c.rect(x, gy - 40, w, 40, stroke=0, fill=1)
        c.setStrokeColor(tint(INK, 0.2)); c.setLineWidth(0.5); c.rect(x, gy - 40, w, 40, stroke=1, fill=0)
        c.setFillColor(INK); c.setFont('MonoB', 7.6); c.drawString(x + 8, gy - 18, hexv.upper())
        p.label('--' + tok, x + 8, gy - 29, tint(INK, 0.5), 6, 'Mono')
        p.para(note, x, gy - 52, w, 9.8, 'Sans', 7.2, tint(INK, 0.76))

    # ── the semantic set, small and level: a signal system, not brand ────
    sx, sw2 = col(6, 6)
    p.label('THE SEMANTIC SET  ·  meaning, not brand', sx, gy + 6, tint(INK, 0.55), 6.6, 'MonoB')
    sem = [('#b3123a', 'danger'), ('#0a6e3f', 'success'), ('#a94e08', 'warning'),
           ('#0e7490', 'sim'), ('#7c3aed', 'vn'), ('#7c5d24', 'gold')]
    cw2 = (sw2 - 5 * 8) / 6
    for i, (hexv, tok) in enumerate(sem):
        x = sx + i * (cw2 + 8)
        c.setFillColor(HexColor(hexv)); c.rect(x, gy - 40, cw2, 40, stroke=0, fill=1)
        c.setFillColor(HexColor('#ffffff')); c.setFont('MonoB', 5.6)
        c.drawString(x + 5, gy - 34, hexv.upper()[1:])
        p.label(tok, x, gy - 51, tint(INK, 0.6), 6, 'MonoB')
    p.para('Six signals, each earned. SIM has its own teal because a SIM row is not a warning; '
           'virtual numbers a violet because they are not a rental. Every one of them has a darker '
           '"-ink" twin for the moment it has to be read as words rather than seen as a state.',
           sx, gy - 64, sw2, 9.8, 'Sans', 7.2, tint(INK, 0.72))

    # ── the dark voice: a different set of values, not a filter over these ──
    dk_y = MB + 172
    c.setFillColor(HexColor('#0b0d11')); c.rect(ML, dk_y, CW, 84, stroke=0, fill=1)
    c.setFillColor(tint(HexColor('#f2f0ea'), 0.55)); c.setFont('MonoB', 6.6)
    c.drawString(ML + 14, dk_y + 68, 'IN DARK')
    c.setFillColor(tint(HexColor('#f2f0ea'), 0.72)); c.setFont('Sans', 7.4)
    c.drawString(ML + 14, dk_y + 54, 'Not a filter over the light palette — a second set of values, each')
    c.drawString(ML + 14, dk_y + 44, 'lifted until it clears AA on a near-black card.')
    dark = [('#0b0d11', 'bg'), ('#1b2028', 'surface'), ('#57a6e6', 'kc-blue-bright'),
            ('#e0a94a', 'gold'), ('#f2f0ea', 'text'), ('#9aa1a9', 'muted')]
    dw = 54
    dx = ML + 14
    for hexv, tok in dark:
        c.setFillColor(HexColor(hexv)); c.rect(dx, dk_y + 12, dw, 22, stroke=0, fill=1)
        c.setStrokeColor(tint(HexColor('#f2f0ea'), 0.22)); c.setLineWidth(0.4)
        c.rect(dx, dk_y + 12, dw, 22, stroke=1, fill=0)
        c.setFillColor(tint(HexColor('#f2f0ea'), 0.6)); c.setFont('Mono', 5.4)
        c.drawString(dx, dk_y + 5, hexv.upper())
        dx += dw + 8
    c.setFillColor(tint(HexColor('#f2f0ea'), 0.42)); c.setFont('Mono', 5.8)
    c.drawRightString(W - MR - 14, dk_y + 68, 'THE MARK KEEPS ITS OWN BLUE ON DARK  ·  logo-full-tight-dark.png')

    # ── the discipline, anchored to the bottom margin ────────────────────
    dy = MB + 84
    p.hair(ML, dy + 22, CW)
    p.label('THE DISCIPLINE', ML, dy + 28, tint(INK, 0.55), 6.6, 'MonoB')
    rules = [
        ('ONE BRAND, ONE PLACE', 'Every surface reads these values from styles/globals.css. The public '
                                 'pages once kept near-miss copies, which is why the product read as two.'),
        ('BLUE IS A BUDGET', 'A screen with one blue thing on it tells you where to press. A screen '
                             'with six tells you nothing. The accent is spent, not applied.'),
        ('GOLD DOES NOT SPEAK', 'It rules, edges and decorates. The moment it has to be read it '
                                'becomes kc-gold-ink instead — that is what the second gold is for.'),
        ('NO LITERAL HEX', 'A hex typed into markup cannot flip for dark mode, so it is a bug by '
                           'construction. Colour comes off a token or it does not ship.'),
    ]
    for i, (h, body) in enumerate(rules):
        x, w = col(i * 3, 3)
        p.label(h, x, dy, BLUE, 6.4, 'MonoB')
        p.para(body, x, dy - 12, w, 9.8, 'Sans', 7.2, tint(INK, 0.76))
    p.foot('PLATE 03  ·  COLOUR  ·  SAMPLED FROM logo-full.png AND styles/globals.css')
    c.showPage()

# ══ PLATE 04 — contrast ══════════════════════════════════════════════════
def contrast(c):
    p = Plate(c, '04', 'Contrast',
              'Every pairing the brand permits, measured rather than judged. WCAG 2.2 asks 4.5:1 for '
              'body copy and 3:1 for text at 18.66 px bold or 24 px regular.')
    rows = [
        ('#0a2540', '#f7f3ea', 'Navy on paper', 'body copy, headings — the default pairing'),
        ('#0a2540', '#fffdf8', 'Navy on card', 'anything set on a card'),
        ('#07639e', '#f7f3ea', 'Blue on paper', 'links and primary labels — the logo’s own blue'),
        ('#57a6e6', '#0b0d11', 'Bright blue on dark', 'the same role, on the dark canvas'),
        ('#ffffff', '#07639e', 'White on blue', 'primary button'),
        ('#ffffff', '#0a2540', 'White on navy', 'the sidebar, the dark lockup panel'),
        ('#8d612b', '#f7f3ea', 'Gold ink on paper', 'the readable gold — warnings, hebrew dates'),
        ('#c19161', '#f7f3ea', 'Gold on paper', 'DECORATION ONLY — fails, and is meant to'),
        ('#c19161', '#0a2540', 'Gold on navy', 'the lockup’s second word, on the rail'),
    ]
    top = H - MT - 100
    rh = 40
    p.hair(ML, top + 14, CW)
    for lbl, x in [('PAIRING', ML), ('SPECIMEN', ML + 176), ('RATIO', ML + 330),
                   ('BODY', ML + 386), ('LARGE', ML + 434)]:
        p.label(lbl, x, top + 20, tint(INK, 0.5), 6.2, 'MonoB')
    y = top
    for fg, bg, name, use in rows:
        r = ratio(fg, bg)
        c.setFillColor(HexColor(bg)); c.rect(ML + 176, y - rh + 6, 140, rh - 10, stroke=0, fill=1)
        c.setStrokeColor(tint(INK, 0.14)); c.setLineWidth(0.4)
        c.rect(ML + 176, y - rh + 6, 140, rh - 10, stroke=1, fill=0)
        c.setFillColor(HexColor(fg)); c.setFont('Sans', 9)
        c.drawString(ML + 186, y - 15, 'Salford M7 4ED')
        c.setFont('SansB', 12); c.drawString(ML + 186, y - 27, '£45.00')

        c.setFillColor(INK); c.setFont('Sans', 8.4); c.drawString(ML, y - 15, name)
        c.setFillColor(tint(INK, 0.5)); c.setFont('Sans', 6.8); c.drawString(ML, y - 25, use)
        c.setFillColor(INK); c.setFont('MonoB', 9.5)
        c.drawString(ML + 330, y - 19, '%.2f' % r)
        for xoff, need in ((386, 4.5), (434, 3.0)):
            ok = r >= need
            c.setFillColor(HexColor('#0c8049') if ok else HexColor('#b3123a'))
            c.setFont('MonoB', 7.4); c.drawString(ML + xoff, y - 19, 'PASS' if ok else 'FAIL')
        p.hair(ML, y - rh + 2, CW, tint(INK, 0.10), 0.4)
        y -= rh

    yy = y - 18
    p.label('WHAT THE FAILING ROW IS FOR', ML, yy, BLUE, 6.6, 'MonoB')
    p.para('kc-gold fails against paper at 2.80:1 and that is not a defect to fix — it is why the '
           'palette carries a second gold. Gold is the brand’s warmth and it does that work as a '
           'rule, an edge, a band, the second word of the lockup. The instant it has to be READ it '
           'becomes kc-gold-ink at 5.42:1. A brand sheet that pretended the decorative gold passed '
           'would put unreadable text on a receipt somebody has to check.',
           ML, yy - 14, col(0, 7)[1], 11, 'Sans', 8, tint(INK, 0.8))
    x2, w2 = col(7, 5)
    p.label('MEASURED, NOT REMEMBERED', x2, yy, BLUE, 6.6, 'MonoB')
    p.para('These ratios are computed from the hex values on plate 03 by the same formula the '
           'harness uses on every screen nightly — sRGB relative luminance, WCAG 2.2 §1.4.3. The '
           'app’s own contrast sweep measures what is actually painted, compositing translucent '
           'fills down to the first opaque layer, because a wash over a card is where this goes '
           'wrong and getComputedStyle alone will not tell you.',
           x2, yy - 14, w2, 11, 'Sans', 8, tint(INK, 0.8))
    # ── what to do when a new colour is proposed ────────────────────────
    ay = MB + 96
    p.hair(ML, ay + 22, CW)
    p.label('IF SOMEBODY WANTS A NEW COLOUR', ML, ay + 28, tint(INK, 0.55), 6.6, 'MonoB')
    steps = [
        ('01  ASK WHAT IT MEANS', 'A colour with no meaning is decoration, and decoration is gold’s '
                                  'job. If it cannot finish the sentence "this colour means ___", it '
                                  'does not need to exist.'),
        ('02  MEASURE IT', 'Against paper, against card, and against navy, at body size and large. '
                           'A value that fails one of those is not rejected — it is given an "-ink" '
                           'twin, the way gold was.'),
        ('03  PUT IT IN THE TOKEN FILE', 'styles/globals.css, light and dark, both in the same commit. '
                                         'A dark rule written in only one of its two forms is caught '
                                         'by the nightly sweep, but only after it has shipped.'),
    ]
    for i, (h, body) in enumerate(steps):
        x, w = col(i * 4, 4)
        p.label(h, x, ay, BLUE, 6.4, 'MonoB')
        p.para(body, x, ay - 12, w, 9.8, 'Sans', 7.2, tint(INK, 0.76))
    p.foot('PLATE 04  ·  CONTRAST  ·  WCAG 2.2 AA  ·  ops/harness/render.mjs --contrast')
    c.showPage()
