/* 《万古云霄》lib-fx.js —— 本片专用笔墨特效（BRIEF §6、§8、§10、§12 盘点补齐）。全部是 t 的纯函数（U.hash/U.noise 种子随机），
   画在调用方当前变换里（镜头由调用方套；I.flash 例外，画屏幕坐标）。颜色严格按 §8 色彩纪律：
     青 #5FA8B5 神意/念头那一点 | 湛然清光 #CFEDEA 灵明与符 | 龙气金 #C9A646 | 白金 #F6EBC8 高转 |
     三阳劫 青 #3E8A9A 白 #F3EEDF 红 #D2462A | 血红 #8E1B12 | 浊黄灰 #6F6A4E、无岸眼 #7A2418 | 朱砂 #C23B22 只作熔岩点染。
   大面积效果（ring sunfire bloodTide turbid strata realm plateFlow mistBand inkSplash flyWhite）由手绘 fx 素材驱动、程序只做运动（I.flow）；mind/spineLight/snap/flash 为小件程序笔墨。
   工具：ring/ringPlan/rings 圆转光环 · mind 灰雾+龙气+青点（念头包）· spineLight 剑脊清光灵明 · sunfire 三阳劫火 · bloodTide 血潮 ·
         turbid 浊浪 · strata 地层（滚动/分层墨块遮罩揭示）· realm 界域墨迹边界 · snap 细线绷断 · flash 白闪。 */
