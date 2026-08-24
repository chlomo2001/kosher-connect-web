import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *
ASSET = lambda n: os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets', n)
REPO  = lambda n: os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', n)
from reportlab.lib.utils import ImageReader
MARK = ImageReader(ASSET('mark.png')); LOCKUP = ImageReader(ASSET('lockup.png'))
MONO = ImageReader(ASSET('mark-mono.png'))

def cols(p, c, y, items, span=3):
    for i, (h, body) in enumerate(items):
        x, w = col(i * span, span)
        p.label(h, x, y, BLUE, 6.4, 'MonoB')
        p.para(body, x, y - 12, w, 9.8, 'Sans', 7.2, tint(INK, 0.76))

# ══ PLATE 09 — print ═════════════════════════════════════════════════════
def print_plate(c):
    p = Plate(c, '09', 'For the printer',
              'What to send, what to insist on, and the one instruction that matters more than any '
              'number on this page: match to the supplied artwork, not to a formula.')
    top = H - MT - 112
    rows = [
        ('#0a2540', 'kc-navy', (84, 42, 0, 75)), ('#07639e', 'logo blue', (96, 37, 0, 38)),
        ('#0060a8', 'kc-blue', (100, 43, 0, 34)), ('#c19161', 'kc-gold', (0, 25, 50, 24)),
        ('#8d612b', 'kc-gold-ink', (0, 31, 70, 45)),
    ]
    p.hair(ML, top + 16, CW)
    for lbl, x in [('VALUE', ML), ('TOKEN', ML + 92), ('HEX', ML + 186),
                   ('CMYK (COATED, INDICATIVE)', ML + 250), ('RGB', ML + 396)]:
        p.label(lbl, x, top + 22, tint(INK, 0.5), 6.2, 'MonoB')
    y = top
    for hexv, tok, cm in rows:
        c.setFillColor(HexColor(hexv)); c.rect(ML, y - 26, 78, 22, stroke=0, fill=1)
        c.setFillColor(INK); c.setFont('Mono', 7.4); c.drawString(ML + 92, y - 19, tok)
        c.setFont('MonoB', 7.6); c.drawString(ML + 186, y - 19, hexv.upper())
        c.setFillColor(tint(INK, 0.8)); c.setFont('Mono', 7.4)
        c.drawString(ML + 250, y - 19, 'C%-3d M%-3d Y%-3d K%-3d' % cm)
        r_, g_, b_ = (int(hexv[i:i+2], 16) for i in (1, 3, 5))
        c.drawString(ML + 396, y - 19, '%d %d %d' % (r_, g_, b_))
        p.hair(ML, y - 32, CW, tint(INK, 0.09), 0.4)
        y -= 34

    wy = y - 12
    c.setFillColor(HexColor('#fdf6ec')); c.rect(ML, wy - 62, CW, 74, stroke=0, fill=1)
    c.setStrokeColor(GOLD_INK); c.setLineWidth(1.4); c.line(ML, wy - 62, ML, wy + 12)
    p.label('THE CMYK ABOVE IS A STARTING POINT, NOT A SPECIFICATION', ML + 16, wy, GOLD_INK, 6.6, 'MonoB')
    p.para('Those numbers are a naive conversion from RGB with no colour profile and no paper stock '
           'behind them. Sent to a press as-is they will not match the sign. The instruction to give '
           'a printer is: match to the supplied logo artwork and send a drawdown or a wet proof on '
           'the actual stock before the run. Approve the proof, not the numbers. Where a spot colour '
           'is offered, ask the printer to select the nearest Pantone against the artwork in daylight '
           'and record what they chose here, in writing, for next time.',
           ML + 16, wy - 12, CW - 32, 10.4, 'Sans', 7.8, tint(INK, 0.85))

    sy = wy - 96
    p.hair(ML, sy + 20, CW)
    p.label('SUBSTRATES', ML, sy + 26, tint(INK, 0.55), 6.6, 'MonoB')
    swatches = [('#f7f3ea', 'COATED WHITE', 'The reference. Everything on plates 03 and 04 was measured here.'),
                ('#d3c1a8', 'KRAFT / RECYCLED', 'The gold loses roughly half its separation from the board. Print the monogram in navy alone, or in navy + one gold.'),
                ('#0a2540', 'NAVY STOCK', 'Reversed lockup only, and check the gold has not gone muddy — on uncoated navy it often needs a white underbase.'),
                ('#ffffff', 'ONE COLOUR', 'Navy only. The mark reads perfectly without the gold; the gold never carries meaning, so nothing is lost.')]
    bw = (CW - 3 * 12) / 4
    for i, (bg, name, note) in enumerate(swatches):
        x = ML + i * (bw + 12)
        c.setFillColor(HexColor(bg)); c.rect(x, sy - 62, bw, 62, stroke=0, fill=1)
        c.setStrokeColor(tint(INK, 0.2)); c.setLineWidth(0.5); c.rect(x, sy - 62, bw, 62, stroke=1, fill=0)
        m = 32
        if i == 2:
            c.drawImage(ImageReader(REPO('public/logo-full-tight-dark.png')),
                        x + 8, sy - 40, bw - 16, (bw - 16) * 184 / 813, mask='auto')
        elif i == 3:
            c.drawImage(MONO, x + bw / 2 - m / 2, sy - 48, m, m * 280 / 279, mask='auto')
        else:
            c.drawImage(MARK, x + bw / 2 - m / 2, sy - 48, m, m * 280 / 279, mask='auto')
        p.label(name, x, sy - 74, tint(INK, 0.6), 6.2, 'MonoB')
        p.para(note, x, sy - 85, bw, 9.6, 'Sans', 7, tint(INK, 0.74))

    my2 = MB + 178
    p.hair(ML, my2 + 22, CW)
    p.label('WHAT GOES WRONG ON PRESS, IN ORDER OF HOW OFTEN', ML, my2 + 28, tint(INK, 0.55), 6.6, 'MonoB')
    cols(p, c, my2, [
        ('THE GAP FILLS IN', 'Ink spread on absorbent stock closes the arc at small sizes. It is why '
                             'the 12 mm minimum exists, and why a bag gets 18.'),
        ('THE GOLD GOES PINK', 'kc-gold is a warm tan with no magenta to spare. A press running heavy '
                               'on magenta turns it salmon. Check this first on any proof.'),
        ('THE BLUE GOES PURPLE', 'The same fault in the other direction. Compare the proof against '
                                 'the printed sign, in daylight, not against a screen.'),
        ('SOMEBODY HELPS', 'A well-meaning studio will centre the mark in a box, add a keyline, or '
                           'square up the arc. Send plate 02 with the artwork and the problem does '
                           'not arise.'),
    ])

    fy = MB + 92
    p.hair(ML, fy + 22, CW)
    p.label('WHAT TO SEND, AND WHAT TO ASK BACK', ML, fy + 28, tint(INK, 0.55), 6.6, 'MonoB')
    cols(p, c, fy, [
        ('SEND', 'The logo artwork as supplied, the clear-space rule from plate 02, and the minimum '
                 'size for that substrate. Never a screenshot, never a PNG lifted off the website.'),
        ('ASK FOR', 'A proof on the real stock. For a bag, a printed sample of one bag — not a PDF '
                    'proof on office paper, which tells you nothing about how kraft eats the gold.'),
        ('CHECK', 'The gap in the arc is open. The k and the c are not touching. The blue matches the '
                  'sign. The words, if present, are at least 34 mm across.'),
        ('RECORD', 'Whatever the printer matched to — ink, Pantone, screen percentages — comes back '
                   'into this document. A brand standard that does not learn is a brand standard '
                   'somebody re-guesses next year.'),
    ])
    p.foot('PLATE 09  ·  FOR THE PRINTER  ·  APPROVE THE PROOF, NOT THE NUMBERS')
    c.showPage()

