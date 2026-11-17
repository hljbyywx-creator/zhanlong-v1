/* 《斩龙封神》专属高神韵动效库 js/lib-zhanlong.js —— 挂载于 CINE.zl 及 CINE.ink.zl。
   审美铁律：南宋水墨皴染＋青绿金碧矿物重彩＋上清古金石蝌蚪篆刻；零等宽几何圆环、零硬边直线、零霓虹高饱和色。
   工程铁律：100% 纯 t 确定性（仅用 CINE.util 的 U.rng / U.hash / U.h2 / U.noise* / U.fbm*，零 Math.random / Date / 跨帧可变状态）。 */
(function () {
'use strict';
var CINE = window.CINE, I = CINE.ink, U = CINE.util, M = CINE.motion || {};
var W = CINE.W || 1920, H = CINE.H || 1080, TAU = Math.PI * 2;
var ZL = CINE.zl = I.zl = {};

/* ---------- 南宋矿物与干涸朱砂色板（严守色彩纪律） ---------- */
var PAL = ZL.PAL = {
  bloodHi: [124, 36, 28],
  bloodMid: [104, 28, 25],
  bloodDk: [88, 24, 22],
  bloodRust: [68, 22, 20],
  violet: [78, 62, 98],
  violetHi: [108, 86, 130],
  violetDk: [46, 36, 58],
  gold: [188, 156, 92],
  goldHi: [216, 190, 132],
  goldBronze: [138, 108, 56],
  redGold: [176, 112, 58],
  cyan: [88, 148, 146],
  cyanHi: [148, 198, 192],
  cyanMist: [176, 212, 206],
  stoneCyan: [64, 114, 122],
  jade: [46, 128, 96],
  jadeHi: [92, 172, 136],
  abyssGreen: [38, 96, 78],
  abyssDeep: [20, 52, 44],
  ink: [24, 22, 20],
  inkSoft: [48, 44, 40],
  ash: [142, 136, 126],
  bone: [206, 198, 182],
  nephrite: [232, 228, 214],
  celadon: [138, 156, 148],
  starBg: [22, 30, 46],
  scorch: [82, 58, 40],
  scorchDk: [44, 34, 30]
};

function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }
function cl01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function mix3(a, b, k) {
  k = cl01(k);
  return [
    Math.round(a[0] + (b[0] - a[0]) * k),
    Math.round(a[1] + (b[1] - a[1]) * k),
    Math.round(a[2] + (b[2] - a[2]) * k)
  ];
}
function expoOut(x, k) {
  x = cl01(x); k = k || 6;
  return x >= 1 ? 1 : (1 - Math.pow(2, -k * x)) / (1 - Math.pow(2, -k));
}
function expoIn(x, k) {
  x = cl01(x); k = k || 6;
  return x <= 0 ? 0 : (Math.pow(2, k * (x - 1)) - Math.pow(2, -k)) / (1 - Math.pow(2, -k));
}

/* 离屏印章确定性稳定化（避免软件光栅首画与后画 mipmap 差 1 级） */
var SETTLE_CTX = null;
function settle(cv) {
  if (!SETTLE_CTX) SETTLE_CTX = U.canvas(4, 4).getContext('2d');
  SETTLE_CTX.drawImage(cv, 0, 0, 4, 4);
  return cv;
}
function drawStamp(c, cv, x, y, w, h, rot, a, mode, flipX) {
  if (!cv || a <= 0.003 || w <= 0.2 || h <= 0.2) return;
  c.save();
  if (mode) c.globalCompositeOperation = mode;
  c.globalAlpha *= Math.min(1, a);
  c.translate(x, y);
  if (rot) c.rotate(rot);
  if (flipX) c.scale(-1, 1);
  var sm = c.imageSmoothingEnabled, sq = c.imageSmoothingQuality;
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'low';
  c.drawImage(cv, -w * 0.5, -h * 0.5, w, h);
  c.imageSmoothingEnabled = sm;
  c.imageSmoothingQuality = sq;
  c.restore();
}

/* 浅宣纸底衬焦墨暗座：保证 screen/lighter 光韵在浅纸上厚重可读、不发白飘浮 */
function scorchSeat(c, x, y, rw, rh, a, seed, rgb, rot) {
  if (a <= 0.003) return;
  c.save();
  c.globalCompositeOperation = 'multiply';
  I.wash(c, x, y, rw, rh, Math.min(1, a), seed || 7, rgb || PAL.scorch, rot || 0, { edge: 'soft' });
  c.restore();
}

/* 二维无散旋度流场（∇×ψ）：由 fbm2 差分求流线速度，有机涡旋永不聚散成硬块 */
function curl2(x, y, t, scale, seed) {
  var sc = scale || 240, eps = 0.06;
  var nx = x / sc, ny = y / sc, z = t * 0.16;
  var p1 = U.fbm2(nx, ny + eps + z, seed, 3);
  var p2 = U.fbm2(nx, ny - eps + z, seed, 3);
  var p3 = U.fbm2(nx + eps - z * 0.7, ny, seed, 3);
  var p4 = U.fbm2(nx - eps - z * 0.7, ny, seed, 3);
  return [(p1 - p2) / (2 * eps), -(p3 - p4) / (2 * eps)];
}

/* 断续飞白毛笔弧（替代任何闭合几何圆环）：多段留缺口、笔路手抖、起收锋尖 */
function brokenBrushLoop(c, x, y, rx, ry, rot, a, seed, o) {
  o = o || {};
  if (a <= 0.003 || rx < 2 || ry < 2) return;
  var segs = o.segs || 4, rgb = o.rgb || PAL.ink, w = o.w || 6, spin = o.spin || 0;
  var dry = o.dry == null ? 0.35 : o.dry, mode = o.mode || null;
  c.save();
  c.translate(x, y);
  if (rot) c.rotate(rot);
  for (var s = 0; s < segs; s++) {
    var sd = seed + s * 37;
    var span = (TAU / segs) * (0.58 + 0.24 * U.hash(sd + 1));
    var a0 = spin + (s / segs) * TAU + (U.hash(sd + 2) - 0.5) * 0.28;
    var N = Math.max(8, Math.min(28, Math.round(span * Math.max(rx, ry) / 18)));
    var pts = [];
    for (var i = 0; i <= N; i++) {
      var u = i / N, th = a0 + span * u;
      var jit = 1 + 0.055 * U.noise1(th * 2.7 + sd * 0.13, sd) + 0.025 * U.noise1(th * 8.1, sd + 5);
      pts.push([Math.cos(th) * rx * jit, Math.sin(th) * ry * jit]);
    }
    if (dry > 0.45) {
      I.dry(c, pts, { raw: true, n: pts.length + 6, w: w * (0.8 + 0.4 * U.hash(sd + 9)), a: a * (0.72 + 0.28 * U.hash(sd + 3)), rgb: rgb, dry: dry, seed: sd, mode: mode });
    } else {
      I.sweep(c, pts, { raw: true, n: pts.length + 6, w: w * (0.8 + 0.4 * U.hash(sd + 9)), a: a * (0.75 + 0.25 * U.hash(sd + 3)), rgb: rgb, dry: dry, seed: sd, mode: mode, head: 0.16, tail: 0.34, wob: 0.24 });
    }
  }
  c.restore();
}

/* ==================== 预渲染水墨金石印章（U.cached，按变体与量化色缓存） ==================== */

/* 1. 上清古篆蝌蚪真文印章（饱满墨首＋游鱼曳尾＋金石横竖契刻，12 种古文变体） */
function stampTadpoleRune(variant, rgb) {
  var v = ((variant | 0) % 12 + 12) % 12;
  var q = U.qrgb(rgb || PAL.gold);
  return U.cached('zl:rune:' + v + ':' + q.join(','), function () {
    var S = 96, cv = U.canvas(S, S), x = cv.getContext('2d'), r = U.rng(911 + v * 73);
    I.wash(x, S * 0.5, S * 0.46, S * 0.34, S * 0.36, 0.16, 30 + v, q, 0, { edge: 'soft' });
    // 主干蝌蚪笔：重顿头、曲折游尾
    var hx = S * (0.38 + r.pm(0.1)), hy = S * (0.24 + r() * 0.1);
    x.fillStyle = U.rgba(q, 0.92);
    I.blot(x, hx, hy, S * (0.075 + r() * 0.03), 40 + v, { rough: 0.26, sx: 1.15, sy: 0.9, rot: r.pm(0.5) });
    x.fill();
    var spine = [[hx, hy]];
    var px = hx, py = hy;
    for (var i = 1; i <= 4; i++) {
      px = U.clamp(px + r.pm(S * 0.18), S * 0.18, S * 0.82);
      py += S * (0.13 + r() * 0.04);
      spine.push([px, py]);
    }
    I.stroke(x, spine, { w: S * 0.09, a: 0.92, rgb: q, seed: 100 + v, head: 0.04, tail: 0.65, wob: 0.24, fb: 0.25, bleed: 0.12 });
    // 副笔：云篆横折或双翼勾挑
    var arms = 2 + (v % 2);
    for (var j = 0; j < arms; j++) {
      var ay = S * (0.32 + j * 0.2 + r.pm(0.04));
      var x0 = S * (0.22 + r() * 0.12), x1 = S * (0.66 + r() * 0.14);
      var midY = ay + r.pm(S * 0.1);
      var sub = [[x0, ay], [(x0 + x1) * 0.5, midY], [x1, ay + r.pm(S * 0.08)], [x1 + r.pm(S * 0.06), ay + S * 0.12]];
      I.stroke(x, sub, { w: S * 0.058, a: 0.86, rgb: q, seed: 200 + v * 5 + j, head: 0.12, tail: 0.55, wob: 0.22, bleed: 0.08 });
    }
    // 蝌蚪灵点
    x.fillStyle = U.rgba(q, 0.88);
    I.blot(x, S * (0.28 + r() * 0.44), S * (0.22 + r() * 0.5), S * 0.042, 310 + v, { rough: 0.28, sx: 1.4, sy: 0.8, rot: r.pm(1) });
    x.fill();
    return settle(cv);
  });
}

/* 2. 上清朱砂暗金符文铁索单环（侧锋锻铁双弧＋焦墨阴翳＋金石符印，6 种形） */
function stampChainLink(variant, runeK) {
  var v = ((variant | 0) % 6 + 6) % 6;
  var rk = Math.round(cl01(runeK == null ? 0.7 : runeK) * 4) / 4;
  return U.cached('zl:link:' + v + ':' + rk, function () {
    var Wc = 132, Hc = 68, cv = U.canvas(Wc, Hc), x = cv.getContext('2d'), sd = 520 + v * 41;
    I.wash(x, Wc * 0.5, Hc * 0.52, Wc * 0.44, Hc * 0.38, 0.34, sd, PAL.scorchDk, 0, { edge: 'wet' });
    // 上下两道咬合锻铁枯湿弧
    var topArc = [], botArc = [];
    for (var i = 0; i <= 16; i++) {
      var th = Math.PI * (0.92 + 1.16 * (i / 16));
      topArc.push([Wc * 0.5 + Math.cos(th) * Wc * 0.37, Hc * 0.5 + Math.sin(th) * Hc * 0.31]);
      var th2 = -Math.PI * 0.08 + Math.PI * 1.16 * (i / 16);
      botArc.push([Wc * 0.5 + Math.cos(th2) * Wc * 0.37, Hc * 0.5 + Math.sin(th2) * Hc * 0.31]);
    }
    I.sweep(x, topArc, { raw: true, n: 28, w: 15, a: 0.94, rgb: PAL.ink, dry: 0.28, seed: sd + 1, head: 0.1, tail: 0.18 });
    I.sweep(x, botArc, { raw: true, n: 28, w: 15, a: 0.94, rgb: PAL.bloodDk, dry: 0.24, seed: sd + 2, head: 0.18, tail: 0.1 });
    I.dry(x, topArc, { raw: true, n: 26, w: 9, a: 0.78, rgb: PAL.bloodHi, dry: 0.48, seed: sd + 3 });
    if (rk > 0) {
      var rc = mix3(PAL.bloodHi, PAL.gold, 0.65);
      I.stroke(x, [[Wc * 0.28, Hc * 0.24], [Wc * 0.5, Hc * 0.19], [Wc * 0.72, Hc * 0.25]], { w: 3.2, a: 0.85 * rk, rgb: rc, seed: sd + 9, head: 0.2, tail: 0.35, bleed: 0 });
      I.stroke(x, [[Wc * 0.32, Hc * 0.76], [Wc * 0.52, Hc * 0.81], [Wc * 0.68, Hc * 0.75]], { w: 2.8, a: 0.75 * rk, rgb: PAL.gold, seed: sd + 11, head: 0.2, tail: 0.35, bleed: 0 });
    }
    return settle(cv);
  });
}

/* 3. 没骨水墨青莲单瓣（莹洁湖玉晕染＋淡青墨叶脉＋瓣尖微露，6 种形） */
function stampLotusPetal(variant, inner) {
  var v = ((variant | 0) % 6 + 6) % 6;
  var tag = inner ? 'in' : 'out';
  return U.cached('zl:petal:' + v + ':' + tag, function () {
    var Wc = 120, Hc = 200, cv = U.canvas(Wc, Hc), x = cv.getContext('2d'), sd = 710 + v * 29;
    var baseCol = inner ? PAL.cyanHi : PAL.cyan;
    var tipCol = inner ? [222, 242, 236] : PAL.cyanMist;
    // 没骨瓣身（下收上阔再敛尖）
    x.save();
    x.beginPath();
    x.moveTo(Wc * 0.5, Hc * 0.92);
    x.bezierCurveTo(Wc * 0.12, Hc * 0.72, Wc * 0.08, Hc * 0.34, Wc * 0.5 + (v % 2 ? 2 : -2), Hc * 0.06);
    x.bezierCurveTo(Wc * 0.92, Hc * 0.34, Wc * 0.88, Hc * 0.72, Wc * 0.5, Hc * 0.92);
    x.closePath();
    x.clip();
    I.wash(x, Wc * 0.5, Hc * 0.54, Wc * 0.44, Hc * 0.46, 0.72, sd, baseCol, 0, { edge: 'soft' });
    I.wash(x, Wc * 0.5, Hc * 0.24, Wc * 0.34, Hc * 0.28, 0.65, sd + 3, tipCol, 0, { edge: 'soft' });
    I.wash(x, Wc * 0.5, Hc * 0.82, Wc * 0.26, Hc * 0.18, 0.45, sd + 5, PAL.jade, 0, { edge: 'wet' });
    x.restore();
    // 瓣缘细润水墨青线与五道叶脉
    var leftEdge = [[Wc * 0.5, Hc * 0.91], [Wc * 0.23, Hc * 0.64], [Wc * 0.22, Hc * 0.32], [Wc * 0.5, Hc * 0.07]];
    var rightEdge = [[Wc * 0.5, Hc * 0.91], [Wc * 0.77, Hc * 0.64], [Wc * 0.78, Hc * 0.32], [Wc * 0.5, Hc * 0.07]];
    I.stroke(x, leftEdge, { w: 2.4, a: 0.52, rgb: PAL.stoneCyan, seed: sd + 7, head: 0.15, tail: 0.25, bleed: 0.1 });
    I.stroke(x, rightEdge, { w: 2.4, a: 0.52, rgb: PAL.stoneCyan, seed: sd + 8, head: 0.15, tail: 0.25, bleed: 0.1 });
    for (var k = -2; k <= 2; k++) {
      var spread = k * Wc * 0.11;
      var vein = [[Wc * 0.5, Hc * 0.88], [Wc * 0.5 + spread * 0.55, Hc * 0.56], [Wc * 0.5 + spread * 0.85, Hc * (0.16 + Math.abs(k) * 0.07)]];
      I.stroke(x, vein, { w: k === 0 ? 2.0 : 1.3, a: 0.42, rgb: mix3(PAL.stoneCyan, PAL.cyanHi, 0.45), seed: sd + 20 + k, head: 0.1, tail: 0.6, bleed: 0 });
    }
    return settle(cv);
  });
}

/* 4. 太霄白羽印章（微弯羽轴＋松灵丝绒羽片，5 种形） */
function stampFeather(variant) {
  var v = ((variant | 0) % 5 + 5) % 5;
  return U.cached('zl:feather:' + v, function () {
    var Wc = 110, Hc = 44, cv = U.canvas(Wc, Hc), x = cv.getContext('2d'), sd = 820 + v * 19;
    var bow = (v % 2 ? 1 : -1) * 4;
    I.wash(x, Wc * 0.54, Hc * 0.5 + bow * 0.3, Wc * 0.38, Hc * 0.32, 0.82, sd, PAL.nephrite, 0.04, { edge: 'soft' });
    var quill = [[Wc * 0.08, Hc * 0.54], [Wc * 0.48, Hc * 0.5 + bow], [Wc * 0.92, Hc * 0.46]];
    for (var i = 0; i < 9; i++) {
      var u = 0.2 + i * 0.08, bx = Wc * u, by = Hc * 0.5 + bow * Math.sin(Math.PI * u);
      I.dry(x, [[bx, by], [bx + 9, by - 9 - (i % 3)], [bx + 15, by - 11]], { w: 4.5, a: 0.65, rgb: [246, 243, 234], dry: 0.35, seed: sd + i });
      I.dry(x, [[bx, by], [bx + 8, by + 8 + (i % 2)], [bx + 14, by + 10]], { w: 4.2, a: 0.58, rgb: [238, 234, 222], dry: 0.4, seed: sd + 20 + i });
    }
    I.stroke(x, quill, { w: 2.2, a: 0.88, rgb: PAL.bone, seed: sd + 40, head: 0.08, tail: 0.55, bleed: 0 });
    I.stroke(x, [[Wc * 0.72, Hc * 0.48 + bow * 0.4], [Wc * 0.93, Hc * 0.46]], { w: 2.0, a: 0.45, rgb: PAL.inkSoft, seed: sd + 45, head: 0.3, tail: 0.5, bleed: 0 });
    return settle(cv);
  });
}

/* 5. 写意仙鹤展翅印章（按 12 档振翅相位缓存：修长曲颈＋丹顶一点＋水墨飞白双翼＋玄黑翎梢） */
function stampCrane(phaseIdx) {
  var p = ((phaseIdx | 0) % 12 + 12) % 12;
  return U.cached('zl:crane:' + p, function () {
    var Wc = 260, Hc = 220, cv = U.canvas(Wc, Hc), x = cv.getContext('2d');
    var ang = p / 12 * TAU, flap = Math.sin(ang); // -1 下扑，+1 高扬
    var cx = Wc * 0.46, cy = Hc * 0.56;
    // 远翼（后侧翼）
    var fy = cy - 48 * flap - 14, fx = cx - 22 + 12 * flap;
    var farWing = [[cx - 6, cy - 4], [(cx + fx) * 0.5 - 10, (cy + fy) * 0.5 - 14], [fx, fy]];
    I.sweep(x, farWing, { w: 26, a: 0.78, rgb: PAL.bone, dry: 0.25, seed: 901 + p, head: 0.15, tail: 0.45 });
    I.dry(x, [farWing[1], [fx - 18, fy + 8]], { w: 14, a: 0.72, rgb: PAL.inkSoft, dry: 0.45, seed: 920 + p });
    // 鹤身与尾羽玄墨
    I.wash(x, cx, cy, 34, 15, 0.92, 930, [246, 242, 232], -0.1, { edge: 'soft' });
    I.sweep(x, [[cx - 22, cy + 2], [cx - 58, cy + 12], [cx - 88, cy + 22]], { w: 12, a: 0.85, rgb: PAL.ink, dry: 0.42, seed: 935, head: 0.1, tail: 0.55 });
    // 修长向后微掠的双足
    I.stroke(x, [[cx - 18, cy + 8], [cx - 56, cy + 20], [cx - 96, cy + 29]], { w: 2.6, a: 0.72, rgb: PAL.inkSoft, seed: 940, head: 0.1, tail: 0.5, bleed: 0 });
    // 曲颈与丹顶、长喙
    var neck = [[cx + 22, cy - 4], [cx + 52, cy - 16], [cx + 78, cy - 22], [cx + 98, cy - 20]];
    I.stroke(x, neck, { w: 8.5, a: 0.95, rgb: [248, 245, 236], seed: 945, head: 0.12, tail: 0.35, bleed: 0 });
    I.stroke(x, [[cx + 26, cy - 2], [cx + 58, cy - 14]], { w: 3.4, a: 0.65, rgb: PAL.ink, seed: 946, head: 0.15, tail: 0.45, bleed: 0 });
    x.fillStyle = U.rgba(PAL.bloodHi, 0.9);
    I.blot(x, cx + 95, cy - 23, 4.2, 948, { rough: 0.2, sx: 1.3, sy: 0.85 });
    x.fill();
    I.stroke(x, [[cx + 99, cy - 20], [cx + 122, cy - 18]], { w: 2.8, a: 0.86, rgb: PAL.goldBronze, seed: 949, head: 0.08, tail: 0.7, bleed: 0 });
    // 近翼（主视觉阔翼＋六道飞白主羽＋墨黑翼尖）
    var ny = cy + 56 * flap - 8, nx = cx - 12 - 16 * flap;
    var nearWing = [[cx + 6, cy - 2], [cx - 6, cy + 26 * flap - 6], [nx, ny]];
    I.sweep(x, nearWing, { w: 34, a: 0.95, rgb: [250, 247, 238], dry: 0.2, seed: 960 + p, head: 0.12, tail: 0.4 });
    for (var k = 0; k < 6; k++) {
      var u = 0.35 + k * 0.13;
      var rx0 = U.lerp(cx + 2, nx, u), ry0 = U.lerp(cy, ny, u);
      var tipX = rx0 - 26 - k * 5, tipY = ry0 + (flap >= 0 ? 18 : -10) + k * 3;
      I.stroke(x, [[rx0, ry0], [(rx0 + tipX) * 0.5, (ry0 + tipY) * 0.5], [tipX, tipY]], { w: 5.5 - k * 0.4, a: 0.88, rgb: [244, 240, 230], seed: 970 + k, head: 0.1, tail: 0.6, fb: 0.3 });
      I.stroke(x, [[U.lerp(rx0, tipX, 0.62), U.lerp(ry0, tipY, 0.62)], [tipX, tipY]], { w: 4.2, a: 0.82, rgb: PAL.ink, seed: 980 + k, head: 0.2, tail: 0.65, fb: 0.35 });
    }
    return settle(cv);
  });
}

/* 6. 残缺太古天龙断角与残爪水墨印章 */
function stampDragonPart(kind, variant) {
  var v = ((variant | 0) % 3 + 3) % 3;
  return U.cached('zl:dragon:' + kind + ':' + v, function () {
    var S = 140, cv = U.canvas(S, S), x = cv.getContext('2d'), sd = 1100 + v * 31;
    if (kind === 'horn') {
      // 嶙峋断角：粗壮龙角中途参差折断，断面崩裂暗红煞丝
      var trunk = [[S * 0.25, S * 0.84], [S * 0.38, S * 0.56], [S * 0.58, S * 0.34]];
      I.sweep(x, trunk, { w: 22, a: 0.92, rgb: PAL.ink, dry: 0.32, seed: sd, head: 0.08, tail: 0.12 });
      I.dry(x, trunk, { w: 14, a: 0.78, rgb: PAL.bloodMid, dry: 0.45, seed: sd + 2 });
      // 参差断茬与旁生短杈
      I.stroke(x, [[S * 0.36, S * 0.6], [S * 0.22, S * 0.42], [S * 0.18, S * 0.3]], { w: 9, a: 0.86, rgb: PAL.ink, seed: sd + 5, head: 0.1, tail: 0.55, fb: 0.35 });
      I.dry(x, [[S * 0.54, S * 0.38], [S * 0.68, S * 0.26]], { w: 15, a: 0.85, rgb: PAL.bloodHi, dry: 0.65, seed: sd + 7 });
    } else {
      // 残缺龙爪：掌骨苍劲，三趾一趾齐根折断，余两趾如铁钩撕裂
      I.sweep(x, [[S * 0.22, S * 0.24], [S * 0.46, S * 0.46]], { w: 18, a: 0.9, rgb: PAL.ink, dry: 0.3, seed: sd + 11 });
      var toes = [
        [[S * 0.46, S * 0.46], [S * 0.72, S * 0.42], [S * 0.86, S * 0.56]],
        [[S * 0.44, S * 0.48], [S * 0.62, S * 0.68], [S * 0.72, S * 0.86]],
        [[S * 0.40, S * 0.50], [S * 0.44, S * 0.66]] // 折断残趾
      ];
      for (var i = 0; i < toes.length; i++) {
        I.stroke(x, toes[i], { w: i === 2 ? 10 : 8.5, a: 0.9, rgb: i === 2 ? PAL.bloodMid : PAL.ink, seed: sd + 20 + i, head: 0.1, tail: i === 2 ? 0.1 : 0.65, fb: 0.28 });
      }
    }
    return settle(cv);
  });
}

/* ==================== 三大通用神韵与动作辅助函数 ==================== */

/* A. zl.spiritDust：旋度流场矿物灵尘/醉灵气潮/紫微星屑 */
ZL.spiritDust = function (c, t, o) {
  o = o || {};
  var A = num(o.a, 1), n = Math.max(1, Math.min(180, Math.round(num(o.n, 48))));
  if (A <= 0.003) return;
  var sd = num(o.seed, 101), rgb = o.rgb || PAL.gold, dir = num(o.dir, -Math.PI * 0.5);
  var spd = num(o.speed, 28), curlAmt = num(o.curl, 1);
  var box = o.box || [-60, -60, W + 120, H + 120];
  var bx = box[0], by = box[1], bw = box[2], bh = box[3];
  var vx = Math.cos(dir) * spd, vy = Math.sin(dir) * spd;

  for (var i = 0; i < n; i++) {
    var h1 = U.hash(sd * 31 + i * 7), h2 = U.hash(sd * 31 + i * 7 + 3), h3 = U.hash(sd * 31 + i * 7 + 5);
    var tier = i % 3; // 0 远景柔晕，1 中景墨金微粒，2 近景拖尾灵星
    var pSpd = 0.55 + 0.75 * h3;
    var px = bx + U.fract(h1 + (vx * pSpd * t) / Math.max(1, bw)) * bw;
    var py = by + U.fract(h2 + (vy * pSpd * t) / Math.max(1, bh)) * bh;
    var cf = curl2(px, py, t * (0.6 + 0.5 * h3), 260 - tier * 40, sd + tier * 19);
    px += cf[0] * 38 * curlAmt;
    py += cf[1] * 38 * curlAmt;

    var pulse = 0.55 + 0.45 * Math.sin(t * (1.4 + h3 * 1.8) + i * 2.1);
    var pa = A * pulse * (tier === 0 ? 0.36 : tier === 1 ? 0.72 : 0.9);
    if (pa <= 0.004) continue;
    var ang = Math.atan2(vy * pSpd + cf[1] * 36 * curlAmt, vx * pSpd + cf[0] * 36 * curlAmt);

    if (tier === 0) {
      I.wash(c, px, py, 14 + 12 * h1, 10 + 8 * h2, pa * 0.45, sd + i, rgb, ang, { edge: 'soft' });
    } else {
      var sz = (tier === 2 ? 3.2 : 2.1) * (0.7 + 0.7 * h1);
      if (o.scorch !== false && tier === 2) scorchSeat(c, px, py, sz * 4.2, sz * 3.6, pa * 0.28, sd + i, PAL.scorch, ang);
      if (tier === 2 && h2 > 0.45) {
        var tailL = (12 + 16 * h3) * (0.5 + 0.5 * curlAmt);
        var wake = [
          [px - Math.cos(ang) * tailL, py - Math.sin(ang) * tailL],
          [px - Math.cos(ang) * tailL * 0.45 + cf[1] * 5, py - Math.sin(ang) * tailL * 0.45 - cf[0] * 5],
          [px, py]
        ];
        I.stroke(c, wake, { raw: true, n: 12, w: sz * 0.9, a: pa * 0.52, rgb: rgb, seed: sd + i, head: 0.65, tail: 0.08, bleed: 0 });
      }
      c.save();
      c.fillStyle = U.rgba(rgb, Math.min(1, pa));
      I.blot(c, px, py, sz, sd + i * 11, { rough: 0.28, n: 10, sx: 1.45, sy: 0.82, rot: ang });
      c.fill();
      if (tier === 2) {
        c.globalCompositeOperation = 'lighter';
        I.glow(c, px, py, sz * 3.8, rgb, pa * 0.34);
      }
      c.restore();
    }
  }
};

/* B. zl.chronalVignette：宣纸水墨有机四角气韵框景（严禁矩形黑边或几何圆框！） */
ZL.chronalVignette = function (c, t, o) {
  o = o || {};
  var k = cl01(num(o.k, 1)), A = num(o.a, 1) * k, sd = num(o.seed, 103);
  if (A <= 0.003) return;
  var mode = o.mode || 'dream';
  var colPrimary, colAccent, edgeStyle, compMode;
  if (mode === 'reality') {
    colPrimary = PAL.bloodRust; colAccent = PAL.ink; edgeStyle = 'wet'; compMode = 'multiply';
  } else if (mode === 'rewind') {
    colPrimary = [52, 42, 30]; colAccent = PAL.goldBronze; edgeStyle = 'wet'; compMode = 'multiply';
  } else if (mode === 'star') {
    colPrimary = PAL.starBg; colAccent = PAL.violetDk; edgeStyle = 'soft'; compMode = 'multiply';
  } else {
    colPrimary = PAL.violet; colAccent = PAL.gold; edgeStyle = 'soft'; compMode = 'source-over';
  }

  c.save();
  I.screen(c);
  // 若 fx-realm-edge 已载入，叠一层随呼吸微动的周边乱墨纸缘
  var T = I.fxTex && I.fxTex('realm-edge');
  if (T && I.flow) {
    var br = 1.04 + 0.02 * Math.sin(t * 0.7 + sd);
    I.flow(c, T.id, t, {
      src: T.src, tint: colPrimary, tintMix: 0.85, mode: compMode, alpha: A * 0.42,
      dst: [-W * 0.14 * br, -H * 0.18 * br, W * (1 + 0.28 * br), H * (1 + 0.36 * br)],
      warp: { amp: 28, scale: 320, speed: 0.14, seed: sd }
    });
  }

  // 14 团不规则边隅水墨晕染（沿四周非对称起伏分布，中景完全通透）
  var anchors = [
    [0.02, 0.04, 420, 260, 0.2], [0.24, -0.02, 360, 170, -0.08], [0.76, -0.02, 380, 175, 0.09], [0.98, 0.05, 430, 265, -0.22],
    [-0.02, 0.36, 230, 320, 0.12], [1.02, 0.38, 240, 330, -0.14], [-0.02, 0.72, 250, 310, -0.1], [1.02, 0.70, 250, 320, 0.11],
    [0.03, 0.96, 440, 270, -0.18], [0.28, 1.02, 390, 180, 0.06], [0.72, 1.02, 390, 185, -0.07], [0.97, 0.96, 450, 275, 0.19]
  ];
  c.save();
  c.globalCompositeOperation = compMode;
  for (var i = 0; i < anchors.length; i++) {
    var p = anchors[i], breath = 0.86 + 0.18 * U.fbm1(t * 0.35 + i * 1.7, sd + i, 2);
    var col = (i % 3 === 1) ? colAccent : colPrimary;
    I.wash(c, p[0] * W + U.noise1(t * 0.25, sd + i) * 22, p[1] * H + U.noise1(t * 0.22, sd + 20 + i) * 16,
      p[2] * breath, p[3] * breath, A * (mode === 'dream' ? 0.22 : 0.36), sd + i * 7, col, p[4], { edge: edgeStyle });
  }
  c.restore();

  // 光阴回溯态：上下边缘掠过古拓枯笔逆流细丝；入梦/星殿态：边隅微泛金紫灵晕
  if (mode === 'rewind') {
    for (var j = 0; j < 6; j++) {
      var u = U.fract(U.hash(sd + j * 13) - t * (0.28 + 0.12 * (j % 3)));
      var rx = u * (W + 320) - 160, ry = (j < 3 ? 42 + j * 26 : H - 42 - (j - 3) * 26) + U.noise1(t + j, sd) * 14;
      I.dry(c, [[rx + 180, ry], [rx + 85, ry - 6], [rx, ry + 4]], {
        w: 11, a: A * 0.32 * Math.sin(Math.PI * u), rgb: PAL.goldBronze, dry: 0.62, seed: sd + 50 + j
      });
    }
  } else if (mode === 'dream' || mode === 'star') {
    c.save();
    c.globalCompositeOperation = 'lighter';
    var glowCol = mode === 'star' ? PAL.gold : PAL.violetHi;
    I.glow(c, 110, 90, 280, glowCol, A * 0.12 * (0.8 + 0.2 * Math.sin(t * 0.9)));
    I.glow(c, W - 110, H - 90, 300, PAL.gold, A * 0.1 * (0.8 + 0.2 * Math.cos(t * 0.8)));
    c.restore();
  }
  c.restore();
};

/* C. zl.slashImpact：千钧斩击水墨飞白（预备吸气 → 顿挫弧形刀罡 → 震波与飞溅余韵） */
ZL.slashImpact = function (c, t, t0, o) {
  o = o || {};
  var A = num(o.a, 1), sd = num(o.seed, 107);
  t0 = num(t0, 0);
  var dt = t - t0;
  if (A <= 0.003 || dt < -0.32 || dt > 2.8) return;

  var x0 = num(o.x0, 360), y0 = num(o.y0, 180), x1 = num(o.x1, 1560), y1 = num(o.y1, 880);
  var dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
  var ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  var mx = (x0 + x1) * 0.5, my = (y0 + y1) * 0.5;
  var kind = o.kind || 'blood';
  var colCore = kind === 'cyan' ? PAL.cyanHi : kind === 'gold' ? PAL.goldHi : PAL.bloodHi;
  var colBody = kind === 'cyan' ? PAL.cyan : kind === 'gold' ? PAL.gold : PAL.bloodDk;
  var colSub = kind === 'blood' ? PAL.ink : mix3(colBody, PAL.ink, 0.55);
  var w = num(o.w, Math.max(44, L * 0.068));

  // 书法微拱刀弧（绝不画死板直尺线）
  var bow = L * 0.042 * (U.hash(sd) < 0.5 ? 1 : -1);
  var arcPts = [];
  for (var i = 0; i <= 16; i++) {
    var s = i / 16, arch = Math.sin(Math.PI * s) * bow + U.noise1(s * 5, sd + 3) * 6;
    arcPts.push([x0 + dx * s + nx * arch, y0 + dy * s + ny * arch]);
  }

  // 1. 蓄势期 [t0 - 0.30, t0)：向内吸摄气机＋一线寒芒欲裂
  if (dt < 0) {
    var pk = cl01((dt + 0.30) / 0.30);
    if (M.inkShock) M.inkShock(c, t, { t0: t0 - 0.30, dur: 0.30, x: mx, y: my, R: L * 0.36, flat: 0.52, inward: true, rgb: colSub, a: 0.35 * A, seed: sd });
    scorchSeat(c, x0, y0, 130 * pk, 90 * pk, 0.35 * A * pk, sd, PAL.scorchDk, Math.atan2(dy, dx));
    I.stroke(c, [arcPts[0], arcPts[4], arcPts[8]], {
      raw: true, w: 3.5 * pk, a: 0.55 * A * pk, rgb: colCore, seed: sd + 2, head: 0.05, tail: 0.85, bleed: 0
    });
    return;
  }

  // 2. 斩落与余韵期 [t0, t0 + 2.8]
  var dur = num(o.dur, 0.14), hold = 0.85, fade = 1.3;
  var swK = expoOut(dt / dur, 7);
  var env = 1 - U.ramp(dt, dur + hold, dur + hold + fade);

  if (env > 0.004) {
    // 焦墨底痕先压暗宣纸
    I.sweep(c, arcPts, { raw: true, n: 42, k: swK, w: w * 1.45, a: 0.42 * A * env, rgb: PAL.scorchDk, mode: 'multiply', dry: 0.35, seed: sd + 5 });
    // 手绘飞白贴图叠层
    if (I.flyWhite) {
      I.flyWhite(c, t, {
        x0: x0, y0: y0, x1: x1, y1: y1, w: w * 1.6, t0: t0, dur: dur, hold: hold * 0.8, fade: fade * 0.8,
        kind: kind === 'gold' ? 'gold' : 'ink', tint: colBody, a: 0.82 * A, seed: sd + 7
      });
    }
    // 侧锋重墨刀身＋枯毫飞白锋刃＋高亮脊芒
    I.sweep(c, arcPts, { raw: true, n: 48, k: swK, w: w, a: 0.88 * A * env, rgb: colSub, dry: 0.28, seed: sd + 9, head: 0.06, tail: 0.32 });
    I.dry(c, arcPts, { raw: true, n: 48, k: swK, w: w * 0.82, a: 0.85 * A * env, rgb: colBody, dry: 0.48, seed: sd + 11 });
    c.save();
    c.globalCompositeOperation = 'lighter';
    I.stroke(c, arcPts, { raw: true, n: 44, k: swK, w: Math.max(4, w * 0.16), a: 0.78 * A * env, rgb: colCore, seed: sd + 13, head: 0.08, tail: 0.45, bleed: 0 });
    c.restore();
  }

  if (M.inkPath) M.inkPath(c, t, { pts: arcPts, t0: t0, dur: dur * 0.9, lag: 0.08, dry: 0.65, w: w * 0.55, rgb: colCore, glow: colBody, a: 0.75 * A, seed: sd + 15 });
  if (M.inkShock) M.inkShock(c, t, { t0: t0 + dur * 0.45, dur: 1.05, x: mx + nx * bow, y: my + ny * bow, R: L * 0.48, flat: 0.46, rgb: colBody, a: 0.52 * A, seed: sd + 17 });
  if (I.inkSplash) I.inkSplash(c, t, { x: mx + nx * bow, y: my + ny * bow, size: Math.min(640, L * 0.55), t0: t0 + dur * 0.35, dur: 0.28, hold: 0.65, fade: 0.9, rot: Math.atan2(dy, dx), tint: colBody, vary: true, a: 0.72 * A, seed: sd + 19 });

  // 沿斩向喷溅的泪滴墨血/青芒点
  if (dt < 1.1) {
    var spK = expoOut(dt / 0.55, 5), spA = A * (1 - U.ramp(dt, 0.45, 1.1));
    I.splat(c, x0 + dx * 0.68, y0 + dy * 0.68, w * 0.72, sd + 23, { k: spK, dir: Math.atan2(dy, dx), spread: 0.55, count: 18, rgb: colBody, a: 0.82 * spA });
  }
  if (M.after) M.after(c, t, t0 + dur * 0.4, { x: mx, y: my, dir: Math.atan2(dy, dx) - 0.35, spread: 1.1, n: 22, v: 440, rgb: colSub, smokeRgb: mix3(colBody, PAL.ash, 0.5), a: 0.7 * A, seed: sd + 29 });
};

/* ==================== MANIFEST 十七项专属道法视觉动效 ==================== */

/* 1. zl.purpleCanopy：云楼树氤氲紫气璎珞垂落＋金色古篆真文流转＋水墨苍枝探入掌心 */
ZL.purpleCanopy = function (c, t, o) {
  o = o || {};
  var A = num(o.a, 1), k = cl01(num(o.k, 1)), branchK = cl01(num(o.branchK, 0)), sd = num(o.seed, 11);
  if (A * Math.max(k, branchK) <= 0.003) return;
  var cx = num(o.x, W * 0.5), cy = num(o.y, 90), cw = num(o.w, 1680), ch = num(o.h, 540);
  var palm = Array.isArray(o.palm) && o.palm.length >= 2 ? [num(o.palm[0], W * 0.56), num(o.palm[1], H * 0.68)] : [W * 0.56, H * 0.68];
  var x0 = cx - cw * 0.5;

  if (k > 0.003) {
    var ak = A * k;
    // 树冠如盖：顶部层叠紫墨烟霞＋缓慢流淌雾带
    if (I.mistBand) I.mistBand(c, t, { x0: x0 - 80, y: cy - 60, w: cw + 160, h: ch * 0.55, speed: 16, warp: 26, tint: PAL.violet, a: 0.38 * ak, seed: sd });
    for (var m = 0; m < 9; m++) {
      var mx = x0 + (m + 0.5) / 9 * cw + U.noise1(t * 0.22 + m, sd) * 36;
      var my = cy + 20 * Math.sin(m * 1.4 + t * 0.35);
      I.wash(c, mx, my, cw * 0.14, ch * 0.22, 0.36 * ak, sd + m * 3, m % 2 ? PAL.violet : PAL.violetDk, 0, { edge: 'soft' });
    }

    // 18 缕垂落紫气璎珞（随清风钟摆摇曳，串缀温润紫玉/泥金气珠）
    var nStrands = 18;
    for (var i = 0; i < nStrands; i++) {
      var hi = U.hash(sd * 17 + i * 5), hi2 = U.hash(sd * 17 + i * 5 + 2);
      var sx = x0 + cw * (0.04 + 0.92 * (i + (hi - 0.5) * 0.45) / Math.max(1, nStrands - 1));
      var sy = cy + (hi2 - 0.5) * 45;
      var len = ch * (0.48 + 0.52 * Math.sin(Math.PI * ((i + 0.5) / nStrands)) * (0.65 + 0.5 * hi)) * expoOut(k, 4);
      var sway = (14 + 18 * hi2) * Math.sin(t * (0.55 + 0.35 * hi) + i * 0.9);
      var pts = [];
      for (var s = 0; s <= 10; s++) {
        var u = s / 10;
        var px = sx + sway * Math.pow(u, 1.35) + 8 * U.noise1(u * 3.2 - t * 0.45, sd + i);
        var py = sy + len * u;
        pts.push([px, py]);
      }
      I.sweep(c, pts, { raw: true, n: 26, w: 18 + 12 * hi, a: 0.26 * ak, rgb: PAL.violet, dry: 0.45, seed: sd + 30 + i, head: 0.08, tail: 0.6 });
      I.stroke(c, pts, { raw: true, n: 26, w: 3.4 + 2 * hi2, a: 0.48 * ak, rgb: PAL.violetHi, seed: sd + 60 + i, head: 0.1, tail: 0.65, bleed: 0.15 });
      // 璎珞气珠节
      for (var b = 2; b <= 8; b += 3) {
        var bp = pts[b], ba = ak * (0.42 + 0.25 * Math.sin(t * 1.6 + i + b));
        I.wash(c, bp[0], bp[1], 11, 15, ba * 0.55, sd + i + b, b === 5 ? PAL.gold : PAL.violetHi, 0, { edge: 'soft' });
      }
    }

    // 24 枚金色古篆真文沿紫气璎珞流转生灭
    for (var r = 0; r < 24; r++) {
      var hr1 = U.hash(sd * 29 + r * 11), hr2 = U.hash(sd * 29 + r * 11 + 3);
      var cyc = U.fract(hr2 + t * (0.055 + 0.04 * hr1));
      var rx = x0 + cw * (0.08 + 0.84 * hr1) + 22 * Math.sin(t * 0.7 + r * 1.7);
      var ry = cy + 20 + cyc * ch * 0.92;
      var ra = ak * Math.sin(Math.PI * cyc) * (0.65 + 0.35 * Math.sin(t * 2.1 + r));
      if (ra <= 0.02) continue;
      var rsz = (18 + 14 * hr2) * (0.85 + 0.3 * Math.sin(Math.PI * cyc));
      scorchSeat(c, rx, ry, rsz * 0.95, rsz * 0.95, ra * 0.32, sd + r, PAL.violetDk, 0);
      drawStamp(c, stampTadpoleRune(r, PAL.gold), rx, ry, rsz, rsz, 0.22 * Math.sin(t * 0.8 + r), ra * 0.88, null, false);
      drawStamp(c, stampTadpoleRune(r, PAL.goldHi), rx, ry, rsz, rsz, 0.22 * Math.sin(t * 0.8 + r), ra * 0.38, 'lighter', false);
    }
  }

  // branchK > 0：一枝苍劲水墨云楼枝干自紫霭深处蜿蜒生长，轻柔探入掌心
  if (branchK > 0.003) {
    var gk = M.grow ? M.grow(branchK, 0, 1) : expoOut(branchK, 5);
    var bx0 = U.lerp(cx, palm[0], 0.22) - 180, by0 = Math.max(0, cy - 10);
    var px1 = palm[0], py1 = palm[1];
    var dx = px1 - bx0, dy = py1 - by0;
    var bough = [
      [bx0, by0],
      [bx0 + dx * 0.26 - 48, by0 + dy * 0.32 + 22],
      [bx0 + dx * 0.54 + 34, by0 + dy * 0.58 - 18],
      [bx0 + dx * 0.80 - 16, by0 + dy * 0.84 + 14],
      [px1, py1]
    ];
    var sp = I.resample(I.spline(bough, 10), 48);
    // 枝干周围萦绕的淡紫灵霭
    var tipIdx = Math.max(1, Math.min(sp.length - 1, Math.round((sp.length - 1) * gk)));
    var tip = sp[tipIdx];
    for (var q = 4; q <= tipIdx; q += 6) {
      I.wash(c, sp[q][0], sp[q][1], 46, 30, 0.22 * A * branchK, sd + 90 + q, PAL.violet, 0, { edge: 'soft' });
    }
    // 苍墨主干＋飞白树皮皴擦
    I.sweep(c, sp, { raw: true, n: 48, k: gk, w: 26, a: 0.92 * A, rgb: PAL.ink, dry: 0.24, seed: sd + 101, head: 0.04, tail: 0.58, wf: function (s) { return Math.pow(1 - s * 0.76, 0.85); } });
    I.dry(c, sp, { raw: true, n: 48, k: gk, w: 18, a: 0.65 * A, rgb: PAL.scorch, dry: 0.52, seed: sd + 103 });
    // 三道旁逸细枝与紫金灵芽
    var forks = [[0.34, -1, 86], [0.58, 1, 72], [0.78, -1, 48]];
    for (var f = 0; f < forks.length; f++) {
      var fk = cl01((gk - forks[f][0]) / 0.28);
      if (fk <= 0) continue;
      var bi = Math.round(forks[f][0] * (sp.length - 1)), bp0 = sp[bi], sgn = forks[f][1], fl = forks[f][2];
      var twig = [bp0, [bp0[0] + sgn * fl * 0.52, bp0[1] + fl * 0.22], [bp0[0] + sgn * fl, bp0[1] - fl * 0.14 + 6 * Math.sin(t * 1.3 + f)]];
      I.stroke(c, twig, { k: fk, w: 7.5 - f * 1.4, a: 0.86 * A, rgb: PAL.ink, seed: sd + 110 + f, head: 0.08, tail: 0.72, fb: 0.25 });
      if (fk > 0.65) {
        var te = twig[2], ba2 = A * (fk - 0.65) / 0.35;
        I.wash(c, te[0], te[1], 18, 14, 0.45 * ba2, sd + 120 + f, PAL.violetHi, 0, { edge: 'soft' });
        c.save(); c.globalCompositeOperation = 'lighter';
        I.glow(c, te[0], te[1], 22, PAL.gold, 0.35 * ba2);
        c.restore();
      }
    }
    // 枝梢触及掌心：温润紫金道韵交融光晕
    var touchK = cl01((gk - 0.82) / 0.18);
    scorchSeat(c, tip[0], tip[1], 56, 44, 0.34 * A * gk, sd + 130, PAL.violetDk, 0);
    c.save();
    c.globalCompositeOperation = 'lighter';
    I.glow(c, tip[0], tip[1], 36 + 52 * touchK, mix3(PAL.violetHi, PAL.gold, 0.55), A * (0.28 + 0.46 * touchK * (0.82 + 0.18 * Math.sin(t * 2.4))));
    c.restore();
    if (touchK > 0.05) {
      brokenBrushLoop(c, px1, py1, 34 + 22 * touchK, 20 + 12 * touchK, -0.18, 0.45 * A * touchK, sd + 135, { segs: 3, w: 3.5, rgb: PAL.gold, spin: t * 0.5, mode: 'lighter' });
    }
  }
};

/* 2. zl.craneFlight：写意白鹤扇翅滑翔＋白羽随风旋落并逐片水墨虚化无影 */
ZL.craneFlight = function (c, t, o) {
  o = o || {};
  var A = num(o.a, 1), sd = num(o.seed, 17), sc = num(o.s, 1);
  var t0 = num(o.t0, 0), dur = Math.max(0.5, num(o.dur, 8));
  var age = t - t0;
  if (A <= 0.003 || age < -0.2 || age > dur + 4.5) return;

  var x0 = num(o.x0, 180), y0 = num(o.y0, 700), x1 = num(o.x1, 1680), y1 = num(o.y1, 220);
  var dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
  var nx = -dy / L, ny = dx / L;

  // 滑翔弧形轨迹函数 u∈[0,1]
  function flightAt(u) {
    var eu = U.lerp(u, U.easeOut(u), 0.35);
    var arch = -Math.sin(Math.PI * eu) * Math.min(130, L * 0.11);
    return [x0 + dx * eu + nx * arch, y0 + dy * eu + ny * arch];
  }

  // 飘落白羽（feathers 片沿航迹依次脱落、旋舞飘摇、化入淡墨云烟消散）
  var nF = Math.max(0, Math.min(32, Math.round(num(o.feathers, 9))));
  for (var i = 0; i < nF; i++) {
    var hi = U.hash(sd * 23 + i * 7), hi2 = U.hash(sd * 23 + i * 7 + 3);
    var spawnU = 0.08 + 0.78 * (i + hi * 0.5) / Math.max(1, nF);
    var spawnAge = spawnU * dur;
    var fAge = age - spawnAge;
    var fLife = 2.8 + 1.5 * hi2;
    if (fAge <= 0 || fAge >= fLife) continue;
    var fk = fAge / fLife; // 0 初落 → 1 虚化无影
    var sp = flightAt(spawnU);
    var fx = sp[0] + (hi - 0.5) * 40 * sc + Math.sin(fAge * (1.8 + hi) + i) * (34 + 18 * fk) * sc + fAge * 18 * (hi2 - 0.3);
    var fy = sp[1] + 18 * sc + (46 + 24 * hi) * fAge + 10 * Math.cos(fAge * 2.2 + i);
    var frot = 0.55 * Math.sin(fAge * (1.9 + hi * 0.8) + i * 1.3) + (hi2 - 0.5) * 0.6;
    var crispA = A * U.clamp(fAge / 0.18, 0, 1) * Math.pow(1 - fk, 1.55);
    var mistA = A * Math.sin(Math.PI * fk) * 0.42;

    if (mistA > 0.004) {
      // 虚化态：羽毛边缘化开为一缕淡青白烟晕，随即散入太霄云气
      I.wash(c, fx, fy, (28 + 38 * fk) * sc, (12 + 20 * fk) * sc, mistA, sd + 40 + i, mix3(PAL.nephrite, PAL.cyanMist, fk), frot, { edge: 'soft' });
    }
    if (crispA > 0.004) {
      scorchSeat(c, fx, fy + 3 * sc, 24 * sc, 10 * sc, crispA * 0.22, sd + i, PAL.scorch, frot);
      drawStamp(c, stampFeather(i), fx, fy, 54 * sc * (1 + 0.12 * fk), 22 * sc * (1 + 0.2 * fk), frot, crispA, null, hi > 0.5);
    }
  }

  // 仙鹤本体与翼后清风流线
  if (age >= 0 && age <= dur) {
    var u = cl01(age / dur);
    var envA = A * U.win(age, 0, dur, 0.35, 0.65);
    if (envA > 0.004) {
      var p0 = flightAt(u), p1 = flightAt(Math.min(1, u + 0.02));
      var heading = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
      // 前半振翅有力，后半舒翼御风滑翔
      var flapFreq = U.lerp(2.1, 1.05, u);
      var flapPh = age * flapFreq * TAU;
      var bob = -11 * sc * Math.sin(flapPh) * (1 - 0.45 * u);
      var cx2 = p0[0], cy2 = p0[1] + bob;

      // 翼后两道清逸风带
      for (var w = 0; w < 2; w++) {
        var wPts = [];
        for (var q = 0; q <= 8; q++) {
          var bu = Math.max(0, u - q * 0.016);
          var bp = flightAt(bu);
          var wy = (w ? 16 : -14) * sc + 8 * Math.sin(age * 4 - q * 0.7 + w * 2);
          wPts.push([bp[0], bp[1] + wy]);
        }
        I.stroke(c, wPts, { raw: true, n: 18, w: (4.5 - w) * sc, a: 0.28 * envA, rgb: PAL.cyanMist, seed: sd + 80 + w, head: 0.15, tail: 0.75, bleed: 0 });
      }

      var flipX = dx < 0;
      var rot = flipX ? Math.PI - heading : heading;
      var phIdx = Math.floor(U.fract(flapPh / TAU) * 12);
      scorchSeat(c, cx2, cy2 + 8 * sc, 96 * sc, 48 * sc, envA * 0.28, sd + 90, PAL.scorch, rot);
      drawStamp(c, stampCrane(phIdx), cx2, cy2, 220 * sc, 186 * sc, rot * 0.65, envA, null, flipX);
    }
  }
};

/* 3. zl.qiMeridians：巫门诸女调理的石青/淡金/紫气灵脉流线，随呼吸律动明灭交织 */
ZL.qiMeridians = function (c, t, o) {
  o = o || {};
  var A = num(o.a, 1), k = cl01(num(o.k, 1)), sd = num(o.seed, 23);
  if (A * k <= 0.003) return;
  var nodes = Array.isArray(o.nodes) && o.nodes.length ? o.nodes : [[520, 560], [960, 440], [1410, 540]];
  var ak = A * k;
  var tones = [PAL.stoneCyan, PAL.gold, PAL.violetHi, PAL.cyanHi];

  // 连接各气穴节点（及向外延伸至天地云海）的三股交织灵脉
  var pairs = [];
  for (var i = 0; i < nodes.length; i++) {
    for (var j = i + 1; j < nodes.length; j++) pairs.push([nodes[i], nodes[j], i + j]);
    // 每个节点另向高天或云渊引出一道天地支脉
    var np = nodes[i], outAng = -Math.PI * 0.5 + (i - (nodes.length - 1) * 0.5) * 0.85;
    pairs.push([np, [np[0] + Math.cos(outAng) * 380, np[1] + Math.sin(outAng) * 260], i + 10]);
  }

  for (var p = 0; p < pairs.length; p++) {
    var P0 = pairs[p][0], P1 = pairs[p][1], pid = pairs[p][2];
    var x0 = num(P0[0], 960), y0 = num(P0[1], 540), x1 = num(P1[0], 960), y1 = num(P1[1], 340);
    var dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
    var nx = -dy / L, ny = dx / L;
    var breath = 0.62 + 0.38 * Math.sin(t * 1.25 + p * 1.15);

    for (var st = 0; st < 3; st++) {
      var col = tones[(pid + st) % tones.length];
      var pts = [], N = 22;
      for (var q = 0; q <= N; q++) {
        var u = q / N, env = Math.sin(Math.PI * u);
        var wave = env * (26 * Math.sin(u * Math.PI * (2 + st * 0.5) - t * (1.1 + st * 0.35) + p) + 18 * U.fbm1(u * 3.5 - t * 0.3, sd + p * 7 + st, 2));
        pts.push([x0 + dx * u + nx * wave, y0 + dy * u + ny * wave]);
      }
      if (st === 0) {
        I.stroke(c, pts, { raw: true, n: 32, k: k, w: 16, a: 0.18 * ak * breath, rgb: PAL.scorch, mode: 'multiply', seed: sd + p * 11, head: 0.2, tail: 0.2, bleed: 0 });
      }
      I.sweep(c, pts, { raw: true, n: 34, k: k, w: (9 - st * 2.2), a: (0.38 - st * 0.06) * ak * breath, rgb: col, dry: 0.32 + st * 0.1, seed: sd + p * 13 + st, head: 0.18, tail: 0.25 });

      // 沿灵脉游走的呼吸真气光团（气行周天）
      var pulseU = U.fract(t * (0.18 + st * 0.05) + p * 0.27 + st * 0.31) * k;
      var i0 = Math.max(0, Math.floor(( pulseU - 0.14) * N)), i1 = Math.min(N, Math.ceil((pulseU + 0.14) * N));
      if (i1 - i0 >= 2) {
        var seg = pts.slice(i0, i1 + 1);
        c.save();
        c.globalCompositeOperation = 'lighter';
        I.stroke(c, seg, { raw: true, n: 14, w: 4.2, a: 0.65 * ak * Math.sin(Math.PI * cl01(pulseU / Math.max(0.01, k))), rgb: mix3(col, PAL.goldHi, 0.4), seed: sd + 90 + p, head: 0.35, tail: 0.35, bleed: 0 });
        c.restore();
      }
    }
  }

  // 各方位阵眼气璇（吞吐明灭的断续笔环与符文微光）
  for (var n = 0; n < nodes.length; n++) {
    var nx0 = num(nodes[n][0], 960), ny0 = num(nodes[n][1], 500);
    var nb = 0.72 + 0.28 * Math.sin(t * 1.45 + n * 2.09);
    var ncol = tones[n % tones.length];
    scorchSeat(c, nx0, ny0, 72 * nb, 42 * nb, 0.32 * ak, sd + n * 19, PAL.scorch, 0);
    I.wash(c, nx0, ny0, 64 * nb, 36 * nb, 0.34 * ak, sd + n * 23, ncol, 0, { edge: 'soft' });
    brokenBrushLoop(c, nx0, ny0, 58 * nb, 26 * nb, -0.12 + n * 0.1, 0.62 * ak, sd + n * 29, { segs: 3, w: 5.5, rgb: ncol, spin: t * (n % 2 ? -0.45 : 0.45) });
    brokenBrushLoop(c, nx0, ny0, 34 * nb, 16 * nb, 0.15, 0.48 * ak, sd + n * 31, { segs: 3, w: 3.2, rgb: PAL.gold, spin: -t * 0.7, mode: 'lighter' });
    c.save();
    c.globalCompositeOperation = 'lighter';
    I.glow(c, nx0, ny0, 44 * nb, ncol, 0.32 * ak);
    c.restore();
  }
};

/* 4. zl.tadpoleEdict：赤金符诏本体＋蝌蚪游鱼神文游出结成天空恢宏金章＋由赤金蜕变为湖玉青光 */
ZL.tadpoleEdict = function (c, t, o) {
  o = o || {};
  var A = num(o.a, 1), sc = num(o.s, 1), sd = num(o.seed, 31);
  if (A <= 0.003) return;
  var cx = num(o.x, W * 0.5), cy = num(o.y, 420);
  var morphK = cl01(num(o.morphK, 0)), unfoldK = cl01(num(o.unfoldK, 0)), cyanK = cl01(num(o.cyanK, 0));

  // 赤金 → 湖玉青光 平滑蜕变色阶
  var colDeep = mix3(PAL.redGold, PAL.stoneCyan, cyanK);
  var colMain = mix3(PAL.gold, PAL.cyan, cyanK);
  var colHi = mix3(PAL.goldHi, PAL.cyanHi, cyanK);
  var colSeal = mix3(PAL.bloodHi, PAL.jade, cyanK * 0.85);

  // 浅底焦墨衬托层
  var auraR = (130 + 280 * Math.max(morphK, unfoldK)) * sc;
  scorchSeat(c, cx, cy - 40 * unfoldK * sc, auraR * 1.15, auraR * 0.72, A * (0.34 + 0.22 * unfoldK), sd, PAL.scorchDk, 0);

  // 蜕变过渡期（0 < cyanK < 1）：旧赤金余晖如蝉蜕水雾向外轻散
  if (cyanK > 0.02 && cyanK < 0.98) {
    var shedA = A * Math.sin(Math.PI * cyanK) * 0.55;
    brokenBrushLoop(c, cx, cy, (90 + 160 * cyanK) * sc, (54 + 95 * cyanK) * sc, -0.1, shedA, sd + 3, {
      segs: 4, w: 9 * sc, rgb: PAL.redGold, dry: 0.52, spin: t * 0.4
    });
  }

  // 1. 符诏本体（随风微卷的泥金/青玉法旨，morphK 升高时半化光雾吐出真文）
  var scrollA = A * (1 - 0.55 * unfoldK);
  if (scrollA > 0.01) {
    var sw = 68 * sc, sh = 168 * sc;
    var flutter = 8 * sc * Math.sin(t * 1.9 + sd);
    c.save();
    c.translate(cx, cy);
    c.rotate(0.05 * Math.sin(t * 1.2 + sd));
    // 符纸多层宣金/青玉底晕
    I.wash(c, flutter * 0.3, 0, sw * 0.72, sh * 0.56, 0.76 * scrollA, sd + 5, colDeep, 0, { edge: 'wet' });
    I.wash(c, flutter * 0.3, -sh * 0.05, sw * 0.54, sh * 0.46, 0.65 * scrollA, sd + 7, colMain, 0, { edge: 'soft' });
    // 四周毛边法旨边框（柔韧曲折，带微风摆幅）
    var lEdge = [[-sw * 0.5, -sh * 0.5], [-sw * 0.48 + flutter * 0.4, 0], [-sw * 0.52 + flutter, sh * 0.5]];
    var rEdge = [[sw * 0.5, -sh * 0.5], [sw * 0.52 + flutter * 0.4, 0], [sw * 0.48 + flutter, sh * 0.5]];
    I.stroke(c, lEdge, { w: 4.2 * sc, a: 0.88 * scrollA, rgb: colHi, seed: sd + 11, head: 0.1, tail: 0.25 });
    I.stroke(c, rEdge, { w: 4.2 * sc, a: 0.88 * scrollA, rgb: colHi, seed: sd + 12, head: 0.1, tail: 0.25 });
    I.stroke(c, [lEdge[0], [0, -sh * 0.52], rEdge[0]], { w: 5.5 * sc, a: 0.9 * scrollA, rgb: colHi, seed: sd + 13 });
    I.dry(c, [lEdge[2], [flutter, sh * 0.53], rEdge[2]], { w: 6 * sc, a: 0.8 * scrollA, rgb: colMain, dry: 0.45, seed: sd + 14 });
    // 朱砂古篆法印＋符心神文（morphK 升高时由符心剥离游出）
    I.wash(c, flutter * 0.4, sh * 0.18, sw * 0.28, sw * 0.28, 0.55 * scrollA, sd + 16, colSeal, 0.08, { edge: 'wet' });
    var innerFade = scrollA * (1 - 0.75 * morphK);
    if (innerFade > 0.02) {
      for (var r0 = 0; r0 < 3; r0++) {
        drawStamp(c, stampTadpoleRune(r0 + 2, colHi), flutter * 0.3 * (r0 / 2), -sh * 0.26 + r0 * sh * 0.24, 34 * sc, 34 * sc, 0, innerFade * 0.92, null, false);
      }
    }
    c.globalCompositeOperation = 'lighter';
    I.glow(c, flutter * 0.3, 0, sh * 0.68, colMain, 0.36 * scrollA);
    c.restore();
  }

  // 2. 蝌蚪游鱼神文游出（morphK）并在苍穹铺展结成七行恢宏锦绣金章（unfoldK）
  if (morphK > 0.004 || unfoldK > 0.004) {
    var nRunes = 42, cols = 7, rows = 6;
    var mk = expoOut(Math.max(morphK, unfoldK), 5), uk = U.smooth(unfoldK);
    // 恢宏金章的云篆飞白外势（借 fx-ring-brush-oval 或侧锋云气托底）
    if (uk > 0.02) {
      brokenBrushLoop(c, cx, cy - 36 * sc, 390 * sc * uk, 185 * sc * uk, -0.04, 0.38 * A * uk, sd + 21, {
        segs: 5, w: 16 * sc, rgb: colDeep, dry: 0.48, spin: t * 0.08
      });
      // 七列天书气脉竖丝
      for (var cl = 0; cl < cols; cl++) {
        var colX = cx + (cl - (cols - 1) * 0.5) * 92 * sc;
        var colTop = cy - 195 * sc, colBot = cy + 125 * sc;
        I.stroke(c, [[colX, colTop], [colX + 5 * Math.sin(t + cl), (colTop + colBot) * 0.5], [colX, colBot]], {
          w: 2.2 * sc, a: 0.24 * A * uk, rgb: colMain, seed: sd + 30 + cl, head: 0.2, tail: 0.35, bleed: 0
        });
      }
    }

    for (var i = 0; i < nRunes; i++) {
      var colIdx = Math.floor(i / rows), rowIdx = i % rows;
      var h1 = U.hash(sd * 37 + i * 9), h2 = U.hash(sd * 37 + i * 9 + 4);
      // 游鱼盘旋态位置
      var swimAng = i * 2.39996 + t * (0.65 + 0.45 * h1) * (i % 2 ? 1 : -1);
      var swimRx = (55 + 260 * Math.sqrt((i + 0.5) / nRunes)) * sc * mk;
      var swimRy = swimRx * 0.58;
      var sx = cx + Math.cos(swimAng) * swimRx + 14 * Math.sin(t * 2.3 + i) * sc;
      var sy = cy - 20 * sc + Math.sin(swimAng) * swimRy;
      var sHeading = swimAng + (i % 2 ? Math.PI * 0.5 : -Math.PI * 0.5);

      // 恢宏金章列阵态位置（自右向左七列古卷排布，微带呼吸浮动）
      var gx = cx + ((cols - 1) * 0.5 - colIdx) * 92 * sc + 4 * Math.sin(t * 1.1 + i) * sc;
      var gy = cy - 165 * sc + rowIdx * 54 * sc + (colIdx % 2 ? 10 : -8) * sc + 3 * Math.cos(t * 1.3 + i) * sc;

      var rx = U.lerp(sx, gx, uk), ry = U.lerp(sy, gy, uk);
      var rot = U.lerp(sHeading + Math.PI * 0.5, 0.06 * Math.sin(t * 0.9 + i), uk);
      var rSize = (24 + 14 * h2) * sc * U.lerp(0.85, 1.12, uk) * Math.min(1, mk * 1.6);
      var ra = A * cl01(mk * 1.4 - (i / nRunes) * 0.35) * (0.78 + 0.22 * Math.sin(t * 2.6 + i * 1.3));
      if (ra <= 0.01) continue;

      // 蝌蚪游鱼灵尾（游动期摆尾显著，结章期收敛为金石笔锋）
      var tailK = (1 - 0.78 * uk) * mk;
      if (tailK > 0.06) {
        var backAng = sHeading + Math.PI;
        var tailLen = (26 + 22 * h1) * sc * tailK;
        var wag = 9 * sc * Math.sin(t * 7.5 + i * 1.9) * tailK;
        var tPts = [
          [rx, ry],
          [rx + Math.cos(backAng) * tailLen * 0.5 - Math.sin(backAng) * wag, ry + Math.sin(backAng) * tailLen * 0.5 + Math.cos(backAng) * wag],
          [rx + Math.cos(backAng) * tailLen + Math.sin(backAng) * wag * 0.6, ry + Math.sin(backAng) * tailLen - Math.cos(backAng) * wag * 0.6]
        ];
        I.stroke(c, tPts, { raw: true, n: 12, w: 4.6 * sc, a: 0.72 * ra, rgb: colMain, seed: sd + 100 + i, head: 0.05, tail: 0.85, bleed: 0 });
      }

      drawStamp(c, stampTadpoleRune(i, colMain), rx, ry, rSize, rSize, rot, ra * 0.92, null, false);
      drawStamp(c, stampTadpoleRune(i, colHi), rx, ry, rSize * 1.04, rSize * 1.04, rot, ra * 0.45, 'lighter', false);
    }

    c.save();
    c.globalCompositeOperation = 'lighter';
    I.glow(c, cx, cy - 30 * sc * uk, auraR * 0.95, colMain, A * (0.18 * mk + 0.22 * uk));
    c.restore();
  }
};

/* 5. zl.meltShadows：四御门庭外盘旋扑击的浓墨天魔黑影，purifyK>0 时如沸汤沃雪消融化烟 */
ZL.meltShadows = function (c, t, o) {
  o = o || {};
  var A = num(o.a, 1), sd = num(o.seed, 37), pk = cl01(num(o.purifyK, 0));
  if (A <= 0.003 || pk >= 0.999) return;
  var cx = num(o.x, W * 0.5), cy = num(o.y, 520), R = num(o.r, 420);
  var n = Math.max(1, Math.min(36, Math.round(num(o.n, 14))));

  // 沃雪金光自中心浩荡外扩
  if (pk > 0.005) {
    var waveR = R * (0.25 + 1.25 * expoOut(pk, 4));
    var waveA = A * Math.sin(Math.PI * cl01(pk * 1.05)) * 0.55;
    scorchSeat(c, cx, cy, waveR * 0.9, waveR * 0.62, waveA * 0.3, sd, PAL.scorch, 0);
    c.save();
    c.globalCompositeOperation = 'lighter';
    I.glow(c, cx, cy, waveR, PAL.gold, waveA * 0.45);
    brokenBrushLoop(c, cx, cy, waveR * 0.88, waveR * 0.58, 0, waveA * 0.72, sd + 2, { segs: 5, w: 18, rgb: PAL.goldHi, dry: 0.42, spin: t * 0.25 });
    c.restore();
  }

  for (var i = 0; i < n; i++) {
    var h1 = U.hash(sd * 19 + i * 7), h2 = U.hash(sd * 19 + i * 7 + 3), h3 = U.hash(sd * 19 + i * 7 + 5);
    // 越靠近门庭中心的天魔越早被金光沸汤融蚀
    var distBand = 0.48 + 0.68 * h1;
    var localMelt = cl01((pk * 1.45 - (distBand - 0.48) * 0.65) / 0.85);
    var remain = 1 - U.smooth(localMelt);
    if (remain <= 0.004 && localMelt >= 0.99) continue;

    var dirSgn = i % 2 ? 1 : -1;
    var baseAng = (i / n) * TAU + (h2 - 0.5) * 0.35 + dirSgn * t * (0.18 + 0.14 * h3) * (1 - 0.6 * localMelt);
    var lunge = 1 - 0.14 * Math.sin(t * (1.5 + h1) + i * 2.1) * (1 - localMelt);
    var recoil = localMelt * 95; // 受金光灼照痛苦外退
    var rad = R * distBand * lunge + recoil;
    var sx = cx + Math.cos(baseAng) * rad * 1.18;
    var sy = cy + Math.sin(baseAng) * rad * 0.68;
    var toCenter = Math.atan2(cy - sy, cx - sx);
    var sz = (68 + 54 * h2) * (0.35 + 0.65 * remain);

    // 浓墨天魔躯干与妖异鬼爪触须（从面光侧向背光侧侵蚀退缩）
    if (remain > 0.02) {
      var da = A * remain;
      var shiftX = -Math.cos(toCenter) * sz * 0.42 * localMelt;
      var shiftY = -Math.sin(toCenter) * sz * 0.42 * localMelt;
      var bx = sx + shiftX, by = sy + shiftY;

      I.wash(c, bx, by, sz * 1.15, sz * 0.72, 0.52 * da, sd + i * 5, PAL.ink, toCenter, { edge: 'wet' });
      I.inkBlot(c, bx, by, sz * 0.55, sd + i * 9, { a: 0.88 * da, rgb: PAL.ink, sx: 1.35, sy: 0.82, rot: toCenter, rough: 0.34 });

      // 四道撕扯扑击的妖异墨爪/残翼
      for (var cl = 0; cl < 4; cl++) {
        var cAng = toCenter + (cl - 1.5) * 0.68 + 0.25 * Math.sin(t * 3.4 + i + cl);
        var cLen = sz * (0.95 + 0.45 * (cl % 2));
        var claw = [
          [bx, by],
          [bx + Math.cos(cAng + 0.24) * cLen * 0.55, by + Math.sin(cAng + 0.24) * cLen * 0.55],
          [bx + Math.cos(cAng - 0.18) * cLen, by + Math.sin(cAng - 0.18) * cLen]
        ];
        I.sweep(c, claw, { raw: true, n: 16, w: sz * 0.22, a: 0.82 * da, rgb: cl === 1 ? PAL.bloodRust : PAL.ink, dry: 0.46, seed: sd + 40 + i * 4 + cl, head: 0.1, tail: 0.7 });
      }

      // 凶戾暗赤魔瞳
      var ex = bx + Math.cos(toCenter) * sz * 0.22, ey = by + Math.sin(toCenter) * sz * 0.22;
      c.save();
      c.fillStyle = U.rgba(PAL.bloodHi, 0.92 * da);
      I.blot(c, ex, ey, Math.max(2, sz * 0.075), sd + 90 + i, { rough: 0.2, sx: 1.8, sy: 0.55, rot: toCenter + 0.3 });
      c.fill();
      c.restore();
    }

    // 沸汤沃雪：面光边缘金火灼沸、浓墨化作滚滚灰白残烟腾空消散
    if (localMelt > 0.02 && localMelt < 0.99) {
      var boilA = A * Math.sin(Math.PI * localMelt);
      var frontX = sx + Math.cos(toCenter) * sz * 0.28, frontY = sy + Math.sin(toCenter) * sz * 0.28;
      // 金光灼蚀前沿亮边
      c.save();
      c.globalCompositeOperation = 'lighter';
      var searArc = [];
      for (var q = -3; q <= 3; q++) {
        var qa = toCenter + q * 0.24;
        searArc.push([sx + Math.cos(qa) * sz * 0.46, sy + Math.sin(qa) * sz * 0.46]);
      }
      I.dry(c, searArc, { raw: true, n: 16, w: 9, a: 0.85 * boilA, rgb: PAL.goldHi, dry: 0.4, seed: sd + 120 + i });
      I.glow(c, frontX, frontY, sz * 0.75, PAL.gold, 0.45 * boilA);
      c.restore();

      // 蒸腾化烟的灰墨气柱与飞散雪点
      for (var sm = 0; sm < 5; sm++) {
        var smU = U.fract(t * 0.55 + sm * 0.2 + h3);
        var smX = sx + (sm - 2) * 18 + 20 * U.noise1(t * 1.2 + sm, sd + i);
        var smY = sy - smU * (90 + 70 * localMelt);
        I.wash(c, smX, smY, (24 + 34 * smU), (18 + 26 * smU), 0.38 * boilA * (1 - smU), sd + 150 + i + sm, mix3(PAL.inkSoft, PAL.ash, smU), 0, { edge: 'soft' });
      }
    }
  }
};

/* 6. zl.invertedDish：真界倒扣白玉巨碟＋中央石绿碧水＋三分之一破口碧水倾泻＋云霭明灭压制 */
ZL.invertedDish = function (c, t, o) {
  o = o || {};
  var A = num(o.a, 1), sc = num(o.s, 1), sd = num(o.seed, 43);
  if (A <= 0.003) return;
  var cx = num(o.x, 960), cy = num(o.y, 500);
  var breachK = cl01(num(o.breachK, 0)), flicker = cl01(num(o.flicker, 0));

  // 云霭明灭闪烁调制（表现外界大能激战或天道威压的窒息闪烁）
  var flkMod = 1 - flicker * (0.28 + 0.34 * cl01(U.fbm1(t * 5.8, sd + 3, 3) + 0.35));
  var effA = A * flkMod;
  var rx = 430 * sc, ry = 175 * sc, domeH = 148 * sc;

  // 虚空暗底衬托羊脂白玉与石绿水光
  scorchSeat(c, cx, cy + 16 * sc, rx * 1.22, (ry + domeH) * 1.08, 0.48 * A, sd, PAL.scorchDk, 0);

  // 破口区间：右下方约占外围圆周 1/3（角度 0.12π → 0.78π）
  var bA0 = Math.PI * 0.12, bA1 = Math.PI * 0.78;
  var gapMid = (bA0 + bA1) * 0.5;

  // 1. 碟内蓄积的中央石绿碧水世界（水波潋滟）
  var waterRx = rx * 0.78, waterRy = ry * 0.76;
  I.wash(c, cx, cy + 14 * sc, waterRx, waterRy, 0.78 * effA, sd + 5, PAL.abyssGreen, 0, { edge: 'wet' });
  I.wash(c, cx - 28 * sc, cy + 8 * sc, waterRx * 0.72, waterRy * 0.68, 0.68 * effA, sd + 7, PAL.jade, 0, { edge: 'soft' });
  I.wash(c, cx + 22 * sc, cy + 18 * sc, waterRx * 0.48, waterRy * 0.44, 0.52 * effA, sd + 9, PAL.cyanHi, 0, { edge: 'soft' });
  for (var wp = 0; wp < 5; wp++) {
    var wr = (0.22 + 0.16 * wp + 0.08 * U.fract(t * 0.18 + wp * 0.2)) * waterRx;
    brokenBrushLoop(c, cx, cy + 14 * sc, wr, wr * (waterRy / waterRx), 0, 0.42 * effA * (1 - wp * 0.14), sd + 15 + wp, {
      segs: 3, w: 3.4 * sc, rgb: PAL.cyanMist, spin: t * (wp % 2 ? -0.15 : 0.18)
    });
  }

  // 2. 倒扣温润羊脂白玉碟穹顶（半透玉质＋古朴经纬玉纹）
  c.save();
  var domeTop = [], N = 28;
  for (var i = 0; i <= N; i++) {
    var u = i / N, th = Math.PI + Math.PI * u; // 上半穹隆弧
    domeTop.push([cx + Math.cos(th) * rx, cy + Math.sin(th) * domeH * 1.15]);
  }
  I.wash(c, cx, cy - domeH * 0.36, rx * 0.88, domeH * 0.85, 0.46 * effA, sd + 21, PAL.nephrite, 0, { edge: 'soft' });
  I.wash(c, cx - rx * 0.18, cy - domeH * 0.52, rx * 0.46, domeH * 0.42, 0.38 * effA, sd + 23, [248, 246, 238], -0.1, { edge: 'soft' });
  I.sweep(c, domeTop, { raw: true, n: 36, w: 14 * sc, a: 0.82 * effA, rgb: PAL.nephrite, dry: 0.22, seed: sd + 25, head: 0.08, tail: 0.08 });
  I.stroke(c, domeTop, { raw: true, n: 36, w: 3.6 * sc, a: 0.58 * effA, rgb: PAL.celadon, seed: sd + 26, head: 0.1, tail: 0.1, bleed: 0 });
  // 穹顶三道经线玉脊
  for (var m = -1; m <= 1; m++) {
    var rib = [[cx, cy - domeH * 1.12], [cx + m * rx * 0.36, cy - domeH * 0.45], [cx + m * rx * 0.58, cy + ry * 0.42]];
    I.stroke(c, rib, { w: 2.8 * sc, a: 0.34 * effA, rgb: PAL.nephrite, seed: sd + 30 + m, head: 0.15, tail: 0.4, bleed: 0 });
  }
  c.restore();

  // 3. 玉碟下缘（完好三分之二弧段＋三分之一崩裂缺口）
  var intactArc = [], breachArc = [];
  for (var j = 0; j <= 44; j++) {
    var ang = bA1 + (TAU - (bA1 - bA0)) * (j / 44);
    intactArc.push([cx + Math.cos(ang) * rx, cy + Math.sin(ang) * ry]);
  }
  I.sweep(c, intactArc, { raw: true, n: 52, w: 15 * sc, a: 0.86 * effA, rgb: PAL.nephrite, dry: 0.25, seed: sd + 35, head: 0.06, tail: 0.06 });
  I.stroke(c, intactArc, { raw: true, n: 52, w: 4 * sc, a: 0.55 * effA, rgb: PAL.inkSoft, seed: sd + 36, head: 0.05, tail: 0.05 });

  if (breachK < 0.98) {
    for (var b = 0; b <= 20; b++) {
      var ba = U.lerp(bA0, bA1, b / 20);
      breachArc.push([cx + Math.cos(ba) * rx, cy + Math.sin(ba) * ry]);
    }
    I.dry(c, breachArc, { raw: true, n: 24, w: 13 * sc * (1 - breachK), a: 0.78 * effA * (1 - breachK), rgb: PAL.nephrite, dry: 0.3 + 0.55 * breachK, seed: sd + 38 });
  }

  // 4. 外围三分之一破口崩裂纹与浩荡外溢的石绿碧水瀑布（breachK > 0）
  if (breachK > 0.005) {
    var bk = expoOut(breachK, 4);
    // 破口两端犬牙交错的玉碟裂纹
    [bA0, bA1].forEach(function (ea, idx) {
      var ex = cx + Math.cos(ea) * rx, ey = cy + Math.sin(ea) * ry;
      var crack = [[ex, ey], [ex - Math.cos(ea) * 28 * sc + 8, ey - 42 * sc * bk], [ex - Math.cos(ea) * 48 * sc - 6, ey - 78 * sc * bk]];
      I.stroke(c, crack, { w: 4.5 * sc, a: 0.82 * effA * bk, rgb: PAL.ink, seed: sd + 42 + idx, head: 0.05, tail: 0.7 });
      I.stroke(c, crack, { w: 2.2 * sc, a: 0.68 * effA * bk, rgb: PAL.goldHi, seed: sd + 44 + idx, head: 0.1, tail: 0.6, bleed: 0 });
    });

    // 11 股碧水洪流越过缺口向虚空深渊奔涌倾泻＋飞白浪沫与水雾
    var nStreams = 11;
    for (var s = 0; s < nStreams; s++) {
      var su = (s + 0.5) / nStreams;
      var sa = U.lerp(bA0 + 0.05, bA1 - 0.05, su);
      var hs = U.hash(sd * 13 + s * 7);
      var lipX = cx + Math.cos(sa) * rx * 0.94, lipY = cy + Math.sin(sa) * ry * 0.94;
      var outDx = Math.cos(sa) * (95 + 65 * hs) * sc * bk;
      var dropH = (170 + 140 * Math.sin(Math.PI * su) + 45 * hs) * sc * bk;
      var stPts = [];
      for (var q2 = 0; q2 <= 10; q2++) {
        var u2 = q2 / 10;
        var wx = lipX + outDx * Math.pow(u2, 0.75) + 12 * sc * Math.sin(u2 * 5 - t * 3.6 + s) * u2;
        var wy = lipY + dropH * u2 * u2;
        stPts.push([wx, wy]);
      }
      var sCol = s % 3 === 0 ? PAL.cyanHi : s % 2 ? PAL.jade : PAL.stoneCyan;
      I.sweep(c, stPts, { raw: true, n: 22, w: (22 + 14 * Math.sin(Math.PI * su)) * sc, a: 0.64 * effA * bk, rgb: sCol, dry: 0.34, seed: sd + 60 + s, head: 0.1, tail: 0.55 });
      I.dry(c, stPts, { raw: true, n: 22, w: 12 * sc, a: 0.58 * effA * bk, rgb: PAL.cyanMist, dry: 0.58, seed: sd + 80 + s });

      // 倾泻末端的腾空水雾与飞溅碧珠
      var endP = stPts[stPts.length - 1];
      I.wash(c, endP[0], endP[1], 56 * sc, 34 * sc, 0.32 * effA * bk, sd + 100 + s, PAL.cyanMist, 0, { edge: 'soft' });
      var dropCyc = U.fract(t * (0.9 + 0.5 * hs) + hs);
      var dp = stPts[Math.min(10, Math.floor(dropCyc * 10))];
      c.save();
      c.fillStyle = U.rgba(PAL.jadeHi, 0.78 * effA * bk * (1 - dropCyc));
      I.blot(c, dp[0] + (hs - 0.5) * 24 * sc, dp[1] + 18 * dropCyc * sc, (3.5 + 3 * hs) * sc, sd + 120 + s, { rough: 0.25, sx: 0.8, sy: 1.5 });
      c.fill();
      c.restore();
    }
    c.save();
    c.globalCompositeOperation = 'lighter';
    I.glow(c, cx + Math.cos(gapMid) * rx * 0.95, cy + Math.sin(gapMid) * ry * 0.95 + 45 * sc, 160 * sc * bk, PAL.jadeHi, 0.26 * effA * bk);
    c.restore();
  }

  // flicker > 0：劫云乱墨与压迫闪影掠过玉碟上空
  if (flicker > 0.01) {
    var opA = A * flicker * (0.24 + 0.26 * Math.abs(U.noise1(t * 4.7, sd + 99)));
    c.save();
    c.globalCompositeOperation = 'multiply';
    I.wash(c, cx + 50 * Math.sin(t * 0.8), cy - domeH * 0.3, rx * 1.35, (ry + domeH) * 0.95, opA, sd + 140, PAL.ink, -0.08, { edge: 'wet' });
    c.restore();
  }
};

/* 7. zl.sixPathsWheel：烛龙王/大黑天背后的水墨飞白日轮，内含六道旋涡与光阴沙砾逆顺流转（绝非几何圆圈） */
ZL.sixPathsWheel = function (c, t, o) {
  o = o || {};
  var A = num(o.a, 1), R = num(o.r, 240), tk = num(o.timeK, 1), sd = num(o.seed, 47);
  if (A <= 0.003 || R <= 2) return;
  var cx = num(o.x, 1320), cy = num(o.y, 440);
  var spin = t * 0.42 * tk;

  // 焦墨日蚀底晕，压住狂暴赤金与枯墨色阶
  scorchSeat(c, cx, cy, R * 1.38, R * 1.32, 0.58 * A, sd, PAL.scorchDk, 0);

  // 若手绘笔环素材在场，叠一层慢转飞白轮底
  var TR = I.fxTex && I.fxTex('ring-brush', sd);
  if (TR && I.flow && I.plateImg(TR.id)) {
    var im = I.plateImg(TR.id), scR = R * 1.06 / (TR.r || im.naturalWidth * 0.4);
    var cc = TR.c || [im.naturalWidth * 0.5, im.naturalHeight * 0.5];
    c.save();
    c.translate(cx, cy);
    c.rotate(spin * 0.65);
    I.flow(c, TR.id, t, {
      src: TR.src, dst: [-cc[0] * scR, -cc[1] * scR, im.naturalWidth * scR, im.naturalHeight * scR],
      tint: PAL.redGold, alpha: 0.55 * A, warp: { amp: R * 0.035, scale: R * 0.45, speed: 0.55, seed: sd }
    });
    c.restore();
  }

  // 外轮狂暴水墨飞白弧与日珥火舌（顺转外轮＋逆转内轮）
  brokenBrushLoop(c, cx, cy, R * 1.04, R * 0.98, 0.12, 0.85 * A, sd + 3, { segs: 5, w: R * 0.13, rgb: PAL.ink, dry: 0.42, spin: spin });
  brokenBrushLoop(c, cx, cy, R * 0.96, R * 0.92, -0.08, 0.78 * A, sd + 7, { segs: 6, w: R * 0.09, rgb: PAL.bloodMid, dry: 0.52, spin: spin * 1.15 });
  brokenBrushLoop(c, cx, cy, R * 0.76, R * 0.74, 0.2, 0.72 * A, sd + 11, { segs: 4, w: R * 0.065, rgb: PAL.gold, dry: 0.48, spin: -spin * 0.85 });

  // 12 簇切向撕裂的飞白日珥火舌
  for (var f = 0; f < 12; f++) {
    var fa = spin * 0.9 + (f / 12) * TAU + 0.18 * U.noise1(t * 1.4 + f, sd);
    var fr0 = R * (0.92 + 0.08 * U.hash(sd + f));
    var fPts = [];
    for (var q = 0; q <= 5; q++) {
      var u = q / 5, angQ = fa + u * 0.36, radQ = fr0 + u * R * (0.24 + 0.16 * U.hash(sd + 30 + f));
      fPts.push([cx + Math.cos(angQ) * radQ, cy + Math.sin(angQ) * radQ]);
    }
    I.dry(c, fPts, { raw: true, n: 14, w: R * 0.075, a: 0.62 * A * (0.65 + 0.35 * Math.sin(t * 3.1 + f)), rgb: f % 2 ? PAL.redGold : PAL.bloodHi, dry: 0.56, seed: sd + 40 + f });
  }

  // 六道气流旋涡与六根弯曲龙骨轮辐
  var sixCols = [PAL.gold, PAL.bloodMid, PAL.ash, PAL.stoneCyan, PAL.redGold, PAL.inkSoft];
  for (var s = 0; s < 6; s++) {
    var sa = spin * 0.55 + (s / 6) * TAU;
    // S 形弯曲轮辐（绝非直线条）
    var spoke = [];
    for (var k = 0; k <= 10; k++) {
      var su = k / 10, sRad = R * (0.14 + 0.82 * su);
      var sCurve = sa + 0.34 * Math.sin(Math.PI * su);
      spoke.push([cx + Math.cos(sCurve) * sRad, cy + Math.sin(sCurve) * sRad]);
    }
    I.sweep(c, spoke, { raw: true, n: 20, w: R * 0.065, a: 0.78 * A, rgb: PAL.ink, dry: 0.34, seed: sd + 60 + s, head: 0.15, tail: 0.25 });
    I.stroke(c, spoke, { raw: true, n: 20, w: R * 0.022, a: 0.68 * A, rgb: PAL.gold, seed: sd + 70 + s, head: 0.2, tail: 0.3, bleed: 0 });

    // 每一道扇区内的独立小旋涡（天、人、阿修罗、畜生、饿鬼、地狱六道气旋）
    var midA = sa + Math.PI / 6 + 0.14;
    var vx = cx + Math.cos(midA) * R * 0.52, vy = cy + Math.sin(midA) * R * 0.52;
    var vSpin = (s % 2 ? -1 : 1) * t * 1.6 * tk + s;
    var vCol = sixCols[s];
    I.wash(c, vx, vy, R * 0.22, R * 0.18, 0.38 * A, sd + 80 + s, vCol, vSpin * 0.3, { edge: 'soft' });
    var spPts = [];
    for (var p = 0; p <= 14; p++) {
      var pu = p / 14, pa = vSpin + pu * Math.PI * 2.4, pr = R * 0.22 * (1 - 0.78 * pu);
      spPts.push([vx + Math.cos(pa) * pr, vy + Math.sin(pa) * pr]);
    }
    I.dry(c, spPts, { raw: true, n: 20, w: R * 0.036, a: 0.65 * A, rgb: vCol, dry: 0.42, seed: sd + 90 + s });
  }

  // 光阴沙砾逆顺流转（外环顺流泥金沙，内环逆流玄铁朱砂砾）
  for (var g = 0; g < 64; g++) {
    var hg1 = U.hash(sd * 23 + g * 5), hg2 = U.hash(sd * 23 + g * 5 + 2);
    var inner = g < 32;
    var dir = inner ? -1 : 1;
    var bandR = R * (inner ? (0.26 + 0.22 * hg1) : (0.58 + 0.28 * hg1));
    var ga = hg2 * TAU + dir * t * (0.65 + 0.55 * hg1) * tk;
    var gx = cx + Math.cos(ga) * bandR, gy = cy + Math.sin(ga) * bandR;
    var gCol = inner ? (g % 3 === 0 ? PAL.bloodHi : PAL.goldHi) : (g % 2 ? PAL.gold : PAL.ash);
    var gSz = (1.8 + 2.8 * hg2) * (R / 240);
    c.save();
    c.fillStyle = U.rgba(gCol, A * (0.52 + 0.38 * Math.sin(t * 2.8 + g)));
    I.blot(c, gx, gy, gSz, sd + 150 + g, { rough: 0.25, n: 8, sx: 2.1, sy: 0.75, rot: ga + Math.PI * 0.5 });
    c.fill();
    c.restore();
  }

  // 轮心烛龙竖瞳日核
  I.inkBlot(c, cx, cy, R * 0.14, sd + 230, { a: 0.92 * A, rgb: PAL.ink, rough: 0.26 });
  c.save();
  c.globalCompositeOperation = 'lighter';
  I.glow(c, cx, cy, R * 0.36, PAL.redGold, 0.48 * A);
  var slit = [[cx, cy - R * 0.12], [cx + R * 0.015 * Math.sin(t * 3), cy], [cx, cy + R * 0.12]];
  I.stroke(c, slit, { w: R * 0.042, a: 0.92 * A, rgb: PAL.goldHi, seed: sd + 235, head: 0.35, tail: 0.35, bleed: 0 });
  c.restore();
};

/* 8. zl.timeRiver：封神台凝滞血雾悬滴(frozen) / 时光长河暗涌(roar) / 决堤逆流漩涡与回溯残影(rewind) */
ZL.timeRiver = function (c, t, o) {
  o = o || {};
  var A = num(o.a, 1), k = cl01(num(o.k, 1)), sd = num(o.seed, 53);
  if (A * k <= 0.003) return;
  var cy = num(o.y, 540), rh = num(o.h, 600), mode = o.mode || 'roar';
  var yTop = cy - rh * 0.5, ak = A * k;

  if (mode === 'frozen') {
    // 凝滞血雾与悬空暗红血珠：封神台万古死寂，连血雾与尘滴都被凝固在半空微颤
    if (I.mistBand) {
      I.mistBand(c, t * 0.04, { x0: -40, y: yTop, w: W + 80, h: rh, speed: 3, warp: 12, tint: PAL.bloodDk, a: 0.38 * ak, seed: sd });
    }
    for (var m = 0; m < 7; m++) {
      var mx = (m + 0.5) / 7 * W + U.noise1(t * 0.06 + m, sd) * 18;
      var my = yTop + rh * (0.25 + 0.5 * U.hash(sd + m * 3));
      I.wash(c, mx, my, 320, rh * 0.32, 0.24 * ak, sd + m * 5, m % 2 ? PAL.bloodRust : PAL.scorchDk, 0, { edge: 'soft' });
    }
    for (var d = 0; d < 52; d++) {
      var h1 = U.hash(sd * 17 + d * 5), h2 = U.hash(sd * 17 + d * 5 + 2), h3 = U.hash(sd * 17 + d * 5 + 4);
      var dx = h1 * W + 0.9 * Math.sin(t * (9 + 6 * h3) + d); // 琥珀定格般的极微高频颤栗
      var dy = yTop + h2 * rh + 1.8 * Math.sin(t * 0.35 + d * 1.7);
      var dsz = 2.2 + 5.6 * Math.pow(h3, 1.6);
      var dCol = d % 4 === 0 ? PAL.ink : d % 2 ? PAL.bloodHi : PAL.bloodDk;
      I.wash(c, dx, dy, dsz * 2.8, dsz * 2.4, 0.22 * ak, sd + d, PAL.bloodRust, 0, { edge: 'soft' });
      c.save();
      c.fillStyle = U.rgba(dCol, 0.86 * ak);
      I.blot(c, dx, dy, dsz, sd + 80 + d, { rough: 0.22, n: 10, sx: 0.86, sy: 1.28, rot: (h1 - 0.5) * 0.4 });
      c.fill();
      if (dsz > 4.5) {
        c.globalCompositeOperation = 'lighter';
        I.glow(c, dx - dsz * 0.22, dy - dsz * 0.25, dsz * 1.5, PAL.gold, 0.22 * ak);
      }
      c.restore();
    }
    return;
  }

  // 'roar'（暗涌奔流）或 'rewind'（决堤倒卷逆流）
  var isRewind = mode === 'rewind';
  var dir = isRewind ? -1 : 1;
  var spd = isRewind ? 260 : 58;

  if (I.turbid) {
    I.turbid(c, t, { x0: -40, y: yTop + rh * 0.1, w: W + 80, h: rh * 0.8, speed: -dir * spd * 0.85, warp: isRewind ? 48 : 26, a: (isRewind ? 0.46 : 0.32) * ak, seed: sd + 3 });
  } else if (I.mistBand) {
    I.mistBand(c, t, { x0: -40, y: yTop, w: W + 80, h: rh, speed: -dir * spd, warp: 34, tint: PAL.goldBronze, a: 0.35 * ak, seed: sd + 3 });
  }

  // 9 层横贯虚空的水墨光阴波涛带
  var nBands = isRewind ? 11 : 8;
  for (var b = 0; b < nBands; b++) {
    var bu = (b + 0.5) / nBands;
    var by = yTop + rh * (0.08 + 0.84 * bu);
    var bCol = b % 3 === 0 ? PAL.goldBronze : b % 3 === 1 ? (isRewind ? PAL.bone : PAL.stoneCyan) : PAL.inkSoft;
    var pts = [], N = 26;
    var phase = dir * t * (isRewind ? (3.8 + b * 0.4) : (0.95 + b * 0.15)) + b * 1.7;
    var amp = (isRewind ? 34 : 18) * (0.6 + 0.6 * Math.sin(Math.PI * bu));
    for (var i = 0; i <= N; i++) {
      var u = i / N, px = -80 + u * (W + 160);
      var py = by + amp * Math.sin(u * Math.PI * 3.5 - phase) + amp * 0.45 * U.fbm1(u * 4 - phase * 0.35, sd + b * 7, 2);
      pts.push([px, py]);
    }
    I.sweep(c, pts, { raw: true, n: 36, w: isRewind ? 28 : 22, a: (isRewind ? 0.46 : 0.32) * ak, rgb: bCol, dry: isRewind ? 0.52 : 0.36, seed: sd + 20 + b, head: 0.08, tail: 0.08 });
    if (isRewind || b % 2 === 0) {
      I.dry(c, pts, { raw: true, n: 36, w: 12, a: 0.42 * ak, rgb: PAL.goldHi, dry: 0.62, seed: sd + 40 + b });
    }
  }

  // 决堤逆流专属：4 团急旋倒卷漩涡＋漫天逆飞的金石古拓残影与光阴沙砾
  if (isRewind) {
    for (var v = 0; v < 4; v++) {
      var hv = U.hash(sd + v * 19);
      var vx = U.fract(hv - t * (0.14 + 0.05 * v)) * (W + 360) - 180;
      var vy = yTop + rh * (0.24 + 0.52 * U.hash(sd + v * 23));
      var vr = 85 + 55 * hv;
      scorchSeat(c, vx, vy, vr * 1.1, vr * 0.72, 0.34 * ak, sd + 70 + v, PAL.scorchDk, 0);
      for (var arm = 0; arm < 2; arm++) {
        var sp = [];
        for (var q = 0; q <= 18; q++) {
          var qu = q / 18, qa = -t * 3.6 + arm * Math.PI + qu * Math.PI * 2.8;
          var qr = vr * (1 - 0.82 * qu);
          sp.push([vx + Math.cos(qa) * qr * 1.25, vy + Math.sin(qa) * qr * 0.72]);
        }
        I.dry(c, sp, { raw: true, n: 24, w: 14, a: 0.58 * ak, rgb: arm ? PAL.gold : PAL.ink, dry: 0.48, seed: sd + 80 + v * 2 + arm });
      }
    }
  }

  // 河中随波漂流（或急速倒飞）的光阴古篆与浪沫沙砾
  var nMotes = isRewind ? 38 : 18;
  for (var p = 0; p < nMotes; p++) {
    var hp1 = U.hash(sd * 31 + p * 9), hp2 = U.hash(sd * 31 + p * 9 + 4);
    var pu = U.fract(hp1 + dir * t * (isRewind ? (0.35 + 0.25 * hp2) : (0.06 + 0.04 * hp2)));
    var rx = pu * (W + 200) - 100;
    var ry = yTop + rh * (0.12 + 0.76 * hp2) + 16 * Math.sin(pu * 9 + p);
    var ra = ak * Math.sin(Math.PI * pu);
    if (p % 4 === 0) {
      drawStamp(c, stampTadpoleRune(p, PAL.gold), rx, ry, 24 + 14 * hp1, 24 + 14 * hp1, dir * t * 0.8 + p, ra * 0.55, null, false);
    } else if (isRewind) {
      I.stroke(c, [[rx, ry], [rx + 48 + 42 * hp1, ry + (hp2 - 0.5) * 12]], {
        raw: true, w: 2.6 + 2 * hp2, a: 0.62 * ra, rgb: p % 2 ? PAL.goldHi : PAL.bone, seed: sd + 120 + p, head: 0.08, tail: 0.82, bleed: 0
      });
    }
  }
};

/* 9. zl.abyssEyes：杨和子睁眼特写动态层——瞳心朱砂赤芒闪烁＋眼底多层石绿深渊无尽向内坍缩 */
ZL.abyssEyes = function (c, t, o) {
  o = o || {};
  var A = num(o.a, 1), sc = num(o.s, 1), openK = cl01(num(o.openK, 1)), sd = num(o.seed, 59);
  if (A <= 0.003 || openK <= 0.004) return;
  var cx = num(o.x, 960), cy = num(o.y, 480);
  var ok = expoOut(openK, 5);

  // 左右双眸中心偏移（横幅特写对称中略带写意俯仰势）
  var eyes = o.single ? [[cx, cy, 1]] : [
    [cx - 235 * sc, cy + 6 * sc, -1],
    [cx + 235 * sc, cy - 6 * sc, 1]
  ];

  for (var e = 0; e < eyes.length; e++) {
    var ex = eyes[e][0], ey = eyes[e][1], side = eyes[e][2];
    var ew = 195 * sc, eh = 68 * sc * (0.06 + 0.94 * ok);
    var tilt = side * -0.055;

    c.save();
    c.translate(ex, ey);
    c.rotate(tilt);

    // 眼窝周围沧桑浓墨暗影衬底
    scorchSeat(c, 0, 0, ew * 1.25, Math.max(28 * sc, eh * 1.9), 0.55 * A, sd + e * 7, PAL.ink, 0);

    // 写意丹凤眼睑裁剪区：内部绘无尽坍缩石绿深渊与镇封魔影
    c.save();
    c.beginPath();
    c.moveTo(-ew, 0);
    c.bezierCurveTo(-ew * 0.45, -eh * 1.25, ew * 0.38, -eh * 1.18, ew, -eh * 0.08 * side);
    c.bezierCurveTo(ew * 0.42, eh * 1.15, -ew * 0.42, eh * 1.22, -ew, 0);
    c.closePath();
    c.clip();

    // 眼底石绿寒潭底色
    var irisR = 76 * sc;
    I.wash(c, 0, 0, ew * 0.95, eh * 1.4, 0.72 * A, sd + 10 + e, PAL.ink, 0, { edge: 'soft' });
    I.wash(c, 0, 0, irisR * 1.25, irisR * 1.15, 0.92 * A, sd + 12 + e, PAL.abyssDeep, 0, { edge: 'wet' });

    // 7 层不断向瞳心坍缩坠落的石绿/翡翠水墨晕圈（眼底幽绿层层无尽）
    var nLayers = 7;
    for (var i = 0; i < nLayers; i++) {
      var cyc = U.fract(i / nLayers - t * 0.24); // 由外向内无尽坍缩
      var lr = irisR * (0.12 + 1.08 * Math.pow(cyc, 0.85));
      var la = A * Math.sin(Math.PI * cyc) * 0.85;
      var lCol = i % 2 ? PAL.jade : PAL.abyssGreen;
      I.wash(c, 0, 0, lr, lr * 0.94, la * 0.48, sd + 20 + i, lCol, t * 0.18 * (i % 2 ? 1 : -1), { edge: 'wet' });
      brokenBrushLoop(c, 0, 0, lr, lr * 0.94, 0, la * 0.82, sd + 40 + e * 11 + i, {
        segs: 4, w: (2.5 + 4.5 * cyc) * sc, rgb: cyc < 0.45 ? PAL.jadeHi : lCol, dry: 0.32, spin: (i % 2 ? -1 : 1) * t * 0.35 + i
      });
    }

    // 绿渊深处隐约挣扎却被死死锁住的几缕黑魔残烟
    for (var m = 0; m < 3; m++) {
      var ma = -t * 0.6 + m * 2.1, mr = irisR * (0.34 + 0.16 * Math.sin(t + m));
      I.dry(c, [[Math.cos(ma) * mr, Math.sin(ma) * mr], [Math.cos(ma + 0.9) * mr * 0.55, Math.sin(ma + 0.9) * mr * 0.55]], {
        raw: true, n: 10, w: 6 * sc, a: 0.55 * A, rgb: PAL.ink, dry: 0.5, seed: sd + 70 + m
      });
    }

    // 瞳心一点朱砂赤芒（骤睁时锋芒刺骨，高频微闪）
    var sparkPulse = (0.78 + 0.22 * Math.sin(t * 7.2 + e * 0.4)) * (0.5 + 0.5 * ok);
    var pR = (10 + 5 * sparkPulse) * sc;
    I.inkBlot(c, 0, 0, pR * 1.45, sd + 80 + e, { a: 0.95 * A, rgb: PAL.bloodDk, rough: 0.2 });
    c.save();
    c.globalCompositeOperation = 'lighter';
    I.glow(c, 0, 0, pR * 4.2, PAL.bloodHi, 0.72 * A * sparkPulse);
    I.stroke(c, [[0, -pR * 2.1], [0, pR * 2.1]], { w: 4.2 * sc, a: 0.9 * A * sparkPulse, rgb: [212, 74, 48], seed: sd + 85, head: 0.45, tail: 0.45, bleed: 0 });
    I.stroke(c, [[-pR * 1.5, 0], [pR * 1.5, 0]], { w: 3.0 * sc, a: 0.75 * A * sparkPulse, rgb: PAL.goldHi, seed: sd + 86, head: 0.45, tail: 0.45, bleed: 0 });
    c.restore();

    c.restore(); // 结束眼睑 clip

    // 上下眼睑苍劲写意浓墨勾线（上睑重压带飞白眼尾，下睑枯淡卧蚕）
    var upLid = [[-ew * 1.06, 2 * sc], [-ew * 0.38, -eh * 1.02], [ew * 0.36, -eh * 0.96], [ew * 1.14, -eh * 0.16 * side]];
    var loLid = [[-ew * 0.96, 3 * sc], [0, eh * 0.96], [ew * 0.98, -eh * 0.04 * side]];
    I.sweep(c, upLid, { w: 14 * sc, a: 0.94 * A, rgb: PAL.ink, dry: 0.28, seed: sd + 90 + e, head: 0.12, tail: 0.42 });
    I.dry(c, loLid, { w: 7.5 * sc, a: 0.72 * A, rgb: PAL.inkSoft, dry: 0.46, seed: sd + 95 + e });

    c.restore();
  }
};

/* 10. zl.bloodChains：20–24 条穿胸透腹的上清符文血链（远中近三层纵深＋悬链线谐波震颤＋锤胸爆射＋上清符印＋倒刺尖刃） */
ZL.bloodChains = function (c, t, o) {
  o = o || {};
  var A = num(o.a, 1), eruptK = cl01(num(o.eruptK, 1)), sd = num(o.seed, 61);
  if (A * eruptK <= 0.003) return;
  var cx = num(o.cx, o.x != null ? o.x : 960), cy = num(o.cy, o.y != null ? o.y : 520);
  var n = Math.max(6, Math.min(32, Math.round(num(o.n, 22))));
  var rattle = cl01(num(o.rattle, 0)), spikes = cl01(num(o.spikes, 0));

  // 穿胸阵枢：焦墨血晕与至纯上清根本法度金篆阵眼
  var ek = expoOut(eruptK, 6);
  scorchSeat(c, cx, cy, 180 * ek, 160 * ek, 0.52 * A, sd, PAL.scorchDk, 0);
  I.wash(c, cx, cy, 115 * ek, 105 * ek, 0.48 * A, sd + 2, PAL.bloodDk, 0, { edge: 'wet' });
  brokenBrushLoop(c, cx, cy, 86 * ek, 82 * ek, 0, 0.56 * A * ek, sd + 4, {
    segs: 4, w: 6.5, rgb: PAL.gold, dry: 0.38, spin: t * 0.22
  });
  if (eruptK > 0.04 && eruptK < 0.85) {
    I.splat(c, cx, cy, 92, sd + 6, { k: ek, count: 20, rgb: PAL.bloodHi, a: 0.75 * A * (1 - eruptK) });
  }

  // 构建 20–24 条辐射全画幅（1920×1080 外缘）的三纵深悬链描述
  var chains = [];
  for (var i = 0; i < n; i++) {
    var h1 = U.hash(sd * 29 + i * 7), h2 = U.hash(sd * 29 + i * 7 + 3), h3 = U.hash(sd * 29 + i * 7 + 5);
    // 纵深分层：0 远景雾锁虚链(~25%)，1 中景精铸符链(~55%)，2 近景大尺度失焦铁索剪影(~20%)
    var depth = (i % 5 === 0) ? 2 : (i % 4 === 1 ? 0 : 1);
    var ang = (i / n) * TAU + (h1 - 0.5) * (TAU / n * 0.68);
    // 投射至画幅四周边界之外 140–280px
    var ux = Math.cos(ang), uy = Math.sin(ang);
    var tx = ux > 0.02 ? (W + 190 - cx) / ux : ux < -0.02 ? (-190 - cx) / ux : 1e5;
    var ty = uy > 0.02 ? (H + 170 - cy) / uy : uy < -0.02 ? (-170 - cy) / uy : 1e5;
    var dist = Math.min(Math.max(420, Math.min(Math.abs(tx), Math.abs(ty))), 1480) * (depth === 2 ? 1.15 : 1);
    chains.push({ i: i, depth: depth, ang: ang, ux: ux, uy: uy, dist: dist, h1: h1, h2: h2, h3: h3 });
  }
  chains.sort(function (a, b) { return a.depth - b.depth; });

  // 横向弦振动谐波强度（erupt 初段铮鸣＋rattle 行走哗啦锁扣颤动）
  var ringVib = (eruptK < 0.98 ? Math.sin(Math.PI * eruptK) * 0.85 : 0) + rattle;

  for (var cIdx = 0; cIdx < chains.length; cIdx++) {
    var ch = chains[cIdx], idx = ch.i;
    var stagger = cl01((eruptK * 1.28 - ch.h1 * 0.26));
    if (stagger <= 0.01) continue;
    var reach = expoOut(stagger, 6);
    var curDist = ch.dist * reach;
    var ex = cx + ch.ux * curDist, ey = cy + ch.uy * curDist;
    var nx = -ch.uy, ny = ch.ux;

    // 悬链线自然垂坠度（水平跨度越大垂弧越明显；紧绷时略收）
    var horiz = Math.abs(ch.ux);
    var sag = horiz * (42 + 68 * ch.h2) * (1.18 - 0.35 * rattle);
    var harmFreq = 16 + 11 * ch.h3;
    var harmAmp = ringVib * (6 + 10 * ch.h2) * (ch.depth === 2 ? 1.4 : 1);

    var N = ch.depth === 1 ? 26 : 18, pts = [];
    for (var s = 0; s <= N; s++) {
      var u = s / N;
      var catenary = 4 * u * (1 - u) * sag; // 重力向下 (+y) 悬垂
      var wave = harmAmp * Math.sin(Math.PI * (2 + (idx % 2)) * u) * Math.sin(t * harmFreq + idx * 1.7);
      var micro = 2.5 * U.noise1(u * 6 + idx, sd + idx) * Math.sin(Math.PI * u);
      pts.push([
        cx + (ex - cx) * u + nx * (wave + micro),
        cy + (ey - cy) * u + catenary + ny * (wave + micro)
      ]);
    }

    if (ch.depth === 0) {
      // 远景血链：没入封神台血雾的苍茫暗红索影
      I.sweep(c, pts, { raw: true, n: 24, w: 11, a: 0.38 * A, rgb: PAL.bloodRust, dry: 0.42, seed: sd + 30 + idx, head: 0.04, tail: 0.08 });
      I.dry(c, pts, { raw: true, n: 24, w: 5, a: 0.28 * A, rgb: PAL.goldBronze, dry: 0.58, seed: sd + 60 + idx });
    } else if (ch.depth === 2) {
      // 近景失焦重索：横掠前景边角的压迫感粗大墨血铁链剪影
      I.sweep(c, pts, { raw: true, n: 26, w: 46 + 12 * ch.h1, a: 0.32 * A, rgb: PAL.ink, dry: 0.48, seed: sd + 90 + idx, head: 0.05, tail: 0.05 });
      var stepNear = Math.max(1, Math.floor(N / 7));
      for (var ln = 1; ln < N; ln += stepNear) {
        var pn0 = pts[ln - 1], pn1 = pts[Math.min(N, ln + 1)];
        var langN = Math.atan2(pn1[1] - pn0[1], pn1[0] - pn0[0]);
        I.wash(c, pts[ln][0], pts[ln][1], 44, 22, 0.36 * A, sd + ln + idx, PAL.bloodRust, langN, { edge: 'soft' });
      }
    } else {
      // 中景主力符文血链：焦墨底索＋逐环咬合铁索印章＋流淌的上清古篆金红符文＋锋利倒刺
      I.stroke(c, pts, { raw: true, n: 32, w: 20, a: 0.32 * A, rgb: PAL.scorchDk, mode: 'multiply', seed: sd + 120 + idx, head: 0.02, tail: 0.02, bleed: 0 });
      I.sweep(c, pts, { raw: true, n: 32, w: 13, a: 0.85 * A, rgb: PAL.bloodDk, dry: 0.3, seed: sd + 150 + idx, head: 0.02, tail: 0.04 });

      var linkSpan = 36;
      var nLinks = Math.max(3, Math.min(34, Math.floor(curDist / linkSpan)));
      for (var lk = 0; lk < nLinks; lk++) {
        var lu = (lk + 0.5) / nLinks;
        var fi = lu * N, i0 = Math.min(N - 1, Math.floor(fi)), frac = fi - i0;
        var lx = U.lerp(pts[i0][0], pts[i0 + 1][0], frac);
        var ly = U.lerp(pts[i0][1], pts[i0 + 1][1], frac);
        var lang = Math.atan2(pts[i0 + 1][1] - pts[i0][1], pts[i0 + 1][0] - pts[i0][0]);
        var edgeRot = (lk % 2 === 0) ? 0 : 0.14; // 奇偶环正侧交错咬合
        var linkW = (lk % 2 === 0) ? 46 : 40, linkH = (lk % 2 === 0) ? 24 : 15;
        drawStamp(c, stampChainLink(idx + lk, 0.8), lx, ly, linkW, linkH, lang + edgeRot, 0.92 * A, null, false);

        // spikes > 0：锁扣迸出狰狞暗红寒铁倒刺尖刃
        if (spikes > 0.02 && lk % 2 === 1) {
          var spLen = (14 + 12 * ((lk * 7 + idx) % 3) / 2) * spikes;
          var spSgn = (lk % 4 === 1) ? 1 : -1;
          var bAng = lang + spSgn * 1.08 + 0.08 * rattle * Math.sin(t * 22 + lk);
          var barb = [
            [lx, ly],
            [lx + Math.cos(bAng) * spLen * 0.55, ly + Math.sin(bAng) * spLen * 0.55],
            [lx + Math.cos(bAng - spSgn * 0.32) * spLen, ly + Math.sin(bAng - spSgn * 0.32) * spLen]
          ];
          I.stroke(c, barb, { w: 5.2, a: 0.9 * A * spikes, rgb: PAL.ink, seed: sd + 200 + lk, head: 0.06, tail: 0.82, bleed: 0 });
          I.stroke(c, barb, { w: 2.2, a: 0.78 * A * spikes, rgb: PAL.bloodHi, seed: sd + 220 + lk, head: 0.1, tail: 0.75, bleed: 0 });
        }
      }

      // 沿铁索流淌结阵的至纯上清古篆符光（自胸膛向外脉动奔流）
      for (var rp = 0; rp < 2; rp++) {
        var ru = U.fract(t * (0.22 + 0.08 * ch.h3) + rp * 0.5 + ch.h1);
        if (ru > reach) continue;
        var rfi = ru * N, ri0 = Math.min(N - 1, Math.floor(rfi)), rfrac = rfi - ri0;
        var rx = U.lerp(pts[ri0][0], pts[ri0 + 1][0], rfrac);
        var ry = U.lerp(pts[ri0][1], pts[ri0 + 1][1], rfrac);
        var rang = Math.atan2(pts[ri0 + 1][1] - pts[ri0][1], pts[ri0 + 1][0] - pts[ri0][0]);
        var rAlpha = A * Math.sin(Math.PI * ru) * 0.85;
        drawStamp(c, stampTadpoleRune(idx + rp * 3, PAL.goldHi), rx, ry, 24, 24, rang, rAlpha, 'lighter', false);
      }
    }
  }

  // 胸口穿刺中心：一点不灭上清纯金与暗赤血气交汇辉光
  c.save();
  c.globalCompositeOperation = 'lighter';
  I.glow(c, cx, cy, 88 * ek, mix3(PAL.bloodHi, PAL.gold, 0.55), 0.38 * A * (0.8 + 0.2 * Math.sin(t * 3.2)));
  c.restore();
};

/* 11. zl.dragonSha：斩龙台冲霄血煞残缺太古天龙（盘旋 prowl / 畏缩 cower / 凝成九百尺千钧断头血刀 blade） */
ZL.dragonSha = function (c, t, o) {
  o = o || {};
  var A = num(o.a, 1), sc = num(o.s, 1), sd = num(o.seed, 67);
  if (A <= 0.003) return;
  var cx = num(o.x, 960), cy = num(o.y, 460);
  var state = o.state || 'prowl', bladeK = cl01(num(o.bladeK, 0));
  var isCower = state === 'cower', isBlade = state === 'blade';

  // 底部蒸腾翻涌的冲霄血煞雾潮（借 fx-bloodtide-tex 驱动）
  var mistY = isCower ? cy + 160 * sc : cy - 60 * sc;
  var mistH = isCower ? 240 * sc : 420 * sc;
  if (I.bloodTide) {
    I.bloodTide(c, t, { x0: cx - 760 * sc, y: mistY, w: 1520 * sc, h: mistH, speed: isCower ? 18 : 54, warp: isCower ? 14 : 32, a: (isCower ? 0.34 : 0.52) * A * (1 - 0.55 * bladeK), seed: sd });
  }

  // 状态三：blade —— 漫天残龙血煞向上急剧坍缩，铸成一柄 900px 纵贯苍穹的千钧书法断头血刀轰然斩落！
  if (isBlade) {
    var formK = cl01(bladeK / 0.32);                       // 0..0.32 聚煞成刀并高举蓄势
    var dropK = bladeK <= 0.32 ? 0 : expoIn((bladeK - 0.32) / 0.46, 6); // 0.32..0.78 千钧斩落
    var postK = bladeK <= 0.78 ? 0 : cl01((bladeK - 0.78) / 0.22);      // 0.78..1.00 劈入断龙石震波

    // 聚煞期：残龙血气如百川归海卷入高空刀脊
    if (formK < 0.98) {
      for (var st = 0; st < 8; st++) {
        var sa = (st / 8) * TAU + t * 2.2;
        var sr = (360 * (1 - formK) + 40) * sc;
        var sPts = [
          [cx + Math.cos(sa) * sr, cy + Math.sin(sa) * sr * 0.65],
          [cx + Math.cos(sa + 0.6) * sr * 0.45, cy - 220 * sc],
          [cx + 30 * sc, cy - 340 * sc]
        ];
        I.sweep(c, sPts, { raw: true, n: 18, w: 28 * sc, a: 0.55 * A * (1 - formK), rgb: PAL.bloodMid, dry: 0.42, seed: sd + 10 + st });
      }
    }

    // 900px 巨型古刑断龙刀：蓄势微抬 (-55px) → 雷霆劈落至断龙石 (cy + 165)
    var liftY = -65 * sc * Math.sin(Math.PI * formK * 0.5) * (1 - dropK);
    var tipX = cx - 40 * sc * dropK, tipY = U.lerp(cy - 160 * sc, cy + 215 * sc, dropK) + liftY;
    var hiltX = tipX + 210 * sc, hiltY = tipY - 880 * sc;
    var dx = tipX - hiltX, dy = tipY - hiltY, L = Math.hypot(dx, dy) || 1;
    var nx = -dy / L, ny = dx / L; // 指向刀刃前弧侧

    var spine = [], edge = [], N = 22;
    for (var i = 0; i <= N; i++) {
      var u = i / N;
      // 阔背弯弧古斩马/断头巨刃：前段宽阔沉重（达 135px），收尖凛冽
      var bladeW = (42 + 98 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.88)), 0.65)) * sc * expoOut(formK, 4);
      var curve = Math.sin(Math.PI * u) * 38 * sc;
      var bx = hiltX + dx * u - nx * curve, by = hiltY + dy * u - ny * curve;
      spine.push([bx, by]);
      edge.push([bx + nx * bladeW, by + ny * bladeW]);
    }

    // 焦墨煞气暗底
    scorchSeat(c, (hiltX + tipX) * 0.5, (hiltY + tipY) * 0.5, 220 * sc, 480 * sc, 0.55 * A * formK, sd + 25, PAL.ink, Math.atan2(dy, dx));

    // 刀面浓黑血铁填充＋飞白血槽＋凛冽朱砂金锋刃
    c.save();
    c.fillStyle = U.rgba(PAL.ink, 0.86 * A * formK);
    c.beginPath();
    for (var p = 0; p <= N; p++) c[p ? 'lineTo' : 'moveTo'](spine[p][0], spine[p][1]);
    for (var p2 = N; p2 >= 0; p2--) c.lineTo(edge[p2][0], edge[p2][1]);
    c.closePath();
    c.fill();
    c.restore();

    I.sweep(c, spine, { raw: true, n: 28, w: 34 * sc, a: 0.94 * A * formK, rgb: PAL.ink, dry: 0.25, seed: sd + 31, head: 0.05, tail: 0.15 });
    I.dry(c, edge, { raw: true, n: 32, w: 28 * sc, a: 0.92 * A * formK, rgb: PAL.bloodHi, dry: 0.42, seed: sd + 33 });
    c.save();
    c.globalCompositeOperation = 'lighter';
    I.stroke(c, edge, { raw: true, n: 32, w: 6.5 * sc, a: 0.85 * A * formK, rgb: PAL.goldHi, seed: sd + 35, head: 0.12, tail: 0.08, bleed: 0 });
    c.restore();

    // 刀身镇刑血篆与劈空拖尾气浪
    for (var r = 0; r < 5; r++) {
      var ru = 0.22 + r * 0.14, ri = Math.round(ru * N);
      var rx = (spine[ri][0] + edge[ri][0]) * 0.5, ry = (spine[ri][1] + edge[ri][1]) * 0.5;
      drawStamp(c, stampTadpoleRune(r + 4, PAL.bloodHi), rx, ry, 42 * sc, 42 * sc, Math.atan2(dy, dx), 0.78 * A * formK, 'lighter', false);
    }
    if (dropK > 0.12) {
      ZL.slashImpact(c, bladeK, 0.72, { x0: hiltX + 60 * sc, y0: hiltY + 180 * sc, x1: tipX, y1: tipY, kind: 'blood', w: 72 * sc, dur: 0.12, a: A * cl01((bladeK - 0.55) / 0.25), seed: sd + 45 });
    }
    if (postK > 0.01 && M.inkShock) {
      M.inkShock(c, postK * 0.9, { t0: 0, dur: 1.0, x: tipX, y: tipY, R: 680 * sc, flat: 0.36, rgb: PAL.bloodMid, a: 0.72 * A, seed: sd + 55 });
    }
    return;
  }

  // 状态一/二：prowl（盘旋咆哮）与 cower（受符诏/水烟震慑哀鸣匍匐）—— 两条交错盘绕的残缺太古血煞天龙
  var nDragons = 2;
  for (var d = 0; d < nDragons; d++) {
    var hd = d === 0 ? 1 : -0.78;
    var dScale = (d === 0 ? 1.0 : 0.74) * sc;
    var flatten = isCower ? 0.34 : 1.0;
    var baseY = isCower ? cy + (135 + d * 35) * sc : cy + (d * 45 - 20) * sc;
    var tremor = isCower ? 5.5 * sc * U.noise1(t * 24 + d * 7, sd) : 0;
    var dAlpha = A * (d === 0 ? 0.92 : 0.68) * (isCower ? 0.78 : 1);

    // 蜿蜒分节水墨龙躯（24 节脊椎曲线）
    var segs = 24, body = [];
    var ph = t * (isCower ? 0.75 : 1.65) * hd + d * 2.4;
    for (var s = 0; s <= segs; s++) {
      var u = s / segs; // 0 龙尾 → 1 龙首
      var spanX = (d === 0 ? 520 : 410) * dScale;
      var sx = cx + hd * (u - 0.48) * spanX + 55 * dScale * Math.sin(u * 4.2 - ph) + tremor;
      var sy = baseY + flatten * (-145 * dScale * Math.sin(Math.PI * u) + 78 * dScale * Math.cos(u * 5.6 - ph)) + (isCower ? u * 58 * dScale : 0);
      body.push([sx, sy]);
    }

    // 龙身血雾底晕＋浓墨重脊＋枯笔逆鳞背鳍
    for (var w = 3; w < segs; w += 4) {
      I.wash(c, body[w][0], body[w][1], 88 * dScale, 54 * dScale * (0.5 + 0.5 * flatten), 0.36 * dAlpha, sd + d * 20 + w, PAL.bloodDk, 0, { edge: 'wet' });
    }
    I.sweep(c, body, {
      raw: true, n: 44, w: 54 * dScale, a: 0.88 * dAlpha, rgb: PAL.ink, dry: 0.32, seed: sd + 60 + d,
      wf: function (s) { return Math.pow(s, 0.45) * (1 - 0.25 * Math.pow(s, 4)) * (0.65 + 0.35 * Math.sin(s * 18)); }
    });
    I.dry(c, body, { raw: true, n: 44, w: 36 * dScale, a: 0.76 * dAlpha, rgb: PAL.bloodMid, dry: 0.48, seed: sd + 65 + d });

    // 背脊参差骨刺/残鳍
    for (var sp = 4; sp < segs - 2; sp += 2) {
      var pPrev = body[sp - 1], pNext = body[sp + 1];
      var tang = Math.atan2(pNext[1] - pPrev[1], pNext[0] - pPrev[0]);
      var finAng = tang - hd * 1.15;
      var finLen = (24 + 18 * Math.sin(Math.PI * (sp / segs))) * dScale * (isCower ? 0.55 : 1);
      I.stroke(c, [body[sp], [body[sp][0] + Math.cos(finAng) * finLen, body[sp][1] + Math.sin(finAng) * finLen]], {
        w: 6.5 * dScale, a: 0.75 * dAlpha, rgb: sp % 4 === 0 ? PAL.bloodHi : PAL.ink, seed: sd + 80 + sp, head: 0.1, tail: 0.75, fb: 0.3
      });
    }

    // 残缺龙爪（一前一后探出墨云）
    [Math.floor(segs * 0.42), Math.floor(segs * 0.76)].forEach(function (ci, kIdx) {
      var cp = body[ci];
      drawStamp(c, stampDragonPart('claw', d + kIdx), cp[0] + hd * 18 * dScale, cp[1] + 44 * dScale, 98 * dScale, 98 * dScale, (isCower ? 0.45 : 0.1) * hd, 0.86 * dAlpha, null, hd < 0);
    });

    // 狰狞龙首＋嶙峋断角＋赤芒凶睛（cower 时低垂贴地战栗）
    var neckP = body[segs - 2], headP = body[segs];
    var hAng = Math.atan2(headP[1] - neckP[1], headP[0] - neckP[0]);
    if (isCower) hAng = hd > 0 ? Math.max(hAng, 0.42) : Math.min(hAng, Math.PI - 0.42);
    var hx = headP[0], hy = headP[1];

    // 断角印章
    drawStamp(c, stampDragonPart('horn', d), hx - Math.cos(hAng) * 18 * dScale, hy - 44 * dScale, 108 * dScale, 108 * dScale, (hAng - (hd > 0 ? 0 : Math.PI)) * 0.5, 0.92 * dAlpha, null, hd < 0);
    // 上下龙颚重墨劈刷
    var snoutLen = 68 * dScale, jawOpen = (isCower ? 0.08 : 0.36 + 0.12 * Math.sin(t * 3.2 + d));
    var upJaw = [[hx, hy], [hx + Math.cos(hAng - jawOpen * 0.5) * snoutLen, hy + Math.sin(hAng - jawOpen * 0.5) * snoutLen]];
    var loJaw = [[hx, hy + 8 * dScale], [hx + Math.cos(hAng + jawOpen) * snoutLen * 0.82, hy + Math.sin(hAng + jawOpen) * snoutLen * 0.82]];
    I.sweep(c, upJaw, { w: 28 * dScale, a: 0.94 * dAlpha, rgb: PAL.ink, dry: 0.28, seed: sd + 110 + d, head: 0.1, tail: 0.45 });
    I.sweep(c, loJaw, { w: 18 * dScale, a: 0.88 * dAlpha, rgb: PAL.bloodDk, dry: 0.35, seed: sd + 115 + d, head: 0.1, tail: 0.55 });
    // 凶戾龙睛赤芒
    var eyeX = hx + Math.cos(hAng - 0.25 * hd) * 22 * dScale, eyeY = hy + Math.sin(hAng - 0.25 * hd) * 22 * dScale - 6 * dScale;
    c.save();
    c.globalCompositeOperation = 'lighter';
    I.glow(c, eyeX, eyeY, 26 * dScale, PAL.bloodHi, (isCower ? 0.38 : 0.78) * dAlpha);
    I.stroke(c, [[eyeX - 10 * dScale, eyeY - 2 * dScale], [eyeX + 10 * dScale, eyeY + 2 * dScale]], {
      w: 4.5 * dScale, a: 0.9 * dAlpha, rgb: PAL.goldHi, seed: sd + 120 + d, head: 0.35, tail: 0.35, bleed: 0
    });
    c.restore();
  }
};

