/* 《斩龙封神》尾声 js/act-coda.js —— 碧血开道（1130.0s – 1320.0s，190.0s，13 镜）
   墨血流尽继之以洁 → 颈种青莲倒刷神光化生道礼「杨祖」→ 弹指摄碧血化翡翠虹桥踏云掠殿 →
   中天紫微星空大殿三垣四象星胎与无常四御 → 清净散人半具焦骨长揖 → 千钧星磨困局与「请圣人决断」朱印收卷。
   铁律：100% 纯 t 确定性（零 Math.random / Date / 跨帧可变状态），零几何正圆/硬框。 */
(function () {
  'use strict';
  var CINE = window.CINE, I = CINE.ink, U = CINE.util, M = CINE.motion, ZL = CINE.zl;
  var W = CINE.W || 1920, H = CINE.H || 1080;

  if (I.speaker) {
    I.speaker('杨祖', [96, 162, 152]);
  }

  var BEATS = [
    ['6-01',   0.0,  14.0, '墨血尽碧血生'],
    ['6-02',  14.0,  24.0, '颈种青莲汲血'],
    ['6-03',  24.0,  41.2, '神光化生杨祖'],
    ['6-04',  41.2,  57.0, '温文再无悲欢'],
    ['6-05',  57.0,  73.0, '弹指碧血化虹'],
    ['6-06',  73.0,  89.2, '弃辇踏虹掠殿'],
    ['6-07',  89.2, 104.0, '虹敛潜入星渊'],
    ['6-08', 104.0, 120.5, '紫微星空大殿'],
    ['6-09', 120.5, 137.2, '四御流转自净'],
    ['6-10', 137.2, 153.8, '清净散人遗骸'],
    ['6-11', 153.8, 171.0, '长揖千钧巨磨'],
    ['6-12', 171.0, 177.0, '内磨外裂星钟'],
    ['6-13', 177.0, 190.0, '请圣人决断印']
  ];

  var SHEET = CINE.beatSheet(BEATS);

  var PLATES = [
    'p-zhanlong-block-cu', 'p-zhanlong-terrace', 'p-rainbow-ruins', 'p-ziwei-starpalace',
    'il-qingjing-bones',
    'sp-yang-true', 'sp-yuci-bow', 'sp-yuci-stand-w', 'sp-yuci-look-3',
    'sp-punish-gen-1', 'sp-punish-gen-2', 'sp-tiger-carriage',
    'fx-sprout-light', 'fx-sunfire-qing', 'fx-mist-tex', 'fx-realm-edge',
    'fx-flywhite-gold', 'fx-ring-brush-round', 'fx-ring-brush-oval'
  ].join(' ');

  function cl(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

  function withCam(c, cam, fn) {
    c.save();
    I.screen(c);
    I.cam(c, I.plateView(cam));
    fn();
    c.restore();
  }

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
      amp: o.amp == null ? 0.82 : o.amp,
      strain: o.strain,
      mode: o.mode,
      script: o.script || {
        root: [{ t: 0, dx: 0, dy: 0, rot: 0, s: 1 }],
        wind: { dirDeg: o.windDir == null ? 16 : o.windDir, base: o.wind == null ? 0.24 : o.wind, gust: o.gust || [] },
        breathe: { period: o.period || 4.6, amp: o.breathe == null ? 0.65 : o.breathe },
        impulse: o.impulse || []
      }
    };
    return I.rig(c, id, t, ro);
  }

  /* 片尾朱砂古篆白文印「斩龙封神」（离屏缓存精灵，零几何圆弧、零主画布 fillText） */
  function cinnabarSealSprite(text, size, seed) {
    return U.cached('zlCinnabarSeal:' + text + ':' + size + ':' + seed, function (px) {
      var n = text.length, bw = size * 1.38, bh = n * size * 1.05 + size * 0.56, pad = 8, S = px || 1;
      var cv = U.canvas(Math.ceil((bw + pad * 2) * S), Math.ceil((bh + pad * 2) * S));
      var x = cv.getContext('2d'), r = U.rng(seed), F = CINE.FONT || {};
      var vermilion = [166, 38, 28];
      x.setTransform(S, 0, 0, S, pad * S, pad * S);

      // 古印金石残泐四边轮廓
      x.beginPath();
      var pts = [], k, e = size * 0.042;
      for (k = 0; k < 12; k++) pts.push([bw * k / 12, U.noise1(k * 0.9, seed) * e]);
      for (k = 0; k < 12; k++) pts.push([bw + U.noise1(k * 0.9 + 20, seed) * e, bh * k / 12]);
      for (k = 0; k < 12; k++) pts.push([bw - bw * k / 12, bh + U.noise1(k * 0.9 + 40, seed) * e]);
      for (k = 0; k < 12; k++) pts.push([U.noise1(k * 0.9 + 60, seed) * e, bh - bh * k / 12]);
      for (k = 0; k < pts.length; k++) {
        if (k) x.lineTo(pts[k][0], pts[k][1]); else x.moveTo(pts[k][0], pts[k][1]);
      }
      x.closePath();
      x.fillStyle = U.rgba(vermilion, 0.95);
      x.fill();

      // 朱砂印泥肌理浓淡
      x.globalCompositeOperation = 'source-atop';
      for (k = 0; k < 8; k++) {
        x.fillStyle = U.rgba(k % 2 ? [225, 92, 68] : [92, 16, 12], 0.06 + 0.05 * r());
        I.blot(x, r() * bw, r() * bh, size * (0.28 + 0.36 * r()), seed + k, { rough: 0.4 });
        x.fill();
      }

      // 白文篆刻阴文（intaglio）：字口透暖宣纸玉白，令磁青星海与宣纸收卷双底上篆字始终清晰凝重
      x.globalCompositeOperation = 'source-atop';
      x.font = Math.round(size * 0.92) + 'px ' + (F.stele || 'serif');
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillStyle = U.rgba([244, 237, 220], 0.94);
      for (k = 0; k < n; k++) {
        x.fillText(text[k], bw * 0.5, size * 0.28 + size * 1.05 * (k + 0.5));
      }
      x.globalCompositeOperation = 'destination-out';
      for (k = 0; k < 160; k++) {
        x.globalAlpha = 0.18 + 0.45 * r();
        I.blot(x, r() * bw, r() * bh, (0.4 + 1.1 * r() * r()) * size / 28, seed + 100 + k, { rough: 0.35, n: 6 });
        x.fill();
      }
      x.globalAlpha = 0.28;
      for (k = 0; k < 2; k++) {
        var yy = r() * bh;
        I.dry(x, [[r() * bw * 0.25, yy], [bw * (0.45 + 0.55 * r()), yy + r.pm(size * 0.28)]], {
          w: size * 0.22, a: 0.85, seed: seed + 260 + k, dry: 0.82, hairs: 5, rgb: [0, 0, 0]
        });
      }
      for (k = 0; k < 14; k++) {
        x.globalAlpha = 0.88;
        var side = k % 4, u = r();
        var bx = side === 0 ? u * bw : side === 1 ? bw : side === 2 ? u * bw : 0;
        var by = side === 0 ? 0 : side === 1 ? u * bh : side === 2 ? bh : u * bh;
        I.blot(x, bx, by, size * (0.03 + 0.055 * r()), seed + 300 + k, { rough: 0.42, n: 9 });
        x.fill();
      }
      cv.w = bw + pad * 2;
      cv.h = bh + pad * 2;
      return cv;
    });
  }

  function drawEndSeal(c, t, t0) {
    if (t < t0) return;
    var spr = cinnabarSealSprite('斩龙封神', 38, 1707);
    var dt = t - t0, k = cl(dt / 0.32), ek = U.easeOut(k);
    var sc = U.lerp(1.58, 1.0, ek) * (k > 0.72 ? 1 + 0.028 * Math.sin((k - 0.72) / 0.28 * Math.PI) : 1);
    var rot = -0.018 + 0.08 * (1 - ek);
    var cx = W * 0.895, cy = H * 0.54 + spr.h * 0.5;

    c.save();
    I.screen(c);
    // 印底衬一抹淡暖宣纸气韵，令暗星海与宣纸收卷两种底色上朱砂白文均鲜明庄重
    I.wash(c, cx, cy, spr.w * 0.88, spr.h * 0.62, 0.28 * cl(k * 2), 1709, [238, 230, 214], 0, { edge: 'soft' });
    c.translate(cx, cy);
    c.rotate(rot);
    c.scale(sc, sc);
    c.globalAlpha *= cl(k * 2.2);
    c.drawImage(spr, -spr.w * 0.5, -spr.h * 0.5, spr.w, spr.h);
    c.restore();

    var land = dt - 0.24;
    if (land > 0 && land < 1.1) {
      c.save();
      I.screen(c);
      I.glow(c, cx, cy, spr.h * (0.65 + 0.45 * land), [196, 56, 38], 0.34 * (1 - land / 1.1));
      var r = U.rng(5123), sk = U.easeOut(cl(land / 0.28));
      c.fillStyle = U.rgba([166, 38, 28], 0.78 * (1 - U.ramp(land, 0.5, 1.1)));
      for (var i = 0; i < 7; i++) {
        var ang = r() * Math.PI * 2, d = (spr.w * 0.55 + spr.h * 0.2 * r()) * sk;
        I.blot(c, cx + Math.cos(ang) * d * 0.9, cy + Math.sin(ang) * d * 0.8, 1.6 + 1.8 * r(), 1720 + i, { rough: 0.3, n: 9 });
        c.fill();
      }
      c.restore();
    }
  }

  /* ==================== 逐镜绘制函数 ==================== */
  var SHOTS = {
    /* 6-01 [0.0..14.0]：「墨血流尽，继之以洁」断颈处溅出莹然如玉的翡翠碧血，滴落苍石绽开清越玉晕！ */
    '6-01': function (c, t, lt) {
      var cam = M.cam(lt, [
        [0.0,  { x: 0,  y: 74, zoom: 1.18 }],
        [14.0, { x: -6, y: 36, zoom: 1.08 }, 'smooth']
      ]);
      I.plateFlow(c, 'p-zhanlong-block-cu', t, { cam: cam, amp: 3.2, scale: 320, speed: 0.08, seed: 801 });

      var sproutTex = I.fxTex && I.fxTex('sprout-light');
      var jadeProg = cl((lt - 0.4) / 10.5);
      // 叠加第二波错峰翡翠珠滴，呼应配乐 7 声清越玉磬（t = 2.2..16s）
      var jadeProg2 = cl((lt - 4.8) / 8.5);

      withCam(c, cam, function () {
        if (sproutTex && I.flow) {
          I.flow(c, sproutTex.id, t, {
            src: sproutTex.src, dst: [850, 380, 220, 360], mode: 'screen',
            tint: [92, 178, 142], alpha: 0.24 * U.smooth(lt / 2.8),
            vignette: { rx: 0.9, ry: 0.9, soft: 0.55 }, warp: { amp: 6, scale: 140, speed: 0.16, seed: 802 }
          });
        }
        ZL.inkBloodToJade(c, t, { x: 960, y: 595, groundY: 730, mode: 'jade', k: jadeProg, a: 0.98, seed: 803 });
        if (jadeProg2 > 0.01) {
          ZL.inkBloodToJade(c, t, { x: 968, y: 602, groundY: 734, mode: 'jade', k: jadeProg2, a: 0.86, seed: 804 });
        }
        // 高空静悬的碗大青莲遥感碧血生机
        ZL.cyanLotusAndMist(c, t, {
          x: 960, y: 560, mistK: 0, lotusK: 0.94, dropY: -95 + 6 * Math.sin(t * 1.4), dewK: 0.95, washK: 0, a: 0.88, seed: 805
        });
        ZL.spiritDust(c, t, { n: 26, box: [740, 420, 440, 340], rgb: [92, 172, 136], speed: 14, a: 0.48 * U.smooth(lt / 2.5), seed: 806 });
      });
    },

    /* 6-02 [14.0..24.0]：碗大青莲悠悠落定颈间（颈种莲花），汲取如玉碧血，清碧神光向下流淌！ */
    '6-02': function (c, t, lt) {
      var cam = M.cam(lt, [
        [0.0,  { x: -6, y: 36, zoom: 1.10 }],
        [10.0, { x: 0,  y: 16, zoom: 1.16 }, 'smooth']
      ]);
      I.plateFlow(c, 'p-zhanlong-block-cu', t, { cam: cam, amp: 3.5, scale: 300, speed: 0.09, seed: 811 });

      var settleK = U.smooth(lt / 5.4);
      var dropY = U.lerp(-92, 0, settleK);
      var preWash = 0.18 * U.smooth((lt - 4.2) / 5.2);

      withCam(c, cam, function () {
        // 石上翡翠碧血化作点点翠芒升入青莲（逆向柔吸气韵）
        ZL.inkBloodToJade(c, t, { x: 960, y: 595, groundY: 730, mode: 'jade', k: 1.0, a: 0.72 * (1 - 0.65 * settleK), seed: 812 });
        ZL.rainbowBridge(c, t, { x0: 960, y0: 565, x1: 1020, y1: 550, dropletsK: 0.65 * U.smooth((lt - 1.2) / 5.5), k: 0, a: 0.68, seed: 813 });

        ZL.cyanLotusAndMist(c, t, {
          x: 960, y: 562, mistK: 0.15 * settleK, lotusK: 1.0, dropY: dropY, dewK: 1.0, washK: preWash, a: 0.98, seed: 814
        });
        ZL.spiritDust(c, t, { n: 32, box: [760, 380, 400, 360], rgb: [118, 196, 168], speed: 20, a: 0.56, seed: 815 });
      });
    },

    /* 6-03 [24.0..41.2]｜命中 H18 @ G1156.0 (t=26.0s)：遗蜕起身，青光自颈间倒刷全身，化生温文道礼之「杨祖」！ */
    '6-03': function (c, t, lt) {
      var HIT = 26.0; // H18 @ G1156.0
      var hk = M.kick(t, HIT, { amp: 9, f: 4.4, zeta: 0.48, life: 1.2, dir: -Math.PI * 0.5, zAmp: 0.024, seed: 821 });
      var cam = M.cam(lt, [
        [0.0,  { x: 0,  y: 35,  zoom: 1.14 }],
        [2.0,  { x: 18, y: 22,  zoom: 1.16 }, 'expoIn'],
        [4.5,  { x: 35, y: -12, zoom: 1.07 }, 'expoOut'],
        [17.2, { x: 42, y: -20, zoom: 1.04 }, 'smooth']
      ]);
      cam = M.kickCam(cam, hk);

      I.plateFlow(c, 'p-zhanlong-block-cu', t, { cam: cam, amp: 3.5, scale: 320, speed: 0.09, seed: 822 });

      var riseK = U.smooth((t - (HIT - 0.3)) / 3.4);
      var washProg = t < HIT ? U.lerp(0.15, 0.25, cl(lt / 2.0)) : U.lerp(0.25, 1.0, M.expoOut(cl((t - HIT) / 3.2), 4));
      var lotusFade = U.lerp(1.0, 0.22, U.smooth((t - (HIT + 1.2)) / 5.5));
      var yangA = U.smooth((t - (HIT + 0.35)) / 2.6);

      withCam(c, cam, function () {
        // 清碧神火微光衬托神圣而清冷的重塑
        if (t >= HIT - 0.4 && t < HIT + 7.5) {
          var sfEnv = U.smooth((t - (HIT - 0.4)) / 1.2) * (1 - U.smooth((t - (HIT + 3.8)) / 3.5));
          I.sunfire(c, t, { x: 1085, y: 690, w: 320, h: 340, n: 8, mix: [1, 0.5, 0], k: 0.65, a: 0.36 * sfEnv, speed: 0.85, paleBg: 0.3, seed: 823 });
        }

        // H18 玉磬泛音光环扶摇升起
        I.ring(c, t, { t0: HIT, x: 1085, y: 590, r: 240, flat: 0.28, rise: 85, life: 3.6, tone: 'qing', a: 0.72, paleBg: 0.45, seed: 824 });
        I.ring(c, t, { t0: HIT + 0.45, x: 1085, y: 620, r: 195, flat: 0.26, rise: 105, spin: -0.5, life: 3.4, tone: 'gold', a: 0.58, paleBg: 0.4, seed: 825 });

        // 颈种青莲倒刷十二道青金神光洗炼全身
        ZL.cyanLotusAndMist(c, t, {
          x: 1085, y: U.lerp(555, 420, riseK), mistK: 0.22 * (1 - yangA * 0.7),
          lotusK: lotusFade, dropY: 0, dewK: 0.8 * (1 - riseK), washK: washProg * (1 - 0.55 * U.smooth((lt - 9.0) / 6.0)),
          a: 0.95, seed: 826
        });
      });

      // 右侧端正起身、高冠博带、含笑拱手的「杨祖」（T121 字位在右，面向左侧余慈）
      if (yangA > 0.01) {
        rigAt(c, 'sp-yang-true', t, {
          cam: cam, s: 0.245, dx: 125, dy: U.lerp(135, 86, riseK), flipX: true, alpha: yangA,
          script: {
            root: [
              { t: 26.0, dx: 0, dy: 28, rot: 0.02, s: 0.97 },
              { t: 29.4, dx: 0, dy: 0, rot: 0, s: 1.0, ease: 'outSine' },
              { t: 41.2, dx: 0, dy: -2, rot: 0, s: 1.0 }
            ],
            wind: { dirDeg: 18, base: 0.22 },
            breathe: { period: 5.4, amp: 0.42 }
          }
        });
      }

      // 左前景静立相迎的余慈背侧剪影
      rigAt(c, 'sp-yuci-stand-w', t, {
        cam: cam, s: 0.155, dx: -435, dy: 132, wind: 0.22, period: 4.8, breathe: 0.5
      });
    },

    /* 6-04 [41.2..57.0]：「请随我来」温和无温的道礼特写 → 48.1s 反打余慈默然凝视空旷斩龙台（再无半点血肉悲欢）！ */
    '6-04': function (c, t, lt) {
      var CUT = 48.1; // 精准落在 T122(47.2) 与 T123(49.0) 之间的无字安全窗！
      if (t < CUT) {
        // 前半：特写「杨祖」侧身引臂请行，礼数周全却去尽人间悲欢
        var cam1 = M.cam(lt, [
          [0.0, { x: 95,  y: 12, zoom: 1.14 }],
          [6.9, { x: 118, y: 4,  zoom: 1.20 }, 'smooth']
        ]);
        I.plateFlow(c, 'p-zhanlong-terrace', t, { cam: cam1, amp: 3.0, scale: 340, speed: 0.07, seed: 831 });
        I.plateMist(c, t, { cam: cam1, y: H * 0.72, h: 260, a: 0.22, speed: 12, rgb: [228, 224, 212], seed: 832 });

        rigAt(c, 'sp-yang-true', t, {
          cam: cam1, s: 0.275, dx: 155, dy: 96,
          script: {
            root: [
              { t: 41.2, dx: -8, dy: 4, rot: -0.015, s: 0.99 },
              { t: 43.4, dx: 8, dy: 0, rot: 0.012, s: 1.0, ease: 'inOutSine' },
              { t: 48.1, dx: 12, dy: 0, rot: 0.012, s: 1.0 }
            ],
            wind: { dirDeg: 14, base: 0.24 },
            breathe: { period: 5.8, amp: 0.35 }
          }
        });
        ZL.spiritDust(c, t, { n: 18, rgb: [138, 194, 184], speed: 10, a: 0.34, seed: 833 });
      } else {
        // 后半：反打余慈微怔凝视空旷荒台，风卷冷雾掠过空无一链的断龙石
        var lt2 = t - CUT;
        var cam2 = M.cam(lt2, [
          [0.0, { x: -115, y: 18, zoom: 1.10 }],
          [8.9, { x: -82,  y: 8,  zoom: 1.17 }, 'smooth']
        ]);
        I.plateFlow(c, 'p-zhanlong-terrace', t, { cam: cam2, amp: 3.5, scale: 340, speed: 0.08, seed: 834 });
        I.mistBand(c, t, { y: H * 0.48, h: H * 0.38, speed: 20, warp: 18, a: 0.28, tint: [222, 218, 208], seed: 835 });

        rigAt(c, 'sp-yuci-look-3', t, {
          cam: cam2, s: 0.205, dx: -245, dy: 108, wind: 0.28, period: 4.6, breathe: 0.55
        });
        ZL.chronalVignette(c, t, { mode: 'reality', k: 0.42, a: 0.48, seed: 836 });
      }
    },

    /* 6-05 [57.0..73.0]｜命中 H19 @ G1192.0 (t=62.0s，rainbow)：摄碧血于掌心，62.0s 弹指化作横跨苍茫云海的翡翠虹桥！ */
    '6-05': function (c, t, lt) {
      var HIT = 62.0; // H19 @ G1192.0
      var hk = M.kick(t, HIT, { amp: 11, f: 5.0, zeta: 0.45, life: 1.0, dir: -0.35, zAmp: 0.025, seed: 841 });
      var ruinsFade = U.smooth((lt - 5.2) / 5.2); // 62.2..67.4s 随虹桥伸展柔溶向神庭云海
      var cam = M.cam(lt, [
        [0.0,  { x: 25,  y: 26,  zoom: 1.14 }],
        [4.9,  { x: 42,  y: 14,  zoom: 1.16 }, 'smooth'],
        [6.2,  { x: 85,  y: -14, zoom: 1.06 }, 'expoOut'],
        [16.0, { x: 118, y: -28, zoom: 1.02 }, 'smooth']
      ]);
      cam = M.kickCam(cam, hk);

      I.plate(c, 'p-zhanlong-terrace', { cam: cam, fade: { id2: 'p-rainbow-ruins', k: ruinsFade } });

      // 57.0..62.0s 石上碧血珠腾空聚入掌心；62.0s 弹指化雾架起翡翠水墨虹桥！
      var dropGather = t < HIT ? U.smooth(lt / 4.8) : cl(1 - (t - HIT) / 1.4);
      var bridgeK = t < HIT ? 0 : M.expoOut(cl((t - HIT) / 3.6), 4);

      withCam(c, cam, function () {
        ZL.rainbowBridge(c, t, {
          x0: 760, y0: 615, x1: 1785, y1: 335,
          dropletsK: dropGather, k: bridgeK, a: 0.98, seed: 842
        });
        I.ring(c, t, { t0: HIT, x: 760, y: 585, r: 190, flat: 0.36, tilt: -0.25, rise: 55, life: 2.8, tone: 'qing', a: 0.68, paleBg: 0.4, seed: 843 });
        I.flyWhite(c, t, { t0: HIT, dur: 0.38, hold: 1.6, fade: 1.1, x0: 750, y0: 615, x1: 1740, y1: 345, w: 72, kind: 'gold', a: 0.46, tint: [92, 172, 136], seed: 844 });
        ZL.spiritDust(c, t, { n: 34, box: [680, 260, 1120, 420], rgb: [92, 172, 136], dir: -0.28, speed: 32, a: 0.55 * bridgeK, seed: 845 });
      });

      rigAt(c, 'sp-yang-true', t, {
        cam: cam, s: 0.215 * (1 - 0.14 * ruinsFade), dx: U.lerp(-145, -245, ruinsFade), dy: U.lerp(96, 82, ruinsFade),
        script: {
          root: [
            { t: 57.0, dx: 0, dy: 4, rot: -0.01, s: 1.0 },
            { t: 61.8, dx: -6, dy: 0, rot: -0.025, s: 1.0, ease: 'inSine' },
            { t: 62.15, dx: 14, dy: -6, rot: 0.025, s: 1.02, ease: 'outBack' },
            { t: 73.0, dx: 18, dy: -4, rot: 0.015, s: 1.0 }
          ],
          wind: { dirDeg: 12, base: 0.32, gust: [{ t: 62.0, dur: 1.8, amp: 1.2 }] },
          impulse: [{ t: 62.0, x: 1, y: -0.4, amp: 1.1 }],
          breathe: { period: 5.0, amp: 0.45 }
        }
      });
    },

    /* 6-06 [73.0..89.2]：余慈弃辇向封神台郑重一揖，随杨祖踏翡翠虹桥向云深处行去，脚下掠过破败神庭殿宇！ */
    '6-06': function (c, t, lt) {
      var cam = M.cam(lt, [
        [0.0,  { x: -48, y: 16,  zoom: 1.04 }],
        [16.2, { x: 45,  y: -18, zoom: 1.15 }, 'smooth']
      ]);
      I.plateFlow(c, 'p-rainbow-ruins', t, { cam: cam, amp: 4.5, scale: 340, speed: 0.1, seed: 851 });
      I.plateMist(c, t, { cam: cam, y: H * 0.76, h: 270, a: 0.28, speed: -18, rgb: [226, 224, 214], seed: 852 });

      // 左后崖边留驻的白虎玉舆（弃辇不用）
      rigAt(c, 'sp-tiger-carriage', t, {
        cam: cam, s: 0.165, dx: -645, dy: 82, alpha: 0.82 * (1 - 0.45 * cl(lt / 14)), wind: 0.18, amp: 0.45
      });

      var bx0 = 250, by0 = 720, bx1 = 1760, by1 = 320;
      withCam(c, cam, function () {
        ZL.rainbowBridge(c, t, { x0: bx0, y0: by0, x1: bx1, y1: by1, dropletsK: 0, k: 1.0, a: 0.94, seed: 853 });
        // 81.8s「唯闻一声朗笑」空谷清越回音水墨圈
        I.ring(c, t, { t0: 81.9, x: 1180, y: 310, r: 220, flat: 0.34, rise: 45, life: 3.2, tone: 'qing', a: 0.48, paleBg: 0.35, seed: 854 });
        I.ring(c, t, { t0: 82.5, x: 1230, y: 290, r: 260, flat: 0.32, rise: 55, life: 3.2, tone: 'gold', a: 0.38, paleBg: 0.3, seed: 855 });
      });

      // 精确对齐 zl.rainbowBridge 脊线公式，令众人衣履稳稳踏在翡翠虹桥桥面之上！
      var bDx = bx1 - bx0, bDy = by1 - by0, bL = Math.hypot(bDx, bDy), bNx = -bDy / bL;
      var bArchH = Math.min(220, bL * 0.19);
      var onBridge = function (u, sRatio, aspect) {
        var arch = -Math.sin(Math.PI * Math.pow(u, 0.88)) * bArchH;
        var px = bx0 + bDx * u + bNx * (arch * 0.28);
        var py = by0 + bDy * u - Math.abs(arch);
        var charH = 1920 * sRatio * aspect;
        return { dx: px - 960, dy: (py - 0.43 * charH) - 540 };
      };

      // 前导：大袖飘飘的「杨祖」（864x932 -> aspect 1.079）
      var yangU = 0.22 + 0.54 * U.smooth(lt / 15.8);
      var yangS = U.lerp(0.162, 0.114, yangU);
      var yangP = onBridge(yangU, yangS, 1.079);
      rigAt(c, 'sp-yang-true', t, {
        cam: cam, s: yangS, dx: yangP.dx, dy: yangP.dy, wind: 0.55, windDir: 195
      });

      // 余慈：施礼（sp-yuci-bow 650x922 -> 1.418）平滑衔接入行进（sp-yuci-stand-w 523x872 -> 1.667）
      var walkU = U.smooth((lt - 3.6) / 12.2);
      var bowOut = U.smooth((lt - 3.4) / 0.9);
      var yuciU = 0.08 + 0.48 * walkU;

      if (bowOut < 0.99) {
        var bowP = onBridge(yuciU, 0.152, 1.418);
        rigAt(c, 'sp-yuci-bow', t, {
          cam: cam, s: 0.152, dx: bowP.dx, dy: bowP.dy, alpha: 1 - bowOut, wind: 0.35
        });
      }
      if (bowOut > 0.01) {
        var standS = U.lerp(0.130, 0.096, walkU);
        var standP = onBridge(yuciU, standS, 1.667);
        rigAt(c, 'sp-yuci-stand-w', t, {
          cam: cam, s: standS, dx: standP.dx, dy: standP.dy, alpha: bowOut, wind: 0.48, windDir: 195
        });
      }

      // 殿后随行的二尊金甲神将远影
      var genU = 0.02 + 0.38 * U.smooth((lt - 4.8) / 11.2);
      if (lt > 4.2) {
        var gA = U.smooth((lt - 4.2) / 1.4) * 0.85;
        var gS = U.lerp(0.122, 0.090, genU);
        var gP1 = onBridge(Math.max(0.01, genU - 0.03), gS, 1.053);
        var gP2 = onBridge(genU + 0.01, gS, 1.003);
        rigAt(c, 'sp-punish-gen-1', t, {
          cam: cam, s: gS, dx: gP1.dx, dy: gP1.dy, alpha: gA, wind: 0.45
        });
        rigAt(c, 'sp-punish-gen-2', t, {
          cam: cam, s: gS, dx: gP2.dx, dy: gP2.dy, flipX: true, alpha: gA, wind: 0.45
        });
      }
    },

    /* 6-07 [89.2..104.0]：俯冲跟镜沿翡翠虹光敛入神庭最幽邃的磁青星渊裂隙，泥金星轨渐次点亮！ */
    '6-07': function (c, t, lt) {
      // 89.2..90.7s（在 T127 91.0s 出字前完成暗场入渊过渡，保证字幕全程在深邃磁青星底上清晰柔白！）
      var intoAbyss = U.smooth(lt / 1.45);
      var cam = M.cam(lt, [
        [0.0,  { x: 20,  y: -32, zoom: 1.08 }],
        [14.8, { x: -18, y: 56,  zoom: 1.25 }, 'smooth']
      ]);

      I.plate(c, 'p-rainbow-ruins', { cam: cam, grade: { dark: 0.35 * intoAbyss, cool: 0.25 * intoAbyss } });
      if (intoAbyss > 0.01) {
        I.plateFlow(c, 'p-ziwei-starpalace', t, { cam: cam, alpha: intoAbyss, amp: 4, scale: 360, speed: 0.08, seed: 861 });
      }

      withCam(c, cam, function () {
        var rbRemain = U.lerp(1.0, 0.16, U.smooth(lt / 12.8));
        ZL.rainbowBridge(c, t, {
          x0: 180, y0: 250, x1: 1380, y1: 660, dropletsK: 0, k: rbRemain, a: 0.88 * (1 - 0.35 * cl((lt - 10) / 4.5)), seed: 862
        });
        // 渐次点亮的泥金星轨与磁青星屑
        var starRise = U.smooth((lt - 1.2) / 6.5);
        ZL.spiritDust(c, t, { n: 54, rgb: [216, 190, 132], dir: -0.45, speed: 24, a: 0.65 * starRise, seed: 863 });
        ZL.spiritDust(c, t, { n: 32, rgb: [148, 198, 192], dir: -0.45, speed: 18, a: 0.45 * starRise, seed: 864 });
      });
      ZL.chronalVignette(c, t, { mode: 'star', k: 0.78 * intoAbyss, a: 0.82, seed: 865 });
    },

    /* 6-08 [104.0..120.5]（starpalace @ 104.0s）：恢宏拉镜揭示无边磁青描金「中天紫微星空大殿」与三垣四象球形星辰胚胎！ */
    '6-08': function (c, t, lt) {
      var cam = M.cam(lt, [
        [0.0,  { x: 0, y: -22, zoom: 1.18 }],
        [16.5, { x: 0, y: 8,   zoom: 1.02 }, 'smooth']
      ]);
      I.plateFlow(c, 'p-ziwei-starpalace', t, { cam: cam, amp: 3.5, scale: 380, speed: 0.07, seed: 871 });

      withCam(c, cam, function () {
        ZL.starEmbryo(c, t, { x: 960, y: 445, s: 1.02, seatsK: 0, heavyK: 0.18, a: 0.96, seed: 872 });
        ZL.spiritDust(c, t, { n: 56, rgb: [216, 190, 132], speed: 12, a: 0.52, seed: 873 });
      });

      // 星坛下缘驻足仰望的三界旅人剪影
      rigAt(c, 'sp-yang-true', t, {
        cam: cam, s: 0.148, dx: 335, dy: 218, flipX: true, wind: 0.22, period: 5.4, breathe: 0.4
      });
      rigAt(c, 'sp-yuci-stand-w', t, {
        cam: cam, s: 0.122, dx: -335, dy: 224, wind: 0.22, period: 4.8, breathe: 0.5
      });

      ZL.chronalVignette(c, t, { mode: 'star', k: 0.72, a: 0.78, seed: 874 });
    },

    /* 6-09 [120.5..137.2]：随杨祖指点，星胎内次第点亮紫微、玉皇、勾陈、后土四御古篆烙印，残阵缓慢自净！ */
    '6-09': function (c, t, lt) {
      var cam = M.cam(lt, [
        [0.0,  { x: 24,  y: 4,   zoom: 1.04 }],
        [16.7, { x: -18, y: -12, zoom: 1.13 }, 'smooth']
      ]);
      I.plateFlow(c, 'p-ziwei-starpalace', t, { cam: cam, amp: 3.5, scale: 360, speed: 0.08, seed: 881 });

      var seatsProg = U.smooth((lt - 0.8) / 7.2); // 121.3..128.5s 四御烙印次第点亮
      var purifyProg = U.lerp(0.35, 0.92, U.smooth((lt - 7.5) / 8.2)); // 128..136.2s 残阵自净消融余孽黑气

      withCam(c, cam, function () {
        // 残阵自净：星河边缘盘桓的丝缕劫后黑魔残气被泥金星辉缓缓消融
        ZL.meltShadows(c, t, { x: 885, y: 445, r: 360, purifyK: purifyProg, n: 10, a: 0.42, seed: 882 });
        ZL.starEmbryo(c, t, { x: 885, y: 445, s: 1.08, seatsK: seatsProg, heavyK: 0.34, a: 0.98, seed: 883 });
        I.flyWhite(c, t, { t0: 121.6, dur: 0.45, hold: 2.2, fade: 1.2, x0: 1220, y0: 540, x1: 895, y1: 310, w: 54, kind: 'gold', a: 0.38, seed: 884 });
        ZL.spiritDust(c, t, { n: 48, rgb: [216, 190, 132], speed: 14, a: 0.48, seed: 885 });
      });

      rigAt(c, 'sp-yang-true', t, {
        cam: cam, s: 0.205, dx: 410, dy: 168, flipX: true,
        script: {
          root: [
            { t: 120.5, dx: 0, dy: 4, rot: 0, s: 1.0 },
            { t: 122.4, dx: -10, dy: -4, rot: -0.018, s: 1.01, ease: 'inOutSine' },
            { t: 137.2, dx: -6, dy: -2, rot: -0.01, s: 1.0 }
          ],
          wind: { dirDeg: 18, base: 0.24 },
          breathe: { period: 5.2, amp: 0.42 }
        }
      });

      ZL.chronalVignette(c, t, { mode: 'star', k: 0.74, a: 0.8, seed: 886 });
    },

    /* 6-10 [137.2..153.8]（qingjing @ 137.2s）：绕过璀璨星胎，孤寂寒星中唯余「清净散人」半具灰黑焦骨盘膝镇守！ */
    '6-10': function (c, t, lt) {
      var cam = M.cam(lt, [
        [0.0,  { x: 42,  y: -8, zoom: 1.04 }],
        [16.6, { x: -12, y: 8,  zoom: 1.16 }, 'smooth']
      ]);
      I.plateFlow(c, 'il-qingjing-bones', t, { cam: cam, amp: 2.8, scale: 380, speed: 0.06, seed: 891 });

      withCam(c, cam, function () {
        // 远景柔焦三垣四象星胎流转，映照孤寂残骸
        ZL.starEmbryo(c, t, { x: 640, y: 455, s: 0.82, seatsK: 0.75, heavyK: 0.45, a: 0.26, seed: 892 });
        // 焦骨周围袅袅漂浮的星光微尘与不灭道韵微芒
        I.glow(c, 1045, 515, 240, [188, 166, 118], 0.14 + 0.04 * Math.sin(t * 1.3), 'lighter');
        ZL.spiritDust(c, t, { n: 52, box: [620, 180, 780, 660], rgb: [216, 194, 140], speed: 10, a: 0.56, seed: 893 });
      });

      ZL.chronalVignette(c, t, { mode: 'star', k: 0.8, a: 0.85, seed: 894 });
    },

    /* 6-11 [153.8..171.0]：余慈向半具前贤焦骨肃然长揖 → 161.5-162.7s 溶回滞重如千钧巨磨的星胎（「时间在哪儿？」）！ */
    '6-11': function (c, t, lt) {
      // T134: 154.8-161.2s, T135: 163.0-169.4s；转场严格落在 161.4-162.7s 无字空窗内！
      var toMill = U.smooth((lt - 7.6) / 1.25); // 161.4..162.65s
      var cam = M.cam(lt, [
        [0.0,  { x: -18, y: 12, zoom: 1.06 }],
        [7.6,  { x: -6,  y: 4,  zoom: 1.12 }, 'smooth'],
        [9.0,  { x: 0,   y: 18, zoom: 1.13 }, 'smooth'],
        [17.2, { x: 0,   y: 28, zoom: 1.05 }, 'smooth']
      ]);

      I.plate(c, 'il-qingjing-bones', { cam: cam, fade: { id2: 'p-ziwei-starpalace', k: toMill } });

      // 前半（153.8..162.4s）：左侧余慈向清净散人半具焦骨深深长揖到底
      if (toMill < 0.99) {
        var bowDeep = U.smooth((lt - 0.6) / 1.8);
        rigAt(c, 'sp-yuci-bow', t, {
          cam: cam, s: 0.188, dx: -365, dy: 138, alpha: 1 - toMill,
          script: {
            root: [
              { t: 153.8, dx: -10, dy: -6, rot: -0.03, s: 0.99 },
              { t: 155.8, dx: 8, dy: 10 * bowDeep, rot: 0.06, s: 1.0, ease: 'inOutSine' },
              { t: 162.5, dx: 8, dy: 10, rot: 0.06, s: 1.0 }
            ],
            wind: { dirDeg: 14, base: 0.18 },
            breathe: { period: 5.0, amp: 0.45 }
          }
        });
      }

      withCam(c, cam, function () {
        if (toMill < 0.95) {
          ZL.spiritDust(c, t, { n: 40, box: [640, 200, 760, 620], rgb: [216, 194, 140], speed: 9, a: 0.48 * (1 - toMill), seed: 901 });
        }
        if (toMill > 0.02) {
          // 勾陈、后土两尊帝座压着两具陨落地仙遗蜕，整座三垣四象星盘滞涩欲停（heavyK: 0.4 -> 1.0）！
          var hvK = U.lerp(0.4, 1.0, U.smooth((lt - 8.2) / 7.8));
          ZL.starEmbryo(c, t, { x: 960, y: 442, s: 1.10, seatsK: 1.0, heavyK: hvK, a: 0.98 * toMill, seed: 902 });
          // 低沉巨磨咬合脉动暗环（呼应配乐 4.2s 一次的沉重建鼓）
          M.inkRing(c, t, 163.4, { x: 960, y: 470, r: 440, flat: 0.42, rgb: [72, 64, 58], a: 0.36 * toMill, life: 1.8, seed: 903 });
          M.inkRing(c, t, 167.6, { x: 960, y: 475, r: 460, flat: 0.42, rgb: [72, 64, 58], a: 0.40 * toMill, life: 1.8, seed: 904 });
        }
      });

      ZL.chronalVignette(c, t, { mode: 'star', k: 0.82, a: 0.86, seed: 905 });
      if (toMill > 0.05) {
        // 压深顶缘星云亮带，令余慈心声 T135（石青色）在暗星天幕上澄澈高对比
        c.save();
        I.screen(c);
        I.wash(c, W * 0.5, H * 0.14, W * 0.56, 135, 0.64 * toMill, 906, [14, 18, 28], 0, { edge: 'soft' });
        c.restore();
      }
    },

    /* 6-12 [171.0..177.0]｜命中 H20 @ G1304.0 (t=174.0s，decide)：内有滞重星磨、外有裂口玉碟，174.0s 紫微星钟轰然定格！ */
    '6-12': function (c, t, lt) {
      var HIT = 174.0; // H20 @ G1304.0
      var ta = M.hitStop(t, [[HIT, 0.14, 0.42]]);
      var hk = M.kick(t, HIT, { amp: 14, f: 4.8, zeta: 0.42, life: 1.35, dir: Math.PI * 0.5, zAmp: 0.038, seed: 911 });
      var cam = M.cam(ta - 171.0, [
        [0.0, { x: 0, y: 12, zoom: 1.06 }],
        [3.0, { x: 0, y: 4,  zoom: 1.16 }, 'expoIn'],
        [6.0, { x: 0, y: 0,  zoom: 1.12 }, 'smooth']
      ]);
      cam = M.kickCam(cam, hk);

      // 174.0s 星钟敲响后万星屏息半凝
      var bellFreeze = t >= HIT ? U.lerp(ta, HIT + (ta - HIT) * 0.22, 0.72) : ta;
      I.plateFlow(c, 'p-ziwei-starpalace', bellFreeze, { cam: cam, amp: 3.5, scale: 360, speed: 0.07, seed: 912 });

      withCam(c, cam, function () {
        // 外层危机幻象：倒扣白玉巨碟三分之一破口碧水狂泻、明暗急迫闪烁！
        var dishA = 0.42 * (t < HIT ? U.smooth(lt / 2.2) : (1 - 0.35 * cl((t - HIT) / 2.6)));
        ZL.invertedDish(c, bellFreeze, {
          x: 960, y: 470, s: 1.22, breachK: 1.0, flicker: t < HIT ? 0.72 : 0.2, a: dishA, seed: 913
        });

        // 内层滞重千钧巨磨：三垣四象星辰胚胎
        ZL.starEmbryo(c, bellFreeze, { x: 960, y: 448, s: 1.06, seatsK: 1.0, heavyK: 1.0, a: 0.95, seed: 914 });

        // 174.0s 幽远苍凉的紫微星钟断墨余波与泥金飞白荡彻星海（破除连续椭圆几何环）
        M.inkRing(c, t, HIT, { x: 960, y: 465, r: 380, flat: 0.40, w: 34, life: 2.2, a: 0.44, rgb: [188, 162, 108], rot: 0.25, seed: 915 });
        M.inkShock(c, t, { t0: HIT, x: 960, y: 465, R: 520, dur: 1.6, flat: 0.42, a: 0.34, rgb: [122, 164, 168], seed: 916 });
        I.flyWhite(c, t, { t0: HIT, dur: 0.32, hold: 1.4, fade: 0.9, x0: 610, y0: 495, x1: 1310, y1: 435, w: 46, kind: 'gold', a: 0.42, seed: 918 });
      });

      if (t >= HIT && t < HIT + 0.32) {
        I.flash(c, 0.36 * (1 - (t - HIT) / 0.32), { x: 960, y: 460, rgb: [242, 234, 208], mode: 'lighter' });
      }
      ZL.chronalVignette(c, t, { mode: 'star', k: 0.86, a: 0.9, seed: 917 });
    },

    /* 6-13 [177.0..190.0]：「请圣人决断。」星光下郑重拱手 → 184.6s「斩龙封神」朱印落定 → 温润宣纸收卷留韵！ */
    '6-13': function (c, t, lt) {
      var cam = M.cam(lt, [
        [0.0,  { x: 0, y: 10, zoom: 1.09 }],
        [13.0, { x: 0, y: -8, zoom: 1.00 }, 'smooth']
      ]);
      I.plateFlow(c, 'p-ziwei-starpalace', t, { cam: cam, amp: 2.8, scale: 400, speed: 0.05, seed: 921 });

      withCam(c, cam, function () {
        ZL.starEmbryo(c, t, { x: 960, y: 425, s: 0.96, seatsK: 0.85, heavyK: 0.85, a: 0.84, seed: 922 });
        ZL.spiritDust(c, t, { n: 54, rgb: [216, 192, 136], speed: 10, a: 0.52, seed: 923 });
      });

      // 右侧星光下郑重拱手道揖的「杨祖」：「请圣人决断。」
      rigAt(c, 'sp-yang-true', t, {
        cam: cam, s: 0.205, dx: 345, dy: 162, flipX: true,
        script: {
          root: [
            { t: 177.0, dx: 0, dy: 0, rot: 0, s: 1.0 },
            { t: 178.4, dx: -10, dy: 8, rot: -0.04, s: 1.0, ease: 'inOutSine' },
            { t: 190.0, dx: -8, dy: 6, rot: -0.032, s: 1.0 }
          ],
          wind: { dirDeg: 18, base: 0.2 },
          breathe: { period: 5.6, amp: 0.36 }
        }
      });

      // 左侧凝立星海、肩负太霄千钧决断的余慈
      rigAt(c, 'sp-yuci-look-3', t, {
        cam: cam, s: 0.178, dx: -345, dy: 168, wind: 0.22, period: 5.0, breathe: 0.48
      });

      ZL.chronalVignette(c, t, { mode: 'star', k: 0.78, a: 0.82, seed: 924 });

      // 186.8..190.0s（终句 T136 早已淡出）：漫天星光柔和敛入温润宣纸长卷，唯留「斩龙封神」朱砂古印常驻收卷！
      if (t > 186.6) {
        var scrollVeil = U.smooth((t - 186.6) / 2.9) * 0.92;
        I.paper(c, scrollVeil);
      }
    }
  };

  var LEDGER_POS = {
    T120: { x: W * 0.09, y: H * 0.13, side: 'left' },
    T128: { x: W * 0.09, y: H * 0.13, side: 'left' },
    T132: { x: W * 0.09, y: H * 0.13, side: 'left' }
  };

  CINE.registerAct({
    id: 'coda',
    order: 6,
    name: '尾 · 碧血开道',
    duration: 190,
    beats: SHEET.beats,
    cues: {
      rainbow:    { t: 62.0,  beat: '6-05', label: '碧血化虹' },
      starpalace: { t: 104.0, beat: '6-08', label: '紫微星殿' },
      qingjing:   { t: 137.2, beat: '6-10', label: '清净散人' },
      decide:     { t: 174.0, beat: '6-12', label: '请圣人决断' }
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
      // 6-01..6-06 为浅暖宣纸底（dark:false）；6-07(89.2s)起入磁青描金星空大殿（dark:true）
      var isDark = t >= 89.2;
      I.screen(c);
      I.ledger(c, t, 'coda', { dark: isDark, seals: false, pos: LEDGER_POS });
      // T137（184.6s–常驻）：右下角朱砂古篆白文大印「斩龙封神」沉稳落定，跨越宣纸收卷常驻至 1320.0s
      drawEndSeal(c, t, 184.6);
    }
  });
})();
