/* 《万古云霄》lib-motion.js —— v5 动作语法（只新增，不改引擎已有函数）。作者看 v4：「特效偏生硬」。病根：出招几乎都是 U.smooth 淡入淡出，
   没有预备—出手—余震三段、命中无顿帧、无过冲、镜头不吃力、特效一出现就是完整形态。本库给出一套 t 的纯函数（无跨帧状态、无 Math.random/Date）。

   ── 曲线（输入 x 0..1，输出 0..1，可略越界）──────────────────────────────────────
     M.expoOut(x, k=7)          快出慢收：出手。1−2^(−k·x) 归一。
     M.expoIn(x, k=7)           慢起急到：蓄力、落雷、坠落。
     M.backOut(x, s=1.7)        到位后过冲一下再回：落定、立住、字落纸。
     M.backIn(x, s=1.7)         先往回拉一下再走：预备（反向蓄势）。
     M.elastic(x, n=3, d=5)     阻尼弹回：震后余颤（1 − e^(−d·x)·cos(n·π·x)）。
     M.step(x, n)               n 级台阶（逐格动画、闪烁）。
   ── 三段式 ─────────────────────────────────────────────────────────────────────
     M.strike(t, t0, o) → {pre, hit, out, k, imp, phase}
       以命中刻 t0 为锚：预备 [t0−o.pre, t0)（缺省 .5）、出手 [t0−o.go, t0]（缺省 .12，含在预备末段）、余震 [t0, t0+o.post)（缺省 1.2）。
       pre  0→1  预备进度（backIn：先往回收）；hit 0→1 出手进度（expoIn，t0 时恰为 1）；out 1→0 余震衰减（expo）；
       k    位置量：预备期 −o.wind·backIn 的回拉（缺省 .12），出手到 1，余震 backOut 落定在 1；
       imp  冲击量：t0 起 1 衰减到 0（e^(−t/τ)，τ＝o.tau 缺省 .16）；phase 'idle'|'pre'|'go'|'post'|'done'。
   ── 顿帧（hit-stop）─────────────────────────────────────────────────────────────
     M.hitStop(t, list) → t'    list=[[t0, len, catch?]…]：t0 处定住 len 秒，之后 catch 秒（缺省 len*3）内匀加速追回，追完与 t 重合，不改总长。
                                只把「动作」的时间喂 t'，冲击（白闪、震屏、墨圈）仍用真 t，于是定格的那几帧里冲击照样炸开。
   ── 冲击 ───────────────────────────────────────────────────────────────────────
     M.shake(t, t0, o) → [dx, dy, rot]   命中震屏：衰减正弦 amp·e^(−d·u)·sin(2π·f·u)（u＝t−t0），x/y 频率错开、带噪声，缺省 amp 14 px、f 11、d 7、rot .004。
     M.punch(t, t0, o) → z 倍率           镜头冲击推：t0 起 .06 s 冲到 1+amp（缺省 .045），再 backOut .45 s 回 1。
     M.inkRing(c, t, t0, o)               墨圈外扩：一圈断续湿墨环自 (x,y) 以 expoOut 外扩到 r（缺省 420），宽由厚变薄、浓→淡、边缘洇开；
                                          o.flat 压扁（地面/水面上 .3），o.rgb 墨色（缺省焦墨），o.a，o.life（缺省 .9）。软边、不画闭合正圆。
     M.flashInk(c, t, t0, o)              命中白—墨两拍：t0 起 o.white（缺省 .05）秒纸白闪（光心 o.x,o.y，半径收在画心，非整屏平涂），
                                          随后 o.ink（缺省 .07）秒四角焦墨一压（multiply），再 .25 s 退尽。只在设计好的重击用（≤全片 15 处）。
     M.dust(c, t, t0, o)                  余墨迸点：n 粒墨点沿 dir±spread 迸出，expoOut 飞行、重力 g、末段淡尽；纯 t（种子 o.seed）。
   ── 生长（替代整体淡入）─────────────────────────────────────────────────────────
     M.grow(t, t0, dur, o) → k            笔势进度：前 15% 快写（起笔顿）、中段匀、末 20% 收笔慢；配合 I.stroke 的 o.k 用。
     M.reveal(c, t, t0, dur, draw, o)     墨洇揭示：draw(c) 画进离屏层，以噪声阈值从 o.from（[x,y]，缺省画心）向外洇开显出，边缘一圈湿墨；
                                          dur 内完成，之后直接画。用于「法相/光阵/题注」出现——不再是整张透明度淡入。
     M.unreveal(c, t, t0, dur, draw, o)   反向：墨散退去。
   ── 运镜 ───────────────────────────────────────────────────────────────────────
     M.cam(t, keys) → {x,y,zoom}          关键帧运镜：keys=[[t, {x,y,zoom}, ease?]…]，每段可指定 ease（'expoOut' 'expoIn' 'backOut' 'smooth' 'linear'，缺省 smooth）；
                                          返回值直接给 I.plateView / I.plate 的 cam。
     M.follow(t, t0, t1, from, to, o)     跟镜：t0→t1 由 from 移到 to，前 .2 慢起、后 .25 惯性超出 o.over（缺省 .04）再收回。
   ── v5 FX 诊断补充（docs：wanggu-v5-work/diag/out-FX.md 第二节）────────────────────
     M.kick(t, t0, o) → {dx, dy, rot, z}  有方向的阻尼回弹震（替代各幕 noise×线性衰减的 shake/shakeAmt/shaken）：s＝e^(−ζωτ)·cos(ω_d·τ)，
                                          位移 amp·dir·s（dir＝施力方向，弧度，缺省向下 π/2；o.side 0..1 横向噪声分量 .25），rot .006·s，z 1+zAmp·punch。
                                          缺省 amp 14、f 6 Hz、ζ .4、life 1.0、zAmp .035。叠到镜头上：cam.x −= dx/zoom、cam.y −= dy/zoom、zoom *= z。
     M.inkShock(c, t, o)                  墨浪冲击环：11 段切向拉长的淡墨团沿一圈外扩（r＝R·expOut），厚由 60 收到 10，噪声低处留缺口，前缘甩墨点；不画描边。
                                          o: x,y, R 600, dur 1.1, flat .45, rgb, a .5, seed, inward（true＝由外向内收：吸气）。
     M.inkPath(c, t, o)                   带拖尾的笔势：沿 o.pts 由头 u_h＝easeIn(age/dur) 推进，尾滞后 o.lag（.06s），拖尾随速度变长、宽 w·sin(πu)^.6；
                                          到头后断成 3–5 段、o.dry（.5s）内收干。o: pts, t0, dur .14, w 24, rgb, a, seed, glow（淡光晕 rgb，可缺）。
     M.after(c, t, t0, o) → amp           命中后余波：o.n（24）块碎墨按解析解飞散（阻尼 3.5、重力 260），活 o.life（2.6s）；烟尘 o.smoke（3.5s）缓漂；
                                          返回 4+26·e^(−τ/.8)（τ＝t−t0，τ<0 时 0）给切后插画的 I.flow warp.amp 用，撑住「后果 2–4 秒」。
   全部函数对 t 连续（顿帧除外，那是有意的）；超出作用区间时返回中性值（0、1 或原值），可放心每帧调用。 */