/* 12. zl.cyanLotusAndMist：澹澹水烟清光＋碗大青莲飘落绽放＋花瓣渗水珠吸尽水烟＋颈种莲花神光倒刷化生 */
ZL.cyanLotusAndMist = function (c, t, o) {
  o = o || {};
  var A = num(o.a, 1), sd = num(o.seed, 71);
  if (A <= 0.003) return;
  var cx = num(o.x, 960), cy = num(o.y, 480);
  var mistK = cl01(num(o.mistK, 1)), lotusK = cl01(num(o.lotusK, 0));
  var dropY = num(o.dropY, 0), dewK = cl01(num(o.dewK, 0)), washK = cl01(num(o.washK, 0));

  var lx = cx, ly = cy + dropY; // 青莲当前落点
  // 随花瓣凝露吸光（dewK 0→1），水烟清光被青莲源源吸入而肉眼可见地收拢变薄！
  var effectiveMist = mistK * (1 - 0.82 * U.smooth(dewK));

  // 1. 脑后升腾的「澹澹水烟清光」（mistK；dewK > 0 时丝缕倒卷吸入莲心）
  if (effectiveMist > 0.004 || (mistK > 0.01 && dewK < 0.99)) {
    var mA = A * Math.max(effectiveMist, mistK * (1 - dewK) * 0.45);
    scorchSeat(c, cx, cy - 65, 190, 155, 0.32 * mA, sd, PAL.scorch, 0);
    I.wash(c, cx, cy - 55, 155 * (1 - 0.45 * dewK), 125 * (1 - 0.35 * dewK), 0.34 * mA, sd + 2, PAL.cyanMist, 0, { edge: 'soft' });

    var nWisps = 14;
    for (var i = 0; i < nWisps; i++) {
      var hi = U.hash(sd * 17 + i * 5), hi2 = U.hash(sd * 17 + i * 5 + 2);
      var spreadX = (i / (nWisps - 1) - 0.5) * 240 * (1 - 0.55 * dewK);
      var wispH = (150 + 95 * hi) * (1 - 0.48 * dewK);
      var pts = [];
      for (var q = 0; q <= 10; q++) {
        var u = q / 10;
        // 正常态袅袅上升盘旋；dewK > 0 时末梢被强力拉向青莲中心 (lx, ly)
        var freeX = cx + spreadX * (0.35 + 0.65 * u) + 24 * Math.sin(u * 4.2 - t * (1.2 + 0.5 * hi) + i);
        var freeY = cy + 20 - wispH * u;
        var suckPull = U.smooth(dewK) * Math.pow(u, 1.3);
        pts.push([U.lerp(freeX, lx, suckPull), U.lerp(freeY, ly - 18, suckPull)]);
      }
      var wCol = i % 3 === 0 ? [228, 244, 240] : i % 2 ? PAL.cyanHi : PAL.cyan;
      I.sweep(c, pts, { raw: true, n: 24, w: (22 - 12 * dewK) * (0.7 + 0.5 * hi2), a: 0.32 * mA, rgb: wCol, dry: 0.42 + 0.25 * dewK, seed: sd + 20 + i, head: 0.15, tail: 0.55 });
      if (dewK > 0.08 && i % 2 === 0) {
        c.save();
        c.globalCompositeOperation = 'lighter';
        I.stroke(c, pts, { raw: true, n: 20, w: 2.2, a: 0.55 * A * Math.sin(Math.PI * dewK), rgb: PAL.cyanHi, seed: sd + 40 + i, head: 0.2, tail: 0.2, bleed: 0 });
        c.restore();
      }
    }
  }

  // 2. 碗大莹洁青莲（外七瓣、中六瓣、内五瓣三层没骨墨脉莲瓣＋泥金莲蕊＋渗露凝珠）
  if (lotusK > 0.004) {
    var lk = expoOut(lotusK, 5);
    var lScale = 0.45 + 0.55 * lk;
    var sway = 0.04 * Math.sin(t * 1.35 + sd);

    scorchSeat(c, lx, ly - 10, 128 * lScale, 84 * lScale, 0.42 * A * lk, sd + 60, PAL.scorchDk, sway);
    c.save();
    c.translate(lx, ly);
    c.rotate(sway);

    // 莲座柔润青玉底晕
    I.wash(c, 0, -8 * lScale, 92 * lScale, 52 * lScale, 0.36 * A * lk, sd + 62, PAL.jade, 0, { edge: 'soft' });

    // 外层 7 阔瓣（舒展度随 lk 与呼吸微张）
    var bloom = 0.35 + 0.65 * lk + 0.04 * Math.sin(t * 1.7);
    var dewTips = [];
    for (var p1 = 0; p1 < 7; p1++) {
      var u1 = p1 / 6 - 0.5; // -0.5 .. +0.5 扇形仰视排布
      var ang1 = u1 * 1.92 * bloom;
      var pw1 = 56 * lScale, ph1 = 96 * lScale;
      c.save();
      c.rotate(ang1);
      drawStamp(c, stampLotusPetal(p1, false), 0, -ph1 * 0.42, pw1, ph1, 0, 0.86 * A * lk, null, p1 % 2 === 1);
      c.restore();
      dewTips.push([Math.sin(ang1) * ph1 * 0.84, -Math.cos(ang1) * ph1 * 0.84]);
    }

    // 中层 6 捧心瓣
    for (var p2 = 0; p2 < 6; p2++) {
      var u2 = p2 / 5 - 0.5;
      var ang2 = u2 * 1.32 * bloom;
      var pw2 = 48 * lScale, ph2 = 84 * lScale;
      c.save();
      c.rotate(ang2);
      drawStamp(c, stampLotusPetal(p2 + 2, true), 0, -ph2 * 0.44, pw2, ph2, 0, 0.9 * A * lk, null, p2 % 2 === 0);
      c.restore();
      if (p2 % 2 === 0) dewTips.push([Math.sin(ang2) * ph2 * 0.86, -Math.cos(ang2) * ph2 * 0.86]);
    }

    // 金色莲蕊丝簇（托于内中瓣之间，温润泥金点染）
    for (var st = -4; st <= 4; st++) {
      var sa = st * 0.14, sLen = (34 + 8 * Math.cos(st)) * lScale;
      var stPts = [[0, -6 * lScale], [Math.sin(sa) * sLen * 0.5, -6 * lScale - Math.cos(sa) * sLen * 0.55], [Math.sin(sa) * sLen, -6 * lScale - Math.cos(sa) * sLen]];
      I.stroke(c, stPts, { w: 1.8 * lScale, a: 0.78 * A * lk, rgb: PAL.gold, seed: sd + 80 + st, head: 0.1, tail: 0.4, bleed: 0 });
      c.fillStyle = U.rgba(PAL.goldHi, 0.88 * A * lk);
      I.blot(c, stPts[2][0], stPts[2][1], 2.4 * lScale, sd + 90 + st, { rough: 0.2, sx: 1.2, sy: 0.9 });
      c.fill();
    }

    // 内层 5 敛合嫩瓣（护住莲心）
    for (var p3 = 0; p3 < 5; p3++) {
      var u3 = p3 / 4 - 0.5;
      var ang3 = u3 * 0.72 * bloom;
      var pw3 = 38 * lScale, ph3 = 68 * lScale;
      c.save();
      c.rotate(ang3);
      drawStamp(c, stampLotusPetal(p3 + 4, true), 0, -ph3 * 0.42, pw3, ph3, 0, 0.92 * A * lk, null, false);
      c.restore();
    }

    // 花瓣凝结晶莹水珠（dewK > 0：瓣尖渗出滚圆清露，微微欲滴，折射星芒）
    if (dewK > 0.01) {
      var dk = expoOut(dewK, 4);
      for (var d = 0; d < dewTips.length; d++) {
        var tp = dewTips[d];
        var tremb = 1.6 * Math.sin(t * 5.2 + d * 1.7) * dk;
        var dx = tp[0] + tremb * 0.4, dy = tp[1] + 4 * dk + Math.abs(tremb);
        var dr = (3.4 + 2.8 * ((d * 3) % 4) / 3) * lScale * dk;
        I.wash(c, dx, dy + dr * 0.4, dr * 1.8, dr * 1.6, 0.35 * A * dk, sd + 110 + d, PAL.stoneCyan, 0, { edge: 'soft' });
        c.fillStyle = U.rgba([226, 248, 244], 0.92 * A * dk);
        I.blot(c, dx, dy, dr, sd + 130 + d, { rough: 0.14, n: 12, sx: 0.92, sy: 1.18 });
        c.fill();
        c.save();
        c.globalCompositeOperation = 'lighter';
        I.glow(c, dx - dr * 0.25, dy - dr * 0.28, dr * 3.2, PAL.cyanHi, 0.62 * A * dk * (0.75 + 0.25 * Math.sin(t * 3.8 + d)));
        c.restore();
      }
    }

    c.globalCompositeOperation = 'lighter';
    I.glow(c, 0, -28 * lScale, 96 * lScale, PAL.cyanHi, A * lk * (0.24 + 0.22 * dewK));
    c.restore();
  }

  // 3. 颈种莲花、神光倒刷洗炼全身并化生「杨祖」温雅道冠头颅（washK > 0）
  if (washK > 0.004) {
    var wk = expoOut(washK, 4);
    scorchSeat(c, lx, ly + 110, 175 * wk, 260 * wk, 0.36 * A * wk, sd + 160, PAL.scorchDk, 0);

    // 向下倒刷全身遗蜕的十二道清润翡翠青金光瀑
    for (var s = 0; s < 12; s++) {
      var su = (s / 11) - 0.5;
      var sx0 = lx + su * 110, sy0 = ly + 6;
      var sx1 = lx + su * 210 * (0.7 + 0.3 * wk), sy1 = ly + (320 + 90 * Math.cos(su * 2.4)) * wk;
      var fallPts = [
        [sx0, sy0],
        [U.lerp(sx0, sx1, 0.45) + 14 * Math.sin(t * 2.4 + s), U.lerp(sy0, sy1, 0.45)],
        [sx1, sy1]
      ];
      var fCol = s % 3 === 0 ? PAL.goldHi : s % 2 ? PAL.cyanHi : PAL.jadeHi;
      I.sweep(c, fallPts, { raw: true, n: 24, w: 24, a: 0.36 * A * wk, rgb: fCol, dry: 0.38, seed: sd + 170 + s, head: 0.1, tail: 0.65 });
      c.save();
      c.globalCompositeOperation = 'lighter';
      I.stroke(c, fallPts, { raw: true, n: 22, w: 3.6, a: 0.52 * A * wk, rgb: fCol, seed: sd + 190 + s, head: 0.15, tail: 0.65, bleed: 0 });
      c.restore();
    }

    // 向上凝聚高冠博带之清朗仙首虚影光轮
    var headH = 128 * wk;
    c.save();
    c.globalCompositeOperation = 'lighter';
    I.glow(c, lx, ly - headH * 0.55, 115 * wk, PAL.cyanHi, 0.34 * A * wk);
    brokenBrushLoop(c, lx, ly - headH * 0.62, 54 * wk, 68 * wk, 0, 0.52 * A * wk, sd + 210, {
      segs: 4, w: 5.5, rgb: PAL.goldHi, dry: 0.35, spin: t * 0.3
    });
    c.restore();
  }
};

