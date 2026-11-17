/* 《万古云霄》lib-text.js —— 上屏文字：字幕 I.sub、题注 I.note、大字 I.big、印章 I.seal / I.sealColumn、账本出字 I.ledger。
   T05 新增：I.inner 心声、I.arrayVoice/I.arrayWave 秘阵声、I.motes/I.moteText 萤光点、I.slip 传讯、I.line/I.speakerDot 说话人色点。
   全部是 t 的纯函数（种子随机），画在屏幕逻辑坐标（忽略镜头）。实际画出的字幕/题注登记进 CINE._textLog（验收：题签与字幕不同屏）。
   字号：字幕缺省 CINE.SUB.size = 64 逻辑 px（codex 版 54 的 1.18 倍；BRIEF §9.1 要求 ≥1.15 倍，终值由协调者在 1080p 截图上定，改这一处即可）。
   1024 反馈改版（feedback-1024 任务 B，GRILL Q1/Q9/Q10）：旁白/对白/心声/传讯不再逐字扫出，整句淡入淡出（各 CINE.SUB.fade＝.25s）；
   对白去句首色点，改冠说话人名（小字 ×.68、隔 .8em，墨色为正文八成浓度；暗景纸色同理；任务 F 由 ×.55 淡墨加强）；对白按账本「字位」落说话人一侧底部；
   取消整幅底带，只在字压到深色/繁杂处补局部柔雾（逐字取样，沿行起伏，柔边不成矩形）；传讯去硬纸条与投影，改柔边淡纸。 */
