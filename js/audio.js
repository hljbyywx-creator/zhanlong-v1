/* 《万古云霄》音频：WebAudio 合成乐器与音效框架 ＋ 配乐 v2（预渲染音轨）。
   配乐 v2：自挂载根目录 audio-assets.js（tools/build-audio.sh 按 cue 表离线渲染、分段 MP3 内嵌），按需解码、按全片秒与画面同步；
   缺该文件时无配乐、不报错。零网络；audio/config.js 配置了 CINE_SCORE 时由 <audio> 接管配乐。
   对外：CINE.THEME、CINE.SONG_CUES、CINE.audio（init/running/clock/scheduleFrom/stopAll/tick/LEAD，wake/revivable；clips() 查配乐片段状态）。 */
(function () {
'use strict';
var CINE = window.CINE = window.CINE || {};

/* ---------- 参数与小工具 ---------- */
var Q = {};
try {
  String(window.location && window.location.search || '').replace(/^\?/, '').split('&').forEach(function (kv) {
    if (!kv) return; var p = kv.split('='); Q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '1');
  });
} catch (e) { /* 无 location 时忽略 */ }
var MUTED = Q.mute === '1' || Q.shot === '1' || Q.bench === '1';

function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
function hash(n) {
  n = (n | 0) ^ 0x9e3779b9;
  n = Math.imul(n ^ (n >>> 16), 0x85ebca6b);
  n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function rng(seed) {
  var a = (seed * 2654435761) >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* 分段线性关键帧取值：keys = [[t, v], ...] */
function kfv(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (var i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      var a = keys[i - 1], b = keys[i], d = b[0] - a[0];
      return d <= 0 ? b[1] : a[1] + (b[1] - a[1]) * (t - a[0]) / d;
    }
  }
  return keys[keys.length - 1][1];
}

/* ================= 主题旋律（占位） =================
   本片以后接入另一套采样配乐；这里只保留「按字排音」的框架：POEM 为空。
   POEM 格式：key: ['字串', '句末标点', [[midi, 拍, midi, 拍, ...] 每字一组]]；基准 1 拍 = BEAT 秒。 */
var BEAT = 0.5;
var POEM = {};
var LINES = {};
Object.keys(POEM).forEach(function (k) {
  var P = POEM[k], txt = P[0], chars = [], notes = [], t = 0;
  for (var i = 0; i < txt.length; i++) {
    var ns = P[2][i], t0 = t;
    for (var j = 0; j < ns.length; j += 2) {
      notes.push({ t: t, d: ns[j + 1] * BEAT, m: ns[j], ci: i, first: j === 0, last: j === ns.length - 2 });
      t += ns[j + 1] * BEAT;
    }
    var c = { t: t0, d: t - t0, ch: txt[i] };
    if (i === txt.length - 1) c.p = P[1];
    chars.push(c);
  }
  LINES[k] = { chars: chars, notes: notes, dur: t };
});
function cp(o) { var r = {}; for (var k in o) r[k] = o[k]; return r; }

CINE.SONG_CUES = [];   // [{ id, act, t0, t1, seq:[POEM key..], voice }]，占位为空
function songCue(id) {
  for (var i = 0; i < CINE.SONG_CUES.length; i++) if (CINE.SONG_CUES[i].id === id) return CINE.SONG_CUES[i];
  return null;
}
function segWalk(id, field) {
  var sc = songCue(id); if (!sc) return [];
  var tot = 0; sc.seq.forEach(function (k) { tot += LINES[k].dur; });
  var k = (sc.t1 - sc.t0) / tot, acc = 0, out = [];
  sc.seq.forEach(function (key, li) {
    LINES[key][field].forEach(function (x) {
      var o = cp(x); o.t = sc.t0 + (acc + x.t) * k; o.d = x.d * k; o.key = key; o.li = li; out.push(o);
    });
    acc += LINES[key].dur;
  });
  return out;
}
CINE.THEME = {
  keys: Object.keys(POEM),
  chars: function (key) { return LINES[key] ? LINES[key].chars.map(cp) : []; },
  dur: function (key) { return LINES[key] ? LINES[key].dur : 0; },
  notes: function (key) { return LINES[key] ? LINES[key].notes.map(cp) : []; },
  segChars: function (id) { return segWalk(id, 'chars'); },
  segNotes: function (id) { return segWalk(id, 'notes'); }
};

/* ================= 音频核心：上下文、总线、会话、时钟、排程 ================= */
var A = CINE.audio = { LEAD: 0.2, errors: [] };
var ctx = null, master = null, revBuf = null, NZ = {}, sess = null, cues = null, ptr = 0;
var base = 0, lat = 0, dead = false, lastRun = 0, lastCT = 0, deadAt = 0, pruneAt = 0;
var EXT = null, extOn = false, extChkAt = 0, voiceDuck = 1;
var AHEAD = 1.6, nzSeed = 1;
function vcall(fn, a) {
  var v = CINE.voice;
  if (v && typeof v[fn] === 'function') { try { v[fn](a); } catch (e) { if (A.errors.length < 20) A.errors.push('voice.' + fn + ': ' + (e && e.message || e)); } }
}
function perf() { return (window.performance ? window.performance.now() : Date.now()) / 1000; }
function W(T) { return base + T; }                     // 全局秒 → ctx 秒
function G(v) { var g = ctx.createGain(); g.gain.value = v == null ? 1 : v; return g; }

function makeIR(sec) {                                   // 生成式冲激响应：早期反射 + 渐暗的指数尾
  var sr = ctx.sampleRate, n = Math.floor(sr * sec), b = ctx.createBuffer(2, n, sr);
  for (var ch = 0; ch < 2; ch++) {
    var d = b.getChannelData(ch), r = rng(17 + ch * 101), lp = 0, pre = Math.floor(sr * .014);
    for (var i = pre; i < n; i++) {
      var t = i / sr, k = .6 - .5 * Math.min(1, t / sec);
      lp += k * ((r() * 2 - 1) - lp);
      d[i] = lp * Math.exp(-6.9 * t / sec) * Math.min(1, (i - pre) / 200);
    }
    for (var e = 0; e < 9; e++) d[pre + Math.floor(sr * r() * .08)] += (r() < .5 ? -1 : 1) * (.45 - e * .04);
  }
  return b;
}
function noiseBuf(kind, sec) {
  var sr = ctx.sampleRate, n = Math.floor(sr * sec), m = Math.floor(sr * .05);
  var b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0), r = rng(kind.length * 7 + 3);
  var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (var i = 0; i < n; i++) {
    var w = r() * 2 - 1;
    if (kind === 'white') d[i] = w * .5;
    else if (kind === 'pink') {
      b0 = .99886 * b0 + w * .0555179; b1 = .99332 * b1 + w * .0750759; b2 = .969 * b2 + w * .153852;
      b3 = .8665 * b3 + w * .3104856; b4 = .55 * b4 + w * .5329522; b5 = -.7616 * b5 - w * .016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * .5362) * .11; b6 = w * .115926;
    } else { last = (last + .02 * w) / 1.02; d[i] = last * 3.5; }
  }
  for (var j = 0; j < m; j++) d[n - m + j] = d[n - m + j] * (1 - j / m) + d[j] * (j / m);  // 循环接缝交叉淡化
  return { b: b, ls: m / sr };
}
function makeMaster() {
  var comp = ctx.createDynamicsCompressor();             // 只作安全限幅：配乐音轨已离线做过响度归一与限幅（峰 ≤ −1.6dBFS），这里不再压它的动态
  comp.threshold.value = -1.5; comp.knee.value = 1; comp.ratio.value = 20;
  comp.attack.value = .002; comp.release.value = .2;
  master = G(1); master.connect(comp); comp.connect(ctx.destination);
  revBuf = makeIR(3.4);
  NZ.white = noiseBuf('white', 4); NZ.pink = noiseBuf('pink', 6); NZ.brown = noiseBuf('brown', 6);
  KS = {};
}
/* 会话：一次 scheduleFrom 的全部节点挂在 s.out 下，stopAll 时整体淡出、断开 */
function newSess() {
  var s = { srcs: [], clips: [] };
  s.out = G(1); s.out.connect(master);
  s.rv = ctx.createConvolver(); s.rv.buffer = revBuf;
  s.rvOut = G(1); s.rv.connect(s.rvOut); s.rvOut.connect(s.out);
  s.m = G(extOn ? 0 : voiceDuck); s.m.connect(s.out);
  s.mRv = G(extOn ? 0 : voiceDuck); s.mRv.connect(s.rv);
  s.s = G(extOn ? .55 : 1); s.s.connect(s.out);
  s.sRv = G(extOn ? .55 : 1); s.sRv.connect(s.rv);
  return s;
}
function pan(node, p) {
  if (!p || !ctx.createStereoPanner) return node;
  var sp = ctx.createStereoPanner(); sp.pan.value = clamp(p, -1, 1); node.connect(sp); return sp;
}
/* 出口：bus 'm' 配乐 / 's' 音效；wet 为混响送量 */
function out(node, bus, wet, p) {
  var s = sess, dst = pan(node, p);
  dst.connect(bus === 'm' ? s.m : s.s);
  if (wet) { var g = G(wet); dst.connect(g); g.connect(bus === 'm' ? s.mRv : s.sRv); }
  return dst;
}
function track(src, end) { sess.srcs.push([src, end]); return src; }
function osc(type, f, when, end) {
  var o = ctx.createOscillator();
  if (typeof type === 'string') o.type = type; else o.setPeriodicWave(type);
  o.frequency.value = Math.min(f, ctx.sampleRate * .45); o.start(when); o.stop(end); return track(o, end);
}
function noise(kind, when, end) {
  var z = NZ[kind], src = ctx.createBufferSource();
  src.buffer = z.b; src.loop = true; src.loopStart = z.ls; src.loopEnd = z.b.duration;
  src.start(when, z.ls + hash(nzSeed++) * (z.b.duration - z.ls - .2)); src.stop(end);
  return track(src, end);
}
function filt(type, f, q, gainDb) {
  var b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f;
  if (q != null) b.Q.value = q; if (gainDb != null) b.gain.value = gainDb; return b;
}
function chainN() { for (var i = 0; i < arguments.length - 1; i++) arguments[i].connect(arguments[i + 1]); return arguments[arguments.length - 1]; }
/* 关键帧自动化：keys 为相对 c.t 的 [[t, v]...]，从全局 from 截入 */
function autom(p, keys, t0, from, mul) {
  mul = mul == null ? 1 : mul;
  var rel = from - t0;
  p.cancelScheduledValues(0);
  p.setValueAtTime(kfv(keys, rel) * mul, W(from));
  for (var i = 0; i < keys.length; i++) if (keys[i][0] > rel) p.linearRampToValueAtTime(keys[i][1] * mul, W(t0 + keys[i][0]));
}
/* 冲击包络：when 起 att 秒升到 v，再以 dec（时间常数）衰减 */
function hit(p, when, v, att, dec) {
  p.setValueAtTime(0, when); p.linearRampToValueAtTime(v, when + att); p.setTargetAtTime(0, when + att, dec);
}
function lfo(f, depth, when, end, param, type) {
  var o = osc(type || 'sine', f, when, end), g = G(depth); o.connect(g); g.connect(param); return o;
}
function run(c, from) {
  try { c.f(c, from); } catch (e) { if (A.errors.length < 20) A.errors.push(c.n + '@' + c.t.toFixed(2) + ': ' + (e && e.message || e)); }
}
function latency() {
  var l = (ctx.baseLatency || 0) + (ctx.outputLatency || 0);
  return isFinite(l) ? clamp(l, 0, .12) : 0;
}

