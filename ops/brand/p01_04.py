import sys, os, math; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *
ASSET = lambda n: os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets', n)
REPO  = lambda n: os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', n)
from reportlab.lib.utils import ImageReader

MARK   = ImageReader(ASSET('mark.png'))
LOCKUP = ImageReader(ASSET('lockup.png'))
LOCK_D = ImageReader(REPO('public/logo-full-tight-dark.png'))

def arc_ring(c, cx, cy, r, gap_deg, start_deg, colr, lw=0.7, alpha=1.0):
    c.saveState(); c.setStrokeColor(tint(colr, alpha)); c.setLineWidth(lw)
    p = c.beginPath(); steps = max(20, int((360 - gap_deg) / 4))
    for i in range(steps + 1):
        a = math.radians(start_deg + (360 - gap_deg) * i / steps)
        x, y = cx + r * math.cos(a), cy + r * math.sin(a)
        p.moveTo(x, y) if i == 0 else p.lineTo(x, y)
    c.drawPath(p, stroke=1, fill=0); c.restoreState()

# ══ PLATE 01 ═════════════════════════════════════════════════════════════
def cover(c):
    c.setFillColor(INK); c.rect(0, 0, W, H, stroke=0, fill=1)

    # A dense band of open circles, the gap advancing one notch per mark. The
    # field is the series; the mark above it is the deviation the series frames.
    x0, y0, step, r = ML, MB + 60, 21.4, 7.6
    n = 0
    for row in range(17):
        for cln in range(24):
            cx, cy = x0 + cln * step, y0 + row * step
            if cx > W - MR: continue
            a = 0.05 + 0.055 * (1 - row / 16.0)
            hot = (n % 23 == 0)
            arc_ring(c, cx, cy, r, 64, -40 + n * 7,
                     GOLD if hot else HexColor('#ffffff'), 0.55,
                     a * (3.4 if hot else 1.0))
            n += 1
    # the band is bounded, so it reads as a plate figure and not as wallpaper
    c.setStrokeColor(tint(HexColor('#ffffff'), 0.16)); c.setLineWidth(0.5)
    c.line(ML, y0 + 16 * step + 16, W - MR, y0 + 16 * step + 16)
    c.line(ML, MB + 40, W - MR, MB + 40)

    # The mark on its own coin — blue on navy will not read, and a brand sheet
    # that cannot show its own mark on its own cover has failed at the first page.
    coin_r = 62; ccx, ccy = ML + coin_r, H - MT - 42 - coin_r
    c.setFillColor(PAPER); c.circle(ccx, ccy, coin_r, stroke=0, fill=1)
    c.setStrokeColor(tint(GOLD, 0.5)); c.setLineWidth(0.7)
    c.circle(ccx, ccy, coin_r + 7, stroke=1, fill=0)
    mw = 78; mh = mw * 280 / 279
    c.drawImage(MARK, ccx - mw / 2, ccy - mh / 2, mw, mh, mask='auto')

    c.setFont('Mono', 6.8); c.setFillColor(tint(HexColor('#ffffff'), 0.5))
    c.drawString(ML, H - MT + 16, 'HATSLUCHE LTD  T/A  KOSHER CONNECT')
    c.drawRightString(W - MR, H - MT + 16, 'PLATE 01  ·  FRONTISPIECE')
    c.setStrokeColor(tint(HexColor('#ffffff'), 0.22)); c.setLineWidth(0.6)
    c.line(ML, H - MT + 8, W - MR, H - MT + 8)

    tx = ccx + coin_r + 34
    c.setFillColor(HexColor('#ffffff')); c.setFont('Plate', 62)
    c.drawString(tx, ccy + 14, 'BRAND')
    c.setFillColor(GOLD); c.drawString(tx, ccy - 34, 'STANDARD')
    c.setFont('Mono', 6.4); c.setFillColor(tint(HexColor('#ffffff'), 0.45))
    c.drawString(tx + 2, ccy + 72, 'ISSUE 01  ·  TWELVE PLATES')

    yy = ccy - coin_r - 40
    c.setStrokeColor(tint(GOLD, 0.55)); c.setLineWidth(0.8)
    c.line(ML, yy, ML + 132, yy)
    c.setFillColor(tint(HexColor('#ffffff'), 0.76)); c.setFont('Sans', 9.4)
    for ln in ['The mark, the colour, the words and the way they are set —',
               'decided here rather than remembered, and every claim in here',
               'checked against the product that has to keep it.']:
        yy -= 15; c.drawString(ML, yy, ln)

    c.setFont('Mono', 6.4); c.setFillColor(tint(HexColor('#ffffff'), 0.42))
    c.drawString(ML, MB + 22, '421 BURY NEW ROAD  ·  SALFORD  M7 4ED  ·  0161 531 1386')
    c.drawRightString(W - MR, MB + 22, '27 AUGUST 2026')
    c.showPage()

