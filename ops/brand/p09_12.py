import sys, os, math; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *
ASSET = lambda n: os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets', n)
REPO  = lambda n: os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', n)
from reportlab.lib.utils import ImageReader
MARK = ImageReader(ASSET('mark.png'))
LOCKUP = ImageReader(ASSET('lockup.png'))

# ══ PLATE 05 — the blue question ═════════════════════════════════════════
def blue_question(c):
    p = Plate(c, '05', 'One blue, or two?',
              'A finding, not a rule. The blue the product paints is not the blue in the logo file, '
              'and this plate exists so the difference is settled once rather than re-discovered.')
    top = H - MT - 100
    bw = (CW - 30) / 2; bh = 150
    for i, (hexv, who, note) in enumerate([
        ('#07639e', 'THE LOGO', 'Sampled from logo-full.png — 19,915 pixels of it, the largest single '
                                'colour in the file. This is what is on the shopfront, the van, the '
                                'business card and every printed thing already out in the world.'),
        ('#0060a8', 'THE PRODUCT', 'Declared as --kc-blue in styles/globals.css and painted on every '
                                   'screen: buttons, links, eyebrows, the sidebar’s active row. This '
                                   'is what a customer sees on the website and in the portal.')]):
        x = ML + i * (bw + 30)
        c.setFillColor(HexColor(hexv)); c.rect(x, top - bh, bw, bh, stroke=0, fill=1)
        c.setFillColor(tint(HexColor('#ffffff'), 0.85)); c.setFont('Plate', 20)
        c.drawString(x + 14, top - 30, who)
        c.setFillColor(HexColor('#ffffff')); c.setFont('MonoB', 13)
        c.drawString(x + 14, top - bh + 18, hexv.upper())
        p.para(note, x, top - bh - 16, bw, 10.6, 'Sans', 7.8, tint(INK, 0.8))

    # the two, adjacent, which is the only honest way to show a small difference
    my_ = top - bh - 96
    c.setFillColor(HexColor('#07639e')); c.rect(ML, my_ - 54, CW / 2, 54, stroke=0, fill=1)
    c.setFillColor(HexColor('#0060a8')); c.rect(ML + CW / 2, my_ - 54, CW / 2, 54, stroke=0, fill=1)
    c.setFillColor(tint(HexColor('#ffffff'), 0.8)); c.setFont('Mono', 6.2)
    c.drawString(ML + 10, my_ - 44, '#07639E  THE LOGO')
    c.drawString(ML + CW / 2 + 10, my_ - 44, '#0060A8  --KC-BLUE')
    c.setStrokeColor(PAPER); c.setLineWidth(1.2)
    c.line(ML + CW / 2, my_ - 54, ML + CW / 2, my_)
    p.label('DELTA-E ≈ 8.7  ·  SIDE BY SIDE IN FLAT COLOUR THIS IS A VISIBLE STEP, NOT A ROUNDING ERROR',
            ML, my_ - 66, tint(INK, 0.55), 6.4, 'MonoB')

    yy = my_ - 96
    p.hair(ML, yy + 16, CW)
    cols = [
        ('WHY IT MATTERS NOW', 'On a screen, nobody sees the two together. On a carrier bag printed to '
                               '--kc-blue, carried into a shop whose sign is matched to the logo file, '
                               'somebody does. Print is where a near-miss becomes a mistake, and the '
                               'bags are the next thing to be ordered.'),
        ('THE COMMENT IS BACKWARDS', 'styles/globals.css calls #07639e a "near-miss copy" the public '
                                     'pages used to carry. It is the other way round: #07639e is the '
                                     'logo. Whatever is decided, that comment needs correcting — it '
                                     'currently teaches the next person the wrong thing.'),
        ('WHAT IS NOT AT STAKE', 'Contrast. #07639e measures 5.77:1 on paper and #0060a8 measures 5.86:1 '
                                 '— both clear AA for body copy and both clear it for large text. This '
                                 'is a question of matching, not of legibility.'),
    ]
    for i, (h, body) in enumerate(cols):
        x, w = col(i * 4, 4)
        p.label(h, x, yy, BLUE, 6.4, 'MonoB')
        p.para(body, x, yy - 12, w, 9.8, 'Sans', 7.2, tint(INK, 0.78))

    # the recommendation, stated plainly and marked as a recommendation
    ry = MB + 92
    c.setFillColor(CARD); c.rect(ML, ry - 8, CW, 78, stroke=0, fill=1)
    c.setStrokeColor(GOLD); c.setLineWidth(1.4); c.line(ML, ry - 8, ML, ry + 70)
    p.label('RECOMMENDED  ·  OWNER DECISION', ML + 16, ry + 56, GOLD_INK, 6.6, 'MonoB')
    p.para('Move --kc-blue to #07639e and let the logo be the authority. The mark is the fixed asset — '
           'it is already printed, already on the sign, already in every customer’s memory — and a '
           'stylesheet is the cheap thing to change. Nothing is lost: contrast holds, dark mode is '
           'unaffected, and one value in one file moves the whole product. The alternative, '
           're-cutting the logo to #0060a8, means re-issuing every printed thing that already exists.',
           ML + 16, ry + 42, CW - 32, 10.4, 'Sans', 8, tint(INK, 0.85))
    p.foot('PLATE 05  ·  ONE BLUE, OR TWO  ·  UNRESOLVED UNTIL THE OWNER SAYS')
    c.showPage()

