#!/usr/bin/env python3.11
"""det 分段并行（gates.sh 用）：det-run.py <工作树> <输出目录> <全片秒> [--from A --to B] [--jobs N] [--seg N]
每段 ≤seg 帧（缺省 40；新秒 690–1100 一带 ≤30，避开无头 Chrome 崩溃），jobs 个进程；
没出 report.json 的段对半拆开、2 进程补渲一轮。结果：<out>/det/s-<a>/report.json。"""
import sys, os, subprocess, json, glob, argparse
from concurrent.futures import ThreadPoolExecutor
ap = argparse.ArgumentParser(); ap.add_argument('wt'); ap.add_argument('out'); ap.add_argument('dur', type=float)
ap.add_argument('--from', dest='a0', type=float, default=0.0); ap.add_argument('--to', dest='b0', type=float, default=None)
ap.add_argument('--jobs', type=int, default=4); ap.add_argument('--seg', type=int, default=40)
o = ap.parse_args()
end = min(o.dur - .6, o.b0 if o.b0 is not None else 1e9)
def segs(a, b, n):
    r = []
    while a <= b + 1e-6:
        k = n if not (690 <= a <= 1100) else min(n, 30)
        e = min(b, a + k - 1); r.append((round(a, 3), round(e, 3))); a = e + 1
    return r
D = os.path.join(o.out, 'det'); os.makedirs(D, exist_ok=True)
def run(ab):
    a, b = ab; d = os.path.join(D, f's-{a:g}')
    with open(d + '.log', 'w') as lg:
        subprocess.run(['node', 'tools/filmstrip.mjs', '--from', f'{a:g}', '--to', f'{b:g}', '--step', '1', '--det', '--thumb', '120', '--out', d],
                       cwd=o.wt, stdout=lg, stderr=subprocess.STDOUT, timeout=3600)
    return ab, os.path.exists(os.path.join(d, 'report.json'))
S = segs(o.a0, end, o.seg)
with open(os.path.join(o.out, 'detsegs.txt'), 'w') as f:
    for a, b in S: f.write(f'{a:g} {b:g}\n')
with ThreadPoolExecutor(o.jobs) as ex: res = list(ex.map(run, S))
miss = [ab for ab, ok in res if not ok]
if miss:
    sub = []
    for a, b in miss: sub += segs(a, b, max(5, int((b - a + 1) // 2)))
    with ThreadPoolExecutor(2) as ex: res2 = list(ex.map(run, sub))
    miss = [ab for ab, ok in res2 if not ok]
    # 拆开补渲的子段覆盖原段：记账用覆盖表
    with open(os.path.join(o.out, 'detsegs.txt'), 'w') as f:
        for a, b in [x for x, ok in res if ok] + sub: f.write(f'{a:g} {b:g}\n')
print('det 未渲完：' + (' '.join(f'{a:g}-{b:g}' for a, b in miss) if miss else '无'))
sys.exit(1 if miss else 0)
