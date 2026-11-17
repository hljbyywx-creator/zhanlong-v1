/* 《万古云霄》配乐 v4 全片总谱（大修订第②期；本期只写 S1 24–278、S2 746–860，其余时段静音）。
   时间：一律取自 docs/revision-v2/CUES-v2.json（全片秒；由 tools/music-cues-v2.mjs 从 BEATSHEET-v2 §5 生成），不读页面 cue。
   1024 观片反馈顺延：CUES-v2 带 fb1024 时，buildScore 先按 BEATSHEET 原秒（T0）出原谱，再由文末 retime1024 平移到新时间轴并重写四处（杀弓手、星君、化梦游仙、静音窗③）。
   速度：每段一张节拍钟（makeClock）。名义速度按 BEATSHEET 逐点线性（「→」为渐变），命中点（HITS）是钟的锚：相邻两锚之间取整拍，
        名义拍数按比例微调（本期实测 −1.7%…+2.3%），于是每个命中点都正落在拍头上、偏差为 0；锚之间的次要动作点按「拍→八分→十六分」就近量化（误差 ≤0.07s）。
        小节从每个锚重新起算，锚前不足 4 拍的余数成为锚前的短小节（3/4 或 2/4），命中＝新句的碰撞拍。
   写法（REVISION-PLAN §7）：一个 4 小节短句依次 准备→逼近→碰撞→结果；每 4 小节至少变一项（重音型、音区、声部、句尾）；
        敌方出招＝截断句（句尾截掉、捂音钹收），余慈接招＝延长／转向句（句尾上行、长音延过小节线）；琵琶轮指只作 0.5–1.5s 突击；
        跨段不复制音型：S1 种子＝「三三二」古筝八分（组首低音、组内四五度上翻），S2 种子＝「三连十六分」低弦水纹（3+3+3+3+4），二者节奏与音高构造都不同；
        全谱不写 A3/D4 两音交替（自检：同一声部相邻两音在两音间来回 ≥4 次即报错）。
   动机：毒鳄（埙 F4↘D4 C♯4 C4 B3）完整陈述只在 244–278 一次，此前只露两音碎片；云霄主题只露片段（头两三音／半句）。
   乐器：古筝 zheng、越南筝 dan、大提琴组 cello、小提琴组 bowed、长笛 flute、埙 xun、手铃 chime、编钟 bell、磬 qing、琵琶 pipa（古筝改演奏法）；
        VCSL 新打击：大鼓 bd、堂鼓 tomH/tomL、板鼓 frameS/frameL、大锣 luo、铙钹 nao、梆子 bang/slit。 */
import { makeScore } from './lib.mjs';

/* 节拍钟：knots=[[t, ♩]…] 名义速度（同一时刻两点＝突变，如 3:2 转换）；anchors=[t…] 锚点（拍号为整数）。b(t) 时刻→拍，t(b) 拍→时刻。 */
export function makeClock(knots, anchors, pad = 40) {
  const bpmN = (t) => {
    if (t <= knots[0][0]) return knots[0][1];
    for (let i = 1; i < knots.length; i++) {
      const [t1, v1] = knots[i], [t0, v0] = knots[i - 1];
      if (t < t1) return t1 > t0 ? v0 + (v1 - v0) * (t - t0) / (t1 - t0) : v1;
    }
    return knots[knots.length - 1][1];
  };
  const dt = .001, t0 = anchors[0] - pad, t1 = anchors[anchors.length - 1] + pad, n = Math.round((t1 - t0) / dt) + 1;
  const Bn = new Float64Array(n);
  for (let i = 1; i < n; i++) Bn[i] = Bn[i - 1] + bpmN(t0 + (i - .5) * dt) / 60 * dt;
  const at = (arr, t) => { const x = Math.max(0, Math.min(n - 1.000001, (t - t0) / dt)), i = Math.floor(x); return arr[i] + (arr[i + 1] - arr[i]) * (x - i); };
  const ab = [0], ks = [];
  for (let j = 0; j + 1 < anchors.length; j++) {
    const nb = at(Bn, anchors[j + 1]) - at(Bn, anchors[j]), N = Math.max(1, Math.round(nb));
    ks.push(N / nb); ab.push(ab[j] + N);
  }
  const B = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = t0 + i * dt;
    let j = 0; while (j + 1 < anchors.length && t >= anchors[j + 1]) j++;
    const k = t < anchors[0] || j >= ks.length ? 1 : ks[j];
    B[i] = ab[j] + k * (Bn[i] - at(Bn, anchors[j]));
  }
  const b = (t) => at(B, t);
  const tOf = (bb) => {
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (B[m] <= bb) lo = m; else hi = m; }
    return t0 + (lo + (bb - B[lo]) / Math.max(1e-12, B[hi] - B[lo])) * dt;
  };
  const bpm = (t) => (b(t + .01) - b(t - .01)) / .02 * 60;
  return { b, t: tOf, bpm, anchors, anchorBeats: ab, scale: ks, nominal: bpmN };
}