A.init = function () {
  if (MUTED) return false;
  if (ctx) { if (ctx.state !== 'running' && ctx.resume) { var p0 = ctx.resume(); if (p0 && p0.catch) p0.catch(function () {}); } vcall('onInit'); return true; }
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  try { ctx = new AC(); } catch (e) { ctx = null; return false; }
  if (ctx.resume) { var pr = ctx.resume(); if (pr && pr.catch) pr.catch(function () {}); }
  makeMaster();
  lastRun = perf(); lastCT = ctx.currentTime;
  probeExt();
  if (clipState === 'wait') { clipState = null; decodeClips(); }
  warmKS();
  vcall('onInit');
  return true;
};
/* 空闲时预渲染提示表里用到的琴弦缓冲，避免首次用到时在帧内卡顿 */
function warmKS() {
  var todo = {}, list;
  buildCues().forEach(function (c) { if (c.n === 'qin') todo[Math.round(c.o.m) + '|' + (c.o.br || .45)] = 1; });
  todo['76|0.95'] = 1;
  list = Object.keys(todo);
  (function step() {
    if (!ctx || !list.length) return;
    for (var k = 0; k < 4 && list.length; k++) { var p = list.pop().split('|'); ksBuf(+p[0], +p[1]); }
    setTimeout(step, 30);
  })();
}
A.running = function () { return !!ctx && !dead && !MUTED && ctx.state !== 'closed'; };
/* 起播前由引擎调：请求 resume，重置 2.5s 宽限计时，已判死的清掉 dead（Safari 睡眠/后台/换耳机挂起过的上下文借此复活；
   若 2.5s 内仍起不来会再次判死，画面照旧转墙钟续走） */
A.wake = function () {
  if (!ctx || MUTED || ctx.state === 'closed') return false;
  if (ctx.state !== 'running' && ctx.resume) { var p0 = ctx.resume(); if (p0 && p0.catch) p0.catch(function () {}); }
  dead = false; lastRun = perf(); lastCT = ctx.currentTime - lat;
  return true;
};
/* 播放中判死后上下文又回到 running：引擎据此按当前时刻重排（暂停再起播） */
A.revivable = function () { return !!ctx && dead && !MUTED && ctx.state === 'running'; };
/* 与 AudioContext 对齐的时钟（已扣输出延迟）。上下文迟迟不启动（>2.5s）则转为墙钟续走，画面不冻死。 */
A.clock = function () {
  var p = perf();
  if (!ctx) return p;
  if (!dead) {
    if (ctx.state === 'running') { lastRun = p; lastCT = ctx.currentTime - lat; return lastCT; }
    if (p - lastRun < 2.5) return lastCT;
    dead = true; deadAt = p; A.stopAll(true);
  }
  return lastCT + (p - deadAt);
};
A.scheduleFrom = function (T0) {
  if (!ctx || dead || MUTED) return;
  if (sess) A.stopAll();
  if (ctx.state !== 'running' && ctx.resume) { var pr = ctx.resume(); if (pr && pr.catch) pr.catch(function () {}); }
  buildCues();
  lat = latency(); lastRun = perf(); lastCT = ctx.currentTime - lat;
  base = A.clock() + A.LEAD - T0;
  prefetch(T0);
  sess = newSess();
  var i = 0;
  for (; i < cues.length && cues[i].t < T0; i++) if (cues[i].e > T0 + .05) run(cues[i], T0);
  ptr = i;
  vcall('scheduleFrom', T0);
  A.tick(T0);
  extStart(T0);
};
A.tick = function (T) {
  if (!sess) return;
  prefetch(T);
  var lim = T + AHEAD;
  while (ptr < cues.length && cues[ptr].t < lim) {
    var c = cues[ptr++];
    if (c.e > T - .05 || c.t > T - .08) run(c, Math.max(c.t, T));
  }
  var now = ctx.currentTime;
  if (now > pruneAt) {
    pruneAt = now + 2;
    sess.srcs = sess.srcs.filter(function (x) { return x[1] > now - .5; });
    sess.clips = sess.clips.filter(function (x) { return x.end > now - .5; });
  }
  if (extOn && EXT && !EXT.paused && now > extChkAt) {
    extChkAt = now + 1;
    if (Math.abs(EXT.currentTime - T) > .25) { try { EXT.currentTime = T; } catch (e) { /* 忽略 */ } }
  }
  vcall('tick', T);
};
A.stopAll = function (hard) {
  voiceDuck = 1;
  vcall('stopAll', hard);
  if (EXT) { try { EXT.pause(); EXT.volume = 1; } catch (e) { /* 忽略 */ } }
  if (!sess || !ctx) { sess = null; return; }
  var s = sess, now = ctx.currentTime, g = s.out.gain;
  sess = null;
  g.cancelScheduledValues(0);
  if (hard) g.setValueAtTime(0, now);
  else { g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(0, now + .06); }
  var kill = function () {
    s.srcs.forEach(function (x) { try { x[0].stop(); } catch (e) { /* 已停 */ } });
    s.srcs = [];
    try { s.out.disconnect(); } catch (e) { /* 已断 */ }
  };
  if (hard) kill(); else setTimeout(kill, 90);
};

/* ---------- 外部配乐接管：不试探文件（缺文件会在控制台报错）。
   audio/config.js 设 window.CINE_SCORE = 'audio/score.mp3' 时才用 <audio> 播放；为 null 则全用合成。 ---------- */
function probeExt() {
  var src = window.CINE_SCORE;
  if (typeof src !== 'string' || !src || typeof Audio === 'undefined') return;
  var el = new Audio();
  el.preload = 'auto';
  el.addEventListener('loadedmetadata', function () { if (EXT) return; EXT = el; applyExt(); });
  el.src = src;
}
function applyExt() {
  extOn = true;
  if (!sess) return;
  var now = ctx.currentTime;
  [[sess.m, 0], [sess.mRv, 0], [sess.s, .55], [sess.sRv, .55]].forEach(function (x) {
    x[0].gain.setTargetAtTime(x[1], now, .15);
  });
  extStart(A.clock() - base);
}
function extStart(T0) {
  if (!extOn || !EXT) return;
  var lead = Math.max(0, A.LEAD - lat);
  try { EXT.currentTime = Math.max(0, T0 - lead); } catch (e) { /* 元数据未就绪 */ }
  var p = EXT.play(); if (p && p.catch) p.catch(function () {});
  extChkAt = ctx.currentTime + 1;
}

/* ---------- 配乐 v2（预渲染）：audio-assets.js（tools/build-audio.sh 生成，构建产物）内嵌整片音轨，切成若干段 MP3 base64：
   window.CINE_SCORE_V2 = { v:2, sr, chunk 段长秒, pad 每段前后多录秒, xf 段间交叉秒, lead 解码偏移校正秒, duration, acts 构建时幕表, parts:[{a 段首全片秒, b 段尾, mime, data}] }。
   本脚本自己挂载该文件（不改 index.html）；静音/截图模式不载。按需解码（播放点所在段＋前方 AHEAD_DEC 秒），解码过的段最多留 KEEP 段（离播放点最远的先丢）。
   相邻两段在交界处各多录 pad 秒、按 xf 秒线性交叉（同一信号，和为 1，不改波形）；骤静等已烘进音轨。
   缺文件或解码失败：无配乐、不抛错（原因记入 A.errors）。段解码完成时若它此刻应在响，就从当前时刻补排。 ---------- */