(function () {
'use strict';
var CINE = window.CINE, I = CINE.ink, U = CINE.util, W = CINE.W, H = CINE.H, F = CINE.FONT;
var PAPER = [240, 232, 214], INK = [30, 25, 21], QING = [95, 168, 181], QBAI = [207, 237, 234], TURBID = [178, 170, 132];
var CYAN = [111, 167, 181], CYAN_DK = [38, 92, 104];       // 余慈青（BRIEF §4 石青灰；暗底/纸底各一档）
/* 心声按说话人换色（修订 v2，BEATSHEET 4-11 / §6.5-4）：未登记的说话人一律余慈青。血府老祖＝暗干血色：纸底字 [118,40,34]；
   暗底字提亮成淡干血 [198,128,114]（[118,40,34] 压在暗底上读不出）。rim：暗红描边（暗底描在浅字外，纸底淡淡加粗一圈同色）。 */
var INNER_TONE = { '血府老祖': { light: [198, 128, 114], ink: [118, 40, 34], rim: [118, 40, 34] } };
var IRON = [156, 171, 177], IRON_DK = [58, 75, 82];        // 三元秘阵冷铁灰（略石青）
var MOTE = [196, 232, 226], MOTE_DK = [30, 68, 72];        // 萤光点小字（暗底/纸底；纸底再压深一档保证 C20）
CINE.SUB = { size: 64, cps: 1 / .06, band: .5, maxW: W * .74, fade: .25, sideW: W * .55, edge: .05, name: .68, nameGap: .8,
  /* v5（TXT 第 5 条）按类型出字：旁白 .35s 淡入＋模糊 3→0px＋下沉 6→0px（墨洇入纸）；对白说话人名先出、正文晚 .12s 以 .15s 快进；心声 .45s 淡入＋上浮 12px。
     tools/sub-lint.mjs 纸面模式 STYLE 与 tools/ledger-retime.py 的退场常数照此同步（改这里要一起改）。v5 TXT 第 6 条：侧位对白 sideW .42W→.55W。 */
  narrIn: .35, narrBlur: 3, narrSink: 6, narrSharp: .7, lineIn: .15, nameLead: .12, innerIn: .45, innerRise: 12 };
var NAME_SEP = '　';                                   // I.ledger 把说话人名以全角空格接在对白前（体检按上屏实字计数，人名计入字数）；I.sub 再拆开
var NAME_INK = [72, 66, 60], NAME_LT = [210, 203, 187];     // 说话人名：正文八成浓度——浅景＝INK 八成压在纸上；暗景＝PAPER 八成压在暗底（任务 F：缩到 960 宽仍认得出）
/* 对白说话人色点（剑破机制：说话人 → 固定色）。1024 改版起 I.sub 不再画句首圆点（改冠说话人名）；
   I.speaker(name, rgb) 可补登；I.speakerDot 仍可单独画（演示幕的图例也用它）。 */
var SPEAKERS = CINE.SPEAKERS = I.SPEAKERS = {
  '余慈': [111, 167, 181], '赵相山': [63, 111, 158], '华夫人': [198, 126, 120],
  '孙维帧': [116, 128, 134], '血府老祖': [124, 38, 34], '幻荣夫人': [92, 76, 98]
};
I.speaker = function (name, rgb) { if (rgb) SPEAKERS[name] = rgb; return SPEAKERS[name] || null; };
var PUNCT = '，。、！？；：…「」『』（）《》“”·—';

/* R3：省略号是一个排版单元；字间距只加在单元之间，出字仍占原来的字符时长。 */
function glyphs(text) { return text.match(/…+|[^]/g) || []; }
function lineWidth(c, line, sp, extra, size) {
  var w = 0;
  line.forEach(function (ch) { w += c.measureText(ch).width + sp + (extra && extra.indexOf(ch) >= 0 ? size * .12 : 0); });
  return Math.max(0, w - sp);
}
function hdabs(c, lines, widths, x, y, lh, size, sp, left, extra) {
  var out = []; out.axis = 'h';
  lines.forEach(function (line, li) {
    var bx = left ? x : x - widths[li] / 2;
    line.forEach(function (ch) {
      var w = c.measureText(ch).width;
      if (extra && extra.indexOf(ch) >= 0) bx += size * .12;
      out.push([bx + w / 2, y + li * lh, size * .5]);  // 标点也纳入同一条衬带
      bx += w + sp;
    });
  });
  return out;
}

/* 连续衬带：沿每行/列的轴扫出平顶柔边，首尾收淡、两侧有缓慢墨色起伏。
   引擎的原 API 保留作浓度取样（空透明 dab 不落墨），因此 contrastPin / lint 的决定仍成对。
   不修改 engine.js；题签等旧调用也经过本入口，dabs 格式兼容。 */
var backingOpacity = I.textBacking;
function bandMask(len, half, seed, dark) {
  return U.cached('textBand:' + len + ':' + half + ':' + seed + ':' + dark, function () {
    var r = half * 4, w = Math.ceil((len + 2 * r) / 2), h = Math.ceil(r), cv = U.canvas(w, h), x = cv.getContext('2d');
    x.drawImage(U.canvas(4, 4), 0, 0);
    var id = x.createImageData(w, h), d = id.data, rgb = dark ? [16, 13, 11] : [244, 238, 224];
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) {
      var u = (i + .5) * 2 - r, v = (j + .5) * 2 - r;
      var side = .86 + .12 * U.noise1(u / (half * 3), seed) + .05 * U.noise1(u / half, seed + 1);   // 1022：上下沿随噪声起伏，不成两道直线
      var dist = Math.hypot(Math.max(0, -u, u - len), v / side) / r;
      var e = U.clamp((dist - .2) / .8, 0, 1), a = (1 - U.smooth(e)) * (1 - e * (.15 + .09 * U.noise2(u / 30, v / 30, seed + 2)));
      var k = (j * w + i) * 4;
      d[k] = rgb[0]; d[k + 1] = rgb[1]; d[k + 2] = rgb[2]; d[k + 3] = a * 255;
    }
    x.putImageData(id, 0, 0);
    var ready = U.canvas(w, h); ready.getContext('2d').drawImage(cv, 0, 0);
    return ready;
  });
}
I.textBacking = function (c, K, dabs, A, seed) {
  if (!K || !(K.need > .005) || !dabs.length || A <= .003) return 0;
  var a = backingOpacity(c, K, [[0, 0, 0, 0]], A, seed);
  if (a <= .005) return a;
  var axis = dabs.axis, runs = [], i;
  if (!axis) {
    var p = dabs[0], q = dabs[1] || p;
    axis = Math.abs(q[0] - p[0]) > Math.abs(q[1] - p[1]) ? 'h' : 'v';
  }
  var major = axis === 'h' ? 0 : 1, minor = 1 - major;
  dabs.forEach(function (q) {
    var alpha = q[3] == null ? 1 : U.clamp(q[3], 0, 1);
    if (alpha <= .003) return;
    var run = runs.find(function (r) { return Math.abs(r.cross - q[minor]) < q[2] * .6; });
    if (!run) { run = { cross: q[minor], start: q[major], end: q[major], half: q[2], alpha: 0 }; runs.push(run); }
    run.start = Math.min(run.start, q[major]); run.end = Math.max(run.end, q[major] - q[2] * (1 - alpha));
    run.half = Math.max(run.half, q[2]); run.alpha = Math.max(run.alpha, alpha);
  });
  c.save(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'low';
  for (i = 0; i < runs.length; i++) {
    var run = runs[i], len = Math.max(0, run.end - run.start), r = run.half * 4;
    var cv = bandMask(len, run.half, (seed || 3) + i * 13, K.dark);
    c.save(); c.globalAlpha *= Math.min(1, a * A) * run.alpha;
    if (axis === 'h') c.translate(run.start - r, run.cross - r);
    else { c.translate(run.cross + r, run.start - r); c.rotate(Math.PI / 2); }
    c.drawImage(cv, 0, 0, cv.width * 2, cv.height * 2); c.restore();
  }
  c.restore();
  return a;
};

/* 竖排仍按原标点格高推进，标点不再挖断衬带。 */
I.vdabs = function (str, x, y, size, gap, colGap, out) {
  out = out || []; out.axis = 'v';
  str.split('\n').forEach(function (col, ci) {
    var cy = y + size / 2, cx = x - ci * size * (colGap || 1.5);
    glyphs(col).forEach(function (ch) {
      var p = PUNCT.indexOf(ch[0]) >= 0 && '《》·'.indexOf(ch[0]) < 0;
      out.push([cx, cy, size * .5]);
      cy += size * (gap || 1.08) * (p ? .35 * ch.length : 1);
    });
  });
  return out;
};

/* 含省略号的竖排：一组六点沿列排成连续一串，不把两个横向三点错位堆叠。 */
var vtext = I.vtext;
I.vtext = function (c, str, x, y, o) {
  if (str.indexOf('…') < 0) return vtext(c, str, x, y, o);
  o = o || {};
  var size = o.size || 48, gap = size * (o.gap || 1.08), idx = 0, out = [];
  str.split('\n').forEach(function (col, ci) {
    var cx = x - ci * size * (o.colGap || 1.5), cy = y;
    glyphs(col).forEach(function (ch) {
      var q = Object.assign({}, o), p = PUNCT.indexOf(ch[0]) >= 0 && '《》·'.indexOf(ch[0]) < 0;
      if (o.times) q.times = [o.times[idx]];
      q.seed = (o.seed || 3) + idx * 7;
      if (ch[0] !== '…') out = out.concat(vtext(c, ch, cx, cy, q));
      else {
        var t = o.t == null ? 1e9 : o.t, ts = o.times ? (o.times[idx] == null ? 1e9 : o.times[idx]) : -1e9;
        var k = U.clamp((t - ts) / (o.fade || .45), 0, 1), A = (o.a == null ? 1 : o.a) * U.easeOut(k);
        if (o.out) A *= 1 - U.ramp(t, o.out[0], o.out[1]);
        if (A > .003) {
          c.save(); c.translate(cx, cy + size * .5); c.rotate(Math.PI / 2);
          c.font = size * .6 + 'px ' + (F[o.font || 'poem'] || o.font || F.poem);
          c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = U.rgba(o.rgb || CINE.C.inkRGB, A);
          c.fillText(ch, 0, 0, gap * .35 * ch.length); c.restore();
        }
        out.push({ ch: ch, x: cx, y: cy + size * .5, k: k });
      }
      cy += p ? gap * .35 * ch.length : gap; idx += ch.length;
    });
  });
  return out;
};

function log(kind, text, box) { if (CINE._textLog) CINE._textLog.push({ kind: kind, text: text, box: box }); }
/* 折行：显式 \n 优先；否则超宽时在最靠近中点的标点后断开（无标点则中点），最多两行 */
function wrap(c, text, maxW, sp) {
  if (text.indexOf('\n') >= 0) return text.split('\n').slice(0, 2).map(glyphs);
  var w = lineWidth(c, glyphs(text), sp);
  if (w <= maxW || text.length < 6) return [glyphs(text)];
  var mid = text.length / 2, best = -1, bd = 1e9;
  for (var i = 2; i < text.length - 2; i++) if ('，、；：…—'.indexOf(text[i]) >= 0 && text[i + 1] !== '…' && Math.abs(i + 1 - mid) < bd) { bd = Math.abs(i + 1 - mid); best = i + 1; }
  if (best < 0 || bd > text.length * .3) best = Math.round(mid);
  while (text[best - 1] === '…' && text[best] === '…') best++;
  return [glyphs(text.slice(0, best)), glyphs(text.slice(best))];
}
/* ---------- 局部柔雾（1024 反馈 Q10，取代整幅底带与常驻字后晕）----------
   整块取样一次（读本帧已画内容，同 engine ctrSample 的量法：步长 4 逻辑 px、透明处补纸色），逐字（框外扩 .15 字高）取亮侧 85 分位／暗侧 15 分位，
   按 CINE.CONTRAST 的目标对比算该字要补多浓的雾（浅字衬墨、墨字衬纸）；沿每行画一条柔边雾带（bandMask：两端收圆、上下沿随噪声起伏），
   浓度按逐字需要沿行起伏——字落在浅净处时雾为 0，不落一笔。取样结果随 CINE.contrastPin 记/放（体检四遍渲染同一决定）。纯 t 函数，不留跨帧状态。 */
var FOG_DK = [16, 13, 11], FOG_LT = [244, 238, 224];
var YLUT = new Float32Array(256);
(function () { for (var i = 0; i < 256; i++) { var v = i / 255; YLUT[i] = v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); } })();
function relY(rgb) { return .2126 * YLUT[rgb[0] | 0] + .7152 * YLUT[rgb[1] | 0] + .0722 * YLUT[rgb[2] | 0]; }
function encY(Y) { Y = U.clamp(Y, 0, 1); return Y <= .0031308 ? Y * 12.92 : 1.055 * Math.pow(Y, 1 / 2.4) - .055; }
function decY(v) { v = U.clamp(v, 0, 1); return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }
function fogNeed(Yq, Yt, light, R) {                       // 底亮度 Yq 上、字亮度 Yt 达到对比 R 所需雾浓度（同 engine ctrNeed：sRGB 线性混合近似、二分）
  var vq = encY(Yq), vb = encY(relY(light ? FOG_DK : FOG_LT)), vt = encY(Yt), al = CINE.CONTRAST.aa;
  function ratio(a) { var vg = vq * (1 - a) + vb * a, yg = decY(vg), yt = decY(al * vt + (1 - al) * vg); return (yt > yg) === light ? (Math.max(yg, yt) + .05) / (Math.min(yg, yt) + .05) : 0; }
  if (ratio(0) >= R) return 0;
  if (ratio(1) < R) return 1;
  var lo = 0, hi = 1;
  for (var k = 0; k < 12; k++) { var m = (lo + hi) / 2; if (ratio(m) >= R) hi = m; else lo = m; }
  return hi;
}
var FOG_PIN = null, pin0 = CINE.contrastPin;                // 跟着 engine 的 contrastPin 记/放（sub-lint --contrast 四遍渲染）
CINE.contrastPin = function (m) {
  if (m === 'rec') FOG_PIN = { mode: 'rec', list: [], i: 0 };
  else if (m === 'play' && FOG_PIN) { FOG_PIN.mode = 'play'; FOG_PIN.i = 0; }
  else FOG_PIN = null;
  return pin0 ? pin0(m) : true;
};
var FOG_S = null, FOG_L = null;
/* 逐字雾浓度：cells [[cx, cy, half]…]（屏幕逻辑坐标）→ [a…]；Yt 字亮度，light 浅字 */
function fogLevels(c, cells, Yt, light, R) {
  if (FOG_PIN && FOG_PIN.mode === 'play') return FOG_PIN.list[FOG_PIN.i++] || cells.map(function () { return 0; });
  var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, i;
  for (i = 0; i < cells.length; i++) { var h = cells[i][2] * 1.3; x0 = Math.min(x0, cells[i][0] - h); y0 = Math.min(y0, cells[i][1] - h); x1 = Math.max(x1, cells[i][0] + h); y1 = Math.max(y1, cells[i][1] + h); }
  x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(W, x1); y1 = Math.min(H, y1);
  var out = cells.map(function () { return 0; });
  if (x1 - x0 >= 4 && y1 - y0 >= 4) {
    var st = 4, gw = Math.ceil((x1 - x0) / st), gh = Math.ceil((y1 - y0) / st), cvs = c.canvas, sc = cvs.width / W;
    if (!FOG_S || FOG_S.canvas.width < gw || FOG_S.canvas.height < gh) {   // 一次给足；新画布先画一次（ENGINE-NOTES 7.6）
      var cv0 = U.canvas(Math.max(gw, 500, FOG_S ? FOG_S.canvas.width : 0), Math.max(gh, 80, FOG_S ? FOG_S.canvas.height : 0));
      FOG_S = cv0.getContext('2d', { willReadFrequently: false }); FOG_S.drawImage(U.canvas(4, 4), 0, 0);
    }
    var S = FOG_S;
    S.setTransform(1, 0, 0, 1, 0, 0); S.globalAlpha = 1; S.globalCompositeOperation = 'source-over';
    S.clearRect(0, 0, gw, gh); S.imageSmoothingEnabled = true; S.imageSmoothingQuality = 'low';
    S.drawImage(cvs, x0 * sc, y0 * sc, (x1 - x0) * sc, (y1 - y0) * sc, 0, 0, gw, gh);
    var d = S.getImageData(0, 0, gw, gh).data, P = CINE.C.paperRGB, Y = new Float32Array(gw * gh);
    for (i = 0; i < gw * gh; i++) {
      var a = d[i * 4 + 3] / 255;
      Y[i] = relY([d[i * 4] * a + (1 - a) * P[0], d[i * 4 + 1] * a + (1 - a) * P[1], d[i * 4 + 2] * a + (1 - a) * P[2]]);
    }
    for (i = 0; i < cells.length; i++) {
      var q = cells[i], hh = q[2] * 1.15, vals = [];
      var gx0 = Math.max(0, Math.floor((q[0] - hh - x0) / st)), gx1 = Math.min(gw - 1, Math.floor((q[0] + hh - x0) / st));
      var gy0 = Math.max(0, Math.floor((q[1] - hh - y0) / st)), gy1 = Math.min(gh - 1, Math.floor((q[1] + hh - y0) / st));
      for (var gy = gy0; gy <= gy1; gy++) for (var gx = gx0; gx <= gx1; gx++) vals.push(Y[gy * gw + gx]);
      if (!vals.length) continue;
      vals.sort(function (p, r) { return p - r; });
      out[i] = Math.min(CINE.CONTRAST.max, fogNeed(vals[Math.min(vals.length - 1, Math.floor(vals.length * (light ? .85 : .15)))], Yt, light, R));
    }
  }
  if (FOG_PIN && FOG_PIN.mode === 'rec') FOG_PIN.list.push(out);
  return out;
}
/* I.textFog(c, runs, A, o)：runs = [[[cx, cy, half]…]…]（每行一串，逻辑屏幕坐标）；o: dark（浅字＝true）, rgb 字色, seed, contrast（false 关 | {target}）
   返回本次最浓的雾（0 = 没落雾）。 */
I.textFog = function (c, runs, A, o) {
  o = o || {};
  if (!CINE.CONTRAST.on || o.contrast === false || A <= .003) return 0;
  var cells = [], i, j;
  runs.forEach(function (r) { r.forEach(function (q) { cells.push(q); }); });
  if (!cells.length) return 0;
  var dark = o.dark !== false, lv = fogLevels(c, cells, relY(o.rgb || (dark ? PAPER : INK)), dark, (o.contrast && o.contrast.target) || CINE.CONTRAST.target);
  var top = Math.max.apply(null, lv);
  var lc = CINE._lintCur && CINE._lintCur();
  if (lc && lc.ctr) lc.ctr.back = Math.round(top * 100) / 100;
  if (top <= .005) return 0;
  c.save(); I.screen(c); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'low';
  var k = 0;
  for (i = 0; i < runs.length; i++) {
    var run = runs[i], n = run.length, a = lv.slice(k, k + n); k += n;
    if (!n) continue;
    var b = a.map(function (v, m) { return Math.max(v, .6 * (a[m - 1] || 0), .6 * (a[m + 1] || 0)); });   // 不留孤零零的空洞
    var peak = Math.max.apply(null, b);
    if (peak <= .005) continue;
    var half = 0; run.forEach(function (q) { half = Math.max(half, q[2]); });
    var s0 = run[0][0], s1 = run[n - 1][0], len = Math.max(0, s1 - s0), r = half * 4, cy = run[0][1];
    var cv = bandMask(len, half, (o.seed || 5) + i * 13, dark), bw = cv.width * 2, bh = cv.height * 2;
    if (!FOG_L || FOG_L.canvas.width < cv.width || FOG_L.canvas.height < cv.height) {
      var cl = U.canvas(Math.max(cv.width, 1200, FOG_L ? FOG_L.canvas.width : 0), Math.max(cv.height, 160, FOG_L ? FOG_L.canvas.height : 0));
      FOG_L = cl.getContext('2d'); FOG_L.drawImage(U.canvas(4, 4), 0, 0);
    }
    var L = FOG_L;
    L.setTransform(1, 0, 0, 1, 0, 0); L.globalAlpha = 1; L.globalCompositeOperation = 'source-over';
    L.clearRect(0, 0, cv.width, cv.height); L.drawImage(cv, 0, 0);
    var g = L.createLinearGradient(0, 0, cv.width, 0);           // 沿行按逐字浓度起伏（相对本行最浓处）
    for (j = 0; j < n; j++) g.addColorStop(U.clamp((run[j][0] - (s0 - r)) / bw, 0, 1), 'rgba(0,0,0,' + (b[j] / peak).toFixed(3) + ')');
    L.globalCompositeOperation = 'destination-in'; L.fillStyle = g; L.fillRect(0, 0, cv.width, cv.height);
    c.globalAlpha = Math.min(1, peak * A);
    c.drawImage(L.canvas, 0, 0, cv.width, cv.height, s0 - r, cy - r, bw, bh);
  }
  c.restore();
  return top;
};

/* ---------- 字幕 I.sub(c, text, t, t0, t1, o) ----------
   1024 改版：整句淡入（t0 起 o.fi，缺省 CINE.SUB.fade＝.25s，easeOut）→ 停 → 淡出在 t1（＝账本「退场」）完成（o.fo 缺省 .25），不再逐字扫出。
   v5 按类型出字（o.fi 显式给时一律按旧法整句淡入）：
     旁白 narr：淡入 CINE.SUB.narrIn＝.35s；同时由糊到清（模糊 3→0px，用缓存的 I.blur 模糊副本叠画，副本走 I.textOverlay 不计体检）、下沉 6→0px；
       清晰字形的不透明度＝淡入×(1−narrSharp×(1−淡入))，体检量的就是它。
     对白 line：说话人名 t0 起淡入、正文晚 nameLead＝.12s 起，各 lineIn＝.15s（无名时正文 t0 起）。
   o.kind：'narr' 旁白（缺省）| 'line' 台词 | 'heart' 心声 | 'thought' 心念 | 'voice' 画外音 | 'chant' 诵（竖排，转 I.chant）
   o.dark 场景是深色（缺省 true：浅字）；false 为浅景（墨字）。不换深浅（心声除外）；字压到深色/繁杂处由 I.textFog 补局部柔雾（无整幅底带）。
   o.size（≥ CINE.SUB.size，不许更小）, o.x 覆盖横位, o.side 'left'|'right'（落左/右三分之一：块心 W/6、5W/6，块不出 edge 边距；底部长句按 sideW 在标点后折两行）,
   o.sideX 侧位的块心横位（逻辑 px，缺省 W/6、5W/6；仍按 edge 夹边、按侧位折行；任务 F：同侧挪到空处）,
   o.y 覆盖行位, o.seed；
   对白（kind 'line'）：o.who 说话人 → 句首冠名（小字 ×CINE.SUB.name，隔 CINE.SUB.nameGap 字；正文八成浓度，暗景纸色），多行时正文左齐、悬在名后；o.name 字符串改上屏名、false 不冠名。
   o.font 正文字体键（F 里的 'text'|'sword'|'poem'，缺省 'text'）。
   text 若以「名＋NAME_SEP」起头（I.ledger 这样传，好让体检按上屏实字计数），先拆掉再画。 */
I.sub = function (c, text, t, t0, t1, o) {
  o = o || {};
  var kind = o.kind || 'narr';
  if (kind === 'chant') return I.chant(c, text, t, t0, t1, o);
  if (kind === 'inner') return I.inner(c, text, t, t0, t1, o);           // T05：余慈心声
  if (kind === 'array') return I.arrayVoice(c, text, t, t0, t1, o);      // T05：秘阵声
  if (kind === 'mote') return I.moteText(c, text, t, t0, t1, o);         // T05：萤光点小字
  if (kind === 'slip') return I.slip(c, text, t, t0, t1, o);             // T05：传讯纸条
  var SB = CINE.SUB, NARR = kind === 'narr' && o.fi == null, LINE = kind === 'line' && o.fi == null;
  var fo = o.fo == null ? SB.fade : o.fo, fi = o.fi == null ? (NARR ? SB.narrIn : LINE ? SB.lineIn : SB.fade) : o.fi;
  var A = (o.a == null ? 1 : o.a) * (1 - U.ramp(t, t1 - fo, t1));
  if (t < t0 || A <= .003) return;
  var name = kind === 'line' && o.who && o.name !== false ? (typeof o.name === 'string' ? o.name : o.who) : null;
  var vis = U.easeOut((t - t0) / fi), visB = LINE && name ? U.easeOut((t - t0 - SB.nameLead) / fi) : vis;   // visB：正文（对白晚 nameLead 起）
  var A0 = A, sharp = NARR ? 1 - SB.narrSharp * (1 - vis) : 1, sink = NARR ? SB.narrSink * (1 - vis) : 0;
  A *= vis;
  if (A <= .003) return;
  var AB = A0 * visB * sharp;                                // 正文清晰字形的不透明度（体检量它）
  var dark = o.dark !== false, heart = kind === 'heart', size = Math.max(CINE.SUB.size, o.size || CINE.SUB.size);
  if (name && text.indexOf(name + NAME_SEP) === 0) text = text.slice(name.length + NAME_SEP.length);
  var sp = size * (heart ? .38 : kind === 'thought' ? .1 : .06), side = o.x == null && (o.side === 'left' || o.side === 'right') ? o.side : null;
  c.save(); I.screen(c);
  var ns = Math.round(size * CINE.SUB.name), nsp = ns * .08, nw = 0, ngap = name ? size * CINE.SUB.nameGap : 0;
  if (name) { c.font = ns + 'px ' + F.text; nw = lineWidth(c, glyphs(name), nsp); }
  var BF = F[o.font] || F.text;                              // o.font：正文字体（缺省 'text' 霞鹜文楷；v3 W184「万古云霄！」用 'sword' 志莽行＝片名同字）；说话人名仍用 text
  c.font = size + 'px ' + BF; c.textBaseline = 'middle'; c.textAlign = 'left';
  var lines = wrap(c, text, (side && o.y == null ? CINE.SUB.sideW : CINE.SUB.maxW) - nw - ngap, sp), lh = size * 1.32;   // 侧位折两行只在底部（顶部行位往下折会压到人头）
  if (side && o.y == null && lines.length > 1 && text.indexOf('\n') < 0 && PUNCT.indexOf(lines[0][lines[0].length - 1][0]) < 0)
    lines = wrap(c, text, CINE.SUB.maxW - nw - ngap, sp);   // 侧位折行只在标点后断；句中无标点可断就整句一行（不把「无极阁」拆开）
  var widths = lines.map(function (s) { return lineWidth(c, s, sp); });
  var maxw = Math.max.apply(null, widths), tot = lines.length * lh, bw = nw + ngap + maxw;
  var cx = o.x != null ? o.x : side && o.sideX != null ? o.sideX : side === 'left' ? W / 6 : side === 'right' ? W * 5 / 6 : W / 2, bl = cx - bw / 2;
  if (side) bl = U.clamp(bl, W * CINE.SUB.edge, W * (1 - CINE.SUB.edge) - bw);
  var y0 = (o.y != null ? o.y : heart ? H * .2 : H * .875 - (lines.length - 1) * lh / 2) - sink;   // 旁白：自上 6px 下沉落定
  var rise = heart ? 16 * (1 - vis) : 0, tx = bl + nw + ngap;
  var lx = function (L) { return name ? tx : bl + (bw - widths[L]) / 2; };   // 有名：正文左齐悬在名后；无名：各行居中
  var box = [bl, y0 - size * .6, bl + bw, y0 + tot - lh + size * .6];
  var K = I.textContrast(c, box,   // 自动对比（ENGINE-NOTES §7.3c）：只量要补多浓的雾，不换深浅（心声除外）——任务 F 撤掉 B 的「整句换深浅」：对白已挪离人身，
    // 而逐帧判深浅在亮暗交界处会显示中途来回换色（实测 382.3、541.8、687.6、W042、1096.9 等）；深浅照幕给的 dark，不够处由局部柔雾补
    { dark: dark, light: kind === 'voice' ? TURBID : PAPER, ink: kind === 'voice' ? [96, 90, 66] : INK, alpha: o.a == null ? 1 : o.a, flip: heart, contrast: o.contrast });
  dark = K.dark;
  var fill = dark ? PAPER : INK;
  if (kind === 'voice') fill = dark ? TURBID : [96, 90, 66];
  var runs = lines.map(function (s, L) {                       // 逐字格（局部柔雾取样与成带）
    var out = [], gx = lx(L), cy = y0 + L * lh;
    if (L === 0 && name) glyphs(name).forEach(function (ch, i, arr) { var w = c.measureText(ch).width * ns / size; out.push([bl + (w + nsp) * i + w / 2, cy, size * .5]); });
    s.forEach(function (ch) { var w = c.measureText(ch).width; out.push([gx + w / 2, cy, size * .5]); gx += w + sp; });
    return out;
  });
  if (heart) I.wash(c, bl + bw / 2, y0 + (lines.length - 1) * lh / 2, maxw * .6 + 60, tot * .8 + 20, (dark ? .35 : .25) * A, 9, dark ? [16, 13, 11] : [250, 247, 238], 0, { edge: 'soft' });
  if (LINE && name && visB < 1) {                             // 对白：名先出时只给名垫雾，正文的雾随正文起（不先铺一条空雾）
    var nn = glyphs(name).length;
    I.textFog(c, [runs[0].slice(0, nn)], A, { dark: dark, rgb: fill, seed: (o.seed || 5) + 70, contrast: o.contrast });
    if (A0 * visB > .003) I.textFog(c, [runs[0].slice(nn)].concat(runs.slice(1)), A0 * visB, { dark: dark, rgb: fill, seed: (o.seed || 5) + 71, contrast: o.contrast });
  } else I.textFog(c, runs, A, { dark: dark, rgb: fill, seed: (o.seed || 5) + 70, contrast: o.contrast });
  if (NARR && vis < 1 && A0 * vis * (1 - sharp) > .003) I.textOverlay(function () {   // 旁白由糊到清：模糊副本（缓存精灵，I.blur 两级≈3px）随清晰度退去
    var pad = Math.ceil(SB.narrBlur * 3), ox = bl - pad, oy = y0 - size * .7 - pad, sw = bw + pad * 2, sh = tot - lh + size * 1.4 + pad * 2;
    var spr = U.cached('subBlur|' + BF + '|' + size + '|' + sp + '|' + fill.join(',') + '|' + (dark ? 1 : 0) + '|' + lines.map(function (s) { return s.join(''); }).join('\n'), function (px) {
      var cv = U.canvas(sw * px, sh * px), x = cv.getContext('2d');
      x.setTransform(px, 0, 0, px, 0, 0); x.font = size + 'px ' + BF; x.textBaseline = 'middle'; x.textAlign = 'left';
      for (var L = 0; L < lines.length; L++) {
        var gx = lx(L) - ox, cy = y0 + L * lh - oy;
        for (var i = 0; i < lines[L].length; i++) {
          var ch = lines[L][i], cw = x.measureText(ch).width;
          if (dark) { x.lineJoin = 'round'; x.strokeStyle = U.rgba([20, 16, 13], .35); x.lineWidth = size * .08; x.strokeText(ch, gx, cy); }
          x.fillStyle = U.rgba(fill, 1); x.fillText(ch, gx, cy);
          gx += cw + sp;
        }
      }
      return I.blur(cv, 2);
    });
    var bk = Math.min(1, SB.narrBlur * (1 - vis) / 1.2);    // 模糊半径 3→0：副本按半径退淡（≤1.2px 起就几乎全清）
    c.save(); c.globalAlpha *= U.clamp(A0 * vis * (1 - sharp) * 1.6 * bk, 0, 1); c.drawImage(spr, ox, oy, sw, sh); c.restore();
  });
  if (name) {                                                // 说话人名：小字、正文八成浓度，与首行同一中线
    c.font = ns + 'px ' + F.text;
    var nx = bl;
    glyphs(name).forEach(function (ch) {
      var w = c.measureText(ch).width;
      if (dark) { c.lineJoin = 'round'; c.strokeStyle = U.rgba([20, 16, 13], A * .45); c.lineWidth = ns * .12; c.strokeText(ch, nx, y0 + size * .04); }
      c.fillStyle = U.rgba(dark ? NAME_LT : NAME_INK, A); c.fillText(ch, nx, y0 + size * .04);   // 名用 A（t0 起），正文用 AB（晚 nameLead 起）
      nx += w + nsp;
    });
    c.font = size + 'px ' + BF;
  }
  var idx = 0;
  if (AB <= .003) { c.restore(); log('say', text, box); return; }   // 对白：名已出、正文未到
  for (var L = 0; L < lines.length; L++) {
    var s = lines[L], gx = lx(L), cy = y0 + L * lh;
    for (var i = 0; i < s.length; i++) {
      var ch = s[i], cw = c.measureText(ch).width, dx = 0, dy = heart ? rise : 0;
      if (kind === 'voice') { var sd = (o.seed || 5) + idx * 7; dx = 2.2 * U.noise1(t * 11 + idx, sd); dy = 2.2 * U.noise1(t * 13 + idx, sd + 3); }
      c.save(); c.translate(gx + cw / 2 + dx, cy + dy);
      if (kind === 'thought') c.transform(1, 0, -.05, 1, 0, 0);       // 斜体感：约 3°
      if (heart) {
        c.lineJoin = 'round'; c.strokeStyle = U.rgba(QBAI, AB * (dark ? .55 : .9)); c.lineWidth = size * .09; c.strokeText(ch, -cw / 2, 0);
        if (dark) I.glow(c, 0, 0, size * .8, QBAI, .12 * AB);
      } else if (kind === 'thought') {
        c.lineJoin = 'round'; c.strokeStyle = U.rgba(QING, AB * .85); c.lineWidth = size * .05; c.strokeText(ch, -cw / 2, 0);
      } else if (dark) {
        c.lineJoin = 'round'; c.strokeStyle = U.rgba([20, 16, 13], AB * .35); c.lineWidth = size * .08; c.strokeText(ch, -cw / 2, 0);
      }
      c.fillStyle = U.rgba(heart && !dark ? INK : fill, AB);
      c.fillText(ch, -cw / 2, 0);
      c.restore();
      gx += cw + sp; idx += ch.length;
    }
  }
  c.restore();
  log('say', text, box);
};
/* 诵：竖排，逐字随单音律动出现。o.times 每字时刻（缺省每 .38s 一字）, x,y（缺省右侧 W*.8, H*.16）, size（缺省 64）, dark */
I.chant = function (c, text, t, t0, t1, o) {
  o = o || {};
  var fo = o.fo == null ? .5 : o.fo, A = (o.a == null ? 1 : o.a) * (1 - U.ramp(t, t1 - fo, t1));
  if (t < t0 || A <= .003) return;
  var times = o.times, n = 0, size = Math.max(CINE.SUB.size, o.size || CINE.SUB.size), dark = o.dark !== false;
  if (!times) { times = []; for (var i = 0; i < text.length; i++) if (text[i] !== '\n') times.push(t0 + (n++) * (o.step || .38)); }
  var x = o.x == null ? W * .8 : o.x, y = o.y == null ? H * .14 : o.y;
  var K = I.textContrast(c, [x - size / 2, y, x + size / 2, y + text.length * size * 1.14], { dark: dark, light: PAPER, ink: INK, alpha: o.a, contrast: o.contrast });
  dark = K.dark;
  c.save(); I.screen(c);
  I.wash(c, x, y + text.length * size * .55, size * 1.3, text.length * size * .62, (dark ? .3 : .2) * A, 11, dark ? [16, 13, 11] : [250, 247, 238], 0, { edge: 'soft' });
  if (K.need > .005) I.textBacking(c, K, I.vdabs(text, x, y, size, 1.14), A * U.clamp((t - t0) * 4, 0, 1), 81);
  I.vtext(c, text, x, y, { size: size, font: 'text', rgb: dark ? PAPER : INK, a: A, times: times, t: t, fade: .3, bleed: .1, grow: .12, gap: 1.14 });
  c.restore();
  log('say', text, [x - size / 2, y, x + size / 2, y + text.length * size * 1.14]);
};

/* ---------- T05 新增文字样式（2026-10-20）----------
   五种样式都先走 I.textContrast（取样本帧已画背景、必要时换深浅）与 I.textBacking（不够再补水墨衬底）；
   全部是 t 与种子的纯函数。API：I.inner 心声 / I.arrayVoice 秘阵声（+ I.arrayWave 顶部光波）/
   I.motes 萤光点 / I.moteText 萤光点小字 / I.slip 传讯纸条 / I.line 对白（说话人色点）。 */

/* 说话人色点 I.speakerDot(c, name, x, y, o)：对白首字前的固定色圆点（剑破机制入口；也可单独画图例）。
   o: r(8), a(1), dark(true 深底：纸色晕边＋微光；false 浅底：墨色晕边), label(false 画名字), size(26), rgb 覆盖 */
I.speakerDot = function (c, name, x, y, o) {
  o = o || {};
  var col = o.rgb || SPEAKERS[name] || [150, 150, 150], r = o.r == null ? 8 : o.r, a = o.a == null ? 1 : o.a;
  var dark = o.dark !== false;
  if (a <= .003) return col;
  c.save(); I.screen(c);
  c.fillStyle = U.rgba(dark ? [244, 238, 224] : [18, 15, 13], .42 * a);
  c.beginPath(); c.arc(x, y, r * 2.1, 0, 6.283); c.fill();
  c.fillStyle = U.rgba(col, .95 * a);
  c.beginPath(); c.arc(x, y, r, 0, 6.283); c.fill();
  c.strokeStyle = U.rgba(dark ? [250, 247, 238] : [20, 16, 13], .5 * a); c.lineWidth = Math.max(1, r * .22);
  c.beginPath(); c.arc(x, y, r, 0, 6.283); c.stroke();
  if (dark) I.glow(c, x, y, r * 4.5, col, .18 * a);
  if (o.label) {
    var size = o.size || 26;
    c.font = size + 'px ' + F.text; c.textBaseline = 'middle'; c.textAlign = 'left';
    c.fillStyle = U.rgba(dark ? [232, 226, 212] : [40, 34, 28], .9 * a);
    c.fillText(name, x + r * 2.2, y);
  }
  c.restore();
  return col;
};

/* ---------- 心声 I.inner(c, text, t, t0, t1, o)（余慈；血府老祖换暗红）----------
   青色（BRIEF §4 石青灰）、略斜（-6°）、无引号；1024 改版：整句淡入淡出，不再逐字错开、不再墨散漂字。
   v5（TXT 第 5 条）：淡入 CINE.SUB.innerIn＝.45s，同时自下 12px 上浮（innerRise）；淡出仍 .25s。
   o: x, y（缺省居中 H*.22）, size（≥ CINE.SUB.size）, dark, a, fo 淡出秒(.25), fadeIn(.45), seed, contrast, rgb/ink（改色：暗底/纸底字色）,
      who 说话人（I.ledger 从账本「说话人」列透传）：INNER_TONE 里登记的（现只有血府老祖）换该色并加暗红描边；o.rgb/o.ink 显式给色时以显式为准。 */
I.inner = function (c, text, t, t0, t1, o) {
  o = o || {};
  text = String(text).replace(/[「」『』“”"]/g, '');
  var fo = o.fo == null ? CINE.SUB.fade : o.fo, A = (o.a == null ? 1 : o.a) * (1 - U.ramp(t, t1 - fo, t1));
  if (t < t0 || A <= .003) return;
  var size = Math.max(CINE.SUB.size, o.size || CINE.SUB.size), dark = o.dark !== false, sd = o.seed || 37;
  var sp = size * .34, fadeIn = o.fadeIn == null ? CINE.SUB.innerIn : o.fadeIn;
  c.save(); I.screen(c);
  c.font = size + 'px ' + F.text; c.textBaseline = 'middle'; c.textAlign = 'left';
  var lines = wrap(c, text, CINE.SUB.maxW, sp), lh = size * 1.4;
  var x = o.x == null ? W / 2 : o.x, y0 = o.y == null ? H * .22 : o.y;
  var widths = lines.map(function (s) { return lineWidth(c, s, sp); });
  var maxw = Math.max.apply(null, widths), tot = lines.length * lh;
  var e0 = U.easeOut((t - t0) / fadeIn), vis = e0 * A;        // 整句同一不透明度
  if (vis <= .003) { c.restore(); return; }
  var rise = o.fadeIn == null ? CINE.SUB.innerRise * (1 - e0) : 0;   // v5：心声自下上浮
  var tone = INNER_TONE[o.who] || null, lightC = o.rgb || (tone ? tone.light : CYAN), inkC = o.ink || o.rgb || (tone ? tone.ink : CYAN_DK);
  var K = I.textContrast(c, [x - maxw / 2, y0 - size * .7, x + maxw / 2, y0 + tot - lh + size * .7],
    { dark: dark, light: lightC, ink: inkC, alpha: o.a == null ? 1 : o.a, flip: true, contrast: o.contrast });
  dark = K.dark;
  var rgb = dark ? lightC : inkC;                            // o.rgb/o.ink：非余慈的心声改色（如赵相山幽蓝）；o.who 登记过的按 INNER_TONE
  var rim = tone && !o.rgb && !o.ink ? tone.rim : null;     // 暗红描边（只给登记过的说话人；显式改色时不加）
  I.wash(c, x, y0 + (lines.length - 1) * lh / 2, maxw * .58 + 80, tot * .8 + 30, (dark ? .33 : .16) * vis, sd, dark ? [14, 12, 10] : [250, 247, 238], 0, { edge: 'soft' });
  if (K.need > .005) {
    var dabs = hdabs(c, lines, widths, x, y0, lh, size, sp);
    I.textBacking(c, K, dabs, vis, sd + 70);
  }
  for (var L = 0; L < lines.length; L++) {
    var s = lines[L], cx = x - widths[L] / 2, cy = y0 + L * lh + rise;
    for (var i = 0; i < s.length; i++) {
      var ch = s[i], cw = c.measureText(ch).width;
      c.save(); c.translate(cx + cw / 2, cy); c.transform(1, 0, -.105, 1, 0, 0);   // -6°
      if (rim) { c.lineJoin = 'round'; c.strokeStyle = U.rgba(rim, vis * (dark ? .9 : .35)); c.lineWidth = size * (dark ? .09 : .05); c.strokeText(ch, -cw / 2, 0); }
      c.fillStyle = U.rgba(rgb, vis); c.fillText(ch, -cw / 2, 0);
      c.restore();
      cx += cw + sp;
    }
  }
  c.restore();
  log('inner', text, [x - maxw / 2, y0 - size * .6, x + maxw / 2, y0 + tot - lh + size * .6]);
};

/* ---------- 秘阵声 I.arrayVoice(c, text, t, t0, t1, o)（三元秘阵监察）----------
   冷铁灰（略石青），字边轻微抖动（全部由 t 与种子算出，无 Math.random），像金属回声：字后两三道横向余响。
   o: x,y, size, dark, a, fo, seed, wave（true 同时放 I.arrayWave，缺省 false）, waveT, contrast,
      name（v4 新增，字符串才生效）：句首冠说话人名——同对白冠名样式（小字 ×CINE.SUB.name、隔 CINE.SUB.nameGap、NAME_LT/NAME_INK），名＋正文整块居中，正文悬在名后；体检按「名＋全角空格＋正文」计字。 */
I.arrayVoice = function (c, text, t, t0, t1, o) {
  o = o || {};
  var fo = o.fo == null ? .5 : o.fo, A = (o.a == null ? 1 : o.a) * (1 - U.ramp(t, t1 - fo, t1));
  if (t < t0 || A <= .003) return;
  var size = Math.max(CINE.SUB.size, o.size || CINE.SUB.size), dark = o.dark !== false, sd = o.seed || 53;
  var sp = size * .08, fadeIn = .3;
  c.save(); I.screen(c);
  c.font = size + 'px ' + F.text; c.textBaseline = 'middle'; c.textAlign = 'left';
  var lines = wrap(c, text, CINE.SUB.maxW, sp), lh = size * 1.32;
  var x = o.x == null ? W / 2 : o.x, y0 = o.y == null ? H * .18 : o.y;
  var nm = typeof o.name === 'string' && o.name ? o.name : null, ns = Math.round(size * CINE.SUB.name), nsp = ns * .08, nw = 0, ngap = 0;
  if (nm) { c.font = ns + 'px ' + F.text; nw = lineWidth(c, glyphs(nm), nsp); ngap = size * CINE.SUB.nameGap; c.font = size + 'px ' + F.text; }
  var widths = lines.map(function (s) { return lineWidth(c, s, sp); });
  var maxw = Math.max.apply(null, widths), tot = lines.length * lh;
  var bx0 = x - (nw + ngap + maxw) / 2;                      // 有名：名＋正文整块居中，正文左齐悬在名后
  if (nm) x += (nw + ngap) / 2;
  var vis = U.clamp((t - t0) * 5, 0, 1) * A;
  var K = I.textContrast(c, [nm ? bx0 : x - maxw / 2, y0 - size * .6, x + maxw / 2, y0 + tot - lh + size * .6],
    { dark: dark, light: IRON, ink: IRON_DK, alpha: o.a == null ? 1 : o.a, flip: true, contrast: o.contrast });
  dark = K.dark;
  var rgb = dark ? IRON : IRON_DK;
  if (!dark) I.wash(c, x, y0 + (lines.length - 1) * lh / 2, maxw * .56 + 80, tot * .8 + 24, .13 * vis, sd, [250, 247, 238], 0, { edge: 'soft' });
  if (K.need > .005) {
    var dabs = hdabs(c, lines, widths, x, y0, lh, size, sp);
    I.textBacking(c, K, dabs, vis, sd + 60);
  }
  if (nm) {                                                  // 说话人名：同 I.sub 对白冠名（小字、正文八成浓度，与首行同一中线），随正文同步淡入淡出
    c.font = ns + 'px ' + F.text;
    var nx = bx0;
    glyphs(nm).forEach(function (ch) {
      var w = c.measureText(ch).width;
      if (dark) { c.lineJoin = 'round'; c.strokeStyle = U.rgba([20, 16, 13], vis * .45); c.lineWidth = ns * .12; c.strokeText(ch, nx, y0 + size * .04); }
      c.fillStyle = U.rgba(dark ? NAME_LT : NAME_INK, vis); c.fillText(ch, nx, y0 + size * .04);
      nx += w + nsp;
    });
    c.font = size + 'px ' + F.text;
  }
  var idx = 0;
  for (var L = 0; L < lines.length; L++) {
    var s = lines[L], cx = nm ? x - maxw / 2 : x - widths[L] / 2, cy = y0 + L * lh;
    for (var i = 0; i < s.length; i++) {
      var ch = s[i], cw = c.measureText(ch).width, k = U.clamp((t - t0 - idx / 22) / fadeIn, 0, 1);
      if (k > 0) {
        var a = A * U.easeOut(k);
        var jx = 1.5 * U.noise1(t * 17 + idx * 5.3, sd), jy = 1.1 * U.noise1(t * 19 + idx * 3.1, sd + 7);   // 字边抖：t 的纯函数
        c.save(); c.translate(cx + cw / 2 + jx, cy + jy);
        if (dark) {
          c.strokeStyle = U.rgba(rgb, a * .16); c.lineWidth = Math.max(1, size * .012);
          for (var e = 3; e >= 1; e--) c.strokeText(ch, -cw / 2 + size * .045 * e, 0);
          c.strokeStyle = U.rgba(rgb, a * .3); c.lineWidth = Math.max(1, size * .018); c.strokeText(ch, -cw / 2 - .8, 0);
        } else {
          c.strokeStyle = U.rgba(rgb, a * .07); c.lineWidth = Math.max(1, size * .01);
          for (var e2 = 2; e2 >= 1; e2--) c.strokeText(ch, -cw / 2 + size * .03 * e2, 0);
        }
        c.fillStyle = U.rgba(rgb, a); c.fillText(ch, -cw / 2, 0);
        c.restore();
      }
      cx += cw + sp; idx += ch.length;
    }
  }
  c.restore();
  if (o.wave) I.arrayWave(c, t, { t0: o.waveT == null ? t0 : o.waveT, dark: dark, a: A, seed: sd + 3 });
  log('array', nm ? nm + NAME_SEP + text : text, [nm ? bx0 : x - maxw / 2, y0 - size * .6, x + maxw / 2, y0 + tot - lh + size * .6]);
};

/* 秘阵光波 I.arrayWave(c, t, o)：屏幕顶部一道极淡横向光波（t0 起 dur 内亮起、扫开、淡去）。
   o: t0, y(H*.075), x0(W*.12), x1(W*.88), dur(1.1), a(1), dark, seed */
I.arrayWave = function (c, t, o) {
  o = o || {};
  var t0 = o.t0 == null ? 0 : o.t0, dur = o.dur || 1.1, k = U.clamp((t - t0) / dur, 0, 1);
  if (k <= 0 || k >= 1) return;
  var y = o.y == null ? H * .075 : o.y, x0 = o.x0 == null ? W * .12 : o.x0, x1 = o.x1 == null ? W * .88 : o.x1;
  var e = U.easeOut(k), a = (o.a == null ? 1 : o.a) * Math.sin(Math.PI * k) * (o.dark === false ? .2 : .3);
  var rgb = o.dark === false ? [70, 104, 110] : [150, 206, 212];
  c.save(); I.screen(c);
  var L = (x1 - x0) * (.25 + .75 * e), sx = x0 + ((x1 - x0) - L) / 2;
  var g = c.createLinearGradient(sx, 0, sx + L, 0);
  g.addColorStop(0, U.rgba(rgb, 0)); g.addColorStop(.5, U.rgba(rgb, a)); g.addColorStop(1, U.rgba(rgb, 0));
  c.fillStyle = g; c.fillRect(sx, y - 1.2, L, 2.4);
  I.wash(c, sx + L / 2, y, L * .5, 8 + 14 * Math.sin(Math.PI * k), a * .55, o.seed || 91, rgb, 0, { edge: 'soft' });
  c.restore();
};

/* ---------- 萤光点 I.motes(c, t, o)（暗室远方众人）----------
   暗底上若干柔光点，位置/亮度随 t 缓慢呼吸（种子确定，无 Math.random）。
   o: x,y 中心, n(7), spread(120), r(3), rgb, a(.55), seed, dark(true；纸底传 false 改 source-over 深青) */
I.motes = function (c, t, o) {
  o = o || {};
  var x = o.x == null ? W * .2 : o.x, y = o.y == null ? H * .35 : o.y, n = o.n == null ? 7 : o.n;
  var spread = o.spread == null ? 120 : o.spread, r0 = o.r == null ? 3 : o.r;
  var dark = o.dark !== false, rgb = o.rgb || (dark ? [132, 218, 208] : [44, 100, 102]);
  var a0 = (o.a == null ? .55 : o.a), sd = o.seed || 71, rng = U.rng(sd);
  c.save(); I.screen(c);
  for (var i = 0; i < n; i++) {
    var px = x + rng.pm(spread) + spread * .09 * U.noise1(t * .17 + i * 2.3, sd + 9);
    var py = y + rng.pm(spread * .62) - spread * .05 * U.noise1(t * .13 + i * 3.1, sd + 13);
    var br = .5 + .5 * (U.noise1(t * .33 + i * 4.7, sd + 3) * .5 + .5), r = r0 * (.7 + .6 * rng());
    if (dark) I.glow(c, px, py, r * 6.5, rgb, a0 * br * .38, 'lighter');
    else I.wash(c, px, py, r * 4, r * 4, a0 * br * .35, sd + i, rgb, 0, { edge: 'soft' });
    c.fillStyle = U.rgba(rgb, a0 * br * .9);
    c.beginPath(); c.arc(px, py, r, 0, 6.283); c.fill();
    c.fillStyle = U.rgba(dark ? [244, 255, 251] : [216, 240, 236], a0 * br * .45);
    c.beginPath(); c.arc(px - r * .2, py - r * .2, r * .44, 0, 6.283); c.fill();
  }
  c.restore();
};
/* 萤光点小字 I.moteText(c, text, t, t0, t1, o)：从 (x,y) 的萤光点旁浮出、半透明、缓慢上漂。
   字号缺省 CINE.SUB.size×.8（BRIEF 要求的「小字」；这是唯一允许小于正文字号的阅读样式）。
   o: x,y 萤光点坐标, side 'right'|'left', size, dark, a(.85), fo, fadeIn(.9), maxW, seed, contrast */
I.moteText = function (c, text, t, t0, t1, o) {
  o = o || {};
  var fo = o.fo == null ? .8 : o.fo, A = (o.a == null ? .85 : o.a) * (1 - U.ramp(t, t1 - fo, t1));
  if (t < t0 || A <= .003) return;
  var size = o.size || Math.round(CINE.SUB.size * .8), dark = o.dark !== false, sd = o.seed || 61;
  var ox = o.x == null ? W * .2 : o.x, oy = o.y == null ? H * .34 : o.y, right = o.side !== 'left';
  var sp = size * .1, fadeIn = o.fadeIn == null ? .9 : o.fadeIn;
  c.save(); I.screen(c);
  c.font = size + 'px ' + F.text; c.textBaseline = 'middle'; c.textAlign = 'left';
  var lines = wrap(c, text, o.maxW || W * .42, sp), lh = size * 1.32;
  var mp = '，。、！？；：', widths = lines.map(function (s) { return lineWidth(c, s, sp, mp, size); });
  var maxw = Math.max.apply(null, widths), tot = lines.length * lh;
  var x = right ? ox + size * 1.6 : ox - size * 1.6 - maxw, y0 = oy - (lines.length - 1) * lh / 2;
  var K = I.textContrast(c, [x - size * .3, y0 - size * .6, x + maxw + size * .3, y0 + tot - lh + size * .6],
    { dark: dark, light: MOTE, ink: MOTE_DK, alpha: o.a == null ? .85 : o.a, flip: true, contrast: o.contrast });
  dark = K.dark;
  var rgb = dark ? MOTE : MOTE_DK;
  if (K.need > .005) {
    var dabs = hdabs(c, lines, widths, x, y0, lh, size, sp, true, mp);
    I.textBacking(c, K, dabs, A * U.clamp((t - t0) * 2, 0, 1), sd + 30);
  }
  var idx = 0, drift = -7 * U.clamp((t - t0) / 5, 0, 1);
  for (var L = 0; L < lines.length; L++) {
    var s = lines[L], cx = x;
    for (var i = 0; i < s.length; i++) {
      var ch = s[i], cw = c.measureText(ch).width, k = U.clamp((t - t0 - idx * .045) / fadeIn, 0, 1);
      if (mp.indexOf(ch) >= 0) cx += size * .12;
      if (k > 0) {
        var ek = U.easeOut(k), a = A * ek;
        var fx = cx + cw / 2, fy = y0 + L * lh + drift + 1.8 * U.noise1(t * .4 + idx * .8, sd);
        var px = fx, py = fy + size * .25 * (1 - ek);
        if (dark) I.glow(c, px, py, size * .55, rgb, .07 * a);
        c.fillStyle = U.rgba(rgb, a); c.fillText(ch, px - cw / 2, py);
      }
      cx += cw + sp; idx += ch.length;
    }
  }
  c.restore();
  log('mote', text, [x - size * .3, y0 - size * .6, x + maxw + size * .3, y0 + tot - lh + size * .6]);
};

/* ---------- 传讯 I.slip(c, text, t, t0, t1, o)（幻荣夫人）----------
   竖排细字，字后一条柔边淡纸（1024 改版：去掉硬纸条、纸边描线、投影与展开/卷起；淡纸用 bandMask 竖放——两端收圆、两侧随噪声起伏，不成矩形）。
   整句淡入（t0 起 o.fadeIn，缺省 CINE.SUB.fade＝.25s）→ 停 → 淡出在 t1 完成（o.fo，缺省同）。
   o: x,y 第一字顶端中心（缺省 W*.78, H*.12）, size(38；总长超 maxH 时缩小), a, paper 淡纸浓度(.85), w 淡纸平顶半宽（字号倍，.75）, maxH(H*.78), seed, contrast
   字固定墨色；淡纸画上后再取样一次，不够时补衬底。 */
I.slip = function (c, text, t, t0, t1, o) {
  o = o || {};
  if (t < t0 || t > t1) return;
  var fi = o.fadeIn == null ? CINE.SUB.fade : o.fadeIn, fo = o.fo == null ? CINE.SUB.fade : o.fo;
  var A = (o.a == null ? 1 : o.a) * U.easeOut((t - t0) / fi) * (1 - U.ramp(t, t1 - fo, t1));
  if (A <= .003) return;
  var sd = o.seed || 83, gap = 1.14;
  var size = o.size || Math.round(CINE.SUB.size * .6), x = o.x == null ? W * .78 : o.x, y = o.y == null ? H * .12 : o.y;
  var chs = 0, i;
  for (i = 0; i < text.length; i++) if (text[i] !== '\n') chs++;
  var maxH = o.maxH || H * .78;
  if (chs * size * gap > maxH) size = Math.max(22, maxH / (chs * gap));
  var ty = y + size * .45, h = chs * size * gap + size * .9, dabs = I.vdabs(text, x, ty, size, gap, 1.2), cols = {};
  dabs.forEach(function (q) { var k = Math.round(q[0]); (cols[k] = cols[k] || []).push(q); });
  c.save(); I.screen(c); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'low';
  Object.keys(cols).forEach(function (k, ci) {               // 每列一条柔边淡纸
    var col = cols[k], s0 = col[0][1], len = Math.max(0, col[col.length - 1][1] - s0), half = size * (o.w == null ? .75 : o.w), r = half * 4;
    var cv = bandMask(len, half, sd + ci * 7, false);
    c.save(); c.globalAlpha *= A * (o.paper == null ? .85 : o.paper);
    c.translate(col[0][0] + r, s0 - r); c.rotate(Math.PI / 2); c.drawImage(cv, 0, 0, cv.width * 2, cv.height * 2);
    c.restore();
  });
  var K = I.textContrast(c, [x - size * .52, ty, x + size * .52, y + h - size * .45],
    { dark: false, light: PAPER, ink: INK, alpha: A * .94, flip: false, contrast: o.contrast });
  if (K.need > .005) I.textBacking(c, K, dabs, A, sd + 40);
  I.vtext(c, text, x, ty, { size: size, font: 'text', rgb: INK, a: A * .94, bleed: .04, grow: 0, gap: gap, colGap: 1.2 });
  c.restore();
  log('slip', text, [x - size * 1.05, y, x + size * 1.05, y + h]);
};

/* 对白 I.line(c, text, t, t0, t1, o)：I.sub kind:'line' 的便捷入口；o.who 传说话人名字即句首冠名（1024 起不再画色点）。 */
I.line = function (c, text, t, t0, t1, o) {
  o = o || {};
  var q = { kind: 'line' }, k;
  for (k in o) q[k] = o[k];
  q.kind = 'line';
  return I.sub(c, text, t, t0, t1, q);
};

/* ---------- 题注 I.note(c, text, t, t0, t1, o) ----------
   概念/地名/时间：竖排小字（霞鹜文楷，缺省 40px），可与字幕同屏；位置避开人脸与字幕带（缺省左上 W*.07, H*.12）。
   逐字淡显（8 字/秒）→ 停 → 在 t1 前 .6s 起墨晕散去（字后淡墨晕、字略放大、向外漂）；字旁一道枯笔细线作题跋。o: x,y,size,dark,seed,rule false 关细线 */
I.noteFx = I.noteFx || {};                               // 题注特效样式表（账本 pos 给 {fx:'daoyun'} 等），见下文「返工 D」
I.note = function (c, text, t, t0, t1, o) {
  o = o || {};
  if (t < t0 || t > t1) return;
  var size = o.size || 40, dark = o.dark !== false, x = o.x == null ? W * .07 : o.x, y = o.y == null ? H * .12 : o.y, sd = o.seed || 17;
  var k = U.clamp((t - (t1 - .6)) / .6, 0, 1), A = (o.a == null ? 1 : o.a) * Math.pow(1 - k, 1.4), n = 0, times = [];
  for (var i = 0; i < text.length; i++) times.push(t0 + (n++) / 8);
  /* o.cols：在句中逗号/分号后另起一列（自右向左，列距 1.5 字），长句不再拖成一长条（W193，10-26 作者反映后半句看不见） */
  var vs = o.cols ? text.replace(/([，；])(?=.)/g, '$1\n') : text, VC = vs.split('\n'), nc = VC.length, cg = size * 1.5, xl = x - (nc - 1) * cg;
  var len = Math.max.apply(null, VC.map(function (s2) { var L2 = 0; for (var j = 0; j < s2.length; j++) L2 += (PUNCT.indexOf(s2[j]) >= 0 && s2[j] !== '·' ? .35 : 1); return L2; })) * size * 1.12;
  if (nc === 1) len = text.length * size * 1.12;
  var K = I.textContrast(c, [xl - size / 2, y, x + size / 2, y + len], { dark: dark, light: [226, 218, 200], ink: [44, 38, 32], alpha: .92 * (o.a == null ? 1 : o.a), contrast: o.contrast });
  dark = K.dark;
  var rgb = dark ? [226, 218, 200] : [44, 38, 32];
  c.save(); I.screen(c);
  c.translate(x, y + len / 2); c.scale(1 + .05 * k, 1 + .05 * k); c.translate(-x - 6 * k, -y - len / 2);
  var NFX = o.fx && I.noteFx[o.fx], NG = NFX ? { t0: t0, t1: t1, x: x, y: y, size: size, len: len, A: A, dark: dark, rgb: rgb, seed: sd, n: text.length, opt: o.fxOpt || {} } : null;   // 返工 D：题注特效（I.noteFx），pre 在衬底下、post 在字上
  if (NFX) NFX(c, t, NG, 'pre');
  var gl = len * U.easeOut(U.clamp((t - t0 + .25) / (text.length / 8 + .25), 0, 1));   // 1022 协调者：衬底随逐字写出向下生长（原先一出现即整条全长，暗底上像一道墨痕）
  I.wash(c, (x + xl) / 2, y + gl / 2, size * 1.1 + (x - xl) * .5, Math.max(gl, size) * .62, (dark ? .32 : .18) * A * U.clamp((t - t0) * 3, 0, 1) + .12 * Math.sin(Math.PI * k), sd, dark ? [14, 12, 10] : [250, 247, 238], 0, { edge: 'soft' });
  if (K.need > .005) I.textBacking(c, K, I.vdabs(noteHead(vs, Math.min(text.length, Math.floor((t - t0) * 8) + 1)), x, y, size, 1.12, 1.5), A * U.clamp((t - t0) * 3, 0, 1), sd + 50);   // 1022：衬底只垫已写出的字
  I.vtext(c, vs, x, y, { size: size, font: 'text', rgb: rgb, a: A * .92, times: times, t: t, fade: .35, bleed: .12, grow: .06, gap: 1.12, colGap: 1.5 });
  if (NFX) NFX(c, t, NG, 'post');
  if (o.rule !== false) I.dry(c, [[x + size * .85, y - size * .1], [x + size * .8, y + len * .5], [x + size * .86, y + len + size * .2]],
    { w: 3.2, a: .5 * A * U.clamp((t - t0) * 2, 0, 1), rgb: rgb, seed: sd, dry: .55, hairs: 4, k: U.clamp((t - t0) / .5, 0, 1) });
  c.restore();
  log('note', text, [xl - size / 2, y, x + size / 2, y + len]);
};
function noteHead(vs, m) {                                // 分列串的前 m 个字（不计换行），供衬底只垫已写出的字
  var o2 = '', k2 = 0;
  for (var i = 0; i < vs.length && k2 < m; i++) { o2 += vs[i]; if (vs[i] !== '\n') k2++; }
  return o2;
}

/* ---------- 大字 I.big(c, text, t, t0, o) ----------
   竖排书法大字（问句/答句/片名等）：逐字「压出」——每字沿斜下方向由上而下显出（软边擦出＋字后湿墨一洇），
   字写完那一刻四周甩出一圈墨溅（之后留在纸上）。整句写完 ≤ o.span（缺省 1.2 秒，BRIEF §9.1）；o.times 可逐字给时刻（随剑吟一顿一顿）。
   o: x,y 第一列顶端中心（缺省 W*.62, H*.14）, size（150）, font 'poem'|'sword', rgb（缺省浅字：纸白；浅景传墨色）, a, colGap, gap, seed,
      splash 墨溅浓度（.8，0 关）, out [t1, t2] 淡出, fx/fxOpt 大字特效（I.bigFx 的样式名，见下），
      scatter {t, dir 弧度（字被冲向的方向，缺省 0 = 向右）, len 位移（320）, dur（.9）}：被答句的飞白冲散——每字切成横条沿 dir 拖散、拖出飞白、淡去。
   返回每字中心 [{ch,x,y,k}]（写进度 k）。 */
var REVEAL = null;
function revealCanvas(w, h) {
  if (!REVEAL || REVEAL.width < w || REVEAL.height < h) { REVEAL = U.canvas(Math.max(w, 1200, REVEAL ? REVEAL.width : 0), Math.max(h, 1200, REVEAL ? REVEAL.height : 0)); REVEAL._glyph = 1; }   // 一次给足（同 lib-flow tmp 注释）；_glyph：字形精灵标记（量对比度钩子用）
  return REVEAL;
}
function charSprite(ch, font, size, rgb) {
  rgb = U.qrgb(rgb);
  return U.cached('bigch:' + ch + ':' + font + ':' + size + ':' + rgb.join(','), function (px) {
    var S = Math.ceil(size * 1.5 * px), c = U.canvas(S, S), x = c.getContext('2d');
    x.setTransform(px, 0, 0, px, 0, 0);
    x.font = size + 'px ' + (F[font] || font); x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = U.rgba(rgb, .35); x.shadowBlur = size * .045 * px;       // 墨的洇边（缓存里只算一次）
    x.fillStyle = U.rgba(rgb, 1); x.fillText(ch, size * .75, size * .75);
    x.shadowBlur = 0; x.fillText(ch, size * .75, size * .75);
    c._glyph = 1;
    return c;
  });
}
I.big = function (c, text, t, t0, o) {
  o = o || {};
  var size = o.size || 150, font = o.font || 'poem', rgb = o.rgb || [238, 230, 212], A0 = o.a == null ? 1 : o.a, sd = o.seed || 31;
  if (o.out) A0 *= 1 - U.ramp(t, o.out[0], o.out[1]);
  var out = [];
  if (t < t0 - 1e-6 || A0 <= .003) return out;
  var x0 = o.x == null ? W * .62 : o.x, y0 = o.y == null ? H * .14 : o.y, gap = size * (o.gap || 1.06), colGap = size * (o.colGap || 1.3);
  var cols = text.split('\n'), chars = [], maxH = (o.maxH || H * .84) - (y0 - H * .08);
  var colH = function (col) { var h = 0; for (var i = 0; i < col.length; i++) h += PUNCT.indexOf(col[i]) >= 0 && col[i] !== '·' ? gap * .4 : gap; return h; };
  if (text.indexOf('\n') < 0 && colH(text) > maxH) {          // 太长：在最靠近中点的标点后折成两列（右列在前）
    var mid = text.length / 2, best = Math.round(mid), bd = 1e9;
    for (var b = 1; b < text.length - 1; b++) if ('：，、；'.indexOf(text[b]) >= 0 && Math.abs(b + 1 - mid) < bd) { bd = Math.abs(b + 1 - mid); best = b + 1; }
    cols = [text.slice(0, best), text.slice(best)];
  }
  var hmax = Math.max.apply(null, cols.map(colH));
  if (hmax > maxH) { var f = maxH / hmax; size *= f; gap *= f; colGap *= f; }
  cols.forEach(function (col, ci) {
    var cy = y0 + size / 2;
    for (var i = 0; i < col.length; i++) {
      var ch = col[i], p = PUNCT.indexOf(ch) >= 0 && ch !== '·';
      chars.push({ ch: ch, p: p, x: x0 - ci * colGap + (p ? size * .3 : 0), y: cy - (p ? gap * .3 : 0) });
      cy += p ? gap * .4 : gap;
    }
  });
  var n = chars.length, span = o.span == null ? 1.2 : o.span, dur = Math.min(.42, Math.max(.16, span / Math.max(1, n) * 1.6));
  var sc = o.scatter, P = CINE.px;
  /* 自动对比（ENGINE-NOTES §7.3c）：近灰的字色（纸白/墨）可换深浅；显式彩色只补衬底 */
  var mx = Math.max(rgb[0], rgb[1], rgb[2]) - Math.min(rgb[0], rgb[1], rgb[2]), gray = mx < 40, lite = .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2] > 128;
  var bxs = chars.map(function (q) { return q.x; }), bys = chars.map(function (q) { return q.y; });
  var K = I.textContrast(c, [Math.min.apply(null, bxs) - size / 2, Math.min.apply(null, bys) - size / 2, Math.max.apply(null, bxs) + size / 2, Math.max.apply(null, bys) + size / 2],
    { dark: lite, light: gray ? [238, 230, 212] : rgb, ink: gray ? [26, 21, 18] : rgb, alpha: o.a, flip: gray, contrast: o.contrast });
  if (K.flip) rgb = K.dark ? [238, 230, 212] : [26, 21, 18];
  c.save(); I.screen(c);
  var BFX = o.fx && I.bigFx && I.bigFx[o.fx], BG = null;    // 大字特效（I.bigFx，同 I.tagFx 的做法）：pre 画在字下、post 画在字上；纯 t
  if (BFX) BG = { t0: t0, out: o.out, A: A0, size: size, seed: sd, opt: o.fxOpt || {}, rgb: rgb, font: font, dur: dur,
    chars: chars.map(function (q, i) { var ts = o.times ? o.times[i] : t0 + (n > 1 ? i * (span - dur) / (n - 1) : 0); return { ch: q.ch, p: q.p, x: q.x, y: q.y, ts: ts, k: U.clamp((t - ts) / dur, 0, 1) }; }),
    sprite: function (ch, rgb2) { return charSprite(ch, font, Math.round(size), rgb2); } };
  if (K.need > .005) {
    var gone = sc && t > sc.t ? U.clamp((t - sc.t) / (sc.dur || .9), 0, 1) : 0;
    var dabs = chars.filter(function (q) { return !q.p; }).map(function (q) {
      var i = chars.indexOf(q), ts = o.times ? o.times[i] : t0 + (n > 1 ? i * (span - dur) / (n - 1) : 0);
      return [q.x, q.y, size * .5, U.clamp((t - ts) / dur * 1.5, 0, 1)];
    });
    dabs.axis = 'v';
    I.textBacking(c, K, dabs, A0 * (1 - gone), sd + 90);
  }
  if (BFX) BFX(c, t, BG, 'pre');                           // 衬底之后、字之前（否则晕色被衬底的纸色柔雾盖掉）
  chars.forEach(function (q, i) {
    var ts = o.times ? o.times[i] : t0 + (n > 1 ? i * (span - dur) / (n - 1) : 0), k = U.clamp((t - ts) / dur, 0, 1);
    out.push({ ch: q.ch, x: q.x, y: q.y, k: k });
    if (k <= 0) return;
    var sz = q.p ? size * .55 : size, spr = charSprite(q.ch, q.p ? 'text' : font, Math.round(sz), rgb), S = spr.width / P, A = A0;
    var sk = 0, dir = 0, len = 0;
    if (sc && t > sc.t) {                                      // 被冲散：离冲来方向近的字先散
      dir = sc.dir || 0; len = sc.len || 320;
      var ord = ((q.x - x0) * Math.cos(dir + Math.PI) + (q.y - y0) * Math.sin(dir + Math.PI)) / (size * 4);
      sk = U.clamp((t - sc.t - .08 * Math.max(0, -ord) - .08 * i / n) / (sc.dur || .9), 0, 1);
      if (sk >= 1) return;
    }
    if (k < 1) I.wash(c, q.x, q.y, sz * .75, sz * .75, .28 * A * Math.sin(Math.PI * k), sd + i, rgb, 0, { edge: 'soft' });
    var sp = o.splash == null ? .8 : o.splash;
    if (sp > 0 && !q.p && k >= 1) {                            // 一圈墨溅：写完那一刻甩出，留在纸上
      var kk = U.clamp((t - ts - dur) / .3, 0, 1), r = U.rng(sd * 7 + i * 31), ek = U.easeOut(kk), sa = sp * A * Math.pow(1 - sk, 2);
      var exit = .6 + r.pm(1.2), nd = 5 + Math.floor(r() * 6);  // 墨溅：多甩向收笔一侧，大小悬殊、有拖尾的泪滴
      for (var d = 0; d < nd; d++) {
        var ang = d < nd * .6 ? exit + r.pm(.7) : r() * 6.283, rr = sz * (.5 + .45 * r()) * (.6 + .4 * ek), big = r() < .25;
        var dr = sz * (big ? .03 + .03 * r() : .006 + .014 * r());
        c.fillStyle = U.rgba(rgb, (big ? .8 : .6) * sa);
        I.blot(c, q.x + Math.cos(ang) * rr, q.y + Math.sin(ang) * rr, Math.max(.8, dr * (.4 + .6 * ek)), sd + i * 13 + d, { rough: .35, n: 12, sx: 1 + r() * 2.2 * ek, sy: .8, rot: ang });
        c.fill();
      }
    }
    var ga = c.globalAlpha;
    if (sk > 0) {                                              // 飞白冲散：字沿 dir 拖出一串残影，再用顺着 dir 的笔毫丝理一刷，成枯笔飞白；越散越淡
      var e = U.easeOut(sk), Rw = Math.ceil((S + 2 * len) * P), R0 = revealCanvas(Rw, Rw), r0 = R0.getContext('2d'), ox = Rw / 2 - spr.width / 2, cd = Math.cos(dir), sn = Math.sin(dir);
      r0.setTransform(1, 0, 0, 1, 0, 0); r0.globalCompositeOperation = 'source-over'; r0.clearRect(0, 0, Rw, Rw);
      for (var j = 18; j >= 1; j--) { var fj = j / 18; r0.globalAlpha = (1 - fj) * .45 + .08; r0.drawImage(spr, ox + cd * len * P * e * fj, ox + sn * len * P * e * fj); }
      var pat = I.bristlePattern((sd + i) % 4, [0, 0, 0]);
      pat.setTransform(new DOMMatrix().translateSelf(Rw / 2, Rw / 2).rotateSelf(dir * 57.2958).scaleSelf(5 * P, 2.2 * P).translateSelf(0, 11 * i));
      r0.globalAlpha = 1; r0.globalCompositeOperation = 'destination-in'; r0.fillStyle = pat; r0.fillRect(0, 0, Rw, Rw);
      c.globalAlpha = ga * A * Math.pow(1 - sk, 1.1); c.drawImage(R0, 0, 0, Rw, Rw, q.x - Rw / P / 2, q.y - Rw / P / 2, Rw / P, Rw / P);
      c.globalAlpha = ga * A * Math.pow(Math.max(0, 1 - sk * 2.2), 1.5); c.drawImage(spr, q.x - S / 2, q.y - S / 2, S, S);
      c.globalAlpha = ga;
      return;
    }
    if (k >= 1) { c.globalAlpha = ga * A; c.drawImage(spr, q.x - S / 2, q.y - S / 2, S, S); c.globalAlpha = ga; return; }
    var R = revealCanvas(spr.width, spr.height), rx = R.getContext('2d'), ang = 1.15, ca = Math.cos(ang), sa2 = Math.sin(ang);   // 斜下约 66°
    rx.setTransform(1, 0, 0, 1, 0, 0); rx.globalCompositeOperation = 'source-over'; rx.clearRect(0, 0, spr.width, spr.height);
    rx.drawImage(spr, 0, 0);
    var Ls = spr.width * 1.2, front = (k * 1.25 - .1) * Ls, cx = spr.width / 2, cy = spr.height / 2;
    var gr = rx.createLinearGradient(cx - ca * Ls / 2, cy - sa2 * Ls / 2, cx + ca * Ls / 2, cy + sa2 * Ls / 2);
    var f0 = U.clamp((front - Ls * .18) / Ls, 0, 1), f1 = U.clamp(front / Ls, 0, 1);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(f0, 'rgba(0,0,0,1)'); gr.addColorStop(Math.max(f0, f1), 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    rx.globalCompositeOperation = 'destination-in'; rx.fillStyle = gr; rx.fillRect(0, 0, spr.width, spr.height);
    var pr = 1 + .05 * (1 - U.easeOut(k));                      // 压笔：下笔略重、收笔回正
    c.globalAlpha = ga * A; c.drawImage(R, 0, 0, spr.width, spr.height, q.x - S * pr / 2, q.y - S * pr / 2, S * pr, S * pr); c.globalAlpha = ga;
  });
  if (BFX) BFX(c, t, BG, 'post');
  c.restore();
  var vis = out.filter(function (e) { return e.k > 0; });
  if (vis.length) log('big', text, [Math.min.apply(null, vis.map(function (e) { return e.x; })) - size / 2, y0, x0 + size / 2, Math.max.apply(null, vis.map(function (e) { return e.y; })) + size / 2]);
  return out;
};

/* ---------- 印章 I.seal / I.sealColumn（竖排印列） ----------
   碑体（CINE.FONT.stele）白文小印：印泥色块、字镂空透出底色；边缘不齐、印泥颗粒与漏印斑（缓存成精灵，按 文字/档/字号/种子）。
   tone：'qing' 青（缺省）| 'gold' 金 | 'white' 素白。盖印动画：.28s 由大落定、略转正，落定一瞬溅几点印泥、
   深底上带一闪微光（.8s 退）。之后常驻。 */
var SEAL_TONE = { qing: [95, 168, 181], gold: [246, 235, 200], white: [250, 248, 240] };
function sealSprite(text, tone, size, seed) {
  return U.cached('seal:' + text + ':' + tone + ':' + size + ':' + seed, function (px) {
    var n = text.length, bw = size * 1.3, bh = n * size * 1.02 + size * .5, pad = 6, S = px;
    var c = U.canvas((bw + pad * 2) * S, (bh + pad * 2) * S), x = c.getContext('2d'), r = U.rng(seed), rgb = SEAL_TONE[tone] || SEAL_TONE.qing;
    x.setTransform(S, 0, 0, S, pad * S, pad * S);
    x.beginPath();                                              // 不齐的印边：四边各 10 段，带细碎起伏与圆角
    var pts = [], k, e = size * .035;
    for (k = 0; k < 10; k++) pts.push([bw * k / 10, U.noise1(k * .9, seed) * e]);
    for (k = 0; k < 10; k++) pts.push([bw + U.noise1(k * .9 + 20, seed) * e, bh * k / 10]);
    for (k = 0; k < 10; k++) pts.push([bw - bw * k / 10, bh + U.noise1(k * .9 + 40, seed) * e]);
    for (k = 0; k < 10; k++) pts.push([U.noise1(k * .9 + 60, seed) * e, bh - bh * k / 10]);
    pts.forEach(function (p, i) { if (i) x.lineTo(p[0], p[1]); else x.moveTo(p[0], p[1]); });
    x.closePath(); x.fillStyle = U.rgba(rgb, .93); x.fill();
    x.globalCompositeOperation = 'source-atop';                 // 印泥浓淡：几团略深略浅
    for (k = 0; k < 6; k++) { x.fillStyle = U.rgba(k % 2 ? [255, 255, 255] : [0, 0, 0], .025 + .03 * r()); I.blot(x, r() * bw, r() * bh, size * (.3 + .4 * r()), seed + k, { rough: .4 }); x.fill(); }
    x.globalCompositeOperation = 'destination-out';
    x.font = Math.round(size * .9) + 'px ' + F.stele; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#000';
    for (k = 0; k < n; k++) x.fillText(text[k], bw / 2, size * .25 + size * 1.02 * (k + .5));
    for (k = 0; k < 260; k++) {                                 // 颗粒与漏印：小点、偶有一道擦痕
      x.globalAlpha = .2 + .6 * r(); x.beginPath(); x.arc(r() * bw, r() * bh, (.3 + 1.1 * r() * r()) * size / 28, 0, 6.283); x.fill();
    }
    x.globalAlpha = .3;
    for (k = 0; k < 2; k++) { var yy = r() * bh; I.dry(x, [[r() * bw * .3, yy], [bw * (.4 + .6 * r()), yy + r.pm(size * .3)]], { w: size * .25, a: .9, seed: seed + k, dry: .8, hairs: 5, rgb: [0, 0, 0] }); }
    for (k = 0; k < 14; k++) {                                  // 边缘崩口
      x.globalAlpha = .9; var side = k % 4, u = r();
      var bx = side === 0 ? u * bw : side === 1 ? bw : side === 2 ? u * bw : 0, by = side === 0 ? 0 : side === 1 ? u * bh : side === 2 ? bh : u * bh;
      I.blot(x, bx, by, size * (.03 + .06 * r()), seed + 50 + k, { rough: .4, n: 10 }); x.fill();
    }
    c.w = bw + pad * 2; c.h = bh + pad * 2;
    return c;
  });
}
/* I.seal(c, text, x, y, o)：(x,y) 印的顶端中心。o: t, t0 盖印时刻（缺省立即）, tone, size 字号（28）, a, seed, rot（缺省按 seed 轻微歪 ±1.5°）, dark（缺省 true：落定一闪微光）
   返回印高（逻辑 px） */
I.seal = function (c, text, x, y, o) {
  o = o || {};
  var size = o.size || 28, tone = o.tone || 'qing', sd = o.seed || (text.length * 7 + size), spr = sealSprite(text, tone, size, sd);
  var t = o.t == null ? 1e9 : o.t, t0 = o.t0 == null ? -1e9 : o.t0, k = U.clamp((t - t0) / .28, 0, 1), A = o.a == null ? 1 : o.a;
  if (k <= 0 || A <= .003) return spr.h;
  var ek = U.easeOut(k), s = U.lerp(1.6, 1, ek) * (k > .7 ? 1 + .03 * Math.sin((k - .7) / .3 * Math.PI) : 1);
  var rot = (o.rot == null ? (U.hash(sd) - .5) * .05 : o.rot) + .1 * (1 - ek), rgb = SEAL_TONE[tone] || SEAL_TONE.qing;
  c.save(); I.screen(c);
  c.translate(x, y + spr.h / 2); c.rotate(rot); c.scale(s, s);
  c.globalAlpha *= A * U.clamp(k * 2.2, 0, 1);
  c.drawImage(spr, -spr.w / 2, -spr.h / 2, spr.w, spr.h);
  c.restore();
  var land = t - t0 - .22;
  if (land > 0 && land < 1) {
    c.save(); I.screen(c);
    if (o.dark !== false) I.glow(c, x, y + spr.h / 2, spr.h * (.7 + .5 * land), rgb, .35 * A * (1 - land) * (1 - land));
    var r = U.rng(sd * 3 + 1), sk = U.clamp(land / .25, 0, 1);
    c.fillStyle = U.rgba(rgb, .8 * A * (1 - U.ramp(land, .5, 1)));
    for (var i = 0; i < 7; i++) {                               // 落定时溅出的几点印泥
      var ang = r() * 6.283, d = (spr.w * .55 + spr.h * .2 * r()) * U.easeOut(sk);
      I.blot(c, x + Math.cos(ang) * d * .9, y + spr.h / 2 + Math.sin(ang) * d * .8, size * (.03 + .04 * r()), sd + i, { rough: .3, n: 10 }); c.fill();
    }
    c.restore();
  }
  return spr.h;
};
/* 印列：list = [{t 盖印时刻, text, tone, size}]，自上而下累积（右侧竖排一列，可逐项给 tone/size）。
   o: t 当前时刻, x（W*.95）, y0（H*.06）, y1（H*.96）, gap（10）, size 缺省字号（26）, a, dark。总高超出 [y0,y1] 时整列等比缩小。 */
I.sealColumn = function (c, t, list, o) {
  o = o || {};
  var x = o.x == null ? W * .95 : o.x, y0 = o.y0 == null ? H * .06 : o.y0, y1 = o.y1 == null ? H * .96 : o.y1, gap = o.gap == null ? 10 : o.gap;
  var hs = list.map(function (it) { var sz = it.size || o.size || 26; return it.text.length * sz * 1.02 + sz * .5 + 12; });
  var tot = hs.reduce(function (a, b) { return a + b + gap; }, -gap), k = Math.min(1, (y1 - y0) / tot), y = y0;
  list.forEach(function (it, i) {
    if (t >= it.t) I.seal(c, it.text, x, y, { t: t, t0: it.t, tone: it.tone, size: (it.size || o.size || 26) * k, a: o.a, dark: o.dark, seed: 101 + i * 7 });
    y += (hs[i] + gap) * k;
  });
};

/* ---------- 账本出字 I.ledger(c, t, act, o) ----------
   按 CINE.LEDGER（tools/build-ledger.py 由 TEXT-LEDGER.md 生成）把本幕全部文字按类别画出：起点＝账本幕内秒，退场＝账本「退场」秒。
   act：幕 ID（prologue / act1…act5 / coda；旧 BRIEF 名 east/mountain/… 经 ALIAS 也可用）。
   o: dark（缺省 true）, pos {T007: {side:'right', x, y, size, font, …}} 逐条覆盖, skip {T006: 1} 跳过（例如题签已写进幕 tags）,
      对白（1024 改版）：账本「字位」（r.side：left/right/center，build-ledger 从第 14 列读）优先于 pos 里的 side 与 x（y、size 等照用）；
      字位带「上」（r.top）＝顶部行位 y＝H×.1（不折行）；带「@数」（r.sx）＝块心横位 W×数（侧位仍夹边、按侧位折行；中位即 o.x）——任务 F：对白不压人，挪到同侧空处/居中/上方；
      说话人名以 NAME_SEP 接在文字前传给 I.sub（上屏冠名、体检计字）。
      tags false 不画题签, seals false 不画印列, sealOpt 印列参数（见 I.sealColumn）。
   类别 → 工具：旁白/台词/心声/心念/画外音/诵 → I.sub（kind narr/line/heart/thought/voice/chant）；题注 → I.note；题签 → I.nameTag；
   大字/片名 → I.big（问句用马善政、答句/片名用志莽行书；同拍内后一条大字出现时前一条被飞白冲散）；
   署名 → I.sub；印章 → I.sealColumn（逐项 tone/size）；画中字（程序笔画）与幕名（引擎幕卡）不在此画。 */
var ALIAS = { act0: 'prologue', east: 'act1', mountain: 'act2', jiuquan: 'act3', birth: 'act4', break: 'act5', act6: 'coda' };
var SUBK = { '旁白': 'narr', '台词': 'line', '对白': 'line', '心声': 'inner', '心念': 'thought', '画外音': 'voice', '诵': 'chant', '署名': 'narr',
  '秘阵声': 'array', '萤光点': 'mote', '传讯': 'slip' };
function merge(a, b) { var r = {}, k; for (k in a) r[k] = a[k]; if (b) for (k in b) r[k] = b[k]; return r; }
I.ledger = function (c, t, act, o) {
  o = o || {};
  var L = CINE.LEDGER || [], id = ALIAS[act] || act, pos = o.pos || {}, skip = o.skip || {}, dark = o.dark !== false, seals = [];
  var rows = L.filter(function (r) { return r.act === id; });
  rows.forEach(function (r, i) {
    if (skip[r.id]) return;
    var p = pos[r.id] || {}, k = r.kind;
    if (SUBK[k]) {
      if (t >= r.t - .01 && t <= r.out + .01) {
        var so = merge({ kind: SUBK[k], dark: dark }, p), txt = r.text;
        var who = r.who || r.speaker || r.spk;             // 账本生成器尚未定字段名：who/speaker/spk 都认
        if (who && so.who == null) so.who = who;           // 说话人：对白冠名、心声换色
        if (so.kind === 'line') {
          if (r.side) { so.side = r.side === 'center' ? null : r.side; delete so.x; }   // 账本字位优先（说话人一侧底部；不在画内居中）
          if (r.sx != null) { if (so.side) so.sideX = W * r.sx; else so.x = W * r.sx; }   // 任务 F：同侧挪到空处
          if (r.top) so.y = H * .1;                          // 任务 F：上移到上方空处（与 act4 W075/W077/W175 的顶部行位同高）
          if (so.who && so.name !== false) txt = (typeof so.name === 'string' ? so.name : so.who) + NAME_SEP + txt;
        }
        I.sub(c, txt, t, r.t, r.out, so);
      }
      return;
    }
    if (k === '题注') { I.note(c, r.text, t, r.t, r.out, merge({ dark: dark }, p)); return; }
    if (k === '题签') {
      if (o.tags === false) return;
      var nm = r.text.split(' · ');
      I.nameTag(c, t, merge({ name: nm[0], role: nm[1] || '', t0: r.t, x: W * .1, y: H * .14, side: 'left', dark: dark }, p));
      return;
    }
    if (k === '大字' || k === '片名') {
      var nx = null;
      for (var j = i + 1; j < rows.length; j++) if ((rows[j].kind === '大字' || rows[j].kind === '片名') && rows[j].beat === r.beat) { nx = rows[j]; break; }
      var sword = k === '片名' || /^答曰/.test(r.text), first = rows.filter(function (q) { return q.kind === '大字' && q.beat === r.beat; })[0] === r;
      var d = merge({ font: sword ? 'sword' : 'poem', size: k === '片名' ? 200 : 150, x: nx || !first ? W * (nx ? .66 : .5) : W * .6, y: H * .12, rgb: dark ? [238, 230, 212] : [26, 21, 18], seed: 40 + i,
        scatter: nx && k === '大字' && !sword ? { t: nx.t, dir: Math.PI * .02, len: 360, dur: .9 } : null, out: [r.out - .5, r.out] }, p);
      if (t >= r.t && t <= r.out + .01) I.big(c, r.text, t, r.t, d);
      return;
    }
    if (k === '印章') seals.push({ t: r.t, text: r.text, tone: r.tone, size: r.size });
  });
  if (seals.length && o.seals !== false) {
    seals.forEach(function (s) { s.tone = s.tone || 'qing'; s.size = s.size || 26; });
    I.sealColumn(c, t, seals, merge({ dark: dark }, o.sealOpt));
  }
};
/* ---------- 题签特效 I.tagFx（可复用样式）：账本 pos 里给某条题签 {fx:'zap', fxOpt:{tone:'gold'}} 即用，I.nameTag 在字下（pre）/字上（post）各调一次 ----------
   zap 神雷电光：出字时三道细电弧（柔边、分叉、墨中透光：淡晕＋青墨身＋透光芯，宽窄随噪声变）——一道从上方落进首字、一道沿名字列逐字窜下、一道横过身份列；
   字随之短促一亮（τ≈.2s 峰值、.2s 衰减，重画字形为透光色）→ 回落成微弱余光（字下一抹淡青柔晕＋字色略带青墨）；停留中偶闪两次细电丝（相邻两字间）；
   淡出前电光先散（t0+hold 起 .4s 退尽，早于题签墨晕散去 t0+.5+hold）。
   1025 雷电环绕（fxOpt.ring 缺省开，false 关）：出字到收字整个停留期，电弧绕整列游走（返工 C 起为有纵深的竖向螺旋，见 zapHelix）、每 1/16s 重抖；
   弧头一点星光白；字身一圈电光轮廓（字形 6 向错开重画成淡青白／星光白，压在墨字下）随噪声明灭；相邻两字之间每 .1s 跳一道细电丝。
   色：tone 'cyan' 淡青白（缺省）或 'gold' 泥金，均低饱和，全部 source-over，不用 lighter，不成霓虹。只画在题签列附近，不出题签区。
   纯 t：电弧抖动按 1/24s 取种重算，只用 U.rng / U.noise1。 */
I.tagFx = I.tagFx || {};
var ZAP_TONE = {
  cyan: { halo: [192, 210, 213], ink: [56, 82, 92], core: [234, 242, 239], tint: [62, 96, 108] },
  gold: { halo: [212, 196, 158], ink: [90, 74, 46], core: [242, 233, 210], tint: [118, 96, 58] }
};
var ZAP_STAR = [244, 244, 236];
var ZAP_RING = {                                          // 环绕电弧在浅纸上要读得出：弧身用青灰蓝墨（同主落雷的青墨带），芯留淡青白；字缘一圈青蓝光边
  cyan: { halo: [176, 198, 206], ink: [58, 96, 118], core: [238, 244, 242], rim: [86, 132, 154] },
  gold: { halo: [212, 196, 158], ink: [104, 84, 48], core: [242, 233, 210], rim: [150, 122, 72] }
};                          // 星光白（呼应「借诸天星力」），只做弧头小光点与字缘

function zapLen(P) { var L = 0; for (var i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); return L; }
function zapPts(a, b, amp, seed, depth) {             // 中点位移：折而不直，再由 I.stroke 的样条揉软
  var r = U.rng(seed), P = [a, b];
  for (var d = 0; d < depth; d++) {
    var N = [P[0]];
    for (var i = 1; i < P.length; i++) {
      var p = P[i - 1], q = P[i], dx = q[0] - p[0], dy = q[1] - p[1], L = Math.sqrt(dx * dx + dy * dy) || 1, off = r.pm(amp) * L;
      N.push([(p[0] + q[0]) / 2 - dy / L * off, (p[1] + q[1]) / 2 + dx / L * off], q);
    }
    P = N; amp *= .8;
  }
  return P;
}
function zapChain(V, amp, seed) {
  var out = [V[0]];
  for (var i = 1; i < V.length; i++) { var s = zapPts(V[i - 1], V[i], amp, seed + i * 13, 2); for (var j = 1; j < s.length; j++) out.push(s[j]); }
  return out;
}
function zapSlice(P, k0, k1) {
  var n = P.length - 1, i0 = Math.max(0, Math.floor(k0 * n)), i1 = Math.min(n, Math.ceil(k1 * n));
  return i1 - i0 >= 1 ? P.slice(i0, i1 + 1) : null;
}
function zapBolt(c, P, w, a, seed, T, branch) {
  if (!P || P.length < 2 || a <= .01) return;
  var n = Math.max(12, P.length * 3);
  var wf = function (s) { return (.15 + .85 * Math.sin(Math.PI * U.clamp(s, 0, 1))) * (.4 + .6 * (U.noise1(s * 9, seed) * .5 + .5)); };
  I.stroke(c, P, { w: w * 5, a: a * .2, rgb: T.halo, wf: wf, wob: .1, bleed: .5, fade: 0, n: n, seed: seed });
  I.stroke(c, P, { w: w * 1.6, a: a * .6, rgb: T.ink, wf: wf, wob: .25, bleed: .3, fade: .25, fb: .2, tex: .4, n: n, seed: seed + 1 });
  I.stroke(c, P, { w: w * .55, a: a * .95, rgb: T.core, wf: wf, wob: .2, bleed: 0, fade: 0, n: n, seed: seed + 2 });
  if (branch) {
    var r = U.rng(seed + 5), L = zapLen(P);
    for (var b = 0; b < branch; b++) {
      var i = Math.floor(r.range(.2, .8) * (P.length - 1)), p = P[i], q = P[Math.min(P.length - 1, i + 1)];
      var ang = Math.atan2(q[1] - p[1], q[0] - p[0]) + (r() < .5 ? -1 : 1) * r.range(.45, .95), len = Math.min(r.range(.16, .3) * L, 1.3 * w / .065);
      zapBolt(c, zapPts(p, [p[0] + Math.cos(ang) * len, p[1] + Math.sin(ang) * len], .3, seed + 40 + b, 3), w * .5, a * .7, seed + 60 + b, T, 0);
    }
  }
}
function zapRing(g) {                                   // 题签整列（名字列＋身份列）的外接椭圆：电弧绕它游走
  var P = g.nb.concat(g.rb), x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, sz = g.size;
  P.forEach(function (q) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); });
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, rx: (x1 - x0) / 2 + sz * .95, ry: (y1 - y0) / 2 + sz * .85 };
}
/* 1025→返工 C：环绕电弧改为「竖向螺旋」——3 道电弧沿绕整列的螺旋线游走（两道自下而上、一道自上而下），螺旋有纵深：
   cosθ>0 的一段在列前（post 相、字之上、全亮带分叉），cosθ<0 的一段在列后（pre 相、字之下、淡且细、无分叉），转到侧边时随纵深渐隐。 */
