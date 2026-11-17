/* 《斩龙封神》全片原创五乐章国风交响总谱（tools/score/score-zhanlong.mjs）
   配器：古筝 zheng、越南筝 dan、琵琶 pipa（轮指 lun 0.5-1.5s / 扫弦 sao）、古埙 xun、青铜编钟 bell、玉磬 qing、手铃 chime、
        竹笛 flute、大提琴组 cello、小提琴组 bowed；VCSL 民族/交响打击（建鼓 bd、堂鼓 tomH/tomL、板鼓 frameS/frameL、大锣 luo、铙钹 nao、木鱼梆子 slit/bang）及低频 sub / 水风 noise。
   时间：动态读取 cues.json 中的幕表（prologue, act1..act5, coda）与幕内 cue，兼容微调时长；核心戏剧节点设硬停静音窗（S.kill tail:true）。 */
import { makeScore, deg } from './lib.mjs';

export function buildScore(cues) {
  const S = makeScore(cues);
  S.wet = 0.52;

  const actMap = {};
  for (const a of cues.acts || []) actMap[a.id] = a;
  const A0 = (id, fb) => (actMap[id] ? actMap[id].start : fb);
  const A1 = (id, fb) => (actMap[id] ? actMap[id].end : fb);
  const C = (id, fb) => (S.has(id) ? S.T(id) : fb);

  const DUR = cues.duration || 1320;
  const J = S.rnd(2026170);
  const jit = (v, k = 0.05) => v * (1 + (J() * 2 - 1) * k);

  /* ---------- 扩展器乐封装 ---------- */
  const cnt = {};
  const PAN = { bd: 0, tomL: 0.2, tomH: -0.18, frameS: 0.32, frameL: -0.12, luo: 0.14, nao: -0.14, bang: 0.36, slit: -0.3, qing: 0.08 };
  const SEND = { bd: 0.18, tomL: 0.16, tomH: 0.16, frameS: 0.14, frameL: 0.15, luo: 0.34, nao: 0.25, bang: 0.18, slit: 0.2, qing: 0.45 };
  const GAIN = { bd: 0.78, tomL: 0.54, tomH: 0.54, frameS: 0.52, frameL: 0.52, luo: 0.78, nao: 0.4, bang: 0.44, slit: 0.48, qing: 0.95 };

  const P = (i, t, v, o = {}) => {
    if (t < 0 || t >= DUR - 0.1) return null;
    const key = i + '|' + (o.tech || '');
    cnt[key] = (cnt[key] || 0) + 1;
    return S.ev({
      k: 'p', i, t, v: o.exact ? v : jit(v, 0.05), m: o.m, tech: o.tech, lv: o.lv, rr: cnt[key],
      rate: o.rate, d: o.d, rel: o.rel, lp: o.lp, hp: o.hp, att: o.att, env: o.env,
      align: o.align, rev: o.rev, mf: o.mf,
      pan: o.pan == null ? (PAN[i] || 0) : o.pan,
      send: o.send == null ? (SEND[i] == null ? 0.22 : SEND[i]) : o.send,
      gain: (o.gain || 1) * (GAIN[i] || 1) * S.gs
    });
  };
  const nEv = (i, t, m, v, o = {}) => {
    if (t < 0 || t >= DUR - 0.1) return null;
    return S.ev({
      k: 'n', i, t, m, v, gain: (o.gain || 1) * S.gs, pan: o.pan == null ? 0 : o.pan, send: o.send == null ? 0.32 : o.send,
      d: o.d, att: o.att, rel: o.rel, off: o.off, env: o.env, genv: o.genv, bend: o.bend, vib: o.vib, lp: o.lp, mf: o.mf, rr: o.rr, tech: o.tech, chord: o.chord
    });
  };

  const Z = (t, m, v, o = {}) => (t >= 0 && t < DUR - 0.1 ? S.z(t, m, v, { exact: true, ...o }) : null);
  const pipa = (t, m, v, o = {}) => nEv('pipa', t, m, v, { pan: -0.25, send: 0.22, ...o });
  const lun = (t0, d, m, v, o = {}) => {
    const cd = Math.max(0.55, Math.min(1.45, d));
    return pipa(t0, m, v, { tech: 'lun', d: cd, ...o });
  };
  const sao = (t, chord, v, o = {}) => pipa(t, chord[0], v, { tech: 'sao', chord, ...o });
  const xun = (t, m, d, v, o = {}) => nEv('xun', t, m, v, { d, att: 0.08, rel: 0.18, send: 0.42, pan: -0.08, ...o });
  const xunLine = (t0, notes, v, o = {}) => {
    let t = t0;
    notes.forEach(([m, d, vv], j) => {
      if (m != null) xun(t, m, d + 0.06, (vv || 1) * v, { ...o, att: j ? 0.07 : 0.14, off: j ? 0.25 : 0, rel: j === notes.length - 1 ? 0.55 : 0.14 });
      t += d;
    });
    return t;
  };
  const bell = (t, m, v, o = {}) => nEv('bell', t, m, v, { send: 0.44, pan: 0.12, ...o });
  const chime = (t, m, v, o = {}) => nEv('chime', t, m, v, { d: 1.4, rel: 0.9, send: 0.52, pan: -0.18, ...o });
  const qing = (t, v, m = 62, o = {}) => P('qing', t, v, { m, ...o });
  const cello = (t, m, d, v, o = {}) => (t >= 0 && t < DUR - 0.1 ? S.cello(t, m, d, v, { exact: true, ...o }) : null);
  const bowed = (t, m, d, v, o = {}) => (t >= 0 && t < DUR - 0.1 ? S.bowed(t, m, d, v, { exact: true, ...o }) : null);
  const flute = (t, m, d, v, o = {}) => (t >= 0 && t < DUR - 0.1 ? S.flute(t, m, d, v, { exact: true, ...o }) : null);
  const stab = (t, m, v, o = {}) => cello(t, m, o.d || 0.22, v, { att: 0.008, rel: 0.1, send: 0.15, ...o });

  // 非机械五声织体生成器（保证相邻音绝不陷入两音死循环，每组走向变化）
  function weaveArp(t0, t1, step, key, mode, patterns, v0, v1, fn) {
    let t = t0, idx = 0;
    while (t < t1 - 0.05) {
      const pat = patterns[idx % patterns.length];
      for (let j = 0; j < pat.length && t < t1 - 0.05; j++) {
        const k = (t - t0) / Math.max(0.1, t1 - t0);
        const v = (v0 + (v1 - v0) * k) * (j === 0 ? 1.08 : 0.84 + 0.12 * ((j * 3) % 2));
        fn(t, deg(key, mode, pat[j]), v, j, idx);
        t += step * (1 + (J() - 0.5) * 0.04);
      }
      idx++;
    }
  }

  // 主题陈述辅助：同时记入 S.theme 供色度检验
  function stateTheme(label, t0, b, notes, instFn, instName) {
    let t = t0;
    for (let j = 0; j < notes.length; j++) {
      const [m, beats, v = 0.72] = notes[j];
      const d = beats * b;
      instFn(t, m, d, v, j === notes.length - 1);
      S.theme.push({ t: +t.toFixed(3), m, d: +d.toFixed(3), label, inst: instName });
      t += d;
    }
    return t;
  }

  /* ============================================================================
     序幕 · 雪崩前夜 (0 – 75s)：千年灭宗残影 → 幽煌大日狂澜 → 余慈漠然入承启天 → 破题
     ============================================================================ */
  const p0 = A0('prologue', 0), p1 = A1('prologue', 75);
  const pSun = C('prologue.sun', p0 + 26);
  const pTitle = C('prologue.title', p1 - 16);
  S.section('序·雪崩前夜', p0, p1, '古埙残韵、大日乱鼓与破题编钟');

  S.noise(p0 + 0.5, pSun - p0, 0.05, { f: 150, q: 1.1, att: 2.5, rel: 2.0 });
  P('luo', p0 + 1.2, 0.42, { tech: 'scrape', send: 0.45 });
  S.pad('cello', p0 + 1.5, pSun, [38, 45], 0.34, { fi: 2.8, fo: 1.8, lp: 1800 });
  // 上清遗恨碎片（D羽：F4 E4 D4 A3）
  stateTheme('elegy-frag-0', p0 + 5.5, 1.35, [[65, 1.5, 0.56], [64, 1.0, 0.48], [62, 2.2, 0.60], [57, 2.8, 0.46]],
    (t, m, d, v) => xun(t, m, d, v), 'xun');
  Z(p0 + 14.2, 50, 0.48, { bend: 'down', vib: true });
  Z(p0 + 16.4, 57, 0.44, { vib: true });
  Z(p0 + 18.8, 53, 0.46, { bend: 'up1' });
  qing(p0 + 21.5, 0.38, 62);

  // 幽煌大日左冲右突（7/8 紧迫低鼓与琵琶扫弦）→ 余慈连眼角都不给，清越古筝上行步入承启天
  S.mark(pSun, 'prologue.sun');
  P('bd', pSun, 0.68, { tech: 'hit' });
  S.sub(pSun, 0.65, { f0: 68, f1: 36 });
  sao(pSun + 0.08, [50, 56, 62, 68], 0.62);
  let rt = pSun + 0.6;
  const pStepIn = pTitle - 9.0;
  while (rt < pStepIn - 1.2) {
    P('tomL', rt, 0.42, { tech: 'm' });
    P('frameL', rt + 0.38, 0.34, { tech: 'open' });
    P('tomH', rt + 0.76, 0.38, { tech: 's' });
    stab(rt + 1.12, 38 + ((Math.round(rt) % 3) * 3), 0.44);
    if (Math.round(rt * 10) % 28 === 0) lun(rt + 0.2, 0.75, 62, 0.48);
    rt += 1.54;
  }
  // 余慈转身漠然踏入承启天：云霄宫调首露锋芒
  S.strum(pStepIn, [50, 57, 62, 66, 69], 0.66, { spread: 0.03 });
  qing(pStepIn + 0.1, 0.52, 69);
  stateTheme('yunxiao-seed', pStepIn + 1.2, 0.95, [[62, 1.2, 0.62], [69, 1.4, 0.66], [66, 0.8, 0.56], [71, 1.6, 0.68], [74, 2.4, 0.72]],
    (t, m, d, v) => { Z(t, m, v, { vib: true }); if (d > 1.3) chime(t + 0.05, m + 12, v * 0.45); }, 'zheng');

  // 破题《斩龙封神》
  S.inhale(pTitle, 0.58, { d: 2.2 });
  S.mark(pTitle, 'prologue.title');
  P('bd', pTitle, 0.86, { tech: 'hit', exact: true });
  P('luo', pTitle, 0.76, { tech: 'main', exact: true });
  S.sub(pTitle, 0.82, { f0: 66, f1: 34 });
  bell(pTitle + 0.04, 50, 0.78);
  bell(pTitle + 0.12, 57, 0.72);
  bell(pTitle + 0.22, 62, 0.76);
  S.pad('cello', pTitle + 0.4, p1, [38, 45, 50], 0.42, { fi: 0.6, fo: 2.5 });
  Z(pTitle + 3.6, 62, 0.58, { bend: 'up', vib: true });
  Z(pTitle + 6.2, 69, 0.54, { vib: true });
  qing(pTitle + 9.5, 0.48, 74);

  /* ============================================================================
     第一幕 · 紫气入梦 (75 – 230s)：承启天醉灵 → 云楼紫气探掌 → 太霄青绿金碧道境
     ============================================================================ */
  const a1_0 = A0('act1', 75), a1_1 = A1('act1', 230);
  const cBranch = C('act1.branch', a1_0 + 68);
  const cDaojing = C('act1.daojing', a1_0 + 84);
  S.section('一·紫气入梦', a1_0, a1_1, '承启天灵潮风铎与太霄道境宫调长卷');

  // 承启天醉灵：温润弦垫＋古筝流水＋手铃风铎
  S.pad('cello', a1_0, cBranch, [50, 57], 0.30, { fi: 2.5, fo: 1.8 });
  S.pad('bowed', a1_0 + 4, cBranch, [62, 69], 0.24, { fi: 3.2, fo: 2.0 });
  weaveArp(a1_0 + 2.0, cBranch - 3.0, 0.68, 62, 'gong',
    [[0, 2, 3, 5, 4, 1], [0, 3, 4, 6, 5, 2], [-2, 0, 2, 4, 3, 5], [1, 3, 5, 7, 4, 2]],
    0.34, 0.46, (t, m, v, j, idx) => {
      Z(t, m, v, { vib: j === 0 });
      if (j === 0 && idx % 2 === 0) chime(t + 0.08, m + 12, 0.28);
      if (j === 3 && idx % 3 === 1) qing(t, 0.26, 69);
    });

  // 云楼树紫气探入掌心 → 虚空移换
  S.mark(cBranch, 'act1.branch');
  S.gliss(cBranch, 2.4, 45, 78, 0.46, { key: 62, mode: 'gong', v1: 0.72, curve: 0.78 });
  chime(cBranch + 1.2, 74, 0.48);
  chime(cBranch + 2.1, 78, 0.52);
  S.inhale(cDaojing, 0.64, { d: 2.8 });

  // 太霄道境豁然展开：青绿金碧千里江山！编钟＋竹笛＋古筝完整奏响「云霄太霄」宫调主题
  S.mark(cDaojing, 'act1.daojing');
  bell(cDaojing, 50, 0.80);
  bell(cDaojing + 0.14, 57, 0.74);
  bell(cDaojing + 0.28, 66, 0.72);
  qing(cDaojing + 0.05, 0.68, 74);
  S.gliss(cDaojing + 0.35, 1.9, 50, 81, 0.55, { key: 62, mode: 'gong', v1: 0.78, curve: 0.72 });
  S.pad('cello', cDaojing + 0.5, a1_1, [50, 57], 0.38, { fi: 1.5, fo: 2.2 });
  S.pad('bowed', cDaojing + 1.2, a1_1, [66, 74, 78], 0.32, { fi: 2.0, fo: 2.4 });

  stateTheme('yunxiao-full-1', cDaojing + 3.2, 1.15,
    [[62, 1.5, 0.72], [66, 1.0, 0.66], [69, 1.5, 0.76], [71, 1.0, 0.68], [74, 2.0, 0.82],
     [76, 1.0, 0.72], [74, 1.0, 0.70], [71, 1.5, 0.68], [69, 1.5, 0.74], [66, 1.0, 0.64], [62, 3.0, 0.76]],
    (t, m, d, v, last) => {
      flute(t, m + 12, d * 0.94, v * 0.78, { swell: [0.65, 1.1, last ? 0.4 : 0.8] });
      Z(t, m, v * 0.72, { bend: last ? 'pre' : undefined, vib: d > 1.2 });
      if (d >= 1.8) bell(t + 0.02, m - 12, v * 0.56);
    }, 'flute');

  weaveArp(cDaojing + 23.5, a1_1 - 1.5, 0.62, 62, 'gong',
    [[0, 2, 4, 5, 7, 4], [2, 4, 5, 7, 9, 6], [0, 3, 5, 4, 2, 1], [-1, 1, 2, 4, 5, 3]],
    0.38, 0.44, (t, m, v, j, idx) => {
      Z(t, m, v * 0.85, { inst: j % 2 ? 'dan' : 'zheng' });
      if (j === 0 && idx % 3 === 0) qing(t, 0.34, 74);
    });

  /* ============================================================================
     第二幕 · 太霄受诏 (230 – 420s)：巫门调脉 → 薛平治叹三十六天 → 赤金符诏 → 虎辇乘风
     ============================================================================ */
  const a2_0 = A0('act2', 230), a2_1 = A1('act2', 420);
  const cXue = C('act2.xue', a2_0 + 48);
  const cEdict = C('act2.edict', a2_0 + 98);
  const cChariot = C('act2.chariot', a2_0 + 138);
  S.section('二·太霄受诏', a2_0, a2_1, '气脉流弦、平治清叹、符诏玉磬与白虎乘辇礼乐');

  // 腾云与巫门三女调理气脉：双筝交织如云脉呼吸
  S.pad('bowed', a2_0, cXue, [62, 69, 73], 0.26, { fi: 2.0, fo: 1.8 });
  weaveArp(a2_0 + 1.0, cXue - 1.5, 0.54, 62, 'zhi',
    [[0, 1, 3, 4, 6, 3], [1, 2, 4, 5, 3, 0], [-1, 0, 2, 3, 5, 1]],
    0.36, 0.42, (t, m, v, j) => {
      S.note(j % 2 === 0 ? 'zheng' : 'dan', t, m, v, { pan: j % 2 === 0 ? -0.32 : 0.32 });
    });

  // 薛平治带血伫立道宫外：「这就是上清三十六天……」—— 大提琴独奏与竹笛相答，清越中含隐痛
  S.mark(cXue, 'act2.xue');
  qing(cXue, 0.45, 69);
  S.pad('cello', cXue + 0.5, cEdict - 2.0, [47, 54], 0.32, { fi: 2.2, fo: 2.0 });
  S.line('flute', cXue + 2.5, [[71, 2.2, 0.85], [73, 1.4, 0.78], [74, 2.6, 0.92], [69, 1.8, 0.76], [66, 3.2, 0.82]], 0.62, { send: 0.44 });
  S.line('cello', cXue + 15.0, [[54, 2.4, 0.88], [57, 1.6, 0.82], [59, 2.8, 0.94], [57, 1.8, 0.78], [50, 3.6, 0.85]], 0.56, { send: 0.34 });
  weaveArp(cXue + 28.0, cEdict - 2.0, 0.82, 59, 'yu',
    [[0, 2, 3, 4, 1], [0, 3, 5, 2, 4]], 0.30, 0.38, (t, m, v, j) => Z(t, m + 5, v, { vib: j === 0 }));

  // 步入道宫门楼中庭，赤金符诏飘落（存神如梦）
  S.mark(cEdict, 'act2.edict');
  P('slit', cEdict, 0.42, { tech: 'lo' });
  bell(cEdict + 0.2, 54, 0.66);
  qing(cEdict + 1.8, 0.56, 74);
  chime(cEdict + 2.0, 78, 0.52);
  S.gliss(cEdict + 3.2, 2.6, 54, 83, 0.42, { key: 62, mode: 'gong', v1: 0.64, curve: 0.85 });
  S.pad('bowed', cEdict + 2.0, cChariot, [62, 69, 76], 0.30, { fi: 2.5, fo: 1.8 });
  weaveArp(cEdict + 7.5, cChariot - 2.0, 0.74, 62, 'gong',
    [[0, 4, 2, 5, 3, 6], [2, 5, 3, 7, 4, 1]], 0.34, 0.46, (t, m, v, j, idx) => {
      Z(t, m, v, { bend: j === 2 ? 'up' : undefined });
      if (j === 0 && idx % 2 === 0) bell(t, m - 12, 0.44);
    });

  // 虎辇玉舆隐轮之车、白虎相牵、神将持诏乘风下界
  S.inhale(cChariot, 0.56, { d: 2.0 });
  S.mark(cChariot, 'act2.chariot');
  P('bd', cChariot, 0.74, { tech: 'hit' });
  P('luo', cChariot, 0.62, { tech: 'small' });
  bell(cChariot + 0.06, 50, 0.74);
  S.strum(cChariot + 0.12, [50, 57, 62, 69, 74], 0.72);
  S.pad('cello', cChariot + 0.5, a2_1, [38, 45, 50], 0.44, { fi: 1.2, fo: 2.0 });

  // 乘风巡天礼乐步点
  let ct = cChariot + 2.2;
  let stepIdx = 0;
  const chariotNotes = [62, 66, 69, 74, 71, 69, 66, 71, 74, 78, 76, 74];
  while (ct < a2_1 - 2.5) {
    P('bd', ct, 0.52, { tech: 'hit' });
    P('tomL', ct + 1.1, 0.38, { tech: 'm' });
    const nm = chariotNotes[stepIdx % chariotNotes.length];
    Z(ct, nm, 0.62, { vib: true });
    Z(ct + 0.55, nm - 5, 0.44);
    Z(ct + 1.1, nm + 2, 0.52, { bend: stepIdx % 3 === 0 ? 'up' : undefined });
    Z(ct + 1.65, nm - 3, 0.46);
    if (stepIdx % 2 === 0) flute(ct + 0.2, nm + 12, 1.5, 0.56);
    if (stepIdx % 4 === 0) bell(ct, 50 + (stepIdx % 3) * 5, 0.52);
    ct += 2.2;
    stepIdx++;
  }

  /* ============================================================================
     第三幕 · 三界危局 (420 – 630s)：倒扣玉碟破口 → 八地仙死寂雪崩 → 四御门庭沸汤沃雪 → 符诏化青
     ============================================================================ */
  const a3_0 = A0('act3', 420), a3_1 = A1('act3', 630);
  const cStandoff = C('act3.standoff', a3_0 + 62);
  const cArchway = C('act3.archway', a3_0 + 132);
  const cPurify = C('act3.purify', a3_0 + 154);
  const cCyan = C('act3.cyan', a3_0 + 182);
  S.section('三·三界危局', a3_0, a3_1, '三界法象水影、八地仙死寂压迫与四御门庭金章涤魔');

  // 穿明灭云霭俯瞰倒扣玉碟与洗玉湖破口
  S.noise(a3_0, cStandoff - a3_0, 0.045, { f: 240, q: 1.4, att: 2.0, rel: 2.0 });
  S.pad('cello', a3_0 + 1.0, cStandoff, [37, 44], 0.36, { fi: 2.4, fo: 2.0, lp: 1600 });
  weaveArp(a3_0 + 2.5, cStandoff - 2.0, 0.92, 61, 'shang',
    [[0, 2, 4, 1, 3], [-1, 1, 3, 5, 2], [0, 3, 1, 4, 2]], 0.32, 0.42,
    (t, m, v, j, idx) => {
      chime(t, m + 12, v * 0.65);
      if (j === 0) Z(t, m, v * 0.85, { bend: 'down' });
      if (j === 2 && idx % 2 === 0) qing(t, 0.34, 61);
    });

  // 真实之域八位地仙死寂对峙：雪崩前夕的心跳低鼓、紧绷高弦与烛龙光阴轮琵琶突击
  S.mark(cStandoff, 'act3.standoff');
  P('luo', cStandoff, 0.56, { tech: 'scrape' });
  S.pad('bowed', cStandoff + 1.0, cArchway - 3.0, [76, 77, 82], 0.24, { fi: 3.0, fo: 2.5 });
  S.pad('cello', cStandoff + 1.0, cArchway - 3.0, [36, 43], 0.40, { fi: 2.5, fo: 2.5, lp: 1200 });
  let st = cStandoff + 2.5, sCount = 0;
  while (st < cArchway - 6.0) {
    P('bd', st, 0.44, { tech: 'hit', lp: 420 });
    P('bd', st + 0.48, 0.30, { tech: 'hit', lp: 340 });
    if (sCount % 3 === 1) lun(st + 1.1, 0.95, 58 + (sCount % 4) * 2, 0.46);
    if (sCount % 4 === 2) xun(st + 0.8, 60 - (sCount % 3) * 2, 2.1, 0.42);
    st += 3.2;
    sCount++;
  }

  // 四御门庭斑驳血迹 → 「请符诏」蝌蚪神文结恢宏金章，沸汤沃雪消融群魔！
  S.mark(cArchway, 'act3.archway');
  xun(cArchway + 0.8, 62, 2.8, 0.54);
  xun(cArchway + 3.8, 58, 2.4, 0.50);
  stab(cArchway + 7.2, 39, 0.52);
  stab(cArchway + 9.4, 38, 0.56);
  S.inhale(cPurify, 0.68, { d: 2.4 });

  S.mark(cPurify, 'act3.purify');
  P('bd', cPurify, 0.84, { tech: 'hit', exact: true });
  P('luo', cPurify, 0.78, { tech: 'main', exact: true });
  P('nao', cPurify + 0.04, 0.62, { tech: 'open' });
  S.sub(cPurify, 0.78, { f0: 70, f1: 36 });
  bell(cPurify + 0.05, 50, 0.82);
  bell(cPurify + 0.18, 57, 0.78);
  bell(cPurify + 0.32, 62, 0.84);
  S.gliss(cPurify + 0.25, 2.2, 45, 81, 0.58, { key: 62, mode: 'gong', v1: 0.84, curve: 0.7 });
  S.trem(cPurify + 2.6, cCyan - 1.5, [62, 69, 74], 0.46, 0.64, { rate: [11, 14] });
  S.pad('cello', cPurify + 0.6, cCyan, [38, 45, 50], 0.48, { fi: 0.8, fo: 1.8 });
  for (let bt = cPurify + 4.0; bt < cCyan - 2.0; bt += 3.6) {
    bell(bt, 50 + ((Math.round(bt) % 3) * 4), 0.62);
    P('tomH', bt + 1.8, 0.44, { tech: 'm' });
  }

  // 符诏褪赤金透莹莹青光，权力移换，云层下沉现封神孤峰
  S.mark(cCyan, 'act3.cyan');
  qing(cCyan, 0.66, 74);
  chime(cCyan + 0.2, 81, 0.58);
  S.line('flute', cCyan + 1.0, [[74, 2.0, 0.82], [76, 1.5, 0.76], [81, 2.8, 0.88], [78, 2.2, 0.74]], 0.58);
  S.pad('cello', cCyan + 9.0, a3_1, [38, 44], 0.38, { fi: 2.5, fo: 1.5, lp: 1300 });
  P('luo', a3_1 - 6.5, 0.46, { tech: 'scrape' });

  /* ============================================================================
     第四幕 · 血链问刀 (630 – 870s)：封神台时光长河 → 赤绿妖瞳 → 重拳轰胸二十余血链 → 登台问刀
     ============================================================================ */
  const a4_0 = A0('act4', 630), a4_1 = A1('act4', 870);
  const cEyes = C('act4.eyes', a4_0 + 58);
  const cChains = C('act4.chains', a4_0 + 88);
  const cAscend = C('act4.ascend', a4_0 + 158);
  const cAskBlade = C('act4.askblade', a4_1 - 24);
  S.section('四·血链问刀', a4_0, a4_1, '时光长河低鸣、妖瞳悬疑、血链穿胸巨震与上清正法编钟');

  // 时光长河凝滞低鸣与荒台孤埙
  S.noise(a4_0, cChains - a4_0 - 1.0, 0.055, { f: 175, q: 1.6, att: 2.5, rel: 0.6 });
  S.pad('cello', a4_0 + 0.5, cEyes, [38, 45], 0.38, { fi: 2.5, fo: 1.5, lp: 1400 });
  S.pad('bowed', a4_0 + 3.0, cEyes, [81], 0.18, { fi: 3.5, fo: 2.0 });
  stateTheme('elegy-terrace', a4_0 + 7.5, 1.45,
    [[62, 2.0, 0.58], [65, 1.5, 0.54], [67, 1.0, 0.52], [69, 2.5, 0.64], [65, 1.5, 0.52], [62, 3.0, 0.58]],
    (t, m, d, v) => xun(t, m, d, v), 'xun');
  weaveArp(a4_0 + 28.0, cEyes - 2.0, 1.15, 50, 'yu',
    [[0, 3, 2, 4, 1], [-1, 2, 4, 1, 3]], 0.30, 0.38,
    (t, m, v, j) => Z(t, m + 12, v, { bend: j === 1 ? 'down' : undefined, vib: true }));

  // 道人睁眼：赤芒闪动、眼底幽绿无尽
  S.mark(cEyes, 'act4.eyes');
  P('luo', cEyes, 0.52, { tech: 'scrape' });
  qing(cEyes + 0.15, 0.50, 77);
  const eyeNotes = [65, 64, 58, 61, 57, 56, 50, 55];
  eyeNotes.forEach((m, i) => {
    pipa(cEyes + 1.4 + i * 2.6, m, 0.48 + i * 0.02, { pan: (i % 2 ? 0.25 : -0.25) });
    if (i % 2 === 1) stab(cEyes + 2.2 + i * 2.6, m - 12, 0.46);
  });
  S.roll(cChains - 4.2, cChains - 0.7, 0.22, 0.68, { rate: [7, 16] });

  // 硬停 0.65s → 道人反手重拳轰向胸膛！二十余条手腕粗上清血链哗啦穿胸爆射！
  S.kill(cChains - 0.65, cChains, { tail: true });
  S.mark(cChains, 'act4.chains');
  P('bd', cChains, 0.92, { tech: 'hit', exact: true });
  P('nao', cChains + 0.02, 0.76, { tech: 'short', exact: true });
  P('luo', cChains + 0.05, 0.82, { tech: 'main', exact: true });
  S.sub(cChains, 0.90, { f0: 74, f1: 34 });
  sao(cChains + 0.08, [45, 52, 57, 62, 69], 0.82);
  // 铁索哗啦激荡声（错落金属磬、梆、琵琶轮指）
  for (let k = 0; k < 9; k++) {
    const tk = cChains + 0.28 + k * 0.24 + J() * 0.06;
    P(k % 2 ? 'bang' : 'frameS', tk, 0.52 - k * 0.03, { tech: k % 2 ? 'hi' : 'mute', pan: (k % 3 - 1) * 0.35 });
    if (k % 3 === 0) qing(tk + 0.04, 0.48 - k * 0.04, 68 + k * 2);
  }
  lun(cChains + 0.5, 1.2, 62, 0.64);
  // 血链之中勃发至纯上清根本法度：庄严青铜编钟破云而出！
  bell(cChains + 3.2, 50, 0.78);
  bell(cChains + 4.4, 57, 0.76);
  bell(cChains + 5.6, 62, 0.82);
  bell(cChains + 7.0, 66, 0.78);
  S.pad('cello', cChains + 3.0, cAscend, [38, 45, 50], 0.42, { fi: 1.5, fo: 2.0 });

  // 余慈步空问名、道人大笑负二十余血链登斩龙台、水烟清光问「这一刀可斩得？」
  weaveArp(cChains + 12.0, cAscend - 2.0, 0.96, 62, 'yu',
    [[0, 2, 4, 3, 1], [0, 3, 5, 2, 4], [-1, 1, 3, 2, 0]], 0.34, 0.44,
    (t, m, v, j, idx) => {
      Z(t, m, v, { vib: j === 0, bend: j === 2 ? 'up1' : undefined });
      if (j === 0 && idx % 3 === 0) cello(t, m - 12, 2.4, 0.42);
    });

  S.mark(cAscend, 'act4.ascend');
  // 负链健步登台：每步沉重鼓点伴铁索铮鸣
  for (let step = 0; step < 8; step++) {
    const ts = cAscend + step * 1.65;
    P('tomL', ts, 0.50, { tech: 'm' });
    P('bang', ts + 0.18, 0.34, { tech: 'main' });
    qing(ts + 0.24, 0.32, 64 + (step % 4) * 3);
  }
  // 顶放澹澹水烟清光，坦陈封魔求死
  S.pad('bowed', cAscend + 14.0, a4_1, [69, 74, 81], 0.28, { fi: 2.8, fo: 1.5 });
  xunLine(cAscend + 16.5, [[69, 2.4, 0.85], [67, 1.6, 0.78], [65, 2.2, 0.82], [62, 3.2, 0.90], [57, 3.6, 0.76]], 0.56);
  S.line('cello', cAskBlade - 18.0, [[50, 2.5, 0.85], [53, 1.8, 0.80], [55, 2.2, 0.88], [57, 3.4, 0.92]], 0.58);
  // 「如此，请前辈上路！请符诏！」蓄势推向第五幕
  S.mark(cAskBlade, 'act4.askblade');
  P('bd', cAskBlade, 0.68, { tech: 'hit' });
  bell(cAskBlade + 0.1, 50, 0.72);
  S.roll(a4_1 - 5.5, a4_1 - 0.2, 0.24, 0.66, { rate: [8, 15] });

  /* ============================================================================
     第五幕 · 一刀断千载 (870 – 1130s)：全片灵魂高潮！
     掌刑喝刀 → 青莲种道基 → 断首一刀 → 时光决堤回溯斩孙留恨 → 朝阳真容 → 截杀参罗利那
     ============================================================================ */
  const a5_0 = A0('act5', 870), a5_1 = A1('act5', 1130);
  const cCallBlade = C('act5.callblade', a5_0 + 18);
  const cLotus = C('act5.lotus', a5_0 + 36);
  const cBehead = C('act5.behead', a5_0 + 76);
  const cRewind = C('act5.rewind', a5_0 + 92);
  const cKillKin = C('act5.killkin', a5_0 + 132);
  const cTrueFace = C('act5.trueface', a5_0 + 152);
  const cSpider = C('act5.spider', a5_0 + 184);
  const cBisect = C('act5.bisect', a5_0 + 208);
  const cThunder = C('act5.thunder', a5_0 + 228);
  S.section('五·一刀断千载', a5_0, a5_1, '喝刀静音、青莲汲光、断首雷霆、千年遗恨悲歌与万雷封魔');

  // 掌刑神将登台 → 1.8s 万籁俱寂硬停（「符诏至，刀来！」）
  for (let g = 0; g < 5; g++) {
    P('bd', a5_0 + 1.2 + g * 2.6, 0.56 + g * 0.05, { tech: 'hit' });
    bell(a5_0 + 1.3 + g * 2.6, 50 + (g % 2) * 7, 0.58);
  }
  S.kill(cCallBlade - 1.8, cCallBlade, { tail: true });
  S.mark(cCallBlade, 'act5.callblade');
  P('bd', cCallBlade, 0.90, { tech: 'hit', exact: true });
  P('luo', cCallBlade, 0.82, { tech: 'main', exact: true });
  S.sub(cCallBlade, 0.86, { f0: 70, f1: 35 });

  // 碗大青莲落水烟、渗露抽神光：出淤泥而不染的清净古筝＋玉磬＋长笛
  S.mark(cLotus, 'act5.lotus');
  qing(cLotus, 0.64, 74);
  chime(cLotus + 0.3, 81, 0.56);
  S.pad('bowed', cLotus + 0.5, cBehead - 2.0, [62, 69, 74], 0.34, { fi: 1.8, fo: 1.2 });
  weaveArp(cLotus + 1.5, cBehead - 2.5, 0.64, 62, 'gong',
    [[4, 2, 0, 3, 1, -1], [5, 3, 2, 4, 1, 0], [6, 4, 2, 3, 0, -2]],
    0.44, 0.62, (t, m, v, j, idx) => {
      Z(t, m, v, { vib: j === 0, bend: j === 3 ? 'down' : undefined });
      if (j === 0 && idx % 2 === 0) qing(t, 0.42, 74);
    });
  // 「道灭而无愧矣！」→ 1.4s 窒息硬停 → 斩龙血刀轰然断首！
  S.kill(cBehead - 1.4, cBehead, { tail: true });
  S.mark(cBehead, 'act5.behead');
  P('bd', cBehead, 0.98, { tech: 'hit', exact: true });
  P('luo', cBehead, 0.92, { tech: 'main', exact: true });
  P('nao', cBehead + 0.02, 0.84, { tech: 'short', exact: true });
  S.sub(cBehead, 0.96, { f0: 76, f1: 32, subD: 2.2 });
  sao(cBehead + 0.06, [45, 50, 57, 62, 69], 0.88);
  S.pad('cello', cBehead + 1.2, cRewind - 0.5, [38, 45], 0.44, { fi: 1.0, fo: 1.0 });

  // 时光长河决堤回溯！千年血战与亲斩子孙杨端明——「上清遗恨」全奏爆发！
  S.inhale(cRewind, 0.78, { d: 2.8 });
  S.mark(cRewind, 'act5.rewind');
  P('bd', cRewind, 0.88, { tech: 'hit' });
  P('luo', cRewind, 0.80, { tech: 'main' });
  S.noise(cRewind, cTrueFace - cRewind, 0.065, { f: 280, q: 1.0, att: 0.8, rel: 2.5 });
  S.pad('cello', cRewind + 0.3, cTrueFace, [38, 45, 50], 0.56, { fi: 0.6, fo: 2.2 });
  S.pad('bowed', cRewind + 0.5, cTrueFace - 2.0, [62, 69, 77], 0.48, { fi: 0.8, fo: 2.0 });
  // 激越古筝摇指托底＋古埙大提琴悲歌全奏
  S.trem(cRewind + 1.2, cKillKin - 0.8, [62, 65, 69, 67], 0.50, 0.72, { rate: [12, 15] });
  stateTheme('elegy-climax', cRewind + 2.5, 1.35,
    [[62, 1.5, 0.82], [69, 2.0, 0.88], [67, 1.0, 0.80], [65, 1.5, 0.84], [72, 2.5, 0.94],
     [70, 1.5, 0.86], [69, 1.5, 0.84], [67, 1.0, 0.78], [65, 2.0, 0.86], [62, 3.0, 0.90]],
    (t, m, d, v) => {
      xun(t, m, d * 0.95, v * 0.92);
      cello(t, m - 12, d * 0.95, v * 0.82, { swell: [0.8, 1.15, 0.75] });
    }, 'xun');
  for (let wt = cRewind + 2.0; wt < cKillKin - 1.5; wt += 2.7) {
    P('bd', wt, 0.62, { tech: 'hit' });
    P('tomH', wt + 0.9, 0.48, { tech: 'm' });
    P('tomL', wt + 1.8, 0.52, { tech: 'm' });
  }

  // 回溯中一刀斩落末代紫微帝御杨端明！
  S.mark(cKillKin, 'act5.killkin');
  P('bd', cKillKin, 0.90, { tech: 'hit', exact: true });
  P('nao', cKillKin + 0.02, 0.76, { tech: 'short', exact: true });
  S.sub(cKillKin, 0.82, { f0: 72, f1: 35 });

  // 群魔杀尽，鼓声骤歇——显露清朗真容「朝阳先生·杨和子」！欲自斩不得，独对荒台千年！
  S.mark(cTrueFace, 'act5.trueface');
  bell(cTrueFace, 50, 0.68);
  qing(cTrueFace + 0.2, 0.62, 69);
  // 纯净孤绝的古筝独奏＋古埙叹息（无任何打击乐干扰泪点）
  xunLine(cTrueFace + 2.2, [[69, 2.8, 0.82], [65, 2.0, 0.74], [62, 3.6, 0.86], [57, 4.2, 0.70]], 0.58);
  const soloNotes = [[62, 2.4], [69, 2.0], [65, 1.8], [67, 2.2], [62, 2.8], [57, 2.4], [58, 2.0], [53, 2.6], [50, 4.2]];
  let zt = cTrueFace + 3.0;
  soloNotes.forEach(([m, d], idx) => {
    Z(zt, m, 0.56 - idx * 0.015, { bend: idx % 3 === 1 ? 'down' : (idx % 3 === 2 ? 'pre' : undefined), vib: true });
    zt += d;
  });

  // 异变陡生：十七长足魔蛛「参罗利那本命分身」破颈冲出！5/8 疾风骤雨截杀！
  S.mark(cSpider, 'act5.spider');
  P('bd', cSpider, 0.88, { tech: 'hit', exact: true });
  P('nao', cSpider + 0.02, 0.74, { tech: 'open' });
  lun(cSpider + 0.05, 1.25, 58, 0.78);
  sao(cSpider + 1.35, [46, 52, 58, 64], 0.76);

  let spT = cSpider + 1.6, spI = 0;
  while (spT < a5_1 - 3.0) {
    const intense = spT >= cThunder ? 1.18 : 1.0;
    P('tomH', spT, 0.54 * intense, { tech: 's' });
    P('tomL', spT + 0.32, 0.50 * intense, { tech: 's' });
    P('frameS', spT + 0.64, 0.46 * intense, { tech: 'open' });
    P('bd', spT + 0.96, 0.64 * intense, { tech: 'hit' });
    stab(spT, 38 + ((spI * 5) % 11), 0.58 * intense);
    pipa(spT + 0.48, 56 + ((spI * 7) % 13), 0.56 * intense);
    if (spI % 3 === 0) lun(spT + 0.15, 0.8, 62 + (spI % 5), 0.62);
    if (spT >= cThunder && spI % 2 === 0) {
      bell(spT, 50 + (spI % 4) * 5, 0.72);
      P('luo', spT + 0.64, 0.58, { tech: 'small' });
    }
    spT += 1.45;
    spI++;
  }
  // 隔空一刀两断＋青光天罗地网重音锚点
  S.mark(cBisect, 'act5.bisect');
  P('bd', cBisect, 0.92, { tech: 'hit', exact: true });
  P('nao', cBisect, 0.80, { tech: 'short', exact: true });
  S.sub(cBisect, 0.86, { f0: 74, f1: 34 });
  S.gliss(cBisect + 1.2, 1.8, 50, 84, 0.64, { key: 62, mode: 'gong', v1: 0.84 });

  S.mark(cThunder, 'act5.thunder');
  P('luo', cThunder, 0.84, { tech: 'main', exact: true });
  S.sub(cThunder, 0.84, { f0: 70, f1: 34 });

  /* ============================================================================
     尾声 · 碧血开道 (1130 – 1320s)：墨血尽碧血生 → 化虹踏云 → 紫微星殿清净骸骨 → 请圣人决断
     ============================================================================ */
  const c0 = A0('coda', 1130), c1 = A1('coda', DUR);
  const cRainbow = C('coda.rainbow', c0 + 42);
  const cStar = C('coda.starpalace', c0 + 74);
  const cQingjing = C('coda.qingjing', c0 + 114);
  const cDecide = C('coda.decide', c1 - 24);
  S.section('尾·碧血开道', c0, c1, '碧血滴玉、虹桥仙籁、清净残骨孤埙与紫微千钧余响');

  // 墨血流尽、继之以洁：一滴滴碧血如玉落石，重塑温文无情的道礼「杨祖」
  for (let d = 0; d < 7; d++) {
    const td = c0 + 2.2 + d * 2.3 + (d * 0.15);
    qing(td, 0.52 + d * 0.02, 69 + (d % 3) * 5);
    chime(td + 0.18, 74 + (d % 4) * 3, 0.42);
  }
  S.pad('bowed', c0 + 12.0, cRainbow, [66, 74, 81], 0.30, { fi: 3.5, fo: 2.0 });
  S.line('flute', c0 + 20.0, [[74, 2.6, 0.78], [76, 1.8, 0.72], [81, 3.2, 0.84], [74, 3.0, 0.70]], 0.52);

  // 碧血化虹，踏虹而行
  S.mark(cRainbow, 'coda.rainbow');
  S.gliss(cRainbow, 2.8, 50, 83, 0.48, { key: 62, mode: 'gong', v1: 0.70, curve: 0.82 });
  bell(cRainbow + 0.2, 57, 0.62);
  S.pad('cello', cRainbow + 1.0, cStar, [50, 57], 0.34, { fi: 2.0, fo: 2.0 });
  weaveArp(cRainbow + 3.5, cStar - 2.0, 0.78, 62, 'gong',
    [[0, 2, 4, 6, 3, 5], [2, 4, 5, 7, 4, 1]], 0.34, 0.42,
    (t, m, v, j) => Z(t, m, v, { vib: j === 0 }));

  // 中天紫微星空大殿：三垣四象胚胎散星长河
  S.mark(cStar, 'coda.starpalace');
  bell(cStar, 50, 0.68);
  qing(cStar + 0.15, 0.60, 74);
  S.pad('cello', cStar + 1.0, cQingjing, [38, 45], 0.36, { fi: 3.0, fo: 2.5 });
  S.pad('bowed', cStar + 2.0, cQingjing, [74, 81], 0.24, { fi: 3.5, fo: 2.5 });
  weaveArp(cStar + 3.0, cQingjing - 2.0, 1.25, 62, 'zhi',
    [[0, 3, 4, 6, 2], [1, 4, 5, 2, 3], [-1, 2, 4, 1, 5]], 0.28, 0.36,
    (t, m, v, j, idx) => {
      chime(t, m + 12, v * 0.85);
      if (j === 0 && idx % 2 === 0) Z(t, m, v * 0.9, { vib: true });
    });

  // 清净散人半具灰黑残骸：孤埙与大提琴肃穆祭奠
  S.mark(cQingjing, 'coda.qingjing');
  bell(cQingjing, 45, 0.66);
  S.pad('cello', cQingjing + 0.8, cDecide, [36, 43, 50], 0.44, { fi: 2.5, fo: 2.0 });
  stateTheme('qingjing-memorial', cQingjing + 3.0, 1.55,
    [[62, 2.0, 0.72], [65, 1.5, 0.68], [69, 2.5, 0.78], [67, 1.5, 0.66], [62, 2.5, 0.74], [57, 3.5, 0.68]],
    (t, m, d, v) => {
      xun(t, m, d * 0.95, v * 0.88);
      if (d >= 2.5) Z(t + 0.1, m - 12, v * 0.65, { vib: true });
    }, 'xun');

  // 千钧星磨难承其重 vs 外界急迫 ——「时间在哪儿？」「请圣人决断。」
  for (let mt = cQingjing + 24.0; mt < cDecide - 2.5; mt += 4.2) {
    P('bd', mt, 0.48, { tech: 'hit', lp: 380 });
    S.sub(mt, 0.45, { f0: 58, f1: 34 });
    Z(mt + 1.4, 50 + ((Math.round(mt) % 3) * 5), 0.46, { bend: 'up1', vib: true });
  }

  S.kill(cDecide - 1.2, cDecide, { tail: true });
  S.mark(cDecide, 'coda.decide');
  bell(cDecide, 50, 0.76);
  bell(cDecide + 0.18, 57, 0.70);
  qing(cDecide + 0.08, 0.68, 69);
  S.pad('cello', cDecide + 0.6, c1 - 4.0, [38, 45], 0.34, { fi: 1.5, fo: 5.5 });
  Z(cDecide + 4.5, 62, 0.54, { vib: true });
  Z(cDecide + 8.2, 69, 0.50, { vib: true });
  chime(cDecide + 12.0, 76, 0.46);
  qing(cDecide + 14.5, 0.52, 81);

  return S;
}
export default buildScore;
