# Draws the vehicle marker of the Live map (assets/map/puv.png, @2x, @3x): a multicab seen from
# above, front at the top, so MapLibre can rotate it to the heading. A dark body with a white
# outline reads on every route colour and on both map themes. Run: python scripts/make-puv-icon.py
from PIL import Image, ImageDraw

BASE = 32           # canvas, dp
SUPER = 8           # drawn larger, then scaled down, for smooth edges
OUTLINE = (255, 255, 255, 255)
BODY = (27, 42, 74, 255)
ROOF = (46, 67, 114, 255)
GLASS = (207, 227, 255, 255)
SHADOW = (0, 0, 0, 70)


def draw(scale: int) -> Image.Image:
    s = scale * SUPER
    size = BASE * s
    image = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(image)
    cx = size / 2
    w, h = 15 * s, 27 * s            # body, front at the top
    top, left = (size - h) / 2, cx - w / 2
    r = 4 * s
    # soft shadow, then the white outline, then the body
    d.rounded_rectangle([left - 1.5 * s, top + 0.5 * s, left + w + 1.5 * s, top + h + 2.5 * s], r + 2 * s, fill=SHADOW)
    d.rounded_rectangle([left - 2 * s, top - 2 * s, left + w + 2 * s, top + h + 2 * s], r + 2 * s, fill=OUTLINE)
    d.rounded_rectangle([left, top, left + w, top + h], r, fill=BODY)
    # windshield at the front, a roof panel, a rear window
    d.rounded_rectangle([left + 2 * s, top + 3 * s, left + w - 2 * s, top + 8 * s], 2 * s, fill=GLASS)
    d.rounded_rectangle([left + 3 * s, top + 10 * s, left + w - 3 * s, top + h - 6 * s], 2 * s, fill=ROOF)
    d.rounded_rectangle([left + 3 * s, top + h - 4.5 * s, left + w - 3 * s, top + h - 2 * s], 1 * s, fill=GLASS)
    # a small arrow ahead of the windshield: the way it is going
    tip = top - 0.5 * s
    d.polygon([(cx, tip - 0.0), (cx - 3.5 * s, tip + 3 * s), (cx + 3.5 * s, tip + 3 * s)], fill=GLASS)
    return image.resize((BASE * scale, BASE * scale), Image.LANCZOS)


for scale, suffix in ((1, ''), (2, '@2x'), (3, '@3x')):
    draw(scale).save(f'assets/map/puv{suffix}.png')
