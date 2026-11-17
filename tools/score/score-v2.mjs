/* 《剑破绝关》配乐 v2 乐谱（协调者方向见 docs/DECISIONS.md「配乐 v2」，对应表见 docs/MUSIC-V2.md）。
   定位：一律 S.T('幕id.cue名')（幕起点 + 幕内 cue，构建时从页面实时读出）；前情提要 recap 幕存在时用其真实起点与时长。
   调性：全片主调 D 羽（D F G A C）。主题 = D A G A C | D（问句停在 C，「一剑斩破」才落到高八度 D）。
   声部分工：古筝＝叙述与余慈；低弦＋大鼓＝剑与推进；长笛＝远方/真意（克制）；小提琴组高音＝剑吟。不用铜管。 */
import { makeScore, THEME, THEME_MAJ, LINGMING, deg } from './lib.mjs';

export function buildScore(cues) {
  const S = makeScore(cues);
  const D = 62;                                         // D4
  const q = (a) => (n, d) => S.T(a + '.' + n, d);
  const P = q('act0'), E1 = q('act1'), M2 = q('act2'), J3 = q('act3'), B4 = q('act4'), K5 = q('act5'), C6 = q('act6');
  const A = (id) => S.act(id);
  const AQ = [[0, 1], [7, .9], [5, 1.15], [7, .35], [10, 0]];    // 问句的实际时值（秒）：随大字落笔，C 留住不解决
  /* 问句：古筝独奏，每音揉弦；末音 C 长留、略带上滑而不到 D */
  function question(t0, key, v, label) {
    let t = t0;
    AQ.forEach(([iv, len], j) => {
      const m = key + iv, last = j === AQ.length - 1;
      S.z(t, m, v * (j === 1 || last ? 1.05 : .9), { vib: true, exact: true, d: last ? 4 : undefined, bend: last ? [[0, 0], [1.1, 0], [1.6, .35], [3.4, .35]] : undefined });
      if (j === 0 || last) S.dan(t + .01, m - 12, v * .5, { exact: true });
      S.theme.push({ t: +t.toFixed(3), m, d: len || 2, label, inst: 'zheng' });
      t += len;
    });
    return t;
  }

  /* 宋公远／诸万象／马明初小景（第一、二幕新增 cue trioSong/trioZhu/trioMa）：各一声越南筝轻音，不另写旋律 */
  const trio = (act) => [['trioSong', 69], ['trioZhu', 72], ['trioMa', 74]].forEach(([n, m]) => { if (S.has(act + '.' + n)) S.dan(S.T(act + '.' + n), m, .24, { vib: true, send: .45 }); });

  /* ======================= 前情提要（recap 幕，存在时才写；卡长变了只延长铺底与持续音型，不变速） ======================= */
  const RC = A('recap'), a0 = A('act0');
  if (RC) {
    /* 八卡（js/act-recap.js 的 cue）：分身 → 故友成凶剑（主题头四音第一次陈述，不完整）→ 东行（轻轻的行进）→ 谷梁设网（G 低持续＋越南筝摇指）
       → 谷梁要什么（追杀转暗：card4turn＝card5）→ 盖勋另一路（同一追杀音型再走一遍）→ 天劫另一路（三声日鸣的预影，card7lock 一锣）→ 四日（序幕的热浪低持续淡入）。
       2026-10-18 起旧 card5/card6（三阳劫/四日）的事件改名 card7/card8；各卡起点一律取 cue（缺 cue 时按时长比例），不写死秒。 */
    S.gs = 1.5;                                          // 说书要轻，但不能比正片低一大截（≈+3.5dB）
    const t0 = RC.start, N = RC.duration, R = (n, k) => S.T('recap.' + n, t0 + N * k);
    const c2 = R('card2', .125), c2b = R('card2blood', .15), c3 = R('card3', .25), c4 = R('card4', .375), c4t = R('card4turn', .5), c5n = R('card5net', .5875), c6 = R('card6', .625),
      c7 = R('card7', .75), c7l = R('card7lock', .8), c8 = R('card8', .875), c8s = R('card8suns', .904), ce = R('recapEnd', .98);
    S.section('前情提要', t0, RC.end, '说书感：古筝独奏；故友一卡主题头四音第一次陈述（不完整）；东行轻行进；设网 G 低持续；谷梁要什么／盖勋另一路两卡同一追杀音型转暗；天劫三声日鸣预影；四日卡起序幕热浪低持续淡入');
    S.pad('cello', t0 + .4, c4, [38], .3, { fi: 3.5, fo: 2, genv: [[t0, .8], [c2, 1], [c2b + 2, 1.12], [c3, 1.05], [c4, .9]] });
    // 一卡 分身：一声远处高 D，低音分解（卡长够时低音分解再轻轻走一遍）
    S.z(t0 + .6, 74, .34, { vib: true, send: .5 }); S.mark(t0 + .6, '前情·开篇一声');
    [[2.4, 50], [2.85, 57], [3.3, 62], [4.6, 65, 'up'], [5.9, 62]].forEach(([dt, m, bd]) => S.z(t0 + dt, m, .36, { vib: dt > 4, bend: bd, bt: .4 })); S.mark(t0 + 2.4, '');
    if (c2 - t0 >= 8.5) [[6.5, 50], [6.95, 57], [7.4, 62]].forEach(([dt, m], j) => S.z(t0 + dt, m, .3, { vib: j === 2 }));
    // 二卡 故友成凶剑：主题头四音（D A G A），随即岔到 F → D，不说完（血墨在头四音里吞上来）
    let t = c2 + .3;
    S.themeAt('前情·陈述', t, 1.05, D, 'head', 'zheng', (tt, m, d, j) => { S.z(tt, m, j === 1 ? .56 : .48, { vib: d > .9 }); if (j === 0) S.dan(tt, 50, .3); });
    t += 4 * 1.05;
    S.z(t, 65, .46, { vib: true }); S.z(t + 1.25, 62, .5, { vib: true, bend: 'pre' }); S.dan(t + 1.25, 41 + 12, .28);
    S.pad('bowed', c2 + .5, c3 + 1, [57, 62], .17, { fi: 2.5, fo: 2 });
    // 三卡 东行：轻轻的行进（♩≈92 八分分解，远鼓）
    const b = .652, n3 = Math.floor((c4 - c3 - .4) / (b / 2));
    for (let k = 0; k < n3; k++) {
      const tt = c3 + .2 + k * b / 2, fig = [62, 69, 74, 69, 72, 69, 67, 69];
      S.z(tt, fig[k % 8] - (k >= 8 && k < 16 ? 3 : 0), .26 + (k % 2 ? 0 : .05) + .04 * Math.sin(k / n3 * Math.PI), { hum: 5 });
      if (k % 4 === 0) S.dan(tt, [50, 53, 55, 50][(k / 4) % 4], .26);
      if (k % 4 === 0 && k > 2) S.drum(tt, .2 + .06 * Math.sin(k / n3 * Math.PI), { lp: 450, send: .4 });
    }
    S.pad('cello', c3, c4 + .5, [45], .2, { fi: 2, fo: 1 });
    // 四卡 谷梁设网：G 低持续、越南筝低音摇指；五卡起（血剑逼来）转暗：心跳低鼓、不协和弦乐、古筝下滑；六卡盖勋追来，同一音型再走一遍；G 低持续一直铺到天劫卡
    S.pad('cello', c4, c7 + .5, [43], .34, { fi: 1, fo: 1.2, genv: [[c4, .8], [c4t, 1.1], [c6, 1], [c7, .9]] });
    S.trem(c4 + .3, c4t - .2, 55, .14, .26, { inst: 'dan', rate: 10 });
    const chase = (tc, v) => [[tc + 1.2, 67, 'down'], [tc + 3, 65, 'down'], [tc + 4.6, 62]].forEach(([tt, m, bd]) => S.z(tt, m, v, { bend: bd, vib: !bd }));
    S.drum(c4t, .42, { lp: 500, sub: .3 }); S.drum(c4t + .42, .26, { lp: 500 }); S.mark(c4t, '前情·追杀转暗');
    S.pad('bowed', c4t, c7, [62], .2, { fi: 1.5, fo: 1.2 }); S.pad('bowed', c4t + .6, c7, [63], .16, { fi: 1.5, fo: 1.2 });
    chase(c4t, .4);
    if (c5n > c4t + 5 && c5n < c6) { S.drum(c5n, .34, { lp: 500, sub: .22 }); S.drum(c5n + .42, .2, { lp: 500 }); }     // 网在剑前合拢
    if (c7 - c6 >= 6) {                                                                                                  // 盖勋另一路：追杀音型再走一遍（略轻）
      S.drum(c6, .36, { lp: 500, sub: .24 }); S.drum(c6 + .42, .22, { lp: 500 });
      S.trem(c6 + .3, c7 - .6, 55, .12, .22, { inst: 'dan', rate: 10 });
      chase(c6, .34);
    }
    // 七卡 天劫另一路：三声日鸣的预影（E5、A5、E♭6，极轻），锁定处一锣
    S.pad('cello', c7, c8 + 1, [38], .3, { fi: 1.5, fo: 1.5 });
    S.bowed(c7 + .4, 76, c7l - c7 + 2.5, .2, { att: 1, rel: 2 }); S.flute(c7 + 1.1, 81, c7l - c7 + 1.6, .18, { att: 1, rel: 2 }); S.flute(c7 + 1.8, 87, c7l - c7 + 1, .12, { att: 1, rel: 2, lp: 6000 });
    S.gong(c7l, .34, { rate: .9, d: 4, rel: 2.5 }); S.drum(c7l, .44, { lp: 600, sub: .35 }); S.mark(c7l, '前情·三阳锁定');
    S.z(c7l + 1.5, 69, .38, { vib: true }); S.z(c7l + 2.7, 67, .34); S.z(c7l + 3.5, 62, .4, { vib: true });
    // 八卡 四日：古筝最后落 D，热浪低持续淡入，交给序幕
    S.z(c8 + .4, 62, .4, { vib: true, d: 5 }); S.dan(c8 + .4, 50, .26);
    S.bowed(c8s, 74, ce - c8s + 2, .16, { att: 1, rel: 2 });
    S.noise(c8, RC.end - c8 + 2.5, .2, { f: 70, q: .7, att: 4, rel: 1, keys: [[c8, 0], [ce, .55], [RC.end + 2.5, .65]] });
    S.cello(c8 + 1, 45, RC.end - c8 + 2, .24, { att: 3, rel: 1.5 });
    S.gs = 1;
  }

  /* ======================= 序 · 四日：灼热压迫的低持续音＋远鼓，问句处留白 ======================= */
  {
    const t0 = a0.start, flood = P('flood'), qa = P('question'), end = A('act1').start;
    S.section('序 · 四日', t0, end, '低弦 D2/A2 热浪持续＋地鸣噪声，四日四个高音；远鼓由远及近；问句处全部退下，古筝独奏问句停在 C');
    const lead = RC ? 3 : 0;
    S.noise(t0 - lead, flood - t0 + lead + 1.2, .5, { f: 75, q: .7, keys: [[t0 - lead, 0], [t0, RC ? .45 : .08], [t0 + 4, .65], [P('dive'), .8], [P('push'), 1], [flood, 1.15], [flood + .6, .3], [qa, .1], [qa + 1, 0]] });
    S.pad('cello', t0 + (RC ? -1 : .2), qa + .4, [38], .5, { fi: RC ? 1 : 3.5, fo: .8, genv: [[t0, .7], [P('sunsMerge'), .85], [P('dive'), 1], [P('push'), 1.1], [flood, 1.25], [qa - .3, .7], [qa + .4, .5]] });
    S.pad('cello', P('sunsMerge'), qa + .4, [45], .44, { fi: 3, fo: .8, genv: [[t0, .8], [P('push'), 1.1], [flood, 1.2], [qa, .6]] });
    // 四日：四个高音依次升起（D5、A5、E♭5、C6），灼热、不协和，镜头下潜后淡去
    S.bowed(P('sunsIn'), 74, P('strata') - P('sunsIn'), .3, { att: 1.5, rel: 3 });
    S.flute(P('sunsApart'), 81, P('dive') - P('sunsApart'), .22, { att: 1.5, rel: 3, lp: 5000 });
    S.bowed(P('sunsMerge'), 75, P('dive') - P('sunsMerge'), .26, { att: 1.2, rel: 2.5 });
    S.flute(P('sunsSet'), 84, P('dive') - P('sunsSet') - 1, .16, { att: 1, rel: 2.5, lp: 4500 });
    // 远鼓：低通、远；入地后渐近
    const far = { lp: 420, send: .45 };
    S.drum(P('sunsMerge'), .34, far); S.drum(P('firstCrack'), .46, { ...far, sub: .35 }); S.drum(P('birdsFall'), .3, far);
    S.drum(P('dive'), .42, { lp: 600, send: .38 }); S.drum(P('dive') + .42, .26, { lp: 600, send: .38 });
    S.drum(P('pierce'), .55, { lp: 900, sub: .5 }); S.drum(P('anchor'), .4, { lp: 900 });
    if (S.has('act0.cage')) S.drum(P('cage'), .3, far);                                     // 剖面全景停住：朱砂阵纹合围（牢），远鼓一声
    S.drum(P('push'), .48, { lp: 1200 }); S.drum(P('push') + .42, .3, { lp: 1200 });
    // 地底剑吟：极细高音由远及近；剑身两颤各一声古筝高音＋弦吟
    S.bowed(P('strata'), 74, P('tremble') - P('strata') + 1, .22, { att: 3, rel: 1.5, swell: [.5, 1, .9] });
    S.z(P('mindCall'), 57, .34, { vib: true }); S.z(P('mindCall2'), 62, .36, { vib: true });
    S.z(P('tremble'), 74, .5, { vib: true }); S.bowed(P('tremble'), 74, 2.2, .34, { att: .3, rel: 1.5 });
    S.z(P('tremble2'), 81, .44, { vib: true }); S.bowed(P('tremble2'), 74, 2.2, .38, { att: .3, rel: 1.5 });
    S.drum(P('tremble'), .34, { lp: 1400 }); S.drum(P('tremble2'), .4, { lp: 1400, sub: .3 });
    // 墨涨：一口吸气后鼓与锣收在问句前，问句处只剩古筝与一缕弦
    S.inhale(flood + .05, .42); S.drum(flood, .6, { sub: .55 }); S.gong(flood, .3, { rate: .9, d: 1.6, rel: 1.2 });
    question(qa, D, .62, '序·问句');
    S.cello(qa + .3, 50, P('questionFade') - qa, .2, { att: 1.2, rel: 2 });
    S.bowed(P('lastHum'), 74, 1.6, .26, { att: .4, rel: 1.2 }); S.bowed(P('lastHum2'), 74, 1.8, .22, { att: .4, rel: 1.6 });
    S.mark(qa, '序·问句（古筝，停在 C）');
  }

  /* ======================= 第一幕 · 东来 ======================= */
  const a1 = A('act1');
  {
    // 1-01 凶 → 1-02 决意 → 1-03 底气
    const raging = E1('swordRaging'), leap = E1('leap'), fu = E1('jianfu');
    S.section('一·凶→决意→底气', a1.start, E1('reach'), '血海：低弦重音、越南筝低音摇指、不规则大鼓（剑东趋西指）');
    S.noise(a1.start - 1.2, leap - a1.start + 2, .45, { f: 90, q: .8, att: 2.2, rel: 1.5 });
    S.cello(raging, 38, leap - raging + .5, .66, { sfz: true, rel: 1.5 });
    S.cello(raging, 45, leap - raging + .5, .54, { sfz: true, rel: 1.5 });
    S.trem(raging + .3, leap - .4, 50, .26, .44, { inst: 'dan', rate: 11 });
    [[0, .7, .6], [2.2, .5, 0], [3.6, .58, .3], [6, .62, .4], [7.3, .45, 0], [9.1, .55, .3]].forEach(([dt, v, s]) => S.drum(raging + dt, v, { sub: s }));
    S.cym(raging, .34, { lp: 6000 });
    [[2.2, 74, 'down'], [6, 72, 'down'], [9.1, 69, 'down']].forEach(([dt, m, b]) => S.z(raging + dt + .05, m, .5, { bend: b }));
    S.noise(leap - 2.5, 7, .55, { f: 900, q: .6, white: .3, keys: [[leap - 2.5, 0], [leap, 1], [leap + 3.5, .6], [leap + 6, 0]] });   // 风啸
    S.gliss(leap - .1, .55, 50, 74, .5, { v1: .7 });
    S.cello(leap - .5, 45, E1('laoPengyou') - leap + 1.5, .3, { att: 1, rel: 2.5 });
    S.gong(fu, .26, { rate: 1.7, d: 3.5, rel: 1.5, send: .45 }); S.dan(fu, 81, .36, { vib: true }); S.dan(fu + .02, 74, .3);   // 符成一声轻磬
    S.section('一·豪赌', E1('reach'), E1('swordTurn'), '古筝明快：主题头句的附点变体与跳音');
  }
  {
    // 1-04 豪赌的笑意：古筝明快（♩≈104），两道剑鸣＝两个弦乐长音成五度
    const t0 = E1('laoPengyou'), stop = E1('swordTurn'), b = .577;
    S.gliss(t0 - .45, .42, 62, 74, .45, { v1: .62 });
    const fig = [[74, .5, .7], [69, .5, .5], [72, .5, .55], [74, .5, .65], [77, .75, .7], [74, .25, .5], [72, .5, .55], [69, .5, .5],
      [67, .5, .55], [69, .5, .6], [72, 1, .62], [74, .5, .55], [72, .5, .5], [69, .5, .52], [67, .5, .5], [69, 1, .62],
      [62, .75, .6], [69, .25, .5], [67, .5, .55], [69, .5, .6], [72, .5, .62], [74, .5, .66], [77, .5, .7], [79, .5, .66]];
    let t = t0;
    for (const [m, l, v] of fig) { if (t > stop - .2) break; S.z(t, m, v, { vib: l >= 1 }); t += l * b; }
    for (let k = 0; t0 + k * 2 * b < stop - .3; k++) { const bt = t0 + k * 2 * b; S.dan(bt, k % 4 < 2 ? 50 : 53, .36); S.dan(bt + b, k % 4 < 2 ? 57 : 60, .26); }
    S.cello(t0, 50, stop - t0 - .2, .3, { att: .4, rel: .5 });
    S.bowed(E1('swordStop'), 69, 4.5, .4, { att: .25, rel: 1.5 }); S.bowed(E1('swordAnswer'), 74, 4, .4, { att: .25, rel: 1.5 });
    for (let k = 0; t0 + k * 4 * b < stop - .3; k++) S.drum(t0 + k * 4 * b, .34 + .03 * k, { lp: 1800 });
  }
  {
    // 1-05 冲击（剑压如墙）→ 1-06 认出：撕裂的丝弦（古筝下滑），重击后一切消融成回忆
    const turn = E1('swordTurn'), hit = E1('hit'), rec = E1('recognize'), mem = E1('memory');
    S.section('一·冲击→认出', turn, mem, '低弦渐强→重击（鼓、锣、钹、低弦）；古筝下滑撕裂；长笛一缕旧日的风引入回忆');
    S.cello(turn, 38, hit - turn + 1.5, .55, { att: .5, rel: 1, swell: [.5, 1.2, .9] });
    S.trem(turn + .2, hit - .05, 57, .3, .62, { rate: [9, 15], cut: true });
    S.inhale(hit, .38);
    S.drum(hit, .92, { sub: .85 }); S.drum(hit + .02, .7); S.gong(hit, .62, { rate: .85, d: 5, rel: 2 }); S.cym(hit, .62);
    S.strum(hit, [38 + 12, 57, 62, 69, 74], .82, { spread: .015 });
    S.cello(hit, 38, 3.5, .7, { sfz: true, rel: 2 }); S.cello(hit, 50, 3, .55, { sfz: true, rel: 2 });
    [[.4, 81], [.75, 77], [1.1, 74], [1.5, 72]].forEach(([dt, m]) => S.z(hit + dt, m, .46, { bend: [[0, 0], [.08, 0], [.5, -2.5]] }));
    S.drum(E1('thrown'), .48, { lp: 1500 }); S.drum(E1('settle'), .32, { lp: 900 });
    S.pad('cello', E1('settle'), mem + 3, [38], .34, { fi: .5, fo: 4 });
    S.flute(rec + .4, 81, mem - rec + 1.5, .28, { att: 1.8, rel: 2.5, lp: 5000, send: .55 });
    S.gliss(mem - 1.6, 1.4, 81, 62, .32, { key: 65, mode: 'gong', curve: .8, v1: .26 });
  }

  /* --- 回忆 · 剑园（暖：F 宫色彩，古筝独奏柔版、可加长笛）--- */
  {
    const mem = E1('memory'), blank = E1('blankPaper'), F = 65;
    S.section('一·回忆', mem, E1('backToRed'), '古筝独奏柔版（F 宫色彩），R3 主题前句＋长笛长吟；R5 互托一段推进，空白纸处骤收，叹息似的弦吟');
    S.pad('cello', mem, E1('jiehe') + .5, [41], .3, { fi: 2.5, fo: 1.5, genv: [[mem, .9], [E1('zhanA'), 1.1], [E1('lakeBreath'), .85], [E1('jiehe'), .9]] });
    S.pad('cello', mem + 1, E1('zhanAText') - .6, [48], .22, { fi: 3, fo: 1.5 });
    // R1 金光一亮 → 剑光斩符（小孩撒气的跳音）→ 扶额（下滑）
    S.strum(E1('gengjin'), [53, 57, 60, 65, 69], .5, { spread: .03 }); S.gong(E1('gengjin'), .2, { rate: 1.9, d: 3, rel: 1.5, send: .5 });
    const sr = E1('slashRunes');
    [[0, [77, 74, 72]], [1.25, [79, 77, 74, 72]], [2.4, [81, 79, 77]], [3.7, [77, 79, 74, 72, 69]]].forEach(([dt, ms]) => ms.forEach((m, j) => S.z(sr + dt + j * .085, m, .44 - j * .03, { hum: 3 })));
    S.z(sr + 5.4, 72, .48, { bend: 'down', bt: .3 }); S.z(sr + 6.6, 65, .4, { vib: true });
    // R2 并肩：电火劈落，「斩啊！」
    const za = E1('zhanA');
    S.trem(za - 3.2, za - .1, 50, .2, .5, { inst: 'dan', rate: [10, 14], cut: true }); S.roll(za - 2.4, za - .05, .14, .4, { rate: 9, lp: 1500 });
    S.strum(za, [50, 57, 62, 69, 74], .78, { spread: .016 }); S.drum(za, .7, { sub: .55 }); S.cym(za, .44, { lp: 7000 });
    S.cello(za, 38, 3.2, .5, { sfz: true, rel: 2 }); S.bowed(za, 69, 3, .36, { sfz: true, rel: 2 });
    // R3 相知、告别：古筝独奏主题前句（D 羽，F 宫底色），剑光离体＝长笛长吟 A5
    const lk = E1('lakeBreath'), bl = E1('browLight'), bm = (bl - lk) / 6.4;
    S.pad('bowed', lk - .5, E1('tianJiu') - .5, [57, 65], .2, { fi: 3, fo: 3, genv: [[lk, .8], [lk + 2, 1], [lk + 4, .8], [lk + 6, 1], [bl, .9]] });
    S.themeAt('回忆·R3 主题', lk + .3, bm, D, 'a', 'zheng', (tt, m, d, j, last) => {
      S.z(tt, m, .5 + (last ? .06 : 0), { vib: d > .7, bend: j === 4 ? 'up1' : undefined, bt: .5 });
      if (j === 0 || j === 3) S.dan(tt, (j ? 48 : 41) + 12, .28);
    });
    S.flute(bl, 81, E1('tianJiu') - bl + .8, .4, { att: .5, rel: 2.5, swell: [.8, 1.15, .8], send: .5 });
    S.z(bl + 2.2, 69, .36, { vib: true }); S.z(bl + 3.4, 72, .34, { vib: true }); S.z(bl + 4.8, 74, .4, { vib: true });
    // R4 馈赠之重：四个古篆一笔一笔（古筝上行分解），入额一声「嗡」，耳鸣
    const tj = E1('tianJiu'), gh = E1('glyphHit');
    [0, .75, 1.5, 2.25].forEach((dt, j) => { S.z(tj + dt, [62, 65, 69, 74][j], .42 + .04 * j, { vib: true }); S.dan(tj + dt + .02, [50, 53, 57, 62][j], .24); });
    S.cello(gh, 38, 3, .62, { sfz: true, rel: 2.5 }); S.gong(gh, .5, { rate: .8, d: 4, rel: 2 }); S.sub(gh, .55); S.drum(gh, .5, { lp: 700 });
    S.flute(gh + .4, 93, 2.6, .14, { att: .5, rel: 1.4, lp: 7000, send: .4 });
    // R5 互托性命：界河一撞 → 源头并肩（主题头句推进）→ 一拖一抹（刮奏）→ 空白纸处骤收
    const jh = E1('jiehe'), sh = E1('sheathHit'), src = E1('source'), drag = E1('dragSlash'), bb = (drag - src) / 6;
    S.cello(jh, 38, blank - jh, .4, { att: .6, rel: .3, swell: [.8, 1.1, 1.2] });
    S.roll(jh + .4, sh - .05, .12, .45, { rate: 10, lp: 1600 });
    S.drum(sh, .8, { sub: .7 }); S.cym(sh, .46, { d: .9, rel: .3 }); S.strum(sh, [38 + 12, 57, 62, 69], .7, { spread: .014 });
    for (let k = 0; src + k * bb < blank - .1; k++) { S.cello(src + k * bb, k % 4 === 2 ? 45 : 38, bb * .55, .44, { att: .02, rel: .12, off: .3 }); if (k % 2 === 0) S.drum(src + k * bb, .42, { lp: 2000 }); }
    S.themeAt('回忆·R5 互托', src + .1, bb * .95, D, 'q', 'zheng', (tt, m, d) => S.trem(tt, tt + d * .92, m, .46, .56, { rate: 12, cut: true }));
    S.gliss(drag, .45, 86, 62, .6, { inst: 'dan', curve: .9, v1: .5 }); S.strum(drag + .45, [50, 57, 62], .62);
    S.drum(drag + .45, .62, { sub: .45 });
    S.bowed(E1('duoXie'), 74, 3, .24, { att: .5, rel: 2, lp: 6000, swell: [.6, 1, .5], bend: [[0, 0], [2, 0], [3, -.4]] });   // 叹息似的剑吟
    if (E1('backToRed') - E1('duoXie') > 4.5) S.bowed((E1('duoXie') + E1('backToRed')) / 2 - .4, 74, 3, .18, { att: .5, rel: 2, lp: 6000, swell: [.6, 1, .5], bend: [[0, 0], [2, 0], [3, -.4]] });   // 留言单元加长：第二声，略轻
    S.mark(blank, '回忆·空白纸骤收');
  }
  {
    // 1-07 一沉（心跳两下）→ 1-08 已成凶剑（不协和上冲）→ 1-09 迎锋（推进）→ 1-10 舍身附剑 → 1-11 灵性（降半音）
    const red = E1('backToRed'), gb = E1('ghostBurnt'), rb = E1('rainbow'), pc = E1('pierce'), mi = E1('mistIn'), dv = E1('deviate'), et = E1('eastTheme');
    S.section('一·一沉→附剑', red, et, '心跳低鼓两下；低弦与高音不协和推到「凶剑」；推进的低弦八分音→舍身一击；化雾后剑吟降半音落到 D');
    S.pad('cello', red - .5, pc + .5, [38], .38, { fi: 1.5, fo: .4, genv: [[red, .8], [gb - 4, 1], [gb, 1.3], [gb + 2, .9], [pc, 1.2]] });
    S.noise(red, pc - red + .5, .3, { f: 80, q: .7, att: 2, rel: .3 });
    if (S.has('act1.spineOut')) S.bowed(red + .3, 74, E1('spineOut') - red - .3, .2, { att: 1, rel: .12, lp: 6000, swell: [.8, 1, .6] });   // 剑脊一线清光被血墨吞没：细剑吟随之掐断
    S.drum(E1('heartbeat'), .5, { lp: 320, sub: .5 }); S.drum(E1('heartbeat2'), .32, { lp: 320, sub: .3 });
    S.bowed(E1('sheathe'), 62, gb - E1('sheathe') + 1, .3, { att: 2, rel: 1.5, swell: [.4, .8, 1.3] });
    S.bowed(E1('sheathe') + 1.2, 63, gb - E1('sheathe'), .3, { att: 2, rel: 1.5, swell: [.4, .8, 1.3] });
    S.flute(gb - 2.5, 81, 4, .26, { att: 1.5, rel: 1.5, lp: 6000 });
    S.drum(gb, .78, { sub: .6 }); S.cym(gb, .55); S.gong(gb, .5, { rate: .95, d: 4, rel: 2 }); S.cello(gb, 50, 2.5, .56, { sfz: true, rel: 1.5 });
    S.gong(E1('jianfuRing'), .2, { rate: 1.7, d: 2.5, rel: 1.4, send: .45 });
    // 迎锋：低弦八分音推进（♩≈112）
    const b = (pc - E1('jianfuRing')) / Math.round((pc - E1('jianfuRing')) / .536);
    for (let t = E1('jianfuRing'), k = 0; t < pc - .05; t += b / 2, k++) {
      const kk = (t - E1('jianfuRing')) / (pc - E1('jianfuRing'));
      S.cello(t, k % 8 === 6 ? 41 : 38, b * .38, .3 + .4 * kk, { att: .015, rel: .1, off: .32 });
      if (k % 4 === 0) S.drum(t, .32 + .4 * kk, { lp: 1200 + 3000 * kk });
    }
    S.bowed(rb, 74, pc - rb, .36, { att: .4, rel: .2, bend: [[0, 0], [pc - rb - 1.5, 0], [pc - rb, 1]], swell: [.6, .9, 1.2] });
    S.inhale(pc, .4); S.drum(pc, 1, { sub: .9 }); S.drum(pc + .015, .75); S.gong(pc, .66, { rate: .8, d: 6, rel: 3 }); S.cym(pc, .55);
    S.cello(pc, 38, 4, .62, { sfz: true, rel: 3 }); S.cello(pc, 45, 4, .48, { sfz: true, rel: 3 });
    S.noise(pc + .3, mi - pc + 1, .2, { f: 4200, q: 1.2, white: .8, att: .1, rel: 2.5 });       // 化雾的嘶声
    S.pad('cello', pc + 3, et + .5, [38, 45], .28, { fi: 1.5, fo: .8, genv: [[pc + 3, .8], [mi, .7], [et - 3, 1.1], [et, 1.2]] });
    S.trem(mi, dv - .2, 50, .12, .28, { inst: 'dan', rate: 10 });
    S.bowed(E1('halo') - 2.2, 75, et - E1('halo') + 2.2, .3, { att: 1.5, rel: .8, bend: [[0, 0], [dv - E1('halo') + 2.2, 0], [dv - E1('halo') + 2.9, -1]] });   // 剑吟降半音：有人在了
    S.roll(et - 2.2, et - .05, .14, .52, { rate: [8, 14], lp: 2500 });
  }
  {
    // 1-12 东去：主题前句第一次以低弦＋古筝＋大鼓说完（短，♩≈100）→ 1-13 天怒（三日鸣不协和）→ 1-14 锁定 → 1-15 截剑者自取其祸
    const et = E1('eastTheme'), b = .6, sc = E1('sunChord');
    S.section('一·东去', et, E1('sheDe'), '主题前句第一次完整（低弦＋古筝＋大鼓同奏）；三日鸣不协和；阵光嗡鸣→撞击崩塌');
    S.themeAt('一·东去 主题', et, b, D, 'a', 'cello', (tt, m, d, j, last) => {
      S.cello(tt, m - 12, d + (last ? 1.5 : .05), .62, { att: .03, rel: last ? 1.5 : .15, off: .3 });
      S.z(tt, m, .62, { vib: d > .7 }); if (d >= .9 || j === 0) S.drum(tt, .5 + .05 * j, { lp: 2500 });
    });
    S.cello(et, 38, 6, .5, { att: .05, rel: 1.5, off: .3 }); S.cym(et + 5.5 * b, .36);
    // 天怒：三个日鸣依次叠上（E5、A5、E♭6），鼓停，低音只剩一线
    S.bowed(E1('sunsReal'), 76, 6.5, .38, { att: .6, rel: 2.2 }); S.flute(sc, 81, 6, .32, { att: .5, rel: 2.2 }); S.flute(sc + .35, 87, 5.5, .2, { att: .5, rel: 2.2, lp: 6500 });
    S.pad('cello', E1('sunsReal'), E1('gateCrash'), [38], .3, { fi: 1, fo: .2, genv: [[E1('sunsReal'), .8], [E1('gateRise'), 1], [E1('gateCrash'), 1.4]] });
    // 锁定：三次烙印（低弦短重音＋古筝下滑＋闷鼓），剑符颤
    ['gaixunMark', 'markSword', 'markMist'].forEach((n, j) => { const t = E1(n); S.drum(t, .5 + .05 * j, { lp: 900, sub: .3 }); S.cello(t, 50 - j * 2, .6, .5, { sfz: true, rel: .4 }); S.z(t + .03, 72 - j * 3, .44, { bend: 'down', bt: .06 }); });
    S.trem(E1('jianfuTremble'), E1('gateRise') - .2, [81, 84], .14, .26, { inst: 'dan', rate: 14, cut: true });
    // 截剑：阵光嗡鸣（弦乐 cluster 渐强）→ 撞击 → 崩塌下行
    const gr = E1('gateRise'), gc = E1('gateCrash');
    S.bowed(gr, 62, gc - gr, .32, { att: 1, rel: .1, swell: [.4, .8, 1.4] }); S.bowed(gr + .3, 63, gc - gr - .3, .3, { att: 1, rel: .1, swell: [.4, .8, 1.4] });
    S.roll(gr + .8, gc - .05, .15, .6, { rate: [8, 16] }); S.inhale(gc, .45);
    S.drum(gc, .95, { sub: .85 }); S.drum(gc + .02, .7); S.gong(gc, .66, { rate: .85, d: 6, rel: 3 }); S.cym(gc, .62);
    S.cello(gc, 38, 3, .66, { sfz: true, rel: 2 }); S.cello(gc, 45, 3, .5, { sfz: true, rel: 2 });
    S.gliss(gc + .25, 1.6, 74, 43, .5, { inst: 'dan', curve: 1.2, v1: .36 });
    S.cello(E1('climb'), 38, E1('sheDe') - E1('climb') + 1, .34, { att: 1.5, rel: 1.2 });
  }
  {
    // 1-16 舍得：主题前句低八度（大提琴，宽广）→ 1-17 一路向东（鼓的行进、古筝八分音型、海风）→ 1-18 天罗地网（只剩鼓脉）→ 1-19 不绕（主题上行一句）→ 冲关滚奏
    const sd = E1('sheDe'), day = E1('day35'), arr = E1('array'), pu = E1('pullUp'), nd = E1('noDetour'), ch = E1('charge'), a2s = A('act2').start;
    S.section('一·舍得→一路向东', sd, a2s, '大提琴低八度主题；鼓的行进＋古筝八分音型；天罗地网只剩鼓脉；主题上行一句落 D，冲关滚奏接第二幕');
    const bs = Math.min((day - sd) / 8.6, .9);                                                 // 拍长封顶：段落加长不变慢，末音延长到行进起
    S.themeAt('一·舍得 主题(低八度)', sd, bs, D - 24, 'a', 'cello', (tt, m, d, j, last) => {
      const L = last ? Math.max(d + .6, day - tt + .2) : d + .08;
      S.cello(tt, m, L, .6, { att: j ? .08 : .3, rel: last ? 1 : .15, off: j ? .35 : 0 });
      S.cello(tt, m + 12, L, .34, { att: j ? .08 : .3, rel: last ? 1 : .15, off: j ? .35 : 0 });
    });
    for (let k = 0; k < 8 || sd + k * bs < day - .5; k++) { const t = sd + k * bs; S.dan(t, [50, 57, 62, 57][k % 4] + (k % 8 > 3 ? 3 : 0), .3); S.dan(t + bs / 2, [62, 65, 69, 65][k % 4], .24); }
    S.gong(sd, .22, { rate: 1.2, d: 4, rel: 2 });
    // 一路向东 ♩=100：大鼓行进、古筝八分音型（D 羽），长笛远处一句主题头
    const b = .6, nArr = Math.round((arr - day) / b), bb = (arr - day) / nArr;
    S.noise(day - 1, arr - day + 1.5, .22, { f: 420, q: .5, white: .1, gust: .5, att: 2.5, rel: .6 });
    for (let k = 0; k < nArr; k++) {
      const t = day + k * bb;
      if (k % 2 === 0) S.drum(t, k % 4 === 0 ? .52 : .38, { lp: 2400 });
      if (k % 4 === 3) S.drum(t + bb / 2, .28, { lp: 2000 });
      const pat = [62, 69, 74, 69, 72, 69, 74, 77][k % 8];
      S.z(t, pat - (k % 16 >= 8 ? 2 : 0) + (k % 16 >= 8 && pat === 62 ? 2 : 0) - 12, .34 + (k % 2 ? 0 : .06), { hum: 5 });
      if (Math.abs(t - E1('seaLight') - 2.5) > 3) S.z(t + bb / 2, 57, .24, { hum: 5 });
    }
    S.pad('cello', day, arr + .3, [38, 45], .36, { fi: 1, fo: .3 });
    S.themeAt('一·向东 长笛远句', E1('seaLight'), bb, D + 12, 'head', 'flute', (tt, m, d) => S.flute(tt, m, d + .1, .58, { att: .1, rel: .5, lp: 7000, send: .4 }));
    // 天罗地网：节奏骤收，只剩鼓脉（♩=100 四分）＋低音；拉起后鼓密、弦乐 cluster 渐强
    for (let t = arr; t < nd - .05; t += b) { const k = (t - arr) / (nd - arr), dense = t >= pu; S.drum(t, .4 + .3 * k, { lp: 1600 + 2000 * k }); if (dense) S.drum(t + b / 2, .26 + .25 * k, { lp: 1600 }); }
    S.pad('cello', arr, nd + .2, [38], .4, { fi: .2, fo: .2, genv: [[arr, .8], [pu, 1], [nd, 1.3]] });
    trio('act1');                                                                                // 三人小景：各一声越南筝
    S.bowed(pu, 69, nd - pu, .26, { att: 1.5, rel: .1, swell: [.4, .8, 1.3] }); S.bowed(pu + .5, 70, nd - pu - .5, .24, { att: 1.5, rel: .1, swell: [.4, .8, 1.3] });
    S.trem(pu + 2, nd - .05, 57, .2, .5, { rate: [10, 15], cut: true });
    // 不绕：主题前句上行一句（♩≈112），落 D 于冲关
    const bn = (ch - nd) / 7.5;
    S.themeAt('一·不绕 主题', nd, bn, D, 'a', 'cello', (tt, m, d, j, last) => {
      S.cello(tt, m - 12, last ? a2s - tt + .3 : d + .05, .72, { att: .02, rel: last ? .3 : .12, off: .3 });
      S.bowed(tt, m, last ? 2.5 : d + .05, .5, { att: .02, rel: last ? 1.2 : .12, off: .4 });
      S.trem(tt, tt + d * .9, m + 12 > 78 ? m : m + 12, .5, .6, { rate: 13, cut: !last });
      S.drum(tt, .6 + .04 * j, { sub: last ? .6 : 0 });
    });
    S.cym(ch, .5); S.gong(ch, .4, { rate: .9, d: 3, rel: 2 });
    S.roll(ch + .6, a2s - .02, .2, .66, { rate: [9, 16] }); S.inhale(a2s, .3);
    S.mark(ch, '一·冲关（主题落 D）');
  }

  /* ======================= 第二幕 · 擎山 ======================= */
  const a2 = A('act2');
  {
    // 2-01..05 严阵以待的冷：A 为中心的空五度高音、稀疏大鼓 → 收紧的脉动 → 「现在！」落在 D
    const t0 = a2.start, now = M2('now');
    S.section('二·严阵', t0, now, '冷：A 中心空五度（弦乐高音＋长笛），稀疏大鼓；脉动收紧、反向钹吸气，「现在！」全奏重音落 D');
    S.drum(t0, .66, { sub: .5 }); S.cym(t0, .3, { lp: 5000 });
    S.pad('bowed', t0 + .2, now - .05, [69, 76], .28, { fi: 2.5, fo: .05, genv: [[t0, .8], [now - 8, .9], [now - .5, 1.3]] });
    S.flute(t0 + 4, 81, 11, .16, { att: 3, rel: 3, lp: 5000 });
    S.pad('cello', t0 + .5, now - .05, [45], .34, { fi: 2, fo: .05, genv: [[t0, .9], [now - 6, 1.1], [now - .3, 1.4]] });
    S.noise(t0, now - t0, .16, { f: 1800, q: .6, white: .12, gust: .6, att: 2, rel: .2 });   // 高空罡风
    [3.5, 7.2, 10.4, 13.1].forEach((dt, j) => S.drum(t0 + dt, .28 + .03 * j, { lp: 900 }));
    const pa = t0 + 15.5, nb = Math.round((now - pa) / .8), b = (now - pa) / nb;
    for (let k = 0; k < nb; k++) {
      const t = pa + k * b, kk = k / nb;
      S.cello(t, 45, b * .45, .3 + .35 * kk, { att: .02, rel: .1, off: .3 });
      if (k % 2 === 0 || kk > .6) S.drum(t, .3 + .35 * kk, { lp: 1000 + 3000 * kk });
      if (k % 4 === 2) S.dan(t, 57, .3 + .2 * kk);
    }
    S.trem(now - 5.5, now - .03, 57, .18, .56, { rate: [9, 16], cut: true });
    S.roll(now - 3, now - .03, .12, .55, { inst: 'snare', rate: 18 });
    S.inhale(now, .55, { lp: 9000 });
    // 「现在！」
    S.drum(now, 1, { sub: 1 }); S.drum(now + .012, .9); S.gong(now, .82, { rate: .9, d: 7, rel: 3 }); S.cym(now, .8);
    S.cello(now, 38, 3, .85, { sfz: true, rel: 1.5 }); S.cello(now, 50, 3, .7, { sfz: true, rel: 1.5 });
    S.bowed(now, 62, 2.6, .7, { sfz: true, rel: 1.5 }); S.bowed(now, 69, 2.6, .66, { sfz: true, rel: 1.5 }); S.bowed(now, 74, 2.6, .6, { sfz: true, rel: 1.5 });
    S.strum(now, [50, 57, 62, 69, 74], 1, { spread: .012 }); S.dan(now, 50, .7);
    S.mark(now, '二·「现在！」全奏重音');
  }
  {
    // 2-06..2-10 爆发后推进（♩=120）→ 擎山（低弦下行、重鼓半速）→ 山底闷住只剩剑吟
    const now = M2('now'), laugh = M2('songLaugh'), palm = M2('palm'), under = M2('under'), land = M2('land');
    S.section('二·擎山', now, M2('step1'), '低弦八分音推进＋大鼓；低弦一声上扬代笑意；山起：低弦逐级下行、重鼓；切到山底全体闷住，只剩高音剑吟');
    const b = .5;
    for (let t = now + 2 * b, k = 0; t < palm - .1; t += b / 2, k++) {
      S.cello(t, [38, 38, 50, 38, 41, 38, 50, 43][k % 8], b * .4, .5, { att: .015, rel: .1, off: .3 });
      if (k % 4 === 0) S.drum(t, .58, { lp: 3000 }); else if (k % 4 === 3) S.drum(t, .36, { lp: 2400 });
      if (k % 8 === 0) S.strum(t, [62, 69, 74], .46, { spread: .02 });
    }
    S.trem(now + 1, laugh - .2, 74, .4, .3, { rate: 13 });
    S.cym(M2('mingchuFire') - .05, .4, { att: .3 });
    S.cello(laugh, 45, 1.6, .7, { sfz: true, rel: .6, bend: [[0, 0], [.25, 0], [.7, 5]] });     // 上扬代笑意
    S.bowed(laugh + .1, 69, 1.5, .5, { sfz: true, rel: .6, bend: [[0, 0], [.25, 0], [.7, 5]] });
    // 擎山：重鼓半速、低弦下行 D3→D2，山越长越低
    const steps = [[palm, 50], [palm + 2.4, 48], [palm + 4.6, 45], [M2('grow2'), 43], [M2('grow3'), 41], [M2('press'), 38]];
    steps.forEach(([t, m], j) => { const nx = j < steps.length - 1 ? steps[j + 1][0] : under; S.cello(t, m, nx - t + .2, .6 + .04 * j, { att: .04, rel: .25, off: .25 }); S.cello(t, m + 12, nx - t + .2, .36, { att: .04, rel: .25, off: .25 }); S.drum(t, .66 + .04 * j, { sub: .4 + .06 * j }); });
    S.gong(palm, .4, { rate: .75, d: 5, rel: 3 });
    S.noise(palm, under - palm + 8, .4, { f: 70, q: .8, att: 1.5, rel: 2 });
    S.bowed(palm + 1, 62, under - palm - 1, .3, { att: 2, rel: .3, swell: [.5, 1, 1.2] });
    // 山底：全体闷住（≈320Hz），剑吟（小提琴组高音，不闷）穿出
    S.muf([[under - .02, 20000], [under, 330], [land + .6, 330], [M2('step1') - .2, 20000]]);
    S.bowed(under, 76, land - under + 2, .42, { att: .15, rel: 2, mf: false, swell: [.8, 1, .9] });
    S.pad('cello', under, land + 1.5, [38], .6, { fi: .05, fo: 1.2 });
    [['braceHit', .8], ['load1', .85], ['load2', .9], ['load3', .95], ['land', 1.05]].forEach(([n, v]) => { const t = M2(n); S.drum(t, v, { sub: v * .9 }); S.gong(t, v * .5, { rate: .7, d: 2.5, rel: 1.5 }); });
    S.mark(under, '二·山底闷住只剩剑吟');
  }
  {
    // 2-11 步罡（七步上行）→ 2-12 山只是枢纽（元磁嗡鸣上行、剑吟穿出）→ 2-13 杀心（加速尖音）→ 2-14 命中？→ 2-15 反咬 → 2-17 收网 → 2-18 警觉 → 2-19 封口骤静
    S.section('二·步罡→反咬', M2('step1'), M2('recede'), '七步上行古筝＋鼓；元磁低音上行、剑吟顽强；加速摇指→金铁交鸣；血舌反咬：主题头句凶狠（摇指＋低弦＋鼓）');
    const st = [1, 2, 3, 4, 5, 6, 7].map((k) => M2('step' + k)), stepM = [50, 53, 55, 57, 60, 62, 65];
    st.forEach((t, j) => { S.drum(t, .44 + .03 * j, { lp: 1500 }); S.z(t, stepM[j], .46 + .02 * j); S.dan(t, stepM[j] - 12 < 43 ? stepM[j] : stepM[j] - 12, .28); });
    const sk = M2('skyward'), pl = M2('plunge'), xl = M2('xuanli'), bu = M2('burst');
    S.strum(sk, [62, 69, 74, 77], .5, { spread: .03 }); S.cym(sk, .3, { lp: 7000 });
    S.cello(sk, 38, pl - sk, .44, { att: 1.2, rel: .2, bend: [[0, 0], [pl - sk, 2]] }); S.cello(sk + .5, 39, pl - sk - .5, .32, { att: 1.5, rel: .2, bend: [[0, 0], [pl - sk, 2]] });
    S.noise(sk, pl - sk, .3, { f: 60, fk: [[sk, 55], [pl, 140]], q: 1.2, att: 2, rel: .2 });
    S.bowed(sk + .5, 76, pl - sk - .5, .38, { att: 1, rel: .3, swell: [.6, 1.1, .8] });
    trio('act2');                                                                                // 三人施术小景：各一声越南筝
    S.drum(pl, .78, { sub: .7 }); S.gong(pl, .44, { rate: .8, d: 3, rel: 2 });
    if (S.has('act2.swordNotch')) { const sn = M2('swordNotch'); S.dan(sn, 81, .3, { vib: true }); S.gong(sn, .2, { rate: 1.7, d: 2.5, rel: 1.4, send: .45 }); }   // 剑被压低一截：金石一鸣
    if (S.has('act2.yellowHit')) S.drum(M2('yellowHit'), .5, { lp: 900, sub: .35 });          // 黄光打在人背上
    S.trem(xl, bu - .03, 81, .2, .6, { rate: [6, 18], cut: true, inst: 'dan' });
    S.pad('cello', pl, bu, [38, 39], .38, { fi: .3, fo: .05, genv: [[pl, .8], [bu, 1.3]] });
    S.drum(bu, .8, { sub: .5 }); S.cym(bu, .55, { d: .35, rel: .1 });
    S.pad('cello', bu + .1, M2('frown') + .4, [38], .36, { fi: .3, fo: .4 }); S.bowed(bu + .6, 63, M2('frown') - bu - .5, .2, { att: 1, rel: .4, swell: [.5, .8, 1.1] }); S.strum(bu, [69, 74, 81], .7, { spread: .01, d: .4 }); S.bowed(bu, 74, .5, .5, { sfz: true, rel: .2 });
    // 反咬：主题头句凶狠两遍，♩=126
    const fr = M2('frown'), lk = M2('lick'), b = .476;
    S.themeAt('二·反咬 主题头', fr, b, D, 'q', 'zheng', (tt, m, d) => { S.trem(tt, tt + d * .9, m, .55, .6, { rate: 14, cut: true }); S.cello(tt, m - 24, d * .8, .62, { att: .015, rel: .1, off: .3 }); S.drum(tt, .52, { lp: 3000 }); });
    S.drum(lk, .9, { sub: .7 }); S.cym(lk, .62); S.roll(lk + .05, lk + .9, .5, .2, { inst: 'snare', rate: 22 });
    S.themeAt('二·反咬 主题头（再）', lk + .5, b, D + 2, 'q', 'zheng', (tt, m, d) => { S.trem(tt, tt + d * .9, m, .58, .64, { rate: 14, cut: true }); S.cello(tt, m - 24, d * .8, .66, { att: .015, rel: .1, off: .3 }); S.drum(tt, .56, { lp: 3000 }); });
    // 补阵：鼓的行进，低音持续
    const rc = M2('recede'), bz = lk + .5 + 5 * b + .5;
    for (let t = bz, k = 0; t < rc - .1; t += b, k++) { S.drum(t, k % 2 ? .36 : .5, { lp: 2200 }); if (k % 2 === 0) S.cello(t, 38, b * .5, .5, { att: .015, rel: .1, off: .3 }); }
    S.pad('bowed', bz, rc + 1, [62, 69], .3, { fi: 1, fo: 1 });
    if (S.has('act2.gapJoin')) { const gj = M2('gapJoin'); S.dan(gj, 74, .26, { vib: true }); S.dan(gj + .35, 81, .2); }   // 补位：阵光一线接回
  }
  {
    const rc = M2('recede'), lo = M2('look'), ss = M2('sealStart'), seal = M2('seal'), scrape = M2('scrape');
    S.section('二·收网→封口', rc, seal, '血海退去长吸（反向钹）；奇异共鸣（反向锣）；渐强推到封口——如匣封口：音乐与混响尾全部硬停', '骤静');
    S.inhale(M2('recede2'), .38, { lp: 5000 }); S.cym(M2('recede2') - 2.6, .1, { rev: true, lp: 3000 });
    S.pad('cello', rc, seal, [38], .4, { fi: 1, fo: .01, genv: [[rc, .8], [lo, .9], [ss, 1.4], [seal, 1.5]] });
    S.pad('bowed', rc + .5, seal, [62, 63], .26, { fi: 2, fo: .01, genv: [[rc, .6], [lo, .7], [ss, 1.4], [seal, 1.5]] });
    S.gong(lo, .5, { rate: .6, rev: true, d: 4.5 });                                                        // 奇异的气机共鸣：反向低锣
    S.dan(lo, 81, .3, { vib: true }); S.dan(lo + .6, 80, .26, { vib: true });
    S.trem(ss - 4.5, seal, 57, .2, .66, { rate: [10, 18], cut: true });
    S.roll(ss - 3.5, seal, .16, .7, { rate: [10, 20] });
    S.inhale(ss, .5);
    S.drum(ss, .95, { sub: .8 }); S.gong(ss, .8, { rate: .85, d: 8 }); S.cym(ss, .6); S.cello(ss, 38, 2, .8, { sfz: true }); S.strum(ss, [50, 57, 62, 69], .9, { spread: .01 });
    S.kill(seal, scrape); S.section('二·如匣封口骤静', seal, scrape, '硬停：干声与混响尾同时切断，数字静音（页面另加极弱高空风）', '骤静');
    S.mark(seal, '二·如匣封口（硬停）');
  }
  {
    // 2-20 无声落地：摩擦后一声长长的颤鸣 → 2-21 看见（水镜）→ 2-22 舍得干净：主题前句以钟形单音缓慢一遍（决绝）→ 2-23 沉落
    const sc = M2('scrape'), mr = M2('mirror'), cv = M2('carve'), sk = M2('sink'), a3 = A('act3').start;
    S.section('二·落地→舍身炼器', sc, a3, '暗金属摩擦（低速钹）＋长长的弦颤鸣；水镜：越南筝高音稀落；主题前句以古筝＋越南筝八度、钟形单音缓慢一遍，低弦推向决绝；沉落', '骤静后');
    S.cym(sc, .4, { rate: .5, lp: 2600, d: 2.5, rel: 1 });
    S.bowed(sc + .3, 74, 6, .34, { att: .3, rel: 2, env: [[0, 1], [.15, .55], [.3, 1], [.45, .55], [.6, 1], [.75, .6], [.9, 1], [1.05, .6], [1.2, .95], [1.4, .65], [1.6, .9], [2, .7], [3, .8], [6, .6]] });
    S.pad('cello', sc + 1.5, cv, [38], .3, { fi: 3, fo: .5, genv: [[sc, .8], [mr, .9], [cv - 3, 1.1], [cv, 1.2]] });
    [[0, 81], [1.6, 76], [2.9, 79], [4.8, 74], [6.4, 81], [8.1, 77]].forEach(([dt, m]) => S.dan(mr + dt, m, .26, { vib: true, send: .55 }));
    S.pad('bowed', mr, cv + .5, [57, 62], .2, { fi: 3, fo: 1 });
    S.themeAt('二·舍得干净 主题（钟形）', cv, Math.min((sk - cv + 2.5) / 8, .87), D, 'a', 'zheng', (tt, m, d, j) => {
      S.z(tt, m, .68, { vib: d > .8 }); S.dan(tt, m + 12 > 84 ? m : m + 12, .38); S.bowed(tt, m, d + .1, .38, { att: .05, rel: .3, off: .35 }); if (j !== 2 && j !== 3) S.drum(tt, .46 + .04 * j, { lp: 900 }); if (j === 0) S.gong(tt, .26, { rate: 1.75, d: 4, rel: 2, send: .5 });
    });
    S.cello(cv, 38, sk - cv + 1, .58, { att: .5, rel: 1, swell: [.7, 1.15, 1.35] }); S.cello(cv, 50, sk - cv + 1, .46, { att: .5, rel: 1, swell: [.7, 1.1, 1.3] });
    S.drum(cv, .5, { sub: .4 }); S.drum(sk, .6, { sub: .5 });
    S.cello(sk, 50, a3 - sk + 3, .55, { att: .05, rel: 2, off: .3, bend: [[0, 0], [1.5, 0], [6, -12]] });   // 沉落：一路滑下八度
    S.noise(sk, a3 - sk + 8, .42, { f: 60, q: .8, att: 2, rel: 3 });
  }

  /* ======================= 第三幕 · 九泉 ======================= */
  const a3 = A('act3');
  {
    const t0 = a3.start, seen = J3('seen'), crush = J3('crush'), rend = J3('rend'), cic = J3('cicada'), pit = J3('pit'), ls = J3('lidSlam');
    S.section('三·寒意→碾碎→剑符', t0, J3('fiveDays'), '寒：低弦与高音空五度；被看穿一声雷似的低音；总爆发与雷火连环；最后只剩一线；剑符动机＝越南筝高音颤（夏蝉）；封炉一锣长余音');
    S.pad('cello', t0 - 1, crush, [38], .34, { fi: 3, fo: .05, genv: [[t0, .8], [J3('crush') - 6, 1], [crush, 1.3]] });
    S.pad('bowed', t0 + 1, seen + 6, [69, 76], .16, { fi: 4, fo: 3 });
    S.drum(seen, .66, { lp: 260, sub: .7 }); S.gong(seen, .4, { rate: .6, d: 6, rel: 3 });
    S.trem(seen + 6.5, crush - .3, 50, .14, .3, { inst: 'dan', rate: 9 });                         // 龙气低鸣
    S.cello(seen + 6, 45, crush - seen - 6, .3, { att: 2, rel: .2 });
    S.inhale(crush, .4);
    [[crush, 1, .9], [J3('crack'), .82, .6], [rend, .86, .7], [rend + 1.4, .7, .5], [rend + 2.6, .62, .4], [rend + 4.1, .5, .3], [rend + 5.9, .36, .2]].forEach(([t, v, s]) => { S.drum(t, v, { sub: s }); S.drum(t + .02, v * .6); });
    S.gong(crush, .7, { rate: .75, d: 8, rel: 4 }); S.cym(crush, .5);
    S.cello(crush, 38, rend - crush + 5, .62, { sfz: true, rel: 3 }); S.cello(crush, 39, rend - crush + 4, .44, { sfz: true, rel: 3 });
    S.noise(crush, rend - crush + 8, .5, { f: 80, q: .7, att: .2, rel: 5 });
    S.bowed(rend + 5, 74, cic - rend - 3, .14, { att: 2, rel: 2 });                                // 最后只剩一个极弱的持续音
    // 剑符（夏蝉）：越南筝高音 A5/C6 快速交替，带 6Hz 鸣响起伏
    const cicada = (t, d, v) => { S.trem(t, t + d, [81, 84], v, v * .8, { inst: 'dan', rate: 15, cut: true, send: .45 }); };
    cicada(cic, 8.5, .24); S.mark(cic, '三·剑符蝉鸣'); S.pad('cello', cic, pit + 1, [38], .26, { fi: 2, fo: 1 });
    // 大炉：岩浆翻滚——低弦脉动、地鸣涌起 → 封炉
    for (let t = pit, k = 0; t < ls - .2; t += 1.1, k++) { S.cello(t, k % 3 === 2 ? 39 : 38, .9, .4 + .02 * k, { att: .2, rel: .4, off: .3 }); if (k % 2 === 0) S.drum(t, .36 + .03 * k, { lp: 600 }); }
    S.noise(pit, ls - pit + 1, .45, { f: 90, fk: [[pit, 70], [ls, 160]], q: .7, att: 1, rel: .5 });
    S.drum(ls, .98, { sub: 1 }); S.gong(ls, .9, { rate: .72, d: 12, rel: 6 }); S.cym(ls, .4, { lp: 4000 });
    S.cello(ls, 38, 4, .7, { sfz: true, rel: 3 });
    S.J3cicada = cicada;
    // 3-08b 牢笼纵剖（封炉后到五日之间够长时）：沿用序幕「入地」的做法——低弦 D2 与地鸣铺底、远鼓由远及近、地底剑吟渐近；穿过鼎盖一声轻磬＋越南筝高音
    const fd = J3('fiveDays');
    if (fd - ls > 8) {
      const ds = J3('descend', ls + 6.5), lr = J3('lidReach', fd - 8), ul = J3('underLid', fd - 5), an = J3('anchor', fd - 1);
      S.pad('cello', ls + 3.5, fd + .3, [38], .3, { fi: 3, fo: .6, genv: [[ls, .7], [ds, .8], [lr, 1], [an, 1.1], [fd, .9]] });
      S.noise(ls + 2, J3('lock') - ls - 1.5, .3, { f: 75, q: .7, keys: [[ls + 2, 0], [ds, .6], [lr, .9], [ul, 1], [an, .8], [fd + 1, .7], [J3('lock') + .5, 0]] });
      S.drum(ds, .3, { lp: 420, send: .45 }); S.drum(lr, .38, { lp: 600, send: .38 }); S.drum(ul, .48, { lp: 900, sub: .4 }); S.drum(an, .4, { lp: 900 });
      S.gong(ul, .22, { rate: 1.7, d: 3, rel: 1.5, send: .45 }); S.dan(ul, 81, .28, { vib: true });
      S.bowed(ds, 74, fd - ds + .5, .2, { att: 3, rel: 1.5, swell: [.5, 1, .9] });
      S.mark(ds, '三·牢笼纵剖（入地）');
    }
  }
  {
    // 3-09 五日：五声递升的热鸣、两次撞击、一记压倒一切的低音 → 低持续；3-10 剑符没停过；3-11 宗师（铃）；3-12 一句话（无伴奏）；3-13 洪钟
    const fd = J3('fiveDays'), ov = J3('overpower'), lock = J3('lock'), gl = J3('guliang'), sp = J3('speak'), pr = J3('press'), bell = J3('bell');
    S.section('三·五日→宗师', fd, J3('call'), '五日：五声递升的弦乐热鸣＋两次撞击＋压倒一切的低锣，之后低持续；剑符蝉鸣；宗师一铃、暗的五度；一句话处无伴奏；洪钟长余音');
    const steps = [50, 53, 55, 57, 60], dt = Math.min((lock - fd) / 5.2, 1.6);                 // 间距封顶：五声连成一线，不拉散
    if (lock - fd > 8) S.pad('cello', fd, lock + .3, [38], .3, { fi: 1, fo: .3, genv: [[fd, .9], [ov, 1.1], [lock, 1.2]] });   // 盖勋被擒段加长：低持续托住
    steps.forEach((m, j) => { S.cello(fd + j * dt, m, 1.6, .38 + .06 * j, { att: .35, rel: .7, swell: [.6, 1.2, .7] }); S.bowed(fd + j * dt, m + 12, 1.5, .24 + .04 * j, { att: .4, rel: .6 }); });
    S.drum(ov, .8, { sub: .6 }); S.drum(ov + .7, .7, { sub: .5 });
    S.gong(lock, 1, { rate: .55, d: 10, rel: 5 }); S.sub(lock, 1, { f0: 60, f1: 30, dec: 1.2, subD: 3.5 }); S.drum(lock, .9);
    S.cello(lock, 38, 3, .7, { sfz: true, rel: 2 });
    S.pad('cello', lock + 1, sp + .3, [38], .36, { fi: 2.5, fo: .8, genv: [[lock, .8], [gl, 1], [sp, .8]] });
    S.noise(lock, sp - lock + 1, .26, { f: 85, q: .7, att: 3, rel: 1 });
    S.J3cicada(J3('cicada2'), 5, .22);
    S.gong(gl, .34, { rate: 2.1, d: 4, rel: 2, send: .5 }); S.dan(gl, 84, .28, { vib: true });          // 宗师：一铃
    S.pad('cello', gl + .3, sp + .5, [36, 43], .36, { fi: 1.5, fo: 1 });
    S.noise(sp, pr - sp + 1, .14, { f: 70, q: .7, att: .5, rel: 1 });                                   // 一句话：只剩熔岩低涌
    if (pr - sp > 6) S.pad('bowed', sp + .6, pr + .8, [69, 76], .07, { fi: 2.5, fo: 1.8 });            // 谷梁三句：配乐让位，只留开幕的寒空五度（极弱）
    S.pad('cello', pr, bell + 1, [38, 45], .32, { fi: 2.5, fo: .5, genv: [[pr, .7], [bell, 1.2]] });
    S.drum(bell, .7, { sub: .7, lp: 1500 }); S.gong(bell, .95, { rate: .82, send: .5 });                // 洪钟：余音很长
    S.pad('cello', bell + 1, J3('call') + .5, [38], .3, { fi: 1, fo: .5 });
  }
  {
    // 3-14 浊海（低弦呼号）→ 3-15 无岸「挽——」（大提琴组远远一声滑音长嗥）→ 3-16 侵蚀（玻璃碎声）→ 3-17 徒然的锋利（剑雨）→ 3-18 一问：抽成一线 → 3-19 默颂：脉动拍齐
    const call = J3('call'), wu = J3('wuan'), ru = J3('ruin'), rain = J3('swordRain'), ask = J3('ask'), ch = J3('chant');
    S.section('三·浊海→一问', call, ch, '低弦呼号；无岸长嗥（大提琴组滑音、远、不吓人）；侵蚀的碎光；剑雨＝古筝高音密集点状；一问处全部抽离成一线高音（留白）', '留白');
    S.roll(call - 1.5, call + 1.2, .1, .5, { rate: 12, lp: 400, pow: 1 }); S.sub(call, .6);
    S.line('cello', call + .4, [[45, 1.1], [50, .9], [48, 2.2]], .62, { lp: 2000 });
    S.line('cello', call + .4, [[57, 1.1], [62, .9], [60, 2.2]], .36, { lp: 2400 });
    S.noise(call - 1, wu - call + 10, .34, { f: 70, q: .8, att: 2, rel: 3 });
    const howl = (t, v, lp, send) => {
      S.cello(t, 45, 5.2, v, { att: .5, rel: 1.6, lp, send, bend: [[0, 0], [.6, 0], [1.6, 3], [3, 3], [4.6, -2], [5.2, -2.5]], vib: { f: 4.5, c: 14, at: .8, ramp: 1 } });
      S.cello(t + .05, 57, 5, v * .6, { att: .6, rel: 1.6, lp, send, bend: [[0, 0], [.6, 0], [1.6, 3], [3, 3], [4.6, -2], [5.2, -2.5]] });
    };
    howl(wu, .58, 900, .55); S.mark(wu, '三·无岸长嗥');
    S.pad('cello', wu - 1, ru + 1, [38], .3, { fi: 1, fo: 1 });
    // 侵蚀：符环碎裂的玻璃光点（越南筝高音下行，带不协和）
    const glass = S.has('act3.drain') ? J3('drain') : ru + 1;                                          // 符环剥落处起
    [[0, 84], [.35, 83], [.9, 79], [1.5, 80], [2.4, 76], [3.1, 77], [4.2, 72], [5.4, 73], [6.5, 69]].forEach(([dt, m]) => S.dan(glass + dt, m, .28, { send: .5 }));
    if (S.has('act3.stain')) S.cello(J3('stain'), 45, 4.6, .34, { att: .5, rel: 1.5, lp: 1200, bend: [[0, 0], [1, 2], [3.6, -2]] });   // 浊流抹过剑脊：浑浊的低弦滑音
    S.pad('bowed', ru, rain + .5, [62, 63], .22, { fi: 2, fo: .5, genv: [[ru, .7], [rain, 1.2]] });
    S.pad('cello', ru + .5, ask - .1, [38], .38, { fi: 1, fo: .15, genv: [[ru, .8], [rain, 1], [ask - 1, 1.2]] });
    // 剑雨：古筝高音密集点状（随机五声、14 音/秒）＋军鼓压低的细滚
    const r = S.rnd(311);
    for (let t = rain; t < ask - 1.8; t += 1 / 14 * (1 + (r() - .5) * .3)) {
      const k = (t - rain) / (ask - rain);
      S.z(t, [69, 72, 74, 77, 79, 81, 74, 72][Math.floor(r() * 8)], .32 + .22 * Math.sin(k * Math.PI) + r() * .08, { exact: true, rr: Math.floor(r() * 2) });
    }
    S.roll(rain, ask - 1.6, .12, .3, { inst: 'snare', rate: 16 });
    [[0, 84], [.4, 81], [.8, 79], [1.2, 74]].forEach(([dt, m]) => S.dan(ask - 1.6 + dt, m, .3, { send: .55 }));   // 符环坠落
    // 一问：全部抽离，只剩一线高音
    S.bowed(ask - .1, 74, ch - ask + 1.5, .24, { att: .6, rel: 1.5, swell: [.8, 1, .9] });
    S.mark(ask, '三·一问（抽成一线）');
  }
  {
    // 3-19 默颂：单音律动拍齐 → 3-20 界域：主题第一次以大调（D 宫）出现，音色变清（长笛＋古筝高音＋弦乐高音，不要低频）→ 3-21 寒锋
    const ch = J3('chant'), rl = J3('realm'), rf = J3('realmFull'), stab = J3('stab'), wu2 = J3('wuan2');
    S.gs = 1.3;
    S.section('三·默颂→界域', ch, wu2, '默颂：古筝低 D 单音律动、乱流被拍齐；界域：主题大调版（长笛＋古筝，D 宫五声），音色变清；寒锋一声锐利剑吟');
    const r = S.rnd(41);
    for (let t = ch, k = 0; t < rl - .3; k++) { S.z(t, 50, .44, { exact: true }); S.dan(t, 50, .2, { exact: true }); if (k % 2 === 0) S.drum(t, .26, { lp: 700 }); t += 1 * (1 + (k < 4 ? (r() - .5) * .25 * (4 - k) / 4 : 0)); }
    S.pad('cello', ch, rl + 2, [38], .26, { fi: 1, fo: 2.5 });
    const b = (rf - rl) / 8;
    S.pad('bowed', rl - .3, wu2 + .5, [62, 66], .2, { fi: 2, fo: 1.5, genv: [[rl, .8], [rf, 1.1], [stab, 1], [wu2, .8]] });
    S.themeAt('三·界域 主题大调', rl, b, D + 12, 'maj', 'flute', (tt, m, d, j, last) => { S.flute(tt, m, d + (last ? 2.5 : .1), .52, { att: j ? .06 : .15, rel: last ? 1.5 : .2, off: j ? .3 : 0, send: .4 }); S.z(tt, m > 78 ? m - 12 : m, .5, { vib: d > .6 }); });
    for (let k = 0; k < 16; k++) { const t = rl + k * b / 2; S.dan(t, [50, 54, 57, 62, 59, 57, 54, 57][k % 8], .26 + (k % 2 ? 0 : .05), { hum: 4 }); }
    S.gliss(rf, 1.6, 62, 78, .4, { key: 62, mode: 'gong', curve: .9, v1: .5 });
    S.trem(rf + 1.8, stab - .2, [78, 81], .18, .26, { inst: 'dan', rate: 12 });
    S.z(stab, 81, .7); S.dan(stab, 86 - 2, .5); S.bowed(stab, 76, 1.4, .5, { sfz: true, rel: 1 }); S.flute(stab, 86, 1.4, .3, { att: .02, rel: 1 });
    S.gs = 1;
  }
  {
    // 3-22 无岸现形（长嗥第二次，更近）→ 3-23 不肯断的一线 → 3-24 离魂（当＋宏大低频）→ 3-25 放手（吸噬长音→一拍空白→骤空，只剩剑吟）
    const wu2 = J3('wuan2'), ln = J3('line'), dang = J3('dang'), peel = J3('peel'), rel = J3('release'), a4 = A('act4').start;
    S.section('三·无岸→放手', wu2, a4, '长嗥第二次（更近更大）；剑吟若断若续横在嗥里；离魂「当」＋宏大低频；吸噬长音渐强→放手处一拍空白，只剩剑吟', '放手留白');
    S.mark(wu2, '三·长嗥（近）'); S.cello(wu2, 45, 5.2, .72, { att: .4, rel: 1.6, lp: 2600, send: .4, bend: [[0, 0], [.6, 0], [1.6, 3], [3, 3], [4.6, -2], [5.2, -2.5]], vib: { f: 4.5, c: 16, at: .8, ramp: 1 } });
    S.cello(wu2 + .05, 57, 5, .48, { att: .5, rel: 1.6, lp: 2600, send: .4, bend: [[0, 0], [.6, 0], [1.6, 3], [3, 3], [4.6, -2], [5.2, -2.5]] });
    S.noise(wu2 - .5, dang - wu2 + 1, .3, { f: 300, q: .5, white: .2, gust: .7, att: 1, rel: .5 });
    S.pad('cello', wu2 + 3, dang, [38], .36, { fi: 2, fo: .05, genv: [[wu2, .8], [dang - 3, 1.1], [dang, 1.3]] });
    // 不肯断的一线：剑吟若断若续
    S.bowed(ln - 2, 74, dang - ln + 2, .34, { att: .5, rel: .05, env: [[0, .6], [1.5, 1], [2.2, .25], [2.6, 1], [4.5, .9], [5, .2], [5.6, .95], [7.5, 1], [8.1, .3], [8.5, 1], [10, .9], [10.6, .3], [11.2, 1]] });
    S.cello(ln + 2, 45, 4.6, .4, { att: .5, rel: 1.5, lp: 1200, bend: [[0, 0], [1, 2], [3.6, -2]] });
    // 离魂：「当」
    S.gong(dang, 1, { rate: 1 }); S.gong(dang, .9, { rate: .5, d: 8, rel: 4 }); S.sub(dang, 1, { f0: 64, f1: 30, dec: 1.4, subD: 4 }); S.drum(dang, .9); S.cym(dang, .4, { lp: 5000 });
    // 吸噬长音：低弦与地鸣越吸越紧，放手处一拍空白
    S.pad('cello', peel, rel - .02, [38, 39, 45], .36, { fi: 2.5, fo: .06, genv: [[peel, .6], [J3('chase'), .9], [J3('reach'), 1.2], [rel - .2, 1.5], [rel, 1.5]] });
    S.pad('bowed', J3('chase'), rel - .02, [62, 63], .26, { fi: 2, fo: .06, genv: [[J3('chase'), .6], [rel - .3, 1.4]] });
    S.noise(peel, rel - peel, .4, { f: 90, fk: [[peel, 70], [rel, 220]], q: .9, att: 2, rel: .06 });
    S.roll(J3('stop'), rel - .05, .1, .5, { rate: [10, 18], lp: 1200 });
    const hum = rel + .9;
    S.bowed(hum, 74, a4 - hum + 1.5, .28, { att: 1.2, rel: 1.5, swell: [.7, 1, .8] });
    S.gliss(J3('split'), 2.4, 77, 57, .2, { inst: 'dan', curve: 1.3, v1: .14 });                       // 血杀之气流走
    S.mark(rel, '三·放手（一拍空白，只剩剑吟）');
  }

  /* ======================= 第四幕 · 初生 ======================= */
  const a4 = A('act4');
  {
    // 4-01 离魂第二次（更沉）→ 4-02 反击：禅唱般持续和声＋三声递升重击＋主题昂扬半句 → 4-04 缝隙收窄（上行弦乐与下压低音同时逼近）→ 4-05 乐队全静
    const dg = B4('dang2'), ch = B4('chant'), hm = B4('hitMountain'), lj = B4('lidJump'), fl = B4('flagLand'), cg = B4('charge'), sp = B4('spark'), stop = B4('stop');
    S.section('四·反击→收窄', a4.start, stop, '离魂第二次（更沉）；禅唱般低弦和声；三声递升重击（D→A→D）；主题昂扬半句；上行弦乐与下压低音相向逼近，到火星处乐队全静');
    S.gong(dg, .95, { rate: .82 }); S.gong(dg, .8, { rate: .42, d: 9, rel: 4 }); S.sub(dg, 1, { f0: 56, f1: 28, dec: 1.6, subD: 4.5 });
    if (S.has('act4.mindHit')) S.drum(B4('mindHit'), .46, { lp: 400, sub: .4 });                // 离魂环撞上雾心
    if (S.has('act4.launch') && hm - B4('launch') < 2) S.inhale(B4('launch'), .32);               // 珠蓄势一退射出
    S.pad('cello', ch, cg + .4, [38, 45, 50], .4, { fi: 2, fo: .6, genv: [[ch, .7], [hm, 1], [fl, 1.15], [cg, 1]] });
    S.pad('bowed', ch + 1, cg + .4, [57, 62, 65], .24, { fi: 2.5, fo: .6 });
    [[hm, 38, .85], [lj, 45, .92], [fl, 50, 1]].forEach(([t, m, v]) => { S.drum(t, v, { sub: v * .8 }); S.drum(t + .015, v * .7); S.cello(t, m, 2.4, .7, { sfz: true, rel: 1.2 }); S.strum(t, [m + 12, m + 19, m + 24], .7, { spread: .012 }); S.gong(t, .3 + .1 * (m - 38) / 12, { rate: 1.1 + (m - 38) / 30, d: 3, rel: 2 }); });
    S.drum(B4('songFall'), .5, { lp: 400 });
    S.themeAt('四·反击 主题昂扬半句', lj + .5, (fl - lj - .5) / 4.3, D, 'q', 'zheng', (tt, m, d) => S.trem(tt, tt + d * .9, m, .52, .6, { rate: 13, cut: true }));
    // 缝隙收窄
    const up = [69, 72, 74, 77, 79], dn = [50, 48, 45, 43, 41], st = (sp - cg) / 5;
    up.forEach((m, j) => S.bowed(cg + j * st, m > 80 ? 80 : m, st + .1, .38 + .07 * j, { att: .08, rel: .1, off: .35 }));
    dn.forEach((m, j) => S.cello(cg + j * st, m, st + .1, .5 + .07 * j, { att: .08, rel: .1, off: .3 }));
    S.roll(cg + 1, sp - .02, .12, .62, { rate: [9, 18] }); S.inhale(sp, .4);
    S.drum(sp, .75, { sub: .6, d: .3, rel: .1 }); S.cym(sp, .4, { d: .25, rel: .08 });
    S.mark(stop, '四·乐队全静');
  }
  {
    // 4-05 惊喜：灵明动机（极轻高音一串），乐队全静 → 4-06 三音同升未炸 → 4-07 炸开 → 4-08 扑护：主题第一次完整而温柔（不是最响），大鼓一击
    const ta = B4('turnAway'), sp = B4('sprout'), ls = B4('lidShut'), ht = B4('heat'), bu = B4('burst'), ct = B4('contact'), fx = B4('flinch');
    S.section('四·灵明→扑护', B4('stop'), B4('halfOut'), '灵明动机（越南筝极轻高音）；三音同升不炸；炸开；扑护：主题前后句第一次完整而温柔——古筝领奏、大提琴暖低音、长笛后句轻和，大鼓一击', '主题完整');
    const lm = (t, sh, v) => LINGMING.forEach((iv, j) => S.dan(t + [0, .45, .9, 1.6][j], D + iv + sh, v * (j === 3 ? 1.1 : 1), { vib: j === 3, send: .55, exact: true }));
    lm(sp, 0, .3); S.mark(sp, '四·灵明动机');
    S.bowed(sp + 2.2, 81 - 1, 3.5, .1, { att: 1.5, rel: 2, lp: 6000 });
    S.drum(ls, .4, { lp: 160, sub: .3 });
    if (ls - sp > 8) {                                                                           // 转离出口、缝一寸寸合拢：灵明动机轻轻再一遍，暖低音与温和剑吟铺到缝合
      const tw = B4('turnAway', sp + 5);
      lm(tw + .4, 0, .22);
      S.pad('cello', tw, ls + .6, [38], .2, { fi: 3, fo: 1 });
      S.bowed(tw + 2, 74, ls - tw - 2, .2, { att: 2, rel: 1.5, swell: [.6, 1, .7] });
    }
    // 三音同升（D3/A3/D4 一起向上推 3 个半音），未炸
    S.mark(ht, '四·三音同升'); [[50, 'cello'], [57, 'cello'], [62, 'bowed']].forEach(([m, i]) => S[i](ht, m, bu - ht, .42, { att: 1, rel: .05, bend: [[0, 0], [bu - ht, 3]], swell: [.4, .9, 1.4] }));
    S.drum(B4('kick'), .55, { sub: .4 }); S.roll(B4('kick') + .2, bu - .03, .15, .6, { rate: [10, 18] });
    S.drum(bu, 1, { sub: .9 }); S.drum(bu + .015, .8); S.cym(bu, .7); S.gong(bu, .7, { rate: .9, d: 5, rel: 3 });
    S.cello(B4('dragonOut'), 38, 2.6, .7, { sfz: true, rel: 1.5, bend: [[0, 0], [.4, 0], [2, -1.5]] });
    S.pad('cello', bu + 1.5, ct, [38], .3, { fi: 1.5, fo: .6 });
    // 扑护：♩≈66，前句＋后句（16 拍），古筝领奏（揉弦），大提琴暖低音，弦乐长音，长笛在后句轻轻和
    const b = .9, end = ct + 16 * b;
    S.drum(ct, .6, { lp: 900, sub: .55 });
    S.themeAt('四·扑护 主题完整', ct, b, D, 'ab', 'zheng', (tt, m, d, j, last) => {
      S.z(tt, m, .6 + (d > 1.2 ? .05 : 0), { vib: d > .6, d: last ? 5 : undefined, bend: j === 4 ? 'up1' : undefined, bt: .55 });
      if (j >= 6) S.flute(tt, m + 12 > 93 ? m : m + 12, d + (last ? 2.5 : .08), .26, { att: j === 6 ? .3 : .08, rel: last ? 2 : .2, off: j === 6 ? 0 : .3, send: .45 });
    });
    const bass = [[0, 38, 4], [4, 41, 2], [6, 43, 2], [8, 46, 2], [10, 41, 2], [12, 43, 1.5], [13.5, 38, 2.5]];
    bass.forEach(([bt, m, l]) => S.cello(ct + bt * b, m, l * b + .15, .46, { att: .35, rel: .5 }));
    bass.forEach(([bt, m, l]) => S.dan(ct + bt * b, m + 12, .26));
    S.pad('bowed', ct + .5, end + 2, [57, 62], .2, { fi: 2.5, fo: 2.5, genv: [[ct, .7], [ct + 8 * b, 1], [end, .9]] });
    S.bowed(B4('hum'), 74, 3.5, .26, { att: .6, rel: 1.6, swell: [.6, 1, .7] });               // 剑吟的温柔版回应
    // 4-10 代价：主题在低音区持续（大提琴缓慢的头四音）
    S.line('cello', fx, [[38, 1.6], [45, 2.2], [43, .8], [45, 2]], .48, { att: .6 });
    S.noise(fx, 9, .2, { f: 120, q: .7, att: 2, rel: 3 });
  }
  {
    // 4-11 一半火灭（噗）→ 细碎的金属颤音 → 4-12 相接（呼吸般的弦乐）→ 4-13 盼（灵明动机低一点）→ 4-14 一沉（碎片互相打架）→ 4-15 外患（长嗥第三次，远）→ 4-16 远方一缕（长笛远声）→ 4-17 吸气的一拍空白
    const ho = B4('halfOut'), fc = B4('fuClear'), li = B4('listen'), cha = B4('chaos'), mf = B4('memFlash'), pre = B4('pressure'), w3 = B4('wuan3'), fl = B4('fuLine'), ts = B4('tense'), cut = B4('cut');
    S.section('四·火灭→远方一缕', ho, cut, '「噗」后越南筝细碎颤音；相接：弦乐呼吸般起伏；灵明动机低四度回来；碎片打架（鼓、刮奏、弦乐短刺）；长嗥第三次远；长笛远声一缕主题头；吸气后一拍空白', '远声');
    S.gs = 1.3;
    S.sub(ho, .5, { f0: 90, f1: 40, dec: .25 }); S.noise(ho, 1.2, .4, { f: 500, q: .5, white: .6, att: .02, rel: .9 });
    S.trem(ho + .5, fc - .3, [81, 83], .14, .1, { inst: 'dan', rate: 16, send: .5 }); S.trem(ho + 2.4, fc - 1.5, [86 - 2, 81], .1, .08, { inst: 'dan', rate: 13, send: .5 });
    S.pad('cello', ho, fc, [38], .26, { fi: 1, fo: 1 });
    const br = [[fc, .6], [fc + 2, 1], [fc + 4, .65], [fc + 6, 1], [fc + 8, .7], [li, .9], [mf - 1, .8]];
    S.pad('cello', fc - .5, mf, [50], .32, { fi: 2, fo: 1.5, genv: br }); S.pad('bowed', fc, mf, [57, 62], .26, { fi: 2, fo: 1.5, genv: br });
    LINGMING.forEach((iv, j) => S.dan(li + [0, .5, 1, 1.8][j], D + iv - 5, .3, { vib: j === 3, send: .55, exact: true }));
    // 碎片：古战场的鼓、剑啸、风，互相打架
    const sg = S.has('act4.seal') ? B4('seal') : null, fe = sg != null ? sg : pre;               // 碎片打到谷梁结印为止
    const r = S.rnd(907); S.mark(mf, '四·碎片打架');
    for (let t = mf; t < fe - .3; t += .35 + r() * .5) {
      const k = Math.floor(r() * 4);
      if (k === 0) S.drum(t, .35 + r() * .3, { lp: 1200 + r() * 2000, pan: (r() - .5) * .8 });
      else if (k === 1) S.gliss(t, .3, 62 + Math.floor(r() * 3) * 5, 74 + Math.floor(r() * 2) * 5, .3, { curve: 1 });
      else if (k === 2) S.bowed(t, [74, 75, 69, 70][Math.floor(r() * 4)], .6, .3, { sfz: true, rel: .3 });
      else S.z(t, [81, 79, 77, 72][Math.floor(r() * 4)], .4, { bend: 'down', bt: .08 });
    }
    S.noise(mf, fe - mf + 1, .3, { f: 600, q: .5, white: .3, gust: .8, att: 1, rel: 1 });
    S.pad('cello', cha - 1, fl + 2, [38, 39], .3, { fi: 1.5, fo: 2, genv: sg != null && pre - sg > 2 ? [[cha, .8], [sg, .8], [sg + .6, .3], [pre - .4, .3], [pre, 1.2], [w3 + 4, 1], [fl, .6]] : [[cha, .8], [pre, 1.2], [w3 + 4, 1], [fl, .6]] });
    if (sg != null && pre - sg > 2) {                                                            // 谷梁结印＝宗师一铃；「莫让剑灵醒转」处配乐让位，只剩压低的低音
      S.gong(sg, .3, { rate: 2.1, d: 4, rel: 2, send: .5 }); S.dan(sg, 84, .24, { vib: true }); S.mark(sg, '四·谷梁结印（让位）');
    }
    S.noise(pre, B4('dent') - pre + 3, .46, { f: 85, q: .7, att: .6, rel: 3 });
    S.drum(B4('pour'), .7, { sub: .6, lp: 700 });
    S.cello(w3, 45, 5.2, .4, { att: .5, rel: 1.6, lp: 600, send: .6, bend: [[0, 0], [.6, 0], [1.6, 3], [3, 3], [4.6, -2], [5.2, -2.5]] });   // 长嗥第三次（远）
    S.drum(B4('dent'), .6, { lp: 500, sub: .5 });
    // 远方一缕：长笛远声（主题头，极轻、低通、湿）——远而不弱：本小段整体再提约 2.5dB
    S.gs = 1.75;
    S.themeAt('四·远方一缕 长笛远声', fl, 1.7, D + 12, 'head', 'flute', (tt, m, d, j, last) => S.flute(tt, m, d + (last ? 3 : .15), .44, { att: .4, rel: last ? 2.5 : .3, lp: 5000, send: .58, off: j ? .3 : 0 }));
    S.flute(B4('jade'), 86, 4, .16, { att: 1.5, rel: 2, lp: 4000, send: .7 });
    S.pad('bowed', fl + 1, ts + 2, [62, 69], .2, { fi: 3, fo: 1.5 });
    S.pad('cello', B4('jade'), cut - 1.4, [38], .3, { fi: 2, fo: .8, genv: [[B4('jade'), .7], [ts, 1], [cut - 2, 1.2]] });
    S.bowed(ts, 62, cut - ts - 1.5, .3, { att: 1, rel: .3, swell: [.5, .9, 1.3] });
    S.inhale(cut - 1.3, .42, { lp: 6000 });                                                         // 吸气，然后一拍空白
    S.mark(cut - 1.3, '四·吸气后一拍空白');
    S.gs = 1;
  }

  /* ======================= 第五幕 · 剑破 ======================= */
  const a5 = A('act5');
  {
    // 5-01 「铮！」→ 5-02 纯粹（只剩主题单音）→ 5-03 剑起 ——意外的轻盈
    const zh = K5('zheng'), pu = K5('purity'), sw = K5('swordWake'), te = K5('tear'), n1 = K5('nian1');
    S.section('五·轻盈', a5.start, n1, '「铮！」古筝高音扫弦＋弦乐亮音；只剩主题第一音 D 轻轻复现；剑起：刮奏撕开；古筝轻快的上行音型预备 G 调');
    S.strum(zh, [62, 69, 74, 81], .86, { spread: .01 }); S.bowed(zh, 74, 4, .44, { sfz: true, rel: 2.5 }); S.flute(zh, 86, 1.6, .24, { att: .02, rel: 1.2 });
    S.gong(zh, .26, { rate: 2, d: 3, rel: 2, send: .5 });
    S.gs = 1.3;
    [0, 1.6, 3.1, 4.4].forEach((dt, j) => { S.z(pu + dt, 74, .36 - j * .03, { vib: true }); S.mark(pu + dt, j ? '' : '五·纯粹（只剩单音 D）'); });
    S.bowed(pu, 62, sw - pu + 1, .2, { att: 2, rel: 1.5 });
    S.gs = 1;
    S.cym(te - .05, .34, { att: .25, lp: 8000 }); S.gliss(te, .5, 55, 79, .5, { key: 55, v1: .62 });
    const r = S.rnd(55), fig = [67, 74, 72, 74, 79, 77, 74, 72];
    for (let t = te + 1, k = 0; t < n1 - .3; t += .25, k++) S.z(t, fig[k % 8] - (k % 16 >= 8 ? 5 : 0), .3 + r() * .08 + (k % 4 ? 0 : .06), { hum: 5 });
    S.pad('cello', sw, n1 + .2, [43], .26, { fi: 2, fo: .3 });
  }
  {
    // 5-04~5-09 一至七转：变调不变速（♩=120 不变，每转按 cue 起拍，局部微调 ≤1.5%），G→G♯→A→B♭→B→C→C♯ 逐转上行；
    // 每转：转首重音（鼓、钹、扫弦）＋问句（主题前五音，停在 ♭7）一转高过一转；鼓点逐转加密；一、三、七转前反向钹吸气
    const turns = [1, 2, 3, 4, 5, 6, 7].map((k) => K5('turn' + k)), lim = K5('limit');
    S.section('五·一至七转', K5('nian1'), K5('release'), '变调不变速：每转升半音（G→C♯），问句一转高过一转、始终不解决；鼓点逐转加密；一、三、七转前吸气；六转里离魂第三次与两兽长啸');
    [K5('nian1'), K5('nian2'), K5('nian3')].forEach((t, j) => { const tg = j === 0 ? turns[0] : j === 1 ? turns[2] : turns[6]; S.inhale(tg, .3 + .1 * j); S.noise(t, tg - t, .2 + .08 * j, { f: 1200, fk: [[t, 600], [tg, 2600]], q: .6, white: .4, att: (tg - t) * .8, rel: .05 }); });
    turns.forEach((t0, k) => {
      const t1 = k < 6 ? turns[k + 1] : lim, nb = Math.round((t1 - t0) / .5), b = (t1 - t0) / nb, key = 55 + k, I = k / 6;
      const lowR = key - 24 < 36 ? key - 12 : key - 24;
      // 转首
      S.drum(t0, .62 + .05 * k, { sub: .45 + .07 * k }); S.cym(t0, .3 + .07 * k);
      S.strum(t0, [key - 12 < 49 ? key : key - 12, key + 7 - 12 < 49 ? key + 7 : key - 5, key, key + 7], .6 + .05 * k, { spread: .014 });
      if (k >= 3) S.gong(t0, .2 + .05 * k, { rate: 1.3 - .03 * k, d: 3, rel: 2 });
      // 低音：一二转长音，三转起八分音脉动
      if (k < 2) S.cello(t0, lowR, t1 - t0 + .1, .5 + .04 * k, { att: .05, rel: .15, off: .3 });
      else for (let j = 0; j < nb * 2; j++) S.cello(t0 + j * b / 2, j % 8 === 6 ? lowR + 7 : lowR, b * .38, .42 + .06 * k * (j % 2 ? .7 : 1), { att: .012, rel: .08, off: .32 });
      if (k >= 4) S.pad('bowed', t0, t1, [key - 12 < 53 ? key : key - 12, key + 7 - 12 < 53 ? key + 7 : key - 5], .28 + .05 * k, { fi: .05, fo: .05, seg: 20 });
      // 鼓点逐转加密
      for (let j = 1; j < nb * 4; j++) {
        const t = t0 + j * b / 4, on4 = j % 4 === 0, on2 = j % 2 === 0, bar = j % 8 === 0;
        let v = 0;
        if (k === 0 && bar) v = .44;
        else if (k === 1 && on4) v = j % 8 === 0 ? .5 : .36;
        else if (k === 2 && on4) v = .48;
        else if (k === 3 && (on4 || j % 8 === 6)) v = on4 ? .52 : .34;
        else if (k === 4 && on2) v = on4 ? .56 : .34;
        else if (k === 5 && on2) v = on4 ? .6 : .38;
        else if (k === 6) v = on4 ? .66 : on2 ? .44 : .3;
        if (v) S.drum(t, v * (1 + .08 * I), { lp: 2000 + 3000 * I });
        if (k >= 2 && j % 8 === 4) S.snare(t, .3 + .3 * I);
        if (k >= 5 && j % 4 === 3) S.snare(t, .2 + .2 * I);
      }
      // 古筝音型：二转起八分音，四转起高音摇指
      if (k >= 1) for (let j = 0; j < nb * 2; j++) { const fig = k >= 3 ? [0, 7, 12, 7, 0, 7, 12, 7] : [0, 7, 12, 7, 10, 7, 12, 15]; S.z(t0 + j * b / 2, key + fig[j % 8] > 78 ? key + fig[j % 8] - 12 : key + fig[j % 8], (k >= 3 ? .24 + .015 * k : .3 + .04 * k) + (j % 2 ? 0 : .04), { hum: 4, exact: false }); }
      // 问句（主题前五音），一转高过一转，不解决
      const qb = Math.min(b, (t1 - t0 - .3) / 6);
      S.themeAt('五·' + (k + 1) + '转 问句', t0 + b, qb, key, 'q', k < 2 ? 'zheng' : k < 4 ? 'zheng+flute' : 'zheng+flute+bowed', (tt, m, d, j, last) => {
        if (k >= 3) S.trem(tt, tt + d * (last ? 1.4 : .92), m + 12 > 78 ? m : m + 12, .56 + .05 * k, .64 + .05 * k, { rate: 13 + k, cut: true });
        else S.z(tt, m + 12 > 78 ? m : m + 12, .56 + .05 * k, { vib: d > .6 });
        if (k >= 1) S.flute(tt, m + 12, d * (last ? 1.6 : 1) + .05, .34 + .06 * k, { att: .04, rel: .2, off: j ? .3 : 0 });
        if (k >= 4) S.bowed(tt, m > 80 ? m - 12 : m, d * (last ? 1.6 : 1) + .05, .48 + .05 * k, { att: .03, rel: .2, off: .35 });
      });
      if (k >= 5) S.gliss(t1 - .55, .5, key, key + 24 > 78 ? 78 : key + 24, .36 + .05 * k, { key, curve: .8 });
    });
    // 六转里：离魂第三次＋两兽长啸
    const bg = K5('beastsGrow');
    S.gong(bg, .9, { rate: .9 }); S.gong(bg, .8, { rate: .45, d: 7, rel: 3 }); S.sub(bg, .9, { f0: 60, f1: 30, dec: 1.2, subD: 3.5 });
    [[bg + .2, 45], [K5('beastsDive'), 48]].forEach(([t, m]) => S.cello(t, m, 3.4, .5, { att: .3, rel: 1, lp: 1800, bend: [[0, 0], [.5, 0], [1.3, 3], [2.4, 3], [3.4, -2]] }));
    // 七转末到极限：停在高音颤音（G♯5 摇指＋弦乐高音＋长笛 C♯6），剑脊里一个更低更亮的 D 悄悄进来
    S.trem(lim, K5('release'), 80, .62, .4, { inst: 'dan', rate: 16, cut: true }); S.bowed(lim, 80, K5('release') - lim + .3, .56, { att: .02, rel: .35, off: .35, vib: { f: 6.5, c: 30, at: .2, ramp: .5 } });
    S.flute(lim, 85, K5('release') - lim + .3, .32, { att: .02, rel: .35, off: .3 }); S.drum(lim, .7, { sub: .5 }); S.roll(lim + .1, K5('release') - .1, .4, .2, { rate: 16, lp: 2000 });
    S.cello(lim + .7, 50, K5('caught') - lim - .5, .34, { att: 1.2, rel: .4 }); S.dan(lim + 1.5, 62, .36, { vib: true });
    S.mark(lim, '五·极限（停在高音颤音）');
  }
  {
    // 5-11 力竭被牵：古篆在剑脊里复现（R4 的上行分解）→ 错愕停顿 → 缓慢上行滑音 → 5-12 第八转：剑接管，主题由低弦与大鼓齐奏（D）
    const rl = K5('release'), gs = K5('glyphSelf'), cg = K5('caught'), pl = K5('pulled'), t8 = K5('turn8'), cc = K5('carryContact');
    S.section('五·力竭→第八转', rl, cc, '力竭后只剩低 D；古篆复现（R4 分解）；错愕停顿后低弦缓慢上行滑音；第八转：主题前句由大提琴组＋小提琴组低八度与大鼓齐奏（同节奏），回到 D', '剑接管');
    S.noise(rl, cg - rl + 1, .2, { f: 70, q: .7, att: .5, rel: 1 });
    [0, .7, 1.4, 2.1].forEach((dt, j) => { S.z(gs + dt, [62, 65, 69, 74][j], .36 + .04 * j, { vib: true }); S.dan(gs + dt, [50, 53, 57, 62][j], .2); });
    S.cello(pl, 50, t8 - pl + .1, .5, { att: .6, rel: .1, bend: [[0, 0], [.4, 0], [t8 - pl, 5]], swell: [.4, .9, 1.3] });
    S.bowed(pl + .2, 57, t8 - pl - .1, .36, { att: .6, rel: .1, bend: [[0, 0], [.4, 0], [t8 - pl - .2, 5]], swell: [.4, .9, 1.3] });
    S.roll(pl + 1, t8 - .03, .1, .6, { rate: [8, 16] }); S.inhale(t8, .45);
    const b = (cc - t8) / 8;
    S.cym(t8, .62); S.gong(t8, .6, { rate: .9, d: 6, rel: 3 });
    S.themeAt('五·第八转 低弦＋鼓齐奏', t8, b, D - 12, 'a', 'cello+bowed+drum', (tt, m, d, j, last) => {
      const L = last ? cc - tt + .4 : d + .05;
      S.cello(tt, m - 12, L, .82, { att: .02, rel: last ? .5 : .1, off: .3 }); S.cello(tt, m, L, .74, { att: .02, rel: last ? .5 : .1, off: .3 });
      S.bowed(tt, m + 12 < 53 ? m + 24 : m + 12, L, .62, { att: .02, rel: last ? .5 : .1, off: .4 });
      S.drum(tt, .78 + .03 * j, { sub: .5 + .05 * j }); S.drum(tt + .012, .5);
      S.strum(tt, [m + 12, m + 19, m + 24].map((x) => (x > 78 ? x - 12 : x)), .5 + .03 * j, { spread: .012 });
    });
    S.mark(t8, '五·第八转 剑接管');
  }
  {
    // 5-13 反带：主题全奏（前句＋后句，♩≈96）→ 5-14 回响：R3 的长吟（长笛 A5）混进全奏 → 5-15 扶摇直上（风啸上冲）→ 切回只剩剑吟 → 5-16 两线分开
    const cc = K5('carryContact'), ec = K5('echo'), eo = K5('echoOut'), ru = K5('rush'), ss = K5('stillSword'), ap = K5('apart'), ask = K5('ask');
    S.section('五·反带→回响→扶摇', cc, ask, '主题全奏一遍（古筝摇指领、长笛八度、低弦、鼓）；回响：长笛 A5 长吟＝回忆 R3 的剑光离体；扶摇直上的上冲；切回只剩剑吟；两条线一升一降');
    const b = (ec - cc) / 14;
    S.themeAt('五·反带 主题全奏', cc, b, D, 'ab', 'tutti', (tt, m, d, j, last) => {
      S.trem(tt, tt + d * .94, m + 12 > 78 ? m : m + 12, .72, .8, { rate: 14, cut: !last });
      S.flute(tt, m + 12, d + .05 + (last ? 1.5 : 0), .52, { att: .03, rel: last ? 1 : .15, off: j ? .3 : 0 });
      S.bowed(tt, m, d + .05 + (last ? 1.5 : 0), .6, { att: .03, rel: last ? 1 : .15, off: .35 });
    });
    const bass = [[0, 38], [2, 45], [4, 41], [6, 43], [8, 46], [10, 41], [12, 43], [14, 38]];
    bass.forEach(([bt, m], j) => { const t = cc + bt * b, L = j < bass.length - 1 ? 2 * b : eo - t; S.cello(t, m, L + .05, .58, { att: .03, rel: .2, off: .3 }); S.cello(t, m + 12, L + .05, .38, { att: .03, rel: .2, off: .3 }); });
    for (let j = 0; j < 32; j++) { const t = cc + j * b / 2; if (t > eo) break; S.drum(t, j % 4 === 0 ? .58 : j % 2 === 0 ? .42 : .26, { lp: 3000 }); if (j % 4 === 2) S.snare(t, .34); }
    S.cym(cc, .6); S.drum(cc, .9, { sub: .7 });
    // 回响：长笛 A5 长吟＋古筝回忆句
    S.flute(ec, 81, eo - ec + 2, .46, { att: .4, rel: 2, swell: [.8, 1.15, .8], send: .5 });
    S.mark(ec, '五·回响（R3 长吟）');
    S.pad('cello', eo - 1, ru + .2, [38, 45], .4, { fi: .5, fo: .2 });
    // 扶摇直上 → 切回只剩剑吟
    S.noise(ru, ss - ru + .05, .5, { f: 600, fk: [[ru, 500], [ss, 3200]], q: .7, white: .4, att: 1, rel: .05 });
    S.gliss(ru, ss - ru - .2, 50, 78, .5, { curve: 1.1, v1: .72 });
    S.bowed(ru, 69, ss - ru, .4, { att: .3, rel: .05, bend: [[0, 0], [ss - ru, 7]], swell: [.6, 1, 1.4] });
    S.roll(ru, ss - .03, .2, .66, { rate: [10, 20] });
    S.bowed(ss, 74, ap - ss + 1, .3, { att: .08, rel: 1, swell: [1, .9, .8] }); S.flute(ss + .2, 86, 2, .16, { att: .3, rel: 1.5, lp: 7000 });
    // 两线分开：长笛上行、大提琴下行
    const apL = Math.max(.6, Math.min(1.65, ask - ap - 2.4 + .6));                                 // 问句提前出时，末音收短让给问句
    S.line('flute', ap, [[74, 1.2], [79, 1.2], [81, apL]], .34, { att: .3 });
    S.line('cello', ap, [[50, 1.2], [45, 1.2], [38, apL + .45]], .48, { att: .3 });
  }
  {
    // 5-17 问句再现（与序幕同一句）→「一剑斩破」：问句落到高八度 D，全片最强 → 后句以高八度凯旋地说完 → 5-18 冰针 → 5-19 九转「波」
    const ask = K5('ask'), sl = K5('slash'), nd = K5('needle'), t9 = K5('turn9');
    S.section('五·问与答：一剑斩破', ask, t9, '问句原样再现（古筝，停在 C）＋低音持续与鼓滚渐强；「一剑斩破」＝问句落到高八度 D，全片最强一击；随后主题前句高八度凯旋地奏完；冰针一线', '全片最强');
    question(ask, D, .66, '五·问句再现');
    S.pad('cello', ask, sl - .02, [38], .42, { fi: .5, fo: .03, genv: [[ask, .7], [sl - 2, 1.1], [sl, 1.5]] });
    S.roll(ask + 1.5, sl - .02, .08, .8, { rate: [8, 20], pow: 2 }); S.inhale(sl, .6, { lp: 10000 });
    // 一剑斩破
    S.drum(sl, 1.2, { sub: 1.25 }); S.drum(sl + .01, 1.05); S.drum(sl + .02, .9); S.gong(sl, 1, { rate: .88 }); S.gong(sl, .7, { rate: .5, d: 8, rel: 4 }); S.cym(sl, 1); S.cym(sl + .03, .7, { rate: .85 });
    [38, 45, 50].forEach((m) => S.cello(sl, m, 4, .95, { sfz: true, rel: 2.5 }));
    [62, 69, 74].forEach((m) => S.bowed(sl, m, 4, .85, { sfz: true, rel: 2.5 }));
    S.flute(sl, 86, 4, .5, { att: .02, rel: 2 }); S.strum(sl, [50, 57, 62, 69, 74, 81], 1.05, { spread: .012 }); S.gliss(sl + .25, .9, 62, 86, .7, { inst: 'dan', curve: .8 });
    S.theme.push({ t: sl, m: 74, d: 2, label: '五·一剑斩破（问句落 D）', inst: 'tutti' });
    S.mark(sl, '五·一剑斩破');
    // 凯旋：主题前句高八度（长笛＋小提琴＋古筝摇指），低弦与鼓八分推进（♩=120）
    const b = .5, t0 = sl + 2 * b, end = nd - .2;
    for (let t = sl + b, j = 0; t < end; t += b / 2, j++) { S.cello(t, j % 8 === 6 ? 45 : 38, b * .4, .56, { att: .012, rel: .08, off: .3 }); if (j % 2 === 0) S.drum(t, j % 4 === 0 ? .6 : .42, { lp: 3200 }); if (j % 8 === 4) S.snare(t, .4); }
    S.themeAt('五·斩破后 主题高八度', t0, (end - t0) / 8.4, D + 12, 'a', 'flute+bowed+zheng', (tt, m, d, j, last) => {
      S.flute(tt, m, d + (last ? 1 : .05), .64, { att: .03, rel: last ? 1.2 : .15, off: j ? .3 : 0 });
      S.bowed(tt, m > 80 ? m - 12 : m, d + (last ? 1 : .05), .68, { att: .03, rel: last ? 1.2 : .15, off: .35 });
      S.trem(tt, tt + d * .94, m > 78 ? m - 12 : m, .7, .76, { rate: 15, cut: true });
    });
    S.cym(end - .1, .5);
    // 冰针：极高单音持续，其余退下
    S.flute(nd, 93, t9 - nd + .3, .3, { att: .3, rel: .3, swell: [.6, .9, 1.1] }); S.bowed(nd, 80, t9 - nd + .3, .26, { att: .5, rel: .3 });
    S.pad('cello', nd, t9, [38], .3, { fi: .6, fo: .1 });
  }
  {
    // 5-19 九转「波」→ 5-20 不妥协：主题头四音反复推进（调内逐级上移）→ 5-21 劫源：低音区缓慢逼近的和弦 → 5-22 十转：青光单音被截住、白金旋律继续升 → 5-23 十一转雷鸣＋火浪塌落长音 → 5-24 绷断即静
    const t9 = K5('turn9'), bo = K5('bo'), pc = K5('pierce'), fu = K5('furnace'), t10 = K5('turn10'), tn = K5('tense'), t11 = K5('turn11'), th = K5('thunder'), co = K5('collapse'), tr = K5('tremble'), sn = K5('snap');
    S.section('五·九转→绷断', t9, A('act6').start, '九转「波」（锣＋鼓）；主题头四音逐级推进；劫源低音和弦逼近；十转：长笛单音被截断、小提琴组旋律继续升；十一转：全片最长最沉的雷（鼓滚、低锣、低频）与火浪塌落长音；一根弦崩断，即静', '绷断即静');
    S.gong(bo, .75, { rate: 1.25, d: 4, rel: 2 }); S.drum(bo, .85, { sub: .7 }); S.sub(bo, .6, { f0: 110, f1: 50, dec: .3 });
    const b = .5;
    for (let t = bo + b, j = 0; t < fu - .1; t += b / 2, j++) { S.cello(t, j % 8 === 6 ? 45 : 38, b * .38, .56, { att: .012, rel: .08, off: .3 }); if (j % 2 === 0) S.drum(t, j % 4 === 0 ? .6 : .42, { lp: 3000 }); }
    S.pad('bowed', bo, pc, [62, 69], .3, { fi: .5, fo: .3 });
    // 不妥协：头四音在调内逐级上移（D、F、G、A 起）
    const hb = (fu - pc) / 16;
    [0, 1, 2, 3].forEach((s, i) => {
      const k0 = deg(D, 'yu', s);
      S.themeAt('五·不妥协 头四音' + (i + 1), pc + i * 4 * hb, hb, k0, [[0, 1], [deg(D, 'yu', s + 3) - k0, 1.5], [deg(D, 'yu', s + 2) - k0, .5], [deg(D, 'yu', s + 3) - k0, 1]], 'zheng+cello', (tt, m, d) => {
        S.trem(tt, tt + d * .92, m > 78 ? m - 12 : m, .68 + .03 * i, .74 + .03 * i, { rate: 14, cut: true }); S.cello(tt, m - 24 < 36 ? m - 12 : m - 24, d + .04, .54 + .03 * i, { att: .02, rel: .1, off: .3 });
      });
    });
    // 劫源：低音区一个缓慢逼近的和弦
    S.pad('cello', fu, t10, [38, 41, 44], .4, { fi: 3, fo: .05, genv: [[fu, .5], [K5('eyeOpen'), .8], [t10 - .5, 1.4]] });
    S.noise(fu, t10 - fu, .4, { f: 60, fk: [[fu, 50], [t10, 130]], q: .8, att: 3, rel: .05 });
    S.drum(K5('eyeOpen'), .6, { lp: 500, sub: .6 }); S.roll(t10 - 2, t10 - .03, .1, .6, { rate: [8, 16] });
    // 十转：青光单音（长笛）被截住，白金旋律（小提琴组＋古筝）继续升（E 调）
    S.flute(K5('eyeOpen') + 1, 81, t10 - K5('eyeOpen') - 1, .3, { att: 1, rel: .01 });
    S.drum(t10, .9, { sub: .8 }); S.cym(t10, .66); S.gong(t10, .4, { rate: 1.1, d: 3, rel: 2 });
    S.line('bowed', t10, [[64, 1.4], [71, 1.4], [69, .7], [71, 1.4], [74, 1.4], [76, 1.6], [79, 1.4]], .58, { att: .05 });
    [64, 71, 69, 71, 74, 76, 79].forEach((m, j) => S.trem(t10 + [0, 1.4, 2.8, 3.5, 4.9, 6.3, 7.9][j], t10 + [1.3, 2.7, 3.4, 4.8, 6.2, 7.8, 9.2][j], m, .5, .56, { rate: 14, cut: true }));
    for (let t = t10, j = 0; t < tn; t += b / 2, j++) { S.cello(t, 40, b * .38, .56, { att: .012, rel: .08, off: .3 }); if (j % 2 === 0) S.drum(t, j % 4 === 0 ? .6 : .44, { lp: 3000 }); }
    S.bowed(tn, 80, t11 - tn + .1, .5, { att: .1, rel: .05, vib: { f: 7, c: 35, at: .1, ramp: .3 } }); S.trem(tn, t11, 80, .4, .6, { inst: 'dan', rate: 18, cut: true });
    S.roll(tn, th - .02, .25, .72, { rate: [12, 22] }); S.inhale(th, .55);
    // 十一转：雷鸣（全片最长最沉）
    S.roll(th, th + 4.5, .72, .22, { rate: 22, pow: .8, lp: 700 }); S.drum(th, .92, { sub: .9 }); S.gong(th, .78, { rate: .62 }); S.gong(th + .05, .62, { rate: .45 }); S.cym(th, .55, { rate: .8, lp: 6000 });
    S.sub(th + .3, .8, { f0: 50, f1: 26, dec: 2.2, subD: 6 }); S.noise(th, 11, .62, { f: 70, q: .7, att: .05, rel: 7 });
    // 火浪塌落的长音（≥3s）：低弦与弦乐一起往下坠
    S.cello(co, 50, 7, .62, { att: .1, rel: 3, bend: [[0, 0], [.5, 0], [7, -12]] }); S.cello(co, 57, 7, .44, { att: .1, rel: 3, bend: [[0, 0], [.5, 0], [7, -12]] });
    S.bowed(co, 74, 6, .5, { att: .1, rel: 3, bend: [[0, 0], [.5, 0], [6, -12]] });
    S.pad('cello', co + 6, sn - .02, [38], .3, { fi: 2, fo: .05, genv: [[co + 6, .7], [tr, 1], [sn - 2, .8]] });
    S.noise(tr, sn - tr, .26, { f: 90, q: .7, gust: .8, att: 1, rel: .05 }); S.roll(tr, tr + 3, .3, .08, { rate: 10, lp: 400 });
    // 绷断：一根弦崩断（古筝高音重拨、急上滑、骤止），即静
    S.note('zheng', sn, 74, 1.15, { exact: true, d: .14, rel: .012, bend: [[0, 0], [.03, 0], [.13, 2.2]] }); S.note('dan', sn, 81, .8, { exact: true, d: .12, rel: .012 });
    S.noise(sn + .13, .14, .5, { f: 3000, q: .6, white: 1, att: .002, rel: .12 }); S.drum(sn, .4, { lp: 600, d: .3, rel: .1 });
    S.mark(sn, '五·绷断即静');
  }

  /* ======================= 尾 ======================= */
  const a6 = A('act6');
  {
    const fa = C6('fall'), gu = C6('guard'), m1 = C6('mark1'), bm = C6('beam'), bh = C6('beamHit'), qu = C6('quake'), lj = C6('lidJump'), lb = C6('lidBack'), rise = C6('rise');
    S.section('尾·剑护人→警兆', a6.start, rise, '下坠风啸；剑护人：灵明动机＋温和弦吟＋古筝低音分解；三枚魂印＝一幕三日鸣各一声，第三声拉长；一拍空白后闷雷；震波；鼎盖跳起又被拉回两声巨响');
    S.mark(fa, '尾·下坠风啸'); S.noise(fa, 7, .3, { f: 1400, fk: [[fa, 2400], [fa + 7, 500]], q: .6, white: .3, att: .3, rel: 3 });
    S.pad('cello', fa + 3, bm + 1.5, [38], .26, { fi: 3, fo: 1.5, genv: [[fa + 3, .7], [gu, 1], [m1, 1.1], [bm, .9]] });
    LINGMING.forEach((iv, j) => S.dan(gu + [0, .5, 1, 1.8][j], D + iv, .3, { vib: j === 3, send: .55, exact: true }));
    S.bowed(gu + .3, 74, m1 - gu, .26, { att: 1.2, rel: 2 });
    [[0, 50], [.6, 57], [1.2, 62], [2.4, 57], [3.6, 50], [4.2, 57], [4.8, 65]].forEach(([dt, m]) => S.z(C6('caught') + dt, m, .34, { vib: true }));
    // 三枚魂印：E5、A5、E♭6（一幕「天怒」的三声日鸣），第三声拉长
    S.bowed(m1, 76, 1.6, .36, { att: .15, rel: 1 }); S.flute(C6('mark2'), 81, 1.6, .3, { att: .15, rel: 1 }); S.flute(C6('mark3'), 87, 4.2, .22, { att: .15, rel: 2.2, lp: 6500 });
    S.drum(m1, .4, { lp: 700 }); S.drum(C6('mark2'), .44, { lp: 700 }); S.drum(C6('mark3'), .5, { lp: 700, sub: .3 });
    S.bowed(C6('twist'), 62, bm - C6('twist') - .4, .26, { att: 1, rel: .5, swell: [.5, .9, 1.1] });
    // 一拍空白 → 闷雷
    S.drum(bh, .9, { lp: 300, sub: .9 }); S.noise(bh, 6, .6, { f: 70, q: .7, att: .05, rel: 4.5 }); S.gong(bh, .5, { rate: .55, d: 6, rel: 3, lp: 1500 });
    S.pad('cello', bh + .5, lj, [38, 45], .32, { fi: 2, fo: .2, genv: [[bh, .7], [qu, 1.1], [lj - 1, 1.2]] });
    S.noise(qu, 6, .5, { f: 55, fk: [[qu, 40], [qu + 3, 110]], q: .9, att: 2.5, rel: 3 }); S.roll(qu, qu + 4, .08, .4, { rate: 12, lp: 500 });
    [lj, lb].forEach((t, j) => { S.drum(t, 1, { sub: 1 }); S.drum(t + .012, .8); S.gong(t, .7 - .1 * j, { rate: .8 + .1 * j, d: 3, rel: 2 }); S.cello(t, 38, 1.2, .7, { sfz: true, rel: .6 }); });
    S.cym(lj, .5);
    S.pad('cello', lb + 1, rise + .5, [38], .32, { fi: 1.5, fo: .5 });
    S.trem(C6('smoke'), rise - .05, 57, .14, .4, { rate: [10, 14], cut: true });
  }
  {
    // 豪迈收束：鼓的行进渐起；主题最后一遍——七个音落在剑吟七声上（D A G A C D' → A'），以上行的五度收尾（开放，不是终止式），剑吟留到最后
    const rise = C6('rise'), songs = [1, 2, 3, 4, 5, 6, 7].map((k) => C6('song' + k)), end = C6('end');
    S.section('尾·豪迈收束', rise, end + .5, '鼓的行进渐起；主题最后一遍：七个音落在剑吟七声上（D A G A C D → A），以上行五度开放收尾，仍在抗争；剑吟（弦乐高音＋越南筝颤）留到最后', '开放结尾');
    const b = (songs[0] - rise) / 8;
    for (let j = 0; j < 8; j++) { S.drum(rise + j * b, .4 + .05 * j, { lp: 2000 + 400 * j }); S.cello(rise + j * b, 38, b * .7, .4 + .04 * j, { att: .02, rel: .2, off: .3 }); }
    S.pad('bowed', rise + 1, songs[0], [57, 62], .26, { fi: 2, fo: .3 });
    const line = [0, 7, 5, 7, 10, 12, 19];
    line.forEach((iv, j) => {
      const t = songs[j], nx = j < 6 ? songs[j + 1] : end + .3, d = nx - t, m = D + iv, last = j === 6, v = .62 + .05 * j;
      S.theme.push({ t: +t.toFixed(3), m, d: +d.toFixed(3), label: '尾·主题最后一遍', inst: 'tutti' });
      S.cello(t, m - 24 < 36 ? m - 12 : m - 24, last ? 5.5 : d + .05, v, { att: .02, rel: last ? 2.5 : .2, off: .3 });
      S.cello(t, 38, last ? 5.5 : d + .05, .5 + .04 * j, { att: .02, rel: last ? 2.5 : .2, off: .3 });
      S.bowed(t, m > 80 ? m - 12 : m, last ? 5.5 : d + .05, v * .9, { att: .02, rel: last ? 2.5 : .2, off: .35 });
      S.flute(t, m + 12 > 93 ? m : m + 12, last ? 5 : d + .05, .3 + .04 * j, { att: .03, rel: last ? 2.5 : .2, off: j ? .3 : 0 });
      S.trem(t, t + Math.min(d, 2.4) * .95, m > 78 ? m - 12 : m, .5 + .04 * j, .56 + .04 * j, { rate: 14, cut: !last });
      S.drum(t, .62 + .05 * j, { sub: .3 + .07 * j }); if (j >= 3) S.cym(t, .2 + .08 * (j - 3));
      for (let k = 1; k < 4 && t + k * d / 4 < nx - .1 && !last; k++) S.drum(t + k * d / 4, .34 + .03 * j, { lp: 2500 });
    });
    const fin = songs[6];
    S.gong(fin, .6, { rate: .95, d: 7, rel: 3 }); S.strum(fin, [50, 57, 62, 69, 74, 76], .86, { spread: .014 });
    S.drum(fin + 1.5, .5, { sub: .4 }); S.drum(fin + 2.25, .4); S.drum(C6('finalTremble'), .5, { sub: .4 });
    // 剑吟留到最后：小提琴组 A5/E5 渐亮＋越南筝高音颤
    S.bowed(fin + 1, 76, end - fin + .3, .34, { att: 1.2, rel: 1.6, swell: [.6, 1, 1.15] });
    S.trem(C6('finalTremble'), end - .2, [81, 84], .16, .26, { inst: 'dan', rate: 15 });
    S.mark(fin, '尾·上行五度开放收尾');
  }
  S.events.sort((x, y) => x.t - y.t);
  return S;
}
