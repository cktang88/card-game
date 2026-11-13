"""Chroma-key UI art from art-drafts/<round>/ into public/ui/*.webp (with alpha).
Frames: also measures the transparent window and writes public/ui/ui.json.
Usage: python3 scripts/process-ui.py <round> id1 id2 ..."""
import json, os, sys
from PIL import Image

rnd, ids = sys.argv[1], sys.argv[2:]
os.makedirs("public/ui", exist_ok=True)
meta_path = "public/ui/ui.json"
meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {}

def key(im: Image.Image, seeds) -> Image.Image:
    """Flood-fill the chroma green from the seed points only, so green that is part of the
    design (e.g. glowing seams) is kept. Soft edge + despill on the region's border."""
    from collections import deque
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    gd = lambda x, y: (lambda r, g, b, a: g - max(r, b))(*px[x, y])
    seen = bytearray(w * h)
    q = deque()
    for sx, sy in seeds:
        if gd(sx, sy) > 90: q.append((sx, sy)); seen[sy * w + sx] = 1
    while q:
        x, y = q.popleft()
        r, g, b, a = px[x, y]
        d = g - max(r, b)
        if d > 90:
            px[x, y] = (0, 0, 0, 0)
        else:  # border pixel: partial alpha + despill, don't spread further
            alpha = max(0, min(255, int(255 * (1 - (d - 25) / 65)))) if d > 25 else 255
            px[x, y] = (r, max(r, b), b, min(a, alpha))
            continue
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                seen[ny * w + nx] = 1
                if gd(nx, ny) > 0: q.append((nx, ny))
    return im

for i in ids:
    src = Image.open(f"art-drafts/{rnd}/{i}.png")
    W, H = src.size
    seeds = [(W // 2, H // 2)] if i.startswith("frame_") else [(0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1), (W // 2, 0), (W // 2, H - 1)]
    im = key(src, seeds)
    if i.startswith("frame_"):
        w, h = im.size
        a = im.getchannel("A")
        # window = bounding box of transparent pixels (inverted alpha) inside the frame
        inv = a.point(lambda v: 255 if v < 20 else 0)
        x0, y0, x1, y1 = inv.getbbox()
        meta[i] = {"window": [round(100 * x0 / w, 2), round(100 * y0 / h, 2), round(100 * (w - x1) / w, 2), round(100 * (h - y1) / h, 2)]}
        im = im.resize((600, 900), Image.LANCZOS)
    else:
        im = im.crop(im.getchannel("A").getbbox())
        im.thumbnail((256, 256), Image.LANCZOS)
        meta[i] = {"aspect": round(im.size[0] / im.size[1], 3)}
    im.save(f"public/ui/{i}.webp", "WEBP", quality=88, method=6)
    print("ok", i, meta[i])
json.dump(meta, open(meta_path, "w"), indent=1)
