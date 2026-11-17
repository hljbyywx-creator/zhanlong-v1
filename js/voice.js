/* 《斩龙封神》角色配音运行时 js/voice.js —— 与 CINE.audio 共享 AudioContext，零网络依赖。
   读取 window.CINE_VOICES = { clips: [{ id, G, dur, gain, role, text, src }] }（src 为 data:audio/mpeg;base64,...，由 voice-assets.js 提供）；
   ?mute=1 / ?shot=1 / ?bench=1 时完全静默跳过（不挂载资产、不建上下文、不解码）；
   按 [T - 2, T + 35] 滑窗预解码，支持任意时刻 play / pause / seek 精确偏移截入，并驱动 CINE.audio.setVoiceDuck 平滑闪避配乐（0.40，前导 0.15s，释放 0.35s）。 */
(function () {
'use strict';
var CINE = window.CINE = window.CINE || {};

var Q = {};
try {
  String(window.location && window.location.search || '').replace(/^\?/, '').split('&').forEach(function (kv) {
    if (!kv) return;
    var p = kv.split('=');
    Q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '1');
  });
} catch (e) { /* 无 location 时忽略 */ }
var MUTED = Q.mute === '1' || Q.shot === '1' || Q.bench === '1' || !!Q.bench;

var DUCK_FLOOR = 0.40;
var LEAD_IN = 0.15;
var RELEASE = 0.35;
var WIN_BACK = 2.0;
var WIN_AHEAD = 35.0;
var LOOKAHEAD = 1.8;
var MAX_KEEP = 32;

function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
function smooth(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }

var V = CINE.voice = {
  muted: MUTED,
  errors: []
};

var CLIPS = [];
var BY_ID = {};
var BUF = {};
var DEC = {};
var vState = null;       // null | 'loading' | 'ready' | 'missing' | 'empty'
var rawRef = undefined;
var vsess = null;
var lastT = 0;
var pruneAt = 0;
var cineHooked = false;

function err(msg) {
  if (V.errors.length < 20) V.errors.push(String(msg));
}

function audioMod() { return CINE.audio || null; }
function getCtx() {
  var A = audioMod();
  return A && typeof A.ctx === 'function' ? A.ctx() : null;
}
function decCtx() {
  var c = getCtx();
  if (c) return c;
  var W = typeof window !== 'undefined' ? window : null;
  var OAC = W && (W.OfflineAudioContext || W.webkitOfflineAudioContext);
  try { return OAC ? new OAC(2, 1, 44100) : null; } catch (e) { return null; }
}

/* 同步消化 window.CINE_VOICES（兼容先于或晚于本脚本载入的 voice-assets.js） */
function ingestVoices() {
  if (MUTED || typeof window === 'undefined') return false;
  var src = window.CINE_VOICES;
  if (src === rawRef) return CLIPS.length > 0;
  rawRef = src;
  CLIPS = [];
  BY_ID = {};
  if (!src) {
    if (src === null) vState = 'missing';
    return false;
  }
  var list = Array.isArray(src) ? src : Array.isArray(src.clips) ? src.clips : [];
  for (var i = 0; i < list.length; i++) {
    var it = list[i];
    if (!it || typeof it.G !== 'number' || !isFinite(it.G)) continue;
    var id = String(it.id != null ? it.id : 'v' + i);
    var c = {
      id: id,
      G: +it.G,
      dur: typeof it.dur === 'number' && it.dur > 0 ? +it.dur : 0,
      gain: typeof it.gain === 'number' && isFinite(it.gain) ? clamp(+it.gain, 0, 4) : 1,
      role: it.role || '',
      text: it.text || '',
      src: typeof it.src === 'string' ? it.src : ''
    };
    CLIPS.push(c);
    BY_ID[id] = c;
  }
  CLIPS.sort(function (a, b) { return a.G - b.G || (a.id < b.id ? -1 : 1); });
  vState = CLIPS.length ? 'ready' : 'empty';
  return CLIPS.length > 0;
}

/* 纯函数闪避包络：台词期压至 0.40，前导 0.15s 平滑压下，句尾 0.35s 平滑回升至 1.0 */
V.duckAt = function (T) {
  if (MUTED || typeof T !== 'number' || !isFinite(T)) return 1.0;
  ingestVoices();
  if (!CLIPS.length) return 1.0;
  var mult = 1.0;
  for (var i = 0; i < CLIPS.length; i++) {
    var c = CLIPS[i];
    var d = (BUF[c.id] ? BUF[c.id].duration : c.dur) || 0;
    if (d <= 0) continue;
    var g0 = c.G, g1 = g0 + d;
    if (g0 - LEAD_IN > T) break;               // CLIPS 按 G 升序，后续更晚无需再扫
    if (T >= g1 + RELEASE) continue;
    var m = 1.0;
    if (T >= g0 && T <= g1) {
      m = DUCK_FLOOR;
    } else if (T < g0) {
      m = 1.0 - (1.0 - DUCK_FLOOR) * smooth((T - (g0 - LEAD_IN)) / LEAD_IN);
    } else {
      m = DUCK_FLOOR + (1.0 - DUCK_FLOOR) * smooth((T - g1) / RELEASE);
    }
    if (m < mult) mult = m;
    if (mult <= DUCK_FLOOR) return DUCK_FLOOR;
  }
  return mult;
};

function applyDuck(T) {
  var A = audioMod();
  if (A && typeof A.setVoiceDuck === 'function') {
    A.setVoiceDuck(T == null ? 1.0 : V.duckAt(T));
  }
}

/* 解码单条 base64 MP3/音频 URI */
function decodeClip(c, dc, cb) {
  if (!c || !c.src) { cb(null); return; }
  var once = false;
  var ok = function (b) { if (once) return; once = true; cb(b); };
  var bad = function (e) {
    if (once) return;
    once = true;
    err('voice ' + c.id + ': ' + (e && e.message || e || 'decode failed'));
    cb(null);
  };
  try {
    var comma = c.src.indexOf(',');
    var b64 = (comma >= 0 ? c.src.slice(comma + 1) : c.src).replace(/\s+/g, '');
    var bin = atob(b64);
    var u8 = new Uint8Array(bin.length);
    for (var k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
    var pr = dc.decodeAudioData(u8.buffer, ok, bad);
    if (pr && typeof pr.then === 'function') pr.then(ok, bad);
  } catch (e) { bad(e); }
}

function evictBuffers(T) {
  var ks = Object.keys(BUF);
  if (ks.length <= MAX_KEEP) return;
  ks.sort(function (a, b) {
    var ca = BY_ID[a], cb = BY_ID[b];
    var da = ca ? Math.abs(ca.G - T) : 1e9;
    var db = cb ? Math.abs(cb.G - T) : 1e9;
    return db - da;
  });
  for (var i = 0; i < ks.length - MAX_KEEP; i++) {
    var id = ks[i], cl = BY_ID[id];
    if (vsess && vsess.scheduled[id]) continue;
    if (cl && cl.G >= T - WIN_BACK - 4 && cl.G <= T + WIN_AHEAD + 4) continue;
    delete BUF[id];
  }
}

function needClip(c, cb) {
  if (!c || !c.src) { if (cb) cb(false); return; }
  if (BUF[c.id]) { if (cb) cb(true); return; }
  if (DEC[c.id]) { if (cb) DEC[c.id].push(cb); return; }
  var dc = decCtx();
  if (!dc) { if (cb) cb(false); return; }
  DEC[c.id] = cb ? [cb] : [];
  decodeClip(c, dc, function (b) {
    var waiters = DEC[c.id] || [];
    delete DEC[c.id];
    if (b) {
      BUF[c.id] = b;
      if (!c.dur || Math.abs(c.dur - b.duration) > 0.02) c.dur = b.duration;
      evictBuffers(lastT);
      onClipReady(c);
    }
    for (var i = 0; i < waiters.length; i++) waiters[i](!!b);
  });
}

/* [T - 2, T + 35] 窗口预解码 */
V.prefetch = function (T) {
  if (MUTED) return;
  ingestVoices();
  if (!CLIPS.length) return;
  lastT = typeof T === 'number' && isFinite(T) ? T : 0;
  var lo = lastT - WIN_BACK, hi = lastT + WIN_AHEAD;
  for (var i = 0; i < CLIPS.length; i++) {
    var c = CLIPS[i], estDur = (BUF[c.id] ? BUF[c.id].duration : c.dur) || 8;
    if (c.G > hi) break;
    if (c.G + estDur >= lo) needClip(c);
  }
};

function sessBase(s) {
  var A = audioMod();
  var ab = A && typeof A.base === 'function' ? A.base() : null;
  return typeof ab === 'number' && isFinite(ab) ? ab : s.baseFallback;
}

function currentFilmTime(s) {
  var actx = getCtx();
  if (!actx || !s) return lastT;
  return actx.currentTime - sessBase(s);
}

function startClipNode(s, c, fromT) {
  var actx = getCtx();
  if (!actx || !s || s !== vsess || s.scheduled[c.id]) return;
  var b = BUF[c.id];
  if (!b) return;
  var d = b.duration;
  if (fromT >= c.G + d - 0.03) return;

  var base = sessBase(s);
  var startFilm = Math.max(c.G, fromT);
  var off = Math.max(0, startFilm - c.G);
  var rem = d - off;
  if (rem < 0.03) return;

  var now = actx.currentTime;
  var st = base + startFilm;
  if (st < now + 0.005) {
    var slip = (now + 0.005) - st;
    off += slip;
    rem = d - off;
    st = now + 0.005;
    if (rem < 0.03) return;
  }
  var end = st + rem;

  var src = actx.createBufferSource();
  src.buffer = b;
  var g = actx.createGain();
  var gv = c.gain;
  if (off > 0.01) {
    g.gain.setValueAtTime(0, st);
    g.gain.linearRampToValueAtTime(gv, Math.min(end, st + 0.022));
  } else {
    g.gain.setValueAtTime(gv, st);
  }
  if (rem > 0.04) {
    g.gain.setValueAtTime(gv, Math.max(st + 0.022, end - 0.02));
    g.gain.linearRampToValueAtTime(0, end);
  }

  src.connect(g);
  g.connect(s.out);
  src.start(st, off);
  src.stop(end + 0.02);

  s.scheduled[c.id] = 1;
  s.active.push({ id: c.id, clip: c, src: src, gain: g, st: st, end: end, off: off });
}

/* 异步解码完成时若当前正在播且落在该句区间/前瞻窗内，立即按精确偏移补排 */
function onClipReady(c) {
  if (!vsess || !getCtx()) return;
  var T = currentFilmTime(vsess);
  if (c.G <= T + LOOKAHEAD && c.G + BUF[c.id].duration > T + 0.04) {
    startClipNode(vsess, c, T);
    applyDuck(T);
  }
}

V.onInit = function () {
  if (MUTED) return;
  hookCine();
  ingestVoices();
  if (CLIPS.length) V.prefetch(lastT);
};
V.init = V.onInit;

V.scheduleFrom = function (T0) {
  if (MUTED) return;
  hookCine();
  ingestVoices();
  var actx = getCtx();
  if (!actx) return;
  if (vsess) V.stopAll(true);

  T0 = typeof T0 === 'number' && isFinite(T0) ? Math.max(0, T0) : 0;
  lastT = T0;
  var A = audioMod();
  var lead = A && typeof A.LEAD === 'number' ? A.LEAD : 0.2;
  var dst = (A && typeof A.master === 'function' && A.master()) || actx.destination;
  var out = actx.createGain();
  out.gain.value = 1;
  out.connect(dst);

  vsess = {
    out: out,
    active: [],
    scheduled: {},
    t0: T0,
    baseFallback: actx.currentTime + lead - T0
  };
  pruneAt = actx.currentTime + 2;

  V.prefetch(T0);
  applyDuck(T0);
  V.tick(T0);
};

V.tick = function (T) {
  if (MUTED || !vsess) return;
  var actx = getCtx();
  if (!actx) return;
  T = typeof T === 'number' && isFinite(T) ? T : currentFilmTime(vsess);
  lastT = T;
  V.prefetch(T);
  applyDuck(T);

  var lim = T + LOOKAHEAD;
  for (var i = 0; i < CLIPS.length; i++) {
    var c = CLIPS[i];
    if (c.G > lim) break;
    if (vsess.scheduled[c.id]) continue;
    var d = (BUF[c.id] ? BUF[c.id].duration : c.dur) || 0;
    if (c.G + d > T + 0.03) startClipNode(vsess, c, T);
  }

  var now = actx.currentTime;
  if (now > pruneAt) {
    pruneAt = now + 2;
    vsess.active = vsess.active.filter(function (x) { return x.end > now - 0.3; });
  }
};

V.stopAll = function (hard) {
  applyDuck(null);
  var actx = getCtx();
  if (!vsess || !actx) { vsess = null; return; }
  var s = vsess;
  vsess = null;
  var now = actx.currentTime, g = s.out.gain;
  try {
    g.cancelScheduledValues(0);
    if (hard) g.setValueAtTime(0, now);
    else { g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(0, now + 0.045); }
  } catch (e) { /* 忽略 */ }
  var kill = function () {
    for (var i = 0; i < s.active.length; i++) {
      try { s.active[i].src.stop(); } catch (e) { /* 已停 */ }
    }
    s.active = [];
    try { s.out.disconnect(); } catch (e) { /* 已断 */ }
  };
  if (hard) kill(); else setTimeout(kill, 70);
};

/* 独立/外部控制接口：兼容直接调用 play / pause / seek */
V.play = function (T) {
  if (MUTED) return;
  var A = audioMod();
  if (A && typeof A.init === 'function' && !getCtx()) A.init();
  V.scheduleFrom(T != null ? T : lastT);
};
V.pause = function () { V.stopAll(false); };
V.seek = function (T) {
  if (MUTED) return;
  var t = typeof T === 'number' && isFinite(T) ? Math.max(0, T) : 0;
  lastT = t;
  if (vsess) V.scheduleFrom(t);
  else V.prefetch(t);
};

/* 观测与诊断接口 */
V.clips = function () {
  ingestVoices();
  var actx = getCtx(), playing = [], bufs = {};
  Object.keys(BUF).forEach(function (k) { bufs[k] = +BUF[k].duration.toFixed(3); });
  if (actx && vsess) {
    var now = actx.currentTime;
    for (var i = 0; i < vsess.active.length; i++) {
      var x = vsess.active[i];
      if (now >= x.st && now <= x.end) {
        playing.push({ id: x.id, G: x.clip.G, role: x.clip.role, pos: +(x.off + (now - x.st)).toFixed(3) });
      }
    }
  }
  return {
    state: vState,
    total: CLIPS.length,
    buffers: bufs,
    playing: playing,
    T: actx && vsess ? +(currentFilmTime(vsess)).toFixed(3) : null,
    duck: +(V.duckAt(lastT)).toFixed(3)
  };
};
V.state = V.clips;

/* 挂钩 window.__cine.seek：暂停态拖动进度条时也提前预解码目标窗口 [T - 2, T + 35] */
function hookCine() {
  if (cineHooked || MUTED || typeof window === 'undefined' || !window.__cine) return;
  var cine = window.__cine;
  if (typeof cine.seek !== 'function') return;
  cineHooked = true;
  var origSeek = cine.seek;
  cine.seek = function (T) {
    var res = origSeek.apply(this, arguments);
    var st = cine.state ? cine.state() : null;
    var t = st && typeof st.T === 'number' ? st.T : (+T || 0);
    lastT = t;
    if (!vsess) V.prefetch(t);
    return res;
  };
}

function mountVoices() {
  if (MUTED || typeof document === 'undefined') return;
  if (window.CINE_VOICES !== undefined) {
    ingestVoices();
    if (CLIPS.length) V.prefetch(0);
    return;
  }
  vState = 'loading';
  var me = document.currentScript && document.currentScript.src || '';
  var s = document.createElement('script');
  s.src = /js\/voice\.js(\?.*)?$/.test(me) ? me.replace(/js\/voice\.js(\?.*)?$/, 'voice-assets.js') : 'voice-assets.js';
  s.onload = function () {
    if (!ingestVoices() && vState === 'loading') vState = 'missing';
    if (CLIPS.length) V.prefetch(lastT);
  };
  s.onerror = function () { vState = 'missing'; };
  (document.head || document.documentElement).appendChild(s);
}

mountVoices();
if (!MUTED && typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('DOMContentLoaded', function () { hookCine(); });
  setTimeout(hookCine, 0);
}
})();
