/* 《斩龙封神》第二幕 act2 · 太霄受诏（190.0s，G: 230.0 – 420.0，13 镜 2-01..2-13）
   纯 t 确定性演出：穿云赴中央道宫 → 巫门三女调理气脉 → 薛平治带血怔望三十六天(xue@44.0/G274.0)与余慈长揖致谢 → 中庭赤金符诏垂落(H05/edict@118.0/G348.0) → 青衣白鹤童子引路 → 白虎玉舆与掌刑神将奉诏出巡(H06/chariot@164.0/G394.0) → 挥别平治穿云下坠。 */
(function () {
  'use strict';
  var CINE = window.CINE, I = CINE.ink, U = CINE.util, M = CINE.motion, ZL = CINE.zl;
  var W = CINE.W, H = CINE.H;

  var BS = CINE.beatSheet([
    ['2-01', 0.0, 14.0, '分云赴中央宫'],
    ['2-02', 14.0, 29.0, '巫门三女调脉'],
    ['2-03', 29.0, 44.0, '中央道宫门楼'],
    ['2-04', 44.0, 58.0, '偶遇平治元君'],
    ['2-05', 58.0, 74.0, '三十六天清叹'],
    ['2-06', 74.0, 88.2, '余慈长揖致谢'],
    ['2-07', 88.2, 102.0, '目送孤身入宫'],
    ['2-08', 102.0, 115.0, '中庭符诏自天'],
    ['2-09', 115.0, 129.0, '双掌承接赤诏'],
    ['2-10', 129.0, 144.2, '执诏洞察真核'],
    ['2-11', 144.2, 159.0, '白鹤童子引路'],
    ['2-12', 159.0, 176.0, '白虎玉舆神将'],
    ['2-13', 176.0, 190.0, '挥别穿云坠渊']
  ]);

  var CUES = Object.assign({}, BS.cues, {
    xue: { t: 44.0, beat: '2-04', label: '平治元君' },
    edict: { t: 118.0, beat: '2-09', label: '赤金符诏' },
    chariot: { t: 164.0, beat: '2-12', label: '虎辇乘风' }
  });

  var PLATES = [
    'p-daojing-scroll', 'p-daogong-gate', 'p-daogong-courtyard', 'cu-talisman-hand',
    'sp-yuci-phantom', 'sp-yuci-stand-w', 'sp-yuci-bow', 'sp-yuci-look-1', 'sp-yuci-look-2', 'sp-yuci-pose-set-2',
    'sp-shaman-trio', 'sp-xue-pingzhi', 'sp-crane-boy', 'sp-tiger-carriage',
    'sp-punish-gen-1', 'sp-punish-gen-2',
    'fx-mist-tex', 'fx-flywhite-gold', 'fx-flywhite-ink',
    'fx-ring-brush-oval', 'fx-ring-brush-round', 'fx-sprout-light', 'fx-inksplash-1'
  ].join(' ');

  /* ── 常量骨骼脚本（WeakMap 缓存复用） ── */
  var SC_PHANTOM_ENTER = {
    root: [
      { t: 0.0, dx: -24, dy: 12, rot: 0.015 },
      { t: 7.0, dx: 8, dy: -8, rot: 0.025, ease: 'inOutSine' },
      { t: 14.0, dx: 36, dy: -22, rot: 0.018, ease: 'inOutSine' }
    ],
    wind: { dirDeg: 10, base: 0.58, gust: [{ t: 2.0, dur: 3.5, amp: 1.2 }, { t: 9.0, dur: 3.2, amp: 1.1 }] },
    breathe: { period: 4.0, amp: 1.0 }
  };

  var SC_SHAMAN_QI = {
    root: [
      { t: 14.0, dx: 0, dy: 0, rot: -0.01 },
      { t: 21.5, dx: 6, dy: -10, rot: 0.015, ease: 'inOutSine' },
      { t: 29.0, dx: -2, dy: 2, rot: -0.008, ease: 'inOutSine' }
    ],
    wind: { dirDeg: 28, base: 0.52, gust: [{ t: 16.5, dur: 3.6, amp: 1.15 }, { t: 23.0, dur: 3.8, amp: 1.25 }] },
    breathe: { period: 3.9, amp: 1.15 }
  };

  var SC_XUE_GAZE = {
    root: [
      { t: 44.0, dx: 0, dy: 0, rot: 0 },
      { t: 51.0, dx: 4, dy: -3, rot: -0.012, ease: 'inOutSine' },
      { t: 65.0, dx: -2, dy: 0, rot: 0.008, ease: 'inOutSine' },
      { t: 74.0, dx: 2, dy: -2, rot: -0.006, ease: 'inOutSine' }
    ],
    wind: { dirDeg: 18, base: 0.38, gust: [{ t: 46.5, dur: 2.8, amp: 0.85 }, { t: 60.0, dur: 3.4, amp: 0.92 }, { t: 68.5, dur: 3.0, amp: 0.80 }] },
    breathe: { period: 4.4, amp: 0.95 }
  };

  var SC_YUCI_ALIGHT = {
    root: [
      { t: 45.2, dx: -60, dy: -34, rot: 0.03 },
      { t: 48.8, dx: 0, dy: 0, rot: 0, ease: 'outBack' },
      { t: 58.0, dx: 8, dy: 0, rot: 0.006, ease: 'inOutSine' }
    ],
    wind: { dirDeg: 15, base: 0.36, gust: [{ t: 47.8, dur: 2.0, amp: 1.1 }] },
    breathe: { period: 4.5, amp: 0.85 }
  };

  var SC_YUCI_DEEPBOW = {
    root: [
      { t: 74.0, dx: 0, dy: 0, rot: 0 },
      { t: 75.4, dx: 18, dy: 10, rot: 0.082, ease: 'inOutSine' },
      { t: 79.4, dx: 16, dy: 9, rot: 0.076, ease: 'inOutSine' },
      { t: 81.0, dx: 0, dy: 0, rot: 0, ease: 'inOutSine' },
      { t: 88.2, dx: 4, dy: -2, rot: 0.008, ease: 'inOutSine' }
    ],
    wind: { dirDeg: 16, base: 0.30, gust: [{ t: 75.2, dur: 2.4, amp: 0.85 }] },
    breathe: { period: 4.4, amp: 0.85 }
  };

  var SC_XUE_RETURN_BOW = {
    root: [
      { t: 74.0, dx: 0, dy: 0, rot: 0 },
      { t: 81.2, dx: 8, dy: 4, rot: 0.042, ease: 'inOutSine' },
      { t: 85.4, dx: 6, dy: 3, rot: 0.032, ease: 'inOutSine' },
      { t: 88.2, dx: 0, dy: 0, rot: 0.006, ease: 'inOutSine' }
    ],
    wind: { dirDeg: 196, base: 0.34, gust: [{ t: 81.5, dur: 2.6, amp: 0.85 }] },
    breathe: { period: 4.3, amp: 0.9 }
  };

  var SC_YUCI_HOLD_EDICT = {
    root: [
      { t: 129.0, dx: -6, dy: 4, rot: 0 },
      { t: 136.5, dx: 6, dy: -3, rot: 0.014, ease: 'inOutSine' },
      { t: 144.2, dx: 12, dy: -5, rot: 0.01, ease: 'inOutSine' }
    ],
    wind: { dirDeg: 14, base: 0.34, gust: [{ t: 132.0, dur: 3.0, amp: 0.8 }, { t: 139.5, dur: 2.8, amp: 0.9 }] },
    breathe: { period: 4.5, amp: 0.9 }
  };

  var SC_CRANE_BOY = {
    root: [
      { t: 144.2, dx: -40, dy: -30, rot: -0.05 },
      { t: 148.6, dx: 0, dy: 0, rot: 0.02, ease: 'outBack' },
      { t: 154.8, dx: 6, dy: -8, rot: 0.032, ease: 'inOutSine' },
      { t: 159.0, dx: -30, dy: -22, rot: -0.03, ease: 'inOutSine' }
    ],
    wind: { dirDeg: 192, base: 0.58, gust: [{ t: 145.5, dur: 2.8, amp: 1.35 }, { t: 156.0, dur: 2.6, amp: 1.25 }] },
    breathe: { period: 3.4, amp: 1.15 }
  };

  var SC_TIGER_LEAP = {
    root: [
      { t: 163.6, dx: -110, dy: 42, rot: -0.06, s: 0.92 },
      { t: 164.0, dx: -18, dy: -12, rot: 0.035, s: 1.03, ease: 'outBack' },
      { t: 165.4, dx: 8, dy: 0, rot: 0.008, s: 1.0, ease: 'inOutSine' },
      { t: 176.0, dx: 48, dy: -14, rot: 0.015, s: 1.02, ease: 'inOutSine' }
    ],
    wind: { dirDeg: 6, base: 0.72, gust: [{ t: 164.0, dur: 2.6, amp: 1.9 }, { t: 170.0, dur: 3.4, amp: 1.35 }] },
    impulse: [{ t: 164.0, x: 1.0, y: -0.4, amp: 1.6 }],
    breathe: { period: 3.6, amp: 1.05 }
  };

  var SC_GEN_STAND = {
    root: [
      { t: 163.8, dx: -36, dy: -26, rot: -0.03 },
      { t: 164.3, dx: 0, dy: 0, rot: 0.015, ease: 'outBack' },
      { t: 176.0, dx: 24, dy: -8, rot: 0.01, ease: 'inOutSine' }
    ],
    wind: { dirDeg: 10, base: 0.78, gust: [{ t: 164.0, dur: 2.8, amp: 1.85 }, { t: 169.5, dur: 3.2, amp: 1.4 }] },
    impulse: [{ t: 164.1, x: 0.8, y: -0.5, amp: 1.4 }],
    breathe: { period: 4.1, amp: 0.95 }
  };

  var SC_XUE_WAVE = {
    root: [
      { t: 176.0, dx: 0, dy: 0, rot: 0 },
      { t: 179.2, dx: 8, dy: -4, rot: -0.025, ease: 'inOutSine' },
      { t: 183.5, dx: 4, dy: -2, rot: -0.012, ease: 'inOutSine' }
    ],
    wind: { dirDeg: 14, base: 0.56, gust: [{ t: 178.0, dur: 3.8, amp: 1.35 }] },
    breathe: { period: 4.2, amp: 1.0 }
  };

  var EDICT_RINGS = I.ringPlan({
    x: 975, y: 430,
    times: [118.0, 118.28, 118.62, 119.05],
    tones: ['gold', 'gold', 'white', 'gold'],
    r0: 195,
    spread: 44,
    seed: 348
  });

  var LEDGER_POS = {
    T030: { x: W * 0.11, y: H * 0.13, side: 'left' },
    T032: { x: W * 0.11, y: H * 0.13, side: 'left' },
    T034: { x: W * 0.88, y: H * 0.13, side: 'right' },
    T042: { x: W * 0.12, y: H * 0.14, side: 'left' },
    T045: { x: W * 0.11, y: H * 0.13, side: 'left' }
  };

  /* ── 立绘摆放与宣纸云垫接地辅助 ── */
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
      I.wash(c, gx, gy, gw, gh, ga, g.seed || 71, g.rgb || [82, 68, 52], 0, { edge: 'soft' });
      if (g.cloud) {
        I.wash(c, gx, gy + 4, gw * 1.48, gh * 1.6, ga * 0.82, (g.seed || 71) + 9, g.cloudRgb || [244, 239, 226], 0, { edge: 'soft' });
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

  /* 薛平治腕间「两仪圈」素白玉镯温润清辉（随世界坐标与朝向锚定） */
  function drawLiangyiBracelet(c, t, cam, wristX, wristY, a) {
    if (a <= 0.004) return;
    c.save();
    I.screen(c);
    I.cam(c, I.plateView(cam));
    var p = 0.72 + 0.28 * Math.sin(t * 2.1);
    I.glow(c, wristX, wristY, 46 * p, [224, 242, 236], 0.42 * a, 'lighter');
    // 两仪阴阳双弧细润环转（不用几何正圆）
    for (var s = 0; s < 2; s++) {
      var base = t * 0.95 + s * Math.PI;
      var arc = [];
      for (var k = 0; k <= 8; k++) {
        var ang = base + (k / 8) * 2.1;
        arc.push([wristX + Math.cos(ang) * 16, wristY + Math.sin(ang) * 10]);
      }
      I.stroke(c, arc, {
        raw: true, n: 14, w: 2.6, a: 0.78 * a * p,
        rgb: s ? [248, 248, 240] : [156, 214, 206], seed: 610 + s, head: 0.2, tail: 0.35, bleed: 0
      });
    }
    c.restore();
  }

  /* ── 2-01 [0.0..14.0]：行近中央道宫，重重云霭向两侧分流 ── */
  function shot201(c, t) {
    var u = U.smooth(t / 14.0);
    var cam = M.cam(t, [
      [0.0, { x: 12, y: -8, zoom: 1.04 }],
      [14.0, { x: 0, y: -26, zoom: 1.18 }, 'smooth']
    ]);

    I.plate(c, 'p-daojing-scroll', {
      cam: cam,
      fade: { id2: 'p-daogong-gate', k: U.ramp(t, 8.2, 13.8) * 0.48 }
    });
    I.plateFlow(c, 'p-daojing-scroll', t, { cam: cam, amp: 5, scale: 320, speed: 0.10, band: [0.40, 1.0], alpha: 0.65, seed: 201 });

    // 云海下方隐现汇向中央道宫的石青与泥金气脉
    c.save();
    I.screen(c);
    I.cam(c, I.plateView(cam));
    ZL.qiMeridians(c, t, { nodes: [[480, 740], [960, 480], [1440, 720]], k: 0.85, a: 0.46, seed: 23 });
    c.restore();

    // 余慈存神乘风前驰
    rigAt(c, 'sp-yuci-phantom', t, {
      cam: cam, hPx: U.lerp(360, 275, u), dx: U.lerp(-105, 10, u), footY: U.lerp(805, 695, u),
      alpha: 0.88, script: SC_PHANTOM_ENTER, amp: 1.25, ground: { a: 0.30, cloud: true, seed: 205 }
    });

    // 承接第一幕末镜的漫镜仙云，向左右两侧恢宏分流让道！
    var part = M.expoOut(U.clamp(t / 5.2, 0, 1), 3.8);
    var shift = part * W * 0.44;
    c.save();
    I.screen(c);
    I.cloud(c, W * 0.25 - shift, H * 0.54 + 14 * Math.sin(t * 0.7), 1060, 593, { a: 0.84 * (1 - 0.55 * u), rgb: [244, 240, 230], shade: 0.20, line: 0.22 });
    I.cloud(c, W * 0.76 + shift, H * 0.50 + 14 * Math.cos(t * 0.7), 1060, 599, { a: 0.84 * (1 - 0.55 * u), rgb: [244, 240, 230], shade: 0.20, line: 0.22 });
    c.restore();

    I.plateMist(c, t, { cam: cam, y: H * 0.80, h: 280, a: 0.26, rgb: [244, 240, 228], speed: -24, depth: 1.38, seed: 211 });
    ZL.spiritDust(c, t, { n: 54, rgb: [212, 180, 96], dir: -Math.PI * 0.5, speed: 28, curl: 1.1, a: 0.52, seed: 213 });
  }

  /* ── 2-02 [14.0..29.0]：巫门三女（幽蕊、慕容轻烟、夏夫人）各据方位调理道境气脉 ── */
  function shot202(c, t) {
    var cam = M.cam(t, [
      [14.0, { x: -42, y: 12, zoom: 1.08 }],
      [29.0, { x: 42, y: -10, zoom: 1.15 }, 'smooth']
    ]);
    I.plateFlow(c, 'p-daojing-scroll', t, { cam: cam, amp: 5, scale: 320, speed: 0.09, band: [0.35, 1.0], seed: 223 });

    c.save();
    I.screen(c);
    I.cam(c, I.plateView(cam));

    // 三座仙云阵台托底
    I.cloud(c, 450, 685, 420, 227, { a: 0.78, rgb: [244, 240, 230], shade: 0.18, line: 0.20 });
    I.cloud(c, 965, 735, 620, 229, { a: 0.86, rgb: [246, 242, 232], shade: 0.20, line: 0.22 });
    I.cloud(c, 1475, 665, 420, 233, { a: 0.78, rgb: [244, 240, 230], shade: 0.18, line: 0.20 });

    // 石青、泥金、紫气灵脉在三才阵眼与巫门三女袖间呼吸明灭，汇向远方中央道宫
    ZL.qiMeridians(c, t, {
      nodes: [[450, 655], [805, 595], [975, 485], [1135, 610], [1475, 635]],
      k: 1.0, a: 0.94, seed: 23
    });
    c.restore();

    // 巫门三女写意云中调脉立绘
    rigAt(c, 'sp-shaman-trio', t, {
      cam: cam, hPx: 440, dx: 10, footY: 775,
      script: SC_SHAMAN_QI, amp: 1.28, ground: { a: 0.34, cloud: true, w: 260, seed: 239 }
    });

    I.plateMist(c, t, { cam: cam, y: H * 0.82, h: 270, a: 0.26, rgb: [242, 238, 226], speed: 18, depth: 1.35, seed: 241 });
    ZL.spiritDust(c, t, { n: 64, rgb: [122, 186, 184], dir: -Math.PI * 0.5, speed: 26, curl: 1.25, a: 0.58, seed: 251 });
    ZL.chronalVignette(c, t, { mode: 'dream', k: 0.38, a: 0.56, seed: 257 });
  }

  /* ── 2-03 [29.0..44.0]：中央道宫恢宏门楼与白玉广场，飞檐流金 ── */
  function shot203(c, t) {
    var cam = M.cam(t, [
      [29.0, { x: 0, y: 42, zoom: 1.13 }],
      [44.0, { x: 0, y: -18, zoom: 1.02 }, 'smooth']
    ]);
    I.plateFlow(c, 'p-daogong-gate', t, { cam: cam, amp: 4, scale: 350, speed: 0.08, band: [0.55, 1.0], seed: 263 });

    c.save();
    I.screen(c);
    I.cam(c, I.plateView(cam));
    // 门楼背后汇聚的天地气脉微光与琉璃瓦脊流淌的金霞
    ZL.qiMeridians(c, t, { nodes: [[560, 460], [960, 290], [1360, 460]], k: 0.9, a: 0.36, seed: 269 });
    I.flyWhite(c, t, { x0: 540, y0: 335, x1: 1380, y1: 335, w: 95, t0: 29.8, dur: 1.4, hold: 10.5, fade: 1.8, kind: 'gold', a: 0.34, seed: 271 });
    ZL.craneFlight(c, t, { t0: 30.2, dur: 11.5, x0: 1680, y0: 290, x1: 380, y1: 185, s: 0.50, feathers: 4, a: 0.72, seed: 277 });
    c.restore();

    I.plateMist(c, t, { cam: cam, y: H * 0.78, h: 260, a: 0.24, rgb: [244, 239, 226], speed: -14, depth: 1.3, seed: 281 });
    ZL.spiritDust(c, t, { n: 52, rgb: [216, 182, 94], dir: -Math.PI * 0.5, speed: 20, curl: 1.0, a: 0.50, seed: 283 });
    ZL.chronalVignette(c, t, { mode: 'dream', k: 0.34, a: 0.52, seed: 293 });
  }

  /* ── 2-04 [44.0..58.0]：cue xue@44.0 —— 薛平治胸背染血怔立道宫外，余慈落步轻问「你在这儿？」 ── */
  function shot204(c, t) {
    var cam = M.cam(t, [
      [44.0, { x: 38, y: 16, zoom: 1.08 }],
      [58.0, { x: -10, y: 8, zoom: 1.13 }, 'smooth']
    ]);
    I.plateFlow(c, 'p-daogong-gate', t, { cam: cam, amp: 4, scale: 340, speed: 0.08, band: [0.58, 1.0], seed: 307 });

    // 画右白玉栏边：薛平治宫装侧背影仰望飞檐，肩背旧血暗红、雪腕两仪圈温润流光
    rigAt(c, 'sp-xue-pingzhi', t, {
      cam: cam, hPx: 455, dx: 245, footY: 895,
      script: SC_XUE_GAZE, amp: 1.05, ground: { a: 0.32, cloud: true, seed: 311 }
    });
    drawLiangyiBracelet(c, t, cam, W * 0.5 + 245 + 152, 578, 0.86);

    // 画左：余慈自左后方飘然落步入画（45.2..49.0s）
    var yIn = U.smooth((t - 45.0) / 1.4);
    if (yIn > 0.01) {
      var landK = M.expoOut(U.clamp((t - 45.0) / 3.8, 0, 1), 4);
      rigAt(c, 'sp-yuci-stand-w', t, {
        cam: cam,
        hPx: 455,
        dx: U.lerp(-405, -230, landK),
        footY: U.lerp(855, 895, landK),
        alpha: yIn,
        script: SC_YUCI_ALIGHT,
        amp: 1.12,
        ground: { a: 0.32 * yIn, cloud: true, seed: 313 }
      });
    }

    I.plateMist(c, t, { cam: cam, y: H * 0.84, h: 250, a: 0.22, rgb: [244, 239, 226], speed: 12, depth: 1.35, seed: 317 });
    ZL.spiritDust(c, t, { n: 46, rgb: [214, 182, 98], dir: -Math.PI * 0.5, speed: 18, curl: 1.05, a: 0.46, seed: 331 });
  }

  /* ── 2-05 [58.0..74.0]：近景凝视薛平治「这就是上清三十六天……」与肩背暗红剑伤、腕间两仪圈 ── */
  function shot205(c, t) {
    var cam = M.cam(t, [
      [58.0, { x: 108, y: -32, zoom: 1.24 }],
      [65.5, { x: 118, y: -22, zoom: 1.28 }, 'smooth'],
      [74.0, { x: 128, y: 38, zoom: 1.34 }, 'smooth']
    ]);

    // 飞檐背景微带浅景深柔化，突出人物悲欣交集之神采
    I.soft(c, function (sc) {
      I.plate(sc, 'p-daogong-gate', { cam: cam });
    }, { layer: 'xueBgSoft', spread: 3.0, halo: 0.38, rim: 0.14, a: 1 });

    I.plateMist(c, t, { cam: cam, y: H * 0.66, h: 280, a: 0.20, rgb: [244, 239, 226], speed: -14, depth: 1.15, seed: 337 });

    // 近景薛平治（明显拉近景别，与 2-04/2-06 中景拉开节奏层次）
    rigAt(c, 'sp-xue-pingzhi', t, {
      cam: cam, hPx: 745, dx: 125, footY: 1125,
      script: SC_XUE_GAZE, amp: 1.15, ground: false
    });

    // 65.5s 起旁白点出「硬受杀剑不退，胸背犹染暗血」：肩背微泛一缕克制的暗红剑意余痕，雪腕两仪圈清光温润守护
    var woundFocus = U.smooth((t - 65.4) / 2.4);
    c.save();
    I.screen(c);
    I.cam(c, I.plateView(cam));
    if (woundFocus > 0.01) {
      I.wash(c, W * 0.5 + 98, 675, 76, 58, 0.24 * woundFocus, 347, [132, 34, 28], -0.25, { edge: 'wet' });
    }
    c.restore();
    drawLiangyiBracelet(c, t, cam, W * 0.5 + 125 + 248, 608, 0.94 + 0.06 * woundFocus);

    ZL.spiritDust(c, t, { n: 48, rgb: [220, 236, 230], dir: -Math.PI * 0.5, speed: 16, curl: 1.15, a: 0.48, seed: 349 });
    ZL.chronalVignette(c, t, { mode: 'dream', k: 0.42, a: 0.58, seed: 353 });
  }

  /* ── 2-06 [74.0..88.2]：余慈深深一揖到底「刚刚多谢了」，薛平治转身敛礼「天君先入宫受诏吧」 ── */
  function shot206(c, t) {
    var cam = M.cam(t, [
      [74.0, { x: 0, y: 14, zoom: 1.07 }],
      [88.2, { x: 0, y: 6, zoom: 1.13 }, 'smooth']
    ]);
    I.plateFlow(c, 'p-daogong-gate', t, { cam: cam, amp: 4, scale: 340, speed: 0.08, band: [0.58, 1.0], seed: 359 });

    // 画左余慈：74.0..80.8s 郑重长揖到底（sp-yuci-bow），80.4..81.4s 平滑直身切换为 sp-yuci-look-2
    var standUpK = U.smooth((t - 80.3) / 1.0);
    if (standUpK < 0.99) {
      rigAt(c, 'sp-yuci-bow', t, {
        cam: cam, hPx: 465, dx: -230, footY: 902, alpha: 1 - standUpK,
        script: SC_YUCI_DEEPBOW, amp: 1.18, ground: { a: 0.34 * (1 - standUpK), cloud: true, seed: 367 }
      });
    }
    if (standUpK > 0.01) {
      rigAt(c, 'sp-yuci-look-2', t, {
        cam: cam, hPx: 465, dx: -230, footY: 902, alpha: standUpK,
        script: SC_YUCI_DEEPBOW, amp: 0.95, ground: { a: 0.34 * standUpK, cloud: true, seed: 367 }
      });
    }

    // 画右薛平治：已转身面向余慈（flip:'h'），颔首敛袖温雅还礼
    rigAt(c, 'sp-xue-pingzhi', t, {
      cam: cam, hPx: 460, dx: 235, footY: 902, flip: 'h',
      script: SC_XUE_RETURN_BOW, amp: 1.08, ground: { a: 0.34, cloud: true, seed: 373 }
    });
    drawLiangyiBracelet(c, t, cam, W * 0.5 + 235 - 154, 582, 0.85);

    I.plateMist(c, t, { cam: cam, y: H * 0.85, h: 240, a: 0.22, rgb: [244, 239, 226], speed: 12, depth: 1.35, seed: 379 });
    ZL.spiritDust(c, t, { n: 44, rgb: [216, 184, 98], dir: -Math.PI * 0.5, speed: 18, curl: 1.05, a: 0.45, seed: 383 });
  }

  /* ── 2-07 [88.2..102.0]：薛平治前景目送轻叹，余慈孤身拾级步入高阔宫门 ── */
  function shot207(c, t) {
    var u = U.smooth((t - 88.2) / 13.8);
    var cam = M.cam(t, [
      [88.2, { x: 18, y: 8, zoom: 1.05 }],
      [102.0, { x: -8, y: -16, zoom: 1.16 }, 'smooth']
    ]);
    I.plateFlow(c, 'p-daogong-gate', t, { cam: cam, amp: 4, scale: 340, speed: 0.08, band: [0.55, 1.0], seed: 389 });

    // 中远景：余慈拾级而上，步入中央道宫金色门洞深处渐隐于瑞霭
    var enterFade = 1 - U.smooth((t - 98.0) / 3.5);
    var stepBob = -3.0 * Math.abs(Math.sin((t - 88.2) * 2.2));
    rigAt(c, 'sp-yuci-stand-w', t, {
      cam: cam,
      hPx: U.lerp(335, 190, u),
      dx: U.lerp(-70, 0, u),
      footY: U.lerp(825, 700, u) + stepBob,
      alpha: enterFade,
      amp: 0.95,
      ground: { a: 0.28 * enterFade, cloud: true, seed: 397 }
    });

    // 宫门洞内透出的温润赤金瑞气
    c.save();
    I.screen(c);
    I.cam(c, I.plateView(cam));
    I.glow(c, 960, 615, 185, [224, 182, 92], 0.22 + 0.16 * u, 'lighter');
    c.restore();

    I.plateMist(c, t, { cam: cam, y: H * 0.78, h: 250, a: 0.24, rgb: [244, 239, 226], speed: -14, depth: 1.25, seed: 401 });

    // 前景右侧过肩柔焦：薛平治凝望背影轻叹「万古云霄……果真是大手笔」
    I.soft(c, function (sc) {
      rigAt(sc, 'sp-xue-pingzhi', t, {
        cam: cam, hPx: 590, dx: 465 + 45 * u, footY: 995,
        alpha: 0.92, script: SC_XUE_GAZE, amp: 0.85, ground: false
      });
    }, { layer: 'xueOts', spread: 2.8, halo: 0.38, rim: 0.16, a: 1 });

    ZL.spiritDust(c, t, { n: 46, rgb: [216, 184, 98], dir: -Math.PI * 0.5, speed: 20, curl: 1.05, a: 0.48, seed: 409 });
  }

  /* ── 2-08 [102.0..115.0]：道宫中庭廊庑万仙缥缈，赤金符诏自苍穹破云飘摇垂落 ── */
  function shot208(c, t) {
    var u = U.easeInOut(U.clamp((t - 102.0) / 13.0, 0, 1));
    var cam = M.cam(t, [
      [102.0, { x: 0, y: -30, zoom: 1.04 }],
      [115.0, { x: 0, y: 18, zoom: 1.12 }, 'smooth']
    ]);
    I.plateFlow(c, 'p-daogong-courtyard', t, { cam: cam, amp: 4, scale: 360, speed: 0.08, seed: 419 });

    c.save();
    I.screen(c);
    I.cam(c, I.plateView(cam));

    // 两侧廊庑高处绰约无声的存神仙影
    var gallery = [
      [250, 560, 78, 1], [340, 610, 72, 1], [425, 650, 66, 1],
      [1495, 650, 66, -1], [1580, 610, 72, -1], [1670, 560, 78, -1]
    ];
    for (var i = 0; i < gallery.length; i++) {
      var g = gallery[i];
      I.figure(c, Object.assign({}, I.pose('salute', { bow: 0.25 }), {
        x: g[0], y: g[1], s: g[2], face: g[3], robe: 'grey',
        rgb: [112, 96, 72], wind: 0.22, a: 0.38, t: t, seed: 420 + i
      }));
    }

    // 穹顶正中：太霄赤金符诏随微风轻摆徐徐垂落
    var ex = 960 + 14 * Math.sin(t * 0.95), ey = U.lerp(175, 445, u);
    I.sprout(c, 960, 110, 240, 0.85, 431, { rgb: [216, 174, 82], a: 0.28 });
    ZL.tadpoleEdict(c, t, { x: ex, y: ey, s: 0.62, morphK: 0.08, unfoldK: 0, cyanK: 0, a: 0.96, seed: 31 });
    c.restore();

    // 庭心下方余慈独立仰接
    rigAt(c, 'sp-yuci-stand-w', t, {
      cam: cam, hPx: 235, dx: -12, footY: 890,
      amp: 0.85, ground: { a: 0.28, cloud: true, seed: 433 }
    });

    I.mistBand(c, t, { y: H * 0.66, h: 280, speed: 14, warp: 22, tint: [238, 224, 192], a: 0.24, seed: 439 });
    ZL.spiritDust(c, t, { n: 60, rgb: [222, 178, 84], dir: Math.PI * 0.5, speed: 24, curl: 1.15, a: 0.56, seed: 443 });
    ZL.chronalVignette(c, t, { mode: 'dream', k: 0.40, a: 0.58, seed: 449 });
  }

  /* ── 2-09 [115.0..129.0]：特写 cu-talisman-hand → H05/edict@118.0(G348.0) 赤金符诏落掌、玉磬清鸣！ ── */
  function shot209(c, t) {
    var TH = 118.0;
    var ta = M.hitStop(t, [[TH, 0.06, 0.26]]);
    var cam = M.cam(ta, [
      [115.0, { x: -14, y: -18, zoom: 1.05 }],
      [117.8, { x: 4, y: 2, zoom: 1.10 }, 'smooth'],
      [118.0, { x: 8, y: 6, zoom: 1.13 }, 'expoIn'],
      [129.0, { x: 20, y: 12, zoom: 1.17 }, 'smooth']
    ]);
    cam = M.kickCam(cam, M.kick(t, TH, { amp: 7, f: 4.4, zeta: 0.45, life: 1.3, zAmp: 0.024, seed: 457 }));

    I.plateFlow(c, 'cu-talisman-hand', ta, { cam: cam, amp: 4, scale: 300, speed: 0.09, seed: 461 });

    c.save();
    I.screen(c);
    I.cam(c, I.plateView(cam));

    // 与底图赤金符诏 [918, 300] 精准叠合：unfoldK 收拢卷体叠边，令蝌蚪游鱼神文自原画符心自然游出环绕双掌
    var mK = t < TH ? U.lerp(0.14, 0.24, (ta - 115.0) / 3.0) : U.lerp(0.28, 0.44, U.smooth((t - TH) / 8.0));
    ZL.tadpoleEdict(c, ta, { x: 922, y: 310, s: 0.78, morphK: mK, unfoldK: 0.08, cyanK: 0, a: 0.54, seed: 31 });

    // H05@118.0：符诏落掌瞬间，温润赤金水墨光环与古篆涟漪荡开
    if (t >= TH) {
      I.rings(c, t, EDICT_RINGS, { paleBg: 0.78 });
      M.inkRing(c, t, TH, { x: 975, y: 430, r: 560, flat: 0.66, w: 42, rgb: [204, 142, 54], a: 0.60, life: 1.45, seed: 463 });
      M.inkRing(c, t, TH + 0.16, { x: 975, y: 430, r: 410, flat: 0.70, w: 30, rgb: [188, 68, 42], a: 0.48, life: 1.5, seed: 467 });
      I.glow(c, 975, 430, 240, [236, 188, 92], 0.28 * (0.75 + 0.25 * Math.sin(t * 2.2)), 'lighter');
    }
    c.restore();

    if (t >= TH && t < TH + 0.65) {
      I.flash(c, 0.38 * Math.exp(-(t - TH) / 0.15), { x: 975, y: 430, rgb: [252, 240, 206], paleBg: 0.78 });
    }

    ZL.spiritDust(c, t, { n: 62, rgb: [224, 176, 78], dir: -Math.PI * 0.5, speed: t < TH ? 20 : 38, curl: 1.25, a: 0.62, seed: 479 });
    ZL.chronalVignette(c, t, { mode: 'dream', k: 0.44, a: 0.62, seed: 487 });
  }

  /* ── 2-10 [129.0..144.2]：余慈执诏凝视「存神如梦，符诏所指方是神庭真核」，殿外鹤唳遥传 ── */
  function shot210(c, t) {
    var cam = M.cam(t, [
      [129.0, { x: -20, y: 6, zoom: 1.10 }],
      [144.2, { x: 20, y: -8, zoom: 1.18 }, 'smooth']
    ]);
    I.plateFlow(c, 'p-daogong-courtyard', t, { cam: cam, amp: 4, scale: 340, speed: 0.08, seed: 491 });

    // 余慈中近景执诏参悟
    rigAt(c, 'sp-yuci-pose-set-2', t, {
      cam: cam, hPx: 555, dx: -105, footY: 980,
      script: SC_YUCI_HOLD_EDICT, amp: 1.05, ground: false
    });

    c.save();
    I.screen(c);
    I.cam(c, I.plateView(cam));
    // 身前悬浮赤金符诏，蝌蚪神文流转映亮衣襟
    var fx = W * 0.5 + 88, fy = 520 + 7 * Math.sin(t * 1.7);
    ZL.tadpoleEdict(c, t, { x: fx, y: fy, s: 0.66, morphK: 0.28, unfoldK: 0.04, cyanK: 0, a: 0.94, seed: 31 });
    I.glow(c, fx - 60, fy + 30, 220, [228, 178, 84], 0.24, 'lighter');

    // 138.8..144.2s 殿外高天白鹤清唳掠过，呼应下一镜白鹤童子登场
    ZL.craneFlight(c, t, { t0: 138.8, dur: 5.8, x0: 1760, y0: 215, x1: 1060, y1: 315, s: 0.62, feathers: 5, a: 0.85, seed: 499 });
    c.restore();

    I.plateMist(c, t, { cam: cam, y: H * 0.84, h: 250, a: 0.24, rgb: [242, 234, 214], speed: 14, depth: 1.35, seed: 503 });
    ZL.spiritDust(c, t, { n: 54, rgb: [222, 178, 82], dir: -Math.PI * 0.5, speed: 22, curl: 1.15, a: 0.54, seed: 509 });
    ZL.chronalVignette(c, t, { mode: 'dream', k: 0.42, a: 0.60, seed: 521 });
  }

  /* ── 2-11 [144.2..159.0]：青衣白鹤童子滑翔落定云阶，稽首引路「老爷，请随我来」 ── */
  function shot211(c, t) {
    var cam = M.cam(t, [
      [144.2, { x: 28, y: -18, zoom: 1.07 }],
      [150.0, { x: 4, y: 4, zoom: 1.11 }, 'smooth'],
      [159.0, { x: -12, y: 8, zoom: 1.13 }, 'smooth']
    ]);
    I.plateFlow(c, 'p-daogong-gate', t, { cam: cam, amp: 4, scale: 340, speed: 0.08, band: [0.55, 1.0], seed: 523 });

    // 画左：余慈负手而立，袖间微露赤金诏光
    rigAt(c, 'sp-yuci-stand-w', t, {
      cam: cam, hPx: 440, dx: -315, footY: 895,
      amp: 0.95, ground: { a: 0.32, cloud: true, seed: 541 }
    });

    // 白鹤滑翔伴随飘落白羽虚化轨迹
    c.save();
    I.screen(c);
    I.cam(c, I.plateView(cam));
    I.glow(c, W * 0.5 - 275, 625, 110, [224, 176, 84], 0.22, 'lighter');
    ZL.craneFlight(c, t, { t0: 144.2, dur: 5.2, x0: 1680, y0: 250, x1: 1210, y1: 560, s: 0.68, feathers: 7, a: 0.55, seed: 547 });
    c.restore();

    // 画右：青衣道童乘白鹤自右上方斜掠落定云阶（全程稳持 flip:'h' 面向余慈稽首引路，避免镜中硬翻）
    var glideK = M.expoOut(U.clamp((t - 144.2) / 4.4, 0, 1), 4);
    var leadOut = U.smooth((t - 155.8) / 3.2);
    var cx = U.lerp(560, 235, glideK) - leadOut * 55;
    var cy = U.lerp(545, 790, glideK) - leadOut * 48 + 8 * Math.sin(t * 2.1);

    rigAt(c, 'sp-crane-boy', t, {
      cam: cam, hPx: 390, dx: cx, footY: cy, flip: 'h',
      script: SC_CRANE_BOY, amp: 1.25, ground: { a: 0.32, cloud: true, w: 220, seed: 557 }
    });

    I.plateMist(c, t, { cam: cam, y: H * 0.84, h: 250, a: 0.24, rgb: [244, 239, 226], speed: -18, depth: 1.38, seed: 563 });
    ZL.spiritDust(c, t, { n: 50, rgb: [198, 226, 218], dir: -0.35, speed: 24, curl: 1.15, a: 0.50, seed: 569 });
  }

  /* ── 2-12 [159.0..176.0]：金霞蓄势 → H06/chariot@164.0(G394.0) 白虎牵玉舆破云跃出、二神将奉诏御行！ ── */
  function shot212(c, t) {
    var TH = 164.0;
    var ta = M.hitStop(t, [[TH, 0.08, 0.30]]);
    var st = M.strike(ta, TH, { pre: 1.4, go: 0.20, post: 2.0, wind: 0.16 });
    var cam = M.cam(ta, [
      [159.0, { x: -32, y: 14, zoom: 1.13 }],
      [163.8, { x: -12, y: 6, zoom: 1.18 }, 'smooth'],
      [164.0, { x: 0, y: 0, zoom: 1.14 }, 'expoIn'],
      [176.0, { x: 28, y: -8, zoom: 1.05 }, 'expoOut']
    ]);
    cam = M.kickCam(cam, M.kick(t, TH, { amp: 16, f: 5.8, zeta: 0.38, life: 1.45, zAmp: 0.045, seed: 571 }));

    I.plateFlow(c, 'p-daogong-gate', ta, { cam: cam, amp: 5, scale: 330, speed: 0.10, band: [0.50, 1.0], seed: 577 });

    // 159.0..164.0s 金霞云海翻涌蓄势与低沉虎咆气环内聚
    if (t < TH + 1.2) {
      var preK = U.clamp((t - 159.0) / 5.0, 0, 1);
      var preFade = 1 - U.ramp(t, TH, TH + 1.2);
      M.inkShock(c, t, { t0: 160.2, dur: 1.5, x: 860, y: 650, R: 540, flat: 0.48, inward: true, rgb: [204, 162, 76], a: 0.42 * preFade, seed: 587 });
      M.inkShock(c, t, { t0: 162.3, dur: 1.6, x: 920, y: 640, R: 620, flat: 0.48, inward: true, rgb: [216, 168, 72], a: 0.55 * preFade, seed: 593 });
      I.mistBand(c, t, { y: H * 0.48, h: 420, speed: -46, warp: 30, tint: [238, 214, 162], a: (0.28 + 0.28 * preK) * preFade, seed: 599 });
    }

    // H06@164.0：白虎牵无轮符篆玉舆破开金霞跃出，二位丈六金甲掌刑神将踏辕高举符诏！
    if (t >= TH - 0.25) {
      var appear = U.clamp((t - (TH - 0.25)) / 0.35, 0, 1);
      var postGlide = U.smooth(U.clamp((t - TH) / 12.0, 0, 1));
      var chDx = U.lerp(-120, 20, M.expoOut(U.clamp((t - (TH - 0.2)) / 1.4, 0, 1), 4.5)) + postGlide * 45;
      var chY = 890 - postGlide * 18 + 5 * Math.sin(t * 2.0);

      // 托车滚滚金白云涛
      c.save();
      I.screen(c);
      I.cam(c, I.plateView(cam));
      I.cloud(c, W * 0.5 + chDx - 40, chY - 35, 920, 601, { a: 0.85 * appear, rgb: [248, 244, 232], shade: 0.22, line: 0.22 });
      I.flyWhite(c, t, { x0: 140, y0: 760, x1: 1780, y1: 520, w: 195, t0: TH, dur: 0.32, hold: 1.8, fade: 1.2, kind: 'gold', a: 0.78, seed: 607 });
      c.restore();

      // 左后护卫：掌刑神将乙（sp-punish-gen-2 翻转朝右随辇护持）
      rigAt(c, 'sp-punish-gen-2', ta, {
        cam: cam, hPx: 450, dx: chDx - 395, footY: chY - 6, flip: 'h',
        alpha: appear, script: SC_GEN_STAND, amp: 1.3, ground: { a: 0.34 * appear, cloud: true, seed: 613 }
      });

      // 中央主驾：白虎牵玉舆隐轮之车（sp-tiger-carriage）
      rigAt(c, 'sp-tiger-carriage', ta, {
        cam: cam, hPx: 465, dx: chDx - 25, footY: chY,
        alpha: appear, script: SC_TIGER_LEAP, amp: 1.35, ground: { a: 0.38 * appear, cloud: true, w: 380, seed: 617 }
      });

      // 右前开道：掌刑神将甲（sp-punish-gen-1）双手高举太霄赤金符诏过顶！
      var gen1X = chDx + 345, gen1Y = chY - 8;
      rigAt(c, 'sp-punish-gen-1', ta, {
        cam: cam, hPx: 470, dx: gen1X, footY: gen1Y,
        alpha: appear, script: SC_GEN_STAND, amp: 1.35, ground: { a: 0.36 * appear, cloud: true, seed: 619 }
      });

      // 神将双手上方辉映的赤金符诏神芒
      c.save();
      I.screen(c);
      I.cam(c, I.plateView(cam));
      var edX = W * 0.5 + gen1X + 92, edY = gen1Y - 435;
      ZL.tadpoleEdict(c, t, { x: edX, y: edY, s: 0.46, morphK: 0.24, unfoldK: 0, cyanK: 0, a: 0.92 * appear, seed: 31 });
      c.restore();

      M.inkShock(c, t, { t0: TH, dur: 1.35, x: 960, y: 660, R: 860, flat: 0.42, rgb: [212, 166, 74], a: 0.65, seed: 631 });
      M.flashInk(c, t, TH, { x: 980, y: 580, white: 0.05, ink: 0.07, a: 0.84 });
    }

    I.plateMist(c, t, { cam: cam, y: H * 0.85, h: 270, a: 0.28, rgb: [246, 240, 224], speed: -36, depth: 1.42, seed: 641 });
    ZL.spiritDust(c, t, { n: 68, rgb: [224, 182, 86], dir: -0.15, speed: 44, curl: 1.2, a: 0.62, seed: 643 });
    ZL.chronalVignette(c, t, { mode: 'dream', k: 0.36 + 0.12 * st.pre, a: 0.58, seed: 647 });
  }

  /* ── 2-13 [176.0..190.0]：与薛平治相视挥别，虎辇随白鹤童子穿云直坠三界深渊 ── */
  function shot213(c, t) {
    var diveK = U.smooth((t - 183.0) / 7.0); // 183.0..190.0s 俯冲扎入明灭深云
    var u = U.smooth((t - 176.0) / 14.0);
    var cam = M.cam(t, [
      [176.0, { x: -10, y: -12, zoom: 1.05 }],
      [183.0, { x: 24, y: -20, zoom: 1.10 }, 'smooth'],
      [190.0, { x: 68, y: 112, zoom: 1.27 }, 'expoIn']
    ]);

    I.plateFlow(c, 'p-daogong-gate', t, { cam: cam, amp: 5, scale: 340, speed: 0.10, band: [0.48, 1.0], seed: 653 });

    // 左下方广场白玉栏边：薛平治轻挥云袖遥遥送别（随俯冲渐退至画外上方）
    var xueAlpha = 1 - U.smooth((t - 184.2) / 3.4);
    if (xueAlpha > 0.01) {
      rigAt(c, 'sp-xue-pingzhi', t, {
        cam: cam, hPx: 410, dx: -510, footY: 895 - diveK * 140,
        alpha: xueAlpha, script: SC_XUE_WAVE, amp: 1.25, ground: { a: 0.30 * xueAlpha, cloud: true, seed: 659 }
      });
      drawLiangyiBracelet(c, t, cam, W * 0.5 - 510 + 136, 610 - diveK * 140, 0.82 * xueAlpha);
    }

    // 空中仙驾编队：白鹤童子前导 + 虎辇玉舆（余慈回眸挥别） + 二掌刑神将破云俯冲下界！
    var arcX = U.lerp(40, 230, u), arcY = U.lerp(735, 650, U.smooth((t - 176.0) / 7.0)) + diveK * 235;
    c.save();
    I.screen(c);
    I.cam(c, I.plateView(cam));
    I.cloud(c, W * 0.5 + arcX, arcY - 25, 780, 661, { a: 0.80, rgb: [246, 242, 230], shade: 0.22, line: 0.22 });
    ZL.craneFlight(c, t, { t0: 176.2, dur: 12.5, x0: 1280, y0: 470, x1: 1790, y1: 680, s: 0.58, feathers: 6, a: 0.65, seed: 673 });
    c.restore();

    rigAt(c, 'sp-punish-gen-2', t, {
      cam: cam, hPx: 325, dx: arcX - 285, footY: arcY - 8, flip: 'h',
      amp: 1.15, ground: false
    });
    rigAt(c, 'sp-tiger-carriage', t, {
      cam: cam, hPx: 375, dx: arcX, footY: arcY,
      amp: 1.2, ground: false
    });
    // 舆中余慈回望广场薛平治（flip:'h' 朝左回眸）
    rigAt(c, 'sp-yuci-look-1', t, {
      cam: cam, hPx: 195, dx: arcX - 58, footY: arcY - 92, flip: 'h',
      alpha: 0.92, amp: 0.9, ground: false
    });
    rigAt(c, 'sp-punish-gen-1', t, {
      cam: cam, hPx: 335, dx: arcX + 265, footY: arcY + 8,
      amp: 1.15, ground: false
    });
    rigAt(c, 'sp-crane-boy', t, {
      cam: cam, hPx: 280, dx: arcX + 495, footY: arcY - 125 + diveK * 95,
      amp: 1.25, ground: false
    });

    // 183.5..190.0s（T048 于 184.0s 收束）：翻腾云海与明灭法则暗影自下方席卷全屏，无缝坠入第三幕三界法象！
    if (diveK > 0.01) {
      var flk = 0.72 + 0.28 * Math.sin(t * 7.5) * diveK;
      I.cloudSea(c, { y: H * (0.92 - 0.62 * diveK), h: H * 0.75, rows: 5, a: 0.86 * diveK, t: t, speed: 55, rgb: [226, 224, 214], shade: 0.26, line: 0.24, seed: 677 });
      I.mistBand(c, t, { y: H * (0.75 - 0.65 * diveK), h: 520, speed: -68, warp: 36, tint: [94, 112, 116], a: 0.56 * diveK * flk, seed: 683 });
    }

    I.plateMist(c, t, { cam: cam, y: H * 0.82, h: 280, a: 0.28, rgb: [242, 238, 226], speed: -38, depth: 1.45, seed: 691 });
    ZL.spiritDust(c, t, { n: 60, rgb: diveK > 0.5 ? [148, 204, 198] : [220, 182, 92], dir: -0.65, speed: 36 + 48 * diveK, curl: 1.25, a: 0.58, seed: 701 });
    ZL.chronalVignette(c, t, { mode: diveK > 0.6 ? 'reality' : 'dream', k: 0.38 + 0.34 * diveK, a: 0.62, seed: 709 });
  }

  function draw(c, t) {
    I.paper(c);
    if (t < 14.0) shot201(c, t);
    else if (t < 29.0) shot202(c, t);
    else if (t < 44.0) shot203(c, t);
    else if (t < 58.0) shot204(c, t);
    else if (t < 74.0) shot205(c, t);
    else if (t < 88.2) shot206(c, t);
    else if (t < 102.0) shot207(c, t);
    else if (t < 115.0) shot208(c, t);
    else if (t < 129.0) shot209(c, t);
    else if (t < 144.2) shot210(c, t);
    else if (t < 159.0) shot211(c, t);
    else if (t < 176.0) shot212(c, t);
    else shot213(c, t);

    I.screen(c);
    I.ledger(c, t, 'act2', { dark: false, pos: LEDGER_POS });
  }

  CINE.registerAct({
    id: 'act2',
    order: 2,
    name: '二 · 太霄受诏',
    duration: 190,
    beats: BS.beats,
    cues: CUES,
    plates: PLATES,
    draw: draw
  });
})();
