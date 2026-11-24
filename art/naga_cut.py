# ตัดพื้นหลังบานเย็นออกจากภาพพญานาค ครอบ ย่อ แล้วบันทึกเป็น art/cut/naga.png
import sys, numpy as np
from PIL import Image, ImageFilter
src, dst = sys.argv[1], sys.argv[2]
a = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
mag = np.minimum(r, b) - g
alpha = np.clip((95 - mag) / 55, 0, 1)
lim = g + 40
edge = (alpha < 0.999) & (mag > 20)
img = Image.fromarray(np.dstack([np.where(edge, np.minimum(r, lim), r), g, np.where(edge, np.minimum(b, lim), b), alpha * 255]).astype(np.uint8), 'RGBA')
al = img.getchannel('A').filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
img.putalpha(al)
img = img.crop(al.point(lambda v: 255 if v > 24 else 0).getbbox())
W = 1500
img = img.resize((W, round(img.height * W / img.width)), Image.LANCZOS)
img.save(dst, optimize=True)
bg = Image.new('RGB', (W + 40, img.height + 40), (14, 18, 60)); bg.paste(img, (20, 20), img)
bg.save(dst.replace('.png', '-check.jpg'), quality=88)
print(img.size)
