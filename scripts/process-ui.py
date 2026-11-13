"""Chroma-key UI art from art-drafts/<round>/ into public/ui/*.webp (with alpha).
Frames: also measures the transparent window and writes public/ui/ui.json.
Usage: python3 scripts/process-ui.py <round> id1 id2 ..."""
import json, os, sys
from PIL import Image

rnd, ids = sys.argv[1], sys.argv[2:]
os.makedirs("public/ui", exist_ok=True)
meta_path = "public/ui/ui.json"
meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {}

def key(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            gd = g - max(r, b)               # green dominance
            if gd > 90:                       # solid key
                px[x, y] = (0, 0, 0, 0)
            elif gd > 25:                     # soft edge: partial alpha + despill
                alpha = int(255 * (1 - (gd - 25) / 65))
                px[x, y] = (r, max(r, b), b, min(a, alpha))
            elif gd > 0:                      # despill only
                px[x, y] = (r, max(r, b) + gd // 3, b, a)
    return im

for i in ids:
    im = key(Image.open(f"art-drafts/{rnd}/{i}.png"))
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
