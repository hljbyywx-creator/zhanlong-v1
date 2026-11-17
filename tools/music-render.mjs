#!/usr/bin/env node
/* 《万古云霄》配乐 v2 离线渲染器（零 npm 依赖；混响卷积借本机 ffmpeg 的 afir）。
   用法：node tools/music-render.mjs [--cues tools/out/music-v2/cues.json] [--out tools/out/music-v2] [--from 秒 --to 秒] [--name master] [--gain-db dB]
   时间一律来自 cue 表（幕表＋幕内 cue，tools/music-cues.mjs 从页面实时读出），本文件不写任何全片秒；--from/--to 只用于渲局部试听段。
   输入：幕表＋cue 表（tools/music-cues.mjs 从页面实时读出；score-v4 改读 docs/revision-v2/CUES-v2.json）、乐谱 tools/score/（环境变量 SCORE 选谱）、
        CC0 采样（animation-02/assets/audio，只读；audio-src/cc0；audio-src/vcsl＝VCSL 打击，MUSIC_VCSL 可改目录）。
   输出：<out>/<name>.wav（44.1kHz 16bit 立体声，已做响度归一与限幅）、<out>/<name>.json（响度/峰值/主题标记/段落表）。
   流程：乐谱生成事件 → 逐音符采样回放（变调＝按音高取最近根音重采样，±4 半音内；音符长于采样时在交叉淡化的循环区内延续）
        → 干声＋混响送量两条总线 → ffmpeg afir 卷积生成式冲激响应 → 硬停窗（如匣封口：干声与混响尾一起切）→ BS.1770 响度归一 → 前视限幅。 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SR = 44100;
const SAMPLES = process.env.MUSIC_SAMPLES || path.resolve(HERE, '..', '..', 'animation-02', 'assets', 'audio');
const CC0 = process.env.MUSIC_CC0 || path.resolve(HERE, '..', 'audio-src', 'cc0');
const VCSL = process.env.MUSIC_VCSL || path.resolve(HERE, '..', 'audio-src', 'vcsl');
const TARGET_LUFS = -23, CEIL_DB = -2.0;   // 1206s 片长使 MP3 降到 ~68kbps，编码过冲变大：样本峰上限压到 −2.0，保证编码后真峰 ≤ −1.5 dBTP

/* ================= WAV 读写 ================= */
export function readWav(file) {
  const b = fs.readFileSync(file);
  let o = 12, fmt = null, data = null;
  while (o < b.length - 8) {
    const id = b.toString('ascii', o, o + 4), sz = b.readUInt32LE(o + 4);
    if (id === 'fmt ') { fmt = { tag: b.readUInt16LE(o + 8), ch: b.readUInt16LE(o + 10), sr: b.readUInt32LE(o + 12), bits: b.readUInt16LE(o + 22) }; if (fmt.tag === 0xfffe && sz >= 26) fmt.tag = b.readUInt16LE(o + 8 + 24); }
    if (id === 'data') { data = b.subarray(o + 8, Math.min(b.length, o + 8 + sz)); }
    o += 8 + sz + (sz & 1);
  }
  if (!fmt || !data) throw new Error('坏 WAV ' + file);
  const bps = fmt.bits / 8, n = Math.floor(data.length / (bps * fmt.ch)), ch = [];
  for (let c = 0; c < fmt.ch; c++) ch.push(new Float32Array(n));
  const fl = fmt.tag === 3;
  for (let i = 0; i < n; i++) for (let c = 0; c < fmt.ch; c++) {
    const q = (i * fmt.ch + c) * bps;
    ch[c][i] = fmt.bits === 16 ? data.readInt16LE(q) / 32768 : fmt.bits === 24 ? data.readIntLE(q, 3) / 8388608 : fl ? data.readFloatLE(q) : data.readInt32LE(q) / 2147483648;
  }
  return { sr: fmt.sr, ch, n };
}
export function writeWav(file, chs, sr, float) {
  const n = chs[0].length, nc = chs.length, bps = float ? 4 : 2, len = n * nc * bps;
  const b = Buffer.alloc(44 + len);
  b.write('RIFF', 0); b.writeUInt32LE(36 + len, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(float ? 3 : 1, 20); b.writeUInt16LE(nc, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * nc * bps, 28);
  b.writeUInt16LE(nc * bps, 32); b.writeUInt16LE(bps * 8, 34); b.write('data', 36); b.writeUInt32LE(len, 40);
  let o = 44, seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < n; i++) for (let c = 0; c < nc; c++) {
    if (float) { b.writeFloatLE(chs[c][i], o); o += 4; }
    else { const v = Math.round(chs[c][i] * 32767 + (rnd() - rnd())); b.writeInt16LE(v > 32767 ? 32767 : v < -32768 ? -32768 : v, o); o += 2; }   // TPDF 抖动
  }
  fs.writeFileSync(file, b);
}

/* 加窗 sinc 重采样（预载采样用；Blackman 窗，±24 点） */
function resample(x, a, z) {
  if (a === z) return x;
  const r = z / a, n = Math.floor(x.length * r), y = new Float32Array(n), W = 24, fc = Math.min(1, r) * .97;
  for (let i = 0; i < n; i++) {
    const p = i / r, c = Math.floor(p);
    let s = 0;
    for (let k = c - W + 1; k <= c + W; k++) {
      if (k < 0 || k >= x.length) continue;
      const d = p - k, u = d / W;
      if (u <= -1 || u >= 1) continue;
      const w = .42 + .5 * Math.cos(Math.PI * u) + .08 * Math.cos(2 * Math.PI * u);
      s += x[k] * w * (d === 0 ? fc : Math.sin(Math.PI * fc * d) / (Math.PI * d));
    }
    y[i] = s;
  }
  return y;
}