var ZAP_HX = [[1, .0, 1.15], [1, .5, 1.3], [-1, .27, 1.05]];   // [方向 1 自下而上／-1 自上而下, 相位, 一程秒数]
function zapHelix(c, t, g, S, TR, w, a, side) {
  if (a <= .01) return;
  var E = zapRing(g), sz = g.size, tau = t - g.t0, q16 = Math.floor(t * 16), y0 = E.cy - E.ry, y1 = E.cy + E.ry, turns = 3.4, tilt = sz * .6;
  for (var j = 0; j < ZAP_HX.length; j++) {
    var H = ZAP_HX[j], cyc = (tau + H[1] * H[2]) / H[2], seg = Math.floor(cyc), u = cyc - seg, rj = U.rng(S + 400 + j * 17 + seg * 7);
    var env = U.ramp(u, 0, .1) * (1 - U.ramp(u, .85, 1)) * (.75 + .25 * Math.max(0, U.noise1(t * 11 + j * 3, S + 410 + j)));
    if (env * a <= .01) continue;
    var th0 = rj() * Math.PI * 2, head = u * 1.45, len = .45, N = 40, runs = [], cur = null;
    for (var m = 0; m <= N; m++) {                       // 弧身：螺旋参数 s∈[head−len, head]（s=0 列底/列顶，1 另一端），超出列的部分不画
      var sp = head - len + len * m / N; if (sp < -.02 || sp > 1.02) { cur = null; continue; }
      var th = th0 + sp * turns * Math.PI * 2, dz = Math.cos(th), yy = H[0] > 0 ? U.lerp(y1, y0, sp) : U.lerp(y0, y1, sp);
      var pt = [E.cx + Math.sin(th) * E.rx * (1 + .06 * U.noise1(sp * 7 + seg, S + 420 + j)), yy + dz * tilt * .3 - Math.sin(th) * tilt * .25];
      var on = side > 0 ? dz > -.12 : dz < .12;
      if (!on) { cur = null; continue; }
      if (!cur) { cur = { P: [], d: [], s: [] }; runs.push(cur); }
      cur.P.push(pt); cur.d.push(dz); cur.s.push(m / N);
    }
    runs.forEach(function (R, k) {
      if (R.P.length < 2) return;
      var dm = R.d.reduce(function (x, y) { return x + Math.abs(y); }, 0) / R.d.length, tail = R.s[0] * .6 + .4;   // 越靠弧头越亮；越在正前/正后越实
      var P = zapChain(R.P.filter(function (_, i) { return i % 3 === 0 || i === R.P.length - 1; }), .26, S + 430 + j * 11 + k * 5 + q16 * 5);
      if (side > 0) zapBolt(c, P, w * (1.35 + .4 * U.noise1(j + seg, S + 440)), Math.min(1, a * env * (.55 + .6 * dm) * tail * 1.2), S + 450 + j + k + q16, TR, dm > .5 ? 2 : 1);
      else zapBolt(c, P, w * .75, a * env * .32 * (.5 + .5 * dm) * tail, S + 460 + j + k + q16, TR, 0);
    });
    if (side > 0 && head <= 1.02 && Math.cos(th0 + head * turns * Math.PI * 2) > 0) {   // 弧头在前时一点星光白
      var thh = th0 + head * turns * Math.PI * 2, yh = H[0] > 0 ? U.lerp(y1, y0, head) : U.lerp(y0, y1, head);
      I.glow(c, E.cx + Math.sin(thh) * E.rx, yh + Math.cos(thh) * tilt * .3 - Math.sin(thh) * tilt * .25, sz * .38, ZAP_STAR, .45 * a * env, 'source-over');
    }
  }
}
I.tagFx.zap = function (c, t, g, phase) {
  var nb = g.nb, rb = g.rb; if (!nb.length) return;
  var tau = t - g.t0, T = ZAP_TONE[g.opt.tone] || ZAP_TONE.cyan, TR = ZAP_RING[g.opt.tone] || ZAP_RING.cyan, S = g.seed * 101 + 9, sz = g.size, A = g.A;
  var out = 1 - U.ramp(tau, g.hold, g.hold + .4);
  var flash = U.ramp(tau, .1, .2) * (tau < .2 ? 1 : Math.exp(-(tau - .2) / .2));
  var after = U.ramp(tau, .2, .55) * (.8 + .2 * U.noise1(tau * 1.7, S)) * out;
  // 1025 雷电环绕（作者：整个停留期都要看得出是雷法）：live 从出字到收字（题签 t0+hold+.5 起墨晕散，电光随之退尽）
  var ring = g.opt.ring !== false, live = ring ? U.ramp(tau, .12, .4) * (1 - U.ramp(tau, g.hold + .55, g.hold + .95)) : 0;
  var q16 = Math.floor(t * 16), fq = Math.floor(t * 24);
  var w0 = sz * .065;
  var flick = live * (.72 + .28 * Math.max(0, U.noise1(t * 7.3, S + 21)) + .3 * Math.max(0, U.noise1(t * 13.1, S + 23) - .35));   // 电光明灭
  var SP = [1.0, 1.62], spk = SP.map(function (s) { return U.ramp(tau, s, s + .03) * (1 - U.ramp(tau, s + .07, s + .16)) * out; });
  var spMax = Math.max.apply(null, spk);
  if (phase === 'pre') {                                 // 字下柔光＋电光轮廓（字形按 6 个方向错开重画成淡青白，压在墨字下＝字身一圈光边）
    if (live > .01) zapHelix(c, t, g, S, TR, w0, A * live, -1);   // 竖向螺旋电弧的后半圈：在字后、淡、细
    var gl = Math.max(flash, after * .5, spMax * .6, flick * .75) * A;
    if (gl <= .005) return;
    nb.forEach(function (q, i) { I.glow(c, q[0], q[1], sz * (.85 + .3 * flash), T.halo, .5 * gl * (.85 + .15 * U.noise1(i * 1.3 + tau * 3, S)), 'source-over'); });
    rb.forEach(function (q, i) { I.glow(c, q[0], q[1], g.rs * .8, T.halo, .35 * gl * (.85 + .15 * U.noise1(i * 1.7 + tau * 3, S + 3)), 'source-over'); });
    if (flick > .01) {
      var ow = sz * (.045 + .02 * U.noise1(t * 9, S + 25));
      for (var d = 0; d < 8; d++) {                      // 外圈青蓝光边（粗细随噪声）＋内圈星光白
        var an = d * Math.PI / 4 + .3 * U.noise1(t * 5, S + 30 + d), wv = .6 + .4 * Math.max(0, U.noise1(t * 6 + d * 1.9, S + 40 + d) + .3), ro = ow * (d % 2 ? 1.15 : .8) * (.6 + .6 * wv);
        c.save(); c.translate(Math.cos(an) * ro, Math.sin(an) * ro); g.redraw(d % 2 ? TR.rim : ZAP_STAR, (d % 2 ? .34 : .4) * wv * flick * A); c.restore();
      }
    }
    return;
  }
  if (flash > .01) g.redraw(T.core, .62 * flash);      // 字亮一下
  var zf = live * Math.max(0, U.noise1(t * 17, S + 27) - .25) * 1.3;   // 停留中字身随电光一闪一闪（透成淡青白）
  if (zf > .01) g.redraw(T.core, .1 * Math.min(1, zf) * A);
  if (after > .01) g.redraw(T.tint, .2 * after);       // 余光：字色略透青墨
  var top = nb[0], i2 = Math.min(2, nb.length - 1), w = sz * .065, R = U.rng(S + 3);
  var arcs = [
    { V: [[g.x + sz * .4, top[1] - sz * 2], [g.x - sz * .15, top[1] - sz * .95], top, nb[Math.min(1, nb.length - 1)]], h: U.ramp(tau, 0, .14), k: U.ramp(tau, .1, .3), b: 2 },
    { V: nb.map(function (q, i) { return [q[0] + (i % 2 ? 1 : -1) * sz * R.range(.15, .32), q[1]]; }), h: U.ramp(tau, .08, .45), k: U.ramp(tau, .24, .62), b: 3 },
    { V: rb.length ? [nb[i2], [(nb[i2][0] + rb[0][0]) / 2, (nb[i2][1] + rb[0][1]) / 2 - sz * .3], rb[0], rb[rb.length - 1]] : null, h: U.ramp(tau, .16, .38), k: U.ramp(tau, .3, .52), b: 1 }
  ];
  arcs.forEach(function (o, j) {
    if (!o.V || o.h - o.k < .02) return;
    var P = zapChain(o.V, .24, S + j * 31 + fq * 3);
    zapBolt(c, zapSlice(P, o.k, o.h), w * (j ? .85 : 1), A * out, S + j * 7 + fq, T, o.b);
  });
  if (live > .01) {
    zapHelix(c, t, g, S, TR, w, A * live, 1);         // 竖向螺旋电弧的前半圈：压在字上、亮
    var cols2 = [nb, rb];                                 // 字与字之间不断跳接的电丝：每 .1s 一档，两档交叠
    for (var s2 = 0; s2 < 6; s2++) {                      // 每档两道
      var slot = Math.floor(tau * 10) * 2 + 1 - s2, sv = tau * 10 - Math.floor(slot / 2); if (slot < 0) continue;
      var rs2 = U.rng(S + 300 + slot * 13), col = rb.length > 1 && rs2() < .3 ? cols2[1] : cols2[0]; if (col.length < 2) continue;
      var ii = Math.floor(rs2() * (col.length - 1)), qa = col[ii], qb = col[ii + 1], dd = (rs2() < .5 ? -1 : 1) * sz * rs2.range(.28, .45);
      var ea = A * live * (1 - U.ramp(sv, .6, 3)) * U.ramp(sv, 0, .25); if (ea <= .01) continue;
      var P3 = zapChain([[qa[0] + dd, qa[1]], [qa[0] + dd * 1.25, (qa[1] + qb[1]) / 2], [qb[0] + dd * .9, qb[1]]], .35, S + 320 + slot * 3 + fq);
      zapBolt(c, P3, w * 1.15, Math.min(1, ea * 1.3), S + 330 + slot + fq, TR, 2);
    }
  }
  SP.forEach(function (s, j) {                           // 停留中的细电丝
    if (spk[j] <= .01 || nb.length < 2) return;
    var r = U.rng(S + 50 + j), i = Math.floor(r() * (nb.length - 1)), a = nb[i], b = nb[i + 1], d = (r() < .5 ? -1 : 1) * sz * .3;
    var P = zapChain([[a[0] + d, a[1] - sz * .1], [a[0] - d * .4, (a[1] + b[1]) / 2], [b[0] + d * .6, b[1] + sz * .1]], .3, S + 70 + j * 5 + fq);
    zapBolt(c, P, w * .55, A * spk[j] * .85, S + 80 + j + fq, T, 1);
  });
};
/* ---------- 大字特效 I.bigFx（可复用样式）：账本 pos 里给某条大字/片名 {fx:'yunxiao'} 即用，I.big 在字下（pre）/字上（post）各调一次 ----------
   yunxiao 万古云霄（道境长卷；原著 L78257–78276 青绿金碧、湖上众生得益）：每字写出那一刻，字下先洇开一圈泥金描边（同字形放大一线、柔边），
   随后青绿与泥金两色淡墨从字里一层层晕开（柔边、随时间缓缓外扩下沉）；整列写完后，字列底部一道青绿泥金的墨韵斜斜流向画里的山水（fxOpt.to [x,y]，
   缺省右下 W*.38,H*.56），沿路几点泥金屑随之飘落；淡出时（out 段）字先褪、晕色再盛一下随之化进长卷。只画字周与那道墨韵，不改长卷底图。
   色：青绿 [58,128,116]、泥金 [176,134,58]（描边 [214,172,84]），低饱和、source-over，不用 lighter。纯 t：只用 U.rng / U.noise1。 */
