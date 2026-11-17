/* 《斩龙封神》第一幕 act1 · 紫气入梦（155.0s，G: 75.0 – 230.0，11 镜 1-01..1-11）
   纯 t 确定性演出：承启天灵潮醉灵 → 赵相山、血府老祖起身行礼与虚生醉倒 → 影鬼挥手领命 → 云楼树紫枝探入掌心(H03@87.0/G162.0) → 存神拔升入太霄道境(H04@115.0/G190.0) → 仙鹤白羽虚化与群仙遥礼。 */
(function () {
  'use strict';
  var CINE = window.CINE, I = CINE.ink, U = CINE.util, M = CINE.motion, ZL = CINE.zl;
  var W = CINE.W, H = CINE.H;

  var BS = CINE.beatSheet([
    ['1-01', 0.0, 14.0, '承启云楼灵潮'],
    ['1-02', 14.0, 30.6, '二老行礼醉灵'],
    ['1-03', 30.6, 45.0, '嘱咐影鬼外防'],
    ['1-04', 45.0, 59.5, '树下独立观照'],
    ['1-05', 59.5, 72.0, '紫气璎珞垂盖'],
    ['1-06', 72.0, 83.5, '抬掌迎枝蓄势'],
    ['1-07', 83.5, 95.2, '紫枝探入掌心'],
    ['1-08', 95.2, 111.0, '存神拔升移天'],
    ['1-09', 111.0, 126.0, '太霄道境铺展'],
    ['1-10', 126.0, 141.2, '仙鹤白羽化烟'],
    ['1-11', 141.2, 155.0, '群仙遥礼赴宫']
  ]);

  var CUES = Object.assign({}, BS.cues, {
    branch: { t: 87.0, beat: '1-07', label: '紫枝探掌' },
    daojing: { t: 115.0, beat: '1-09', label: '太霄道境' }
  });

  var PLATES = [
    'p-chengqi-tree', 'cu-tree-palm', 'p-daojing-scroll',
    'sp-yuci-stand-w', 'sp-yuci-look-1', 'sp-yuci-look-2', 'sp-yuci-sit-1', 'sp-yuci-phantom',
    'sp-zhao-xiangshan', 'sp-zhao-set-1', 'sp-zhao-halt',
    'sp-xuefu-1', 'sp-xuefu-2', 'sp-xuefu-4',
    'fx-mist-tex', 'fx-sprout-light', 'fx-ring-brush-oval', 'fx-ring-brush-round',
    'fx-realm-edge', 'fx-flywhite-gold', 'fx-flywhite-ink', 'fx-inksplash-1'
  ].join(' ');

  /* ── 常量骨骼脚本（WeakMap 缓存） ── */
  var SC_CALM_YUCI = {
    root: [{ t: 0, dx: 0, dy: 0, rot: 0 }, { t: 30.6, dx: 12, dy: -2, rot: 0.008, ease: 'inOutSine' }],
    wind: { dirDeg: 18, base: 0.34, gust: [{ t: 5.5, dur: 2.8, amp: 0.7 }, { t: 19.0, dur: 2.4, amp: 0.65 }] },
    breathe: { period: 4.6, amp: 0.9 }
  };

  var SC_ZHAO_SALUTE = {
    root: [
      { t: 14.0, dx: 0, dy: 14, rot: 0 },
      { t: 16.5, dx: -6, dy: 0, rot: -0.02, ease: 'outBack' },
      { t: 18.8, dx: -14, dy: 8, rot: -0.095, ease: 'inOutSine' },
      { t: 22.4, dx: -12, dy: 6, rot: -0.075, ease: 'inOutSine' },
      { t: 25.0, dx: -4, dy: 0, rot: -0.015, ease: 'inOutSine' }
    ],
    wind: { dirDeg: 195, base: 0.28, gust: [{ t: 18.6, dur: 2.2, amp: 0.8 }] },
    breathe: { period: 4.3, amp: 0.85 }
  };

  var SC_XUEFU_SALUTE = {
    root: [
      { t: 14.0, dx: 0, dy: 16, rot: 0 },
      { t: 16.9, dx: 6, dy: 0, rot: 0.02, ease: 'outBack' },
      { t: 19.1, dx: 14, dy: 8, rot: 0.085, ease: 'inOutSine' },
      { t: 22.6, dx: 12, dy: 6, rot: 0.068, ease: 'inOutSine' },
      { t: 25.4, dx: 4, dy: 0, rot: 0.012, ease: 'inOutSine' }
    ],
    wind: { dirDeg: 15, base: 0.26, gust: [{ t: 19.0, dur: 2.0, amp: 0.75 }] },
    breathe: { period: 4.8, amp: 0.8 }
  };

  var SC_XUSHENG_DRUNK = {
    root: [
      { t: 14.0, dx: 0, dy: 12, rot: 0.34 },
      { t: 22.0, dx: 10, dy: 18, rot: 0.39, ease: 'inOutSine' },
      { t: 26.5, dx: -2, dy: 14, rot: 0.33, ease: 'inOutSine' },
      { t: 30.6, dx: 8, dy: 19, rot: 0.40, ease: 'inOutSine' }
    ],
    wind: { dirDeg: 20, base: 0.18 },
    breathe: { period: 3.2, amp: 1.55 }
  };

  var SC_YUCI_TALK = {
    root: [
      { t: 30.6, dx: -8, dy: 0, rot: 0 },
      { t: 34.0, dx: 4, dy: -2, rot: 0.015, ease: 'inOutSine' },
      { t: 41.8, dx: 4, dy: 0, rot: 0.008, ease: 'inOutSine' },
      { t: 45.0, dx: 28, dy: -6, rot: 0.025, ease: 'inOutSine' }
    ],
    wind: { dirDeg: 14, base: 0.36, gust: [{ t: 38.5, dur: 2.2, amp: 0.8 }, { t: 42.6, dur: 2.0, amp: 1.1 }] },
    breathe: { period: 4.4, amp: 0.9 }
  };

  var SC_YUCI_TREE_WALK = {
    root: [
      { t: 45.0, dx: 20, dy: 8, rot: -0.01 },
      { t: 52.5, dx: -16, dy: -4, rot: -0.022, ease: 'inOutSine' },
      { t: 59.5, dx: -34, dy: -8, rot: -0.03, ease: 'inOutSine' }
    ],
    wind: { dirDeg: 196, base: 0.42, gust: [{ t: 53.0, dur: 3.2, amp: 0.95 }] },
    breathe: { period: 4.5, amp: 0.9 }
  };

  var SC_ZHAO_OTS = {
    root: [{ t: 45.0, dx: 0, dy: 0, rot: 0 }, { t: 52.0, dx: 6, dy: 2, rot: 0.015, ease: 'inOutSine' }],
    wind: { dirDeg: 15, base: 0.25 },
    breathe: { period: 4.6, amp: 0.75 }
  };

  var SC_YUCI_REACH = {
    root: [
      { t: 72.0, dx: 18, dy: 8, rot: 0 },
      { t: 77.5, dx: -4, dy: -2, rot: 0.018, ease: 'inOutSine' },
      { t: 83.5, dx: -12, dy: -6, rot: 0.026, ease: 'inOutSine' }
    ],
    wind: { dirDeg: 18, base: 0.38, gust: [{ t: 75.0, dur: 3.0, amp: 0.95 }, { t: 81.2, dur: 2.2, amp: 1.1 }] },
    breathe: { period: 4.2, amp: 0.85 }
  };

  var SC_PHANTOM_RISE = {
    root: [
      { t: 95.2, dx: 0, dy: 24, rot: -0.02, s: 0.94 },
      { t: 103.0, dx: 18, dy: -28, rot: 0.02, s: 1.02, ease: 'inOutSine' },
      { t: 111.0, dx: 36, dy: -68, rot: 0.035, s: 1.06, ease: 'inOutSine' }
    ],
    wind: { dirDeg: 85, base: 0.65, gust: [{ t: 97.5, dur: 3.5, amp: 1.3 }, { t: 104.0, dur: 4.0, amp: 1.5 }] },
    breathe: { period: 3.8, amp: 1.1 }
  };

  var SC_YUCI_GLIDE = {
    root: [
      { t: 141.2, dx: -20, dy: 8, rot: 0.02 },
      { t: 148.0, dx: 16, dy: -10, rot: 0.032, ease: 'inOutSine' },
      { t: 155.0, dx: 52, dy: -24, rot: 0.028, ease: 'inOutSine' }
    ],
    wind: { dirDeg: 8, base: 0.68, gust: [{ t: 143.5, dur: 3.4, amp: 1.25 }, { t: 150.0, dur: 3.8, amp: 1.4 }] },
    breathe: { period: 4.2, amp: 0.95 }
  };

  var PALM_RINGS = I.ringPlan({
    x: 995, y: 555,
    times: [87.0, 87.22, 87.52, 87.90],
    tones: ['gold', 'qing', 'gold', 'qing'],
    r0: 190,
    spread: 48,
    seed: 162
  });

  var LEDGER_POS = {
    T011: { x: W * 0.88, y: H * 0.14, side: 'right' },
    T013: { x: W * 0.88, y: H * 0.13, side: 'right' },
    T022: { x: W * 0.65, y: H * 0.18 },
    T025: { x: W * 0.11, y: H * 0.13, side: 'left' },
    T027: { cols: true, x: W * 0.89, y: H * 0.14, size: 42 }
  };

  /* ── 立绘摆放与接地云洗辅助 ── */
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
      var ga = (g.a == null ? 0.30 : g.a) * (o.alpha == null ? 1 : o.alpha);
      c.save();
      I.screen(c);
      I.cam(c, I.plateView(cam));
      var gx = W * 0.5 + wDx + (g.ox || 0), gy = footY + (g.oy == null ? -8 : g.oy);
      var gw = g.w || hPx * 0.34, gh = g.h || hPx * 0.085;
      I.wash(c, gx, gy, gw, gh, ga, g.seed || 71, g.rgb || [64, 54, 62], 0, { edge: 'soft' });
      if (g.cloud) {
        I.wash(c, gx, gy + 4, gw * 1.45, gh * 1.55, ga * 0.78, (g.seed || 71) + 7, g.cloudRgb || [236, 231, 220], 0, { edge: 'soft' });
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

  /* 垂直升腾的灵芽紫金光束（fx-sprout-light） */
  function drawSproutBeams(c, t, cam, list, a) {
    if (a <= 0.004 || !I.plateHas('fx-sprout-light')) return;
    var T = CINE.FX_META['fx-sprout-light'] || { src: [211, 182, 361, 1207] };
    c.save();
    I.screen(c);
    I.cam(c, I.plateView(cam));
    for (var i = 0; i < list.length; i++) {
      var b = list[i], pulse = 0.65 + 0.35 * Math.sin(t * 1.3 + i * 1.9);
      I.flow(c, 'fx-sprout-light', t, {
        src: T.src,
        dst: [b[0] - b[2] * 0.5, b[1], b[2], b[3]],
        tint: b[4] || [196, 162, 92],
        mode: 'lighter',
        alpha: a * pulse * (b[5] || 1),
        feather: { t: b[3] * 0.24, b: b[3] * 0.24, l: b[2] * 0.22, r: b[2] * 0.22 },
        warp: { amp: 14, scale: 180, speed: 0.16, seed: 41 + i * 7, dir: [0, -0.18] }
      });
    }
    c.restore();
  }

  /* 程序水墨半透明「影鬼」（屈无劫潇洒轮廓 + 墨烟波纹晃动 + 挥手化风远遁） */
  function drawShadowGhost(c, t, cam) {
    var vanishK = U.ramp(t, 42.3, 44.6);
    var baseA = (1 - vanishK) * (0.74 + 0.12 * Math.sin(t * 3.4));
    var waveK = U.win(t, 38.0, 42.4, 0.45, 0.65);
    var pose = I.lerpPose(
      I.pose('stand', { lean: -0.04, armF: [0.28, 0.35], armB: [-0.12, 0.22] }),
      I.pose('beat', { shrug: 0.35, lean: -0.07, armF: [2.05, 0.42] }),
      waveK
    );

    c.save();
    I.screen(c);
    I.cam(c, I.plateView(cam));

    var gx = W * 0.5 + 265 + vanishK * 240 + 7 * Math.sin(t * 2.7);
    var gy = 890 - vanishK * 38;

    // 脚下翻涌墨影涡与随身飘散的幽墨烟带
    I.wash(c, gx, gy - 8, 155, 38, 0.42 * (1 - vanishK), 301, [26, 22, 32], 0, { edge: 'wet' });
    for (var s = 0; s < 4; s++) {
      var sw = 24 * Math.sin(t * (1.8 + s * 0.35) + s * 1.4);
      var h0 = gy - 80 - s * 95;
      var rib = [
        [gx - 24 + sw * 0.3, h0],
        [gx + 38 + sw, h0 - 46],
        [gx + 92 + sw * 1.3 + vanishK * 180, h0 - 84]
      ];
      I.sweep(c, rib, { raw: true, n: 20, w: 26 - s * 4, a: 0.28 * baseA, rgb: [36, 30, 44], dry: 0.48, seed: 310 + s, head: 0.12, tail: 0.65 });
    }

    // 水墨半透明躯影（柔焦墨韵渗边，随灵风半虚半实摇曳，配屈无劫披散长发墨丝）
    if (baseA > 0.01) {
      I.soft(c, function (sc) {
        sc.save();
        I.screen(sc);
        I.cam(sc, I.plateView(cam));
        I.figure(sc, Object.assign({}, pose, {
          x: gx, y: gy, s: 465, face: -1, robe: 'ink', rgb: [28, 24, 34],
          hair: 0.96, sleeve: 1.28, wind: 0.78 + 0.8 * vanishK, windDir: -1,
          a: 0.88 * baseA, t: t, seed: 331
        }));
        var hx = gx + 10, hy = gy - 418;
        for (var h = 0; h < 3; h++) {
          var hw = 18 * Math.sin(t * 2.8 + h);
          I.stroke(sc, [[hx, hy + h * 10], [hx + 46 + hw * 0.5, hy + 28 + h * 16], [hx + 96 + hw + vanishK * 90, hy + 44 + h * 24]], {
            w: 7.5 - h * 1.6, a: 0.72 * baseA, rgb: [28, 24, 34], seed: 335 + h, head: 0.1, tail: 0.75, fb: 0.3
          });
        }
        sc.restore();
      }, { layer: 'shadowGhost', spread: 3.4, halo: 0.55, rim: 0.42, a: 1 });
    }

    // 42.2..44.8s 应诺「去便是了」后化作三缕凌厉墨风破空掠出右缘
    if (vanishK > 0.01 && vanishK < 0.99) {
      var streakA = Math.sin(Math.PI * vanishK);
      for (var k = 0; k < 3; k++) {
        var sy = gy - 150 - k * 85;
        I.flyWhite(c, t, {
          x0: gx - 80, y0: sy + 18, x1: gx + 480, y1: sy - 55, w: 68 - k * 12,
          t0: 42.2 + k * 0.12, dur: 0.32, hold: 0.7, fade: 0.8, kind: 'ink', tint: [38, 32, 48], a: 0.65 * streakA, seed: 340 + k
        });
      }
    }
    c.restore();
  }

  /* ── 1-01 [0.0..14.0]：承启天 · 云楼树，纯灵如潮倒灌 ── */
  function shot101(c, t) {
    var cam = M.cam(t, [
      [0.0, { x: -10, y: 38, zoom: 1.12 }],
      [14.0, { x: 8, y: -25, zoom: 1.03 }, 'smooth']
    ]);
    I.plateFlow(c, 'p-chengqi-tree', t, { cam: cam, amp: 5, scale: 320, speed: 0.09, band: [0.0, 0.68], seed: 101 });

    drawSproutBeams(c, t, cam, [
      [680, 90, 220, 620, [186, 152, 212], 0.55],
      [1040, 60, 260, 680, [212, 178, 96], 0.48],
      [1360, 110, 210, 580, [172, 144, 204], 0.42]
    ], 0.46);

    c.save();
    I.screen(c);
    I.cam(c, I.plateView(cam));
    ZL.purpleCanopy(c, t, { x: 960, y: 72, w: 1680, h: 530, k: 0.86, branchK: 0, a: 0.88, seed: 11 });
    c.restore();

    // 石坛远景余慈驻足观望云楼树
    rigAt(c, 'sp-yuci-stand-w', t, {
      cam: cam, hPx: 205, dx: -320 + t * 2.2, footY: 815,
      script: SC_CALM_YUCI, amp: 0.85, ground: { a: 0.28, cloud: true, seed: 107 }
    });

    // 如潮汐起伏的纯灵雾气与漫天醉灵金紫砂砾
    var tide = 0.5 + 0.5 * Math.sin(t * 0.85);
    I.mistBand(c, t, { y: H * (0.68 - 0.04 * tide), h: 320, speed: 18, warp: 22, tint: [188, 172, 206], a: 0.28 + 0.08 * tide, seed: 109 });
    I.plateMist(c, t, { cam: cam, y: H * 0.80, h: 280, a: 0.26, speed: 14, depth: 1.35, seed: 113 });
    ZL.spiritDust(c, t, { n: 68, rgb: [196, 162, 86], dir: -Math.PI * 0.46, speed: 24, curl: 1.15, a: 0.62, seed: 127 });
    ZL.chronalVignette(c, t, { mode: 'dream', k: 0.42, a: 0.62, seed: 131 });
  }

  /* ── 1-02 [14.0..30.6]：赵相山、血府老祖起身行礼；虚生不胜仙灵醉倒坛边 ── */
  function shot102(c, t) {
    var cam = M.cam(t, [
      [14.0, { x: -42, y: 12, zoom: 1.07 }],
      [22.2, { x: 34, y: 8, zoom: 1.11 }, 'smooth'],
      [30.6, { x: 118, y: 36, zoom: 1.20 }, 'smooth']
    ]);
    I.plateFlow(c, 'p-chengqi-tree', t, { cam: cam, amp: 4, scale: 340, speed: 0.08, band: [0.0, 0.60], seed: 137 });

    c.save();
    I.screen(c);
    I.cam(c, I.plateView(cam));
    ZL.purpleCanopy(c, t, { x: 940, y: 65, w: 1680, h: 460, k: 0.78, branchK: 0, a: 0.66, seed: 11 });
    c.restore();

    // 画左：余慈负手淡然受礼
    rigAt(c, 'sp-yuci-stand-w', t, {
      cam: cam, hPx: 425, dx: -395, footY: 865,
      script: SC_CALM_YUCI, amp: 0.9, ground: { a: 0.32, cloud: true, seed: 139 }
    });

    // 画右前：赵相山自盘坐起身（14.8..16.2s 过渡），肃然拱手施礼「见过天君！」
    var riseK = U.smooth((t - 14.9) / 1.3);
    if (riseK < 0.99) {
      rigAt(c, 'sp-zhao-set-1', t, {
        cam: cam, hPx: 295, dx: 145, footY: 865, alpha: 1 - riseK,
        script: SC_ZHAO_SALUTE, amp: 0.8, ground: { a: 0.28 * (1 - riseK), seed: 149 }
      });
    }
    if (riseK > 0.01) {
      rigAt(c, 'sp-zhao-xiangshan', t, {
        cam: cam, hPx: 420, dx: 145, footY: 865, alpha: riseK,
        script: SC_ZHAO_SALUTE, amp: 1.15, ground: { a: 0.32 * riseK, seed: 151 }
      });
    }

    // 画右中：血府老祖紧随起身行礼
    var riseK2 = U.smooth((t - 15.2) / 1.4);
    if (riseK2 < 0.99) {
      rigAt(c, 'sp-xuefu-1', t, {
        cam: cam, hPx: 285, dx: 335, footY: 842, alpha: 1 - riseK2,
        script: SC_XUEFU_SALUTE, amp: 0.75, ground: { a: 0.26 * (1 - riseK2), rgb: [68, 32, 30], seed: 157 }
      });
    }
    if (riseK2 > 0.01) {
      rigAt(c, 'sp-xuefu-2', t, {
        cam: cam, hPx: 390, dx: 335, footY: 842, flip: 'h', alpha: riseK2,
        script: SC_XUEFU_SALUTE, amp: 1.05, ground: { a: 0.30 * riseK2, rgb: [68, 32, 30], seed: 163 }
      });
    }

    // 画右坛角：老道「虚生」不胜仙灵，酣然醉倒于紫金灵雾酒晕之中
    rigAt(c, 'sp-xuefu-4', t, {
      cam: cam, hPx: 275, dx: 575, footY: 888,
      script: SC_XUSHENG_DRUNK, amp: 1.25, ground: { a: 0.34, cloud: true, cloudRgb: [216, 198, 224], seed: 167 }
    });

    // 虚生周身缭绕的「醉灵」桃紫泥金酒晕泡泡与呼吸灵涡
    c.save();
    I.screen(c);
    I.cam(c, I.plateView(cam));
    var drunkFocus = 0.45 + 0.55 * U.smooth((t - 21.5) / 3.5);
    var xv = W * 0.5 + 575, yv = 775;
    I.wash(c, xv, yv + 42, 145, 58, 0.28 * drunkFocus, 173, [176, 128, 184], 0.08, { edge: 'soft' });
    for (var b = 0; b < 7; b++) {
      var cyc = U.fract(t * (0.24 + 0.05 * (b % 3)) + b * 0.17);
      var bx = xv - 28 + (b - 3) * 18 + 22 * Math.sin(cyc * 5 + b);
      var by = yv + 15 - cyc * 145;
      var ba = drunkFocus * Math.sin(Math.PI * cyc) * 0.52;
      I.wash(c, bx, by, 16 + 14 * cyc, 14 + 12 * cyc, ba, 180 + b, b % 2 ? [196, 146, 198] : [214, 178, 98], 0, { edge: 'soft' });
    }
    ZL.spiritDust(c, t, { box: [xv - 190, yv - 190, 380, 290], n: 34, rgb: [204, 152, 196], dir: -Math.PI * 0.5, speed: 20, curl: 1.5, a: 0.68 * drunkFocus, seed: 191 });
    c.restore();

    I.plateMist(c, t, { cam: cam, y: H * 0.83, h: 250, a: 0.22, speed: 12, depth: 1.35, seed: 197 });
    ZL.spiritDust(c, t, { n: 44, rgb: [194, 162, 88], dir: -Math.PI * 0.48, speed: 20, curl: 1.1, a: 0.45, seed: 199 });
  }

  /* ── 1-03 [30.6..45.0]：余慈嘱咐影鬼看好承启天，影鬼潇洒挥手领命而去 ── */
  function shot103(c, t) {
    var cam = M.cam(t, [
      [30.6, { x: -55, y: 12, zoom: 1.15 }],
      [37.6, { x: -12, y: 8, zoom: 1.18 }, 'smooth'],
      [45.0, { x: -38, y: 2, zoom: 1.21 }, 'smooth']
    ]);
    I.plateFlow(c, 'p-chengqi-tree', t, { cam: cam, amp: 5, scale: 310, speed: 0.09, band: [0.0, 0.62], seed: 211 });

    c.save();
    I.screen(c);
    I.cam(c, I.plateView(cam));
    ZL.purpleCanopy(c, t, { x: 920, y: 60, w: 1640, h: 450, k: 0.80, branchK: 0, a: 0.68, seed: 11 });
    c.restore();

    // 画左：余慈沉静吩咐，末段缓步转身迈向云楼树下
    rigAt(c, 'sp-yuci-look-2', t, {
      cam: cam, hPx: 505, dx: -265, footY: 905,
      script: SC_YUCI_TALK, amp: 1.05, ground: { a: 0.34, cloud: true, seed: 223 }
    });

    // 画右：半虚半实水墨「影鬼」潇洒应诺化烟而去
    drawShadowGhost(c, t, cam);

    I.plateMist(c, t, { cam: cam, y: H * 0.84, h: 240, a: 0.22, speed: -18, depth: 1.4, seed: 227 });
    ZL.spiritDust(c, t, { n: 46, rgb: [182, 152, 202], dir: -Math.PI * 0.5, speed: 22, curl: 1.15, a: 0.48, seed: 229 });
  }

  /* ── 1-04 [45.0..59.5]：过肩移焦——赵相山感叹定力 → 移焦云楼树下独立仰望的余慈 ── */
  function shot104(c, t) {
    var rackK = U.smooth((t - 51.4) / 2.6); // 0 前景实焦 → 1 移焦至中远景树下余慈
    var cam = M.cam(t, [
      [45.0, { x: 42, y: 12, zoom: 1.08 }],
      [51.8, { x: 20, y: 4, zoom: 1.11 }, 'smooth'],
      [59.5, { x: -58, y: -22, zoom: 1.19 }, 'smooth']
    ]);
    I.plateFlow(c, 'p-chengqi-tree', t, { cam: cam, amp: 5, scale: 320, speed: 0.09, band: [0.0, 0.65], seed: 233 });

    drawSproutBeams(c, t, cam, [
      [690, 80, 240, 650, [192, 156, 218], 0.45 + 0.35 * rackK],
      [920, 60, 220, 620, [214, 178, 94], 0.35 + 0.35 * rackK]
    ], 0.52);

    c.save();
    I.screen(c);
    I.cam(c, I.plateView(cam));
    ZL.purpleCanopy(c, t, { x: 900, y: 65, w: 1680, h: 520, k: 0.92, branchK: 0, a: 0.72 + 0.20 * rackK, seed: 11 });
    c.restore();

    // 中远景云楼树下：余慈缓步至树心独立仰首
    var uWalk = U.smooth((t - 45.0) / 14.5);
    rigAt(c, 'sp-yuci-stand-w', t, {
      cam: cam,
      hPx: 305,
      dx: U.lerp(-95, -215, uWalk),
      footY: U.lerp(825, 795, uWalk),
      flip: 'h',
      script: SC_YUCI_TREE_WALK,
      amp: 1.05,
      ground: { a: 0.30, cloud: true, seed: 239 }
    });

    I.plateMist(c, t, { cam: cam, y: H * 0.76, h: 250, a: 0.22, speed: 15, depth: 1.25, seed: 241 });

    // 前景右侧过肩侧影：赵相山与血府老祖（52.0s 起随移焦柔化退向画右边缘）
    var fgSlide = rackK * 115;
    var fgAlpha = 1 - 0.38 * rackK;
    var drawFgElders = function (dc) {
      rigAt(dc, 'sp-xuefu-2', t, {
        cam: cam, hPx: 520, dx: 615 + fgSlide * 1.15, footY: 985, flip: 'h',
        alpha: fgAlpha * 0.88, script: SC_ZHAO_OTS, amp: 0.7, ground: false
      });
      rigAt(dc, 'sp-zhao-halt', t, {
        cam: cam, hPx: 590, dx: 445 + fgSlide, footY: 1005, flip: 'h',
        alpha: fgAlpha, script: SC_ZHAO_OTS, amp: 0.8, ground: false
      });
    };
    if (rackK > 0.15) {
      I.soft(c, drawFgElders, { layer: 'otsElders', spread: 2.0 + Math.round(rackK * 12) / 5, halo: 0.45 * rackK, rim: 0.18, a: 1 });
    } else {
      drawFgElders(c);
    }

    ZL.spiritDust(c, t, { n: 52, rgb: [198, 166, 88], dir: -Math.PI * 0.5, speed: 24, curl: 1.15, a: 0.52, seed: 251 });
  }

  /* ── 1-05 [59.5..72.0]：仰视云楼华盖——紫气璎珞垂落，金篆真文流转 ── */
  function shot105(c, t) {
    var u = (t - 59.5) / 12.5;
    var cam = M.cam(t, [
      [59.5, { x: -34, y: -28, zoom: 1.09 }],
      [72.0, { x: 18, y: -74, zoom: 1.21 }, 'smooth']
    ]);
    I.plateFlow(c, 'p-chengqi-tree', t, { cam: cam, amp: 7, scale: 290, speed: 0.11, band: [0.0, 0.82], seed: 257 });

    drawSproutBeams(c, t, cam, [
      [580, 40, 280, 740, [186, 148, 216], 0.65],
      [960, 20, 320, 780, [218, 182, 98], 0.72],
      [1340, 50, 260, 700, [176, 142, 208], 0.58]
    ], 0.58);

    c.save();
    I.screen(c);
    I.cam(c, I.plateView(cam));
    c.translate(W * 0.5, H * 0.45);
    c.rotate(-0.018 + 0.036 * U.smooth(u));
    c.translate(-W * 0.5, -H * 0.45);
    ZL.purpleCanopy(c, t, {
      x: 960, y: 52, w: 1840, h: 660,
      k: 1.0, branchK: U.ramp(t, 66.2, 72.0) * 0.16, palm: [1040, 650],
      a: 0.96, seed: 11
    });
    c.restore();

    I.mistBand(c, t, { y: H * 0.62, h: 340, speed: 16, warp: 26, tint: [182, 162, 204], a: 0.28, seed: 263 });
    ZL.spiritDust(c, t, { n: 78, rgb: [212, 176, 92], dir: -Math.PI * 0.44, speed: 26, curl: 1.25, a: 0.68, seed: 269 });
    ZL.chronalVignette(c, t, { mode: 'dream', k: 0.56, a: 0.72, seed: 271 });
  }

  /* ── 1-06 [72.0..83.5]：紫气拂袖，余慈缓抬手掌，苍木古枝距掌心寸许微颤蓄势 ── */
  function shot106(c, t) {
    var u = U.smooth((t - 72.0) / 11.5);
    var cam = M.cam(t, [
      [72.0, { x: -42, y: -6, zoom: 1.14 }],
      [83.5, { x: 8, y: -18, zoom: 1.22 }, 'smooth']
    ]);
    I.plateFlow(c, 'p-chengqi-tree', t, { cam: cam, amp: 5, scale: 300, speed: 0.10, band: [0.0, 0.72], seed: 277 });

    // 余慈居画右朝左迎枝（选用干净无杂线的 sp-yuci-look-1 翻转，与下一镜 1-07 cu-tree-palm 右臂入画、左上探枝完成 100% 视线顺接）
    rigAt(c, 'sp-yuci-look-1', t, {
      cam: cam, hPx: 605, dx: 210, footY: 1000, flip: 'h',
      script: SC_YUCI_REACH, amp: 1.22, ground: false
    });

    c.save();
    I.screen(c);
    I.cam(c, I.plateView(cam));
    var bK = U.lerp(0.16, 0.56, u) + 0.015 * Math.sin(t * 6.5) * u;
    ZL.purpleCanopy(c, t, {
      x: 780, y: 48, w: 1560, h: 540,
      k: 1.0, branchK: bK, palm: [965, 575],
      a: 0.94, seed: 11
    });
    // 掌心前寸许欲触未触的紫金气感共鸣
    I.glow(c, 965, 575, 85 + 35 * u, [206, 168, 108], 0.18 + 0.24 * u * (0.75 + 0.25 * Math.sin(t * 3.8)), 'lighter');
    c.restore();

    I.plateMist(c, t, { cam: cam, y: H * 0.84, h: 250, a: 0.24, speed: 14, depth: 1.35, seed: 281 });
    ZL.spiritDust(c, t, { n: 58, rgb: [204, 168, 92], dir: -0.6, speed: 25, curl: 1.2, a: 0.58, seed: 283 });
    ZL.chronalVignette(c, t, { mode: 'dream', k: 0.48, a: 0.66, seed: 293 });
  }

  /* ── 1-07 [83.5..95.2]：特写 cu-tree-palm → H03@87.0(G162.0) 苍枝触掌、一念通霄！ ── */
  function shot107(c, t) {
    var TH = 87.0;
    var ta = M.hitStop(t, [[TH, 0.06, 0.28]]);
    var cam = M.cam(ta, [
      [83.5, { x: -18, y: -10, zoom: 1.04 }],
      [86.8, { x: 8, y: 6, zoom: 1.11 }, 'smooth'],
      [87.0, { x: 14, y: 10, zoom: 1.15 }, 'expoIn'],
      [95.2, { x: 24, y: 4, zoom: 1.19 }, 'smooth']
    ]);
    cam = M.kickCam(cam, M.kick(t, TH, { amp: 10, f: 5.0, zeta: 0.42, life: 1.25, zAmp: 0.032, seed: 307 }));

    I.plateFlow(c, 'cu-tree-palm', ta, { cam: cam, amp: 4, scale: 280, speed: 0.09, seed: 311 });

    c.save();
    I.screen(c);
    I.cam(c, I.plateView(cam));

    // 水墨苍枝沿左上古枝蜿蜒探入掌心 [995, 555]
    var bK = t < TH ? U.lerp(0.56, 1.0, M.expoIn((ta - 83.5) / 3.5, 3.5)) : 1.0;
    ZL.purpleCanopy(c, ta, {
      x: 640, y: 42, w: 1260, h: 490,
      k: 0.92, branchK: bK, palm: [995, 555],
      a: 0.92, seed: 11
    });

    // H03@87.0：苍枝触掌，飞白金紫气环层层荡开，清光灵丝沿手腕漫入经脉！
    if (t >= TH) {
      var postK = U.clamp((t - TH) / 4.2, 0, 1);
      I.rings(c, t, PALM_RINGS, { paleBg: 0.85 });
      M.inkRing(c, t, TH, { x: 995, y: 555, r: 580, flat: 0.64, w: 44, rgb: [132, 92, 162], a: 0.62, life: 1.35, seed: 313 });
      M.inkRing(c, t, TH + 0.12, { x: 995, y: 555, r: 440, flat: 0.68, w: 32, rgb: [204, 166, 78], a: 0.58, life: 1.45, seed: 317 });
      I.spineLight(c, t, {
        x0: 995, y0: 555, x1: 1560, y1: 665, u: 0.25 + 0.55 * U.easeOut(postK),
        sprout: U.clamp((t - TH) / 1.8, 0, 1), len: 135, n: 4, paleBg: 0.75, a: 0.88, seed: 331
      });
    }
    c.restore();

    if (t >= TH && t < TH + 0.65) {
      I.flash(c, 0.46 * Math.exp(-(t - TH) / 0.14), { x: 995, y: 555, rgb: [250, 242, 218], paleBg: 0.85 });
    }

    ZL.spiritDust(c, t, { n: 64, rgb: t < TH ? [184, 148, 206] : [214, 178, 92], dir: -Math.PI * 0.5, speed: t < TH ? 24 : 46, curl: 1.3, a: 0.66, seed: 337 });

    // 93.8..95.2s 紫白云气上涌衔接 1-08 拔升
    var liftVeil = U.smooth((t - 93.6) / 1.6);
    if (liftVeil > 0.01) {
      I.mistBand(c, t, { y: H * (0.85 - 0.55 * liftVeil), h: 520, speed: 32, warp: 30, tint: [224, 214, 232], a: 0.58 * liftVeil, seed: 347 });
    }
    ZL.chronalVignette(c, t, { mode: 'dream', k: 0.54, a: 0.70, seed: 349 });
  }

  /* ── 1-08 [95.2..111.0]：身留承启石坛，一缕存神穿越重重云障直入太霄 ── */
  function shot108(c, t) {
    var u = U.clamp((t - 95.2) / 15.8, 0, 1);
    var cam = M.cam(t, [
      [95.2, { x: 0, y: 62, zoom: 1.10 }],
      [103.0, { x: 0, y: -15, zoom: 1.17 }, 'smooth'],
      [111.0, { x: 0, y: -82, zoom: 1.24 }, 'smooth']
    ]);

    // 底层承启天石坛 → 100.2..106.5s 随拔升墨洇溶换为太霄云海
    I.plateFlow(c, 'p-chengqi-tree', t, { cam: cam, amp: 6, scale: 320, speed: 0.12, seed: 353 });
    if (t >= 99.8) {
      M.reveal(c, t, 99.8, 6.2, function (rc) {
        I.plateFlow(rc, 'p-daojing-scroll', t, { cam: { x: -20, y: 65 - 80 * u, zoom: 1.26 }, amp: 7, scale: 300, speed: 0.14, seed: 359 });
      }, { from: [960, 220], rim: 0.20, rimRgb: [126, 168, 164], seed: 367 });
    }

    // 石坛盘坐本尊随镜头拔升缓缓下沉并化作淡墨留影
    var bodyFade = 1 - U.smooth((t - 96.5) / 6.8);
    if (bodyFade > 0.01) {
      rigAt(c, 'sp-yuci-sit-1', t, {
        cam: cam,
        hPx: 320,
        dx: -115,
        footY: 855 + (t - 95.2) * 44,
        alpha: bodyFade * 0.92,
        amp: 0.65,
        ground: { a: 0.30 * bodyFade, cloud: true, seed: 373 }
      });
    }

    // 三重紫白云障自上而下疾掠而过（营造强烈垂直拔升速度感）
    for (var l = 0; l < 3; l++) {
      var cyc = U.fract((t - 95.2) * (0.22 + l * 0.07) + l * 0.33);
      var cy = -240 + cyc * (H + 480);
      var ca = Math.sin(Math.PI * cyc) * (0.34 + l * 0.08);
      I.mistBand(c, t, {
        y: cy - 160, h: 320, speed: (l % 2 ? -34 : 34), warp: 28,
        tint: l === 0 ? [196, 182, 214] : [236, 232, 222], a: ca, seed: 380 + l * 7
      });
    }

    // 清透存神虚影破云而上，周身金青道环护持
    var phIn = U.smooth((t - 95.6) / 2.2);
    var phY = U.lerp(810, 560, U.easeOut(u));
    c.save();
    I.screen(c);
    I.cam(c, I.plateView(cam));
    I.glow(c, W * 0.5 - 35 + 55 * u, phY - 190, 210, [132, 206, 202], 0.28 * phIn, 'lighter');
    c.restore();

    rigAt(c, 'sp-yuci-phantom', t, {
      cam: cam,
      hPx: 410,
      dx: U.lerp(-75, 25, u),
      footY: phY,
      alpha: 0.86 * phIn,
      script: SC_PHANTOM_RISE,
      amp: 1.35,
      ground: { a: 0.28 * phIn, cloud: true, cloudRgb: [212, 234, 230], seed: 397 }
    });

    // 102.1..103.6s（恰好处于 T023 退场 102.0 与 T024 入场 103.8 之间的空窗！）一抹水洗空间移换气韵
    if (t > 102.08 && t < 103.68) {
      I.inkBleed(c, (t - 102.08) / 1.60, { mode: 'wash', a: 0.52, seed: 401 });
    }

    I.wind(c, { t: t, n: 12, dir: Math.PI * 0.5, y0: 0, y1: H, speed: 520, len: 230, a: 0.18, rgb: [168, 196, 194], seed: 409 });
    ZL.spiritDust(c, t, { n: 70, rgb: [164, 218, 212], dir: Math.PI * 0.5, speed: 68, curl: 1.1, a: 0.64, seed: 419 });
    ZL.chronalVignette(c, t, { mode: 'dream', k: 0.46, a: 0.64, seed: 421 });
  }

  /* ── 1-09 [111.0..126.0]：紫白云帷蓄势分卷 → H04@115.0(G190.0) 太霄道境青绿万重豁然铺开！ ── */
  function shot109(c, t) {
    var TH = 115.0;
    var cam = M.cam(t, [
      [111.0, { x: -62, y: 24, zoom: 1.22 }],
      [115.0, { x: -46, y: -8, zoom: 1.17 }, 'expoIn'],
      [126.0, { x: 36, y: 4, zoom: 1.02 }, 'expoOut']
    ]);
    cam = M.kickCam(cam, M.kick(t, TH, { amp: 8, f: 4.2, zeta: 0.48, life: 1.5, zAmp: 0.028, seed: 431 }));

    I.plateFlow(c, 'p-daojing-scroll', t, { cam: cam, amp: 5, scale: 340, speed: 0.09, band: [0.35, 1.0], seed: 433 });

    // H04@115.0：泥金霞光掠过千里青绿峰峦，双鹤振翅穿峰！
    if (t >= TH - 0.4) {
      c.save();
      I.screen(c);
      I.cam(c, I.plateView(cam));
      I.flyWhite(c, t, { x0: 120, y0: 420, x1: 1820, y1: 260, w: 180, t0: TH, dur: 0.85, hold: 3.2, fade: 1.8, kind: 'gold', a: 0.48, seed: 439 });
      ZL.craneFlight(c, t, { t0: 114.6, dur: 10.6, x0: 150, y0: 690, x1: 1760, y1: 225, s: 0.94, feathers: 7, a: 0.96, seed: 17 });
      ZL.craneFlight(c, t, { t0: 115.3, dur: 10.2, x0: 60, y0: 585, x1: 1620, y1: 175, s: 0.54, feathers: 4, a: 0.68, seed: 29 });
      c.restore();
    }

    // 111.0..117.5s 左右厚重紫白水墨云帷蓄势向两侧豁然拉开
    var partK = t < TH ? 0.08 * U.smooth((t - 111.0) / 4.0) : 0.08 + 0.92 * M.expoOut(U.clamp((t - TH) / 2.8, 0, 1), 4.5);
    if (partK < 0.995) {
      var curtainA = 1 - U.smooth((partK - 0.65) / 0.35);
      var shift = partK * (W * 0.66);
      c.save();
      I.screen(c);
      for (var row = 0; row < 4; row++) {
        var ry = 130 + row * 255 + 16 * Math.sin(t * 0.9 + row);
        I.cloud(c, W * 0.28 - shift - row * 35, ry, 880, 440 + row, { a: 0.92 * curtainA, rgb: [242, 238, 228], shade: 0.24, line: 0.22 });
        I.cloud(c, W * 0.72 + shift + row * 35, ry + 24, 880, 460 + row, { a: 0.92 * curtainA, rgb: [242, 238, 228], shade: 0.24, line: 0.22 });
      }
      c.restore();
    }

    if (t >= TH && t < TH + 0.75) {
      I.flash(c, 0.36 * Math.exp(-(t - TH) / 0.18), { x: 960, y: 420, rgb: [252, 246, 224], paleBg: 0.55 });
    }

    I.plateMist(c, t, { cam: cam, y: H * 0.78, h: 270, a: 0.24, rgb: [242, 238, 226], speed: -16, depth: 1.3, seed: 443 });
    ZL.spiritDust(c, t, { n: 56, rgb: [212, 180, 96], dir: -0.25, speed: 24, curl: 1.0, a: 0.52, seed: 449 });
    ZL.chronalVignette(c, t, { mode: 'dream', k: 0.36, a: 0.55, seed: 457 });
  }

  /* ── 1-10 [126.0..141.2]：仙鹤振翅，飘落白羽随风旋舞、逐片虚化无影（此间万象，皆为存神） ── */
  function shot110(c, t) {
    var cam = M.cam(t, [
      [126.0, { x: -64, y: 20, zoom: 1.18 }],
      [141.2, { x: 54, y: -22, zoom: 1.24 }, 'smooth']
    ]);
    I.plateFlow(c, 'p-daojing-scroll', t, { cam: cam, amp: 5, scale: 310, speed: 0.09, band: [0.30, 1.0], seed: 461 });

    // 主视觉：近景仙鹤舒翼掠过界画仙阁，飘落十一片白羽逐片化烟
    c.save();
    I.screen(c);
    I.cam(c, I.plateView(cam));
    ZL.craneFlight(c, t, { t0: 126.1, dur: 13.4, x0: 150, y0: 635, x1: 1680, y1: 245, s: 1.32, feathers: 11, a: 0.98, seed: 41 });
    c.restore();

    // 前景特写级三片灵羽：缓缓旋落画心并在目光注视下化为青白水烟消散无踪
    c.save();
    I.screen(c);
    for (var f = 0; f < 3; f++) {
      var ft0 = 127.4 + f * 3.1, flife = 4.6;
      var fa = (t - ft0) / flife;
      if (fa <= 0 || fa >= 1) continue;
      var fx = 520 + f * 340 + 68 * Math.sin(fa * 4.4 + f * 1.7) + fa * 95;
      var fy = 310 + f * 45 + fa * 265;
      var rot = 0.48 * Math.sin(fa * 5.2 + f);
      var solidA = U.clamp(fa / 0.14, 0, 1) * Math.pow(1 - fa, 1.65);
      var smokeA = Math.sin(Math.PI * fa) * 0.48;

      if (smokeA > 0.01) {
        I.wash(c, fx, fy, 48 + 54 * fa, 20 + 28 * fa, smokeA, 470 + f, [196, 224, 218], rot, { edge: 'soft' });
        I.wash(c, fx + 18 * fa, fy - 12 * fa, 34 + 42 * fa, 14 + 20 * fa, smokeA * 0.65, 480 + f, [238, 236, 226], rot + 0.2, { edge: 'soft' });
      }
      if (solidA > 0.01) {
        var fPts = [
          [fx - Math.cos(rot) * 38, fy - Math.sin(rot) * 38],
          [fx, fy + 5],
          [fx + Math.cos(rot) * 42, fy + Math.sin(rot) * 42]
        ];
        I.sweep(c, fPts, { raw: true, n: 18, w: 18 * (1 + 0.15 * fa), a: 0.88 * solidA, rgb: [248, 246, 238], dry: 0.35 + 0.45 * fa, seed: 490 + f, head: 0.18, tail: 0.22 });
        I.stroke(c, fPts, { raw: true, n: 18, w: 2.2, a: 0.65 * solidA, rgb: [164, 156, 142], seed: 500 + f, head: 0.12, tail: 0.18, bleed: 0 });
      }
    }
    c.restore();

    I.plateMist(c, t, { cam: cam, y: H * 0.80, h: 260, a: 0.24, rgb: [240, 236, 224], speed: -20, depth: 1.38, seed: 503 });
    ZL.spiritDust(c, t, { n: 50, rgb: [186, 220, 214], dir: -0.18, speed: 22, curl: 1.2, a: 0.48, seed: 509 });
    ZL.chronalVignette(c, t, { mode: 'dream', k: 0.44, a: 0.62, seed: 521 });
  }

  /* ── 1-11 [141.2..155.0]：云间群仙折腰遥礼，余慈乘风直赴中央道宫 ── */
  function shot111(c, t) {
    var u = U.smooth((t - 141.2) / 13.8);
    var cam = M.cam(t, [
      [141.2, { x: -32, y: 14, zoom: 1.07 }],
      [155.0, { x: 40, y: -32, zoom: 1.18 }, 'smooth']
    ]);
    I.plateFlow(c, 'p-daojing-scroll', t, { cam: cam, amp: 5, scale: 330, speed: 0.09, band: [0.32, 1.0], seed: 523 });

    // 远近峰峦云台之上：点点仙人水墨剪影纷纷面向余慈折腰遥礼
    c.save();
    I.screen(c);
    I.cam(c, I.plateView(cam));
    var immortals = [
      [560, 565, 86, 1, 142.4],
      [635, 578, 78, 1, 142.9],
      [1295, 535, 84, -1, 143.3],
      [1370, 552, 92, -1, 143.7],
      [1455, 580, 82, -1, 144.1]
    ];
    for (var i = 0; i < immortals.length; i++) {
      var im = immortals[i];
      var bowAmt = U.smooth((t - im[4]) / 1.6);
      var ip = I.lerpPose(I.pose('stand'), I.pose('salute', { bow: 0.48 }), bowAmt);
      I.wash(c, im[0], im[1] + 4, im[2] * 0.75, 16, 0.36, 530 + i, [236, 232, 220], 0, { edge: 'soft' });
      I.figure(c, Object.assign({}, ip, {
        x: im[0], y: im[1], s: im[2], face: im[3], robe: 'grey',
        rgb: [58, 74, 72], wind: 0.38, a: 0.72, t: t, seed: 540 + i
      }));
    }
    ZL.craneFlight(c, t, { t0: 141.8, dur: 11.5, x0: 320, y0: 460, x1: 1520, y1: 185, s: 0.56, feathers: 4, a: 0.72, seed: 557 });
    c.restore();

    // 余慈乘青白云气掠过层叠仙阁，直趋远方巍峨中央道宫
    var yx = U.lerp(-250, 75, u), yy = U.lerp(815, 695, u);
    c.save();
    I.screen(c);
    I.cam(c, I.plateView(cam));
    I.cloud(c, W * 0.5 + yx - 15, yy - 12, 340, 563, { a: 0.78, rgb: [244, 241, 232], shade: 0.20, line: 0.20 });
    I.flyWhite(c, t, {
      x0: W * 0.5 + yx - 280, y0: yy + 18, x1: W * 0.5 + yx + 60, y1: yy - 8, w: 68,
      t0: 141.4, dur: 0.8, hold: 11.5, fade: 1.2, kind: 'gold', a: 0.36, seed: 569
    });
    c.restore();

    rigAt(c, 'sp-yuci-stand-w', t, {
      cam: cam, hPx: U.lerp(365, 285, u), dx: yx, footY: yy,
      script: SC_YUCI_GLIDE, amp: 1.22, ground: { a: 0.32, cloud: true, seed: 571 }
    });

    I.plateMist(c, t, { cam: cam, y: H * 0.80, h: 270, a: 0.26, rgb: [242, 238, 226], speed: -28, depth: 1.4, seed: 577 });
    ZL.spiritDust(c, t, { n: 54, rgb: [212, 180, 96], dir: -0.32, speed: 34, curl: 1.1, a: 0.52, seed: 587 });

    // 151.8..155.0s（T028 早已于 148.8s 退场）：仙云漫镜无缝滑入第二幕 2-01 分流云霭！
    var cloudBridge = U.smooth((t - 151.8) / 3.2);
    if (cloudBridge > 0.01) {
      c.save();
      I.screen(c);
      I.cloud(c, W * 0.25, H * 0.54, 1080, 593, { a: 0.84 * cloudBridge, rgb: [244, 240, 230], shade: 0.20, line: 0.22 });
      I.cloud(c, W * 0.76, H * 0.50, 1080, 599, { a: 0.84 * cloudBridge, rgb: [244, 240, 230], shade: 0.20, line: 0.22 });
      c.restore();
    }
    ZL.chronalVignette(c, t, { mode: 'dream', k: 0.38, a: 0.55, seed: 601 });
  }

  function draw(c, t) {
    I.paper(c);
    if (t < 14.0) shot101(c, t);
    else if (t < 30.6) shot102(c, t);
    else if (t < 45.0) shot103(c, t);
    else if (t < 59.5) shot104(c, t);
    else if (t < 72.0) shot105(c, t);
    else if (t < 83.5) shot106(c, t);
    else if (t < 95.2) shot107(c, t);
    else if (t < 111.0) shot108(c, t);
    else if (t < 126.0) shot109(c, t);
    else if (t < 141.2) shot110(c, t);
    else shot111(c, t);

    I.screen(c);
    I.ledger(c, t, 'act1', { dark: false, pos: LEDGER_POS });
  }

  CINE.registerAct({
    id: 'act1',
    order: 1,
    name: '一 · 紫气入梦',
    duration: 155,
    beats: BS.beats,
    cues: CUES,
    plates: PLATES,
    draw: draw
  });
})();