function buildV4(cues) {
  const S = makeScore(cues);
  S.wet = .5;
  const HT = {}; for (const h of cues.hits || []) HT[h.id] = h.T;
  const H = (id) => { if (!(id in HT)) throw new Error('缺命中点 ' + id); return HT[id]; };
  const T = (id) => S.T(id);
  const J = S.rnd(404);
  const jit = (v, k = .05) => v * (1 + (J() * 2 - 1) * k);

  /* ---------- 乐器 ---------- */
  const cnt = {};
  const PAN = { bd: 0, tomL: .2, tomH: -.18, frameS: .34, frameL: -.1, luo: .12, nao: -.14, bang: .4, slit: -.32, qing: .1, drum: 0, gong: .12, cym: -.12 };
  const SEND = { bd: .16, tomL: .15, tomH: .15, frameS: .12, frameL: .15, luo: .3, nao: .24, bang: .18, slit: .17, qing: .42, drum: .2, gong: .32, cym: .3 };
  const GAIN = { bd: .78, tomL: .55, tomH: .55, frameS: .55, frameL: .55, luo: .8, nao: .42, bang: .45, slit: .5, qing: 1, drum: 1, gong: .75, cym: .42 };
  const P = (i, t, v, o = {}) => {
    const key = i + '|' + (o.tech || '');
    cnt[key] = (cnt[key] || 0) + 1;
    return S.ev({ k: 'p', i, t, v: o.exact ? v : jit(v, .05), m: o.m, tech: o.tech, lv: o.lv, rr: cnt[key], rate: o.rate, d: o.d, rel: o.rel, lp: o.lp, hp: o.hp, att: o.att, env: o.env,
      align: o.align, rev: o.rev, mf: o.mf, pan: o.pan == null ? (PAN[i] || 0) : o.pan, send: o.send == null ? (SEND[i] == null ? .2 : SEND[i]) : o.send, gain: (o.gain || 1) * (GAIN[i] || 1) * S.gs });
  };
  const nEv = (i, t, m, v, o = {}) => S.ev({ k: 'n', i, t, m, v, gain: (o.gain || 1) * S.gs, pan: o.pan == null ? 0 : o.pan, send: o.send == null ? .3 : o.send,
    d: o.d, att: o.att, rel: o.rel, off: o.off, env: o.env, genv: o.genv, bend: o.bend, vib: o.vib, lp: o.lp, mf: o.mf, rr: o.rr, tech: o.tech, chord: o.chord });
  const Z = (t, m, v, o = {}) => S.z(t, m, v, { exact: true, ...o });            // 古筝（音域外自动由越南筝补）
  const pipa = (t, m, v, o = {}) => nEv('pipa', t, m, v, { pan: -.26, send: .2, ...o });
  const lun = (t0, d, m, v, o = {}) => {                                          // 琵琶轮指突击：只许 0.5–1.5s
    if (d < .5 - 1e-9 || d > 1.5 + 1e-9) throw new Error(`轮指 ${d}s 越出 0.5–1.5s @${t0}`);
    S.lunLog.push([+t0.toFixed(3), +d.toFixed(3)]);
    return pipa(t0, m, v, { tech: 'lun', d, ...o });
  };
  S.lunLog = [];
  const sao = (t, chord, v, o = {}) => pipa(t, chord[0], v, { tech: 'sao', chord, ...o });
  const xun = (t, m, d, v, o = {}) => nEv('xun', t, m, v, { d, att: .06, rel: .15, send: .38, ...o });
  const bell = (t, m, v, o = {}) => nEv('bell', t, m, v, { send: .4, ...o });
  const chime = (t, m, v, o = {}) => nEv('chime', t, m, v, { d: 1.2, rel: .8, send: .5, ...o });
  const qing = (t, v, m = 60, o = {}) => P('qing', t, v, { m, ...o });
  const cello = (t, m, d, v, o = {}) => S.cello(t, m, d, v, { exact: true, ...o });
  const bowed = (t, m, d, v, o = {}) => S.bowed(t, m, d, v, { exact: true, ...o });
  const flute = (t, m, d, v, o = {}) => S.flute(t, m, d, v, { exact: true, ...o });
  const stab = (t, m, v, o = {}) => S.cello(t, m, o.d || .2, v, { exact: true, att: .006, rel: o.rel || .09, send: .14, ...o });   // 低弦短弓
  const sub = (t, v, o = {}) => S.sub(t, v, o);
  const trem = (...a) => { const n0 = S.events.length; S.trem(...a); for (let k = n0; k < S.events.length; k++) S.events[k].trem = true; };   // 单音摇指／颤弓（多声部叠用时各声部单独一条）

  /* 五声阶梯（G 宫：G A B D E），n=0 为 E3；S1 以 E 为中心（羽），S2 以 D 为中心（徵） */
  const LADE = (n) => { const s = [0, 3, 5, 7, 10], o = Math.floor(n / 5), i = ((n % 5) + 5) % 5; return 52 + 12 * o + s[i]; };
  const LADD = (n) => { const s = [0, 2, 5, 7, 9], o = Math.floor(n / 5), i = ((n % 5) + 5) % 5; return 50 + 12 * o + s[i]; };

  /* 量化：拍→八分→十六分，取误差 ≤tol 的最粗一档 */
  const qz = (clk, t, tol = .07) => {
    const b = clk.b(t);
    for (const g of [1, .5, .25]) { const tq = clk.t(Math.round(b / g) * g); if (Math.abs(tq - t) <= tol) return tq; }
    return clk.t(Math.round(b * 4) / 4);
  };
  /* 小节：从锚 tA 起每 4 拍一小节，到 tB（下一锚）前的余数成短小节 */
  const barsOf = (clk, tA, tB) => {
    const bA = Math.round(clk.b(tA)), bB = Math.round(clk.b(tB)), out = [];
    for (let b = bA, k = 0; b < bB; k++) { const len = Math.min(4, bB - b); out.push({ b0: b, len, k, t0: clk.t(b), t1: clk.t(b + len) }); b += len; }
    return out;
  };
  /* 命中保护：其它声部在命中前 0.12s 到后 0.08s 内不落音（命中自己的声部用 force 写） */
  const guard = [];
  const free = (t) => !guard.some((g) => t > g - .12 && t < g + .08);

  /* 记录 */
  const sec = (name, t0, t1, note) => S.section(name, t0, t1, note);

  /* ==================================================================================
     S1 · 24–278：侍立 → 诸招开路 → 暴起 → 一剑 → 合印 → 暗室
     ================================================================================== */
  const clk1 = makeClock(
    [[20, 60], [53.9, 60], [54, 112], [71, 120], [79, 124], [91, 124], [115, 128], [122, 132], [216, 132], [218, 120], [232, 100], [244, 88], [300, 88]],
    [H('H00'), H('H01'), H('H02'), H('H03'), H('H04'), H('H05'), H('H06'), H('H07'), T('act2.2-06')]);
  S.clockInfo = { s1: { anchors: clk1.anchors, beats: clk1.anchorBeats, scale: clk1.scale.map((k) => +k.toFixed(4)) } };
  for (const h of ['H00', 'H01', 'H02', 'H03', 'H04', 'H05', 'H06', 'H07']) guard.push(H(h));

  /* 种子 A（S1）：一小节八分音，按分组（3+3+2 等）；每组首音＝组根（低音、重音），三音组 [r, r+3, r+5]、二音组 [r, r+4]、四音组 [r, r+2, r+5, r+3]（五声级数，E 羽阶梯）。
     roots＝本小节各组的根（级数）；reg＝整体移位（级数，5＝八度）。 */
  const GSHAPE = { 2: [0, 4], 3: [0, 3, 5], 4: [0, 3, 5, 2], 1: [0] }, NARROW = { 2: [0, 1], 3: [0, 1, 3], 4: [0, 1, 3, 2], 1: [0] };
  const cellA = (group, roots, reg = 0, narrow = false) => {
    const out = [];
    group.forEach((g, j) => (narrow ? NARROW : GSHAPE)[g].forEach((d, k) => out.push({ m: LADE(roots[j] + reg + d), acc: k === 0, grp: j })));
    return out;
  };
  /* 一小节古筝八分：cut＝截断（只奏前 n 个音），hold＝末音延长到下一小节拍头（余慈的延长句） */
  let lastZ = null;
  const zBar = (clk, bar, group, roots, o = {}) => {
    const notes = cellA(group, roots, o.reg || 0, o.narrow), n8 = Math.round(bar.len * 2);
    const lim = Math.min(n8, o.cut == null ? notes.length : o.cut);
    for (let k = 0; k < lim; k++) {
      const t = clk.t(bar.b0 + k / 2);
      if (!free(t)) continue;
      const x = { ...notes[k % notes.length] }, last = k === lim - 1;
      if ((lastZ === 57 && x.m === 62) || (lastZ === 62 && x.m === 57)) x.m = x.m === 62 ? 64 : 55;   // 不让 A3、D4 相邻
      lastZ = x.m;
      const v = (x.acc ? (o.vA || .46) : (o.v || .3)) * (o.cres ? 1 + o.cres * k / n8 : 1);
      Z(x.acc ? t : t + (J() * 2 - 1) * .005, x.m, jit(v, .06), { d: last && o.hold ? clk.t(bar.b0 + bar.len) - t + .25 : .34, rel: last && o.hold ? .6 : .12, pan: o.pan, send: o.send, bend: last && o.bend ? o.bend : undefined });
      if (x.acc && o.stab) { let sm = x.m - 12; while (sm > 59) sm -= 12; stab(t, sm, o.stabV || .36); }
    }
    if (o.cut != null && o.choke) P('nao', clk.t(bar.b0 + lim / 2), o.choke, { tech: 'short' });
  };
  /* 鼓层：pos 为小节内八分位（可含 .5 即十六分）；accentSet 里的位加重 */
  const drums = (clk, bar, layers) => {
    for (const L of layers) {
      for (const p of L.pos) {
        if (p >= bar.len * 2) continue;
        const t0 = clk.t(bar.b0 + p / 2);
        if (!free(t0)) continue;
        const acc = L.acc && L.acc.includes(p), t = acc ? t0 : t0 + (J() * 2 - 1) * .004;   // 非重音 ±4ms 人味
        P(L.i, t, (acc ? L.vA || L.v * 1.45 : L.v) * (L.cres ? 1 + L.cres * p / (bar.len * 2) : 1), { tech: L.tech, lp: L.lp, gain: L.gain, d: L.d != null ? L.d : L.i === 'bd' ? .5 : undefined, rel: L.i === 'bd' ? .3 : undefined });   // 律动里的大鼓捂音（.5s＋.3s 收），免得 43Hz 长鸣叠成低频泥
      }
    }
  };
  const ALL8 = [0, 1, 2, 3, 4, 5, 6, 7], ALL16 = [0, .5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5];
  const A332 = [0, 3, 6], A233 = [0, 2, 5], A323 = [0, 3, 5], A44 = [0, 4];

  /* ---------------- 快打Ⅰ 54–174 ---------------- */
  {
    const h00 = H('H00'), h01 = H('H01'), h02 = H('H02'), h03 = H('H03'), h04 = H('H04');
    const c = clk1;
    sec('S1·1-04 水下剑破板', 54, h00, '53.5 声场抽空→54.3 琵琶一扫（敌方截断句）→板鼓渐快渐强→55.8 堂鼓＋梆子木裂');
    S.kill(53.5, 54.22);
    sao(54.3, [52, 59, 64, 71], .62, { send: .24 });
    P('nao', 54.3, .32, { tech: 'short', gain: .8 });
    P('bang', 54.3, .62);
    { let t = 54.72, i = 0; while (t < h00 - .07) { const k = (t - 54.72) / (h00 - 54.72); P('frameS', t, .12 + .34 * k * k, { tech: 'mute' }); t += 1 / (11 + 11 * k); i++; } }
    S.gliss(55.25, .5, 52, 76, .34, { key: 67, mode: 'gong', v1: .5, curve: .8 });
    bowed(54.7, 64, 1.05, .14, { att: .8, rel: .08, lp: 7000 });
    P('tomL', h00, .96, { tech: 'm', exact: true }); P('tomH', h00 + .012, .82, { tech: 'm', exact: true });
    P('bd', h00, .72, { exact: true }); P('bang', h00 + .004, .9, { exact: true }); P('slit', h00 + .008, .85, { tech: 'lo', exact: true });
    stab(h00, 40, .55, { d: .45 }); stab(h00, 47, .45, { d: .45 }); sub(h00, .3, { f0: 85, f1: 40, dec: .5 });
    S.mark(h00, 'H00 破板');

    /* ---- 55.8–81.5：木屑悬停 → 拂袖拉开虚空 → 红柱震颤 → 弓满 ---- */
    const bB = barsOf(c, h00, h01);
    const t59 = T('act1.1-05'), t71 = T('act1.1-06'), t79 = T('act1.1-07');
    sec('S1·1-04后果→1-05 拂袖', h00, t71, '堂鼓三三二＋板鼓鬼音（木屑悬停）；59 低弦长音被拉长下滑（余慈延长句）；60.5 出手：反向钹吸气→大鼓；61.3 起古筝种子 A，第二句放宽成 4+4（虚空被拉长）；鼓只留两层');
    const PH = [[0, 0, -2], [1, 1, 2], [3, 2, 1], [0, -2, -3]];          // 4 小节：准备→逼近→碰撞→结果（组根级数）
    const t605 = qz(c, 60.5), t613 = qz(c, 61.3);
    for (const bar of bB) {
      const t = bar.t0;
      if (t < t59 - .01) {                                              // 后果：木屑悬停
        drums(c, bar, [{ i: 'tomL', tech: 'm', pos: A332, v: .4, acc: [0], vA: .5 }, { i: 'frameS', tech: 'mute', pos: ALL8, v: .17, acc: [0, 4], vA: .24 }, { i: 'bd', pos: [0], v: .46 }]);
        for (const p of A332) if (p < bar.len * 2) stab(c.t(bar.b0 + p / 2), 40, p ? .3 : .38);
      } else if (t < t71 - .01) {                                       // 1-05：两层鼓（大鼓＋堂鼓），古筝种子 A
        const k = bar.k - bB.findIndex((x) => x.t0 >= t59 - .01);
        drums(c, bar, [{ i: 'bd', pos: k % 2 ? [0, 5] : [0], v: .46, acc: [0], vA: .56 }, { i: 'tomL', tech: 'm', pos: k >= 4 ? A44.concat([6]) : A332, v: .36, acc: [0], vA: .46 }]);
        if (bar.t0 >= t613 - .3) {
          const kk = bB.filter((x) => x.t0 >= t613 - .3 && x.t0 < bar.t0).length;
          if (kk < 4) zBar(c, bar, [3, 3, 2], PH[kk], { vA: .44, v: .28, stab: false, hold: kk === 3, bend: kk === 3 ? [[0, 0], [.3, 0], [.6, 2]] : null });
          else zBar(c, bar, [4, 4], [[0, 1], [2, 1], [3, 2], [1, 0]][(kk - 4) % 4], { vA: .42, v: .27, reg: 0, hold: (kk - 4) % 4 === 3 });
        }
      } else if (t < t79 - .01) {                                       // 1-06：红柱震颤（梆子三连，截断句），光网，侍女冲入
        const k = bB.filter((x) => x.t0 >= t71 - .01 && x.t0 < bar.t0).length;
        drums(c, bar, [{ i: 'bd', pos: [0, 5], v: .48, acc: [0], vA: .6 }, { i: 'tomL', tech: 'm', pos: A233, v: .38, acc: [0], vA: .5 }, { i: 'tomH', tech: 's', pos: k % 2 ? [3, 7] : [7], v: .3 }, { i: 'frameS', tech: 'mute', pos: ALL8, v: .15, acc: [2, 6], vA: .22 }]);
        if (k >= 2) zBar(c, bar, [2, 3, 3], [[1, 2, 0], [2, 3, 1], [3, 1, 2], [0, 2, 1]][k % 4], { reg: k >= 3 ? 5 : 0, vA: .4, v: .26, cut: k % 2 ? 4 : 5, choke: .26 });
      } else {                                                          // 1-07 准备：弓满（低弦颤弓渐强），板鼓十六分渐强
        drums(c, bar, [{ i: 'frameS', tech: 'mute', pos: ALL16, v: .16, cres: 1.6 }, { i: 'tomL', tech: 'm', pos: [0, 3], v: .42 }]);
      }
    }
    /* 1-05 余慈接招：低弦长音被拉长、下滑（不复用 v3 写法：这里是 B2 下滑到 A2，同时小提琴组守 E4，两声部间距越拉越大） */
    cello(t59 + .1, 47, t71 - t59 - .4, .4, { att: 1.0, rel: 1.4, bend: [[0, 0], [4, 0], [t71 - t59 - 1.5, -2]] });
    bowed(t59 + .4, 64, t71 - t59 - .6, .16, { att: 2.2, rel: 1.6, lp: 8000 });
    S.inhale(t605, .4, { d: 1.4, lp: 8000 });
    P('bd', t605, .7, { exact: true }); P('tomL', t605 + .01, .55, { tech: 'm' }); S.strum(t605, [52, 59, 64, 71], .42, { spread: .03 });
    P('nao', t613, .3, { tech: 'open', d: 2.5, rel: 1.5 });
    [61.3, 63.0, 64.7].forEach((x, j) => { S.noise(x, .45, .14 + .02 * j, { f: 1100, q: .55, white: .45, att: .012, rel: .36, send: .4, pan: .25 }); P('tomL', x + .006, .26 + .04 * j, { tech: 'm', exact: true, lp: 700 }); S.mark(x, '对点 A 咫尺天涯第' + (j + 1) + '扑'); });   // v5 对点 A：刺客三扑（act1 LUNGE105）各踩起水花＝扑水声＋一记捂音堂鼓
    /* 1-06 红柱震颤：梆子三连（时刻照画面，截断句：每击后半拍古筝停；v5 终修 G1-1：71.4/72.6/73.8→71.25/71.6/71.95） */
    [[71.25, .66], [71.6, .74], [71.95, .84]].forEach(([tt, v], j) => { P('bang', tt, v, { exact: true }); P('slit', tt + .006, v * .8, { tech: 'hi' }); stab(tt, [52, 55, 57][j], .34); });
    bowed(t71 + 1.0, 76, 6.2, .1, { att: 1.8, rel: 1.6, lp: 9000, send: .5 });       // 光网：高音泛光（小提琴组采样最高 E5 附近；更高的由长笛弱奏）
    flute(t71 + 1.2, 83, 5.5, .07, { att: 2, rel: 1.5, lp: 10000, send: .55 });
    P('frameL', 73.5, .4, { tech: 'mute' });                                           // 侍女摔倒（v5 终修 G1-1：1-06 压到 71–74.3，摔倒 77.2→73.5；不加 exact——exact 会少取一次随机数，后面古筝随机句型整体错位、141 s 处撞上两音循环自检）
    /* 1-07：弓满 → 80.5 弦爆＋轮指 0.8s → 81.5 拈箭，停一拍 */
    for (const m of [40, 47]) trem(t79 + .1, 80.45, m, .12, .4, { inst: 'cello', rate: [8, 14], cut: true, send: .1 });
    bowed(t79 + .2, 76, 1.2, .1, { att: 1, rel: .1, lp: 6000 });
    const t805 = qz(c, 80.5);
    bowed(t805, 79, .5, .42, { sfz: true, rel: .25 }); P('nao', t805, .5, { tech: 'short' }); P('bd', t805, .56);
    lun(80.6, .8, 71, .5, { send: .2 });
    P('bd', h01, .78, { exact: true }); P('tomL', h01 + .008, .85, { tech: 'm', exact: true }); P('nao', h01, .62, { tech: 'short', exact: true });
    P('slit', h01, .7, { tech: 'hi', exact: true }); stab(h01, 40, .5, { d: .25 });
    const b815 = Math.round(c.b(h01));
    S.kill(h01 + .17, c.t(b815 + 1) - .01);                                              // 拈箭：停一拍
    S.mark(h01, 'H01 拈箭（停一拍）');

    /* ---- 81.5–111.6：箭颤 → 同框攻防（余慈奏完一句）→ 光波压身（鼓抽一层）→ 剑客自爆 ---- */
    const bC = barsOf(c, h01, h02);
    const t91 = T('act1.1-07a'), t97 = T('act1.1-08'), t109 = T('act1.1-09');
    sec('S1·1-07后果→1-09', h01, h02, '箭颤＝越南筝高音摇指；字幕处古筝只留组根轻脉冲；1-07a 前一小节进古筝种子 A 完整一句＋越南筝余慈句（奏完，落 E）；1-08 99.0 光波低频长音、鼓抽掉堂鼓高；关节咯响＝堂鼓边；1-09 堂鼓十六分渐强→111.6 闷爆');
    S.dan(c.t(b815 + 1) + .02, 76, .26, { exact: true, d: 2.4, rel: .8, send: .45, vib: { f: 9, c: 45, at: .02, ramp: .1 } });   // 箭颤：越南筝高音急颤（揉弦，不用轮指）
    const pre91 = bC.findIndex((x) => x.t1 > t91 - 2.2);             // 提前一小节进新声部
    for (const bar of bC) {
      if (bar.k === 0) { drums(c, { ...bar, b0: bar.b0 + 1, len: bar.len - 1 }, [{ i: 'frameS', tech: 'mute', pos: ALL8, v: .16 }]); continue; }
      const t = bar.t0;
      if (bar.k < pre91) {                                              // 箭颤、心声（字幕）：轻脉冲
        drums(c, bar, [{ i: 'frameS', tech: 'mute', pos: ALL8, v: .17, acc: [0, 3, 6], vA: .25 }, { i: 'tomL', tech: 'm', pos: A332, v: .32 }, { i: 'bd', pos: [0], v: .4 }]);
        for (const p of A332) if (p < bar.len * 2) { const tt = c.t(bar.b0 + p / 2); if (free(tt)) Z(tt, LADE([0, 3, 1, 2][bar.k % 4] - (p ? 0 : 5) + 5), p ? .2 : .26, { d: .3 }); }
        if (bar.k % 2 === 0) stab(t, 40, .32);
      } else if (t < t97 - .3) {                                        // 1-07a：余慈暂占上风，奏完整句
        const kk = bar.k - pre91;
        drums(c, bar, [{ i: 'bd', pos: [0, 6], v: .5, acc: [0], vA: .62 }, { i: 'tomL', tech: 'm', pos: A332, v: .4, acc: [0], vA: .52 }, { i: 'tomH', tech: 'm', pos: kk === 3 ? [5, 6, 7] : [7], v: .3 }, { i: 'frameS', tech: 'mute', pos: ALL8, v: .17 }]);
        zBar(c, bar, [3, 3, 2], [[2, 2, 0], [3, 3, 4], [5, 4, 3], [2, 0, 1]][kk % 4], { vA: .46, v: .3, stab: true, reg: 0, hold: kk % 4 === 3 });
      } else if (t < t109 - .01) {                                      // 1-08：光波压身，鼓抽一层；古筝压低压弱
        const kk = bC.filter((x) => x.t0 >= t97 - .3 && x.t0 < bar.t0).length;
        drums(c, bar, [{ i: 'bd', pos: [0], v: .44 }, { i: 'tomL', tech: 'm', pos: kk % 4 === 3 ? A323 : A332, v: .33, acc: [0], vA: .42 }, { i: 'frameS', tech: 'mute', pos: ALL8, v: .15, acc: [0], vA: .2 }]);
        zBar(c, bar, kk % 4 === 3 ? [3, 2, 3] : [3, 3, 2], [[-2, -3, -2], [-3, -2, 0], [0, -2, -3], [-3, -3, -2]][kk % 4], { reg: 0, vA: .3, v: .2 });
        if (kk % 2 === 1) P('tomH', c.t(bar.b0 + 2.75), .2, { tech: 'rim' });        // 关节咯响
      } else {                                                          // 1-09 准备：双眼迸裂前，堂鼓十六分渐强
        drums(c, bar, [{ i: 'tomL', tech: 's', pos: ALL16.filter((p) => p >= 2), v: .22, cres: 1.8 }, { i: 'frameS', tech: 'mute', pos: ALL8, v: .2, cres: 1 }]);
      }
    }
    /* 1-07a 越南筝余慈句：整句奏完、落 E（延长到下一小节）——种子 A 的组根轮廓 E–B–D–E 上行，转向后落 */
    {
      const b0 = bC[pre91].b0;
      const line = [[76, 1.5], [74, .5], [71, 1], [74, 1], [76, 1], [79, 1.5], [76, .5], [74, 1], [71, 1], [69, .5], [71, .5], [74, 1], [76, 3]];
      let b = b0;
      for (const [m, len] of line) { const tt = c.t(b); if (free(tt)) S.dan(tt, m, .3, { exact: true, d: c.t(b + len) - tt + .1, vib: len >= 1.5, send: .36 }); b += len; }
    }
    /* 1-08 光波：低频长音（合成 sub＋低弦泛音），99.0 起 */
    const t99 = qz(c, 99.0);
    sub(t99, .42, { f0: 66, f1: 34, dec: 3.2, subD: 8 });
    cello(t99 + .1, 43, 8.5, .26, { att: 2.2, rel: 2, lp: 2600, send: .4 });
    flute(t99 + .4, 83, 7.5, .06, { att: 2.6, rel: 2.2, lp: 7000, send: .55 });
    /* 1-09：111.6 闷爆（大鼓＋锣闷击），之后低弦颤音 */
    bowed(109.6, 71, 1.9, .14, { att: 1.4, rel: .06, lp: 8000 });
    P('bd', h02, .9, { exact: true, lp: 700 }); P('luo', h02 + .01, .62, { tech: 'main', lp: 1800, exact: true }); sub(h02, .48, { f0: 70, f1: 32, dec: .9 });
    P('tomL', h02, .7, { tech: 'm', exact: true }); P('nao', h02 + .005, .36, { tech: 'open', lp: 4000 });
    stab(h02, 40, .5, { d: .35 });
    S.mark(h02, 'H02 剑客自爆（闷爆）');

    /* ---- 111.6–129.8：霉斑蔓延（低弦颤音）→ 虚空三缩 → 鼓滚 → 侍女暴起 → 三步 → 抵胸 ---- */
    const bD = barsOf(c, h02, h03);
    const t115 = T('act1.1-09a'), t122 = T('act1.1-10');
    sec('S1·1-09后果→1-10', h02, h03, '低弦颤音＋板鼓十六分鬼音（霉斑）；三缩：堂鼓逐次加重、低弦短弓逐次上移；古筝种子 A 收窄成邻级簇；121.2 指尖一动（梆子轻点）；121.5 大鼓滚；122 琵琶一扫；三步大鼓递进；129.8 抵胸＝大鼓＋铙钹＋轮指 0.6s；震波锣降速，一层强过一层');
    for (const m of [40, 47]) trem(h02 + .15, t115 + .6, m, .28, .18, { inst: 'cello', rate: 11, cut: true, send: .12 });
    const shrink = [115.4, 116.6, 117.8];                                                                  // v5 对点 A：三收压到 115.4/116.6/117.8（act1 SHRINK；原 116/118/120 量化），其后 119–121.6 删
    for (const bar of bD) {
      const t = bar.t0;
      if (t < t115 - .6) {
        drums(c, bar, [{ i: 'frameS', tech: 'mute', pos: ALL16, v: .13, acc: [0, 1.5, 3, 5, 6.5], vA: .22 }, { i: 'tomL', tech: 'm', pos: [0, 5], v: .34 }]);
      } else if (t < t122 - .01) {
        const kk = bD.filter((x) => x.t0 >= t115 - .6 && x.t0 < bar.t0).length;
        drums(c, bar, [{ i: 'frameS', tech: 'mute', pos: ALL8, v: .18, acc: [0, 3, 6], vA: .26 }, { i: 'bd', pos: [0], v: .44 }, { i: 'tomH', tech: 's', pos: [3, 7], v: .3 }]);
        zBar(c, bar, [3, 3, 2], [[1, 2, 1], [2, 3, 2], [3, 4, 3], [4, 4, 5]][kk % 4], { narrow: true, vA: .4, v: .28, cres: .3, cut: t >= 120.6 ? 2 : undefined });
      } else {                                                          // 1-10：敌方压迫（截断句：每小节第 4 拍后半截住）
        const kk = bD.filter((x) => x.t0 >= t122 - .01 && x.t0 < bar.t0).length;
        if (bar.t0 < 126.8) {
          drums(c, bar, [{ i: 'tomH', tech: 's', pos: [0, .5, 1.5, 3, 3.5, 4.5, 6], v: .3, acc: [0, 3], vA: .44 }, { i: 'tomL', tech: 's', pos: [1, 2, 4, 5, 7 - 1], v: .32 }, { i: 'frameS', tech: 'mute', pos: ALL8, v: .16 }, { i: 'bd', pos: [0], v: .5 }]);
          if (bar.len === 4) P('nao', bar.t0 + (bar.t1 - bar.t0) * 7 / 8, .3, { tech: 'short' });
          stab(bar.t0, 40, .4); stab(c.t(bar.b0 + 1.5), 43, .32); stab(c.t(bar.b0 + 3), 45, .34);
        } else drums(c, bar, [{ i: 'frameS', tech: 'mute', pos: ALL8, v: .18, cres: 2 }]);   // v5 SND3：板鼓 cres .8→2
      }
    }
    shrink.forEach((tt, j) => { S.mark(tt, '对点 A 三收第' + (j + 1) + '收'); P('tomL', tt, .5 + .16 * j, { tech: 'm' }); if (j) P('bd', tt, .4 + .14 * j); stab(tt, [52, 55, 57][j], .4 + .06 * j, { d: .3 }); });
    P('bang', 118.4, .3, { tech: 'main', exact: true }); S.mark(118.4, '对点 A 侍女指尖一动');   // v5 对点 A：指尖一动挪到 118.4（act1 TWITCH，原 121.2 落在删段里）
    P('bd', qz(c, 121.5), .5, { tech: 'froll', d: t122 - qz(c, 121.5) + .15, rel: .1, gain: .8 });
    sao(t122, [52, 57, 64, 69, 76], .6); P('nao', t122, .4, { tech: 'short' }); P('bd', t122, .6); S.mark(t122, '对点 A 侍女暴起');
    lun(t122 + .05, .5, 64, .4);
    for (const m of [40, 47]) trem(126.8, 129.6, m, .3, .8, { inst: 'cello', rate: [9, 15], cut: true, send: .1 });   // v5 SND3：低弦颤弓 E2/B2 渐强（预备）
    { let x = 126.9; while (x < 129.55) { const k = (x - 126.8) / 2.8; P('tomL', x, .22 + .4 * k, { tech: 's', exact: true }); x += 1 / (6 + 10 * k); } }   // 堂鼓渐密渐强接三步
    S.kill(129.62, 129.78);                                                                              // v5 SND3：抵胸前吸空
    [127.4, 128.3, 129.2].forEach((tt, j) => { S.inhale(tt, .16 + .04 * j, { d: .15, lp: 7000 }); P('bd', tt, .6 + .2 * j, { exact: true, lp: 1000 + 1300 * j }); stab(tt, 40, .38 + .07 * j, { d: .3 }); P('tomL', tt + .01, .4 + .1 * j, { tech: 'm' }); S.mark(tt, '对点 A 侍女第' + (j + 1) + '步落脚'); });   // v5 对点 A：三步落脚照画面（act1 STEP，不量化；原 qz 晚 ~.04s），冲的 .15s 各一记短吸收在落脚
    P('bd', h03, .86, { exact: true }); P('nao', h03 + .003, .7, { tech: 'open', exact: true }); P('tomL', h03 + .01, .72, { tech: 'm', exact: true }); sub(h03, .5, { f0: 80, f1: 36, dec: .7 });   // v5 SND9：顶级命中各降约 1.5 dB
    lun(h03, .6, 64, .55); stab(h03, 40, .55, { d: .5 }); stab(h03, 52, .45, { d: .5 });
    [[130.3, .5, .88], [131.0, .62, .78], [131.8, .74, .68]].forEach(([x, v, r]) => P('luo', qz(c, x), v, { tech: 'main', rate: r, d: 6, rel: 2.5 }));
    S.mark(h03, 'H03 手刀抵胸');

    /* ---- 129.8–165.5：崩解后果 → 天外音十转（敌方鼓逐转减层，余慈句逐转延长）→ 手刀三衰 → 剑气凝眉 → 一剑勾销 ---- */
    const bE = barsOf(c, h03, h04);
    const t138 = T('act1.1-11'), t162 = T('act1.1-12');
    const rings = [140.4, 142.0, 143.4, 144.6, 145.6, 146.45, 147.15, 147.75, 148.25, 148.65], BIGR = [2, 5, 8];   // v5 对点 A：十转转距 1.6→0.4s 照画面（act1 T11，不量化；原 141.0…153.5）；第 3/6/9 转血焰大剥落（BIG11）
    sec('S1·1-10后果→1-12', h03, h04, '低弦短弓八分推进（胸膛内陷）；天外音十转＝手铃/越南筝击发＋长笛高泛音长音，音高逐转上行；敌方鼓五层每两转去一层；余慈古筝句每转多一音；手刀三衰（堂鼓渐弱）；剑气凝眉＝古筝摇指＋小提琴组渐强；165.5 琉璃碎＝编钟高音＋磬，骤静一拍，低音脉冲续');
    const enemyLayers = (n) => [
      { i: 'bang', pos: [2, 6], v: .32 }, { i: 'tomH', tech: 's', pos: [3, 7], v: .28 }, { i: 'tomL', tech: 'm', pos: A332, v: .34, acc: [0], vA: .44 },
      { i: 'bd', pos: [0, 5], v: .44, acc: [0], vA: .54 }, { i: 'frameS', tech: 'mute', pos: ALL8, v: .15 }].slice(5 - n);
    for (const bar of bE) {
      const t = bar.t0;
      if (bar.k === 0 && bar.len) { stab(c.t(bar.b0 + 2), 40, .4); continue; }   // 震波期间只留锣
      if (t < t138 - 1.8) {                                             // 崩解后果：低弦短弓八分（字幕：先前诸招……），轻鼓
        for (let k = 0; k < bar.len * 2; k++) { const tt = c.t(bar.b0 + k / 2); if (free(tt)) stab(tt, [40, 47, 50, 40, 47, 50, 43, 47][k] + (bar.k % 2 && k % 3 === 1 ? 12 : 0), [0, 3, 6].includes(k) ? .38 : .24); }
        drums(c, bar, [{ i: 'bd', pos: [0], v: .4 }, { i: 'tomL', tech: 's', pos: bar.k >= 2 ? A323 : [0, 6], v: .3, acc: [0], vA: .38 }, { i: 'frameS', tech: 'mute', pos: ALL8, v: .18, acc: [0, 3, 6], vA: .28 }]);
        if (bar.t1 > t138 - 2.2) zBar(c, bar, [3, 3, 2], [0, 1, -2], { reg: 0, vA: .3, v: .2 });   // 提前一小节进古筝
      } else if (t < t162 - .01) {                                      // 天外音
        const done = rings.filter((r) => r <= t + .01).length;
        const nE = Math.max(1, 5 - done);                               // v5 SND5：敌方鼓每转去一层，第四转起只剩板鼓
        drums(c, bar, enemyLayers(nE));
        const kk = bE.filter((x) => x.t0 >= t138 - 1.8 && x.t0 < bar.t0).length;
        const late = t > 154;
        zBar(c, bar, late ? [3, 3, 2] : [2, 3, 3], (late ? [[0, 1, 0], [1, 2, 1], [2, 1, 0], [1, 0, 2]] : [[0, 1, 0], [1, 2, 3], [2, 3, 2], [3, 2, 4]])[kk % 4], { reg: late ? 5 : 0, vA: late ? .42 : .34, v: late ? .27 : .22, stab: !late, stabV: .3 });
      } else {                                                          // 1-12 准备：剑气在眉心前，只留低脉冲＋高音
        drums(c, bar, [{ i: 'bd', pos: [0, 4], v: .34 }, { i: 'frameS', tech: 'mute', pos: ALL8, v: .13, cres: .6 }]);
        for (const p of [0, 2, 4, 6]) if (p < bar.len * 2) { const tt = c.t(bar.b0 + p / 2); if (free(tt)) stab(tt, 40, .3); }
      }
    }
    /* 十转：手铃/越南筝击发＋长笛长音（音高逐转上行，后四转在顶端交替并加高八度长笛） */
    const ringP = [76, 79, 81, 83, 86, 88, 86, 88, 86, 88];
    rings.forEach((tt, j) => {
      const m = ringP[j], d = Math.max(3.5, t162 + 1 - tt);
      if (m <= 88) chime(tt, m, .22 + .03 * j, { d: 1.8, rel: 1.2, send: .55, pan: j % 2 ? .3 : -.2 });   // v5 SND5：手铃逐转渐强加倍
      if (m <= 84) S.dan(tt + .005, m, .22 + .01 * j, { exact: true, d: 1.2, rel: .6, send: .5 });
      flute(tt + .02, j >= 6 ? m + 5 : m, d, .1 + .016 * j, { att: .3, rel: 1.6, lp: 12000, send: .6, pan: .25 });   // v5 SND5：长笛逐转渐强加倍
      // 余慈句：每转多一音（转向句：上行到转音再回落一级）
      const n = 2 + Math.floor(j / 2), gap = (rings[j + 1] || 157.2) - tt, stepB = gap >= 1.2 ? .5 : .25, off = gap >= 1.2 ? 1 : .5;   // v5 对点 A：转距压到 1.0s 以下后余慈句改十六分、贴着转音起
      for (let q = 0; q < n; q++) {
        const tq = c.t(c.b(tt) + off + q * stepB);
        if (tq >= (rings[j + 1] || 157.2) - .05) break;
        Z(tq, LADE(5 + q + Math.floor(j / 3)), .22 + .02 * q + .04 * j, { d: .5, send: .32, pan: -.2 });   // v5 SND5：余慈句随转渐强
      }
      S.mark(tt, '对点 A 天外音第' + (j + 1) + '转');
    });
    BIGR.forEach((j, n) => { P('luo', rings[j], .28 + .04 * n, { tech: 'small', exact: true, d: 2.5, rel: 1.2 }); P('tomL', rings[j] + .006, .3 + .05 * n, { tech: 'm', exact: true, lp: 900 });   // v5 对点 A：第 3/6/9 转血焰大剥落＝小锣＋捂音堂鼓（一次重过一次）
      [.12, .24, .4, .58].forEach((dt, k) => P(k % 2 ? 'slit' : 'bang', rings[j] + dt, .16 - .025 * k, { tech: k % 2 ? 'lo' : 'main', exact: true, pan: .3 })); });   // 落灰＝梆子碎点渐稀
    P('luo', rings[9], .3, { tech: 'small', d: 2.5, rel: 1.2 });                                        // v5 SND5：第十转小锣弱奏
    S.pad('bowed', rings[0], t162 + .4, [64, 71], .14, { fi: 2, fo: .3, genv: [[rings[0], .3], [rings[5], 1.2], [rings[9], 2.8], [t162, 2.8]] });   // v5 SND5：小提琴组 E4/B4 长音随十转渐强（约 +7 dB）
    S.pad('cello', rings[0], t162 + .4, [40], .16, { fi: 2, fo: .3, genv: [[rings[0], .5], [rings[9], 1.8], [t162, 2]] });
    [[154.5, .48], [156.0, .36], [157.5, .24]].forEach(([x, v]) => { const tt = qz(c, x); S.mark(tt, '对点 A 手刀一竭'); P('tomL', tt, v, { tech: 'm' }); P('bd', tt, v * .8); stab(tt, 45, v * .8, { d: .35 }); });
    [[158.0, 71], [159.4, 74], [161.6, 79], [162.4, 83], [163.2, 84]].forEach(([x, m], j) => S.dan(qz(c, x), m, .2 + .03 * j, { exact: true, d: 1.6, rel: .8, send: .45, vib: { f: 6 + j, c: 20 + 6 * j, at: .1, ramp: .4 } }));   // 剑气凝：越南筝逐级上行、揉弦渐急；v5：160.6 一级落在画面删段 159.8–160.8 里，撤掉（五级）
    bowed(qz(c, 158), 76, t162 + 3.4 - 158, .1, { att: 2.5, rel: .05, lp: 9000, swell: [.7, 1.2, 1.7] });
    flute(qz(c, 159), 83, t162 + 2.4 - 159, .07, { att: 2.5, rel: .05, lp: 10000, swell: [.6, 1.1, 1.6] });
    S.inhale(h04, .5, { d: 1.6, lp: 9000 });
    bell(h04, 88, .56, { d: 2.5, send: .5 }); bell(h04 + .01, 95, .27, { d: 2, send: .55 });          // v5 SND9：降约 1.5 dB
    qing(h04, .72, 72); P('nao', h04 + .004, .45, { tech: 'short', exact: true }); chime(h04, 88, .36, { d: 2 });
    S.gliss(h04 + .02, .38, 84, 64, .44, { inst: 'dan', key: 67, mode: 'gong', curve: 1.2, v1: .3 });
    const b165 = Math.round(c.b(h04));
    S.kill(h04 + .42, c.t(b165 + 2) - .01);                                              // 骤静一拍
    S.mark(h04, 'H04 一剑勾销（琉璃碎）');
    /* 1-12 后果：骤静一拍后低音脉冲续（不收束、不宣告胜利）——每拍大鼓弱＋低弦短弓，板鼓八分极轻 */
    for (let b = b165 + 2; c.t(b) < T('act1.2-01') - .01; b++) {
      const tt = c.t(b), k = b - b165 - 2;
      P('bd', tt, k % 4 === 0 ? .34 : .24, { lp: 900 }); stab(tt, k % 4 === 2 ? 43 : 40, k % 4 === 0 ? .34 : .26);
      P('frameS', c.t(b + .5), .12, { tech: 'mute' });
    }
  }

  /* ---------------- 0–24：冷开场（水滴＋埙一声低音）→ 湖面散板 → 古筝分解（散板→♩60，起音 0.3–0.8） ---------------- */
  {
    const p1 = T('prologue.P-01'), p2 = T('prologue.P-02'), p3 = T('prologue.P-03');
    sec('P-01→P-03', p1, 24, '全黑水滴三声（越南筝高音＋手铃）；2.0 埙一声低音 B3（赵的影子，不成动机）；P-02 6.0 古筝散板（先疏后密再疏），湖风起；P-03 古筝分解 G 宫、一拍一音渐成 ♩60；「上清后圣」处长笛＋手铃一声高音 D6；字幕处只留单音');
    [[.6, 84, -.2], [3.3, 79, .25], [5.3, 83, -.05]].forEach(([dt, m, pan], j) => { S.dan(p1 + dt, m, .2 - .02 * j, { exact: true, d: .18, rel: .14, send: .62, pan }); chime(p1 + dt + .01, m + 4 <= 88 ? m + 4 : m, .1, { d: .5, rel: .35, send: .7, pan }); });
    xun(p1 + 2.0, 59, 3.6, .3, { att: .5, rel: 1.2, send: .5, env: [[0, .6], [1.2, 1], [3.6, 0]] });
    S.mark(p1 + 2.0, '冷开场：埙一声低音');
    [[p2 + .05, 43, .26, 3.2], [p2 + 1.3, 55, .22, 2.4], [p2 + 2.1, 62, .2, 2], [p2 + 2.6, 67, .22, 2.4], [p2 + 3.6, 59, .2, 2.6]].forEach(([tt, m, v, d]) => Z(tt, m, v, { d, send: .42, vib: d > 2.5 }));
    const seq = [[0, 43], [1, 50], [2, 55], [3, 59], [4, 62], [5, 55], [6.2, 50], [7.4, 57], [8.5, 62], [9.6, 64], [10.7, 59], [11.8, 55], [12.9, 50]];
    for (const [k, m] of seq) { const tt = p3 + .6 + k * 1.0; if (tt > 23.9) break; Z(tt, m, k === 0 ? .27 : .2 + .015 * (k % 3), { d: 2, send: .42 }); }
    flute(20.9, 86, 3.4, .1, { att: .6, rel: 1.6, lp: 9000, send: .6 }); chime(20.92, 86, .12, { d: 2, rel: 1.2, send: .7 });   // 「上清后圣」
    [11.35, 12.7, 14.05, 15.4, 16.75, 18.1].forEach((x, j) => { S.noise(x, .5, .085 + .006 * j, { f: 760, q: .7, white: .22, att: .025, rel: .4, send: .45, pan: -.6 + .09 * j }); S.mark(x, '对点 A 踏水第' + (j + 1) + '步'); });   // v5 对点 A：余慈自画外踏水走入（act-prologue STEPS，1.35s 一步）＝每步一声极轻的水声
  }

  /* ---------------- 24–54：侍立 → 对坐 → 抬眼 → 凉风（散板→♩60，起音 0.3–0.8） ---------------- */
  {
    const c0 = makeClock([[20, 60], [60, 60]], [T('prologue.P-04'), T('prologue.1-02')]);
    const p4 = T('prologue.P-04'), t101 = T('prologue.1-01'), t102 = T('prologue.1-02'), t103 = T('prologue.1-03');
    sec('S1·P-03尾→1-03', 24, 54, '湖风持续；古筝分解（G 宫，♩60）一拍一音；P-04 云霄主题只露头两音（G4 A4，长留）；1-01 古筝低回、对白处只留长音；45.2 筝刮奏一记；1-03 风声起，53.5 声场抽空');
    const t02 = T('prologue.P-02'), t03 = T('prologue.P-03');
    S.noise(t02, t103 - t02 + 2.6, .26, { f: 900, q: .6, white: .2, gust: .55, att: 1.4, rel: 1.2, send: .35, keys: [[t02, 0], [t02 + 1.6, .8], [t03, 1], [t103, .9], [t103 + 1.6, 1.6], [53.45, 1.8], [53.5, 0]] });   // 湖风：P-02 起一条不断，到 53.5 抽空
    S.pad('cello', t03 + 1.2, t103 + 1.5, [43, 50], .24, { fi: 2.5, fo: 1.5, genv: [[t03, .7], [p4, 1], [t101, .9], [t102, 1], [t103, .7]] });
    [[24.2, 55], [25.2, 62], [26.1, 64]].forEach(([tt, m]) => Z(tt, m, .24, { d: 1.6, send: .4 }));            // P-03 尾：分解
    for (let b = 0; b < 10; b++) {                                                                             // P-04：一拍一音，尾音不断
      const tt = c0.t(b), m = [55, 62, 67, 69, 62, 64, 67, 62, 59, 62][b];
      if (b === 2 || b === 3) continue;
      Z(tt, m, b % 4 === 0 ? .27 : .21, { d: 1.8, send: .42, vib: b % 4 === 0 });
    }
    Z(c0.t(2), 67, .34, { d: 1.6, vib: true, send: .4 }); Z(c0.t(3), 69, .36, { d: 4.5, vib: true, send: .42 });   // 云霄头两音（片段）
    S.theme.push({ t: +c0.t(2).toFixed(3), m: 67, d: 1, label: 'P-04 云霄片段', inst: 'zheng' }, { t: +c0.t(3).toFixed(3), m: 69, d: 4, label: 'P-04 云霄片段', inst: 'zheng' });
    [[t101 + .4, 50, 3], [t101 + 2.6, 55, 2.2], [t101 + 4.8, 52, 3.2], [t101 + 7.0, 47, 2]].forEach(([tt, m, d], j) => Z(tt, m, .27, { d, send: .36, bend: j === 2 ? 'down' : j === 1 ? 'up1' : undefined, vib: true }));   // 1-01 低回
    S.gliss(t102 + .2, .48, 55, 79, .3, { key: 67, mode: 'gong', v1: .4, curve: .9 });                        // 45.2 刮奏
    Z(t102 + .2, 43, .26, { d: 3, vib: true });
    Z(t102 + 2.6, 62, .2, { d: 2.4, send: .4 }); Z(t102 + 4.4, 64, .18, { d: 2, send: .4, bend: 'down' });
  }

  /* ---------------- 165.5–244：浮尸诡笑 → 光柱 → 第二箭 → 冰封劈拳 → 锁链 → 合印 → 念经（快打Ⅰ尾，♩132→88，起音 3–4→0.8–1.5） ---------------- */
  {
    const c = clk1, h05 = H('H05'), h06 = H('H06'), h07 = H('H07');
    const t201 = T('act1.2-01'), t202 = T('act1.2-02'), t203 = T('act1.2-03'), t204 = T('act1.2-04'), t205 = T('act1.2-05'), t205a = T('act1.2-05a'), tEnd = T('act2.2-06');
    sec('S1·2-01→2-03', t201, h05, '低音脉冲续（大鼓弱＋低弦短弓＋板鼓）；177.0 埙毒鳄首个片段（F4↘D4 两音即断）；诡笑＝小提琴组极高泛音；朽灰＝越南筝碎粒下行；2-02 光柱嗡鸣压低八度、敌方鼓 2+3+3 闷踩；符光＝古筝上行刮奏＋长笛云霄头两音（余慈延长句）；2-03 低弦渐强截断于 202.0');
    const bF = barsOf(c, H('H04'), h05);
    for (const bar of bF) {
      const t = bar.t0;
      if (t < t201 - .01) continue;                                    // 1-12 后果已写
      if (t < t202 - .01) {                                            // 2-01：低音脉冲
        drums(c, bar, [{ i: 'bd', pos: [0, 2, 4, 6], v: .26, acc: [0], vA: .34 }, { i: 'frameS', tech: 'mute', pos: ALL8, v: .15, acc: [3, 6], vA: .22 }, { i: 'tomL', tech: 'm', pos: [3, 6], v: .24 }]);
        for (const p of [0, 3, 6]) if (p < bar.len * 2) stab(c.t(bar.b0 + p / 2), p === 6 ? 43 : 40, .3);
      } else if (t < t203 - .01) {                                     // 2-02：光柱压身
        drums(c, bar, [{ i: 'bd', pos: [0, 4, 5], v: .4, acc: [0], vA: .5, lp: 600 }, { i: 'tomL', tech: 'm', pos: A233, v: .36, acc: [0], vA: .46 }, { i: 'frameS', tech: 'mute', pos: ALL8, v: .17 }]);
        for (const p of A233) if (p < bar.len * 2) stab(c.t(bar.b0 + p / 2), [40, 38, 40][A233.indexOf(p)], .34);
      } else if (t < 198.0) {                                          // 2-03 前半：弓手回望（对白），轻脉冲
        drums(c, bar, [{ i: 'frameS', tech: 'mute', pos: ALL8, v: .16, acc: [0, 3, 6], vA: .24 }, { i: 'tomL', tech: 's', pos: [0, 5], v: .28 }]);
        for (const p of [0, 3, 6]) if (p < bar.len * 2) Z(c.t(bar.b0 + p / 2), [52, 59, 57][[0, 3, 6].indexOf(p)], .2, { d: .3 });
      } else if (bar.t0 < 202.0 - .01) {                               // 2-03 后半：弓满（十六分渐强），202.0 截断
        drums(c, bar, [{ i: 'frameS', tech: 'mute', pos: ALL16, v: .15, cres: 1.4 }, { i: 'tomL', tech: 'm', pos: [0, 3, 6], v: .3, cres: .8 }]);
      }
    }
    xun(175.4, 65, .48, .5, { bend: [[0, 0], [.28, 0], [.48, -300]], rel: .06 }); xun(175.88, 62, .34, .5, { rel: .05 });   // 毒鳄首个片段：两音即断（v5 对点 A：随怨气逸出 177→175.4）
    S.mark(175.4, '对点 A 毒鳄碎片①（怨气逸出）');
    flute(175.6, 88, 2.6, .07, { att: .9, rel: 1.2, lp: 9000, vib: { f: 4.5, c: 30, at: .3, ramp: 1 }, send: .6 });   // 诡笑：极高的颤音
    [[177.7, 84], [178.3, 79], [179.0, 76], [179.6, 72], [180.3, 67]].forEach(([tt, m], j) => S.dan(qz(c, tt), m, .2 - .02 * j, { exact: true, d: .5, send: .5 }));
    P('tomH', qz(c, 183.2), .3, { tech: 'rim' });
    sub(t202 + .2, .34, { f0: 52, f1: 46, dec: 4, subD: 9 }); cello(t202 + .1, 43, 9.6, .22, { att: 1.5, rel: 1.6, lp: 1400, send: .3 });   // 光柱嗡鸣（比 1-08 低一个八度的体感）
    cello(t202 + .6, 50, 6, .16, { att: 2.4, rel: 1.8, send: .35 }); cello(t202 + .9, 52, 5.6, .14, { att: 2.4, rel: 1.8, send: .35 });                     // 暗红斑：D3/E3 大二度摩擦
    S.gliss(qz(c, 190), 1.7, 55, 84, .38, { key: 67, mode: 'gong', v1: .5, curve: .8, send: .45 });                             // 符光：上行刮奏
    flute(qz(c, 191.9), 79, 1.4, .3, { att: .2, rel: .4, send: .45 }); flute(qz(c, 193.3), 81, 3.2, .32, { att: .2, rel: 1.4, send: .45 });   // 云霄头两音（片段，延长）
    S.theme.push({ t: +qz(c, 191.9).toFixed(3), m: 79, d: 1.4, label: '2-02 符光 云霄片段', inst: 'flute' }, { t: +qz(c, 193.3).toFixed(3), m: 81, d: 3.2, label: '2-02 符光 云霄片段', inst: 'flute' });
    cello(198.0, 40, 4.0, .22, { att: 3, rel: .02, swell: [.5, 1.1, 1.8] }); cello(198.2, 47, 3.8, .2, { att: 3, rel: .02, swell: [.5, 1.1, 1.8] });
    bowed(199.0, 59, 3.0, .14, { att: 2.6, rel: .02, swell: [.5, 1.1, 1.9] });
    S.kill(201.6, 201.98);                                                                                                     // v5 SND2：截断窗前移到 201.6–201.98，命中 202.0（箭光与切点）
    S.inhale(h05, .42, { d: .56, lp: 9000 });

    sec('S1·2-04', h05, t205, '203 第二箭弦爆＋铙钹；剥落＝梆子/木鼓碎落；206 铁索（刮锣＋铙钹捂音＋堂鼓边）；207 冰裂（越南筝高音簇＋手铃）；箭在冰中颤（小提琴组颤弓）；211 劈拳＝大鼓＋锣短击，之后鼓减至单层；锁链三收');
    bowed(h05, 79, .6, .46, { sfz: true, rel: .3 }); cello(h05, 40, .9, .5, { sfz: true, rel: .4 });
    P('nao', h05 + .003, .82, { tech: 'open', exact: true }); P('bd', h05, .8, { exact: true }); P('tomL', h05 + .01, .7, { tech: 'm', exact: true });
    const bG = barsOf(c, h05, h06), bHh = barsOf(c, h06, h07);
    for (const bar of bG) {
      if (bar.k === 0) { drums(c, { ...bar, b0: bar.b0 + 1, len: bar.len - 1 }, [{ i: 'frameS', tech: 'mute', pos: ALL8, v: .17 }]); continue; }
      drums(c, bar, [{ i: 'bd', pos: [0, 5], v: .44, acc: [0], vA: .54 }, { i: 'tomL', tech: 'm', pos: A323, v: .36, acc: [0], vA: .46 }, { i: 'frameS', tech: 'mute', pos: ALL8, v: .17, acc: [0, 3, 5], vA: .25 }]);
      zBar(c, bar, [3, 2, 3], [[-2, 0, -3], [0, 1, -2], [1, 2, 0], [-2, -3, -2]][bar.k % 4], { reg: 5, vA: .34, v: .22, cut: bar.t0 > 209.5 ? 3 : undefined, choke: .22 });
    }
    [[203.6, .5], [204.1, .38], [204.5, .44], [205.0, .32], [205.6, .3]].forEach(([x, v], j) => P(j % 2 ? 'slit' : 'bang', qz(c, x), v, { tech: j % 2 ? 'lo' : 'main' }));   // 墙皮剥落
    const t206 = qz(c, 206), t207 = qz(c, 207);
    P('luo', t206, .5, { tech: 'scrape', d: 2.2, rel: 1 }); P('nao', t206, .3, { tech: 'short' }); [0, .09, .2, .28].forEach((dt, j) => P('tomH', t206 + dt, .28 - .04 * j, { tech: 'rim' }));
    S.strum(t207, [76, 79, 83, 84], .4, { inst: 'dan', spread: .03, send: .45 }); chime(t207 + .02, 86, .3, { d: 1.4 });
    trem(208.0, 210.4, 79, .08, .2, { inst: 'bowed', rate: 13, cut: true, send: .4 });
    S.inhale(h06, .28, { d: .5 });                                                                                  // v5 对点 A：210.5–210.9 劈拳预备回收＝一记短吸
    P('bd', h06, .92, { exact: true }); P('luo', h06 + .008, .68, { tech: 'main', d: .6, rel: .4, exact: true }); P('tomL', h06, .62, { tech: 'm', exact: true });
    sub(h06, .4, { f0: 75, f1: 38, dec: .5 }); stab(h06, 40, .5, { d: .3 });
    S.mark(h06, 'H06 冰封劈拳');
    const t212 = [212.1, 213.4, 214.7];                                                                   // v5 对点 A：铁索三收照画面（act1 CH_TT；原 212/214/216 量化）
    P('bd', 212.25, .42, { exact: true, lp: 380, d: .5, rel: .3 }); P('tomL', 212.256, .3, { tech: 'm', exact: true, lp: 700 }); sub(212.25, .16, { f0: 56, f1: 36, dec: .4 }); S.mark(212.25, '对点 A 铁索落身');   // v5 对点 A：四根铁索 211.8 起带分量砸下、212.25 落定一震＝一记闷击
    for (const bar of bHh) {                                           // 211 之后：鼓减至单层（堂鼓），古筝低音区八分；218 起 ♩120 转慢
      const t = bar.t0;
      if (bar.k === 0) continue;
      if (t < t205 - .01) {
        drums(c, bar, [{ i: 'tomL', tech: 'm', pos: A332, v: .34, acc: [0], vA: .44 }]);
        zBar(c, bar, [3, 3, 2], [[-3, -2, -3], [-2, 0, -2], [0, -2, -3], [-3, -3, -2]][bar.k % 4], { vA: .3, v: .19 });
      } else {                                                         // 2-05：额印将成——只留堂鼓与板鼓轻脉冲；两缕线绞合
        drums(c, bar, [{ i: 'tomL', tech: 'm', pos: [0, 4], v: .3 }, { i: 'frameS', tech: 'mute', pos: ALL8, v: .14, acc: [0, 3, 6], vA: .2 }]);
      }
    }
    t212.forEach((tt, j) => { S.mark(tt, '对点 A 铁索第' + (j + 1) + '收'); P('tomL', tt, .42 + .06 * j, { tech: 'm' }); P('nao', tt + .01, .2, { tech: 'short' }); stab(tt, [43, 45, 47][j], .34, { d: .5 }); });
    /* 两缕绞成双蛇：两条小提琴组线从两侧向中间绞合（221–223），223 合印 */
    bowed(T('act1.2-05') + 1.5, 55, 4.2, .12, { att: 1.5, rel: .1, pan: -.65, bend: [[0, 0], [1.5, 0], [4.2, 9]] });
    bowed(T('act1.2-05') + 1.5, 76, 4.2, .1, { att: 1.5, rel: .1, pan: .65, bend: [[0, 0], [1.5, 0], [4.2, -12]] });
    P('luo', h07, .26, { tech: 'main', exact: true }); P('bd', h07, .25, { exact: true }); P('tomL', h07, .22, { tech: 'm', exact: true }); P('slit', h07 + .006, .3, { tech: 'lo', exact: true });   // v5 SND2：H07 峰比铺底约高 12 dB（原 24）
    cello(h07, 40, 1.6, .2, { sfz: true, rel: .8 }); sub(h07, .08, { f0: 60, f1: 34, dec: 1.2 });
    xun(h07 + .35, 61, .7, .44, { att: .05 }); xun(h07 + 1.05, 60, .9, .4, { env: [[0, 1], [.5, .8], [.9, 0]] });   // 毒鳄碎片②（C♯4 C4）
    S.mark(h07, 'H07 双蛇合印（毒鳄碎片②）');

    sec('S1·2-05→2-05a 念经', h07, tEnd, '人声化弦群念经织体：三条单音声部（E3/D3/G3），各自以「念白」节奏（一字一八分，句末拖长）错位重复，宽声像、湿混响；2-05a 青线（越南筝上冲）被挡回（堂鼓闷击）、铁索电光（板鼓十六分 0.9s 突击）、弓手第三次引弓（低弦弱渐强）；念经逐渐收窄，243.7 收尽');
    const chant = [[1, 1, 1, 1, 2], [1, 1, 2], [1, 1, 1, 3], [1, 2, 1, 2]];   // 「念白」：八分音节，末字拖长（单位：八分）
    [[52, -.5, .15, 0], [50, .55, .13, 1.5], [55, -.15, .1, 3]].forEach(([m, pan, v, off], vi) => {
      let b = Math.round(c.b(h07)) + 1 + off / 2, ph = vi;
      const stopAt = 243.7 - (vi === 2 ? 8 : vi === 1 ? 4 : 1.2);
      while (c.t(b) < stopAt) {
        const w = chant[ph % 4];
        for (const u of w) {
          const tt = c.t(b); if (tt >= stopAt) break;
          const len = c.t(b + u / 2) - tt;
          const e = S.note(m < 53 ? 'cello' : 'bowed', tt, m, v * (u > 1 ? 1.15 : 1) * (m < 53 ? 1.5 : 1), { exact: true, d: Math.max(.16, len * .9), att: .03, rel: u > 1 ? .35 : .1, send: .6, pan, lp: 5000 });
          e.vo = 'chant' + vi;
          b += u / 2;
        }
        b += 1; ph++;                                                  // 句间换气一拍
      }
    });
    S.pad('cello', h07 + .5, 243.4, [40], .24, { fi: 1.5, fo: 1.5 });
    const g232 = qz(c, 232.6);
    S.gliss(g232, .5, 64, 84, .3, { inst: 'dan', key: 67, mode: 'gong', curve: .8 }); P('tomL', qz(c, 233.4), .5, { tech: 'm', lp: 900 }); P('bd', qz(c, 233.4), .4, { lp: 500 });
    bowed(qz(c, 233.4), 63, 1.6, .14, { att: .05, rel: .8, lp: 4000 });                                                         // 被暗红光挡回（半音外的刺）
    { const t0 = qz(c, 235.5); for (let k = 0; k < 9; k++) P('frameS', t0 + k * .1, .2 + .02 * (k % 3), { tech: 'mute' }); P('nao', t0, .18, { tech: 'short' }); }   // 电光：0.9s 突击
    cello(237.5, 40, 6.0, .16, { att: 4, rel: .2, swell: [.4, .9, 1.4] }); cello(238.0, 47, 5.5, .14, { att: 4, rel: .2, swell: [.4, .9, 1.4] });
    [[235.0, 'tomL', .3], [238.0, 'nao', .2], [240.5, 'tomL', .26]].forEach(([x, i, v]) => { P(i, x, v, { tech: i === 'nao' ? 'short' : 'm', exact: true, lp: i === 'nao' ? undefined : 900 }); S.mark(x, '对点 A 2-05a 切点'); });   // v5 对点 A：2-05a 拆三镜（235.0/238.0/240.5 硬切），切点上各吸一记（SND 第 10 条；按画面切点写，不挪刀）
    for (let b = Math.ceil(c.b(236.3)); c.t(b) < 243.4; b++) P('frameL', c.t(b), .16 + .02 * (b % 2), { tech: 'mute' });       // 心跳般的轻脉冲
    S.kill(243.7, tEnd);
  }

  /* ---------------- 244–278：暗室（♩88；毒鳄完整陈述，全片唯一一次；起音 0.8–1.5） ---------------- */
  {
    const c = clk1, t206 = T('act2.2-06'), t207 = T('act2.2-07'), t207a = T('act2.2-07a'), tE = 278;
    sec('S1·2-06→2-07a 暗室', t206, tE, '水滴（越南筝＋手铃）→ 埙毒鳄完整陈述（F4↘D4 | C♯4 – C4 – | B3 ––––）＋大提琴 D2 持续；萤光笑声＝梆子轻点；血海一闪＝低鼓＋锣弱；毒鳄尾句；字幕密，只留长音与心跳般的框鼓；2-07a 埙下行句收在 277.5，留未解决的低弦大二度');
    S.dan(t206 + .05, 84, .22, { exact: true, d: .2, rel: .15, send: .62, pan: -.15 }); chime(t206 + .06, 88, .14, { d: .5, rel: .4, send: .7 });
    S.pad('cello', t206 + .2, tE + .5, [38], .28, { fi: 1.5, fo: 1.2, genv: [[t206, .9], [t207, 1], [t207a, .9], [tE, .8]] });
    S.pad('cello', t206 + 3, t207a, [47], .14, { fi: 3, fo: 2 });
    const b0 = Math.round(c.b(t206)) + 1, bt = (k) => c.t(b0 + k);
    xun(bt(0), 65, bt(1) - bt(0), .6, { bend: [[0, 0], [(bt(1) - bt(0)) * .6, 0], [bt(1) - bt(0), -300]] });
    xun(bt(1), 62, bt(2) - bt(1), .6); xun(bt(2), 61, bt(4) - bt(2), .6); xun(bt(4), 60, bt(6) - bt(4), .58);
    xun(bt(6), 59, bt(11) - bt(6), .56, { att: .08, env: [[0, 1], [(bt(11) - bt(6)) * .6, .9], [bt(11) - bt(6), 0]], vib: { f: 4.2, c: 18, at: 1.2, ramp: 1 } });
    [[0, 65], [1, 62], [2, 61], [4, 60], [6, 59]].forEach(([k, m]) => S.theme.push({ t: +bt(k).toFixed(3), m, d: 1, label: '毒鳄动机·完整（唯一）', inst: 'xun' }));
    S.mark(bt(0), '毒鳄动机完整陈述（全片唯一）');
    [[249.9, .16], [250.6, .12], [251.15, .18], [252.0, .13], [252.4, .1]].forEach(([x, v], j) => P('bang', x, v, { tech: j % 2 ? 'hi' : 'main', lv: 0, pan: -.5 + .25 * j }));   // 萤光笑声
    for (let k = 0; c.t(b0 + 2 * k) < t207a + 9.5; k++) { const tt = c.t(b0 + 2 * k); if (tt > 253.2 && tt < 254.2) continue; P('frameL', tt, k % 2 ? .14 : .18, { tech: 'mute', lp: 2500 }); }   // 心跳：每两拍一下
    P('bd', 253.4, .5, { lp: 450 }); P('luo', 253.42, .36, { tech: 'main', lp: 1200 }); bowed(253.45, 76, 1.8, .1, { att: .05, rel: 1, lp: 7000 });   // 血海一闪
    const b1 = Math.round(c.b(255.2));
    xun(c.t(b1), 62, c.t(b1 + 1) - c.t(b1), .46); xun(c.t(b1 + 1), 61, c.t(b1 + 2) - c.t(b1 + 1), .44); xun(c.t(b1 + 2), 59, c.t(b1 + 5) - c.t(b1 + 2), .42, { env: [[0, 1], [1.2, .8], [2, 0]] });   // 毒鳄尾句
    [[258.3, .14], [258.6, .11], [259.0, .15], [259.2, .1], [259.7, .13], [260.4, .12], [261.0, .1]].forEach(([x, v], j) => P(j % 3 ? 'bang' : 'slit', x, v, { tech: j % 3 ? 'main' : 'hi', lv: 0, pan: (j % 2 ? .45 : -.4) }));   // 萤光骚动
    bowed(262, 59, 6, .08, { att: 2.5, rel: 2, lp: 6000, send: .5 });
    const b2 = Math.round(c.b(272.0));                                                                                          // 2-07a 埙下行句（五声，非毒鳄）收在 277.5
    const st = c.t(b2);
    [[64, 1], [62, 1], [59, 1.5]].reduce((tt, [m, n]) => { const d = c.t(c.b(tt) + n) - tt; xun(tt, m, d, .4); return tt + d; }, st);
    const tA = c.t(b2 + 3.5); xun(tA, 57, 277.5 - tA, .38, { bend: [[0, 0], [(277.5 - tA) * .55, 0], [277.5 - tA, -100]], env: [[0, 1], [277.5 - tA - .6, .7], [277.5 - tA, 0]] });
    cello(270.0, 50, 9, .16, { att: 3, rel: 1.5 }); cello(270.4, 52, 8.6, .14, { att: 3, rel: 1.5 });                             // 未解决的低弦大二度
  }

  /* ==================================================================================
     S2 · 746–860：会商收暗 → 水德六动作（快打Ⅲa）→ 3:2 转 ♩88 → 道韵入瞳 → 封第三层 → 执事干枯 → 鼓预示回转
     ================================================================================== */
  /* 第③期：同一张钟向前延到 680（政治段）、向后延到 926（快打Ⅲb）；824→860 段不变，860 处 3:2 转回（旧三连八分＝新八分） */
  const clk2 = makeClock(
    [[676, 96], [688, 100], [725, 112], [745, 116], [758, 120], [768, 124], [780, 128], [802, 129.4], [802, 118], [806, 132], [824, 132], [824, 88], [860, 88], [860, 132], [878, 132], [880, 136], [893, 136], [895, 144], [935, 144]],
    [T('act4.4-12'), H('H18'), H('H19'), H('H20'), T('act4.4-16a'), H('H21'), H('H22'), H('H23'), H('H24'), T('act4.5-01a'), T('act4.5-03a'), H('H29'), H('H30'), H('H31'), T('act5.5-10')]);
  S.clockInfo.s2 = { anchors: clk2.anchors, beats: clk2.anchorBeats, scale: clk2.scale.map((k) => +k.toFixed(4)), bpmBefore824: +clk2.bpm(823.9).toFixed(2), bpmAfter824: +clk2.bpm(824.1).toFixed(2), bpmBefore860: +clk2.bpm(859.9).toFixed(2), bpmAfter860: +clk2.bpm(860.1).toFixed(2) };
  for (const h of ['H21', 'H22', 'H23', 'H24', 'H25', 'H26']) guard.push(H(h));
  /* 种子 B（S2）：低弦十六分「水纹」——一小节 16 个十六分按 3+3+3+3+4 分组（重音每 3 个十六分一跳，跨小节线错位），
     三音组 [r, r−2, r+1]（下勾再上翻），四音组 [r, r−2, r+1, r+3]；D 徵阶梯（D E G A B，n=0 为 D3）。与种子 A 的「八分、组首低音、四五度上翻」在节奏单位、分组、轮廓上都不同。 */
  const SHB = { 3: [0, -2, 1], 4: [0, -2, 1, 3], 2: [0, 1], 6: [0, -2, 1, 3, 1, -2] };
  const wBar = (clk, bar, group, roots, o = {}) => {
    const out = [];
    group.forEach((g, j) => SHB[g].forEach((d, k) => out.push({ m: LADD(roots[j] + (o.reg || 0) + d), acc: k === 0 })));
    const n16 = Math.round(bar.len * 4), lim = Math.min(n16, o.cut == null ? n16 : o.cut);
    for (let k = 0; k < lim; k++) {
      const t = clk.t(bar.b0 + k / 4);
      if (!free(t)) continue;
      const x = { ...out[k % out.length] };
      while (x.m < 38) x.m += 12;                                           // 低于 D2 上移、高于 B3 下移八度（显式，不靠 lib 折叠）
      while (o.inst !== 'zheng' && x.m > 59) x.m -= 12;
      const v = (x.acc ? (o.vA || .4) : (o.v || .24)) * (o.cres ? 1 + o.cres * k / n16 : 1);
      const th = x.acc ? t : t + (J() * 2 - 1) * .004;
      if (o.inst === 'zheng') Z(th, x.m + 12, jit(v, .06), { d: .2, rel: .08 });
      else { const e = stab(th, x.m, jit(v, .06), { d: .1, rel: .05 }); e.vo = 'wave'; }
    }
    if (o.cut != null && o.choke) P('nao', clk.t(bar.b0 + lim / 4), o.choke, { tech: 'short' });
  };
  /* 余慈句（S2）：附点上行转身——♪. ♬ ♪ ♪ ♩（五声级数 r, r+1, r+2, r+4, r+3），末音延长；与 S1 的直八分不同 */
  const yuLine = (clk, b0, r, v, o = {}) => {
    const shape = [[0, .75], [1, .25], [2, .5], [4, .5], [3, o.hold || 2]];
    let b = b0;
    for (const [d, len] of shape) { const tt = clk.t(b); if (free(tt)) (o.inst === 'dan' ? S.dan : Z)(tt, LADD(r + d) + 12, v * (d === 4 ? 1.15 : 1), { exact: true, d: clk.t(b + len) - tt + .1, vib: len >= 1, send: .34, pan: o.pan == null ? -.22 : o.pan }); b += len; }
  };
  /* 敌方截断句（S2）：琵琶十六分下行五音，第五音被捂音钹截住 */
  const enemyCut = (clk, b0, r, v) => {
    for (let k = 0; k < 4; k++) { const tt = clk.t(b0 + k / 4); if (free(tt)) pipa(tt, LADD(r - k) + 12, v * (1 - .08 * k), { d: .14, rel: .03, pan: .3 }); }
    P('nao', clk.t(b0 + 1), v * .55, { tech: 'short', pan: .3 });
  };
  {
    const c = clk2, h21 = H('H21'), h22 = H('H22'), h23 = H('H23'), h24 = H('H24');
    const t416 = T('act4.4-16'), t416a = T('act4.4-16a'), t18a = T('act4.4-18a'), t18b = T('act4.4-18b'), t18c = T('act4.4-18c'), t18d = T('act4.4-18d'), t19a = T('act4.4-19a'), t19b = T('act4.4-19b'), t824 = T('act4.5-01a');
    sec('S2·4-16→4-16a', 744, t18a, '星光长音（小提琴组 B4＋大提琴 B2，编钟低音预先在 712.5，此处延续）下加轻脉冲；火苗收暗，越南筝退成长音；754 鼓进入（堂鼓两层＋大鼓），低弦水纹提前一小节进');
    // 星光长音（小提琴组 B4＋大提琴 B2）自 712.5 起由 680–746 段写入，一直搭桥到 759
    for (const bar of barsOf(c, 744, t416a)) {
      drums(c, bar, [{ i: 'frameS', tech: 'mute', pos: [1, 3, 5, 7], v: .13 }, { i: 'slit', tech: 'lo', pos: [0, 4], v: .2 }]);
    }
    [[746.4, 74, 2.6], [749.3, 71, 3.2], [752.8, 69, 4]].forEach(([tt, m, d]) => S.dan(tt, m, .2, { exact: true, d, vib: true, send: .45 }));
    P('tomL', 750.4, .44, { tech: 'm', exact: true, lp: 900 }); P('slit', 750.404, .3, { tech: 'lo', exact: true });   // v5 对点 B：火苗 .15s 一齐矮下（旧 754.9）＝落拍一记
    const bars0 = barsOf(c, t416a, h21);
    for (const bar of bars0) {
      const t = bar.t0, k = bar.k;
      if (t < t18a - .05) {                                             // 754–758：鼓进入、水纹提前进
        drums(c, bar, [{ i: 'tomL', tech: 'm', pos: [0, 3, 6], v: .32 + .08 * k, acc: [0], vA: .44 }, { i: 'bd', pos: [0], v: .4 + .1 * k }, { i: 'tomH', tech: 'm', pos: k ? [5, 6, 7] : [7], v: .26 }]);
        wBar(c, bar, [3, 3, 3, 3, 4], [0, 0, 1, 0, -1], { reg: -2, vA: .3 + .06 * k, v: .18, cres: .2 });
      } else if (t < t18b - .05) {                                      // 4-18a 水鬼探路：低弦水纹＋堂鼓两层；敌方短截句
        const kk = bars0.filter((x) => x.t0 >= t18a - .05 && x.t0 < t).length;
        drums(c, bar, [{ i: 'tomL', tech: 'm', pos: kk % 2 ? [0, 3, 6, 7] : [0, 3, 6], v: .36, acc: [0], vA: .48 }, { i: 'tomH', tech: 's', pos: kk % 2 ? [1.5, 4.5] : [2, 5], v: .3, acc: [], vA: .3 }]);
        wBar(c, bar, [3, 3, 3, 3, 4], [[0, 1, 0, -1, 0], [1, 2, 1, 0, 1], [0, -1, 0, 1, 2], [2, 1, 0, -1, -2]][kk % 4], { reg: -2, vA: .36, v: .2 });
        if (kk % 2 === 1) enemyCut(c, bar.b0 + 2, 6 - kk, .44);
        if (kk === 0) P('bd', bar.t0, .5);
      } else {                                                          // 4-18b 道兵出阵：大鼓＋木鱼行进；分组改 4+4+4+4（军阵方整）；余慈附点句
        const kk = bars0.filter((x) => x.t0 >= t18b - .05 && x.t0 < t).length;
        drums(c, bar, [{ i: 'bd', pos: [0, 4], v: .5, acc: [0], vA: .6 }, { i: 'slit', tech: kk % 2 ? 'lo' : 'hi', pos: ALL8, v: .26, acc: [0, 4], vA: .38 }, { i: 'tomL', tech: 'm', pos: [6, 7], v: .34 }, { i: 'frameS', tech: 'mute', pos: [1, 3, 5, 7], v: .16 }]);
        wBar(c, bar, [4, 4, 4, 4], [[0, 1, 2, 1], [1, 2, 3, 2], [2, 1, 0, 1], [0, 0, 1, 2]][kk % 4], { reg: -2, vA: .34, v: .2 });
        if (kk === 0) yuLine(c, bar.b0 + .5, 2, .34);
        if (kk === 2) yuLine(c, bar.b0, 3, .36, { hold: 1.5 });
      }
    }
    P('bang', T('act4.4-18a') + .02, .3);                                                     // 屏风纹（被搅散又重现）
    P('nao', 762.4, .22, { tech: 'short', exact: true }); P('tomH', 762.403, .34, { tech: 'm', exact: true });   // v5 对点 B：鬼撞屏风（旧 766.9，顿 .06s＋震 4px）＝一记轻击
    S.inhale(h21, .42, { d: .38 });                                                                                 // v5 对点 B：宝珠 777.65（旧）起 .35s 冲出＝吸气渐强进击溃
    P('nao', h21, .82, { tech: 'open', exact: true }); P('bd', h21, .82, { exact: true }); P('slit', h21 + .005, .66, { tech: 'lo', exact: true }); P('tomL', h21 + .01, .6, { tech: 'm', exact: true });
    stab(h21, 38, .5, { d: .4 }); sub(h21, .32, { f0: 80, f1: 40, dec: .45 });
    S.mark(h21, 'H21 道兵击溃水鬼');

    sec('S2·4-18b后果→4-18c', h21, h22, '鬼影散半（越南筝碎点左右散开）；行进继续，分组回到 3+3+3+3+4 但升一个音区；780 凶螭蓄势：堂鼓滚＋琵琶一扫；782.3 轮指 0.6s；783.0 无声咆哮＝全频削到 40Hz 只留沸水声一拍（体感低频闷压），783＋一拍再落大鼓＋锣');
    [[774.2, 83, -.6], [774.6, 81, .55], [775.1, 84, -.3], [775.5, 79, .7], [776.2, 76, -.7]].forEach(([tt, m, pan]) => S.dan(qz(c, tt), m, .18, { exact: true, d: .4, pan, send: .5 }));
    const bars1 = barsOf(c, h21, h22);
    for (const bar of bars1) {
      const t = bar.t0, k = bar.k;
      if (k === 0) { drums(c, { ...bar, b0: bar.b0 + 1, len: bar.len - 1 }, [{ i: 'slit', tech: 'hi', pos: ALL8, v: .22 }]); continue; }
      if (t < t18c - .05) {
        drums(c, bar, [{ i: 'bd', pos: [0, 4, 6], v: .46, acc: [0], vA: .56 }, { i: 'slit', tech: 'hi', pos: ALL8, v: .24, acc: [0, 3, 6], vA: .34 }, { i: 'tomL', tech: 'm', pos: [3, 7], v: .32 }]);
        wBar(c, bar, [3, 3, 3, 3, 4], [[1, 2, 1, 0, 2], [2, 3, 2, 1, 0]][k % 2], { reg: 0, vA: .34, v: .2 });
        if (k === 2) yuLine(c, bar.b0, 4, .34, { inst: 'dan', hold: 1.5 });
      } else {                                                          // 780–783 凶螭蓄势（敌方）
        drums(c, bar, [{ i: 'tomL', tech: 's', pos: ALL16, v: .2, cres: 1.6 }, { i: 'bd', pos: [0, 4], v: .5 }]);
        wBar(c, bar, [3, 3, 3, 3, 4], [-1, -2, -1, -2, -3], { reg: -2, vA: .4, v: .26, cres: .5 });
      }
    }
    sao(t18c + .05, [50, 57, 62, 69], .58); P('nao', t18c + .05, .3, { tech: 'short' });
    lun(782.3, .6, 62, .52);
    S.muf([[h22 - .015, 20000], [h22, 40], [c.t(c.b(h22) + 1) - .03, 40], [c.t(c.b(h22) + 1), 20000]]);
    P('bd', h22, .9, { exact: true, lp: 140, mf: false }); sub(h22, .62, { f0: 55, f1: 28, dec: .55, subD: 1.4 });
    const bt22 = c.t(c.b(h22) + 1) - h22;
    S.noise(h22, 4.5, .2, { f: 1400, q: .45, white: .9, att: .004, rel: 2.5, send: .3, keys: [[h22, 0], [h22 + .008, 1.5], [h22 + bt22 - .02, 1.2], [h22 + bt22 + .3, .35], [h22 + 2.5, .2], [h22 + 4.5, 0]] });   // 沸水声（不受闷音）：削频那一拍是唯一的声音，鼓落下后退到底下
    S.events[S.events.length - 1].mf = false;
    const t783b = c.t(c.b(h22) + 1);
    P('bd', t783b, .95, { exact: true }); P('luo', t783b + .01, .74, { tech: 'main', exact: true }); P('tomL', t783b, .7, { tech: 'm', exact: true }); stab(t783b, 38, .55, { d: .5 }); stab(t783b, 45, .45, { d: .5 });
    S.mark(h22, 'H22 凶螭无声咆哮（削频一拍）');

    sec('S2·4-18c后果→4-18d', h22, h23, '军阵崩散：堂鼓高→低下行、梆子碎裂、水纹碎成断组；792 湖水定住：一切十六分骤停，只剩木鼓高音八分与小提琴组长和弦；795 旗幡卷螭＝锣降速＋古筝刮奏收拢');
    const bars2 = barsOf(c, h22, h23);
    for (const bar of bars2) {
      const t = bar.t0, k = bar.k;
      if (k === 0) continue;
      if (t < t18d - .05) {
        drums(c, bar, [{ i: 'tomH', tech: 'm', pos: [0, 1.5, 3], v: .4, acc: [0], vA: .5 }, { i: 'tomL', tech: 'm', pos: [4, 5.5, 7], v: .42 }, { i: 'bd', pos: [0], v: .5 }, { i: 'frameS', tech: 'mute', pos: ALL8, v: .17 }]);
        wBar(c, bar, [3, 3, 3, 3, 4], [[0, -1, -2, -1, -3], [-1, -2, -3, -2, -4], [0, 1, 0, -1, -2], [-2, -1, 0, 1, 0]][k % 4], { reg: -2, vA: .4, v: .22, cut: k % 2 ? 9 : 12, choke: .26 });
        [[.25, 'bang', .3], [1.25, 'bang', .26], [2.75, 'slit', .28]].forEach(([dt, i, v]) => { if (k % 2) P(i, c.t(bar.b0 + dt), v, { tech: i === 'slit' ? 'hi' : 'main' }); });
      } else {                                                          // 792–795：湖水定住
        drums(c, bar, [{ i: 'slit', tech: 'hi', pos: ALL8, v: .2, acc: [0], vA: .28 }]);
      }
    }
    bowed(t18d + .02, 62, h23 - t18d + .3, .14, { att: .6, rel: .3 }); bowed(t18d + .02, 69, h23 - t18d + .3, .12, { att: .6, rel: .3 }); bowed(t18d + .05, 76, h23 - t18d + .3, .09, { att: .8, rel: .3, lp: 9000 });
    cello(t18d + .02, 38, h23 - t18d + .2, .24, { att: .3, rel: .2 });
    P('luo', h23, .52, { tech: 'main', rate: .76, d: 4.5, rel: 2, exact: true }); P('bd', h23, .63, { exact: true }); P('tomL', h23 + .01, .45, { tech: 'm', exact: true });   // v5 SND9：降约 1.5 dB
    S.gliss(h23 - .55, .55, 84, 62, .4, { key: 67, mode: 'gong', curve: 1.3, v1: .3, send: .4 }); S.gliss(h23 - .5, .5, 43, 62, .36, { key: 67, mode: 'gong', curve: .8, v1: .42 });   // 刮奏收拢（上下两路合到 D4）；v5 SND2：命中前 .55s 起、收在命中（卷螭动作峰）
    S.mark(h23, 'H23 旗幡卷螭');

    sec('S2·4-18d后果→4-19a', h23, h24, '余慈句奏完（古筝附点句两次、第二次落 D 并延长）；行进重起；800 赵喝令「爆灵」：埙一音（毒鳄碎片）被堂鼓十六分压断；802 爆＝大鼓＋铙钹＋锣＋低弦重音');
    const bars3 = barsOf(c, h23, h24);
    for (const bar of bars3) {
      const t = bar.t0, k = bar.k;
      if (k === 0) { yuLine(c, bar.b0 + 1, 1, .36, { hold: 1 }); drums(c, { ...bar, b0: bar.b0 + 1, len: bar.len - 1 }, [{ i: 'slit', tech: 'lo', pos: [0, 2, 4], v: .24 }]); continue; }
      if (t < t19a - .05) {
        drums(c, bar, [{ i: 'bd', pos: [0, 3, 6], v: .46, acc: [0], vA: .56 }, { i: 'tomL', tech: 'm', pos: [2, 5], v: .34 }, { i: 'frameS', tech: 'mute', pos: ALL8, v: .17, acc: [0, 3, 6], vA: .26 }]);
        wBar(c, bar, [3, 3, 3, 3, 4], [1, 0, 1, 2, 0], { reg: -2, vA: .34, v: .2 });
        yuLine(c, bar.b0, 2, .38, { hold: 2.5 });                       // 第二次：落 D（r+3＝D5）并延长
      } else {
        drums(c, bar, [{ i: 'tomL', tech: 's', pos: ALL16.filter((p) => p >= 2), v: .22, cres: 1.7 }, { i: 'tomH', tech: 's', pos: [0, 1], v: .3 }]);
      }
    }
    xun(800.42, 61, .5, .5, { rel: .04 }); P('tomL', 800.92, .5, { tech: 'm' }); P('bd', 800.92, .5);   // 毒鳄碎片③：一音即被鼓压断
    S.mark(800.42, '毒鳄碎片③（被鼓压断）');
    [[800.9, .26], [801.4, .34], [801.8, .42]].forEach(([x, v]) => { P('frameL', x, v, { tech: 'mute', exact: true, lp: 1800 }); P('tomH', x + .005, v * .7, { tech: 'm', exact: true }); });   // v5 对点 B：爆灵三胀（805.4/805.9/806.3），渐强
    S.kill(h24 - .15, h24 - .02);                                                                                 // v5 对点 B：806.35 向心一缩＝吸空
    P('bd', h24, .98, { exact: true }); P('nao', h24 + .003, .85, { tech: 'open', exact: true }); P('luo', h24 + .01, .56, { tech: 'main', d: 4, rel: 2, exact: true }); P('tomL', h24, .7, { tech: 'm', exact: true });
    cello(h24, 38, 1.4, .58, { sfz: true, rel: .6 }); cello(h24, 45, 1.4, .5, { sfz: true, rel: .6 }); sub(h24, .55, { f0: 78, f1: 34, dec: .7 });
    S.mark(h24, 'H24 爆灵');

    sec('S2·4-19a后果→4-19b', h24, t824, '爆后湖纹翻动（板鼓十六分＋水纹升一个音区）；806 水宫显形：编钟 G5 单音预影；810 云霄主题第二次半句（长笛 G4 A4 D5 E5 | G5 ––，长音，字幕下只留轻脉冲）；820 起低弦把十六分改成三个八分一组（附点四分＝新 ♩88 的拍），堂鼓随之，824 3:2 转 ♩88');
    const bars4 = barsOf(c, h24, t824);
    [811.6, 812.4, 813.2, 814.0].forEach((x, j) => { P('bd', x, .42 + .03 * j, { exact: true, lp: 300, d: .4, rel: .3 }); P('tomL', x + .006, .3 + .02 * j, { tech: 'm', exact: true, lp: 700 }); S.mark(x, '对点 B 一叩'); });   // v5 对点 B：血府一步一叩（旧 816.1/816.9/817.7/818.5，每叩震 3px）＝各一记闷鼓
    const b820 = Math.round(c.b(t824)) - 9, t820 = c.t(b820);            // 820 起：六组「三个八分」（9 拍）正好收在 824
    for (const bar0 of bars4) {
      const bar = bar0.b0 + bar0.len > b820 ? { ...bar0, len: Math.max(0, b820 - bar0.b0) } : bar0;   // 跨 820 的小节截到 820
      if (!bar.len) continue;
      const t = bar.t0, k = bar.k;
      if (k === 0) { drums(c, { ...bar, b0: bar.b0 + 1, len: bar.len - 1 }, [{ i: 'frameS', tech: 'mute', pos: ALL16, v: .18 }]); continue; }
      if (t < t19b - .05) {
        drums(c, bar, [{ i: 'frameS', tech: 'mute', pos: ALL16, v: .16, acc: [0, 1.5, 3, 4.5, 6], vA: .26 }, { i: 'tomL', tech: 'm', pos: [0, 3], v: .36 }, { i: 'bd', pos: [0], v: .42 }]);
        wBar(c, bar, [3, 3, 3, 3, 4], [2, 3, 2, 1, 3], { reg: 0, vA: .36, v: .22 });
      } else {                                                          // 806–820：字幕下的轻脉冲（水纹降回低音区、减弱）
        const kk = bars4.filter((x) => x.t0 >= t19b - .05 && x.t0 < t).length;
        drums(c, bar, [{ i: 'tomL', tech: 'm', pos: kk % 2 ? [0, 3, 6] : [0, 6], v: .3, acc: [0], vA: .38 }, { i: 'slit', tech: 'lo', pos: [2, 5], v: .2 }, { i: 'frameS', tech: 'mute', pos: ALL8, v: .14 }]);
        wBar(c, bar, [3, 3, 3, 3, 4], [[0, 1, 0, -1, 0], [-1, 0, 1, 0, -1], [0, -1, -2, -1, 0], [1, 0, -1, 0, 1]][kk % 4], { reg: -2, vA: .28, v: .16 });
      }
    }
    /* 820–824：三个八分一组（附点四分），低弦与堂鼓一起，十六分退成八分——3:2 预备 */
    {
      for (let g = 0; g < 6; g++) {
        for (let e = 0; e < 3; e++) {
          const b = b820 + g * 1.5 + e * .5, tt = c.t(b);
          const ee = stab(tt, LADD([1, 0, 2, 1, 0, 1][g] + [0, -2, 1][e] - 2), e === 0 ? .44 : .22, { d: .18, rel: .07 }); ee.vo = 'hemi';
          if (e === 0) P('tomL', tt, .36 + .04 * g, { tech: 'm' }); else P('frameS', tt, .15, { tech: 'mute' });
        }
      }
      S.mark(c.t(b820), '3:2 预备：附点四分重音');
    }
    bell(T('act4.4-19b') + .3, 79, .3, { d: 3, send: .45, pan: .1 });                                                     // 编钟单音预影（水宫显形）
    { const b0 = Math.round(c.b(T('act4.M-yunxiao2'))), YA = [[67, 2], [69, 2], [74, 2], [76, 2], [79, 4]];               // 云霄主题半句（长笛，长音）
      let b = b0; for (const [m, n] of YA) { const tt = c.t(b), d = c.t(b + n) - tt; flute(tt, m, d + .2, .26, { att: .12, rel: .6, send: .45 }); S.theme.push({ t: +tt.toFixed(3), m, d: +d.toFixed(3), label: '4-19b 云霄半句', inst: 'flute' }); b += n; }
      Z(c.t(b0), 55, .24, { d: 3, vib: true }); }
    bowed(814.6, 59, 5.2, .1, { att: 2, rel: 1.4, lp: 8000 });                                                            // 血府重塑：低泛光

    /* ---- 824–860：♩88（3:2，脉动不断）：潮汐长弓、入瞳、封第三层、执事干枯、鼓预示回转 ---- */
    const t01b = T('act4.5-01b'), t01c = T('act4.5-01c'), t502 = T('act4.5-02'), t860 = T('act4.5-03a'), h25 = H('H25'), h26 = H('H26');
    sec('S2·5-01a→5-02 ♩88', t824, t860, '824 3:2：旧八分＝新三连八分，第一小节板鼓三连八分接住脉动，之后框鼓守四分；低弦潮汐长弓（每小节一涨一落）；入瞳＝手铃三点；水浪低语＝带通噪声随潮起伏；836.5 封＝大鼓闷击＋低频＋小提琴组高音嗡鸣；849 干枯＝磬＋低弦断弓；858 起四分三连（＝新 ♩132 的拍）渐强，860 回转');
    const b824 = Math.round(c.b(t824)), b860 = Math.round(c.b(t860));
    for (let k = 0; k < 6; k++) P('frameS', c.t(b824 + k / 3), k % 3 === 0 ? .26 : .17, { tech: 'mute' });               // 第一拍两拍：三连八分接住
    for (let k = 0; k < 6; k++) if (k % 3 !== 1) P('frameS', c.t(b824 + 2 + k / 3), .14, { tech: 'mute' });
    for (let b = b824 + 4; b < b860 - 3; b++) {                                                                            // 框鼓守拍（脉动不断）
      const tt = c.t(b);
      if (!free(tt) || (tt > 848.6 && tt < 849.5)) continue;
      P('frameL', tt, b % 4 === 0 ? .26 : .17, { tech: 'mute', lp: 3000 });
      if (b % 4 === 2) P('frameS', c.t(b + 2 / 3), .11, { tech: 'mute' });
    }
    for (let bar = b824; bar < b860 - 2; bar += 4) {                                                                       // 潮汐长弓：每小节一涨一落
      const tt = c.t(bar), d = c.t(bar + 4) - tt, m = [38, 38, 43, 38, 40, 38, 43, 38, 45][((bar - b824) / 4) % 9];
      if (tt > h26 - 3 && tt < h26 + .5) continue;
      cello(tt, m, d + .3, .3, { att: d * .45, rel: d * .5, swell: [.5, 1.25, .5], send: .25 });
      cello(tt + .05, m + 7 + (m === 43 ? -2 : 0), d + .3, .18, { att: d * .45, rel: d * .5, swell: [.4, 1.2, .4], send: .3 });
      S.noise(tt, d + .2, .1, { f: 900, q: .7, white: .3, att: d * .45, rel: d * .5, send: .4 });                         // 水浪低语
    }
    [[t824, 88], [t824 + 1.35, 91], [t824 + 2.7, 86]].forEach(([tt, m], j) => chime(tt + .02, Math.min(88, m), .2 - .03 * j, { d: 1.6, pan: [-.5, .5, 0][j], send: .6 }));   // 入瞳
    xun(t01b + .6, 59, 1.4, .34, { env: [[0, 1], [1, .8], [1.4, 0]] });                                                   // 赵厉声：埙一口低气（碎片，不成动机）
    P('bd', h25, .9, { exact: true, lp: 320 }); P('tomL', h25, .6, { tech: 'm', exact: true, lp: 900 }); sub(h25, .5, { f0: 62, f1: 30, dec: .8 }); P('luo', h25 + .01, .4, { tech: 'small', lp: 2000 });
    bowed(h25 + .05, 76, 2.6, .2, { att: .05, rel: 1.2, vib: { f: 7, c: 12, at: .05, ramp: .2 } }); bowed(h25 + .05, 78, 2.6, .12, { att: .05, rel: 1.2, lp: 9000 }); flute(h25 + .1, 88, 2.4, .08, { att: .1, rel: 1.2, lp: 9000 });   // 光壁嗡鸣（E5/F♯5 小二度摩擦＋高音）
    S.mark(h25, 'H25 封第三层');
    P('nao', qz(c, t01c + .2), .32, { tech: 'short' }); P('bang', qz(c, t01c + .2), .36);                                // 光壁刚罩上就裂
    cello(h26 - 2.7, 38, 2.7, .3, { att: 1.6, rel: .015, swell: [.6, 1, 1.7] }); cello(h26 - 2.5, 45, 2.5, .22, { att: 1.6, rel: .015, swell: [.6, 1, 1.7] });   // 断弓：渐强后在 849.0 一刀断
    [[846.6, .24], [847.8, .32], [848.5, .4]].forEach(([x, v]) => { P('frameL', x, v, { tech: 'mute', exact: true, lp: 1600 }); P('bang', x + .004, v * .7, { exact: true }); });   // v5 对点 B：执事三挤（851.1/852.3/853.0），一记重过一记进塌缩
    qing(h26, .85, 64, { exact: true }); P('frameL', h26, .55, { tech: 'open', exact: true }); P('slit', h26 + .004, .5, { tech: 'lo', exact: true });
    S.mark(h26, 'H26 执事干枯（磬＋断弓）');
    /* 858 起：四分三连（每个＝新 ♩132 的一拍），由 860 倒推，渐强 */
    for (let k = 4; k >= 1; k--) { const tt = c.t(b860 - k * 2 / 3); P('tomL', tt, .32 + .1 * (4 - k), { tech: 'm' }); P('tomH', tt + .01, .2 + .07 * (4 - k), { tech: 's' }); if (k <= 2) P('bd', tt, .3 + .1 * (2 - k)); }
    S.mark(c.t(b860 - 8 / 3), '鼓预示 3:2 回转');
  }

  /* ==================================================================================
     278–530：局部反击（种子 F）→ 暗室甩锅 → 无明火 → 无声之吼 → 长啸 → 中枢 → 玄黄 → 追踪（种子 H）→ 虎辇
     ================================================================================== */
  for (const h of ['H08', 'H09', 'H10', 'H12', 'H13']) guard.push(H(h));
  /* 种子 F（局部反击）：每拍后半拍的「双击」——古筝同音十六分两下落在「&」「a」，拍头留给低弦短弓；
     双击音高按拍走五声（每小节 [r, r+1, r+3, r+2] 转身），节奏单位与 A（三三二八分）、B（十六分三连组）都不同。 */
  const fBar = (clk, bar, r, o = {}) => {
    const steps = o.steps || [0, 1, 3, 2];
    for (let q = 0; q < bar.len; q++) {
      const st = steps[q % steps.length], m = LADE(r + st + (o.reg == null ? 5 : o.reg));
      if (!(o.skip && o.skip.includes(q))) for (const f of [.5, .75]) {
        const t = clk.t(bar.b0 + q + f);
        if (free(t)) Z(t + (J() * 2 - 1) * .004, m, jit(f === .5 ? (o.vA || .36) : (o.v || .26), .06), { d: .15, rel: .06 });
      }
      if (o.bass !== false) { const t = clk.t(bar.b0 + q); let bm = LADE(r + st - 5); while (bm < 38) bm += 12; if (free(t)) stab(t, bm, q === 0 ? (o.bA || .4) : (o.bV || .28)); }
    }
  };
  /* 种子 H（追踪）：古筝八分「邻音探寻」——每两拍 [r, r+1, r−1, r]，每两拍 r 移一级（dir），像顺着线头找；与 A、F 都不同 */
  const hBar = (clk, bar, r0, o = {}) => {
    for (let k = 0; k < bar.len * 2; k++) {
      const t = clk.t(bar.b0 + k / 2); if (!free(t)) continue;
      const gk = Math.round(clk.b(t) * 2), span = o.span || 4, cell = ((Math.floor(gk / 4) % span) + span) % span;   // 全局八分序号定组：跨小节连续，不在小节线重起
      const r = r0 + (o.dir == null ? 1 : o.dir) * cell, m = LADE(r + ((o.dir || 0) < 0 ? [0, -1, 1, 0] : [0, 1, -1, 0])[((gk % 4) + 4) % 4] + (o.reg == null ? 5 : o.reg));   // 下行时邻音先下后上，免得跨组成两音来回
      const g4 = ((gk % 4) + 4) % 4;
      Z(g4 ? t + (J() * 2 - 1) * .005 : t, m, jit(g4 === 0 ? (o.vA || .3) : (o.v || .21), .06), { d: .32, rel: .1, pan: o.pan });
    }
  };
  const clk3 = makeClock([[270, 132], [331.5, 132], [338, 110], [338, 72], [364, 72], [381, 84], [393, 96], [410, 108], [450, 108]],
    [T('act2.2-08'), H('H08'), H('H09'), H('H10'), T('act2.2-12'), 384.82, 386.22, 387.62, 389.12, T('act2.3-05'), H('H11'), H('H12'), T('act3.3-09')]);   // v5 对点 A：阴云四扑撞点（384.82/386.22/387.62/389.12）加锚，每两拍一扑；末扑前一对拍略放慢（末扑收紧）
  S.clockInfo.s278 = { anchors: clk3.anchors, beats: clk3.anchorBeats, scale: clk3.scale.map((k) => +k.toFixed(4)) };
  {
    const c = clk3, h08 = H('H08'), h09 = H('H09'), h10 = H('H10');
    const t208 = T('act2.2-08'), t209 = T('act2.2-09'), t210 = T('act2.2-10'), t211 = T('act2.2-11'), t211a = T('act2.2-11a'), t212 = T('act2.2-12');
    sec('278–338 局部反击', t208, t212, '种子 F：古筝后半拍同音双击＋拍头低弦短弓；孙维帧狂喜＝板鼓开音不稳碎点；令牌拨动＝梆子；门外连轰＝堂鼓捂音四下；两次对视 287/290 低弦重音；295.5 冰刀高音＋大鼓；304.4 轮指 1.0s→305.5 弦爆；309.5 远雷（锣降速）；嘶吼段堂鼓十六分连击（敌方）；318 骤静＋低弦长音（心魔）；324 墨爆；记忆流＝古筝高音下行；2-11a 锁链坠落连响，余慈句奏完整句');
    const bars = barsOf(c, t208, h08).concat(barsOf(c, h08, h09), barsOf(c, h09, h10), barsOf(c, h10, t212));
    const RF = [0, 1, -1, 2, 0, 3, 1, -2];
    for (const bar of bars) {
      const t = bar.t0, k = bars.indexOf(bar);
      if (t < t209 - .05) {                                            // 2-08：孙狂喜、拨令牌、封水道、两次对视
        drums(c, bar, [{ i: 'tomL', tech: 'm', pos: [0, 4], v: .34, acc: [0], vA: .44 }, { i: 'frameS', tech: 'mute', pos: ALL8, v: .15 }, { i: 'frameS', tech: 'open', pos: k % 2 ? [1.5, 5, 6.5] : [2.5, 3, 7], v: .2 }]);
        fBar(c, bar, RF[k % 8], { vA: .3, v: .22, bV: .24 });
      } else if (t < t210 - .05) {                                     // 2-09：意念入侵前（对白），轻脉冲
        drums(c, bar, [{ i: 'frameS', tech: 'mute', pos: ALL8, v: .16, acc: [0, 4], vA: .22 }, { i: 'tomL', tech: 's', pos: [0, 3, 6], v: .28 }]);
        fBar(c, bar, RF[k % 8], { vA: .26, v: .18, skip: [0, 2], bV: .22 });
      } else if (t < t211 - .05) {                                     // 2-10：箭泛青光→流星→崩弦；之后远雷
        drums(c, bar, [{ i: 'bd', pos: [0, 5], v: .44, acc: [0], vA: .52 }, { i: 'tomL', tech: 'm', pos: [3, 6, 7], v: .36 }, { i: 'frameS', tech: 'mute', pos: ALL16, v: .14, acc: [0, 2, 4, 6], vA: .22 }]);
        fBar(c, bar, RF[k % 8] + 1, { vA: .38, v: .27, reg: 5 });
      } else if (t < 316.7 - .05) {                                    // 2-11 嘶吼：敌方堂鼓十六分连击（v5 对点 A：骤静随闪回提前到 316.7，跨 316.7 的那一小节截在骤静前）
        const cutB = bar.t1 > 316.7 ? { ...bar, len: c.b(316.68) - bar.b0 } : bar;
        drums(c, cutB, [{ i: 'tomH', tech: 's', pos: ALL16, v: .26, acc: [0, 3, 6], vA: .4, cres: .5 }, { i: 'tomL', tech: 's', pos: [0, 1.5, 3, 4.5, 6], v: .36 }, { i: 'bd', pos: [0], v: .46 }]);
        if (cutB !== bar) drums(c, bar, [{ i: 'frameL', tech: 'mute', pos: [3], v: .2 }]);
      } else if (t < h10 - .05) {                                      // 316.7 骤静后：心魔（只留框鼓心跳＋长音）
        drums(c, bar, [{ i: 'frameL', tech: 'mute', pos: [0, 3], v: .2 }]);
      } else if (t < t211a - .05) {                                    // 墨爆后：记忆流（古筝高音下行），双击转到高音区
        drums(c, bar, [{ i: 'frameS', tech: 'mute', pos: ALL8, v: .15 }, { i: 'tomL', tech: 'm', pos: [0, 5], v: .3 }]);
        fBar(c, bar, 7 - (k % 4), { reg: 5, vA: .26, v: .19, steps: [0, -1, -2, -3], bass: false });
      } else {                                                         // 2-11a：锁链松落；余慈句奏完整句（双击收成长音）
        drums(c, bar, [{ i: 'tomL', tech: 'm', pos: [0, 3, 6], v: .34 }, { i: 'frameS', tech: 'mute', pos: ALL8, v: .15 }]);
      }
    }
    [281.2, 283.4].forEach((x) => P('bang', qz(c, x), .5));                               // 令牌拨动、光罩移走
    [285.2, 285.62, 286.0, 286.5].forEach((x, j) => P('tomL', x, .34 + .03 * j, { tech: 'm', lp: 500, send: .3 }));   // 门外连轰（捂音）
    [287.0, 290.0].forEach((x) => { const tt = qz(c, x); stab(tt, 40, .5, { d: .5 }); stab(tt, 47, .4, { d: .5 }); P('nao', tt, .26, { tech: 'short' }); });
    flute(h08, 88, 1.6, .3, { att: .01, rel: .9, lp: 12000, vib: { f: 9, c: 30, at: .02, ramp: .1 } }); bowed(h08, 76, 2.2, .3, { att: .02, rel: 1.2, vib: { f: 8, c: 34, at: .05, ramp: .2 } });   // 冰刀高音
    P('bd', h08, .78, { exact: true }); P('frameL', h08, .55, { tech: 'open', exact: true }); P('nao', h08 + .004, .5, { tech: 'short', exact: true }); sub(h08, .3, { f0: 80, f1: 40, dec: .4 });
    lun(304.4, 1.0, 76, .44);
    bowed(h09, 79, .8, .5, { sfz: true, rel: .3 }); cello(h09, 40, 1, .55, { sfz: true, rel: .5 });
    P('bd', h09, .9, { exact: true }); P('nao', h09 + .003, .8, { tech: 'open', exact: true }); P('tomL', h09 + .01, .7, { tech: 'm', exact: true }); sub(h09, .45, { f0: 85, f1: 38, dec: .5 });
    P('luo', 309.5, .5, { tech: 'main', rate: .55, d: 6, rel: 3, send: .45 });                                   // 远雷后到
    S.kill(316.7, 317.0); S.mark(316.7, '对点 A 骤静（心魔闪回起）');                                              // 骤静（v5 对点 A：318.0→316.7，随闪回整体提前，P2 第 6 条）
    cello(317.0, 36, h10 - 317.3, .28, { att: 2, rel: .2, lp: 1200 }); bowed(317.3, 59, h10 - 317.7, .08, { att: 3, rel: .2, vib: { f: 5, c: 30, at: 1, ramp: 2 } });
    [[317.05, 76], [318.2, 71], [319.5, 74]].forEach(([x, m]) => S.dan(x, m, .14, { exact: true, d: 1.4, send: .55, lp: 4000 }));   // 褪色闪回（v5 对点 A：随闪回提前；318.2 墨裂）
    P('bd', 318.8, .34, { exact: true, lp: 380, d: .5, rel: .3 }); P('frameL', 318.804, .24, { tech: 'mute', exact: true, lp: 900 }); S.mark(318.8, '对点 A 反噬墨团砸落');   // v5 对点 A：反噬一击（原 321.5）＝一记闷击
    [320.2, 320.67, 321.11, 321.52, 321.9, 322.25, 322.57, 322.87, 323.17, 323.47, 323.77].forEach((x, j) => P('frameL', x, .16 + .024 * j, { tech: 'mute', exact: true, lp: 700 + 60 * j, send: .12 }));   // v5 对点 A：镜前灌力（act2 PUMP 320.2 起，间隔 .5→.3s）＝加速的闷击，渐强
    S.kill(323.9, 323.98); S.mark(323.9, '对点 A 墨向头上一收（吸空）');                                          // v5 对点 A：323.86–323.93 墨向头上一收＝吸空，324.0 墨爆
    S.inhale(h10, .38, { d: 1.2 });
    P('luo', h10 + .006, .7, { tech: 'main', exact: true, d: 5, rel: 2.5 }); P('bd', h10, .88, { exact: true }); P('nao', h10 + .004, .5, { tech: 'open', exact: true, lp: 6000 }); sub(h10, .45, { f0: 70, f1: 34, dec: .7 });
    S.gliss(331.95, .5, 55, 79, .26, { inst: 'dan', key: 67, mode: 'gong', curve: .9, v1: .34, send: .4 });                    // v5 SND1：甩索＝越南筝上刮
    [[334.7, .5, .34], [334.95, .44, .3], [335.2, .4, .27], [336.3, .36, .24]].forEach(([x, v, vr], j) => { P('nao', x, v, { tech: 'short', exact: true, rate: 1 - .04 * j }); P('tomH', x + .004, vr, { tech: 'rim', exact: true }); S.mark(x, '对点 A 铁索第' + (j + 1) + '根松'); });   // v5 SND1＋对点 A：铁索连响改照画面松脱 334.7/334.95/335.2（三根连着松）＋336.3（肩上第四根）
    P('bd', 335.0, .5, { exact: true, lp: 900 }); sub(335.0, .22, { f0: 60, f1: 36, dec: .5 });                     // 软命中 H41：第一根 335.0 落湖
    [[335.31, .1], [335.56, .1]].forEach(([x, v]) => S.noise(x, .5, v, { f: 1300, q: .6, white: .5, att: .01, rel: .4, send: .4, pan: .2 }));   // v5 对点 A：第二、三根落水
    P('tomL', 336.85, .46, { tech: 'm', exact: true, lp: 1200 }); S.noise(336.85, .7, .15, { f: 1000, q: .55, white: .5, att: .012, rel: .55, send: .42 }); S.mark(336.85, '对点 A 第四根落水（中鼓）');   // v5 对点 A（P2 第 8 条）：第四根落水，水花大一号＝一记中鼓
    { const b0 = Math.round(c.b(t211a)) + 1; [[64, .5], [67, .5], [69, 1], [71, .5], [74, .5], [76, 2.5]].reduce((b, [m, n]) => { const tt = c.t(b); Z(tt, m, .32, { d: c.t(b + n) - tt + .1, vib: n > 1, send: .36 }); return b + n; }, b0); }   // 余慈完整句（上行落 E5）
    S.mark(h08, 'H08 冰刀'); S.mark(h09, 'H09 崩弦'); S.mark(h10, 'H10 墨爆');

    /* ---- 338–393：暗室甩锅（♩72）→ 猴戏（无旋律）→ 内境（♩84，毒鳄碎片围攻） ---- */
    const t301 = T('act2.3-01'), t302 = T('act2.3-02'), t303 = T('act2.3-03'), t304 = T('act2.3-04'), t305 = T('act2.3-05');
    sec('338–393 暗室→猴戏→内境', t212, t305, '2-12 埙下行三音落 B3（碎片，不成完整动机）＋大提琴 D2/B2；萤光点私语＝梆子极轻；3-01 埙句不重开、只延长；烟线三缕各一粒极轻磬；3-02 低弦压抑长音；3-03 远处空洞掌声（堂鼓边、大混响），无旋律；3-04 ♩84 低弦八分脉动＋埙 C♯4 C4 左右两处围攻');
    S.pad('cello', t212 + .2, t302 + .5, [38], .26, { fi: 1.5, fo: 1.5 }); S.pad('cello', t212 + 1.2, t302, [47], .13, { fi: 2, fo: 2 });
    { const b0 = Math.round(c.b(t212)) + 1, bt = (x) => c.t(b0 + x); xun(bt(0), 62, bt(1) - bt(0), .5); xun(bt(1), 61, bt(2) - bt(1), .48); xun(bt(2), 59, t301 + 6 - bt(2), .46, { env: [[0, 1], [6, .85], [t301 + 6 - bt(2), 0]], vib: { f: 4, c: 14, at: 1.5, ramp: 2 } }); S.mark(bt(0), '毒鳄碎片（2-12 下行三音）'); }
    [[339.6, .12], [340.1, .09], [342.3, .11], [343.0, .08], [346.2, .1]].forEach(([x, v], j) => P('bang', x, v, { lv: 0, tech: j % 2 ? 'hi' : 'main', pan: j % 2 ? .5 : -.45 }));
    [346.0, 352.8, 356.2].forEach((x) => { qing(x, .2, 72, { send: .6, exact: true }); S.mark(x, '对点 A 称名烟'); });   // v5 对点 A：称名烟随暗室二拆镜提前（原 351.0/356.8/360.5；360.5 原落在删段 359.8–364.0）
    xun(354.9, 57, 4.8, .3, { att: .8, rel: 1.5, env: [[0, .5], [2, 1], [4.8, 0]] });                                // 埙句延长（A3，不重开头；v5：358.6→354.9，收在删段 359.8 之前）
    for (const b of [0, 2, 4, 6]) { const tt = c.t(Math.round(c.b(t212)) + 1 + b * 2); if (tt < t301) P('frameL', tt, .14, { tech: 'mute', lp: 2500 }); }
    cello(t302, 40, t303 - t302 + 1.5, .3, { att: 1, rel: 1.5 }); cello(t302 + .2, 41, t303 - t302 + 1, .14, { att: 1.5, rel: 1.5 });   // 压抑：E2 与 F2 小二度
    [368.9, 370.1, 371.2, 372.2, 373.1, 373.9, 374.6, 375.2, 375.7, 376.2].forEach((x, j) => { const v = .12 + .18 * j / 9; S.mark(x, '对点 A 掌声第' + (j + 1) + '下'); P('tomL', x, v, { tech: 'rim', exact: true, send: .75, pan: (j % 2 ? .35 : -.3) }); P('tomH', x + .014, v * .7, { tech: 'rim', exact: true, send: .75, pan: (j % 2 ? .3 : -.35) }); });   // v5 SND1＋对点 A：远处空洞掌声＝act2 新 CLAP 十个时刻（由疏到密 1.2→.5s），力度 .12→.30
    cello(368.6, 40, 381 - 368.6, .12, { att: 1.5, rel: 1.6, send: .3 }); cello(368.8, 41, 381 - 368.8, .07, { att: 1.8, rel: 1.6, send: .3 });   // v5 SND7：E2/F2 小二度延到 381 托住掌声
    P('frameL', 382.7, .22, { tech: 'mute', exact: true, lp: 1800 }); P('frameL', 383.0, .28, { tech: 'mute', exact: true, lp: 1800 }); S.mark(383.0, '对点 A 穿印墨洇起');   // v5 SND7：两刀各一记捂音框鼓（v5 对点 A：第二记 383.2→383.0＝内境自印心洇开起）
    qing(383.7, .45, 55, { exact: true, send: .55 }); sub(383.7, .12, { f0: 48, f1: 36, dec: 1.2 }); S.mark(383.7, 'H42 入内境（低磬，软命中）');   // v5 SND7：MUSIC.md「3-04 入内境一声低磬」
    const LUNGE = [384.82, 386.22, 387.62, 389.12];                                                         // v5 对点 A：阴云四扑撞上岛沿（act2 LUNGE＋.22s 冲程）；clk3 已加锚，四撞落在拍头（P2 第 9 条拍格）
    LUNGE.forEach((x, j) => { S.inhale(x, .12 + .03 * j, { d: .22, lp: 6000 }); P('bd', x, .36 + .05 * j, { exact: true, lp: 420, d: .45, rel: .3 }); P('tomL', x + .006, .3 + .04 * j, { tech: 'm', exact: true, lp: 800 }); S.mark(x, '对点 A 阴云第' + (j + 1) + '扑'); });   // 冲 .22s 一记短吸、撞上一记闷击，一扑重过一扑
    for (const bar of barsOf(c, t304, t305)) for (let k = 0; k < bar.len * 2; k++) { const tt = c.t(bar.b0 + k / 2); if (k % 4 && LUNGE.some((x) => Math.abs(tt - x) < .05)) continue; stab(tt, k % 4 === 0 ? 40 : k % 4 === 2 ? 43 : 47, (k % 4 === 0 ? .3 : .18) * (tt >= 386 ? 1.33 : 1), { d: .25 }); }   // v5 SND7：386–393 低弦八分 +4 dB 接无明火
    S.pad('bowed', t304 + .5, t305, [57, 58], .07, { fi: 3, fo: 1.5 });
    xun(t304 + 2.0, 61, .6, .4, { pan: -.55 }); xun(t304 + 2.6, 60, .9, .38, { pan: -.55, env: [[0, 1], [.9, 0]] });
    xun(t304 + 7.2, 61, .6, .4, { pan: .55 }); xun(t304 + 7.8, 60, 1.1, .36, { pan: .55, env: [[0, 1], [1.1, 0]] });
    S.mark(t304 + 2, '毒鳄碎片（3-04 C♯4 C4 围攻）');

    /* ---- 393–440：无明火（♩96→108 渐强→410 停，空一拍）→ 无声之吼（415–418.5 只剩极低嗡）→ 情绪浪潮 → 长啸全奏 ---- */
    const h11 = H('H11'), h12 = H('H12'), t306 = T('act2.3-06'), t307 = T('act2.3-07'), t308 = T('act2.3-08'), tE = T('act3.3-09');
    sec('393–440 无明火→无声之吼→长啸', t305, tE, '低弦 G2/D3 渐强＋大鼓八分自极弱渐强、堂鼓与板鼓逐层加入；410 鼓停，空一拍（余慈笑）；410.6 起只留低持续与吸气（反向钹，不送混响）；415.0 抽空（只剩 G2 极低嗡，≤−50 dBFS）到 418.5；418.5 远处一记低闷，鼓声一圈圈由近及远；3-07 ♩108 锣降速三环、血海一闪＝埙短音；434.5 全奏（锣＋大鼓＋低弦＋铙钹）；节点六灯熄＝木鼓高音六点渐弱；439.6 收尽');
    const bF = barsOf(c, t305, h11), stop = qz(c, 410);
    S.pad('cello', t305, stop, [43, 50], .3, { fi: 2, fo: .05, send: .05, genv: [[t305, .45], [t305 + 8, .8], [stop - 3, 1.25], [stop, 1.35]] });
    for (const bar of bF) {
      if (bar.t0 >= stop - .01) continue;
      const k = (bar.t0 - t305) / (stop - t305);
      drums({ t: (b) => Math.min(stop - .03, c.t(b)) }, bar, [{ i: 'bd', pos: ALL8, v: .08 + .42 * k * k, acc: [0, 4], vA: .14 + .5 * k * k, lp: 500 + 2500 * k }].concat(k > .35 ? [{ i: 'tomL', tech: 'm', pos: [3, 6, 7], v: .16 + .3 * k }] : [], k > .65 ? [{ i: 'frameS', tech: 'mute', pos: ALL16, v: .1 + .16 * k }] : []));
      if (k > .2) for (const p of [0, 3, 6]) { const tt = c.t(bar.b0 + p / 2); if (tt < stop - .05) stab(tt, p ? 50 : 43, .2 + .25 * k, { d: .22 }); }
    }
    S.kill(stop, c.t(c.b(stop) + 1));                                                                            // 余慈笑处空一拍
    sub(c.t(c.b(stop) + 1), .14, { f0: 45, f1: 40, dec: 2.5, subD: h11 - c.t(c.b(stop) + 1) });
    S.inhale(h11, .42, { d: 2.4, lp: 8000, send: 0 });
    cello(c.t(c.b(stop) + 1), 43, h11 - c.t(c.b(stop) + 1) - .02, .2, { att: 1.5, rel: .02, send: 0, swell: [.6, 1, 1.6] });
    cello(h11, 43, T('act2.3-06') + 5.5 - h11, .16, { att: .01, rel: 2, lp: 200, send: 0, gain: .35, genv: [[h11, 1], [h11 + 2, .8], [418.5, .3], [420, 0]] });   // 只剩极低嗡
    S.mark(h11, 'H11 无声之吼（抽空）');
    sub(418.5, .36, { f0: 48, f1: 30, dec: 1.6, subD: 3 }); P('bd', 418.5, .5, { lp: 200, send: .6 });
    [[419.9, .3], [421.1, .27], [422.1, .25], [423.0, .24], [423.8, .24], [424.5, .25]].forEach(([x, v], j) => P(j % 2 ? 'tomL' : 'bd', x, v, { tech: j % 2 ? 'm' : undefined, lp: 900 + 200 * j, send: .55 - .05 * j }));   // 一圈圈由近及远
    for (const bar of barsOf(c, h11, h12)) {
      if (bar.t0 < t307 - .3) continue;
      const k = bar.k;
      drums(c, bar, [{ i: 'tomL', tech: 'm', pos: [0, 3, 6], v: .3 + .03 * k, acc: [0], vA: .42 }, { i: 'frameS', tech: 'mute', pos: ALL8, v: .15 + .01 * k }, { i: 'bd', pos: [0], v: .4 }]);
      for (const p of [0, 3, 6]) if (p < bar.len * 2) stab(c.t(bar.b0 + p / 2), [43, 47, 50][[0, 3, 6].indexOf(p)], .3);
      if (bar.t0 > t308 - .1) drums(c, bar, [{ i: 'frameS', tech: 'mute', pos: ALL16, v: .18, cres: 1.4 }]);
    }
    [[t307 + .5, .5, .95], [t307 + 2.6, .46, .85], [t307 + 4.7, .44, .74]].forEach(([x, v, r]) => P('luo', qz(c, x), v, { tech: 'main', rate: r, d: 3.5, rel: 1.8 }));   // 环扩散：锣降速
    xun(430.6, 61, .35, .46, { rel: .05 }); P('bd', 430.6, .4, { lp: 400 }); bowed(430.62, 76, 1, .1, { att: .04, rel: .6 });   // 血海一闪
    S.inhale(h12, .5, { d: 1.6, send: .1 });
    P('luo', h12 + .006, .82, { tech: 'main', exact: true, d: 4, rel: 1.2 }); P('bd', h12, .98, { exact: true }); P('nao', h12 + .004, .78, { tech: 'open', exact: true, d: 3.5, rel: 1.2 }); P('tomL', h12 + .01, .8, { tech: 'm', exact: true });
    cello(h12, 43, 2.4, .62, { sfz: true, rel: 1.2 }); cello(h12, 55, 2.4, .55, { sfz: true, rel: 1.2 }); bowed(h12, 67, 2.4, .42, { sfz: true, rel: 1.2 }); sub(h12, .6, { f0: 75, f1: 33, dec: .9 });
    [[400, 434.638], [570, 434.659], [760, 434.683], [880, 434.699], [1060, 434.725], [1282, 434.759], [1420, 434.782]].forEach(([x, tt], j) => P(j % 2 ? 'slit' : 'bang', tt, .2 - .012 * j, { tech: j % 2 ? 'lo' : 'main', exact: true, send: .3, pan: Math.max(-.6, Math.min(.6, (x - 960) / 960 * .7)) }));   // v5 对点 A：长啸冲击前沿 434.57 起自左扫向右，各崩散点被扫到时一粒碎响（act2 COLLAPSE×arrive8），声像左→右
    [435.0, 435.35, 435.7, 436.05, 436.4, 436.75].forEach((x, j) => P('slit', x, .4 - .05 * j, { tech: 'hi', send: .4, pan: -.5 + .2 * j }));   // 节点六灯熄（v5 终修 G2-6：随画面压到每 .35 s 一盏；437.3–439.5 画面删去）
    S.kill(439.6, tE);
    S.mark(h12, 'H12 长啸全奏');
  }

  /* ---------------- 440–530：中枢低鸣 → 玄黄（唯一一次）→ 追踪（种子 H）→ 投影破灭 → 云霄头句 → 虎辇 ---------------- */
  const clk4 = makeClock([[436, 108], [452, 108], [464, 112], [478, 114], [492.5, 120], [507, 120], [510, 124], [520, 124], [530, 132], [540, 132]],
    [T('act3.3-09'), T('act3.3-09a'), T('act3.3-10'), H('H13'), T('act3.3-11a'), T('act3.4-01'), T('act3.4-02'), T('act3.4-03'), T('act3.4-04')]);
  S.clockInfo.s440 = { anchors: clk4.anchors, beats: clk4.anchorBeats, scale: clk4.scale.map((k) => +k.toFixed(4)) };
  {
    const c = clk4, h13 = H('H13');
    const t309 = T('act3.3-09'), t309a = T('act3.3-09a'), t310 = T('act3.3-10'), t311 = T('act3.3-11'), t311a = T('act3.3-11a'), t401 = T('act3.4-01'), t402 = T('act3.4-02'), t403 = T('act3.4-03'), t404 = T('act3.4-04');
    sec('440–530 中枢→玄黄→追踪→虎辇', t309, t404, '3-09 新声部：大提琴 D2 每拍一弓的「低鸣」＋框鼓守拍；3-09a 452.0 剑吟＋玄黄动机 D4 A4 G4 A4 C5 D5（古筝，原样速度 0.95s/拍，全片唯一）；3-10 种子 H 古筝邻音探寻八分起；3-11 萤光惊乱＝梆子/木鼓碎点；484.0 埙 F4↘D4 被截断＋泡破（木鼓低＋大鼓＋捂音钹）；485.0 长笛云霄头两音；3-11a 追踪下行（线向湖底）；4-01 云霄头句半句（小提琴组＋古筝，停在 G5 不落）；507 鼓进；4-02 虎啸（锣）＋大鼓行进、湖底暗光（低频）；4-03 追踪句落定于 D、光圈收紧（小锣）');
    for (const bar of barsOf(c, t309, t310)) for (let q = 0; q < bar.len; q++) { const tt = c.t(bar.b0 + q); cello(tt, 38, c.t(bar.b0 + q + 1) - tt + .05, q % 4 === 0 ? .26 : .19, { att: .12, rel: .25, send: .15, swell: [.7, 1.15, .7] }); if (q % 2 === 0) P('frameL', tt, q % 4 ? .13 : .18, { tech: 'mute', lp: 2500 }); }
    sub(t309 + .1, .2, { f0: 40, f1: 37, dec: 8, subD: 11.5 });
    bowed(t309a, 76, 6.5, .2, { att: .4, rel: 2, vib: { f: 6.5, c: 22, at: .4, ramp: .8 }, send: .45 });       // 剑吟
    { let tt = t309a + .6; [[62, 1], [69, 1.5], [67, .5], [69, 1], [72, 1.5], [74, 2.5]].forEach(([m, n], j, a) => { const d = n * .95; Z(tt, m, j === 1 ? .5 : .44, { d: j === a.length - 1 ? d + 2 : undefined, vib: d > .7, send: .34 }); S.theme.push({ t: +tt.toFixed(3), m, d: +d.toFixed(3), label: '3-09a 玄黄动机（唯一）', inst: 'zheng' }); tt += d; }); S.mark(t309a + .6, '玄黄动机（唯一一次）'); }
    for (const bar of barsOf(c, t309a, t310)) for (let q = 0; q < bar.len; q += 2) P('frameL', c.t(bar.b0 + q), .14, { tech: 'mute', lp: 2500 });
    P('bd', 453.2, .46, { exact: true, lp: 360 }); sub(453.2, .2, { f0: 60, f1: 36, dec: .6 });                        // v5 对点 B：光柱 .6s easeIn 落到手上（453.2，顿 .1s＋震 10px）
    [457.4, 458.5, 459.6, 460.7].forEach((x, j) => { P('frameL', x, .26 + .04 * j, { tech: 'mute', exact: true, lp: 1800 }); S.mark(x, '对点 B 四压'); }); S.mark(453.2, '对点 B 光柱落地');   // v5 对点 B：一寸一寸四压，各一记捂音框鼓
    S.pad('cello', t309a, t310 + .5, [38, 45], .18, { fi: 1, fo: 1 });
    const bars = barsOf(c, t310, h13).concat(barsOf(c, h13, t311a), barsOf(c, t311a, t401), barsOf(c, t401, t402), barsOf(c, t402, t403), barsOf(c, t403, t404));
    for (const bar of bars) {
      const t = bar.t0, k = bars.indexOf(bar);
      if (t < t311 - .05) {                                            // 3-10：追踪起
        hBar(c, bar, 0, { vA: .3, v: .21 });
        drums(c, bar, [{ i: 'frameS', tech: 'mute', pos: ALL8, v: .13, acc: [0, 4], vA: .19 }, { i: 'tomL', tech: 'm', pos: [0], v: .26 }]);
      } else if (t < h13 - .05) {                                      // 3-11 暗室：萤光惊乱，追踪暂停
        drums(c, bar, [{ i: 'frameL', tech: 'mute', pos: [0, 4], v: .15 }]);
      } else if (t < 487.0) {                                          // 破灭后：只留长笛两音
      } else if (t < t401 - .05) {                                     // 3-11a：追踪下行（线向湖底）
        hBar(c, bar, 4, { dir: -1, vA: .28, v: .2 });
        drums(c, bar, [{ i: 'frameS', tech: 'mute', pos: ALL8, v: .13 }, { i: 'tomL', tech: 'm', pos: [0, 5], v: .26 }]);
      } else if (t < t402 - .05) {                                     // 4-01：追踪不断，云霄头句压在上面；507 鼓进
        hBar(c, bar, -1, { span: 3, vA: .24, v: .17 });
        if (bar.t0 >= 506.5) drums(c, bar, [{ i: 'bd', pos: [0, 4], v: .36, cres: .4 }, { i: 'tomL', tech: 'm', pos: [3, 6, 7], v: .3, cres: .5 }]);
        else drums(c, bar, [{ i: 'frameS', tech: 'mute', pos: ALL8, v: .13 }]);
      } else if (t < t403 - .05) {                                     // 4-02：虎辇——大鼓行进
        drums(c, bar, [{ i: 'bd', pos: [0, 2, 4, 6], v: .46, acc: [0], vA: .58 }, { i: 'tomL', tech: 'm', pos: [3, 7], v: .34 }, { i: 'frameS', tech: 'mute', pos: ALL8, v: .15 }]);
        hBar(c, bar, 1, { span: 3, vA: .27, v: .19 });
      } else {                                                         // 4-03：追踪句落定（余慈句奏完）→ 进快打Ⅱ
        drums(c, bar, [{ i: 'bd', pos: [0, 4], v: .42 }, { i: 'tomL', tech: 'm', pos: [2, 5, 7], v: .32 }, { i: 'frameS', tech: 'mute', pos: ALL8, v: .16, cres: bar.t1 > t404 - 2.2 ? 1.4 : 0 }]);
        if (bar.t0 < 523) hBar(c, bar, 3, { dir: -1, span: 3, vA: .28, v: .2 });
      }
    }
    { const r = S.rnd(311); for (let x = t311 + .3; x < h13 - .25; x += .12 + r() * .3) P(r() < .6 ? 'bang' : 'slit', x, .1 + .12 * r(), { tech: r() < .5 ? 'hi' : undefined, lv: 0, pan: (r() - .5) * 1.4 }); }   // 萤光惊乱
    bowed(t311 + 2.5, 74, h13 - t311 - 2.6, .1, { att: 1.5, rel: .05, lp: 7000 });
    xun(h13 - .7, 65, .5, .55, { bend: [[0, 0], [.3, 0], [.5, -300]] }); xun(h13 - .2, 62, .25, .55, { rel: .02 });    // 埙 F4↘D4，被截断
    S.kill(h13 - .01, h13 + .002);
    P('slit', h13 + .002, .8, { tech: 'lo', exact: true }); P('bd', h13 + .002, .7, { exact: true, lp: 900 }); P('nao', h13 + .004, .45, { tech: 'short', exact: true }); sub(h13, .4, { f0: 60, f1: 30, dec: .5 });
    S.mark(h13, 'H13 投影破灭（埙断）');
    flute(T('act3.M-yunxiao0'), 67, 1.3, .34, { att: .2, rel: .4, send: .45 }); flute(T('act3.M-yunxiao0') + 1.3, 69, 3.2, .34, { att: .2, rel: 1.6, send: .45 });
    S.theme.push({ t: T('act3.M-yunxiao0'), m: 67, d: 1.3, label: '3-11 云霄头两音', inst: 'flute' }, { t: T('act3.M-yunxiao0') + 1.3, m: 69, d: 3.2, label: '3-11 云霄头两音', inst: 'flute' });
    { const b0 = Math.round(c.b(t401)) + 1, YA = [[67, 2], [69, 2], [74, 2], [76, 2], [79, 5]]; let b = b0;
      for (const [m, n] of YA) { const tt = c.t(b), d = c.t(b + n) - tt; bowed(tt, m, d + .2, .2, { att: .15, rel: n > 2 ? 1.6 : .2, send: .4 }); Z(tt, m, .3, { d: Math.min(d, 1.6), vib: true }); S.theme.push({ t: +tt.toFixed(3), m, d: +d.toFixed(3), label: '4-01 云霄头句（半句，停在 G5）', inst: 'bowed+zheng' }); b += n; } }
    P('luo', t402 + .3, .62, { tech: 'main', rate: 1.05, d: 5, rel: 2.5 }); bowed(t402 + .3, 57, 1.8, .2, { att: .05, rel: .8, bend: [[0, 0], [.4, 1], [1.8, -3]] });   // 虎啸
    sub(515.0, .3, { f0: 40, f1: 32, dec: 2.5, subD: 5 }); cello(514.8, 36, 4.5, .2, { att: 1.5, rel: 1.5, lp: 900 });           // 湖底暗光
    P('luo', qz(c, 521.5), .4, { tech: 'small', d: 3, rel: 1.5 }); bowed(qz(c, 521.5), 69, 2.5, .12, { att: .05, rel: 1, bend: [[0, 0], [2, 2]] });
    { const b0 = Math.round(c.b(523.2)); [[71, .5], [69, .5], [67, .5], [64, .5], [62, 3]].reduce((b, [m, n]) => { const tt = c.t(b); Z(tt, m, .32, { d: c.t(b + n) - tt + .1, vib: n > 1 }); return b + n; }, b0); }   // 追踪句落定于 D4
  }

  /* ==================================================================================
     530–680：快打Ⅱ（种子 C「跑马」）→ 血府幻境 → 归降
     ================================================================================== */
  for (const h of ['H14', 'H15', 'H16', 'H17', 'H18', 'H19', 'H20']) guard.push(H(h));
  const LADA = (n) => { const s = [0, 2, 5, 7, 10], o = Math.floor(n / 5), i = ((n % 5) + 5) % 5; return 45 + 12 * o + s[i]; };   // A 商阶梯，n=0 为 A2
  /* 种子 C（快打Ⅱ）：「跑马」——每拍 ♪♬（八分＋两个十六分，长短短），堂鼓（八分低、十六分高）与古筝同奏；组音 [r, r+2, r+1]（A 商阶梯），每拍换根；
     与 A（三三二八分）、B（十六分三连组）、F（后半拍双击）、H（邻音八分）在节奏单位上都不同。 */
  let lastC = null;
  const cBar = (clk, bar, roots, o = {}) => {
    for (let q = 0; q < bar.len; q++) {
      const r = roots[q % roots.length] + (o.reg == null ? 6 : o.reg);
      [[0, 0, o.vA || .4], [.5, 2, o.v || .28], [.75, 1, o.v2 || .25]].forEach(([f, d, v], j) => {
        const t = clk.t(bar.b0 + q + f); if (!free(t)) return;
        const tt = j ? t + (J() * 2 - 1) * .004 : t;
        if (o.zheng !== false) {
          let m = LADA(r + d);
          if ((lastC === 57 && m === 62) || (lastC === 62 && m === 57)) m = m === 62 ? 64 : 55;   // 不让 A3、D4 相邻
          lastC = m;
          Z(tt, m, jit(v, .06), { d: .2, rel: .07 });
        }
        if (o.tom !== false) P(j ? 'tomH' : 'tomL', tt, (o.tv || .32) * (j ? .78 : 1.15), { tech: o.stick ? 's' : 'm' });
      });
      if (o.bass !== false && q % 2 === 0) { const t = clk.t(bar.b0 + q); if (free(t)) stab(t, LADA(r - 5), q ? .3 : .4, { d: .32 }); }
    }
  };
  const clk5 = makeClock([[526, 132], [600, 132], [602, 120], [620, 100], [620, 96], [636, 96], [648, 84], [666, 72], [690, 72]],
    [T('act3.4-04'), H('H14'), H('H15'), H('H16'), T('act3.4-08'), T('act3.4-09'), H('H17'), T('act3.4-11'), T('act3.4-11a'), T('act4.4-12')]);
  S.clockInfo.s530 = { anchors: clk5.anchors, beats: clk5.anchorBeats, scale: clk5.scale.map((k) => +k.toFixed(4)) };
  {
    const c = clk5, h14 = H('H14'), h15 = H('H15'), h16 = H('H16'), h17 = H('H17');
    const t404 = T('act3.4-04'), t405 = T('act3.4-05'), t406 = T('act3.4-06'), t406a = T('act3.4-06a'), t407 = T('act3.4-07'), t408 = T('act3.4-08'), t409 = T('act3.4-09'), t410 = T('act3.4-10'), t411 = T('act3.4-11'), t411a = T('act3.4-11a'), tE = T('act4.4-12');
    sec('530–620 快打Ⅱ', t404, t409, '种子 C「跑马」：堂鼓长短短＋古筝同奏、A 商阶梯每拍换根；530 咒门＝锣＋埙 C♯4 C4 碎片；妖风＝噪声＋琵琶一扫；538 吞＝大鼓闷击＋全体停半拍；539.2 透亮＝编钟高音一粒；4-05 堂鼓分层连击＋低弦短弓，传讯字幕处古筝退出只留鼓；4-06 梆子随墨点由疏到密；579 撑爆＝锣＋钹＋大鼓，之后鼓留两层；587 轮指 0.8s→588 一记锣（本段最重）；593.8 起越南筝余慈句延长；4-08 ♩120→100 鼓减为单层、低弦拖弓');
    const bars = [];
    for (const [x, y] of [[t404, h14], [h14, h15], [h15, h16], [h16, t408], [t408, t409]]) bars.push(...barsOf(c, x, y));
    const RC = [[0, 1, 2, 1], [1, 2, 3, 2], [2, 1, 0, -1], [0, 0, 1, 2], [3, 2, 1, 0], [1, 3, 2, 0]];
    for (const bar of bars) {
      const t = bar.t0, k = bars.indexOf(bar), rc = RC[k % RC.length];
      if (t < h14 - .05) {                                              // 4-04：咒门、妖风、饕餮成形（敌方压上）
        if (t < 534) drums(c, bar, [{ i: 'bd', pos: [0, 4], v: .44 }, { i: 'frameS', tech: 'mute', pos: ALL16, v: .14, acc: [0, 2, 4, 6], vA: .2 }, { i: 'tomL', tech: 'm', pos: [3, 7], v: .3 }]);
        else cBar(c, bar, rc, { reg: 5, vA: .34, v: .24, tv: .3 });
      } else if (t < t405 - .05) {                                      // 吞后：黑一瞬→透亮→跑马站稳（余慈根基撑住）
        if (bar.k === 0) continue;
        cBar(c, bar, rc, { vA: .4, v: .28, tv: .34 });
        drums(c, bar, [{ i: 'bd', pos: [0, 4], v: .44, acc: [0], vA: .54 }, { i: 'frameS', tech: 'mute', pos: [1, 3, 5, 7], v: .15 }]);
      } else if (t < t406 - .05) {                                      // 4-05：堂鼓分层连击；传讯字幕处古筝退出
        const quiet = t >= 550.6 && t < 559.4;
        cBar(c, bar, rc, { zheng: !quiet, vA: .38, v: .26, tv: .36, stick: k % 2 === 1 });
        drums(c, bar, [{ i: 'frameS', tech: 'mute', pos: ALL16, v: .15, acc: [0, 3, 6], vA: .24 }, { i: 'bd', pos: [0, 3, 6], v: .42, acc: [0], vA: .52 }].concat(k % 2 ? [{ i: 'tomH', tech: 's', pos: [6.5, 7, 7.5], v: .3 }] : []));
      } else if (t < t406a - .05) {                                     // 4-06：墨点落定，梆子由疏到密
        const kk = bars.filter((x) => x.t0 >= t406 - .05 && x.t0 < t).length;
        cBar(c, bar, rc, { reg: 5, vA: .19, v: .13, v2: .15, tv: .28, bass: kk % 2 === 0 });           // v5 SND6：跑马古筝 ×0.6，让梆子出来
        const dens = [[0], [0, 4], [0, 2, 4, 6], [0, 1, 2, 4, 5, 6], ALL8, ALL8.concat([1.5, 3.5, 5.5, 7.5]), ALL16][Math.min(6, kk)];
        drums(c, bar, (bar.t0 >= 568.6 ? [{ i: 'bang', pos: dens, v: .22 + .055 * kk, acc: [0], vA: .36 + .05 * kk }] : []).concat([{ i: 'bd', pos: [0], v: .4 + .03 * kk }]));   // v5 SND6：梆子随墨点渐强（.03k→.055k）；v5 对点 B：落点段（564–568.5）改由下面逐点写
      } else if (t < h15 - .05) {                                       // 576–579：龙长嗥，蓄势
        drums(c, bar, [{ i: 'tomL', tech: 'm', pos: ALL16, v: .2, cres: 1.6 }, { i: 'bd', pos: [0, 4], v: .46, cres: .5 }]);
        cBar(c, bar, rc, { tom: false, vA: .36, v: .26 });
      } else if (t < t407 - .05) {                                      // 撑爆后：鼓留两层（大鼓＋堂鼓）
        if (bar.k === 0) continue;
        cBar(c, bar, rc, { vA: .38, v: .27, tv: .34 });
        drums(c, bar, [{ i: 'bd', pos: [0, 4], v: .46 }]);
      } else if (t < h16 - .05) {                                       // 584–588：流星坠（准备），轮指在 587
        drums(c, bar, [{ i: 'frameS', tech: 'mute', pos: ALL16, v: .2, cres: 2 }, { i: 'tomL', tech: 'm', pos: [0, 4], v: .32 }]);   // v5 SND3：板鼓 v .16 cres 1.2→v .2 cres 2
      } else if (t < t408 - .05) {                                      // 588 后：对折、幡裂；593.8 余慈句延长（越南筝），跑马退到低音区
        if (bar.k === 0) continue;
        cBar(c, bar, rc, { reg: 3, vA: .34, v: .24, tv: .32, zheng: t < 593.4 });
        drums(c, bar, [{ i: 'bd', pos: [0, 4], v: .44 }, { i: 'frameS', tech: 'mute', pos: [2, 6], v: .16 }]);
      } else {                                                          // 4-08：鼓减为单层，低弦拖弓
        drums(c, bar, [{ i: 'tomL', tech: 'm', pos: ALL8, v: .26, acc: [0, 3, 6], vA: .34 }]);
      }
    }
    P('luo', t404 + .02, .6, { tech: 'main', d: 5, rel: 2.5 }); xun(t404 + .35, 61, .5, .48, { pan: -.3 }); xun(t404 + .85, 60, .8, .44, { pan: -.3, env: [[0, 1], [.8, 0]] });
    S.mark(t404 + .35, '毒鳄碎片（咒门 C♯4 C4）');
    S.noise(532.0, 2.6, .2, { f: 700, q: .5, white: .3, att: .5, rel: 1.2, send: .3, fk: [[532, 400], [533.2, 1400], [534.6, 600]] }); sao(qz(c, 532.2), [57, 64, 69, 76], .5);   // 妖风
    cello(536.4, 40, h14 - 536.4 - .05, .22, { att: 1, rel: .03, swell: [.5, 1, 1.8] }); cello(536.6, 41, h14 - 536.6 - .05, .18, { att: 1, rel: .03, swell: [.5, 1, 1.8] });   // 饕餮成形
    S.inhale(h14, .4, { d: 1.5 });                                                                                  // v5 对点 B：541.0 张口起渐强（吸气）进吞
    P('bd', h14, .95, { exact: true, lp: 320 }); P('tomL', h14, .6, { tech: 'm', exact: true, lp: 800 }); sub(h14, .55, { f0: 55, f1: 30, dec: .8 });
    S.kill(h14 + .1, c.t(c.b(h14) + .5));                                                                       // 全体停半拍
    cello(c.t(c.b(h14) + .5), 38, 539.4 - c.t(c.b(h14) + .5), .16, { att: .2, rel: .1, lp: 600 });
    bell(539.4, 88, .5, { d: 3, send: .5 }); chime(539.41, 88, .2, { d: 2 });                                       // 透亮（v5 SND10：539.2→539.4，吸到切点 543.9 新秒）
    [[539.6, 79], [540.1, 83], [540.6, 86], [541.1, 88]].forEach(([x, m]) => flute(x, m, 1.6, .08, { att: .05, rel: 1, lp: 10000, send: .55 }));
    S.mark(h14, 'H14 饕餮吞天（停半拍）');
    { const t0 = 551.6; P('luo', t0, .5, { tech: 'small', exact: true, d: 3, rel: 1.5 }); P('bd', t0, .62, { exact: true }); sub(t0, .3, { f0: 70, f1: 36, dec: .6 });   // v5 SND6：金蛇雷雨轰下（新 556.1）＝小锣＋大鼓
      const b0 = Math.ceil(c.b(t0 + .05) * 4) / 4, b1 = c.b(555.5); for (let b = b0; b < b1; b += .25) { const tt = c.t(b); P('frameS', tt, .18 + .22 * (b - b0) / (b1 - b0), { tech: 'mute' }); } }   // 板鼓十六分渐强 .18→.40（到 555.5，新 560）
    [552.3, 552.7, 552.9, 554.5, 554.9, 555.1, 556.7, 557.1].forEach((x, j) => { if ([0, 3, 6].includes(j)) { P('bd', x, .56, { exact: true, lp: 420 }); P('tomL', x + .006, .44, { tech: 'm', exact: true }); sub(x, .22, { f0: 62, f1: 34, dec: .5 }); } else P('tomH', x, .3, { tech: 'm', exact: true, pan: j % 3 === 1 ? -.3 : .3 }); S.mark(x, '对点 B 雷'); });   // v5 对点 B：雷「重轻轻」三组（旧 556.8/557.2/557.4、559.0/559.4/559.6、561.2/561.6），组首重
    { let x = 564; for (let j = 0; j < 28; j++) { P('bang', x, .24 + .32 * j / 27 + (j % 3 ? 0 : .06), { exact: true, pan: (j % 2 ? .25 : -.25) + .3 }); x += j < 7 ? .3 : .12; } }   // v5 对点 B：墨点变速落点（act3 DOT_T：前 8 颗隔 .3s、后 20 颗隔 .12s；原 564.0–568.5＝旧 568.5–573.0），一点一记梆子（按画面落点、不量化），大点加重
    S.inhale(h15, .5, { d: 1.8 }); bowed(576.4, 64, h15 - 576.4, .14, { att: 1.5, rel: .02, bend: [[0, 0], [2.6, 3]] });
    P('luo', h15 + .006, .67, { tech: 'main', exact: true, d: 5, rel: 2.5 }); P('nao', h15 + .003, .72, { tech: 'open', exact: true }); P('bd', h15, .83, { exact: true }); P('tomL', h15, .54, { tech: 'm', exact: true });   // v5 SND9：降约 1.5 dB
    cello(h15, 45, 1.2, .5, { sfz: true, rel: .6 }); sub(h15, .45, { f0: 75, f1: 35, dec: .6 });
    { const tq = c.t(Math.round(c.b(580.7) * 4) / 4); P('tomL', tq, .45, { tech: 'm', exact: true }); P('nao', tq + .004, .22, { tech: 'short', exact: true }); S.cutAccents2 = (S.cutAccents2 || []).concat([{ cut0: 580.7, grid0: +tq.toFixed(3) }]); }   // v5 对点 B：585.2 硬切回小天地，切点吸一记（画面切点按 grid0 对，见 sync/D.md）
    S.mark(h15, 'H15 饕餮撑爆');
    flute(584.4, 76, 2.4, .24, { att: 1.8, rel: .1, bend: [[0, 0], [1.4, 0], [2.4, 7]] }); bowed(585, 71, 2, .2, { att: 1.5, rel: .1, bend: [[0, 0], [2, 5]] });   // 流星坠（v5 SND3：.14/.12→.24/.20）
    for (const m of [45, 52]) trem(584.6, 587.9, m, .25, .7, { inst: 'cello', rate: [8, 14], cut: true, send: .12 });                 // v5 SND3：低弦颤弓随流星下坠渐强（预备）
    lun(587.0, .8, 69, .5);
    { let x = 586.3; while (x < h16 - .1) { const k = (x - 586.3) / (h16 - .1 - 586.3); P('frameS', x, .18 + .3 * k, { tech: 'open', exact: true }); x += 1 / (10 + 12 * k); } }   // v5 对点 B：流星 590.8 起 easeIn³ 加速，板鼓滚奏收进 592.5
    S.inhale(h16, .4, { d: .9 });
    P('luo', h16 + .004, .7, { tech: 'main', exact: true, d: 6, rel: 3 }); P('bd', h16, .8, { exact: true });   // v5 SND9：流星击蝇不再与千里一吼一样响 P('nao', h16 + .002, .7, { tech: 'open', exact: true }); P('tomL', h16, .7, { tech: 'm', exact: true });
    cello(h16, 40, 1.6, .58, { sfz: true, rel: .8 }); cello(h16, 47, 1.6, .5, { sfz: true, rel: .8 }); sub(h16, .6, { f0: 80, f1: 32, dec: .9 });
    [[589.0, .4], [589.7, .36], [590.5, .3]].forEach(([x, v]) => { P('nao', qz(c, x), v, { tech: 'short' }); P('tomH', qz(c, x) + .01, v * .8, { tech: 's' }); });   // 空间对折、幡裂
    S.mark(h16, 'H16 流星击蝇（本段最重）');
    { const b0 = Math.round(c.b(593.8)); [[76, 1], [79, 1], [81, 2], [79, .5], [76, .5], [74, 1], [76, 1.5], [79, .5], [81, 3]].reduce((b, [m, n], j, arr) => { const tt = c.t(b); S.dan(tt, m, .32, { exact: true, d: c.t(b + n) - tt + .1, vib: n >= 1.5, send: .36, bend: j === arr.length - 1 ? [[0, 0], [.8, 0], [1.4, 2]] : undefined }); return b + n; }, b0); }   // 余慈句延长（转向上行）
    S.pad('cello', t408 + .2, t409 + .5, [43], .26, { fi: 1, fo: 1.2, bend: [[0, 0], [8, -1]] });
    [[t408 + .3, 50, 6], [t408 + 6.5, 47, 6], [t408 + 12.5, 45, 5.5]].forEach(([x, m, d]) => cello(x, m, d, .22, { att: 1.2, rel: 1.2, bend: [[0, 0], [d * .6, 0], [d, -1.5]] }));   // 低弦拖弓
    bowed(t408 + 4, 69, 6, .08, { att: 2.5, rel: 2 });
    P('bd', 606.5, .8, { exact: true, lp: 400 }); P('luo', 606.505, .42, { tech: 'small', exact: true, d: 2.5, rel: 1.2 }); P('tomL', 606.51, .45, { tech: 'm', exact: true, lp: 900 }); sub(606.5, .32, { f0: 58, f1: 32, dec: .7 });   // v5 SND1：血浪罩身（软命中 H44）＝大鼓闷击＋小锣；v5 对点 B：4-08 压缩后罩身在旧 611.0（原 613.2）
    S.mark(606.5, 'H44 血浪罩身（软命中）');
    S.inhale(607.7, .34, { d: 1.0 }); P('tomL', 607.7, .5, { tech: 'm', exact: true }); P('tomH', 607.71, .3, { tech: 's', exact: true });   // v5 SND1：挣脱＝反向钹收进堂鼓；v5 对点 B：一挣在旧 612.2（原 614.6）

    sec('620–680 血府幻境→归降', t409, tE, '4-09 ♩96 古筝极慢高音（泛音般，手铃同发）、花开花谢四次各一粒磬、声像左右对调；4-10 绿火（低弦颤弓渐强）→641.0 尖啸被闷住（大鼓闷击＋低频，整体闷到 300Hz 一瞬）→只剩低弦；4-11 ♩84 古琴般的古筝独句（低音区、上下滑音）；摩顶处小提琴组长音；4-11a ♩72 喘息，679.5 低弦收弓');
    S.pad('cello', t409 + .3, t410 + 1, [43, 50], .16, { fi: 2, fo: 2 });
    for (const bar of barsOf(c, t409, h17)) {
      if (bar.t0 >= t410 - .05) break;
      for (let q = 0; q < bar.len; q += 2) {
        const tt = c.t(bar.b0 + q), pan = tt < 628.4 ? -.42 : tt < 631.0 ? .42 : tt < 633.4 ? -.42 : .42, m = [74, 79, 76, 81, 79, 74][(bar.k * 2 + q / 2) % 6];   // v5 SND1：换声像随荷翻
        Z(tt, m, .2, { d: 2.4, send: .55, pan }); chime(tt + .01, m + 12 <= 88 ? m + 12 : m, .07, { d: 1, rel: .8, send: .6, pan });
      }
    }
    [626.4, 628.4, 631.0, 633.4].forEach((x, j) => qing(x, .3 - .03 * j, 67, { exact: true, pan: j % 2 ? .4 : -.4 }));   // v5 SND1：四粒磬对荷翻（新 630.9/632.9/635.5/637.9），不再量化
    for (const m of [40, 47]) trem(638.2, h17 - .05, m, .2, .6, { inst: 'cello', rate: [7, 13], cut: true, send: .1 });   // v5 SND3：青火颤弓 .1→.38 改 .2→.6
    bowed(639.0, 64, h17 - 639.05, .16, { att: 1.8, rel: .03, swell: [.4, 1, 2.2] }); bowed(639.2, 65, h17 - 639.25, .1, { att: 1.8, rel: .03, swell: [.4, 1, 2.2] });   // 绿火逼近：小提琴组小二度渐强，645.5 一并闷住
    S.kill(h17 - .12, h17 - .02);                                                                                   // v5 对点 B：尖啸前 .1s 吸空（身缩、心火缩）
    S.muf([[h17 - .01, 20000], [h17, 300], [h17 + .7, 300], [h17 + 1.2, 20000]]);
    P('bd', h17, .95, { exact: true, lp: 260 }); sub(h17, .6, { f0: 58, f1: 30, dec: .9 }); P('tomL', h17, .55, { tech: 'm', exact: true, lp: 500 });
    bowed(h17, 79, .9, .3, { att: .02, rel: .3 });                                                                   // 尖啸（被闷）
    S.mark(h17, 'H17 血府尖啸（被闷住）');
    cello(h17 + .9, 40, t411 - h17 - .4, .22, { att: 1, rel: 1.5 });
    [[t411 + .3, 50, 'down', 2.6], [t411 + 2.6, 55, 'pre', 2], [t411 + 4.5, 52, 'up1', 2.5], [t411 + 7.0, 47, 'down', 3]].forEach(([x, m, bd, d]) => Z(x, m, .34, { d, vib: true, bend: bd, send: .35 }));   // 古琴般独句
    S.pad('cello', t411 + .5, t411a + 1, [38], .18, { fi: 2, fo: 2 });
    P('tomL', 655.6, .34, { tech: 'm', exact: true, lp: 700 }); P('frameL', 655.604, .22, { tech: 'mute', exact: true });   // v5 对点 B：大礼拜下（旧 660.1，俯到最低即换图、顿 .1s）
    bowed(657.1, 62, 5, .16, { att: 1.5, rel: 1.8, swell: [.6, 1.1, .6] }); bowed(657.3, 69, 4.8, .1, { att: 1.5, rel: 1.8 });   // 摩顶长音（v5 SND1：对掌影按下，新 661.6）
    [[668.5, 83], [671.8, 79], [675.0, 76]].forEach(([x, m]) => S.dan(x, m, .16, { exact: true, d: 2.2, vib: true, send: .5 }));   // 红烟随风
    cello(t411a + .5, 43, 673.1 - t411a - .5, .22, { att: 2, rel: .25 }); cello(t411a + .8, 50, 673.1 - t411a - .8, .14, { att: 2, rel: .25 });   // 收弓（v5 对点 B：679.5→673.1＝旧 677.6，红烟沉完；其后 673.4–680 由剪辑删）
    { const a0 = 669.0, a1 = 673.4; let x = a0, j = 0; while (x < a1 - .05) { const k = (x - a0) / (a1 - a0); P('frameL', x, (.12 + .1 * k) * 1.7, { tech: 'mute', exact: true, lp: 2400, send: .2 }); if (j % 2) P('frameS', x, .1 + .1 * k, { tech: 'mute', exact: true }); x += 60 / (72 + 24 * k); j++; } }
    cello(670.9, 38, 2.45, .2, { att: 2, rel: .05, swell: [.4, 1, 1.8] });                                                      // 末 2.5s 低弦 D2 渐强接千里一吼   // v5 SND11：千里一吼的助跑——框鼓心跳 ♩72→96（v .12→.22）接 680 低弦脉冲
  }

  /* ---------------- 680–746：湖底府邸（♩96）→ 千里一吼（全片最响单击）→ 首告 → 封通讯 → 星光（长音一直搭桥到 759）→ 白虎施压 → 巴掌句 ---------------- */
  {
    const c = clk2, h18 = H('H18'), h19 = H('H19'), h20 = H('H20');
    const t412 = T('act4.4-12'), t413 = T('act4.4-13'), t414 = T('act4.4-14'), t417a = T('act4.4-17a'), t417 = T('act4.4-17'), t415 = T('act4.4-15'), t415a = T('act4.4-15a'), t416 = T('act4.4-16');
    sec('680–746 对质被封口', t412, t416 + 1, '4-12 ♩96 低弦脉冲＋秘府水压声（低频噪声）；685.0 全片最响单击（大鼓＋锣＋铙钹＋低弦齐奏，0.4s 截止）；4-14 ♩100 古筝轻拨（字幕密，只拨单音）；4-17a 光环收紧＝低弦上滑，水镜一面面熄＝梆子截断五下渐快；706 二吼（低闷）；712.5 星光落定＝编钟低音＋小提琴组 B4/大提琴 B2 长音（到 759）；4-15 长音下轻脉冲；725 虎啸＋大鼓＋秘阵嗡鸣上扬；♩112 轻脉冲；738 起余慈句一句比一句短（四音→三音→二音→一音，每句尾一记板鼓）');
    S.noise(t412, t414 - t412 + 1, .14, { f: 120, q: .9, att: 1, rel: 1.5, send: .2 });                          // 秘府水压声
    for (let b = Math.round(c.b(t412)); c.t(b) < t414 + 10; b++) {                                                 // 低弦脉冲（每拍）
      const tt = c.t(b); if (tt > h18 - .3 && tt < h18 + 1.0) continue;
      stab(tt, b % 4 === 0 ? 38 : 45, b % 4 === 0 ? .3 : .2, { d: .3 });
      if (b % 2 === 0 && tt > t414) P('frameL', tt, .14, { tech: 'mute', lp: 2500 });
    }
    P('bd', h18, 1.0, { exact: true }); P('luo', h18 + .004, 1.0, { tech: 'main', lv: 3, exact: true }); P('nao', h18 + .002, .9, { tech: 'open', exact: true }); P('tomL', h18, .8, { tech: 'm', exact: true });
    cello(h18, 40, .5, .7, { sfz: true, rel: .05 }); cello(h18, 47, .5, .65, { sfz: true, rel: .05 }); bowed(h18, 64, .5, .5, { sfz: true, rel: .05 }); sub(h18, .7, { f0: 85, f1: 34, dec: .5 });
    S.kill(h18 + .4, h18 + .9);                                                                                   // 0.4s 截止
    S.mark(h18, 'H18 千里一吼（全片最响单击）');
    [[689.2, 62], [691.6, 59], [694.0, 64], [696.4, 62]].forEach(([x, m]) => Z(x, m, .24, { d: 1.6, send: .4 }));   // 古筝轻拨
    cello(t417a + .4, 45, 5.5, .2, { att: 1, rel: 1, bend: [[0, 0], [1, 0], [5, 3]] }); cello(t417a + .6, 52, 5.3, .14, { att: 1, rel: 1, bend: [[0, 0], [1, 0], [5, 3]] });   // 光环收紧
    [702.0, 702.8, 703.5, 704.4].forEach((x, j) => { P('bang', x, .38 + .05 * j, { exact: true }); P('nao', x + .005, .16, { tech: 'short', exact: true }); S.mark(x, '对点 B 水镜截断'); });   // 水镜一面面熄（v5 对点 B：四面镜 .06s 截断，旧 706.5/707.3/708.0/708.9，各踩一记梆子）
    P('bd', 706.2, .55, { lp: 400 }); sub(706.2, .35, { f0: 52, f1: 32, dec: 1.2 });                            // 吼声再到
    for (let b = Math.round(c.b(706.8)); c.t(b) < h19 - .3; b++) if (b % 2 === 0) P('frameL', c.t(b), .13, { tech: 'mute', lp: 2500 });
    bell(h19, 43, .7, { d: 8, send: .45 }); bell(h19 + .01, 55, .4, { d: 6, send: .45 }); P('luo', h19 + .01, .4, { tech: 'small', d: 4, rel: 2 });   // 星光落定：编钟低音
    S.pad('bowed', h19 + .05, T('act4.4-18a') + 1, [71], .12, { fi: 1.2, fo: 1.6, seg: 9, lp: 8000, send: .5 });
    S.pad('cello', h19 + .1, T('act4.4-18a') + .5, [47], .2, { fi: 1.5, fo: 1.2, seg: 9 });
    S.mark(h19, 'H19 星光落定（长音到 759）');
    for (let b = Math.round(c.b(t415)); c.t(b) < h20 - .2; b++) { const tt = c.t(b); P('frameS', c.t(b + .5), .13, { tech: 'mute' }); if (b % 2 === 0) P('slit', tt, .18, { tech: 'lo' }); }   // 长音下轻脉冲
    P('luo', h20 + .006, .7, { tech: 'main', rate: 1.06, exact: true, d: 4, rel: 2 }); P('bd', h20, .85, { exact: true }); P('tomL', h20, .6, { tech: 'm', exact: true });
    bowed(h20, 57, 2.4, .26, { att: .05, rel: 1, bend: [[0, 0], [.3, 1], [2.4, -2]] });                          // 虎啸
    sub(h20 + .3, .3, { f0: 45, f1: 52, dec: 3, subD: 4 }); bowed(h20 + .4, 62, 4.5, .1, { att: 2, rel: 1.5, bend: [[0, 0], [4.5, 4]] }); bowed(h20 + .4, 63, 4.5, .07, { att: 2, rel: 1.5, bend: [[0, 0], [4.5, 4]] });   // 秘阵嗡鸣上扬
    S.mark(h20, 'H20 白虎长啸施压');
    for (let b = Math.round(c.b(h20)) + 2; c.t(b) < t416 - .1; b++) { const tt = c.t(b); P('frameS', tt, b % 4 === 0 ? .2 : .14, { tech: 'mute' }); P('frameS', c.t(b + .5), .11, { tech: 'mute' }); if (b % 4 === 0) P('tomL', tt, .24, { tech: 'm' }); }   // ♩112 轻脉冲
    { let b = Math.round(c.b(738.4));                                                                            // 巴掌句：一句比一句短
      for (const ph of [[71, 74, 76, 79], [74, 76, 79], [76, 79], [79]]) { ph.forEach((m, j) => Z(c.t(b + j * .5), m, .3 + .02 * j, { d: .4 })); const te = c.t(b + ph.length * .5); P('frameS', te, .42, { tech: 'open' }); P('bang', te + .004, .3); b += ph.length * .5 + (ph.length > 1 ? 1 : 0); } }
  }

  /* ==================================================================================
     860–926：快打Ⅲb（种子 D「浪涌」）——3:2 转回 ♩132 → 136 → 144
     ================================================================================== */
  for (const h of ['H27', 'H28', 'H29', 'H30', 'H31', 'H32', 'H33', 'H34']) guard.push(H(h));
  const LADG = (n) => { const s = [0, 2, 4, 7, 9], o = Math.floor(n / 5), i = ((n % 5) + 5) % 5; return 55 + 12 * o + s[i]; };   // G 宫阶梯，n=0 为 G3
  /* 种子 D（快打Ⅲb）：「浪涌」——每个浪＝浪底一记低弦短弓，接着古筝十六分沿五声一路上冲，浪头（最高音）加重并留长；
     一小节按浪长切分（4+4+4+4、6+6+4、5+5+6、8+8……），浪越长水越大。上冲句不循环，与 A/B/C/E/F/H 的单元都不同。 */
  const dBar = (clk, bar, waves, r0, o = {}) => {
    let p = 0;
    waves.forEach((W, wi) => {
      const r = r0 + (o.step || 0) * wi;
      for (let j = 0; j < W && p + j < bar.len * 4; j++) {
        const t = clk.t(bar.b0 + (p + j) / 4); if (!free(t)) continue;
        if (j === 0) { if (o.bass !== false) stab(t, LADG(r - 5), o.bA || .36, { d: .2 }); continue; }
        const top = j === W - 1, m = LADG(r + j - 1 + (o.reg || 0));
        Z(top ? t : t + (J() * 2 - 1) * .004, m, jit(top ? (o.vA || .4) : (o.v || .24) * (1 + .25 * j / W), .06), { d: top ? .45 : .14, rel: top ? .2 : .06 });
      }
      p += W;
    });
  };
  {
    const c = clk2, h27 = H('H27'), h28 = H('H28'), h29 = H('H29'), h30 = H('H30'), h31 = H('H31');
    const t03a = T('act4.5-03a'), t03b = T('act4.5-03b'), t504 = T('act4.5-04'), t05a = T('act4.5-05a'), t05b = T('act4.5-05b'), t05c = T('act4.5-05c'), tE = T('act5.5-10');
    sec('860–926 快打Ⅲb', t03a, tE, '860.0 3:2 转回 ♩132（旧三连八分＝新八分），低弦恢复八分短弓；861.0 雷拳＝大鼓＋铙钹（落在第 2 拍后的十六分上）；种子 D「浪涌」古筝十六分上冲；871.5 落空＝反向钹收在 871.5＋轮指 0.6s、无重鼓；剑气削阵盘＝梆子/木鼓四下；880.0 凿壁＝大鼓＋锣，♩136，大鼓滚＋长浪；882 长笛云霄半句（长音）；道兵驱浪＝大鼓＋木鼓行进；895 ♩144 阴阳光域＝小提琴组大二度长音；十八死士＝金属碰响一串；902.0 定＝大鼓闷击＋低音长鸣，其余停半拍；906 撕纱幕八层＝梆子逐层加快，每层截住一个短浪；912 低弦颤弓；918.5 剑吟＋断首；919 光域崩、水压；碎片下沉越南筝下行，925.5 收尽');
    const bars = [];
    for (const [x, y] of [[t03a, h29], [h29, h30], [h30, h31], [h31, tE]]) bars.push(...barsOf(c, x, y));
    const WV = [[4, 4, 4, 4], [6, 6, 4], [5, 5, 6], [4, 6, 6], [8, 8], [6, 4, 6], [5, 6, 5], [8, 4, 4]];
    for (const bar of bars) {
      const t = bar.t0, k = bars.indexOf(bar);
      const lowBows = (o) => { for (let e = 0; e < bar.len * 2; e++) { const tt = c.t(bar.b0 + e / 2); if (free(tt)) { const ge = Math.round(c.b(tt) * 2), ee = stab(tt, [38, 45, 50][((ge % 3) + 3) % 3], ge % 2 ? .2 : .3, { d: .16, rel: .06 }); ee.vo = 'bow8'; } } };
      if (t < h27 - .3) { lowBows(); P('bd', t, .5); P('tomL', t + .005, .4, { tech: 'm' }); continue; }   // 860：3:2 落地
      if (t < t03b - .05) {                                            // 5-03a：青莲开、化身出
        lowBows();
        drums(c, bar, [{ i: 'tomL', tech: 'm', pos: [0, 4], v: .36 }, { i: 'frameS', tech: 'mute', pos: ALL16, v: .13, acc: [0, 3, 6], vA: .2 }]);
        if (t > 862) dBar(c, bar, WV[k % 8], 0 + (k % 3), { bass: false, vA: .34, v: .2 });
      } else if (t < t504 - .05) {                                     // 5-03b：化雾穿人、削阵盘
        lowBows();
        drums(c, bar, [{ i: 'frameS', tech: 'mute', pos: ALL16, v: .14, acc: [0, 2, 4, 6], vA: .2 }, { i: 'tomL', tech: 's', pos: [0, 3, 6], v: .3 }]);
        if (!(t > h28 - 1.6 && t < h28 + .4)) dBar(c, bar, WV[(k + 3) % 8], 2, { bass: false, vA: .3, v: .18, reg: 3 });
      } else if (t < h29 - .05) {                                      // 878–880：凿壁前蓄势
        drums(c, bar, [{ i: 'tomL', tech: 'm', pos: ALL16, v: .2, cres: 1.6 }, { i: 'bd', pos: [0, 4], v: .5 }]);
        lowBows();
      } else if (t < t05a - .05) {                                     // 5-04：湖水灌府——长浪＋大鼓滚；道兵驱浪
        const kk = bars.filter((x) => x.t0 >= h29 - .05 && x.t0 < t).length, sub8 = t > 888.3 && t < 894.8;
        if (kk === 0) continue;
        dBar(c, bar, WV[(kk + 4) % 8], [-1, 0, 1, 0][kk % 4], { vA: sub8 ? .3 : .42, v: sub8 ? .18 : .25, bA: .4, step: 1 });
        drums(c, bar, [{ i: 'bd', pos: [0, 3, 4, 6], v: .46, acc: [0], vA: .56 }, { i: 'slit', tech: kk % 2 ? 'lo' : 'hi', pos: ALL8, v: .22 }, { i: 'tomL', tech: 'm', pos: [2, 7], v: .32 }]);
      } else if (t < h30 - .05) {                                      // 5-05a：阴阳光域、死士起
        const kk = bars.filter((x) => x.t0 >= t05a - .05 && x.t0 < t).length;
        lowBows();
        drums(c, bar, [{ i: 'tomL', tech: 's', pos: [0, 1.5, 3, 4.5, 6], v: .34, acc: [0], vA: .44 }, { i: 'frameS', tech: 'mute', pos: ALL16, v: .14 }, { i: 'bd', pos: [0], v: .46 }]);
        dBar(c, bar, [[3, 5, 3, 5], [4, 4, 4, 4]][kk % 2], 3, { bass: false, vA: .32, v: .2 });
      } else if (t < t05b - .05) {                                     // 902 定之后：受困，浪窄
        if (bar.k === 0) { drums(c, { ...bar, b0: bar.b0 + 1, len: bar.len - 1 }, [{ i: 'frameS', tech: 'mute', pos: ALL8, v: .15 }]); continue; }   // v5 对点 B：定 .42s（一拍）后复流时起
        lowBows();
        drums(c, bar, [{ i: 'frameS', tech: 'mute', pos: ALL16, v: .15, acc: [0, 3, 6], vA: .22 }, { i: 'tomL', tech: 'm', pos: [0, 5], v: .32 }]);
        dBar(c, bar, [3, 3, 3, 3, 4], 1, { bass: false, vA: .3, v: .2 });
      } else if (t < h31 - .05) {                                      // 5-05b：撕纱幕（每层截住一个短浪），912 起颤弓
        drums(c, bar, [{ i: 'frameS', tech: 'mute', pos: ALL16, v: .15 }, { i: 'tomL', tech: 'm', pos: [0, 4], v: .34 }].concat(t > 911.8 ? [{ i: 'bd', pos: [0, 2, 4, 6], v: .36 }] : []));
        if (t < 911.5) lowBows();
      } else {                                                         // 剑吟之后：崩、压、逃，碎片下沉
        if (bar.k === 0) continue;
        if (t < 921.5) drums(c, bar, [{ i: 'tomH', tech: 'm', pos: [0, 1, 2], v: .34 }, { i: 'tomL', tech: 'm', pos: [3, 4, 5, 6], v: .36 }, { i: 'bd', pos: [0, 4], v: .44 }]);
      }
    }
    for (const m of [38, 45]) trem(860.1, h27 - .1, m, .14, .5, { inst: 'cello', rate: [9, 15], cut: true, send: .1 });   // v5 对点 B：864.6–865.3 收拳蓄劲＝罡煞渐强
    S.kill(h27 - .08, h27 - .01);                                                                                 // 865.42 冲拳＝吸空
    P('bd', h27, .95, { exact: true }); P('nao', h27 + .003, .82, { tech: 'open', exact: true }); P('tomL', h27, .66, { tech: 'm', exact: true }); sub(h27, .45, { f0: 80, f1: 36, dec: .5 }); stab(h27, 38, .55, { d: .4 });
    S.mark(h27, 'H27 雷拳摧莲');
    S.inhale(h28, .5, { d: 1.3, send: .1 }); lun(h28, .6, 74, .44);                                               // 落空：反向钹收在 871.5，无重鼓
    S.mark(h28, 'H28 雷光落空');
    [874.5, 875.6, 876.6, 877.4].forEach((x, j) => { const tt = qz(c, x); P(j % 2 ? 'slit' : 'bang', tt, .5 + .05 * j, { tech: j % 2 ? 'hi' : 'main' }); P('nao', tt + .004, .2, { tech: 'short' }); });   // 剑气削阵盘
    P('bd', h29, .87, { exact: true }); P('luo', h29 + .006, .65, { tech: 'main', exact: true, d: 5, rel: 2 }); P('tomL', h29, .63, { tech: 'm', exact: true }); cello(h29, 38, 1.4, .52, { sfz: true, rel: .6 }); sub(h29, .5, { f0: 78, f1: 33, dec: .7 });   // v5 SND9：降约 1.5 dB
    P('bd', h29 + .5, .5, { tech: 'froll', d: 7.5, rel: 1.5, gain: .7 });                                          // 湖水灌入：大鼓滚
    S.mark(h29, 'H29 凿壁灌湖');
    { const b0 = Math.round(c.b(T('act4.M-flute'))); [[67, 3], [69, 3], [74, 3], [76, 3], [79, 6]].reduce((b, [m, n]) => { const tt = c.t(b), d = c.t(b + n) - tt; flute(tt, m, d + .15, .3, { att: .15, rel: n > 3 ? 1.5 : .2, send: .45 }); S.theme.push({ t: +tt.toFixed(3), m, d: +d.toFixed(3), label: '5-04 长笛云霄半句', inst: 'flute' }); return b + n; }, b0); }
    bowed(t05a + .3, 62, h30 - t05a - .5, .12, { att: 1.5, rel: .2 }); bowed(t05a + .3, 64, h30 - t05a - .5, .1, { att: 1.5, rel: .2 });   // 阴阳光域
    [898.6, 899.1, 899.5, 899.95, 900.3, 900.6, 900.95, 901.25, 901.55].forEach((x, j) => P(j % 3 === 0 ? 'nao' : 'tomH', x, .2 + .02 * j, { tech: j % 3 === 0 ? 'short' : 'rim' }));   // 十八死士站起
    P('bd', h30, .9, { exact: true, lp: 500 }); P('slit', h30 + .004, .66, { tech: 'lo', exact: true }); P('tomL', h30, .5, { tech: 'm', exact: true });
    cello(h30, 38, 4.2, .5, { att: .01, rel: 1.5, sfz: true }); cello(h30, 45, 4.2, .36, { att: .01, rel: 1.5 }); sub(h30, .4, { f0: 50, f1: 40, dec: 3, subD: 4 });   // 定：低音长鸣
    [902.42, 903.4].forEach((x, j) => { P('slit', x, .42 + .05 * j, { tech: 'hi', exact: true }); P('frameL', x + .004, .3 + .04 * j, { tech: 'mute', exact: true }); S.mark(x, '对点 B 网线'); });   // v5 对点 B：网线三步收紧（旧 906.92/907.9）各一记；第三步 908.9 落在 B 路删段 908.5–910.5 里，不写
    S.mark(h30, 'H30 死士定水（停 .42s）');
    [906.4, 907.5, 908.4, 909.1, 909.7, 910.2, 910.6, 910.95].forEach((x, j) => {                                  // 撕纱幕：每层一记梆子，截住一个短浪
      const tt = qz(c, x, .05); P('bang', tt, .48 + .03 * j); P('nao', tt + .004, .18, { tech: 'short' });
      if (j < 6) for (let q = 1; q <= 3; q++) { const tq = c.t(c.b(tt) + q / 4); if (tq < (qz(c, [907.5, 908.4, 909.1, 909.7, 910.2, 910.6, 910.95, 912][j], .05) - .06)) Z(tq, LADG(2 + j + q), .24 + .03 * q, { d: .12 }); }
    });
    { const r = S.rnd(910); for (let x = 910.2; x < 913; x += .2 + r() * .35) P('tomH', x, .16 + .08 * r(), { tech: 'rim', pan: (r() - .5) * 1.2 }); }   // 碎符挂钩
    [909.9, 910.5, 911.1, 911.7].forEach((x, j) => P('bang', x, .5 + .04 * j, { exact: true, pan: [-.3, .3, -.15, .15][j] }));   // v5 对点 B：四钩扎入（914.4/915.0/915.6/916.2），钩落处各一记梆子
    [912.1, 912.7].forEach((x) => { P('bd', x, .58, { exact: true }); P('tomL', x + .006, .5, { tech: 'm', exact: true }); P('nao', x + .004, .26, { tech: 'short', exact: true }); });   // 两记同拽（916.6、917.2）给重拍
    for (const m of [40, 47]) trem(qz(c, 912), h31 - .1, m, .14, .36, { inst: 'cello', rate: [9, 14], cut: true, send: .1 });
    S.inhale(918.1, .36, { d: 1.7 }); S.kill(918.12, h31 - .03);                                                   // v5 对点 B：920.9–922.6（新）屏息＝吸气，收住后静 .35s 到刃光一刀（P4 第 1 条）
    bowed(h31, 76, 3.2, .36, { att: .02, rel: 1.8, vib: { f: 6.5, c: 26, at: .1, ramp: .5 }, send: .5 }); flute(h31 + .01, 88, 2.2, .14, { att: .02, rel: 1.4, lp: 10000 });   // 剑吟（非玄黄）
    P('nao', h31 + .002, .55, { tech: 'short', exact: true }); P('slit', h31, .62, { tech: 'hi', exact: true }); P('bd', h31, .7, { exact: true, lp: 600 });
    S.mark(h31, 'H31 无形剑断首');
    S.noise(919.2, 3.2, .24, { f: 260, q: .6, att: .1, rel: 2, send: .3 }); sub(919.2, .4, { f0: 55, f1: 30, dec: 1.2 });   // 光域崩、水压
    [[921.8, 84], [922.6, 79], [923.4, 76], [924.1, 71], [924.7, 67]].forEach(([x, m], j) => S.dan(x, m, .2 - .02 * j, { exact: true, d: .7, rel: .4, send: .5 }));   // 碎片下沉
    // v5 SND12：撤 925.5–926 硬停（新 930.0–930.5），雨声提前 1.5s 叠入（见 5-10）
  }

  /* ==================================================================================
     926–1020：甘露雨 → 化梦游仙（木鼓逐闪渐密）→ 心声（抽空、全停 958.8–962.0）→ 快打Ⅳ（种子 E「逐层分解」）→ 风吟坠阵 → 宣句 → 落羽 → 静 2 秒
     ================================================================================== */
  const clk9 = makeClock([[922, 96], [934, 108], [950, 120], [966, 144], [984, 144], [996, 120], [1012, 120]],
    [T('act5.5-10'), T('act5.5-06'), T('act5.5-07'), T('act5.5-08'), H('H32'), T('act5.5-11'), H('H33'), T('act5.5-12')]);
  S.clockInfo.s926 = { anchors: clk9.anchors, beats: clk9.anchorBeats, scale: clk9.scale.map((k) => +k.toFixed(4)) };
  /* 种子 E（快打Ⅳ）：「逐层分解」——六个十六分的回文分解 [r, r+2, r+4, r+5, r+4, r+2]（G 宫阶梯），六对四错位滚动；
     一层一座楼：第一层古筝低音十六分，第二层越南筝八分、第三层古筝高音十六分（只在第 2、4 拍）、第四层手铃/长笛在强拍——逐层叠加。 */
  const eLayer = (clk, b0, b1, r, o = {}) => {
    const cell = [0, 2, 4, 5, 4, 2], step = o.step || .25;
    for (let b = b0, k = 0; b < b1 - 1e-6; b += step, k++) {
      if (o.beats && !o.beats.includes(Math.floor(((b % 4) + 4) % 4))) continue;
      const t = clk.t(b); if (!free(t) || (o.mute && o.mute(t))) continue;
      const m = LADG(r + cell[k % 6] + (o.reg || 0));
      const ee = (o.inst === 'dan' ? S.dan : Z)(k % 6 ? t + (J() * 2 - 1) * .004 : t, m, jit(k % 6 === 0 ? (o.vA || .34) : (o.v || .22), .06), { exact: true, d: step * 1.6 * (60 / 144), rel: .06, pan: o.pan, send: o.send });
      if (o.vo) ee.vo = o.vo;                                           // v5：分层各算一个声部（两音循环自检按声部查；高层与低层同是古筝，交错时不算一个声部的来回）
    }
  };
  /* 风吟音型（5-11 立，C-02b 钤印时弱奏再现）：五声 [0, 1, 3, 4, 3, 2]（E 羽阶梯）——五个十六分上旋到顶、回落一级后长留 */
  const FENGYIN = [0, 1, 3, 4, 3, 2];
  const fengyin = (t0, base, v, step, o = {}) => {
    FENGYIN.forEach((d, j) => {
      const tt = t0 + j * step, m = LADE(base + d), last = j === FENGYIN.length - 1;
      if (o.inst === 'flute') flute(tt, m, last ? (o.hold || 1.6) : step + .04, v * (last ? 1 : .9), { att: .015, rel: last ? .9 : .04, send: .55, lp: o.lp });
      else (o.inst === 'dan' ? S.dan : Z)(tt, m, v * (last ? 1.05 : .9), { exact: true, d: last ? (o.hold || 1.6) : step + .05, vib: last, send: .5 });
      S.theme.push({ t: +tt.toFixed(3), m, d: last ? (o.hold || 1.6) : step, label: o.label || '风吟音型', inst: o.inst || 'zheng' });
    });
  };
  {
    const c = clk9, h32 = H('H32'), h33 = H('H33'), h34 = H('H34');
    const t510 = T('act5.5-10'), t506 = T('act5.5-06'), t507 = T('act5.5-07'), t508 = T('act5.5-08'), t509 = T('act5.5-09'), t511 = T('act5.5-11'), t512 = T('act5.5-12'), t513 = T('act5.5-13');
    sec('926–966 甘露→化梦游仙→心声', t510, t508, '5-10 ♩96 雨声（高频噪声）＋古筝八分稀拨＋低弦长音，碗聚光处手铃；5-06 ♩108→120 每闪一记木鱼（木鼓高音）越来越密，传讯处长笛一句，945 埙 B3 一口气声（喊不出声）；5-07 心声期间只留极弱长音，958.8–962.0 全停，962.0 古筝一声');
    S.noise(t510 - 2.7, t506 - t510 + 4.2, .16, { f: 3600, q: 1, white: .55, att: 1.8, rel: 1.5, send: .4 });   // v5 SND12：雨声提前 1.5s 叠入；v5 对点 B：近黑尾删 1.2s（旧 928.9–930.1），起点再前移 1.2s，新秒仍提前 1.5s 且不起在删段里
    S.pad('cello', t510 + .2, t507, [43, 50], .2, { fi: 1.5, fo: 2 });
    for (const bar of barsOf(c, t510, t506)) for (let e = 0; e < bar.len * 2; e += 1) { if (e % 3 === 2) continue; Z(c.t(bar.b0 + e / 2), [67, 71, 74, 71, 69, 74, 76, 74][(bar.k * 8 + e) % 8], .2, { d: .5, send: .4 }); }
    [[927.6, 88], [929.8, 86], [932.1, 88]].forEach(([x, m]) => chime(x, m, .12, { d: 1.6, send: .6 }));
    { const r = S.rnd(506); let x = t506 + .6, gap = 1.3; const ends = t507 - .3; while (x < ends) { P('slit', qz(c, x, .05), .26 + .14 * (x - t506) / (ends - t506), { tech: 'hi', pan: (r() - .5) * .8 }); x += gap; gap = Math.max(.24, gap * .9); } }   // 每闪一下一记木鱼，越来越密
    for (let b = Math.round(c.b(t506)); c.t(b) < t507 - .2; b += 2) P('frameL', c.t(b), .13, { tech: 'mute', lp: 2500 });
    [[935.3, 74, 1], [936.3, 76, .6], [936.9, 79, 1.4], [938.3, 76, .6], [938.9, 74, 1.6]].forEach(([x, m, d]) => flute(x, m, d, .22, { att: .08, rel: .3, send: .45 }));   // 传讯处长笛一句
    xun(945.2, 59, 1.4, .3, { att: .05, rel: .3, env: [[0, 1], [.4, .5], [1.4, 0]] }); S.mark(945.2, '毒鳄残响：埙 B3 一口气声');
    bowed(946.5, 79, 3.5, .06, { att: 1.5, rel: 1.5, lp: 7000 });                                                 // 拼出的空间到处是缝
    S.pad('cello', t507 + .2, 957.1, [43], .13, { fi: 1, fo: 1.5 }); S.pad('bowed', t507 + 1, 957.1, [62], .05, { fi: 2, fo: 1.5 });   // v5 对点 C2：收在静音②（957.3）之前
    S.kill(957.3, 958.5); S.mark(957.3, '对点 C2 静音②');                                                       // v5 SND14＋对点 C2：静音② 1.2s 随睁眼提前（原 958.8–960.0）＝旧 965.8–967.0
    Z(958.5, 62, .34, { d: 4, vib: true, send: .5 }); S.mark(958.5, '对点 C2 睁眼古筝一声');                        // v5 对点 C2：古筝一声＝睁眼（act5 EYE7 32.5＝旧 967.0；原 960.0＝旧 968.5）
    S.pad('cello', 958.5, t508 + .5, [43], .14, { fi: 1.2, fo: .3, genv: [[958.5, .55], [960.6, 1], [962.8, 1.9]] }); S.inhale(962.8, .34, { d: 1.6 });   // v5 SND14＋对点 C2：低弦 G2 自睁眼渐强，接删点 962.8（旧 971.3，原接 966＝5-08）
    S.mark(962.75, '对点 C2 删点前渐强收尾');                                                                   // splice-fit：配乐删点不早于此，渐强与吸气不被删掉

    sec('966–1020 快打Ⅳ→风吟→宣句→落羽', t508, t513, '种子 E 逐层分解：966 第一层古筝低音十六分，每两小节加一层（越南筝八分→古筝高音十六分只在 2、4 拍→手铃/长笛强拍），堂鼓与板鼓托底；旁白处顶上两层压弱；975.5 吸入＝古筝上刮＋小提琴组上滑＋铙钹；985.0 心声处旋律停半拍；991 起坠落＝低弦长滑音下行；5-11 四段风各换一种噪声色（松涛低、山涧中、雨雾高、窗隙窄带哨音），每段一次风吟音型（音区／乐器各换），剥落声＝梆子与板鼓碎点；1005.0 闷爆；1011.4 宣句＝小提琴组和弦散板长音；1016.5 落羽＝越南筝＋手铃一声；1017.5–1019.5 完全静音');
    const b508 = Math.round(c.b(t508)), bPt = (x) => Math.round(c.b(x));
    const quietTop = (t) => (t > 966.8 && t < 973.6) || (t > 977 && t < 983.2) || (t >= 985.0 && t < c.t(c.b(985.0) + .5));
    const stopHalf = (t) => t >= 985.0 - .01 && t < c.t(c.b(985.0) + .5);
    eLayer(c, b508, bPt(t511), 0, { v: .22, vA: .34, mute: stopHalf });
    eLayer(c, b508 + 8, bPt(t511), 3, { inst: 'dan', step: .5, v: .2, vA: .28, mute: stopHalf, pan: .3 });
    eLayer(c, b508 + 16, bPt(t509 + 6), 5, { beats: [1, 3], v: .2, vA: .26, mute: (t) => quietTop(t) || stopHalf(t), pan: -.35, vo: 'eHi' });
    for (let b = b508 + 24; c.t(b) < t511 - .3; b += 2) { const tt = c.t(b); if (!free(tt) || quietTop(tt)) continue; chime(tt, [88, 86, 83, 86][(b / 2) % 4 | 0], .12, { d: 1.2, send: .6, pan: .4 }); }
    for (const bar of barsOf(c, t508, h32).concat(barsOf(c, h32, t511))) {
      const k = bar.k;
      drums(c, bar, [{ i: 'tomL', tech: 'm', pos: [0, 4], v: .36, acc: [0], vA: .44 }, { i: 'frameS', tech: 'mute', pos: ALL16, v: .13, acc: [0, 2, 4, 6], vA: .2 }].concat(bar.t0 > 970 ? [{ i: 'bd', pos: [0, 5], v: .42 }] : [], bar.t0 > 990 ? [{ i: 'tomH', tech: 's', pos: [6, 6.5, 7, 7.5], v: .26 }] : []));
    }
    S.gliss(h32 - .5, .5, 55, 84, .36, { key: 67, mode: 'gong', curve: .7, v1: .48 }); bowed(h32 - .6, 64, 1.4, .18, { att: .3, rel: .6, bend: [[0, 0], [.6, 5], [1.4, 7]] });
    P('nao', h32 + .002, .7, { tech: 'open', exact: true }); P('bd', h32, .74, { exact: true }); P('tomL', h32, .5, { tech: 'm', exact: true });
    S.mark(h32, 'H32 长廊吸入');
    bowed(h32 + .1, 67, 2.1, .14, { att: .4, rel: .3, bend: [[0, 0], [2.1, 7]], swell: [.6, 1, 1.6] }); bowed(h32 + .12, 74, 2.1, .1, { att: .4, rel: .3, bend: [[0, 0], [2.1, 5]], swell: [.6, 1, 1.6] });   // v5 SND2：长廊竖起＝小提琴组上滑
    { for (let x = h32 + .15, j = 0; x < h32 + 2.15; x += .07, j++) P('frameS', x, .14 + .26 * (x - h32) / 2.2, { tech: 'mute', exact: true }); P('luo', h32 + 2.2, .42, { tech: 'small', exact: true, d: 3, rel: 1.4 }); S.mark(h32 + 2.2, '长廊竖起（小锣）'); }   // 板鼓滚渐强，977.7（新 986.2）小锣
    cello(991.0, 47, t511 - 991 + .5, .32, { att: .3, rel: .8, bend: [[0, 0], [5.5, -12]] }); cello(991.1, 40, t511 - 991 + .4, .26, { att: .3, rel: .8, bend: [[0, 0], [5.5, -4]] });   // 坠落：低弦下滑
    /* 5-11：四段风，各一次风吟音型 */
    const W4 = [[t511, 300, .7, .2, .1], [t511 + 3.75, 1100, 1.4, .14, .25], [t511 + 7.5, 4200, 1.0, .08, .65], [t511 + 11.25, 1750, 9, .07, .02]];
    W4.forEach(([x, f, q, v, wh], j) => S.noise(x, 4.2, v, { f, q, white: wh, gust: j === 0 ? .7 : .3, att: .4, rel: .6, send: .35, fk: j === 1 ? [[x, 800], [x + 1, 1500], [x + 2, 900], [x + 3, 1600], [x + 4.2, 1000]] : null }));
    fengyin(qz(c, t511 + .5), 0, .3, .125, { label: '风吟音型（立：松涛）' });
    fengyin(qz(c, t511 + 4.3), 5, .26, .125, { inst: 'dan', label: '风吟音型（山涧）' });
    fengyin(qz(c, t511 + 8.0), 5, .22, .125, { inst: 'flute', label: '风吟音型（雨雾）' });
    fengyin(qz(c, 1007.8), 10, .16, .125, { inst: 'flute', hold: 2.2, lp: 9000, label: '风吟音型（窗隙）' });
    { const r = S.rnd(511); for (let x = t511 + .2; x < t512 - .4; x += (x > 1000 ? .16 : .2) + r() * (x > 1000 ? .16 : .22)) { if (Math.abs(x - h33) < .2) continue; const wb = r() < .55; P(wb ? 'bang' : 'slit', x, .24 + .18 * r(), { tech: wb ? undefined : 'hi', lv: 0, pan: (r() - .5) * 1.2 }); } }   // 墨色剥落：梆子／木鼓碎点
    for (let b = bPt(t511); c.t(b) < t512 - .3; b++) if (free(c.t(b)) && Math.abs(c.t(b) - (h33 + .5)) > .06) P('frameL', c.t(b), b % 2 ? .13 : .18, { tech: 'mute', lp: 2200 });   // 坠阵：框鼓每拍一下（心跳般，乐器已退）
    for (let j = 0; j < 9; j++) P('frameS', h33 - .5 + j * .055, .16 + .3 * j / 8, { tech: 'open', exact: true });   // v5 对点 C：撞前 .5s 阵线绷紧（旧 1013.0–1013.5）＝板鼓滚冲进 H33
    P('frameL', h33 + .5, .24, { tech: 'mute', exact: true, lp: 1600, send: .3 });                                   // v5 对点 C：赵被弹到顶（旧 1014.0）＝一记很轻的捂音框鼓
    P('bd', h33, .92, { exact: true, lp: 380 }); P('luo', h33 + .005, .5, { tech: 'main', lp: 1500, exact: true }); P('tomL', h33, .5, { tech: 'm', exact: true, lp: 900 }); sub(h33, .55, { f0: 62, f1: 30, dec: .8 });
    S.mark(h33, 'H33 坠阵反噬（闷爆）');
    [55, 62, 67, 71].forEach((m, j) => bowed(1011.4 + .05 * j, m, h34 - 1011.4 - .3, .15 - .015 * j, { att: 1.2, rel: .8, vib: { f: 4.6, c: 16, at: .8, ramp: 1 }, swell: [.6, 1.15, .7], send: .5 }));   // 宣句（散板）
    flute(1012.3, 74, 3.6, .1, { att: 1.2, rel: 1.2, send: .55 });
    S.dan(h34, 83, .36, { exact: true, d: .9, rel: .5, send: .55 }); chime(h34 + .005, 88, .24, { d: .9, rel: .5 });   // 落羽
    S.mark(h34, 'H34 落羽定身');
    S.kill(1017.5, 1019.5);
  }

  /* ==================================================================================
     5-13 万古云霄（1020–1060）：score-v3 的 5-13 原样移植，只平移时间（v3 在全片 1056 起，此处 1020 起）。
     与 v3 逐事件同参：编钟完整云霄主题两遍（中音区→高八度）、低弦 G→C→D→G 每 4 拍一换、磬每小节首拍、每小节第 3 拍高音点缀、第一遍末音的三次轻击。
     两处为「保持波形一致」做的等效换算：① v4 全局湿声 .5、v3 为 .55——本段每个事件的混响送量 ×1.1，湿声与 v3 相同；
     ② 磬按事件顺序轮换采样，v3 全片在本段前只有 1 次磬——这里用 qi 直接取 v3 当时那几条（第 2–9 条）。
     段前 1017.5–1019.5 硬停窗（全片空白之三），本段窗内（1020–1060）不写任何别的声部。
     ================================================================================== */
  {
    const n513 = S.events.length;
    const t13 = T('act5.5-13'), WET = .55 / S.wet;
    const v3n = (i, t, m, v, o = {}) => S.ev({ k: 'n', i, t, m, v, gain: o.gain || 1, pan: o.pan == null ? 0 : o.pan, send: (o.send == null ? .3 : o.send) * WET, d: o.d, att: o.att, rel: o.rel, lp: o.lp });
    sec('5-13 万古云霄（移植 v3）', t13, T('act5.5-14a'), 'score-v3 原样，只平移时间；混响送量 ×1.1 抵消全局湿声差；磬取 v3 当时的第 2–9 条采样');
    const B56 = 60 / 56, b = B56, t0 = t13 + .5, G = 67;
    const YA_FULL = [[0, 1], [2, 1], [7, 1], [9, 1], [12, 2], [14, 1], [12, 1], [9, 1], [7, 1], [9, 1], [2, 1], [0, 4]];
    const chords = [[43, 50, 59], [48, 55, 64], [50, 57, 64], [43, 50, 59]];
    for (let k = 0; k < 8; k++) {
      const ct = t0 + k * 4 * b, ch = chords[k % 4];
      ch.forEach((m) => S.cello(ct, m, 4 * b + .5, .3, { att: .35, rel: .9, send: .15 * WET, exact: true }));
      S.ev({ k: 'p', i: 'qing', t: ct, v: .45, m: 55, send: .45 * WET, pan: .1, qi: 1 + k });
      const ht = ct + 2 * b;
      if (k % 2 === 0) v3n('chime', ht, 86, .25, { d: 2, rel: 1.2, send: .55, pan: .25 });
      else S.flute(ht, 91, 2.2, .12, { exact: true, att: .05, rel: .8, lp: 12000, send: .55 * WET, pan: .25 });
      S.z(ht, k % 2 === 0 ? 74 : 79, .12, { exact: true, d: 1.5, send: .5 * WET, pan: .25 });
    }
    for (let pass = 0; pass < 2; pass++) {
      const base = G + pass * 12;
      let t = t0 + pass * 16 * b;
      YA_FULL.forEach(([iv, len], j) => {
        const m = base + iv, d = len * b, last = j === YA_FULL.length - 1;
        v3n('bell', t, m, .8, { d: last ? d + 2.5 : d, send: .4, pan: pass ? .18 : -.18 });
        S.theme.push({ t: +t.toFixed(3), m, d: +d.toFixed(3), label: '5-13 云霄主题（编钟' + (pass ? '高八度' : '中音区') + '）', inst: 'bell' });
        t += d;
      });
      [13, 14, 15].forEach((k, j) => v3n('bell', t0 + pass * 16 * b + k * b, base, .46 - .08 * j, { d: 2.2, send: .35, pan: pass ? .18 : -.18 }));
    }
    S.mark(t0, '5-13 编钟完整主题（v3 移植）');
    for (let k = n513; k < S.events.length; k++) S.events[k].keep513 = true;
  }

  /* ==================================================================================
     1060–1260：镇压 → 撼阵 → 弃壳 → 卷道境 → 招印 → 九叶 → 钤印（风吟弱奏）→ 化珠（一粒钟）→ 余波 → 问句不解决 → 尾音
     ================================================================================== */
  for (const h of ['H35', 'H36', 'H37', 'H38', 'H39', 'H40']) guard.push(H(h));
  const clk10 = makeClock([[1056, 72], [1104, 72]], [T('act5.5-14a'), H('H35'), H('H37'), T('act5.C-01')]);
  const clk11 = makeClock([[1096, 56], [1120, 56], [1120, 60], [1166, 60]], [T('act5.C-01'), T('act5.C-02a'), T('coda.C-03a')]);
  const clk12 = makeClock([[1156, 72], [1182, 72], [1203.5, 60], [1262, 60]], [T('coda.C-03a'), T('coda.C-04'), T('coda.C-06a')]);
  S.clockInfo.s1060 = { scale: [clk10.scale, clk11.scale, clk12.scale].map((x) => x.map((k) => +k.toFixed(4))) };
  {
    const c = clk10, h35 = H('H35'), h36 = H('H36'), h37 = H('H37');
    const t14a = T('act5.5-14a'), t14b = T('act5.5-14b'), t515 = T('act5.5-15'), t516 = T('act5.5-16'), tC1 = T('act5.C-01');
    sec('1060–1100 镇压→撼阵→弃壳', t14a, tC1, '5-14a 厉啸＝低弦刮弓（上滑再坠）＋血焰噪声＋埙毒鳄最后两音 C4→B3；5-14b 锣弱＋编钟低音、法印升起＝小提琴组上行长音、湖底暗光＝低频；1071.0 大锣＋大鼓镇压，窍穴一处处闭合＝木鼓七点渐疏；5-15 秘阵嗡鸣（大提琴＋小提琴组近音＋低频）与框鼓守拍，1082.0 嗡鸣骤然降调＋铙钹；5-16 1091.5 埙最后一缕（未完即断）＋闷爆，弃壳余响退入风声');
    cello(t14a + .1, 45, 4.6, .4, { att: .05, rel: .6, bend: [[0, 0], [1.2, 3], [3, 3], [4.6, -4]] }); cello(t14a + .15, 52, 4.4, .3, { att: .05, rel: .6, bend: [[0, 0], [1.2, 2], [4.4, -5]] });   // 厉啸：刮弓
    S.noise(t14a, 6, .18, { f: 900, q: .5, white: .3, att: .3, rel: 2, send: .3 });
    xun(t14a + 1.0, 60, 1.2, .48); xun(t14a + 2.2, 59, 2.2, .44, { env: [[0, 1], [1.4, .7], [2.2, 0]] }); S.mark(t14a + 1, '毒鳄最后两音（C4→B3）');
    P('luo', t14b + .3, .36, { tech: 'main', lv: 0, d: 6, rel: 3 }); bell(t14b + .5, 55, .42, { d: 6 }); bell(t14b + 2.0, 43, .34, { d: 7 });   // 锣＋编钟低音
    [[t14b + 1.0, 55], [t14b + 2.4, 62], [t14b + 3.8, 67]].forEach(([x, m]) => bowed(x, m, h35 - x - .1, .13, { att: 1.5, rel: .1, send: .45 }));   // 法印升起
    [1066.2, 1066.55, 1066.9, 1067.25, 1067.6, 1067.95].forEach((x, j) => chime(x, [86, 83, 88, 81, 86, 84][j], .06, { d: 1.1, rel: .8, send: .6, pan: [-.4, -.1, .3, .5, 0, -.5][j] }));   // v5 对点 C：湖上六处阵纹逐个亮（旧 1074.7 起每 .35s），各一粒极轻手铃
    S.inhale(1068.15, .3, { d: .65 }); S.gliss(1067.5, .6, 62, 84, .2, { key: 67, mode: 'gong', curve: 1.6, v1: .26 });   // v5 对点 C：一镜俯冲进湖（旧 1076.0–1076.65）＝吸气＋上刮
    P('bd', 1068.15, .42, { exact: true, lp: 240, d: .8, rel: .5 });                                               // v5 对点 C：切进湖底落定（旧 1076.65）一记低频闷响
    sub(1068.2, .28, { f0: 38, f1: 32, dec: 3, subD: 3 }); cello(1068.0, 36, 3, .18, { att: 1.2, rel: 1, lp: 700 });   // 湖底暗光
    cello(1069.6, 38, 1.2, .24, { att: .9, rel: .03, swell: [.4, 1, 2] }); cello(1069.6, 45, 1.2, .18, { att: .9, rel: .03, swell: [.4, 1, 2] });   // v5 对点 C：上缘玉白威压蓄到切点（旧 1078.1–1079.3）＝低弦渐强
    for (let b = Math.round(c.b(t14b)); c.t(b) < h35 - .3; b += 2) P('frameL', c.t(b), .15, { tech: 'mute', lp: 2200 });
    S.inhale(h35, .36, { d: .2 });                                                                                  // v5 对点 C：1079.3（旧）硬切暗地、印 .2s 砸下＝反向钹 .2s 收在命中
    P('luo', h35 + .004, .7, { tech: 'main', lv: 3, exact: true, d: 6, rel: 3 });   // v5 SND9：.9→.7 P('bd', h35, .96, { exact: true }); P('tomL', h35, .6, { tech: 'm', exact: true }); sub(h35, .55, { f0: 70, f1: 32, dec: .9 });
    cello(h35, 43, 2.4, .5, { sfz: true, rel: 1.2 }); cello(h35, 50, 2.4, .42, { sfz: true, rel: 1.2 });
    [1072.0, 1072.6, 1073.3, 1074.0, 1074.8, 1075.45, 1075.85].forEach((x, j) => { P('slit', x, .34 - .03 * j, { tech: j % 2 ? 'lo' : 'hi', send: .35 }); sub(x, .12, { f0: 52, f1: 40, dec: .35 }); });   // 窍穴闭合（v5 对点 C：末两点随画面 1075.5→1075.45、1076.3→1075.85；每闭一处印往下一沉＝低频下沉）
    P('frameL', h35 + .6, .2, { tech: 'mute', exact: true, lp: 900 }); cello(h35 + .6, 38, 1074.8 - h35 - .6, .12, { att: .4, rel: .8, lp: 500 });   // v5 对点 C：印触顶后弹回半空（.5s backOut）悬着往下压，到 1074.8（旧 1083.3）离头升起
    S.mark(h35, 'H35 法印镇压');
    S.pad('cello', t515 + .2, h36 + .1, [40, 47], .2, { fi: 1.5, fo: .1 }); S.pad('bowed', t515 + .5, h36 + .1, [59, 60], .07, { fi: 2, fo: .1 }); sub(t515 + .3, .2, { f0: 45, f1: 44, dec: 6, subD: 6 });   // 秘阵嗡鸣
    for (let b = Math.round(c.b(t515)); c.t(b) < t516 - .2; b++) { const tt = c.t(b); if (!free(tt)) continue; P('frameL', tt, b % 2 ? .12 : .17, { tech: 'mute', lp: 2200 }); if (b % 4 === 2) P('frameS', c.t(b + .5), .12, { tech: 'mute' }); }
    S.inhale(1077.0, .14, { d: .3, lp: 6000 }); P('luo', 1077.0, .2, { tech: 'main', lp: 900, exact: true, d: 1.6, rel: .8 }); P('bd', 1077.0, .34, { exact: true, lp: 300, d: .5, rel: .3 }); sub(1077.0, .14, { f0: 52, f1: 38, dec: .6 }); S.mark(1077.0, '对点 C3 手按令牌（沉的铁声）');   // v5 对点 C3：1085.2–1085.5（旧）按前推近一沉＝轻吸气，1085.5 按下＝捂低的锣＋大鼓闷
    P('bd', 1079.55, .2, { exact: true, lp: 200, d: 1.2, rel: .8, send: .55 }); sub(1079.55, .1, { f0: 44, f1: 34, dec: 1.2 }); S.mark(1079.55, '对点 C3 远岸墨纹（吼声如蚊蚋）');   // v5 对点 C3：封禁远景 1088.05（旧）远岸一圈墨纹＝远处一层闷响
    S.inhale(h36, .3, { d: .3, lp: 7000 }); S.mark(h36 - .3, '对点 C3 回手再压');                                    // v5 对点 C3：1090.2（旧）硬切回手、.3s 再压＝反向钹 .3s 冲进 H36
    P('nao', h36 + .003, .66, { tech: 'open', exact: true }); P('bd', h36, .6, { exact: true }); P('tomL', h36, .44, { tech: 'm', exact: true });
    cello(h36, 40, t516 - h36, .24, { att: .02, rel: 1.2, bend: [[0, 0], [.35, -2]] }); bowed(h36, 59, t516 - h36 - 1, .09, { att: .02, rel: 1.2, bend: [[0, 0], [.35, -3]] }); flute(h36 + .4, 88, 2.4, .06, { att: .3, rel: 1.2, lp: 9000 });   // 嗡鸣降调、细缝
    S.mark(h36, 'H36 纪庸撼阵（嗡鸣变调）');
    [[1090.3, .05], [1090.62, .065], [1091.0, .08]].forEach(([x, v]) => { S.noise(x, .28, v, { f: 1900, q: .7, white: .7, att: .02, rel: .22, send: .4, pan: -.1 }); S.mark(x, '对点 C3 冷笑肩抖'); });   // v5 对点 C3：冷笑肩抖 1098.8/1099.12/1099.5（旧）各一下极轻气声
    S.inhale(h37, .26, { d: .5, lp: 6000 });                                                                         // v5 对点 C3：炸前 .5s 向心内缩（1099.5–1100.0 旧）＝反向钹收在 H37
    xun(h37 - .9, 59, 1.4, .32, { att: .2, rel: .02, env: [[0, .6], [.6, 1], [.9, 1], [.92, 0]] });              // 埙最后一缕，未完即断
    P('bd', h37, .9, { exact: true, lp: 420 }); P('luo', h37 + .005, .46, { tech: 'main', lp: 1400, exact: true }); P('tomL', h37, .46, { tech: 'm', exact: true, lp: 800 }); sub(h37, .5, { f0: 60, f1: 30, dec: .9 });
    S.mark(h37, 'H37 形神炸开（埙断）');
    S.noise(1091.6, 21.9, .2, { f: 800, q: .6, white: .12, gust: .5, send: .35,
      keys: [[1091.6, 0], [1091.9, 1.6], [1093.0, 1.1], [1095.0, .6], [1097.5, .85], [1105.3, 1], [1105.75, 2], [1107.15, 1.25], [1107.45, 2], [1108.8, 1.25], [1109.1, 2], [1110.45, 1.3], [1110.6, 1.2], [1111.8, .7], [1113.5, 0]],
      fk: [[1091.6, 950], [1095.0, 700], [1105.6, 700], [1106.1, 860], [1107.27, 1000], [1107.77, 1110], [1108.93, 1250], [1109.43, 1360], [1110.6, 1500], [1113.5, 1000]] });
    // 弃壳余响退入风声，风延到卷道境。v5 对点 C3：灰带溶入（旧 1100.4）风一冲即随流速衰减（τ1.6s，到 1103.5 转弱）；
    // SND8 卷道境：卷前沿 1114.1–1119.1（旧）三口气（act5 curlK，每口 1.67s 先急后缓），每口起处涨 6 dB、口末回落，中心频率随前沿升高 700→1500 Hz，1119.1 回落
    [1105.6, 1107.267, 1108.933].forEach((x, j) => S.mark(x, '对点 C3 卷道境第' + (j + 1) + '口气'));
    qing(1097.8, .13, 76, { exact: true, send: .62, pan: .3 }); S.noise(1097.8, .5, .05, { f: 1300, q: .6, white: .5, att: .01, rel: .4, send: .5, pan: .3 }); S.mark(1097.8, '对点 C3 残念皮屑落湖');   // v5 对点 C3：1106.3（旧）一粒极轻的磬＋水声
    S.gliss(1105.6, 5, 55, 84, .2, { inst: 'dan', key: 67, mode: 'gong', curve: 1, v1: .3, send: .45 }); S.mark(1105.6, '长卷上天（越南筝上刮跟卷前沿）');
    cello(1093.5, 43, 7, .16, { att: 2, rel: 2 });
  }
  {
    const c = clk11, h38 = H('H38'), h39 = H('H39');
    const tC1 = T('act5.C-01'), tC1a = T('act5.C-01a'), tC2a = T('act5.C-02a'), tC2b = T('act5.C-02b'), tC2c = T('act5.C-02c'), tC2d = T('act5.C-02d'), tEnd = T('coda.C-03a');
    sec('1100–1160 卷道境→招印→九叶→钤印→化珠→穿腕', tC1, tEnd, 'C-01 ♩56 风；指敲车壁两下（梆子极轻）；云霄尾句缩小音域（越南筝 E5 D5 E5 B4 | A4）；C-01a 法印移动＝低弦长鸣渐强，1118.5 云散＝编钟一粒；C-02a ♩60 古筝一拍一音，九粒磬（首粒 1121.5，余八粒 1127–1133 渐弱），1135 金声玉振；1137.5 钤印＝大锣弱奏＋编钟，随后风吟音型弱奏（长笛、越南筝各一次）；1151.5 化珠＝一粒钟声，1158 前衰尽；C-02d 古筝收句（云霄主题末句）');
    [[1102.8, .14], [1103.4, .11]].forEach(([x, v]) => P('bang', x, v, { lv: 0, exact: true }));                // 指敲车壁（v5 对点 C3：照画面 1111.3/1111.9 旧，原 1102.4/1102.75 早 .4–.65s）
    chime(1103.65, 91, .06, { d: 1.2, rel: .8, send: .65, pan: .25 }); S.mark(1103.65, '对点 C3 头侧一点花青');   // v5 对点 C3：1112.15（旧）睁眼冷笑＝一粒极轻的高音手铃
    S.pad('cello', tC1 + .5, tC1a + 1, [43, 50], .17, { fi: 2, fo: 2 });
    { const b0 = Math.round(c.b(1101.4)); [[76, 1], [74, 1], [76, 1], [71, 1], [69, 3.5]].reduce((b, [m, n]) => { const tt = c.t(b), d = c.t(b + n) - tt; S.dan(tt, m, .26, { exact: true, d: d + .2, vib: n > 1, send: .45 }); S.theme.push({ t: +tt.toFixed(3), m, d: +d.toFixed(3), label: 'C-01 云霄尾句（缩小音域）', inst: 'dan' }); return b + n; }, b0); }
    [[1109.2, 86], [1109.8, 88], [1110.4, 83]].forEach(([x, m]) => chime(x, m, .1, { d: 1.4, send: .65 }));   // 光气入碗（v5 SND1：对画面晚 4.6s）
    cello(tC1a + .2, 38, h38 - tC1a - 12, .28, { att: 3, rel: 2, swell: [.5, 1.2, .8] }); sub(tC1a + .4, .22, { f0: 40, f1: 37, dec: 5, subD: 6.5 });   // 法印移动
    bell(1118.5, 79, .5, { d: 4, send: .5 }); S.mark(1118.5, '云散：编钟一粒');
    for (let b = Math.round(c.b(tC2a)); c.t(b) < tC2b - .3; b++) { const tt = c.t(b); Z(tt, [55, 62, 67, 71, 67, 62][(b % 6 + 6) % 6], .18 + (b % 4 === 0 ? .04 : 0), { d: 1.6, send: .45 }); }
    S.pad('cello', tC2a, tC2c, [43, 50], .16, { fi: 2, fo: 2 });
    [1125.0].concat([0, 1, 2, 3, 4, 5, 6, 7].map((k) => 1126.45 + k * .42)).forEach((x, j) => qing(x, .4 - .03 * j, 64 + (j % 3), { exact: true, send: .5, pan: -.3 + .07 * j }));   // 九粒磬，渐弱（v5 对点 C3：首粒 1125.0＝旧 1133.5，后八遍落纸 1134.95＋.42k 旧，原 1127.25＋.72k）
    S.mark(1125.0, '对点 C3 九叶首粒'); S.mark(1126.45 + 7 * .42, '对点 C3 九叶末粒');
    bell(1130.35, 67, .5, { d: 3, send: .5 }); bell(1130.36, 79, .3, { d: 3, send: .5 }); qing(1130.35, .45, 67, { exact: true }); S.mark(1130.35, '对点 C3 一抖金玉相击');  // 金声玉振（v5 对点 C3：随一抖 1143.45→1138.85 旧）
    S.mark(1136.0, '对点 C3 抬镜对住悬印'); S.inhale(h38, .3, { d: .8, lp: 7000 }); cello(h38 - .8, 43, .8, .14, { att: .6, rel: .03, swell: [.4, 1, 2] });   // v5 对点 C3：1145.2–1146.0（旧）抬镜一推、印身越蓄越亮＝预备渐强 .8s 冲进 H38
    P('luo', h38 + .004, .46, { tech: 'main', lv: 0, exact: true, d: 6, rel: 3 }); bell(h38, 67, .62, { d: 4, send: .45 }); bell(h38 + .005, 55, .34, { d: 4 });   // 钤印
    S.mark(h38, 'H38 钤印（大锣弱奏＋编钟）');
    S.gliss(1138.2, .7, 67, 84, .1, { key: 67, mode: 'gong', curve: .9, v1: .16, send: .5 }); S.mark(1138.2, '对点 C3 印抬离一转');   // v5 对点 C3：1146.7–1147.9（旧）印抬离、一转、隐没＝一记轻的上刮
    fengyin(1139.6, 5, .12, .16, { inst: 'flute', hold: 2.2, lp: 8000, label: '风吟音型（C-02b 钤印后弱奏再现）' });
    fengyin(1142.8, 5, .12, .18, { inst: 'dan', hold: 2.4, label: '风吟音型（C-02b 弱奏，越南筝）' });
    S.pad('cello', tC2b + 1, h39 - .5, [43], .13, { fi: 2, fo: 1.5 });
    bell(h39, 79, .62, { d: 1.5, send: .45 }); chime(h39 + .004, 79, .18, { d: 5.5, rel: 2.6, send: .6 });   // 化珠：一粒钟声（v5 对点 C3：第五幕停在掌中珠 1162.5–1167.8 旧，钟声余响延到掌中珠镜尾）
    S.mark(h39, 'H39 化珠钟声');
    { const b0 = Math.round(c.b(tC2d + .2)); [[76, 1], [74, 1], [76, 1], [69, 1], [67, 1.6]].reduce((b, [m, n], j, arr) => { const tt = c.t(b); Z(tt, m, .3, { d: j === arr.length - 1 ? 1.4 : c.t(b + n) - tt + .1, rel: j === arr.length - 1 ? .35 : .2, vib: n > 1 }); S.theme.push({ t: +tt.toFixed(3), m, d: n, label: 'C-02d 古筝收句（云霄末句）', inst: 'zheng' }); return b + n; }, b0); }
  }
  {
    const c = clk12, h40 = H('H40');
    const tC3a = T('coda.C-03a'), tC3b = T('coda.C-03b'), tC4 = T('coda.C-04'), tC5 = T('coda.C-05'), tC6a = T('coda.C-06a'), tC6b = T('coda.C-06b'), tC7 = T('coda.C-07');
    sec('1160–1260 余波→问句→尾音', tC3a, 1260, 'C-03a 埙三口气音碎片（毒鳄最碎）；1171.0 爆裂＝低音闷击＋磬，十字光纹＝长笛极弱高音十点一亮一暗渐黯；C-04 长笛冷音（E5→D5→B4）；C-05 血浪＝低弦群快速下滑＋低频噪声涨起，1209.6 收；C-06a 古筝问句（落在 A4，不落主音）；C-06b 对白处只留铺底，1240 起古筝问句 G4 A4 D5 E5 停在 E5 不解决；C-07 主题尾音 G：古筝 G4＋编钟 G5 散板长留淡出');
    S.pad('cello', tC3a - 2, tC4 + 1, [38], .2, { fi: 1.2, fo: 2, genv: [[tC3a - 2, 1.5], [tC3a + 3, 1.5], [tC3a + 6, 1]] });                                               // v5 SND12：D2 长音提前 2s（新 1166.5）跨过幕界
    [[1161.0, 59], [1165.3, 60], [1168.4, 59]].forEach(([x, m]) => xun(x, m, .38, .2, { att: .06, rel: .16, send: .45, env: [[0, 1], [.26, .7], [.38, 0]] }));
    S.mark(1162.0, '毒鳄最碎：三口气音');
    P('bd', h40, .8, { exact: true, lp: 360 }); qing(h40, .7, 62, { exact: true }); sub(h40, .45, { f0: 58, f1: 30, dec: .8 }); P('tomL', h40, .4, { tech: 'm', exact: true, lp: 700 });
    S.mark(h40, 'H40 道韵伐根（闷击＋磬）');
    for (let k = 0; k < 10; k++) flute(1172.2 + k * .8, k % 2 ? 86 : 88, .55, .1 * (1 - k * .07), { att: .08, rel: .3, lp: 9000, send: .6, pan: -.4 + .09 * k });   // 十字光纹一亮一暗
    for (let b = Math.round(c.b(tC3b)); c.t(b) < tC5 - .2; b += 2) { const tt = c.t(b); P('frameL', tt, tt > tC4 ? .26 : .12, { tech: 'mute', lp: 2000 }); if (tt > tC4) P('frameS', c.t(b + 1), .13, { tech: 'mute' }); }   // v5 SND13：C-03b 框鼓续过 C-04 对白（加一记弱拍），接到血浪起（原秒 tC5）
    bowed(tC4 + .5, 79, 13, .2, { att: 3, rel: 4, lp: 8000, send: .55, vib: { f: 4.2, c: 10, at: 2, ramp: 3 } }); bowed(tC4 + .8, 74, 12.5, .14, { att: 3, rel: 4, lp: 8000, send: .55 });   // v5 SND13：月光照下（新 1190.5）小提琴组泛音长音
    S.pad('cello', tC4 + .5, tC5 + .3, [38, 45], .26, { fi: 2.5, fo: 1.2 });                                                    // 对白下低弦铺底，目标约 −31
    S.pad('cello', tC4 - .5, tC5 + .3, [43, 50], .15, { fi: 2, fo: 1.5 });
    [[tC4 + 1.0, 76, 8.5], [tC4 + 10.0, 74, 6], [tC4 + 16.5, 71, 4.6]].forEach(([x, m, d]) => flute(x, m, d, .18, { att: 1.5, rel: 2, lp: 9000, send: .45 }));   // 长笛冷音
    S.gliss(tC5 + .3, 4.5, 60, 36, .46, { inst: 'cello', key: 67, mode: 'gong', curve: 1.15, v1: .32, send: .3 });     // 血浪：低弦群快速下滑
    S.gliss(tC5 + .5, 4.2, 57, 38, .36, { inst: 'cello', key: 67, mode: 'gong', curve: 1.2, v1: .26, send: .3 });
    S.noise(tC5, 1209.6 - tC5, .4, { f: 100, q: .8, att: .3, rel: .05, send: .3, keys: [[tC5, 0], [tC5 + 3, .8], [1209.4, 1.2], [1209.6, 0]] });
    S.kill(1209.6, tC6a);
    S.pad('cello', tC6a + .2, tC7 + 1.5, [43, 50], .16, { fi: 2, fo: 2 });
    { const b0 = Math.round(c.b(tC6a + .5)); [[67, 1], [69, 1], [74, 1.5], [76, .5], [74, 1], [69, 3]].reduce((b, [m, n]) => { const tt = c.t(b); Z(tt, m, .3, { d: c.t(b + n) - tt + .15, vib: n > 1 }); return b + n; }, b0); }   // 问句，落在 A4
    [[1240.6, 67, 1.2], [1241.8, 69, 1.1], [1242.9, 74, 1.4], [1244.3, 76, 5.2]].forEach(([x, m, d], j, a) => { Z(x, m, j === 1 ? .36 : .33, { d: j === a.length - 1 ? d : undefined, vib: true }); if (j === 0) S.dan(x + .01, m - 12, .16, { exact: true }); S.theme.push({ t: x, m, d, label: 'C-06b 古筝问句（停在 E5 不解决）', inst: 'zheng' }); });
    chime(1243.4, 88, .08, { d: 1.5, send: .65 });                                                                   // 腕珠珠里一亮（v5 对点 C：旧 1251.9＝原 1243.4，原 1247.6 的旧腕珠镜作废）
    Z(tC7 + .5, 67, .36, { d: 7, env: [[0, 1], [3, .9], [5.5, .35], [7.2, 0]], send: .5 });                         // 主题尾音 G（散板）
    bell(tC7 + .5, 79, .3, { d: 2, send: .45 });   // 编钟按自然衰减（T60 6s），到片尾约 −75 dB
    S.mark(tC7 + .5, 'C-07 主题尾音');
  }

  /* 5-13 绝对电平与现片一致：全片其余声部整体压 REST_DB，整片归一到 −23 LUFS 后 5-13 自然回到现片的绝对响度（全片最强段，比积分响度高约 9 LU）。
     只缩放事件增益（合成层缩放 v），不改任何声部之间的相对平衡。 */
  /* v5 SND10 切点吸拍：快打Ⅲb/Ⅳ 的切点离鼓击 0.2–0.4s。离切点最近的十六分格加一记重音（堂鼓 .45、捂音钹 .3 交替），
     画面切点挪到该格（≤0.06s）由协调者合并时做（docs/revision-v5/sync/D.md）；999.5、1004.5（新秒）两刀夹 W194，只在刀上加鼓、不挪刀。原秒。 */
  S.cutAccents = [];
  [[clk2, 861.5], [clk2, 863.43], [clk2, 878.0], [clk2, 906.0], [clk9, 984.1], [clk9, 991.0, true], [clk9, 996.0, true]].forEach(([ck, x, exact], j) => {
    const tq = exact ? x : ck.t(Math.round(ck.b(x) * 4) / 4);
    if (j % 2 === 0) P('tomL', tq, .45, { tech: 'm', exact: true }); else P('nao', tq, .3, { tech: 'short', exact: true });
    S.cutAccents.push({ cut0: x, grid0: +tq.toFixed(3), shift: +(tq - x).toFixed(3) });
  });
  const REST_DB = -2.8, ATT = Math.pow(10, REST_DB / 20);
  for (const e of S.events) if (!e.keep513) { if (e.k === 's') e.v *= ATT; else e.gain = (e.gain == null ? 1 : e.gain) * ATT; }
  S.events.sort((x, y) => x.t - y.t);
  loopCheck(S);
  S.h = { ATT, P, nEv, Z, xun, stab, sub, bowed, bell, lun, drums, barsOf, hBar, clk4, ALL8 };   // 给 retime1024 补写用（只读出，不改上面任何事件）
  return S;
}
/* 自检：同一声部相邻音在两音间来回 ≥4 次（如 A3/D4 循环）即报错 */
function loopCheck(S) {
  const byInst = {};
  for (const e of S.events) if (e.k === 'n' && e.m != null && e.tech !== 'sao' && !e.trem && !(e.d > .8)) { const L = (byInst[e.i + (e.vo || '')] = byInst[e.i + (e.vo || '')] || []); if (!L.length || e.t - L[L.length - 1].t > .03) L.push(e); }   // 同时（30ms 内）的和弦音只取第一个
  for (const [i, list] of Object.entries(byInst)) {
    for (let k = 3; k < list.length; k++) {
      const [a, b, c2, d] = [list[k - 3], list[k - 2], list[k - 1], list[k]];
      const gs = [b.t - a.t, c2.t - b.t, d.t - c2.t];
      if (!process.env.NOLOOPCHK && d.t - a.t < 1.6 && Math.max(...gs) < 1.8 * Math.min(...gs) && a.m === c2.m && b.m === d.m && a.m !== b.m) throw new Error(`两音循环 ${i} ${a.m}/${b.m} @${a.t.toFixed(2)}: ` + list.slice(k - 6, k + 3).map((e) => e.m + "@" + e.t.toFixed(2)).join(" "));
    }
  }
}

