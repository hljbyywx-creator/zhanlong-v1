#!/bin/sh
# 《斩龙封神》字体子集化：自动扫描全仓字符集 → 子集 woff2/woff → fonts.js（base64 data-URI 内嵌，零缺字）。
set -eu

HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/.." && pwd)
CHARSETS="$HERE/font-charsets"
mkdir -p "$CHARSETS"
FONT_SRC=${FONT_SRC:-/Users/banana499/Desktop/liige-video/work/fonts}
PYFTSUBSET=${PYFTSUBSET:-$HOME/miniforge3/bin/pyftsubset}
OUT=${OUT:-$(mktemp -d)}

SRC_POEM="$FONT_SRC/MaShanZheng-Regular.ttf"
SRC_TEXT="$FONT_SRC/LXGWWenKai-Regular.ttf"
SRC_SWORD="$FONT_SRC/ZhiMangXing-Regular.ttf"
SRC_STELE="$FONT_SRC/wts43.ttf"

for f in "$SRC_POEM" "$SRC_TEXT" "$SRC_SWORD" "$SRC_STELE"; do
  [ -f "$f" ] || { echo "缺源字体：$f（设 FONT_SRC=下载目录）" >&2; exit 1; }
done

PY=$(head -1 "$PYFTSUBSET" | sed 's/^#!//')
if "$PY" -c 'import brotli' 2>/dev/null; then FLAVOR=woff2; else FLAVOR=woff; fi
echo "输出格式：$FLAVOR"

# 1) 自动提取全项目所有中文字符与标点，同步供给 text / poem / sword，杜绝题签、大字、剑诀缺字
"$PY" - "$ROOT" "$CHARSETS" <<'EOF'
import sys, glob, os, re
root, cs = sys.argv[1], sys.argv[2]
srcs = [
    os.path.join(root, 'docs', 'DECISIONS.md'),
    os.path.join(root, 'docs', 'MASTER-MANIFEST.md'),
    os.path.join(root, 'docs', 'BRIEF.md'),
    os.path.join(root, 'docs', 'TEXT-LEDGER.md'),
    os.path.join(root, 'index.html'),
] + sorted(glob.glob(os.path.join(root, 'js', '*.js')))
srcs = [p for p in srcs if not p.endswith(('plates.js', 'voice-assets.js', 'audio-assets.js', 'fonts.js'))]

pat = re.compile('[㐀-䶿一-鿿豈-﫿　-〿︰-﹏＀-￯‐-‧·←-↓]')
chars = set(chr(c) for c in range(0x21, 0x7f))
used = []
for p in srcs:
    if os.path.isfile(p):
        used.append(os.path.relpath(p, root))
        chars.update(pat.findall(open(p, encoding='utf-8').read()))
chars.discard('　')
s_all = ''.join(sorted(chars))

for target in ('text.txt', 'poem.txt', 'sword.txt'):
    with open(os.path.join(cs, target), 'w', encoding='utf-8') as f:
        f.write('# 自动生成（build-fonts.sh）；来源：' + ' '.join(used) + '\n')
        for i in range(0, len(s_all), 64):
            f.write(s_all[i:i+64] + '\n')

stele_chars = sorted(set("一二三四五六七八九十转太霄神庭斩龙封神碧血开道紫微上清道境圣人敕诏印无愧"))
with open(os.path.join(cs, 'stele.txt'), 'w', encoding='utf-8') as f:
    f.write('# 自动生成印章碑体字符集\n' + ''.join(stele_chars) + '\n')
EOF

subset() {
  grep -v '^#' "$2" | tr -d '\n' > "$OUT/.chars"
  printf ' ' >> "$OUT/.chars"
  "$PYFTSUBSET" "$1" --text-file="$OUT/.chars" --flavor="$FLAVOR" --output-file="$3" \
    --layout-features='*' --no-hinting --desubroutinize --name-IDs='*' --notdef-outline
}
subset "$SRC_POEM"  "$CHARSETS/poem.txt"  "$OUT/poem.$FLAVOR"
subset "$SRC_TEXT"  "$CHARSETS/text.txt"  "$OUT/text.$FLAVOR"
subset "$SRC_SWORD" "$CHARSETS/sword.txt" "$OUT/sword.$FLAVOR"