/* 13. zl.inkBloodToJade：断颈墨血挣扎化形被青光锁链化烟泯灭(ink) / 莹然如玉的翡翠碧血溅落石上(jade) */
ZL.inkBloodToJade = function (c, t, o) {
  o = o || {};
  var A = num(o.a, 1), k = cl01(num(o.k, 0)), sd = num(o.seed, 73);
  if (A <= 0.003 || k <= 0.002) return;
  var cx = num(o.x, 960), cy = num(o.y, 580), mode = o.mode || 'ink';

  if (mode === 'ink') {
    // 墨血初喷挣扎化魔（k: 0..0.55 狂涌扭曲）→ 青光细锁纵横绞杀化作灰烟泯灭（k: 0.35..1.0）
    var surge = expoOut(cl01(k / 0.45), 5);
    var quell = cl01((k - 0.28) / 0.72);
    var remain = 1 - U.smooth(quell);

    if (remain > 0.005) {
      var nTendrils = 11;
      for (var i = 0; i < nTendrils; i++) {
        var hi = U.hash(sd * 19 + i * 7), hi2 = U.hash(sd * 19 + i * 7 + 3);
        var ang = -Math.PI * 0.5 + (i / (nTendrils - 1) - 0.5) * 1.85 + 0.18 * Math.sin(t * 5.5 + i);
        var len = (95 + 145 * hi) * surge * (0.4 + 0.6 * remain);
        var writhe = 26 * Math.sin(t * 7.2 + i * 1.9) * remain;
        var tPts = [
          [cx, cy],
          [cx + Math.cos(ang) * len * 0.52 - Math.sin(ang) * writhe, cy + Math.sin(ang) * len * 0.52 + Math.cos(ang) * writhe],
          [cx + Math.cos(ang) * len + Math.sin(ang) * writhe * 0.6, cy + Math.sin(ang) * len - Math.cos(ang) * writhe * 0.6]
        ];
        var bCol = i % 3 === 0 ? PAL.bloodRust : PAL.ink;
        I.sweep(c, tPts, { raw: true, n: 20, w: (24 - 10 * quell) * (0.7 + 0.5 * hi2), a: 0.9 * A * remain, rgb: bCol, dry: 0.36 + 0.3 * quell, seed: sd + 10 + i, head: 0.06, tail: 0.6 });
        if (i % 3 === 1) {
          I.inkBlot(c, tPts[2][0], tPts[2][1], 14 * remain, sd + 30 + i, { a: 0.85 * A * remain, rgb: PAL.ink, rough: 0.36 });
        }
      }
    }

    // 纵横穿插的青光细锁与化烟消散
    if (quell > 0.02) {
      var chainA = A * Math.sin(Math.PI * cl01(quell * 1.05));
      scorchSeat(c, cx, cy - 75, 190, 120, 0.28 * chainA, sd + 45, PAL.scorchDk, 0);
      for (var q = 0; q < 7; q++) {
        var qa = (q / 7) * Math.PI + 0.25 * Math.sin(t * 2 + q);
        var span = 165 * surge;
        var qx = cx + (U.hash(sd + q * 11) - 0.5) * 90, qy = cy - 75 + (U.hash(sd + q * 13) - 0.5) * 80;
        var cPts = [
          [qx - Math.cos(qa) * span, qy - Math.sin(qa) * span * 0.65],
          [qx + 8 * Math.sin(t * 8 + q), qy + 8 * Math.cos(t * 8 + q)],
          [qx + Math.cos(qa) * span, qy + Math.sin(qa) * span * 0.65]
        ];
        I.stroke(c, cPts, { raw: true, n: 18, w: 3.2, a: 0.82 * chainA, rgb: PAL.cyan, seed: sd + 50 + q, head: 0.15, tail: 0.15, bleed: 0 });
        c.save();
        c.globalCompositeOperation = 'lighter';
        I.stroke(c, cPts, { raw: true, n: 18, w: 1.6, a: 0.75 * chainA, rgb: PAL.cyanHi, seed: sd + 60 + q, head: 0.2, tail: 0.2, bleed: 0 });
        c.restore();
      }
      // 墨血化作袅袅淡灰青烟消泯无踪
      for (var sm = 0; sm < 9; sm++) {
        var hs = U.hash(sd + 80 + sm);
        var smX = cx + (hs - 0.5) * 210, smY = cy - 40 - quell * (120 + 95 * hs);
        I.wash(c, smX, smY, 44 + 38 * quell, 28 + 26 * quell, 0.42 * A * Math.sin(Math.PI * quell), sd + 90 + sm, mix3(PAL.inkSoft, PAL.ash, quell), 0, { edge: 'soft' });
      }
    }
    return;
  }

  // mode === 'jade'：「墨血流尽，继之以洁」—— 莹然如玉的翡翠碧血溅出颈间，滴落断龙石绽开碧玉水晕
  var jk = cl01(k);
  var groundY = num(o.groundY, cy + 125);
  scorchSeat(c, cx, (cy + groundY) * 0.5, 165, 110, 0.34 * A * Math.sin(Math.PI * Math.min(1, jk * 1.2)), sd + 110, PAL.scorchDk, 0);

  var nDrops = 16;
  for (var d = 0; d < nDrops; d++) {
    var hd1 = U.hash(sd * 23 + d * 5), hd2 = U.hash(sd * 23 + d * 5 + 2);
    var tStart = hd1 * 0.32;
    var dk = cl01((jk - tStart) / (0.68));
    if (dk <= 0) continue;

    var vx = (hd2 - 0.5) * 240, vy0 = -(85 + 115 * hd1);
    var grav = 460;
    var px = cx + vx * dk;
    var py = cy + vy0 * dk + 0.5 * grav * dk * dk;

    if (py < groundY) {
      // 空中抛物飞溅的晶莹翡翠血珠
      var dr = 4.2 + 4.8 * hd2;
      var angD = Math.atan2(vy0 + grav * dk, vx);
      I.wash(c, px, py, dr * 2.4, dr * 1.8, 0.38 * A, sd + 130 + d, PAL.jade, angD, { edge: 'soft' });
      c.save();
      c.fillStyle = U.rgba(PAL.jadeHi, 0.94 * A);
      I.blot(c, px, py, dr, sd + 150 + d, { rough: 0.18, n: 12, sx: 1.45, sy: 0.82, rot: angD });
      c.fill();
      c.globalCompositeOperation = 'lighter';
      I.glow(c, px, py, dr * 3.6, PAL.cyanHi, 0.55 * A);
      c.restore();
    } else {
      // 滴落断龙石：绽开温润翡翠玉晕与断续碧波涟漪，升起清冽瑞气
      var hitT = cl01((py - groundY) / 140);
      var lx2 = cx + vx * Math.min(1, dk);
      var ripR = (14 + 54 * expoOut(hitT, 4)) * (0.6 + 0.6 * hd2);
      var ripA = A * (1 - 0.75 * hitT);
      I.wash(c, lx2, groundY, ripR * 0.85, ripR * 0.28, 0.45 * ripA, sd + 170 + d, PAL.jade, 0, { edge: 'wet' });
      brokenBrushLoop(c, lx2, groundY, ripR, ripR * 0.32, 0, 0.72 * ripA, sd + 190 + d, {
        segs: 3, w: 3.2, rgb: PAL.jadeHi, dry: 0.28, spin: d
      });
      if (d % 3 === 0) {
        I.wash(c, lx2, groundY - 28 * hitT, 28, 22, 0.28 * ripA, sd + 210 + d, PAL.cyanMist, 0, { edge: 'soft' });
      }
    }
  }
};