# ══ PLATE 10 — evidence ══════════════════════════════════════════════════
def evidence(c):
    p = Plate(c, '10', 'The evidence',
              'Branding advice is full of numbers that do not survive being looked up. This plate '
              'grades what is worth acting on, names what to stop repeating, and gives a test for '
              'the next claim somebody brings through the door.')
    top = H - MT - 100
    BANDS = [
        ('#0a6e3f', 'HOLDS UP', 'Replicated across many studies. Act on these.', [
            ('Processing fluency', 'Text that is easy to read is judged more likeable AND more '
                                   'likely to be true. Legibility is not only an accessibility '
                                   'duty — it is persuasion. Plate 04 is marketing work.'),
            ('Mere exposure', 'Repeated exposure increases liking, without the person recalling '
                              'the exposure. This is the argument for consistency over novelty: '
                              'the same mark, in the same colours, everywhere, for years.'),
            ('Distinctive assets', 'Brands are retrieved from memory by a few consistent cues '
                                   '(Ehrenberg-Bass tradition). Here those are the open arc, the '
                                   'navy-and-gold pairing, and the warm paper. Protect them, and '
                                   'do not "refresh" them because somebody is bored.'),
            ('Colour appropriateness', 'What matters is whether a colour FITS the category and the '
                                       'claimed personality — not a universal emotional code. '
                                       'The defensible sentence is "blue fits telecom", never '
                                       '"blue means trust".'),
        ]),
        ('#a94e08', 'DEPENDS', 'Real, but context-bound. Do not generalise from one result.', [
            ('Button colour and conversion', 'The famous A/B wins are real for the page they were '
                                             'run on. They do not transfer. If it matters here, '
                                             'test it here.'),
            ('Colour and emotion', 'Associations vary by culture, by individual and by what the '
                                   'colour is on. Ours is a community with its own visual habits; '
                                   'a study of American undergraduates is not evidence about it.'),
        ]),
        ('#b3123a', 'FOLKLORE', 'Repeated everywhere. Not supported. Stop citing these.', [
            ('"90% of snap judgements are based on colour"', 'Traceable to a secondary citation '
                                                             'that misstates its source. The number '
                                                             'has no study behind it.'),
            ('"Colour lifts brand recognition by 80%"', 'Same lineage. The underlying figure is not '
                                                        'what the claim says it is.'),
            ('"It takes seven impressions to make a sale"', 'Trade folklore from mid-century '
                                                            'advertising, never established.'),
            ('"People decide in 50 milliseconds"', 'The study behind this measured how quickly '
                                                   'people form a VISUAL APPEAL rating of a web '
                                                   'page. Not a purchase decision, not trust.'),
        ]),
    ]
    y = top
    for colr, name, sub, items in BANDS:
        c.setFillColor(HexColor(colr)); c.rect(ML, y - 15, 3, 17, stroke=0, fill=1)
        c.setFillColor(HexColor(colr)); c.setFont('Plate', 15); c.drawString(ML + 10, y - 12, name)
        c.setFillColor(tint(INK, 0.55)); c.setFont('Sans', 7.4)
        c.drawString(ML + 10 + 96, y - 11, sub)
        y -= 24
        for i, (h, body) in enumerate(items):
            x, w = col((i % 2) * 6, 6)
            if i % 2 == 0 and i > 0: y -= 44
            p.label(h.upper(), x, y, INK, 6.4, 'MonoB')
            p.para(body, x, y - 11, w, 9.6, 'Sans', 7.2, tint(INK, 0.76))
        y -= 56
        p.hair(ML, y + 14, CW, tint(INK, 0.12))

    ry = MB + 216
    c.setFillColor(CARD); c.rect(ML, ry - 8, CW, 100, stroke=0, fill=1)
    c.setStrokeColor(GOLD); c.setLineWidth(1.4); c.line(ML, ry - 8, ML, ry + 92)
    p.label('AND FOR THIS SHOP IN PARTICULAR', ML + 16, ry + 78, GOLD_INK, 6.6, 'MonoB')
    a, aw = col(0, 6); b, bw = col(6, 6)
    p.para('The channel that decides this business is not advertising — it is one person telling '
           'another, inside a community where everybody knows everybody. That is what the welcome '
           'page’s "why people send their friends" section is for, and it is why manufactured '
           'urgency is not merely off-brand here but actively dangerous: a countdown clock costs '
           'nothing to ignore and a great deal to be seen using.',
           ML + 16, ry + 64, aw - 20, 10.2, 'Sans', 7.8, tint(INK, 0.84))
    p.para('The trust signals that work are concrete and already true: an address you can walk to, '
           'a number a person answers, staff who know your name, and a shop that will tell you when '
           'you are already on a good deal. None of those is a design decision. The brand’s whole '
           'job is to not get in their way — which is why this document spends more pages on '
           'restraint than on expression.',
           b + 4, ry + 64, bw - 4, 10.2, 'Sans', 7.8, tint(INK, 0.84))
    # ── the test, so this plate keeps working after today ───────────────
    ty = MB + 92
    p.hair(ML, ty + 22, CW)
    p.label('HOW TO GRADE THE NEXT CLAIM YOURSELF', ML, ty + 28, tint(INK, 0.55), 6.6, 'MonoB')
    cols(p, c, ty, [
        ('WHO MEASURED IT?', 'Not who repeated it. A statistic with no study behind it is a slogan '
                             'with a number in it, and most of them are.'),
        ('ON WHOM?', 'A result from undergraduates in one country in one decade is not a fact about '
                     'a Salford high street. Ask who was in the room.'),
        ('HOW BIG, AND HOW OFTEN?', 'One striking result is a hypothesis. A dozen boring replications '
                                    'is a finding. Prefer the boring one.'),
        ('WHAT WOULD CHANGE?', 'If believing it would not change a single decision here, it does not '
                               'matter whether it is true. Spend the argument elsewhere.'),
    ])
    p.foot('PLATE 10  ·  EVIDENCE  ·  EFFECTS NAMED SO THEY CAN BE LOOKED UP, NOT CITED AS PROOF')
    c.showPage()
