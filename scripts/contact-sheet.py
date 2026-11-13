"""Contact sheet for art review: python3 scripts/contact-sheet.py <round> <out.png> [ids...]"""
import sys, os
from PIL import Image, ImageDraw
rnd, out, ids = sys.argv[1], sys.argv[2], sys.argv[3:]
if not ids: ids = sorted(f[:-4] for f in os.listdir(f"art-drafts/{rnd}") if f.endswith(".png"))
W, H, cols = 300, 450, 3
rows = (len(ids) + cols - 1) // cols
sheet = Image.new("RGB", (W * cols, (H + 22) * rows), "#111")
d = ImageDraw.Draw(sheet)
for i, id in enumerate(ids):
    im = Image.open(f"art-drafts/{rnd}/{id}.png").convert("RGB").resize((W, H))
    x, y = (i % cols) * W, (i // cols) * (H + 22)
    sheet.paste(im, (x, y + 22)); d.text((x + 6, y + 5), id, fill="#eee")
sheet.save(out)
