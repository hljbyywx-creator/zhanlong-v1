/* 《斩龙封神》第四幕 act4.js —— 四 · 血链问刀（240.0s，G: 630.0 – 870.0，16 镜）
   核心戏眼：封神台凝滞血雾与时光长河 → 台缘血须道人与脚下残首 → 双眸骤睁赤芒幽绿无尽（H10）→
            反手重拳轰胸爆出二十二条上清符文血链（H11）→ 余慈步空刷青光驯龙煞、问名控台 →
            道人大笑负链登斩龙台，顶升澹澹水烟清光问刀（H12）→ 「如此，请前辈上路！请符诏！」青光冲霄入第五幕。
   工程铁律：100% 纯 t 确定性（零 Math.random / Date / 跨帧可变状态）；复用常量 rig script 对象；零几何圆框硬线。 */
(function () {
  'use strict';
  var CINE = window.CINE, I = CINE.ink, U = CINE.util, M = CINE.motion, ZL = CINE.zl;
  var W = CINE.W || 1920, H = CINE.H || 1080;

  if (I.speaker) {
    I.speaker('道人', [168, 146, 116]);
    I.speaker('影鬼', [118, 126, 138]);
  }

  var PAL = (ZL && ZL.PAL) || {
    bloodHi: [124, 36, 28], bloodMid: [104, 28, 25], bloodRust: [68, 22, 20],
    gold: [188, 156, 92], goldHi: [216, 190, 132], goldBronze: [138, 108, 56],
    cyan: [88, 148, 146], cyanHi: [148, 198, 192], cyanMist: [176, 212, 206],
    stoneCyan: [64, 114, 122], jade: [46, 128, 96], jadeHi: [92, 172, 136],
    abyssGreen: [38, 96, 78], abyssDeep: [20, 52, 44], violet: [78, 62, 98],
    ink: [24, 22, 20], inkSoft: [48, 44, 40], scorch: [82, 58, 40], scorchDk: [44, 34, 30]
  };

  /* ---------- 常量骨骼/风场脚本（严禁每帧新建对象，保护 lib-rig Map 缓存） ---------- */
  var SC_CLIFF_GALE = {
    wind: { dirDeg: 10, base: 0.78 },
    breathe: { period: 4.4, amp: 1.0 }
  };
  var SC_HEAD_STILL = {
    wind: { dirDeg: 12, base: 0.08 },
    breathe: { period: 6.0, amp: 0.1 }
  };
  var SC_YUCI_WIND = {
    wind: { dirDeg: 192, base: 0.68 },
    breathe: { period: 3.6, amp: 1.0 }
  };
  var SC_PRE_PUNCH = {
    root: [
      { t: 81.0, dx: 0, dy: 0, rot: 0, s: 1.0 },
      { t: 83.6, dx: -16, dy: -12, rot: -0.035, s: 1.03, ease: 'inOutSine' },
      { t: 84.82, dx: -24, dy: -18, rot: -0.05, s: 1.04, ease: 'inQuad' },
      { t: 85.0, dx: 22, dy: 28, rot: 0.045, s: 0.97, ease: 'inCubic' }
    ],
    wind: { dirDeg: 14, base: 0.95, gust: [{ t: 83.5, dur: 1.6, amp: 1.4 }] },
    breathe: { period: 2.6, amp: 1.4 }
  };
  var SC_STEP_AIR = {
    root: [
      { t: 110.2, dx: -40, dy: -32 },
      { t: 111.5, dx: 0, dy: 0, rot: 0.02, ease: 'outBack' },
      { t: 118.0, dx: 26, dy: 14, rot: 0, ease: 'inOutSine' },
      { t: 126.0, dx: 34, dy: 18, ease: 'inOutSine' }
    ],
    wind: { dirDeg: 16, base: 0.62, gust: [{ t: 111.4, dur: 1.8, amp: 1.25 }] },
    impulse: [{ t: 111.5, x: 1, y: 0.3, amp: 1.3 }],
    breathe: { period: 3.6, amp: 1.0 }
  };
  var SC_BOW_ASK = {
    root: [
      { t: 126.0, dy: 0, rot: 0 },
      { t: 127.6, dx: 12, dy: 10, rot: 0.05, ease: 'inOutSine' },
      { t: 132.4, dx: 10, dy: 8, rot: 0.04, ease: 'inOutSine' },
      { t: 134.0, dx: 0, dy: 0, rot: 0, ease: 'outSine' }
    ],
    wind: { dirDeg: 15, base: 0.45 },
    breathe: { period: 3.8, amp: 0.9 }
  };
  var SC_ASCEND_WALK = (function () {
    var keys = [{ t: 156.0, dx: 0, dy: 0, rot: -0.03 }];
    var imps = [{ t: 157.4, x: 0.4, y: -1, amp: 1.1 }];
    for (var s = 0; s < 8; s++) {
      var ts = 158.0 + s * 1.65;
      keys.push({ t: ts - 0.35, dy: -12, rot: 0.015, ease: 'inSine' });
      keys.push({ t: ts, dy: 6, rot: -0.02, ease: 'outQuad' });
      imps.push({ t: ts, x: 0.8, y: 0.6, amp: 0.95 });
    }
    keys.push({ t: 173.0, dy: 0, rot: 0, ease: 'inOutSine' });
    return {
      root: keys,
      wind: { dirDeg: 196, base: 0.85 },
      impulse: imps,
      breathe: { period: 3.2, amp: 1.2 }
    };
  })();
  var SC_FINAL_SALUTE = {
    root: [
      { t: 224.8, dy: 0, rot: 0 },
      { t: 226.4, dx: 16, dy: 14, rot: 0.06, ease: 'inOutSine' },
      { t: 231.2, dx: 14, dy: 12, rot: 0.05, ease: 'inOutSine' },
      { t: 232.6, dx: -4, dy: -14, rot: -0.02, s: 1.03, ease: 'outBack' },
      { t: 240.0, dx: -6, dy: -18, rot: -0.015, s: 1.04, ease: 'inOutSine' }
    ],
    wind: { dirDeg: 14, base: 0.72, gust: [{ t: 232.4, dur: 3.2, amp: 1.35 }] },
    impulse: [{ t: 232.5, x: 0.3, y: -1.0, amp: 1.4 }],
    breathe: { period: 3.4, amp: 1.1 }
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
      var gw = targetH * (o.groundW || 0.42), gh = gw * (o.groundFlat || 0.24);
      var ga = (o.alpha == null ? 1 : o.alpha) * (o.groundA == null ? 0.38 : o.groundA);
      I.wash(c, wx, footY - gh * 0.15, gw, gh, ga, o.seed || 23, o.groundRgb || PAL.scorchDk, 0, { edge: o.groundEdge || 'soft' });
      c.restore();
    }

    return I.rig(c, id, t, {
      cam: rigCam, s: s, dx: dx, dy: dy, flip: o.flip,
      alpha: o.alpha, script: o.script || SC_CLIFF_GALE, amp: o.amp, strain: o.strain, mode: o.mode
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

  /* 穿胸透腹前景补笔：在道人立绘之上叠绘穿出前胸肋腹的四道短铁索头与上清金印，消除「铁链只贴背后」的平面感 */
  function drawFrontPierce(c, t, cx, cy, rattle, spikes, a) {
    var A = a == null ? 0.88 : a;
    I.wash(c, cx, cy, 42, 36, 0.52 * A, 601, PAL.bloodRust, 0, { edge: 'wet' });
    var dirs = [[-0.42, -0.22], [0.46, -0.18], [-0.48, 0.28], [0.44, 0.32]];
    for (var i = 0; i < 4; i++) {
      var vib = (rattle || 0.2) * 4 * Math.sin(t * 19 + i * 2.1);
      var x1 = cx + dirs[i][0] * 135, y1 = cy + dirs[i][1] * 115 + vib;
      var pts = [[cx + dirs[i][0] * 8, cy + dirs[i][1] * 8], [cx + dirs[i][0] * 68, cy + dirs[i][1] * 56 + 10], [x1, y1 + 18]];
      I.sweep(c, pts, { raw: true, n: 16, w: 12, a: 0.82 * A, rgb: PAL.bloodMid, dry: 0.3, seed: 610 + i, head: 0.08, tail: 0.45 });
      I.stroke(c, pts, { raw: true, n: 16, w: 3.2, a: 0.68 * A, rgb: PAL.goldHi, seed: 620 + i, head: 0.15, tail: 0.55, bleed: 0 });
      if (spikes > 0.1) {
        var mx = pts[1][0], my = pts[1][1];
        I.stroke(c, [[mx, my], [mx + (i % 2 ? 12 : -12) * spikes, my - 14 * spikes]], { w: 4.2, a: 0.85 * A * spikes, rgb: PAL.ink, seed: 630 + i, head: 0.1, tail: 0.8, bleed: 0 });
      }
    }
    c.save();
    c.globalCompositeOperation = 'lighter';
    I.glow(c, cx, cy, 52, PAL.gold, 0.34 * A * (0.8 + 0.2 * Math.sin(t * 3.2)));
    c.restore();
  }

  /* ---------- 拍表定义（严格对齐 BRIEF.md 4-01 .. 4-16，总长 240.0s） ---------- */
  var SHEET = CINE.beatSheet([
    ['4-01',   0.0,  15.0, '封神斩龙台全景'],
    ['4-02',  15.0,  29.0, '台缘血须道人'],
    ['4-03',  29.0,  42.0, '脚边瞋目残首'],
    ['4-04',  42.0,  55.0, '余慈凛眉入真'],
    ['4-05',  55.0,  69.0, '双眸赤芒幽绿'],
    ['4-06',  69.0,  81.0, '承启天众骇然'],
    ['4-07',  81.0,  95.8, '重拳血链穿胸'],
    ['4-08',  95.8, 110.2, '至纯上清法度'],
    ['4-09', 110.2, 126.0, '青光刷落驯煞'],
    ['4-10', 126.0, 141.0, '躬身问名拒讳'],
    ['4-11', 141.0, 156.0, '可控斩龙台否'],
    ['4-12', 156.0, 173.0, '大笑负链登台'],
    ['4-13', 173.0, 190.5, '坦陈封魔求死'],
    ['4-14', 190.5, 208.0, '问刀可为接引'],
    ['4-15', 208.0, 224.8, '水烟压煞立约'],
    ['4-16', 224.8, 240.0, '请前辈上路请诏']
  ]);

  /* ==================== 各镜绘制实现 ==================== */

  /* 4-01 [0.0..15.0]：孤峰绝顶封神斩龙台全景——漫天血雾悬停凝滞，虚空深处时光长河暗涌 */
  function draw401(c, t) {
    var cam = M.cam(t, [
      [ 0.0, { x: -50, y: -12, zoom: 1.03 }],
      [15.0, { x:  22, y:   6, zoom: 1.12 }, 'smooth']
    ]);
    I.plate(c, 'p-zhanlong-terrace', { cam: cam, grade: { dark: 0.08, warm: 0.06 } });

    inWorld(c, cam, function () {
      // 底层虚空时光长河浩渺暗涌
      ZL.timeRiver(c, t, { y: 690, h: 480, mode: 'roar', k: 0.46, a: 0.52, seed: 53 });
      // 半空凝滞悬停的暗红血雾与琥珀定格血珠
      ZL.timeRiver(c, t, { y: 460, h: 680, mode: 'frozen', k: 1.0, a: 0.90, seed: 55 });
      I.bloodTide(c, t, { x0: 840, y: 470, w: 960, h: 240, speed: 6, warp: 12, a: 0.24, seed: 401 });
    });

    // 远景崖端伏笔：孤立绝壁边缘的道人剪影与脚旁极小残首（比例严丝合缝）
    rigAt(c, 'sp-severed-head', t, 518, 566, 25, cam, {
      ground: true, groundW: 0.9, groundA: 0.45, groundRgb: PAL.ink, script: SC_HEAD_STILL, mode: 'sway', seed: 402
    });
    rigAt(c, 'sp-yang-disguise', t, 556, 564, 142, cam, {
      ground: true, groundRgb: PAL.scorchDk, groundA: 0.42, script: SC_CLIFF_GALE, seed: 403
    });

    I.plateMist(c, t, { y: H * 0.84, h: 240, a: 0.22, rgb: [168, 152, 138], speed: -10, cam: cam, seed: 404 });
    ZL.chronalVignette(c, t, { mode: 'reality', k: 0.58, seed: 405 });
  }

  /* 4-02 [15.0..29.0]：长焦缓推台缘负手独立之道人——血须凝硬如铁，脚畔暗墨残首 */
  function draw402(c, t) {
    var cam = M.cam(t, [
      [15.0, { x: -215, y:  -6, zoom: 1.16 }],
      [29.0, { x: -265, y: -22, zoom: 1.30 }, 'smooth']
    ]);
    I.plate(c, 'p-zhanlong-terrace', { cam: cam, grade: { dark: 0.10, warm: 0.08 } });

    inWorld(c, cam, function () {
      ZL.timeRiver(c, t, { y: 690, h: 420, mode: 'roar', k: 0.38, a: 0.42, seed: 53 });
      ZL.timeRiver(c, t, { y: 470, h: 640, mode: 'frozen', k: 0.82, a: 0.85, seed: 55 });
      I.wind(c, { x: 180, y: 180, w: 980, h: 560, n: 14, t: t * 1.15, dir: 0.04, a: 0.24, rgb: [148, 132, 120], seed: 407 });
    });

    // 脚边残首严格按真人头颅比例（targetH=72 vs 全身 targetH=445 ≈ 1:6.2）置于左脚外侧地面
    rigAt(c, 'sp-severed-head', t, 502, 668, 72, cam, {
      ground: true, groundW: 0.95, groundFlat: 0.28, groundA: 0.52, groundRgb: PAL.ink,
      groundEdge: 'wet', script: SC_HEAD_STILL, mode: 'sway', seed: 408
    });
    rigAt(c, 'sp-yang-disguise', t, 595, 660, 445, cam, {
      ground: true, groundW: 0.48, groundA: 0.46, groundRgb: PAL.scorchDk,
      script: SC_CLIFF_GALE, amp: 1.25, seed: 409
    });

    inPar(c, cam, 1.3, function () {
      I.mistBand(c, t * 0.25, { x0: -120, y: 680, w: 1200, h: 340, speed: -14, warp: 18, tint: PAL.bloodRust, a: 0.26, seed: 410 });
    });
    ZL.chronalVignette(c, t, { mode: 'reality', k: 0.62, seed: 411 });
  }

  /* 4-03 [29.0..42.0]：贴地横移掠过苍老暗墨残首，上摇至道人染血袍角（埋腐骨化灰草蛇灰线） */
  function draw403(c, t) {
    var u = U.clamp((t - 29.0) / 13.0, 0, 1);
    var cam = M.cam(t, [
      [29.0, { x: -210, y: 118, zoom: 1.38 }],
      [42.0, { x: -125, y:  78, zoom: 1.48 }, 'smooth']
    ]);
    I.plate(c, 'p-zhanlong-terrace', { cam: cam, grade: { dark: 0.14, warm: 0.08 } });

    inWorld(c, cam, function () {
      // 崖面陈年干涸暗血晕痕与低空死寂浊雾
      I.turbid(c, t * 0.35, { x0: 260, y: 650, w: 1100, h: 320, speed: 12, warp: 22, a: 0.32, seed: 413 });
      I.wash(c, 650, 775, 185, 42, 0.56, 414, PAL.bloodRust, -0.05, { edge: 'wet' });
      I.wash(c, 920, 790, 240, 52, 0.48, 415, PAL.scorchDk, 0.04, { edge: 'wet' });
    });

    // 贴地近景：左侧地面残首（s ≈ 0.078，符合 0.055–0.085 规范上限）＋右侧高耸的染血道袍下摆
    rigAt(c, 'sp-severed-head', t, 645, 780, 116, cam, {
      ground: true, groundW: 1.05, groundFlat: 0.26, groundA: 0.58, groundRgb: PAL.ink,
      groundEdge: 'wet', script: SC_HEAD_STILL, mode: 'sway', seed: 416
    });
    rigAt(c, 'sp-yang-disguise', t, 935, 815, 650, cam, {
      ground: true, groundW: 0.46, groundA: 0.50, groundRgb: PAL.scorchDk,
      script: SC_CLIFF_GALE, amp: 1.15, seed: 417
    });

    inWorld(c, cam, function () {
      // 残首上方偶浮几粒极淡金石光阴微尘（暗伏第五幕腐骨化灰）
      ZL.spiritDust(c, t, { n: 22, box: [520, 580, 320, 220], rgb: PAL.goldBronze, speed: 12, dir: -Math.PI * 0.45, a: 0.38 * u, seed: 418 });
      ZL.timeRiver(c, t, { y: 620, h: 420, mode: 'frozen', k: 0.65, a: 0.72, seed: 55 });
    });

    ZL.chronalVignette(c, t, { mode: 'reality', k: 0.68, seed: 419 });
  }

  /* 4-04 [42.0..55.0]：反打推近虎辇上余慈凛冽眉宇——「这不再是梦境，而是真正的现实！」 */
  function draw404(c, t) {
    var u = U.clamp((t - 42.0) / 13.0, 0, 1);
    var cam = M.cam(t, [
      [42.0, { x: 115, y: -24, zoom: 1.12 }],
      [55.0, { x: 155, y: -42, zoom: 1.25 }, 'smooth']
    ]);
    I.plate(c, 'p-zhanlong-terrace', { cam: cam, grade: { dark: 0.12 + 0.08 * u, warm: 0.06 } });

    inWorld(c, cam, function () {
      I.bloodTide(c, t, { x0: 420, y: 540, w: 1460, h: 420, speed: -38, warp: 26, a: 0.34, seed: 421 });
      ZL.timeRiver(c, t, { y: 480, h: 580, mode: 'frozen', k: 0.72, a: 0.78, seed: 55 });
    });

    // 虎辇悬停台外云端（水平翻转朝左直对封神台），余慈立于辇前凝眉直视
    rigAt(c, 'sp-tiger-carriage', t, 1210, 775, 420, cam, {
      flip: 'h', ground: true, groundRgb: PAL.scorchDk, groundA: 0.32, script: SC_YUCI_WIND, seed: 422
    });
    rigAt(c, 'sp-punish-gen-2', t, 1410, 745, 360, cam, {
      ground: false, alpha: 0.78, script: SC_YUCI_WIND
    });
    rigAt(c, 'sp-yuci-look-3', t, 1055, 760, 525, cam, {
      flip: 'h', ground: false, script: SC_YUCI_WIND, amp: 1.2
    });

    inWorld(c, cam, function () {
      // 余慈袖侧湖玉青光符诏静悬，映照凛冽铁锈罡风
      ZL.tadpoleEdict(c, t, { x: 935, y: 475, s: 0.56, cyanK: 1.0, morphK: 0.22, a: 0.78, seed: 31 });
      I.wind(c, { x: 520, y: 180, w: 1200, h: 560, n: 15, t: t * 1.35, dir: -0.05, a: 0.26, rgb: PAL.bloodHi, seed: 423 });
    });

    I.press(c, 0.18 + 0.22 * u, { seed: 424 });
    ZL.chronalVignette(c, t, { mode: 'reality', k: 0.52 + 0.28 * u, seed: 425 });
  }

  /* 4-05 [55.0..69.0]：命中 H10 / cue: eyes @ 58.0s（G688.0）！双眸骤睁，赤芒刺破银幕，眼底石绿深渊坍缩 */
  function draw405(c, t) {
    var tHit = 58.0;
    var ts = M.hitStop(t, [[tHit, 0.07, 0.24]]);
    var st = M.strike(t, tHit, { pre: 1.8, go: 0.12, post: 2.2 });
    var baseCam = M.cam(ts, [
      [55.0, { x: 28, y: -22, zoom: 1.04 }],
      [57.9, { x: 28, y: -24, zoom: 1.02 }, 'smooth'],
      [58.2, { x: 34, y: -32, zoom: 1.09 }, 'expoOut'],
      [69.0, { x: 42, y: -38, zoom: 1.18 }, 'smooth']
    ]);
    var cam = M.kickCam(baseCam, M.kick(t, tHit, { amp: 13, f: 6.8, dir: Math.PI * 0.5, zAmp: 0.045, life: 1.15, seed: 427 }));

    var openK = t < tHit ? 0.06 + 0.05 * st.pre : U.lerp(0.18, 1.0, M.expoOut(U.clamp((ts - tHit) / 0.28, 0, 1), 6));

    I.plate(c, 'cu-yang-eyes', { cam: cam, grade: { dark: t < tHit ? 0.22 : 0.08, cool: t >= tHit ? 0.08 : 0 } });
    if (t >= tHit) {
      I.plateFlow(c, 'cu-yang-eyes', ts, { cam: cam, amp: 5, scale: 220, speed: 0.18, band: [0.25, 0.65], alpha: 0.55, seed: 428 });
    }

    // 精确锁定 cu-yang-eyes 实测左右瞳孔坐标：(534, 460) 与 (1498, 458)！
    inWorld(c, cam, function () {
      // 55.0–58.0s 似瞌非瞌蓄势期：以浓墨沧桑眼睑阴影半掩原画双瞳，令 58.0s 骤睁反差惊心动魄
      var lidCover = 1 - U.smooth(U.clamp((openK - 0.12) / 0.55, 0, 1));
      if (lidCover > 0.01) {
        I.wash(c, 534, 456, 210, 62, 0.88 * lidCover, 429, [58, 46, 38], 0.03, { edge: 'soft' });
        I.wash(c, 1498, 454, 210, 62, 0.88 * lidCover, 430, [58, 46, 38], -0.03, { edge: 'soft' });
      }

      ZL.abyssEyes(c, ts, { x: 534,  y: 460, s: 1.18, openK: openK, single: true, a: 0.96, seed: 59 });
      ZL.abyssEyes(c, ts, { x: 1498, y: 458, s: 1.18, openK: openK, single: true, a: 0.96, seed: 63 });

      // 骤睁刹那双瞳迸发的石绿魔渊冲击与朱砂寒芒
      I.inkSplash(c, t, { x: 534,  y: 460, size: 460, t0: tHit, dur: 0.28, hold: 0.9, fade: 1.1, v: 1, tint: PAL.abyssGreen, vary: true, a: 0.48, seed: 431 });
      I.inkSplash(c, t, { x: 1498, y: 458, size: 460, t0: tHit, dur: 0.28, hold: 0.9, fade: 1.1, v: 1, tint: PAL.abyssGreen, vary: true, a: 0.48, seed: 432 });
      M.inkRing(c, t, tHit, { x: 1016, y: 460, r: 720, flat: 0.35, rgb: PAL.abyssGreen, a: 0.52, life: 1.2, seed: 433 });

      if (t >= tHit) {
        ZL.spiritDust(c, ts, { n: 36, box: [180, 260, 1660, 420], rgb: PAL.jadeHi, speed: 22, dir: -Math.PI * 0.5, a: 0.46, seed: 434 });
      }
    });

    M.flashInk(c, t, tHit, { x: 1016, y: 460, white: 0.035, ink: 0.085, a: 0.82 });
    I.press(c, 0.24 + 0.22 * st.imp, { seed: 435 });
    ZL.chronalVignette(c, t, { mode: 'reality', k: 0.68, seed: 436 });
  }

  /* 悬停虎辇云座组合：在左侧云海边缘托起白虎玉舆、余慈与二位掌刑神将，明确「驻辇云端隔台对峙」而非徒步站地 */
  function drawHaltedChariot(c, t, chX, chY, chH, cam, alpha) {
    var A = alpha == null ? 1 : alpha;
    if (A <= 0.005) return;
    var k = chH / 340;

    inWorld(c, cam, function () {
      // 车底厚实蓬松的多层水墨云海软垫，遮断背后崖石使车驾凌空悬浮于云渊之上
      I.wash(c, chX - 10 * k, chY - 18 * k, 320 * k, 78 * k, 0.82 * A, 640, [224, 218, 204], 0, { edge: 'soft' });
      I.wash(c, chX + 45 * k, chY - 6 * k,  270 * k, 64 * k, 0.72 * A, 641, [202, 208, 202], 0.04, { edge: 'soft' });
      I.wash(c, chX - 95 * k, chY - 8 * k,  230 * k, 58 * k, 0.68 * A, 642, PAL.cyanMist, -0.04, { edge: 'soft' });
    });

    // 虎辇玉舆本体居底，余慈与二位金甲掌刑神将合比例乘立车辕之上
    rigAt(c, 'sp-tiger-carriage', t, chX, chY, chH, cam, {
      ground: false, alpha: A, script: SC_CLIFF_GALE, seed: 643
    });
    rigAt(c, 'sp-punish-gen-2', t, chX - 138 * k, chY - 82 * k, 212 * k, cam, {
      flip: 'h', ground: false, alpha: 0.90 * A, script: SC_CLIFF_GALE
    });
    rigAt(c, 'sp-yuci-stand-w', t, chX - 64 * k, chY - 86 * k, 242 * k, cam, {
      ground: false, alpha: 0.98 * A, script: SC_CLIFF_GALE, amp: 1.1
    });
    rigAt(c, 'sp-punish-gen-1', t, chX + 26 * k, chY - 80 * k, 218 * k, cam, {
      ground: false, alpha: 0.92 * A, script: SC_CLIFF_GALE
    });

    // 前景云絮轻拢车底与人物袍摆下缘，彻底消除落地错觉
    inWorld(c, cam, function () {
      I.wash(c, chX - 68 * k, chY - 76 * k, 165 * k, 40 * k, 0.84 * A, 644, [232, 228, 216], -0.03, { edge: 'soft' });
      I.wash(c, chX + 28 * k, chY - 68 * k, 175 * k, 42 * k, 0.76 * A, 645, [218, 222, 214],  0.03, { edge: 'soft' });
      I.wash(c, chX,          chY - 12 * k, 290 * k, 48 * k, 0.68 * A, 646, [226, 220, 208],  0,    { edge: 'soft' });
    });
  }

  /* 4-06 [69.0..81.0]：轰胸前对峙全景——左侧云端虎辇悬停（载余慈与二神将、秘阵声回荡），右侧台缘道人魔意沸腾！ */
  function draw406(c, t) {
    var u = U.clamp((t - 69.0) / 12.0, 0, 1);
    var cam = M.cam(t, [
      [69.0, { x: -45, y:  -6, zoom: 1.05 }],
      [81.0, { x:  15, y: -16, zoom: 1.13 }, 'smooth']
    ]);
    I.plate(c, 'p-zhanlong-terrace', { cam: cam, grade: { dark: 0.10 + 0.08 * u, warm: 0.06 } });

    inWorld(c, cam, function () {
      ZL.timeRiver(c, t, { y: 680, h: 460, mode: 'roar', k: 0.45, a: 0.50, seed: 53 });
      ZL.timeRiver(c, t, { y: 470, h: 640, mode: 'frozen', k: 0.85, a: 0.84, seed: 55 });
      I.mistBand(c, t * 0.4, { x0: -80, y: 540, w: 860, h: 280, speed: 18, warp: 20, tint: [216, 214, 206], a: 0.42, seed: 438 });

      // 台缘道人周身翻涌的凶戾石绿墨血魔氛（「好凶的魔意，台上锁着什么怪物？」）
      var miasma = 0.55 + 0.35 * u;
      I.wash(c, 1215, 455, 165 * (0.9 + 0.2 * Math.sin(t * 2.1)), 195, 0.46 * miasma, 439, PAL.abyssDeep, 0, { edge: 'wet' });
      I.wash(c, 1225, 420, 120, 145, 0.38 * miasma, 440, PAL.bloodRust, 0.15, { edge: 'wet' });
      I.bloodTide(c, t, { x0: 920, y: 520, w: 760, h: 260, speed: 22, warp: 22, a: 0.28 * miasma, seed: 441 });
    });

    // 右侧封神台：道人孤立崖石、魔气冲霄，脚旁小残首伏地
    rigAt(c, 'sp-severed-head', t, 1125, 642, 54, cam, {
      ground: true, groundW: 0.95, groundA: 0.50, groundRgb: PAL.ink, script: SC_HEAD_STILL, mode: 'sway', seed: 442
    });
    rigAt(c, 'sp-yang-disguise', t, 1215, 635, 395, cam, {
      ground: true, groundW: 0.48, groundA: 0.48, groundRgb: PAL.scorchDk, script: SC_CLIFF_GALE, amp: 1.2, seed: 443
    });

    // 左侧云海边缘：白虎玉舆稳托余慈与二位掌刑神将隔台遥对！
    var chX = 435, chY = 645 + 6 * Math.sin(t * 1.1);
    drawHaltedChariot(c, t, chX, chY, 345, cam, 1.0);

    inWorld(c, cam, function () {
      // 余慈身畔湖玉青光符诏与承启天影鬼传音秘阵波纹（T075 70.0–77.2s）
      ZL.tadpoleEdict(c, t, { x: chX + 55, y: chY - 245, s: 0.50, cyanK: 1.0, morphK: 0.24, a: 0.84, seed: 31 });
      if (I.arrayWave && t >= 69.8 && t <= 77.6) {
        I.arrayWave(c, t, { x: chX - 65, y: chY - 215, r: 155, a: 0.56 });
      }
    });

    // 79.0–81.0s 为下一镜重拳轰胸预压紧绷暗调
    I.press(c, 0.18 + 0.26 * U.ramp(t, 78.8, 81.0), { seed: 451 });
    ZL.chronalVignette(c, t, { mode: 'reality', k: 0.58, seed: 452 });
  }

  /* 4-07 [81.0..95.8]：命中 H11 / cue: chains @ 85.0s（G715.0）！反手重拳轰胸（0.10s 顿帧），22 条上清血链爆射穿身！ */
  function draw407(c, t) {
    var tHit = 85.0;
    var ts = M.hitStop(t, [[tHit, 0.10, 0.32]]);
    var st = M.strike(t, tHit, { pre: 1.6, go: 0.16, post: 2.4, wind: 0.16 });

    // 第一阶段 [81.0 .. 85.0)：承接 4-06 空间轴线（左云端悬停虎辇，右台上道人沉肩扬拳蓄势，未现铁索！）
    if (t < tHit) {
      var preCam = M.cam(t, [
        [81.0, { x:  35, y: -14, zoom: 1.14 }],
        [84.3, { x: 115, y: -22, zoom: 1.08 }, 'smooth'],
        [85.0, { x: 135, y: -26, zoom: 1.06 }, 'expoIn']
      ]);
      I.plate(c, 'p-zhanlong-terrace', { cam: preCam, grade: { dark: 0.14 + 0.16 * st.pre, warm: 0.08 } });

      var yangX = 1145, yangFootY = 705;

      inWorld(c, preCam, function () {
        ZL.timeRiver(c, t, { y: 500, h: 620, mode: 'frozen', k: 0.85, a: 0.82, seed: 55 });
        // 胸膛内狂暴魔气与上清禁制向内疯狂坍缩吸气（呼应配乐 S.kill 硬停蓄力）
        M.inkShock(c, t, { t0: 83.2, dur: 1.8, x: yangX, y: 445, R: 480, flat: 0.65, inward: true, rgb: PAL.bloodHi, a: 0.62, seed: 454 });
        I.wash(c, yangX, 445, 110 * st.pre, 95 * st.pre, 0.46 * st.pre, 455, PAL.abyssGreen, 0, { edge: 'wet' });
      });

      // 左侧云海边缘延续驻停的虎辇与余慈、二神将，保持完美空间连续性
      drawHaltedChariot(c, t, 395, 655 + 5 * Math.sin(t * 1.1), 320, preCam, 0.94);

      rigAt(c, 'sp-severed-head', t, yangX - 115, yangFootY + 8, 72, preCam, {
        ground: true, groundW: 0.95, groundA: 0.5, groundRgb: PAL.ink, script: SC_HEAD_STILL, mode: 'sway', seed: 456
      });
      rigAt(c, 'sp-yang-disguise', t, yangX, yangFootY, 515, preCam, {
        ground: true, groundW: 0.48, groundA: 0.48, groundRgb: PAL.scorchDk,
        script: SC_PRE_PUNCH, amp: 1.45, seed: 457
      });

      // 右拳蓄力扬起至反手轰胸的刚猛残影弧
      inWorld(c, preCam, function () {
        var coil = U.clamp((t - 81.8) / 3.2, 0, 1);
        var fistX = U.lerp(yangX + 75, yangX + 125, st.pre) - (st.phase === 'go' ? 125 * st.hit : 0);
        var fistY = U.lerp(495, 375, st.pre) + (st.phase === 'go' ? 65 * st.hit : 0);
        I.wash(c, fistX, fistY, 44 * coil, 38 * coil, 0.68 * coil, 458, PAL.ink, -0.4, { edge: 'wet' });
        c.save();
        c.globalCompositeOperation = 'lighter';
        I.glow(c, fistX, fistY, 68 * coil, PAL.gold, 0.42 * coil);
        c.restore();
        if (st.phase === 'go') {
          M.inkPath(c, t, { pts: [[yangX + 130, 375], [yangX + 75, 405], [yangX, 445]], t0: tHit - 0.16, dur: 0.15, w: 34, rgb: PAL.bloodHi, glow: PAL.gold, a: 0.92, seed: 459 });
        }
      });

      I.press(c, 0.25 + 0.38 * st.pre, { seed: 460 });
      ZL.chronalVignette(c, t, { mode: 'reality', k: 0.66 + 0.2 * st.pre, seed: 461 });
      return;
    }

    // 第二阶段 [85.0 .. 95.8]：重拳轰胸瞬切 il-yang-chains 意境大图＋22 条手腕粗符文血链三层纵深爆射锁死！
    var postCam = M.cam(ts, [
      [85.0, { x:   0, y: -18, zoom: 1.08 }],
      [85.4, { x:   0, y: -10, zoom: 1.03 }, 'expoOut'],
      [95.8, { x:  14, y: -24, zoom: 1.12 }, 'smooth']
    ]);
    var cam = M.kickCam(postCam, M.kick(t, tHit, { amp: 20, f: 6.5, dir: Math.PI * 0.5, zAmp: 0.055, life: 1.4, seed: 462 }));

    I.plate(c, 'il-yang-chains', { cam: cam, grade: { dark: 0.12 * st.imp, warm: 0.08 } });
    var warpAmp = 4 + 26 * Math.exp(-(t - tHit) / 0.85);
    I.plateFlow(c, 'il-yang-chains', ts, { cam: cam, amp: warpAmp, scale: 240, speed: 0.28, alpha: 0.78, seed: 463 });

    var eruptK = U.clamp((ts - tHit) / 0.52, 0, 1);
    var rattle = 0.26 + 0.58 * Math.exp(-(t - tHit) / 2.2);

    inWorld(c, cam, function () {
      var cx = 985, cy = 455; // il-yang-chains 胸腹阵枢
      // 22 条上清朱砂暗金符文血链跨远中近三层纵深穿体爆射！
      ZL.bloodChains(c, ts, { cx: cx, cy: cy, n: 22, eruptK: eruptK, rattle: rattle, spikes: 0.55, a: 0.72, seed: 61 });

      // 有机墨晕剪裁回贴原画中央道人面容、白袍与轰胸右拳，使人物主体挺立于漫天血链阵心不被红晕糊没！
      c.save();
      c.globalAlpha *= 0.90;
      I.blot(c, 955, 395, 195, 463, { sx: 0.78, sy: 1.48, rough: 0.22, n: 28 });
      c.clip();
      I.drawImg(c, 'il-yang-chains', 730, 80, 450, 630, 730, 80, 450, 630);
      c.restore();
      drawFrontPierce(c, ts, cx, cy - 20, rattle, 0.55, 0.85 * eruptK);

      // 轰胸冲击墨浪、飞白与铁血碎屑
      ZL.slashImpact(c, t, tHit, { x0: 1180, y0: 290, x1: 790, y1: 540, kind: 'blood', w: 58, dur: 0.13, a: 0.88, seed: 464 });
      M.inkShock(c, t, { t0: tHit, dur: 1.25, x: cx, y: cy, R: 780, flat: 0.48, rgb: PAL.bloodMid, a: 0.76, seed: 465 });
      M.inkShock(c, t, { t0: tHit + 0.14, dur: 1.45, x: cx, y: cy, R: 920, flat: 0.52, rgb: PAL.goldBronze, a: 0.58, seed: 466 });
      I.inkSplash(c, t, { x: cx, y: cy, size: 680, t0: tHit + 0.02, dur: 0.30, hold: 1.1, fade: 1.0, v: 0, tint: PAL.bloodHi, vary: true, a: 0.72, seed: 467 });
      M.after(c, t, tHit + 0.03, { x: cx, y: cy, dir: -Math.PI * 0.5, spread: 1.8, n: 28, v: 520, rgb: PAL.bloodMid, smokeRgb: PAL.scorch, a: 0.82, seed: 468 });

      // 88.2s 起（呼应配乐 cChains+3.2s 青铜编钟破云）：血链阵枢升起堂皇至纯的上清正统青金道环与灵尘！
      if (t >= 88.0) {
        var orthoK = U.smooth(U.clamp((t - 88.0) / 3.0, 0, 1));
        I.ring(c, t, { t0: 88.2, x: cx, y: cy + 30, r: 290, flat: 0.30, spin: 0.42, rise: 48, acc: 10, grow: 0.14, life: 4.2, tone: 'gold', a: 0.62 * orthoK, paleBg: 0.65, seed: 469 });
        I.ring(c, t, { t0: 90.6, x: cx, y: cy + 20, r: 320, flat: 0.30, spin: -0.36, rise: 52, acc: 12, grow: 0.14, life: 4.2, tone: 'qing', a: 0.58 * orthoK, paleBg: 0.60, seed: 470 });
        ZL.spiritDust(c, ts, { n: 52, box: [420, 80, 1120, 760], rgb: PAL.goldHi, speed: 34, dir: -Math.PI * 0.5, a: 0.62 * orthoK, seed: 471 });
      }
    });

    M.flashInk(c, t, tHit, { x: 985, y: 420, white: 0.055, ink: 0.095, a: 0.96 });
    I.press(c, 0.20 + 0.35 * st.imp, { seed: 472 });
    ZL.chronalVignette(c, t, { mode: 'reality', k: 0.64, seed: 473 });
  }

  /* 4-08 [95.8..110.2]：沿紧绷铁索横移特写古金上清篆文，叠承启天赵相山、血府老祖震骇观照 */
  function draw408(c, t) {
    var cam = M.cam(t, [
      [ 95.8, { x: -58, y: -22, zoom: 1.20 }],
      [110.2, { x:  56, y:   8, zoom: 1.26 }, 'smooth']
    ]);
    I.plate(c, 'il-yang-chains', { cam: cam, grade: { warm: 0.10 } });

    inWorld(c, cam, function () {
      var cx = 985, cy = 455;
      ZL.bloodChains(c, t, { cx: cx, cy: cy, n: 22, eruptK: 1.0, rattle: 0.22, spikes: 0.45, a: 0.70, seed: 61 });
      c.save();
      c.globalAlpha *= 0.92;
      I.blot(c, 955, 395, 195, 463, { sx: 0.78, sy: 1.48, rough: 0.22, n: 28 });
      c.clip();
      I.drawImg(c, 'il-yang-chains', 730, 80, 450, 630, 730, 80, 450, 630);
      c.restore();
      drawFrontPierce(c, t, cx, cy - 20, 0.22, 0.45, 0.82);

      // 至纯上清根本法度金光沿铁索流淌生辉
      I.flyWhite(c, t, { x0: cx - 35, y0: cy - 10, x1: 1580, y1: 185, w: 46, t0: 96.4, dur: 0.45, hold: 2.6, fade: 1.2, kind: 'gold', a: 0.64, seed: 475 });
      I.flyWhite(c, t, { x0: cx + 25, y0: cy + 15, x1: 340,  y1: 260, w: 44, t0: 100.2, dur: 0.45, hold: 2.6, fade: 1.2, kind: 'gold', a: 0.62, seed: 476 });
      I.ring(c, t, { t0: 96.6,  x: cx, y: cy + 10, r: 280, flat: 0.30, spin: 0.36, rise: 36, acc: 8, grow: 0.12, life: 4.8, tone: 'gold', a: 0.56, paleBg: 0.6, seed: 477 });
      I.ring(c, t, { t0: 102.4, x: cx, y: cy + 10, r: 300, flat: 0.30, spin: -0.34, rise: 38, acc: 8, grow: 0.12, life: 4.8, tone: 'qing', a: 0.54, paleBg: 0.6, seed: 478 });
      ZL.spiritDust(c, t, { n: 48, rgb: PAL.goldHi, speed: 28, dir: -Math.PI * 0.5, a: 0.56, seed: 479 });
    });

    // 右上角写意枯笔紫气镜影局部框（I.closeup）：人物精确居中于镜框 (1545, 245) 内！
    var inK = U.win(t, 97.0, 109.6, 0.9, 0.9);
    if (inK > 0.01 && I.closeup) {
      I.closeup(c, inK, { x: 1545, y: 245, rx: 235, ry: 150, seed: 480, ring: 0.62 }, function (L) {
        I.plate(L, 'p-chengqi-tree', { cam: { x: -120, y: -40, zoom: 1.22 }, grade: { dark: 0.10 } });
        I.wash(L, 1545, 245, 220, 135, 0.24, 482, PAL.violet, 0, { edge: 'soft' });
        if (t < 104.6) {
          rigAt(L, 'sp-zhao-set-3', t, 1545, 415, 315, null, { flip: 'h', ground: false, script: SC_YUCI_WIND });
        } else {
          rigAt(L, 'sp-xuefu-3', t, 1545, 400, 275, null, { ground: false, script: SC_YUCI_WIND });
        }
      });
    }

    ZL.chronalVignette(c, t, { mode: 'reality', k: 0.54, seed: 481 });
  }

  /* 4-09 [110.2..126.0]：余慈步空走下玉舆，「镇！」符诏青光刷落，冲霄残缺太古龙影尽皆俯首 */
  function draw409(c, t) {
    var tHit = 111.5; // T079「镇！」重音刻
    var ts = M.hitStop(t, [[tHit, 0.06, 0.22]]);
    var st = M.strike(t, tHit, { pre: 1.1, go: 0.14, post: 2.0 });
    var baseCam = M.cam(ts, [
      [110.2, { x:  55, y: -16, zoom: 1.06 }],
      [111.6, { x:  25, y:  -4, zoom: 1.10 }, 'expoOut'],
      [126.0, { x: -12, y:   8, zoom: 1.14 }, 'smooth']
    ]);
    var cam = M.kickCam(baseCam, M.kick(t, tHit, { amp: 12, f: 5.8, dir: 0.25, zAmp: 0.032, life: 1.1, seed: 483 }));

    I.plate(c, 'p-zhanlong-terrace', { cam: cam, grade: { dark: 0.08, cool: t >= tHit ? 0.08 : 0 } });

    var cowerMix = U.smooth(U.clamp((ts - tHit) / 2.2, 0, 1));

    inWorld(c, cam, function () {
      ZL.timeRiver(c, ts, { y: 490, h: 600, mode: 'frozen', k: 0.68, a: 0.72, seed: 55 });

      // 冲霄太古残缺天龙血煞：111.5s 前咆哮扑击(prowl)，青光刷落后哀鸣匍匐(cower)
      if (cowerMix < 0.99) {
        ZL.dragonSha(c, ts, { x: 1185, y: 435, s: 1.02, state: 'prowl', a: 0.92 * (1 - cowerMix), seed: 67 });
      }
      if (cowerMix > 0.01) {
        ZL.dragonSha(c, ts, { x: 1195, y: 495, s: 0.98, state: 'cower', a: 0.88 * cowerMix, seed: 67 });
      }
    });

    // 远景右侧云间停驻的白虎玉舆与神将
    rigAt(c, 'sp-tiger-carriage', ts, 420, 520, 235, cam, {
      ground: true, groundRgb: PAL.cyanMist, groundA: 0.28, script: SC_YUCI_WIND, seed: 484
    });

    // 余慈步空蹈虚走下车辇：足底绽开湖玉清波光环
    var yx = U.lerp(610, 695, U.smooth(U.clamp((ts - 110.2) / 9.0, 0, 1)));
    var yy = U.lerp(615, 675, U.smooth(U.clamp((ts - 110.2) / 9.0, 0, 1)));
    inWorld(c, cam, function () {
      I.ring(c, t, { t0: 110.3, x: 615, y: 618, r: 120, flat: 0.24, spin: 0.4, rise: -4, acc: 0, grow: 0.18, life: 3.2, tone: 'qing', a: 0.55, paleBg: 0.5, seed: 485 });
      I.ring(c, t, { t0: 113.8, x: 660, y: 652, r: 130, flat: 0.24, spin: -0.4, rise: -4, acc: 0, grow: 0.18, life: 3.2, tone: 'qing', a: 0.52, paleBg: 0.5, seed: 486 });
    });
    rigAt(c, 'sp-yuci-pose-set-3', ts, yx, yy, 445, cam, {
      ground: true, groundRgb: PAL.cyanMist, groundA: 0.34, script: SC_STEP_AIR, amp: 1.25, seed: 487
    });

    // 111.5s 余慈拂袖刷落湖玉青光符诏，横扫整座斩龙台镇伏群龙！
    inWorld(c, cam, function () {
      var edK = U.smooth(U.clamp((ts - 110.8) / 2.2, 0, 1));
      ZL.tadpoleEdict(c, ts, {
        x: U.lerp(yx + 95, 920, edK), y: U.lerp(yy - 250, 315, edK),
        s: 0.78 + 0.28 * edK, cyanK: 1.0, morphK: 0.65 * edK, unfoldK: 0.52 * edK, a: 0.94, seed: 31
      });
      ZL.slashImpact(c, t, tHit, { x0: 680, y0: 320, x1: 1520, y1: 580, kind: 'cyan', w: 62, dur: 0.16, a: 0.85, seed: 488 });
      M.inkShock(c, t, { t0: tHit, dur: 1.35, x: 1080, y: 520, R: 740, flat: 0.38, rgb: PAL.cyan, a: 0.66, seed: 489 });
      I.ring(c, t, { t0: tHit + 0.08, x: 1120, y: 560, r: 480, flat: 0.26, spin: 0.38, rise: -18, acc: -4, grow: 0.16, life: 4.0, tone: 'qing', a: 0.62, paleBg: 0.6, seed: 490 });
      ZL.spiritDust(c, ts, { n: 44, rgb: PAL.cyanHi, speed: 36, dir: 0.18, a: 0.55 * edK, seed: 491 });
    });

    M.flashInk(c, t, tHit, { x: 940, y: 420, white: 0.04, ink: 0.05, a: 0.72 });
    ZL.chronalVignette(c, t, { mode: 'reality', k: 0.48, seed: 492 });
  }

  /* 4-10 [126.0..141.0]：双人遥对广角——余慈郑重长揖问名，道人立于二十二条血链中央沧桑拒讳 */
  function draw410(c, t) {
    var cam = M.cam(t, [
      [126.0, { x: -18, y:  6, zoom: 1.04 }],
      [141.0, { x:  16, y: -8, zoom: 1.10 }, 'smooth']
    ]);
    I.plate(c, 'p-zhanlong-terrace', { cam: cam, grade: { dark: 0.08, warm: 0.05 } });

    var yangX = 1285, yangFootY = 665;
    inWorld(c, cam, function () {
      ZL.timeRiver(c, t, { y: 490, h: 580, mode: 'frozen', k: 0.62, a: 0.68, seed: 55 });
      ZL.bloodChains(c, t, { cx: yangX, cy: yangFootY - 210, n: 22, eruptK: 1.0, rattle: 0.15, spikes: 0.35, a: 0.80, seed: 61 });
    });

    // 右侧：负链而立的道人与远端台缘小残首
    rigAt(c, 'sp-severed-head', t, 545, 575, 42, cam, {
      ground: true, groundW: 0.9, groundA: 0.45, groundRgb: PAL.ink, script: SC_HEAD_STILL, mode: 'sway', seed: 494
    });
    rigAt(c, 'sp-yang-disguise', t, yangX, yangFootY, 445, cam, {
      ground: true, groundW: 0.48, groundA: 0.46, groundRgb: PAL.scorchDk, script: SC_CLIFF_GALE, seed: 495
    });

    // 左侧：余慈先郑重长揖问名（126.0–133.4s），随后直身肃立聆听（133.4–141.0s）
    var standMix = U.smooth(U.clamp((t - 133.1) / 0.65, 0, 1));
    if (standMix < 0.999) {
      rigAt(c, 'sp-yuci-bow', t, 640, 690, 435, cam, {
        alpha: 1 - standMix, ground: true, groundRgb: PAL.inkSoft, groundA: 0.36 * (1 - standMix), script: SC_BOW_ASK, seed: 496
      });
    }
    if (standMix > 0.001) {
      rigAt(c, 'sp-yuci-stand-w', t, 640, 690, 440, cam, {
        alpha: standMix, ground: true, groundRgb: PAL.inkSoft, groundA: 0.36 * standMix, script: SC_CLIFF_GALE, seed: 497
      });
    }

    inWorld(c, cam, function () {
      drawFrontPierce(c, t, yangX, yangFootY - 210, 0.15, 0.35, 0.72);
      ZL.tadpoleEdict(c, t, { x: 735, y: 450, s: 0.58, cyanK: 1.0, morphK: 0.22, a: 0.78, seed: 31 });
      ZL.spiritDust(c, t, { n: 32, rgb: PAL.cyanMist, speed: 18, dir: -0.2, a: 0.38, seed: 498 });
    });

    I.plateMist(c, t, { y: H * 0.84, h: 220, a: 0.20, speed: 12, cam: cam, seed: 499 });
    ZL.chronalVignette(c, t, { mode: 'reality', k: 0.52, seed: 500 });
  }

  /* 4-11 [141.0..156.0]：镜内凌厉切焦——「可控得斩龙台否？」「控得。」千钧七字问答 */
  function draw411(c, t) {
    // 141.0–148.2s 紧推道人近景发问（zoom=1.44 允许大横移单人构图）；148.2–156.0s 镜内急摇切至余慈掌托青光符诏应答！
    var cam = M.cam(t, [
      [141.0, { x:  255, y: -25, zoom: 1.40 }],
      [148.1, { x:  290, y: -38, zoom: 1.46 }, 'smooth'],
      [148.7, { x: -265, y: -28, zoom: 1.42 }, 'expoOut'],
      [156.0, { x: -295, y: -38, zoom: 1.48 }, 'smooth']
    ]);
    var ansKick = M.kick(t, 149.4, { amp: 7, f: 5.2, dir: 0, zAmp: 0.02, life: 0.8, seed: 502 });
    cam = M.kickCam(cam, ansKick);

    I.plate(c, 'p-zhanlong-terrace', { cam: cam, grade: { dark: 0.10, warm: t < 148.4 ? 0.07 : 0, cool: t >= 148.4 ? 0.07 : 0 } });

    inWorld(c, cam, function () {
      ZL.timeRiver(c, t, { y: 490, h: 580, mode: 'frozen', k: 0.60, a: 0.65, seed: 55 });
      ZL.bloodChains(c, t, { cx: 1315, cy: 495, n: 22, eruptK: 1.0, rattle: 0.25, spikes: 0.45, a: 0.86, seed: 61 });
    });

    rigAt(c, 'sp-yang-disguise', t, 1315, 765, 565, cam, {
      ground: true, groundRgb: PAL.scorchDk, groundA: 0.45, script: SC_CLIFF_GALE, amp: 1.15, seed: 503
    });
    rigAt(c, 'sp-yuci-look-1', t, 605, 770, 560, cam, {
      ground: true, groundRgb: PAL.inkSoft, groundA: 0.40, script: SC_CLIFF_GALE, amp: 1.1, seed: 504
    });

    inWorld(c, cam, function () {
      drawFrontPierce(c, t, 1315, 495, 0.25, 0.45, 0.80);
      // 前半段道人侧首处一点赤绿寒芒微闪；后半段余慈掌上青光符诏湛然一定（「控得」）
      if (t < 148.6) {
        c.save();
        c.globalCompositeOperation = 'lighter';
        I.glow(c, 1262, 308, 36, PAL.bloodHi, 0.56 * (0.7 + 0.3 * Math.sin(t * 6.5)));
        c.restore();
      }
      var ansBoost = t >= 149.4 ? U.smooth(U.clamp((t - 149.4) / 1.2, 0, 1)) : 0;
      ZL.tadpoleEdict(c, t, {
        x: 745, y: 455, s: 0.74 + 0.14 * ansBoost,
        cyanK: 1.0, morphK: 0.30 + 0.35 * ansBoost, unfoldK: 0.18 * ansBoost, a: 0.90, seed: 31
      });
      I.inkSplash(c, t, { x: 745, y: 455, size: 380, t0: 149.4, dur: 0.30, hold: 1.0, fade: 0.9, v: 2, tint: PAL.cyan, vary: true, a: 0.52, seed: 505 });
      I.ring(c, t, { t0: 149.45, x: 745, y: 485, r: 240, flat: 0.28, spin: 0.4, rise: 18, acc: 4, grow: 0.14, life: 3.4, tone: 'qing', a: 0.58, paleBg: 0.55, seed: 506 });
    });

    ZL.chronalVignette(c, t, { mode: 'reality', k: 0.54, seed: 507 });
  }

  /* 4-12 [156.0..173.0]：cue: ascend @ 158.0s！道人仰天大笑，拖曳 22 条倒刺血链踏上斩龙台，顶门升起澹澹水烟清光！ */
  function draw412(c, t) {
    var u = U.clamp((t - 156.0) / 17.0, 0, 1);
    var walkU = U.smooth(U.clamp((t - 157.8) / 13.2, 0, 1));
    var baseCam = M.cam(t, [
      [156.0, { x: -65, y:  18, zoom: 1.06 }],
      [173.0, { x:  18, y: -16, zoom: 1.16 }, 'smooth']
    ]);

    // 同步配乐 act4.ascend 8 记沉重步点（158.0 + step * 1.65s），每步带起微震与铁索哗啦抖动
    var stepIdx = Math.max(0, Math.min(7, Math.floor((t - 158.0) / 1.65)));
    var stepT0 = 158.0 + stepIdx * 1.65;
    var stepKick = (t >= 158.0 && t <= 171.5) ? M.kick(t, stepT0, { amp: 6.5, f: 5.0, dir: Math.PI * 0.5, zAmp: 0.012, life: 0.65, seed: 510 + stepIdx }) : null;
    var cam = M.kickCam(baseCam, stepKick);

    // 切入 p-zhanlong-block-cu 断龙石与三根困龙桩近景舞台！
    I.plate(c, 'p-zhanlong-block-cu', { cam: cam, grade: { dark: 0.06, warm: 0.06 } });

    var yangX = U.lerp(525, 865, walkU);
    var yangFootY = U.lerp(845, 765, walkU);
    var chestY = yangFootY - 235;
    var headTopY = yangFootY - 460;
    var mistK = U.smooth(U.clamp((t - 162.8) / 6.2, 0, 1)) * 0.92;

    inWorld(c, cam, function () {
      // 台上残缺龙煞被水烟清光逼得节节退缩匍匐
      ZL.dragonSha(c, t, { x: 1120 + 90 * mistK, y: 525, s: 0.92, state: 'cower', a: 0.68 * (1 - 0.35 * mistK), seed: 67 });
      // 22 条带狰狞倒刺的穿胸血链随步伐剧烈哗啦震颤（rattle=0.92, spikes=1.0）
      var pulseRattle = 0.78 + 0.22 * Math.exp(-Math.max(0, t - stepT0) / 0.45);
      ZL.bloodChains(c, t, { cx: yangX, cy: chestY, n: 22, eruptK: 1.0, rattle: pulseRattle, spikes: 1.0, a: 0.92, seed: 61 });

      if (t >= 158.0 && t <= 171.2) {
        M.dust(c, t, stepT0, { x: yangX, y: yangFootY, n: 12, v: 260, g: 380, life: 0.75, rgb: PAL.bloodRust, a: 0.62, seed: 520 + stepIdx });
      }
    });

    // 道人翻转朝右健步迈上断龙石台心
    rigAt(c, 'sp-yang-disguise', t, yangX, yangFootY, 485, cam, {
      flip: 'h', ground: true, groundW: 0.50, groundA: 0.48, groundRgb: PAL.scorchDk,
      script: SC_ASCEND_WALK, amp: 1.35, seed: 529
    });

    // 头顶百会穴袅袅升起莹澈柔和的「澹澹水烟清光」（mistK: 0 → 0.92, lotusK: 0）＋前胸穿刺锁头
    inWorld(c, cam, function () {
      drawFrontPierce(c, t, yangX, chestY, 0.88, 1.0, 0.86);
      if (mistK > 0.01) {
        ZL.cyanLotusAndMist(c, t, { x: yangX, y: headTopY + 25, mistK: mistK, lotusK: 0, a: 0.96, seed: 71 });
        I.ring(c, t, { t0: 164.0, x: yangX, y: yangFootY - 20, r: 340, flat: 0.25, spin: 0.32, rise: -8, acc: 0, grow: 0.12, life: 5.2, tone: 'white', a: 0.44 * mistK, paleBg: 0.5, seed: 530 });
        ZL.spiritDust(c, t, { n: 36, box: [yangX - 240, headTopY - 200, 480, 380], rgb: PAL.cyanMist, speed: 22, dir: -Math.PI * 0.5, a: 0.54 * mistK, seed: 531 });
      }
    });

    ZL.chronalVignette(c, t, { mode: 'reality', k: 0.52, seed: 532 });
  }

  /* 4-13 [173.0..190.5]：中近景环绕台心道人——顶门水烟高洁逼退龙煞，胸口血链深处墨绿魔气翻涌，坦陈求死无力 */
  function draw413(c, t) {
    var u = U.clamp((t - 173.0) / 17.5, 0, 1);
    var cam = M.cam(t, [
      [173.0, { x: -24, y: -14, zoom: 1.15 }],
      [190.5, { x:  24, y: -32, zoom: 1.24 }, 'smooth']
    ]);
    I.plate(c, 'p-zhanlong-block-cu', { cam: cam, grade: { dark: 0.09, warm: 0.05 } });

    var yangX = 915, yangFootY = 805, chestY = 535, headTopY = 275;

    inWorld(c, cam, function () {
      // 四周血煞天龙畏惧水烟清光，低伏台缘不敢近身
      ZL.dragonSha(c, t, { x: 960, y: 560, s: 1.05, state: 'cower', a: 0.54, seed: 67 });
      ZL.bloodChains(c, t, { cx: yangX, cy: chestY, n: 22, eruptK: 1.0, rattle: 0.30, spikes: 0.82, a: 0.90, seed: 61 });
    });

    rigAt(c, 'sp-yang-disguise', t, yangX, yangFootY, 560, cam, {
      ground: true, groundW: 0.48, groundA: 0.48, groundRgb: PAL.scorchDk,
      script: SC_CLIFF_GALE, amp: 1.05, seed: 534
    });

    inWorld(c, cam, function () {
      drawFrontPierce(c, t, yangX, chestY, 0.30, 0.82, 0.88);
      // 顶门高洁水烟清光持续升腾
      ZL.cyanLotusAndMist(c, t, { x: yangX, y: headTopY + 25, mistK: 1.0, lotusK: 0, a: 0.98, seed: 71 });

      // 胸口血链囚笼内不断左冲右突、却被金篆死死压回的十余头大魔墨绿残烟（具象化「半步魔染、油尽灯枯」）
      var surge = 0.65 + 0.35 * Math.sin(t * 2.4);
      I.wash(c, yangX, chestY, 96 * surge, 84 * surge, 0.52, 535, PAL.abyssDeep, t * 0.2, { edge: 'wet' });
      for (var m = 0; m < 5; m++) {
        var ma = (m / 5) * Math.PI * 2 + t * 0.85 * (m % 2 ? 1 : -1);
        var mr = 38 + 44 * U.fract(t * 0.42 + m * 0.2);
        var mx = yangX + Math.cos(ma) * mr, my = chestY + Math.sin(ma) * mr * 0.78;
        I.wash(c, mx, my, 42, 28, 0.44 * (1 - mr / 95), 536 + m, m % 2 ? PAL.abyssGreen : PAL.ink, ma, { edge: 'wet' });
      }
      I.ring(c, t, { t0: 175.0, x: yangX, y: chestY, r: 165, flat: 0.45, spin: -0.5, rise: 0, acc: 0, grow: -0.06, life: 4.5, tone: 'gold', a: 0.48, paleBg: 0.55, seed: 541 });
      I.ring(c, t, { t0: 181.5, x: yangX, y: chestY, r: 165, flat: 0.45, spin: 0.5, rise: 0, acc: 0, grow: -0.06, life: 4.5, tone: 'gold', a: 0.48, paleBg: 0.55, seed: 542 });
    });

    I.press(c, 0.22 + 0.10 * u, { seed: 543 });
    ZL.chronalVignette(c, t, { mode: 'reality', k: 0.58, seed: 544 });
  }

  /* 4-14 [190.5..208.0]：冷峻问刀交锋——「这一刀，可斩得？」「前辈可为接引？」 */
  function draw414(c, t) {
    var cam = M.cam(t, [
      [190.5, { x: -12, y:  -4, zoom: 1.08 }],
      [198.2, { x:  28, y: -14, zoom: 1.14 }, 'smooth'],
      [208.0, { x: -18, y: -18, zoom: 1.18 }, 'smooth']
    ]);
    I.plate(c, 'p-zhanlong-terrace', { cam: cam, grade: { dark: 0.09, warm: 0.05 } });

    var yangX = 1215, yangFootY = 635;
    var yuciX = 655,  yuciFootY = 685;

    inWorld(c, cam, function () {
      ZL.timeRiver(c, t, { y: 480, h: 580, mode: 'frozen', k: 0.68, a: 0.74, seed: 55 });
      ZL.dragonSha(c, t, { x: 1020, y: 520, s: 0.90, state: 'cower', a: 0.46, seed: 67 });
      ZL.bloodChains(c, t, { cx: yangX, cy: yangFootY - 205, n: 22, eruptK: 1.0, rattle: 0.24, spikes: 0.65, a: 0.82, seed: 61 });
    });

    // 右侧断龙石畔：负链顶放水烟的道人；左侧台前：执湖玉青光符诏的余慈
    rigAt(c, 'sp-yang-disguise', t, yangX, yangFootY, 440, cam, {
      ground: true, groundRgb: PAL.scorchDk, groundA: 0.46, script: SC_CLIFF_GALE, seed: 546
    });
    rigAt(c, 'sp-yuci-stand-w', t, yuciX, yuciFootY, 435, cam, {
      ground: true, groundRgb: PAL.inkSoft, groundA: 0.38, script: SC_CLIFF_GALE, seed: 547
    });

    inWorld(c, cam, function () {
      ZL.cyanLotusAndMist(c, t, { x: yangX, y: yangFootY - 410, mistK: 1.0, lotusK: 0, a: 0.94, seed: 71 });
      ZL.tadpoleEdict(c, t, { x: yuciX + 85, y: yuciFootY - 240, s: 0.66, cyanK: 1.0, morphK: 0.34, unfoldK: 0.12, a: 0.88, seed: 31 });
      I.wind(c, { x: 320, y: 200, w: 1280, h: 520, n: 12, t: t * 0.95, dir: 0.03, a: 0.20, rgb: PAL.cyanMist, seed: 548 });
    });

    ZL.chronalVignette(c, t, { mode: 'reality', k: 0.54, seed: 549 });
  }

  /* 4-15 [208.0..224.8]：命中 H12 / cue: askblade @ 222.0s（G852.0）！水烟骤涨逼退满台血煞，沉钟一响定生死盟约 */
  function draw415(c, t) {
    var tHit = 222.0;
    var ts = M.hitStop(t, [[tHit, 0.07, 0.24]]);
    var st = M.strike(t, tHit, { pre: 2.2, go: 0.16, post: 2.4 });
    var baseCam = M.cam(ts, [
      [208.0, { x:  12, y: -10, zoom: 1.12 }],
      [221.8, { x:   0, y: -22, zoom: 1.18 }, 'smooth'],
      [222.2, { x:   0, y: -26, zoom: 1.22 }, 'expoOut'],
      [224.8, { x:  -6, y: -30, zoom: 1.24 }, 'smooth']
    ]);
    var cam = M.kickCam(baseCam, M.kick(t, tHit, { amp: 14, f: 5.4, dir: Math.PI * 0.5, zAmp: 0.038, life: 1.35, seed: 551 }));

    var postK = U.clamp((ts - tHit) / 2.2, 0, 1);
    I.plate(c, 'p-zhanlong-block-cu', { cam: cam, grade: { dark: 0.08 * (1 - 0.5 * postK), cool: 0.10 * postK } });

    var yangX = 925, yangFootY = 785, chestY = 530, headTopY = 285;

    inWorld(c, cam, function () {
      // 虚空时光长河奔涌渐急，预示第五幕千年光阴决堤
      ZL.timeRiver(c, ts, { y: 580, h: 560, mode: 'roar', k: 0.48 + 0.36 * postK, a: 0.62, seed: 53 });
      // 满台龙煞在 H12 沉钟与水烟暴涨之下彻底退避边缘
      ZL.dragonSha(c, ts, { x: 960, y: 560 + 75 * postK, s: 1.04, state: 'cower', a: 0.66 * (1 - 0.55 * postK), seed: 67 });
      ZL.bloodChains(c, ts, { cx: yangX, cy: chestY, n: 22, eruptK: 1.0, rattle: 0.24 + 0.45 * st.imp, spikes: 0.85, a: 0.90, seed: 61 });

      // 219.5–222.0s 顶门水烟向内凝聚蓄势
      if (t >= 219.5 && t < tHit) {
        M.inkShock(c, t, { t0: 219.5, dur: 2.5, x: yangX, y: headTopY, R: 380, flat: 0.55, inward: true, rgb: PAL.cyanHi, a: 0.52, seed: 552 });
      }
    });

    rigAt(c, 'sp-yang-disguise', ts, yangX, yangFootY, 535, cam, {
      ground: true, groundRgb: PAL.scorchDk, groundA: 0.46, script: SC_CLIFF_GALE, amp: 1.15, seed: 553
    });

    inWorld(c, cam, function () {
      drawFrontPierce(c, ts, yangX, chestY, 0.24 + 0.45 * st.imp, 0.85, 0.86);
      // H12 沉钟震荡：水烟清光骤涨（以双层叠绘表现 mistK 1.0 → 1.35 的澎湃仙光）并推出千尺清波！
      ZL.cyanLotusAndMist(c, ts, { x: yangX, y: headTopY + 20, mistK: 1.0, lotusK: 0, a: 0.98, seed: 71 });
      if (t >= tHit - 0.3) {
        var extraA = U.clamp((t - (tHit - 0.3)) / 0.8, 0, 1) * 0.68;
        c.save();
        c.translate(yangX, headTopY + 10);
        c.scale(1.36, 1.28);
        ZL.cyanLotusAndMist(c, ts + 2.3, { x: 0, y: 0, mistK: 1.0, lotusK: 0, a: extraA, seed: 79 });
        c.restore();
      }

      M.inkShock(c, t, { t0: tHit, dur: 1.5, x: yangX, y: headTopY + 40, R: 820, flat: 0.42, rgb: PAL.cyanHi, a: 0.68, seed: 554 });
      M.inkRing(c, t, tHit, { x: yangX, y: yangFootY - 40, r: 740, flat: 0.28, rgb: PAL.cyan, a: 0.64, life: 1.8, seed: 555 });
      I.ring(c, t, { t0: tHit + 0.05, x: yangX, y: headTopY + 50, r: 380, flat: 0.32, spin: 0.42, rise: -28, acc: -6, grow: 0.18, life: 3.4, tone: 'qing', a: 0.66, paleBg: 0.6, seed: 556 });
      ZL.spiritDust(c, ts, { n: 52, rgb: PAL.cyanMist, speed: 34, dir: -Math.PI * 0.5, a: 0.45 + 0.42 * postK, seed: 557 });
    });

    M.flashInk(c, t, tHit, { x: yangX, y: headTopY, white: 0.045, ink: 0.065, a: 0.82 });
    ZL.chronalVignette(c, t, { mode: 'reality', k: 0.48, seed: 558 });
  }

  /* 4-16 [224.8..240.0]：「如此，请前辈上路！请符诏！」余慈深深稽首后振袖举诏，青光冲霄引动三根困龙桩齐亮！ */
  function draw416(c, t) {
    var tRaise = 232.4;
    var cam = M.cam(t, [
      [224.8, { x: -28, y:  24, zoom: 1.07 }],
      [231.8, { x: -10, y:  14, zoom: 1.11 }, 'smooth'],
      [233.2, { x:  22, y: -22, zoom: 1.15 }, 'expoOut'],
      [240.0, { x:  38, y: -42, zoom: 1.19 }, 'smooth']
    ]);
    cam = M.kickCam(cam, M.kick(t, tRaise, { amp: 11, f: 5.6, dir: -Math.PI * 0.5, zAmp: 0.03, life: 1.1, seed: 560 }));

    var skyK = U.smooth(U.clamp((t - tRaise) / 3.2, 0, 1));
    I.plate(c, 'p-zhanlong-terrace', { cam: cam, grade: { dark: 0.06, cool: 0.14 * skyK } });

    var yangX = 1205, yangFootY = 625;
    var yuciX = 675,  yuciFootY = 695;

    inWorld(c, cam, function () {
      ZL.timeRiver(c, t, { y: 620, h: 520, mode: 'roar', k: 0.55 + 0.35 * skyK, a: 0.58, seed: 53 });
      ZL.bloodChains(c, t, { cx: yangX, cy: yangFootY - 200, n: 22, eruptK: 1.0, rattle: 0.22 + 0.25 * skyK, spikes: 0.7, a: 0.80, seed: 61 });
    });

    // 台上：道人坦然静立断龙石畔，水烟清光莹然；台侧两尊金甲掌刑神将随诏令压阵而降
    rigAt(c, 'sp-yang-disguise', t, yangX, yangFootY, 430, cam, {
      ground: true, groundRgb: PAL.scorchDk, groundA: 0.45, script: SC_CLIFF_GALE, seed: 561
    });
    if (skyK > 0.05) {
      var genDrop = U.lerp(-140, 0, M.expoOut(skyK, 5));
      rigAt(c, 'sp-punish-gen-1', t, 1035, 595 + genDrop, 265, cam, {
        alpha: skyK * 0.92, ground: true, groundRgb: PAL.scorchDk, groundA: 0.35 * skyK, script: SC_CLIFF_GALE, seed: 562
      });
      rigAt(c, 'sp-punish-gen-2', t, 1395, 605 + genDrop, 265, cam, {
        alpha: skyK * 0.92, ground: true, groundRgb: PAL.scorchDk, groundA: 0.35 * skyK, script: SC_CLIFF_GALE, seed: 563
      });
    }

    // 余慈：224.8–232.0s 向台上前辈深深稽首长揖到底；232.0–240.0s 振袖直身举诏向天！
    var raiseMix = U.smooth(U.clamp((t - 231.8) / 0.65, 0, 1));
    if (raiseMix < 0.999) {
      rigAt(c, 'sp-yuci-bow', t, yuciX, yuciFootY, 455, cam, {
        alpha: 1 - raiseMix, ground: true, groundRgb: PAL.inkSoft, groundA: 0.38 * (1 - raiseMix), script: SC_FINAL_SALUTE, seed: 564
      });
    }
    if (raiseMix > 0.001) {
      rigAt(c, 'sp-yuci-pose-set-3', t, yuciX, yuciFootY, 465, cam, {
        alpha: raiseMix, ground: true, groundRgb: PAL.cyanMist, groundA: 0.42 * raiseMix, script: SC_FINAL_SALUTE, amp: 1.3, seed: 565
      });
    }

    inWorld(c, cam, function () {
      ZL.cyanLotusAndMist(c, t, { x: yangX, y: yangFootY - 405, mistK: 1.0, lotusK: 0, a: 0.95, seed: 71 });

      // 湖玉青光符诏自余慈掌上冲霄而起，引动整座封神斩龙台三根困龙桩符纹齐亮！
      var edX = U.lerp(yuciX + 95, 815, skyK), edY = U.lerp(yuciFootY - 210, 255, skyK);
      I.sunfire(c, t, { x: edX, y: yuciFootY - 120, w: 340, h: 480, n: 12, dir: -Math.PI * 0.5, mix: [1, 0.35, 0], k: skyK, a: 0.58 * skyK, speed: 1.15, paleBg: 0.55, seed: 566 });
      ZL.tadpoleEdict(c, t, {
        x: edX, y: edY, s: U.lerp(0.68, 1.18, skyK),
        cyanK: 1.0, morphK: 0.28 + 0.52 * skyK, unfoldK: 0.76 * skyK, a: 0.96, seed: 31
      });

      // 精确点亮 p-zhanlong-terrace 三根困龙桩：(1090, 310), (1280, 290), (1520, 330)！
      if (skyK > 0.02) {
        var pillars = [[1090, 480, 155], [1280, 470, 125], [1520, 495, 175]];
        for (var p = 0; p < 3; p++) {
          var pk = U.clamp((skyK - p * 0.12) / 0.7, 0, 1);
          if (pk <= 0) continue;
          var px = pillars[p][0], py0 = pillars[p][1], py1 = pillars[p][2];
          I.spineLight(c, t, { x0: px, y0: py0, x1: px, y1: py1, u: 0.5, sprout: pk, len: 95, n: 3, a: 0.88 * pk, paleBg: 0.65, seed: 570 + p });
          I.ring(c, t, { t0: tRaise + 0.35 + p * 0.35, x: px, y: py0 - 20, r: 95, flat: 0.28, spin: (p % 2 ? -0.6 : 0.6), rise: 85, acc: 18, grow: 0.06, life: 3.6, tone: 'qing', a: 0.62 * pk, paleBg: 0.55, seed: 575 + p });
        }
        I.flyWhite(c, t, { x0: edX, y0: edY, x1: 1540, y1: 190, w: 74, t0: tRaise + 0.1, dur: 0.32, hold: 1.8, fade: 1.2, kind: 'ink', tint: PAL.cyanHi, a: 0.68, seed: 580 });
        ZL.spiritDust(c, t, { n: 64, rgb: PAL.cyanHi, speed: 54, dir: -Math.PI * 0.5, a: 0.68 * skyK, seed: 581 });
      }
    });

    ZL.chronalVignette(c, t, { mode: 'reality', k: 0.50, seed: 582 });
  }

  var DRAWERS = [
    draw401, draw402, draw403, draw404,
    draw405, draw406, draw407, draw408,
    draw409, draw410, draw411, draw412,
    draw413, draw414, draw415, draw416
  ];

  CINE.registerAct({
    id: 'act4',
    order: 4,
    name: '四 · 血链问刀',
    duration: 240,
    beats: SHEET.beats,
    cues: {
      eyes:     { t: 58.0,  label: '赤绿妖瞳' },
      chains:   { t: 85.0,  label: '血链穿胸' },
      ascend:   { t: 158.0, label: '负链登台' },
      askblade: { t: 222.0, label: '请前辈上路' }
    },
    plates: 'p-zhanlong-terrace p-zhanlong-block-cu p-chengqi-tree cu-yang-eyes il-yang-chains sp-yang-disguise sp-severed-head sp-tiger-carriage sp-yuci-stand-w sp-yuci-bow sp-yuci-look-1 sp-yuci-look-3 sp-yuci-pose-set-3 sp-punish-gen-1 sp-punish-gen-2 sp-zhao-set-3 sp-xuefu-3 fx-bloodtide-tex fx-turbid-tex fx-mist-tex fx-inksplash-1 fx-inksplash-2 fx-inksplash-3 fx-flywhite-ink fx-flywhite-gold fx-sunfire-qing fx-ring-brush-oval fx-ring-brush-round fx-realm-edge fx-crack-gold',
    draw: function (c, t) {
      var bs = SHEET.beats, idx = 0;
      while (idx + 1 < bs.length && t >= bs[idx + 1].t) idx++;
      I.paper(c);
      c.save();
      DRAWERS[idx](c, t);
      c.restore();
      I.screen(c);
      I.ledger(c, t, 'act4', { dark: false });
    }
  });
})();