I.bigFx = I.bigFx || {};
var YX = { qing: [58, 128, 116], gold: [176, 134, 58], goldHi: [232, 204, 140], rim: [214, 172, 84] };
I.bigFx.yunxiao = function (c, t, g, phase) {
  var ch = g.chars.filter(function (q) { return !q.p; }); if (!ch.length) return;
  var sz = g.size, S = g.seed * 53 + 7, out = g.out || [1e9, 1e9];
  var fo = U.ramp(t, out[0], out[1]), live = 1 - U.ramp(t, out[0] + .25, out[1]);   // 淡出段：字先褪，晕色晚 .25s 才退
  if (phase === 'pre') {
    ch.forEach(function (q, i) {
      var tw = t - q.ts - g.dur; if (q.k <= 0) return;
      var rim = U.ramp(tw, -g.dur * .5, .25) * (1 - .35 * U.ramp(tw, .6, 2)) * live;   // 泥金描边：写完一亮，之后常驻略淡
      if (rim > .01) {
        var spr = g.sprite(q.ch, YX.rim), P = CINE.px, Sw = spr.width / P, ga = c.globalAlpha;
        for (var d = 0; d < 4; d++) {
          var an = d * Math.PI / 2 + .6, o2 = sz * .028 * (1 + .4 * U.noise1(t * .7 + d, S + i));
          c.globalAlpha = ga * .75 * rim; c.drawImage(spr, q.x - Sw / 2 + Math.cos(an) * o2, q.y - Sw / 2 + Math.sin(an) * o2, Sw, Sw);
        }
        c.globalAlpha = ga;
      }
      var bl = U.ramp(tw, -.1, 1.2);                           // 两色墨晕一层层外扩下沉
      if (bl <= .005) return;
      for (var L = 0; L < 3; L++) {
        var ph = U.clamp(bl * 1.2 - L * .2, 0, 1); if (ph <= 0) continue;
        var e = U.easeOut(ph), col = (i + L) % 2 ? YX.gold : YX.qing, dr = U.noise1(t * .25 + L, S + 20 + i * 3);
        var a = (.55 - L * .1) * (1 - .25 * e) * (live + .9 * fo * live);
        I.wash(c, q.x + sz * (.12 * L + .1 * dr) * e, q.y + sz * (.1 + .16 * L) * e, sz * (.55 + .45 * e + .2 * L), sz * (.45 + .3 * e + .15 * L), a, S + 40 + i * 7 + L, col, .3 * dr, { edge: 'soft' });
      }
    });
    var last = ch[ch.length - 1], fl = U.ramp(t, last.ts + g.dur + .1, last.ts + g.dur + 1.8) * live;   // 墨韵流向长卷
    if (fl > .005) {
      var to = g.opt.to || [W * .38, H * .56], x0 = last.x, y0 = last.y + sz * .45, N = 9;
      for (var m = 0; m < N; m++) {
        var u = (m + .5) / N; if (u > fl * 1.05) break;
        var bx = U.lerp(x0, to[0], u) + sz * .4 * Math.sin(u * 3.1 + 1) + sz * .1 * U.noise1(t * .3 + m, S + 70),
          by = U.lerp(y0, to[1], u) + sz * .25 * Math.sin(u * 2.3);
        var aa = .62 * (1 - .4 * u) * U.clamp((fl * 1.05 - u) * 4, 0, 1) * (1 + .6 * fo);
        I.wash(c, bx, by, sz * (.5 + .7 * u), sz * (.22 + .2 * u), aa, S + 80 + m, m % 3 === 1 ? YX.gold : YX.qing, .55 + .2 * Math.sin(u * 3), { edge: 'soft' });
      }
      var r = U.rng(S + 99);                                 // 泥金屑：沿墨韵飘落
      for (var k2 = 0; k2 < 14; k2++) {
        var u0 = r(), sp = r.range(.05, .12), uu = u0 + sp * (t - last.ts - g.dur);
        uu -= Math.floor(uu); if (uu > fl) continue;
        var px = U.lerp(x0, to[0], uu) + r.pm(sz * .6), py = U.lerp(y0, to[1], uu) + r.pm(sz * .4) + sz * .2 * Math.sin(t * .8 + k2);
        I.glow(c, px, py, sz * r.range(.05, .1), YX.rim, 1 * fl * Math.sin(Math.PI * uu), 'source-over');
      }
    }
    return;
  }
  // post：淡出段字被晕色吞没时字面透一层青绿（化进长卷）
  if (fo > .01) ch.forEach(function (q) {
    var spr = g.sprite(q.ch, YX.qing), P = CINE.px, Sw = spr.width / P, ga = c.globalAlpha;
    c.globalAlpha = ga * .35 * Math.sin(Math.PI * fo); c.drawImage(spr, q.x - Sw / 2, q.y - Sw / 2, Sw, Sw); c.globalAlpha = ga;
  });
};
/* wuxing 太初无形剑（原著 L77883–77897：「如气、如烟、如雾」，虚无深处藏一道锋锐；「其外清气流转，隐约剑形，随即隐没」）——10-25 作者返工 B：
   「无形」做在字上：字身透明，只剩一圈锋利的刃边勾出笔画（I.nameTag 的 drawName 钩子：名字先画进离屏层，再用笔画描边的窄带 destination-in 掏空，
   只留贴着笔画外缘、宽 ≈ .055 字高的实边；量对比度的白/黑遍同样经这一层，量到的就是刃边本身）；字腔里只留极淡的一层清气。
   一道极细的剑光（细白芯＋青墨身＋淡晕，两端收尖）自右上斜劈过整列，光头扫到哪个字，那个字的字身才实一下、刃边一亮，随即在 .45s 内又隐回透明，只余锐利的边。
   出字时一劈（τ .15–.5，自上而下），停留中段再一劈（τ 1.15–1.45，自下而上，偏一点角度）；出字前后一团淡青雾气聚起又化开，淡出时雾再起、刃边随雾散。
   色：低饱和青灰、青墨与淡青白，source-over，无霓虹；浅底刃边用深青墨，深底用淡青白。纯 t，只用 U.rng / U.noise1。 */
