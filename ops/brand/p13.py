import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *
ASSET = lambda n: os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets', n)
REPO  = lambda n: os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', n)
from reportlab.lib.utils import ImageReader
MARK = ImageReader(ASSET('mark.png')); LOCKUP = ImageReader(ASSET('lockup.png'))

def two_col(p, c, y, pairs, gap=3):
    for i, (h, body) in enumerate(pairs):
        x, w = col(i * gap, gap)
        p.label(h, x, y, BLUE, 6.4, 'MonoB')
        p.para(body, x, y - 12, w, 9.8, 'Sans', 7.2, tint(INK, 0.76))

# ══ PLATE 07 — voice ═════════════════════════════════════════════════════
def voice(c):
    p = Plate(c, '07', 'Words',
              'British English, plainly, to a community that will repeat what it hears. Every line '
              'below is a rule the product already keeps — this plate is where they are written down.')
    top = H - MT - 112
    p.hair(ML, top + 16, CW)
    p.label('SAY THIS  ·  NOT THAT', ML, top + 22, tint(INK, 0.55), 6.6, 'MonoB')
    pairs = [
        ('Owes £45.00', 'Debt: £45.00', 'One money vocabulary across the whole product: owes, '
                                        'settled, in credit, still to pay.'),
        ('Close this rental', 'Mark as Returned', 'The verb says what pressing it does, and it is '
                                                  'the same verb on every screen that does it.'),
        ('We will tell you', 'Contact us today!', 'No manufactured urgency. Reputation is the whole '
                                                  'asset here and pressure spends it.'),
        ('Phone rental', 'Device solutions', 'The shop sells phones, SIMs and flights. It does not '
                                             'sell solutions, journeys or experiences.'),
        ('Sunday 2 pm – 6.30 pm', 'Sun 14:00-18:30', 'Times as a person says them. Twenty-four-hour '
                                                     'clocks belong in a timetable.'),
        ('Salford, Manchester', 'Greater Manchester area', 'Where the shop actually is. Somebody is '
                                                           'deciding whether to walk there.'),
    ]
    # Three columns with real widths, and the "why" WRAPS. Truncating it at a
    # character count is how the last version ran two words off the plate.
    GX, WX = ML + 152, ML + 292
    WW = W - MR - WX
    y = top - 6
    for good, bad, why in pairs:
        c.setFillColor(HexColor('#0a6e3f')); c.setFont('SansB', 9.2)
        c.drawString(ML, y - 12, good)
        c.setFillColor(tint(INK, 0.34)); c.setFont('SansI', 8.8)
        c.drawString(GX, y - 12, bad)
        endy = p.para(why, WX, y - 12, WW, 9.6, 'Sans', 7.4, tint(INK, 0.7))
        y = min(y - 30, endy - 8)
        p.hair(ML, y + 8, CW, tint(INK, 0.09), 0.4)

    yy = y - 8
    two_col(p, c, yy, [
        ('BRITISH ENGLISH', 'Realise, not realize. Cheque, not check. Mobile, not cell. Post, not '
                            'mail — except where the product means email, which it calls email. '
                            'Dates are 24 August 2026 or 24/08/2026, never 08/24.'),
        ('THE COMMUNITY IS THE READER', 'Copy is written for the orthodox Jewish community in '
                                        'Salford, which means Hebrew set properly and right-to-left, '
                                        'Shabbos and Yom Tov understood rather than worked around, '
                                        'and imagery that a family would not hesitate over.'),
        ('NAMES ARE NOT DATA', 'A customer’s name is capitalised the way they write it, and the '
                               'record keeps the title they gave. Nothing in the product '
                               'auto-corrects a name to a house style.'),
        ('SAY WHAT WENT WRONG', 'An error message names the thing that failed and what to do next. '
                                '"Could not save that correction — check the connection and try '
                                'again" beats "An error occurred" every time somebody is at a counter '
                                'with a queue behind them.'),
    ], gap=3)

    ry = MB + 186
    c.setFillColor(CARD); c.rect(ML, ry - 6, CW, 82, stroke=0, fill=1)
    c.setStrokeColor(GOLD); c.setLineWidth(1.4); c.line(ML, ry - 6, ML, ry + 76)
    p.label('THE ONE THAT MATTERS MOST', ML + 16, ry + 62, GOLD_INK, 6.6, 'MonoB')
    p.para('The welcome page carries a line that is the whole business in a sentence: "And if you’re '
           'already on a good one, we’ll tell you." A shop that tells a customer they do not need '
           'anything today is the shop they send their friends to. Nothing in this brand — not a '
           'colour, not a headline, not a campaign — is permitted to contradict it.',
           ML + 16, ry + 48, CW - 32, 10.6, 'Sans', 8.2, tint(INK, 0.85))
    p.foot('PLATE 07  ·  WORDS  ·  MONEY VOCABULARY ENFORCED BY ops/harness/money.mjs')
    c.showPage()

