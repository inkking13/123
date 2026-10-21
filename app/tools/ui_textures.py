# Paints the menu textures in assets/ui: the parchment sheet and the leather
# background. Run: python3 tools/ui_textures.py assets/ui
import random, sys
from PIL import Image, ImageChops, ImageFilter, ImageOps, ImageDraw
random.seed(7)
out = sys.argv[1]

def octave(w, h, cell, sigma=60):
    n = Image.effect_noise((max(2, w // cell), max(2, h // cell)), sigma)
    return n.resize((w, h), Image.BICUBIC)

def fbm(w, h, cells, weights):
    acc = Image.new('L', (w, h), 128)
    for c, wt in zip(cells, weights):
        acc = Image.blend(acc, octave(w, h, c), wt)
    return ImageOps.autocontrast(acc, cutoff=1)

def vignette(w, h, edge, blur):
    # White inside, black over an edge band `edge` (fraction of the short side) wide, with a ragged rim.
    e = int(min(w, h) * edge)
    m = Image.new('L', (w, h), 0)
    ImageDraw.Draw(m).rectangle([e, e, w - e, h - e], fill=255)
    rag = octave(w, h, max(4, e // 2), 90)
    m = m.filter(ImageFilter.GaussianBlur(e * blur))
    ragged = ImageChops.multiply(m, rag.filter(ImageFilter.GaussianBlur(2)).point(lambda v: min(255, 150 + v)))
    # Only the rim is ragged; the middle of the sheet stays clean.
    inner = m.point(lambda v: 255 if v >= 240 else int(v * v / 240 / 1.0) if v > 120 else 0)
    return Image.composite(m, ragged, inner)

def radial(w, h, inner, outer):
    m = Image.radial_gradient('L').resize((w, h), Image.BICUBIC)  # 0 at centre, 255 at r=1
    return m.point(lambda v: 255 if v < inner else 0 if v > outer else int(255 * (outer - v) / (outer - inner)))

# Parchment: cream paper with mottling, fibres and browned, burnt edges.
W, H = 512, 512
blot = fbm(W, H, [170, 70], [0.6, 0.3]).filter(ImageFilter.GaussianBlur(6)).point(lambda v: 90 + v * 0.55)
fibre = Image.effect_noise((W, H // 6), 40).resize((W, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(0.6))
grain = Image.effect_noise((W, H), 30)
g = Image.blend(blot, fibre, 0.25)
g = Image.blend(g, grain, 0.12)
paper = ImageOps.colorize(ImageOps.autocontrast(g, cutoff=2), black='#c2a877', white='#ecdfbe', mid='#dccaa1')
edge = vignette(W, H, 0.035, 0.6)
burnt = ImageOps.colorize(fbm(W, H, [64, 20], [0.6, 0.3]), black='#5a3a1c', white='#8f6a3f')
paper = Image.composite(paper, burnt, edge)
paper.save(f'{out}/parchment.jpg', quality=82)

# Background: dark worn leather under the menus, warmer and darker than the old stone wall.
W, H = 720, 1560
blot = fbm(W, H, [120, 40, 12], [0.5, 0.35, 0.25])
crease = Image.effect_noise((W // 3, H // 3), 50).resize((W, H), Image.BICUBIC).filter(ImageFilter.FIND_EDGES).filter(ImageFilter.GaussianBlur(1.2))
pores = Image.effect_noise((W, H), 40).filter(ImageFilter.GaussianBlur(0.7))
g = Image.blend(blot, pores, 0.2)
g = ImageChops.subtract(g, crease.point(lambda v: v // 3))
leather = ImageOps.colorize(g, black='#0c0806', white='#33251a', mid='#1e150e')
v = radial(W, H, 150, 330)
leather = Image.composite(leather, Image.new('RGB', (W, H), '#070504'), v)
leather.save(f'{out}/leather-bg.jpg', quality=78)