/* ==================================================================================
   1024 观片反馈顺延（第三波 G）：CUES-v2 带 fb1024 时，先按 BEATSHEET 原时间轴（各 cue 的 T0）原样出谱——与 1022 定稿 master 逐事件相同——
   再把事件平移到新时间轴（原秒 <510 不动，510–950 +4.5，≥950 +8.5；任务 M 起＝第三波 G 的 +2.5／+6.5 再加任务 L 的 +2），只在四处重写：
   ① 2-10 杀弓手（300–312，时长不变）：撤旧 304.4 轮指、305.5 崩弦命中、309.5 远雷；补回旧命中保护挖掉的 305.5 拍头；
      305.9 轮指（丝颤；v5 305.55）→ 306.85 末一拍后鼓群停（前一拍收紧）→ 307.0 雷出天（v5：306.7 起落）：板鼓紧滚 → 307.3 板鼓＋大锣干裂命中 → 311.0 大鼓低滚远雷。
   ② 4-01 星君（新 500–514.5；任务 L：勾线 502.5 → 长成 506–509.4 → 停驻 → 清光 511 → 切虎辇 514.5）：502.5 勾线起云霄头句半句，每音 3 拍的舒展长音，
      G5 延到鼓进；下垫一层弦长音，长成起再添高弦与低弦（长成完成处古筝刮奏），低弦铺到切点；追踪织体照旧铺满；
      鼓进＝出光起 511（先一记大鼓、一记堂鼓，光到画右起接原鼓进句型渐强，♩120→124 自出光起渐快），514.5 接旧 510 起的虎辇（♩124）。
   ③ 5-06 化梦游仙（新 938.5–958.5）：撤木鱼逐闪渐密、框鼓脉动、埙气声；（任务 J，随任务 I 重做的画面）每次挪移消散起一记木鱼、由疏到密，
      末记大跨越梆子，余慈抬手古筝一声、停手埙一声；传讯长笛句照旧（同幕内秒），低弦长音铺到临界，27.62 戛然（带 tail 的硬停，混响尾一起切）。
   ④ 静音窗③（新 1026.0 起）收到 1027.75，1027.8 补一记极低堂鼓闷音，紧接 W184。
   万古云霄长卷（5-13）及其余各段只平移。 */
