/* 《斩龙封神》第五幕 js/act5.js —— 一刀断千载（870.0s – 1130.0s，260.0s，22 镜）
   全片立魂高潮：掌刑喝刀 → 碗大青莲抽尽水烟 → 道灭无愧一刀断首 → 时光决堤回溯血战自囚、挥泪斩孙腐骨化灰 →
   朝阳先生真容与求死不得千年孤候 → 参罗利那破颈狂遁、神将一刀两断、天罗摄道境万雷封茧。
   铁律：100% 纯 t 确定性（零 Math.random / Date / 跨帧可变状态），零几何正圆/硬框。 */
(function () {
  'use strict';
  var CINE = window.CINE, I = CINE.ink, U = CINE.util, M = CINE.motion, ZL = CINE.zl;
  var W = CINE.W || 1920, H = CINE.H || 1080;

  if (I.speaker) {
    I.speaker('掌刑神将', [188, 148, 76]);
    I.speaker('道人', [132, 44, 36]);
  }

  var BEATS = [
    ['5-01',   0.0,  10.5, '神将登台喝刀'],
    ['5-02',  10.5,  23.2, '冲霄龙煞成刀'],
    ['5-03',  23.2,  38.2, '伏石水烟抗刀'],
    ['5-04',  38.2,  56.0, '稽首种莲抽光'],
    ['5-05',  56.0,  68.5, '伏石长笑上阕'],
    ['5-06',  68.5,  81.2, '道灭无愧屏息'],
    ['5-07',  81.2,  93.5, '一刀断首压屏'],
    ['5-08',  93.5, 102.2, '断颈墨血化烟'],
    ['5-09', 102.2, 114.6, '长河决堤回溯'],
    ['5-10', 114.6, 122.6, '来迟血战群魔'],
    ['5-10b',122.6, 125.6, '自画血链穿胸'],
    ['5-11', 125.6, 135.2, '提孙按上断石'],
    ['5-12', 135.2, 146.6, '挥泪斩孙化灰'],
    ['5-13', 146.6, 162.0, '朝阳先生真容'],
    ['5-14', 162.0, 177.5, '力竭求死不得'],
    ['5-15', 177.5, 195.0, '变貌负链千年'],
    ['5-16', 195.0, 209.0, '魔蛛破颈冲出'],
    ['5-17', 209.0, 217.0, '神将一刀两断'],
    ['5-17b',217.0, 221.4, '双残狂遁罩网'],
    ['5-18', 221.4, 233.6, '青网径摄道境'],
    ['5-19', 233.6, 246.5, '万仙雷霆织茧'],
    ['5-20', 246.5, 260.0, '魔茧坠池归静']
  ];

  var SHEET = CINE.beatSheet(BEATS);

  var PLATES = [
    'p-zhanlong-terrace', 'p-zhanlong-block-cu', 'p-flashback-war', 'p-daojing-scroll', 'p-chengqi-tree',
    'il-yang-kneel-lotus', 'il-yang-chains', 'il-yang-kill-kin', 'il-spider-thunder',
    'sp-punish-gen-1', 'sp-punish-gen-2', 'sp-yang-disguise', 'sp-yang-true',
    'sp-severed-head', 'sp-canluolina', 'sp-yuci-bow', 'sp-yuci-look-3', 'sp-yuci-pose-set-1',
    'sp-zhao-set-4', 'sp-xuefu-4',
    'fx-bloodtide-tex', 'fx-turbid-tex', 'fx-mist-tex', 'fx-strata-tex', 'fx-realm-edge',
    'fx-ring-brush-oval', 'fx-ring-brush-round', 'fx-sprout-light',
    'fx-sunfire-qing', 'fx-sunfire-bai', 'fx-sunfire-hong',
    'fx-inksplash-1', 'fx-inksplash-2', 'fx-inksplash-3',
    'fx-flywhite-ink', 'fx-flywhite-gold', 'fx-crack-gold'
  ].join(' ');

  function cl(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

  /* 将世界坐标特效钉在底图视窗（随 cam 推拉摇移与震屏严丝合缝） */
  function withCam(c, cam, fn) {
    c.save();
    I.screen(c);
    I.cam(c, I.plateView(cam));
    fn();
    c.restore();
  }

  /* 镜像安全立绘封装：支持 flipX 且严格对齐 cam 视差与世界坐标 (960+dx, 540+dy) */
  function rigAt(c, id, t, o) {
    o = o || {};
    var cam = o.cam || { x: 0, y: 0, zoom: 1 };
    var ro = {
      cam: o.flipX ? { x: -(cam.x || 0), y: cam.y || 0, zoom: cam.zoom || 1 } : cam,
      s: o.s == null ? 0.2 : o.s,
      dx: o.flipX ? -(o.dx || 0) : (o.dx || 0),
      dy: o.dy || 0,
      flip: o.flipX ? 'h' : undefined,
      alpha: o.alpha == null ? 1 : o.alpha,
      amp: o.amp == null ? 0.85 : o.amp,
      strain: o.strain,
      mode: o.mode,
      script: o.script || {
        root: [{ t: 0, dx: 0, dy: 0, rot: 0, s: 1 }],
        wind: { dirDeg: o.windDir == null ? 18 : o.windDir, base: o.wind == null ? 0.28 : o.wind, gust: o.gust || [] },
        breathe: { period: o.period || 4.2, amp: o.breathe == null ? 0.7 : o.breathe },
        impulse: o.impulse || []
      }
    };
    return I.rig(c, id, t, ro);
  }

  /* 叠加多重 M.kick 到机位 */
  function applyKicks(cam, list) {
    var out = cam;
    for (var i = 0; i < list.length; i++) out = M.kickCam(out, list[i]);
    return out;
  }

  /* ==================== 逐镜绘制函数 ==================== */
  var SHOTS = {
    /* 5-01 [0.0..10.5]：二掌刑神将重步登台顿足，万籁骤寂后雷霆喝令「符诏至，刀来！」 */
    '5-01': function (c, t, lt) {
      var k1 = M.kick(t, 1.55, { amp: 12, f: 5.5, life: 0.75, dir: Math.PI * 0.5, zAmp: 0.02, seed: 501 });
      var k2 = M.kick(t, 2.85, { amp: 13, f: 5.5, life: 0.75, dir: Math.PI * 0.5, zAmp: 0.022, seed: 502 });
      var kShout = M.kick(t, 4.25, { amp: 15, f: 7.0, life: 0.9, dir: -Math.PI * 0.5, zAmp: 0.032, seed: 503 });
      var cam = M.cam(lt, [
        [0.0,  { x: 65,  y: 18, zoom: 1.08 }],
        [3.6,  { x: 110, y: 10, zoom: 1.15 }, 'smooth'],
        [4.25, { x: 122, y: 4,  zoom: 1.18 }, 'expoOut'],
        [10.5, { x: 136, y: -4, zoom: 1.21 }, 'smooth']
      ]);
      cam = applyKicks(cam, [k1, k2, kShout]);

      var hush = U.smooth((lt - 3.2) / 0.85) * (1 - U.smooth((lt - 4.2) / 0.25));
      var windLv = (1 - 0.88 * hush) * (lt > 4.25 ? 0.55 : 0.32);

      I.plateFlow(c, 'p-zhanlong-terrace', t * (1 - 0.75 * hush), { cam: cam, amp: 5, scale: 340, speed: 0.1, band: [0.0, 0.55], seed: 51 });
      I.plateMist(c, t * (1 - 0.8 * hush), { cam: cam, y: H * 0.78, h: 240, a: 0.22, speed: 16, rgb: [224, 214, 198], seed: 52 });

      withCam(c, cam, function () {
        ZL.timeRiver(c, t, { y: 510, h: 560, mode: 'frozen', k: 0.72, a: 0.68, seed: 504 });
        ZL.dragonSha(c, t, { x: 1140, y: 350, s: 0.94, state: 'prowl', a: 0.68 + 0.24 * U.smooth((lt - 4.2) / 2.2), seed: 505 });

        // 断龙石旁待刑的道人与穿胸血链
        ZL.bloodChains(c, t, { cx: 1135, cy: 585, n: 20, eruptK: 1, rattle: 0.16, a: 0.65, seed: 506 });
      });

      rigAt(c, 'sp-yang-disguise', t, {
        cam: cam, s: 0.165, dx: 175, dy: 82, wind: windLv * 0.6,
        script: {
          root: [{ t: 0, dx: 0, dy: 0, rot: 0, s: 1 }],
          wind: { dirDeg: 12, base: windLv * 0.65 },
          breathe: { period: 4.6, amp: 0.5 }
        }
      });

      // 左右掌刑神将重步踏入并顿足立定
      var step1 = M.expoOut(cl(lt / 1.55), 5);
      var step2 = M.expoOut(cl((lt - 0.9) / 1.95), 5);
      rigAt(c, 'sp-punish-gen-1', t, {
        cam: cam, s: 0.205, dx: U.lerp(-145, -45, step1), dy: U.lerp(132, 108, step1),
        script: {
          root: [
            { t: 0.0, dx: -35, dy: 12, rot: -0.03, s: 0.98 },
            { t: 1.55, dx: 0, dy: 0, rot: 0, s: 1, ease: 'outBack' },
            { t: 4.2, dx: 0, dy: -6, rot: -0.02, s: 1.02, ease: 'outCubic' },
            { t: 10.5, dx: 0, dy: -4, rot: -0.01, s: 1.01 }
          ],
          wind: { dirDeg: 195, base: windLv, gust: [{ t: 4.25, dur: 1.4, amp: 1.2 }] },
          impulse: [{ t: 1.55, x: 0, y: 1, amp: 1.1 }, { t: 4.25, x: 0.4, y: -1, amp: 1.3 }],
          breathe: { period: 3.8, amp: 0.7 }
        }
      });
      rigAt(c, 'sp-punish-gen-2', t, {
        cam: cam, s: 0.205, dx: U.lerp(425, 325, step2), dy: U.lerp(132, 108, step2),
        alpha: cl((lt - 0.35) / 0.6),
        script: {
          root: [
            { t: 0.9, dx: 40, dy: 14, rot: 0.03, s: 0.98 },
            { t: 2.85, dx: 0, dy: 0, rot: 0, s: 1, ease: 'outBack' },
            { t: 4.25, dx: 0, dy: -5, rot: 0.015, s: 1.015, ease: 'outCubic' },
            { t: 10.5, dx: 0, dy: -3, rot: 0.01, s: 1.01 }
          ],
          wind: { dirDeg: 15, base: windLv, gust: [{ t: 4.25, dur: 1.4, amp: 1.2 }] },
          impulse: [{ t: 2.85, x: 0, y: 1, amp: 1.1 }, { t: 4.25, x: -0.4, y: -1, amp: 1.2 }],
          breathe: { period: 3.9, amp: 0.7 }
        }
      });

      withCam(c, cam, function () {
        M.inkShock(c, t, { t0: 1.55, dur: 0.85, x: 915, y: 785, R: 280, flat: 0.3, rgb: [72, 54, 44], a: 0.48, seed: 507 });
        M.inkShock(c, t, { t0: 2.85, dur: 0.85, x: 1285, y: 785, R: 280, flat: 0.3, rgb: [72, 54, 44], a: 0.48, seed: 508 });
        // 4.2s「符诏至，刀来！」高举符诏震开湖玉金赤气浪
        var edK = U.smooth((lt - 3.9) / 1.1);
        if (edK > 0.01) {
          ZL.tadpoleEdict(c, t, { x: 955, y: 455, s: 0.56, morphK: 0.45 * edK, unfoldK: 0.35 * edK, cyanK: 0.85, a: 0.82 * edK, seed: 509 });
        }
        M.inkRing(c, t, 4.25, { x: 955, y: 455, r: 520, flat: 0.58, rgb: [132, 42, 32], a: 0.56, life: 1.15, seed: 510 });
        I.flyWhite(c, t, { t0: 4.25, dur: 0.28, hold: 0.9, fade: 0.65, x0: 680, y0: 510, x1: 1480, y1: 310, w: 95, kind: 'gold', a: 0.55, seed: 511 });
      });
      ZL.chronalVignette(c, t, { mode: 'reality', k: 0.65, a: 0.72, seed: 512 });
    },

    /* 5-02 [10.5..23.2]｜命中 H13 @ G883.0 (t=13.0s)：冲霄龙煞轰然合拢，铸成横亘苍穹的千钧断头血刀！ */
    '5-02': function (c, t, lt) {
      var ta = M.hitStop(t, [[13.0, 0.08, 0.28]]);
      var lta = ta - 10.5;
      var st = M.strike(t, 13.0, { pre: 2.2, go: 0.24, post: 1.8, wind: 0.15, over: 0.08 });
      var hk = M.kick(t, 13.0, { amp: 19, f: 6.2, zeta: 0.38, life: 1.15, dir: Math.PI * 0.5, zAmp: 0.045, seed: 520 });
      var cam = M.cam(lta, [
        [0.0,  { x: 0,  y: 44,  zoom: 1.18 }],
        [2.3,  { x: 0,  y: 56,  zoom: 1.22 }, 'expoIn'],
        [2.65, { x: 0,  y: -18, zoom: 1.07 }, 'expoOut'],
        [12.7, { x: -8, y: -36, zoom: 1.03 }, 'smooth']
      ]);
      cam = M.kickCam(cam, hk);

      I.plateFlow(c, 'p-zhanlong-block-cu', ta, { cam: cam, amp: 6 + 10 * st.imp, scale: 300, speed: 0.14, seed: 521 });
      I.bloodTide(c, ta, { y: H * 0.62, h: H * 0.38, speed: 58, warp: 26, a: 0.36, burn: 0.45, seed: 522 });

      // 10.5..13.0 满台残龙向天穹倒卷蓄势；13.0 起凝为悬顶千钧巨刃（bladeK 0 -> 0.32 聚煞成刀高悬）
      var formBladeK = t < 13.0 ? 0.16 * M.expoIn(cl((t - 10.6) / 2.4), 5) : U.lerp(0.16, 0.32, M.expoOut(cl((t - 13.0) / 0.85), 5));

      withCam(c, cam, function () {
        if (t < 13.35) {
          ZL.dragonSha(c, ta, { x: 960, y: 390 - 90 * cl((t - 10.5) / 2.5), s: 1.08 * (1 - 0.25 * cl((t - 12.2) / 0.8)), state: 'prowl', a: 0.85 * (1 - cl((t - 12.9) / 0.45)), seed: 523 });
          M.inkShock(c, t, { t0: 11.1, dur: 1.85, inward: true, x: 960, y: 290, R: 680, flat: 0.55, rgb: [112, 28, 24], a: 0.58, seed: 524 });
        }
        ZL.dragonSha(c, ta, { x: 960, y: 625, s: 1.08, state: 'blade', bladeK: formBladeK, a: cl((t - 10.9) / 1.6), seed: 525 });

        // 13.0s 铸刀雷霆气浪与飞白铮鸣
        I.flyWhite(c, t, { t0: 13.0, dur: 0.22, hold: 1.1, fade: 0.7, x0: 1190, y0: 40, x1: 890, y1: 420, w: 120, kind: 'ink', a: 0.78, seed: 526 });
        I.inkSplash(c, t, { t0: 13.0, x: 970, y: 270, size: 580, v: 0, vary: true, a: 0.62, tint: [118, 28, 24], seed: 527 });
        M.inkRing(c, t, 13.0, { x: 960, y: 310, r: 580, flat: 0.42, rgb: [124, 34, 26], a: 0.68, life: 1.1, seed: 528 });
      });

      // 断龙石左右肃立护法的二尊金甲掌刑神将
      rigAt(c, 'sp-punish-gen-1', ta, {
        cam: cam, s: 0.215, dx: -455, dy: 125, wind: 0.48,
        gust: [{ t: 13.0, dur: 1.6, amp: 1.5 }], impulse: [{ t: 13.0, x: -0.6, y: 0.4, amp: 1.2 }]
      });
      rigAt(c, 'sp-punish-gen-2', ta, {
        cam: cam, s: 0.215, dx: 455, dy: 125, wind: 0.48, windDir: 195,
        gust: [{ t: 13.0, dur: 1.6, amp: 1.5 }], impulse: [{ t: 13.0, x: 0.6, y: 0.4, amp: 1.2 }]
      });

      M.flashInk(c, t, 13.0, { x: 960, y: 290, white: 0.045, ink: 0.08, a: 0.88 });
      ZL.chronalVignette(c, t, { mode: 'reality', k: 0.72, a: 0.78, seed: 529 });
    },

    /* 5-03 [23.2..38.2]：道人坦然跪伏断龙石引颈，千钧血刀下压却被先天水烟清光死死托住！ */
    '5-03': function (c, t, lt) {
      var resistK = U.smooth((lt - 6.8) / 2.2); // 30.0s 起血刀重压与水烟激烈相抗
      var trem = resistK * 4.5 * U.noise1(t * 22, 531);
      var cam = M.cam(lt, [
        [0.0,  { x: 25,  y: 42,  zoom: 1.06 }],
        [7.3,  { x: 65,  y: 12,  zoom: 1.14 }, 'smooth'],
        [15.0, { x: 88,  y: -38, zoom: 1.20 }, 'smooth']
      ]);
      cam = { x: cam.x + trem * 0.35, y: cam.y - Math.abs(trem) * 0.3, zoom: cam.zoom };

      var kneelFade = U.smooth((lt - 0.6) / 2.6);
      I.plate(c, 'p-zhanlong-block-cu', { cam: cam, fade: { id2: 'il-yang-kneel-lotus', k: kneelFade } });

      withCam(c, cam, function () {
        // 穿胸二十二道血链随呼吸低鸣
        ZL.bloodChains(c, t, { cx: 1020, cy: 520, n: 22, eruptK: 1, rattle: 0.18 + 0.22 * resistK, a: 0.62 * kneelFade, seed: 532 });

        // 脑后自发升腾的先天水烟清光（初态无莲 lotusK=0）
        ZL.cyanLotusAndMist(c, t, {
          x: 1095, y: 382, mistK: 0.55 + 0.45 * kneelFade, lotusK: 0, dewK: 0, washK: 0, a: 0.96, seed: 533
        });

        // 悬顶千钧断头血刀重重下压（bladeK 0.32 -> 0.415 吃力震颤）却被水烟清光死死架住！
        var pressBlade = 0.32 + 0.095 * resistK + 0.014 * resistK * Math.sin(t * 26);
        ZL.dragonSha(c, t, { x: 1085, y: 535, s: 1.02, state: 'blade', bladeK: pressBlade, a: 0.96, seed: 534 });

        if (resistK > 0.02) {
          // 刀锋与水烟清光交界处的相抗涟漪与清芒迸点
          var pulseT = Math.floor((lt - 6.8) / 1.45) * 1.45 + 23.2 + 6.8;
          M.inkRing(c, t, pulseT, { x: 1080, y: 332, r: 290, flat: 0.32, rgb: [138, 194, 188], a: 0.52 * resistK, life: 1.25, seed: 535 });
          ZL.spiritDust(c, t, { n: 28, box: [860, 210, 440, 260], rgb: [168, 212, 206], speed: 36, a: 0.65 * resistK, seed: 536 });
        }
      });
      ZL.chronalVignette(c, t, { mode: 'reality', k: 0.65, a: 0.7, seed: 537 });
    },

    /* 5-04 [38.2..56.0]：余慈肃然稽首，符诏绽碗大青莲落入脑后水烟，花瓣凝露抽尽护体清光！ */
    '5-04': function (c, t, lt) {
      // T097: 39.8-45.8s, T098: 47.6-53.8s；推镜转折严格落在 45.9-47.4s 无字幕安全窗内！
      var cuK = U.smooth((lt - 7.8) / 1.4); // 46.0..47.4s 由中景稽首平滑推入颈后青莲特写
      var cam = M.cam(lt, [
        [0.0,  { x: -35, y: 12,  zoom: 1.05 }],
        [7.6,  { x: -10, y: -4,  zoom: 1.09 }, 'smooth'],
        [9.3,  { x: 132, y: -88, zoom: 1.27 }, 'smooth'],
        [17.8, { x: 148, y: -98, zoom: 1.33 }, 'smooth']
      ]);

      I.plateFlow(c, 'il-yang-kneel-lotus', t, { cam: cam, amp: 3.5, scale: 320, speed: 0.08, seed: 541 });
      var sproutTex = I.fxTex && I.fxTex('sprout-light');
      if (sproutTex && I.flow) {
        withCam(c, cam, function () {
          I.flow(c, sproutTex.id, t, {
            src: sproutTex.src, dst: [985, 130, 220, 340], mode: 'screen',
            tint: [148, 204, 198], alpha: 0.24 * U.smooth((lt - 0.4) / 2.2) * (1 - 0.55 * cl((lt - 11.0) / 5.5)),
            vignette: { rx: 0.9, ry: 0.9, soft: 0.55 }, warp: { amp: 8, scale: 140, speed: 0.22, seed: 542 }
          });
        });
      }

      // 前段（38.2..46.8s）：左侧余慈郑重稽首送行，掌前湖玉符诏绽出碗大青莲飘向断龙石
      var yuciA = 1 - cuK;
      if (yuciA > 0.01) {
        var bowK = U.smooth(lt / 1.4);
        rigAt(c, 'sp-yuci-bow', t, {
          cam: cam, s: 0.185, dx: -445, dy: 126, alpha: yuciA,
          script: {
            root: [
              { t: 38.2, dx: -10, dy: -8, rot: -0.04, s: 0.99 },
              { t: 39.8, dx: 6, dy: 6 * bowK, rot: 0.045, s: 1.0, ease: 'inOutSine' },
              { t: 46.8, dx: 4, dy: 4, rot: 0.03, s: 1.0 }
            ],
            wind: { dirDeg: 14, base: 0.24 },
            breathe: { period: 4.5, amp: 0.55 }
          }
        });
      }

      withCam(c, cam, function () {
        ZL.bloodChains(c, t, { cx: 1020, cy: 520, n: 22, eruptK: 1, rattle: 0.14 + 0.18 * cuK, a: 0.58, seed: 543 });

        // 符诏青光在余慈身前化莲（38.4..45.5s）
        var edictA = U.smooth((lt - 0.15) / 0.8) * (1 - U.smooth((lt - 6.8) / 1.2));
        if (edictA > 0.01) {
          ZL.tadpoleEdict(c, t, { x: 675, y: 315, s: 0.68, morphK: 0.55, unfoldK: 0.4, cyanK: 1.0, a: 0.86 * edictA, seed: 544 });
        }

        // 碗大青莲自余慈符诏悠悠飘落至杨和子脑后水烟（dropY & x 平滑过渡），随即凝露抽尽水烟！
        var lotusBloom = U.smooth((lt - 0.3) / 2.2);
        var travelK = U.smooth((lt - 1.0) / 6.2);
        var dewProg = U.smooth((lt - 8.2) / 7.8); // 46.4..54.2s 花瓣凝露抽光
        var mistRemain = 1.0 - 0.92 * dewProg;
        var lx = U.lerp(720, 1098, travelK);
        var dropY = U.lerp(-95, 0, travelK);

        ZL.cyanLotusAndMist(c, t, {
          x: 1098, y: 372, mistK: mistRemain, lotusK: 0, dewK: dewProg, washK: 0, a: 0.95, seed: 545
        });
        ZL.cyanLotusAndMist(c, t, {
          x: lx, y: 372, mistK: 0, lotusK: lotusBloom, dropY: dropY, dewK: dewProg, washK: 0, a: 0.98, seed: 546
        });

        // 悬顶血刀随着水烟敛去而微微沉降逼近
        ZL.dragonSha(c, t, { x: 1090, y: 395, s: 0.95, state: 'blade', bladeK: 0.33 + 0.04 * dewProg, a: 0.72 - 0.18 * cuK, seed: 547 });
        ZL.spiritDust(c, t, { n: 32, box: [840, 200, 480, 290], rgb: [158, 214, 206], dir: Math.PI * 0.5, speed: 22, a: 0.58 * lotusBloom, seed: 548 });
      });
      ZL.chronalVignette(c, t, { mode: 'reality', k: 0.55, a: 0.62, seed: 549 });
    },

    /* 5-05 [56.0..68.5]：水烟敛尽，二十二条血链哗啦颤鸣，道人伏石仰首震天长笑上半阕！ */
    '5-05': function (c, t, lt) {
      var laughEnv = U.smooth((lt - 1.1) / 1.2) * (1 - 0.25 * U.smooth((lt - 9.8) / 2.2));
      var laughVib = laughEnv * 2.8 * Math.sin(t * 17.5) * (0.6 + 0.4 * U.noise1(t * 6, 551));
      var cam = M.cam(lt, [
        [0.0,  { x: 55,  y: 18, zoom: 1.06 }],
        [3.2,  { x: 82,  y: 4,  zoom: 1.12 }, 'smooth'],
        [12.5, { x: 108, y: -12, zoom: 1.18 }, 'smooth']
      ]);
      cam = { x: cam.x + laughVib * 0.25, y: cam.y + laughVib * 0.55, zoom: cam.zoom };

      I.plateFlow(c, 'il-yang-kneel-lotus', t, {
        cam: cam, amp: 4 + 5 * laughEnv, scale: 260, speed: 0.16, band: [0.25, 0.85], seed: 552
      });
      I.bloodTide(c, t, { y: H * 0.68, h: H * 0.32, speed: 46, warp: 24, a: 0.32 + 0.14 * laughEnv, seed: 553 });

      withCam(c, cam, function () {
        // 失去水烟庇护后剧烈哗啦鸣响的二十二条穿胸铁索
        ZL.bloodChains(c, t, {
          cx: 1025, cy: 520 + laughVib * 0.8, n: 22, eruptK: 1,
          rattle: 0.32 + 0.42 * laughEnv, spikes: 0.45, a: 0.86, seed: 554
        });
        // 颈后已锁住群魔的莹洁青莲
        ZL.cyanLotusAndMist(c, t, {
          x: 1098, y: 374 + laughVib * 0.6, mistK: 0.04, lotusK: 0.96, dewK: 1.0, washK: 0, a: 0.94, seed: 555
        });
        // 长笑声浪激起的苍凉水墨气环
        M.inkRing(c, t, 57.6, { x: 1055, y: 450, r: 480, flat: 0.55, rgb: [96, 36, 30], a: 0.44, life: 1.35, seed: 556 });
        M.inkRing(c, t, 61.2, { x: 1055, y: 450, r: 540, flat: 0.55, rgb: [96, 36, 30], a: 0.38, life: 1.45, seed: 557 });
      });
      ZL.chronalVignette(c, t, { mode: 'reality', k: 0.72, a: 0.76, seed: 558 });
    },

    /* 5-06 [68.5..81.2]：「又迎起复之机，道灭而无愧矣！」镜头自染血白发仰摇至悬顶赤锋，天地屏息！ */
    '5-06': function (c, t, lt) {
      // 79.5..81.2s 配乐收止，天地凝滞蓄势
      var hushK = U.smooth((lt - 10.6) / 1.8);
      var tf = U.lerp(t, 79.5 + (t - 79.5) * 0.08, hushK);
      var cam = M.cam(lt, [
        [0.0,  { x: 112, y: 24,  zoom: 1.18 }],
        [9.5,  { x: 96,  y: -68, zoom: 1.22 }, 'smooth'],
        [12.7, { x: 92,  y: -86, zoom: 1.25 }, 'smooth']
      ]);

      I.plateFlow(c, 'il-yang-kneel-lotus', tf, { cam: cam, amp: 3 * (1 - 0.85 * hushK), scale: 300, speed: 0.08, seed: 561 });

      withCam(c, cam, function () {
        ZL.timeRiver(c, tf, { y: 460, h: 620, mode: 'frozen', k: 0.45 + 0.45 * hushK, a: 0.65, seed: 562 });
        ZL.bloodChains(c, tf, { cx: 1025, cy: 520, n: 22, eruptK: 1, rattle: 0.26 * (1 - 0.9 * hushK), a: 0.74, seed: 563 });
        ZL.cyanLotusAndMist(c, tf, { x: 1098, y: 374, mistK: 0, lotusK: 1.0, dewK: 1.0, washK: 0, a: 0.92, seed: 564 });

        // 悬顶赤红刀锋蓄势微抬，锋芒逼人欲滴
        ZL.dragonSha(c, tf, { x: 1085, y: 555, s: 1.04, state: 'blade', bladeK: 0.32 - 0.03 * hushK, a: 0.97, seed: 565 });
      });
      ZL.chronalVignette(c, tf, { mode: 'reality', k: 0.78 + 0.14 * hushK, a: 0.82, seed: 566 });
    },

    /* 5-07 [81.2..93.5]｜命中 H14 @ G954.0 (t=84.0s，全片最高潮！)
       83.2-84.0s 0.8秒绝对死寂 → 84.0s 4帧高反差黑白浓墨顿帧＋22px裂地重震＋干墨斜劈 → 87.2s「道灭无愧」巨字压屏！ */
    '5-07': function (c, t, lt) {
      var HIT = 84.0;
      var deadSilence = t >= 83.2 && t < HIT;
      var ta = deadSilence ? 83.2 : M.hitStop(t, [[HIT, 0.14, 0.44]]);
      var hk = M.kick(t, HIT, { amp: 22, f: 6.8, zeta: 0.34, life: 1.45, dir: Math.PI * 0.5, zAmp: 0.06, seed: 571 });
      var stampKick = M.kick(t, 87.2, { amp: 9, f: 5.5, zeta: 0.45, life: 0.75, dir: Math.PI * 0.5, zAmp: 0.018, seed: 572 });

      var cam = M.cam(ta - 81.2, [
        [0.0,  { x: 0,   y: -48, zoom: 1.08 }],
        [2.0,  { x: 0,   y: -76, zoom: 1.15 }, 'expoOut'],
        [2.8,  { x: 0,   y: -76, zoom: 1.15 }, 'linear'],
        [3.05, { x: -12, y: 38,  zoom: 1.22 }, 'expoOut'],
        [6.0,  { x: -6,  y: 16,  zoom: 1.10 }, 'smooth'],
        [12.3, { x: 0,   y: -6,  zoom: 1.04 }, 'smooth']
      ]);
      cam = applyKicks(cam, [hk, stampKick]);

      var postWarp = M.after(null, t, HIT, {});
      I.plateFlow(c, 'p-zhanlong-block-cu', ta, {
        cam: cam, amp: deadSilence ? 0 : (3.5 + postWarp * 0.45), scale: 280, speed: 0.12, seed: 573
      });

      // 81.2..83.2 极高扬刀吸气；83.2..84.0 死寂凝定；84.0 雷霆斩入断龙石刀槽！
      var bK, bladeBaseY;
      if (t < 83.2) { bK = U.lerp(0.32, 0.26, U.smooth((t - 81.2) / 2.0)); bladeBaseY = 615; }
      else if (t < HIT) { bK = 0.26; bladeBaseY = 615; }
      else {
        var dropP = M.expoOut(cl((t - HIT) / 0.48), 6);
        bK = U.lerp(0.33, 1.0, dropP);
        bladeBaseY = U.lerp(615, 455, dropP);
      }

      withCam(c, cam, function () {
        if (t < 83.2) {
          M.inkShock(c, t, { t0: 81.25, dur: 1.85, inward: true, x: 960, y: 240, R: 720, flat: 0.55, rgb: [96, 24, 22], a: 0.52, seed: 574 });
        }
        ZL.timeRiver(c, ta, { y: 500, h: 580, mode: 'frozen', k: t < HIT ? 0.85 : cl(1 - (t - HIT) / 0.8) * 0.85, a: 0.72, seed: 575 });

        // 断龙石刀痕裂金光爆发
        var crackTex = I.fxTex && I.fxTex('crack-gold');
        if (crackTex && I.flow && t >= HIT) {
          var ckA = cl(1 - (t - HIT) / 4.8) * 0.82;
          I.flow(c, crackTex.id, ta, {
            dst: [620, 420, 680, 460], mode: 'lighter', tint: [224, 176, 96], alpha: ckA,
            vignette: { rx: 0.92, ry: 0.85, soft: 0.5 }, warp: { amp: 4, scale: 180, speed: 0.1, seed: 576 }
          });
        }

        ZL.dragonSha(c, ta, { x: 960, y: bladeBaseY, s: 1.08, state: 'blade', bladeK: bK, a: 0.98 * (1 - 0.35 * U.smooth((t - 86.8) / 3.5)), seed: 577 });

        // 千钧斜劈全屏干墨飞白与浓墨爆溅
        ZL.slashImpact(c, t, HIT, { x0: 1380, y0: 45, x1: 680, y1: 835, kind: 'blood', w: 84, a: 1.0, seed: 578 });
        I.flyWhite(c, t, { t0: HIT, dur: 0.18, hold: 1.6, fade: 1.1, x0: 1560, y0: 30, x1: 420, y1: 920, w: 145, kind: 'ink', a: 0.92, seed: 579 });
        I.flyWhite(c, t, { t0: HIT + 0.04, dur: 0.22, hold: 1.3, fade: 0.9, x0: 360, y0: 700, x1: 1580, y1: 660, w: 78, kind: 'gold', a: 0.65, seed: 580 });
        I.inkSplash(c, t, { t0: HIT, x: 955, y: 635, size: 720, v: 1, vary: true, a: 0.86, seed: 581 });
        M.after(c, t, HIT, { x: 955, y: 640, n: 32, v: 560, life: 3.2, smoke: 4.5, rgb: [28, 22, 20], a: 0.85, seed: 582 });
      });

      // 84.00..84.14s：4 帧高反差黑白浓墨顿帧冲击（宣纸炽白底＋手绘飞白破墨裂痕斜贯全屏，绝无生硬圆斑！）
      var impDt = t - HIT;
      if (impDt >= 0 && impDt < 0.14) {
        c.save();
        I.screen(c);
        var bwFlip = impDt < 0.07;
        I.paper(c, bwFlip ? 0.95 : 0.84);
        if (!bwFlip) {
          c.globalCompositeOperation = 'multiply';
          I.wash(c, W * 0.5, H * 0.5, W * 0.95, H * 0.95, 0.76, 583, [22, 18, 16], 0, { edge: 'wet' });
          c.globalCompositeOperation = 'source-over';
        }
        var slashCol = bwFlip ? [16, 14, 12] : [248, 244, 232];
        I.inkSplash(c, HIT + 0.36, { t0: HIT, x: 955, y: 610, size: 820, v: 1, a: 0.92, dark: !bwFlip, seed: 586 });
        I.flyWhite(c, HIT + 0.28, { t0: HIT, x0: 1620, y0: 15, x1: 340, y1: 985, w: 168, kind: 'ink', a: 0.98, dark: !bwFlip, seed: 584 });
        I.dry(c, [[1560, 20], [960, 585], [380, 975]], { raw: true, n: 32, w: 74, a: 0.96, rgb: slashCol, dry: 0.46, hairs: 7, seed: 585 });
        I.dry(c, [[200, 660], [955, 625], [1720, 670]], { raw: true, n: 28, w: 42, a: 0.88, rgb: slashCol, dry: 0.52, hairs: 6, seed: 586 });
        c.restore();
      } else {
        M.flashInk(c, t, HIT + 0.13, { x: 960, y: 590, white: 0.05, ink: 0.12, a: 0.95 });
      }

      // 87.2..92.6s「道灭无愧」干墨巨字衬一层温润宣纸云白气晕，令金石巨印般的大字压塌苍穹且对比鲜明
      if (t >= 87.0 && t <= 92.8) {
        var bigEnv = U.smooth((t - 87.0) / 0.4) * (1 - U.smooth((t - 92.1) / 0.6));
        c.save();
        I.screen(c);
        I.wash(c, W * 0.58, H * 0.46, 230, 440, 0.68 * bigEnv, 587, [238, 231, 215], 0, { edge: 'soft' });
        I.inkSplash(c, t, { t0: 87.2, x: W * 0.58, y: H * 0.24, size: 420, hold: 3.8, fade: 0.9, v: 2, a: 0.22 * bigEnv, tint: [132, 38, 30], seed: 588 });
        c.restore();
      }
      ZL.chronalVignette(c, t, { mode: 'reality', k: 0.82, a: 0.85, seed: 589 });
    },

    /* 5-08 [93.5..102.2]：断颈喷涌漆黑魔染墨血狰狞挣扎，旋即被青莲与血链余威绞作飞烟！ */
    '5-08': function (c, t, lt) {
      var cam = M.cam(lt, [
        [0.0, { x: 0,  y: 52, zoom: 1.12 }],
        [8.7, { x: 12, y: 84, zoom: 1.24 }, 'smooth']
      ]);
      I.plateFlow(c, 'p-zhanlong-block-cu', t, { cam: cam, amp: 4.5, scale: 260, speed: 0.14, seed: 591 });

      var inkProg = cl((lt - 0.15) / 7.8);
      withCam(c, cam, function () {
        // 残余血链金篆锁阵镇封断龙石
        ZL.bloodChains(c, t, { cx: 960, cy: 640, n: 16, eruptK: 1 - 0.45 * inkProg, rattle: 0.35 * (1 - inkProg), a: 0.52 * (1 - 0.5 * inkProg), seed: 592 });
        // 墨血喷涌挣扎 → 青光细锁纵横绞杀化作青灰烟霭泯灭
        ZL.inkBloodToJade(c, t, { x: 960, y: 615, mode: 'ink', k: inkProg, a: 0.98, seed: 593 });
        // 悬护上方的碗大青莲洒下镇魔清辉
        ZL.cyanLotusAndMist(c, t, {
          x: 960, y: 495 - 12 * Math.sin(t * 1.8), mistK: 0, lotusK: 0.88, dewK: 0.85, washK: 0, a: 0.94, seed: 594
        });
        ZL.spiritDust(c, t, { n: 26, box: [740, 380, 440, 280], rgb: [148, 198, 192], speed: 24, a: 0.55, seed: 595 });
      });
      ZL.chronalVignette(c, t, { mode: 'reality', k: 0.68, a: 0.72, seed: 596 });
    },

    /* 5-09 [102.2..114.6]｜命中 H15 @ G975.0 (t=105.0s)：时光长河轰然决堤逆流，倒卷回一千年前！ */
    '5-09': function (c, t, lt) {
      var HIT = 105.0;
      var ta = M.hitStop(t, [[HIT, 0.09, 0.3]]);
      var hk = M.kick(t, HIT, { amp: 20, f: 6.5, zeta: 0.38, life: 1.3, dir: 0, rot: 0.014, zAmp: 0.05, seed: 601 });
      var rewK = cl((t - HIT) / 2.2);
      var cam = M.cam(ta - 102.2, [
        [0.0,  { x: -20, y: 15,  zoom: 1.06 }],
        [2.7,  { x: 0,   y: 8,   zoom: 1.15 }, 'expoIn'],
        [3.1,  { x: 35,  y: -25, zoom: 1.04 }, 'expoOut'],
        [12.4, { x: -45, y: 12,  zoom: 1.22 }, 'smooth']
      ]);
      cam = M.kickCam(cam, hk);

      I.plate(c, 'p-zhanlong-terrace', { cam: cam });
      if (rewK > 0.005) {
        M.reveal(c, t, HIT, 1.9, function (rc) {
          I.plateFlow(rc, 'p-flashback-war', ta, { cam: cam, amp: 8, scale: 280, speed: 0.22, seed: 602,
            grade: { warm: 0.16, dark: 0.04 } });
        }, { from: [960, 520], edge: 0.16, rim: 0.25, rimRgb: [138, 108, 56], seed: 603 });
      }

      // 102.2..105.0 静止千年的悬空血珠高频剧颤；105.0 起决堤逆流！
      if (t < HIT + 0.6) {
        var shakeT = t + 0.35 * U.smooth((t - 102.4) / 2.5) * Math.sin(t * 38);
        ZL.timeRiver(c, shakeT, { y: 540, h: 660, mode: 'frozen', k: 1 - rewK, a: 0.88, seed: 604 });
      }
      if (t >= HIT - 0.1) {
        I.strata(c, ta, { mode: 'reveal', k: cl((t - HIT) / 1.6), n: 5, dir: 'up', shift: 160, a: 0.32 * (1 - cl((t - 107.2) / 2.5)), seed: 605 });
        ZL.timeRiver(c, ta, { y: 520, h: 720, mode: 'rewind', k: M.expoOut(cl((t - HIT) / 1.2), 5), a: 0.95, seed: 606 });
        I.flyWhite(c, t, { t0: HIT, dur: 0.28, hold: 1.4, fade: 0.9, x0: 1680, y0: 260, x1: 220, y1: 620, w: 120, kind: 'gold', a: 0.72, seed: 607 });
        I.flyWhite(c, t, { t0: HIT + 0.12, dur: 0.32, hold: 1.3, fade: 0.9, x0: 1620, y0: 690, x1: 260, y1: 360, w: 96, kind: 'ink', a: 0.65, seed: 608 });
      }
      M.flashInk(c, t, HIT, { x: 960, y: 500, white: 0.05, ink: 0.09, a: 0.9 });
      ZL.chronalVignette(c, t, { mode: rewK > 0.3 ? 'rewind' : 'reality', k: 0.88, a: 0.86, seed: 609 });
    },

    /* 5-10 [114.6..122.6]（快切回溯①）：来迟一步！身化煌煌水烟清光的道人横扫崩塌神庭屠戮漫天黑魔！ */
    '5-10': function (c, t, lt) {
      // 118.6s（lt=4.0s）镜内凌厉急甩变向（非换图硬切，保证 T104 零跨切且战场感拉满！）
      var whipK = M.kick(t, 118.6, { amp: 14, f: 7.5, life: 0.7, dir: 0, zAmp: 0.03, seed: 611 });
      var cam = M.cam(lt, [
        [0.0, { x: 72,  y: -18, zoom: 1.15 }],
        [3.8, { x: 18,  y: -8,  zoom: 1.20 }, 'smooth'],
        [4.3, { x: -58, y: 14,  zoom: 1.24 }, 'expoOut'],
        [8.0, { x: -75, y: 22,  zoom: 1.27 }, 'smooth']
      ]);
      cam = M.kickCam(cam, whipK);

      I.plateFlow(c, 'p-flashback-war', t, { cam: cam, amp: 9, scale: 260, speed: 0.25, seed: 612 });

      withCam(c, cam, function () {
        // 漫天围攻封神台的浓墨天魔被水烟剑光如沸汤沃雪般屠戮
        var purK = 0.18 + 0.58 * cl(lt / 7.6);
        ZL.meltShadows(c, t, { x: 960, y: 440, r: 540, purifyK: purK, n: 20, a: 0.92, seed: 613 });

        // 身裹煌煌水烟清光的杨和子立于中枢挥袖斩魔
        ZL.cyanLotusAndMist(c, t, { x: 960, y: 505, mistK: 1.0, lotusK: 0, dewK: 0, washK: 0, a: 1.0, seed: 614 });
        ZL.cyanLotusAndMist(c, t + 1.7, { x: 960, y: 465, mistK: 0.85, lotusK: 0, dewK: 0, washK: 0, a: 0.82, seed: 615 });
      });

      rigAt(c, 'sp-yang-true', t, {
        cam: cam, s: 0.16, dx: 0, dy: 28, wind: 0.95,
        gust: [{ t: 115.4, dur: 1.2, amp: 1.6 }, { t: 118.6, dur: 1.4, amp: 1.8 }]
      });

      withCam(c, cam, function () {
        // 纵横劈杀群魔的清青剑气笔势
        M.inkPath(c, t, { t0: 115.1, dur: 0.22, dry: 0.65, w: 30, rgb: [164, 214, 208], glow: [88, 148, 146], pts: [[560, 560], [960, 390], [1420, 250]], seed: 616 });
        M.inkPath(c, t, { t0: 116.8, dur: 0.22, dry: 0.65, w: 28, rgb: [216, 190, 132], glow: [188, 156, 92], pts: [[1380, 520], [940, 360], [480, 240]], seed: 617 });
        M.inkPath(c, t, { t0: 118.65, dur: 0.20, dry: 0.70, w: 34, rgb: [176, 220, 214], glow: [88, 148, 146], pts: [[440, 310], [960, 440], [1490, 560]], seed: 618 });
        M.inkPath(c, t, { t0: 120.4, dur: 0.22, dry: 0.65, w: 28, rgb: [216, 190, 132], glow: [188, 156, 92], pts: [[1320, 220], [920, 430], [540, 610]], seed: 619 });
      });

      ZL.timeRiver(c, t, { y: 520, h: 680, mode: 'rewind', k: 0.82, a: 0.52, seed: 620 });
      ZL.chronalVignette(c, t, { mode: 'rewind', k: 0.92, a: 0.88, seed: 621 });
    },

    /* 5-10b [122.6..125.6]（3.0s 纯动作快切②）：群魔钻心，他并指如刀自画二十二道血链生生刺穿胸膛封魔！ */
    '5-10b': function (c, t, lt) {
      var HIT = 123.35;
      var ta = M.hitStop(t, [[HIT, 0.09, 0.26]]);
      var hk = M.kick(t, HIT, { amp: 18, f: 7.2, zeta: 0.36, life: 1.0, dir: Math.PI * 0.5, zAmp: 0.05, seed: 625 });
      var cam = M.cam(ta - 122.6, [
        [0.0,  { x: -65, y: -15, zoom: 1.10 }],
        [0.75, { x: -85, y: -25, zoom: 1.22 }, 'expoIn'],
        [1.05, { x: -95, y: -20, zoom: 1.28 }, 'expoOut'],
        [3.0,  { x: -105,y: -26, zoom: 1.31 }, 'smooth']
      ]);
      cam = M.kickCam(cam, hk);

      I.plate(c, 'p-flashback-war', { cam: cam, alpha: 0.35 });
      I.plate(c, 'il-yang-chains', { cam: cam, alpha: 0.92, grade: { warm: 0.22, dark: 0.08 } });

      withCam(c, cam, function () {
        // 前 0.75s 十余道凶魔黑影趁隙扑入胸口
        if (lt < 1.15) {
          ZL.meltShadows(c, ta, { x: 770, y: 460, r: 340 * (1 - 0.65 * cl(lt / 0.85)), purifyK: 0, n: 14, a: 0.85 * (1 - cl((lt - 0.65) / 0.45)), seed: 626 });
        }
        // 自画二十二道朱砂符链穿胸爆射锁紧！
        var erK = lt < 0.75 ? 0.16 * cl(lt / 0.75) : U.lerp(0.2, 1.0, M.expoOut(cl((lt - 0.75) / 0.65), 6));
        ZL.bloodChains(c, ta, { cx: 770, cy: 460, n: 22, eruptK: erK, rattle: 0.75, spikes: 0.85, a: 0.98, seed: 627 });
        I.inkSplash(c, t, { t0: HIT, x: 770, y: 460, size: 620, v: 0, vary: true, a: 0.76, tint: [128, 32, 26], seed: 628 });
        I.flyWhite(c, t, { t0: HIT, dur: 0.2, hold: 0.9, fade: 0.6, x0: 320, y0: 340, x1: 1360, y1: 580, w: 92, kind: 'gold', a: 0.68, seed: 629 });
      });

      M.flashInk(c, t, HIT, { x: 770, y: 460, white: 0.045, ink: 0.08, a: 0.88 });
      ZL.timeRiver(c, ta, { y: 520, h: 640, mode: 'rewind', k: 0.78, a: 0.45, seed: 630 });
      ZL.chronalVignette(c, t, { mode: 'rewind', k: 0.95, a: 0.9, seed: 631 });
    },

    /* 5-11 [125.6..135.2]（快切回溯③）：左手死死紧提入魔痛哭的子孙杨端明，重重按上斩龙台！ */
    '5-11': function (c, t, lt) {
      // 130.4s（lt=4.8s）由特写急摇下压至断龙石（同镜运镜无硬切，保护 T105 126.2-132.4s！）
      var pressKick = M.kick(t, 130.6, { amp: 14, f: 6.0, zeta: 0.42, life: 0.9, dir: Math.PI * 0.5, zAmp: 0.03, seed: 635 });
      var cam = M.cam(lt, [
        [0.0, { x: -165, y: -56, zoom: 1.28 }],
        [4.5, { x: -135, y: -38, zoom: 1.24 }, 'smooth'],
        [5.4, { x: -42,  y: 26,  zoom: 1.15 }, 'expoOut'],
        [9.6, { x: -20,  y: 38,  zoom: 1.18 }, 'smooth']
      ]);
      cam = M.kickCam(cam, pressKick);

      I.plateFlow(c, 'il-yang-kill-kin', t, {
        cam: cam, amp: 5.5, scale: 280, speed: 0.16, seed: 636
      });

      withCam(c, cam, function () {
        // 道人身上哗啦绷紧的穿胸血链与脑后激荡的水烟清光
        ZL.bloodChains(c, t, { cx: 690, cy: 465, n: 20, eruptK: 1, rattle: 0.72, spikes: 0.5, a: 0.72, seed: 637 });
        ZL.cyanLotusAndMist(c, t, { x: 695, y: 415, mistK: 0.92, lotusK: 0, dewK: 0, washK: 0, a: 0.78, seed: 638 });

        // 断龙石上挣扎黑紫魔气（末代紫微帝御杨端明体内魔染）与 130.6s 按上石面的冲击波
        var thrashX = 855 + 6 * Math.sin(t * 14), thrashY = 535 + 4 * Math.cos(t * 11);
        I.wash(c, thrashX, thrashY, 95, 75, 0.48, 639, [58, 34, 66], 0, { edge: 'wet' });
        M.inkShock(c, t, { t0: 130.6, dur: 0.95, x: 865, y: 560, R: 340, flat: 0.35, rgb: [68, 28, 26], a: 0.58, seed: 640 });

        // 上方蓄势成型的残缺血龙巨刃
        ZL.dragonSha(c, t, { x: 920, y: 365, s: 0.94, state: 'blade', bladeK: 0.18 + 0.14 * cl((lt - 4.5) / 4.8), a: 0.78, seed: 641 });
      });

      ZL.timeRiver(c, t, { y: 520, h: 660, mode: 'rewind', k: 0.75, a: 0.44, seed: 642 });
      ZL.chronalVignette(c, t, { mode: 'rewind', k: 0.9, a: 0.86, seed: 643 });
    },

    /* 5-12 [135.2..146.6]｜命中 H16 @ G1008.0 (t=138.0s)：挥刀斩落亲孙颈项 → 139.6s 刀光匹配切回现世台缘残首腐骨化灰！ */
    '5-12': function (c, t, lt) {
      var HIT = 138.0, CUT = 139.6;
      var ta = M.hitStop(t, [[HIT, 0.11, 0.32]]);

      if (t < CUT) {
        // 前半：千年之前挥泪一刀斩落亲孙杨端明！
        var hk = M.kick(t, HIT, { amp: 20, f: 6.8, zeta: 0.36, life: 1.2, dir: Math.PI * 0.5, zAmp: 0.05, seed: 651 });
        var cam1 = M.cam(ta - 135.2, [
          [0.0, { x: -25, y: 20,  zoom: 1.16 }],
          [2.7, { x: -10, y: -15, zoom: 1.24 }, 'expoIn'],
          [3.1, { x: 10,  y: 35,  zoom: 1.14 }, 'expoOut'],
          [4.4, { x: 18,  y: 42,  zoom: 1.18 }, 'smooth']
        ]);
        cam1 = M.kickCam(cam1, hk);

        I.plateFlow(c, 'il-yang-kill-kin', ta, { cam: cam1, amp: 5, scale: 280, speed: 0.14, seed: 652 });
        var bK2 = t < HIT ? U.lerp(0.30, 0.26, cl((t - 135.2) / 2.7)) : U.lerp(0.34, 1.0, M.expoOut(cl((t - HIT) / 0.45), 6));

        withCam(c, cam1, function () {
          ZL.bloodChains(c, ta, { cx: 690, cy: 465, n: 20, eruptK: 1, rattle: 0.55, a: 0.68, seed: 653 });
          ZL.dragonSha(c, ta, { x: 885, y: 385, s: 0.96, state: 'blade', bladeK: bK2, a: 0.94, seed: 654 });
          ZL.slashImpact(c, t, HIT, { x0: 1290, y0: 75, x1: 660, y1: 720, kind: 'blood', w: 82, a: 0.96, seed: 655 });
          I.flyWhite(c, t, { t0: HIT, dur: 0.2, hold: 1.1, fade: 0.5, x0: 1420, y0: 55, x1: 540, y1: 780, w: 125, kind: 'ink', a: 0.85, seed: 656 });
          I.inkSplash(c, t, { t0: HIT, x: 870, y: 555, size: 580, v: 2, vary: true, a: 0.82, seed: 657 });
        });

        // 3 帧拓片金石反白顿帧
        if (t >= HIT && t < HIT + 0.10) {
          c.save();
          I.screen(c);
          I.paper(c, 0.88);
          I.sweep(c, [[1440, 40], [875, 550], [480, 860]], { raw: true, n: 28, w: 96, a: 0.95, rgb: [32, 24, 20], dry: 0.42, seed: 658 });
          c.restore();
        } else {
          M.flashInk(c, t, HIT + 0.09, { x: 875, y: 550, white: 0.04, ink: 0.08, a: 0.85 });
        }
        ZL.chronalVignette(c, t, { mode: 'rewind', k: 0.92, a: 0.88, seed: 659 });
      } else {
        // 后半（139.6..146.6s，T106 141.0-146.0s 完全落在本段内！）：现世封神台缘残首腐骨化作万点飞灰消散！
        var postLt = t - CUT;
        var cam2 = M.cam(postLt, [
          [0.0, { x: -275, y: 58, zoom: 1.38 }],
          [7.0, { x: -225, y: 42, zoom: 1.24 }, 'smooth']
        ]);
        I.plateFlow(c, 'p-zhanlong-terrace', t, { cam: cam2, amp: 4, scale: 320, speed: 0.12, seed: 660 });

        var ashProg = cl((postLt - 0.25) / 6.2); // 0 -> 1 暗墨肉形 → 枯白颅骨 → 万点飞灰
        var headSpriteA = 1 - U.smooth((ashProg - 0.08) / 0.34);

        withCam(c, cam2, function () {
          // 崖缘石台衬一抹微光冷雾，令残颅化骨飞灰在绝壁之上历历分明
          I.wash(c, 598, 596, 175, 92, 0.38 * (1 - 0.5 * ashProg), 665, [234, 226, 210], 0, { edge: 'soft' });
        });

        if (headSpriteA > 0.01) {
          rigAt(c, 'sp-severed-head', t, {
            cam: cam2, s: 0.082, dx: -365, dy: 64, alpha: headSpriteA, wind: 0.18 + 0.4 * ashProg, amp: 0.4
          });
        }

        withCam(c, cam2, function () {
          ZL.headToAsh(c, t, { x: 595, y: 604, s: 1.48, k: ashProg, a: 0.98, seed: 661 });
          I.wind(c, { count: 16, y0: 490, y1: 710, t: t * 1.4, a: 0.30 * (0.3 + 0.7 * ashProg), rgb: [122, 114, 104], seed: 662 });
          // 139.6s 衔接刀光飞白余韵
          I.flyWhite(c, t, { t0: CUT, dur: 0.22, hold: 0.35, fade: 0.55, x0: 960, y0: 390, x1: 410, y1: 690, w: 88, kind: 'gold', a: 0.58, seed: 663 });
        });
        ZL.chronalVignette(c, t, { mode: 'reality', k: 0.65, a: 0.72, seed: 664 });
      }
    },

    /* 5-13 [146.6..162.0]（trueface）：乱流渐平显露清朗宗师真容「朝阳先生 · 杨和子」，叠切承启天赵相山与血府老祖失声骇立！ */
    '5-13': function (c, t, lt) {
      var cam = M.cam(lt, [
        [0.0,  { x: -30, y: 18,  zoom: 1.16 }],
        [4.8,  { x: -75, y: 8,   zoom: 1.09 }, 'smooth'],
        [15.4, { x: -95, y: -4,  zoom: 1.05 }, 'smooth']
      ]);

      // 硝烟散尽态：提亮暖宣纸气韵，令上方题签 T107 与秘阵声 T108 清晰隽永
      I.plate(c, 'p-flashback-war', { cam: cam, grade: { warm: 0.16, dark: -0.18 } });
      c.save();
      I.screen(c);
      var clearMist = 0.42 + 0.16 * U.smooth(lt / 3.5);
      I.wash(c, W * 0.45, H * 0.22, W * 0.72, H * 0.36, clearMist, 671, [238, 231, 215], 0, { edge: 'soft' });
      I.wash(c, W * 0.18, H * 0.32, 420, 380, 0.52, 672, [240, 233, 218], 0, { edge: 'soft' });
      c.restore();

      withCam(c, cam, function () {
        ZL.timeRiver(c, t, { y: 540, h: 580, mode: 'roar', k: 0.42 * (1 - 0.5 * cl(lt / 12)), a: 0.42, seed: 673 });
        // 真容背后澄澈朝阳清辉与穿胸血链形成震撼悲剧对照
        I.glow(c, 780, 490, 290, [224, 198, 142], 0.34, 'screen');
        ZL.bloodChains(c, t, { cx: 775, cy: 595, n: 18, eruptK: 1, rattle: 0.12, a: 0.48, seed: 674 });
      });

      // 清朗儒雅、渊渟岳峙的开派祖师真容（sp-yang-true 中近景）
      var revealYang = U.smooth(lt / 1.4);
      rigAt(c, 'sp-yang-true', t, {
        cam: cam, s: 0.265, dx: -185, dy: 92, alpha: revealYang, wind: 0.32,
        script: {
          root: [
            { t: 146.6, dx: -12, dy: 10, rot: -0.015, s: 0.98 },
            { t: 150.0, dx: 0, dy: 0, rot: 0, s: 1.0, ease: 'outSine' },
            { t: 162.0, dx: 6, dy: -4, rot: 0.008, s: 1.01 }
          ],
          wind: { dirDeg: 16, base: 0.3 },
          breathe: { period: 4.8, amp: 0.65 }
        }
      });

      // 150.8..160.6s（严格包覆 T108 151.8-159.6s，进出均在无字安全窗内柔边洇现）：右半水墨云镜叠切承启天赵相山与血府老祖骇然失色！
      var insetIn = U.smooth((lt - 4.1) / 0.85), insetOut = 1 - U.smooth((lt - 13.4) / 1.1);
      var insetA = insetIn * insetOut;
      if (insetA > 0.01) {
        c.save();
        I.screen(c);
        I.flow(c, 'p-chengqi-tree', t, {
          src: [360, 120, 1200, 840], dst: [1040, 190, 790, 620], alpha: 0.86 * insetA,
          vignette: { rx: 0.92, ry: 0.88, soft: 0.52 }, warp: { amp: 4, scale: 240, speed: 0.1, seed: 675 }
        });
        // 紫气云缘柔护框
        ZL.purpleCanopy(c, t, { x: 1435, y: 235, w: 680, h: 210, k: 0.65 * insetA, branchK: 0, a: 0.68 * insetA, seed: 676 });
        c.restore();

        // 赵相山骇然后退半步、血府老祖双手合十失神
        rigAt(c, 'sp-zhao-set-4', t, {
          cam: { x: 0, y: 0, zoom: 1 }, s: 0.155, dx: 345, dy: 58, alpha: insetA,
          script: {
            root: [
              { t: 151.2, dx: -18, dy: 0, rot: 0, s: 1.0 },
              { t: 152.1, dx: 24, dy: 6, rot: 0.035, s: 0.985, ease: 'outBack' },
              { t: 161.0, dx: 28, dy: 6, rot: 0.03, s: 0.985 }
            ],
            wind: { dirDeg: 12, base: 0.36 },
            impulse: [{ t: 151.8, x: 1, y: 0.2, amp: 1.1 }],
            breathe: { period: 3.2, amp: 0.8 }
          }
        });
        rigAt(c, 'sp-xuefu-4', t, {
          cam: { x: 0, y: 0, zoom: 1 }, s: 0.155, dx: 590, dy: 92, alpha: insetA,
          script: {
            root: [
              { t: 151.2, dx: 0, dy: 0, rot: 0, s: 1.0 },
              { t: 152.2, dx: 10, dy: 4, rot: 0.02, s: 0.99, ease: 'outCubic' },
              { t: 161.0, dx: 12, dy: 4, rot: 0.02, s: 0.99 }
            ],
            wind: { dirDeg: 15, base: 0.3 },
            breathe: { period: 3.6, amp: 0.7 }
          }
        });
      }

      ZL.spiritDust(c, t, { n: 30, rgb: [216, 190, 132], speed: 16, a: 0.42, seed: 677 });
      ZL.chronalVignette(c, t, { mode: 'rewind', k: 0.58, a: 0.65, seed: 678 });
    },

    /* 5-14 [162.0..177.5]：杀尽群魔欲自斩，龙煞微闪即溃（力竭难催寸锋）→ 170.4s 切余慈默然动容「求死亦不可得……」 */
    '5-14': function (c, t, lt) {
      var CUT = 170.4; // 精准落在 T109(169.8) 与 T110(171.2) 之间的无字空窗！
      if (t < CUT) {
        var cam1 = M.cam(lt, [
          [0.0, { x: -20, y: 12, zoom: 1.08 }],
          [4.8, { x: -10, y: 34, zoom: 1.15 }, 'smooth'],
          [8.4, { x: -6,  y: 52, zoom: 1.20 }, 'smooth']
        ]);
        I.plate(c, 'p-zhanlong-block-cu', { cam: cam1, grade: { warm: 0.18, dark: 0.05 } });

        // 163.8..166.3s 勉力催动头顶龙煞欲凝血刀；166.4s 力竭反噬，刀影闪烁两下无力溃散成烟！
        var tryRise = U.smooth((lt - 1.6) / 2.2);
        var collapse = U.smooth((lt - 4.4) / 1.4);
        var flicker = lt > 3.8 && lt < 5.6 ? (0.55 + 0.45 * Math.sin(t * 28)) : 1;
        var shaA = 0.46 * tryRise * (1 - collapse) * flicker;

        var slumpK = U.smooth((lt - 4.3) / 2.2);

        withCam(c, cam1, function () {
          if (shaA > 0.01) {
            ZL.dragonSha(c, t, { x: 960, y: 350 + 60 * collapse, s: 0.88, state: 'cower', a: shaA, seed: 681 });
            ZL.dragonSha(c, t, { x: 960, y: 420, s: 0.82, state: 'blade', bladeK: 0.18 * tryRise * (1 - collapse), a: shaA * 0.72, seed: 682 });
          }
          // 刀影溃散时化作无奈飘落的暗赭残烟
          if (lt > 4.3 && lt < 7.8) {
            M.dust(c, t, 166.4, { x: 960, y: 340, n: 22, v: 240, g: 180, life: 2.4, rgb: [104, 38, 32], a: 0.55, seed: 683 });
          }
          ZL.bloodChains(c, t, { cx: 885, cy: 615 + 34 * slumpK, n: 22, eruptK: 1, rattle: 0.36 * (1 - 0.5 * slumpK), a: 0.78, seed: 684 });
        });

        rigAt(c, 'sp-yang-true', t, {
          cam: cam1, s: 0.225, dx: -75, dy: 118 + 38 * slumpK,
          script: {
            root: [
              { t: 162.0, dx: 0, dy: 0, rot: 0.03, s: 1.0 },
              { t: 165.8, dx: 8, dy: -8, rot: -0.02, s: 1.01, ease: 'inOutSine' },
              { t: 167.2, dx: 22, dy: 34, rot: 0.14, s: 0.97, ease: 'outCubic' },
              { t: 170.4, dx: 26, dy: 42, rot: 0.16, s: 0.96 }
            ],
            wind: { dirDeg: 18, base: 0.24 },
            impulse: [{ t: 166.5, x: 0.3, y: 1, amp: 0.9 }],
            breathe: { period: 3.4, amp: 0.85 }
          }
        });
        ZL.chronalVignette(c, t, { mode: 'rewind', k: 0.72, a: 0.78, seed: 685 });
      } else {
        // 后半（170.4..177.5s）：余慈凝望空寂断龙石，心声动容「求死亦不可得……」
        var lt2 = t - CUT;
        var cam2 = M.cam(lt2, [
          [0.0, { x: -95, y: 16, zoom: 1.12 }],
          [7.1, { x: -65, y: 6,  zoom: 1.19 }, 'smooth']
        ]);
        I.plateFlow(c, 'p-zhanlong-terrace', t, { cam: cam2, amp: 3.5, scale: 340, speed: 0.08, seed: 686 });
        I.plateMist(c, t, { cam: cam2, y: H * 0.74, h: 250, a: 0.24, speed: 10, rgb: [228, 220, 206], seed: 687 });

        rigAt(c, 'sp-yuci-look-3', t, {
          cam: cam2, s: 0.195, dx: -210, dy: 108, wind: 0.25, period: 4.8, breathe: 0.6
        });
        ZL.spiritDust(c, t, { n: 22, rgb: [148, 198, 192], speed: 12, a: 0.38, seed: 688 });
        ZL.chronalVignette(c, t, { mode: 'reality', k: 0.58, a: 0.64, seed: 689 });
      }
    },

    /* 5-15 [177.5..195.0]：苦笑摇头变貌负链，缓步走向绝壁崖边立定，四周血雾凝固静止熬过一千年！ */
    '5-15': function (c, t, lt) {
      var walkK = U.smooth(lt / 12.2);
      var morphK = U.smooth((lt - 4.6) / 3.8); // 182.1..185.9s 由清朗真容渐化为白皙血须伪装态
      var freezeK = U.smooth((lt - 7.5) / 6.5); // 185.0..191.5s 时光由奔流彻底凝固静止

      var cam = M.cam(lt, [
        [0.0,  { x: 65,   y: 24, zoom: 1.10 }],
        [12.5, { x: -165, y: 38, zoom: 1.18 }, 'smooth'],
        [17.5, { x: -185, y: 32, zoom: 1.14 }, 'smooth']
      ]);

      var tf = U.lerp(t, 191.5 + (t - 191.5) * 0.04, U.smooth((lt - 13.5) / 3.0));
      I.plateFlow(c, 'p-zhanlong-terrace', tf, { cam: cam, amp: 4.5 * (1 - 0.8 * freezeK), scale: 320, speed: 0.1, seed: 691 });

      var charDx = U.lerp(95, -355, walkK);
      var charDy = U.lerp(104, 88, walkK) + (1 - walkK) * 3.5 * Math.abs(Math.sin(lt * 2.3));
      var headShake = (lt > 1.2 && lt < 4.8) ? 0.035 * Math.sin((lt - 1.2) * 5.2) * Math.sin(Math.PI * (lt - 1.2) / 3.6) : 0;

      withCam(c, cam, function () {
        if (freezeK < 0.98) {
          ZL.timeRiver(c, tf, { y: 530, h: 620, mode: 'roar', k: 0.55 * (1 - freezeK), a: 0.55, seed: 692 });
        }
        if (freezeK > 0.02) {
          ZL.timeRiver(c, tf, { y: 530, h: 620, mode: 'frozen', k: freezeK, a: 0.82, seed: 693 });
        }
        // 二十二条穿胸铁索随步伐拖拽沉吟，抵崖立定后一同凝止
        ZL.bloodChains(c, tf, {
          cx: 960 + charDx, cy: 585 + (charDy - 95), n: 22, eruptK: 1,
          rattle: 0.34 * (1 - 0.88 * freezeK), a: 0.72, seed: 694
        });
        // 变貌瞬间的暗红血雾拂面墨晕
        if (morphK > 0.02 && morphK < 0.98) {
          var veilA = Math.sin(Math.PI * morphK) * 0.45;
          I.wash(c, 960 + charDx, 555, 135, 220, veilA, 695, [88, 28, 24], 0, { edge: 'wet' });
        }
      });

      if (morphK < 0.99) {
        rigAt(c, 'sp-yang-true', tf, {
          cam: cam, s: 0.195, dx: charDx, dy: charDy, flipX: true, alpha: 1 - morphK,
          wind: 0.32 * (1 - 0.7 * freezeK),
          script: {
            root: [{ t: 0, dx: 0, dy: 0, rot: headShake, s: 1 }],
            wind: { dirDeg: 18, base: 0.32 * (1 - 0.7 * freezeK) },
            breathe: { period: 4.5, amp: 0.6 * (1 - 0.7 * freezeK) }
          }
        });
      }
      if (morphK > 0.01) {
        rigAt(c, 'sp-yang-disguise', tf, {
          cam: cam, s: 0.195, dx: charDx, dy: charDy, alpha: morphK,
          wind: 0.28 * (1 - 0.8 * freezeK),
          script: {
            root: [{ t: 0, dx: 0, dy: 0, rot: headShake * 0.5, s: 1 }],
            wind: { dirDeg: 14, base: 0.26 * (1 - 0.8 * freezeK) },
            breathe: { period: 5.2, amp: 0.45 * (1 - 0.8 * freezeK) }
          }
        });
      }

      ZL.chronalVignette(c, tf, { mode: 'reality', k: 0.68 + 0.15 * freezeK, a: 0.78, seed: 696 });
    },

    /* 5-16 [195.0..209.0]｜命中 H17 @ G1070.0 (t=200.0s)：青莲被暴烈血烟猛然冲起，十七足巨蛛「参罗利那本命分身」破颈冲出！ */
    '5-16': function (c, t, lt) {
      var HIT = 200.0;
      var ta = M.hitStop(t, [[HIT, 0.09, 0.28]]);
      var preRumble = t < HIT ? U.smooth((t - 195.8) / 4.0) : 0;
      var rumX = preRumble * 4.2 * U.noise1(t * 29, 701), rumY = preRumble * 3.6 * U.noise1(t * 31, 702);
      var hk = M.kick(t, HIT, { amp: 21, f: 7.0, zeta: 0.35, life: 1.25, dir: -Math.PI * 0.5, zAmp: 0.055, seed: 703 });

      var cam = M.cam(ta - 195.0, [
        [0.0,  { x: 0,   y: 58,  zoom: 1.20 }],
        [4.9,  { x: 0,   y: 72,  zoom: 1.28 }, 'expoIn'],
        [5.3,  { x: 0,   y: -18, zoom: 1.05 }, 'expoOut'],
        [14.0, { x: -12, y: -28, zoom: 1.11 }, 'smooth']
      ]);
      cam = M.kickCam({ x: cam.x + rumX, y: cam.y + rumY, zoom: cam.zoom }, hk);

      I.plateFlow(c, 'p-zhanlong-block-cu', ta, { cam: cam, amp: 4 + 8 * (t >= HIT ? 1 : preRumble), scale: 260, speed: 0.18, seed: 704 });

      var burstProg = t < HIT ? 0 : M.expoOut(cl((t - HIT) / 1.15), 5);
      var lotusKnockY = t < HIT ? (-6 * preRumble * Math.sin(t * 32)) : (-215 * M.expoOut(cl((t - HIT) / 0.85), 5) + 14 * Math.sin((t - HIT) * 3.5));

      withCam(c, cam, function () {
        if (preRumble > 0.05 && t < HIT + 0.3) {
          I.wash(c, 960, 610, 145 * preRumble, 85 * preRumble, 0.58 * preRumble, 705, [36, 16, 18], 0, { edge: 'wet' });
        }
        // 颈口碗大青莲被狂暴魔气猛地顶飞至高空
        ZL.cyanLotusAndMist(c, ta, {
          x: 960 + (t >= HIT ? 48 * burstProg : 0), y: 565, mistK: 0, lotusK: 1.0,
          dropY: lotusKnockY, dewK: 0.6, washK: 0, a: 0.92, seed: 706
        });

        // 参罗利那十七足血烟本命分身破颈冲出
        if (burstProg > 0.01) {
          ZL.spiderEscape(c, ta, { x: 960, y: 545, s: 1.06, burstK: burstProg, splitK: 0, netK: 0, cocoonK: 0, a: 0.82, seed: 707 });
          I.inkSplash(c, t, { t0: HIT, x: 960, y: 560, size: 680, v: 2, vary: true, a: 0.85, tint: [78, 18, 22], seed: 708 });
          M.inkShock(c, t, { t0: HIT, dur: 1.05, x: 960, y: 540, R: 620, flat: 0.45, rgb: [92, 22, 24], a: 0.68, seed: 709 });
        }
      });

      // 叠入精绘十七长足巨蛛立绘（sp-canluolina）凶睛怒张盘踞半空！
      if (t >= HIT) {
        var spSc = 0.37 * (0.45 + 0.55 * burstProg);
        rigAt(c, 'sp-canluolina', ta, {
          cam: cam, s: spSc, dx: 0, dy: U.lerp(45, -75, burstProg), alpha: cl((t - HIT) / 0.22) * 0.94,
          script: {
            root: [
              { t: 200.0, dx: 0, dy: 40, rot: -0.04, s: 0.88 },
              { t: 200.5, dx: 0, dy: -12, rot: 0.03, s: 1.04, ease: 'outBack' },
              { t: 209.0, dx: 8, dy: -22, rot: -0.02, s: 1.02 }
            ],
            wind: { dirDeg: 90, base: 0.72, gust: [{ t: 200.0, dur: 1.5, amp: 1.8 }] },
            impulse: [{ t: 200.0, x: 0, y: -1, amp: 1.5 }],
            breathe: { period: 1.8, amp: 1.1 }
          }
        });
      }

      M.flashInk(c, t, HIT, { x: 960, y: 520, white: 0.045, ink: 0.09, a: 0.92 });
      ZL.chronalVignette(c, t, { mode: 'reality', k: 0.82, a: 0.84, seed: 710 });
    },

    /* 5-17 [209.0..217.0]（快切斩魔①，bisect @ 209.8s）：副御金甲神将暴起挥刃，将十七足魔蛛当空一刀劈为左右两半！ */
    '5-17': function (c, t, lt) {
      var HIT = 209.8;
      var ta = M.hitStop(t, [[HIT, 0.08, 0.25]]);
      var hk = M.kick(t, HIT, { amp: 18, f: 7.4, zeta: 0.38, life: 1.0, dir: -0.66, zAmp: 0.042, seed: 715 });
      var cam = M.cam(ta - 209.0, [
        [0.0, { x: 45,  y: -10, zoom: 1.08 }],
        [0.8, { x: 15,  y: -25, zoom: 1.15 }, 'expoIn'],
        [1.1, { x: -20, y: -32, zoom: 1.07 }, 'expoOut'],
        [8.0, { x: -35, y: -48, zoom: 1.13 }, 'smooth']
      ]);
      cam = M.kickCam(cam, hk);

      I.plateFlow(c, 'p-zhanlong-block-cu', ta, { cam: cam, amp: 5, scale: 280, speed: 0.16, seed: 716 });

      var splitProg = t < HIT ? 0 : M.expoOut(cl((t - HIT) / 0.85), 5);

      // 斩击前由 sp-canluolina 扑出，209.8s 刀光闪处无缝移交 zl.spiderEscape(splitK: 0->1) 左右两半残躯！
      var wholeSpiderA = 1 - cl((t - (HIT - 0.04)) / 0.18);
      if (wholeSpiderA > 0.01) {
        rigAt(c, 'sp-canluolina', ta, {
          cam: cam, s: 0.36, dx: -35, dy: -85 - 25 * cl(lt / 0.8), alpha: wholeSpiderA * 0.94, wind: 0.8
        });
      }

      withCam(c, cam, function () {
        ZL.spiderEscape(c, ta, {
          x: 925, y: 470, s: 1.14, burstK: 1.0, splitK: splitProg, netK: 0, cocoonK: 0,
          a: t < HIT ? 0.65 : 1.0, seed: 717
        });
        // 神将隔空金青剑罡凛冽一刀两断（锋芒利落不臃肿）！
        ZL.slashImpact(c, t, HIT, { x0: 1390, y0: 660, x1: 490, y1: 175, kind: 'cyan', w: 42, a: 0.96, seed: 718 });
        I.flyWhite(c, t, { t0: HIT, dur: 0.15, hold: 0.42, fade: 0.52, x0: 1440, y0: 685, x1: 440, y1: 150, w: 54, kind: 'gold', a: 0.78, seed: 719 });
        M.after(c, t, HIT, { x: 925, y: 410, n: 22, v: 440, life: 2.0, smoke: 2.6, rgb: [64, 16, 20], a: 0.75, seed: 720 });
      });

      // 右侧副御金甲神将踏步挥剑
      rigAt(c, 'sp-punish-gen-2', ta, {
        cam: cam, s: 0.23, dx: U.lerp(410, 315, cl(lt / 0.85)), dy: 118,
        script: {
          root: [
            { t: 209.0, dx: 28, dy: 10, rot: 0.05, s: 0.98 },
            { t: 209.8, dx: -18, dy: -14, rot: -0.07, s: 1.04, ease: 'outBack' },
            { t: 217.0, dx: -10, dy: -6, rot: -0.03, s: 1.01 }
          ],
          wind: { dirDeg: 195, base: 0.65, gust: [{ t: 209.8, dur: 1.2, amp: 1.6 }] },
          impulse: [{ t: 209.8, x: -1, y: -0.5, amp: 1.4 }],
          breathe: { period: 3.2, amp: 0.8 }
        }
      });

      M.flashInk(c, t, HIT, { x: 925, y: 410, white: 0.04, ink: 0.07, a: 0.82 });
      ZL.chronalVignette(c, t, { mode: 'reality', k: 0.72, a: 0.76, seed: 721 });
    },

    /* 5-17b [217.0..221.4]（4.4s 纯动作快切②）：被劈两半的魔蛛分左右狂飙冲霄，天穹湖玉青光大网兜头罩落！ */
    '5-17b': function (c, t, lt) {
      var u = cl(lt / 4.4);
      var cam = M.cam(lt, [
        [0.0, { x: 0,  y: 65,   zoom: 1.06 }],
        [2.4, { x: -8, y: -85,  zoom: 1.15 }, 'expoOut'],
        [4.4, { x: 0,  y: -125, zoom: 1.20 }, 'smooth']
      ]);
      I.plateFlow(c, 'p-zhanlong-terrace', t, { cam: cam, amp: 6, scale: 300, speed: 0.18, seed: 725 });

      withCam(c, cam, function () {
        // 两道黑红魔虹分左右狂飙逃窜轨迹
        M.inkPath(c, t, { t0: 217.05, dur: 1.3, dry: 1.8, w: 32, rgb: [78, 18, 22], glow: [124, 36, 28], pts: [[920, 620], [720, 440], [580, 260]], seed: 726 });
        M.inkPath(c, t, { t0: 217.12, dur: 1.3, dry: 1.8, w: 30, rgb: [38, 18, 24], glow: [104, 28, 25], pts: [[990, 620], [1190, 430], [1340, 250]], seed: 727 });

        // 天顶湖玉符诏展开，化作遮天青网罩落（netK: 0 -> 0.38）
        var netOpen = U.smooth((lt - 1.1) / 3.1);
        ZL.tadpoleEdict(c, t, { x: 960, y: 175, s: 1.05, morphK: 0.75, unfoldK: 0.45 + 0.4 * netOpen, cyanK: 1.0, a: 0.9, seed: 728 });
        ZL.spiderEscape(c, t, {
          x: 960, y: U.lerp(560, 355, M.expoOut(u, 4)), s: 1.18,
          burstK: 1.0, splitK: 1.0, netK: 0.38 * netOpen, cocoonK: 0, a: 0.96, seed: 729
        });
      });
      ZL.chronalVignette(c, t, { mode: 'reality', k: 0.62, a: 0.68, seed: 730 });
    },

    /* 5-18 [221.4..233.6]（快切兜截③）：余慈剑指一引青光天罗地网收拢，228.5s 空间漩涡将其径摄太霄道境！ */
    '5-18': function (c, t, lt) {
      // T115: 222.2-228.2s；空间移换严格从 228.5s（lt=7.1s）启动，避开字幕区间！
      var shiftK = U.smooth((lt - 7.1) / 3.8);
      var cam = M.cam(lt, [
        [0.0,  { x: -30, y: -15, zoom: 1.06 }],
        [7.0,  { x: 10,  y: -45, zoom: 1.14 }, 'smooth'],
        [12.2, { x: 35,  y: -75, zoom: 1.24 }, 'expoIn']
      ]);

      I.plate(c, 'p-zhanlong-terrace', { cam: cam, fade: { id2: 'p-daojing-scroll', k: shiftK } });
      if (shiftK > 0.02 && shiftK < 0.98) {
        I.realm(c, t, { x: 980, y: 390, R: 460, k: shiftK, chaos: 1.2, paper: 0.25, a: 0.68 * Math.sin(Math.PI * shiftK), seed: 735 });
      }

      // 前段左侧余慈剑指擎天催动符诏
      if (shiftK < 0.95) {
        rigAt(c, 'sp-yuci-pose-set-1', t, {
          cam: cam, s: 0.195, dx: -415, dy: 122, alpha: 1 - shiftK,
          script: {
            root: [
              { t: 221.4, dx: -14, dy: 8, rot: -0.02, s: 0.99 },
              { t: 222.6, dx: 6, dy: -8, rot: 0.02, s: 1.02, ease: 'outCubic' },
              { t: 230.0, dx: 10, dy: -12, rot: 0.025, s: 1.02 }
            ],
            wind: { dirDeg: 15, base: 0.48, gust: [{ t: 222.2, dur: 1.6, amp: 1.3 }] },
            breathe: { period: 3.6, amp: 0.7 }
          }
        });
      }

      withCam(c, cam, function () {
        var netProg = U.lerp(0.38, 1.0, U.smooth(lt / 6.8));
        ZL.tadpoleEdict(c, t, {
          x: 990, y: 320, s: 1.16 * (1 - 0.22 * shiftK), morphK: 0.85, unfoldK: 0.95, cyanK: 1.0, a: 0.92, seed: 736
        });
        ZL.spiderEscape(c, t, {
          x: 990, y: 415 - 35 * shiftK, s: 1.14 * (1 - 0.18 * shiftK),
          burstK: 1.0, splitK: 1.0, netK: netProg, cocoonK: 0.12 * shiftK, a: 0.98, seed: 737
        });
        ZL.spiritDust(c, t, { n: 38, rgb: [148, 206, 198], speed: 34, a: 0.58, seed: 738 });
      });
      ZL.chronalVignette(c, t, { mode: shiftK > 0.5 ? 'dream' : 'reality', k: 0.55, a: 0.58, seed: 739 });
    },

    /* 5-19 [233.6..246.5]（thunder @ 233.6s）：道境万仙金青雷霆如暴雨倾盆轰落，符丝层层将凶魔缠成硕大巨茧！ */
    '5-19': function (c, t, lt) {
      var k0 = M.kick(t, 233.65, { amp: 17, f: 7.5, life: 0.95, dir: Math.PI * 0.5, zAmp: 0.04, seed: 741 });
      var k1 = M.kick(t, 237.2,  { amp: 13, f: 7.2, life: 0.75, dir: Math.PI * 0.5, zAmp: 0.025, seed: 742 });
      var k2 = M.kick(t, 241.4,  { amp: 14, f: 7.2, life: 0.80, dir: Math.PI * 0.5, zAmp: 0.028, seed: 743 });
      // 持续道法雷暴高频微颤
      var stormTrem = 2.4 * U.noise1(t * 24, 744);
      var cam = M.cam(lt, [
        [0.0,  { x: 0,  y: -18, zoom: 1.05 }],
        [6.5,  { x: 12, y: -6,  zoom: 1.14 }, 'smooth'],
        [12.9, { x: -8, y: 8,   zoom: 1.20 }, 'smooth']
      ]);
      cam = applyKicks({ x: cam.x + stormTrem, y: cam.y + stormTrem * 0.7, zoom: cam.zoom }, [k0, k1, k2]);

      I.plateFlow(c, 'il-spider-thunder', t, { cam: cam, amp: 7, scale: 260, speed: 0.22, seed: 745 });

      var cocProg = U.smooth(lt / 11.8) * 0.85;
      withCam(c, cam, function () {
        // 道境青白神火雷云环拱茧心
        I.sunfire(c, t, { x: 960, y: 540, w: 680, h: 320, n: 10, mix: [1, 0.45, 0], k: 0.72, a: 0.42, speed: 1.35, paleBg: 0.35, seed: 746 });
        ZL.spiderEscape(c, t, {
          x: 960, y: 455, s: 1.14, burstK: 1.0, splitK: 1.0, netK: 1.0, cocoonK: cocProg, a: 1.0, seed: 747
        });
        I.flyWhite(c, t, { t0: 233.65, dur: 0.22, hold: 0.9, fade: 0.6, x0: 380, y0: 80, x1: 960, y1: 450, w: 86, kind: 'gold', a: 0.72, seed: 748 });
        I.flyWhite(c, t, { t0: 237.2,  dur: 0.22, hold: 0.9, fade: 0.6, x0: 1540, y0: 70, x1: 960, y1: 450, w: 86, kind: 'gold', a: 0.68, seed: 749 });
      });

      // 雷霆交替闪光（浅纸底模式压暗外缘突显雷心）
      var flashPulse = Math.max(0, Math.sin(t * 9.2) * Math.cos(t * 5.7) - 0.55) * 0.55;
      if (flashPulse > 0.01) {
        I.flash(c, flashPulse, { x: 960, y: 430, rgb: [236, 248, 244], paleBg: 0.65 });
      }
    },

    /* 5-20 [246.5..260.0]：符文巨茧轰然打落万魔池底，254.2s 起镜头穿清冷烟霭缓降回寂静封神台！ */
    '5-20': function (c, t, lt) {
      // T117: 248.0-254.0s；254.2s（lt=7.7s）起柔雾缓溶回封神台，确保 T117 零跨切！
      var plungeKick = M.kick(t, 247.4, { amp: 14, f: 5.8, life: 0.95, dir: Math.PI * 0.5, zAmp: 0.03, seed: 751 });
      var backToTerrace = U.smooth((lt - 7.7) / 4.6); // 254.2..258.8s 穿云缓降回断龙石
      var cam = M.cam(lt, [
        [0.0,  { x: 0, y: -15, zoom: 1.08 }],
        [6.8,  { x: 0, y: 78,  zoom: 1.18 }, 'smooth'],
        [13.5, { x: 0, y: 24,  zoom: 1.14 }, 'smooth']
      ]);
      cam = M.kickCam(cam, plungeKick);

      I.plate(c, 'il-spider-thunder', { cam: cam, fade: { id2: 'p-zhanlong-block-cu', k: backToTerrace } });

      withCam(c, cam, function () {
        if (backToTerrace < 0.96) {
          var cocFinal = U.lerp(0.85, 1.0, cl(lt / 4.8));
          var cocFade = (1 - U.smooth((lt - 4.2) / 2.6)) * (1 - backToTerrace);
          ZL.spiderEscape(c, t, {
            x: 960, y: 455, s: 1.12, burstK: 1.0, splitK: 1.0, netK: 1.0, cocoonK: cocFinal, a: cocFade, seed: 752
          });
          // 底部幽暗万魔池浊渊吞没魔茧
          I.turbid(c, t, { y: H * 0.68, h: H * 0.34, speed: 24, warp: 28, a: 0.52 * (1 - backToTerrace), seed: 753 });
          M.inkShock(c, t, { t0: 250.2, dur: 1.4, x: 960, y: 790, R: 480, flat: 0.28, rgb: [38, 46, 52], a: 0.55 * (1 - backToTerrace), seed: 754 });
        }

        // 清冷云霭穿行过渡，落定断龙石前的一片空灵澄澈
        var mistEnv = Math.sin(Math.PI * cl((lt - 6.8) / 5.8));
        if (mistEnv > 0.01) {
          I.mistBand(c, t, { y: H * 0.22, h: H * 0.62, speed: 22, warp: 24, a: 0.65 * mistEnv, tint: [232, 228, 216], seed: 755 });
        }
        if (backToTerrace > 0.25) {
          // 远处高空悠悠悬停的那朵碗大青莲，静候尾声「碧血开道」
          ZL.cyanLotusAndMist(c, t, {
            x: 960, y: 485, mistK: 0, lotusK: 0.92, dropY: -95, dewK: 0.9, washK: 0, a: 0.78 * backToTerrace, seed: 756
          });
          ZL.spiritDust(c, t, { n: 20, rgb: [148, 202, 194], speed: 10, a: 0.36 * backToTerrace, seed: 757 });
        }
      });

      ZL.chronalVignette(c, t, { mode: 'reality', k: 0.48 * (1 - 0.35 * backToTerrace), a: 0.56, seed: 758 });
    }
  };

  /* 账本排版微调（保证大字、题签、对白与画面主体零遮挡、高对比） */
  var LEDGER_POS = {
    T101: { x: W * 0.58, y: H * 0.11, size: 162, rgb: [24, 18, 16] },
    T107: { x: W * 0.09, y: H * 0.13, side: 'left' }
  };

  CINE.registerAct({
    id: 'act5',
    order: 5,
    name: '五 · 一刀断千载',
    duration: 260,
    beats: SHEET.beats,
    cues: {
      callblade: { t: 13.0,  beat: '5-02', label: '符诏至刀来' },
      lotus:     { t: 38.5,  beat: '5-04', label: '碗大青莲' },
      behead:    { t: 84.0,  beat: '5-07', label: '一刀断首' },
      rewind:    { t: 105.0, beat: '5-09', label: '光阴回溯' },
      killkin:   { t: 138.0, beat: '5-12', label: '亲斩杨端明' },
      trueface:  { t: 146.6, beat: '5-13', label: '朝阳先生' },
      spider:    { t: 200.0, beat: '5-16', label: '参罗利那' },
      bisect:    { t: 209.8, beat: '5-17', label: '一刀两断' },
      thunder:   { t: 233.6, beat: '5-19', label: '万雷封茧' }
    },
    plates: PLATES,
    draw: function (c, t) {
      var bs = SHEET.beats, idx = 0;
      while (idx + 1 < bs.length && t >= bs[idx + 1].t) idx++;
      var b = bs[idx], lt = t - b.t;
      I.paper(c);
      var fn = SHOTS[b.id];
      if (fn) {
        c.save();
        fn(c, t, lt);
        c.restore();
      }
      I.screen(c);
      I.ledger(c, t, 'act5', { dark: false, pos: LEDGER_POS });
    }
  });
})();
