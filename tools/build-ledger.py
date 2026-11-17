#!/usr/bin/env python3
"""docs/TEXT-LEDGER.md → js/lib-ledger.js（window.CINE.LEDGER，全部上屏文字的编号、拍号、幕内秒、类别、文字、最短停留、退场）。
可重复运行：python3 tools/build-ledger.py。账本改了就重跑；fonts 的 text.txt 也会因此自动收进这些字（build-fonts.sh 扫 js/*.js）。"""
import json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'docs', 'TEXT-LEDGER.md')
OUT = os.path.join(ROOT, 'js', 'lib-ledger.js')
ACTS = [('冷开场', 'prologue'), ('前情', 'prologue'), ('序', 'prologue'), ('第一幕', 'act1'), ('第二幕', 'act2'),
        ('第三幕', 'act3'), ('第四幕', 'act4'), ('第五幕', 'act5'), ('尾', 'coda'), ('尾声', 'coda')]
if not os.path.isfile(SRC):
    print('build-ledger: 缺 docs/TEXT-LEDGER.md，跳过（保留现有 js/lib-ledger.js）', file=sys.stderr)
    sys.exit(0)
rows, act = [], None
for line in open(SRC, encoding='utf-8'):
    if line.startswith('## '):
        act = next((a for k, a in ACTS if line[3:].startswith(k)), None)
        continue
    m = re.match(r'^\|\s*([TW]\d{3})\s*\|', line)
    if not m or not act:
        continue
    c = [x.strip() for x in line.strip().strip('|').split('|')]
    tid, beat, t, G, kind, text, src, n, mind, out = c[:10]
    if len(c) > 12 and '建议删' in c[12]:        # 协调者裁定 1020：备注含「建议删」的一律不上屏
        continue
    who = c[10] if len(c) > 10 and c[10] not in ('', '—', '旁白') else None
    pm = re.match(r'^([左右中])(上)?(?:@(\d*\.?\d+))?$', c[13]) if len(c) > 13 else None   # 1024：第 14 列「字位」＝左/右/中［上］［@块心横位］（任务 F）
    side = {'左': 'left', '右': 'right', '中': 'center'}[pm.group(1)] if pm else None
    pos = {**({'top': True} if pm and pm.group(2) else {}), **({'sx': float(pm.group(3))} if pm and pm.group(3) else {})}
    rows.append({'id': tid, 'act': act, 'beat': beat, 't': float(t), 'G': float(G), 'kind': kind, 'text': text,
                 'min': float(mind), 'out': None if out == '常驻' else float(out), 'note': '改写' in src or '改编' in src,
                 **({'who': who} if who else {}), **({'side': side} if side else {}), **pos})
print('账本条目 %d' % len(rows), file=sys.stderr)
js = ('/* 自动生成：tools/build-ledger.py ← docs/TEXT-LEDGER.md —— 勿手改。全部上屏文字 %d 项。\n'
      '   字段：id 编号, act 幕 ID, beat 拍号, t 幕内秒（起点）, G 全片秒, kind 类别, text 文字, min 最短停留, out 退场幕内秒（印章 null＝常驻）, note 改写/改编,\n'
      '         who 说话人（有则给）, side 字位 left/right/center（对白，有则给）, top 顶部行位（字位带「上」）, sx 块心横位（W 的比例，字位带「@」）。\n'
      '   用法见 lib-text.js 的 I.ledger。 */\n'
      '(function () {\nwindow.CINE = window.CINE || {};\nCINE.LEDGER = [\n%s\n];\n})();\n') % (
    len(rows), ',\n'.join('  ' + json.dumps(r, ensure_ascii=False) for r in rows))
open(OUT, 'w', encoding='utf-8').write(js)
from collections import Counter
print('lib-ledger.js：%d 项 %s' % (len(rows), dict(Counter(r['kind'] for r in rows))))