/* 14. zl.headToAsh：杨端明残首随千年光阴冲刷由暗墨肉形 → 枯白颅骨 → 万点飞灰随风消散 (k: 0..1) */
ZL.headToAsh = function (c, t, o) {
  o = o || {};
  var A = num(o.a, 1), sc = num(o.s, 1), k = cl01(num(o.k, 0)), sd = num(o.seed, 79);
  if (A <= 0.003 || k >= 0.999) return;
  var cx = num(o.x, 720), cy = num(o.y, 820);

  // 三阶段权重：fleshK 暗墨肉形(0..0.46)，boneK 枯白颅骨(0.22..0.82)，ashK 风蚀化灰(0.45..1.0)
  var fleshA = A * (1 - U.smooth((k - 0.16) / 0.34));
  var boneA = A * U.smooth((k - 0.14) / 0.24) * (1 - U.smooth((k - 0.56) / 0.34));
  var ashK = cl01((k - 0.38) / 0.62);
  var erode = cl01((k - 0.52) / 0.45); // 自迎风左侧向右侧逐寸剥蚀

  // 地面苍凉焦墨残迹（随飞灰散尽渐淡）
  scorchSeat(c, cx, cy + 16 * sc, 72 * sc * (1 - 0.6 * ashK), 24 * sc, 0.48 * A * (1 - 0.8 * erode), sd, PAL.ink, 0);

  // 阶段二：千年风化露出的枯白减笔侧颅轮廓（水墨金石气，悲怆肃穆、不作恐怖细节）
  if (boneA > 0.005) {
    var crR = 38 * sc * (1 - 0.35 * erode);
    var bx = cx + erode * 14 * sc, by = cy - 6 * sc;
    I.wash(c, bx, by, crR * 1.15, crR * 0.95, 0.78 * boneA, sd + 5, PAL.bone, -0.12, { edge: 'wet' });
    I.wash(c, bx - crR * 0.2, by - crR * 0.15, crR * 0.75, crR * 0.65, 0.65 * boneA, sd + 7, [224, 218, 204], 0, { edge: 'soft' });
    // 颅顶至颧颌古拙干笔勾勒＋空洞墨影眼窝与岁月裂纹
    var skullArc = [
      [bx - crR * 0.78, by + crR * 0.42],
      [bx - crR * 0.82, by - crR * 0.45],
      [bx + crR * 0.12, by - crR * 0.88],
      [bx + crR * 0.84, by - crR * 0.18],
      [bx + crR * 0.62, by + crR * 0.64]
    ];
    I.dry(c, skullArc, { w: 6.5 * sc, a: 0.84 * boneA, rgb: PAL.inkSoft, dry: 0.42, seed: sd + 11 });
    I.inkBlot(c, bx + crR * 0.36, by - crR * 0.04, crR * 0.24, sd + 13, { a: 0.76 * boneA, rgb: PAL.ink, sx: 1.25, sy: 0.85 });
    I.stroke(c, [[bx - crR * 0.25, by - crR * 0.68], [bx + crR * 0.05, by - crR * 0.22], [bx - crR * 0.08, by + crR * 0.15]], {
      w: 2.2 * sc, a: 0.68 * boneA, rgb: PAL.scorchDk, seed: sd + 15, head: 0.1, tail: 0.75, bleed: 0
    });
  }

  // 阶段一：暗墨蓬乱道髻残首侧影（随光阴回溯褪去血肉乱发）
  if (fleshA > 0.005) {
    var fr = 42 * sc;
    I.wash(c, cx, cy - 4 * sc, fr * 1.28, fr * 1.02, 0.64 * fleshA, sd + 21, PAL.bloodRust, -0.08, { edge: 'wet' });
    I.inkBlot(c, cx, cy - 6 * sc, fr * 0.92, sd + 23, { a: 0.92 * fleshA, rgb: PAL.ink, sx: 1.12, sy: 0.94, rough: 0.28 });
    // 散乱苍老发髻与枯发飞丝
    I.inkBlot(c, cx - fr * 0.38, cy - fr * 0.78, fr * 0.36, sd + 25, { a: 0.9 * fleshA, rgb: PAL.ink, sx: 1.3, sy: 0.85, rot: -0.4 });
    for (var h = 0; h < 7; h++) {
      var ha = -0.6 + h * 0.36;
      var hair = [
        [cx - fr * 0.2, cy - fr * 0.65],
        [cx + Math.cos(ha) * fr * 0.85, cy + Math.sin(ha) * fr * 0.65 + 8 * sc],
        [cx + Math.cos(ha) * fr * 1.35 + 10 * sc * k, cy + fr * 0.55]
      ];
      I.dry(c, hair, { w: 5.5 * sc, a: 0.78 * fleshA, rgb: PAL.ink, dry: 0.48, seed: sd + 30 + h });
    }
  }

  // 阶段三：随风崩解化作万点枯白与焦黑飞灰，卷入旋度气流消散无踪
  if (ashK > 0.004) {
    var nAsh = 68;
    for (var i = 0; i < nAsh; i++) {
      var h1 = U.hash(sd * 31 + i * 7), h2 = U.hash(sd * 31 + i * 7 + 3), h3 = U.hash(sd * 31 + i * 7 + 5);
      var releaseAt = h1 * 0.55;
      var pk = cl01((ashK - releaseAt) / (1 - releaseAt));
      if (pk <= 0 || pk >= 1) continue;

      var ox = cx + (h1 - 0.5) * 76 * sc, oy = cy - 8 * sc + (h2 - 0.5) * 64 * sc;
      var windX = (140 + 240 * h3) * sc * Math.pow(pk, 1.25);
      var windY = -(65 + 155 * h2) * sc * Math.pow(pk, 1.1) + 28 * sc * Math.sin(pk * 6 + i);
      var cf = curl2(ox + windX, oy + windY, t * 0.8, 180, sd + 60);
      var px = ox + windX + cf[0] * 36 * sc * pk;
      var py = oy + windY + cf[1] * 36 * sc * pk;
      var pa = A * Math.sin(Math.PI * pk) * (1 - 0.35 * pk);
      if (pa <= 0.005) continue;

      var aCol = i % 3 === 0 ? PAL.bone : i % 2 ? PAL.ash : PAL.inkSoft;
      var sz = (1.6 + 4.2 * h3) * sc * (1 - 0.45 * pk);
      if (i % 6 === 0) {
        I.wash(c, px, py, sz * 4.5, sz * 2.8, pa * 0.32, sd + 100 + i, aCol, pk * 2, { edge: 'soft' });
      }
      c.save();
      c.fillStyle = U.rgba(aCol, Math.min(1, pa * 0.92));
      I.blot(c, px, py, sz, sd + 140 + i, { rough: 0.34, n: 9, sx: 1.65, sy: 0.72, rot: pk * 4 + i });
      c.fill();
      c.restore();
    }
  }
};