var WX = { mist: [190, 206, 204], qing: [112, 158, 158], core: [228, 240, 236], halo: [172, 204, 200] };
function wxMist(c, g, tau, a, seedOff) {
  if (a <= .004) return;
  var nb = g.nb, sz = g.size, r = U.rng(g.seed * 37 + 11 + seedOff), n = nb.length + 3;
  for (var i = 0; i < n; i++) {
    var q = nb[Math.min(nb.length - 1, Math.floor(r() * nb.length))], ox = r.pm(sz * .9), oy = r.pm(sz * .6), ph = r() * 9;
    var dx = U.noise1(tau * .6 + ph, g.seed + i) * sz * .5 + tau * sz * .18 * (i % 2 ? 1 : -1), dy = -tau * sz * .22 + U.noise1(tau * .5 + ph, g.seed + 40 + i) * sz * .3;
    I.wash(c, q[0] + ox + dx, q[1] + oy + dy, sz * r.range(.7, 1.3), sz * r.range(.35, .6), a * r.range(.6, 1), g.seed + 60 + i, WX.mist, r.pm(.6) + U.noise1(tau * .4, i) * .3, { edge: 'soft' });
  }
}
var WX_EDGE = { light: [30, 46, 54], dark: [226, 238, 234] }, WX_SW = [[.15, .5, 1], [1.15, 1.45, -1]];
function wxSweepPath(g, j) {                               // 第 j 道剑光：一条斜劈过整列的细线（略带弧），dir 1 自上而下、-1 自下而上
  var nb = g.nb, sz = g.size, top = nb[0], last = nb[nb.length - 1], sk = j ? -.35 : 0;
  var a = [g.x + sz * (1.25 + sk), top[1] - sz * 1.0], b = [g.x - sz * (1.05 - sk), last[1] + sz * .9], P = [], M = 28;
  for (var m = 0; m <= M; m++) { var u = m / M; P.push([U.lerp(a[0], b[0], u) + Math.sin(Math.PI * u) * sz * .12, U.lerp(a[1], b[1], u)]); }
  return WX_SW[j][2] > 0 ? P : P.reverse();
}
function wxReveal(g, tau, cy) {                            // 某高度 cy 处字身「显形」的强度：剑光头扫过后一实，再 .45s 指数隐去
  var nb = g.nb, top = nb[0][1], bot = nb[nb.length - 1][1], v = 0;
  for (var j = 0; j < WX_SW.length; j++) {
    var S = WX_SW[j], f = (cy - top + g.size) / (bot - top + 2 * g.size), tp = S[0] + (S[2] > 0 ? f : 1 - f) * (S[1] - S[0]), d = tau - tp;
    if (d > -.04) v = Math.max(v, U.ramp(d, -.04, .03) * Math.exp(-Math.max(0, d - .03) / .45));
  }
  return v;
}
I.tagFx.wuxing = function (c, t, g, phase) {
  var nb = g.nb; if (!nb.length) return;
  var tau = t - g.t0, sz = g.size, A = g.A, hold = g.hold;
  var mistIn = U.ramp(tau, 0, .25) * (1 - .8 * U.ramp(tau, .35, 1.1)), mistOut = U.ramp(tau, hold + .2, hold + .6) * (1 - U.ramp(tau, hold + .7, hold + 1));
  if (phase === 'pre') { wxMist(c, g, tau, .3 * (mistIn + mistOut) * A, 0); return; }
  for (var j = 0; j < WX_SW.length; j++) {                // 剑光：极细，光头带一点亮，尾巴很快收掉
    var S = WX_SW[j], hk = U.ramp(tau, S[0] - .05, S[1]), tk = U.ramp(tau, S[0] + .05, S[1] + .18);
    if (hk - tk <= .01) continue;
    var P = wxSweepPath(g, j), n = P.length - 1, Q = P.slice(Math.floor(tk * n), Math.ceil(hk * n) + 1);
    if (Q.length < 2) continue;
    var tw = function (s) { return Math.pow(Math.sin(Math.PI * U.clamp(s, 0, 1)), .6) * (.35 + .65 * s); }, fa = A;
    I.stroke(c, Q, { w: sz * .2, a: .16 * fa, rgb: WX.halo, wf: tw, wob: .03, bleed: .5, fade: 0, n: 30, seed: g.seed + 21 + j });
    I.stroke(c, Q, { w: sz * .045, a: .55 * fa, rgb: g.dark ? WX.qing : WX_EDGE.light, wf: tw, wob: .04, bleed: .15, fade: .1, n: 30, seed: g.seed + 22 + j });
    I.stroke(c, Q, { w: sz * .018, a: .95 * fa, rgb: WX.core, wf: tw, wob: .02, bleed: 0, fade: 0, n: 30, seed: g.seed + 23 + j });
    var hd = Q[Q.length - 1]; I.glow(c, hd[0], hd[1], sz * .28, WX.core, .55 * fa, 'source-over');
  }
};
/* 名字字形改由特效画：透明字身＋锋利刃边（见上）。vo＝I.nameTag 给 I.vtext 的同一组参数（name x y size rgb a times fade grow），按同一时序逐字显 */
I.tagFx.wuxing.drawName = function (c, t, g, vo) {
  var tau = t - g.t0, sz = vo.size, str = vo.name, edge = Math.max(1.3, sz * .026), ERGB = g.dark ? WX_EDGE.dark : WX_EDGE.light, ch = [];
  for (var i = 0, cy = vo.y + sz / 2; i < str.length; i++, cy += sz * 1.08) {
    var k = U.clamp((t - (vo.times[i] == null ? 1e9 : vo.times[i])) / vo.fade, 0, 1), ek = U.easeOut(k);
    if (k > 0) ch.push({ s: str[i], x: vo.x, y: cy, ek: ek, f: Math.round(sz * (1 + vo.grow * (1 - ek))) + 'px ' + F.poem, rv: wxReveal(g, tau, cy) });
  }
  if (!ch.length) return;
  var M = c.getTransform(), La = U.layerAcquire('wx-edge'), Lb = U.layerAcquire('wx-mask');
  try {
    [La, Lb].forEach(function (L) { L.setTransform(M); L.textAlign = 'center'; L.textBaseline = 'middle'; L.lineJoin = 'round'; });
    ch.forEach(function (q) {                              // 刃边：字形实填（计入字数与不透明度）→ 再与「笔画描边带」求交，掏空字腔
      La.font = q.f; La.fillStyle = U.rgba(ERGB, vo.a * q.ek); La.fillText(q.s, q.x, q.y);
      Lb.font = q.f; Lb.lineWidth = edge * 2; Lb.strokeStyle = '#000'; Lb.strokeText(q.s, q.x, q.y);
    });
    La.save(); La.setTransform(1, 0, 0, 1, 0, 0); La.globalCompositeOperation = 'destination-in'; La.drawImage(Lb.canvas, 0, 0); La.restore();
    I.textOverlay(function () {                            // 字腔：极淡清气；剑光扫过处字身实一下、刃边亮一下（装饰重画，不算字、不入对比度取样）
      ch.forEach(function (q) {
        c.font = q.f; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillStyle = U.rgba(WX.mist, (.05 + .05 * Math.sin(tau * 2.1 + q.y * .013)) * vo.a * q.ek); c.fillText(q.s, q.x, q.y);
        if (q.rv <= .01) return;
        c.lineJoin = 'round'; c.lineWidth = edge * 2.6; c.strokeStyle = U.rgba(WX.core, .7 * q.rv * vo.a * q.ek); c.strokeText(q.s, q.x, q.y);   // 刃光外缘：压在刃边之下，只亮出字外一圈
        c.fillStyle = U.rgba(vo.rgb, .9 * q.rv * vo.a * q.ek); c.fillText(q.s, q.x, q.y);
      });
    });
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(La.canvas, 0, 0); c.restore();
  } finally { U.layerRelease('wx-mask'); U.layerRelease('wx-edge'); }
};
/* ---------- 返工 D（10-25）：神通／法宝的题签、题注配专属特效（名字、地名、身份类不配） ----------
   共用：纯 t，只用 U.rng / U.noise1；低饱和、source-over、柔边，不成霓虹；都只画在本条字的近旁。
   tagFx.jianyi  玄黄 · 余慈之剑（W151，原著 L76569–76580：「锵然剑鸣，满室生寒」；高空「森然锐气，直如星辰斗柄，受其指向，则如坠数九寒冬」，剑意锁定、重如山岳）
      ——画顶垂下一线极细的寒锋直指首字（斗柄所指），锋尖一点寒星；出字时两圈扁平的剑鸣声纹自字列荡开；字周一层冷青灰寒气、细霜屑缓缓下沉；字身出字一亮转冷色。
   tagFx.qinglian  余慈 · 青莲剑化身（W123，原著 L77740–77741 青莲法剑衍化的化身；L77768「身外莲花盛开，片断真文道韵加持其身，身形再度虚化」）
      ——名字列脚下一朵青莲（八瓣）次第绽开，瓣尖各放出一道细剑芒；停留中莲瓣随呼吸微张；收字时莲瓣化开、剑芒先散。
   noteFx.daoyun  真文道韵：入耳便受制（W086，原著 L77602–77613：符纹轨迹烙进瞳孔、「哗哗」水浪般的细微余韵、像种子透过心神缝隙生根；L77668–77671 真文道韵）
      ——自题注列向画内一圈圈荡出极淡的声纹弧（水浪往复、一疏一密），弧上浮现几枚篆样真文碎片，亮一下即「烙」成淡痕。
   noteFx.sanyuan  三元秘阵：监察掌控，锁住余慈（W116，原著 L74043–74049：三城为基，上感周天星辰、下应地气水脉、中合人道气运）
      ——题注后一座极淡的三元阵：三个阵枢（天枢星点、人枢气缕、地枢水纹，与画里「三元锁」同一套符号）随字写出依次亮起，柔笔阵线连成三角，缓缓转动。
   noteFx.suifu  碎符如钩，扣住界域（W164，原著 L77871–77876：符纹碎片粘连界域外围，形散神不散，像铺下的挠钩扣着界域撕扯）
      ——题注两侧几枚残缺的符片，各甩出一道带倒钩的细线向外勾住，隔一阵一齐向外一扯。 */
