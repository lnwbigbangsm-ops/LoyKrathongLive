# เตรียมภาพฉากและพระจันทร์:  python scene_cut.py
import os, numpy as np
from PIL import Image
D = os.path.dirname(os.path.abspath(__file__))
sc = Image.open(os.path.join(D, 'scene', 'scene.png')).convert('RGB')
sc.save(os.path.join(D, 'cut', 'scene.jpg'), quality=90)
print('scene', sc.size)
m = Image.open(os.path.join(D, 'moon', 'moon.png')).convert('RGB')
a = np.asarray(m).astype(np.float32); lum = a.max(axis=2)
ys, xs = np.nonzero(lum > 60)
x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
cx, cy, r = (x0 + x1) / 2, (y0 + y1) / 2, max(x1 - x0, y1 - y0) / 2
box = tuple(int(round(v)) for v in (cx - r, cy - r, cx + r, cy + r))
m = m.crop(box).resize((560, 560), Image.LANCZOS)
m.save(os.path.join(D, 'cut', 'moon.png'), optimize=True)
print('moon', box)
