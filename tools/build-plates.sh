#!/bin/sh
# 《万古云霄》水墨底图打包：plates/<id>.webp|.jpg|.png → plates.js（base64 data-URI 内嵌，file:// 下无需 fetch）。
# 可重复运行；plates/ 不存在或没有图时生成空的合法 plates.js（window.CINE_PLATES = {}）。
# 用法：sh tools/build-plates.sh   （任意目录下均可）
# 产物：window.CINE_PLATES = { '<id>': 'data:image/...;base64,...', ... };  按文件名排序。
# 总大小目标 ≤ 40 MiB（MAX_BYTES 可用环境变量改）；超出时照常写出但以非零码退出，提示降低编码质量。
set -eu

HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/.." && pwd)                       # 项目根（jianpo-v2）
DIR="$ROOT/plates"
OUT="$ROOT/plates.js"
MAX_BYTES=${MAX_BYTES:-41943040}                   # 40 MiB（全片约 145 张）

TMP="$OUT.tmp"
{
  echo "/* 自动生成：tools/build-plates.sh —— 勿手改。图源目录 plates/，文件名（去扩展名）即底图 id。 */"
  echo "window.CINE_PLATES = {"
} > "$TMP"

n=0
for f in "$DIR"/*.webp "$DIR"/*.jpg "$DIR"/*.png; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  id=${name%.*}
  if [ -f "$(dirname "$0")/plates-exclude.txt" ] && grep -qx -- "$id" "$(dirname "$0")/plates-exclude.txt"; then continue; fi
  case "$name" in
    *.webp) mime=image/webp ;;
    *.jpg)  mime=image/jpeg ;;
    *.png)  mime=image/png ;;
  esac
  [ $n -gt 0 ] && echo "," >> "$TMP"
  printf "  '%s': 'data:%s;base64," "$id" "$mime" >> "$TMP"
  base64 < "$f" | tr -d '\n' >> "$TMP"
  printf "'" >> "$TMP"
  n=$((n + 1))
done
printf "\n};\n" >> "$TMP"
mv "$TMP" "$OUT"

bytes=$(wc -c < "$OUT" | tr -d ' ')
mb=$(awk -v b="$bytes" 'BEGIN { printf "%.2f", b / 1048576 }')
echo "plates.js：$n 张，$bytes 字节（$mb MB）"
if [ "$bytes" -gt "$MAX_BYTES" ]; then
  echo "超出目标 $MAX_BYTES 字节：请降低 webp 质量后重打包" >&2
  exit 2
fi