/* ================= 采样库 ================= */
const SRC_INST = { cello: 'cello', bowed: 'bowed', flute: 'flute', dan: 'dantranh', drum: 'bigdrum', gong: 'gong', snare: 'snare' };
const PROC_INST = { zheng: 'guzheng', cym: 'cymbal' };
const PAD = 4;
/* 音名 → MIDI（# 升号；b 也接受） */
function noteMidi(s) {
  const m = /^([A-G])([#b]?)(-?\d+)$/.exec(s);
  if (!m) return null;
  const pc = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 12 * (+m[3] + 1) + pc;
}
/* CC0 采样：全部从文件名取音高/力度，不读 manifest */
function loadCc0(lib) {
  const add = (key, file, root, extra = {}) => {
    if (!fs.existsSync(file)) return null;
    const w = readWav(file);
    let L = w.ch[0], R = w.ch[1] || w.ch[0];
    L = resample(L, w.sr, SR); R = w.ch.length > 1 ? resample(R, w.sr, SR) : L;
    const n = L.length, pL = new Float32Array(n + PAD * 2), pR = new Float32Array(n + PAD * 2);
    pL.set(L, PAD); pR.set(R, PAD);
    const e = { key, root, L: pL, R: pR, n, stereo: w.ch.length > 1, file: path.basename(file), ...extra };
    (lib[key] = lib[key] || []).push(e);
    return e;
  };
  const files = (sub) => { const d = path.join(CC0, sub); return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.wav')).sort() : []; };
  for (const f of files('ocarina')) {                       // 埙（陶笛代）：持续音
    const m = /^StdOcarina_Sus_(.+)\.wav$/.exec(f), root = m && noteMidi(m[1]);   // VCSL 陶笛实际比文件名高八度（A3 文件实测 440Hz）
    if (root != null) add('xun', path.join(CC0, 'ocarina', f), root + 12);
  }
  for (const f of files('handchimes')) {                    // 手铃：打击
    const m = /^sus_(.+)_r01_main\.wav$/.exec(f), root = m && noteMidi(m[1]);
    if (root != null) add('chime', path.join(CC0, 'handchimes', f), root);
  }
  for (const f of files('tubular')) {                       // 管钟：同音名按力度分 ff/fff 与 p/pp 两条
    const m = /^chimes_(.+)_(pp|p|mp|mf|f|ff|fff)_rr(\d+)\.wav$/.exec(f), root = m && noteMidi(m[1]);
    if (root != null) add('tube', path.join(CC0, 'tubular', f), root, { dyn: /^(ff|fff)$/.test(m[2]) ? 'hi' : /^(p|pp)$/.test(m[2]) ? 'lo' : 'mid', rr: +m[3] });
  }
  const nep = files('nepalese').map((f) => { const m = /^fx1_short_r(\d+)_main\.wav$/.exec(f); return m ? [+m[1], f] : null; }).filter(Boolean).sort((a, b) => a[0] - b[0]);
  for (const [, f] of nep) add('qing', path.join(CC0, 'nepalese', f), 60);   // 磬：无音高，按事件顺序轮换 r01→r11
}
/* VCSL 打击（CC0，audio-src/vcsl）：每条采样带 演奏法 tech／力度级 lv／轮换号 rr。
   lv 先从文件名取（pp…fff 或 v1…v4）；文件名里没有力度的，按峰值电平就近归入同 tech 已知级的平均峰值，同 tech 全无已知级则按峰值排序编级。
   起音前的静音按「首个 ≥ 峰值 1% 的样本前 2ms」裁掉，命中时刻＝事件 t；pkT 记峰值时刻，供 align:'peak' 用（渐强滚奏把峰值对到 t）。 */
const DYN = { ppp: 0, pp: 1, p: 2, mp: 3, mf: 4, f: 5, ff: 6, fff: 7 };
const VM = 'Membranophones/Struck Membranophones', VI = 'Idiophones/Struck Idiophones';
const VCSL_MAP = [   // [乐器, 子目录, 文件名正则（第 1 组＝力度，第 2 组＝轮换号）, tech]
  ['bd', VM + '/Bass Drum 2', /^bassdrum_hit_(pp|mp|mf|f|ff)(\d?)\.wav$/, 'hit'],                 // 大鼓
  ['bd', VM + '/Bass Drum 2', /^bassdrum_roll_(pp|mp|mf|ff)\.wav$/, 'roll'],
  ['bd', VM + '/Bass Drum 2', /^bassdrum_roll_(pp|mp|mf|ff)_rel\.wav$/, 'rollend'],
  ['bd', VM + '/Bass Drum 2', /^bassdrum_roll_fast_(pp|mp|mf|f)\.wav$/, 'froll'],
  ['bd', VM + '/Bass Drum 2', /^bassdrum_roll_fast_(pp|mp|mf|f)_rel\.wav$/, 'frollend'],
  ['bd', VM + '/Bass Drum 2', /^bassdrum_cresc_(?:short|med)()\.wav$/, 'cresc'],
  ['bd', VM + '/Bass Drum 2', /^bassdrum_rub\d+()\.wav$/, 'rub'],
  ['tomH', VM + '/Tom 1/Mallet', /^TomH_HitM_v(\d)_rr(\d)_Mid\.wav$/, 'm'],                        // 堂鼓（高）
  ['tomH', VM + '/Tom 1/Stick', /^TomH_HitS_v(\d)_rr(\d)_Mid\.wav$/, 's'],
  ['tomH', VM + '/Tom 1/Mallet', /^TomH_RollM_v(\d)_rr(\d)_Mid\.wav$/, 'mroll'],
  ['tomH', VM + '/Tom 1/Stick', /^TomH_RollS_v(\d)_rr(\d)_Mid\.wav$/, 'sroll'],
  ['tomH', VM + '/Tom 1', /^TomH_rimS_v(\d)_rr(\d)_Mid\.wav$/, 'rim'],
  ['tomH', VM + '/Tom 1', /^TomH_rimFLS()_rr(\d)_Mid\.wav$/, 'rim'],
  ['tomL', VM + '/Tom 2/Mallet', /^TomL_HitM_v(\d)_rr(\d)_Mid\.wav$/, 'm'],                        // 堂鼓（低）
  ['tomL', VM + '/Tom 2/Stick', /^TomL_HitS_v(\d)_rr(\d)_Mid\.wav$/, 's'],
  ['tomL', VM + '/Tom 2/Mallet', /^TomL_RollM_v(\d)_rr(\d)_Mid\.wav$/, 'mroll'],
  ['tomL', VM + '/Tom 2/Stick', /^TomL_RollS_v(\d)_rr(\d)_Mid\.wav$/, 'sroll'],
  ['tomL', VM + '/Tom 2', /^TomL_rimS_v(\d)_rr(\d)_Mid\.wav$/, 'rim'],
  ['tomL', VM + '/Tom 2', /^TomL_rimFLS()_rr(\d)_Mid\.wav$/, 'rim'],
  ['frameL', VM + '/Frame Drum', /^HDrumL_Hit_v(\d)_rr(\d)_Sum\.wav$/, 'open'],                    // 板鼓（大框鼓）；Hand 两条电平 −56/−60 dBFS，峰值对齐后只剩底噪，不收
  ['frameL', VM + '/Frame Drum', /^HDrumL_HitMuted_v(\d)_rr(\d)_Sum\.wav$/, 'mute'],
  ['frameS', VM + '/Frame Drum', /^HDrumS_Hit_v(\d)_rr(\d)_Sum\.wav$/, 'open'],                    // 板鼓（小框鼓）
  ['frameS', VM + '/Frame Drum', /^HDrumS_HitMuted_v(\d)_rr(\d)_Sum\.wav$/, 'mute'],
  ['luo', VI + '/Gong 1', /^gong_(p|mf|f|fff)()\.wav$/, 'main'],                                    // 大锣（低音锣 ~140Hz）
  ['luo', VI + '/Gong 1', /^gong_2_(mp|f)()\.wav$/, 'small'],                                       // 另一面较高的锣 ~300Hz
  ['luo', VI + '/Gong 1', /^gong_scrape_(mf)()\.wav$/, 'scrape'],
  ['nao', VI + '/Clash Cymbals 1', /^cymbal_crash1_(pp|mp|mf|ff)(\d)\.wav$/, 'open'],              // 铙钹
  ['nao', VI + '/Clash Cymbals 1', /^cymbal_crash1_short()(\d)\.wav$/, 'short'],                    // 捂音（短）
  ['bang', VI + '/Woodblock', /^wood_click_(pp|mp|f|ff)(?:_rr(\d))?\.wav$/, 'main'],                // 梆子
  ['bang', VI + '/Woodblock', /^wood_click3_vl()(\d)\.wav$/, 'main'],                               // 无力度名：按电平归级
  ['bang', VI + '/Woodblock', /^wood_click2_(mp)()\.wav$/, 'hi'],                                   // 高一档的另一块（~2.9kHz）
  ['slit', VI + '/Slit Drum', /^LogDrumHi_MedM_v(\d)_rr(\d)_Sum\.wav$/, 'hi'],                      // 梆子（木鼓）
  ['slit', VI + '/Slit Drum', /^LogDrumLo_MedM_v(\d)_rr(\d)_Sum\.wav$/, 'lo']
];
export const VCSL_KEYS = [...new Set(VCSL_MAP.map((r) => r[0]))];
function loadVcsl(lib) {
  const got = [];
  for (const [key, sub, re, tech] of VCSL_MAP) {
    const dir = path.join(VCSL, sub);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.wav')).sort()) {
      const m = re.exec(f); if (!m) continue;
      const w = readWav(path.join(dir, f));
      let pk = 0; for (const c of w.ch) for (let i = 0; i < w.n; i++) pk = Math.max(pk, Math.abs(c[i]));
      let on = 0; outer: for (let i = 0; i < w.n; i++) for (const c of w.ch) if (Math.abs(c[i]) >= pk * .01) { on = i; break outer; }
      const a = Math.max(0, on - Math.round(.002 * w.sr));
      let L = w.ch[0].subarray(a), R = (w.ch[1] || w.ch[0]).subarray(a);
      L = resample(L, w.sr, SR); R = w.ch.length > 1 ? resample(R, w.sr, SR) : L;
      const n = L.length, pL = new Float32Array(n + PAD * 2), pR = new Float32Array(n + PAD * 2);
      pL.set(L, PAD); pR.set(R, PAD);
      let pi = 0, pv = 0; for (let i = 0; i < n; i++) { const v = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (v > pv) { pv = v; pi = i; } }
      const d = m[1] || '';
      const e = { key, root: 60, L: pL, R: pR, n, stereo: w.ch.length > 1, file: f, vcsl: true, tech, rr: m[2] ? +m[2] : 1,
        lv: d in DYN ? DYN[d] : /^\d$/.test(d) ? +d : null, pkDb: 20 * Math.log10(Math.max(pk, 1e-9)), pkT: pi / SR };
      got.push(e);
      (lib[key] = lib[key] || []).push(e);
    }
  }
  /* 无力度名的：就近归级（同乐器同 tech） */
  for (const e of got.filter((x) => x.lv == null)) {
    const known = got.filter((x) => x.key === e.key && x.tech === e.tech && x.lv != null);
    if (known.length) {
      const lvs = [...new Set(known.map((x) => x.lv))], mean = (l) => { const k = known.filter((x) => x.lv === l); return k.reduce((s, x) => s + x.pkDb, 0) / k.length; };
      e.lv = lvs.sort((p, q) => Math.abs(mean(p) - e.pkDb) - Math.abs(mean(q) - e.pkDb))[0];
    }
  }
  const groups = {};
  for (const e of got.filter((x) => x.lv == null)) (groups[e.key + '|' + e.tech] = groups[e.key + '|' + e.tech] || []).push(e);
  for (const g of Object.values(groups)) {   // 全无力度名：峰值相差 ≤3dB 的并为一级（作轮换），否则按峰值升序编级
    g.sort((p, q) => p.pkDb - q.pkDb);
    let lv = 1, ref = g[0].pkDb;
    for (const e of g) { if (e.pkDb - ref > 3) { lv++; ref = e.pkDb; } e.lv = lv; }
  }
}
/* 取 VCSL 采样：tech 缺省取该乐器列表里的第一种；力度 v∈[0,1] 线性映到该 tech 的力度级（相邻两级之间按小数部分以确定性哈希择一，避免整齐的分界）；
   级内按 rr（乐谱逐击递增的计数；缺省用时刻哈希）轮换。e.lv 可直接指定级序号（0 起）。 */
function pickVcsl(list, e) {
  const tech = e.tech || list[0].tech;
  const g = list.filter((x) => x.tech === tech);
  if (!g.length) throw new Error(`${e.i} 无演奏法 ${tech}`);
  const lvs = [...new Set(g.map((x) => x.lv))].sort((p, q) => p - q), nL = lvs.length;
  const rr = e.rr != null ? e.rr : Math.round(e.t * 1000);
  let li;
  if (e.lv != null) li = Math.max(0, Math.min(nL - 1, e.lv));
  else {
    const x = Math.max(0, Math.min(1, e.v == null ? .7 : e.v)) * (nL - 1), f = Math.floor(x);
    li = Math.min(nL - 1, f + (hash01(rr * 131 + 7) < x - f ? 1 : 0));
  }
  const layer = g.filter((s) => s.lv === lvs[li]).sort((p, q) => p.rr - q.rr || (p.file < q.file ? -1 : 1));
  return layer[((rr % layer.length) + layer.length) % layer.length];
}
export function loadLib(dir = SAMPLES) {
  const man = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const lib = {};
  const add = (key, s, file, useOffset) => {
    const w = readWav(file), off = useOffset ? (s.sourceOffsetFrames || 0) : 0;
    let L = w.ch[0].subarray(off), R = (w.ch[1] || w.ch[0]).subarray(off);
    L = resample(L, w.sr, SR); R = w.ch.length > 1 ? resample(R, w.sr, SR) : L;
    const n = L.length, pl = new Float32Array(n + PAD * 2), pr = new Float32Array(n + PAD * 2);
    pl.set(L, PAD); pr.set(R, PAD);
    const e = { key, root: s.rootMidi, L: pl, R: pr, n, stereo: w.ch.length > 1, file: path.basename(file) };
    (lib[key] = lib[key] || []).push(e);
    return e;
  };
  for (const s of man.samples) {
    for (const [k, inst] of Object.entries(SRC_INST)) if (s.instrument === inst) add(k, s, path.join(dir, s.id + '-source.wav'), true);
    for (const [k, inst] of Object.entries(PROC_INST)) if (s.instrument === inst) add(k, s, path.join(dir, s.id + '.wav'), false);
  }
  loadCc0(lib);
  loadVcsl(lib);
  /* 电平校准：持续音按 1–3.5s 的 RMS、拨弦按前 0.25s 的 RMS、打击按峰值，对齐到同一参考 */
  const rms = (e, a, b) => { let s = 0, c = 0; for (let i = PAD + Math.floor(a * SR); i < PAD + Math.min(e.n, Math.floor(b * SR)); i++) { s += e.L[i] * e.L[i] + e.R[i] * e.R[i]; c += 2; } return Math.sqrt(s / Math.max(1, c)); };
  const peak = (e) => { let p = 0; for (let i = 0; i < e.L.length; i++) p = Math.max(p, Math.abs(e.L[i]), Math.abs(e.R[i])); return p; };
  for (const [k, list] of Object.entries(lib)) for (const e of list) {
    if (['cello', 'bowed', 'flute', 'xun'].includes(k)) e.g = .1 / rms(e, 1, 3.5);
    else if (k === 'zheng' || k === 'dan') e.g = .2 / rms(e, 0, .25);
    else e.g = .7 / peak(e);
    if (['cello', 'bowed', 'flute', 'xun'].includes(k)) makeLoop(e);
  }
  for (const list of Object.values(lib)) list.sort((a, b) => a.root - b.root);
  return lib;
}
/* 循环区：持续段 [ls, le) 末尾 xf 秒与 ls 之前的同长一段等功率交叉，读到 le 跳回 ls 无缝 */
function makeLoop(e) {
  const dur = e.n / SR, ls = 1.6, le = Math.max(ls + 2.5, dur - 1.9), xf = .6;
  const A = Math.floor(ls * SR) + PAD, B = Math.floor(le * SR) + PAD, X = Math.floor(xf * SR), D = B - A;
  for (const ch of [e.L, e.R]) {
    if (e.L === e.R && ch === e.R) break;
    for (let k = 0; k < X; k++) {
      const i = B - X + k, u = k / X, fo = Math.cos(u * Math.PI / 2), fi = Math.sin(u * Math.PI / 2);
      ch[i] = ch[i] * fo + ch[i - D] * fi;
    }
  }
  e.loop = { a: A, b: B };
}
/* 按音高取根音：±4 半音内最近者；rr 交替时取次近者（音色轮换） */
function pick(list, m, rr, tol = 4.01) {
  const c = list.map((e) => ({ e, d: m - e.root })).filter((x) => Math.abs(x.d) <= tol).sort((a, b) => Math.abs(a.d) - Math.abs(b.d) || a.d - b.d);
  if (!c.length) return null;
  return (rr && c.length > 1 ? c[1] : c[0]).e;
}

/* ================= 渲染核心 ================= */
function hermite(a, p) {
  const i = p | 0, f = p - i, xm = a[i - 1], x0 = a[i], x1 = a[i + 1], x2 = a[i + 2];
  return ((((.5 * (x2 - xm) + 1.5 * (x0 - x1)) * f + (xm - 2.5 * x0 + 2 * x1 - .5 * x2)) * f + .5 * (x1 - xm)) * f + x0);
}
function pl(keys, x) {                                   // 分段线性
  if (!keys || !keys.length) return 0;
  if (x <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (x <= keys[i][0]) { const a = keys[i - 1], b = keys[i], d = b[0] - a[0]; return d <= 0 ? b[1] : a[1] + (b[1] - a[1]) * (x - a[0]) / d; }
  return keys[keys.length - 1][1];
}
/* 确定性哈希（同文件里合成层用的 mulberry 式整数混洗；不用 Math.random） */
function hash01(n) {
  let t = (Math.imul(n | 0, 2654435761) + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function panG(p, stereo) {
  p = Math.max(-1, Math.min(1, p || 0));
  if (stereo) return [p > 0 ? 1 - .7 * p : 1, p < 0 ? 1 + .7 * p : 1];
  const th = (p + 1) * Math.PI / 4; return [Math.cos(th) * Math.SQRT2 * .85, Math.sin(th) * Math.SQRT2 * .85];
}
function biq(fc, q) {                                   // RBJ 低通系数
  const w = 2 * Math.PI * Math.min(fc, SR * .45) / SR, al = Math.sin(w) / (2 * q), c = Math.cos(w), a0 = 1 + al;
  return [(1 - c) / 2 / a0, (1 - c) / a0, (1 - c) / 2 / a0, -2 * c / a0, (1 - al) / a0];
}

export class Mix {
  constructor(t0, t1, lib) {
    this.t0 = t0; this.t1 = t1; this.lib = lib;
    this.n = Math.ceil((t1 - t0) * SR);
    this.dL = new Float32Array(this.n); this.dR = new Float32Array(this.n);
    this.sL = new Float32Array(this.n); this.sR = new Float32Array(this.n);
    this.muf = null; this.kills = []; this.cuts = []; this.count = 0; this.warn = []; this.qc = 0;
  }
  /* 写入：src 为 [L, R]（长度 len），自全局时刻 t 起；gs 为送混响量 */
  put(t, L, R, len, gs) {
    let i0 = Math.round((t - this.t0) * SR), a = 0, m = len;
    for (const tc of this.cuts) if (t < tc) m = Math.min(m, Math.round((tc - t) * SR));   // 带 tail 的硬停：切点前起的声音（干声与送混响量）到切点为止
    if (i0 < 0) { a = -i0; i0 = 0; }
    m = Math.min(m - a, this.n - i0);
    for (let k = 0; k < m; k++) { const l = L[a + k], r = R[a + k]; this.dL[i0 + k] += l; this.dR[i0 + k] += r; if (gs) { this.sL[i0 + k] += l * gs; this.sR[i0 + k] += r * gs; } }
    this.count++;
  }
  mufAt(t) { return this.muf ? pl(this.muf, t) : 20000; }
  /* 采样音符：e = {i, t, m, v, d, att, rel, off, pan, send, env, bend, vib, lp, mf, rr, cut} */
  note(e) {
    if (e.i === 'bell') return this.bell(e);
    if (e.i === 'pipa' || e.tech === 'lun' || e.tech === 'sao') return this.pipa(e);
    let list = this.lib[e.i];
    if (!list) throw new Error('无此乐器 ' + e.i);
    const v = e.v == null ? .7 : e.v;
    if (e.i === 'tube') {                                     // 管钟：同一音名按力度取 ff/fff 或 p/pp
      const f = list.filter((x) => x.dyn === (v >= .6 ? 'hi' : 'lo'));
      if (f.length) list = f;
    }
    let s = pick(list, e.m, e.rr, e.i === 'xun' ? 14.01 : 4.01);   // 埙：陶笛整体下移约一个八度，音色更暗更近埙
    if (!s && e.i === 'zheng') s = pick(this.lib.dan, e.m, e.rr);      // 古筝高低音域外由越南筝补
    if (!s) { this.warn.push(`${e.i} ${e.m} 超出音域 @${e.t.toFixed(2)}`); return; }
    const sus = !!s.loop;
    const rel = e.rel != null ? e.rel : sus ? .45 : .25;
    const natural = (s.n - Math.floor((e.off || 0) * SR)) / SR;          // 采样自然长度（拨弦）
    const hold = e.d != null ? e.d : sus ? 2 : natural;
    const len = Math.max(8, Math.floor((sus ? hold + rel : Math.min(natural, hold + rel)) * SR));
    if (e.t + len / SR < this.t0 || e.t > this.t1) return;
    const L = new Float32Array(len), R = new Float32Array(len);
    const ge = e.i === 'xun' ? new Float32Array(len) : null;      // 埙：记下包络，气声随音走
    const base = Math.pow(2, (e.m - s.root) / 12);
    let pos = PAD + (e.off || 0) * SR;
    const att = Math.max(.0015, e.att != null ? e.att : sus ? .06 : .002), attN = att * SR, relN = rel * SR, holdN = hold * SR;
    const vel = Math.pow(Math.max(0, v), 1.6) * s.g * (e.gain || 1);
    /* 力度→亮度：拨弦单极点低通，弱奏更暗 */
    const fc = e.lp || (sus ? 16000 : 1800 + 15000 * Math.pow(Math.min(1, v), 2));
    const a1 = 1 - Math.exp(-2 * Math.PI * fc / SR);
    let yl = 0, yr = 0;
    const useMuf = e.mf !== false && this.muf;
    let bc = null, z = [0, 0, 0, 0, 0, 0, 0, 0];
    const lp = s.loop;
    let ratio = base;
    for (let k = 0; k < len; k++) {
      if ((k & 63) === 0) {
        const dt = k / SR;
        let c = e.bend ? pl(e.bend, dt) * 100 : 0;
        if (e.vib) { const vb = e.vib, w = Math.max(0, Math.min(1, (dt - (vb.at || .25)) / (vb.ramp || .4))); c += Math.sin(2 * Math.PI * (vb.f || 5.5) * dt) * (vb.c || 25) * w; }
        ratio = base * (c ? Math.pow(2, c / 1200) : 1);
        if (useMuf) { const f = this.mufAt(e.t + dt); bc = f < 19000 ? biq(f, .8) : null; }
      }
      if (lp && pos >= lp.b) pos -= lp.b - lp.a;
      if (pos >= s.n + PAD - 2) break;
      let l = hermite(s.L, pos), r = s.stereo ? hermite(s.R, pos) : l;
      pos += ratio;
      let g = k < attN ? (sus && att > .05 ? Math.sin(k / attN * Math.PI / 2) : k / attN) : 1;   // 持续音长起音/收音用等功率曲线，便于交叠换弓
      if (k > holdN) { const x = Math.min(1, (k - holdN) / relN); g *= sus ? Math.cos(x * Math.PI / 2) : (1 - x) * (1 - x); }
      if (e.env) g *= pl(e.env, k / SR);
      if (e.genv) g *= pl(e.genv, e.t + k / SR);
      if (ge) ge[k] = g;
      yl += a1 * (l - yl); yr += a1 * (r - yr);
      l = yl * g * vel; r = yr * g * vel;
      if (bc) {
        const ol = bc[0] * l + bc[1] * z[0] + bc[2] * z[1] - bc[3] * z[2] - bc[4] * z[3]; z[1] = z[0]; z[0] = l; z[3] = z[2]; z[2] = ol; l = ol;
        const or = bc[0] * r + bc[1] * z[4] + bc[2] * z[5] - bc[3] * z[6] - bc[4] * z[7]; z[5] = z[4]; z[4] = r; z[7] = z[6]; z[6] = or; r = or;
      }
      L[k] = l; R[k] = r;
    }
    if (e.i === 'xun') {
      /* 埙：一阶低通 2200Hz，再叠白噪声经 800–2500Hz 带通、电平为该音 RMS 的 6%，随包络 */
      const a = 1 - Math.exp(-2 * Math.PI * 2200 / SR);
      let lpL = 0, lpR = 0;
      for (let k = 0; k < len; k++) { lpL += a * (L[k] - lpL); lpR += a * (R[k] - lpR); L[k] = lpL; R[k] = lpR; }
      let se = 0; for (let k = 0; k < len; k++) se += L[k] * L[k] + R[k] * R[k];
      const nr = Math.sqrt(se / Math.max(1, 2 * len));
      const f0 = Math.sqrt(800 * 2500), qb = f0 / (2500 - 800);
      const w0 = 2 * Math.PI * f0 / SR, al = Math.sin(w0) / (2 * qb), c0 = Math.cos(w0), a0 = 1 + al;
      const b0 = al / a0, b2 = -al / a0, a1b = -2 * c0 / a0, a2b = (1 - al) / a0;
      let seed = (Math.round(e.t * 1000) * 2654435761 + e.m * 7919) >>> 0;
      const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
      const nL = new Float32Array(len), nR = new Float32Array(len);
      let xl1 = 0, xl2 = 0, yl1 = 0, yl2 = 0, xr1 = 0, xr2 = 0, yr1 = 0, yr2 = 0;
      for (let k = 0; k < len; k++) {
        const xl = rnd(), xr = rnd();
        const ol = b0 * xl + b2 * xl2 - a1b * yl1 - a2b * yl2; xl2 = xl1; xl1 = xl; yl2 = yl1; yl1 = ol;
        const or = b0 * xr + b2 * xr2 - a1b * yr1 - a2b * yr2; xr2 = xr1; xr1 = xr; yr2 = yr1; yr1 = or;
        nL[k] = ol; nR[k] = or;
      }
      let sn = 0; for (let k = 0; k < len; k++) sn += nL[k] * nL[k] + nR[k] * nR[k];
      const nn = Math.sqrt(sn / Math.max(1, 2 * len)), ng = nn > 1e-9 ? .06 * nr / nn : 0;
      for (let k = 0; k < len; k++) { L[k] += nL[k] * ng * ge[k]; R[k] += nR[k] * ng * ge[k]; }
    }
    const [gl, gr] = panG(e.pan, s.stereo);
    for (let k = 0; k < len; k++) { L[k] *= gl; R[k] *= gr; }
    this.put(e.t, L, R, len, e.send == null ? .25 : e.send);
  }
  /* 琵琶（用古筝采样改演奏法）：tech 'lun' 轮指 | 'sao' 扫弦；无 tech 等同 zheng */
  pipa(e) {
    const v = e.v == null ? .7 : e.v;
    if (e.tech === 'lun') {
      const d = e.d != null ? e.d : 1, n = Math.max(1, Math.floor(d * 12 + 1e-6));
      for (let i = 0; i < n; i++) {
        const ti = e.t + i / 12;
        if (ti >= e.t + d - 1e-9) break;
        const vv = v * (.82 + .18 * hash01(Math.round(e.t * 1000) * 131 + i * 17 + e.m));
        this.note({ ...e, i: 'zheng', tech: undefined, t: ti, v: vv, d: .12, rel: .015 });
      }
      return;
    }
    if (e.tech === 'sao') {
      const ch = (e.chord || []).slice().sort((a, b) => a - b);
      ch.forEach((m, j) => this.note({ ...e, i: 'zheng', tech: undefined, chord: undefined, t: e.t + j * .025, m }));
      return;
    }
    this.note({ ...e, i: 'zheng', tech: undefined });
  }
  /* 编钟：加性合成（非谐和分音＋第二音高）＋手铃激励；峰值对齐 .7 */
  bell(e) {
    const f = 440 * Math.pow(2, (e.m - 69) / 12);
    const dur = Math.max(7, (e.d || 0) + 5), len = Math.ceil(dur * SR);
    const L = new Float32Array(len), R = new Float32Array(len);
    const mul = [1, 2.76, 5.40, 8.93], amp = [1, .55, .32, .18], t60 = [6, 3.2, 1.6, .9];
    const att = Math.max(1, Math.floor(.004 * SR));
    for (let k = 0; k < len; k++) {
      const t = k / SR, a = k < att ? k / att : 1;
      let s = 0;
      for (let j = 0; j < 4; j++) s += amp[j] * Math.exp(-6.91 * t / t60[j]) * Math.sin(2 * Math.PI * f * mul[j] * t);
      s += .22 * Math.exp(-6.91 * t / 4) * Math.sin(2 * Math.PI * f * 1.19 * t);
      L[k] = R[k] = s * a;
    }
    const cs = pick(this.lib.chime || [], e.m);
    if (cs) {
      const base = Math.pow(2, (e.m - cs.root) / 12);
      for (let k = 0; k < len; k++) {
        const pos = PAD + k * base;
        if (pos >= cs.n + PAD - 2) break;
        const l = hermite(cs.L, pos) * .35, r = (cs.stereo ? hermite(cs.R, pos) : l) * .35;
        L[k] += l; R[k] += r;
      }
    }
    let pk = 0; for (let k = 0; k < len; k++) pk = Math.max(pk, Math.abs(L[k]), Math.abs(R[k]));
    const g = .7 / Math.max(pk, 1e-9);
    const vel = Math.pow(Math.max(0, e.v == null ? .7 : e.v), 1.6) * (e.gain || 1);
    const [gl, gr] = panG(e.pan, true);
    for (let k = 0; k < len; k++) { L[k] *= g * vel * gl; R[k] *= g * vel * gr; }
    this.put(e.t, L, R, len, e.send == null ? .3 : e.send);
  }
  /* 打击：e = {i: drum|gong|cym|snare|qing|bd|tomH|tomL|frameL|frameS|luo|nao|bang|slit, t, v, rate, rev, d, lp, hp, pan, send, rr, mf}
     VCSL 乐器另收 tech（演奏法，见 VCSL_MAP）、lv（直接指定力度级）、align:'peak'（采样峰值对到 t） */
  hit(e) {
    const list = this.lib[e.i]; if (!list) throw new Error('无此打击 ' + e.i);
    let s, rate = e.rate || 1;
    if (e.i === 'qing') {                                    // 磬：无音高采样依次轮换；midi 只作移调；qi 可直接指定第几条（移植旧谱段落时按原渲染的轮换位置取）
      s = e.qi != null ? list[e.qi % list.length] : list[this.qc++ % list.length];
      rate = Math.pow(2, ((e.m == null ? 60 : e.m) - 60) / 12);
    } else if (list[0].vcsl) {                               // VCSL：力度分级＋级内轮换；每击另加 ±0.8% 的确定性变速，免得同一条采样机械重复
      s = pickVcsl(list, e);
      rate *= 1 + (hash01((e.rr != null ? e.rr : Math.round(e.t * 1000)) * 7919 + s.n) - .5) * .016;
    } else s = list[(e.rr || 0) % list.length];
    const nat = (s.n / rate) / SR, d = Math.min(nat, e.d != null ? e.d : nat), rel = e.rel || .08;
    const len = Math.floor((e.rev ? d : Math.min(nat, d + rel)) * SR);   // 反向：取原采样前 d 秒倒放
    const L = new Float32Array(len), R = new Float32Array(len);
    const vel = Math.pow(Math.max(0, e.v == null ? .7 : e.v), 1.4) * s.g * (e.gain || 1);
    const a1 = e.lp ? 1 - Math.exp(-2 * Math.PI * e.lp / SR) : 1, h1 = e.hp ? Math.exp(-2 * Math.PI * e.hp / SR) : 0;
    let yl = 0, yr = 0, hl = 0, hr = 0, pl0 = 0, pr0 = 0;
    const useMuf = e.mf !== false && this.muf; let bc = null; const z = [0, 0, 0, 0, 0, 0, 0, 0];
    const fadeIn = e.att ? e.att * SR : e.rev ? len * .3 : 0;
    for (let k = 0; k < len; k++) {
      if (useMuf && (k & 63) === 0) { const f = this.mufAt((e.rev ? e.t - len / SR : e.t) + k / SR); bc = f < 19000 ? biq(f, .8) : null; }
      const p = e.rev ? PAD + (len - 1 - k) * rate : PAD + k * rate;
      if (p < 1 || p >= s.n + PAD - 2) { if (e.rev) continue; break; }
      let l = hermite(s.L, p), r = s.stereo ? hermite(s.R, p) : l;
      yl += a1 * (l - yl); yr += a1 * (r - yr); l = yl; r = yr;
      if (h1) { const nl = h1 * (hl + l - pl0), nr = h1 * (hr + r - pr0); pl0 = l; pr0 = r; hl = nl; hr = nr; l = nl; r = nr; }
      let g = vel;
      if (!e.rev && k / SR > d) g *= Math.max(0, 1 - (k / SR - d) / rel);
      if (e.rev && k > len - 32) g *= (len - k) / 32;
      if (fadeIn && k < fadeIn) g *= k / fadeIn;
      if (e.env) g *= pl(e.env, k / SR);
      l *= g; r *= g;
      if (bc) {
        const ol = bc[0] * l + bc[1] * z[0] + bc[2] * z[1] - bc[3] * z[2] - bc[4] * z[3]; z[1] = z[0]; z[0] = l; z[3] = z[2]; z[2] = ol; l = ol;
        const or = bc[0] * r + bc[1] * z[4] + bc[2] * z[5] - bc[3] * z[6] - bc[4] * z[7]; z[5] = z[4]; z[4] = r; z[7] = z[6]; z[6] = or; r = or;
      }
      L[k] = l; R[k] = r;
    }
    const [gl, gr] = panG(e.pan, s.stereo);
    for (let k = 0; k < len; k++) { L[k] *= gl; R[k] *= gr; }
    const t = e.rev ? e.t - len / SR : e.align === 'peak' && s.pkT != null ? e.t - s.pkT / rate : e.t;   // 反向：在 t 处收尾（吸气）；align 'peak'：采样峰值落在 t
    this.put(t, L, R, len, e.send == null ? .2 : e.send);
  }
  /* 合成层：sub 低频鼓体（正弦下滑）| noise 滤波噪声（风/热浪/地鸣，带通中心与幅度可自动化） */
  synth(e) {
    const len = Math.floor(e.d * SR), L = new Float32Array(len), R = new Float32Array(len);
    let seed = (e.seed || 7) * 2654435761 >>> 0;
    const rnd = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const v = e.v == null ? .5 : e.v;
    if (e.type === 'sub') {
      const f0 = e.f0 || 72, f1 = e.f1 || 38, dec = e.dec || .5; let ph = 0;
      for (let k = 0; k < len; k++) {
        const t = k / SR, f = f1 + (f0 - f1) * Math.exp(-t / .07);
        ph += 2 * Math.PI * f / SR;
        const g = Math.min(1, t / .004) * Math.exp(-t / dec) * v;
        L[k] = R[k] = Math.sin(ph) * g;
      }
    } else {
      /* 噪声：棕噪→双极点带通（中心 f 可随 fk 自动化）→幅度 keys；左右独立 */
      const fk = e.fk || [[0, e.f || 300]], q = e.q || .7, keys = e.keys || [[0, 1]];
      for (const [buf, sd] of [[L, 1], [R, 2]]) {
        seed = ((e.seed || 7) * 7919 + sd * 104729) >>> 0;
        let b = null, z1 = 0, z2 = 0, y1 = 0, y2 = 0, br = 0, am = 0, amT = 0;
        for (let k = 0; k < len; k++) {
          const t = k / SR;
          if ((k & 63) === 0) {
            const f = pl(fk, t), w = 2 * Math.PI * Math.min(f, SR * .4) / SR, al = Math.sin(w) / (2 * q), c = Math.cos(w), a0 = 1 + al;
            b = [al / a0, 0, -al / a0, -2 * c / a0, (1 - al) / a0];
            if ((k & 4095) === 0) amT = .55 + .45 * rnd();
          }
          br = (br + .02 * (rnd() * 2 - 1)) / 1.02;
          const x = br * 3.5 + (e.white || 0) * (rnd() * 2 - 1);
          const y = b[0] * x + b[1] * z1 + b[2] * z2 - b[3] * y1 - b[4] * y2; z2 = z1; z1 = x; y2 = y1; y1 = y;
          am += (amT - am) * (e.gust ? .00005 : 0);
          buf[k] = y * pl(keys, t) * v * (e.gust ? (1 - e.gust + e.gust * am) : 1);
        }
      }
    }
    if (e.att || e.rel) for (let k = 0; k < len; k++) { const t = k / SR; let g = 1; if (e.att && t < e.att) g = t / e.att; if (e.rel && t > e.d - e.rel) g *= Math.max(0, (e.d - t) / e.rel); L[k] *= g; R[k] *= g; }
    const [gl, gr] = panG(e.pan, true);
    for (let k = 0; k < len; k++) { L[k] *= gl; R[k] *= gr; }
    this.put(e.t, L, R, len, e.send == null ? .15 : e.send);
  }
}

/* ================= 混响：生成式冲激响应（早期反射＋高频随时间加速衰减的指数尾），ffmpeg afir 卷积 ================= */
function makeIR(sec = 4.2, rt = 2.8) {
  const n = Math.floor(sec * SR), out = [];
  for (let ch = 0; ch < 2; ch++) {
    const d = new Float32Array(n);
    let seed = 99 + ch * 7, lp = 0;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
    const pre = Math.floor(.022 * SR);
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / SR, fc = 9000 * Math.exp(-t / 1.1) + 1400, a = 1 - Math.exp(-2 * Math.PI * fc / SR);
      lp += a * (rnd() - lp);
      d[i] = lp * Math.exp(-6.91 * t / rt) * Math.min(1, t / .03);
    }
    for (let k = 0; k < 14; k++) { const i = pre + Math.floor(SR * (.004 + .075 * Math.abs(rnd()))); d[i] += rnd() * .5 * (1 - k / 16); }
    let e = 0; for (let i = 0; i < n; i++) e += d[i] * d[i];
    const g = 1 / Math.sqrt(e); for (let i = 0; i < n; i++) d[i] *= g;
    out.push(d);
  }
  return out;
}
export function convolve(sL, sR, tmp) {
  const u = `${process.pid}`, a = path.join(tmp, `_send-${u}.wav`), b = path.join(tmp, `_ir-${u}.wav`), c = path.join(tmp, `_wet-${u}.wav`);   // 临时文件带 PID：两个构建并发写同一 --out 时不会互删（11-01 gates4 配乐退出 2 的成因）
  const padN = Math.floor(5 * SR), L = new Float32Array(sL.length + padN), R = new Float32Array(sR.length + padN);
  L.set(sL); R.set(sR);
  writeWav(a, [L, R], SR, true);
  writeWav(b, makeIR(), SR, true);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', a, '-i', b, '-filter_complex', '[0:a][1:a]afir=dry=1:wet=1:irnorm=-1:irgain=1:maxir=10[o]', '-map', '[o]', '-c:a', 'pcm_f32le', c]);
  const w = readWav(c);
  for (const f of [a, b, c]) fs.rmSync(f, { force: true });
  if (w.n < sL.length) throw new Error(`混响输出过短 ${w.n} < ${sL.length}`);
  return [w.ch[0].subarray(0, sL.length), w.ch[1].subarray(0, sR.length)];
}

/* ================= 响度（BS.1770-4）与限幅 ================= */
function kCoefs() {
  let f0 = 1681.974450955533, G = 3.999843853973347, Q = .7071752369554196, K = Math.tan(Math.PI * f0 / SR);
  const Vh = Math.pow(10, G / 20), Vb = Math.pow(Vh, .4996667741545416), a0 = 1 + K / Q + K * K;
  const s1 = [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0];
  f0 = 38.13547087602444; Q = .5003270373238773; K = Math.tan(Math.PI * f0 / SR);
  const d = 1 + K / Q + K * K;
  const s2 = [1, -2, 1, 2 * (K * K - 1) / d, (1 - K / Q + K * K) / d];
  return [s1, s2];
}
/* 返回每 100ms 一格的 K 加权均方（两声道和），供积分响度/短时/瞬时计算 */
export function kPower(L, R) {
  const [s1, s2] = kCoefs(), hop = SR / 10, nb = Math.floor(L.length / hop), out = new Float64Array(nb);
  for (const x of [L, R]) {
    let a1 = 0, a2 = 0, b1 = 0, b2 = 0, c1 = 0, c2 = 0, d1 = 0, d2 = 0;
    for (let j = 0; j < nb; j++) {
      let s = 0;
      for (let i = j * hop; i < (j + 1) * hop; i++) {
        const v = x[i], y = s1[0] * v + s1[1] * a1 + s1[2] * a2 - s1[3] * b1 - s1[4] * b2; a2 = a1; a1 = v; b2 = b1; b1 = y;
        const w = s2[0] * y + s2[1] * c1 + s2[2] * c2 - s2[3] * d1 - s2[4] * d2; c2 = c1; c1 = y; d2 = d1; d1 = w;
        s += w * w;
      }
      out[j] += s / hop;
    }
  }
  return out;
}
const LU = (p) => -0.691 + 10 * Math.log10(Math.max(p, 1e-20));
export function loudness(pw) {                            // 积分响度（400ms 块、75% 重叠、绝对 −70 / 相对 −10 门限）
  const blocks = [];
  for (let j = 0; j + 4 <= pw.length; j++) blocks.push((pw[j] + pw[j + 1] + pw[j + 2] + pw[j + 3]) / 4);
  const g1 = blocks.filter((p) => LU(p) > -70);
  if (!g1.length) return -Infinity;
  const m1 = g1.reduce((a, b) => a + b, 0) / g1.length, thr = LU(m1) - 10;
  const g2 = g1.filter((p) => LU(p) > thr);
  return LU(g2.reduce((a, b) => a + b, 0) / g2.length);
}
export function shortTerm(pw) { const o = []; for (let j = 0; j < pw.length; j++) { let s = 0, c = 0; for (let k = Math.max(0, j - 29); k <= j; k++) { s += pw[k]; c++; } o.push(LU(s / c)); } return o; }
export function momentary(pw) { const o = []; for (let j = 0; j < pw.length; j++) { let s = 0, c = 0; for (let k = Math.max(0, j - 3); k <= j; k++) { s += pw[k]; c++; } o.push(LU(s / c)); } return o; }
/* 4× 过采样峰值（真峰近似）：对每点用 Hermite 在 .25/.5/.75 处插值 */
function tpAbs(x, i) { let m = Math.abs(x[i]); if (i > 0 && i < x.length - 2) for (const f of [.25, .5, .75]) { const p = i + f; m = Math.max(m, Math.abs(hermite(x, p))); } return m; }
export function limitPeak(L, R, ceil) { return limit(L, R, ceil); }   // v5：给 music-v5-finish 用（只导出，不改行为）
function limit(L, R, ceil) {
  const n = L.length, la = Math.floor(.006 * SR), pk = new Float32Array(n);
  for (let i = 0; i < n; i++) pk[i] = Math.max(tpAbs(L, i), tpAbs(R, i));
  const gr = new Float32Array(n), dq = new Int32Array(n); let h = 0, t = 0;   // 前视窗口最大值（单调队列）
  for (let i = n - 1; i >= 0; i--) {
    while (t > h && pk[dq[t - 1]] <= pk[i]) t--;
    dq[t++] = i;
    while (dq[h] > i + la) h++;
    const m = pk[dq[h]]; gr[i] = m > ceil ? ceil / m : 1;
  }
  const rel = 1 - Math.exp(-1 / (.15 * SR)), att = 1 - Math.exp(-1 / (.0022 * SR));
  let g = 1, red = 0;
  for (let i = 0; i < n; i++) { g = Math.min(gr[i], g + (1 - g) * rel); gr[i] = g; }
  g = 1; for (let i = n - 1; i >= 0; i--) { g = Math.min(gr[i], g + (1 - g) * att); gr[i] = g; if (g < .999) red++; }
  for (let i = 0; i < n; i++) { L[i] *= gr[i]; R[i] *= gr[i]; }
  return red / SR;
}

/* ================= 主流程 ================= */
function arg(k, d) { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; }
async function main() {
  const t00 = Date.now();
  const cuesFile = path.resolve(arg('--cues', path.join(HERE, 'out', 'music-v2', 'cues.json')));
  const outDir = path.resolve(arg('--out', path.join(HERE, 'out', 'music-v2')));
  const cues = JSON.parse(fs.readFileSync(cuesFile, 'utf8'));
  const name = arg('--name', 'master');
  const from = +arg('--from', 0), to = +arg('--to', cues.duration);   // 整片音轨长度＝全片时长（cue 表实时给出；末尾 0.4s 淡出防爆音）
  fs.mkdirSync(outDir, { recursive: true });
  const lib = loadLib();
  const { buildScore } = await import(pathToFileURL(path.join(HERE, 'score', process.env.SCORE || 'score-v3.mjs')).href);
  const sc = buildScore(cues);
  const mix = new Mix(from, to, lib);
  mix.muf = sc.muffle && sc.muffle.length ? sc.muffle : null;
  mix.cuts = (sc.kills || []).filter((k) => k.tail).map((k) => k.t0);
  let nn = 0;
  for (const e of sc.events) {
    const end = e.t + (e.d || 0) + 12;
    if (end < from || e.t > to + 2) continue;
    if (e.k === 'n') mix.note(e); else if (e.k === 'p') mix.hit(e); else if (e.k === 's') mix.synth(e);
    nn++;
  }
  console.log(`music-render: ${nn} 个事件（乐谱共 ${sc.events.length}），${((Date.now() - t00) / 1000).toFixed(1)}s`);
  if (mix.warn.length) console.log('  警告：' + mix.warn.slice(0, 8).join('；') + (mix.warn.length > 8 ? ` …共 ${mix.warn.length}` : ''));
  const [wL, wR] = convolve(mix.sL, mix.sR, outDir);
  for (const k of sc.kills || []) {                   // 带 tail 的硬停：切点起 6s（> 冲激响应 4.2s）的混响只由切点后的送量重算，切点前的混响尾不会在窗后回涌
    if (!k.tail) continue;
    const a = Math.max(0, Math.round((k.t0 - from) * SR)), b = Math.min(mix.n, a + Math.round(6 * SR));
    if (b <= a) continue;
    const [lL, lR] = convolve(mix.sL.slice(a, b), mix.sR.slice(a, b), outDir);
    wL.set(lL, a); wR.set(lR, a);
  }
  const WET = sc.wet || .55;
  const L = mix.dL, R = mix.dR;
  for (let i = 0; i < L.length; i++) { L[i] += wL[i] * WET; R[i] += wR[i] * WET; }
  /* 硬停窗：干声与混响尾一起切（5ms 斜坡），窗内恒为数字零；带 tail 的窗，窗前的声音与混响尾到窗后也不再回来（见上） */
  for (const k of sc.kills || []) {
    const a = Math.round((k.t0 - from) * SR), b = Math.round((k.t1 - from) * SR), r = Math.round(.005 * SR);
    for (let i = Math.max(0, a - r); i < Math.min(L.length, b); i++) { const g = i < a ? (a - i) / r : 0; L[i] *= g; R[i] *= g; }
  }
  if (!arg('--to', null)) { const f = Math.round(.4 * SR); for (let i = Math.max(0, L.length - f); i < L.length; i++) { const g = (L.length - i) / f; L[i] *= g; R[i] *= g; } }
  /* 低切 25Hz（二阶），去直流与次声 */
  for (const x of [L, R]) { const w = 2 * Math.PI * 25 / SR, al = Math.sin(w) / (2 * .707), c = Math.cos(w), a0 = 1 + al, b0 = (1 + c) / 2 / a0, b1 = -(1 + c) / a0, a1 = -2 * c / a0, a2 = (1 - al) / a0; let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < x.length; i++) { const v = x[i], y = b0 * v + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = v; y2 = y1; y1 = y; x[i] = y; } }
  for (const k of sc.kills || []) { const a = Math.round((k.t0 - from) * SR), b = Math.round((k.t1 - from) * SR); for (let i = Math.max(0, a); i < Math.min(L.length, b); i++) { L[i] = 0; R[i] = 0; } }
  /* 响度归一（预览/试听段按全片同一增益：用乐谱给的 gainDb 或自测） */
  let lufs0 = loudness(kPower(L, R)), gain;
  if (arg('--gain-db', null) != null) gain = Math.pow(10, +arg('--gain-db') / 20);
  else gain = Math.pow(10, (TARGET_LUFS - lufs0) / 20);
  for (let i = 0; i < L.length; i++) { L[i] *= gain; R[i] *= gain; }
  const limSec = limit(L, R, Math.pow(10, CEIL_DB / 20));
  let lufs = loudness(kPower(L, R));
  if (arg('--gain-db', null) == null && Math.abs(lufs - TARGET_LUFS) > .15) {   // 限幅后补一次
    const g2 = Math.pow(10, (TARGET_LUFS - lufs) / 20);
    for (let i = 0; i < L.length; i++) { L[i] *= g2; R[i] *= g2; }
    gain *= g2; limit(L, R, Math.pow(10, CEIL_DB / 20)); lufs = loudness(kPower(L, R));
  }
  let pk = 0, clip = 0; for (let i = 0; i < L.length; i++) { const p = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (p > pk) pk = p; if (p >= .999) clip++; }
  writeWav(path.join(outDir, name + '.wav'), [L, R], SR, false);
  const meta = {
    name, sr: SR, t0: from, t1: to, duration: L.length / SR, lufsRaw: +lufs0.toFixed(2), gainDb: +(20 * Math.log10(gain)).toFixed(2), lufs: +lufs.toFixed(2),
    samplePeakDb: +(20 * Math.log10(pk)).toFixed(2), clipped: clip, limitSec: +limSec.toFixed(2),
    acts: cues.acts, kills: sc.kills, marks: sc.marks, sections: sc.sections, theme: sc.theme,
    accents: [...new Set(sc.events.filter((e) => (e.k === 'p' && e.v >= .2 && !e.rev) || (e.k === 's' && e.type === 'sub' && e.v >= .15) || (e.k === 'n' && (e.i === 'zheng' || e.i === 'dan') && e.v >= .4) || (e.k === 'n' && e.att != null && e.att < .02 && e.v >= .5)).map((e) => Math.round(e.t * 10) / 10))].sort((a, b) => a - b)
  };
  fs.writeFileSync(path.join(outDir, name + '.json'), JSON.stringify(meta, null, 1));
  console.log(`music-render: ${name}.wav ${meta.duration.toFixed(1)}s  原始 ${meta.lufsRaw} LUFS → ${meta.lufs} LUFS（增益 ${meta.gainDb} dB）样本峰 ${meta.samplePeakDb} dBFS 限幅 ${meta.limitSec}s 削波 ${clip}  用时 ${((Date.now() - t00) / 1000).toFixed(1)}s`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { console.error('music-render: ' + (e && e.stack || e)); process.exit(2); });