# ══ PLATE 08 — application ═══════════════════════════════════════════════
def application(c):
    p = Plate(c, '08', 'In the world',
              'Where the mark goes, at what size, on what ground. Eight surfaces, in the order a '
              'customer meets them.')
    top = H - MT - 96
    MM = 72 / 25.4

    # shopfront
    sw = col(0, 7)[1]; sh = 116
    c.setFillColor(INK); c.rect(ML, top - sh, sw, sh, stroke=0, fill=1)
    lkw = sw * 0.46
    c.drawImage(ImageReader(REPO('public/logo-full-tight-dark.png')),
                ML + 20, top - sh / 2 - (lkw * 184 / 813) / 2 + 8, lkw, lkw * 184 / 813, mask='auto')
    c.setFillColor(tint(HexColor('#ffffff'), 0.55)); c.setFont('Mono', 6)
    c.drawString(ML + 20, top - sh + 20, '421 BURY NEW ROAD  ·  0161 531 1386')
    c.setStrokeColor(tint(GOLD, 0.7)); c.setLineWidth(1.2)
    c.line(ML + 20, top - sh + 32, ML + 20 + lkw, top - sh + 32)
    p.label('01  FASCIA', ML, top - sh - 13, tint(INK, 0.6), 6.2, 'MonoB')
    p.para('Reversed lockup on navy, a gold rule under it, the address in mono. That rule is the '
           'only decoration the sign gets.', ML, top - sh - 24, sw, 9.6, 'Sans', 7.2, tint(INK, 0.7))

    # carrier bag
    bx, bw = col(7, 5)
    bh = sh
    c.setFillColor(HexColor('#d3c1a8')); c.rect(bx, top - bh, bw, bh, stroke=0, fill=1)
    c.setStrokeColor(tint(INK, 0.18)); c.setLineWidth(0.5); c.rect(bx, top - bh, bw, bh, stroke=1, fill=0)
    c.setFillColor(tint(INK, 0.10)); c.rect(bx, top - 18, bw, 18, stroke=0, fill=1)
    m2 = 44
    c.drawImage(MARK, bx + bw / 2 - m2 / 2, top - bh / 2 - m2 / 2 - 4, m2, m2 * 280 / 279, mask='auto')
    c.setFillColor(INK); c.setFont('Plate', 13)
    c.drawCentredString(bx + bw / 2, top - bh + 26, 'KOSHER CONNECT')
    c.setFillColor(tint(INK, 0.6)); c.setFont('Mono', 5.4)
    c.drawCentredString(bx + bw / 2, top - bh + 16, 'SALFORD')
    p.label('02  CARRIER BAG', bx, top - bh - 13, tint(INK, 0.6), 6.2, 'MonoB')
    p.para('Monogram alone at 18 mm, centred. On kraft board the gold sinks into the substrate — '
           'plate 09 says what to do about it.', bx, top - bh - 24, bw, 9.6, 'Sans', 7.2, tint(INK, 0.7))

    # receipt + sms
    ry = top - sh - 44
    rw = col(0, 4)[1]; rh2 = 150
    c.setFillColor(CARD); c.rect(ML, ry - rh2, rw, rh2, stroke=0, fill=1)
    c.setStrokeColor(FAINT); c.setLineWidth(0.5); c.rect(ML, ry - rh2, rw, rh2, stroke=1, fill=0)
    m3 = 26
    c.drawImage(MARK, ML + 12, ry - 40, m3, m3 * 280 / 279, mask='auto')
    c.setFillColor(INK); c.setFont('SansB', 8.4); c.drawString(ML + 44, ry - 22, 'Kosher Connect')
    c.setFillColor(tint(INK, 0.55)); c.setFont('Sans', 6.6)
    c.drawString(ML + 44, ry - 31, '421 Bury New Road, Salford M7 4ED')
    p.hair(ML + 12, ry - 50, rw - 24, tint(INK, 0.14))
    lines = [('Nokia 105 rental — 2 weeks', '£20.00'), ('Charger', '£6.00'),
             ('Deposit held', '£20.00'), ('', ''), ('Paid — card', '£46.00')]
    yy = ry - 64
    for a, b in lines:
        if a:
            c.setFillColor(tint(INK, 0.8)); c.setFont('Sans', 7.2); c.drawString(ML + 12, yy, a)
            c.setFillColor(INK); c.setFont('SansB', 7.2); c.drawRightString(ML + rw - 12, yy, b)
        yy -= 12
    p.hair(ML + 12, yy + 4, rw - 24, tint(INK, 0.14))
    c.setFillColor(tint(INK, 0.5)); c.setFont('Sans', 6.4)
    c.drawString(ML + 12, yy - 8, 'Thank you — any problem, just bring it back.')
    p.label('03  RECEIPT', ML, ry - rh2 - 13, tint(INK, 0.6), 6.2, 'MonoB')
    p.para('Monogram, never the full lockup: a till roll is 80 mm wide and the words would land '
           'under their 34 mm minimum.', ML, ry - rh2 - 24, rw, 9.6, 'Sans', 7.2, tint(INK, 0.7))

    sx, sw2 = col(4, 4)
    c.setFillColor(CARD); c.rect(sx, ry - rh2, sw2, rh2, stroke=0, fill=1)
    c.setStrokeColor(FAINT); c.setLineWidth(0.5); c.rect(sx, ry - rh2, sw2, rh2, stroke=1, fill=0)
    c.setFillColor(HexColor('#eef4fa')); c.rect(sx + 10, ry - 78, sw2 - 20, 60, stroke=0, fill=1)
    p.para('Hello Moshe — your phone is ready to collect from the shop. Kosher Connect, 421 Bury New '
           'Road. Any time before 6.30.', sx + 18, ry - 30, sw2 - 36, 10, 'Sans', 7.4, tint(INK, 0.85))
    p.label('NO LOGO. NO LINK. NO EMOJI.', sx + 10, ry - 96, GOLD_INK, 6.2, 'MonoB')
    p.para('A text message is the one place the brand is only its words. A logo cannot render, a '
           'shortened link looks like fraud, and the message has to survive being read aloud to '
           'somebody in a queue.', sx + 10, ry - 108, sw2 - 20, 9.8, 'Sans', 7.2, tint(INK, 0.72))
    p.label('04  SMS', sx, ry - rh2 - 13, tint(INK, 0.6), 6.2, 'MonoB')

    ax, aw = col(8, 4)
    c.setFillColor(HexColor('#1d3956')); c.rect(ax, ry - rh2, 44, rh2, stroke=0, fill=1)
    c.setFillColor(PAPER); c.rect(ax + 44, ry - rh2, aw - 44, rh2, stroke=0, fill=1)
    c.setStrokeColor(FAINT); c.setLineWidth(0.5); c.rect(ax, ry - rh2, aw, rh2, stroke=1, fill=0)
    c.drawImage(MARK, ax + 12, ry - 32, 20, 20 * 280 / 279, mask='auto')
    for i in range(7):
        c.setFillColor(tint(HexColor('#ffffff'), 0.30 if i == 1 else 0.13))
        c.rect(ax + 10, ry - 58 - i * 13, 24, 5, stroke=0, fill=1)
    c.setFillColor(CARD); c.rect(ax + 54, ry - 60, aw - 66, 44, stroke=0, fill=1)
    c.setFillColor(INK); c.setFont('Plate', 15); c.drawString(ax + 62, ry - 34, '£65.00')
    c.setFillColor(tint(INK, 0.5)); c.setFont('Sans', 6.2); c.drawString(ax + 62, ry - 44, 'money in today')
    c.setFillColor(HexColor('#0060a8')); c.rect(ax + 54, ry - 92, 62, 16, stroke=0, fill=1)
    c.setFillColor(HexColor('#ffffff')); c.setFont('Sans', 6.6); c.drawString(ax + 62, ry - 87, 'New rental')
    p.label('05  THE APP', ax, ry - rh2 - 13, tint(INK, 0.6), 6.2, 'MonoB')
    p.para('Navy rail, warm canvas, and one blue thing on the screen to press.',
           ax, ry - rh2 - 24, aw, 9.6, 'Sans', 7.2, tint(INK, 0.7))

    # ── row three: card, window, email ──────────────────────────────────
    r3 = ry - rh2 - 56
    h3 = 112
    cw3 = col(0, 4)[1]
    c.setFillColor(CARD); c.rect(ML, r3 - h3, cw3, h3, stroke=0, fill=1)
    c.setStrokeColor(FAINT); c.setLineWidth(0.5); c.rect(ML, r3 - h3, cw3, h3, stroke=1, fill=0)
    lk3 = cw3 * 0.56
    c.drawImage(LOCKUP, ML + 16, r3 - 40, lk3, lk3 * 184 / 813, mask='auto')
    c.setStrokeColor(tint(GOLD, 0.8)); c.setLineWidth(1); c.line(ML + 16, r3 - 50, ML + 16 + lk3, r3 - 50)
    c.setFillColor(INK); c.setFont('SansB', 8); c.drawString(ML + 16, r3 - 66, 'Eliezer Rothbart')
    c.setFillColor(tint(INK, 0.6)); c.setFont('Sans', 6.8)
    c.drawString(ML + 16, r3 - 76, '0161 531 1386')
    c.drawString(ML + 16, r3 - 85, '421 Bury New Road, Salford M7 4ED')
    p.label('06  BUSINESS CARD', ML, r3 - h3 - 13, tint(INK, 0.6), 6.2, 'MonoB')
    p.para('85 × 55 mm. Lockup, gold rule, name, number, address — nothing else fits.',
           ML, r3 - h3 - 24, cw3, 9.6, 'Sans', 7.2, tint(INK, 0.7))

    wx, ww = col(4, 4)
    c.setFillColor(HexColor('#e8eef4')); c.rect(wx, r3 - h3, ww, h3, stroke=0, fill=1)
    c.setStrokeColor(FAINT); c.setLineWidth(0.5); c.rect(wx, r3 - h3, ww, h3, stroke=1, fill=0)
    for i in range(4):
        c.setStrokeColor(tint(INK, 0.06)); c.setLineWidth(0.6)
        c.line(wx, r3 - 18 - i * 26, wx + ww, r3 - 18 - i * 26)
    m4 = 40
    c.drawImage(MARK, wx + ww / 2 - m4 / 2, r3 - h3 / 2 - m4 / 2, m4, m4 * 280 / 279, mask='auto')
    p.label('07  WINDOW VINYL', wx, r3 - h3 - 13, tint(INK, 0.6), 6.2, 'MonoB')
    p.para('Monogram only, cut vinyl, no background panel. The gap in the arc is what makes this '
           'read from across the road — do not let a fitter fill it.',
           wx, r3 - h3 - 24, ww, 9.6, 'Sans', 7.2, tint(INK, 0.7))

    ex, ew = col(8, 4)
    c.setFillColor(CARD); c.rect(ex, r3 - h3, ew, h3, stroke=0, fill=1)
    c.setStrokeColor(FAINT); c.setLineWidth(0.5); c.rect(ex, r3 - h3, ew, h3, stroke=1, fill=0)
    p.para('Thanks — that is all booked in for the 8th. Any change, just ring.',
           ex + 12, r3 - 22, ew - 24, 10, 'Sans', 7.4, tint(INK, 0.85))
    p.hair(ex + 12, r3 - 52, ew - 24, tint(INK, 0.14))
    c.drawImage(MARK, ex + 12, r3 - 82, 22, 22 * 280 / 279, mask='auto')
    c.setFillColor(INK); c.setFont('SansB', 7.4); c.drawString(ex + 40, r3 - 64, 'Kosher Connect')
    c.setFillColor(tint(INK, 0.55)); c.setFont('Sans', 6.4)
    c.drawString(ex + 40, r3 - 73, '0161 531 1386  ·  kosher-connect.com')
    c.drawString(ex + 40, r3 - 82, '421 Bury New Road, Salford M7 4ED')
    p.label('08  EMAIL SIGN-OFF', ex, r3 - h3 - 13, tint(INK, 0.6), 6.2, 'MonoB')
    p.para('Monogram at 22 px, a hairline above it, three lines of fact. No banner, no strapline, '
           'no social icons the shop does not have.', ex, r3 - h3 - 24, ew, 9.6, 'Sans', 7.2, tint(INK, 0.7))

    # the rule
    fy = MB + 86
    p.hair(ML, fy + 22, CW)
    p.label('THE RULE THAT COVERS THE ONES NOT DRAWN HERE', ML, fy + 28, tint(INK, 0.55), 6.6, 'MonoB')
    two_col(p, c, fy, [
        ('BIG ENOUGH FOR WORDS?', 'Use the full lockup. Below 34 mm across, use the monogram alone — '
                                  'a lockup whose words have silted up is worse than no lockup.'),
        ('DARK GROUND?', 'Use logo-full-tight-dark.png. Never place the light lockup on navy and hope: '
                         'its blue measures 2.1:1 there and the k vanishes.'),
        ('SOMEBODY ELSE’S SURFACE?', 'A supplier’s form, a shared window, a community notice — the '
                                     'monogram, clear space kept, and nothing else of ours on it.'),
        ('NO GROUND AT ALL?', 'Text only, set in the house voice. Plate 07 is the brand when there is '
                              'no room for a mark, which is most of the time.'),
    ], gap=3)
    p.foot('PLATE 08  ·  IN THE WORLD  ·  MOCK-UPS ARE INDICATIVE, NOT ARTWORK')
    c.showPage()
