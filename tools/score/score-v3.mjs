/* 《万古云霄》配乐 v3 乐谱（按 docs/MUSIC.md 作曲方案落谱，不作曲）。
   定位：一律「幕起点 + 幕内拍 cue」（S.T('act5.5-13')），不写全片秒；act5/coda 尚未落拍时用幕任务拍表的幕内偏移兜底。
   调性：全片 G 宫五声（G A B D E）；毒鳄动机里的 F、C♯ 只出现在埙。
   声部分工：古筝＝叙述与余慈；大提琴/小提琴组＝重量与张力；大鼓/锣/钹/军鼓＝推进；长笛＝远方与传讯；
             越南筝＝细光；琵琶＝杀局；埙＝赵相山；编钟/磬＝道境（编钟在 5-13 之前只作单音预影）。 */
import { makeScore, deg } from './lib.mjs';

export function buildScore(cues) {
  const S = makeScore(cues);
  const G = 67;                                          // G4；G 宫五声：G A B D E
  const B60 = 1, B96 = 60 / 96, B56 = 60 / 56;           // 叙事／杀局／道境拍长
  const A = (id) => S.act(id);

  /* act5/coda 的拍表落定前的兜底（幕内秒，取自 docs/tasks/T15-act5.md、T16-coda.md；有 cue 时 cue 优先） */
  const OFF5 = { '5-01': 0, '5-02': 22, '5-03': 34, '5-04': 56, '5-05': 76, '5-06': 92, '5-07': 112, '5-08': 124,
    '5-09': 148, '5-10': 160, '5-11': 178, '5-12': 196, '5-13': 206, '5-14': 246, '5-15': 262, '5-16': 278 };
  const OFFC = { 'C-01': 0, 'C-02': 12, 'C-03': 36, 'C-04': 48, 'C-05': 73, 'C-06': 79, 'C-07': 98 };
  const at = (a, n, d) => {
    const act = A(a), off = a === 'act5' ? OFF5[n] : a === 'coda' ? OFFC[n] : null;
    return S.T(a + '.' + n, d != null ? d : (act && off != null ? act.start + off : undefined));
  };
  const T = (a, n) => at(a, n);

  /* 低弦铺底：每段默认一条，G2/D3 或 C3/G3，力度 .25–.35，起音 1.5s、释放 2s */
  const bed = (t0, t1, ms, v, o = {}) => { if (t1 - t0 > .4) S.pad('cello', t0, t1, ms, v, { fi: 1.5, fo: 2, ...o }); };

  /* 云霄主题（G 宫，4/4，♩=60）：压抑形只奏前四音、停在 E5 不落 */
  const YA = [[0, 1], [2, 1], [7, 1], [9, 3]];           // 相对 G4：G A D E，末音长留
  const YA5 = [[0, 1], [2, 1], [7, 1], [9, 1], [12, 2]]; // 再上半句 G5 ––
  const YA_FULL = [[0, 1], [2, 1], [7, 1], [9, 1], [12, 2], [14, 1], [12, 1], [9, 1], [7, 1], [9, 1], [2, 1], [0, 4]];
  const beat = (o, k, b) => o + k * b;
  /* 主题谱面：返回末音起点，theme 记录供自检 */
  function yaLine(t0, base, ls, fn, b = B60, label = '', inst = 'zheng') {
    let t = t0;
    ls.forEach(([iv, len], j) => {
      const m = base + iv, d = len * b, last = j === ls.length - 1;
      fn(t, m, d, j, last);
      S.theme.push({ t: +t.toFixed(3), m, d: +d.toFixed(3), label, inst });
      t += d;
    });
    return t;
  }
  const press = (t0, v = .45, hold = 3, label = '云霄主题·压抑形') => yaLine(t0, G, [[0, 1], [2, 1], [7, 1], [9, hold]], (t, m, d, j, last) => {
    S.z(t, m, v * (j === 1 ? 1.03 : .95), { vib: true, exact: true, d: last ? d + 1.2 : undefined });
    if (j === 0) S.dan(t + .01, m - 12, v * .45, { exact: true });
  }, B60, label);
  const half5 = (t0, v = .5, label = '云霄主题·压抑形＋半句') => yaLine(t0, G, YA5, (t, m, d, j, last) => {
    S.z(t, m, v * (j === 1 ? 1.03 : .95), { vib: true, exact: true, d: last ? d + 1.5 : undefined });
    if (j === 0) S.dan(t + .01, m - 12, v * .45, { exact: true });
  }, B60, label);

  /* T09 新增乐器不在 lib.mjs 的 RANGE 表里：直接写事件，绕开 S.note 的音域折叠 */
  const nEv = (i, t, m, v, o = {}) => S.ev({ k: 'n', i, t, m, v, gain: o.gain || 1, pan: o.pan == null ? 0 : o.pan, send: o.send == null ? .3 : o.send,
    d: o.d, att: o.att, rel: o.rel, off: o.off, env: o.env, genv: o.genv, bend: o.bend, vib: o.vib, lp: o.lp, mf: o.mf, rr: o.rr });
  const pipaNote = (t, m, v, o = {}) => nEv('pipa', t, m, v, { pan: -.25, send: .2, ...o });

  /* 毒鳄动机（埙，低）：F4↘D4 | C♯4 – C4 – | B3 ––––，随剧情碎化 */
  const xunNote = (t, m, d, v, o = {}) => nEv('xun', t, m, v, { d, att: .06, rel: .15, send: .38, ...o });
  const croc = (t0, v = .6, opt = {}) => {
    xunNote(t0, 65, .5, v, { bend: [[0, 0], [.35, 0], [.5, -200]] });           // F4 音头后下滑到 D4
    xunNote(t0 + .5, 62, 1, v);
    xunNote(t0 + 1.5, 61, 1, v);                                               // C♯4
    xunNote(t0 + 2.5, 60, 1, v);                                               // C4
    xunNote(t0 + 3.5, 59, opt.tail || 4, v, { att: .08, env: [[0, 1], [Math.max(1, (opt.tail || 4) * .55), 1], [opt.tail || 4, 0]] });
  };

  /* ======================= 冷开场＋前情 ======================= */
  {
    const p1 = T('prologue', 'P-01'), p2 = T('prologue', 'P-02'), p3 = T('prologue', 'P-03'), p4 = T('prologue', 'P-04');
    const end = A('act1').start;
    S.section('冷开场', p1, p2, '水滴三次；水镜亮时埙一声 D4 长音；其余全静');
    [2.0, 5.0, 8.0].forEach((dt, j) => {
      S.dan(p1 + dt, j === 1 ? 79 : 84, .2, { exact: true, d: .18, rel: .12, send: .62, pan: j === 1 ? .2 : -.14 });
      nEv('chime', p1 + dt + .01, j === 1 ? 84 : 88, .12, { d: .5, rel: .3, send: .7 });
    });
    xunNote(p1 + 6.0, 62, 4.5, .28, { att: .3, rel: .8, send: .5 });             // 水镜亮：D4 长音（毒鳄影子）
    S.section('前情', p2, end, '古筝散板（G 宫）；「后圣」处越南筝一声高音；推入水榭长音铺底；P-03 云霄压抑形');
    bed(p2 + .6, p4, [43, 50], .28, { fi: 2.5, fo: 2 });
    [[1.2, 55, .3], [4.0, 62, .27], [6.8, 57, .29], [9.4, 64, .26]].forEach(([dt, m, v], j) => S.z(p2 + dt, m, v, { vib: j === 2, exact: true, d: 2.5 }));
    press(p3 + 1.0, .45, 3, '前情·P-03 云霄压抑形');
    S.dan(p3 + 8.7, 84, .3, { vib: true, exact: true, d: 3, send: .5 });         // 「后圣」：越南筝一声高音
    bed(p4, end, [48, 55], .3, { fi: 2, fo: 2 });
    S.z(p4 + 1.0, 55, .26, { vib: true, exact: true, d: 4 });
    S.mark(p1 + 6.0, '水镜亮（埙 D4）');
  }

  /* ======================= 一 · 毒刺 ======================= */
  {
    const a = 'act1';
    const t01 = T(a, '1-01'), t02 = T(a, '1-02'), t03 = T(a, '1-03'), t04 = T(a, '1-04'), t05 = T(a, '1-05'),
      t06 = T(a, '1-06'), t07 = T(a, '1-07'), t08 = T(a, '1-08'), t09 = T(a, '1-09'), t10 = T(a, '1-10'),
      t11 = T(a, '1-11'), t12 = T(a, '1-12'), end = A('act2').start;
    S.section('一·对话', t01, t03, '古筝低回、稀疏；1-01 云霄压抑形；1-02 一记刮奏如剑出鞘；1-03 风声起、乐器全退');
    bed(t01 + .4, t03 + 1.5, [43, 50], .28, { fi: 2, fo: 1.5 });
    press(t01 + 1.5, .4, 2.5, '一·1-01 云霄压抑形');
    S.gliss(t02 + 1.6, .5, 55, 79, .46, { key: G, mode: 'gong', v1: .6, curve: .9 });
    S.z(t02 + 1.6, 55, .24, { exact: true, d: 2, vib: true });
    S.noise(t03, t04 - t03 + .8, .3, { f: 900, q: .6, white: .25, gust: .5, att: 2.2, rel: 1, send: .35 });
    S.section('一·刺杀', t04, t10, '琵琶一声扫；1-05 低弦长音被音高滑落；1-07 琵琶轮指＋弦爆；1-08 低频嗡；1-10 大鼓三击递进');
    pipaNote(t04 + .05, 57, .56, { tech: 'sao', chord: [50, 57, 62, 69], send: .22, pan: -.25 });
    S.cello(t04, 43, 3.5, .34, { att: .4, rel: 1.2 });
    S.sub(t04 + .2, .25, { f0: 90, f1: 40, dec: .8, subD: 2.2 });
    const d5 = t06 - t05;
    S.cello(t05, 43, d5 + .2, .44, { att: 1.2, rel: 1.6, bend: [[0, 0], [Math.max(1, d5 - 2.5), 0], [d5, -1.4]] });
    S.cello(t05 + .15, 50, d5, .3, { att: 1.2, rel: 1.6, bend: [[0, 0], [Math.max(1, d5 - 2.5), 0], [d5, -1.4]] });
    bed(t06, t07 + 1, [48, 55], .26, { fi: 1.5, fo: 1.5 });
    S.drum(t06 + 1.0, .3, { lp: 900, sub: .18 });
    // 1-07 琵琶杀局：A3/D4 交替 16 分，4 小节；弦爆音
    const p0 = t07 + .6, step = B96 / 4, n = Math.round(4 * 4 * 4);
    for (let k = 0; k < n; k++) pipaNote(p0 + k * step, k % 2 ? 62 : 57, .5, { exact: true, d: .12, rel: .02, send: .2, pan: -.25 });
    for (let k = 0; k < 4 * 4; k++) S.snare(p0 + k * B96, .16, { lp: 5200, send: .2 });
    S.cym(t07 + 1.0, .42, { lp: 7000 }); S.cello(t07 + 1.0, 43, 2.5, .42, { sfz: true, rel: 1.2 });
    bed(t07 + .2, t08, [43, 50], .26, { fi: .8, fo: .8 });
    // 1-08 秘阵光波：低频嗡＋大提琴泛音
    S.sub(t08 + .2, .5, { f0: 74, f1: 36, dec: 2.6, subD: 6.5 });
    S.cello(t08 + .5, 55, 5.5, .24, { att: 2, rel: 2, lp: 2800, send: .45 });
    S.bowed(t08 + .8, 79, 4.5, .13, { att: 2, rel: 2, lp: 6000, send: .55 });
    // 1-09 刺客炸开：闷爆
    S.drum(t09 + .1, .62, { lp: 650, sub: .45 }); S.gong(t09 + .1, .3, { rate: .8, d: 4, rel: 2 });
    S.cym(t09 + .12, .32, { lp: 3500 }); S.cello(t09 + .1, 38, 2, .4, { sfz: true, rel: 1.2 });
    // 1-10 大鼓三击递进、每击更近
    [1.0, 5.2, 9.4].forEach((dt, j) => { S.drum(t10 + dt, .5 + .13 * j, { lp: 1000 + 1200 * j, sub: .3 + .12 * j }); S.cello(t10 + dt, 43, 1.4, .3 + .05 * j, { sfz: true, rel: .8 }); });
    bed(t10 + .3, t11, [43, 50], .27, { fi: 1.2, fo: 1 });
    S.section('一·天外音', t11, end, '天外音十转（高泛音逐转，连成一长音）；1-12 琉璃碎（越南筝刮＋钹反向）→ 骤静');
    bed(t11, t12 + 2, [43, 50], .25, { fi: 1.5, fo: 1.5, send: .1 });
    const rings = [2.0, 3.3, 4.6, 5.9, 7.2, 8.5, 9.8, 11.1, 12.4, 13.7];
    const ringP = [79, 81, 83, 84, 86, 88, 91, 93, 91, 88];
    rings.forEach((dt, j) => {
      const tt = t11 + dt, d = Math.min(14, Math.max(5, t12 + 3 - tt));
      const m = ringP[j];
      if (m >= 86) S.flute(tt, m, d, .2 + .012 * j, { att: .35, rel: 1.8, lp: 12000, send: .6 });
      else S.dan(tt, m, .22 + .012 * j, { exact: true, d, att: .12, rel: 1.4, send: .6 });
      S.z(tt + .02, 74, .1, { exact: true, d: 1.2, rel: .4, send: .6, pan: .2 });
      S.mark(tt, '天外音第' + (j + 1) + '转');
    });
    S.inhale(t12 + 1.0, .5, { lp: 9000 });
    S.gliss(t12 + 1.0, .55, 84, 62, .5, { inst: 'dan', key: G, mode: 'gong', curve: 1.2, v1: .38, send: .4 });
    S.note('dan', t12 + 1.05, 79, .4, { exact: true, d: .5, rel: .1, send: .5 });
    S.kill(t12 + 2.0, t12 + 5.0);                                                 // 琉璃碎后骤静
    bed(t12 + 5.0, end, [43, 50], .18, { fi: 2, fo: 2, send: .1 });
    S.mark(t12 + 1.0, '1-12 琉璃碎');
  }

  /* ======================= 二 · 暗室 ======================= */
  {
    const a = 'act2';
    const t01 = T(a, '2-01'), t02 = T(a, '2-02'), t03 = T(a, '2-03'), t04 = T(a, '2-04'), t05 = T(a, '2-05'),
      t06 = T(a, '2-06'), t07 = T(a, '2-07'), t08 = T(a, '2-08'), t09 = T(a, '2-09'), t10 = T(a, '2-10'),
      t11 = T(a, '2-11'), t12 = T(a, '2-12'), end = A('act3').start;
    S.section('二·浮尸→咒印', t01, t06, '埙毒鳄动机首现（完整）＋大提琴 D2；铁索＝锣轻刮＋低鼓；冰裂＝越南筝高音拨弦簇，后鼓停；咒音＝小提琴组极低不协和簇');
    bed(t01, t06, [38], .3, { fi: 1.5, fo: 2 });
    croc(t01 + 1.0, .6);
    S.sub(t02 + 2.0, .3, { f0: 80, f1: 40, dec: 1.6, subD: 4 });
    S.cello(t02 + 2.0, 50, 8, .26, { att: 1.5, rel: 2 });
    S.gong(t03 + 1.0, .22, { rate: 1.6, d: 3.5, rel: 2, send: .55 });              // 铁索：锣轻刮
    S.drum(t03 + 1.2, .3, { lp: 420, sub: .2 }); S.drum(t03 + 2.0, .2, { lp: 380 });
    S.strum(t04 + 1.0, [76, 79, 81, 84], .42, { inst: 'dan', spread: .045, send: .45 });   // 冰裂
    S.dan(t04 + 1.25, 86, .2, { exact: true, d: .3, rel: .2, send: .5 });
    S.pad('bowed', t05, t06, [53, 54], .18, { fi: 4, fo: 2, seg: 6, xf: 1.5 });     // 咒音：极低不协和簇
    S.pad('cello', t05, t06, [43, 44], .14, { fi: 4, fo: 2 });
    S.section('二·暗室→替死鬼', t06, end, '埙动机完整＋大提琴 D2；孙的狂喜＝不稳军鼓碎点；冰刀高音；弦爆＋远雷；2-11 骤静；2-12 埙下行落 B3');
    bed(t06, t10, [38], .3, { fi: 2, fo: 2 });
    croc(t06 + 2.0, .58, { tail: 4.5 });
    S.snare(t08 + 1.0, .16, { lp: 4800 }); S.snare(t08 + 2.4, .2, { lp: 4600 }); S.snare(t08 + 3.1, .14, { lp: 5000 });
    S.snare(t08 + 5.2, .18, { lp: 4400 }); S.snare(t08 + 7.0, .15, { lp: 4800 }); S.snare(t08 + 8.6, .2, { lp: 4200 });
    S.snare(t08 + 10.5, .13, { lp: 5000 }); S.snare(t08 + 12.1, .18, { lp: 4600 }); S.snare(t08 + 14.2, .12, { lp: 5200 });
    S.note('bowed', t09 + 1.0, 79, .24, { att: .08, d: 6, rel: 1.4, vib: { f: 8.2, c: 34, at: .05, ramp: .25 }, send: .4 });   // 冰刀高音
    S.strum(t10 + 1.0, [43, 50, 57, 62], .52, { spread: .02 });
    S.drum(t10 + 1.0, .7, { lp: 1600, sub: .55 });
    S.gong(t10 + 1.05, .45, { rate: .48, d: 7, rel: 3, send: .55 });               // 远雷：锣降速
    S.cym(t10 + 1.02, .3, { lp: 5000 });
    bed(t10 + 2, t11, [38], .26, { fi: .5, fo: .3 });
    S.kill(t11 + .2, t11 + 2.6);                                                   // 2-11 骤静
    bed(t12 + .3, end, [48, 55], .26, { fi: 2, fo: 2 });
    xunNote(t12 + 1.0, 65, .8, .55, { bend: [[0, 0], [.3, 0], [.8, -200]] });
    xunNote(t12 + 1.8, 62, .9, .55);
    xunNote(t12 + 2.7, 60, .9, .55);
    xunNote(t12 + 3.6, 59, 3.5, .55, { att: .1, env: [[0, 1], [2, 1], [3.5, 0]] });
  }

  /* ======================= 三 · 无明 ======================= */
  {
    const a = 'act3';
    const t01 = T(a, '3-01'), t02 = T(a, '3-02'), t03 = T(a, '3-03'), t04 = T(a, '3-04'), t05 = T(a, '3-05'),
      t06 = T(a, '3-06'), t07 = T(a, '3-07'), t08 = T(a, '3-08'), t09 = T(a, '3-09'), t10 = T(a, '3-10'),
      t11 = T(a, '3-11'), end = A('act4').start;
    S.section('三·压抑', t01, t05, '低弦压抑铺底；3-03 远处空洞掌声（鼓边敲击、大混响）；3-04 一声低磬（预影）');
    bed(t01, t05, [43, 50], .27, { fi: 2.5, fo: 2, genv: [[t01, .85], [t03, 1], [t04, .9], [t05, 1.05]] });
    S.pad('cello', t02, t04, [48, 55], .18, { fi: 2, fo: 2 });
    [2.0, 3.5, 5.0, 6.2, 8.0, 9.4, 11.0, 12.5, 14.0, 15.5, 17.0, 18.5].forEach((dt, j) => {
      S.drum(t03 + dt, .1 + .015 * (j % 3), { lp: 2600, send: .72, d: .12, pan: j % 2 ? .25 : -.2 });
    });
    S.ev({ k: 'p', i: 'qing', t: t04 + 1.0, v: .4, m: 55, send: .5, pan: .1 });    // 磬的预影（低）
    S.section('三·无明火', t05, t06, '低弦＋大鼓从极弱渐强；古筝摇指在 G 宫最低音；余慈笑时一切停');
    const d5 = t06 - t05;
    S.pad('cello', t05, t06 - 1.2, [43, 50], .3, { fi: 2, fo: .6, send: 0, genv: [[t05, .5], [t05 + d5 * .5, .85], [t06 - 3, 1.25], [t06 - 1.2, 1.35]] });
    S.roll(t05 + 2, t06 - 2.0, .05, .5, { rate: [5, 12], lp: 1800, send: 0 });
    S.trem(t05 + 3, t06 - 2.0, 55, .1, .46, { rate: [7, 13], cut: true, send: 0 });
    for (let k = 0; k < 12; k++) S.drum(t05 + 2 + k * ((d5 - 4) / 12), .12 + .035 * k, { lp: 600 + 200 * k, sub: k > 8 ? .2 : 0, send: 0 });
    S.mark(t06 - .2, '余慈笑：一切停');
    S.section('三·吼', t06, t08, '3-06 声场全抽空，只剩极低嗡（渐弱到 0）；3-07 情绪浪潮＝鼓一圈圈由近及远；3-08 全片第一次全奏强音，短促');
    // 3-06：只留极低嗡，逐渐淡到 0（窗口内 RMS 约 −50 dB）
    S.cello(t06 + .05, 43, t07 - t06, .2, { att: 3, rel: 2.5, lp: 220, send: 0, exact: true, gain: .45, genv: [[t06, 1], [t06 + 3, .9], [t07, 0]] });
    S.mark(t06, '3-06 声场全抽空');
    [0.5, 2.0, 4.0, 6.5, 9.0].forEach((dt, j) => {
      S.drum(t07 + dt, .62 - .1 * j, { lp: 2200 - 350 * j, send: .35 + .14 * j, d: 2.2, sub: j === 0 ? .35 : 0 });
    });
    bed(t07, t08, [43, 50], .24, { fi: 1.5, fo: 1 });
    // 3-08 全奏：短促一击，随后云霄压抑形由低弦八度奏出
    S.gong(t08 + .3, .62, { rate: .95, d: 5, rel: 2.5 });
    S.drum(t08 + .3, .88, { lp: 3200, sub: .7 });
    S.cym(t08 + .31, .5, { lp: 8000 });
    S.cello(t08 + .3, 43, 2.2, .6, { sfz: true, rel: 1.2 });
    S.cello(t08 + .3, 55, 2.2, .55, { sfz: true, rel: 1.2 });
    S.bowed(t08 + .3, 55, 2.2, .4, { sfz: true, rel: 1.2 });
    yaLine(t08 + 1.2, G - 24, [[0, 1], [2, 1], [7, 1], [9, 2.6]], (t, m, d, j, last) => {
      S.cello(t, m, d + .3, .7, { att: .05, rel: .5, off: .3 });
      S.cello(t, m + 12, d + .3, .5, { att: .05, rel: .5, off: .3 });
      S.bowed(t, m + 12, d + .3, .55, { att: .05, rel: .5, off: .3 });
    }, B60, '三·3-08 云霄压抑形（低弦八度）', 'cello+bowed');
    S.section('三·剑意', t09, t10, '玄黄动机（D A G A C|D）原样速度；小提琴组高音剑吟托底；古筝奏出');
    bed(t09 + .5, t10, [43, 50], .24, { fi: 2, fo: 2 });
    S.pad('bowed', t09 + .5, t10, [74, 76], .18, { fi: 3, fo: 3, seg: 7 });
    S.themeAt('三·玄黄动机', t09 + 1.0, .95, 62, 'a', 'zheng', (tt, m, d, j, last) => {
      S.z(tt, m, j === 1 ? .58 : .5, { vib: d > .7, exact: true, d: last ? d + 2 : undefined });
    });
    S.section('三·锁定', t10, end, '越南筝细光音描写「后圣」细烟；3-11 埙在暗室爆毁时被截断，接云霄主题前两音（长笛）');
    bed(t10, t11, [43, 50], .22, { fi: 2, fo: 2 });
    [[1.0, 84], [3.4, 81], [5.8, 79], [8.2, 84], [10.6, 81], [13.0, 79], [15.4, 84]].forEach(([dt, m], j) => {
      S.dan(t10 + dt, m, .2 + .01 * (j % 2), { exact: true, vib: true, d: 2.2, send: .5, pan: j % 2 ? .3 : -.25 });
    });
    bed(t11, end, [43, 50], .2, { fi: 2, fo: 2 });
    xunNote(t11 + 1.0, 65, .35, .5); xunNote(t11 + 1.35, 62, .35, .5);
    S.kill(t11 + 1.7, t11 + 2.2);                                                  // 被截断
    S.flute(t11 + 2.6, 67, 3.5, .34, { att: .25, rel: 1.4, send: .4 });
    S.flute(t11 + 3.8, 69, 4.5, .34, { att: .25, rel: 1.8, send: .4 });
    S.theme.push({ t: +(t11 + 2.6).toFixed(3), m: 67, d: 3.5, label: '三·云霄主题前两音', inst: 'flute' });
    S.theme.push({ t: +(t11 + 3.8).toFixed(3), m: 69, d: 4.5, label: '三·云霄主题前两音', inst: 'flute' });
  }

  /* ======================= 四 · 千里 ======================= */
  {
    const a = 'act4';
    const t01 = T(a, '4-01'), t02 = T(a, '4-02'), t03 = T(a, '4-03'), t04 = T(a, '4-04'), t05 = T(a, '4-05'),
      t06 = T(a, '4-06'), t07 = T(a, '4-07'), t08 = T(a, '4-08'), t09 = T(a, '4-09'), t10 = T(a, '4-10'),
      t11 = T(a, '4-11'), t12 = T(a, '4-12'), t13 = T(a, '4-13'), t14 = T(a, '4-14'), t15 = T(a, '4-15'),
      t16 = T(a, '4-16'), t17 = T(a, '4-17'), t18 = T(a, '4-18'), t19 = T(a, '4-19'), end = A('act5').start;
    S.section('四·虎辇', t01, t05, '4-01 云霄压抑形＋半句 G5；4-02 大鼓行进（虎啸处锣）；4-04 长笛一句');
    bed(t01, t04, [43, 50], .28, { fi: 2, fo: 2 });
    half5(t01 + 1.0, .5, '四·4-01 云霄压抑形＋半句');
    for (let k = 0; k < 16; k++) S.drum(t02 + 1.0 + k * B60, k % 4 === 0 ? .4 : .27, { lp: 1500 + (k % 4) * 250, sub: k % 4 === 0 ? .18 : 0 });
    S.gong(t02 + .3, .4, { rate: 1.1, d: 5, rel: 2.5 });                            // 虎啸处锣
    bed(t03, t04, [48, 55], .24, { fi: 2, fo: 1.5 });
    S.flute(t04 + .5, 74, 1.2, .28, { att: .15, rel: .5, send: .4 });
    S.flute(t04 + 1.7, 79, 1.6, .3, { att: .15, rel: .6, send: .4 });
    S.flute(t04 + 3.3, 76, 2.0, .28, { att: .15, rel: .8, send: .4 });
    S.section('四·破咒', t05, t09, '鼓连击＋锣；雷雨＝军鼓滚奏＋钹；4-07 一记锣；4-08 低弦下行');
    bed(t05, t09, [43, 50], .26, { fi: 2, fo: 2, genv: [[t05, .9], [t06, 1.05], [t07, 1], [t08, .95]] });
    S.roll(t05 + .5, t05 + 20, .08, .5, { rate: [6, 11], lp: 2000 });
    S.gong(t05 + 1.0, .38, { rate: .85, d: 6, rel: 2.5 });
    S.gong(t05 + 10.0, .32, { rate: .7, d: 7, rel: 3 });
    S.roll(t05 + 12, t05 + 20, .12, .38, { rate: [8, 14], inst: 'snare', lp: 6000, send: .3 });
    S.cym(t05 + 20, .4, { lp: 9000 });
    bed(t06, t07, [43, 50], .23, { fi: 1.5, fo: 1.5 });
    S.gong(t07 + 1.0, .5, { rate: .7, d: 7, rel: 3 });
    S.drum(t07 + 1.02, .3, { lp: 700, sub: .2 });
    S.line('cello', t08 + 1.0, [[55, 1.5], [52, 1.5], [50, 1.5], [48, 2], [43, 3]], .4, { att: .2, rel: .8, off: .2 });   // 低弦下行
    bed(t08 + .5, t09, [43, 50], .22, { fi: 1.5, fo: 1.5 });
    S.section('四·幻境', t09, t12, '古筝极慢、泛音为主；花开花谢左右对调时音型左右声像互换；4-10 尖啸被闷住（混响拉满后突然切断）；4-11 古筝独句');
    bed(t09, t12, [43, 50], .2, { fi: 3, fo: 3, send: .15 });
    [[2.0, 74], [5.0, 79], [8.0, 76], [11.0, 74], [14.0, 79], [17.0, 81], [20.0, 76], [23.0, 74], [26.0, 79]].forEach(([dt, m], j) => {
      const pan = j < 5 ? -.42 : .42;                                               // 花开花谢左右对调
      S.z(t09 + dt, m, .24, { exact: true, d: 3, send: .55, pan });
      if (m + 12 <= 86) nEv('chime', t09 + dt + .01, m + 12, .1, { d: 1.2, rel: .8, send: .55, pan });
    });
    S.note('bowed', t10 + 1.0, 80, .3, { att: .08, d: 2.2, rel: .1, send: .9, lp: 9000 });   // 尖啸
    S.note('zheng', t10 + 1.0, 84, .26, { d: .6, bend: [[0, 0], [.15, 0], [.6, -5]], send: .8 });
    S.kill(t10 + 3.2, t10 + 4.2);                                                   // 混响拉满后突然切断
    bed(t11, t12, [43, 50], .2, { fi: 2, fo: 2 });
    [[1.0, 50, 'down'], [2.6, 57, 'pre'], [4.4, 55, 'down'], [6.6, 62, 'up1'], [9.2, 57, 'pre'], [11.5, 50, 'down']].forEach(([dt, m, bd]) => {
      S.z(t11 + dt, m, .34, { vib: true, exact: true, d: 2.8, bend: bd, send: .35 });
    });
    S.section('四·千里一吼', t12, t14, '4-12 埙极轻；4-13 单击大鼓＋锣（全片最响的单音）后留 1.5 秒混响尾；4-14 起字多，只留低持续与轻鼓');
    bed(t12, t13, [43, 50], .2, { fi: 1.5, fo: 1 });
    xunNote(t12 + .5, 61, .7, .3); xunNote(t12 + 1.2, 60, .8, .3);
    S.drum(t13 + .5, 1.0, { lp: 4200, sub: 1.0, send: .5 });
    S.gong(t13 + .5, 1.0, { rate: .7, d: 9, rel: 4, send: .5 });
    S.mark(t13 + .5, '4-13 全片最响单音');
    bed(t13 + 3.0, t14, [43, 50], .2, { fi: 1.5, fo: 1.5 });
    bed(t14, t17, [43, 50], .24, { fi: 2, fo: 2, genv: [[t14, .95], [t15, 1], [t16, .95], [t17, 1]] });
    for (let k = 0; k < 10; k++) S.drum(t14 + 2 + k * 4, .16, { lp: 900, sub: 0 });
    S.section('四·星光→攻府', t17, end, '4-17 星光柱一声越南筝高音长颤；4-18 琵琶＋军鼓杀局音型（第二次，比一幕短）；4-19 编钟单音 G5 预影＋云霄压抑形半句；埙强压回来');
    S.trem(t17 + 1.0, t17 + 9.0, 84, .16, .34, { inst: 'dan', rate: 13, cut: false, send: .55 });
    bed(t17 + .5, t18, [43, 50], .22, { fi: 1.5, fo: 1.5 });
    const q0 = t18 + 1.0, step = B96 / 4, n = Math.round(2 * 4 * 4);
    for (let k = 0; k < n; k++) pipaNote(q0 + k * step, k % 2 ? 62 : 57, .5, { exact: true, d: .12, rel: .02, send: .2, pan: -.25 });
    for (let k = 0; k < 2 * 4; k++) S.snare(q0 + k * B96, .16, { lp: 5200, send: .2 });
    bed(t18 + .3, t19, [43, 50], .22, { fi: 1, fo: 1 });
    nEv('bell', t19 + .5, 79, .3, { exact: true, d: 3, send: .45, pan: .1 });    // 编钟单音 G5 预影
    half5(t19 + 1.0, .5, '四·4-19 云霄压抑形＋半句');
    xunNote(t19 + 1.0, 65, .45, .62); xunNote(t19 + 1.45, 62, .5, .62);
    xunNote(t19 + 1.95, 61, .5, .62); xunNote(t19 + 2.45, 60, .5, .62);
    xunNote(t19 + 2.95, 59, 2.5, .62, { att: .1, env: [[0, 1], [1.5, 1], [2.5, 0]] });
  }

  /* ======================= 五 · 云霄 ======================= */
  {
    const a = 'act5';
    const t01 = T(a, '5-01'), t02 = T(a, '5-02'), t03 = T(a, '5-03'), t04 = T(a, '5-04'), t05 = T(a, '5-05'),
      t06 = T(a, '5-06'), t07 = T(a, '5-07'), t08 = T(a, '5-08'), t09 = T(a, '5-09'), t10 = T(a, '5-10'),
      t11 = T(a, '5-11'), t12 = T(a, '5-12'), t13 = T(a, '5-13'), t14 = T(a, '5-14'), t15 = T(a, '5-15'),
      t16 = T(a, '5-16'), end = A('coda').start;
    S.section('五·道韵', t01, t04, '5-01 风声里藏弦群模拟的「诵经」轮廓；5-03 古筝轮指；5-04 长笛唱云霄主题前两小节');
    S.noise(t01, t04 - t01 + 1, .28, { f: 600, q: .55, white: .08, gust: .4, att: 3, rel: 2, fk: [[t01, 320], [t02, 700], [t03, 480], [t04, 620]], send: .35 });
    S.pad('bowed', t01 + 1, t04, [55, 57], .16, { fi: 4, fo: 3, seg: 9, genv: [[t01, .6], [t02, 1], [t03, .8], [t04, 1.15]] });
    bed(t01 + .5, t04, [43, 50], .27, { fi: 2.5, fo: 2 });
    S.trem(t03 + 1.0, t03 + 6.5, 74, .16, .34, { rate: 12, cut: false, send: .35 });
    S.flute(t04 + 1.0, 67, 1.0, .5, { att: .12, rel: .4, send: .4 });
    S.flute(t04 + 2.0, 69, 1.0, .5, { att: .12, rel: .4, send: .4 });
    S.flute(t04 + 3.0, 74, 1.0, .5, { att: .12, rel: .4, send: .4 });
    S.flute(t04 + 4.0, 76, 1.0, .5, { att: .12, rel: .4, send: .4 });
    S.flute(t04 + 5.0, 79, 2.0, .5, { att: .12, rel: .8, send: .45 });
    S.flute(t04 + 7.0, 81, 1.0, .5, { att: .12, rel: .4, send: .4 });
    S.flute(t04 + 8.0, 79, 1.0, .5, { att: .12, rel: .4, send: .4 });
    [[67, 1, 1], [69, 1, 2], [74, 1, 3], [76, 1, 4], [79, 2, 5], [81, 1, 7], [79, 1, 8]].forEach(([m, d, k]) => S.theme.push({ t: +(t04 + k).toFixed(3), m, d, label: '五·5-04 长笛云霄前两小节', inst: 'flute' }));
    S.roll(t04 + .8, t04 + 9.5, .08, .45, { rate: [5, 10], lp: 1600 });
    S.section('五·揭底', t04, t07, '5-05 琵琶第三次（最短）＋剑吟；5-06 古筝快速分解和弦；5-07 停一拍（全静 0.8 秒）');
    bed(t05, t06, [43, 50], .26, { fi: 1.5, fo: 1.5 });
    const q1 = t05 + 1.0, step = B96 / 4;
    for (let k = 0; k < 16; k++) pipaNote(q1 + k * step, k % 2 ? 62 : 57, .5, { exact: true, d: .12, rel: .02, send: .2, pan: -.25 });
    S.bowed(t05 + 1.0, 79, 5.5, .28, { att: .2, rel: 1.2, vib: { f: 6.5, c: 24, at: .1, ramp: .4 }, send: .4 });   // 剑吟（非玄黄）
    bed(t06, t07 - .4, [43, 50], .24, { fi: 1.5, fo: .5, send: .1 });
    const arp = [67, 71, 74, 79, 76, 74, 71, 67];
    for (let k = 0; t06 + 1 + k * .5 < t07 - .5; k++) S.z(t06 + 1 + k * .5, arp[k % 8], .26 + (k % 2 ? 0 : .04), { exact: true, d: .45, send: .25, hum: 4 });
    S.kill(t07, t07 + .8);                                                          // 5-07 全静 0.8 秒
    S.mark(t07, '5-07 停一拍（全静 0.8 秒）');
    bed(t07 + .9, t08, [43, 50], .2, { fi: 1.5, fo: 1, send: .1 });
    S.section('五·画中人→宣句', t08, t12, '5-08 古筝分解和弦逐层叠加；5-10 雨声＋低弦长音；5-11 风声为主，乐器退到几乎没有；5-12 羽毛落时越南筝一声');
    bed(t08, t10, [43, 50], .25, { fi: 2, fo: 2 });
    const layers = [[55, 62], [67, 74], [71, 79], [76, 84]];
    layers.forEach((ms, li) => {
      const t0 = t08 + 1 + li * 4;
      for (let k = 0; t0 + k * .5 < t08 + 22; k++) {
        const m = ms[k % 2], v = .2 + .03 * li + (k % 4 === 0 ? .03 : 0);
        S.z(t0 + k * .5, m, v, { exact: true, d: .5, send: .25, hum: 4, pan: -.35 + .12 * li });
      }
    });
    S.dan(t09 + 1.0, 84, .22, { exact: true, vib: true, d: 2.5, send: .45 });
    S.noise(t10, t11 - t10 + .6, .24, { f: 3600, q: 1.0, white: .55, att: 3, rel: 2.5, send: .4 });   // 雨声
    bed(t10, t11, [43, 50], .26, { fi: 2, fo: 2 });
    S.noise(t11, t12 - t11, .3, { f: 700, q: .5, white: .12, gust: .7, att: 3, rel: 2, send: .35 });   // 风声为主
    bed(t11, t12 + 6.0, [43, 50], .16, { fi: 3, fo: 3, send: 0 });
    S.dan(t12 + .5, 79, .3, { exact: true, vib: true, d: 3, send: .45 });            // 羽毛落时一声
    S.mark(t12 + 7.0, '5-12 宣句后完全静音');
    S.kill(t12 + 7.0, t13);                                                          // 至 5-13 完全静音
    S.section('五·万古云霄', t13, t14, '编钟完整奏出云霄主题（中音区→高八度）；低弦 G 宫三和弦 G→C→D→G；古筝泛音点缀；磬每小节首拍；全片最强，不加鼓');
    const b = B56, t0 = t13 + .5;
    const chords = [[43, 50, 59], [48, 55, 64], [50, 57, 64], [43, 50, 59]];
    for (let k = 0; k < 8; k++) {
      const ct = t0 + k * 4 * b, ch = chords[k % 4];
      ch.forEach((m) => S.cello(ct, m, 4 * b + .5, .3, { att: .35, rel: .9, send: .15, exact: true }));
      S.ev({ k: 'p', i: 'qing', t: ct, v: .45, m: 55, send: .45, pan: .1 });                         // 磬：每小节首拍
      const ht = ct + 2 * b;                                                       // 每小节第 3 拍
      if (k % 2 === 0) nEv('chime', ht, 86, .25, { exact: true, d: 2, rel: 1.2, send: .55, pan: .25 });   // D6
      else S.flute(ht, 91, 2.2, .12, { exact: true, att: .05, rel: .8, lp: 12000, send: .55, pan: .25 });    // G6（采样音域内的高音）
      S.z(ht, k % 2 === 0 ? 74 : 79, .12, { exact: true, d: 1.5, send: .5, pan: .25 });
    }
    for (let pass = 0; pass < 2; pass++) {
      const base = G + pass * 12;
      yaLine(t0 + pass * 16 * b, base, YA_FULL, (t, m, d, j, last) => {
        nEv('bell', t, m, .8, { exact: true, d: last ? d + 2.5 : d, send: .4, pan: pass ? .18 : -.18 });
      }, b, '五·5-13 云霄主题（编钟' + (pass ? '高八度' : '中音区') + '）', 'bell');
      [13, 14, 15].forEach((k, j) => nEv('bell', t0 + pass * 16 * b + k * b, base, .46 - .08 * j, { exact: true, d: 2.2, send: .35, pan: pass ? .18 : -.18 }));   // 末音 G 延长：钟声轻击续响
    }
    S.mark(t13 + .5, '5-13 编钟完整主题');
    S.section('五·镇压与弃壳', t14, end, '5-14 锣＋编钟低音；5-15 秘阵声处低频嗡突兀插入；5-16 埙最后一缕气声，未完');
    S.gong(t14 + .2, .55, { rate: .7, d: 7, rel: 3 });
    nEv('bell', t14 + .5, 55, .4, { exact: true, d: 6, send: .4 });
    nEv('bell', t14 + 2.0, 43, .32, { exact: true, d: 7, send: .4 });
    bed(t14 + .5, t15, [43, 50], .2, { fi: 1.5, fo: 1.5 });
    S.sub(t15 + 1.0, .3, { f0: 70, f1: 30, dec: 1.8, subD: 5 });
    S.noise(t15 + 1.0, 4, .25, { f: 80, q: .8, att: .15, rel: 2, send: .3 });
    bed(t15 + 1.2, t16, [43, 50], .18, { fi: 1.5, fo: 1.5 });
    bed(t16, end, [43, 50], .2, { fi: 2, fo: 2 });
    xunNote(t16 + 1.0, 59, 4, .25, { att: .2, env: [[0, 1], [2.5, .85], [4, 0]], send: .45 });
  }

  /* ======================= 尾 · 收卷 ======================= */
  {
    const a = 'coda';
    const c1 = T(a, 'C-01'), c2 = T(a, 'C-02'), c3 = T(a, 'C-03'), c4 = T(a, 'C-04'), c5 = T(a, 'C-05'),
      c6 = T(a, 'C-06'), c7 = T(a, 'C-07'), end = cues.duration;
    S.section('尾·收卷', c1, c2, '狂风卷起道境，归于虚无；只留低弦与风');
    bed(c1, c2, [43, 50], .22, { fi: 2.5, fo: 2 });
    S.noise(c1, c2 - c1, .24, { f: 800, q: .6, white: .1, gust: .5, att: 3, rel: 2, send: .35 });
    S.section('尾·钤印', c2, c3, '编钟收主题后交回古筝完整形；最后一音延长');
    nEv('bell', c2 + .5, 67, .3, { exact: true, d: 4, send: .4 });
    nEv('bell', c2 + .55, 79, .18, { exact: true, d: 4, send: .4 });
    bed(c2 + 1, c3, [43, 50], .25, { fi: 2, fo: 2 });
    yaLine(c2 + 2.0, G, YA_FULL, (t, m, d, j, last) => {
      S.z(t, m, j === 1 ? .5 : .45, { vib: d > .9, exact: true, d: last ? d + 3 : undefined });
      if (j === 0 || j === 4) S.dan(t + .01, m - 12, .22, { exact: true });
    }, B60, '尾·C-02 古筝完整形', 'zheng');
    S.section('尾·鱼吞鱼→明月', c3, c5, 'C-03 埙三个气音碎片；C-04 长笛冷音；C-05 血浪＝低弦群快速滑音吞没');
    bed(c3, c4, [43, 50], .2, { fi: 2, fo: 2 });
    [[2.0, 59], [5.0, 60], [8.5, 59]].forEach(([dt, m], j) => xunNote(c3 + dt, m, .4, .2, { att: .08, rel: .18, send: .4, env: [[0, 1], [.28, .8], [.4, 0]] }));
    bed(c4, c5, [43, 50], .22, { fi: 2.5, fo: 2 });
    S.flute(c4 + 1.0, 76, 8, .2, { att: 1.5, rel: 2.5, lp: 9000, send: .45 });      // 长笛冷音
    S.flute(c4 + 10.0, 74, 6, .18, { att: 1.5, rel: 2.5, lp: 8000, send: .45 });
    S.gliss(c5 + .3, 4.5, 76, 43, .5, { inst: 'cello', key: G, mode: 'gong', curve: 1.15, v1: .36, send: .3 });   // 低弦群快速滑音
    S.noise(c5, c6 - c5, .42, { f: 100, q: .8, att: .3, rel: 2, send: .4 });
    S.section('尾·问句→片名', c6, end, 'C-06 古筝问句（云霄主题前四音，停在 E5）；C-07 片名时主题最后一音 G 延长淡出（古筝 G4＋编钟 G5）');
    bed(c6, c7, [43, 50], .2, { fi: 2, fo: 2 });
    press(c6 + .5, .45, 4, '尾·C-06 云霄问句');
    bed(c7, end, [43, 50], .18, { fi: 2, fo: 2 });
    S.z(c7 + .5, 67, .38, { exact: true, d: 8, env: [[0, 1], [3, .95], [6, .35], [8, 0]], send: .5 });
    nEv('bell', c7 + .5, 79, .3, { exact: true, d: 9, send: .45, env: [[0, 1], [4, .8], [6, .2], [9, 0]] });
    S.mark(c7 + .5, 'C-07 片名：主题最后一音 G 延长淡出');
    S.section('尾·收束', c7 + .5, end, '最后一音延长淡出');
  }

  S.events.sort((x, y) => x.t - y.t);
  return S;
}