/* 15. zl.spiderEscape：十七长足血烟魔蛛破颈冲出 → 一刀斩为两段疾遁 → 青光天罗地网兜截 → 万雷轰击符丝织成蚕茧坠渊 */
ZL.spiderEscape = function (c, t, o) {
  o = o || {};
  var A = num(o.a, 1), sc = num(o.s, 1), sd = num(o.seed, 83);
  var burstK = cl01(num(o.burstK, 0)), splitK = cl01(num(o.splitK, 0));
  var netK = cl01(num(o.netK, 0)), cocoonK = cl01(num(o.cocoonK, 0));
  if (A <= 0.003 || Math.max(burstK, splitK, netK, cocoonK) <= 0.002) return;

  var x0 = num(o.x, 960), y0 = num(o.y, 500);
  var bk = expoOut(burstK, 5);
  // 蚕茧末段打落万魔池下坠位移
  var plungeY = cocoonK > 0.72 ? expoIn((cocoonK - 0.72) / 0.28, 4) * 380 * sc : 0;
  var cx = x0, cy = y0 - 85 * sc * bk + plungeY;

  // 斜斩轴（约 -38°）：splitK 将魔蛛一刀两断向两侧仓皇逃窜，netK 天罗地网再将其兜截收拢，cocoonK 紧缩成茧
  var slashAng = -0.66;
  var sepAxis = [Math.cos(slashAng + Math.PI * 0.5), Math.sin(slashAng + Math.PI * 0.5)];
  var sepDist = (175 * expoOut(splitK, 5) * (1 - 0.72 * U.smooth(netK)) * (1 - 0.92 * U.smooth(cocoonK))) * sc;
  var shrink = 1 - 0.68 * U.smooth(cocoonK);

  scorchSeat(c, cx, cy, (220 + sepDist) * sc, 185 * sc, 0.52 * A * bk, sd, PAL.ink, 0);

  // 1 & 2. 参罗利那本命分身：黑红血烟魔核与不对称十七长足（左半 9 足、右半 8 足，三节鬼爪枯枝关节有机抽搐）
  var spiderVis = A * bk * (1 - 0.78 * U.smooth((cocoonK - 0.35) / 0.55));
  if (spiderVis > 0.01) {
    // 绘制被斜斩切开的两半魔核（splitK === 0 时重合为一团完整巨蛛）
    for (var half = 0; half < 2; half++) {
      var sgn = half === 0 ? -1 : 1;
      var hx = cx + sepAxis[0] * sgn * sepDist + (splitK > 0 ? 9 * sc * Math.sin(t * 14 + half * 3) * (1 - cocoonK) : 0);
      var hy = cy + sepAxis[1] * sgn * sepDist + (splitK > 0 ? 7 * sc * Math.cos(t * 13 + half * 2) * (1 - cocoonK) : 0);
      var coreR = (half === 0 ? 56 : 50) * sc * bk * shrink;

      // 翻涌血烟魔躯
      I.wash(c, hx, hy, coreR * 1.65, coreR * 1.35, 0.56 * spiderVis, sd + 5 + half, PAL.bloodMid, slashAng, { edge: 'wet' });
      I.inkBlot(c, hx, hy, coreR, sd + 9 + half, { a: 0.94 * spiderVis, rgb: PAL.ink, sx: 1.22, sy: 0.88, rot: slashAng, rough: 0.32 });
      // 断面喷溅的黑红魔血烟丝
      if (splitK > 0.03 && cocoonK < 0.6) {
        I.dry(c, [[hx, hy], [cx, cy]], { w: 18 * sc * shrink, a: 0.65 * spiderVis * (1 - cocoonK), rgb: PAL.bloodHi, dry: 0.55, seed: sd + 15 + half });
      }
    }

    // 严格 17 条不对称三节修长魔足（编号 0..8 归左上半 9 足，9..16 归右下半 8 足）
    for (var lg = 0; lg < 17; lg++) {
      var isLeft = lg < 9;
      var sgnL = isLeft ? -1 : 1;
      var localIdx = isLeft ? lg : (lg - 9);
      var localCnt = isLeft ? 9 : 8;
      var hl1 = U.hash(sd * 23 + lg * 7), hl2 = U.hash(sd * 23 + lg * 7 + 3);

      var rootX = cx + sepAxis[0] * sgnL * sepDist;
      var rootY = cy + sepAxis[1] * sgnL * sepDist;

      // 扇面分布＋不对称鬼爪曲折三节运动学（基节上扬 → 胫节外折 → 跗节如镰刀下钩高频抓挠）
      var fanU = (localIdx / Math.max(1, localCnt - 1)) - 0.5;
      var baseTheta = (isLeft ? Math.PI : 0) + fanU * 2.05 + (hl1 - 0.5) * 0.22;
      var twitchSpd = 6.5 + 5.5 * hl2 + 8 * splitK;
      var twitch = (0.18 + 0.22 * splitK) * Math.sin(t * twitchSpd + lg * 1.37) * (1 - 0.8 * cocoonK);

      var len1 = (72 + 44 * hl1) * sc * bk * shrink;
      var len2 = (86 + 52 * hl2) * sc * bk * shrink;
      var len3 = (64 + 38 * hl1) * sc * bk * shrink;

      var a1 = baseTheta - sgnL * (0.48 + 0.2 * fanU) + twitch;
      var k1x = rootX + Math.cos(a1) * len1, k1y = rootY + Math.sin(a1) * len1;
      var a2 = a1 + sgnL * (0.86 + 0.25 * hl2) - twitch * 1.25;
      var k2x = k1x + Math.cos(a2) * len2, k2y = k1y + Math.sin(a2) * len2;
      var a3 = a2 + sgnL * (0.62 + 0.2 * hl1) + twitch * 0.9;
      var tipX = k2x + Math.cos(a3) * len3, tipY = k2y + Math.sin(a3) * len3;

      var legPts = [[rootX, rootY], [k1x, k1y], [k2x, k2y], [tipX, tipY]];
      I.stroke(c, legPts, {
        raw: true, n: 22, w: (11.5 - 2.5 * hl1) * sc * shrink, a: 0.92 * spiderVis,
        rgb: PAL.ink, seed: sd + 30 + lg, head: 0.06, tail: 0.78, wob: 0.22, fb: 0.22
      });
      I.dry(c, [legPts[1], legPts[2], legPts[3]], {
        raw: true, n: 16, w: 6.5 * sc * shrink, a: 0.72 * spiderVis,
        rgb: lg % 3 === 0 ? PAL.bloodHi : PAL.bloodMid, dry: 0.52, seed: sd + 60 + lg
      });
    }

    // 9 枚诡异不对称凶睛（冷瞥余慈：外渗幽绿、内燃朱砂赤芒）
    for (var ey = 0; ey < 9; ey++) {
      var ehSide = ey < 5 ? -1 : 1;
      var exOff = ((ey % 5) - 2) * 14 * sc * shrink;
      var eyOff = ((ey * 7 % 5) - 2) * 10 * sc * shrink - 8 * sc;
      var eyeX = cx + sepAxis[0] * ehSide * sepDist + exOff;
      var eyeY = cy + sepAxis[1] * ehSide * sepDist + eyOff;
      var eSz = (3.2 + 2.8 * (ey % 3)) * sc * shrink;
      c.save();
      c.fillStyle = U.rgba(ey % 2 ? PAL.bloodHi : PAL.jadeHi, 0.95 * spiderVis);
      I.blot(c, eyeX, eyeY, eSz, sd + 100 + ey, { rough: 0.18, sx: 1.7, sy: 0.58, rot: slashAng + (ey - 4) * 0.15 });
      c.fill();
      c.globalCompositeOperation = 'lighter';
      I.glow(c, eyeX, eyeY, eSz * 3.8, PAL.bloodHi, 0.55 * spiderVis);
      c.restore();
    }
  }

  // 一刀两断瞬间寒芒刀痕（splitK 初段凌厉金青刀光斜劈而过）
  if (splitK > 0.01 && splitK < 0.82) {
    var sLen = 340 * sc;
    ZL.slashImpact(c, splitK, 0.02, {
      x0: cx - Math.cos(slashAng) * sLen, y0: cy - Math.sin(slashAng) * sLen,
      x1: cx + Math.cos(slashAng) * sLen, y1: cy + Math.sin(slashAng) * sLen,
      kind: 'gold', w: 46 * sc, dur: 0.14, a: A * (1 - U.ramp(splitK, 0.35, 0.82)), seed: sd + 120
    });
  }

  // 3. 青光天罗地网兜截（netK > 0：漫天湖玉青色符文绶带交织成菱形大网，兜头罩住两半魔蛛）
  if (netK > 0.005) {
    var nk = expoOut(netK, 5);
    var netR = (340 * (1 - 0.48 * U.smooth(cocoonK))) * sc;
    var netA = A * nk * (1 - 0.55 * U.smooth((cocoonK - 0.55) / 0.45));

    if (netA > 0.01) {
      for (var dirIdx = 0; dirIdx < 2; dirIdx++) {
        var nAng = (dirIdx === 0 ? 0.58 : -0.58);
        var cux = Math.cos(nAng), cuy = Math.sin(nAng), cnx = -cuy, cny = cux;
        for (var ln = -3; ln <= 3; ln++) {
          var off = ln * (netR * 0.28);
          var spanL = Math.sqrt(Math.max(0.05, 1 - Math.pow(ln / 3.6, 2))) * netR;
          var rPts = [];
          for (var s = 0; s <= 12; s++) {
            var u = (s / 12) * 2 - 1;
            var domePull = (1 - u * u) * 22 * sc * nk; // 兜网弧度
            rPts.push([
              cx + cnx * off + cux * u * spanL,
              cy + cny * off + cuy * u * spanL - domePull
            ]);
          }
          I.stroke(c, rPts, { raw: true, n: 22, k: nk, w: 6.5 * sc, a: 0.28 * netA, rgb: PAL.scorchDk, mode: 'multiply', seed: sd + 140 + ln, bleed: 0 });
          I.sweep(c, rPts, { raw: true, n: 22, k: nk, w: 4.8 * sc, a: 0.72 * netA, rgb: PAL.cyan, dry: 0.28, seed: sd + 150 + dirIdx * 10 + ln, head: 0.1, tail: 0.1 });
          c.save();
          c.globalCompositeOperation = 'lighter';
          I.stroke(c, rPts, { raw: true, n: 22, k: nk, w: 1.8 * sc, a: 0.76 * netA, rgb: PAL.cyanHi, seed: sd + 170 + dirIdx * 10 + ln, head: 0.1, tail: 0.1, bleed: 0 });
          c.restore();
        }
      }
      // 菱网交点镇魔青金符节
      for (var nd = 0; nd < 9; nd++) {
        var na = (nd / 9) * TAU + t * 0.4;
        var nr = netR * (0.35 + 0.35 * (nd % 2));
        drawStamp(c, stampTadpoleRune(nd, PAL.cyanHi), cx + Math.cos(na) * nr, cy + Math.sin(na) * nr * 0.72, 26 * sc, 26 * sc, na, 0.78 * netA, 'lighter', false);
      }
    }
  }

  // 4. 万仙道法雷霆如暴雨轰击＋符文金丝层层缠成蚕茧（cocoonK > 0）
  if (cocoonK > 0.005) {
    var ck = cl01(cocoonK);
    // 8 道曲折分叉的金青道境神雷自四方云海劈落茧心
    var boltEnv = A * Math.sin(Math.PI * cl01(ck * 1.12));
    if (boltEnv > 0.02) {
      var nBolts = 8;
      for (var b = 0; b < nBolts; b++) {
        var bPulse = U.fract(t * (3.4 + (b % 3) * 0.9) + b * 0.37);
        if (bPulse > 0.58) continue; // 雷光急促交替炸闪
        var ba = -Math.PI * 0.5 + ((b / (nBolts - 1)) - 0.5) * 2.35 + 0.15 * U.noise1(t * 6 + b, sd);
        var bDist = (380 + 140 * (b % 2)) * sc;
        var sx = cx + Math.cos(ba) * bDist, sy = cy + Math.sin(ba) * bDist - 120 * sc;
        var bolt = [[sx, sy]];
        var segN = 8;
        for (var q = 1; q < segN; q++) {
          var qu = q / segN;
          var jag = (U.noise1(q * 3.7 + Math.floor(t * 18) + b * 11, sd + b) ) * 46 * sc;
          bolt.push([U.lerp(sx, cx, qu) - Math.sin(ba) * jag, U.lerp(sy, cy, qu) + Math.cos(ba) * jag]);
        }
        bolt.push([cx + (b % 2 ? 12 : -12) * sc, cy]);
        var bAlpha = boltEnv * (1 - bPulse / 0.58);
        var bCol = b % 2 ? PAL.goldHi : PAL.cyanHi;
        I.stroke(c, bolt, { raw: true, n: 24, w: 12 * sc, a: 0.35 * bAlpha, rgb: PAL.scorchDk, mode: 'multiply', seed: sd + 200 + b, bleed: 0 });
        c.save();
        c.globalCompositeOperation = 'lighter';
        I.stroke(c, bolt, { raw: true, n: 24, w: 7.5 * sc, a: 0.48 * bAlpha, rgb: b % 2 ? PAL.gold : PAL.cyan, seed: sd + 210 + b, head: 0.05, tail: 0.05, bleed: 0 });
        I.stroke(c, bolt, { raw: true, n: 24, w: 2.6 * sc, a: 0.95 * bAlpha, rgb: [250, 248, 236], seed: sd + 220 + b, head: 0.05, tail: 0.05, bleed: 0 });
        // 雷枝分叉
        var fkP = bolt[4];
        I.stroke(c, [fkP, [fkP[0] + (b % 2 ? 52 : -52) * sc, fkP[1] + 44 * sc]], { raw: true, n: 8, w: 1.8 * sc, a: 0.78 * bAlpha, rgb: bCol, seed: sd + 230 + b, bleed: 0 });
        I.glow(c, cx, cy, 135 * sc, bCol, 0.32 * bAlpha);
        c.restore();
      }
    }

    // 层层符文金青丝线紧密缠绕成的镇魔蚕茧本体
    var wrapK = expoOut(ck, 4);
    var cocRx = 58 * sc * (0.55 + 0.45 * wrapK), cocRy = 94 * sc * (0.55 + 0.45 * wrapK);
    var throb = 1 + 0.045 * Math.sin(t * 9.5) * (1 - 0.5 * ck); // 茧内凶魔残余挣扎脉动
    c.save();
    c.translate(cx, cy);
    c.rotate(0.18 + 0.06 * Math.sin(t * 4.2));
    c.scale(throb, 2 - throb);

    I.wash(c, 0, 0, cocRx * 1.15, cocRy * 1.12, 0.82 * A * wrapK, sd + 250, PAL.ink, 0, { edge: 'wet' });
    I.wash(c, 0, 0, cocRx * 0.92, cocRy * 0.92, 0.65 * A * wrapK, sd + 252, mix3(PAL.goldBronze, PAL.cyan, 0.45), 0, { edge: 'soft' });

    // 18 圈斜交缠裹的发光符丝
    var nThreads = Math.round(18 * wrapK);
    for (var th = 0; th < nThreads; th++) {
      var v = (th / 17) * 2 - 1; // -1 茧顶 .. +1 茧底
      var ringW = cocRx * Math.sqrt(Math.max(0.06, 1 - v * v * 0.86));
      var wy = v * cocRy * 0.9;
      var tiltY = (th % 2 ? 1 : -1) * 14 * sc;
      var silk = [[-ringW, wy - tiltY], [0, wy + tiltY * 0.45], [ringW, wy + tiltY]];
      var tCol = th % 3 === 0 ? PAL.cyanHi : PAL.goldHi;
      I.stroke(c, silk, { raw: true, n: 16, w: 4.6 * sc, a: 0.86 * A * wrapK, rgb: th % 2 ? PAL.gold : PAL.cyan, seed: sd + 260 + th, head: 0.15, tail: 0.15, bleed: 0 });
      c.save();
      c.globalCompositeOperation = 'lighter';
      I.stroke(c, silk, { raw: true, n: 16, w: 1.8 * sc, a: 0.72 * A * wrapK, rgb: tCol, seed: sd + 280 + th, head: 0.2, tail: 0.2, bleed: 0 });
      c.restore();
    }
    // 茧表镇封金篆
    drawStamp(c, stampTadpoleRune(3, PAL.goldHi), 0, -cocRy * 0.28, 34 * sc, 34 * sc, 0, 0.88 * A * wrapK, 'lighter', false);
    drawStamp(c, stampTadpoleRune(8, PAL.cyanHi), 0, cocRy * 0.28, 34 * sc, 34 * sc, 0, 0.88 * A * wrapK, 'lighter', false);
    c.restore();
  }
};

