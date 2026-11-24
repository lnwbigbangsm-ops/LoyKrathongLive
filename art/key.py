# ตัดพื้นหลังสีบานเย็น (#FF00FF) ออกจากภาพกระทง ครอบให้พอดี ย่อ แล้วบันทึกเป็น PNG โปร่งใส
# ใช้:  python key.py <raw_dir> <out_dir>
import sys, os, json
import numpy as np
from PIL import Image, ImageFilter

raw, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
meta = {}
for fn in sorted(os.listdir(raw)):
    if not (fn.startswith('krathong-') and fn.endswith('.png')):
        continue
    im = Image.open(os.path.join(raw, fn)).convert('RGB')
    a = np.asarray(im).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # ความเป็นบานเย็น: แดงและน้ำเงินสูงกว่าเขียวมาก
    mag = np.minimum(r, b) - g
    alpha = np.clip((95 - mag) / 55, 0, 1)            # mag>=95 โปร่งใส, mag<=40 ทึบ
    # ลดสีบานเย็นที่ขอบ (despill): ดึงแดง/น้ำเงินลงมาไม่ให้เกินเขียวมาก
    lim = g + 40
    edge = alpha < 0.999
    r2 = np.where(edge & (mag > 20), np.minimum(r, lim), r)
    b2 = np.where(edge & (mag > 20), np.minimum(b, lim), b)
    rgba = np.dstack([r2, g, b2, alpha * 255]).astype(np.uint8)
    img = Image.fromarray(rgba, 'RGBA')
    al = img.getchannel('A').filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    img.putalpha(al)
    box = al.point(lambda v: 255 if v > 24 else 0).getbbox()
    img = img.crop(box)
    W = 520
    img = img.resize((W, round(img.height * W / img.width)), Image.LANCZOS)
    name = fn[:-4]
    img.save(os.path.join(out, name + '.png'), optimize=True)
    # หาตำแหน่งเปลวเทียน: จุดสว่างเหลืองบนสุดบริเวณกลางภาพ
    p = np.asarray(img).astype(np.float32)
    h, w = p.shape[:2]
    bright = (p[..., 0] > 240) & (p[..., 1] > 215) & (p[..., 2] > 90) & (p[..., 3] > 200)
    bright[:, : int(w * 0.36)] = False
    bright[:, int(w * 0.535):] = False
    ys, xs = np.nonzero(bright[: int(h * 0.35)])
    if len(ys):
        top = ys.min(); sel = ys < top + 26
        fx, fy = float(xs[sel].mean()), float(ys[sel].mean())
    else:
        fx, fy = w / 2, h * 0.12
    # เส้นน้ำ: ส่วนกว้างสุดของฐาน
    widths = (p[..., 3] > 128).sum(axis=1)
    base = int(h * 0.94)
    meta[name] = {'w': w, 'h': h, 'fx': round(fx / w, 4), 'fy': round(fy / h, 4), 'base': round(base / h, 4)}
    print(name, meta[name])
json.dump(meta, open(os.path.join(out, 'meta.json'), 'w'), indent=1)

# แผ่นรวมไว้ตรวจ (พื้นน้ำเงินเข้มเหมือนในเกม)
names = list(meta)
sheet = Image.new('RGB', (540 * len(names), 620), (14, 18, 60))
for i, n in enumerate(names):
    s = Image.open(os.path.join(out, n + '.png'))
    sheet.paste(s, (10 + 540 * i, 610 - s.height), s)
sheet.save(os.path.join(out, 'contact.jpg'), quality=88)
