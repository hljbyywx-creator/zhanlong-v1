#!/usr/bin/env node
/* 《万古云霄》配乐 v2 打包：master.wav 切成 CHUNK 秒一段（前后各多录 PAD 秒，供交界线性交叉），逐段 lame 编码 MP3（ABR），
   base64 内嵌为根目录 audio-assets.js（构建产物，已 .gitignore）：window.CINE_SCORE_V2 = { v:2, sr, chunk, pad, xf, lead, duration, acts, parts:[{a,b,mime,data}] }。
   体积上限 MAX（缺省 13.8e6 字节）：从 ABR 84kbps 起试，超了逐级降码率重编。
   用法：node tools/music-pack.mjs [--wav tools/out/music-v2/master.wav] [--dst audio-assets.js] [--lead 秒]
   --lead：解码偏移校正（verify-audio 实测解码后与原 WAV 的对齐差；LAME 写了 gapless 头，Chrome 通常已自动裁掉编码延迟，缺省 0）。 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readWav, writeWav } from './music-render.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const WAV = path.resolve(arg('--wav', path.join(HERE, 'out', 'music-v2', 'master.wav')));
const DST = path.resolve(arg('--dst', path.join(HERE, '..', 'audio-assets.js')));
const META = JSON.parse(fs.readFileSync(WAV.replace(/\.wav$/, '.json'), 'utf8'));
const CHUNK = 24, PAD = .25, XF = .05, MAX = +arg('--max', 13.8e6), LEAD = +arg('--lead', 0);
const TMP = path.join(path.dirname(WAV), '_pack');

const w = readWav(WAV), sr = w.sr, n = w.n, dur = n / sr;
const nParts = Math.ceil((dur - .01) / CHUNK);
fs.mkdirSync(TMP, { recursive: true });
const slices = [];
for (let i = 0; i < nParts; i++) {
  const a = Math.max(0, i * CHUNK - PAD), b = Math.min(dur, (i + 1) * CHUNK + PAD);
  const ia = Math.round(a * sr), ib = Math.round(b * sr), f = path.join(TMP, `p${String(i).padStart(3, '0')}.wav`);
  writeWav(f, [w.ch[0].slice(ia, ib), w.ch[1].slice(ia, ib)], sr, false);
  slices.push({ a: ia / sr, b: ib / sr, wav: f });
}
let kbps = 84, total = 0, parts;
for (;;) {
  parts = slices.map((s) => {
    const mp3 = s.wav.replace(/\.wav$/, '.mp3');
    execFileSync('lame', ['--quiet', '--abr', String(kbps), '-q', '2', s.wav, mp3]);
    const data = fs.readFileSync(mp3).toString('base64');
    return { a: +s.a.toFixed(6), b: +s.b.toFixed(6), mime: 'audio/mpeg', data };
  });
  total = parts.reduce((x, p) => x + p.data.length, 0) + 4096;
  if (total <= MAX || kbps <= 56) break;
  kbps -= 4;
}
/* 编码后的真峰（ffmpeg ebur128 peak=true，逐段取最大），只报告 */
let tpMax = -Infinity;
for (const sl of slices) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', sl.wav.replace(/\.wav$/, '.mp3'), '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = [...String(r.stderr).matchAll(/Peak:\s+(-?[\d.]+|-inf) dBFS/g)].pop();
  if (m && m[1] !== '-inf') tpMax = Math.max(tpMax, +m[1]);
}
const head = `/* 构建产物，勿手改：sh tools/build-audio.sh 重建。《万古云霄》配乐 v2（程序化作曲，CC0 真采样：古筝/越南筝/大提琴组/小提琴组/长笛/大鼓/锣/钹/军鼓；乐谱 tools/score/score-v2.mjs）。
   ${nParts} 段×${CHUNK}s（前后各多 ${PAD}s 交叉）MP3 ABR ${kbps}kbps base64；积分 ${META.lufs} LUFS，样本峰 ${META.samplePeakDb} dBFS；幕表 ${META.acts.map((a) => a.id + '@' + a.start).join(' ')}。 */\n`;
const body = 'window.CINE_SCORE_V2 = ' + JSON.stringify({ v: 2, sr, chunk: CHUNK, pad: PAD, xf: XF, lead: LEAD, duration: +dur.toFixed(3), lufs: META.lufs, acts: META.acts.map((a) => ({ id: a.id, start: a.start, duration: a.duration })), parts }) + ';\n';
fs.writeFileSync(DST + '.tmp', head + body);
fs.renameSync(DST + '.tmp', DST);
fs.rmSync(TMP, { recursive: true, force: true });
const size = fs.statSync(DST).size;
console.log(`music-pack: ${path.basename(DST)} ${(size / 1e6).toFixed(2)} MB（${nParts} 段，ABR ${kbps}kbps，${dur.toFixed(1)}s）编码后真峰 ${tpMax.toFixed(1)} dBTP${size > 14e6 ? '  ✗ 超过 14MB' : ''}${tpMax > -1.5 ? '  ✗ 真峰超过 −1.5' : ''}`);
if (size > 14e6) process.exit(1);
