#!/bin/sh
# 《斩龙封神》配乐构建流水线：无头 Chrome 提取实时幕表与 cue → 44.1kHz 真采样混音母带（-23 LUFS）→ 24s 分片 MP3 内嵌 audio-assets.js
set -eu
HERE=$(cd "$(dirname "$0")/.." && pwd)
cd "$HERE"
for c in node ffmpeg lame; do command -v "$c" >/dev/null || { echo "build-audio: 需要 $c" >&2; exit 2; }; done
OUT=tools/out/music-zhanlong
mkdir -p "$OUT"
NODE="node --max-old-space-size=8192"
SCORE=${SCORE:-score-zhanlong.mjs}
export SCORE
node tools/music-cues.mjs "$OUT/cues.json"
$NODE tools/music-render.mjs --cues "$OUT/cues.json" --out "$OUT"
node tools/music-pack.mjs --wav "$OUT/master.wav" --dst "$HERE/audio-assets.js" --lead "${LEAD:-0}"
[ "${NOCHECK:-}" = 1 ] || $NODE tools/music-check.mjs --wav "$OUT/master.wav" --out "$OUT" || true
ls -l "$HERE/audio-assets.js" | awk '{ printf "build-audio: %s  %.2f MB\n", $NF, $5 / 1048576 }'