const off1024 = (t) => (t < 510 ? 0 : t < 950 ? 4.5 : 8.5);       // 原秒→新秒的平移量（4-01、5-06 窗内事件另行处理；须与 CUES fb1024.map 的整段平移一致，retime1024 开头自检）
function oldCues(cues) {
  const fb = cues.fb1024;
  return { duration: fb.duration0, acts: fb.acts0, cues: cues.cues.filter((c) => c.T0 != null).map((c) => ({ ...c, T: c.T0 })), hits: cues.hits.map((h) => ({ ...h, T: h.T0 })) };
}
function retime1024(S, cues) {
  const h = S.h, C = {};
  for (const c of cues.cues) C[c.id] = c.T;
  const T = (id) => { if (!(id in C)) throw new Error('缺 cue ' + id); return C[id]; };
  for (const [a, b, c, d] of cues.fb1024.map) if (Math.abs((b - a) - (d - c)) < 1e-9 && Math.abs(off1024((a + b) / 2) - (c - a)) > 1e-9) throw new Error(`off1024 与 fb1024.map 不一致 @${a}–${b}`);
  const inW = (t, a, b) => t >= a - 1e-6 && t < b - 1e-6;
  /* 1) 撤掉要重写的旧事件（原秒） */
  const drop = (e) =>
    (e.i === 'pipa' && e.tech === 'lun' && Math.abs(e.t - 304.4) < 1e-6) ||                  // ① 旧轮指
    inW(e.t, 305.38, 305.58) ||                                                                 // ① 旧崩弦命中（旧命中保护窗里只有它）
    (e.i === 'luo' && Math.abs(e.t - 309.5) < 1e-6) ||                                        // ① 旧远雷
    inW(e.t, 306.9, 307.38) ||                                                                  // ① 前一拍收紧＋新命中保护
    inW(e.t, 502.5, 510) || (inW(e.t, 500, 502.5) && (e.i === 'bowed' || (e.i === 'zheng' && e.d > .5))) ||   // ② 旧头句、502.5 起的旧织体
    (e.i === 'cello' && (e.m === 43 || e.m === 50) && inW(e.t, 926.1, 950) && e.d > 5) ||      // ③ 5-10→5-06 低弦长音（重铺）
    (inW(e.t, 934, 950) && e.i !== 'flute');                                                    // ③ 旧 5-06（只留传讯长笛句）
  S.events = S.events.filter((e) => !drop(e));
  S.marks = S.marks.filter((m) => !inW(m.t, 305.4, 305.6) && !inW(m.t, 934, 950));
  S.theme = S.theme.filter((x) => !inW(x.t, 500, 510));
  S.lunLog = S.lunLog.filter(([t0]) => Math.abs(t0 - 304.4) > 1e-6);
  /* 2) 平移 */
  for (const e of S.events) { const d = off1024(e.t); if (d) { e.t += d; if (e.genv) e.genv = e.genv.map(([x, g]) => [x + d, g]); } }
  for (const k of S.kills) { const d = off1024(k.t0); k.t0 += d; k.t1 += d; }
  S.muffle = S.muffle.map(([x, f]) => [x + off1024(x), f]);
  for (const m of S.marks) m.t = +(m.t + off1024(m.t)).toFixed(3);
  for (const x of S.theme) x.t = +(x.t + off1024(x.t)).toFixed(3);
  for (const x of S.sections) { const d = off1024(x.t0); x.t0 = +(x.t0 + d).toFixed(2); x.t1 = +(x.t1 + off1024(x.t1)).toFixed(2); }
  S.lunLog = S.lunLog.map(([t0, d]) => [+(t0 + off1024(t0)).toFixed(3), d]);
  S.duration = cues.duration; S.acts = cues.acts;
  /* 3) 新写（新秒；写完统一乘全片压低量 ATT，与上文一致） */
  const n0 = S.events.length, { P, Z, xun, stab, sub, bowed, lun, drums, barsOf, hBar, clk4, ALL8 } = h;
  {                                                                     // ① 2-10 杀弓手
    const hit = T('act2.H09'), bolt = T('act2.M-bolt'), far = T('act2.M-thunder');
    S.section('1024·2-10 杀弓手', 300, T('act2.2-11'), '种子 F 照旧；补回 305.5 拍头；305.9 轮指 0.95s（丝颤）；306.85 末一拍后鼓群停；307.0 雷出天＝板鼓四下紧滚、吸气；307.3 命中＝板鼓＋大锣干裂（干声短收）＋大鼓；311.0 远雷＝大鼓低滚');
    P('frameS', 305.387, .14, { tech: 'mute' }); P('frameS', 305.5, .22, { tech: 'mute' }); P('bd', 305.5, .52, { d: .5, rel: .3 }); stab(305.5, 43, .4);   // 旧命中保护挖掉的拍头（该小节 fBar 拍头低音 G2）
    lun(305.55, .95, 76, .44);                                                                                      // v5 对点 A：丝颤轮指随聚星提前（305.85→305.55），收在 306.5、落雷 306.7 之前
    [[-.3, .2], [-.22, .24], [-.15, .28], [-.08, .33]].forEach(([x, v]) => P('frameS', bolt + x, v, { tech: 'open', exact: true }));   // v5 对点 A：雷 306.7 起落，板鼓紧滚提前到落程里（306.7–306.95）
    S.kill(bolt, hit - .05, { tail: true });                                                                      // v5 对点 A（P2 第 1 条⑥）：307.0–307.25 鼓群停到 ≤−40 dB（落—顿—炸）
    P('frameL', hit, .78, { tech: 'open', exact: true }); P('frameS', hit + .004, .62, { tech: 'open', exact: true });
    P('luo', hit + .006, .72, { tech: 'main', exact: true, d: 1.3, rel: .45, send: .06 }); P('bd', hit, .82, { exact: true }); sub(hit, .4, { f0: 90, f1: 40, dec: .4 });
    [[307.43, 1], [307.5, .3], [307.57, 1], [307.63, .15], [307.7, .8]].forEach(([x, a], j) => { P('frameS', x, .1 + .2 * a, { tech: 'open', exact: true, pan: j % 2 ? .3 : -.2, send: .3 }); if (a > .5) P('nao', x + .003, .12 + .1 * a, { tech: 'short', exact: true, send: .35 }); });   // v5 对点 A：雷柱明灭 1/.3/1/.15/.8（act2 FLK210）＝雷鸣碎裂余响随明灭断续
    S.mark(306.7, '对点 A 落雷起'); S.mark(T('act2.M-bolt') + .2, '对点 A 雷到顶门（定 3 帧）');
    P('bd', far, .5, { tech: 'froll', d: 2.6, rel: 1.4, lp: 380, send: .45 }); sub(far, .22, { f0: 46, f1: 32, dec: 1.6, subD: 3 });
    S.mark(hit, 'H09 雷落顶门（板鼓＋大锣干裂）'); S.mark(far, '远雷（大鼓低滚）');
  }
  {                                                                     // ② 4-01 星君（任务 L：勾线 → 长成整幅 → 停驻 → 清光 → 切虎辇）：新时钟与旧 clk4 在 500 对齐拍号（追踪织体跨小节连续）
    const t401 = T('act3.4-01'), t402 = T('act3.4-02'), y1 = T('act3.M-yunxiao1'), dr = T('act3.DRUM'), g0 = T('act3.M-grow'), gW = T('act3.M-whole');
    const B0 = Math.round(clk4.b(t401)), cb = makeClock([[495, 120], [dr, 120], [t402, 124], [t402 + 8, 124]], [t401, t402]);   // 出光起才渐快：♩120→124 进虎辇
    const c = { b: (t) => B0 + cb.b(t), t: (x) => cb.t(x - B0) };
    S.section('1024·4-01 星君', t401, t402, `500–502.5 照旧；${y1} 勾线起云霄头句半句（G4 A4 D5 E5 各 3 拍，G5 延到鼓进），下垫小提琴组 G3/D4 长音；${g0} 长成起添高弦 B4/D5、低弦 G2/D3 渐强（弦长音停驻里不退、出光起才收，低弦铺到切点）；${gW} 长成完成古筝 G 宫刮奏上行；追踪邻音八分与板鼓照旧铺满；${dr} 出光起鼓进（一记大鼓、一记堂鼓，光到画右起接原鼓进句型渐强，♩120→124）；${t402} 切虎辇`);
    const k0 = S.events.length;
    for (const bar of barsOf(c, t401, t402)) { hBar(c, bar, -1, { span: 3, vA: .24, v: .17 }); drums(c, bar, [{ i: 'frameS', tech: 'mute', pos: ALL8, v: .13 }]); }
    const keep = S.events.slice(k0).filter((e) => e.t >= y1 - .03 && !(e.i === 'frameS' && e.t >= dr - .05));   // 502.5 前沿用旧事件；板鼓让位给鼓进
    S.events.length = k0; S.events.push(...keep);
    const bd = Math.round(c.b(dr) * 2) / 2, bE = B0 + Math.round(cb.b(t402));
    drums(c, { b0: bd - .5, len: 2.5 }, [{ i: 'bd', pos: [1], v: .5 }, { i: 'tomL', tech: 'm', pos: [4], v: .3 }]);   // v5 SND4：鼓进大鼓 .3→.5   // 出光起：门洞聚光一记大鼓，光头走出一记堂鼓
    P('bd', c.t(bd + 2), .42, { tech: 'froll', exact: true, d: t402 - c.t(bd + 2) - .05, rel: .08, gain: .9, env: [[0, .3], [t402 - c.t(bd + 2) - .1, 1.6]] });   // v5 SND4：光到画右起大鼓滚渐强进虎辇（514.5 约 −17）
    drums(c, { b0: bd + 2, len: bE - bd - 2 }, [{ i: 'bd', pos: [1, 4, 8], v: .5, cres: .6 }, { i: 'tomL', tech: 'm', pos: [3, 6, 7, 9], v: .4, cres: .7 }, { i: 'frameS', tech: 'mute', pos: [2, 5, 8, 8.5, 9, 9.5], v: .22, cres: 1 }]);   // v5 SND4：鼓进句型加强，514.5 约 −17   // 光到画右起：原鼓进句型（4.5 拍渐强）接虎辇
    let b = Math.round(c.b(y1));
    for (const [m, n] of [[67, 3], [69, 3], [74, 3], [76, 3], [79, bd - b - 12]]) {
      const tt = c.t(b), d = c.t(b + n) - tt, top = m === 79;
      bowed(tt, m, d + .2, .2, { att: .3, rel: top ? 1.6 : .35, send: .42 }); Z(tt, m, .3, { d: Math.min(d, 1.6), vib: true });
      S.theme.push({ t: +tt.toFixed(3), m, d: +d.toFixed(3), label: '4-01 云霄头句（半句，停在 G5；1024 勾线起，舒展）', inst: 'bowed+zheng' });
      b += n;
    }
    S.pad('bowed', y1, dr + 1.4, [55, 62], .06, { fi: 2.5, fo: 1.4 });                                                         // 停驻里不退，出光起才收
    S.pad('bowed', g0, t402 + .3, [71, 74], .09, { fi: 2.2, fo: .4, genv: [[g0, 1], [gW, 1.6], [dr, 1.8], [t402, 2.6]] });   // v5 SND4：高弦 1.35→1.8，出光后续涨到切点                // 长成：高弦 B4/D5 随宫阙长成渐强，托住 G5，停驻里持平
    S.pad('cello', g0 + .3, t402, [43, 50], .18, { fi: 2.5, fo: .8, genv: [[g0, 1], [gW, 2.0], [dr, 2.4], [t402, 4]] });   // v5 SND4：低弦 1.3→2.0，出光后再涨到切点                   // 云海自宫基下漫：低弦 G2/D3，铺过停驻与清光到切点
    S.gliss(gW - .55, .55, 62, 84, .4, { key: 67, mode: 'gong', v1: .55, curve: .8, send: .45 });                               // v5 SND4：刮奏 .2/.32→.4/.55
    h.bell(gW, 79, .42, { d: 4, send: .5 });                                                                                     // v5 SND4：编钟 G5 单音（仍是预影）；509.4＝软命中 H43
    S.inhale(dr, .36, { d: dr - gW, lp: 8000 });                                                                                  // v5 SND4：509.4–511 反向钹吸气收在出光                               // 长成完成：古筝 G 宫刮奏上行（D4→B5）
    S.mark(y1, '4-01 云霄头句（勾线起）'); S.mark(gW, '4-01 长成完成（古筝刮奏）'); S.mark(c.t(bd), '4-01 鼓进（出光起）');
  }
  {                                                                     // ③ 5-06 化梦游仙（1024 任务 I 重做；挪移秒表＝CUES act5.M-shift1…15、M-leap，取消散起）
    const cut = T('act5.M-snap'), leap = T('act5.M-leap');
    S.section('1024·5-06 化梦游仙', T('act5.5-06'), T('act5.5-07'), '散板：传讯长笛句照旧；每次挪移消散起一记木鱼（15 记，间隔 2.8→0.42s 由疏到密、渐强，声像随赵左右来回），末记大跨越换梆子；临界四顶各一记闷框鼓（P3-4）；抬手古筝一声（D5 按弦上滑到 E5）、停手埙一声 A3；低弦 G2/D3 长音自 5-10 铺到临界、末段渐强；27.62 戛然：干声与混响尾一起切，静 0.38s 接 5-07');
    S.pad('cello', T('act5.5-10') + .2, cut + .3, [43, 50], .2, { fi: 1.5, fo: .05, genv: [[T('act5.M-shift4'), 1], [leap, 1.4], [cut, 2.8]] });
    const X6 = [1180, 800, 1330, 960, 1300, 900, 1420, 820, 1500, 780, 1540, 770, 1550, 760, 1560];   // 每次消散处脚底 x（act5.js 起点 ZP0，其后为上一次 MV6 凝回处；底图 1920 宽）
    X6.forEach((x, j) => P('slit', T('act5.M-shift' + (j + 1)), j < 3 ? [.22, .2, .22][j] : .22 + .12 * (j - 2) / 12, { tech: 'hi', exact: true, pan: Math.max(-.4, Math.min(.4, (x - 1150) / 1050)) }));
    P('bang', leap, .38, { exact: true, pan: -.05 });
    [0, .70, 1.26, 1.66].forEach((dx, j) => {                           // P3-4 闷框鼓：赵每往外顶一次虚空边缘（act5.js PUSH6＝HIT6 25.62 起四顶）补一记捂音大框鼓＋极低闷震，一记比一记重、越挨越近（原著 L78091「以连续的小挪移积蓄力量，击破虚空屏障」）
      const tp = +(cut - 2 + dx).toFixed(3);
      P('frameL', tp, .3 + .05 * j, { tech: 'mute', exact: true, lp: 1100, send: .1, pan: -.08 });
      sub(tp, .14 + .03 * j, { f0: 58, f1: 34, dec: .28, subD: .6 });
      S.mark(tp, `5-06 第 ${j + 1} 顶（闷框鼓）`);
    });
    Z(T('act5.M-raise'), 74, .3, { d: 1.8, bend: [[0, 0], [.3, 0], [.55, 2]], send: .5 });
    xun(T('act5.M-stay'), 57, 1.3, .3, { att: .08, rel: .4, env: [[0, 1], [.5, .55], [1.3, 0]] });
    S.kill(cut, T('act5.5-07'), { tail: true });                        // 戛然：窗前的声音与混响尾一起切断，窗后也不回涌
    S.mark(cut + .38, '对点 C2 戛然后纸白'); S.mark(959.32, '对点 C2 墨晕起显');   // v5 对点 C2：画面 956.12 戛然、纸白 .4s、删 956.52–959.3；两个对点让 splice-fit 的配乐删点贴着画面删点（静 .4s 后接 5-07）
    S.mark(T('act5.M-shift1'), '5-06 第 1 次挪移（木鱼）'); S.mark(leap, '5-06 末记大跨越（梆子）'); S.mark(cut, '5-06 临界戛然');
    S.mark(T('act5.M-raise'), '5-06 抬手（古筝）'); S.mark(T('act5.M-stay'), '5-06 停手（埙）');
  }
  {                                                                     // ④ 静音窗③收短，补堂鼓闷音
    const tg = T('act5.M-tanggu'), k3 = S.kills.find((k) => Math.abs(k.t0 - T('act5.SIL-3')) < 1e-6);
    if (!k3) throw new Error('缺静音窗③');
    k3.t1 = +(tg - .05).toFixed(3);
    P('tomL', tg, .42, { tech: 'm', exact: true, lp: 320, d: .45, rel: .2, send: .1 }); sub(tg, .26, { f0: 52, f1: 30, dec: .45, subD: .9 });   // 尾音收在 5-13 入点（0.7s 后）之前
    S.section('1024·5-12 静音窗③', T('act5.SIL-3'), T('act5.5-13'), `${T('act5.SIL-3')}–${k3.t1} 完全静音；${tg} 极低堂鼓闷音（捂音、低通），紧接 W184 呻吟；5-13 长卷入点不动（相对画面）`);
    S.mark(tg, '静音窗末堂鼓闷音');
  }
  for (let k = n0; k < S.events.length; k++) { const e = S.events[k]; if (e.k === 's') e.v *= h.ATT; else e.gain = (e.gain == null ? 1 : e.gain) * h.ATT; }
}
export function buildScore(cues) {
  if (!cues.fb1024) return buildV4(cues);
  const S = buildV4(oldCues(cues));
  retime1024(S, cues);
  S.events.sort((x, y) => x.t - y.t);
  loopCheck(S);
  return S;
}
