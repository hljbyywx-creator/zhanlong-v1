# usage: ~/miniforge3/bin/python3 sp-split-cols.py in.png outdir id N [holes]
# 抠图后按「列 alpha 投影」在 N-1 处最小值切开（姿态互相贴着、连通域拆不开时用）。
# holes=1：再把被包围的近纯白大块（≥250 且面积≥1500px）也当底色去掉（弓弦围出的白底）。
import sys, os, subprocess, numpy as np
from PIL import Image
from scipy import ndimage
src, out, iid, N = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
holes = len(sys.argv) > 5 and sys.argv[5] == '1'
here = os.path.dirname(os.path.abspath(__file__)); tmp = '/tmp/%s-cut.png' % iid
subprocess.run(['/usr/bin/python3', os.path.join(here, 'sp-cutout.py'), src, tmp, '2', '248'], check=True)
im = np.asarray(Image.open(tmp).convert('RGBA')).copy()
if holes:
    rgb = np.asarray(Image.open(src).convert('RGB')).astype(int)
    white = (rgb.min(axis=2) >= 250) & (im[..., 3] > 0)
    lab, n = ndimage.label(white)
    sizes = ndimage.sum(white, lab, range(1, n + 1))
    for i, s in enumerate(sizes):
        if s >= 1500: im[lab == i + 1, 3] = 0
a = im[..., 3].astype(float); col = a.sum(axis=0)
xs = np.nonzero(col > 0)[0]; x0, x1 = xs[0], xs[-1]; w = x1 - x0
cuts = []
for k in range(1, N):
    g = x0 + w * k / N; lo, hi = int(g - w * .12), int(g + w * .12)
    sm = np.convolve(col, np.ones(9) / 9, 'same')
    cuts.append(lo + int(np.argmin(sm[lo:hi])))
edges = [0] + cuts + [im.shape[1]]
for f in os.listdir(out):
    if f.startswith(iid + '-') or f == iid + '.webp': os.remove(os.path.join(out, f))
for i in range(N):
    piece = im.copy(); piece[:, :edges[i], 3] = 0; piece[:, edges[i + 1]:, 3] = 0
    ys, xs2 = np.nonzero(piece[..., 3] > 24)
    b = (max(0, xs2.min() - 12), max(0, ys.min() - 12), min(im.shape[1], xs2.max() + 13), min(im.shape[0], ys.max() + 13))
    name = '%s.webp' % iid if N == 1 else '%s-%d.webp' % (iid, i + 1)
    Image.fromarray(piece).crop(b).save(os.path.join(out, name), quality=88, method=6)
    print(name, b[2] - b[0], b[3] - b[1])
