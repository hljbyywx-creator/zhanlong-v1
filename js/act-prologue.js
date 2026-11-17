/* 《斩龙封神》序幕 prologue · 前情·雪崩前夜（75.0s，G: 0.0 – 75.0，7 镜 P-01..P-07）
   纯 t 确定性演出：千年上清魔劫覆灭 → 洗玉湖深渊三界虚空对撞(H01@28.0) → 幽煌大日狂澜 → 余慈漠然踏入承启天 → 干墨飞白破题(H02@58.5)《斩龙封神·碧血开道》。 */
(function () {
  'use strict';
  var CINE = window.CINE, I = CINE.ink, U = CINE.util, M = CINE.motion, ZL = CINE.zl;
  var W = CINE.W, H = CINE.H;

  var BS = CINE.beatSheet([
    ['P-01', 0.0, 10.5, '上清覆灭残影'],
    ['P-02', 10.5, 20.0, '内鬼毁阵沉湖'],
    ['P-03', 20.0, 30.8, '三界虚空相撞'],
    ['P-04', 30.8, 42.4, '幽煌大日狂澜'],
    ['P-05', 42.4, 53.3, '余慈漠然入道'],
    ['P-06', 53.3, 61.4, '一步踏破界膜'],
    ['P-07', 61.4, 75.0, '干墨破题立卷']
  ]);

  var CUES = Object.assign({}, BS.cues, {
    sun: { t: 28.0, beat: 'P-03', label: '幽煌大日' },
    title: { t: 58.5, beat: 'P-06', label: '斩龙封神' }
  });

  var PLATES = [
    'p-shangqing-fall', 'p-renjian-sun', 'p-chengqi-tree',
    'sp-yuci-stand-w', 'sp-yuci-look-1',
    'fx-crack-gold', 'fx-mist-tex', 'fx-turbid-tex', 'fx-bloodtide-tex',
    'fx-inksplash-1', 'fx-inksplash-2', 'fx-inksplash-3',
    'fx-strata-tex', 'fx-realm-edge', 'fx-flywhite-gold', 'fx-flywhite-ink',
    'fx-sunfire-hong', 'fx-sunfire-bai', 'fx-ring-brush-oval', 'fx-ring-brush-round'
  ].join(' ');

  /* ── 常量骨骼脚本（WeakMap 缓存复用，零逐帧分配） ── */
  var SC_YUCI_WALK = {
    root: [
      { t: 42.4, dx: 0, dy: 0, rot: 0.015 },
      { t: 45.2, dx: 18, dy: -6, rot: 0.024, ease: 'inOutSine' },
      { t: 48.0, dx: 34, dy: -2, rot: 0.018, ease: 'inOutSine' },
      { t: 50.8, dx: 52, dy: -8, rot: 0.026, ease: 'inOutSine' },
      { t: 53.3, dx: 68, dy: -4, rot: 0.02, ease: 'inOutSine' }
    ],
    wind: {
      dirDeg: 12,
      base: 0.62,
      gust: [
        { t: 44.0, dur: 2.2, amp: 1.15 },
        { t: 46.8, dur: 2.4, amp: 1.45 },
        { t: 50.2, dur: 2.5, amp: 1.35 }
      ]
    },
    breathe: { period: 4.4, amp: 0.9 }
  };

  var SC_YUCI_BREACH = {
    root: [
      { t: 53.3, dx: -16, dy: 6, rot: 0.01 },
      { t: 56.8, dx: 12, dy: 0, rot: 0.02, ease: 'inOutSine' },
      { t: 57.6, dx: 4, dy: 5, rot: -0.018, ease: 'inOutSine' },
      { t: 58.5, dx: 56, dy: -14, rot: 0.045, ease: 'outBack' },
      { t: 61.4, dx: 82, dy: -20, rot: 0.025, ease: 'inOutSine' }
    ],
    wind: {
      dirDeg: 8,
      base: 0.55,
      gust: [
        { t: 57.3, dur: 1.1, amp: 1.3 },
        { t: 58.5, dur: 2.0, amp: 2.1 }
      ]
    },
    impulse: [{ t: 58.5, x: 1.0, y: -0.35, amp: 1.5 }],
    breathe: { period: 4.0, amp: 0.85 }
  };

  var LEDGER_POS = {
    T004: { x: W * 0.88, y: H * 0.14, side: 'right' },
    T006: { x: W * 0.88, y: H * 0.14, side: 'right' },
    T009: { x: W * 0.53, y: H * 0.11, size: 198, span: 1.25 },
    T010: { x: W * 0.50, y: H * 0.25, size: 66 }
  };

  /* ── 统一像素级立绘摆放与宣纸云垫接地辅助 ── */
  function rigAt(c, id, t, o) {
    var im = I.plateImg(id);
    if (!im) return;
    var iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
    var hPx = o.hPx || 420;
    var s = (iw / ih > W / H) ? (hPx / H) : ((hPx * iw) / (W * ih));
    var wDx = o.dx || 0;
    var footY = o.footY == null ? 860 : o.footY;
    var dy = footY - H * 0.5 - hPx * 0.5;
    var cam = o.cam;

    if (o.ground !== false) {
      var g = o.ground || {};
      var ga = (g.a == null ? 0.34 : g.a) * (o.alpha == null ? 1 : o.alpha);
      c.save();
      I.screen(c);
      I.cam(c, I.plateView(cam));
      var gx = W * 0.5 + wDx + (g.ox || 0), gy = footY + (g.oy == null ? -8 : g.oy);
      var gw = g.w || hPx * 0.34, gh = g.h || hPx * 0.085;
      I.wash(c, gx, gy, gw, gh, ga, g.seed || 71, g.rgb || [42, 36, 30], 0, { edge: 'soft' });
      if (g.cloud) {
        I.wash(c, gx - gw * 0.15, gy + 4, gw * 1.35, gh * 1.45, ga * 0.72, (g.seed || 71) + 5, g.cloudRgb || [236, 229, 214], 0, { edge: 'soft' });
      }
      c.restore();
    }

    var flip = o.flip === 'h';
    var rCam = flip && cam ? { x: -(cam.x || 0), y: cam.y || 0, zoom: cam.zoom || 1 } : cam;
    I.rig(c, id, t, {
      cam: rCam,
      s: s,
      dx: flip ? -wDx : wDx,
      dy: dy,
      flip: o.flip,
      alpha: o.alpha,
      script: o.script,
      amp: o.amp,
      strain: o.strain
    });
  }

  /* 金石裂纹光脉（借 fx-crack-gold 手绘贴图） */
  function drawGoldCracks(c, t, cam, x, y, sz, a, seed) {
    if (a <= 0.004 || !I.plateHas('fx-crack-gold')) return;
    c.save();
    I.screen(c);
    I.cam(c, I.plateView(cam));
    var pulse = 0.65 + 0.35 * Math.sin(t * 1.7 + seed);
    I.flow(c, 'fx-crack-gold', t, {
      dst: [x - sz * 0.5, y - sz * 0.5, sz, sz],
      tint: [214, 174, 86],
      mode: 'lighter',
      alpha: a * pulse,
      vignette: { rx: 0.95, ry: 0.95, soft: 0.45 },
      warp: { amp: 8, scale: 210, speed: 0.14, seed: seed }
    });
    c.restore();
  }

  /* ── P-01 [0.0..10.5]：千年之前，玄门魁首上清宗毁于内鬼 ── */
  function shotP01(c, t) {
    var cam = M.cam(t, [
      [0.0, { x: -16, y: -38, zoom: 1.04 }],
      [10.5, { x: 14, y: 24, zoom: 1.14 }, 'smooth']
    ]);
    I.plateFlow(c, 'p-shangqing-fall', t, { cam: cam, amp: 6, scale: 340, speed: 0.09, seed: 11 });

    // 牌阙残影间的金石裂纹明灭游走
    drawGoldCracks(c, t, cam, 460, 410, 560, 0.46, 17);
    drawGoldCracks(c, t, cam, 980, 350, 480, 0.34, 29);

    // 远近破墨乱云三层视差错动
    I.mistBand(c, t, { y: -30, h: 360, speed: 22, warp: 24, tint: [32, 28, 26], a: 0.44, seed: 13 });
    I.plateMist(c, t, { cam: cam, y: H * 0.54, h: 300, a: 0.22, rgb: [54, 48, 44], speed: -16, depth: 1.35, seed: 19 });

    // 下缘暗墨浊潮渐涌（6.0s 起暗赭血墨自深渊漫起，同时稳托浅色字幕对比）
    var abyssRise = U.ramp(t, 5.2, 10.2);
    I.turbid(c, t, { y: H * (0.68 - 0.10 * abyssRise), h: H * 0.48, speed: 28, warp: 26, a: 0.62 + 0.22 * abyssRise, seed: 23 });
    if (abyssRise > 0.01) {
      I.bloodTide(c, t, { y: H * (0.76 - 0.10 * abyssRise), h: H * 0.36, speed: -46, warp: 22, burn: 0.35 * abyssRise, a: 0.48 * abyssRise, seed: 31 });
    }

    // 飘坠古铜金烬与残灰
    ZL.spiritDust(c, t, { n: 54, rgb: [196, 154, 78], dir: Math.PI * 0.58, speed: 26, curl: 1.1, a: 0.56, scorch: false, seed: 37 });
    ZL.chronalVignette(c, t, { mode: 'rewind', k: 0.72, a: 0.78, seed: 41 });

    // 开卷 1.1s 浓墨宣纸自然敛开
    var openVeil = 1 - U.smooth(t / 1.15);
    if (openVeil > 0.004) {
      c.save();
      I.screen(c);
      c.globalAlpha = openVeil;
      I.paper(c, 1);
      I.nightSky(c, 0.88 * openVeil, { rgb: [24, 20, 18], seed: 3 });
      c.restore();
    }
  }

  /* ── P-02 [10.5..20.0]：太霄神庭自内崩塌，沉入洗玉湖深渊 ── */
  function shotP02(c, t) {
    var u = (t - 10.5) / 9.5;
    var cam = M.cam(t, [
      [10.5, { x: -34, y: -16, zoom: 1.16 }],
      [20.0, { x: 22, y: 34, zoom: 1.29 }, 'smooth']
    ]);
    var rumble = M.kick(t, 11.2, { amp: 9, f: 5.5, life: 1.4, zAmp: 0.02 });
    cam = M.kickCam(cam, rumble);

    I.plateFlow(c, 'p-shangqing-fall', t, { cam: cam, amp: 10, scale: 270, speed: 0.15, seed: 51 });
    drawGoldCracks(c, t, cam, 620, 440, 680, 0.55 * (1 - 0.35 * u), 53);

    // 盘踞撕扯大阵的天魔黑影与自内向外爆发的暗红魔潮
    c.save();
    I.screen(c);
    I.cam(c, I.plateView(cam));
    ZL.meltShadows(c, t, { x: 740, y: 470 + 55 * u, r: 410, purifyK: 0, n: 12, a: 0.62, seed: 57 });
    I.sunfire(c, t, { x: 690, y: 660, w: 920, h: 320, n: 11, mix: [0, 0.12, 1], k: 0.78, a: 0.52, speed: 1.15, seed: 61 });
    c.restore();

    I.bloodTide(c, t, { y: H * (0.58 - 0.08 * u), h: H * 0.52, speed: -72, warp: 32, burn: 0.58, a: 0.68, seed: 67 });
    I.inkSplash(c, t, { x: 640, y: 460, size: 580, t0: 11.1, dur: 0.36, hold: 1.4, fade: 1.1, tint: [132, 30, 22], vary: true, a: 0.65, seed: 71 });
    I.inkSplash(c, t, { x: 1180, y: 520, size: 520, t0: 15.2, dur: 0.38, hold: 1.3, fade: 1.0, tint: [28, 24, 22], vary: true, a: 0.62, seed: 73 });

    // 洗玉湖底幽暗水层自下向上吞没沉坠仙阙
    var submergeK = U.smooth((t - 12.0) / 7.5);
    I.strata(c, t, { speed: 150, dir: 'down', y0: H * (0.62 - 0.42 * submergeK), y1: H, red: 0.25, a: 0.42 * submergeK, seed: 79 });
    I.turbid(c, t, { y: H * (0.64 - 0.14 * submergeK), h: H * 0.54, speed: 38, warp: 34, a: 0.64, seed: 83 });

    ZL.spiritDust(c, t, { n: 48, rgb: [112, 168, 162], dir: -Math.PI * 0.48, speed: 34, curl: 1.3, a: 0.45 * submergeK, scorch: false, seed: 89 });
    ZL.chronalVignette(c, t, { mode: 'reality', k: 0.78, a: 0.82, seed: 91 });
  }

  /* ── P-03 [20.0..30.8]：三界虚空挤压蓄势 → H01@28.0 轰然对撞！ ── */
  function shotP03(c, t) {
    var TH = 28.0;
    var ta = M.hitStop(t, [[TH, 0.08, 0.34]]);
    var st = M.strike(ta, TH, { pre: 1.5, go: 0.22, post: 2.2, wind: 0.18 });
    var cam = M.cam(ta, [
      [20.0, { x: 0, y: 12, zoom: 1.08 }],
      [26.5, { x: 0, y: -6, zoom: 1.20 }, 'smooth'],
      [27.78, { x: 0, y: -10, zoom: 1.15 }, 'backIn'],
      [28.0, { x: 0, y: 0, zoom: 1.28 }, 'expoIn'],
      [30.8, { x: -24, y: -12, zoom: 1.12 }, 'expoOut']
    ]);
    cam = M.kickCam(cam, M.kick(t, TH, { amp: 22, f: 6.2, zeta: 0.36, life: 1.75, zAmp: 0.06, seed: 97 }));

    I.plateFlow(c, 'p-shangqing-fall', ta, { cam: cam, amp: 8 + 10 * st.pre, scale: 280, speed: 0.14, seed: 101 });

    // 20.0..28.0：真界(白玉)、水世界(石绿)、太霄神庭(赤金古铜)三重空间断层相向挤压
    var sq = U.clamp((ta - 20.0) / 8.0, 0, 1);
    var postFade = 1 - U.ramp(t, TH, TH + 1.4);
    if (postFade > 0.01) {
      I.strata(c, ta, { mode: 'reveal', x: 0, y: 0, w: W, h: H * 0.48, k: U.clamp(sq * 1.25, 0, 1), n: 4, dir: 'down', shift: 140, a: 0.46 * postFade, seed: 103 });
      I.strata(c, ta, { mode: 'reveal', x: 0, y: H * 0.52, w: W, h: H * 0.48, k: U.clamp(sq * 1.25, 0, 1), n: 4, dir: 'up', shift: 140, a: 0.52 * postFade, seed: 107 });

      // 万古云霄界域裹住神庭核心，真界白玉碟与碧水世界上下挤压欲裂
      c.save();
      I.screen(c);
      I.cam(c, I.plateView(cam));
      var realmScale = U.lerp(0.86, 0.58, M.expoIn(sq, 3.5)) * (1 - 0.10 * st.pre);
      ZL.invertedDish(c, ta, { x: 960, y: 495, s: realmScale, breachK: 0.14 + 0.36 * sq, flicker: 0.45 * sq, a: 0.76 * postFade, seed: 43 });
      drawGoldCracks(c, ta, cam, 960, 495, 980 * realmScale, (0.36 + 0.55 * sq) * postFade, 113);
      c.restore();
    }

    // 底部深渊墨雾衬底（保证 20.6..26.4s T003 字幕清晰沉稳）
    if (postFade > 0.02) {
      I.turbid(c, ta, { y: H * 0.64, h: H * 0.42, speed: 42, warp: 30, a: 0.66 * postFade, seed: 117 });
    }

    // H01@28.0：三界轰然对撞！墨洇揭开人间界外层天穹 p-renjian-sun
    if (t >= TH - 0.32) {
      if (t >= TH) {
        M.reveal(c, t, TH, 2.2, function (rc) {
          I.plateFlow(rc, 'p-renjian-sun', t, { cam: cam, amp: 12, scale: 260, speed: 0.18, seed: 121 });
          rc.save();
          I.screen(rc);
          I.cam(rc, I.plateView(cam));
          ZL.sixPathsWheel(rc, t, { x: 485, y: 190, r: 190, timeK: 1.4, a: 0.88, seed: 47 });
          rc.restore();
        }, { from: [960, 490], rim: 0.28, rimRgb: [196, 152, 68], seed: 127 });
      }

      // 对撞冲击环、金墨飞白裂空与碎墨余震
      ZL.slashImpact(c, t, TH, { x0: 180, y0: 530, x1: 1740, y1: 460, w: 84, kind: 'gold', dur: 0.15, a: 0.92, seed: 131 });
      M.inkShock(c, t, { t0: TH, dur: 1.45, x: 960, y: 490, R: 920, flat: 0.48, rgb: [212, 168, 76], a: 0.72, seed: 137 });
      M.inkRing(c, t, TH + 0.04, { x: 960, y: 490, r: 680, flat: 0.56, w: 54, rgb: [82, 158, 168], a: 0.65, life: 1.25, seed: 139 });
      M.after(c, t, TH, { x: 960, y: 490, n: 28, v: 480, life: 2.4, smoke: 2.6, rgb: [42, 34, 28], smokeRgb: [168, 146, 112], a: 0.78, seed: 149 });
      M.flashInk(c, t, TH, { x: 960, y: 490, white: 0.06, ink: 0.09, a: 0.96 });
    }

    ZL.chronalVignette(c, t, { mode: t < TH ? 'reality' : 'rewind', k: 0.62, a: 0.68, seed: 151 });
  }

  /* ── P-04 [30.8..42.4]：大黑天催幽煌大日，在外层横冲直撞 ── */
  function shotP04(c, t) {
    var cam = M.cam(t, [
      [30.8, { x: -46, y: -18, zoom: 1.12 }],
      [36.6, { x: -8, y: -4, zoom: 1.09 }, 'smooth'],
      [42.4, { x: 34, y: 12, zoom: 1.06 }, 'smooth']
    ]);
    // 大日三次横冲直撞震波
    var k1 = M.kick(t, 32.6, { amp: 7, f: 5.5, life: 1.1, zAmp: 0.018, seed: 11 });
    var k2 = M.kick(t, 36.8, { amp: 9, f: 6.0, life: 1.2, zAmp: 0.022, seed: 17 });
    var k3 = M.kick(t, 40.4, { amp: 8, f: 5.8, life: 1.1, zAmp: 0.018, seed: 23 });
    cam = M.kickCam(M.kickCam(M.kickCam(cam, k1), k2), k3);

    I.plateFlow(c, 'p-renjian-sun', t, { cam: cam, amp: 9, scale: 280, speed: 0.16, seed: 163 });

    // 世界空间：锚定在底图左上赤金涡旋处的「幽煌大日·六道光阴轮」狂暴冲撞
    c.save();
    I.screen(c);
    I.cam(c, I.plateView(cam));
    var surgeX = 485 + 26 * Math.sin(t * 1.9) + 18 * U.noise1(t * 2.6, 47);
    var surgeY = 190 + 16 * Math.cos(t * 2.3);
    I.sunfire(c, t, { x: surgeX, y: surgeY + 58, w: 460, h: 250, n: 11, mix: [0, 0.22, 1], k: 0.92, a: 0.72, speed: 1.35, paleBg: 0.55, seed: 167 });
    ZL.sixPathsWheel(c, t, { x: surgeX, y: surgeY, r: 192 + 12 * Math.sin(t * 2.7), timeK: 1.45, a: 0.92, seed: 47 });

    M.inkRing(c, t, 32.6, { x: surgeX, y: surgeY, r: 520, flat: 0.68, w: 42, rgb: [176, 56, 32], a: 0.55, life: 1.3, seed: 173 });
    M.inkRing(c, t, 36.8, { x: surgeX, y: surgeY, r: 580, flat: 0.66, w: 46, rgb: [196, 118, 42], a: 0.58, life: 1.35, seed: 179 });
    M.inkRing(c, t, 40.4, { x: surgeX, y: surgeY, r: 540, flat: 0.68, w: 42, rgb: [176, 56, 32], a: 0.52, life: 1.25, seed: 181 });
    c.restore();

    // 翻涌云水与狂风横掠
    I.mistBand(c, t, { y: H * 0.46, h: 340, speed: -54, warp: 28, tint: [188, 168, 148], a: 0.32, seed: 191 });
    I.plateMist(c, t, { cam: cam, y: H * 0.74, h: 280, a: 0.26, speed: -32, depth: 1.35, seed: 193 });
    I.wind(c, { t: t, n: 12, y0: 140, y1: 760, speed: 460, len: 240, a: 0.22, rgb: [96, 72, 58], seed: 197 });
    ZL.spiritDust(c, t, { n: 46, rgb: [198, 92, 48], dir: 0.22, speed: 52, curl: 1.35, a: 0.48, seed: 199 });
  }

  /* ── P-05 [42.4..53.3]：余慈连眼角都不给，径直踏向承启天 ── */
  function shotP05(c, t) {
    var u = U.smooth((t - 42.4) / 10.9);
    var cam = M.cam(t, [
      [42.4, { x: -18, y: 16, zoom: 1.08 }],
      [53.3, { x: 46, y: -12, zoom: 1.15 }, 'smooth']
    ]);
    I.plateFlow(c, 'p-renjian-sun', t, { cam: cam, amp: 7, scale: 300, speed: 0.13, seed: 211 });

    c.save();
    I.screen(c);
    I.cam(c, I.plateView(cam));
    // 背后左上远空：幽煌大日依旧爆闪挑衅，却渐居画外边缘
    var sx = 485 + 18 * Math.sin(t * 2.1), sy = 190 + 10 * Math.cos(t * 1.8);
    I.sunfire(c, t, { x: sx, y: sy + 48, w: 390, h: 210, n: 9, mix: [0, 0.2, 1], k: 0.85, a: 0.58, speed: 1.25, paleBg: 0.45, seed: 223 });
    ZL.sixPathsWheel(c, t, { x: sx, y: sy, r: 172, timeK: 1.35, a: 0.80, seed: 47 });
    M.inkRing(c, t, 46.6, { x: sx, y: sy, r: 480, flat: 0.65, w: 36, rgb: [182, 62, 34], a: 0.45, life: 1.3, seed: 227 });
    M.inkRing(c, t, 50.3, { x: sx, y: sy, r: 460, flat: 0.65, w: 34, rgb: [196, 124, 48], a: 0.42, life: 1.25, seed: 229 });

    // 右前山道深处：承启天入口清幽紫玉灵韵遥遥接引
    ZL.purpleCanopy(c, t, { x: 1580, y: 210, w: 540, h: 360, k: 0.72, branchK: 0, a: 0.42 + 0.24 * u, seed: 233 });
    I.glow(c, 1560, 490, 210, [136, 198, 204], 0.22 + 0.14 * Math.sin(t * 1.5), 'lighter');
    c.restore();

    // 中景后层薄云
    I.plateMist(c, t, { cam: cam, y: H * 0.64, h: 240, a: 0.18, speed: -24, depth: 1.15, seed: 239 });

    // 主角余慈：背对左上狂日、连眼角都不给，步履沉稳沿山道向右上承启天行去
    var stepBob = -4.5 * Math.abs(Math.sin((t - 42.4) * 2.35));
    rigAt(c, 'sp-yuci-stand-w', t, {
      cam: cam,
      hPx: U.lerp(450, 405, u),
      dx: U.lerp(-150, 215, u),
      footY: U.lerp(895, 795, u) + stepBob,
      script: SC_YUCI_WALK,
      amp: 1.28,
      ground: { a: 0.34, cloud: true, seed: 241 }
    });

    // 前景山风与灵尘掠过衣袂
    I.wind(c, { t: t, n: 10, y0: 260, y1: 860, speed: 420, len: 210, a: 0.18, rgb: [122, 114, 102], seed: 251 });
    ZL.spiritDust(c, t, { n: 42, rgb: [152, 124, 172], dir: -0.35, speed: 32, curl: 1.1, a: 0.42 * u + 0.15, seed: 257 });
    I.plateMist(c, t, { cam: cam, y: H * 0.84, h: 240, a: 0.22, speed: -38, depth: 1.45, seed: 263 });
  }

  /* ── P-06 [53.3..61.4]：外间喧嚣，不过诱饵 → H02@58.5 一步踏破界膜、干墨劈空！ ── */
  function shotP06(c, t) {
    var TH = 58.5;
    var ta = M.hitStop(t, [[TH, 0.10, 0.36]]);
    var st = M.strike(ta, TH, { pre: 1.1, go: 0.18, post: 1.8, wind: 0.16 });
    var cam = M.cam(ta, [
      [53.3, { x: 82, y: -12, zoom: 1.16 }],
      [57.4, { x: 128, y: -22, zoom: 1.22 }, 'smooth'],
      [58.5, { x: 162, y: -28, zoom: 1.28 }, 'expoIn'],
      [61.4, { x: 178, y: -32, zoom: 1.20 }, 'expoOut']
    ]);
    cam = M.kickCam(cam, M.kick(t, TH, { amp: 18, dir: -0.28, f: 6.4, zeta: 0.38, life: 1.35, zAmp: 0.048, seed: 269 }));

    I.plateFlow(c, 'p-renjian-sun', ta, { cam: cam, amp: 6, scale: 280, speed: 0.12, seed: 271 });

    // 承启天虚空界膜：在余慈身前呼吸流转，58.5s 被一步踏破
    c.save();
    I.screen(c);
    I.cam(c, I.plateView(cam));
    var gateX = 1285, gateY = 505;
    var gateRemain = 1 - U.ramp(t, TH, TH + 0.9);
    if (gateRemain > 0.01) {
      I.realm(c, ta, {
        x: gateX, y: gateY, R: 310 * (1 - 0.10 * st.pre), k: 1, chaos: 0.8 + 0.9 * st.pre, a: 0.58 * gateRemain,
        push: [{ t: 57.5, ang: Math.PI, amp: 0.28, dur: 1.2 }], seed: 277
      });
    }
    ZL.purpleCanopy(c, ta, { x: gateX + 60, y: 150, w: 680, h: 430, k: 0.85, branchK: 0, a: 0.52, seed: 281 });
    c.restore();

    // 近景跟拍余慈侧颜淡漠微抬，一步踏入承启天
    var stepFwd = U.smooth((ta - 53.3) / 5.2) * 110 + (t >= TH ? U.easeOut(U.clamp((t - TH) / 1.4, 0, 1)) * 75 : 0);
    var enterFade = 1 - U.ramp(t, TH + 0.55, TH + 1.85);
    if (enterFade > 0.01) {
      rigAt(c, 'sp-yuci-look-1', ta, {
        cam: cam,
        hPx: 620,
        dx: -40 + stepFwd,
        footY: 1015,
        alpha: enterFade,
        script: SC_YUCI_BREACH,
        amp: 1.45,
        ground: false
      });
    }

    ZL.spiritDust(c, ta, { n: 50, rgb: [198, 166, 88], dir: -0.45, speed: 38, curl: 1.2, a: 0.52, seed: 283 });

    // H02@58.5：干墨飞白横贯银幕破空劈开画面！
    if (t >= TH - 0.32) {
      ZL.slashImpact(c, t, TH, { x0: 90, y0: 845, x1: 1835, y1: 215, w: 98, kind: 'gold', dur: 0.16, a: 0.96, seed: 293 });
      I.flyWhite(c, t, { x0: 60, y0: 780, x1: 1860, y1: 260, w: 230, t0: TH + 0.02, dur: 0.22, hold: 1.35, fade: 0.95, kind: 'ink', a: 0.92, seed: 307 });
      I.flyWhite(c, t, { x0: 150, y0: 870, x1: 1790, y1: 195, w: 155, t0: TH + 0.05, dur: 0.24, hold: 1.35, fade: 0.95, kind: 'gold', a: 0.86, seed: 311 });
      M.flashInk(c, t, TH, { x: 1080, y: 480, white: 0.05, ink: 0.08, a: 0.90 });

      // 末段水洗宣纸漫开，无缝托出 P-07 卷首大字
      var washOut = U.smooth((t - 59.8) / 1.55);
      if (washOut > 0.004) {
        c.save();
        I.screen(c);
        c.globalAlpha = washOut * 0.76;
        I.paper(c, 1);
        c.restore();
      }
    }
  }

  /* ── P-07 [61.4..75.0]：卷首立题《斩龙封神 · 碧血开道》，云散滑入第一幕承启天 ── */
  function shotP07(c, t) {
    var u = U.smooth((t - 61.4) / 13.6);
    // 末帧镜头落在 {x: -10, y: 38, zoom: 1.12}，与 act1 1-01 首帧严丝合缝零跳切！
    var cam = M.cam(t, [
      [61.4, { x: 18, y: 58, zoom: 1.05 }],
      [70.0, { x: 2, y: 44, zoom: 1.09 }, 'smooth'],
      [75.0, { x: -10, y: 38, zoom: 1.12 }, 'smooth']
    ]);

    I.plateFlow(c, 'p-chengqi-tree', t, { cam: cam, amp: 5, scale: 340, speed: 0.08, seed: 313 });

    // 柔焦宣纸薄纱：主片名期间温润留白，71.0..75.0s 徐徐散尽直入承启天石坛
    var veilA = 0.62 * (1 - U.smooth((t - 70.6) / 4.2));
    if (veilA > 0.004) {
      c.save();
      I.screen(c);
      c.globalAlpha = veilA;
      I.paper(c, 1);
      c.restore();
    }

    // 淡紫云楼霞气与泥金砂砾缓缓升腾
    var canopyA = U.lerp(0.36, 0.82, U.smooth((t - 69.5) / 5.5));
    ZL.purpleCanopy(c, t, { x: 960, y: 75, w: 1680, h: 520, k: 0.82, branchK: 0, a: canopyA, seed: 11 });
    I.plateMist(c, t, { cam: cam, y: H * 0.76, h: 300, a: 0.28, speed: 14, depth: 1.25, seed: 317 });
    ZL.spiritDust(c, t, { n: 58, rgb: [198, 162, 82], dir: -Math.PI * 0.5, speed: 22, curl: 1.05, a: 0.54, seed: 331 });

    // 主片名 T009 (62.2..67.6) 干墨金石衬势与朱砂闲章
    var titleWin = U.win(t, 62.2, 67.6, 0.35, 0.55);
    if (titleWin > 0.004) {
      I.flyWhite(c, t, { x0: 760, y0: 210, x1: 1240, y1: 780, w: 190, t0: 62.2, dur: 0.45, hold: 4.1, fade: 0.8, kind: 'gold', a: 0.38 * titleWin, seed: 337 });
      M.inkRing(c, t, 62.35, { x: W * 0.53, y: H * 0.46, r: 440, flat: 0.82, w: 34, rgb: [64, 50, 42], a: 0.34, life: 1.6, seed: 347 });
      I.screen(c);
      I.seal(c, '问镜', W * 0.44, H * 0.76, { size: 32, tone: 'zhu', a: 0.88 * U.win(t, 63.1, 67.5, 0.35, 0.45) });
    }

    // 副题 T010 (68.8..74.2)《碧血开道》翡翠泥金淡晕衬托
    var subWin = U.win(t, 68.8, 74.2, 0.4, 0.6);
    if (subWin > 0.004) {
      c.save();
      I.screen(c);
      I.wash(c, W * 0.50, H * 0.43, 112, 245, 0.24 * subWin, 353, [74, 152, 132], -0.04, { edge: 'soft' });
      I.flyWhite(c, t, { x0: 780, y0: 280, x1: 1120, y1: 660, w: 135, t0: 68.8, dur: 0.42, hold: 4.0, fade: 0.8, kind: 'gold', tint: [82, 162, 138], a: 0.34 * subWin, seed: 359 });
      c.restore();
    }

    // 末段与 1-01 远景余慈位置衔接渐显
    var yuciIn = U.smooth((t - 72.2) / 2.8);
    if (yuciIn > 0.01) {
      rigAt(c, 'sp-yuci-stand-w', t, {
        cam: cam,
        hPx: 195,
        dx: -320,
        footY: 815,
        alpha: yuciIn,
        amp: 0.8,
        ground: { a: 0.26 * yuciIn, cloud: true, seed: 367 }
      });
    }

    ZL.chronalVignette(c, t, { mode: 'dream', k: 0.48 * (1 - 0.3 * u), a: 0.68, seed: 373 });
  }

  function draw(c, t) {
    I.paper(c);
    if (t < 10.5) shotP01(c, t);
    else if (t < 20.0) shotP02(c, t);
    else if (t < 30.8) shotP03(c, t);
    else if (t < 42.4) shotP04(c, t);
    else if (t < 53.3) shotP05(c, t);
    else if (t < 61.4) shotP06(c, t);
    else shotP07(c, t);

    I.screen(c);
    I.ledger(c, t, 'prologue', { dark: t < 30.8, pos: LEDGER_POS });
  }

  CINE.registerAct({
    id: 'prologue',
    order: 0,
    name: '序 · 雪崩前夜',
    duration: 75,
    beats: BS.beats,
    cues: CUES,
    plates: PLATES,
    draw: draw
  });
})();