/* 16. zl.rainbowBridge：地上翡翠碧血摄回掌心弹指蒸腾，化作横跨茫茫云海的虚淡翡翠水墨虹桥 */
ZL.rainbowBridge = function (c, t, o) {
  o = o || {};
  var A = num(o.a, 1), k = cl01(num(o.k, 1)), dropK = cl01(num(o.dropletsK, 0)), sd = num(o.seed, 89);
  if (A * Math.max(k, dropK) <= 0.003) return;

  var x0 = num(o.x0, 380), y0 = num(o.y0, 760), x1 = num(o.x1, 1560), y1 = num(o.y1, 300);
  var dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
  var nx = -dy / L, ny = dx / L;

  // 1. dropletsK > 0：石上翡翠碧血珠被摄起升入掌心，弹指蒸腾为清润碧雾
  if (dropK > 0.004) {
    var dk = cl01(dropK);
    var vaporK = cl01((dk - 0.55) / 0.45);
    scorchSeat(c, x0, y0 + 45 * (1 - dk), 95, 75, 0.34 * A * Math.sin(Math.PI * dk), sd, PAL.scorch, 0);
    for (var d = 0; d < 20; d++) {
      var hd1 = U.hash(sd * 17 + d * 5), hd2 = U.hash(sd * 17 + d * 5 + 2);
      var gx = x0 + (hd1 - 0.5) * 180, gy = y0 + 95 + hd2 * 45;
      var riseU = expoOut(cl01((dk - hd1 * 0.28) / 0.72), 4);
      if (riseU <= 0) continue;
      var spiral = (1 - riseU) * 34 * Math.sin(riseU * 8 + d + t * 3);
      var px = U.lerp(gx, x0, riseU) + spiral;
      var py = U.lerp(gy, y0, riseU) - Math.sin(Math.PI * riseU) * 28;
      var dAlpha = A * (1 - 0.85 * vaporK);
      if (dAlpha > 0.01) {
        c.save();
        c.fillStyle = U.rgba(d % 2 ? PAL.jadeHi : PAL.jade, 0.9 * dAlpha);
        I.blot(c, px, py, (3.2 + 3.6 * hd2) * (1 - 0.5 * vaporK), sd + 20 + d, { rough: 0.2, sx: 0.9, sy: 1.35 });
        c.fill();
        c.globalCompositeOperation = 'lighter';
        I.glow(c, px, py, 16, PAL.cyanHi, 0.45 * dAlpha);
        c.restore();
      }
    }
    if (vaporK > 0.02) {
      var vA = A * Math.sin(Math.PI * cl01(vaporK * 0.95));
      for (var v = 0; v < 6; v++) {
        I.wash(c, x0 + (v - 2.5) * 26, y0 - v * 18 * vaporK, 54 + 42 * vaporK, 32 + 24 * vaporK, 0.38 * vA, sd + 50 + v, v % 2 ? PAL.jadeHi : PAL.cyanMist, -0.2, { edge: 'soft' });
      }
    }
  }

  // 2. 虚淡翡翠水墨虹桥横跨苍茫云海（随 k 由起端向远空舒展成形）
  if (k > 0.004) {
    var gk = M.grow ? M.grow(k, 0, 1) : expoOut(k, 4);
    var archH = Math.min(220, L * 0.19);
    // 仰拱索桥脊线采样
    var N = 36, spine = [];
    for (var i = 0; i <= N; i++) {
      var u = i / N;
      // 远端透视收窄微曲
      var arch = -Math.sin(Math.PI * Math.pow(u, 0.88)) * archH;
      var breath = 4.5 * Math.sin(u * 5 - t * 1.1) * Math.sin(Math.PI * u);
      spine.push([x0 + dx * u + nx * (arch * 0.28), y0 + dy * u - Math.abs(arch) + breath]);
    }

    // 浅云底衬托焦墨柔影（使半透翡翠虹桥不飘不白，立于云海之上）
    I.sweep(c, spine, {
      raw: true, n: 40, k: gk, w: 68, a: 0.26 * A, rgb: PAL.scorch, mode: 'multiply', dry: 0.45, seed: sd + 70,
      wf: function (s) { return (1 - 0.52 * s) * Math.pow(Math.sin(Math.PI * Math.min(0.96, 0.08 + s * 0.88)), 0.35); }
    });

    // 五层没骨水墨与飞白交融的翡翠碧玉桥身（远端渐敛入云霭）
    var ribbons = [
      { off: 12, w: 52, col: PAL.abyssGreen, a: 0.34, dry: 0.48, mode: null },
      { off: 2,  w: 38, col: PAL.jade,       a: 0.46, dry: 0.36, mode: null },
      { off: -5, w: 24, col: PAL.cyan,       a: 0.42, dry: 0.42, mode: null },
      { off: -9, w: 14, col: PAL.jadeHi,     a: 0.48, dry: 0.32, mode: 'lighter' },
      { off: -12, w: 5, col: PAL.goldHi,     a: 0.36, dry: 0.55, mode: 'lighter' }
    ];
    for (var r = 0; r < ribbons.length; r++) {
      var rb = ribbons[r], rPts = [];
      for (var j = 0; j <= N; j++) {
        var uj = j / N, persp = 1 - 0.52 * uj;
        rPts.push([spine[j][0], spine[j][1] + rb.off * persp]);
      }
      I.sweep(c, rPts, {
        raw: true, n: 42, k: gk, w: rb.w, a: rb.a * A, rgb: rb.col, dry: rb.dry, mode: rb.mode, seed: sd + 80 + r,
        wf: function (s) { return (1 - 0.54 * s) * (0.4 + 0.6 * Math.sin(Math.PI * Math.min(0.95, 0.12 + s * 0.82))); }
      });
    }

    // 桥缘袅袅逸散的翡翠灵尘与云雾托脚
    var maxIdx = Math.max(1, Math.floor(N * gk));
    for (var m = 0; m <= 8; m++) {
      var mu = (m / 8) * gk, mi = Math.min(N, Math.round(mu * N));
      var mp = spine[mi];
      I.wash(c, mp[0], mp[1] + 18 * (1 - 0.5 * mu), 65 * (1 - 0.4 * mu), 24 * (1 - 0.4 * mu), 0.22 * A * Math.sin(Math.PI * (m + 0.5) / 9), sd + 110 + m, PAL.cyanMist, 0, { edge: 'soft' });
    }
    for (var sp = 0; sp < 26; sp++) {
      var hsp = U.hash(sd * 29 + sp * 7);
      var su = U.fract(hsp + t * 0.045) * gk;
      var si = Math.min(maxIdx, Math.floor(su * N));
      var bp = spine[si];
      var lift = U.fract(t * (0.28 + 0.2 * hsp) + sp * 0.31);
      var sx2 = bp[0] + (U.hash(sd + sp * 11) - 0.5) * 34;
      var sy2 = bp[1] - lift * 42 * (1 - 0.45 * su);
      var sa2 = A * Math.sin(Math.PI * lift) * (1 - 0.4 * su) * 0.72;
      if (sa2 <= 0.01) continue;
      c.save();
      c.globalCompositeOperation = 'lighter';
      I.glow(c, sx2, sy2, 9 * (1 - 0.4 * su), sp % 3 === 0 ? PAL.goldHi : PAL.jadeHi, sa2);
      c.restore();
    }
  }
};