(function () {
'use strict';
var CINE = window.CINE, I = CINE.ink, U = CINE.util, W = CINE.W, H = CINE.H;
var M = CINE.motion = {};
var TAU = Math.PI * 2;
function cl(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

/* ---------------- 曲线 ---------------- */
M.expoOut = function (x, k) { x = cl(x); k = k || 7; return x >= 1 ? 1 : (1 - Math.pow(2, -k * x)) / (1 - Math.pow(2, -k)); };
M.expoIn = function (x, k) { x = cl(x); k = k || 7; return x <= 0 ? 0 : (Math.pow(2, k * (x - 1)) - Math.pow(2, -k)) / (1 - Math.pow(2, -k)); };
M.backOut = function (x, s) { x = cl(x); s = s == null ? 1.7 : s; var y = x - 1; return 1 + (s + 1) * y * y * y + s * y * y; };
M.backIn = function (x, s) { x = cl(x); s = s == null ? 1.7 : s; return (s + 1) * x * x * x - s * x * x; };
M.elastic = function (x, n, d) { x = cl(x); n = n || 3; d = d || 5; return x >= 1 ? 1 : 1 - Math.exp(-d * x) * Math.cos(n * Math.PI * x); };
M.step = function (x, n) { x = cl(x); n = n || 4; return Math.min(1, Math.floor(x * n + 1e-9) / n); };
M.ease = function (name) {
  return name === 'expoOut' ? M.expoOut : name === 'expoIn' ? M.expoIn : name === 'backOut' ? M.backOut : name === 'backIn' ? M.backIn :
    name === 'linear' ? cl : name === 'easeOut' ? U.easeOut : name === 'easeIn' ? U.easeIn : U.smooth;
};

/* ---------------- 三段式 ---------------- */
M.strike = function (t, t0, o) {
  o = o || {};
  var pre = o.pre == null ? .5 : o.pre, go = Math.min(o.go == null ? .12 : o.go, pre), post = o.post == null ? 1.2 : o.post;
  var wind = o.wind == null ? .12 : o.wind, tau = o.tau == null ? .16 : o.tau, over = o.over == null ? .06 : o.over, u = t - t0;
  var r = { pre: 0, hit: 0, out: 0, k: 0, imp: 0, phase: 'idle' };
  if (u < -pre) return r;
  if (u < 0) {
    r.pre = cl((u + pre) / pre);
    if (u < -go) {                                         // 预备：往回收到 −wind（蓄势），越近出手越慢——U.smooth
      r.k = -wind * U.smooth((u + pre) / Math.max(.001, pre - go));
      r.phase = 'pre';
    } else {                                               // 出手：自 −wind 急到 1（expoIn，t0 恰到）
      r.hit = M.expoIn((u + go) / go, 5);
      r.k = U.lerp(-wind, 1, r.hit);
      r.phase = 'go';
    }
    return r;
  }
  r.pre = 1; r.hit = 1; r.imp = Math.exp(-u / tau);
  if (u < post) {                                          // 余震：过冲 over 后落定在 1；out 1→0
    var v = u / post;
    r.out = 1 - M.expoOut(v, 5);
    r.k = 1 + over * Math.sin(Math.PI * cl(v / .45)) * (1 - cl(v / .45));
    r.phase = 'post';
  } else { r.k = 1; r.phase = 'done'; }
  return r;
};

/* ---------------- 顿帧 ---------------- */
M.hitStop = function (t, list) {
  var out = t;
  for (var i = 0; i < list.length; i++) {
    var t0 = list[i][0], len = list[i][1], cat = list[i][2] == null ? len * 3 : list[i][2];
    var u = t - t0;
    if (u <= 0 || u >= len + cat) continue;
    if (u < len) { out -= u; continue; }                 // 定住：动作时间停在 t0
    var v = (u - len) / cat;                              // 追回：动作时间自 t0 起 cat 秒内走完 len+cat；三次曲线 p(v)=(3L+2C)v²−(2L+C)v³：起速 0、末速＝真 t 的速度，位置与速度都连续
    out = t0 + (3 * len + 2 * cat) * v * v - (2 * len + cat) * v * v * v;
  }
  return out;
};

/* ---------------- 冲击 ---------------- */
M.shake = function (t, t0, o) {
  o = o || {};
  var u = t - t0, life = o.life == null ? .7 : o.life;
  if (u < 0 || u > life) return [0, 0, 0];
  var amp = o.amp == null ? 14 : o.amp, f = o.f == null ? 11 : o.f, d = o.d == null ? 7 : o.d, sd = o.seed || 7;
  var e = amp * Math.exp(-d * u) * (1 - U.smooth((u - life * .7) / (life * .3)));
  var nx = .75 + .25 * U.noise1(u * 9, sd), ny = .75 + .25 * U.noise1(u * 9, sd + 3);
  return [e * nx * Math.sin(TAU * f * u + .3), e * .62 * ny * Math.sin(TAU * f * 1.31 * u + 1.7), (o.rot == null ? .004 : o.rot) * Math.exp(-d * u) * Math.sin(TAU * f * .7 * u)];
};
M.punch = function (t, t0, o) {
  o = o || {};
  var u = t - t0, amp = o.amp == null ? .045 : o.amp, up = o.up == null ? .06 : o.up, back = o.back == null ? .45 : o.back;
  if (u < 0 || u > up + back) return 1;
  if (u < up) return 1 + amp * M.expoOut(u / up, 4);
  var v = (u - up) / back;
  return 1 + amp * (1 - M.backOut(v, 1.2));
};
M.inkRing = function (c, t, t0, o) {
  o = o || {};
  var u = t - t0, life = o.life == null ? .9 : o.life;
  if (u < 0 || u > life) return;
  var x = o.x == null ? W / 2 : o.x, y = o.y == null ? H / 2 : o.y, R = o.r == null ? 420 : o.r, flat = o.flat == null ? 1 : o.flat;
  var k = M.expoOut(u / life, 6), a = (o.a == null ? .55 : o.a) * (1 - U.smooth((u / life - .35) / .65)), rgb = o.rgb || [34, 28, 24], sd = o.seed || 11;
  if (a <= .003) return;
  var r = R * (.08 + .92 * k), w = (o.w == null ? 46 : o.w) * (1 - .75 * k) + 4, N = 34, rot = o.rot || 0;
  c.save();
  c.translate(x, y); if (rot) c.rotate(rot); c.scale(1, flat);
  I.wash(c, 0, 0, r * 1.08, r * 1.08, a * .18 * (1 - k), sd, rgb, 0, { edge: 'soft' });
  for (var s = 0; s < 3; s++) {                           // 三段断续弧，每段长短随噪声，接头错开——不成闭合正圆
    var a0 = s / 3 * TAU + U.noise1(sd + s, 3) * .5 + .4 * k, span = TAU / 3 * (.62 + .22 * U.noise1(sd + s * 7, 5));
    var pts = [];
    for (var i = 0; i <= N; i++) {
      var q = a0 + span * i / N, rr = r * (1 + .07 * U.noise1(q * 3 + sd, 9) + .04 * U.noise1(q * 9, sd + 2));
      pts.push([Math.cos(q) * rr, Math.sin(q) * rr]);
    }
    I.stroke(c, pts, { w: w, a: a * (.75 + .25 * U.noise1(s, sd)), rgb: rgb, seed: sd + s, head: .25, tail: .35, wob: .12, bleed: .25 });
  }
  c.restore();
};
M.flashInk = function (c, t, t0, o) {
  o = o || {};
  var u = t - t0, wt = o.white == null ? .05 : o.white, it = o.ink == null ? .07 : o.ink;
  if (u < 0 || u > wt + it + .28) return;
  var x = o.x == null ? W / 2 : o.x, y = o.y == null ? H * .45 : o.y, A = o.a == null ? 1 : o.a;
  c.save(); I.screen(c);
  if (u < wt + .06) {                                   // 白：光心一团纸白，外圈收得快；不平涂整屏
    var kw = A * (u < wt ? 1 : 1 - (u - wt) / .06);
    var g = c.createRadialGradient(x, y, 0, x, y, W * .62);
    g.addColorStop(0, U.rgba([252, 250, 244], .96 * kw)); g.addColorStop(.45, U.rgba([250, 247, 238], .7 * kw)); g.addColorStop(1, U.rgba([246, 241, 230], .18 * kw));
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }
  if (u >= wt) {                                        // 墨：四角焦墨一压（multiply），再退
    var v = u - wt, ki = A * (v < it ? M.expoOut(v / it, 4) : 1 - U.smooth((v - it) / .28));
    if (ki > .003) {
      c.globalCompositeOperation = 'multiply';
      var g2 = c.createRadialGradient(x, y, W * .05, x, y, W * .78);
      g2.addColorStop(0, U.rgba([210, 200, 186], .0)); g2.addColorStop(.55, U.rgba([120, 104, 90], .35 * ki)); g2.addColorStop(1, U.rgba([60, 50, 44], .62 * ki));
      c.fillStyle = g2; c.fillRect(0, 0, W, H);
    }
  }
  c.restore();
};
M.dust = function (c, t, t0, o) {
  o = o || {};
  var u = t - t0, life = o.life == null ? 1.1 : o.life;
  if (u < 0 || u > life) return;
  var n = o.n || 18, sd = o.seed || 21, r0 = U.rng(sd), dir = o.dir == null ? -Math.PI / 2 : o.dir, sp = o.spread == null ? 1.2 : o.spread;
  var x = o.x == null ? W / 2 : o.x, y = o.y == null ? H / 2 : o.y, v0 = o.v == null ? 520 : o.v, g = o.g == null ? 420 : o.g, rgb = o.rgb || [30, 24, 20], A = o.a == null ? .8 : o.a;
  for (var i = 0; i < n; i++) {
    var ang = dir + (r0() * 2 - 1) * sp, vv = v0 * (.35 + .65 * r0()), sz = (o.size || 9) * (.4 + .8 * r0()), lf = life * (.55 + .45 * r0());
    if (u > lf) continue;
    var q = u / lf, d = vv * lf * M.expoOut(q, 4) * .55;
    var px = x + Math.cos(ang) * d, py = y + Math.sin(ang) * d + .5 * g * u * u;
    var a = A * (1 - U.smooth((q - .45) / .55));
    if (a <= .003) continue;
    c.fillStyle = U.rgba(rgb, a);
    I.blot(c, px, py, Math.max(.8, sz * (1 - .5 * q)), sd + i * 13, { rough: .3, n: 10, sx: 1 + .8 * (1 - q), sy: .85, rot: ang });
    c.fill();
  }
};

/* ---------------- 生长 ---------------- */
M.grow = function (t, t0, dur, o) {
  var x = cl((t - t0) / dur);
  if (x <= 0 || x >= 1) return x;
  /* 分段：0–.15 快写到 .26（起笔顿后快行）、.15–.8 匀到 .9、.8–1 收笔慢到 1 */
  if (x < .15) return .26 * M.expoOut(x / .15, 3);
  if (x < .8) return .26 + .64 * (x - .15) / .65;
  return .9 + .1 * U.easeOut((x - .8) / .2);
};
function revealMask(w, h, sd) {                         // 低分辨率噪声阈值场（按尺寸＋种子缓存）：值 0..1，越小越先显出
  return U.cached('mrev:' + w + 'x' + h + ':' + sd, function () {
    var a = new Float32Array(w * h);
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) a[j * w + i] = .5 + .5 * U.fbm2(i / 9, j / 9, sd, 3);
    return a;
  });
}
M.reveal = function (c, t, t0, dur, draw, o) {
  o = o || {};
  var x = cl((t - t0) / dur);
  if (x <= 0) return;
  if (x >= 1 && !o.keepMask) { c.save(); draw(c); c.restore(); return; }
  var L = U.layerAcquire('mreveal'), M2 = U.layerAcquire('mrevealM');
  try {
    L.setTransform(c.getTransform()); L.save(); draw(L); L.restore();
    var fr = o.from || [W / 2, H / 2], gw = 96, gh = 54, sd = o.seed || 31, F = revealMask(gw, gh, sd);
    var cv = U.cached('mrevCv:' + gw + 'x' + gh, function () { return U.canvas(gw, gh); });
    var mx = cv.getContext('2d'), id = mx.createImageData(gw, gh), d = id.data;
    var e = M.expoOut(x, 4), soft = o.edge == null ? .12 : o.edge, fx = fr[0] / W, fy = fr[1] / H, dmax = Math.sqrt(Math.max(fx, 1 - fx) * Math.max(fx, 1 - fx) + Math.max(fy, 1 - fy) * Math.max(fy, 1 - fy));
    for (var j = 0; j < gh; j++) for (var i = 0; i < gw; i++) {
      var dx = (i + .5) / gw - fx, dy = ((j + .5) / gh - fy) * .62, dd = Math.sqrt(dx * dx + dy * dy) / dmax;
      var thr = dd * .7 + F[j * gw + i] * .3;              // 离源越远、噪声越大越晚显
      var v = cl((e * (1 + soft) - thr) / soft), k = (j * gw + i) * 4;
      d[k] = d[k + 1] = d[k + 2] = 0; d[k + 3] = v * 255;
    }
    mx.putImageData(id, 0, 0);
    var Lc = L.canvas;
    L.save(); L.setTransform(1, 0, 0, 1, 0, 0); L.globalCompositeOperation = 'destination-in'; L.imageSmoothingEnabled = true; L.imageSmoothingQuality = 'low';
    L.drawImage(cv, 0, 0, Lc.width, Lc.height); L.restore();
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(Lc, 0, 0); c.restore();
    if (o.rim !== false && x < 1) {                        // 洇开的前沿：一圈淡湿墨（只在揭示途中）
      var ra = (o.rim == null ? .16 : o.rim) * (1 - x);
      if (ra > .003) {
        M2.setTransform(1, 0, 0, 1, 0, 0); M2.globalCompositeOperation = 'source-over'; M2.imageSmoothingEnabled = true;
        M2.drawImage(cv, 0, 0, Lc.width, Lc.height);
        M2.globalCompositeOperation = 'source-in'; M2.fillStyle = U.rgba(o.rimRgb || [70, 60, 52], 1); M2.fillRect(0, 0, Lc.width, Lc.height);
        c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha *= ra; c.globalCompositeOperation = 'multiply'; c.drawImage(M2.canvas, -2, -2, Lc.width + 4, Lc.height + 4); c.restore();
      }
    }
  } finally { U.layerRelease('mrevealM'); U.layerRelease('mreveal'); }
};
M.unreveal = function (c, t, t0, dur, draw, o) {
  var x = cl((t - t0) / dur);
  if (x >= 1) return;
  if (x <= 0) { c.save(); draw(c); c.restore(); return; }
  M.reveal(c, t0 + (1 - x) * dur, t0, dur, draw, Object.assign({}, o, { rim: false }));
};

/* ---------------- 运镜 ---------------- */
M.cam = function (t, keys) {
  if (t <= keys[0][0]) return Object.assign({}, keys[0][1]);
  for (var i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      var a = keys[i - 1], b = keys[i], k = M.ease(b[2])((t - a[0]) / (b[0] - a[0])), r = {};
      for (var p in b[1]) r[p] = U.lerp(a[1][p] == null ? b[1][p] : a[1][p], b[1][p], k);
      for (var q in a[1]) if (r[q] == null) r[q] = a[1][q];
      return r;
    }
  }
  return Object.assign({}, keys[keys.length - 1][1]);
};
M.follow = function (t, t0, t1, from, to, o) {
  o = o || {};
  var x = cl((t - t0) / (t1 - t0)), over = o.over == null ? .04 : o.over;
  var k = x < .8 ? U.smooth(x / .8) * (1 + over) : 1 + over * (1 - M.backOut((x - .8) / .2, 1));
  var r = {};
  for (var p in to) r[p] = U.lerp(from[p] == null ? to[p] : from[p], to[p], k);
  return r;
};
/* ---------------- v5 FX 补充 ---------------- */
M.kick = function (t, t0, o) {
  o = o || {};
  var u = t - t0, life = o.life == null ? 1.0 : o.life;
  if (u < 0 || u > life) return { dx: 0, dy: 0, rot: 0, z: 1 };
  var amp = o.amp == null ? 14 : o.amp, f = o.f == null ? 6 : o.f, ze = o.zeta == null ? .4 : o.zeta, w = TAU * f, wd = w * Math.sqrt(1 - ze * ze);
  var fade = 1 - U.smooth((u - life * .75) / (life * .25));
  var sv = Math.exp(-ze * w * u) * Math.cos(wd * u) * fade, dir = o.dir == null ? Math.PI / 2 : o.dir, side = o.side == null ? .25 : o.side, sd = o.seed || 3;
  var n = side * U.noise1(u * 17, sd) * Math.exp(-ze * w * u) * fade;
  return {
    dx: amp * (Math.cos(dir) * sv - Math.sin(dir) * n), dy: amp * (Math.sin(dir) * sv + Math.cos(dir) * n),
    rot: (o.rot == null ? .006 : o.rot) * sv, z: 1 + (o.zAmp == null ? .035 : o.zAmp) * (u < .05 ? M.expoOut(u / .05, 4) : Math.exp(-(u - .05) / .18))
  };
};
M.kickCam = function (cam, k) {                            // 把 kick 叠到 I.plateView/I.plate 的 cam 上（zoom 1 时临时抬到 1.02，免被夹边吃掉）
  if (!k || (!k.dx && !k.dy && k.z === 1)) return cam;
  var z = Math.max(1.02, (cam.zoom || 1)) * (k.z || 1);
  return { x: (cam.x || 0) - k.dx / z, y: (cam.y || 0) - k.dy / z, zoom: z };
};
M.inkShock = function (c, t, o) {
  o = o || {};
  var u = t - (o.t0 || 0), dur = o.dur == null ? 1.1 : o.dur;
  if (u < 0 || u > dur) return;
  var k = u / dur, e = o.inward ? 1 - M.expoOut(k, 4) : M.expoOut(k, 4), R = o.R == null ? 600 : o.R, flat = o.flat == null ? .45 : o.flat;
  var A = (o.a == null ? .5 : o.a) * (o.inward ? U.smooth(k / .25) * (1 - U.smooth((k - .8) / .2)) : 1 - U.smooth((k - .3) / .7)), rgb = o.rgb || [40, 33, 28], sd = o.seed || 17, N = 11;
  if (A <= .003) return;
  var x = o.x == null ? W / 2 : o.x, y = o.y == null ? H / 2 : o.y, th = 10 + 50 * Math.pow(1 - e, .6);
  c.save(); c.translate(x, y); c.scale(1, flat);
  for (var i = 0; i < N; i++) {
    var q = (i + .5) / N * TAU + .35 * U.noise1(sd + i, 2), gap = .5 + .5 * U.noise1(i * 1.9 + k * 2, sd + 4);
    if (gap < .3) continue;                                 // 噪声低处留缺口
    var rr = R * (.06 + .94 * e) * (1 + .14 * U.noise2(1.5 * Math.cos(q), 1.5 * Math.sin(q), sd));
    var px = Math.cos(q) * rr, py = Math.sin(q) * rr, len = Math.max(th * 1.2, rr * TAU / N * .55);
    I.wash(c, px, py, len, th, A * gap, sd + i, rgb, q + Math.PI / 2, { edge: 'wet' });
    if (!o.inward && k < .45 && (i % 3 === 0)) {
      var r0 = U.rng(sd * 7 + i);
      for (var j = 0; j < 2; j++) { var d = rr * (1.04 + .1 * r0()), qq = q + r0.pm(.12); c.fillStyle = U.rgba(rgb, A * .8); I.blot(c, Math.cos(qq) * d, Math.sin(qq) * d, 3 + 5 * r0() * (1 - k), sd + i * 5 + j, { rough: .3, n: 10 }); c.fill(); }
    }
  }
  c.restore();
};
M.inkPath = function (c, t, o) {
  var P = o.pts, age = t - (o.t0 || 0), dur = o.dur == null ? .14 : o.dur, lag = o.lag == null ? .06 : o.lag, dry = o.dry == null ? .5 : o.dry;
  if (!P || P.length < 2 || age < 0 || age > dur + lag + dry) return;
  var L = [0], i;
  for (i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  var tot = L[L.length - 1], sd = o.seed || 9;
  function at(u) { var s2 = u * tot, j = 1; while (j < L.length - 1 && L[j] < s2) j++; var f = (s2 - L[j - 1]) / Math.max(1e-6, L[j] - L[j - 1]); return [U.lerp(P[j - 1][0], P[j][0], f), U.lerp(P[j - 1][1], P[j][1], f)]; }
  var uh = U.easeIn(U.clamp(age / dur, 0, 1)), ut = U.easeIn(U.clamp((age - lag) / dur, 0, 1));
  var A = (o.a == null ? .9 : o.a) * (1 - U.smooth((age - dur - lag) / dry)), w = o.w == null ? 24 : o.w, rgb = o.rgb || [36, 30, 26];
  if (A <= .003 || uh - ut < .002) return;
  var segs = age > dur + lag * .5 ? 4 : 1;                 // 到头后断成几段收干
  for (var sg = 0; sg < segs; sg++) {
    var a0 = U.lerp(ut, uh, sg / segs) + (segs > 1 ? .02 : 0), a1 = U.lerp(ut, uh, (sg + 1) / segs) - (segs > 1 ? .02 : 0);
    if (a1 - a0 < .004) continue;
    var pts = [], n = 18;
    for (i = 0; i <= n; i++) {
      var u = U.lerp(a0, a1, i / n), p = at(u), p2 = at(Math.min(1, u + .01)), nx = -(p2[1] - p[1]), ny = p2[0] - p[0], nl = Math.hypot(nx, ny) || 1, off = .03 * tot * U.noise1(u * 7, sd) * .3;
      pts.push([p[0] + nx / nl * off, p[1] + ny / nl * off]);
    }
    if (o.glow) I.wash(c, pts[n >> 1][0], pts[n >> 1][1], (a1 - a0) * tot * .6 + w, w * 2.2, A * .25, sd + sg, o.glow, Math.atan2(pts[n][1] - pts[0][1], pts[n][0] - pts[0][0]), { edge: 'soft' });
    I.stroke(c, pts, { w: w, a: A, rgb: rgb, seed: sd + sg, wf: function (q) { return .25 + .75 * Math.pow(Math.sin(Math.PI * q), .6); }, wob: .1, bleed: .22, fb: .2 });
  }
};
M.after = function (c, t, t0, o) {
  o = o || {};
  var u = t - t0;
  if (u < 0) return 0;
  var life = o.life == null ? 2.6 : o.life, sm = o.smoke == null ? 3.5 : o.smoke, x = o.x == null ? W / 2 : o.x, y = o.y == null ? H / 2 : o.y, sd = o.seed || 41;
  var rgb = o.rgb || [34, 28, 24], A0 = o.a == null ? .75 : o.a;
  if (c && u < life) {
    var n = o.n || 24, r0 = U.rng(sd), dmp = 3.5, g = o.g == null ? 260 : o.g;
    for (var i = 0; i < n; i++) {
      var ang = (o.dir == null ? -Math.PI / 2 : o.dir) + (r0() * 2 - 1) * (o.spread == null ? 1.6 : o.spread), v = (o.v || 380) * (.3 + .7 * r0()), sz = (o.size || 7) * (.5 + r0());
      var lf = life * (.5 + .5 * r0()); if (u > lf) continue;
      var e = (1 - Math.exp(-dmp * u)) / dmp;                       // 阻尼位移的解析解
      var px = x + Math.cos(ang) * v * e, py = y + Math.sin(ang) * v * e + .5 * g * u * u * Math.exp(-u * .6);
      var a = A0 * (1 - U.smooth((u / lf - .4) / .6));
      if (a <= .003) continue;
      c.fillStyle = U.rgba(rgb, a); I.blot(c, px, py, Math.max(.8, sz * (1 - .4 * u / lf)), sd + i * 11, { rough: .3, n: 10 }); c.fill();
    }
  }
  if (c && u < sm) {
    var sa = (o.smokeA == null ? .16 : o.smokeA) * U.smooth(u / .3) * (1 - U.smooth((u - sm * .4) / (sm * .6)));
    for (var j = 0; j < 4; j++) I.wash(c, x + (j - 1.5) * 70 + 30 * u * (j % 2 ? 1 : -1), y - 40 * u - j * 20, 160 + 60 * u, 90 + 30 * u, sa, sd + j, o.smokeRgb || [118, 110, 100], 0, { edge: 'soft' });
  }
  return 4 + 26 * Math.exp(-u / .8);
};
})();