# ══ PLATE 06 — type ══════════════════════════════════════════════════════
def typography(c):
    p = Plate(c, '06', 'Type',
              'Two faces, one ramp, and a rule about capitals. Both are self-hosted — no CDN, and '
              'no third party told who reads the page.')
    top = H - MT - 96
    for i, (name, role, note) in enumerate([
        ('Heebo', 'THE VOICE',
         'A humanist grotesque with a full Hebrew cut in the same family, which is the whole reason '
         'it was chosen: one face, both alphabets, no seam where the languages meet. Weights 100–900 '
         'from a single variable file.'),
        ('David Libre', 'THE HEBREW',
         'The classic David face at 400/500/700, scoped to the HEBREW UNICODE-RANGE ONLY. Because it '
         'covers no Latin codepoints, listing it first styles Hebrew properly while Latin falls '
         'straight through untouched. Full niqqud.')]):
        x, w = col(i * 6, 6)
        c.setFillColor(INK); c.setFont('Plate', 40); c.drawString(x, top - 32, name)
        p.label(role, x, top - 46, BLUE, 6.6, 'MonoB')
        p.para(note, x, top - 60, w, 10.4, 'Sans', 7.8, tint(INK, 0.78))

    # The one true specimen this document can show: the Hebrew, in the actual
    # face, lifted out of public/fonts. The Latin cut is NOT in the repo — only
    # Heebo's Hebrew subset is — so no Latin specimen here is really Heebo, and
    # saying so is cheaper than letting somebody proof against the wrong shapes.
    hx, hw = col(6, 6)
    c.setFillColor(tint(INK, 0.9)); c.setFont('Heb', 30)
    c.drawString(hx, top - 128, rtl('אלול') + '   ' + rtl('שבת') + '   ' + rtl('כשר קונקט'))
    p.label('DAVID LIBRE 400  ·  THE PRODUCT’S OWN FILE, public/fonts', hx, top - 142, tint(INK, 0.45), 5.8)
    p.para('Every Latin word in this document is set in Instrument Sans, not in Heebo: the repo '
           'carries Heebo’s Hebrew subset only. Proof Latin on a screen, never against this sheet.',
           ML, top - 122, col(0, 6)[1], 9.8, 'Sans', 7.2, tint(GOLD_INK, 0.95))

    # ── the ramp, drawn at size ──────────────────────────────────────────
    ry = top - 196
    p.hair(ML, ry + 18, CW)
    p.label('THE RAMP  ·  every size in the app is one of these', ML, ry + 24, tint(INK, 0.55), 6.6, 'MonoB')
    ramp = [('--fs-hero', 28, 'money'), ('--fs-h1', 22, 'headings'),
            ('--fs-title', 18, 'card titles'), ('--fs-lead', 16, 'modal titles'),
            ('--fs-ui', 14, 'inputs'), ('--fs-body', 13, 'the default'),
            ('--fs-small', 12, 'tables'), ('--fs-micro', 11, 'badges'),
            ('--fs-overline', 10, 'labels')]
    y = ry - 8
    RX = ML + 118        # the token column, clear of the 28 px specimen
    for tok, px, use in ramp:
        c.setFillColor(INK); c.setFont('Sans', px)
        c.drawString(ML, y - px + 2, '£45.00')
        c.setFillColor(tint(INK, 0.6)); c.setFont('MonoB', 6.2)
        c.drawString(RX, y - px * 0.6, tok)
        c.setFillColor(tint(INK, 0.42)); c.setFont('Mono', 6)
        c.drawRightString(RX + 96, y - px * 0.6, '%d px' % px)
        c.drawString(RX + 104, y - px * 0.6, use)
        y -= px + 8
    ramp_bottom = y

    # ── Simple Mode, in its own column, clear of the ramp ────────────────
    sx, sw = col(8, 4)
    p.label('SIMPLE MODE', sx, ry - 8, BLUE, 6.6, 'MonoB')
    sy = p.para('Every step is written as calc(px × --fs-scale). One multiplier — 1, 1.15, 1.3 — moves '
                'the whole product with its proportions intact. It exists because the app is dense on '
                'purpose and that density is wrong for some of the people behind this counter.',
                sx, ry - 22, sw, 10.2, 'Sans', 7.6, tint(INK, 0.78))
    for i, (lbl, sc) in enumerate([('×1', 13), ('×1.15', 15), ('×1.3', 17)]):
        yy = sy - 16 - i * 28
        c.setFillColor(INK); c.setFont('Sans', sc); c.drawString(sx, yy, 'Close this rental')
        p.label(lbl, sx + sw - 26, yy, tint(INK, 0.45), 5.8)
    p.para('Any new off-ramp size silently opts that text out of Simple Mode, which is the second '
           'reason not to add one.', sx, sy - 108, sw, 9.8, 'Sans', 7.2, tint(INK, 0.62))

    # ── the rules that are not about size ────────────────────────────────
    ky = MB + 96
    p.hair(ML, ky + 22, CW)
    p.label('THE RULES THAT ARE NOT ABOUT SIZE', ML, ky + 28, tint(INK, 0.55), 6.6, 'MonoB')
    rules = [
        ('SENTENCE CASE, ALWAYS', '"Save changes", not "Save Changes". Proper nouns keep their '
                                  'capitals. The app was split between the two until August and read '
                                  'as two products stitched together.'),
        ('WEIGHTS', '400 body · 500 labels and links · 600 emphasis · 700 headings and values. 400 is '
                    'the floor for anything read as data — table cells were 300 and were too thin to '
                    'read on a busy counter.'),
        ('MONEY IS TABULAR', 'Anything that is a figure sets font-feature-settings "tnum", so a column '
                             'of prices lines up on the decimal instead of drifting.'),
        ('DISPLAY IS FURNITURE', 'The 20–48 px display tier at weight 300 is page furniture: titles, '
                                 'the greeting, the till total. Body copy never uses it.'),
    ]
    for i, (h, body) in enumerate(rules):
        x, w = col(i * 3, 3)
        p.label(h, x, ky, BLUE, 6.4, 'MonoB')
        p.para(body, x, ky - 12, w, 9.8, 'Sans', 7.2, tint(INK, 0.76))
    p.foot('PLATE 06  ·  TYPE  ·  RAMP IN styles/globals.css  ·  CONTRACT IN docs/DESIGN.md')
    c.showPage()