var JY = { cold: [196, 212, 220], ink: [52, 74, 88], core: [236, 242, 244], tint: [64, 92, 108] };
I.tagFx.jianyi = function (c, t, g, phase) {
  var nb = g.nb; if (!nb.length) return;
  var tau = t - g.t0, sz = g.size, A = g.A, S = g.seed * 37 + 5, top = nb[0], bot = nb[nb.length - 1];
  var live = U.ramp(tau, 0, .3) * (1 - U.ramp(tau, g.hold + .3, g.hold + .8));
  if (live <= .005) return;
  if (phase === 'pre') {
    nb.forEach(function (q, i) { I.glow(c, q[0], q[1], sz * 1.05, JY.cold, .32 * live * A * (.85 + .15 * U.noise1(tau * 1.3 + i, S)), 'source-over'); });
    var r = U.rng(S + 3);                                // 霜屑：细小三叉，缓缓下沉
    for (var i = 0; i < 14; i++) {
      var px = top[0] + r.pm(sz * 1.4), py0 = top[1] - sz * .6 + r() * (bot[1] - top[1] + sz * 1.6), sp = r.range(10, 22), ph = r();
      var py = py0 + ((tau * sp + ph * 40) % 40) - 20, fa = live * A * .5 * (.5 + .5 * Math.sin(tau * 3 + i)), ss = sz * r.range(.05, .09);
      if (fa <= .01) continue;
      c.strokeStyle = U.rgba(g.dark ? JY.core : JY.ink, fa); c.lineWidth = 1; c.beginPath();
      for (var m = 0; m < 3; m++) { var an = m * Math.PI / 3 + ph; c.moveTo(px - Math.cos(an) * ss, py - Math.sin(an) * ss); c.lineTo(px + Math.cos(an) * ss, py + Math.sin(an) * ss); }
      c.stroke();
    }
    for (var j = 0; j < 2; j++) {                        // 剑鸣：两圈扁平声纹自字列荡开
      var u = U.clamp((tau - .12 - j * .22) / .7, 0, 1); if (u <= 0 || u >= 1) continue;
      var cy = (top[1] + bot[1]) / 2, rx = sz * (.7 + 2.6 * u), ry = rx * .28, fa2 = A * .5 * Math.sin(Math.PI * u) * (1 - u * .4);
      c.lineWidth = Math.max(1, sz * .02 * (1 - u * .6)); c.strokeStyle = U.rgba(g.dark ? JY.cold : JY.ink, fa2);
      c.beginPath(); c.ellipse(top[0], cy, rx, ry, 0, 0, Math.PI * 2); c.stroke();
    }
    return;
  }
  var yEnd = Math.max(bot[1], g.rb.length ? g.rb[g.rb.length - 1][1] : 0) + sz * 1.1;
  var dn = U.easeOut(U.ramp(tau, 0, .3)), y0 = 0, y1 = U.lerp(0, yEnd, dn), fl = .8 + .2 * U.noise1(t * 9, S + 9);   // 寒锋：自画顶一线垂落，贴着名字列右侧直指下方（斗柄所指）
  var bx = top[0] + sz * .82;
  if (y1 - y0 > 4) {
    var P = [[bx, y0], [bx, (y0 + y1) / 2], [bx, y1]], wf = function (s) { return .25 + .75 * Math.pow(s, .7); };
    I.stroke(c, P, { w: sz * .16, a: .18 * live * A, rgb: JY.cold, wf: wf, wob: 0, bleed: .4, fade: 0, n: 16, seed: S + 11 });
    I.stroke(c, P, { w: sz * .045, a: .6 * live * A * fl, rgb: JY.ink, wf: wf, wob: 0, bleed: .1, fade: 0, n: 16, seed: S + 12 });
    I.stroke(c, P, { w: sz * .016, a: .95 * live * A * fl, rgb: JY.core, wf: wf, wob: 0, bleed: 0, fade: 0, n: 16, seed: S + 13 });
    I.glow(c, bx, y1, sz * .45 * (1 + .6 * U.ramp(tau, .15, .3) * (1 - U.ramp(tau, .3, .8))), JY.core, .6 * live * A, 'source-over');   // 锋尖寒星
  }
  var fls = U.ramp(tau, .18, .28) * (1 - U.ramp(tau, .28, .7));
  if (fls > .01) g.redraw(JY.core, .55 * fls * A);
  g.redraw(JY.tint, .22 * U.ramp(tau, .3, .8) * live * A);
};
var QL = { petal: [118, 160, 152], ink: [52, 92, 88], core: [226, 238, 230] };
I.tagFx.qinglian = function (c, t, g, phase) {
  var nb = g.nb; if (!nb.length) return;
  var tau = t - g.t0, sz = g.size, A = g.A, S = g.seed * 53 + 3, bot = nb[nb.length - 1];
  var bloom = U.easeOut(U.ramp(tau, .05, .75)), out = U.ramp(tau, g.hold + .1, g.hold + .9), live = bloom * (1 - out);
  if (live <= .005 && out <= 0) return;
  var ft = g.rb.length ? g.rb[g.rb.length - 1] : bot, cx = ft[0], cy = ft[1] + sz * .95, N = 8, R = sz * (1.0 + .06 * Math.sin(tau * 2.2));   // 青莲托在身份列（「化身」）脚下
  if (phase === 'pre') {
    for (var i = 0; i < N; i++) {                        // 八瓣：后排四瓣淡、前排四瓣实；花瓣是两段二次曲线的尖叶
      var back = i % 2 === 0, an = -Math.PI / 2 + (i - (N - 1) / 2) / N * Math.PI * 1.15 * (.35 + .65 * bloom), L = R * (back ? 1.15 : .95) * (.3 + .7 * bloom) * (1 + .3 * out);
      var wdt = L * .32, ca = Math.cos(an), sa = Math.sin(an), tx = cx + ca * L + ca * out * sz * .4, ty = cy + sa * L * .9 + sa * out * sz * .4;
      var fa = A * (back ? .22 : .36) * (1 - out) * U.ramp(bloom, .05, .3);
      if (fa <= .01) continue;
      c.beginPath(); c.moveTo(cx, cy);
      c.quadraticCurveTo(cx + ca * L * .5 - sa * wdt, cy + sa * L * .5 * .9 + ca * wdt, tx, ty);
      c.quadraticCurveTo(cx + ca * L * .5 + sa * wdt, cy + sa * L * .5 * .9 - ca * wdt, cx, cy);
      c.fillStyle = U.rgba(QL.petal, fa); c.fill();
      c.lineWidth = Math.max(1, sz * .022); c.strokeStyle = U.rgba(g.dark ? QL.core : QL.ink, fa * 1.4); c.stroke();
      var sw = U.ramp(tau, .45 + i * .04, .62 + i * .04) * (1 - U.ramp(tau, .9 + i * .04, 1.5 + i * .04)) * (1 - out);   // 瓣尖剑芒
      if (!back && sw > .01) {
        var l2 = sz * (.4 + 1.3 * sw);
        I.stroke(c, [[tx, ty], [tx + ca * l2 * .5, ty + sa * l2 * .5], [tx + ca * l2, ty + sa * l2]], { w: sz * .045, a: .9 * sw * A, rgb: g.dark ? QL.core : QL.ink, wf: function (s) { return 1 - s; }, wob: 0, bleed: .1, fade: 0, n: 10, seed: S + i });
      }
    }
    I.glow(c, cx, cy - sz * .2, sz * 1.1, QL.petal, .2 * live * A, 'source-over');
    nb.forEach(function (q) { I.glow(c, q[0], q[1], sz * .9, QL.core, .25 * live * A, 'source-over'); });
    return;
  }
  var fls = U.ramp(tau, .4, .55) * (1 - U.ramp(tau, .55, 1));
  if (fls > .01) g.redraw(QL.core, .45 * fls * A);
  g.redraw(QL.ink, .2 * U.ramp(tau, .6, 1) * (1 - out) * A);
};
function seal(c, x, y, s, seed, a, rgb) {                 // 篆样真文碎片：方框缺一角＋两三笔折线
  var r = U.rng(seed); c.lineWidth = Math.max(1, s * .09); c.strokeStyle = U.rgba(rgb, a); c.lineCap = 'round'; c.beginPath();
  var h = s / 2, gap = Math.floor(r() * 4);
  var C = [[x - h, y - h], [x + h, y - h], [x + h, y + h], [x - h, y + h]];
  for (var e = 0; e < 4; e++) if (e !== gap) { c.moveTo(C[e][0], C[e][1]); c.lineTo(C[(e + 1) % 4][0], C[(e + 1) % 4][1]); }
  for (var m = 0; m < 2 + (r() < .5 ? 1 : 0); m++) {
    var px = x + r.pm(h * .6), py = y + r.pm(h * .6); c.moveTo(px, py); c.lineTo(px + r.pm(h * .7), py); c.lineTo(px + r.pm(h * .3), py + r.pm(h * .7));
  }
  c.stroke();
}
I.noteFx.daoyun = function (c, t, g, phase) {
  if (phase !== 'pre') return;
  var tau = t - g.t0, A = g.A * U.ramp(tau, 0, .4), sz = g.size, cx = g.x + sz * .3, cy = g.y + g.len * .5, ink = g.opt.ink || (g.dark ? [206, 218, 212] : [58, 80, 84]), S = g.seed * 41;   // fxOpt.ink：题注衬底与画面深浅相反时（浅衬底压暗景）按画面给弧色
  if (A <= .01) return;
  for (var j = 0; j < 7; j++) {                          // 声纹弧：每 .55s 荡出一圈，一疏一密（水浪往复），朝画内（左）开口
    var tb = Math.floor(tau / .55) - j, u = (tau - tb * .55) / 2.4; if (tb < 0 || u > 1) continue;
    var rr = sz * (1.2 + 9 * u) * (tb % 2 ? .93 : 1), fa = A * .8 * Math.sin(Math.PI * Math.min(1, u * 1.4)) * (1 - u);
    if (fa <= .01) continue;
    c.lineWidth = Math.max(1.2, sz * .08 * (1 - u * .6)); c.strokeStyle = U.rgba(ink, fa);
    c.beginPath(); c.ellipse(cx, cy, rr, Math.min(rr * 1.6, g.len * .62 + rr * .4), 0, Math.PI * .62, Math.PI * 1.38); c.stroke();
  }
  for (var k = 0; k < 6; k++) {                          // 真文碎片：在声纹上浮现、一亮，随后烙成淡痕
    var r = U.rng(S + k * 7), tk = .5 + k * .42 + r() * .2, v = tau - tk; if (v < 0) continue;
    var sx = cx - sz * r.range(2.2, 7.5), sy = g.y + g.len * r.range(.05, .6),   // 碎片只在上半，避开画下方人物
        fa2 = A * (v < .3 ? U.ramp(v, 0, .12) * .85 : .85 * Math.exp(-(v - .3) / .5) + .2);
    seal(c, sx, sy, sz * r.range(.8, 1.1), S + k * 13, Math.min(1, fa2 * 1.1), ink);
    if (v < .4) I.glow(c, sx, sy, sz * 1.1, g.dark ? [226, 234, 228] : [196, 210, 206], .5 * (1 - v / .4) * A, 'source-over');
  }
};
I.noteFx.sanyuan = function (c, t, g, phase) {          // 10-25 返工 E：与画里的「三元锁」同一套符号——天枢星点、人枢气缕、地枢水纹，柔笔阵线相连；去掉双环刻度与虚线（硬几何）
  if (phase !== 'pre') return;
  var tau = t - g.t0, A = g.A, sz = g.size, cx = g.x - sz * 1.3, cy = g.y + g.len * .42, R = sz * 3, rot = tau * .06;   // 阵图收在字列左侧，不压字
  var ink = g.dark ? [214, 210, 196] : [58, 80, 92], mist = g.dark ? [200, 214, 218] : [132, 154, 164];
  var on = function (i) { return U.ramp(tau, .1 + i * .35, .5 + i * .35); }, N = [], i;
  for (i = 0; i < 3; i++) { var an = -Math.PI / 2 + rot + i * Math.PI * 2 / 3; N.push([cx - sz * 1.2 + Math.cos(an) * R * .55, cy + Math.sin(an) * R]); }
  for (i = 0; i < 3; i++) {                              // 阵线：两两相连的柔笔弧（向外鼓），随阵枢亮起依次写出
    var a0 = N[i], a1 = N[(i + 1) % 3], k = U.ramp(tau, .3 + i * .35, 1 + i * .35); if (k <= 0) continue;
    var ox = cx - sz * 1.2, mx = (a0[0] + a1[0]) / 2 + ((a0[0] + a1[0]) / 2 - ox) * .35, my = (a0[1] + a1[1]) / 2 + ((a0[1] + a1[1]) / 2 - cy) * .35;
    I.dry(c, [a0, [mx, my], a1], { w: Math.max(2, sz * .07), a: .34 * A, rgb: ink, seed: g.seed + 40 + i, dry: .55, k: k });
  }
  N.forEach(function (p, i) {
    var k = on(i), fa = .6 * k * A; if (fa <= .01) return;
    var r = sz * .6;
    I.wash(c, p[0], p[1], r * 1.3, r * 1.3, fa * .5, g.seed + 50 + i, mist, 0, { edge: 'soft' });   // 枢眼：一团冷青淡墨
    I.wash(c, p[0], p[1], r * .45, r * .45, fa, g.seed + 54 + i, ink, 0, { edge: 'soft' });
    if (i === 0) for (var s = 0; s < 5; s++) { var rr = U.rng(g.seed + s); I.wash(c, p[0] + rr.pm(r * 1.6), p[1] - r * rr.range(1.1, 2.1), sz * .07, sz * .07, fa * (.7 + .3 * Math.sin(tau * 3 + s * 2)), g.seed + 60 + s, ink, 0, { edge: 'soft' }); }   // 天：星点
    if (i === 1) for (var q = 0; q < 4; q++) { var fq = ((tau * .5 + q / 4) % 1); I.wash(c, p[0] + sz * .12 * Math.sin(tau * 1.3 + q * 2), p[1] - r * (.6 + 2.2 * fq), sz * .06, sz * .09, fa * Math.sin(Math.PI * fq), g.seed + 70 + q, ink, 0, { edge: 'soft' }); }   // 人：气缕上升
    if (i === 2) for (var w = 0; w < 2; w++) { var u = ((tau * .6 + w * .5) % 1); I.wash(c, p[0], p[1] + r * .3, r * (1 + u * 1.4), r * (.16 + u * .14), fa * .55 * (1 - u), g.seed + 80 + w, ink, 0, { edge: 'soft' }); }   // 地：水纹
  });
};
I.noteFx.suifu = function (c, t, g, phase) {
  if (phase !== 'pre') return;
  var tau = t - g.t0, A = g.A * U.ramp(tau, .1, .6), sz = g.size, ink = g.dark ? [214, 206, 188] : [64, 58, 52], S = g.seed * 29 + 1;
  if (A <= .01) return;
  var tug = Math.pow(Math.max(0, Math.sin((tau - .8) * Math.PI / 1.1)), 6) * U.ramp(tau, .8, 1);   // 隔一阵一齐向外一扯
  for (var k = 0; k < 6; k++) {
    var r = U.rng(S + k * 11), side = k % 2 ? 1 : -1, sy = g.y + g.len * (.08 + .84 * (k + r()) / 6), sx = g.x + side * sz * r.range(.95, 1.3);
    var ap = U.ramp(tau, .1 + k * .12, .35 + k * .12); if (ap <= 0) continue;
    var ss = sz * r.range(.6, .85), fa = .9 * A * ap;
    c.save(); c.translate(sx, sy); c.rotate(r.pm(.5));             // 残符：缺角的小符片＋一笔符纹
    c.beginPath(); c.moveTo(-ss * .5, -ss * .7); c.lineTo(ss * .35, -ss * .75); c.lineTo(ss * .5, ss * .1); c.lineTo(ss * .1, ss * .7); c.lineTo(-ss * .45, ss * .55); c.closePath();
    c.fillStyle = U.rgba(g.dark ? [120, 96, 70] : [196, 170, 128], fa * .55); c.fill();
    c.lineWidth = 1.5; c.strokeStyle = U.rgba(ink, fa); c.stroke();
    c.beginPath(); c.moveTo(-ss * .2, -ss * .4); c.lineTo(ss * .15, -ss * .1); c.lineTo(-ss * .15, ss * .2); c.lineTo(ss * .1, ss * .45); c.stroke();
    c.restore();
    var L = sz * (1.2 + 1.2 * U.ramp(tau, .3 + k * .12, .8 + k * .12)) * (1 + .35 * tug), ex = sx + side * L, ey = sy + r.pm(sz * .5) - tug * sz * .1;   // 挠钩：带倒钩的细线向外勾住
    var mx = (sx + ex) / 2, my = (sy + ey) / 2 + sz * .4 * (1 - tug);
    c.lineWidth = Math.max(1.5, sz * .075); c.strokeStyle = U.rgba(ink, fa); c.lineCap = 'round';
    c.beginPath(); c.moveTo(sx + side * ss * .4, sy); c.quadraticCurveTo(mx, my, ex, ey);
    c.quadraticCurveTo(ex + side * sz * .28, ey + sz * .05, ex + side * sz * .14, ey + sz * .32); c.lineTo(ex - side * sz * .04, ey + sz * .2); c.stroke();
  }
};
/* baojian 太虚宝鉴（原著 L77188–77190：「从浑茫太虚之中，引来星光，锁定目标，一个时辰都不会消散…星光如影随形，照彻一身」）：
   出字时十来点星光自上方虚空斜落、拖一缕淡尾，各自落到字列外一圈椭圆「镜缘」上的定位点，落定时一闪即钉住不动（只微微明灭，不漂移、不散）；
   星点到齐时镜缘一圈淡银光自顶顺时针合拢，镜面里一层极淡的清光，字被照亮一下；随后一道柔边镜光斜掠镜面一次（如铜镜反照）。
   停留全程星点与镜缘锁住不散，只随题签一同淡去（淡出也不位移）。色：淡银白/银灰，低饱和，source-over，无金、无霓虹。纯 t，只用 U.rng / U.noise1。
   fxOpt：n 星点数（缺省 10）。浅底（dark=false）自动换成银灰墨色。 */
