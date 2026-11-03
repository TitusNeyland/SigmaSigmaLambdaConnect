"""Draws the app icon, Android adaptive icon layers, splash mark, favicon and Play feature
graphic (#53).

The ΣΣΛ monogram in old gold on ink, matching src/ui/Monogram. No crest or other official
marks (see #52). Run: python3 scripts/make-icons.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

INK = (17, 17, 17)
GOLD = (197, 162, 83)
WHITE = (255, 255, 255)
FONT = '/usr/share/fonts/opentype/inter/InterDisplay-SemiBold.otf'
OUT = Path(__file__).resolve().parent.parent / 'assets' / 'images'
TEXT = 'ΣΣΛ'


def mark(size: int, width_ratio: float, color, background=None, rule=True) -> Image.Image:
    """The monogram centered on a square canvas, its text `width_ratio` of the canvas wide."""
    scale = 4  # draw big, then downsample for clean edges
    s = size * scale
    font = ImageFont.truetype(FONT, 400)
    spacing = 0.06
    # Draw the letters and rule on their own layer first.
    layer = Image.new('RGBA', (2400, 1000), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    x = 100
    for c in TEXT:
        draw.text((x, 100), c, font=font, fill=color + (255,))
        x += font.getlength(c) + font.size * spacing
    letters = layer.getbbox()
    if rule:
        glyph_h = letters[3] - letters[1]
        y = letters[3] + glyph_h * 0.28
        cx = (letters[0] + letters[2]) / 2
        half = (letters[2] - letters[0]) * 0.18
        draw.rectangle([cx - half, y, cx + half, y + glyph_h * 0.045], fill=color + (255,))
    # Then scale it to the target width and center its actual ink on the canvas.
    mark_img = layer.crop(layer.getbbox())
    w = int(s * width_ratio)
    h = int(mark_img.height * w / mark_img.width)
    mark_img = mark_img.resize((w, h), Image.LANCZOS)
    img = Image.new('RGBA', (s, s), background + (255,) if background else (0, 0, 0, 0))
    img.alpha_composite(mark_img, ((s - w) // 2, (s - h) // 2))
    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    # iOS and the store want an opaque square; the OS rounds the corners.
    mark(1024, 0.62, GOLD, INK).convert('RGB').save(OUT / 'icon.png')
    # Android adaptive: keep the mark inside the 66% safe zone.
    mark(512, 0.5, GOLD).save(OUT / 'android-icon-foreground.png')
    Image.new('RGBA', (512, 512), INK + (255,)).save(OUT / 'android-icon-background.png')
    mark(432, 0.5, WHITE).save(OUT / 'android-icon-monochrome.png')
    # Splash: just the mark on the ink background set in app.json.
    mark(600, 0.9, GOLD).save(OUT / 'splash-icon.png')
    mark(48, 0.78, GOLD, INK, rule=False).save(OUT / 'favicon.png')
    # Google Play feature graphic, 1024x500: the mark centered on ink.
    store = Path(__file__).resolve().parent.parent / 'assets' / 'store'
    store.mkdir(exist_ok=True)
    graphic = Image.new('RGBA', (1024, 500), INK + (255,))
    m = mark(500, 0.62, GOLD)
    graphic.alpha_composite(m, ((1024 - 500) // 2, 0))
    graphic.convert('RGB').save(store / 'play-feature-graphic.png')
    # Play's listing icon is 512x512.
    mark(512, 0.62, GOLD, INK).convert('RGB').save(store / 'play-icon.png')


if __name__ == '__main__':
    main()
