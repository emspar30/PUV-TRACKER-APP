"""Draws the VS1 status marks for multicab markers (assets/map/status-*.png at 1x, 2x and 3x).

Each status has its own shape as well as its own colour, so it never relies on colour alone:
  stopped  red octagon with a white bar (a stop sign)
  loading  blue circle with a white person
  traffic  amber triangle with a dark exclamation mark
Every mark has a white edge so it reads on the light and the dark map.
Run: python scripts/make-status-icons.py
"""
import math
from pathlib import Path

from PIL import Image, ImageDraw

SIZE_DP = 16
SCALES = {'': 1, '@2x': 2, '@3x': 3}
# Drawn this many times larger, then shrunk, for smooth edges
SUPERSAMPLE = 8
WHITE = (255, 255, 255, 255)
RED = (211, 47, 47, 255)
BLUE = (25, 103, 210, 255)
AMBER = (245, 166, 35, 255)
DARK = (33, 33, 33, 255)
OUT = Path(__file__).resolve().parent.parent / 'assets' / 'map'


def polygon(n, cx, cy, r, rotation):
    return [(cx + r * math.cos(rotation + 2 * math.pi * i / n), cy + r * math.sin(rotation + 2 * math.pi * i / n)) for i in range(n)]


def stopped(d, s):
    c = s / 2
    d.polygon(polygon(8, c, c, s * 0.5, math.pi / 8), fill=WHITE)
    d.polygon(polygon(8, c, c, s * 0.40, math.pi / 8), fill=RED)
    d.rectangle([s * 0.26, s * 0.43, s * 0.74, s * 0.57], fill=WHITE)


def loading(d, s):
    d.ellipse([0, 0, s, s], fill=WHITE)
    d.ellipse([s * 0.1, s * 0.1, s * 0.9, s * 0.9], fill=BLUE)
    d.ellipse([s * 0.40, s * 0.22, s * 0.60, s * 0.42], fill=WHITE)
    d.pieslice([s * 0.28, s * 0.46, s * 0.72, s * 0.90], 180, 360, fill=WHITE)


def traffic(d, s):
    d.polygon([(s / 2, 0), (s, s * 0.92), (0, s * 0.92)], fill=WHITE)
    d.polygon([(s / 2, s * 0.16), (s * 0.86, s * 0.82), (s * 0.14, s * 0.82)], fill=AMBER)
    d.rectangle([s * 0.45, s * 0.36, s * 0.55, s * 0.62], fill=DARK)
    d.rectangle([s * 0.45, s * 0.67, s * 0.55, s * 0.76], fill=DARK)


for name, draw in {'stopped': stopped, 'loading': loading, 'traffic': traffic}.items():
    for suffix, scale in SCALES.items():
        px = SIZE_DP * scale
        big = Image.new('RGBA', (px * SUPERSAMPLE, px * SUPERSAMPLE), (0, 0, 0, 0))
        draw(ImageDraw.Draw(big), px * SUPERSAMPLE)
        big.resize((px, px), Image.LANCZOS).save(OUT / f'status-{name}{suffix}.png')
print('wrote', len(SCALES) * 3, 'files to', OUT)