var CLIP = {}, clipState = null, SV = null, DEC = {}, KEEP = 8, AHEAD_DEC = 8, lastT = 0, BUFS = null;
function mountClips() {
  if (MUTED || typeof document === 'undefined') return;
  if (window.CINE_SCORE_V2) { clipsLoaded(); return; }
  var me = document.currentScript && document.currentScript.src || '';
  var s = document.createElement('script');
  s.src = /js\/audio\.js(\?.*)?$/.test(me) ? me.replace(/js\/audio\.js(\?.*)?$/, 'audio-assets.js') : 'audio-assets.js';
  s.onload = clipsLoaded;
  s.onerror = function () { clipState = 'missing'; };
  (document.head || document.documentElement).appendChild(s);
}
function clipsLoaded() {
  SV = window.CINE_SCORE_V2 || null;
  if (!SV || !SV.parts || !SV.parts.length) { clipState = 'missing'; return; }
  cues = null;                                            // 段落表随资产重建
  staleCheck();
  decodeClips();
}
/* 资产与当前幕表不一致（如插了新幕而没重建音轨）：控制台提醒一次，照常按全片秒播放 */
function staleCheck() {
  try {
    var r2 = function (v) { return Math.round(v * 100) / 100; };   // v5：幕起点经全片时间映射算出，带浮点尾数；按 .01s 比
    var live = ((CINE.acts && CINE.acts()) || []).map(function (a) { return a.id + ':' + r2(a.start) + ':' + r2(a.duration); }).join('|');
    var built = (SV.acts || []).map(function (a) { return a.id + ':' + r2(a.start) + ':' + r2(a.duration); }).join('|');
    A.stale = !!live && live !== built;
    if (A.stale && window.console) console.warn('audio: 配乐音轨按旧幕表构建（' + built + '），当前幕表 ' + live + '；请 sh tools/build-audio.sh 重建');
  } catch (e) { /* 忽略 */ }
}
function decCtx() {
  var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  try { return ctx || (OAC ? new OAC(2, 1, SV.sr || 44100) : null); } catch (e) { return null; }
}
/* 首次：解第 0 段探路（确认能解），成功即 ready */
function decodeClips() {
  if (!SV || clipState === 'loading' || clipState === 'ready') return;
  if (!decCtx()) { clipState = 'wait'; return; }
  clipState = 'loading';
  need(0, function (ok) { clipState = ok ? 'ready' : 'missing'; });
}
function partKey(i) { return 'p' + i; }
function partAt(T) { var n = SV.parts.length, i = Math.floor(T / SV.chunk); return i < 0 ? 0 : i >= n ? n - 1 : i; }
function decodePart(i, dc, cb) {
  var P = SV.parts[i], once = false;
  var ok = function (b) { if (once) return; once = true; cb(b); };
  var bad = function (e) { if (once) return; once = true; if (A.errors.length < 20) A.errors.push('score part ' + i + ': ' + (e && e.message || e || 'decode failed')); cb(null); };
  try {
    var bin = atob(P.data), u8 = new Uint8Array(bin.length);
    for (var k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
    var pr = dc.decodeAudioData(u8.buffer, ok, bad);
    if (pr && pr.then) pr.then(ok, bad);
  } catch (e) { bad(e); }
}
/* 确保第 i 段已解码；解完若此刻应在响就补排 */
function need(i, cb) {
  if (!SV || i < 0 || i >= SV.parts.length) { if (cb) cb(false); return; }
  var k = partKey(i);
  if (CLIP[k]) { if (cb) cb(true); return; }
  if (DEC[k]) { if (cb) DEC[k].push(cb); return; }
  var dc = decCtx();
  if (!dc) { if (cb) cb(false); return; }
  DEC[k] = cb ? [cb] : [];
  decodePart(i, dc, function (b) {
    var w = DEC[k]; delete DEC[k];
    if (b) { CLIP[k] = b; evict(); partReady(k); }
    w.forEach(function (f) { f(!!b); });
  });
}
function evict() {
  var ks = Object.keys(CLIP); if (ks.length <= KEEP) return;
  var cur = partAt(lastT);
  ks.sort(function (x, y) { return Math.abs(+y.slice(1) - cur) - Math.abs(+x.slice(1) - cur); });
  for (var j = 0; j < ks.length - KEEP; j++) if (Math.abs(+ks[j].slice(1) - cur) > 1) delete CLIP[ks[j]];
}
function partReady(k) {
  if (!sess || !ctx || !cues) return;
  var T = ctx.currentTime - base + .05;
  for (var i = 0; i < ptr; i++) { var c = cues[i]; if (c.n === 'clip' && c.o.src === k && c.e > T + .1 && c.on !== sess) run(c, Math.max(c.t, T)); }
}
function prefetch(T) {
  if (!SV || clipState !== 'ready') return;
  lastT = T;
  var lo = partAt(T), hi = partAt(T + AHEAD_DEC);           // 11-02 修：原按 chunk/2＝12 s 步进、上限 T+8，只取到当前段——下一段要等播放点跨进去才开始解码，每个 24 s 段界都会空 .1–.3 s
  for (var i = lo; i <= hi; i++) need(i);
}
/* 片段：o = {src, off 源起点秒, rate, loop:[ls,le], keys 增益（相对 c.t）, v, lp, lpKeys, pan}；从中途截入时按 (from−t)·rate 推进源位置 */
function clip(c, from) {
  var o = c.o, b = (BUFS || CLIP)[o.src];
  if (!b) return;
  var rate = o.rate || 1, st = W(from), end = W(c.e), pos = o.off + (from - c.t) * rate;
  if (end - st < .03) return;
  var src = ctx.createBufferSource();
  src.buffer = b; src.playbackRate.value = rate;
  if (o.loop) {
    src.loop = true; src.loopStart = o.loop[0]; src.loopEnd = o.loop[1];
    if (pos >= o.loop[1]) pos = o.loop[0] + (pos - o.loop[0]) % (o.loop[1] - o.loop[0]);
  } else if (pos >= b.duration - .02) return;
  var g = G(0), dc = G(0), node = src;
  autom(g.gain, o.keys, c.t, from, o.v == null ? 1 : o.v);
  dc.gain.setValueAtTime(0, st); dc.gain.linearRampToValueAtTime(1, st + .025);     // 截入防爆音
  if (o.lp || o.lpKeys) {
    var f = filt('lowpass', o.lp || 18000, .7);
    if (o.lpKeys) autom(f.frequency, o.lpKeys, c.t, from);
    node.connect(f); node = f;
  }
  chainN(node, g, dc);
  src.start(st, Math.max(0, pos)); src.stop(end + .02); track(src, end + .02);
  sess.clips.push({ c: c, st: st, pos: pos, rate: rate, loop: o.loop, end: end }); c.on = sess;
  out(dc, 'm', o.wet || 0, o.pan);
}

/* ================= 乐器 ================= */
/* 古琴：Karplus-Strong 预渲染成缓冲（按音高缓存），播放时以 playbackRate 做滑音与吟猱 */
var KS = {};
function ksBuf(m, br) {
  br = Math.round(br * 10) / 10;
  var key = m + '|' + br;
  if (KS[key]) return KS[key];
  var sr = ctx.sampleRate, f = mtof(m), N = Math.max(4, Math.floor(sr / f - .5)), f0 = sr / (N + .5);
  var dur = clamp(5.4 - (m - 40) * .07, 1.8, 5.6), len = Math.floor(sr * dur);
  var b = ctx.createBuffer(1, len, sr), y = b.getChannelData(0), r = rng(m * 131 + Math.round(br * 97));
  var x = new Float32Array(N), lp = 0, mean = 0, P = Math.max(1, Math.round(N * .13)), i;
  for (i = 0; i < N; i++) { lp += br * ((r() * 2 - 1) - lp); x[i] = lp; mean += lp; }
  mean /= N;
  var g = Math.pow(10, -3 / (dur * .8 * f0)), pk = 1e-6;
  for (i = 0; i < len; i++) {
    var v = i < N ? (x[i] - mean) - (i >= P ? x[i - P] - mean : 0) : 0;
    if (i > N) v += g * .5 * (y[i - N] + y[i - N - 1]);
    y[i] = v; if (Math.abs(v) > pk) pk = Math.abs(v);
  }
  for (i = 0; i < len; i++) y[i] *= .8 / pk;
  return (KS[key] = { b: b, rate: f / f0 });
}
/* o = {m, d, v, gl (滑音半音), gs (滑起), gt (滑时), vib (吟猱深度), br, lp, wet, pan} */
function qinNote(w, o, bus) {
  var mi = Math.round(o.m), k = ksBuf(mi, o.br || .45), src = ctx.createBufferSource();
  var rate = k.rate * Math.pow(2, (o.m - mi) / 12), dur = o.cut ? o.cut : Math.min(k.b.duration / rate - .05, (o.d || 1.5) + 1.6);
  src.buffer = k.b;
  src.playbackRate.setValueAtTime(rate, w);
  if (o.gl) {
    var gs = w + (o.gs == null ? .12 : o.gs);
    src.playbackRate.setValueAtTime(rate, gs);
    src.playbackRate.linearRampToValueAtTime(rate * Math.pow(2, o.gl / 12), gs + (o.gt || .25));
  }
  var g = G(0), v = (o.v == null ? .5 : o.v) * 1.4;
  var fo = o.cut ? .004 : .4;                           // cut：骤断
  g.gain.setValueAtTime(v, w); g.gain.setValueAtTime(v, w + dur - fo); g.gain.linearRampToValueAtTime(0, w + dur);
  src.connect(g);
  if (o.vib) {
    var vg = G(0); lfo(o.vf || 5.2, 1, w, w + dur, vg); vg.connect(src.playbackRate);
    vg.gain.setValueAtTime(0, w + .1); vg.gain.linearRampToValueAtTime(rate * o.vib, w + .45);
    vg.gain.linearRampToValueAtTime(rate * o.vib * .3, w + dur);
  }
  src.start(w); src.stop(w + dur); track(src, w + dur);
  var tick = noise('white', w, w + .03), tg = G(0), tb = filt('bandpass', 2600, 1.5);
  hit(tg.gain, w, v * .12, .001, .006); chainN(tick, tb, tg); tg.connect(g);
  out(chainN(g, filt('peaking', 170, 1.1, 5), filt('lowpass', o.lp || 3400, .6)), bus || 'm', o.wet == null ? .3 : o.wet, o.pan == null ? -.18 : o.pan);
}
/* 琴泛音：清冷的钟样音 */
function qinHarm(w, o, bus) {
  var f = mtof(o.m), dec = o.dec || 2.4, mix = G(1), v = o.v == null ? .3 : o.v;
  [[1, 1], [2, .22], [3, .07]].forEach(function (p) {
    if (f * p[0] > ctx.sampleRate * .42) return;
    var s = osc('sine', f * p[0], w, w + dec * 1.8), g = G(0);
    hit(g.gain, w, v * p[1], .004, dec / (3 + p[0])); s.connect(g); g.connect(mix);
  });
  out(mix, bus || 'm', o.wet == null ? .5 : o.wet, o.pan == null ? -.1 : o.pan);
}

/* 箫：带谐波的正弦 + 随音高的带通气声 + 起音"吹"噪；一句连奏 notes = [{w, d, m, f}]；o.art：代唱吐字（字首音吐音加重 art 倍，字内第二音连奏不吐） */
var XW = null;
function xiaoWave() {
  if (!XW) XW = ctx.createPeriodicWave(new Float32Array([0, 1, .16, .06, .025, .01]), new Float32Array(6));
  return XW;
}
function xiaoPhrase(ns, o, bus) {
  var v = o.v == null ? .3 : o.v, tr = o.tr || 0, rel = o.rel || .3;
  var t0 = ns[0].w, L = ns[ns.length - 1], t1 = L.w + L.d, end = t1 + rel * 2 + .1;
  var f = function (m) { return mtof(m + tr); };
  var vo = osc(xiaoWave(), f(ns[0].m), t0, end), amp = G(0), br = G(0);
  var nz = noise('white', t0, end), bp = filt('bandpass', f(ns[0].m), 6), ch = filt('bandpass', f(ns[0].m) * 2, 2.5), chg = G(0);
  vo.frequency.setValueAtTime(f(ns[0].m) * .975, t0); vo.frequency.setTargetAtTime(f(ns[0].m), t0, .04);
  var vg = G(0); lfo(5.1, 1, t0, end, vg); vg.connect(vo.detune);
  ns.forEach(function (n, i) {
    var fq = f(n.m);
    if (i) { vo.frequency.setTargetAtTime(fq, n.w - .015, .022); bp.frequency.setTargetAtTime(fq, n.w - .015, .022); }
    ch.frequency.setValueAtTime(fq * 2, n.w);
    var sl = o.art && n.f === false, a = !i ? 1 : o.art ? (sl ? 0 : o.art) : .55;
    chg.gain.setValueAtTime(0, n.w); chg.gain.linearRampToValueAtTime(v * 1.6 * a, n.w + .012); chg.gain.setTargetAtTime(0, n.w + .012, .035);
    if (i && !sl) { amp.gain.setTargetAtTime(v * (o.art ? .45 : .7), n.w - .03, .012); amp.gain.setTargetAtTime(v, n.w + .012, .03); }
    vg.gain.setValueAtTime(0, n.w);
    if (n.d > .55) { vg.gain.linearRampToValueAtTime(0, n.w + .22); vg.gain.linearRampToValueAtTime(o.vib || 16, n.w + .6); amp.gain.setTargetAtTime(v * 1.08, n.w + .15, n.d * .5); }
  });
  amp.gain.setValueAtTime(0, t0); amp.gain.linearRampToValueAtTime(v, t0 + .09);
  amp.gain.setTargetAtTime(0, t1 - .03, rel / 3);
  br.gain.setValueAtTime(0, t0); br.gain.linearRampToValueAtTime(v * 5, t0 + .03); br.gain.setTargetAtTime(v * 1.5, t0 + .03, .08);
  br.gain.setTargetAtTime(0, t1 - .03, rel / 3);
  var mix = G(1), lp = filt('lowpass', o.lp || 4200, .5);
  vo.connect(amp); amp.connect(mix);
  chainN(nz, bp, br, mix); chainN(nz, ch, chg, mix);
  var air = filt('highpass', 5000, .7), ag = G(0); chainN(nz, air, ag, mix);
  ag.gain.setValueAtTime(0, t0); ag.gain.linearRampToValueAtTime(v * .05, t0 + .1); ag.gain.setTargetAtTime(0, t1, rel / 3);
  out(chainN(mix, lp), bus || 'm', o.wet == null ? .4 : o.wet, o.pan == null ? .16 : o.pan);
}

/* 埙（第五幕 S5 解良哑声代唱）：空心的奇次谐波音，低沉窄带，气噪大；音准略飘（每个指法固定偏 ±det/100 半音，
   字首从下往上"够"音，慢漂移），颤得少；粗糙的幅度抖动作"哑"。notes = [{w, d, m, f}]；o = {v, tr, det, breath, rasp, vib, lp, wet, pan, seed} */
var XNW = null;
function xunWave() {
  if (!XNW) XNW = ctx.createPeriodicWave(new Float32Array([0, 1, .06, .3, .03, .1, .01, .04]), new Float32Array(8));
  return XNW;
}
function xunPhrase(ns, o, bus) {
  var v = o.v == null ? .25 : o.v, tr = o.tr == null ? -12 : o.tr, rel = o.rel || .45, det = o.det || 0, b = o.breath || 1;
  var t0 = ns[0].w, L = ns[ns.length - 1], t1 = L.w + L.d, end = t1 + rel * 2 + .1;
  var f = function (m) { return mtof(m + tr + (det ? (hash((m | 0) * 13 + (o.seed || 0)) - .5) * det / 50 : 0)); };
  var vo = osc(xunWave(), f(ns[0].m), t0, end), body = G(1), amp = G(0), fin = G(1);
  var vg = G(0); lfo(4.2, 1, t0, end, vg); vg.connect(vo.detune);
  if (det) { var dg = G(det * .8); chainN(noise('brown', t0, end), filt('lowpass', 2.5, .7), dg); dg.connect(vo.detune); }
  var nz = noise('white', t0, end), bp = filt('bandpass', f(ns[0].m) * 2, 3), br = G(v * 4 * b), puff = G(0), ag = G(v * 1.5 * b);
  vo.frequency.setValueAtTime(f(ns[0].m) * .97, t0); vo.frequency.setTargetAtTime(f(ns[0].m), t0, .1);
  amp.gain.setValueAtTime(0, t0); amp.gain.linearRampToValueAtTime(v, t0 + .14);
  ns.forEach(function (n, i) {
    var fq = f(n.m), tk = !i || n.f !== false;           // tk：字首吐气、够音；字内第二音懒懒地滑过去
    if (i && tk) {
      vo.frequency.setTargetAtTime(fq * .98, n.w - .02, .015); vo.frequency.setTargetAtTime(fq, n.w + .03, .09);
      amp.gain.setTargetAtTime(v * .35, n.w - .06, .02); amp.gain.setTargetAtTime(v, n.w + .01, .06);
    } else if (i) vo.frequency.setTargetAtTime(fq, n.w - .02, .05);
    bp.frequency.setTargetAtTime(fq * 2, n.w - .02, .05);
    if (tk) { puff.gain.setValueAtTime(0, n.w); puff.gain.linearRampToValueAtTime(v * 4.5 * b, n.w + .02); puff.gain.setTargetAtTime(0, n.w + .02, .07); }
    vg.gain.setValueAtTime(0, n.w);
    if (n.d > .8) { vg.gain.linearRampToValueAtTime(0, n.w + .5); vg.gain.linearRampToValueAtTime(o.vib || 6, n.w + n.d); amp.gain.setTargetAtTime(v * .82, n.w + .3, n.d * .6); }
  });
  amp.gain.setTargetAtTime(0, t1 - .03, rel / 3);
  ag.gain.setValueAtTime(0, t0); ag.gain.linearRampToValueAtTime(v * 1.5 * b, t0 + .1); ag.gain.setTargetAtTime(0, t1, rel / 3);
  vo.connect(body); chainN(nz, bp, br, body);
  var rasp = G(1);                                       // 哑：粗糙的幅度抖动
  chainN(noise('brown', t0, end), filt('lowpass', 35, .7), G(o.rasp == null ? .5 : o.rasp), rasp.gain);
  chainN(body, rasp, amp, fin);
  chainN(nz, filt('bandpass', 1100, .7), puff, fin); chainN(nz, filt('bandpass', 700, .5), ag, fin);
  out(chainN(fin, filt('highpass', 90, .7), filt('lowpass', o.lp || 1000, .6)), bus || 'm', o.wet == null ? .35 : o.wet, o.pan == null ? -.2 : o.pan);
}

/* 人声：锯齿声源 + 共振峰带通组（近似元音）；哼鸣用 'm'。o = {vow, v, tr, hoarse, det, br, vib, wet, pan} */
var VOW = {
  a: [[730, 1, 7], [1100, .55, 9], [2500, .22, 13], [3300, .1, 15]],
  o: [[520, 1, 6], [880, .5, 8], [2450, .12, 13], [3200, .05, 15]],
  u: [[340, 1, 6], [820, .22, 8], [2400, .05, 12]],
  m: [[250, 1, 3], [900, .06, 6], [2200, .02, 9]]
};
function voicePhrase(ns, o, bus) {
  var v = o.v == null ? .3 : o.v, tr = o.tr || 0, rel = o.rel || .3, hum = o.vow === 'm';
  var t0 = ns[0].w, L = ns[ns.length - 1], t1 = L.w + L.d, end = t1 + rel * 2 + .1;
  var fq = function (n, i) { return mtof(n.m + tr + (o.det ? (hash(i * 31 + (n.m | 0) * 7 + (o.seed || 0)) - .5) * o.det / 50 : 0)); };
  var s1 = osc('sawtooth', fq(ns[0], 0), t0, end), s2 = osc('sawtooth', fq(ns[0], 0), t0, end), src = G(.6);
  s2.detune.value = 7; s1.connect(src); s2.connect(src);
  var vg = G(0); lfo(o.vf || 5.3, 1, t0, end, vg); vg.connect(s1.detune); vg.connect(s2.detune);
  var fr = [s1.frequency, s2.frequency], gl = o.glide || (hum ? .05 : .035);
  ns.forEach(function (n, i) {
    var f = fq(n, i);
    fr.forEach(function (p) {
      if (i === 0) { p.setValueAtTime(f * .96, t0); p.setTargetAtTime(f, t0, .05); }
      else if (o.det) { p.setTargetAtTime(f * .975, n.w - .02, gl); p.setTargetAtTime(f, n.w + .06, .07); }
      else p.setTargetAtTime(f, n.w - .02, gl);
    });
    vg.gain.setValueAtTime(0, n.w);
    if (n.d > .45) { vg.gain.linearRampToValueAtTime(0, n.w + .2); vg.gain.linearRampToValueAtTime(o.vib || 22, n.w + .55); }
  });
  var fm = G(1), amp = G(0);
  (VOW[o.vow || 'a']).forEach(function (F) {
    var b = filt('bandpass', F[0] * (o.fs || 1), F[2]), g = G(F[1] * 1.6);
    chainN(src, b, g, fm);
  });
  if (hum) { var sn = osc('sine', fq(ns[0], 0), t0, end), sg = G(.35); fr.push(sn.frequency); ns.forEach(function (n, i) { if (i) sn.frequency.setTargetAtTime(fq(n, i), n.w - .02, gl); }); chainN(sn, sg, fm); }
  var nz = noise('white', t0, end), nb = filt('bandpass', 1300, .7), ng = G((o.hoarse ? .9 : .12) * (o.breath || 1));
  chainN(nz, nb, ng, fm);
  if (o.hoarse) {                                        // 哑：粗糙的幅度抖动 + 音高游移
    var rz = noise('brown', t0, end), rl = filt('lowpass', 45, .7), rg = G(o.hoarse * .8), rasp = G(1);
    chainN(rz, rl, rg, rasp.gain); fm.connect(rasp); fm = rasp;
    var jz = noise('brown', t0, end), jl = filt('lowpass', 6, .7), jg = G(o.hoarse * 60);
    chainN(jz, jl, jg); jg.connect(s1.detune); jg.connect(s2.detune);
  }
  var att = o.att || (hum ? .14 : .07);
  amp.gain.setValueAtTime(0, t0); amp.gain.linearRampToValueAtTime(v, t0 + att);
  ns.forEach(function (n, i) {
    if (!i) return;
    amp.gain.setTargetAtTime(v * .78, n.w - .03, .015); amp.gain.setTargetAtTime(v, n.w + .015, .04);
    if (n.d > .5) amp.gain.setTargetAtTime(v * 1.1, n.w + .12, n.d * .6);
  });
  amp.gain.setTargetAtTime(0, t1 - .03, rel / 3);
  fm.connect(amp);
  out(chainN(amp, filt('lowpass', o.lp || (hum ? 1400 : 4200), .6)), bus || 'm', o.wet == null ? .38 : o.wet, o.pan || 0);
}

/* 磬：非谐泛音，敲击起音 */
var QING = [[1, 1, 1], [2.32, .55, .62], [4.25, .32, .4], [6.63, .18, .26], [9.38, .09, .17], [13.1, .04, .1]];
function qing(w, o, bus) {
  var dec = o.dec || 3.2, v = o.v == null ? .3 : o.v, mix = G(1);
  QING.forEach(function (p, i) {
    if (o.f * p[0] > ctx.sampleRate * .42) return;
    var d = dec * p[2], s = osc('sine', o.f * p[0] * (1 + (hash(i * 7 + (o.f | 0)) - .5) * .006), w, w + d * 1.9), g = G(0);
    hit(g.gain, w, v * p[1], .002, d / 4); s.connect(g); g.connect(mix);
  });
  var n = noise('white', w, w + .05), g2 = G(0);
  hit(g2.gain, w, v * .35, .001, .01); chainN(n, filt('bandpass', o.f * 3, 1), g2, mix);
  out(mix, bus || 'm', o.wet == null ? .45 : o.wet, o.pan);
}

/* ================= 持续层（可从中途截入）：c = {t, e, o}，keys 相对 c.t ================= */
/* 持续音垫 / 低频长音 / 不协和：o = {ns, type, lp, lpKeys, q, det, keys, v, wet, pan} */
function pad(c, from) {
  var o = c.o, st = W(from), end = W(c.e) + .05, mix = G(1 / Math.max(1, o.ns.length)), amp = G(0);
  var lp = filt('lowpass', o.lp || 800, o.q || .7), type = o.type || 'sawtooth', dual = type !== 'sine';
  o.ns.forEach(function (m, i) {
    (dual ? [-1, 1] : [0]).forEach(function (sg) {
      var s = osc(type, mtof(m), st, end); s.detune.value = sg * (o.det == null ? 6 : o.det) + i * 1.3; s.connect(mix);
    });
  });
  if (o.lpKeys) autom(lp.frequency, o.lpKeys, c.t, from);
  else lfo(.05 + hash(c.t * 10 | 0) * .05, (o.lp || 800) * .22, st, end, lp.frequency);
  if (o.trem) lfo(o.trem, o.tremD || .008, st, end, amp.gain);
  autom(amp.gain, o.keys, c.t, from, (o.v == null ? 1 : o.v) * .6);
  chainN(mix, lp, amp);
  out(amp, o.bus || 'm', o.wet == null ? .5 : o.wet, o.pan);
}
/* 风：滤波粉噪两层（左右）+ LFO 阵风；可选呼哨层。o = {keys, f, fk, q, gust, wh, whf, v} */
function wind(c, from) {
  var o = c.o, st = W(from), end = W(c.e) + .05, amp = G(0), f = o.f || 600;
  [-.6, .6].forEach(function (p, i) {
    var n = noise('pink', st, end), bp = filt('bandpass', f * (1 + i * .2), o.q || .8), g = G(.55);
    if (o.fk) autom(bp.frequency, o.fk, c.t, from, 1 + i * .2);
    lfo(.05 + i * .04, f * .3, st, end, bp.frequency);
    lfo(.09 + i * .06, o.gust == null ? .3 : o.gust, st, end, g.gain);
    lfo(.23 + i * .11, (o.gust == null ? .3 : o.gust) * .4, st, end, g.gain);
    chainN(n, bp, g); pan(g, p).connect(amp);
  });
  if (o.wh) {
    var wn = noise('white', st, end), wb = filt('bandpass', o.whf || 1400, 16), wb2 = filt('bandpass', o.whf || 1400, 10), wg = G(0);
    lfo(.07, (o.whf || 1400) * .12, st, end, wb.frequency); lfo(.07, (o.whf || 1400) * .12, st, end, wb2.frequency);
    lfo(.17, .4, st, end, wg.gain);
    autom(wg.gain, o.wh, c.t, from, 5);
    chainN(wn, wb, wb2, wg, amp);
  }
  autom(amp.gain, o.keys, c.t, from, (o.v == null ? 1 : o.v) * 4.4);
  out(amp, 's', o.wet == null ? .25 : o.wet);
}
/* 风声里的旋律：极窄带通噪声随音高滑动（风哨）。o = {ns:[{t,d,m}] 全局, tr, keys, v} */
function windTune(c, from) {
  var o = c.o, st = W(from), end = W(c.e) + .1, tr = o.tr || 0, amp = G(0);
  var n = noise('white', st, end), b1 = filt('bandpass', 800, o.q || 24), b2 = filt('bandpass', 800, o.q || 24);
  var cur = o.ns[0];
  o.ns.forEach(function (x) { if (x.t <= from) cur = x; });
  [b1, b2].forEach(function (b) {
    b.frequency.setValueAtTime(mtof(cur.m + tr), st);
    o.ns.forEach(function (x) { if (x.t > from) b.frequency.setTargetAtTime(mtof(x.m + tr), W(x.t), .06); });
  });
  var vg = G(.25); lfo(.4, .2, st, end, vg.gain);
  autom(amp.gain, o.keys, c.t, from, o.v == null ? 8 : o.v);
  chainN(n, b1, b2, vg, amp);
  out(amp, 'm', o.wet == null ? .55 : o.wet, o.pan);
}
/* 水：粉噪底 + 确定性气泡/水波点。o = {keys, v, sp (气泡间隔), f} */
function water(c, from) {
  var o = c.o, st = W(from), end = W(c.e) + .05, amp = G(0);
  var n = noise('pink', st, end), bp = filt('bandpass', o.f || 850, .9), am = G(.5);
  lfo(.31, .22, st, end, am.gain); lfo(1.37, .12, st, end, am.gain); lfo(.19, (o.f || 850) * .3, st, end, bp.frequency);
  chainN(n, bp, am, amp);
  var r = rng((c.t * 100) | 0), t = from;
  for (;;) {
    t += .08 + r() * (o.sp || .3); if (t >= c.e - .1) break;
    var w = W(t), f = 420 + r() * 1000, s = osc('sine', f, w, w + .1), g = G(0);
    s.frequency.setValueAtTime(f, w); s.frequency.exponentialRampToValueAtTime(f * (1.4 + r() * .7), w + .06);
    hit(g.gain, w, .1 * (.3 + r() * .7), .003, .018); chainN(s, g, amp);
  }
  autom(amp.gain, o.keys, c.t, from, o.v == null ? 1 : o.v);
  out(amp, 's', o.wet == null ? .5 : o.wet, o.pan);
}
/* 火：低频呼呼 + 噼啪。o = {keys, v} */
function fire(c, from) {
  var o = c.o, st = W(from), end = W(c.e) + .05, amp = G(0);
  var n = noise('brown', st, end), lp = filt('lowpass', 420, .9), g = G(1.4);
  lfo(.7, .35, st, end, g.gain); lfo(2.3, .2, st, end, g.gain);
  chainN(n, lp, g, amp);
  var n2 = noise('pink', st, end), bp = filt('bandpass', 260, 1.2), g2 = G(.6); chainN(n2, bp, g2, amp);
  var r = rng((c.t * 100) | 7), t = from;
  for (;;) {
    t += .04 + r() * .28; if (t >= c.e - .1) break;
    var w = W(t), cn = noise('white', w, w + .03), cb = filt('bandpass', 1800 + r() * 3000, 2), cg = G(0);
    hit(cg.gain, w, .25 * r(), .0008, .004); chainN(cn, cb, cg, amp);
  }
  autom(amp.gain, o.keys, c.t, from, o.v == null ? 1 : o.v);
  out(amp, 's', o.wet == null ? .2 : o.wet, o.pan);
}
/* 电芒：低频锯齿嗡鸣 + 颤动。o = {keys, v} */
function buzz(c, from) {
  var o = c.o, st = W(from), end = W(c.e) + .05, amp = G(0), mix = G(.5);
  [55, 110.8, 164.3].forEach(function (f) { osc('sawtooth', f, st, end).connect(mix); });
  var bp = filt('bandpass', 900, 1.4), tr = G(.6);
  lfo(9.3, .35, st, end, tr.gain); lfo(.4, 500, st, end, bp.frequency);
  var cz = noise('white', st, end), ch = filt('highpass', 3500, .7), cg = G(0);
  lfo(13, .08, st, end, cg.gain, 'square');
  chainN(mix, bp, tr, amp); chainN(cz, ch, cg, amp);
  autom(amp.gain, o.keys, c.t, from, o.v == null ? 1 : o.v);
  out(amp, 's', o.wet == null ? .3 : o.wet, o.pan);
}
/* 混响回送的压低/恢复（"全静"时连尾音一起收掉）。o = {keys} */
function duck(c, from) { autom(sess.rvOut.gain, c.o.keys, c.t, from); }

/* ================= 音效（一次性）：fn(w = ctx 秒, o, bus) ================= */
/* 呼啸/掠过：o = {d, f0, f1, q, v, p0, p1, kind} */
function whoosh(w, o, bus) {
  var d = o.d || 1, v = o.v == null ? .3 : o.v, n = noise(o.kind || 'pink', w, w + d + .1);
  var bp = filt('bandpass', o.f0 || 300, o.q || 1.4), g = G(0);
  bp.frequency.setValueAtTime(o.f0 || 300, w); bp.frequency.exponentialRampToValueAtTime(o.f1 || 2400, w + d);
  g.gain.setValueAtTime(0, w); g.gain.linearRampToValueAtTime(v * 2.2, w + d * (o.pk || .55)); g.gain.linearRampToValueAtTime(0, w + d);
  chainN(n, bp, g);
  var dst = g;
  if (o.p0 != null && ctx.createStereoPanner) {
    dst = ctx.createStereoPanner(); dst.pan.setValueAtTime(o.p0, w); dst.pan.linearRampToValueAtTime(o.p1 == null ? -o.p0 : o.p1, w + d); g.connect(dst);
  }
  out(dst, bus || 's', o.wet == null ? .35 : o.wet);
}
/* 雷：近雷带炸裂，远雷只剩低滚。o = {v, dist 0..1, d, pan} */
function thunder(w, o, bus) {
  var v = o.v == null ? .4 : o.v, far = o.dist == null ? .5 : o.dist, d = o.d || 2.5 + far * 3, mix = G(1);
  if (far < .7) {
    var n1 = noise('white', w, w + .5), g1 = G(0);
    hit(g1.gain, w, v * (1 - far) * 1.2, .002, .06); chainN(n1, filt('highpass', 700 + (1 - far) * 1600, .7), g1, mix);
  }
  var att = .03 + far * .45, n2 = noise('brown', w, w + d + .6), lp = filt('lowpass', 900 - far * 600, .8), g2 = G(0), am = G(.7);
  lp.frequency.setValueAtTime(900 - far * 600, w); lp.frequency.exponentialRampToValueAtTime(70 + (1 - far) * 80, w + d);
  g2.gain.setValueAtTime(0, w); g2.gain.linearRampToValueAtTime(v * 2.6, w + att); g2.gain.setTargetAtTime(0, w + att, d / 3.5);
  lfo(1.3 + hash(w * 100 | 0) * 1.4, .3, w, w + d + .6, am.gain); lfo(.55, .22, w, w + d + .6, am.gain);
  chainN(n2, lp, g2, am, mix);
  out(mix, bus || 's', .3 + far * .35, o.pan);
}
/* 脚步（石阶）：o = {v, f, pan, twin} */
function step(w, o, bus) {
  var v = o.v == null ? .2 : o.v, mix = G(1), n = noise('white', w, w + .12), g = G(0);
  hit(g.gain, w, v * 1.4, .002, .016); chainN(n, filt('bandpass', o.f || 1100, 1.1), g, mix);
  if (o.twin) { var g3 = G(0); hit(g3.gain, w + .006, v * .8, .002, .02); chainN(n, filt('bandpass', (o.f || 1100) * .62, 1.3), g3, mix); }
  var s = osc('sine', 130, w, w + .14), sg = G(0);
  s.frequency.setValueAtTime(140, w); s.frequency.exponentialRampToValueAtTime(58, w + .09);
  hit(sg.gain, w, v * .9, .003, .025); chainN(s, sg, mix);
  out(mix, bus || 's', o.wet == null ? .18 : o.wet, o.pan);
}
/* 心跳式低频闷响：o = {v, f, d} */
function thump(w, o, bus) {
  var v = o.v == null ? .5 : o.v, f = o.f || 60, d = o.d || .5, mix = G(1);
  var s = osc('sine', f, w, w + d * 1.6 + .1), g = G(0);
  s.frequency.setValueAtTime(f * 1.7, w); s.frequency.exponentialRampToValueAtTime(f * .7, w + d * .6);
  hit(g.gain, w, v, .006, d / 3.2); chainN(s, g, mix);
  var n = noise('brown', w, w + d + .1), ng = G(0);
  hit(ng.gain, w, v * 1.6, .004, d / 5); chainN(n, filt('lowpass', 200, .7), ng, mix);
  out(mix, bus || 's', o.wet == null ? .15 : o.wet, o.pan);
}
/* 打铁：金属撞击的非谐泛音 + 锤下的低频（lub），回弹轻敲（dub）——锤声即心跳。o = {v, f, heart} */
function hammer(w, o, bus) {
  var v = o.v == null ? .4 : o.v, f = o.f || 760, mix = G(1);
  [[1, 1, .6], [2.63, .6, .4], [3.91, .45, .28], [5.27, .3, .18], [6.93, .2, .12]].forEach(function (p) {
    var s = osc('sine', f * p[0], w, w + p[2] * 2.2), g = G(0);
    hit(g.gain, w, v * p[1] * .45, .001, p[2] / 3.5); s.connect(g); g.connect(mix);
  });
  var n = noise('white', w, w + .08), ng = G(0);
  hit(ng.gain, w, v * .9, .0008, .012); chainN(n, filt('highpass', 2200, .7), ng, mix);
  out(mix, bus || 's', .28, o.pan);
  var h = o.heart == null ? 1 : o.heart;
  thump(w, { v: v * 1.1 * h, f: 52, d: .42 }, bus);
  thump(w + .3, { v: v * .55 * h, f: 46, d: .34 }, bus);
  var s2 = osc('sine', f * 1.02, w + .3, w + .6), g4 = G(0);
  hit(g4.gain, w + .3, v * .08, .001, .05); chainN(s2, g4); out(g4, bus || 's', .2, o.pan);
}
/* 剑鸣：高频振铃，两枚近频分音拍出颤光。o = {f, d, v, wet, pan} */
function sword(w, o, bus) {
  var f = o.f || 2400, d = o.d || 3, v = o.v == null ? .25 : o.v, mix = G(1);
  [[1, 1, 1], [1.0024, .8, .92], [2.76, .28, .5], [5.4, .1, .28], [.5, .12, .6]].forEach(function (p) {
    if (f * p[0] > ctx.sampleRate * .42) return;
    var s = osc('sine', f * p[0], w, w + d * p[2] * 1.6), g = G(0);
    hit(g.gain, w, v * p[1] * .5, .003, d * p[2] / 4); s.connect(g); g.connect(mix);
  });
  var n = noise('white', w, w + .25), ng = G(0);
  hit(ng.gain, w, v * .7, .003, .05); chainN(n, filt('highpass', 4200, .7), ng, mix);
  out(mix, bus || 's', o.wet == null ? .55 : o.wet, o.pan);
}
/* 弦断「铮」：绷紧上滑的亮拨 → 骤断 + 崩裂 + 回抽。o = {v} */
function snap(w, o) {
  var v = o.v == null ? .6 : o.v, cut = .38;
  qinNote(w, { m: 76, d: cut, v: v, br: .95, gl: .9, gs: .03, gt: cut, lp: 8000, wet: .5, pan: 0, cut: cut }, 's');
  var b = w + cut, mix = G(1), n = noise('white', b, b + .1), g = G(0);
  hit(g.gain, b, v * 1.6, .0005, .008); chainN(n, filt('bandpass', 3600, .8), g, mix);
  var s = osc('sine', 420, b, b + .35), sg = G(0);
  s.frequency.setValueAtTime(520, b); s.frequency.exponentialRampToValueAtTime(70, b + .2);
  hit(sg.gain, b, v * .6, .001, .05); chainN(s, sg, mix);
  out(mix, 's', .6, 0);
  sword(b, { f: 3150, d: 1.1, v: v * .25, wet: .7 });
}
/* 长啸：带滑音的锯齿 + 噪声，共振峰塑形。o = {d, v} */
function cry(w, o) {
  var d = o.d || 5, v = o.v == null ? .5 : o.v, end = w + d + .2, src = G(.5), mix = G(1), amp = G(0);
  var s1 = osc('sawtooth', 170, w, end), s2 = osc('sawtooth', 340, w, end), g2 = G(.35);
  [s1, s2].forEach(function (s, i) {
    var k = i + 1, p = s.frequency;
    p.setValueAtTime(165 * k, w); p.exponentialRampToValueAtTime(262 * k, w + .4);
    p.exponentialRampToValueAtTime(330 * k, w + 1.3); p.linearRampToValueAtTime(311 * k, w + d * .72);
    p.exponentialRampToValueAtTime(196 * k, w + d);
  });
  s1.connect(src); chainN(s2, g2, src);
  var vg = G(0); lfo(5.6, 1, w, end, vg); vg.connect(s1.detune); vg.connect(s2.detune);
  vg.gain.setValueAtTime(0, w + .8); vg.gain.linearRampToValueAtTime(35, w + d * .8);
  VOW.a.forEach(function (F) { chainN(src, filt('bandpass', F[0], F[2] * .7), G(F[1] * 3), mix); });
  var n = noise('pink', w, end), ng = G(.9); chainN(n, filt('bandpass', 1100, .6), ng, mix);
  amp.gain.setValueAtTime(0, w); amp.gain.linearRampToValueAtTime(v, w + .35);
  amp.gain.setValueAtTime(v, w + d - 1.3); amp.gain.linearRampToValueAtTime(0, w + d);
  chainN(mix, amp);
  out(amp, 's', .75, 0);
}
/* 水滴（墨滴/露水/心血）：o = {f, v} */
function drop(w, o, bus) {
  var f = o.f || 900, v = o.v == null ? .3 : o.v, s = osc('sine', f, w, w + .5), g = G(0);
  s.frequency.setValueAtTime(f * .8, w); s.frequency.exponentialRampToValueAtTime(f * 1.9, w + .07);
  hit(g.gain, w, v, .002, .045); chainN(s, g);
  out(g, bus || 's', o.wet == null ? .65 : o.wet, o.pan);
}
/* 碎裂（水镜/阴神）：o = {v, n, d, seed, rev (反向凝聚), up (音高随时间升)} */
function shatter(w, o, bus) {
  var v = o.v == null ? .4 : o.v, n = o.n || 26, d = o.d || .7, r = rng(o.seed || 7), mix = G(1);
  if (!o.rev) { var nz = noise('white', w, w + .3), ng = G(0); hit(ng.gain, w, v * 1.1, .001, .05); chainN(nz, filt('highpass', 2500, .7), ng, mix); }
  for (var i = 0; i < n; i++) {
    var x = Math.pow(r(), 1.8), t = w + (o.rev ? 1 - x : x) * d, f = 2000 + r() * 5000;
    if (o.up) f = 1500 + (t - w) / d * 4500 + r() * 900;
    var s = osc('sine', f, t, t + .7), g = G(0);
    hit(g.gain, t, v * (.12 + r() * .22), .001, .03 + r() * .12); s.connect(g); g.connect(mix);
  }
  out(mix, bus || 's', o.wet == null ? .45 : o.wet, o.pan);
}
/* 击掌 / 拍打：o = {v, f} */
function clap(w, o, bus) {
  var v = o.v == null ? .4 : o.v, n = noise('white', w, w + .3), g = G(0);
  g.gain.setValueAtTime(0, w);
  [0, .009, .018].forEach(function (k) { g.gain.setValueAtTime(v * 2, w + k); g.gain.setTargetAtTime(0, w + k + .001, .003); });
  g.gain.setValueAtTime(v * 1.6, w + .027); g.gain.setTargetAtTime(0, w + .028, .03);
  chainN(n, filt('bandpass', o.f || 1150, 1.2), g);
  out(g, bus || 's', o.wet == null ? .35 : o.wet, o.pan);
}
/* 撞碎（门/屋塌/石裂）：o = {v, d, lp} */
function crash(w, o, bus) {
  var v = o.v == null ? .5 : o.v, d = o.d || .8, r = rng((w * 1000) | 0), mix = G(1), n = noise('white', w, w + d + .2), g = G(0);
  hit(g.gain, w, v, .002, d / 4); chainN(n, filt('lowpass', o.lp || 3200, .7), g, mix);
  for (var i = 0; i < 10; i++) {
    var t = w + .05 + r() * d, tn = noise('white', t, t + .05), tg = G(0);
    hit(tg.gain, t, v * .5 * r(), .001, .008); chainN(tn, filt('bandpass', 700 + r() * 2500, 2), tg, mix);
  }
  out(mix, bus || 's', .3, o.pan);
  thump(w, { v: v * .9, f: 68, d: .55 }, bus);
}

/* ================= 提示表（cue sheet） =================
   各幕用幕内相对秒编写，经 CINE.acts() 的 start 换算为全局秒。
   一次性音效从中途截入时跳过；持续层 / 乐句从截入点续上。 */
function one(fn) { return function (c, from) { if (from > c.t + .05) return; fn(W(c.t), c.o, c.o.bus); }; }
function phr(fn) {
  return function (c, from) {
    var ns = [];
    c.o.ns.forEach(function (n) {
      if (n.t >= from - .02) ns.push({ w: W(n.t), d: n.d, m: n.m, f: n.f });
      else if (n.t + n.d - from > .15) ns.push({ w: W(from), d: n.t + n.d - from, m: n.m, f: true });   // 切入点落在拖腔中段：从切入时刻按剩余时长补排
    });
    if (ns.length) fn(ns, c.o, c.o.bus);
  };
}
var FN = {
  whoosh: one(whoosh), thunder: one(thunder), step: one(step), thump: one(thump), hammer: one(hammer),
  sword: one(sword), snap: one(snap), cry: one(cry), drop: one(drop), shatter: one(shatter), clap: one(clap),
  crash: one(crash), qing: one(qing), qin: one(qinNote), harm: one(qinHarm),
  xiao: phr(xiaoPhrase), xun: phr(xunPhrase), voice: phr(voicePhrase),
  clip: clip, pad: pad, wind: wind, windTune: windTune, water: water, fire: fire, buzz: buzz, duck: duck
};
var L = [], OFF = 0, DUR = 0, NDUR = 0, CUEKEY = '';
/* 幕加长（幕定义带 warp = U.warp 表）：各幕提示表仍按旧秒书写，WT 把旧秒换成新秒；新写的段落用 raw() 包住、直接写新秒。
   二次加长（强化 1010）：幕定义再带 rawWarp（1009 秒 → 1010 秒），warp 为旧秒 → 1010 秒的合成表；
   raw() 里写的是 1009 秒（经 rawWarp 换算），raw2() 里写的是 1010 新秒（不换算）。
   三次加长（强化 1012）：幕定义再带 raw2Warp（1010 → 1012），raw2() 里的 1010 秒经它换算，raw3() 写 1012 新秒。
   四次加长（强化 1013 §2.2）：幕定义再带 outer（W13：现行秒 → 1013 秒），OW 把上面各层换出的现行秒再换到 1013 秒；raw13() 写 1013 秒（两层都不换算）。 */
function ID(t) { return t; }
var WT = ID, RWT = ID, R2WT = ID, OW = ID;
function raw(fn) { var w = WT; WT = RWT; try { fn(); } finally { WT = w; } }
function raw2(fn) { var w = WT; WT = R2WT; try { fn(); } finally { WT = w; } }
function raw3(fn) { var w = WT; WT = ID; try { fn(); } finally { WT = w; } }
function raw13(fn) { var w = WT, o = OW; WT = ID; OW = ID; try { fn(); } finally { WT = w; OW = o; } }
function cue(n, t, o, len) {
  var t1 = OW(WT(t)), e1 = OW(WT(t + (len || 0)));
  if (t1 > NDUR + 1) return null;                        // 幕被缩短时丢弃越界的提示
  var c = { n: n, t: OFF + t1, e: OFF + e1, f: FN[n], o: o || {} };
  L.push(c); return c;
}
/* 持续层：keys/fk/lpKeys/wh 用幕内秒书写，这里换成相对 t0 */
function bed(n, t0, t1, o) {
  var w0 = OW(WT(t0));
  ['keys', 'fk', 'lpKeys', 'wh'].forEach(function (k) {
    if (!o[k]) return;
    o[k] = o[k].map(function (x) { return [OW(WT(x[0])) - w0, x[1]]; }).sort(function (a, b) { return a[0] - b[0]; });
  });
  return cue(n, t0, o, t1 - t0);
}
/* 乐句：ns 为幕内秒的 [{t,d,m}] */
function phrase(n, ns, o) {
  if (!ns.length) return null;
  o.ns = ns.map(function (x) { var a = OW(WT(x.t)); return { t: OFF + a, d: OW(WT(x.t + x.d)) - a, m: x.m, f: x.first }; });   // f：字首音（箫 art、埙按字吐音用）
  var z = ns[ns.length - 1];
  return cue(n, ns[0].t, o, z.t + z.d - ns[0].t + (o.rel || .3) * 2);
}
function nl(arr) { return arr.map(function (x) { return { t: x[0], m: x[1], d: x[2], first: true }; }); }
function lineNotes(key, t0, beat) {
  var k = beat / BEAT;
  return LINES[key].notes.map(function (n) { return { t: t0 + n.t * k, d: n.d * k, m: n.m, ci: n.ci, first: n.first, last: n.last }; });
}
function segLines(id) {
  var r = [];
  segWalk(id, 'notes').forEach(function (n) { (r[n.li] = r[n.li] || []).push(n); });
  return r;
}
/* 琴按句弹：一字两音且相邻（≤3 半音）时不再拨，改用滑音（琴的"上/下"） */
function qinLine(ns, o) {
  var tr = o.tr || 0;
  for (var i = 0; i < ns.length; i++) {
    var n = ns[i], nx = ns[i + 1];
    if (o.first && !n.first) continue;
    var q = { m: n.m + tr, d: n.d, v: (n.first ? 1 : .8) * o.v, br: o.br, lp: o.lp, pan: o.pan, wet: o.wet };
    if (n.d > .45) q.vib = o.vib || .005;
    if (!o.first && nx && !nx.first && Math.abs(nx.m - n.m) <= 3) {
      q.gl = nx.m - n.m; q.gs = n.d - .03; q.gt = Math.min(.14, nx.d * .5); q.d = n.d + nx.d;
      if (nx.d > .45) q.vib = o.vib || .005;
      i++;
    }
    cue('qin', n.t, q);
  }
}
function steps(t0, t1, per, o, seed) {
  var r = rng(seed || 1), t = t0;
  while (t < t1) {
    var v = typeof o.v === 'number' ? o.v : kfv(o.v, t);
    cue('step', t, { v: v * (.8 + r() * .35), f: (o.f || 1100) * (.9 + r() * .2), pan: o.pan, twin: o.twin, wet: o.wet });
    t += (typeof per === 'number' ? per : kfv(per, t)) * (1 + (r() - .5) * (o.jit || .12));
  }
}
function arp(t0, dt, ms, o) { ms.forEach(function (m, i) { var q = cp(o); q.m = m; cue(o.harm ? 'harm' : 'qin', t0 + i * dt, q); }); }
/* 节拍锚点：幕文件若注册了同名 beats（如 '4b'），且与默认值相差 <15s，则以其为准 */
function anchors(a, def) {
  var r = cp(def);
  ((a && a.beats) || []).forEach(function (b) {
    var id = String(b.id).replace(/^(beat|b)[-_.]?(?=\d)/i, '');
    if (r.hasOwnProperty(id) && typeof b.t === 'number' && Math.abs(b.t - r[id]) < 15) r[id] = b.t;
  });
  return r;
}

/* ---------- 汇编：定位各幕 → 逐幕写入 → 排序 ----------
   占位：SHEETS 为空，不产生任何提示。接入配乐时往 SHEETS 里推 [幕id, function (act) { cue(...); bed(...); ... }]，
   幕内秒书写；cue/bed/phrase 见上；DUR 为本幕时长，OFF 为本幕全局起点。幕 id 对应 CINE.registerAct 的 id（act0…act6）。 */
var SHEETS = [];
function resolveActs() {
  var list = (CINE.acts && CINE.acts()) || [], M = {};
  SHEETS.forEach(function (x) {
    var hit = null;
    list.forEach(function (a) { if (!hit && a.id === x[0]) hit = a; });
    M[x[0]] = hit;
  });
  return M;
}
/* ---------- 配乐 v2 段落表：每段一条 clip（全片秒 [a+pad, b−pad] ± xf，两端线性交叉），外加封口骤静里的极弱高空风（实时合成，不进音轨）。
   音轨本身由 tools/build-audio.sh 按 cue 表离线渲染（乐谱 tools/score/score-v2.mjs），这里只负责按全片秒放回去。 ---------- */
function put(n, t, e, o) { if (!(e > t)) return null; var c = { n: n, t: t, e: e, f: FN[n], o: o }; L.push(c); return c; }
function SCORE() {
  if (!SV) return;
  var n = SV.parts.length, xf = SV.xf || .05, lead = SV.lead || 0;
  SV.parts.forEach(function (P, i) {
    var s0 = i ? i * SV.chunk : 0, s1 = i < n - 1 ? (i + 1) * SV.chunk : P.b;
    var t = i ? s0 - xf : 0, e = i < n - 1 ? s1 + xf : P.b, len = e - t;
    put('clip', t, e, {
      src: partKey(i), off: t - P.a + lead,
      keys: [[0, i ? 0 : 1], [i ? 2 * xf : .001, 1], [i < n - 1 ? len - 2 * xf : len, 1], [len, i < n - 1 ? 0 : 1]]
    });
  });
}
function buildCues() {
  var M = resolveActs(), key = SHEETS.map(function (x) { var a = M[x[0]]; return a ? a.start + ':' + a.duration : '-'; }).join('|');
  key += '#' + ((CINE.acts && CINE.acts()) || []).map(function (a) { return a.start + ':' + a.duration; }).join(',') + '#' + (SV ? SV.parts.length : 0);
  if (cues && key === CUEKEY) return cues;
  L = [];
  if (CINE.cue || SV) { try { SCORE(); } catch (e) { L = []; if (A.errors.length < 20) A.errors.push('score: ' + (e && e.message || e)); } }
  SHEETS.forEach(function (x) {
    var a = M[x[0]]; if (!a) return;
    OFF = a.start; NDUR = a.duration;
    var lg = a.warp && a.legacy;
    RWT = a.rawWarp ? a.rawWarp.toNew : ID;
    R2WT = a.raw2Warp ? a.raw2Warp.toNew : ID;
    OW = a.outer ? a.outer.toNew : ID;
    DUR = lg ? lg.duration : a.outer ? a.outer.toOld(a.duration) : a.duration; WT = lg ? a.warp.toNew : RWT;
    var n0 = L.length;
    x[1](lg ? { id: a.id, beats: lg.beats, duration: lg.duration, warp: a.warp } : a);
    WT = ID; RWT = ID; R2WT = ID; OW = ID;
    for (var i = n0; i < L.length; i++) L[i].act = x[0];
  });
  L.sort(function (p, q) { return p.t - q.t; });
  cues = L; CUEKEY = key;
  return cues;
}

/* ---------- 调试/测试钩子（不影响播放） ---------- */
A.cues = function () { return buildCues(); };
/* 各幕定义里导出的音乐/音效锚点（engine 合并好的全局表：[{id:'幕id.名', act, name, t 幕内秒, T 全片秒, …}]），配乐代理按名取点位用；
   A.actCue('jiuquan.bell') 取单项。这里只读、不排任何声音。 */
A.actCues = function () { return CINE.cueTable ? CINE.cueTable() : []; };
A.actCue = function (id) { return CINE.cue ? CINE.cue(id) : null; };
A.muted = MUTED;
A.ctx = function () { return ctx; };
A.master = function () { return master; };
A.base = function () { return sess ? base : null; };
A.setVoiceDuck = function (mult) {
  var m = isFinite(+mult) ? clamp(+mult, 0, 1) : 1;
  voiceDuck = m;
  if (extOn && EXT) { try { EXT.volume = m; } catch (e) { /* 忽略 */ } return; }
  if (!sess || !ctx || extOn) return;
  var now = ctx.currentTime;
  sess.m.gain.setTargetAtTime(m, now, .04);
  sess.mRv.gain.setTargetAtTime(m, now, .04);
};
A.score = function () { return extOn && EXT ? EXT.currentSrc || EXT.src : null; };
/* 配乐状态：state（null 未载 / missing / wait / loading / ready）、已解码的段及时长、当前会话里在响的段及其此刻的源位置、资产与幕表是否过期 */
A.clips = function () {
  var r = { state: clipState, buffers: {}, playing: [], T: ctx && sess ? ctx.currentTime - base : null, parts: SV ? SV.parts.length : 0, chunk: SV ? SV.chunk : null, lead: SV ? SV.lead || 0 : null, stale: !!A.stale };
  Object.keys(CLIP).forEach(function (k) { r.buffers[k] = +CLIP[k].duration.toFixed(3); });
  if (ctx && sess) {
    var now = ctx.currentTime;
    sess.clips.forEach(function (x) {
      if (now < x.st || now > x.end) return;
      var p = x.pos + (now - x.st) * x.rate;
      if (x.loop && p >= x.loop[1]) p = x.loop[0] + (p - x.loop[0]) % (x.loop[1] - x.loop[0]);
      r.playing.push({ src: x.c.o.src, t: x.c.t, e: x.c.e, off: x.c.o.off, rate: x.rate, pos: p, loop: !!x.loop });
    });
  }
  return r;
};
/* 自测：解码第 i 段，返回 Promise<{sr, len, a 段首全片秒, L: 从 from 样本起 n 个左声道样本}> */
A._part = function (i, from, n) {
  return new Promise(function (res) {
    var dc = decCtx(); if (!SV || !dc) { res(null); return; }
    decodePart(i, dc, function (b) {
      if (!b) { res(null); return; }
      var d = b.getChannelData(0), o = []; for (var k = from; k < Math.min(d.length, from + n); k++) o.push(d[k]);
      res({ sr: b.sampleRate, len: b.length, dur: b.duration, a: SV.parts[i].a, L: o });
    });
  });
};
/* 离线渲染 [T0, T1) 全局秒，返回 Promise<AudioBuffer>；仅供自测页使用。先把区间内的配乐段解进一张临时表（按离线上下文采样率），不动播放用的缓存 */
A._offline = function (T0, T1, sr, pred) {
  var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  sr = sr || 44100;
  var oc = new OAC(2, Math.ceil((T1 - T0) * sr), sr), tmp = {}, want = [];
  if (SV) for (var i = partAt(Math.max(0, T0 - 1)); i <= partAt(T1); i++) want.push(i);
  return Promise.all(want.map(function (i) { return new Promise(function (res) { decodePart(i, oc, function (b) { if (b) tmp[partKey(i)] = b; res(); }); }); })).then(function () {
    var keep = { ctx: ctx, master: master, sess: sess, base: base, extOn: extOn, voiceDuck: voiceDuck, revBuf: revBuf, KS: KS, NZ: { white: NZ.white, pink: NZ.pink, brown: NZ.brown } };
    ctx = oc; makeMaster(); buildCues(); extOn = false; voiceDuck = 1;
    base = -T0; sess = newSess(); BUFS = tmp;
    try { cues.forEach(function (c) { if (c.t < T1 && (c.t >= T0 || c.e > T0 + .05) && (!pred || pred(c))) run(c, Math.max(c.t, T0)); }); }
    finally { BUFS = null; }
    var pr = oc.startRendering();
    ctx = keep.ctx; master = keep.master; sess = keep.sess; base = keep.base; extOn = keep.extOn; voiceDuck = keep.voiceDuck;
    revBuf = keep.revBuf; KS = keep.KS; NZ.white = keep.NZ.white; NZ.pink = keep.NZ.pink; NZ.brown = keep.NZ.brown;
    return pr;
  });
};
mountClips();
})();
