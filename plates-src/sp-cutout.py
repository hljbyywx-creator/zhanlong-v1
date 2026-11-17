# usage: /usr/bin/python3 sp-cutout.py in.png out.png [edge_px=2] [thr=248]
# 离歌第八批做法：从四边泛洪，亮度>=thr 且与画布边缘连通的像素当作底色；
# 人物内核保留原墨色不透明；外缘 edge_px 像素带改为 alpha=墨色浓度(255-Y)、RGB=黑，飞白处透明。
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
src, dst = sys.argv[1], sys.argv[2]
edge = int(sys.argv[3]) if len(sys.argv) > 3 else 2
thr = int(sys.argv[4]) if len(sys.argv) > 4 else 248
im = Image.open(src).convert("RGB")
rgb = np.asarray(im).astype(np.float32)
Y = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
h, w = Y.shape
b = Image.fromarray(np.where(Y >= thr, 255, 0).astype(np.uint8)).copy()  # copy：fromarray 共享只读缓冲，floodfill 会静默失效
for x in range(w):
    for y in (0, h - 1):
        if b.getpixel((x, y)) == 255:
            ImageDraw.floodfill(b, (x, y), 128)
for y in range(h):
    for x in (0, w - 1):
        if b.getpixel((x, y)) == 255:
            ImageDraw.floodfill(b, (x, y), 128)
bg = np.asarray(b) == 128
core = Image.fromarray(np.where(bg, 0, 255).astype(np.uint8))
er = core.filter(ImageFilter.MinFilter(2 * edge + 1)) if edge > 0 else core
er = np.asarray(er) == 255
band = (~bg) & (~er)
sat = rgb.max(axis=2) - rgb.min(axis=2)
band &= sat < 40  # 有色处（朱红剑符）不做墨浓度转换，保留原色不透明
a = np.where(bg, 0, 255).astype(np.float32)
a[band] = np.clip(255 - Y[band], 0, 255)
out = np.dstack([rgb, a]).astype(np.float32)
out[band, 0:3] = 0
Image.fromarray(out.clip(0, 255).astype(np.uint8)).save(dst)
ys, xs = np.where(a > 64)
print(f"{dst}: {w}x{h} bbox x {xs.min()}-{xs.max()} y {ys.min()}-{ys.max()}")
