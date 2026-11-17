/* 《万古云霄》lib-flow.js —— I.flow：让手绘水墨素材（fx-* 纹理）与场景底图「自己动」。程序只做运动，不画笔触。
   在 lib-rig.js 之后、lib-fx.js 之前载入。全部是 t 的纯函数（位移场 = 种子噪声 × t），无跨帧状态。

   I.flow(c, id, t, o)
     取样：src [sx,sy,sw,sh] 素材像素矩形（缺省：dst 缺省时按 I.plate 的 cover＋cam 取景；否则整张）
     落位：dst [x,y,w,h] 画在 c 当前变换里（缺省：屏幕 1920×1080，等同 I.plate 铺满；o.cam 同 I.plate）
     曲面：map(u,v) → [x,y] 取代 dst 矩形网格（c 当前变换里；如光环把笔触带弯成椭圆），此时 dst 只作遮罩参照
     运动：warp {amp 位移 px（dst 单位）, scale 位移场波长 px（缺省 260）, speed 推进速度（缺省 .12/秒）, oct 层数（2）, seed, dir [dx,dy] 场随时间漂移方向}
           ampAt(u,v) → 0..1 位移的空间权重（u,v 为 dst 归一坐标；如海面只动下半、界域外圈大内圈稳）
           disp(u,v,t) → [dx,dy] 额外位移（dst px，如界域被乱流撞凹）
           scroll [vx,vy] 素材卷动 px/秒（素材像素；尾段交叉渐变成无缝块再平铺；一次只滚一个轴）, repeat 平铺轴上一屏显示几个重复（缺省 1）, scrollOff [x,y] 直接给卷动位移（取代 scroll×t）
           grid [cols,rows] 网格（缺省按 dst 尺寸约每格 90px，最多 28×16）
     抠底：key 'paper' 由纸色反推透明（素材画在宣纸/白底上时用；颜色按「叠在纸上」还原）| 'dark' 亮度即不透明（黑底光效）| 缺省不抠
     染色：tint [r,g,b]（保留浓淡只换颜色，光环青/白金用）, tintMix 0..1（缺省 1）
     遮罩：feather {t,b,l,r} 四边羽化 px | vignette {rx,ry,soft} 椭圆柔边（rx/ry 为 dst 半宽/半高的倍数，缺省 1）|
           wedge {a0, a1, soft, cx, cy} 只显 a0→a1 的扇形（逐段写出，弧度；中心缺省 dst 中心）|
           reveal {k 0..1, type 'bleed' 墨晕从 pts 洇开（缺省）| 'wipe' 沿 dir 推进, pts [[u,v]…], dir [dx,dy], soft, rough, seed}
     合成：mode（'source-over' | 'lighter' | 'multiply' | 'screen' …）, alpha
   贴图法与 lib-rig 相同：每个三角形外扩 .75px 多边形 clip + 仿射 drawImage，用 destination-out + lighter 按覆盖率「替换」，半透明纹理不会在格缝处叠两次。
   位移加在取样坐标上（落位网格固定），所以边缘不露底。
   I.fxTex(name) → {id, src, key}：按名找已落地的 fx 素材（plates 里以 'fx-<name>' 开头的第一张），没有就返回 CINE.FX_STANDIN[name] 替身（本片为空表 → null，效果静默跳过）。 */