var BJ = { dark: { star: [232, 238, 242], halo: [178, 194, 208], rim: [204, 216, 226], fill: [150, 168, 186] },
  light: { star: [96, 110, 124], halo: [150, 162, 174], rim: [110, 124, 138], fill: [170, 180, 190] } };
I.tagFx.baojian = function (c, t, g, phase) {
  var nb = g.nb; if (!nb.length) return;
  var tau = t - g.t0, sz = g.size, A = g.A, T = g.dark ? BJ.dark : BJ.light, R = U.rng(g.seed * 53 + 17), n = g.opt.n || 10;
  var top = nb[0], last = nb[nb.length - 1], cx = g.x, cy = (top[1] + last[1]) / 2, ex = sz * 1.05, ey = (last[1] - top[1]) / 2 + sz * .85;
  var lock = U.ramp(tau, .5, .8), rimK = U.ramp(tau, .52, .9), sheen = U.ramp(tau, .9, 1.6);
  var st = [];
  for (var i = 0; i < n; i++) {
    var th = -Math.PI / 2 + i / n * Math.PI * 2 + R.pm(.12), tx = cx + Math.cos(th) * ex, ty = cy + Math.sin(th) * ey;
    var sx = tx + R.pm(sz * 1.6) + sz * .8, sy = ty - sz * R.range(3, 5.5), d0 = R.range(0, .16), ph = R() * 6.28;
    var u = U.ramp(tau, d0, d0 + .45), e = 1 - Math.pow(1 - u, 2.2);
    st.push({ tx: tx, ty: ty, sx: sx, sy: sy, u: u, e: e, ph: ph, land: U.ramp(tau, d0 + .45, d0 + .5) * (1 - U.ramp(tau, d0 + .55, d0 + .9)) });
  }
  if (phase === 'pre') {
    if (lock > .01) {                                    // 镜面：一层极淡清光（柔边，不成实盘）
      I.wash(c, cx, cy, ex * 1.05, ey * 1.02, .14 * lock * A, g.seed + 3, T.fill, 0, { edge: 'soft' });
    }
    if (rimK > .01) {                                    // 镜缘：一圈淡银光自顶顺时针合拢，之后锁住
      var M = 64, P = [];
      for (var m = 0; m <= Math.round(M * rimK); m++) { var a = -Math.PI / 2 + m / M * Math.PI * 2; P.push([cx + Math.cos(a) * ex, cy + Math.sin(a) * ey]); }
      if (P.length > 2) {
        var wf = function (s) { var q = U.noise1(s * 9, g.seed + 9) * .5 + .5; return .2 + .8 * q * q; };   // 镜缘断续、浓淡不匀，不成实线
        I.stroke(c, P, { w: sz * .34, a: .1 * A, rgb: T.halo, wf: wf, wob: .08, bleed: .7, fade: 0, n: 90, seed: g.seed + 31 });
        I.stroke(c, P, { w: sz * .06, a: .26 * A, rgb: T.rim, wf: wf, wob: .14, bleed: .5, fade: .3, fb: .35, tex: .6, n: 90, seed: g.seed + 32 });
      }
    }
    if (sheen > 0 && sheen < 1) {                        // 镜光一掠：柔边斜带自左上到右下，限在镜内
      c.save(); c.beginPath(); c.ellipse(cx, cy, ex * .96, ey * .97, 0, 0, Math.PI * 2); c.clip();
      var s0 = U.lerp(-1.4, 1.4, U.smooth(sheen)), bx = cx + s0 * ex, by = cy + s0 * ey * .5, gw = sz * .9;
      var gr = c.createLinearGradient(bx - gw, by + gw * .5, bx + gw, by - gw * .5);
      var sa = .22 * Math.sin(Math.PI * sheen) * A;
      gr.addColorStop(0, U.rgba(T.star, 0)); gr.addColorStop(.5, U.rgba(T.star, sa)); gr.addColorStop(1, U.rgba(T.star, 0));
      c.fillStyle = gr; c.fillRect(cx - ex, cy - ey, ex * 2, ey * 2); c.restore();
    }
    return;
  }
  if (lock > .01) g.redraw(T.star, .4 * lock * (1 - U.ramp(tau, .8, 1.3)));   // 星光到齐，字被照亮一下
  st.forEach(function (s, i) {
    if (s.u <= 0) return;
    var px = U.lerp(s.sx, s.tx, s.e), py = U.lerp(s.sy, s.ty, s.e);
    if (s.u < 1) {                                       // 落下途中：一缕淡尾
      var e0 = Math.max(0, s.e - .28), qx = U.lerp(s.sx, s.tx, e0), qy = U.lerp(s.sy, s.ty, e0);
      I.stroke(c, [[qx, qy], [(qx + px) / 2, (qy + py) / 2], [px, py]], { w: sz * .09, a: .3 * A * Math.min(1, s.u * 4), rgb: T.rim, wf: function (q) { return Math.pow(q, 1.4); }, wob: .02, bleed: .6, fade: 0, n: 16, seed: g.seed + 50 + i });
    }
    var tw = s.u < 1 ? 1 : .78 + .22 * Math.sin(tau * 2.1 + s.ph);   // 落定后只微微明灭
    I.glow(c, px, py, sz * (.26 + .3 * s.land), T.halo, .38 * A * tw, 'source-over');
    I.glow(c, px, py, sz * (.08 + .1 * s.land), T.star, .9 * A * tw, 'source-over');
  });
};
/* bingjie 太玄冰解（原著 L75919–75921：「箭矢锋芒之前，寒意剧盛。太玄冰解封闭了虚空一角…物性的消长变化，也给"固定"了那么瞬间」）：
   出字即寒：字列四周虚空先凝一层淡冰青的霜气，几枝霜花（主干＋两侧短羽，柔边、逐笔长出）自字间向外结开，字面结一层薄霜（重画字形为冰白、随即回落为微透冰青）；
   随后霜纹沿地面（fxOpt.ground 屏幕 y）自字列下方向 fxOpt.dir 一侧蔓延（主冰裂折而不直、带分叉，两侧压扁的霜晕贴地铺开，近大远小），
   停留中冻住不动（只极轻的冷光明灭）；淡出时冰随字一同化开（淡去，不位移）。
   色：冰青/冰白/青灰墨，低饱和，source-over，无霓虹；浅底自动换深一档。fxOpt：ground（缺省 H*.92）、dir 1|-1（缺省 1 向右）、len 蔓延长度 px（缺省 W*.3）。纯 t。 */