# ══ PLATE 02 ═════════════════════════════════════════════════════════════
def mark_page(c):
    p = Plate(c, '02', 'The mark',
              'Two letters closing a circle they never quite close. The gap is the mark — not an '
              'error to be tidied, and nothing may be set inside it.')
    MM = 72 / 25.4
    top = H - MT - 92

    # ── figure: the mark in its cage, and the two lockups ────────────────
    mw = 118; mh = mw * 280 / 279
    mx = ML + 12; my = top - mh
    X = mh / 4
    c.setStrokeColor(tint(BLUE, 0.4)); c.setLineWidth(0.5); c.setDash(2.2, 2.6)
    c.rect(mx - X, my - X, mw + 2 * X, mh + 2 * X, stroke=1, fill=0); c.setDash()
    c.drawImage(MARK, mx, my, mw, mh, mask='auto')
    c.setStrokeColor(BLUE); c.setLineWidth(0.7)
    c.line(mx - X, my - X - 10, mx, my - X - 10)
    c.line(mx - X, my - X - 13, mx - X, my - X - 7)
    c.line(mx, my - X - 13, mx, my - X - 7)
    p.label('X', mx - X / 2 - 2.4, my - X - 21, BLUE, 7, 'MonoB')
    p.label('X = ¼ OF THE MONOGRAM HEIGHT', mx + 10, my - X - 21, tint(INK, 0.5))

    lx = mx + mw + X + 28; lw_ = W - MR - lx; lh = lw_ * 184 / 813
    c.drawImage(LOCKUP, lx, top - lh, lw_, lh, mask='auto')
    p.label('PRIMARY LOCKUP · logo-full-tight.png', lx, top - lh - 13, tint(INK, 0.5))
    bh = lh + 24; box_y = top - lh - 28 - bh
    c.setFillColor(INK); c.rect(lx, box_y, lw_, bh, stroke=0, fill=1)
    c.drawImage(LOCK_D, lx + 14, box_y + 12, lw_ - 28, (lw_ - 28) * 184 / 813, mask='auto')
    p.label('ON NAVY · logo-full-tight-dark.png', lx, box_y - 13, tint(INK, 0.5))

    # ── specs ────────────────────────────────────────────────────────────
    ybase = min(my - X - 42, box_y - 34)
    p.hair(ML, ybase + 15, CW)
    specs = [
        ('THE MONOGRAM', 'logo.png, 326×326. The square mark alone — favicon, app icon, the '
                         'stamp on a bag, anywhere below 40 mm where the words would not read.'),
        ('MINIMUM SIZE', 'Screen: 28 px monogram height. Print: 12 mm monogram height, or 34 mm '
                         'across the full lockup. Below that the gap silts up and the k closes.'),
        ('CLEAR SPACE', 'X on every side. Nothing crosses it — not a fold, not a seam, not a '
                        'strapline, and never a second logo sharing the same margin.'),
        ('THE GAP', 'The open arc survives at every size we use. It is the one part of the mark '
                    'a printer will offer to close up for you. It stays open.'),
    ]
    low = ybase
    for i, (h, body) in enumerate(specs):
        x, w = col(i * 3, 3)
        p.label(h, x, ybase, BLUE, 6.6, 'MonoB')
        low = min(low, p.para(body, x, ybase - 14, w, 10.6, 'Sans', 7.6, tint(INK, 0.78)))

    # ── the size ladder, standing on the bottom margin ───────────────────
    lad_y = MB + 30
    ladder = [(12 * MM, '12 mm', 'PRINT MINIMUM'), (18 * MM, '18 mm', 'ON A CARRIER BAG'),
              (28 * 0.75, '28 px', 'SCREEN MINIMUM')]
    lx2 = ML
    for h_, mm, note in ladder:
        c.drawImage(MARK, lx2, lad_y + 8, h_, h_ * 280 / 279, mask='auto')
        c.setFillColor(tint(INK, 0.75)); c.setFont('MonoB', 6.4); c.drawString(lx2, lad_y, mm)
        c.setFillColor(tint(INK, 0.42)); c.setFont('Mono', 5.6); c.drawString(lx2, lad_y - 8.5, note)
        lx2 += max(h_, 66) + 34
    lkw = 34 * MM
    c.drawImage(LOCKUP, W - MR - lkw, lad_y + 16, lkw, lkw * 184 / 813, mask='auto')
    c.setFillColor(tint(INK, 0.75)); c.setFont('MonoB', 6.4); c.drawRightString(W - MR, lad_y, '34 mm')
    c.setFillColor(tint(INK, 0.42)); c.setFont('Mono', 5.6)
    c.drawRightString(W - MR, lad_y - 8.5, 'LOCKUP MINIMUM')
    lad_top = lad_y + 8 + (12 * MM) * 280 / 279 + 24
    p.hair(ML, lad_top, CW)
    p.label('AT SIZE  ·  THIS PAGE IS 1:1 ON A4, SO THE RULE CAN BE MEASURED',
            ML, lad_top + 6, tint(INK, 0.55), 6.6, 'MonoB')

    # ── the misuse row, filling between specs and ladder ─────────────────
    cellw = (CW - 5 * 12) / 6; cellh = 76
    mrow_y = (low - 26 + lad_top + 22) / 2 - cellh / 2
    dont = ['Recolour it', 'Stretch it', 'Close the gap', 'Add a glow', 'Box it in', 'Tilt it']
    for i in range(6):
        bx, by = ML + i * (cellw + 12), mrow_y
        c.setFillColor(CARD); c.rect(bx, by, cellw, cellh, stroke=0, fill=1)
        c.setStrokeColor(FAINT); c.setLineWidth(0.5); c.rect(bx, by, cellw, cellh, stroke=1, fill=0)
        s_ = 36; cx, cy = bx + cellw / 2, by + cellh / 2 + 7
        c.saveState()
        if i == 0:
            c.setFillColor(HexColor('#7d1f1f')); c.rect(cx - s_/2, cy - s_/2, s_, s_, stroke=0, fill=1)
            c.drawImage(MARK, cx - s_/2, cy - s_/2, s_, s_, mask='auto')
        elif i == 1:
            c.drawImage(MARK, cx - s_*0.74, cy - s_/2, s_*1.48, s_, mask='auto')
        elif i == 2:
            c.drawImage(MARK, cx - s_/2, cy - s_/2, s_, s_, mask='auto')
            c.setStrokeColor(BLUE); c.setLineWidth(2.8)
            c.arc(cx - s_/2, cy - s_/2, cx + s_/2, cy + s_/2, 298, 74)
        elif i == 3:
            for k in range(7):
                c.setFillColor(tint(BLUE, 0.045)); c.circle(cx, cy, s_ * (0.6 + k * 0.045), stroke=0, fill=1)
            c.drawImage(MARK, cx - s_/2, cy - s_/2, s_, s_, mask='auto')
        elif i == 4:
            c.setStrokeColor(INK); c.setLineWidth(1.7)
            c.rect(cx - s_*0.58, cy - s_*0.58, s_*1.16, s_*1.16, stroke=1, fill=0)
            c.drawImage(MARK, cx - s_/2, cy - s_/2, s_, s_, mask='auto')
        else:
            c.translate(cx, cy); c.rotate(-14)
            c.drawImage(MARK, -s_/2, -s_/2, s_, s_, mask='auto')
        c.restoreState()
        c.setStrokeColor(HexColor('#b3123a')); c.setLineWidth(1.1)
        c.line(bx + cellw - 15, by + 9, bx + cellw - 7, by + 17)
        c.line(bx + cellw - 15, by + 17, bx + cellw - 7, by + 9)
        c.setFillColor(tint(INK, 0.72)); c.setFont('Sans', 6.8)
        c.drawString(bx + 7, by + 10, dont[i])
    p.hair(ML, mrow_y + cellh + 15, CW)
    p.label('NEVER', ML, mrow_y + cellh + 21, tint(INK, 0.55), 6.6, 'MonoB')

    p.foot('PLATE 02  ·  THE MARK  ·  ASSETS IN /public  ·  DO NOT REDRAW')
    c.showPage()