(function () {
'use strict';
var CINE = window.CINE, I = CINE.ink, U = CINE.util, W = CINE.W, H = CINE.H;

/* ---------- 素材预处理（按 id+src+key+平铺轴 缓存）：抠纸、无缝平铺带 ---------- */
function prepared(id, im, src, key, tileAxis, sat, dk) {
  sat = sat == null ? 1 : Math.round(sat * 20) / 20;
  return U.cached('flowTex:' + id + ':' + src.join(',') + ':' + (key || '') + ':' + (tileAxis || '') + ':' + sat + ':' + (dk || ''), function () {
    var sw0 = Math.round(src[2]), sh0 = Math.round(src[3]), nx = tileAxis === 'x' ? 3 : 1, ny = tileAxis === 'y' ? 3 : 1;
    var ovx = tileAxis === 'x' ? Math.round(sw0 * .25) : 0, ovy = tileAxis === 'y' ? Math.round(sh0 * .25) : 0, sw = sw0 - ovx, sh = sh0 - ovy;
    var A = U.canvas(sw, sh), ax = A.getContext('2d');          // 无缝块：尾部 ov 一段渐隐叠到开头（交叉渐变平铺，不用镜像，免得出现对称花纹）
    ax.drawImage(im, src[0], src[1], src[2], src[3], 0, 0, sw0, sh0);
    if (ovx || ovy) {
      var E = U.canvas(ovx || sw, ovy || sh), ex = E.getContext('2d');
      ex.drawImage(im, src[0], src[1], src[2], src[3], -(ovx ? sw : 0), -(ovy ? sh : 0), sw0, sh0);
      var gg = ovx ? ex.createLinearGradient(0, 0, ovx, 0) : ex.createLinearGradient(0, 0, 0, ovy);
      gg.addColorStop(0, 'rgba(0,0,0,1)'); gg.addColorStop(1, 'rgba(0,0,0,0)');
      ex.globalCompositeOperation = 'destination-in'; ex.fillStyle = gg; ex.fillRect(0, 0, E.width, E.height);
      var g2 = ovx ? ax.createLinearGradient(0, 0, ovx, 0) : ax.createLinearGradient(0, 0, 0, ovy);   // 开头一段按 0→1 渐入，与渐出的尾段相加（lighter＝预乘线性混合），带 alpha 的素材不会在接缝处变浓
      g2.addColorStop(0, 'rgba(0,0,0,1)'); g2.addColorStop(1, 'rgba(0,0,0,0)');   // destination-out 是「有界」合成（destination-in 会清掉矩形以外）
      ax.globalCompositeOperation = 'destination-out'; ax.fillStyle = g2; ax.fillRect(0, 0, ovx || sw, ovy || sh);
      ax.globalCompositeOperation = 'lighter'; ax.drawImage(E, 0, 0); ax.globalCompositeOperation = 'source-over';
    }
    var px = !!key || sat !== 1 || !!dk, c = U.canvas(sw * nx, sh * ny), x = c.getContext('2d', { willReadFrequently: px });
    for (var j = 0; j < ny; j++) for (var i = 0; i < nx; i++) x.drawImage(A, i * sw, j * sh);
    if (px) {
      var d = x.getImageData(0, 0, c.width, c.height), p = d.data, n = p.length, k, pr = 236, pg = 229, pb = 212;
      if (key === 'paper') {                                   // 纸色：最亮的 3% 像素的均值
        var hist = new Uint32Array(256), tot = 0, need, acc = 0, th = 255, sr = 0, sg = 0, sb = 0, cnt = 0;
        for (k = 0; k < n; k += 16) { hist[(p[k] * 77 + p[k + 1] * 150 + p[k + 2] * 29) >> 8]++; tot++; }
        need = tot * .03;
        while (th > 0 && acc + hist[th] < need) acc += hist[th--];
        for (k = 0; k < n; k += 16) if (((p[k] * 77 + p[k + 1] * 150 + p[k + 2] * 29) >> 8) >= th) { sr += p[k]; sg += p[k + 1]; sb += p[k + 2]; cnt++; }
        if (cnt) { pr = sr / cnt; pg = sg / cnt; pb = sb / cnt; }
        for (k = 0; k < n; k += 4) {                           // 按「颜色 = 纸·(1−a) + 墨·a」反推：a 取三通道里最需要的那个
          var a = Math.max((pr - p[k]) / pr, (pg - p[k + 1]) / pg, (pb - p[k + 2]) / pb, 0);
          a = Math.min(1, a * 1.15);
          if (a < .02) { p[k + 3] = 0; continue; }
          p[k] = U.clamp((p[k] - pr * (1 - a)) / a, 0, 255); p[k + 1] = U.clamp((p[k + 1] - pg * (1 - a)) / a, 0, 255); p[k + 2] = U.clamp((p[k + 2] - pb * (1 - a)) / a, 0, 255);
          p[k + 3] = a * 255;
        }
      } else if (key === 'dark') {
        for (k = 0; k < n; k += 4) p[k + 3] = Math.max(p[k], p[k + 1], p[k + 2]);
      }
      if (sat !== 1) for (k = 0; k < n; k += 4) {               // 压饱和：向灰度收拢（生图素材往往比底图艳）
        var L = p[k] * .3 + p[k + 1] * .59 + p[k + 2] * .11;
        p[k] = L + (p[k] - L) * sat; p[k + 1] = L + (p[k + 1] - L) * sat; p[k + 2] = L + (p[k + 2] - L) * sat;
      }
      if (dk === 'invert') for (k = 0; k < n; k += 4) {         // 暗场：灰黑的墨反成淡银灰到纸色（越浓越亮），有色相的（血红、金、赭）保留
        if (!p[k + 3]) continue;
        var mx = Math.max(p[k], p[k + 1], p[k + 2]), mn = Math.min(p[k], p[k + 1], p[k + 2]), w = 1 - U.smooth((mx - mn - 38) / 50);   // 按色度（绝对值）判：近黑的噪色不算有色
        var q = 1 - (p[k] * .3 + p[k + 1] * .59 + p[k + 2] * .11) / 255;
        p[k] += (88 + 98 * q - p[k]) * w; p[k + 1] += (86 + 96 * q - p[k + 1]) * w; p[k + 2] += (82 + 88 * q - p[k + 2]) * w; p[k + 3] *= 1 - .15 * w;   // 浓墨→约 180 的银灰（不是纸白，免得像雪）
      } else if (dk === 'sil') for (k = 0; k < n; k += 4) {     // 暗场描亮边用的剪影：纸色、半透
        p[k] = 232; p[k + 1] = 226; p[k + 2] = 210; p[k + 3] *= .5;
      }
      x.putImageData(d, 0, 0);
      var c2 = U.canvas(c.width, c.height);                     // 改过像素的画布再拷一遍：putImageData 出来的画布首次被画与之后差 1 级（实测），用拷贝件就稳定
      c2.getContext('2d').drawImage(c, 0, 0); c = c2;
    }
    settle(c);
    c.tw = sw; c.th = sh;
    return c;
  });
}

var SET = null;
function settle(cv) { if (!SET) SET = U.canvas(4, 4).getContext('2d'); SET.drawImage(cv, 0, 0, 4, 4); }   // 新画布先被画一次（同上，首画与后画不一致）
/* ---------- 位移场：两层低频值噪声，随 t 推进 ---------- */
function field(o, t) {
  var w = o.warp || {}, sc = w.scale || 260, sp = w.speed == null ? .12 : w.speed, sd = w.seed || 7, oct = w.oct || 2, dir = w.dir || [0, 0];
  return function (x, y) {
    var X = x / sc + dir[0] * t, Y = y / sc + dir[1] * t, ax = 0, ay = 0, f = 1, g = 1;
    for (var i = 0; i < oct; i++) {
      ax += g * U.noise2(X * f + t * sp * f, Y * f - t * sp * .7 * f, sd + i * 17);
      ay += g * U.noise2(X * f - t * sp * .8 * f + 31, Y * f + t * sp * .6 * f, sd + i * 17 + 5);
      f *= 2.1; g *= .45;
    }
    return [ax, ay];
  };
}

/* ---------- 临时层（按需增大、不缩；可重入：按嵌套深度各一张） ---------- */
var pool = [], depth = 0;
function tmp(w, h) {                                        // 一次就按目标画布整幅分配（中途换新画布会让首次合成差 1 级，结果随历史变，实测）
  var c = pool[depth];
  if (!c || c.width < w || c.height < h) { c = pool[depth] = U.canvas(Math.max(w, c ? c.width : 0), Math.max(h, c ? c.height : 0)); settle(c); }
  depth++;
  return c;
}

/* 三角形贴图（与 lib-rig 同法）：dst 三点 d、src 三点 s；X 为临时层 ctx，T 为 dst→设备 的基变换 */
var EXP = .75;
function tri(X, T, tex, d, s) {
  var s0x = s[0], s0y = s[1], ux = s[2] - s0x, uy = s[3] - s0y, vx = s[4] - s0x, vy = s[5] - s0y, det = ux * vy - uy * vx;
  if (Math.abs(det) < 1e-9) return;
  var ex = d[2] - d[0], ey = d[3] - d[1], fx = d[4] - d[0], fy = d[5] - d[1];
  var ia = vy / det, ib = -uy / det, ic = -vx / det, id = ux / det;        // src 基的逆
  var a = ex * ia + fx * ib, b = ey * ia + fy * ib, c = ex * ic + fx * id, dd = ey * ic + fy * id;
  var e = d[0] - a * s0x - c * s0y, f = d[1] - b * s0x - dd * s0y;
  X.save();
  X.setTransform(T);
  X.beginPath();
  var cx = (d[0] + d[2] + d[4]) / 3, cy = (d[1] + d[3] + d[5]) / 3, sc = Math.hypot(T.a, T.b) || 1;
  for (var i = 0; i < 3; i++) {
    var px = d[i * 2], py = d[i * 2 + 1], l = Math.hypot(px - cx, py - cy) || 1, k = EXP / sc / l * 1.6;
    if (i) X.lineTo(px + (px - cx) * k, py + (py - cy) * k); else X.moveTo(px + (px - cx) * k + 1 / 64, py + (py - cy) * k + 1 / 64);
  }
  X.closePath(); X.clip();
  X.globalCompositeOperation = 'destination-out'; X.fillRect(-1e5, -1e5, 2e5, 2e5);
  X.globalCompositeOperation = 'lighter';
  X.transform(a, b, c, dd, e, f);
  var x0 = Math.min(s0x, s[2], s[4]), x1 = Math.max(s0x, s[2], s[4]), y0 = Math.min(s0y, s[3], s[5]), y1 = Math.max(s0y, s[3], s[5]);
  var sx = Math.max(0, Math.floor(x0) - 2), sy = Math.max(0, Math.floor(y0) - 2), sw = Math.min(tex.width, Math.ceil(x1) + 2) - sx, sh = Math.min(tex.height, Math.ceil(y1) + 2) - sy;
  if (sw > 0 && sh > 0) X.drawImage(tex, sx, sy, sw, sh, sx, sy, sw, sh);
  X.restore();
}

/* ---------- 遮罩 ---------- */
function masks(X, T, o, dst, t) {
  var x = dst[0], y = dst[1], w = dst[2], h = dst[3], f = o.feather, g;
  X.save(); X.setTransform(T);
  if (f) {
    X.globalCompositeOperation = 'destination-out';
    [['t', 0, 1], ['b', 0, -1], ['l', 1, 0], ['r', -1, 0]].forEach(function (s) {
      var q = f[s[0]];
      if (!q) return;
      var x0 = s[0] === 'r' ? x + w : x, y0 = s[0] === 'b' ? y + h : y;
      g = X.createLinearGradient(x0, y0, x0 + s[1] * q, y0 + s[2] * q);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      X.fillStyle = g;
      if (s[0] === 't') X.fillRect(x - 2, y - 2, w + 4, q + 2); else if (s[0] === 'b') X.fillRect(x - 2, y + h - q, w + 4, q + 2);
      else if (s[0] === 'l') X.fillRect(x - 2, y - 2, q + 2, h + 4); else X.fillRect(x + w - q, y - 2, q + 2, h + 4);
    });
  }
  var v = o.vignette;
  if (v) {
    X.globalCompositeOperation = 'destination-in';
    X.save(); X.translate(x + w / 2, y + h / 2); X.scale((v.rx || 1) * w / 2, (v.ry || 1) * h / 2);
    g = X.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(U.clamp(1 - (v.soft == null ? .45 : v.soft), 0, .99), 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    X.fillStyle = g; X.fillRect(-1.2, -1.2, 2.4, 2.4);
    X.restore();
  }
  var wd = o.wedge;
  if (wd && wd.a1 - wd.a0 < Math.PI * 2 - 1e-3) {
    var cx = wd.cx == null ? x + w / 2 : wd.cx, cy = wd.cy == null ? y + h / 2 : wd.cy, sa = wd.soft == null ? .25 : wd.soft, TAU = Math.PI * 2, g0 = wd.a0 - sa;
    X.globalCompositeOperation = 'destination-in';
    g = X.createConicGradient(g0, cx, cy);
    var fr = function (a) { return U.clamp((a - g0) / TAU, 0, 1); };
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(fr(wd.a0), 'rgba(0,0,0,1)');
    g.addColorStop(Math.max(fr(wd.a0), fr(wd.a1 - sa * .5)), 'rgba(0,0,0,1)'); g.addColorStop(Math.max(fr(wd.a0) + 1e-4, fr(wd.a1 + sa * .5)), 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    X.fillStyle = g; X.fillRect(x - w, y - h, w * 3, h * 3);
  }
  var r = o.reveal;
  if (r && r.k < 1) {                                          // 墨晕揭示：低分辨率逐点算前沿（距离＋噪声），放大成软边
    var mw = 160, mh = Math.max(24, Math.round(160 * h / Math.max(1, w))), m = mcv(mw, mh), mx = m.getContext('2d'), id = mx.createImageData(mw, mh), d = id.data;
    var pts = r.pts || [[.5, .5]], dir = r.dir || [0, 1], dl = Math.hypot(dir[0], dir[1]) || 1, sd = r.seed || 3, rough = r.rough == null ? .22 : r.rough, soft = r.soft == null ? .12 : r.soft;
    var front = r.k * (1 + rough + soft) - soft;
    for (var j = 0; j < mh; j++) for (var i = 0; i < mw; i++) {
      var u = (i + .5) / mw, vv = (j + .5) / mh, dd;
      if (r.type === 'wipe') dd = ((u - .5) * dir[0] + (vv - .5) * dir[1]) / dl + .5;
      else { dd = 9; for (var p = 0; p < pts.length; p++) dd = Math.min(dd, Math.hypot((u - pts[p][0]) * w / h, vv - pts[p][1]) * .75); }
      dd += rough * (U.fbm2(u * 5 * w / h, vv * 5, sd, 3) * .5 + .5);
      d[(j * mw + i) * 4 + 3] = 255 * U.clamp((front - dd) / soft + 1, 0, 1);
    }
    mx.putImageData(id, 0, 0);
    X.globalCompositeOperation = 'destination-in'; X.imageSmoothingEnabled = true; X.imageSmoothingQuality = 'low';   // 画布源一律双线性：'high'/'medium' 会用按需生成的 mipmap，结果随此前画过几次而差 1 级（实测），破坏确定性
    X.drawImage(m, 0, 0, mw, mh, x, y, w, h);
  }
  X.restore();
}
var MC = {};
function mcv(w, h) { var k = w + 'x' + h; if (!MC[k]) { MC[k] = U.canvas(w, h); settle(MC[k]); } return MC[k]; }

/* map 模式：落位不是矩形而是 map(u,v) 给的曲面网格（如把一条笔触弯成一圈），bbox 按采样点估 */
function mapCorners(map) {
  var r = [];
  for (var i = 0; i <= 32; i++) for (var j = 0; j <= 2; j++) r.push(map(i / 32, j / 2));
  return r;
}
/* ---------- 主函数 ---------- */
I.flow = function (c, id, t, o) {
  o = o || {};
  var im = I.plateImg(id);
  if (!im) return false;
  if (o.img) { im = o.img; id = id + '#' + (o.imgKey || 'img'); }   // 替身图：同尺寸的加工画布（如盖掉底图穿帮），照常走同一套取景与流动；imgKey 区分预处理缓存
  var iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height, dst = o.dst, src = o.src, P = CINE.px, T0;
  if (!dst && o.map) {
    var mc = mapCorners(o.map), xs = mc.map(function (p) { return p[0]; }), ys = mc.map(function (p) { return p[1]; });
    dst = [Math.min.apply(null, xs), Math.min.apply(null, ys), Math.max.apply(null, xs) - Math.min.apply(null, xs), Math.max.apply(null, ys) - Math.min.apply(null, ys)];
  }
  var screen = !dst;
  if (!dst) {
    dst = [0, 0, W, H];
    if (!src) {
      var cw = iw, ch = ih;
      if (iw / ih > W / H) cw = ih * W / H; else ch = iw * H / W;
      var v = I.plateView(o.cam), k = cw / W;
      src = [(iw - cw) / 2 + (v.x - W / v.z / 2) * k, (ih - ch) / 2 + (v.y - H / v.z / 2) * k, W / v.z * k, H / v.z * k];
    }
    T0 = new DOMMatrix([P, 0, 0, P, 0, 0]);
    if (o.flip === 'h') T0 = T0.translate(W, 0).scale(-1, 1);
  } else T0 = c.getTransform();
  if (!src) src = [0, 0, iw, ih];
  src = src.map(function (q) { return Math.round(q * 100) / 100; });
  var A = (o.alpha == null ? 1 : o.alpha) * c.globalAlpha;
  if (A <= .003) return true;
  var axis = o.scroll ? (o.scroll[0] ? 'x' : o.scroll[1] ? 'y' : '') : '';
  var crop = axis ? src : [Math.floor(src[0]), Math.floor(src[1]), Math.ceil(src[2] + src[0] - Math.floor(src[0])), Math.ceil(src[3] + src[1] - Math.floor(src[1]))];
  var dmode = o.dark === true ? 'invert' : o.dark === 'invert' ? 'invert' : o.dark === 'sil' ? 'sil' : '';
  if (o.dark === 'rim' && !o._rim) {                         // 暗场描亮边：先画外扩一点的纸色剪影（两次错位），再画原样
    var dd = o.dst || dst, pad = Math.max(3, Math.min(dd[2], dd[3]) * .012);
    var ro = Object.assign({}, o, { _rim: 1, dark: 'sil', mode: 'source-over', tint: null, dst: [dd[0] - pad, dd[1] - pad, dd[2] + 2 * pad, dd[3] + 2 * pad] });
    if (!o.map) { I.flow(c, id, t, ro); ro.dst = [dd[0] + pad * .5, dd[1] - pad * 1.5, dd[2], dd[3]]; I.flow(c, id, t, ro); }
    o = Object.assign({}, o, { _rim: 1, dark: '' }); dmode = '';
  }
  var tex = prepared(id, im, crop, o.key, axis, o.sat, dmode), tw = tex.tw, th = tex.th, ox = axis ? 0 : src[0] - crop[0], oy = axis ? 0 : src[1] - crop[1], sw = axis ? tw : src[2], sh = axis ? th : src[3];
  var cs = (o.map ? mapCorners(o.map) : [[dst[0], dst[1]], [dst[0] + dst[2], dst[1]], [dst[0], dst[1] + dst[3]], [dst[0] + dst[2], dst[1] + dst[3]]]).map(function (p) { return T0.transformPoint(new DOMPoint(p[0], p[1])); });
  var bx = Math.max(0, Math.floor(Math.min.apply(null, cs.map(function (p) { return p.x; }))) - 2), by = Math.max(0, Math.floor(Math.min.apply(null, cs.map(function (p) { return p.y; }))) - 2);
  var bx1 = Math.min(c.canvas.width, Math.ceil(Math.max.apply(null, cs.map(function (p) { return p.x; }))) + 2), by1 = Math.min(c.canvas.height, Math.ceil(Math.max.apply(null, cs.map(function (p) { return p.y; }))) + 2);
  var bw = bx1 - bx, bh = by1 - by;
  if (bw <= 0 || bh <= 0) return true;
  var L = tmp(Math.max(bw, c.canvas.width), Math.max(bh, c.canvas.height));
  try {
    var X = L.getContext('2d');
    X.setTransform(1, 0, 0, 1, 0, 0); X.globalCompositeOperation = 'source-over'; X.globalAlpha = 1; X.clearRect(0, 0, bw, bh);
    X.imageSmoothingEnabled = true; X.imageSmoothingQuality = 'low';   // 画布源一律双线性：'high'/'medium' 会用按需生成的 mipmap，结果随此前画过几次而差 1 级（实测），破坏确定性
    var T = new DOMMatrix().translate(-bx, -by).multiply(T0);
    if (axis && o.repeat) { if (axis === 'x') sw *= o.repeat; else sh *= o.repeat; }   // 平铺轴上显示几个重复
    var wp = o.warp || {}, amp = wp.amp || 0, F = amp ? field(o, t) : null, kx = sw / dst[2], ky = sh / dst[3];
    var gcols = o.grid ? o.grid[0] : Math.max(2, Math.min(28, Math.round(dst[2] * Math.hypot(T0.a, T0.b) / P / 90))), grows = o.grid ? o.grid[1] : Math.max(2, Math.min(16, Math.round(dst[3] * Math.hypot(T0.c, T0.d) / P / 90)));
    if (axis && o.repeat) { if (axis === 'x') gcols = Math.max(gcols, Math.ceil(o.repeat * 3)); else grows = Math.max(grows, Math.ceil(o.repeat * 3)); }
    if (o.map) { gcols = o.grid ? o.grid[0] : 64; grows = o.grid ? o.grid[1] : 2; }
    else if (!amp && !o.disp && !axis) { gcols = 1; grows = 1; }
    var offx = axis === 'x' ? (o.scrollOff ? o.scrollOff[0] : o.scroll[0] * t) : 0, offy = axis === 'y' ? (o.scrollOff ? o.scrollOff[1] : o.scroll[1] * t) : 0, nx = gcols + 1, SX = [], SY = [], DX = [], DY = [];
    for (var j = 0; j <= grows; j++) for (var i = 0; i <= gcols; i++) {
      var u = i / gcols, vv = j / grows, ddx = 0, ddy = 0;
      if (F) { var wgt = o.ampAt ? o.ampAt(u, vv) : 1, fv = F(u * dst[2], vv * dst[3]); ddx = amp * wgt * fv[0]; ddy = amp * wgt * fv[1]; }
      if (o.disp) { var e = o.disp(u, vv, t); ddx += e[0]; ddy += e[1]; }
      var sx = ox + u * sw + ddx * kx + offx, sy = oy + vv * sh + ddy * ky + offy;
      if (axis !== 'x') sx = U.clamp(sx, 0, tw); if (axis !== 'y') sy = U.clamp(sy, 0, th);
      SX.push(sx); SY.push(sy);
      if (o.map) { var mp = o.map(u, vv); DX.push(mp[0]); DY.push(mp[1]); } else { DX.push(dst[0] + u * dst[2]); DY.push(dst[1] + vv * dst[3]); }
    }
    for (j = 0; j < grows; j++) for (i = 0; i < gcols; i++) {
      var a = j * nx + i, b = a + 1, cc = a + nx, d = cc + 1, sxs = [SX[a], SX[b], SX[cc], SX[d]], sys = [SY[a], SY[b], SY[cc], SY[d]];
      if (axis === 'x') { var bs = Math.floor(Math.min.apply(null, sxs) / (2 * tw)) * 2 * tw; sxs = sxs.map(function (q) { return q - bs; }); }
      if (axis === 'y') { var bt = Math.floor(Math.min.apply(null, sys) / (2 * th)) * 2 * th; sys = sys.map(function (q) { return q - bt; }); }
      tri(X, T, tex, [DX[a], DY[a], DX[b], DY[b], DX[d], DY[d]], [sxs[0], sys[0], sxs[1], sys[1], sxs[3], sys[3]]);
      tri(X, T, tex, [DX[a], DY[a], DX[d], DY[d], DX[cc], DY[cc]], [sxs[0], sys[0], sxs[3], sys[3], sxs[2], sys[2]]);
    }
    if (o.tint) {
      X.setTransform(1, 0, 0, 1, 0, 0); X.globalCompositeOperation = 'source-atop'; X.globalAlpha = o.tintMix == null ? 1 : o.tintMix;
      X.fillStyle = U.rgba(o.tint, 1); X.fillRect(0, 0, bw, bh); X.globalAlpha = 1;
    }
    masks(X, T, o, dst, t);
    if (screen && !axis && !o.key && !o.mode && !o.reveal && !o.vignette && !o.feather) {   // 铺满的底图：先垫一张不动的原图（取自同一张预处理画布，不走 <img> 解码缓存），
      c.save(); c.setTransform(T0); c.globalAlpha = Math.min(1, A); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'low';   // 格缝/替换合成留下的 254 级透明只会透出同一张图，而不是上一帧（帧间不清屏）
      c.drawImage(tex, ox, oy, sw, sh, 0, 0, W, H); c.restore();
    }
    if (screen && !o.key && !o.mode && I.markPlate) I.markPlate(Math.min(1, A));
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = Math.min(1, A); c.globalCompositeOperation = o.mode || 'source-over';
    c.drawImage(L, 0, 0, bw, bh, bx, by, bw, bh);
    c.restore();
  } finally { depth--; }
  return true;
};

/* ---------- fx 素材查找：已落地的 fx-<name>* 优先，否则替身（现有成品底图裁片；素材到了自动换掉） ---------- */
/* 新片没有旧底图可裁：替身表留空（I.fxTex 缺素材时返回 null，各效果静默跳过）。素材落地后在 CINE.FX_META 补取样参数。 */
CINE.FX_STANDIN = {};
/* 已落地素材的取样参数（alpha 外接框、中心、半径、缺省压饱和等，素材像素）。新素材只要在这里补一行 */
CINE.FX_META = {
  'fx-bloodtide-tex': { src: [0, 86, 1508, 581] },
  'fx-turbid-tex': { src: [0, 102, 1327, 463] },
  'fx-mist-tex': { src: [0, 120, 1508, 520] },
  'fx-strata-tex': {},
  'fx-realm-edge': { c: [553, 548], r: 290, ring: [260, 500] },
  'fx-ring-brush-round': { c: [626, 617], r: 490 },
  'fx-ring-brush-oval': { c: [630, 596], r: 590, flat: 385 / 590 },
  'fx-sunfire-qing': { sat: .55 }, 'fx-sunfire-bai': { sat: .7 }, 'fx-sunfire-hong': { sat: .5 },
  'fx-inksplash-1': { o: [.42, .45] }, 'fx-inksplash-2': { o: [.06, .92] }, 'fx-inksplash-3': { o: [.12, .32] },   // 墨溅的「着纸点」（归一坐标），揭示从这里洇开
  'fx-flywhite-ink': { src: [27, 52, 1615, 314] }, 'fx-flywhite-gold': { src: [27, 76, 1618, 256] },
  'fx-crack-gold': { c: [555, 537], r: 420 }, 'fx-sprout-light': { src: [211, 182, 361, 1207] }
};
function metaOf(id) { var m = CINE.FX_META[id] || {}, r = { id: id, fx: true }; for (var k in m) r[k] = m[k]; return r; }
/* 名字 → 全部已落地的 fx-<名>*（按 id 排序） */
I.fxTexAll = function (name) {
  var ps = window.CINE_PLATES ? Object.keys(window.CINE_PLATES).sort() : [], pre = 'fx-' + name, out = [];
  for (var i = 0; i < ps.length; i++) if (ps[i].indexOf(pre) === 0 && I.plateHas(ps[i])) out.push(metaOf(ps[i]));
  return out;
};
I.fxTex = function (name, pick) {
  var all = I.fxTexAll(name);
  if (all.length) return all[(pick || 0) % all.length];
  var s = CINE.FX_STANDIN[name];
  return s && I.plateHas(s.id) ? s : null;
};
})();
