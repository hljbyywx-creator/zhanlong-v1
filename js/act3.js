/* 《斩龙封神》第三幕 act3.js —— 三 · 三界危局（210.0s，G: 420.0 – 630.0，15 镜）
   核心戏眼：穿明灭云霭俯瞰倒扣玉碟与洗玉湖破口（H07）→ 真实之域八位地仙死寂对峙（H08）＋湖底李伯才暗影一闪 →
            四御门庭神将举诏、蝌蚪成章沸汤沃雪净魔（H09）→ 符诏褪赤金化湖玉青光（太霄权柄归云霄）→ 白鹤童子化烟辞去。
   工程铁律：100% 纯 t 确定性（零 Math.random / Date / 跨帧可变状态）；复用常量 rig script 对象；零几何圆框硬线。 */
(function () {
  'use strict';
  var CINE = window.CINE, I = CINE.ink, U = CINE.util, M = CINE.motion, ZL = CINE.zl;
  var W = CINE.W || 1920, H = CINE.H || 1080;

  if (I.speaker) {
    I.speaker('白鹤童子', [126, 178, 172]);
  }

  var PAL = (ZL && ZL.PAL) || {
    bloodHi: [124, 36, 28], bloodMid: [104, 28, 25], bloodRust: [68, 22, 20],
    gold: [188, 156, 92], goldHi: [216, 190, 132], redGold: [176, 112, 58],
    cyan: [88, 148, 146], cyanHi: [148, 198, 192], cyanMist: [176, 212, 206],
    stoneCyan: [64, 114, 122], jade: [46, 128, 96], jadeHi: [92, 172, 136],
    abyssGreen: [38, 96, 78], abyssDeep: [20, 52, 44], nephrite: [232, 228, 214],
    ink: [24, 22, 20], inkSoft: [48, 44, 40], ash: [142, 136, 126], scorchDk: [44, 34, 30]
  };

  /* ---------- 常量骨骼/风场脚本（严禁每帧新建对象，保护 lib-rig Map 缓存） ---------- */
  var SC_GLIDE = {
    wind: { dirDeg: 195, base: 0.55 },
    breathe: { period: 3.8, amp: 1.0 }
  };
  var SC_GALE = {
    wind: { dirDeg: 188, base: 0.85 },
    breathe: { period: 3.2, amp: 1.2 }
  };
  var SC_IMMORTAL = {
    root: [{ t: 72.0, dy: 14 }, { t: 86.0, dy: -22, ease: 'inOutSine' }],
    wind: { dirDeg: 16, base: 0.52 },
    breathe: { period: 4.6, amp: 0.9 }
  };
  var SC_HOIST = {
    root: [
      { t: 142.0, dy: 16, s: 0.98 },
      { t: 144.8, dy: 24, rot: -0.025, s: 0.97, ease: 'inOutQuad' },
      { t: 146.2, dy: -12, rot: 0.015, s: 1.03, ease: 'outBack' },
      { t: 151.0, dy: -16, rot: 0.01, s: 1.04, ease: 'inOutSine' }
    ],
    wind: { dirDeg: 185, base: 0.92, gust: [{ t: 145.6, dur: 2.2, amp: 1.3 }] },
    impulse: [{ t: 145.8, x: 0.2, y: -1.0, amp: 1.4 }],
    breathe: { period: 2.8, amp: 1.3 }
  };
  var SC_GUARD = {
    wind: { dirDeg: 12, base: 0.72 },
    breathe: { period: 3.6, amp: 1.0 }
  };
  var SC_CRANE_BOW = {
    root: [
      { t: 195.2, dx: 0, dy: 0, rot: 0 },
      { t: 197.4, dx: -18, dy: 14, rot: -0.08, ease: 'inOutSine' },
      { t: 201.4, dx: -14, dy: 10, rot: -0.06, ease: 'inOutSine' },
      { t: 206.0, dx: 36, dy: -28, rot: 0.04, ease: 'inSine' }
    ],
    wind: { dirDeg: 15, base: 0.48 },
    breathe: { period: 3.6, amp: 1.0 }
  };

  /* ---------- 精确世界坐标立绘摆放器（自动补偿宽高比与水平翻转视差） ---------- */
  function rigAt(c, id, t, wx, footY, targetH, cam, o) {
    o = o || {};
    var im = I.plateImg(id);
    if (!im) return null;
    var iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
    var cw = (iw / ih > W / H) ? ih * W / H : iw;
    var s = targetH * cw / (W * ih);
    var anchorY = o.anchorY == null ? 0.47 : o.anchorY;
    var wy = footY - targetH * anchorY;
    var flipH = o.flip === 'h';
    var dx = flipH ? (W * 0.5 - wx) : (wx - W * 0.5);
    var dy = wy - H * 0.5;
    var rigCam = (flipH && cam) ? { x: -(cam.x || 0), y: cam.y || 0, zoom: cam.zoom || 1 } : cam;

    if (o.ground !== false) {
      c.save();
      I.cam(c, I.plateView(cam));
      var gw = targetH * (o.groundW || 0.42), gh = gw * 0.24;
      var ga = (o.alpha == null ? 1 : o.alpha) * (o.groundA == null ? 0.36 : o.groundA);
      I.wash(c, wx, footY - gh * 0.15, gw, gh, ga, o.seed || 19, o.groundRgb || PAL.inkSoft, 0, { edge: 'soft' });
      c.restore();
    }

    return I.rig(c, id, t, {
      cam: rigCam, s: s, dx: dx, dy: dy, flip: o.flip,
      alpha: o.alpha, script: o.script || SC_GLIDE, amp: o.amp, strain: o.strain, mode: o.mode
    });
  }

  function inWorld(c, cam, fn) {
    c.save();
    I.cam(c, I.plateView(cam));
    fn();
    c.restore();
  }

  function inPar(c, cam, depth, fn) {
    c.save();
    I.cam(c, I.par(I.plateView(cam), depth));
    fn();
    c.restore();
  }

  /* ---------- 拍表定义（严格对齐 BRIEF.md 3-01 .. 3-15，总长 210.0s） ---------- */
  var SHEET = CINE.beatSheet([
    ['3-01',   0.0,  13.0, '穿明灭云霭'],
    ['3-02',  13.0,  28.0, '倒扣玉碟全景'],
    ['3-03',  28.0,  44.2, '玉碟破口外溢'],
    ['3-04',  44.2,  57.0, '虎辇凝眸远眺'],
    ['3-05',  57.0,  72.0, '烛龙六道光阴'],
    ['3-06',  72.0,  86.0, '叶缤幻荣相持'],
    ['3-07',  86.0, 102.2, '八仙死寂雪崩'],
    ['3-08', 102.2, 115.0, '湖底李伯才影'],
    ['3-09', 115.0, 128.0, '急坠云染旧血'],
    ['3-10', 128.0, 142.0, '四御门庭群魔'],
    ['3-11', 142.0, 151.0, '神将踏辕举诏'],
    ['3-12', 151.0, 166.0, '蝌蚪成章沃雪'],
    ['3-13', 166.0, 180.0, '群魔化烟净尽'],
    ['3-14', 180.0, 195.2, '符诏褪赤化青'],
    ['3-15', 195.2, 210.0, '鹤童化烟辞别']
  ]);

  /* ==================== 各镜绘制实现 ==================== */

  /* 3-01 [0.0..13.0]：高空俯冲穿明灭云霭，虎辇与仙鹤剪影掠入三界法象 */
  function draw301(c, t) {
    var u = U.clamp(t / 13.0, 0, 1);
    var cam = M.cam(t, [
      [0.0,  { x: -35, y: -52, zoom: 1.18 }],
      [13.0, { x:  18, y:  28, zoom: 1.06 }, 'smooth']
    ]);
    var flk = 0.28 + 0.35 * U.clamp(U.fbm1(t * 5.4, 301, 3) + 0.35, 0, 1);
    I.plate(c, 'p-three-voids-dish', { cam: cam, grade: { dark: 0.10 + 0.16 * flk, cool: 0.08 } });

    inWorld(c, cam, function () {
      // 遮蔽右下方破口的浓云，留待 3-03 崩豁揭示
      I.wash(c, 1280, 520, 420, 290, 0.78 * (1 - 0.25 * u), 302, [218, 214, 202], -0.1, { edge: 'soft' });
      ZL.invertedDish(c, t, { x: 880, y: 420, s: 1.02, breachK: 0, flicker: 0.75, a: 0.55 + 0.35 * u, seed: 43 });
      I.mistBand(c, t, { x0: -80, y: 120, w: W + 160, h: 420, speed: 34, warp: 28, a: 0.58 * (1 - 0.35 * u), seed: 303 });
    });

    // 中前景：白鹤引路、虎辇破明灭云层斜掠而下
    var cx = U.lerp(420, 980, U.easeOut(u)), cy = U.lerp(280, 520, U.smooth(u));
    rigAt(c, 'sp-tiger-carriage', t, cx - 150, cy + 55, U.lerp(185, 130, u), cam, {
      ground: false, alpha: 0.90, script: SC_GALE
    });
    rigAt(c, 'sp-crane-boy', t, cx + 115, cy - 15, U.lerp(145, 105, u), cam, {
      ground: false, alpha: 0.92, script: SC_GLIDE
    });

    inPar(c, cam, 1.35, function () {
      ZL.craneFlight(c, t, { t0: -0.5, dur: 12.5, x0: 260, y0: 210, x1: 1240, y1: 560, s: 0.55, feathers: 11, a: 0.42, seed: 305 });
      ZL.spiritDust(c, t, { n: 42, rgb: PAL.goldHi, speed: 46, dir: 0.48, a: 0.52, seed: 307 });
      I.mistBand(c, t, { x0: -120, y: 520, w: W + 240, h: 460, speed: -42, warp: 34, a: 0.46 * (1 - 0.3 * u), seed: 309 });
    });
    I.plateMist(c, t, { y: H * 0.76, h: 300, a: 0.24, speed: -22, cam: cam, seed: 311 });
    ZL.chronalVignette(c, t, { mode: 'dream', k: 0.48, seed: 312 });
  }

  /* 3-02 [13.0..28.0]：缓慢拉远展现苍穹级倒扣白玉碟与中央石绿水世界 */
  function draw302(c, t) {
    var cam = M.cam(t, [
      [13.0, { x: -24, y: -18, zoom: 1.12 }],
      [28.0, { x:   8, y:   6, zoom: 1.00 }, 'smooth']
    ]);
    I.plate(c, 'p-three-voids-dish', { cam: cam, grade: { cool: 0.06 } });
    I.plateFlow(c, 'p-three-voids-dish', t, { cam: cam, amp: 7, scale: 280, speed: 0.14, band: [0.22, 0.72], alpha: 0.65, seed: 315 });

    inWorld(c, cam, function () {
      var u = U.clamp((t - 13.0) / 15.0, 0, 1);
      // 轻雾半掩外缘初裂处，突出中央穹窿与碧水包裹关系
      I.wash(c, 1300, 540, 340, 240, 0.42 * (1 - 0.4 * u), 316, [224, 220, 208], 0, { edge: 'soft' });
      ZL.invertedDish(c, t, { x: 880, y: 422, s: 1.05, breachK: 0.16 + 0.09 * u, flicker: 0.32, a: 0.88, seed: 43 });
      // 玉碟穹顶缓缓流转的太霄清气光环
      I.ring(c, t, { t0: 13.4, x: 880, y: 430, r: 360, flat: 0.34, spin: 0.28, rise: 8, acc: 2, grow: 0.03, life: 8.5, tone: 'qing', a: 0.36, paleBg: 0.5, seed: 317 });
      I.ring(c, t, { t0: 19.2, x: 880, y: 435, r: 340, flat: 0.34, spin: -0.24, rise: 8, acc: 2, grow: 0.03, life: 8.5, tone: 'white', a: 0.34, paleBg: 0.4, seed: 318 });
      ZL.spiritDust(c, t, { n: 38, box: [280, 140, 1200, 560], rgb: PAL.cyanHi, speed: 18, dir: 0.1, a: 0.48, seed: 319 });
    });

    I.plateMist(c, t, { y: H * 0.78, h: 280, a: 0.22, speed: 15, cam: cam, seed: 320 });
    ZL.chronalVignette(c, t, { mode: 'dream', k: 0.38, seed: 321 });
  }

  /* 3-03 [28.0..44.2]：命中 H07 @ 34.0s（G454.0）！玉碟外缘三分之一破口轰然崩豁，碧水狂泻 */
  function draw303(c, t) {
    var tHit = 34.0;
    var ts = M.hitStop(t, [[tHit, 0.08, 0.28]]);
    var st = M.strike(t, tHit, { pre: 1.5, go: 0.18, post: 2.2, wind: 0.14 });
    var baseCam = M.cam(ts, [
      [28.0, { x:  12, y: -10, zoom: 1.03 }],
      [33.8, { x: 135, y:  22, zoom: 1.22 }, 'expoIn'],
      [34.2, { x: 155, y:  34, zoom: 1.26 }, 'expoOut'],
      [44.2, { x: 110, y:  48, zoom: 1.16 }, 'smooth']
    ]);
    var cam = M.kickCam(baseCam, M.kick(t, tHit, { amp: 16, f: 6.2, dir: 0.42, zAmp: 0.045, life: 1.25, seed: 323 }));

    I.plate(c, 'p-three-voids-dish', { cam: cam, grade: { dark: 0.06 + 0.10 * st.imp, cool: 0.10 } });
    var afterAmp = t >= tHit ? 4 + 22 * Math.exp(-(t - tHit) / 1.1) : 3;
    I.plateFlow(c, 'p-three-voids-dish', ts, { cam: cam, amp: afterAmp, scale: 220, speed: 0.32, band: [0.28, 0.85], alpha: 0.82, seed: 324 });

    var bk = t < tHit ? 0.25 + 0.10 * st.pre : U.lerp(0.35, 1.0, M.expoOut(U.clamp((ts - tHit) / 1.6, 0, 1), 5));

    inWorld(c, cam, function () {
      // 蓄势期向破口收缩的气浪
      if (t >= tHit - 1.3 && t < tHit) {
        M.inkShock(c, t, { t0: tHit - 1.3, dur: 1.3, x: 1185, y: 430, R: 380, flat: 0.55, inward: true, rgb: PAL.stoneCyan, a: 0.46, seed: 325 });
      }
      ZL.invertedDish(c, ts, { x: 880, y: 422, s: 1.06, breachK: bk, flicker: 0.55 + 0.25 * st.imp, a: 0.94, seed: 43 });

      // 金石崩裂纹贴图在破口处爆亮蔓延
      var crackA = t < tHit ? 0.35 * st.pre : 0.88 * (1 - 0.45 * U.ramp(t, tHit + 2.0, 44.2));
      if (crackA > 0.01) {
        I.flow(c, 'fx-crack-gold', ts, {
          key: 'paper', dst: [980, 240, 460, 380], alpha: crackA,
          warp: { amp: 6, scale: 180, speed: 0.2, seed: 326 }, vignette: { rx: 0.95, ry: 0.95, soft: 0.45 }
        });
      }

      // 崩裂瞬间的墨浪冲击与碧玉洪流激沫
      M.inkShock(c, t, { t0: tHit, dur: 1.35, x: 1190, y: 435, R: 620, flat: 0.48, rgb: PAL.jade, a: 0.68, seed: 327 });
      I.inkSplash(c, t, { x: 1210, y: 455, size: 580, t0: tHit + 0.04, dur: 0.32, hold: 1.2, fade: 1.1, tint: PAL.jadeHi, vary: true, a: 0.78, seed: 328 });
      M.after(c, t, tHit + 0.05, { x: 1200, y: 450, dir: 0.95, spread: 1.1, n: 26, v: 460, rgb: PAL.abyssGreen, smokeRgb: PAL.cyanMist, a: 0.76, seed: 329 });

      if (t >= tHit) {
        var turbA = U.clamp((t - tHit) / 1.2, 0, 1) * 0.48;
        I.turbid(c, ts, { x0: 760, y: 580, w: 1080, h: 360, speed: -52, warp: 36, a: turbA, seed: 330 });
      }
    });

    M.flashInk(c, t, tHit, { x: 1180, y: 430, white: 0.045, ink: 0.075, a: 0.88 });
    ZL.chronalVignette(c, t, { mode: 'reality', k: 0.35 + 0.25 * bk, seed: 331 });
  }

  /* 3-04 [44.2..57.0]：虎辇侧近景跟拍余慈凝眸远眺，虚空界膜乱流呼啸 */
  function draw304(c, t) {
    var u = U.clamp((t - 44.2) / 12.8, 0, 1);
    var cam = M.cam(t, [
      [44.2, { x: -24, y: -14, zoom: 1.10 }],
      [57.0, { x:  28, y:   8, zoom: 1.18 }, 'smooth']
    ]);
    I.plate(c, 'p-three-voids-dish', { cam: cam, grade: { dark: 0.12, cool: 0.08 } });

    inWorld(c, cam, function () {
      I.realm(c, t, { x: 820, y: 520, R: 680, k: 1, chaos: 1.25, a: 0.42, seed: 333 });
      I.wind(c, { x: 0, y: 120, w: W, h: 760, n: 16, t: t * 1.4, dir: 0.06, a: 0.28, rgb: PAL.cyanMist, seed: 334 });
    });

    // 虎辇御风横空：缩小余慈与护卫神将（约 0.70x）立于玉舆前轩，下摆收进车底仙云软垫
    var chX = U.lerp(775, 845, u), chY = U.lerp(755, 740, u);
    inWorld(c, cam, function () {
      I.wash(c, chX - 15, chY - 35, 340, 68, 0.48, 335, [226, 224, 214], 0, { edge: 'soft' });
    });
    rigAt(c, 'sp-tiger-carriage', t, chX, chY, 425, cam, {
      ground: false, script: SC_GALE, seed: 335
    });
    rigAt(c, 'sp-punish-gen-2', t, chX + 26, chY - 98, 225, cam, {
      ground: false, alpha: 0.88, script: SC_GUARD
    });
    rigAt(c, 'sp-yuci-look-3', t, chX - 72, chY - 96, 300, cam, {
      ground: false, script: SC_GALE, amp: 1.2
    });
    inWorld(c, cam, function () {
      // 车舆底盘翻涌仙云自然遮掩人物袍摆底边，使其稳乘玉舆之内
      I.wash(c, chX - 65, chY - 92, 165, 42, 0.86, 339, [234, 232, 222], -0.04, { edge: 'soft' });
      I.wash(c, chX + 18, chY - 82, 185, 46, 0.76, 346, PAL.cyanMist, 0.03, { edge: 'soft' });
    });

    inPar(c, cam, 1.32, function () {
      ZL.spiritDust(c, t, { n: 36, rgb: PAL.cyanHi, speed: 62, dir: 0.08, a: 0.46, seed: 336 });
      I.mistBand(c, t, { x0: -100, y: 660, w: W + 200, h: 340, speed: -54, warp: 26, a: 0.36, seed: 337 });
    });
    ZL.chronalVignette(c, t, { mode: 'dream', k: 0.44, seed: 338 });
  }

  /* 3-05 [57.0..72.0]：真实之域右半幅——大黑天佛轮嫁接烛龙王六道光阴日轮（cue: standoff） */
  function draw305(c, t) {
    var cam = M.cam(t, [
      [57.0, { x: 175, y: -38, zoom: 1.22 }],
      [72.0, { x:  85, y: -12, zoom: 1.10 }, 'smooth']
    ]);
    I.plate(c, 'p-eight-immortals', { cam: cam, grade: { warm: 0.12, dark: 0.06 } });
    I.plateFlow(c, 'p-eight-immortals', t, { cam: cam, amp: 8, scale: 240, speed: 0.22, band: [0.0, 0.65], alpha: 0.72, seed: 340 });

    inWorld(c, cam, function () {
      // 狂暴赤金劫火衬底＋水墨飞白六道光阴日轮精确叠合右上佛轮
      I.sunfire(c, t, { x: 1520, y: 455, w: 680, h: 420, n: 14, dir: -Math.PI * 0.62, mix: [0, 0.22, 1], k: 0.88, a: 0.56, speed: 1.15, paleBg: 0.6, seed: 341 });
      ZL.sixPathsWheel(c, t, { x: 1545, y: 278, r: 268, timeK: 1.08, a: 0.94, seed: 47 });
      // 崖顶四位邪道/佛宗地仙脚下翻涌的暗浊煞潮
      I.turbid(c, t, { x0: 1080, y: 545, w: 920, h: 380, speed: 38, warp: 30, a: 0.36, seed: 342 });
      ZL.spiritDust(c, t, { n: 44, box: [1040, 60, 880, 640], rgb: PAL.redGold, speed: 38, dir: -2.4, a: 0.58, seed: 343 });
    });

    I.plateMist(c, t, { y: H * 0.78, h: 260, a: 0.24, rgb: [228, 214, 198], speed: 24, cam: cam, seed: 344 });
    ZL.chronalVignette(c, t, { mode: 'reality', k: 0.42, seed: 345 });
  }

  /* 3-06 [72.0..86.0]：真实之域左半幅——叶缤清冽剑意、幻荣仙姿与诸仙隔空相持 */
  function draw306(c, t) {
    var cam = M.cam(t, [
      [72.0, { x: -175, y: -24, zoom: 1.20 }],
      [86.0, { x:  -85, y:  -6, zoom: 1.10 }, 'smooth']
    ]);
    I.plate(c, 'p-eight-immortals', { cam: cam, grade: { cool: 0.10 } });

    inWorld(c, cam, function () {
      // 四道冲霄清冽气机（叶缤雪白剑脊灵明＋羽清玄/邵天尊青白仙光）
      I.sunfire(c, t, { x: 470, y: 535, w: 540, h: 380, n: 12, dir: -Math.PI * 0.46, mix: [1, 0.85, 0], k: 0.78, a: 0.46, speed: 0.85, paleBg: 0.55, seed: 347 });
      I.spineLight(c, t, { x0: 455, y0: 530, x1: 540, y1: 120, u: 0.48, sprout: 0.92, len: 150, n: 4, a: 0.86, paleBg: 0.7, seed: 348 });
      I.spineLight(c, t, { x0: 545, y0: 535, x1: 685, y1: 185, u: 0.45, sprout: 0.78, len: 125, n: 3, a: 0.74, paleBg: 0.6, seed: 349 });

      // 周期性横空清冽剑气飞白
      var cyc = Math.floor((t - 72.0) / 3.6), t0 = 72.4 + cyc * 3.6;
      I.flyWhite(c, t, { x0: 290, y0: 460, x1: 860, y1: 250, w: 48, t0: t0, dur: 0.28, hold: 1.4, fade: 0.9, kind: 'ink', tint: PAL.stoneCyan, a: 0.52, seed: 350 + cyc });
    });

    // 幻荣夫人衣袂飘举立于左侧云峰之上
    rigAt(c, 'sp-huanrong', t, 355, 625, 345, cam, {
      ground: true, groundRgb: PAL.cyanMist, groundA: 0.42, script: SC_IMMORTAL, amp: 1.15, seed: 352
    });

    inPar(c, cam, 1.28, function () {
      ZL.spiritDust(c, t, { n: 36, box: [40, 80, 920, 680], rgb: PAL.cyanHi, speed: 26, dir: -0.55, a: 0.52, seed: 353 });
    });
    I.plateMist(c, t, { y: H * 0.76, h: 280, a: 0.26, speed: -18, cam: cam, seed: 354 });
    ZL.chronalVignette(c, t, { mode: 'dream', k: 0.36, seed: 355 });
  }

  /* 3-07 [86.0..102.2]：八仙死寂全景，命中 H08 @ 92.0s（G512.0）——雪崩只差最后一嗓！ */
  function draw307(c, t) {
    var tHit = 92.0;
    var ts = M.hitStop(t, [[tHit, 0.09, 0.34]]);
    var st = M.strike(t, tHit, { pre: 1.6, go: 0.15, post: 2.4 });
    var baseCam = M.cam(ts, [
      [ 86.0, { x: 0, y: -8, zoom: 1.01 }],
      [ 92.0, { x: 0, y:  0, zoom: 1.05 }, 'smooth'],
      [102.2, { x: 0, y:  6, zoom: 1.08 }, 'linear']
    ]);
    var cam = M.kickCam(baseCam, M.kick(t, tHit, { amp: 10, f: 4.8, dir: Math.PI * 0.5, zAmp: 0.028, life: 1.4, seed: 357 }));

    I.plate(c, 'p-eight-immortals', { cam: cam, grade: { dark: 0.04 + 0.14 * st.imp } });

    // H08 后万物凝滞：日轮转速骤降，声场与气流宛如冻结
    var wheelSpd = t < tHit ? 1.0 : U.lerp(0.12, 0.28, U.clamp((t - tHit) / 8.0, 0, 1));

    inWorld(c, cam, function () {
      // 左极：青白剑气山岳般峙立；右极：烛龙六道光阴轮压顶
      I.sunfire(c, ts, { x: 470, y: 530, w: 460, h: 310, n: 10, dir: -Math.PI * 0.35, mix: [1, 0.9, 0], k: 0.72, a: 0.42, speed: wheelSpd, paleBg: 0.5, seed: 358 });
      I.spineLight(c, ts, { x0: 470, y0: 525, x1: 690, y1: 210, u: 0.5, sprout: 0.85, len: 120, n: 3, a: 0.75, paleBg: 0.6, seed: 359 });

      I.sunfire(c, ts, { x: 1540, y: 470, w: 540, h: 350, n: 11, dir: -Math.PI * 0.68, mix: [0, 0.2, 1], k: 0.82, a: 0.48, speed: wheelSpd, paleBg: 0.55, seed: 360 });
      ZL.sixPathsWheel(c, ts, { x: 1585, y: 270, r: 235, timeK: wheelSpd, a: 0.90, seed: 47 });

      // 中央死寂留白区（x ≈ 960）：两股灭世气机挤压出的无形锋面与 H08 冰裂颤纹
      var squeeze = 0.35 + 0.45 * st.pre + 0.35 * st.imp;
      I.snap(c, t, { x0: 958, y0: 140, x1: 962, y1: 790, t0: 999, u: 0.5, rgb: PAL.inkSoft, w: 2.2, a: 0.38 * squeeze, paleBg: 0.5, seed: 361 });
      M.inkRing(c, t, tHit, { x: 960, y: 465, r: 540, flat: 0.36, rgb: PAL.inkSoft, a: 0.58, life: 1.5, seed: 362 });

      if (t >= tHit - 0.2) {
        var frostA = U.clamp((t - (tHit - 0.2)) / 0.25, 0, 1) * (1 - 0.35 * U.ramp(t, tHit + 2.5, 102.2)) * 0.52;
        I.flow(c, 'fx-crack-gold', ts, { key: 'paper', tint: PAL.inkSoft, dst: [740, 120, 440, 680], alpha: frostA, vignette: { rx: 0.85, ry: 0.95, soft: 0.5 } });
      }
    });

    rigAt(c, 'sp-huanrong', ts, 330, 610, 215, cam, { ground: false, alpha: 0.86, script: SC_IMMORTAL });

    // H08 低频心跳暗压
    var beatPulse = t >= tHit ? 0.16 * Math.pow(Math.max(0, Math.sin((t - tHit) * Math.PI * 0.625)), 6) : 0;
    I.press(c, 0.18 + 0.32 * st.imp + beatPulse, { seed: 363 });
    M.flashInk(c, t, tHit, { x: 960, y: 465, white: 0.03, ink: 0.09, a: 0.65 });
    ZL.chronalVignette(c, t, { mode: 'reality', k: 0.46 + 0.18 * st.imp, seed: 364 });
  }

  /* 3-08 [102.2..115.0]：潜入洗玉湖底幽暗墨水层，李伯才水墨暗影一闪隐没（暗场 dark:true） */
  function draw308(c, t) {
    var u = U.clamp((t - 102.2) / 12.8, 0, 1);
    var cam = M.cam(t, [
      [102.2, { x: -30, y: 125, zoom: 1.32 }],
      [115.0, { x:  35, y: 175, zoom: 1.44 }, 'smooth']
    ]);
    I.plate(c, 'p-three-voids-dish', { cam: cam, grade: { dark: 0.35, cool: 0.28 } });
    I.nightSky(c, 0.78, { rgb: [14, 28, 30], low: 0.88, seed: 366 });

    inWorld(c, cam, function () {
      I.turbid(c, t, { x0: -120, y: 240, w: W + 240, h: 780, speed: 28, warp: 42, dark: 'invert', a: 0.42, seed: 367 });

      // 104.0–111.8s：李伯才窥伺黑影如水中鬼魅斜掠深渊暗流，旋即墨散无痕
      if (t >= 104.0 && t <= 111.8) {
        var su = U.clamp((t - 104.0) / 7.6, 0, 1);
        var lx = U.lerp(520, 1340, U.smooth(su));
        var ly = 695 - 38 * Math.sin(Math.PI * su) + 16 * Math.sin(t * 1.9);
        M.unreveal(c, t, 109.0, 2.5, function (L) {
          var fadeIn = U.clamp((t - 104.0) / 1.1, 0, 1);
          // 拖曳的水墨暗流披风尾迹
          var wake = [
            [lx - 190, ly - 115 + 18 * Math.sin(t * 2.6)],
            [lx - 95,  ly - 135 - 12 * Math.cos(t * 2.2)],
            [lx - 12,  ly - 145]
          ];
          I.sweep(L, wake, { raw: true, n: 24, w: 68, a: 0.58 * fadeIn, rgb: [10, 16, 18], dry: 0.42, seed: 368, head: 0.55, tail: 0.08 });
          I.wash(L, lx - 25, ly - 130, 190, 125, 0.66 * fadeIn, 369, [10, 16, 18], -0.12, { edge: 'wet' });
          I.figure(L, {
            x: lx, y: ly, s: 295, face: 1, pose: I.pose('fly', { lean: 0.34, head: -0.22 }),
            wind: 1.25, wash: 0.96, lineRGB: [8, 12, 14],
            clothRGB: [14, 22, 24], a: 0.92 * fadeIn, seed: 370
          });
          // 阴鸷窥伺微光一闪即逝
          if (t > 106.2 && t < 108.8) {
            var glint = Math.sin(Math.PI * U.clamp((t - 106.2) / 2.6, 0, 1));
            L.save();
            L.globalCompositeOperation = 'lighter';
            I.glow(L, lx + 24, ly - 245, 24, PAL.cyanHi, 0.68 * glint);
            L.restore();
          }
        }, { from: [lx, ly - 120], seed: 371 });

        I.inkSplash(c, t, { x: 1240, y: 565, size: 460, t0: 109.2, dur: 0.45, hold: 0.8, fade: 1.2, v: 2, dark: true, tint: PAL.abyssGreen, a: 0.48, seed: 372 });
      }

      I.turbid(c, t, { x0: -120, y: 520, w: W + 240, h: 560, speed: -44, warp: 48, dark: 'invert', a: 0.38, seed: 372 });
      ZL.spiritDust(c, t, { n: 46, rgb: PAL.cyan, speed: 20, dir: -Math.PI * 0.4, a: 0.44, scorch: false, seed: 373 });
    });

    I.press(c, 0.45 + 0.1 * u, { seed: 374 });
    ZL.chronalVignette(c, t, { mode: 'star', k: 0.62, seed: 375 });
  }

  /* 3-09 [115.0..128.0]：虎辇急坠向神庭真核，四周云气由清白渐染沉郁旧血色 */
  function draw309(c, t) {
    var u = U.clamp((t - 115.0) / 13.0, 0, 1);
    var cam = M.cam(t, [
      [115.0, { x: -20, y: -42, zoom: 1.08 }],
      [128.0, { x:  18, y:  42, zoom: 1.18 }, 'smooth']
    ]);
    I.plate(c, 'p-siyu-archway', { cam: cam, grade: { dark: 0.08 + 0.14 * u, warm: 0.06 + 0.12 * u } });

    inWorld(c, cam, function () {
      // 前段浓雾掩住门庭主体，表现高空穿云下坠
      I.strata(c, t, { dir: 'down', speed: 240, a: 0.28 * (1 - 0.5 * u), red: 0.2 + 0.6 * u, seed: 377 });
      I.wash(c, 960, 480, 980, 420, 0.72 * (1 - 0.55 * u), 378, U.mix([216, 214, 206], [136, 96, 86], u), 0, { edge: 'soft' });
      I.bloodTide(c, t, { x0: -80, y: U.lerp(760, 540, u), w: W + 160, h: 480, speed: 48, warp: 28, a: 0.12 + 0.36 * u, seed: 379 });
    });

    var cx = U.lerp(720, 980, u), cy = U.lerp(420, 620, U.smooth(u));
    rigAt(c, 'sp-tiger-carriage', t, cx, cy, U.lerp(330, 275, u), cam, {
      ground: false, script: SC_GALE
    });
    rigAt(c, 'sp-yuci-look-2', t, cx - 58, cy - 48, U.lerp(340, 285, u), cam, {
      ground: false, script: SC_GALE, amp: 1.25
    });
    rigAt(c, 'sp-crane-boy', t, cx + 240, cy + 25, U.lerp(220, 185, u), cam, {
      ground: false, script: SC_GLIDE
    });

    inPar(c, cam, 1.35, function () {
      I.mistBand(c, t, { x0: -120, y: 460, w: W + 240, h: 460, speed: -58, warp: 32, tint: U.mix([210, 214, 208], PAL.bloodRust, u * 0.7), a: 0.44, seed: 380 });
      ZL.spiritDust(c, t, { n: 34, rgb: U.mix(PAL.cyanHi, PAL.redGold, u), speed: 55, dir: 1.15, a: 0.42, seed: 381 });
    });
    ZL.chronalVignette(c, t, { mode: 'reality', k: 0.32 + 0.32 * u, seed: 382 });
  }

  /* 3-10 [128.0..142.0]：浓雾裂开仰拍「四御门庭·九间十柱」，十五道天魔黑影盘踞嘶嚎（cue: archway） */
  function draw310(c, t) {
    var u = U.clamp((t - 128.0) / 14.0, 0, 1);
    var cam = M.cam(t, [
      [128.0, { x:  18, y: -24, zoom: 1.14 }],
      [142.0, { x:  -8, y:   8, zoom: 1.04 }, 'smooth']
    ]);
    I.plate(c, 'p-siyu-archway', { cam: cam, grade: { dark: 0.12, warm: 0.08 } });
    I.plateFlow(c, 'p-siyu-archway', t, { cam: cam, amp: 6, scale: 260, speed: 0.16, band: [0.02, 0.55], alpha: 0.72, seed: 384 });

    inWorld(c, cam, function () {
      ZL.meltShadows(c, t, { x: 960, y: 470, r: 460, purifyK: 0, n: 15, a: 0.92, seed: 37 });
      I.bloodTide(c, t, { x0: -80, y: 690, w: W + 160, h: 360, speed: 28, warp: 22, a: 0.26, seed: 385 });
      // 开镜前 2.2s 残雾向两侧分开揭示牌坊
      var veilA = (1 - U.smooth(U.clamp((t - 128.0) / 2.4, 0, 1))) * 0.48;
      if (veilA > 0.01) I.mistBand(c, t, { x0: -80, y: 180, w: W + 160, h: 520, speed: 45, warp: 30, a: veilA, seed: 386 });
    });

    // 前景左侧白鹤童子盘旋引路，衬托九间十柱牌坊之恢宏苍凉
    rigAt(c, 'sp-crane-boy', t, U.lerp(285, 365, u), U.lerp(725, 695, u), 225, cam, {
      ground: true, groundRgb: PAL.inkSoft, groundA: 0.24, script: SC_GLIDE, seed: 387
    });

    I.plateMist(c, t, { y: H * 0.82, h: 240, a: 0.26, rgb: [186, 174, 158], speed: -18, cam: cam, seed: 388 });
    ZL.chronalVignette(c, t, { mode: 'reality', k: 0.56, seed: 389 });
  }

  /* 3-11 [142.0..151.0]：群魔黑影扑向车驾，金甲掌刑神将踏辕怒立，高举赤金符诏蓄势 */
  function draw311(c, t) {
    var u = U.clamp((t - 142.0) / 9.0, 0, 1);
    var cam = M.cam(t, [
      [142.0, { x: -20, y:  32, zoom: 1.08 }],
      [145.6, { x:   5, y:  38, zoom: 1.11 }, 'smooth'],
      [147.2, { x:  18, y:  -8, zoom: 1.20 }, 'expoOut'],
      [151.0, { x:  24, y: -18, zoom: 1.23 }, 'smooth']
    ]);
    var liftHit = M.kick(t, 145.8, { amp: 9, f: 5.5, dir: -Math.PI * 0.5, zAmp: 0.025, life: 0.9, seed: 391 });
    cam = M.kickCam(cam, liftHit);

    I.plate(c, 'p-siyu-archway', { cam: cam, grade: { dark: 0.16, warm: 0.08 } });

    inWorld(c, cam, function () {
      // 天魔黑影俯冲逼压车驾
      ZL.meltShadows(c, t, { x: 960, y: 485, r: 410 - 45 * u, purifyK: 0.04 * u, n: 15, a: 0.94, seed: 37 });
    });

    // 虎辇与护卫副将、主御举诏金甲神将
    rigAt(c, 'sp-tiger-carriage', t, 760, 825, 355, cam, {
      ground: true, groundRgb: PAL.scorchDk, groundA: 0.42, script: SC_GALE, seed: 392
    });
    rigAt(c, 'sp-punish-gen-2', t, 560, 815, 395, cam, {
      ground: true, groundRgb: PAL.scorchDk, groundA: 0.38, script: SC_GUARD, seed: 393
    });
    rigAt(c, 'sp-punish-gen-1', t, 985, 810, 495, cam, {
      ground: true, groundRgb: PAL.scorchDk, groundA: 0.46, script: SC_HOIST, amp: 1.25, seed: 394
    });

    // 神将双手高举过顶处的赤金符诏蓄势金芒（对准 sp-punish-gen-1 右上方举诏手位）
    inWorld(c, cam, function () {
      var glowK = U.smooth(U.clamp((t - 144.8) / 5.5, 0, 1));
      var ex = 1095, ey = 352 - 18 * glowK;
      if (t >= 149.2) {
        M.inkShock(c, t, { t0: 149.2, dur: 1.8, x: ex, y: ey, R: 360, flat: 0.62, inward: true, rgb: PAL.gold, a: 0.52, seed: 395 });
      }
      ZL.tadpoleEdict(c, t, { x: ex, y: ey, s: 0.62 + 0.14 * glowK, morphK: 0.24 * glowK, unfoldK: 0, cyanK: 0, a: 0.35 + 0.65 * glowK, seed: 31 });
      c.save();
      c.globalCompositeOperation = 'lighter';
      I.glow(c, ex, ey, 110 + 130 * glowK, PAL.goldHi, 0.38 * glowK);
      c.restore();
    });

    ZL.chronalVignette(c, t, { mode: 'reality', k: 0.62, seed: 396 });
  }

  /* 3-12 [151.0..166.0]：命中 H09 / cue: purify @ 154.0s（G574.0）！蝌蚪游鱼结成恢宏金章，沸汤沃雪净魔 */
  function draw312(c, t) {
    var tHit = 154.0;
    var ts = M.hitStop(t, [[tHit, 0.07, 0.26]]);
    var st = M.strike(t, tHit, { pre: 1.6, go: 0.16, post: 2.4 });
    var baseCam = M.cam(ts, [
      [151.0, { x: 16, y: -12, zoom: 1.16 }],
      [153.8, { x:  8, y: -28, zoom: 1.18 }, 'expoIn'],
      [154.3, { x:  0, y: -18, zoom: 1.05 }, 'expoOut'],
      [166.0, { x:  0, y:   4, zoom: 1.02 }, 'smooth']
    ]);
    var cam = M.kickCam(baseCam, M.kick(t, tHit, { amp: 15, f: 6.0, dir: Math.PI * 0.5, zAmp: 0.042, life: 1.3, seed: 398 }));

    var postK = U.clamp((ts - tHit) / 11.5, 0, 1);
    var morphK = t < tHit ? 0.24 + 0.28 * st.pre : U.lerp(0.52, 1.0, M.expoOut(U.clamp((ts - tHit) / 1.8, 0, 1), 5));
    var unfoldK = t < tHit ? 0.0 : M.expoOut(U.clamp((ts - tHit) / 3.2, 0, 1), 4);
    // 沸汤沃雪金光疾速外推涤荡，避免半途停驻成椭圆框线
    var purifyK = t < tHit ? 0.04 : U.lerp(0.08, 0.94, M.expoOut(U.clamp((ts - tHit) / 4.8, 0, 1), 3.5));

    I.plate(c, 'p-siyu-archway', { cam: cam, grade: { dark: 0.14 * (1 - 0.7 * postK), warm: 0.14 } });

    inWorld(c, cam, function () {
      if (t < tHit) {
        M.inkShock(c, t, { t0: 152.2, dur: 1.8, x: 960, y: 295, R: 420, flat: 0.55, inward: true, rgb: PAL.gold, a: 0.52, seed: 399 });
      }
      // 十五道盘踞天魔在金光倾泻下如沸汤沃雪消融化烟
      ZL.meltShadows(c, ts, { x: 960, y: 485, r: 465, purifyK: purifyK, n: 15, a: 0.95, seed: 37 });

      // 苍穹七行蝌蚪游鱼恢宏金章展开
      ZL.tadpoleEdict(c, ts, { x: 960, y: 285, s: 1.26, morphK: morphK, unfoldK: unfoldK, cyanK: 0, a: 0.96, seed: 31 });

      // H09 不规则破空飞白金刷与倾泻霞晕（禁用连续几何椭圆光环！）
      I.flyWhite(c, t, { x0: 320,  y0: 270, x1: 1620, y1: 235, w: 88, t0: tHit,        dur: 0.28, hold: 1.5, fade: 1.2, kind: 'gold', a: 0.76, seed: 400 });
      I.flyWhite(c, t, { x0: 880,  y0: 250, x1: 310,  y1: 660, w: 72, t0: tHit + 0.18, dur: 0.34, hold: 1.8, fade: 1.4, kind: 'gold', a: 0.62, seed: 401 });
      I.flyWhite(c, t, { x0: 1040, y0: 250, x1: 1610, y1: 650, w: 72, t0: tHit + 0.28, dur: 0.34, hold: 1.8, fade: 1.4, kind: 'gold', a: 0.62, seed: 402 });
      I.flyWhite(c, t, { x0: 540,  y0: 360, x1: 1390, y1: 540, w: 64, t0: tHit + 1.9,  dur: 0.42, hold: 2.0, fade: 1.5, kind: 'gold', a: 0.50, seed: 403 });

      if (t >= tHit) {
        var pourA = Math.sin(Math.PI * U.clamp((t - tHit) / 9.5, 0, 1)) * 0.36;
        c.save();
        c.globalCompositeOperation = 'lighter';
        I.wash(c, 680,  430, 310, 145, pourA, 435, PAL.gold, -0.32, { edge: 'soft' });
        I.wash(c, 1240, 440, 320, 150, pourA, 436, PAL.gold,  0.30, { edge: 'soft' });
        I.wash(c, 960,  320, 420, 130, pourA * 0.9, 437, PAL.goldHi, 0, { edge: 'soft' });
        c.restore();
      }
      M.inkShock(c, t, { t0: tHit, dur: 1.25, x: 960, y: 340, R: 760, flat: 0.44, rgb: PAL.gold, a: 0.64, seed: 438 });
      ZL.spiritDust(c, ts, { n: 64, rgb: PAL.goldHi, speed: 48, dir: Math.PI * 0.5, a: 0.68 * unfoldK, seed: 404 });
    });

    // 下方门前神将高举符诏之威仪剪影
    rigAt(c, 'sp-punish-gen-1', ts, 960, 885, 290, cam, {
      ground: true, groundRgb: PAL.scorchDk, groundA: 0.35, script: SC_GUARD, seed: 405
    });

    M.flashInk(c, t, tHit, { x: 960, y: 290, white: 0.05, ink: 0.06, a: 0.90 });
    ZL.chronalVignette(c, t, { mode: 'dream', k: 0.36, seed: 406 });
  }

  /* 3-13 [166.0..180.0]：缓推穿过涤净后的九间十柱石坊，残余魔影化烟殆尽，漫天神文敛回 */
  function draw313(c, t) {
    var u = U.clamp((t - 166.0) / 14.0, 0, 1);
    var cam = M.cam(t, [
      [166.0, { x: 0, y:   4, zoom: 1.02 }],
      [180.0, { x: 0, y: -14, zoom: 1.14 }, 'smooth']
    ]);
    I.plate(c, 'p-siyu-archway', { cam: cam, grade: { warm: 0.08 * (1 - u), cool: 0.06 * u } });

    inWorld(c, cam, function () {
      var pk = U.lerp(0.94, 1.0, U.clamp(u * 1.4, 0, 1));
      ZL.meltShadows(c, t, { x: 960, y: 485, r: 465, purifyK: pk, n: 15, a: 0.92, seed: 37 });
      ZL.tadpoleEdict(c, t, {
        x: 960, y: U.lerp(290, 390, U.smooth(u)),
        s: U.lerp(1.22, 0.86, U.smooth(u)),
        morphK: U.lerp(0.95, 0.28, U.smooth(u)),
        unfoldK: U.lerp(0.96, 0.12, U.smooth(u)),
        cyanK: 0.15 * U.smooth(u),
        a: 0.94, seed: 31
      });
      ZL.spiritDust(c, t, { n: 48, rgb: U.mix(PAL.goldHi, PAL.cyanHi, u * 0.35), speed: 30, dir: -Math.PI * 0.5, a: 0.58, seed: 408 });
    });

    rigAt(c, 'sp-tiger-carriage', t, 930, 815, U.lerp(235, 195, u), cam, {
      ground: true, groundRgb: PAL.inkSoft, groundA: 0.26, script: SC_GLIDE, seed: 409
    });

    I.plateMist(c, t, { y: H * 0.78, h: 250, a: 0.22, speed: 14, cam: cam, seed: 410 });
    ZL.chronalVignette(c, t, { mode: 'dream', k: 0.34, seed: 411 });
  }

  /* 3-14 [180.0..195.2]：特写符诏褪去太霄赤金，化作莹莹湖玉青光——太霄权柄归入云霄（cue: cyan） */
  function draw314(c, t) {
    var u = U.clamp((t - 180.0) / 15.2, 0, 1);
    var cyanK = U.lerp(0.15, 1.0, U.smooth(U.clamp((t - 180.6) / 7.6, 0, 1)));
    var cam = M.cam(t, [
      [180.0, { x: -16, y: -22, zoom: 1.06 }],
      [195.2, { x:  14, y:  -6, zoom: 1.16 }, 'smooth']
    ]);

    // 先垫虚焦四御门庭气韵，再平稳切入双手捧诏特写 cu-talisman-hand
    var handIn = U.smooth(U.clamp((t - 180.0) / 1.4, 0, 1));
    if (handIn < 0.999) {
      I.plate(c, 'p-siyu-archway', { cam: cam, grade: { dark: 0.12 } });
      rigAt(c, 'sp-punish-gen-1', t, 830, 850, 420, cam, { alpha: 1 - handIn, script: SC_GUARD });
      rigAt(c, 'sp-yuci-pose-set-3', t, 1110, 855, 415, cam, { flip: 'h', alpha: 1 - handIn, script: SC_GLIDE });
    }
    I.plate(c, 'cu-talisman-hand', { cam: cam, alpha: handIn, grade: { cool: 0.14 * cyanK } });

    // 对准 cu-talisman-hand 中符纸精确像素中心与倾角 (936, 262, -0.28rad) 叠绘完整赤金→湖玉青光蜕变层
    inWorld(c, cam, function () {
      var tx = 936, ty = 262;
      if (cyanK > 0.03) {
        c.save();
        c.translate(tx, ty);
        c.rotate(-0.28);
        // 沿整张斜置符纸全长（约 125×320）覆盖温润湖玉青色晕，彻底褪尽原画上下端赤金残色
        I.wash(c, 0, -4, 108, 225, 0.86 * cyanK * handIn, 413, PAL.cyan, 0, { edge: 'soft' });
        I.wash(c, -4, -18, 92, 198, 0.82 * cyanK * handIn, 414, PAL.cyanHi, 0, { edge: 'soft' });
        I.wash(c, 6, 48, 86, 138, 0.78 * cyanK * handIn, 420, PAL.jadeHi, 0, { edge: 'soft' });
        c.globalCompositeOperation = 'lighter';
        I.glow(c, 0, 0, 185, PAL.cyanHi, 0.34 * cyanK * handIn);
        c.restore();
      }
      c.save();
      c.translate(tx, ty);
      c.rotate(-0.28);
      ZL.tadpoleEdict(c, t, {
        x: 0, y: 0, s: 1.18,
        morphK: 0.24 + 0.14 * Math.sin(t * 1.1),
        unfoldK: 0.06,
        cyanK: cyanK,
        a: 0.96 * handIn, seed: 31
      });
      c.restore();

      I.sunfire(c, t, { x: tx + 10, y: ty + 145, w: 320, h: 280, n: 9, dir: -Math.PI * 0.5, mix: [1, 0.35, 0], k: 0.65 * cyanK, a: 0.42 * handIn, speed: 0.75, paleBg: 0.5, seed: 415 });
      I.ring(c, t, { t0: 181.2, x: tx, y: ty + 55, r: 240, flat: 0.32, spin: 0.38, rise: 24, acc: 4, grow: 0.12, life: 4.5, tone: 'qing', a: 0.52 * handIn, paleBg: 0.55, seed: 416 });
      I.ring(c, t, { t0: 186.5, x: tx, y: ty + 55, r: 260, flat: 0.32, spin: -0.34, rise: 22, acc: 4, grow: 0.12, life: 4.8, tone: 'qing', a: 0.56 * handIn, paleBg: 0.55, seed: 417 });
      ZL.spiritDust(c, t, { n: 48, box: [480, 40, 960, 740], rgb: U.mix(PAL.goldHi, PAL.cyanHi, cyanK), speed: 24, dir: -Math.PI * 0.5, a: 0.58 * handIn, seed: 418 });
    });

    ZL.chronalVignette(c, t, { mode: 'dream', k: 0.35, seed: 419 });
  }

  /* 3-15 [195.2..210.0]：白鹤童子施礼化烟散去，虎辇独载余慈与二神将驶入封神台暗赭雾障 */
  function draw315(c, t) {
    var u = U.clamp((t - 195.2) / 14.8, 0, 1);
    var cam = M.cam(t, [
      [195.2, { x:  12, y:  10, zoom: 1.12 }],
      [210.0, { x: -10, y: -16, zoom: 1.26 }, 'smooth']
    ]);
    I.plate(c, 'p-siyu-archway', { cam: cam, grade: { dark: 0.14 + 0.16 * u, warm: 0.10 + 0.10 * u } });

    inWorld(c, cam, function () {
      // 门庭深处翻涌而出的封神台暗红血煞与迷雾
      I.bloodTide(c, t, { x0: -80, y: U.lerp(660, 480, u), w: W + 160, h: 480, speed: 34, warp: 26, a: 0.28 + 0.32 * u, seed: 421 });
      I.wash(c, 960, 520, 360, 320, 0.35 + 0.35 * u, 422, PAL.bloodRust, 0, { edge: 'wet' });
    });

    // 虎辇与二神将穿过中门向封神孤峰深处独行（远去缩小）
    var chU = U.smooth(U.clamp((t - 198.0) / 11.8, 0, 1));
    var chX = U.lerp(690, 955, chU), chY = U.lerp(755, 655, chU), chH = U.lerp(310, 185, chU);
    var chAlpha = 1 - 0.35 * U.ramp(t, 206.5, 210.0);
    rigAt(c, 'sp-tiger-carriage', t, chX, chY, chH, cam, {
      ground: true, groundRgb: PAL.scorchDk, groundA: 0.34 * chAlpha, alpha: chAlpha, script: SC_GLIDE, seed: 423
    });
    rigAt(c, 'sp-punish-gen-1', t, chX + chH * 0.32, chY - chH * 0.12, chH * 0.88, cam, {
      ground: false, alpha: 0.86 * chAlpha, script: SC_GUARD
    });
    inWorld(c, cam, function () {
      // 车驾上方莹莹湖玉青光符诏护持破煞
      ZL.tadpoleEdict(c, t, { x: chX + chH * 0.36, y: chY - chH * 0.92, s: 0.52 * (chH / 310), cyanK: 1.0, morphK: 0.28, a: 0.88 * chAlpha, seed: 31 });
    });

    // 右侧前景：青衣白鹤童子拱手施礼（195.2–201.3s），随后寸寸水墨虚化散作清烟与飘羽（201.3–204.2s）
    if (t < 204.3) {
      M.unreveal(c, t, 201.3, 2.8, function (L) {
        rigAt(L, 'sp-crane-boy', t, 1295, 735, 285, cam, {
          flip: 'h', ground: true, groundRgb: PAL.cyanMist, groundA: 0.30, script: SC_CRANE_BOW, seed: 424
        });
      }, { from: [1295, 600], seed: 425 });
    }
    inWorld(c, cam, function () {
      // 化烟升腾的青白轻雾与漫空虚化白羽（dur=2.0 令本体早收，仅留 16 片白羽在 201.5–206.0s 随风虚化消散，绝不叠重影！）
      if (t >= 201.0 && t <= 206.8) {
        var smokeU = U.clamp((t - 201.0) / 5.2, 0, 1);
        var smA = Math.sin(Math.PI * smokeU) * 0.52;
        for (var k = 0; k < 5; k++) {
          I.wash(c, 1295 + (k - 2) * 38 + 45 * smokeU, 625 - k * 28 - 95 * smokeU, 95 + 65 * smokeU, 48 + 32 * smokeU, smA * (1 - k * 0.12), 430 + k, PAL.cyanMist, -0.12, { edge: 'soft' });
        }
      }
      if (t >= 201.4) {
        ZL.craneFlight(c, t, { t0: 199.4, dur: 1.9, x0: 1260, y0: 615, x1: 1460, y1: 495, s: 0.82, feathers: 16, a: 0.78 * (1 - U.ramp(t, 204.8, 208.2)), seed: 426 });
      }
      I.mistBand(c, t, { x0: -100, y: 560, w: W + 200, h: 420, speed: -32, warp: 28, tint: U.mix([190, 196, 188], PAL.bloodRust, u), a: 0.34 + 0.24 * u, seed: 427 });
    });

    I.press(c, 0.22 + 0.32 * u, { seed: 428 });
    ZL.chronalVignette(c, t, { mode: 'reality', k: 0.45 + 0.35 * u, seed: 429 });
  }

  var DRAWERS = [
    draw301, draw302, draw303, draw304, draw305,
    draw306, draw307, draw308, draw309, draw310,
    draw311, draw312, draw313, draw314, draw315
  ];

  CINE.registerAct({
    id: 'act3',
    order: 3,
    name: '三 · 三界危局',
    duration: 210,
    beats: SHEET.beats,
    cues: {
      standoff: { t: 57.0,  label: '八仙对峙' },
      archway:  { t: 128.0, label: '四御门庭' },
      purify:   { t: 154.0, label: '沸汤沃雪' },
      cyan:     { t: 180.0, label: '符诏化青' }
    },
    plates: 'p-three-voids-dish p-eight-immortals p-siyu-archway cu-talisman-hand sp-crane-boy sp-tiger-carriage sp-yuci-look-2 sp-yuci-look-3 sp-yuci-pose-set-3 sp-huanrong sp-punish-gen-1 sp-punish-gen-2 fx-mist-tex fx-crack-gold fx-turbid-tex fx-realm-edge fx-sunfire-hong fx-sunfire-qing fx-sunfire-bai fx-ring-brush-oval fx-ring-brush-round fx-inksplash-1 fx-inksplash-2 fx-inksplash-3 fx-bloodtide-tex fx-flywhite-gold fx-flywhite-ink fx-strata-tex',
    draw: function (c, t) {
      var bs = SHEET.beats, idx = 0;
      while (idx + 1 < bs.length && t >= bs[idx + 1].t) idx++;
      I.paper(c);
      c.save();
      DRAWERS[idx](c, t);
      c.restore();
      // 3-08 湖底深渊暗场采用浅宣纸色字幕，其余浅宣纸矿物底采用浓墨字幕
      var isDark = (idx === 7);
      I.screen(c);
      I.ledger(c, t, 'act3', { dark: isDark });
    }
  });
})();
