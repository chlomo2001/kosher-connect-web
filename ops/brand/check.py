# Text that collides with other text, or runs off the plate — found by reading
# the PDF back. Twelve plates is too many to eyeball reliably, and every
# collision on this document has been the same shape: a fixed-position label
# meeting a paragraph that grew.
import sys, os, pypdfium2 as pdfium
HERE = os.path.dirname(os.path.abspath(__file__))
MARGIN = 8
pdf = pdfium.PdfDocument(os.path.join(HERE, '..', '..', 'docs', 'brand', 'KOSHER-CONNECT-BRAND-STANDARD.pdf'))
total = 0
for pi in range(len(pdf)):
    page = pdf[pi]; tp = page.get_textpage()
    PW, PH = page.get_width(), page.get_height()
    chars = []
    for i in range(tp.count_chars()):
        ch = tp.get_text_range(i, 1)
        if not ch.strip(): continue
        try: box = tp.get_charbox(i, loose=False)
        except Exception: continue
        if box: chars.append((box, ch))
    # stitch characters into runs: same baseline, no big horizontal jump
    runs = []
    cur = None
    for (l, b, r, t), ch in chars:
        if cur and abs(b - cur['b']) < 1.2 and l - cur['r'] < 6:
            cur['r'] = max(cur['r'], r); cur['t'] = max(cur['t'], t); cur['s'] += ch
        else:
            if cur: runs.append(cur)
            cur = {'l': l, 'r': r, 'b': b, 't': t, 's': ch}
    if cur: runs.append(cur)

    probs = []
    for run in runs:
        if run['r'] > PW - MARGIN or run['l'] < MARGIN:
            probs.append(('OFF PLATE', run['s'][:40]))
    for i, a in enumerate(runs):
        for b_ in runs[i+1:]:
            if b_['b'] > a['t'] + 2: break
            ox = min(a['r'], b_['r']) - max(a['l'], b_['l'])
            oy = min(a['t'], b_['t']) - max(a['b'], b_['b'])
            if ox > 1.5 and oy > 3.5:
                probs.append(('OVERLAP', a['s'][:26] + ' ✕ ' + b_['s'][:26]))
    uniq = []
    for p in probs:
        if p not in uniq: uniq.append(p)
    if uniq:
        print(f'  plate {pi+1:02d}: {len(uniq)}')
        for p in uniq[:6]: print('        ', p[0], '·', p[1])
        total += len(uniq)
print('clean — no text overlaps and nothing off the plate' if not total else f'{total} problems')
sys.exit(1 if total else 0)
