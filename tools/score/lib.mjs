/* 《剑破绝关》配乐 v2 · 乐谱构造工具：时间一律由「幕起点 + 幕内 cue」取（S.T('act2.seal')），不写死全片秒。
   事件交给 tools/music-render.mjs 渲染：n 采样音符 / p 打击 / s 合成层；kills 硬停窗；muffle 全局闷音（低通）自动化；marks/theme 供自检。
   乐器：zheng 古筝（真采样 8 根音，音域外自动由 dan 越南筝补）、dan 越南筝、cello 大提琴组、bowed 小提琴组、flute 长笛（代笛）、
        drum 大鼓、gong 锣、cym 钹、snare 军鼓（压低当板鼓用）；合成只用于低频鼓体 sub 与风/热浪/地鸣噪声。 */

export const MODES = { yu: [0, 3, 5, 7, 10], gong: [0, 2, 4, 7, 9], shang: [0, 2, 5, 7, 10], zhi: [0, 2, 5, 7, 9] };
/* 主题（D 羽，4/4 一拍一单位）：前句＝问句＋落音；后句回落主音。半音偏移相对主音。 */
export const THEME = { a: [[0, 1], [7, 1.5], [5, .5], [7, 1], [10, 1.5], [12, 2.5]], b: [[12, 1], [10, .5], [7, .5], [5, 1.5], [3, .5], [5, 1], [0, 3]] };
export const THEME_MAJ = [[0, 1], [7, 1.5], [4, .5], [7, 1], [9, 1.5], [12, 2.5]];   // 界域：大调（宫调式）版
export const LINGMING = [19, 22, 17, 19];                // 灵明动机（相对 D4）：A5 C6 G5 A5，极轻

/* 音阶：key 为主音 MIDI，取第 n 级（可负、跨八度） */
export function deg(key, mode, n) { const s = MODES[mode], o = Math.floor(n / s.length), i = ((n % s.length) + s.length) % s.length; return key + 12 * o + s[i]; }
export function scaleBetween(key, mode, a, b) {        // a..b（含端点附近）之间的调内音，按方向排列
  const lo = Math.min(a, b), hi = Math.max(a, b), out = [];
  for (let m = lo; m <= hi; m++) if (MODES[mode].includes(((m - key) % 12 + 12) % 12)) out.push(m);
  return a <= b ? out : out.reverse();
}

