"""Regenerate assets/og.png (1200x630) for the Genkai brand.

Run from the repo root:  python scripts/make-og.py
Fonts are read from the Windows font folder; adjust FONT_DIR elsewhere.
Colours match assets/styles.css. Shu vermilion is used only as the limit line.
"""
from PIL import Image, ImageDraw, ImageFont
import os, sys

W, H = 1200, 630
BG, INK, MUTED, AMBER, SHU = "#12161C", "#F3F5F7", "#8D97A5", "#F2A33C", "#E2472B"
B1, B2, B3 = "#24435F", "#33608A", "#4A82B4"
FONT_DIR = os.environ.get("FONT_DIR", r"C:\Windows\Fonts")

def font(name, size):
    return ImageFont.truetype(os.path.join(FONT_DIR, name), size)

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

# The ceiling: shu limit line with the diamond marker, as on every page.
d.rectangle([0, 0, W, 6], fill=SHU)
d.polygon([(1115, 0), (1133, 18), (1115, 36), (1097, 18)], fill=SHU)
d.rectangle([0, 0, W, 6], fill=SHU)

# Lower band: the demand curves, then the strapline over them.
import math
def wave(y0, amp, phase, n=60):
    pts = []
    for i in range(n + 1):
        x = W * i / n
        pts.append((x, y0 + amp * math.sin(x / W * math.pi * 1.6 + phase)))
    return pts
top1 = wave(440, 14, 0.4); top2 = wave(414, 18, 1.1)
d.polygon(top1 + [(W, H), (0, H)], fill=B1)
d.polygon(top2 + list(reversed(top1)), fill=B2)
# tone the band down so text stays legible
overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
ImageDraw.Draw(overlay).rectangle([0, 380, W, H], fill=(18, 22, 28, 140))
img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
d = ImageDraw.Draw(img)

# Amber lockup line with diamond.
d.rectangle([84, 104, 690, 110], fill=AMBER)
d.polygon([(704, 88), (724, 108), (704, 128), (684, 108)], fill=AMBER)

def spaced(x, y, text, f, fill, tracking):
    for ch in text:
        d.text((x, y), ch, font=f, fill=fill)
        x += d.textlength(ch, font=f) + tracking
    return x

# Wordmark
spaced(84, 150, "GENKAI", font("segoeuib.ttf", 112), INK, 26)
# 限界 · THE LIMIT
jp = font("YuGothM.ttc", 30)
x = 88
d.text((x, 292), "限界", font=jp, fill=MUTED)
x += d.textlength("限界", font=jp) + 18
d.ellipse([x, 310, x + 7, 317], fill=MUTED)
x += 25
spaced(x, 296, "THE LIMIT", font("segoeuib.ttf", 22), MUTED, 9)
# By line
spaced(88, 342, "BY DGMO CONSULTANCY", font("segoeui.ttf", 22), MUTED, 8)

# Strapline
big = font("segoeuib.ttf", 40)
d.text((84, 470), "Know when you run out —", font=big, fill=INK)
d.text((84, 516), "months before you do.", font=big, fill=INK)
small = font("segoeuib.ttf", 21)
t = "dgmoconsultancy.com"
d.text((W - 84 - d.textlength(t, font=small), 528), t, font=small, fill=MUTED)

out = sys.argv[1] if len(sys.argv) > 1 else "assets/og.png"
img.save(out, optimize=True)
print("wrote", out, os.path.getsize(out), "bytes")