/* 17. zl.starEmbryo：中天紫微「三垣四象」球形星辰胚胎＋外围散星长河缓慢公转＋四御道韵烙印(seatsK)＋地仙遗蜕镇压千钧巨磨滞涩感(heavyK) */
ZL.starEmbryo = function (c, t, o) {
  o = o || {};
  var A = num(o.a, 1), sc = num(o.s, 1), sd = num(o.seed, 97);
  if (A <= 0.003) return;
  var cx = num(o.x, 960), cy = num(o.y, 460);
  var seatsK = cl01(num(o.seatsK, 0)), heavyK = cl01(num(o.heavyK, 0));

  // heavyK > 0 时：星盘如压两具地仙遗蜕的千钧巨磨，转速骤沉并带滞涩咬合颤动（纯 t 函数，无跨帧状态）
  var baseRate = U.lerp(0.16, 0.038, heavyK);
  var grindJudder = heavyK * 0.022 * (Math.sin(t * 2.4) + 0.35 * Math.sin(t * 7.2));
  var rot = t * baseRate + grindJudder;
  var sagY = heavyK * 22 * sc; // 沉重下坠压迫感
  var ex = cx, ey = cy + sagY;

  var R = 168 * sc;          // 中央三垣四象球形胚胎半径
  var galRx = 540 * sc;      // 外围浩瀚散星长河长轴
  var galRy = 195 * sc;      // 星河透视短轴
  var galTilt = -0.21;       // 星河倾角

  // 幽邃磁青玄墨天穹底晕
  scorchSeat(c, ex, ey, galRx * 1.08, (R + 120 * sc) * 1.25, 0.62 * A, sd, PAL.starBg, galTilt);

  // 外围散星长河绘制助手：half === -1 画远端后半环（在胚胎之后），half === 1 画近端前半环（遮挡在胚胎之前，营造真实立体景深）
  function drawStarRiverHalf(half) {
    c.save();
    c.translate(ex, ey);
    c.rotate(galTilt);

    // 星云水墨雾带弧
    var nebPts = [];
    var aStart = half < 0 ? Math.PI : 0, aEnd = half < 0 ? TAU : Math.PI;
    for (var q = 0; q <= 20; q++) {
      var qa = U.lerp(aStart, aEnd, q / 20);
      nebPts.push([Math.cos(qa) * galRx * 0.86, Math.sin(qa) * galRy * 0.86]);
    }
    I.sweep(c, nebPts, { raw: true, n: 28, w: 68 * sc, a: 0.24 * A, rgb: PAL.violet, dry: 0.48, seed: sd + (half < 0 ? 5 : 6), head: 0.08, tail: 0.08 });
    I.dry(c, nebPts, { raw: true, n: 28, w: 32 * sc, a: 0.26 * A, rgb: PAL.stoneCyan, dry: 0.56, seed: sd + (half < 0 ? 7 : 8) });

    // 150 颗散星长河星辰（泥金、苍玉、银白星砾沿椭圆轨道缓慢公转）
    var nStars = 150;
    for (var i = 0; i < nStars; i++) {
      var h1 = U.hash(sd * 23 + i * 7), h2 = U.hash(sd * 23 + i * 7 + 3), h3 = U.hash(sd * 23 + i * 7 + 5);
      var theta = U.fract(h1 + (rot * (0.65 + 0.55 * h2)) / TAU) * TAU;
      var inFront = Math.sin(theta) >= 0;
      if ((half > 0) !== inFront) continue;

      var radMul = 0.56 + 0.56 * h2 + 0.08 * Math.sin(theta * 3 + i);
      var sx = Math.cos(theta) * galRx * radMul;
      var sy = Math.sin(theta) * galRy * radMul + (h3 - 0.5) * 34 * sc;
      var depthScale = 0.72 + 0.42 * (Math.sin(theta) * 0.5 + 0.5);
      var twinkle = 0.58 + 0.42 * Math.sin(t * (1.8 + 2.4 * h3) + i * 1.9);
      var sCol = i % 5 === 0 ? PAL.goldHi : i % 3 === 0 ? PAL.cyanHi : PAL.bone;
      var sz = (1.4 + 3.2 * Math.pow(h3, 1.8)) * sc * depthScale;
      var sa = A * twinkle * (half < 0 ? 0.62 : 0.92);

      // heavyK > 0 时：星辰拖出滞涩沉重的暗金残迹
      if (heavyK > 0.05 && i % 3 === 0) {
        var lagA = theta - 0.09 * heavyK;
        I.stroke(c, [[Math.cos(lagA) * galRx * radMul, Math.sin(lagA) * galRy * radMul + (h3 - 0.5) * 34 * sc], [sx, sy]], {
          raw: true, w: sz * 0.9, a: 0.38 * sa * heavyK, rgb: PAL.goldBronze, seed: sd + 30 + i, bleed: 0
        });
      }

      c.fillStyle = U.rgba(sCol, Math.min(1, sa));
      I.blot(c, sx, sy, sz, sd + 100 + i, { rough: 0.22, n: 8, sx: 1.25, sy: 0.9, rot: theta });
      c.fill();
      if (h3 > 0.78) {
        c.save();
        c.globalCompositeOperation = 'lighter';
        I.glow(c, sx, sy, sz * 4.2, sCol, sa * 0.42);
        c.restore();
      }
    }
    c.restore();
  }

  // 先绘后半圈星河
  drawStarRiverHalf(-1);

  // 2. 中央「三垣四象」球形星辰胚胎（混沌星云胎盘＋三垣立体泥金经纬环＋四象二十八宿星官连线）
  c.save();
  c.translate(ex, ey);
  I.wash(c, 0, 0, R * 1.08, R * 1.05, 0.84 * A, sd + 260, PAL.starBg, 0, { edge: 'wet' });
  I.wash(c, -R * 0.16, -R * 0.12, R * 0.82, R * 0.78, 0.56 * A, sd + 262, PAL.violetDk, 0.3, { edge: 'soft' });
  I.wash(c, R * 0.14, R * 0.16, R * 0.68, R * 0.64, 0.44 * A, sd + 264, PAL.stoneCyan, -0.4, { edge: 'soft' });

  // 三垣（紫微垣、太微垣、天市垣）：三道不同倾角的立体球面飞白泥金/石青垣墙环
  var enclosures = [
    { tilt: 0.32,  flat: 0.42, col: PAL.gold,   sp: 1.0  },
    { tilt: -0.68, flat: 0.48, col: PAL.cyanHi, sp: -0.75 },
    { tilt: 1.18,  flat: 0.38, col: PAL.violetHi, sp: 0.6 }
  ];
  for (var en = 0; en < enclosures.length; en++) {
    var E = enclosures[en];
    brokenBrushLoop(c, 0, 0, R * (0.94 - en * 0.08), R * (0.94 - en * 0.08) * E.flat, E.tilt, 0.72 * A, sd + 270 + en * 7, {
      segs: 4, w: 6.5 * sc, rgb: E.col, dry: 0.38, spin: rot * 1.8 * E.sp
    });
  }

  // 四象星宿图腾（东方苍龙青、西方白虎银、南方朱雀丹、北方玄武墨金）在球胎表面流转
  var beasts = [
    { col: PAL.jadeHi,  ang: 0,             pts: [[-0.55, -0.15], [-0.25, -0.32], [0.1, -0.18], [0.42, -0.35], [0.62, -0.1]] },
    { col: PAL.bone,    ang: Math.PI * 0.5, pts: [[-0.48, 0.12], [-0.15, -0.08], [0.22, -0.05], [0.48, 0.18]] },
    { col: PAL.bloodHi, ang: Math.PI,       pts: [[-0.52, 0.05], [0, -0.28], [0.52, 0.08], [0.05, 0.34]] },
    { col: PAL.gold,    ang: Math.PI * 1.5, pts: [[-0.38, 0.22], [-0.12, 0.04], [0.18, 0.06], [0.36, 0.26], [0, 0.38]] }
  ];
  for (var bs = 0; bs < beasts.length; bs++) {
    var B = beasts[bs], bPhi = B.ang + rot * 1.35;
    // 球面经度投影：正面清晰、背面隐淡
    var cosZ = Math.cos(bPhi);
    var vis = 0.28 + 0.72 * cl01(cosZ * 0.5 + 0.5);
    var bScreen = [];
    for (var bp = 0; bp < B.pts.length; bp++) {
      var lon = bPhi + B.pts[bp][0] * 0.85, lat = B.pts[bp][1] * 1.25;
      var px = Math.sin(lon) * Math.cos(lat) * R * 0.78;
      var py = Math.sin(lat) * R * 0.78;
      bScreen.push([px, py]);
    }
    I.stroke(c, bScreen, { raw: true, n: 18, w: 2.2 * sc, a: 0.62 * A * vis, rgb: B.col, seed: sd + 300 + bs, head: 0.1, tail: 0.1, bleed: 0 });
    for (var st = 0; st < bScreen.length; st++) {
      var spP = bScreen[st];
      c.fillStyle = U.rgba(PAL.goldHi, 0.9 * A * vis);
      I.blot(c, spP[0], spP[1], 3.2 * sc, sd + 320 + bs * 8 + st, { rough: 0.2 });
      c.fill();
      c.save();
      c.globalCompositeOperation = 'lighter';
      I.glow(c, spP[0], spP[1], 12 * sc, B.col, 0.48 * A * vis);
      c.restore();
    }
  }

  // 球胎外缘温润泥金灵晕勾边（分段枯湿笔，绝非正圆）
  brokenBrushLoop(c, 0, 0, R, R * 0.98, 0, 0.76 * A, sd + 360, {
    segs: 5, w: 8 * sc, rgb: PAL.goldBronze, dry: 0.44, spin: -rot * 0.5
  });
  c.save();
  c.globalCompositeOperation = 'lighter';
  I.glow(c, 0, 0, R * 1.18, PAL.violetHi, 0.24 * A);
  c.restore();
  c.restore();

  // 再绘前半圈散星长河（横跨星胎前方，立住浩瀚纵深）
  drawStarRiverHalf(1);

  // 3. seatsK > 0：依次点亮紫微（北极顶）、玉皇（东尊）、勾陈（西武）、后土（南坤）无常四御道韵烙印
  if (seatsK > 0.004) {
    var seats = [
      { x: ex,               y: ey - R * 1.28, col: PAL.violetHi, hi: PAL.goldHi, rune: 0, heavy: 0 },   // 中天紫微北极太皇大帝
      { x: ex + R * 1.52,    y: ey - R * 0.24, col: PAL.gold,     hi: PAL.cyanHi, rune: 4, heavy: 0 },   // 昊天金阙玉皇大帝
      { x: ex - R * 1.48,    y: ey + R * 0.28, col: PAL.redGold,  hi: PAL.goldHi, rune: 7, heavy: 1 },   // 勾陈上宫天皇大帝（地仙遗蜕镇压）
      { x: ex + R * 0.12,    y: ey + R * 1.24, col: PAL.goldBronze, hi: PAL.bone, rune: 10, heavy: 1 }   // 承天效法后土皇地祇（地仙遗蜕镇压）
    ];
    for (var sIdx = 0; sIdx < 4; sIdx++) {
      var sk = expoOut(cl01((seatsK * 1.35 - sIdx * 0.14)), 4);
      if (sk <= 0.01) continue;
      var S = seats[sIdx];
      // heavyK 升高时：勾陈、后土两尊帝座因清净散人纳入两具地仙遗蜕而沉重下坠、缠绕灰黑焦骨镇封墨链！
      var weighY = S.heavy ? heavyK * 28 * sc : 0;
      var sx0 = S.x, sy0 = S.y + weighY;

      scorchSeat(c, sx0, sy0, 68 * sc * sk, 46 * sc * sk, 0.48 * A * sk, sd + 400 + sIdx, PAL.ink, 0);
      // 帝座与中央胚胎的法则气脉牵引线
      var tether = [[ex, ey], [(ex + sx0) * 0.5, (ey + sy0) * 0.5 + weighY * 0.5], [sx0, sy0]];
      I.stroke(c, tether, {
        w: (S.heavy && heavyK > 0.1 ? 5.5 : 2.8) * sc, a: 0.45 * A * sk,
        rgb: S.heavy && heavyK > 0.2 ? mix3(S.col, PAL.ash, heavyK * 0.6) : S.col,
        seed: sd + 410 + sIdx, head: 0.15, tail: 0.15, bleed: 0
      });

      brokenBrushLoop(c, sx0, sy0, 46 * sc * sk, 28 * sc * sk, 0, 0.76 * A * sk, sd + 420 + sIdx, {
        segs: 3, w: 5 * sc, rgb: S.col, dry: 0.35, spin: (sIdx % 2 ? -1 : 1) * rot * 2.2
      });
      drawStamp(c, stampTadpoleRune(S.rune, S.hi), sx0, sy0, 44 * sc * sk, 44 * sc * sk, 0, 0.92 * A * sk, null, false);
      drawStamp(c, stampTadpoleRune(S.rune, S.hi), sx0, sy0, 46 * sc * sk, 46 * sc * sk, 0, 0.52 * A * sk * (1 - 0.4 * S.heavy * heavyK), 'lighter', false);

      if (S.heavy && heavyK > 0.04) {
        // 遗蜕镇压之重：灰黑沉滞墨霭与牵引磨盘般的吃力暗纹向深渊下垂
        I.wash(c, sx0, sy0 + 24 * sc * heavyK, 62 * sc, 42 * sc * heavyK, 0.58 * A * heavyK, sd + 440 + sIdx, PAL.ink, 0, { edge: 'wet' });
        I.dry(c, [[sx0 - 38 * sc, sy0 + 8 * sc], [sx0, sy0 + 36 * sc * heavyK], [sx0 + 38 * sc, sy0 + 8 * sc]], {
          w: 9 * sc, a: 0.68 * A * heavyK, rgb: PAL.ash, dry: 0.52, seed: sd + 450 + sIdx
        });
      }
    }
  }
};

})();