var BJIE = { dark: { frost: [206, 222, 232], ice: [236, 244, 248], line: [168, 196, 214], halo: [150, 178, 196] },
  light: { frost: [222, 232, 236], ice: [244, 248, 250], line: [104, 128, 144], halo: [150, 172, 188] } };
function frostFern(c, o, ang, L, k, w, a, T, seed) {        // 一枝霜花：主干＋两侧短羽，按 k 逐段长出
  if (k <= .01 || a <= .004) return;
  var r = U.rng(seed), P = zapPts(o, [o[0] + Math.cos(ang) * L, o[1] + Math.sin(ang) * L], .12, seed, 2), n = P.length - 1, m = Math.max(1, Math.ceil(n * k));
  var S = P.slice(0, m + 1), tp = function (s) { return Math.pow(1 - U.clamp(s, 0, 1), .7); };
  I.stroke(c, S, { w: w * 3.2, a: a * .22, rgb: T.halo, wf: tp, wob: .1, bleed: .6, fade: 0, n: 16, seed: seed + 1 });
  I.stroke(c, S, { w: w, a: a * .7, rgb: T.line, wf: tp, wob: .2, bleed: .35, fade: .2, tex: .4, n: 16, seed: seed + 2 });
  for (var i = 1; i < 6; i++) {                               // 短羽：自主干两侧斜出，越往外越短
    var f = i / 6; if (f > k) break;
    var q = [U.lerp(o[0], P[n][0], f), U.lerp(o[1], P[n][1], f)], bl = L * .32 * (1 - f) * r.range(.7, 1.1), kk = U.clamp((k - f) / .25, 0, 1);
    [-1, 1].forEach(function (sd) {
      var ba = ang + sd * r.range(.75, 1.05), e = [q[0] + Math.cos(ba) * bl * kk, q[1] + Math.sin(ba) * bl * kk];
      if (kk > .05) I.stroke(c, [q, [(q[0] + e[0]) / 2, (q[1] + e[1]) / 2], e], { w: w * .6, a: a * .55, rgb: T.line, wf: tp, wob: .1, bleed: .4, fade: .1, n: 8, seed: seed + 10 + i * 2 + (sd > 0 ? 1 : 0) });
    });
  }
}
function bjNet(seed, O, dir, len, sz, FL) {             // 冰裂网几何（只依种子与几何，纯函数）：7 支主裂多朝 dir 一侧、2 支朝后，各带 1–2 支折出的细叉
  var r = U.rng(seed * 7 + 3), out = [], b, j;
  for (b = 0; b < 9; b++) {
    var fw = b < 7, ang = fw ? (dir > 0 ? 0 : Math.PI) + r.pm(.9) : (dir > 0 ? Math.PI : 0) + r.pm(.5), bl = fw ? len * r.range(.4, 1) : sz * r.range(1.2, 2.4);
    var P = [O.slice()], x = O[0], y = O[1], n = 4 + (fw ? 1 : 0);
    for (j = 0; j < n; j++) { var a = ang + r.pm(.5); x += Math.cos(a) * bl / n; y += Math.sin(a) * bl / n * FL; P.push([x, y]); }
    var d0 = fw ? b * .035 : .12, w = sz * (fw ? .03 : .022) * r.range(.8, 1.2);
    out.push({ P: P, d0: d0, dur: .8, w: w });
    for (j = 0; j < (fw ? 2 : 1); j++) {
      var i = 1 + Math.floor(r() * (n - 1)), q = P[i], qa = ang + (j ? 1 : -1) * r.range(.6, 1.2), ql = bl * r.range(.12, .26), Q = [q.slice()];
      for (var k = 0; k < 2; k++) { var a2 = qa + r.pm(.4); Q.push([Q[k][0] + Math.cos(a2) * ql / 2, Q[k][1] + Math.sin(a2) * ql / 2 * FL]); }
      out.push({ P: Q, d0: d0 + .8 * i / n, dur: .3, w: w * .6 });
    }
  }
  return out;
}
function bjPartial(L, P, k) {                                // 折线画前 k（按累计长度）
  var seg = [0], i; for (i = 1; i < P.length; i++) seg.push(seg[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  var lim = seg[seg.length - 1] * k; L.beginPath(); L.moveTo(P[0][0], P[0][1]);
  for (i = 1; i < P.length; i++) {
    if (seg[i] <= lim) { L.lineTo(P[i][0], P[i][1]); continue; }
    var f = (lim - seg[i - 1]) / ((seg[i] - seg[i - 1]) || 1); L.lineTo(U.lerp(P[i - 1][0], P[i][0], f), U.lerp(P[i - 1][1], P[i][1], f)); break;
  }
  L.stroke();
}
I.tagFx.bingjie = function (c, t, g, phase) {
  var nb = g.nb; if (!nb.length) return;
  var tau = t - g.t0, sz = g.size, A = g.A, T = g.dark ? BJIE.dark : BJIE.light, R = U.rng(g.seed * 61 + 5);
  var gy = g.opt.ground == null ? H * .92 : g.opt.ground, dir = g.opt.dir === -1 ? -1 : 1, len = g.opt.len || W * .3;
  var top = nb[0], last = nb[nb.length - 1], cy = (top[1] + last[1]) / 2;
  var cold = U.ramp(tau, 0, .3), frz = U.ramp(tau, .05, .3) * (tau < .3 ? 1 : Math.exp(-(tau - .3) / .35));
  var shimmer = .85 + .15 * Math.sin(tau * 1.7 + g.seed);
  if (phase === 'pre') {
    I.wash(c, g.x, cy, sz * 1.5, (last[1] - top[1]) / 2 + sz * 1.1, .2 * cold * A, g.seed + 3, T.frost, 0, { edge: 'soft' });   // 虚空一角：一层冷霜气
    for (var i = 0; i < 7; i++) {                             // 字间结出的霜花
      var q = nb[i % nb.length], ang = (i % 2 ? 0 : Math.PI) + R.pm(.7) + (i > 3 ? Math.PI / 2 * (i % 2 ? 1 : -1) * .5 : 0), d0 = R.range(0, .2);
      var o = [q[0] + Math.cos(ang) * sz * .42, q[1] + Math.sin(ang) * sz * .3 + R.pm(sz * .2)];
      frostFern(c, o, ang, sz * R.range(.8, 1.3), U.ramp(tau, d0, d0 + .5), sz * .03, .6 * A * shimmer, T, g.seed + 100 + i * 17);
    }
    var gk = U.ramp(tau, .35, 1.6);                           // 地面结冰：自字列下方一点起，冰面与冰裂网压扁贴地、向 dir 一侧铺开
    if (gk > .01) {
      var O = [g.x + dir * sz * .2, gy], RG = U.rng(g.seed * 7 + 3), FL = .3;   // FL：地面透视压扁
      for (var h = 0; h < 9; h++) {                           // 冰面：一片片压扁的冷白晕，近大远小，随冰裂推进铺开
        var f = h / 8; if (f > gk + .05) break;
        var hx = O[0] + dir * len * f * .92, hy = gy + RG.pm(sz * .12), ha = A * U.clamp((gk - f) / .2, 0, 1), sc = 1 - f * .55;
        I.wash(c, hx, hy, sz * 2.0 * sc, sz * .5 * sc, .55 * ha, g.seed + 40 + h, T.ice, RG.pm(.08), { edge: 'soft' });
        I.wash(c, hx, hy + sz * .06, sz * 1.5 * sc, sz * .3 * sc, .14 * ha, g.seed + 50 + h, T.halo, 0, { edge: 'soft' });
      }
      var NET = bjNet(g.seed, O, dir, len, sz, FL);
      I.soft(c, function (L) {                                // 冰面＋冰裂网：折线（冰裂是折的，不是弯的），整层经 I.soft 洇开一圈，不留矢量硬边
        L.lineCap = 'round'; L.lineJoin = 'round';
        var r2 = U.rng(g.seed * 5 + 1);                       // 冰面：一串压扁的径向柔光（中心冷白、边缘化入纸色），随冰裂推进铺开
        for (var m = 0; m < 8; m++) {
          var f = m / 7, fa = U.clamp((gk - f * .85) / .2, 0, 1); if (fa <= 0) break;
          var hx = O[0] + dir * len * f * .9 + r2.pm(sz * .3), hy = gy + r2.pm(sz * .1), rx = sz * (2.3 - 1.1 * f) * r2.range(.85, 1.15), ry = rx * FL * .9;
          L.save(); L.translate(hx, hy); L.scale(1, ry / rx);
          var gr = L.createRadialGradient(0, 0, 0, 0, 0, rx);
          gr.addColorStop(0, U.rgba(T.ice, .5 * fa * A)); gr.addColorStop(.55, U.rgba(T.ice, .3 * fa * A)); gr.addColorStop(1, U.rgba(T.ice, 0));
          L.fillStyle = gr; L.beginPath(); L.arc(0, 0, rx, 0, Math.PI * 2); L.fill(); L.restore();
        }
        NET.forEach(function (B) {
          var bk = U.clamp((gk - B.d0) / B.dur, 0, 1); if (bk <= 0) return;
          L.strokeStyle = U.rgba(T.ice, .3 * A); L.lineWidth = B.w * 2.2; bjPartial(L, B.P, bk);
          for (var i = 1; i < B.P.length; i++) {              // 裂纹逐段收细（不等宽）
            var f0 = (i - 1) / (B.P.length - 1), f1 = i / (B.P.length - 1); if (f0 >= bk) break;
            var q0 = B.P[i - 1], q1 = B.P[i], e = Math.min(1, (bk - f0) / (f1 - f0));
            L.strokeStyle = U.rgba(T.line, .75 * shimmer * A); L.lineWidth = B.w * (1 - .7 * f0);
            L.beginPath(); L.moveTo(q0[0], q0[1]); L.lineTo(U.lerp(q0[0], q1[0], e), U.lerp(q0[1], q1[1], e)); L.stroke();
          }
        });
      }, { halo: .55, spread: 2.6, rim: 0, layer: 'tagfx-ice' });
    }
    return;
  }
  if (frz > .01) g.redraw(T.ice, .5 * frz);                    // 字面结霜一亮
  if (cold > .01) g.redraw(T.halo, .14 * cold * shimmer);      // 之后字色微透冰青
};
/* tianyan 天厌地弃（原著第 068 章 L78053–78060：余慈「念动则杀意倾注，虚空结构开始改变」，把这片天地的构建法则纳入掌握、「扭曲其中法理，不给他存身立足之地」，
   赵相山成了纯粹的「外人」，「呼吸的空气都是毒素」；第 069 章 L78213：「天厌地弃」的感觉重新上身，「完全失去了对身体的控制，从万丈高空向下急降」）：
   ①天厌——出字时几条冷灰墨舌自题签上方的天空压下来，压到首字头顶停住，之后一直悬着（天在上压）；字列一僵（τ .1–.5 细颤）、字身一闪暗干血色（杀意倾注）。
   ②法则扭曲——字列两侧几缕淡墨气脉，本该顺着往下走，到字旁却向外弯开、缓缓拧动（周遭的天地绕开它、不给落脚处）；断续、粗细不匀、带噪声，不成规整弧线。
   ③毒——字缝里渗出极淡的暗干血色薄雾，慢慢往外散（空气都是毒）。
   ④地弃——收字前，字从最下一字起逐个失了托底、往下坠、略带翻转，每字拖一缕向下的墨痕（与画中赵相山同一方向急坠），随题签墨晕一同散尽。
   色：冷灰墨、青灰、暗干血，低饱和，source-over，柔边；无金、无霓虹。浅底（dark=false）用墨色，深底自动换淡灰。纯 t，只用 U.rng / U.noise1。 */
var TYD = { light: { ink: [46, 48, 54], press: [78, 82, 90], vein: [96, 100, 108], blood: [96, 38, 32], haze: [112, 70, 62] },
  dark: { ink: [208, 210, 214], press: [170, 174, 182], vein: [150, 156, 164], blood: [150, 76, 66], haze: [140, 96, 88] } };
function tydDrop(g, i, n, tau) {                              // 第 i 字的下坠量（0..1）：最下一字先失托底
  var d0 = g.hold - .15 + (n - 1 - i) * .09;
  return U.easeIn(U.clamp((tau - d0) / 1.0, 0, 1));
}
function tydVeinPts(g, j, tau, k) {                          // 第 j 缕气脉：纵贯字列一侧，到字旁向外弯开，缓缓拧动（只取前 k 段）
  var nb = g.nb, sz = g.size, top = nb[0][1] - sz * 1.6, bot = nb[nb.length - 1][1] + sz * 1.9, side = j % 2 ? 1 : -1, r = U.rng(g.seed * 29 + j * 7);
  var base = (j % 2 ? g.x : (g.rb.length ? g.rx : g.x)) + side * sz * r.range(.95, 1.5), bul = sz * r.range(.45, .8), P = [], M = 18;
  for (var m = 0; m <= M; m++) {
    var u = m / M; if (u > k) break;
    var y = U.lerp(top, bot, u) + r.pm(sz * .05), push = Math.pow(Math.sin(Math.PI * U.clamp((u - .12) / .76, 0, 1)), 1.4);
    P.push([base + side * bul * push + sz * .16 * U.noise1(u * 3.1 + tau * .45, g.seed + 70 + j), y]);
  }
  return P;
}
function tydDabs(c, P, w, a, rgb, sd, gaps) {                 // 气脉/墨痕：沿折线密排柔边晕点（I.glow 源上叠），成一缕柔边淡墨，不出硬线也不出拉丝；gaps 处断开，粗细浓淡随噪声起伏
  for (var m = 1; m < P.length; m++) {
    if (gaps && gaps.indexOf(m) >= 0) continue;
    var p0 = P[m - 1], p1 = P[m], L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), N = Math.max(1, Math.ceil(L / (w * .45)));
    for (var h = 0; h < N; h++) {
      var u = (h + .5) / N, q = .45 + .55 * (U.noise1((m + u) * .9, sd) * .5 + .5);
      I.glow(c, U.lerp(p0[0], p1[0], u), U.lerp(p0[1], p1[1], u), w * q, rgb, a * q, 'source-over');
    }
  }
}
I.tagFx.tianyan = function (c, t, g, phase) {
  var nb = g.nb; if (!nb.length) return;
  var tau = t - g.t0, sz = g.size, A = g.A, T = g.dark ? TYD.dark : TYD.light, R = U.rng(g.seed * 43 + 3), n = nb.length;
  var top = nb[0], last = nb[n - 1], cy = (top[1] + last[1]) / 2;
  if (phase === 'pre') {
    var pk = U.easeOut(U.ramp(tau, 0, .6)), stay = 1 - .4 * U.ramp(tau, .8, 1.8);
    for (var b0 = 0; b0 < 5; b0++) I.glow(c, g.x - sz * .3 + (b0 - 2) * sz * .5 + sz * .1 * U.noise1(b0 + tau * .3, g.seed + 8), -sz * .5 + sz * .9 * pk + sz * .15 * (b0 % 2), sz * (1.0 + .2 * (b0 % 3)), T.press, .32 * pk * stay * A, 'source-over');   // ①天压：画外上方一团冷灰墨云压下来
    for (var i = 0; i < 3; i++) {                              // 云底垂下几条墨舌，一路压到首字头顶才停住（舌身摆动、渐细）
      var ox = (i - 1) * sz * .62 + R.pm(sz * .12), y1 = top[1] - sz * (.7 + .2 * R()), y0 = sz * .2, Q = [];
      for (var s1 = 0; s1 <= 8; s1++) { var u1 = s1 / 8; Q.push([g.x - sz * .3 + ox + sz * .16 * U.noise1(u1 * 2 + tau * .5, g.seed + 11 + i), U.lerp(y0, U.lerp(y0, y1, pk), u1)]); }
      for (var s3 = 1; s3 < Q.length; s3++) tydDabs(c, [Q[s3 - 1], Q[s3]], sz * (.38 - .26 * s3 / 8), .2 * pk * stay * A, T.press, g.seed + 20 + i * 9 + s3, null);
    }
    I.wash(c, g.x - (g.rb.length ? sz * .5 : 0), cy, sz * 1.9, (last[1] - top[1]) / 2 + sz * 1.6, .07 * pk * A, g.seed + 15, T.vein, 0, { edge: 'soft' });   // 字周空气发沉
    var vk = U.ramp(tau, .2, 1.0);                             // ②法则扭曲：两侧气脉一路往下走，到字旁却向外弯开、慢慢拧动，断续不连
    for (var j = 0; j < 5; j++) {
      var P = tydVeinPts(g, j, tau, vk); if (P.length < 3) continue;
      tydDabs(c, P, sz * (.12 + .04 * (j % 3)), .2 * A, T.vein, g.seed + 100 + j * 13, [4 + j % 3, 10 + (j * 2) % 4, 15]);
    }
    var hz = U.ramp(tau, .3, 1.1);                             // ③毒：字缝渗出暗干血薄雾，慢慢外散
    for (var m = 0; m < n + 3; m++) {
      var q = nb[m % n], drift = tau * sz * .14, sd2 = m % 2 ? 1 : -1;
      I.wash(c, q[0] + sd2 * (sz * .5 + drift) + sz * .12 * U.noise1(tau * .4 + m, g.seed + 120 + m), q[1] + sz * .35 * U.noise1(tau * .3 + m * 2, g.seed + 130 + m), sz * .7, sz * .4, .13 * hz * A, g.seed + 140 + m, T.haze, R.pm(.5), { edge: 'soft' });
    }
    return;
  }
  var jolt = U.ramp(tau, .1, .18) * Math.exp(-Math.max(0, tau - .18) / .3);   // 杀意倾注：字身一闪暗干血
  if (jolt > .01) g.redraw(T.blood, .6 * jolt);
  for (var i2 = 0; i2 < n; i2++) {                             // ④地弃：每字失托底时，从字底拖出一缕往下的淡墨痕
    var dk = tydDrop(g, i2, n, tau); if (dk <= .01) continue;
    var q2 = nb[i2], x0 = q2[0] + sz * .08 * U.noise1(i2 * 3.3, g.seed + 150), yb = q2[1] + sz * .9 * dk + sz * .42, L = sz * (.25 + .9 * dk), D = [];
    for (var s2 = 0; s2 <= 5; s2++) D.push([x0 + sz * .04 * U.noise1(s2 * .8 + i2, g.seed + 160), yb + L * s2 / 5]);
    tydDabs(c, D, sz * .18, .3 * A * Math.sin(Math.PI * Math.min(1, dk * 1.05)), T.ink, g.seed + 170 + i2 * 9, null);
  }
};
/* 名字字形由特效画：同一时序逐字显（与缺省 I.vtext 同参），只多两件事——τ .1–.5 整列一僵细颤；收字前逐字往下坠、略翻转（tydDrop）。 */
I.tagFx.tianyan.drawName = function (c, t, g, vo) {
  var tau = t - g.t0, sz = vo.size, str = vo.name, n = str.length, shiv = sz * .035 * (1 - U.ramp(tau, .1, .55)) * U.ramp(tau, .08, .12);
  for (var i = 0, cy = vo.y; i < n; i++, cy += sz * 1.08) {
    var dk = tydDrop(g, i, n, tau), jx = shiv * U.noise1(t * 38 + i * 5, g.seed + 180), dy = sz * .9 * dk, rot = (i % 2 ? 1 : -1) * .16 * dk;
    c.save(); c.translate(vo.x + jx, cy + sz / 2 + dy); c.rotate(rot); c.translate(-vo.x, -(cy + sz / 2));
    I.vtext(c, str[i], vo.x, cy, { size: sz, font: 'poem', gap: 1.08, rgb: vo.rgb, a: vo.a * (1 - .55 * dk), t: t, times: [vo.times[i]], fade: vo.fade, bleed: .18, grow: vo.grow, seed: (g.seed || 7) + i * 7 });
    c.restore();
  }
};
})();
