"""Fotos de produto para as capturas da inspeção (desenhadas aqui, nunca baixadas).

Grava três JPEGs de 1600x1200 em scripts/video/out/insp/photos/:
  glass-cup-unpacked.jpg   the glass on a light-gray backdrop
  glass-cup-packed.jpg     the glass next to its color box
  glass-cup-on-scale.jpg   the glass on a digital scale
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, S = 1600, 1200, 2  # final size and supersampling factor
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "out", "insp", "photos")
os.makedirs(OUT, exist_ok=True)


def font(size, bold=False):
    for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ):
        if path and os.path.exists(path):
            return ImageFont.truetype(path, size * S)
    return ImageFont.load_default()


def backdrop():
    """Soft light-gray studio sweep: wall gradient, table and a vignette."""
    img = Image.new("RGB", (W * S, H * S))
    px = ImageDraw.Draw(img)
    horizon = int(H * S * 0.62)
    for y in range(H * S):
        if y < horizon:
            t = y / horizon
            c = (int(240 - 12 * t), int(242 - 12 * t), int(245 - 12 * t))
        else:
            t = (y - horizon) / (H * S - horizon)
            c = (int(222 - 20 * t), int(224 - 20 * t), int(228 - 20 * t))
        px.line([(0, y), (W * S, y)], fill=c)
    # Blur the horizon so the table meets the wall softly.
    img = img.filter(ImageFilter.GaussianBlur(40 * S))
    glow = Image.new("L", (W * S, H * S), 0)
    ImageDraw.Draw(glow).ellipse(
        [int(W * S * 0.18), int(H * S * 0.05), int(W * S * 0.82), int(H * S * 0.85)],
        fill=70,
    )
    glow = glow.filter(ImageFilter.GaussianBlur(160 * S))
    img = Image.composite(Image.new("RGB", img.size, (255, 255, 255)), img, glow)
    return img.convert("RGBA")


def shadow(base, box, strength=90, blur=26):
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse([v * S for v in box], fill=(40, 48, 60, strength))
    return Image.alpha_composite(base, layer.filter(ImageFilter.GaussianBlur(blur * S)))


def glass(base, cx, bottom, height=560, top_w=330, bot_w=250):
    """A clear tumbler: tapered body, rim, thick base and highlights."""
    top = bottom - height
    tl, tr = cx - top_w / 2, cx + top_w / 2
    bl, br = cx - bot_w / 2, cx + bot_w / 2
    rim_h, base_h = 46, 36
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    sc = lambda pts: [(x * S, y * S) for x, y in pts]
    bx = lambda b: [v * S for v in b]
    # Body.
    d.polygon(sc([(tl, top), (tr, top), (br, bottom), (bl, bottom)]), fill=(255, 255, 255, 70))
    d.ellipse(bx([bl, bottom - base_h / 2, br, bottom + base_h / 2]), fill=(255, 255, 255, 70))
    # Thick glass base.
    k = 70
    il = bl + (tl - bl) * k / height
    ir = br + (tr - br) * k / height
    d.polygon(sc([(il, bottom - k), (ir, bottom - k), (br, bottom), (bl, bottom)]), fill=(205, 222, 232, 150))
    d.ellipse(bx([bl, bottom - base_h / 2, br, bottom + base_h / 2]), fill=(196, 214, 226, 170))
    d.ellipse(bx([il, bottom - k - base_h / 2, ir, bottom - k + base_h / 2]), fill=(236, 244, 248, 190))
    # Side shading.
    d.polygon(sc([(tl, top), (tl + 26, top), (bl + 22, bottom), (bl, bottom)]), fill=(150, 172, 188, 110))
    d.polygon(sc([(tr - 26, top), (tr, top), (br, bottom), (br - 22, bottom)]), fill=(150, 172, 188, 110))
    # Highlights.
    d.polygon(sc([(tl + 52, top + 40), (tl + 84, top + 40), (bl + 66, bottom - 110), (bl + 44, bottom - 110)]), fill=(255, 255, 255, 190))
    d.polygon(sc([(tr - 70, top + 60), (tr - 58, top + 60), (br - 50, bottom - 160), (br - 60, bottom - 160)]), fill=(255, 255, 255, 130))
    layer = layer.filter(ImageFilter.GaussianBlur(1.2 * S))
    base = Image.alpha_composite(base, layer)
    # Crisp outlines and the rim on top.
    line = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(line)
    edge = (120, 142, 160, 230)
    d.line(sc([(tl, top), (bl, bottom)]), fill=edge, width=4 * S)
    d.line(sc([(tr, top), (br, bottom)]), fill=edge, width=4 * S)
    d.arc(bx([bl, bottom - base_h / 2, br, bottom + base_h / 2]), 0, 180, fill=edge, width=4 * S)
    d.ellipse(bx([tl, top - rim_h / 2, tr, top + rim_h / 2]), fill=(246, 250, 252, 150), outline=edge, width=4 * S)
    d.ellipse(bx([tl + 12, top - rim_h / 2 + 7, tr - 12, top + rim_h / 2 - 7]), outline=(255, 255, 255, 220), width=3 * S)
    return Image.alpha_composite(base, line.filter(ImageFilter.GaussianBlur(0.6 * S)))


def box(base, left, bottom, w=360, h=470, depth=90):
    """The color box: front panel, side panel, lid and a printed label."""
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    sc = lambda pts: [(x * S, y * S) for x, y in pts]
    top = bottom - h
    d.polygon(sc([(left, top), (left + w, top), (left + w, bottom), (left, bottom)]), fill=(250, 250, 248, 255))
    d.polygon(sc([(left + w, top), (left + w + depth, top - 34), (left + w + depth, bottom - 34), (left + w, bottom)]), fill=(214, 217, 220, 255))
    d.polygon(sc([(left, top), (left + depth, top - 34), (left + w + depth, top - 34), (left + w, top)]), fill=(236, 238, 240, 255))
    # Brand band and the printed glass.
    d.rectangle([left * S, (top + 44) * S, (left + w) * S, (top + 120) * S], fill=(191, 32, 38, 255))
    d.text(((left + 28) * S, (top + 58) * S), "GLASS CUP", font=font(40, True), fill=(255, 255, 255, 255))
    gx, gb = left + w / 2, bottom - 96
    d.polygon(sc([(gx - 70, gb - 190), (gx + 70, gb - 190), (gx + 52, gb), (gx - 52, gb)]), outline=(120, 142, 160, 255), width=4 * S, fill=(232, 240, 245, 255))
    d.ellipse([(gx - 70) * S, (gb - 202) * S, (gx + 70) * S, (gb - 178) * S], outline=(120, 142, 160, 255), width=4 * S, fill=(246, 250, 252, 255))
    d.text(((left + 28) * S, (bottom - 70) * S), "350 ml  ·  GC-350", font=font(30), fill=(70, 78, 90, 255))
    return Image.alpha_composite(base, layer.filter(ImageFilter.GaussianBlur(0.5 * S)))


def scale(base, cx, bottom, w=560):
    """A flat digital scale with a display reading the measured weight."""
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    left, right = cx - w / 2, cx + w / 2
    d.rounded_rectangle([left * S, (bottom - 86) * S, right * S, bottom * S], radius=22 * S, fill=(58, 64, 74, 255))
    d.rounded_rectangle([(left + 18) * S, (bottom - 112) * S, (right - 18) * S, (bottom - 78) * S], radius=14 * S, fill=(196, 201, 208, 255))
    d.rounded_rectangle([(cx - 120) * S, (bottom - 66) * S, (cx + 120) * S, (bottom - 16) * S], radius=8 * S, fill=(205, 226, 196, 255))
    d.text(((cx - 96) * S, (bottom - 62) * S), "0.30 kg", font=font(38, True), fill=(34, 44, 40, 255))
    return Image.alpha_composite(base, layer.filter(ImageFilter.GaussianBlur(0.5 * S)))


def save(img, name):
    path = os.path.join(OUT, name)
    img.convert("RGB").resize((W, H), Image.LANCZOS).save(path, "JPEG", quality=90, optimize=True)
    print(path, os.path.getsize(path), "bytes")


# 1. Unpacked: the glass alone.
img = backdrop()
img = shadow(img, [540, 900, 1090, 990])
img = glass(img, 800, 930)
save(img, "glass-cup-unpacked.jpg")

# 2. Packed: the box, with the glass beside it.
img = backdrop()
img = shadow(img, [420, 905, 1010, 990])
img = box(img, 470, 940)
img = shadow(img, [960, 905, 1330, 975], strength=80)
img = glass(img, 1140, 930, height=430, top_w=250, bot_w=190)
save(img, "glass-cup-packed.jpg")

# 3. On the scale.
img = backdrop()
img = shadow(img, [460, 930, 1140, 1020])
img = scale(img, 800, 980)
img = glass(img, 800, 872, height=500, top_w=296, bot_w=224)
save(img, "glass-cup-on-scale.jpg")
sys.exit(0)