(function () {
'use strict';
var CINE = window.CINE, I = CINE.ink, U = CINE.util, W = CINE.W, H = CINE.H;
var COL = CINE.FX = {
  qing: [95, 168, 181], clear: [207, 237, 234], dragon: [201, 166, 70], baijin: [246, 235, 200],
  sunQ: [62, 138, 154], sunW: [243, 238, 223], sunR: [210, 70, 42], blood: [142, 27, 18], bloodDk: [64, 12, 9],
  turbid: [111, 106, 78], lantern: [122, 36, 24], cinnabar: [194, 59, 34], bronze: [77, 90, 74], wither: [170, 146, 84], mist: [150, 144, 134]
};
var TAU = Math.PI * 2;
function lerp3(a, b, k) { return [U.lerp(a[0], b[0], k), U.lerp(a[1], b[1], k), U.lerp(a[2], b[2], k)]; }
/* 浅纸底垫底（10-14 增）：lighter 加色光在宣纸底（≈239,231,213）上几乎加不上去。光效传 o.paleBg（true=1 或 0..1 强度）或 o.scorch（垫色 rgb，传了即开），
   就在光下先用 multiply 垫一层淡焦墨暖晕（缺省 SCORCH），把底压暗到 ~170 再加光，光才读得出。缺省关闭，深底画面不受影响。 */
var SCORCH = [86, 60, 38];
function paleK(o) { return o.paleBg === true ? 1 : o.paleBg ? U.clamp(+o.paleBg, 0, 1.5) : o.scorch ? 1 : 0; }
function scorchGlow(c, x, y, r, a, o) { if (a > .003) I.glow(c, x, y, r, o.scorch || SCORCH, a, 'multiply'); }

/* ======== 以下五种大面积效果由手绘 fx 素材驱动，程序只做运动（I.flow，见 lib-flow.js）；素材名查找与替身见 I.fxTex / CINE.FX_STANDIN ======== */
function aspectOf(T) {                                       // 素材取样框的宽高比
  if (T.src) return T.src[2] / T.src[3];
  var im = I.plateImg(T.id); return im ? im.naturalWidth / im.naturalHeight : 16 / 9;
}
function tex(name, o) { return o && o.tex ? (typeof o.tex === 'string' ? { id: o.tex } : o.tex) : I.fxTex(name); }

/* ---------- 圆转光环 I.ring(c, t, o)（BRIEF §6） ----------
   素材 fx-ring-brush*（手绘一圈飞白笔环）：压成透视扁椭圆、在环面内自转、染色（青 / 白金 / 素白）、按扇形逐段写出，随后上浮、放大、淡去。
   替身（素材未到）：把一段笔触带（CINE.FX_STANDIN['ring-brush']）沿椭圆弯成一圈；本片替身为空，缺素材时静默跳过。
   o: t0, x,y 起点圆心, r 横半径（220）, flat ry/rx（.26）, tilt 倾角, spin 环面自转 弧度/秒（.6，可负）, rise 上升 px/s（120）, acc, drift, grow 放大/秒（.12）,
      life（3.2）, write 写成一圈的时长（.32）, w 笔带宽（替身用，缺省 r*.16）, tone 'qing'|'gold'|'white', a, seed, glow 光晕（缺省 .35）, tex 指定素材 id */
I.ring = function (c, t, o) {
  var t0 = o.t0 || 0, age = t - t0, life = o.life || 3.2;
  if (age <= 0 || age > life) return null;
  var sd = o.seed || 1, rgb = o.tone === 'gold' ? COL.baijin : o.tone === 'white' ? [252, 250, 244] : COL.qing, T = o.tex ? tex('ring-brush', o) : I.fxTex('ring-brush', sd);
  var rise = o.rise == null ? 120 : o.rise, acc = o.acc == null ? 40 : o.acc;
  var cx = o.x + (o.drift || 0) * age, cy = o.y - rise * age - acc * age * age / 2;
  var r = (o.r || 220) * (1 + (o.grow == null ? .12 : o.grow) * age), fl = o.flat || .26;
  var wk = U.clamp(age / (o.write || .32), 0, 1), A = (o.a == null ? 1 : o.a) * (1 - U.ramp(age, life * .35, life)) * U.clamp(age / .06, 0, 1);
  if (A <= .003 || !T) return [cx, cy];
  var ph = U.hash(sd) * TAU, spin = (o.spin == null ? .6 : o.spin) * age, gl = o.glow == null ? .35 : o.glow;
  c.save();
  c.translate(cx, cy); c.rotate(o.tilt || 0); c.scale(1, fl);
  var pass = function (mode, a) {
    if (T.strip) {                                           // 替身：笔触带沿圆弯成一圈（自转＝起笔角随 t 转）
      var w = o.w || r * .16, sw = TAU * (1.05 + .05 * U.hash(sd + 1)) * wk, a0 = ph + spin;
      I.flow(c, T.id, t, { src: T.src || [300, 385, 1000, 115], key: T.key, tint: rgb, mode: mode, alpha: a, grid: [64, 2],
        map: function (u, v) { var th = a0 + sw * u, rr = r + (v - .5) * w * (1 - .55 * u); return [Math.cos(th) * rr, Math.sin(th) * rr]; },
        warp: { amp: 3, scale: 80, speed: .8, seed: sd } });
    } else {                                                 // 正式素材：整圈图在环面内自转（扁环素材先还原成圆），扇形逐段显现
      var im = I.plateImg(T.id), k = r / (T.r || im.naturalWidth * .4), cc = T.c || [im.naturalWidth / 2, im.naturalHeight / 2];
      c.save(); c.rotate(ph + spin); if (T.flat) c.scale(1, 1 / T.flat);
      I.flow(c, T.id, t, { src: T.src, key: T.key, dst: [-cc[0] * k, -cc[1] * k, im.naturalWidth * k, im.naturalHeight * k], tint: rgb, mode: mode, alpha: a,
        wedge: { a0: 0, a1: TAU * wk, soft: .35, cx: 0, cy: 0 }, warp: { amp: r * .012, scale: r * .5, speed: .6, seed: sd } });
      c.restore();
    }
  };
  var pk = paleK(o);
  if (pk) {                                                  // 浅纸底：沿环身垫一圈焦墨暖晕（环心留纸色），光晕下再淡垫一层
    var sg = c.createRadialGradient(0, 0, r * .62, 0, 0, r * 1.38), sc = o.scorch || SCORCH;
    sg.addColorStop(0, U.rgba(sc, 0)); sg.addColorStop(.5, U.rgba(sc, Math.min(1, .5 * pk * A))); sg.addColorStop(1, U.rgba(sc, 0));
    c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = sg; c.beginPath(); c.arc(0, 0, r * 1.38, 0, TAU); c.fill(); c.restore();
    scorchGlow(c, 0, r * .55, r * .9, .2 * pk * A, o);
  }
  if (gl > 0) { c.save(); c.filter = 'none'; c.globalCompositeOperation = 'lighter'; I.glow(c, 0, r * .55, r * .9, rgb, gl * .25 * A); c.restore(); }
  pass('source-over', .8 * A);
  if (gl > 0) pass('lighter', gl * A);
  c.restore();
  return [cx, cy];
};
/* 十一环（或任意 n 环）的参数表：大小不一、圆心逐次偏移、升速一环快过一环、自转方向与快慢各异（审稿第 17 条：不许同心匀速堆叠）。
   o: x,y 发环处, times [], tones [], seed, r0（200）, spread（90）→ 直接给 I.rings */
I.ringPlan = function (o) {
  var n = o.times.length, sd = o.seed || 77, r0 = o.r0 || 200, sp = o.spread == null ? 90 : o.spread, out = [];
  for (var i = 0; i < n; i++) {
    var h = function (k) { return U.hash(sd * 31 + i * 7 + k); }, q = i / Math.max(1, n - 1);
    out.push({ t0: o.times[i], x: o.x + (h(1) - .5) * 2 * sp * (.5 + q), y: o.y + (h(2) - .5) * 40, r: r0 * (.7 + .65 * h(3)) * (1 + .25 * q),
      flat: .2 + .12 * h(4), tilt: (h(5) - .5) * .32, rise: 90 + 260 * q * q + 50 * h(6), acc: 30 + 160 * q, drift: (h(7) - .5) * 60,
      spin: (h(8) < .5 ? -1 : 1) * (.3 + .9 * h(9) + q), tone: o.tones ? o.tones[i] : 'qing', seed: sd + i * 13, life: 3.4 - 1.2 * q });
  }
  return out;
};
I.rings = function (c, t, list, o) { list.forEach(function (p) { I.ring(c, t, o && o.a != null ? Object.assign({}, p, { a: o.a }) : p); }); };

/* ---------- 三阳劫火 I.sunfire(c, t, o)（青白红三色专用） ----------
   三色火纹理（fx-sunfire-tex-qing/-bai/-hong）切成团块：每团是一块椭圆柔边的纹理，内部向上卷动＋强扭曲（翻涌），沿底线此起彼伏地生灭、上浮；
   叠两遍：source-over 打底保留墨色、lighter 提亮成火光。o: x,y 底线中点, w（800）, h（360）, n 团数（12）, dir（-π/2）, mix [青,白,红] 权重, k 火势, a, seed, speed
   burst {x,y,k,r}：内爆——团块自一点向外推开、放大、散淡。 */
var FIRE = ['sunfire-qing', 'sunfire-bai', 'sunfire-hong'];
function fireTex(h, mix) {
  var m = mix || [1, 1, 1], s = m[0] + m[1] + m[2], v = h * s;
  return FIRE[v < m[0] ? 0 : v < m[0] + m[1] ? 1 : 2];
}
function fireBlob(c, t, T, cx, cy, bw, bh, ang, A, sd, spd, po) {
  if (!T || A <= .003) return;
  c.save(); c.translate(cx, cy); c.rotate(ang + Math.PI / 2);
  var pk = po ? paleK(po) : 0;
  if (pk) { c.save(); c.scale(1, bh / bw); scorchGlow(c, 0, 0, bw * .75, .8 * pk * A, po); c.restore(); }   // 浅纸底：团下垫焦墨暖晕
  var o = T.fx ? { src: T.src, sat: T.sat, dst: [-bw / 2, -bh / 2, bw, bh], vignette: { rx: 1.05, ry: 1.05, soft: .35 },   // 正式素材：整团火，只翻涌不卷动
      warp: { amp: bw * .045, scale: bw * .5, speed: .5 * spd, seed: sd, dir: [0, .3 * spd] }, grid: [8, 10] }
    : { src: T.src, key: T.key, dst: [-bw / 2, -bh / 2, bw, bh], scroll: [0, 70 * spd], vignette: { rx: .95, ry: .95, soft: .7 },
      warp: { amp: bw * .05, scale: bw * .7, speed: .45 * spd, seed: sd, dir: [0, .2 * spd] }, grid: [8, 10] };
  o.alpha = (T.fx ? .85 : .75) * A; I.flow(c, T.id, t, o);
  o.alpha = (T.fx ? .3 : .45) * A; o.mode = 'lighter'; I.flow(c, T.id, t, o);
  c.restore();
}
I.sunfire = function (c, t, o) {
  var A = (o.a == null ? 1 : o.a), K = o.k == null ? 1 : U.clamp(o.k, 0, 1), sd = o.seed || 61, spd = o.speed || 1, i, h;
  if (A * K <= .003) return;
  if (o.burst) {
    var B = o.burst, bk = U.clamp(B.k == null ? 1 : B.k, 0, 1), R = B.r || 420, nb = o.n || 10, eb = U.easeOut(bk);
    for (i = 0; i < nb; i++) {
      h = U.hash(sd + i * 11);
      var an = i / nb * TAU + (h - .5) * .7, rr = R * eb * (.15 + .55 * U.hash(sd + i * 5)), sz = R * (.35 + .35 * h) * (.4 + .8 * eb);
      fireBlob(c, t, tex(fireTex(U.hash(sd + i * 3), o.mix), o), B.x + Math.cos(an) * rr, B.y + Math.sin(an) * rr * .85, sz, sz * 1.25, an, A * K * (1 - bk * bk * .8), sd + i, spd, o);
    }
    return;
  }
  var n = o.n || 12, w = o.w || 800, hh = (o.h || 360) * K, dir = o.dir == null ? -Math.PI / 2 : o.dir, px = -Math.sin(dir), py = Math.cos(dir), list = [];
  for (i = 0; i < n; i++) {
    h = U.hash(sd + i * 13);
    var life = (1.8 + 1.2 * U.hash(sd + i * 3)) / spd, cyc = (t + h * 7) / life, gen = Math.floor(cyc), age = cyc - gen, g = U.hash(sd * 7 + i * 131 + gen * 17);
    var u = (i + .5 + (g - .5) * .8) / n - .5, rise = hh * .35 * age, bw = w / n * (1.8 + 1.2 * g), bh = hh * (.7 + .5 * U.hash(sd + gen * 5 + i));
    list.push({ x: o.x + px * u * w + Math.cos(dir) * (bh * .4 + rise), y: o.y + py * u * w + Math.sin(dir) * (bh * .4 + rise), bw: bw, bh: bh, a: Math.pow(Math.sin(Math.PI * age), .8), name: fireTex(U.hash(sd + gen * 3 + i * 29), o.mix), d: g, sd: sd + i * 7 + gen });
  }
  list.sort(function (a, b) { return a.d - b.d; });
  list.forEach(function (f) { fireBlob(c, t, tex(f.name, o), f.x, f.y, f.bw, f.bh, dir, A * K * f.a, f.sd, spd, o); });
};

/* ---------- 血潮 / 血海流动层 I.bloodTide(c, t, o)（血红只到 3-25，§8） ----------
   素材 fx-bloodtide-tex（替身：il-mountain-press 的血带）抠纸后两层横向卷动（远慢近快）＋低频翻涌扭曲，上缘羽化，叠在场景上。
   o: y 上缘（H*.55）, h 厚度（H*.45）, speed px/s（缺省 60，负为向左）, x0, w, a, seed, warp 翻涌幅度（24）, burn 0..1 燃烧（暗红泛光） */
I.bloodTide = function (c, t, o) {
  o = o || {};
  var T = tex('bloodtide', o), y = o.y == null ? H * .55 : o.y, h = o.h || H * .45, A = o.a == null ? 1 : o.a, x0 = o.x0 || 0, w = o.w || W, spd = o.speed == null ? 60 : o.speed, sd = o.seed || 7, wa = o.warp == null ? 24 : o.warp;
  if (!T || A <= .003) return;
  var asp = aspectOf(T);
  [[0, .62, .6, .7], [1, 1, .75, 1]].forEach(function (L) {
    var dy = y + h * (1 - L[2]) * L[0], dh = h * L[2], rep = (w / dh) / asp;     // repeat：保持素材横竖比，不拉伸
    I.flow(c, T.id, t, { src: T.src, key: T.fx ? null : T.key == null ? 'paper' : T.key, dark: o.dark, dst: [x0, dy, w, dh], scroll: [-spd * L[1] * (T.src ? T.src[2] : 1920) / w * rep, 0], repeat: rep, alpha: A * L[3],
      warp: { amp: wa * (L[0] ? 1 : .6), scale: 320, speed: .18, seed: sd + L[0] * 9, dir: [.04, 0] }, feather: { t: dh * .35, b: L[0] ? 0 : dh * .3 }, grid: [20, 6] });
  });
  if (o.burn) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (var b = 0; b < 6; b++) { var bx = x0 + U.fract(U.hash(sd + b) + t * .02) * w; I.glow(c, bx, y + h * .4, 260, [150, 40, 18], .12 * A * o.burn * (.6 + .4 * Math.sin(t * 2 + b))); }
    c.restore();
  }
};
/* ---------- 浊浪 I.turbid(c, t, o)（无岸与浊海） ----------
   素材 fx-turbid-tex（替身：p-zhuohai 下半的浊浪）两层卷动＋沉重的大尺度翻涌，上缘羽化；九点暗红灯笼眼画在两层之间（可被前浪遮住）。
   o: 同 bloodTide（speed 缺省 35、warp 缺省 34）, eyes [[x,y]…], eyeR（9） */
I.turbid = function (c, t, o) {
  o = o || {};
  var T = tex('turbid', o), y = o.y == null ? H * .5 : o.y, h = o.h || H * .5, A = o.a == null ? 1 : o.a, x0 = o.x0 || 0, w = o.w || W, spd = o.speed == null ? 35 : o.speed, sd = o.seed || 9, wa = o.warp == null ? 34 : o.warp;
  if (!T || A <= .003) return;
  var asp = aspectOf(T);
  var layer = function (k) {
    var dy = y + h * .3 * k, dh = h * (k ? .7 : .8), rep = (w / dh) / asp;
    I.flow(c, T.id, t, { src: T.src, key: T.key, dark: o.dark, dst: [x0, dy, w, dh], scroll: [-spd * (k ? 1 : .55) * (T.src ? T.src[2] : 1920) / w * rep, 0], repeat: rep, alpha: A * (k ? 1 : .8),
      warp: { amp: wa * (k ? 1 : .7), scale: 420, speed: .12, seed: sd + k * 9, dir: [.03, 0] }, feather: { t: dh * (k ? .3 : .45) }, grid: [22, 7] });
  };
  layer(0);
  (o.eyes || []).forEach(function (e, i) {
    var p = .7 + .3 * Math.sin(t * .6 + i * 1.3), er = (o.eyeR || 9) * (.85 + .3 * U.hash(sd + i));
    c.save(); c.globalCompositeOperation = 'lighter'; I.glow(c, e[0], e[1], er * 5, COL.lantern, .5 * A * p); c.restore();
    I.wash(c, e[0], e[1], er * 1.3, er, .9 * A * p, sd + i, [150, 52, 34], 0, { edge: 'soft' });
  });
  layer(1);
};
/* ---------- 底图本身翻涌 I.plateFlow(c, id, t, o)：I.flow 的场景用法（浪、熔岩、劫云微动），与 I.plate 同取景 ----------
   o: cam（同 I.plate）, amp（6）, scale（300）, speed（.12）, band [v0,v1] 只让画面纵向这段动（缺省全幅，边缘渐弱）, alpha, seed */
I.plateFlow = function (c, id, t, o) {
  o = o || {};
  var b = o.band;
  return I.flow(c, id, t, { cam: o.cam, flip: o.flip, alpha: o.alpha, warp: { amp: o.amp == null ? 6 : o.amp, scale: o.scale || 300, speed: o.speed == null ? .12 : o.speed, seed: o.seed || 3, dir: o.dir },
    ampAt: b ? function (u, v) { return U.smooth((v - b[0]) / .08) * (1 - U.smooth((v - b[1]) / .08)); } : null, grid: o.grid });
};

/* ---------- 地层 I.strata(c, t, o) ----------
   素材 fx-strata-tex（替身：p-mountain-peak-section 顶部的横向地层带），镜像平铺。
   mode 'scroll'（缺省）：竖向卷动（dir 'down' 下潜＝地层向上掠过 | 'up' 上冲），轻微横向扭曲，越深越红（red 或 off/redAt）。o: off 位移 px（缺省 speed*t）, speed（220）, y0,y1, a, seed
   mode 'reveal'：n 条带，各自按墨线前沿（wipe）逐条揭开（dir 'down'|'up'），揭开时左右错位、最后落定。o: x,y,w,h, k, n（5）, shift（120） */
I.strata = function (c, t, o) {
  o = o || {};
  var T = tex('strata', o), A = o.a == null ? 1 : o.a, sd = o.seed || 5;
  if (!T || A <= .003) return;
  var sh0 = T.src ? T.src[3] : 400, sw0 = T.src ? T.src[2] : 1920;
  if (o.mode === 'reveal') {
    var x = o.x || 0, y = o.y || 0, w = o.w || W, h = o.h || H, n = o.n || 5, k = U.clamp(o.k == null ? 1 : o.k, 0, 1), up = o.dir === 'up', sh = o.shift == null ? 120 : o.shift;
    for (var i = 0; i < n; i++) {
      var ord = up ? n - 1 - i : i, ki = U.clamp(k * (n + 1.5) - ord * 1.05, 0, 1);
      if (ki <= 0) continue;
      var off = sh * (U.hash(sd + i * 5) - .5) * 2 * Math.sin(Math.PI * ki) + sh * .3 * (U.hash(sd + i * 9) - .5) * U.smooth(ki);
      var sy = U.hash(sd + i * 3) * sh0 * .5, sl = sh0 * .5;
      I.flow(c, T.id, t, { src: [T.src ? T.src[0] : 0, (T.src ? T.src[1] : 0) + sy, sw0, sl], key: T.key, dst: [x - 140 + off, y + h * (i - .2) / n, w + 280, h * 1.4 / n], alpha: A, feather: { t: h * .12 / n, b: h * .12 / n },
        reveal: { k: ki, type: 'wipe', dir: [0, up ? -1 : 1], rough: .35, soft: .15, seed: sd + i }, warp: { amp: 6, scale: 200, speed: .1, seed: sd + i }, grid: [12, 3] });
    }
    return;
  }
  var spd = o.speed == null ? 220 : o.speed, offp = o.off == null ? spd * t : o.off, dn = o.dir !== 'up' ? 1 : -1, y0 = o.y0 || 0, y1 = o.y1 == null ? H : o.y1;
  var red = o.red == null ? U.clamp(offp / (o.redAt || 4000), 0, 1) : o.red, k2 = sw0 / (W + 80), rep = (y1 - y0) * k2 / sh0;   // 保持素材横竖比
  I.flow(c, T.id, t, { src: T.src, key: T.key, dst: [-40, y0, W + 80, y1 - y0], scroll: [0, 1], scrollOff: [0, dn * offp * k2], repeat: rep, alpha: A, grid: [14, 0],
    warp: { amp: 10, scale: 260, speed: .05, seed: sd } });
  if (red > .01) { c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = U.rgba(lerp3([255, 255, 255], [214, 140, 112], red), A); c.fillRect(-40, y0, W + 80, y1 - y0); c.restore(); }
};

/* ---------- 界域 I.realm(c, t, o)（3-19～3-20：浑浊中洇开一片宣纸本色；外乱内序） ----------
   素材 fx-realm-edge（替身：p-domain-inner，中间一片纸色、四周乱墨），整张随时间呼吸（缩放 ±2%），扭曲按离中心距离加权：外圈大、内圈几乎不动；
   成形时由中心墨晕式洇开（k）；乱流撞来（push）时该方向边界先凹后弹。o: x,y 中心, R 纸色区半径（360）, k, push [{t, ang, amp, dur}], chaos 外圈扭曲（1）, a, seed
   素材参数（fx 表/替身里）：src 取样框、c [x,y] 纸色区中心、r 纸色区半径（素材像素）。返回近似边界函数 r(θ)。 */
I.realm = function (c, t, o) {
  var T = tex('realm-edge', o), A = o.a == null ? 1 : o.a, sd = o.seed || 91, k = U.clamp(o.k == null ? 1 : o.k, 0, 1), R = o.R || 360;
  var rad = function () { return R * U.easeOut(k); };
  if (!T || A <= .003) return rad;
  var im = I.plateImg(T.id), src = T.src || [0, 0, im.naturalWidth, im.naturalHeight], pr = T.r || src[3] * .3;   // 素材纸色区半径（素材像素）
  var br = 1 + .02 * Math.sin(t * .9) + .01 * Math.sin(t * 2.3 + 1), sc = R / pr * br, dw = src[2] * sc, dh = src[3] * sc, pushes = o.push || [], ch = o.chaos == null ? 1 : o.chaos;
  var cu = T.c ? (T.c[0] - src[0]) / src[2] : .5, cv = T.c ? (T.c[1] - src[1]) / src[3] : .5;   // 纸色区中心在素材里的位置
  var ek = U.easeOut(k);
  if (T.ring) {                                              // 正式素材 fx-realm-edge 是一圈透明底的乱墨：里面先铺一片宣纸本色（边缘不规则），再叠墨圈；成形＝由小洇大
    var gk = .3 + .7 * ek; sc *= gk; dw *= gk; dh *= gk;
    c.save();
    I.blot(c, o.x, o.y, R * gk * br * (T.ring[0] + T.ring[1]) / 2 / pr, sd, { rough: .07, n: 72, fringe: .02 });
    c.clip(); c.globalAlpha *= A * U.clamp(k * 3, 0, 1) * (o.paper == null ? .96 : o.paper);
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(I.paperCanvas(), 0, 0); c.restore();
    c.restore();
    A *= U.clamp(k * 2.5, 0, 1);
  }
  I.flow(c, T.id, t, { src: src, key: T.key, dark: o.dark, dst: [o.x - dw * cu, o.y - dh * cv, dw, dh], alpha: A, grid: [26, 16],
    warp: { amp: 60 * ch, scale: 300, speed: .2, seed: sd, oct: 2 },
    ampAt: function (u, v) { var d = Math.hypot((u - cu) * dw, (v - cv) * dh) / R; return .04 + .96 * U.smooth((d - .7) / .9); },
    disp: pushes.length ? function (u, v, tt) {
      var X = (u - cu) * dw, Y = (v - cv) * dh, d = Math.hypot(X, Y) || 1, th = Math.atan2(Y, X), m = 0;
      for (var i = 0; i < pushes.length; i++) {
        var p = pushes[i], q = (tt - p.t) / (p.dur || 1.6);
        if (q <= 0 || q >= 1) continue;
        var da = Math.atan2(Math.sin(th - p.ang), Math.cos(th - p.ang));
        m += (p.amp == null ? .25 : p.amp) * R * Math.exp(-da * da / .18) * Math.sin(Math.PI * q) * Math.exp(-2.2 * q) * 1.6 * Math.exp(-Math.pow((d - R) / (R * .6), 2));
      }
      return [X / d * m, Y / d * m];                          // 取样点外移 = 画面里边界向内凹
    } : null,
    reveal: k < 1 && !T.ring ? { k: k, pts: [[cu, cv]], rough: .3, soft: .15, seed: sd } : null, feather: T.ring ? null : { t: dh * .12, b: dh * .12, l: dw * .1, r: dw * .1 } });
  return rad;
};

/* ---------- 雾带 I.mistBand(c, t, o)：素材 fx-mist-tex 横向卷动＋慢翻涌（灰雾、劫云底、地层间的烟） ----------
   o: y 上缘, h 厚（H*.4）, speed px/s（25）, x0, w, a, seed, warp（20）, dark 暗场（true＝反成银灰 | 'rim'）, tint [r,g,b], mode */
I.mistBand = function (c, t, o) {
  o = o || {};
  var T = tex('mist', o), A = o.a == null ? 1 : o.a, y = o.y == null ? H * .4 : o.y, h = o.h || H * .4, x0 = o.x0 || 0, w = o.w || W, spd = o.speed == null ? 25 : o.speed;
  if (!T || A <= .003) return;
  var rep = (w / h) / aspectOf(T);
  I.flow(c, T.id, t, { src: T.src, key: T.fx ? null : 'paper', dark: o.dark, tint: o.tint, mode: o.mode, dst: [x0, y, w, h], scroll: [-spd * (T.src ? T.src[2] : 1508) / w * rep, 0], repeat: rep, alpha: A,
    warp: { amp: o.warp == null ? 20 : o.warp, scale: 300, speed: .15, seed: o.seed || 13 }, feather: T.fx ? null : { t: h * .3, b: h * .3 }, grid: [20, 5] });
};
/* ---------- 墨溅 I.inkSplash(c, t, o)：素材 fx-inksplash-1/2/3 从「着纸点」墨晕式炸开（.35s），停留后淡去；情绪重音（附剑、「现在！」、扑护、答句） ----------
   o: x,y 着纸点落在哪, size 素材长边落位尺寸（520）, t0, dur 炸开时长（.35）, hold 停留（1.5）, fade 淡出（.8）, rot, v 选第几张（0..2）, a, dark, tint, seed */
I.inkSplash = function (c, t, o) {
  if (o.vary) return inkSplashVary(c, t, o);
  var age = t - (o.t0 || 0), dur = o.dur || .35, hold = o.hold == null ? 1.5 : o.hold, fd = o.fade == null ? .8 : o.fade;
  if (age < 0 || age > dur + hold + fd) return;
  var T = o.tex ? tex('inksplash', o) : I.fxTex('inksplash', o.v || 0);
  if (!T) return;
  var im = I.plateImg(T.id), sz = o.size || 520, k = sz / Math.max(im.naturalWidth, im.naturalHeight), org = T.o || [.5, .5];
  var A = (o.a == null ? 1 : o.a) * (1 - U.ramp(age, dur + hold, dur + hold + fd)), kk = U.clamp(age / dur, 0, 1);
  c.save(); c.translate(o.x, o.y); c.rotate(o.rot || 0); c.scale(1 + .04 * U.easeOut(kk), 1 + .04 * U.easeOut(kk));
  I.flow(c, T.id, t, { key: T.fx ? null : 'paper', dark: o.dark, tint: o.tint, dst: [-org[0] * im.naturalWidth * k, -org[1] * im.naturalHeight * k, im.naturalWidth * k, im.naturalHeight * k], alpha: A,
    reveal: kk < 1 ? { k: U.easeOut(kk), pts: [org], rough: .35, soft: .08, seed: o.seed || 5 } : null, warp: { amp: 3, scale: 120, speed: .2, seed: o.seed || 5 } });
  c.restore();
};
/* v5（FX 诊断第 9 条）：o.vary 开关——同 3 张素材不再一眼认出：按 seed 左右翻转、旋转 ±.5 rad、缩放 ±15%；主溅前 .04–.08 s 先甩 2–4 个墨点；
   揭示 expoOut(k,6)（先快后慢）；hold 缺省 .3+size/1500。不开 vary 时行为与 v4 完全一致。 */
function inkSplashVary(c, t, o) {
  var sd = o.seed || 5, r = U.rng(sd * 31 + 7), flip = r() < .5 ? -1 : 1, rot = (o.rot || 0) + (r() * 2 - 1) * .5, sc = 1 + (r() * 2 - 1) * .15;
  var sz = (o.size || 520) * sc, lead = .04 + .04 * r(), age = t - (o.t0 || 0);
  var hold = o.hold == null ? .3 + sz / 1500 : o.hold, dur = o.dur || .35, fd = o.fade == null ? .8 : o.fade;
  if (age < -lead || age > dur + hold + fd) return;
  if (age < dur * .6 + .2) {                                  // 先甩墨点（主溅之前就飞出）
    var n = 2 + Math.floor(r() * 3);
    for (var i = 0; i < n; i++) {
      var ang = rot + (r() * 2 - 1) * 2.4, d = sz * (.35 + .4 * r()), q = U.clamp((age + lead) / (lead + .18), 0, 1), e = 1 - Math.pow(2, -6 * q);
      var pa = (o.a == null ? 1 : o.a) * .85 * (1 - U.smooth((age - dur * .6) / .2));
      if (pa > .003 && q > 0) { c.fillStyle = U.rgba(o.dark === true ? [236, 230, 216] : [30, 24, 20], pa); I.blot(c, o.x + Math.cos(ang) * d * e, o.y + Math.sin(ang) * d * e, 3 + sz * .012 * (1 - .4 * q), sd + i * 7, { rough: .3, n: 10, sx: 1.5, sy: .8, rot: ang }); c.fill(); }
    }
  }
  if (age < 0) return;
  var T = o.tex ? tex('inksplash', o) : I.fxTex('inksplash', o.v || 0);
  if (!T) return;
  var im = I.plateImg(T.id), k = sz / Math.max(im.naturalWidth, im.naturalHeight), org = T.o || [.5, .5];
  var A = (o.a == null ? 1 : o.a) * (1 - U.ramp(age, dur + hold, dur + hold + fd)), kk = U.clamp(age / dur, 0, 1), ek = kk >= 1 ? 1 : (1 - Math.pow(2, -6 * kk)) / (1 - Math.pow(2, -6));
  c.save(); c.translate(o.x, o.y); c.rotate(rot); c.scale(flip * (1 + .04 * ek), 1 + .04 * ek);
  I.flow(c, T.id, t, { key: T.fx ? null : 'paper', dark: o.dark, tint: o.tint, dst: [-org[0] * im.naturalWidth * k, -org[1] * im.naturalHeight * k, im.naturalWidth * k, im.naturalHeight * k], alpha: A,
    reveal: kk < 1 ? { k: ek, pts: [org], rough: .35, soft: .08, seed: sd } : null, warp: { amp: 3, scale: 120, speed: .2, seed: sd } });
  c.restore();
}
/* ---------- 飞白 I.flyWhite(c, t, o)：素材 fx-flywhite-ink / -gold 一笔从 (x0,y0) 扫到 (x1,y1)（墨线前沿推进），停留后淡去 ----------
   o: x0,y0,x1,y1, w 笔宽（落位高度，缺省按素材比例）, t0, dur 扫过时长（.25）, hold（1.2）, fade（.6）, kind 'ink'|'gold', a, dark, tint, seed */
I.flyWhite = function (c, t, o) {
  var age = t - (o.t0 || 0), dur = o.dur || .25, hold = o.hold == null ? 1.2 : o.hold, fd = o.fade == null ? .6 : o.fade;
  if (age < 0 || age > dur + hold + fd) return;
  var T = o.tex ? tex('flywhite', o) : I.fxTex('flywhite-' + (o.kind || 'ink'));
  if (!T) return;
  var L = Math.hypot(o.x1 - o.x0, o.y1 - o.y0), src = T.src || [0, 0, 1672, 418], wd = o.w || L * src[3] / src[2], kk = U.clamp(age / dur, 0, 1);
  var A = (o.a == null ? 1 : o.a) * (1 - U.ramp(age, dur + hold, dur + hold + fd));
  c.save(); c.translate(o.x0, o.y0); c.rotate(Math.atan2(o.y1 - o.y0, o.x1 - o.x0));
  I.flow(c, T.id, t, { src: src, key: T.fx ? null : 'paper', dark: o.dark, tint: o.tint, dst: [0, -wd / 2, L, wd], alpha: A,
    reveal: kk < 1 ? { k: U.easeOut(kk), type: 'wipe', dir: [1, 0], rough: .25, soft: .06, seed: o.seed || 9 } : null, warp: { amp: 2, scale: 140, speed: .3, seed: o.seed || 9 }, grid: [12, 2] });
  c.restore();
};

/* ---------- 念头包 I.mind(c, t, o)（雾心里的一点念头） ----------
   一团灰雾裹着剑，雾心一点青光（念头，位置固定、只微微明灭），外面两三道金色龙气缓缓盘旋护住它。
   R2 视觉语法（审稿第 6 条）：念头＝雾心内一枚实心青色圆点、外裹暗金壳；点周围先压暗（暗座）、龙气外晕减半——靠主体大和背景暗区分，不靠加亮。
   与灵明（I.spineLight）的区别：念头是「圆点」，灵明是「丝」；念头不随剑动，灵明长在剑脊里。
   o: x,y 雾心（= 念头位置，不随剑动）, R 雾半径（150）, a, seed, breath 呼吸幅度（.06）, smoke 0..1 龙气小半化烟（4-10）,
      dragon 龙气浓度（1）, dot 青点浓度（1）, dotR 圆点半径（缺省 R×.075，夹在 8–26）, mist 雾浓度（1）, mistRGB */
I.mind = function (c, t, o) {
  var x = o.x, y = o.y, R = o.R || 150, A = o.a == null ? 1 : o.a, sd = o.seed || 23, br = 1 + (o.breath == null ? .06 : o.breath) * Math.sin(t * 1.3);
  if (A <= .003) return;
  var mrgb = o.mistRGB || COL.mist, ma = (o.mist == null ? 1 : o.mist) * A, sm = U.clamp(o.smoke || 0, 0, 1), i, k;
  for (i = 0; i < 14; i++) {                                 // 灰雾：一团横长的淡洗绕雾心缓转、一收一放（裹住剑）
    var ang = i / 14 * TAU + t * (.04 + .04 * U.hash(sd + i)) * (i % 2 ? 1 : -1), d = R * (.15 + .6 * U.hash(sd + i * 3)) * br;
    I.wash(c, x + Math.cos(ang) * d * 1.3, y + Math.sin(ang) * d * .55, R * (.5 + .45 * U.hash(sd + i * 5)) * br, R * (.3 + .2 * U.hash(sd + i * 7)) * br,
      (.3 + .2 * U.hash(sd + i * 11)) * ma, sd + i, mrgb, ang * .2, { edge: 'soft' });
  }
  for (i = 0; i < 5; i++) {                                  // 雾里几缕淡墨游丝（宽而淡的侧锋），绕着走
    var a0 = t * .2 * (i % 2 ? 1 : -1) + i * 1.1, pts = [];
    for (k = 0; k <= 12; k++) { var aa = a0 + k * .14, rr = R * (.75 + .25 * Math.sin(k * .45 + i)) * br; pts.push([x + Math.cos(aa) * rr * 1.3, y + Math.sin(aa) * rr * .5]); }
    I.sweep(c, pts, { w: 34, a: .13 * ma, rgb: [176, 170, 158], seed: sd + 40 + i, dry: .85, head: .2, tail: .5, fade: .6 });
  }
  var da = (o.dragon == null ? 1 : o.dragon) * A, dk = U.clamp(o.dot == null ? 1 : o.dot, 0, 1.5);
  var pa = dk * A * (.9 + .1 * Math.sin(t * 2.3 + sd)), dr = o.dotR || U.clamp(R * .075, 8, 26);   // 念头圆点：半径随雾大小（R2 增大主体）
  var pk = paleK(o);
  if (pk) scorchGlow(c, x, y, R * .62, .42 * pk * Math.max(da, dk * A), o);   // 浅纸底：龙气与青点下垫焦墨暖晕
  if (pa > .003) I.glow(c, x, y, dr * 6, [34, 26, 16], .55 * pa, 'multiply');   // R2 视觉语法：压低念头周围的背景光（暗座），圆点才立得住
  if (da > .003) {
    c.save(); c.globalCompositeOperation = 'lighter';           // 龙气外晕：R2 压到原来的一半（不再靠大片金晕表示念头）
    I.glow(c, x, y, R * .45, COL.dragon, .09 * da * (1 - .5 * sm));
    I.wash(c, x, y, R * .3, R * .24, .08 * da * (1 - .5 * sm), sd + 3, COL.dragon, 0, { edge: 'soft' });
    c.restore();
    for (i = 0; i < 3; i++) {                                // 龙气：三道侧锋金气，宽而淡、飞白如鳞，交错反向盘旋；每道下面垫一串金色淡洗作光
      var dir = i % 2 ? -1 : 1, base = i * 2.2 + dir * t * (.45 + .1 * i), rad = R * (.2 + .09 * i), arc = 2.2 + .9 * U.hash(sd + i * 9), P = [];
      var keep = 1 - sm * (i === 0 ? .25 : .7);
      for (k = 0; k <= 14; k++) { var th = base + dir * arc * k / 14 * keep, wob = 1 + .1 * U.noise1(k * .5 + t * 1.2, sd + i); P.push([x + Math.cos(th) * rad * wob, y + Math.sin(th) * rad * .72 * wob]); }
      c.save(); c.globalCompositeOperation = 'lighter';
      for (k = 2; k < P.length; k += 3) I.wash(c, P[k][0], P[k][1], R * .14, R * .1, .06 * da * (1 - k / P.length * .6), sd + i * 7 + k, COL.dragon, 0, { edge: 'soft' });
      c.restore();
      I.sweep(c, P, { raw: true, n: 48, w: 26 - 4 * i, a: .36 * da, rgb: [164, 132, 66], seed: sd + 70 + i, dry: .75, head: .08, tail: .5, fade: .55 });
      if (sm > 0) {                                          // 化烟：气尾散成灰烟上飘
        var e = P[P.length - 1];
        for (k = 0; k < 4; k++) {
          var up = (U.fract(t * .35 + k / 4 + i * .13)) * R * .9;
          I.wash(c, e[0] + U.noise1(t + k * 3, sd + i) * 18, e[1] - up, 22 + up * .3, 16 + up * .2, .26 * sm * A * (1 - up / (R * .9)), sd + 80 + k, [140, 134, 124], 0, { edge: 'soft' });
        }
      }
    }
  }
  if (pa > .003) {                                           // 念头（R2 固定语法）：雾心一枚实心青色圆点，外裹一层暗金壳（两瓣侧锋缓转，像双手拢住）；位置不动，只明灭
    if (pk) scorchGlow(c, x, y, dr * 3, .5 * pk * pa, o);
    var sh = Math.min(1, da / Math.max(.3, A)) * pa;           // 暗金壳随龙气浓度（只开念头不开龙气时只剩圆点）
    if (sh > .003) {
      I.wash(c, x, y, dr * 2.6, dr * 2.3, .42 * sh, sd + 88, [92, 66, 28], 0, { edge: 'soft' });   // 暗金窝：圆点坐在一团暗金里
      for (i = 0; i < 2; i++) {
        var a0 = t * .35 * (i ? -1 : 1) + i * Math.PI + .4, Q = [];
        for (k = 0; k <= 16; k++) { var aq = a0 + k / 16 * 2.7; Q.push([x + Math.cos(aq) * dr * 1.9, y + Math.sin(aq) * dr * 1.9]); }
        I.sweep(c, Q, { raw: true, n: 32, w: dr * 1.15, a: .8 * sh, rgb: [112, 82, 32], seed: sd + 90 + i, dry: .6, head: .25, tail: .35, fade: .35, bleed: .15 });
        c.save(); c.globalCompositeOperation = 'lighter';
        I.stroke(c, Q, { raw: true, w: dr * .12, a: .3 * sh, rgb: COL.dragon, seed: sd + 94 + i, head: .4, tail: .5, bleed: 0, fade: .4, wob: .2 });
        c.restore();
      }
    }
    c.save(); c.globalCompositeOperation = 'lighter';
    I.glow(c, x, y, dr * 3.2, COL.qing, .32 * pa);
    c.restore();
    c.save(); c.fillStyle = U.rgba([84, 156, 170], .96 * Math.min(1, pa)); c.beginPath(); c.arc(x, y, dr, 0, TAU); c.fill(); c.restore();   // 实心圆点（青，不是青白）
    c.save(); c.globalCompositeOperation = 'lighter';
    I.glow(c, x - dr * .2, y - dr * .2, dr * 1.1, [120, 196, 208], .7 * pa);
    c.restore();
  }
};
/* ---------- 剑脊清光 / 初生灵明 I.spineLight(c, t, o)（BRIEF §0.2 ②：只在剑脊里，只从剑脊往上抽丝） ----------
   与念头的区分（三项都不同）：位置＝剑脊上（随剑动）；颜色＝湛然清光青白 #CFEDEA（念头是青 #5FA8B5 且外有金龙气）；运动＝沿剑脊一线呼吸、光丝向上抽出摇曳。
   R2 视觉语法：形状＝丝（脊里发丝＋从脊里长出的光丝，根先顺钢走一段），没有圆形亮点；辉光减半，丝下垫一道暗边。
   o: x0,y0,x1,y1 剑脊线（剑尖→剑柄均可）, u 灵明在脊上的位置（.42）, a, seed,
      sprout 0..1 光丝破土（一根接一根抽出，弯弯如芽）, wither 0..1 遭劫火：光丝蜷缩回卷、褪成枯黄、发颤、变短, up 光丝朝向（弧度，缺省 -π/2 屏幕上方）,
      len 光丝最长（120）, n 光丝数（3）。返回灵明点 [x,y]。 */
I.spineLight = function (c, t, o) {
  var A = o.a == null ? 1 : o.a, sd = o.seed || 41, u = o.u == null ? .42 : o.u, wi = U.clamp(o.wither || 0, 0, 1), sp = U.clamp(o.sprout || 0, 0, 1);
  var dx = o.x1 - o.x0, dy = o.y1 - o.y0, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  var px = o.x0 + dx * u, py = o.y0 + dy * u, puls = .82 + .18 * Math.sin(t * 1.6 + sd), rgb = lerp3(COL.clear, COL.wither, wi * .8);
  if (A <= .003) return [px, py];
  var tr = wi * (1.5 + 2.5 * wi);                            // 发颤
  px += tr * U.noise1(t * 23, sd); py += tr * U.noise1(t * 21, sd + 3);
  var pk = paleK(o), core = lerp3([244, 255, 252], COL.wither, wi * .7);
  if (pk) { scorchGlow(c, px, py, 80, .5 * pk * A * puls, o); scorchGlow(c, px, py, 26, .35 * pk * A * puls, o); }   // 浅纸底：灵明点下垫焦墨暖晕
  var seg = L * (.07 + .04 * (1 - wi)), pts = [], i, k;
  c.save(); c.globalCompositeOperation = 'lighter';
  /* R2 视觉语法（审稿第 6 条）：灵明＝从剑脊里生出的青白细丝。不再有圆形亮点（圆点是念头的记号），辉光压到原来一半；
     脊里两三根发丝细的清光沿钢走（像透在钢里），光丝的根先顺着剑脊走一小段再拐出来——看得出是从剑里「长」出来的。 */
  for (i = 0; i < 9; i++) pts.push([px + ux * seg * (i - 4) / 4, py + uy * seg * (i - 4) / 4]);
  I.glow(c, px, py, 34, rgb, .1 * A * puls * (1 - .6 * wi));
  for (i = -2; i <= 2; i++) I.glow(c, px + ux * seg * i / 2, py + uy * seg * i / 2, 18, rgb, .09 * A * puls * (1 - .55 * wi));
  for (var h = 0; h < 3; h++) {                              // 脊里发丝：两三根平行细线，亮段沿脊缓缓游走
    var off = (h - 1) * 2.2, hs = U.fract(t * .18 + h * .37), Hp = [];
    for (i = 0; i <= 12; i++) { var q = (i / 12 - .5) * (1.6 - .3 * h); Hp.push([px + ux * seg * q * 2 - uy * off, py + uy * seg * q * 2 + ux * off]); }
    I.stroke(c, Hp, { raw: true, w: h === 1 ? 2.2 : 1.2, a: (.55 + .35 * Math.sin(Math.PI * hs)) * A * puls * (1 - .5 * wi), rgb: h === 1 ? core : rgb, seed: sd + 60 + h, head: .45, tail: .45, bleed: 0, fade: 0, wob: .08 });
  }
  c.restore();
  var up = o.up == null ? -Math.PI / 2 : o.up, nT = o.n || 3, Lm = o.len || 120, along = Math.atan2(uy, ux);
  for (var j = 0; j < nT && sp > 0; j++) {                   // 光丝：一根接一根抽出
    var kj = U.easeOut(U.clamp((sp - j * .22) / .55, 0, 1));
    if (kj <= 0) continue;
    var hs2 = U.hash(sd + j * 17), len = Lm * (1 - .22 * j) * (.75 + .4 * hs2) * kj * (1 - .55 * wi), base = up + (j - (nT - 1) / 2) * .22 + (hs2 - .5) * .3;
    var curl = (j % 2 ? -1 : 1) * (1 + 2.4 * wi), P = [], sgn = j % 2 ? -1 : 1, ox = px + ux * (j - (nT - 1) / 2) * 22 * (1 + hs2), oy = py + uy * (j - (nT - 1) / 2) * 22 * (1 + hs2);
    var X = ox - ux * sgn * 26, Y = oy - uy * sgn * 26, ang;
    P.push([X, Y]);
    for (k = 1; k <= 3; k++) {                               // 根：先在剑脊里顺钢走一小段（从剑里长出来）
      ang = along + (sgn < 0 ? Math.PI : 0); var bend = k / 3;
      var dir2 = Math.atan2(Math.sin(ang) * (1 - bend) + Math.sin(base) * bend * .6, Math.cos(ang) * (1 - bend) + Math.cos(base) * bend * .6);
      X += Math.cos(dir2) * 10; Y += Math.sin(dir2) * 10; P.push([X, Y]);
    }
    for (k = 1; k <= 14; k++) {                              // 弯弯如芽：方向沿长度慢慢偏，风里摇；枯萎时越往梢越卷
      var s = k / 14;
      ang = base + curl * (.25 * Math.sin(s * 3) + Math.pow(s, 4) * (1.4 + 1.2 * wi)) + .3 * U.noise1(t * .9 + j * 4 + s * 2, sd + j) * s;   // 芽：身子一道 S 弯、梢头回勾；枯萎时整根蜷回
      X += Math.cos(ang) * len / 14; Y += Math.sin(ang) * len / 14;
      P.push([X, Y]);
    }
    if (pk) I.stroke(c, P, { raw: true, n: 36, w: 18 * (1 - .25 * j), a: .3 * pk * A * kj * (1 - .45 * wi), rgb: o.scorch || SCORCH, mode: 'multiply', seed: sd + 13 + j, head: .02, tail: .9, bleed: 0, fade: .6, wob: .3 });   // 浅纸底：光丝下垫一道焦墨
    I.stroke(c, P, { raw: true, n: 36, w: 7 * (1 - .25 * j), a: .22 * A * kj, rgb: [40, 52, 54], mode: 'multiply', seed: sd + 17 + j, head: .02, tail: .85, bleed: 0, fade: .5, wob: .3 });   // 丝下一道暗边：亮底上也分得出丝
    c.save(); c.globalCompositeOperation = 'lighter';
    I.stroke(c, P, { raw: true, n: 36, w: 13 * (1 - .25 * j), a: .13 * A * (1 - .45 * wi), rgb: rgb, seed: sd + 9 + j, head: .02, tail: .9, bleed: 0, fade: .6, wob: .3 });   // 光丝的柔晕（R2 收窄）
    I.stroke(c, P, { raw: true, n: 36, w: 3.6 * (1 - .25 * j), a: .7 * A * (1 - .45 * wi), rgb: rgb, seed: sd + 5 + j, head: .02, tail: .85, bleed: 0, fade: .6, wob: .3, tex: .6 });
    I.stroke(c, P, { raw: true, n: 36, w: 1.2, a: .85 * A * (1 - .5 * wi), rgb: core, seed: sd + 7 + j, head: .02, tail: .75, bleed: 0, fade: .5, wob: .3 });   // 丝芯一线
    var hk = 4 + (j % 3), Hb = [P[hk]], hb = base + sgn * .7;   // 一根更细的分丝
    for (k = 1; k <= 6; k++) { var bx = Hb[k - 1][0] + Math.cos(hb + sgn * k * .12) * len * .07, by = Hb[k - 1][1] + Math.sin(hb + sgn * k * .12) * len * .07; Hb.push([bx, by]); }
    I.stroke(c, Hb, { raw: true, w: 1.4, a: .55 * A * kj * (1 - .5 * wi), rgb: rgb, seed: sd + 21 + j, head: .02, tail: .9, bleed: 0, fade: .5, wob: .2 });
    I.glow(c, X, Y, 9, rgb, .35 * A * kj * (1 - .7 * wi));
    c.restore();
  }
  return [px, py];
};

/* ---------- 细线绷断 I.snap(c, t, o)（5-24 联系绷断、1-03 符线等） ----------
   o: x0,y0,x1,y1 两端, t0 断开时刻, u 断点位置（.5）, rgb, w（2.4）, a, seed, glow 发光（深底缺省 true）。
   断前：绷直、细颤（越近 t0 颤得越急）；断后：两半各自向己端回弹、卷曲、淡去（1.2s）。 */
I.snap = function (c, t, o) {
  var A = o.a == null ? 1 : o.a, sd = o.seed || 3, u = o.u == null ? .5 : o.u, rgb = o.rgb || COL.qing, w = o.w || 2.4, dt = t - (o.t0 || 0);
  if (A <= .003) return;
  var pk = paleK(o), dx = o.x1 - o.x0, dy = o.y1 - o.y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, line = function (P, a) {
    if (pk) I.stroke(c, P, { raw: true, w: w * 5, a: .22 * pk * a, rgb: o.scorch || SCORCH, mode: 'multiply', seed: sd + 2, bleed: 0, fade: 0, wob: .1 });   // 浅纸底：线下垫焦墨
    if (o.glow !== false) { c.save(); c.globalCompositeOperation = 'lighter'; I.stroke(c, P, { raw: true, w: w * 4, a: .12 * a, rgb: rgb, seed: sd, bleed: 0, fade: 0, wob: .1 }); c.restore(); }
    I.stroke(c, P, { raw: true, w: w, a: .9 * a, rgb: rgb, seed: sd + 1, bleed: 0, fade: 0, wob: .1, head: .02, tail: .02 });
  };
  var P = [], i, s;
  if (dt < 0) {
    var amp = 1.5 + 3 * U.clamp(1 + dt / 2, 0, 1), fq = 30 + 40 * U.clamp(1 + dt / 2, 0, 1);
    for (i = 0; i <= 24; i++) { s = i / 24; var v = amp * Math.sin(Math.PI * s) * U.noise1(t * fq + s * 3, sd); P.push([o.x0 + dx * s + nx * v, o.y0 + dy * s + ny * v]); }
    line(P, A);
    return;
  }
  var k = U.clamp(dt / 1.2, 0, 1), fa = A * (1 - k) * (1 - k);
  if (fa <= .003) return;
  if (pk) scorchGlow(c, o.x0 + dx * u, o.y0 + dy * u, 60 * (1 - k) + 14, .45 * pk * A * (1 - k), o);
  c.save(); c.globalCompositeOperation = 'lighter'; I.glow(c, o.x0 + dx * u, o.y0 + dy * u, 40 * (1 - k) + 10, rgb, .6 * A * (1 - k)); c.restore();
  [[o.x0, o.y0, 1], [o.x1, o.y1, -1]].forEach(function (end, side) {
    var len = L * (side ? 1 - u : u) * (1 - .55 * U.easeOut(k)), Q = [], dir = side ? -1 : 1, curl = (side ? -1 : 1) * 3.5 * U.easeOut(k);
    var X = end[0], Y = end[1], ang = Math.atan2(dy * dir, dx * dir);
    Q.push([X, Y]);
    for (var j = 1; j <= 16; j++) { var q = j / 16; ang += curl * q / 16 * 2; X += Math.cos(ang) * len / 16; Y += Math.sin(ang) * len / 16; Q.push([X, Y]); }
    line(Q, fa);
  });
};
/* ---------- 白闪 I.flash(c, k, o)：屏幕坐标整屏一闪（重击、雷鸣）。k 0..1 强度；o.rgb（纸白）, o.x,o.y 光心（偏亮处）, o.mode 'lighter'|'source-over'；
   o.paleBg / o.scorch 浅纸底：四周压一圈焦墨、白只聚在光心（缺省关，原样整屏） ---------- */
I.flash = function (c, k, o) {
  o = o || {};
  if (k <= .003) return;
  var rgb = o.rgb || [252, 250, 244], pk = paleK(o), fx = o.x == null ? W / 2 : o.x, fy = o.y == null ? H * .4 : o.y, kk = Math.min(1, k);
  c.save(); I.screen(c);
  if (pk) {                                                  // 浅纸底：四周先一压焦墨（光心留白），再在光心一团白——闪读作「一亮」而不是纸白盖纸白
    c.globalCompositeOperation = 'multiply';
    var gs = c.createRadialGradient(fx, fy, W * .08, fx, fy, W * .8), sc = o.scorch || SCORCH;
    gs.addColorStop(0, U.rgba(sc, 0)); gs.addColorStop(1, U.rgba(sc, .5 * pk * kk));
    c.fillStyle = gs; c.fillRect(0, 0, W, H);
  }
  c.globalCompositeOperation = o.mode || 'source-over';
  var g = c.createRadialGradient(fx, fy, 0, pk ? fx : W / 2, pk ? fy : H / 2, pk ? W * .42 : W * .75);
  g.addColorStop(0, U.rgba(rgb, kk)); g.addColorStop(1, U.rgba(rgb, pk ? 0 : kk * .7));
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.restore();
};
})();