export function makeScore(cues) {
  const C = {}, A = {};
  for (const c of cues.cues) C[c.id] = c.T;
  for (const a of cues.acts) A[a.id] = a;
  let seed = 1;
  const S = {
    events: [], kills: [], muffle: [], marks: [], sections: [], theme: [], wet: .55, gs: 1,   // gs：段落整体增益（只影响之后写入的事件）
    duration: cues.duration, acts: cues.acts,
    T(id, d) { if (id in C) return C[id]; if (d !== undefined) return d; throw new Error('缺 cue ' + id); },
    has(id) { return id in C; },
    act(id) { return A[id] || null; },
    rnd(sd) { let a = (sd * 2654435761) >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; },
    section(name, t0, t1, note) { S.sections.push({ name, t0: +t0.toFixed(2), t1: +t1.toFixed(2), note }); },
    mark(t, label) { S.marks.push({ t: +t.toFixed(3), label }); },
    kill(t0, t1, o) { S.kills.push(o && o.tail ? { t0, t1, tail: true } : { t0, t1 }); },   // o.tail：窗前的声音与混响尾到窗后也不再回来（戛然而止）
    /* 全局闷音：[[t, Hz]…]（≥19000 视为不闷）；mf:false 的事件不受影响（如山底仍清楚的剑吟） */
    muf(keys) { S.muffle.push(...keys); S.muffle.sort((a, b) => a[0] - b[0]); },
    ev(e) { S.events.push(e); return e; }
  };
  const H = S.rnd(77);
  const hum = (t, ms) => t + (H() * 2 - 1) * (ms || 0) / 1000;
  const hv = (v, k) => v * (1 + (H() * 2 - 1) * (k == null ? .05 : k));
  const TRIM = { zheng: 1, dan: .85, cello: 1, bowed: .8, flute: .55 };
  const PAN = { zheng: -.28, dan: -.38, cello: .3, bowed: -.22, flute: .34 };
  const SEND = { zheng: .3, dan: .34, cello: .2, bowed: .28, flute: .38 };
  const RANGE = { zheng: [43, 84], dan: [43, 84], cello: [36, 61], bowed: [53, 80], flute: [56, 97] };
  S.folds = 0;
  const fold = (i, m) => { const [lo, hi] = RANGE[i]; let x = m; while (x > hi) x -= 12; while (x < lo) x += 12; if (x !== m) S.folds++; return x; };

  /* ---------- 采样音符 ---------- */
  S.note = (i, t, m, v, o = {}) => S.ev({ k: 'n', i, t: o.exact ? t : hum(t, o.hum == null ? 6 : o.hum), m: fold(i, m), v: o.exact ? v : hv(v, o.vj), gain: (o.gain || 1) * TRIM[i] * S.gs, pan: o.pan == null ? PAN[i] : o.pan, send: o.send == null ? SEND[i] : o.send,
    d: o.d, att: o.att, rel: o.rel, off: o.off, env: o.env, genv: o.genv, bend: o.bend, vib: o.vib, lp: o.lp, mf: o.mf, rr: o.rr });
  /* 古筝单音：o.bend 'up'（按弦上滑大二度）| 'down'（下滑音）| 'up1'（上滑小二度）| 数组；o.vib true＝揉弦（音长 >0.5s 时自然起） */
  S.z = (t, m, v, o = {}) => {
    const q = { ...o };
    if (o.bend === 'up') q.bend = [[0, 0], [o.bt || .22, 0], [(o.bt || .22) + .2, 2]];
    else if (o.bend === 'up1') q.bend = [[0, 0], [o.bt || .2, 0], [(o.bt || .2) + .16, 1]];
    else if (o.bend === 'down') q.bend = [[0, 0], [o.bt || .25, 0], [(o.bt || .25) + .25, -2]];
    else if (o.bend === 'pre') q.bend = [[0, 2], [o.bt || .14, 2], [(o.bt || .14) + .2, 0]];   // 先按后放（回滑）
    if (o.vib === true) q.vib = { f: 5.4, c: 22, at: .28, ramp: .45 };
    return S.note('zheng', t, m, v, q);
  };
  S.dan = (t, m, v, o = {}) => S.note('dan', t, m, v, o.vib === true ? { ...o, vib: { f: 5.2, c: 16, at: .3, ramp: .5 } } : o);
  /* 摇指（轮指）：rate 次/秒，弱强交替，每下按住上一下（短淡出），末音自然余振 */
  S.trem = (t0, t1, m, v0, v1, o = {}) => {
    const r = S.rnd(Math.round(t0 * 100) + m), rate = o.rate || 12, inst = o.inst || 'zheng';
    let t = t0, i = 0;
    while (t < t1) {
      const k = (t - t0) / Math.max(.01, t1 - t0), rt = Array.isArray(rate) ? rate[0] + (rate[1] - rate[0]) * k : rate;
      const nx = t + (1 / rt) * (1 + (r() - .5) * .14), last = nx >= t1;
      const v = (v0 + (v1 - v0) * k) * (i % 2 ? .8 : 1) * (1 + (r() - .5) * .1);
      S.note(inst, t, Array.isArray(m) ? m[i % m.length] : m, v, { exact: true, rr: i % 2, d: last && !o.cut ? undefined : nx - t + .012, rel: last && !o.cut ? undefined : .035, off: r() * .003, pan: o.pan, send: o.send, lp: o.lp, mf: o.mf, gain: o.gain });
      t = nx; i++;
    }
  };
  /* 刮奏：调内音逐级（m0→m1），dur 内时间按 curve 分布（<1 先快后慢），音音相续不止 */
  S.gliss = (t0, dur, m0, m1, v, o = {}) => {
    const ms = scaleBetween(o.key == null ? 62 : o.key, o.mode || 'yu', m0, m1), n = ms.length, cu = o.curve || 1;
    ms.forEach((m, j) => {
      const k = n > 1 ? j / (n - 1) : 0, vv = v * (o.v1 == null ? 1 : 1 + (o.v1 / v - 1) * k);
      S.note(o.inst || 'zheng', t0 + dur * Math.pow(k, cu), m, vv, { hum: 3, rr: j % 2, pan: o.pan, send: o.send, mf: o.mf, gain: o.gain, d: o.d });
    });
  };
  /* 扫弦/撮：和弦由低到高快速滚奏 */
  S.strum = (t, ms, v, o = {}) => { const sp = o.spread == null ? .022 : o.spread; ms.forEach((m, j) => S.note(o.inst || 'zheng', t + j * sp, m, v * (1 - j * .03), { hum: 2, pan: o.pan, send: o.send, mf: o.mf, vib: o.vib, gain: o.gain, d: o.d })); };
  /* ---------- 弓弦/长笛：持续音 ---------- */
  const sus = (i) => (t, m, d, v, o = {}) => {
    const q = { ...o, d };
    if (o.sfz) { q.off = .25; q.att = .012; q.env = o.env || [[0, 1.25], [.35, .7], [Math.max(.4, d), .8]]; }
    else if (q.att == null) q.att = i === 'flute' ? .07 : .22;
    if (o.swell) q.env = [[0, o.swell[0]], [d * .5, o.swell[1]], [d, o.swell[2] == null ? o.swell[0] : o.swell[2]]];
    return S.note(i, t, m, v, q);
  };
  S.cello = sus('cello'); S.bowed = sus('bowed'); S.flute = sus('flute');
  /* 长和弦/持续音：按 seg 秒分弓（相邻两弓等功率交叠 xf 秒、轮换根音采样），整体力度按全局包络 genv [[T, g]…]（缺省两端淡入淡出 fi/fo） */
  S.pad = (i, t0, t1, ms, v, o = {}) => {
    const seg = o.seg || 8.5, xf = o.xf || 1.8, fi = o.fi == null ? 2 : o.fi, fo = o.fo == null ? 2 : o.fo;
    const genv = o.genv || null;
    let t = t0, j = 0;
    while (t < t1 - .3) {
      const e = Math.min(t1, t + seg), first = t === t0, last = e >= t1 - .01 || t1 - e < 2.5;
      const end = last ? t1 : e;
      for (const m of ms) S.note(i, t, m, v, { ...o, exact: true, d: (end - t) - (last ? fo : xf), att: first ? Math.max(.05, fi) : xf, rel: last ? Math.max(.05, fo) : xf, rr: (j + (m % 2)) % 2, genv, off: first ? o.off : .6 });
      if (last) break;
      t = e - xf; j++;
    }
  };
  /* 连奏句：notes = [[m, 长(秒), v?], …]；后续音从采样稳态处起（跳过起音）并与前音交叠，像一口气/一弓连下来 */
  S.line = (i, t0, notes, v, o = {}) => {
    let t = t0;
    notes.forEach(([m, d, vv], j) => {
      if (m != null) S.note(i, t, m, (vv || 1) * v, { ...o, d: d + .06, att: j ? .07 : (o.att || .15), off: j ? (o.offL || .35) : o.off, rel: j === notes.length - 1 ? (o.rel || .6) : .12, exact: true });
      t += d;
    });
    return t;
  };
  /* 节奏型：beats 为 [[拍位, m, v, 长(拍)], …] */
  S.melody = (fn, t0, b, notes) => { let t = t0; for (const [m, len, v] of notes) { if (m != null) fn(t, m, v, len * b); t += len * b; } return t; };
  /* ---------- 打击 ---------- */
  let drr = 0;
  S.drum = (t, v, o = {}) => { const e = S.ev({ k: 'p', i: 'drum', t: hum(t, o.hum == null ? 4 : o.hum), v: hv(v, .04), rr: drr++, lp: o.lp, pan: o.pan == null ? 0 : o.pan, send: o.send == null ? .2 : o.send, mf: o.mf, gain: (o.gain || 1) * S.gs, d: o.d }); if (o.sub) S.sub(t, o.sub, o); return e; };
  S.roll = (t0, t1, v0, v1, o = {}) => {             // 鼓滚奏（大鼓双槌）：rate 次/秒，可渐快
    const r = S.rnd(Math.round(t0 * 37)), rate = o.rate || 10;
    let t = t0, i = 0;
    while (t < t1) { const k = (t - t0) / (t1 - t0), rt = Array.isArray(rate) ? rate[0] + (rate[1] - rate[0]) * k : rate; S.ev({ k: 'p', i: o.inst || 'drum', t, v: (v0 + (v1 - v0) * Math.pow(k, o.pow || 1.4)) * (i % 2 ? .86 : 1) * (1 + (r() - .5) * .12), rr: i, lp: o.lp, send: o.send == null ? .2 : o.send, pan: o.pan || 0, mf: o.mf, gain: (o.gain || (o.inst === 'snare' ? .32 : 1)) * S.gs, d: o.d }); t += (1 / rt) * (1 + (r() - .5) * .1); i++; }
  };
  S.gong = (t, v, o = {}) => S.ev({ k: 'p', i: 'gong', t, v, rate: o.rate || 1, lp: o.lp, d: o.d, rel: o.rel, pan: o.pan == null ? .12 : o.pan, send: o.send == null ? .32 : o.send, mf: o.mf, gain: (o.gain || 1) * .75 * S.gs, rev: o.rev, env: o.env, att: o.att });
  S.cym = (t, v, o = {}) => S.ev({ k: 'p', i: 'cym', t, v, rate: o.rate || 1, lp: o.lp, hp: o.hp, d: o.d, rel: o.rel, pan: o.pan == null ? -.12 : o.pan, send: o.send == null ? .3 : o.send, mf: o.mf, gain: (o.gain || 1) * .42 * S.gs, rev: o.rev, att: o.att });
  /* 吸气：反向钹在 tEnd 收尾 */
  S.inhale = (tEnd, v, o = {}) => S.cym(tEnd, v, { ...o, rev: true, lp: o.lp || 7000, d: o.d || 2.6 });
  S.snare = (t, v, o = {}) => S.ev({ k: 'p', i: 'snare', t: hum(t, 4), v: hv(v, .06), rr: drr++, lp: o.lp || 5200, pan: o.pan == null ? .18 : o.pan, send: o.send == null ? .18 : o.send, mf: o.mf, gain: (o.gain || 1) * .32 * S.gs });
  /* ---------- 合成层（只做低频鼓体与噪声） ---------- */
  S.sub = (t, v, o = {}) => S.ev({ k: 's', type: 'sub', t, d: o.subD || 1.6, v: v * .55 * S.gs, f0: o.f0 || 70, f1: o.f1 || 36, dec: o.dec || .45, send: 0, mf: o.mf });
  S.noise = (t, d, v, o = {}) => S.ev({ k: 's', type: 'noise', t, d, v: v * S.gs, f: o.f || 200, fk: o.fk ? o.fk.map(([x, f]) => [x - t, f]) : null, q: o.q || .8, keys: o.keys ? o.keys.map(([x, g]) => [x - t, g]) : [[0, 0], [Math.min(o.att || 1.5, d / 2), 1], [Math.max(d / 2, d - (o.rel || 1.5)), 1], [d, 0]], white: o.white, gust: o.gust, seed: o.seed || Math.round(t * 10), pan: o.pan || 0, send: o.send == null ? .2 : o.send });
  /* ---------- 主题记录（自检用：主题音的音高类在该时刻应能被色度分析认出） ---------- */
  S.themeAt = (label, t0, b, key, part, inst, fn, o = {}) => {
    const notes = part === 'q' ? THEME.a.slice(0, 5) : part === 'a' ? THEME.a : part === 'b' ? THEME.b : part === 'ab' ? THEME.a.concat(THEME.b) : part === 'maj' ? THEME_MAJ : part === 'head' ? THEME.a.slice(0, 4) : part;
    let t = t0;
    notes.forEach(([iv, len], j) => {
      const m = key + iv + (o.oct || 0), last = j === notes.length - 1;
      fn(t, m, len * b, j, last);
      S.theme.push({ t: +t.toFixed(3), m, d: +(len * b).toFixed(3), label, inst });
      t += len * b;
    });
    return t;
  };
  return S;
}
