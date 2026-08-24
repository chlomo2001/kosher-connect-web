# Assets the plates draw from, cut once from what is already in the repo.
import io, os
from PIL import Image
from fontTools.ttLib import woff2, TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
OUT = os.path.join(HERE, 'assets')
os.makedirs(OUT, exist_ok=True)

def trim(src, dst):
    im = Image.open(os.path.join(ROOT, src)).convert('RGBA')
    im.crop(im.getchannel('A').getbbox()).save(os.path.join(OUT, dst))
    print(' ', dst, Image.open(os.path.join(OUT, dst)).size)

trim('public/logo.png', 'mark.png')
trim('public/logo-full-tight.png', 'lockup.png')

# The one-colour versions. Navy at every opaque pixel, alpha untouched, so the
# mark keeps its edges — plate 09 shows this on a stock that cannot hold gold.
for src, dst in [('mark.png', 'mark-mono.png'), ('lockup.png', 'lockup-mono.png')]:
    im = Image.open(os.path.join(OUT, src)).convert('RGBA'); px = im.load()
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            r, g, b, a = px[x, y]
            if a > 0: px[x, y] = (10, 37, 64, a)
    im.save(os.path.join(OUT, dst)); print(' ', dst)

# The Hebrew, from the product's own font directory. reportlab cannot read
# woff2, so it is decompressed here rather than substituted for.
for src, dst in [('public/fonts/david-libre-400-hebrew.woff2', 'David400.ttf'),
                 ('public/fonts/david-libre-700-hebrew.woff2', 'David700.ttf')]:
    buf = io.BytesIO(); woff2.decompress(os.path.join(ROOT, src), buf); buf.seek(0)
    f = TTFont(buf); f.flavor = None; f.save(os.path.join(OUT, dst))
    print(' ', dst, len(TTFont(os.path.join(OUT, dst)).getBestCmap()), 'glyphs')