# 2) 碑体简体→Big5码位桥接
"$PY" - "$SRC_STELE" "$OUT/stele-src.ttf" <<'EOF'
import sys
from fontTools.ttLib import TTFont
ALIAS = {
    '时': '時', '转': '轉', '斩': '斬', '龙': '龍', '开': '開',
    '圣': '聖', '无': '無', '罗': '羅', '净': '淨', '云': '雲',
    '灵': '靈', '剑': '劍', '风': '風', '门': '門', '御': '御', '诏': '詔',
}
f = TTFont(sys.argv[1])
for t in f['cmap'].tables:
    if t.isUnicode():
        for s, tr in ALIAS.items():
            if ord(s) not in t.cmap and ord(tr) in t.cmap:
                t.cmap[ord(s)] = t.cmap[ord(tr)]
n = f['name']
for r in list(n.names):
    if r.nameID in (1, 4, 16): n.setName('WHZ WeiBei', r.nameID, r.platformID, r.platEncID, r.langID)
    elif r.nameID == 3: n.setName('WHZ WeiBei Regular (subset of wts43.ttf, GPL-2.0)', r.nameID, r.platformID, r.platEncID, r.langID)
    elif r.nameID == 6: n.setName('WHZWeiBei-Regular', r.nameID, r.platformID, r.platEncID, r.langID)
f.save(sys.argv[2])
EOF
subset "$OUT/stele-src.ttf" "$CHARSETS/stele.txt" "$OUT/stele.$FLAVOR"

# 3) 生成 fonts.js
"$PY" - "$ROOT" "$CHARSETS" "$OUT" "$FLAVOR" "$SRC_POEM" "$SRC_TEXT" "$SRC_SWORD" "$OUT/stele-src.ttf" <<'EOF'
import sys, os, base64, json
from fontTools.ttLib import TTFont
root, cs, out, flavor = sys.argv[1:5]
KEYS = ('poem', 'text', 'sword', 'stele')
srcs = dict(zip(KEYS, sys.argv[5:9]))
fam = {'poem': 'Ma Shan Zheng', 'text': 'LXGW WenKai', 'sword': 'Zhi Mang Xing', 'stele': 'WHZ WeiBei'}
LIC = {'stele': '/* WHZ WeiBei = wts43.ttf subset, GNU GPL v2 */\n'}
faces, samples = [], {}
for k in KEYS:
    want = ''.join(l for l in open(os.path.join(cs, k + '.txt'), encoding='utf-8').read().splitlines() if not l.startswith('#'))
    want = sorted(set(want) - {' '})
    cmap = TTFont(srcs[k]).getBestCmap()
    miss = [c for c in want if ord(c) not in cmap]
    have = [c for c in want if ord(c) in cmap]
    p = os.path.join(out, k + '.' + flavor)
    b = open(p, 'rb').read()
    print('%-5s %-17s 字符 %4d  子集 %7d B  缺字 %s' % (k, fam[k], len(have), len(b), ''.join(miss) or '无'))
    samples[k] = ''.join(c for c in have if ord(c) > 0x2e80)[:8] or 'Aa'
    faces.append(LIC.get(k, '') + '@font-face{font-family:"%s";src:url(data:font/%s;base64,%s) format("%s");font-display:swap;}'
                 % (fam[k], flavor, base64.b64encode(b).decode(), flavor))
js = '''/* 自动生成：tools/build-fonts.sh —— 勿手改。 */
(function () {
  var families = %s;
  var samples = %s;
  var done;
  var ready = new Promise(function (r) { done = r; });
  window.CINE_FONTS = { families: families, ready: ready };
  try {
    var st = document.createElement('style');
    st.id = 'cine-fonts';
    st.textContent = %s;
    (document.head || document.documentElement).appendChild(st);
    var timer = setTimeout(function () { done(false); }, 3000);
    if (!document.fonts || !document.fonts.load) { clearTimeout(timer); done(false); return; }
    Promise.all(Object.keys(families).map(function (k) {
      return document.fonts.load('32px "' + families[k] + '"', samples[k]).catch(function () { return []; });
    })).then(function () { clearTimeout(timer); done(true); }, function () { clearTimeout(timer); done(false); });
  } catch (e) { done(false); }
})();
''' % (json.dumps(fam), json.dumps(samples, ensure_ascii=False), json.dumps('\n'.join(faces)))
open(os.path.join(root, 'fonts.js'), 'w', encoding='utf-8').write(js)
print('fonts.js %.2f MiB' % (os.path.getsize(os.path.join(root, 'fonts.js')) / 1048576))
EOF
