# Aufruf: python3 assets/berliner-bild/cut.py  (braucht Pillow und numpy)
# Schneidet die Bildkarten aus den Commons-Scans aus, richtet sie gerade und hellt das Papier auf.
import math, os
from PIL import Image, ImageOps
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'public', 'cards')
SRC = {r: os.path.join(HERE, f) for r, f in {'J': 'Berlinerbild_Buben.jpg', 'Q': 'Berlinerbild_Damen.jpg', 'K': 'Berlinerbild_Koenige.jpg'}.items()}
ORDER = ['S', 'D', 'C', 'H']
W, H = 480, 672  # 240 x 336 doppelt

def runs(mask, minlen):
    out = []; s = None
    for i, v in enumerate(list(mask) + [False]):
        if v and s is None: s = i
        elif not v and s is not None:
            if i - s >= minlen: out.append((s, i))
            s = None
    return out

def edge_angle(m):
    """Neigung aus der linken und rechten Kante (erste/letzte Kartenspalte je Zeile)."""
    h = m.shape[0]
    ys = np.arange(int(h * 0.15), int(h * 0.85), 4)
    pts = []
    for side in (0, 1):
        xs = []
        for y in ys:
            row = np.nonzero(m[y])[0]
            if len(row): xs.append(row[0] if side == 0 else row[-1])
        xs = np.array(xs, float)
        k = np.polyfit(ys[:len(xs)], xs, 1)[0]
        pts.append(k)
    return math.degrees(math.atan(np.median(pts)))

for rank, path in SRC.items():
    img = Image.open(path).convert('RGB')
    a = np.asarray(img.convert('L')).astype(int)
    m = a < 246
    cols = runs(m.mean(axis=0) > 0.4, 100)
    assert len(cols) == 4, (path, cols)
    for (c0, c1), suit in zip(cols, ORDER):
        pad = 20
        x0, x1 = max(0, c0 - pad), min(a.shape[1], c1 + pad)
        rows = runs(m[:, c0:c1].mean(axis=1) > 0.4, 100)[0]
        y0, y1 = max(0, rows[0] - pad), min(a.shape[0], rows[1] + pad)
        card = img.crop((x0, y0, x1, y1))
        mm = np.asarray(card.convert('L')) < 246
        ang = edge_angle(mm)
        card = card.rotate(ang, resample=Image.BICUBIC, fillcolor=(255, 255, 255), expand=False)
        mm = np.asarray(card.convert('L')) < 246
        cc = runs(mm.mean(axis=0) > 0.5, 50)[0]
        rr = runs(mm.mean(axis=1) > 0.5, 50)[0]
        cw, ch = cc[1] - cc[0], rr[1] - rr[0]
        # Nur den Rand mit Schatten weg; die Karte ist schmaler als 1 : 1,4, also seitlich weiß auffüllen
        ix, iy = cw * 0.02, ch * 0.012
        box = (cc[0] + ix, rr[0] + iy, cc[1] - ix, rr[1] - iy)
        inner = card.crop(tuple(int(round(v)) for v in box))
        # Papierton auf Weiß ziehen (hellstes Perzentil je Kanal)
        arr = np.asarray(inner).astype(float)
        paper = np.percentile(arr.reshape(-1, 3), 97, axis=0)
        inner = Image.fromarray(np.clip(arr * (255.0 / paper), 0, 255).astype(np.uint8))
        fw = min(W, round(inner.width * H / inner.height * 1.04))  # höchstens 4 % breiter ziehen
        face = Image.new('RGB', (W, H), (255, 255, 255))
        face.paste(inner.resize((fw, H), Image.LANCZOS), ((W - fw) // 2, 0))
        face.save(os.path.join(OUT, f'{rank}{suit}.jpg'), quality=84, optimize=True, progressive=True)
        print(rank + suit, f'winkel {ang:.2f}°', 'breite', fw)
