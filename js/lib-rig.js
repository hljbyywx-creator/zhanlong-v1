/* 《万古云霄》lib-rig.js —— 立绘次级运动（ink-rig 移植）+ 关键帧序列播放器。在 engine.js 之后、各幕之前载入。
   来源：lab/ink-rig/ink-rig.html 第一个 <script>（算法、常数、确定性论证见 lab/ink-rig/README.md），移植时的改动：
   ① 按 alpha 外接框裁切纹理（全幅透明立绘 1920×1080 里人物只占一小块），锚点一律写「底图像素坐标」，导出 JSON 同；
   ② 每次 draw 可给 amp 幅度倍率（摆幅、软上限、风中飘动同乘）与 strain {cloth, silk} 边长约束上限（衣摆/发带可单独放宽）；
   ③ 运动脚本 root 关键帧可写相对量 {t, dx, dy, rot, s}（相对锚点 pivot 在底图上的原位），缺省 root = 原位不动；
   ④ 图层留边 margin 缺省 260（放大到 3 倍时衣摆能甩出原图）。
   对外：CINE.InkRig（create/rootAt/EASE），I.rig（= env.rig）画、I.rig.define 登记配置、I.kfseq 关键帧序列。
   确定性：rig 实例只缓存配置派生量与「每帧开头整体覆盖」的工作数组；画面只取决于 (t, script, amp, strain, 配置)。 */
(function () {
'use strict';
var CINE = window.CINE, I = CINE.ink, U = CINE.util;

/* ---------- 可调常数（单位：局部像素 = 原图像素，秒）—— 与 lab 版一致 ---------- */
const DT = 1 / 120;
const MATERIALS = [
  { id: 'cloth', f: 1.05, z: 0.2, gain: 1, delay: 0.09, strain: 0.12 },
  { id: 'silk', f: 1.5, z: 0.13, gain: 2.2, delay: 0.26, strain: 0.2 }
];
const DYN = {
  inertia: 0.3, gravity: 5200, wind: 900, impulse: 420, impulseDur: 0.06, flutter: 4.5,
  limit: 120, iters: 40, relax: 1.6, limitSpread: 3, radial: 0.25, smoothIters: 8, rigidFall: 160, background: 0.15
};
const B1 = 1.70158, B2 = B1 + 1, B3 = B1 * 1.525;
const EASE = {
  linear: (x) => x, inQuad: (x) => x * x, outQuad: (x) => 1 - (1 - x) * (1 - x),
  inOutQuad: (x) => (x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x)),
  inCubic: (x) => x * x * x, outCubic: (x) => 1 - (1 - x) * (1 - x) * (1 - x),
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - 4 * (1 - x) * (1 - x) * (1 - x)),
  inSine: (x) => 1 - Math.cos(x * Math.PI / 2), outSine: (x) => Math.sin(x * Math.PI / 2), inOutSine: (x) => (1 - Math.cos(Math.PI * x)) / 2,
  inBack: (x) => B2 * x * x * x - B1 * x * x,
  outBack: (x) => 1 + B2 * (x - 1) * (x - 1) * (x - 1) + B1 * (x - 1) * (x - 1),
  inOutBack: (x) => (x < 0.5 ? (2 * x) * (2 * x) * ((B3 + 1) * 2 * x - B3) / 2 : ((2 * x - 2) * (2 * x - 2) * ((B3 + 1) * (2 * x - 2) + B3) + 2) / 2)
};
function hash1(i, seed) {
  let h = Math.imul(i ^ Math.imul(seed, 0x9e3779b1), 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 2147483648 - 1;
}
function noise1(x, seed) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return hash1(i | 0, seed) * (1 - u) + hash1((i + 1) | 0, seed) * u;
}
const smooth = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };

/* ---------- 运动脚本 ---------- */
function rootAt(keys, t, out) {
  const n = keys.length;
  let a = keys[0], b = a, u = 0;
  if (t >= keys[n - 1].t) a = b = keys[n - 1];
  else if (t > keys[0].t) {
    let i = 0;
    while (t >= keys[i + 1].t) i++;
    a = keys[i]; b = keys[i + 1];
    u = (EASE[a.ease] || EASE.linear)((t - a.t) / (b.t - a.t));
  }
  out.x = a.x + (b.x - a.x) * u; out.y = a.y + (b.y - a.y) * u;
  out.rot = (a.rot || 0) + ((b.rot || 0) - (a.rot || 0)) * u;
  out.s = (a.s || 1) + ((b.s || 1) - (a.s || 1)) * u;
  return out;
}
function windStrength(wind, t) {
  if (!wind) return 0;
  let s = (wind.base || 0) * (1 + 0.4 * noise1(t * 0.55, 11) + 0.18 * noise1(t * 1.9, 23));
  const gs = wind.gust || [];
  for (let i = 0; i < gs.length; i++) {
    const g = gs[i], u = (t - g.t) / g.dur;
    if (u > 0 && u < 1) { const k = Math.sin(Math.PI * u); s += g.amp * k * k; }
  }
  return s;
}

/* ---------- 次级运动：欠阻尼二阶系统，窗口重积分（见 README「确定性论证」） ---------- */
const CH = MATERIALS.map(({ f, z }) => {
  const om = 2 * Math.PI * f, sg = z * om, od = om * Math.sqrt(1 - z * z);
  const E = Math.exp(-sg * DT), c = Math.cos(od * DT), s = Math.sin(od * DT);
  return { om2: om * om, a11: E * (c + sg / od * s), a12: E * s / od, a21: -E * om * om / od * s, a22: E * (c - sg / od * s), sg };
});
const NSTEP = Math.ceil(10 / Math.min.apply(null, CH.map((c) => c.sg)) / DT);
const NREC = Math.ceil(Math.max(MATERIALS[0].delay, MATERIALS[1].delay) / DT) + 2;

function Dynamics() {
  this.fx = new Float64Array(NSTEP); this.fy = new Float64Array(NSTEP); this.fa = new Float64Array(NSTEP);
  this.rec = CH.map(() => ({ x: new Float64Array(NREC + 1), y: new Float64Array(NREC + 1), a: new Float64Array(NREC + 1) }));
  this._p0 = {}; this._p1 = {}; this._pm = {};
}
Dynamics.prototype._forces = function (script, t) {
  const keys = script.root, H = 1e-4, P0 = this._p0, P1 = this._p1, PM = this._pm;
  const wind = script.wind, wd = ((wind && wind.dirDeg) || 0) * Math.PI / 180, wcx = Math.cos(wd), wcy = Math.sin(wd);
  const imps = script.impulse || [], ID = DYN.impulseDur;
  let pvx = 0, pvy = 0, pva = 0;
  for (let k = 0; k <= NSTEP; k++) {
    const tb = t - (NSTEP - k) * DT;
    rootAt(keys, tb + H, P1); rootAt(keys, tb - H, P0);
    const vx = (P1.x - P0.x) / (2 * H), vy = (P1.y - P0.y) / (2 * H), va = (P1.rot - P0.rot) / (2 * H);
    if (k > 0) {
      const tm = tb - DT / 2;
      rootAt(keys, tm, PM);
      let wx = -DYN.inertia * (vx - pvx) / DT, wy = -DYN.inertia * (vy - pvy) / DT;
      const ws = windStrength(wind, tm) * DYN.wind;
      wx += ws * wcx; wy += ws * wcy;
      for (let i = 0; i < imps.length; i++) {
        const im = imps[i], u = (tm - im.t) / ID;
        if (u > 0 && u < 1) {
          const k2 = DYN.impulse * (im.amp == null ? 1 : im.amp) * Math.PI / (2 * ID) * Math.sin(Math.PI * u);
          wx += k2 * im.x; wy += k2 * im.y;
        }
      }
      const c = Math.cos(PM.rot), s = Math.sin(PM.rot), is = 1 / PM.s;
      this.fx[k - 1] = (c * wx + s * wy) * is + DYN.gravity * s;
      this.fy[k - 1] = (-s * wx + c * wy) * is + DYN.gravity * (c - 1);
      this.fa[k - 1] = DYN.inertia * (va - pva) / DT;
    }
    pvx = vx; pvy = vy; pva = va;
  }
};
Dynamics.prototype.solve = function (script, t) {
  this._forces(script, t);
  const k0 = NSTEP - NREC, fx = this.fx, fy = this.fy, fa = this.fa;
  for (let c = 0; c < CH.length; c++) {
    const C = CH[c], R = this.rec[c], iw = 1 / C.om2;
    let x = fx[0] * iw, y = fy[0] * iw, a = fa[0] * iw, vx = 0, vy = 0, va = 0;
    for (let k = 0; k < NSTEP; k++) {
      if (k >= k0) { R.x[k - k0] = x; R.y[k - k0] = y; R.a[k - k0] = a; }
      let q = fx[k] * iw, d = x - q; x = q + C.a11 * d + C.a12 * vx; vx = C.a21 * d + C.a22 * vx;
      q = fy[k] * iw; d = y - q; y = q + C.a11 * d + C.a12 * vy; vy = C.a21 * d + C.a22 * vy;
      q = fa[k] * iw; d = a - q; a = q + C.a11 * d + C.a12 * va; va = C.a21 * d + C.a22 * va;
    }
    R.x[NREC] = x; R.y[NREC] = y; R.a[NREC] = a;
  }
};

/* ---------- 自动锚点：没有手调配置时按 alpha 外接框给一套保守的竖立人物锚点（底图坐标） ----------
   头顶 12% 刚性、两脚刚性、腰压硬、下摆与两袖柔软、右上方当发带（silk）。只作起点，调试面板里再拖。 */
function autoPins(b) {
  const x = (u) => Math.round(b.x + b.w * u), y = (v) => Math.round(b.y + b.h * v), r = (k) => Math.round(Math.max(b.w, b.h * .45) * k);
  return [
    { id: 'pivot', kind: 'pivot', x: x(.4), y: y(.985) },
    { id: 'head', kind: 'rigid', x: x(.38), y: y(.13), r: r(.17) },
    { id: 'footL', kind: 'rigid', x: x(.25), y: y(.98), r: r(.05), fall: 140 },
    { id: 'footR', kind: 'rigid', x: x(.5), y: y(.985), r: r(.05), fall: 140 },
    { id: 'neck', kind: 'soft', x: x(.4), y: y(.22), r: r(.18), w: 0.03 },
    { id: 'waist', kind: 'soft', x: x(.42), y: y(.42), r: r(.3), w: 0 },
    { id: 'sleeveL', kind: 'soft', x: x(.15), y: y(.58), r: r(.2), w: 0.8 },
    { id: 'sleeveR', kind: 'soft', x: x(.7), y: y(.55), r: r(.22), w: 0.8 },
    { id: 'ribbon', kind: 'soft', x: x(.75), y: y(.18), r: r(.22), w: 0.9, mat: 'silk' },
    { id: 'hemL', kind: 'soft', x: x(.15), y: y(.93), r: r(.28), w: 0.7 },
    { id: 'hemR', kind: 'soft', x: x(.85), y: y(.9), r: r(.4), w: 1 },
    { id: 'chest', kind: 'breath', x: x(.42), y: y(.3), r: r(.3) },
    { id: 'robeHinge', kind: 'hinge', mat: 'cloth', x: x(.42), y: y(.4) },
    { id: 'ribbonHinge', kind: 'hinge', mat: 'silk', x: x(.45), y: y(.15) }
  ];
}
/* 挂幅（旗、幡）：顶端挂杆刚性，旗身越往下越软，悬挂点在顶 */
function hangPins(b) {
  const x = (u) => Math.round(b.x + b.w * u), y = (v) => Math.round(b.y + b.h * v), r = (k) => Math.round(b.w * k);
  return [
    { id: 'pivot', kind: 'pivot', x: x(.5), y: y(.03) },
    { id: 'barL', kind: 'rigid', x: x(.15), y: y(.04), r: r(.1), fall: 60 },
    { id: 'barC', kind: 'rigid', x: x(.5), y: y(.03), r: r(.12), fall: 60 },
    { id: 'barR', kind: 'rigid', x: x(.85), y: y(.04), r: r(.1), fall: 60 },
    { id: 'top', kind: 'soft', x: x(.5), y: y(.18), r: r(.6), w: .15 },
    { id: 'mid', kind: 'soft', x: x(.5), y: y(.45), r: r(.7), w: .45 },
    { id: 'low', kind: 'soft', x: x(.5), y: y(.72), r: r(.7), w: .8 },
    { id: 'tailL', kind: 'soft', x: x(.2), y: y(.95), r: r(.5), w: 1 },
    { id: 'tailR', kind: 'soft', x: x(.8), y: y(.95), r: r(.5), w: 1 },
    { id: 'hang', kind: 'hinge', mat: 'cloth', x: x(.5), y: y(.03) }
  ];
}
/* 立绘形态判断（无手调锚点时）：挂幅 → 'hang'；瘦高、填充够的竖立人物 → 'cloth'（站姿自动锚点）；
   其余（坐姿、横宽、大块透明、分离部件）→ 'sway'：整体刚性＋轻微整体摆动，不做网格变形，绝不撕裂 */
function shapeMode(alpha, W, H) {
  let filled = 0;
  const band = (y0, y1) => { let n = 0; for (let x = 0; x < W; x += 2) { for (let y = y0; y < y1; y += 2) if (alpha[(y * W + x) * 4 + 3] > 24) { n++; break; } } return n / Math.ceil(W / 2); };
  for (let k = 3; k < alpha.length; k += 16) if (alpha[k] > 24) filled++;
  let top = 0;                                                 // 顶端 12% 里最宽的一条（挂杆）：挂钩、绳子在最上面，所以逐条取最大
  for (let y0 = 0; y0 < H * .12; y0 += Math.max(2, Math.round(H * .02))) top = Math.max(top, band(y0, Math.min(H, y0 + Math.max(2, Math.round(H * .02)))));
  const fill = filled / (alpha.length / 16), bot = band(Math.round(H * .94), H), asp = H / W;
  if (top >= .55 && bot <= .3 && asp >= 1.8) return 'hang';   // 实测：灵旗 top .67 / bot .07；站立人物 top ≤ .46、bot ≥ .59
  if (asp >= 1.75 && fill >= .28) return 'cloth';
  return 'sway';
}
function makeCanvas(w, h, opts) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return { c, x: c.getContext('2d', opts) };
}
function rootMatrix(r, px, py) {
  const c = Math.cos(r.rot) * r.s, s = Math.sin(r.rot) * r.s;
  return [c, s, -s, c, r.x - (c * px - s * py), r.y - (s * px + c * py)];
}
/* alpha 外接框（底图像素），四周加 pad，夹在图内 */
function alphaBox(data, W, H, pad) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    const row = y * W * 4;
    for (let x = 0; x < W; x++) if (data[row + x * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; y1 = y; }
  }
  if (x1 < 0) return { x: 0, y: 0, w: W, h: H };
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/* ---------- Rig ----------
   image：整张透明立绘（<img> 或 canvas，底图像素坐标）。opts（全部可省，导出的 JSON 可直接传）：
     pins 锚点（底图坐标，见 README 锚点表）| weights 笔刷增量（长度 (cols+1)(rows+1)）| grid {cols,rows}（缺省按格约 20px）|
     crop {x,y,w,h}（缺省 alpha 外接框外扩 8px）| margin 图层留边（260）| amp / strain 该立绘的缺省倍率与边长上限 */
function Rig(image, opts) {
  opts = opts || {};
  const IW = image.naturalWidth || image.width, IH = image.naturalHeight || image.height;
  let crop = opts.crop;
  if (!crop) {
    const F = makeCanvas(IW, IH, { willReadFrequently: true });
    F.x.drawImage(image, 0, 0);
    crop = alphaBox(F.x.getImageData(0, 0, IW, IH).data, IW, IH, 8);
  }
  this.crop = { x: crop.x, y: crop.y, w: crop.w, h: crop.h };
  this.ox = crop.x; this.oy = crop.y;
  const W = this.W = crop.w, H = this.H = crop.h;
  this.cols = (opts.grid && opts.grid.cols) || Math.max(4, Math.round(W / 20));
  this.rows = (opts.grid && opts.grid.rows) || Math.max(4, Math.round(H / 20));
  this.margin = opts.margin || 260;
  this.amp = opts.amp || 1; this.strain = opts.strain || null;
  const T = makeCanvas(W, H, { willReadFrequently: true });
  T.x.drawImage(image, crop.x, crop.y, W, H, 0, 0, W, H);
  this.tex = T.c; settleC(T.c);
  this.BW = W + 2 * this.margin; this.BH = H + 2 * this.margin;   // 图层尺寸（共用一张离屏层的左上角这一块，见 sharedLayer）
  const alpha = T.x.getImageData(0, 0, W, H).data;
  this.mode = opts.mode || (opts.pins ? 'cloth' : shapeMode(alpha, W, H));
  let pins = opts.pins || (this.mode === 'hang' ? hangPins(this.crop) : autoPins(this.crop));
  if (opts.rigid) pins = pins.concat(opts.rigid.map((q, i) => ({ id: 'rigidX' + i, kind: 'rigid', x: q[0], y: q[1], r: q[2], fall: q[3] || 80 })));   // act 追加的刚性区（底图坐标 [x,y,r,fall]）
  this.pins = pins.map((p) => { const q = JSON.parse(JSON.stringify(p)); q.x -= this.ox; q.y -= this.oy; return q; });   // 内部用裁切局部坐标
  this._buildMesh(alpha);
  const nv = this.rx.length;
  this.delta = new Float64Array(nv);
  if (opts.weights) {
    if (opts.weights.length !== nv) throw new Error('weights 长度 ' + opts.weights.length + ' ≠ 顶点数 ' + nv + '（grid 不匹配）');
    this.delta.set(opts.weights);
  }
  this.dyn = new Dynamics();
  this._r = { x: 0, y: 0, rot: 0, s: 1 };
  this._norm = new WeakMap();
  this._esKey = '';
  this.stats = { tris: 0, draws: 0, maxStrain: 0, maxStrainCloth: 0, overStrain: 0, rigidErr: 0 };
  this.refresh();
}
Rig.prototype._buildMesh = function (alpha) {
  const W = this.W, H = this.H, cols = this.cols, rows = this.rows, nx = cols + 1, nv = nx * (rows + 1);
  const cw = W / cols, ch = H / rows;
  this.cw = cw; this.ch = ch;
  this.rx = new Float64Array(nv); this.ry = new Float64Array(nv);
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) { this.rx[j * nx + i] = i * cw; this.ry[j * nx + i] = j * ch; }
  const cells = [], used = new Uint8Array(nv);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x0 = Math.max(0, Math.floor(i * cw) - 1), x1 = Math.min(W, Math.ceil((i + 1) * cw) + 1);
    const y0 = Math.max(0, Math.floor(j * ch) - 1), y1 = Math.min(H, Math.ceil((j + 1) * ch) + 1);
    let hit = false;
    for (let y = y0; y < y1 && !hit; y++) for (let x = x0; x < x1; x++) if (alpha[(y * W + x) * 4 + 3]) { hit = true; break; }
    if (!hit) continue;
    cells.push(j * cols + i);
    const v = j * nx + i; used[v] = used[v + 1] = used[v + nx] = used[v + nx + 1] = 1;
  }
  this.cells = Int32Array.from(cells);
  this.verts = Int32Array.from(Array.from(used.keys()).filter((v) => used[v]));
  const seen = new Set(), ea = [], eb = [];
  const add = (a, b) => { const k = Math.min(a, b) * nv + Math.max(a, b); if (!seen.has(k)) { seen.add(k); ea.push(a); eb.push(b); } };
  for (const c of cells) {
    const v = Math.floor(c / cols) * nx + (c % cols);
    add(v, v + 1); add(v + nx, v + nx + 1); add(v, v + nx); add(v + 1, v + nx + 1); add(v, v + nx + 1); add(v + 1, v + nx);
  }
  this.ea = Int32Array.from(ea); this.eb = Int32Array.from(eb);
  this.el = Float64Array.from(ea, (a, i) => Math.hypot(this.rx[eb[i]] - this.rx[a], this.ry[eb[i]] - this.ry[a]));
  this.qx = new Float64Array(nv); this.qy = new Float64Array(nv);
  this.w = new Float64Array(nv); this.inv = new Uint8Array(nv); this.bw = new Float64Array(nv);
  this.tx = new Float64Array(nv); this.ty = new Float64Array(nv); this.hr = new Float64Array(nv);
  this.ks = new Float64Array(nv); this.cx = new Float64Array(nv); this.cy = new Float64Array(nv); this.cn = new Uint8Array(nv);
  this.sf = new Float64Array(nv); this.di = new Int32Array(nv); this.df = new Float64Array(nv);
  this.ef = new Float64Array(ea.length); this.es = new Float64Array(ea.length);
};
Rig.prototype.refresh = function () {
  const pins = this.pins, diag = Math.hypot(this.cw, this.ch);
  const pv = pins.find((p) => p.kind === 'pivot') || { x: this.W / 2, y: this.H };
  const br = pins.find((p) => p.kind === 'breath');
  const hinge = (mat) => pins.find((p) => p.kind === 'hinge' && p.mat === mat) || pv;
  const hc = hinge('cloth'), hs = hinge('silk');
  this.px = pv.x; this.py = pv.y;
  if (br) { this.bx = br.x; this.by = br.y; }
  const rx = this.rx, ry = this.ry, w = this.w, inv = this.inv, verts = this.verts, ea = this.ea, eb = this.eb;
  for (const v of verts) {
    const x = rx[v], y = ry[v];
    let m = 1, num = 0, den = DYN.background, sn = 0;
    for (const p of pins) {
      const d = Math.hypot(x - p.x, y - p.y);
      if (p.kind === 'rigid') m *= smooth(p.r + diag, p.r + diag + (p.fall || DYN.rigidFall), d);
      else if (p.kind === 'soft' && d < p.r) {
        const u = 1 - (d / p.r) * (d / p.r), k = u * u;
        num += k * p.w; den += k; if (p.mat === 'silk') sn += k;
      }
    }
    w[v] = m === 0 ? 0 : Math.min(1, Math.max(0, num / den * (1 + DYN.background) + this.delta[v])) * m;
    inv[v] = m === 0 ? 0 : 1;
    this.sf[v] = den > DYN.background ? sn / (den - DYN.background) : 0;
  }
  const deg = new Float64Array(w.length), acc = new Float64Array(w.length);
  for (let e = 0; e < ea.length; e++) { deg[ea[e]]++; deg[eb[e]]++; }
  for (let it = 0; it < DYN.smoothIters; it++) {
    acc.fill(0);
    for (let e = 0; e < ea.length; e++) { acc[ea[e]] += w[eb[e]]; acc[eb[e]] += w[ea[e]]; }
    for (const v of verts) if (inv[v]) w[v] = (w[v] + acc[v]) / (1 + deg[v]);
  }
  for (const v of verts) {
    const sf = this.sf[v], pos = NREC - w[v] * (MATERIALS[0].delay + (MATERIALS[1].delay - MATERIALS[0].delay) * sf) / DT;
    if (pos >= NREC) { this.di[v] = NREC - 1; this.df[v] = 1; }   // 柔软度恰为 0 的非刚性顶点：取记录末端（原写法读到 rec[NREC+1] 越界得 NaN，整格不画）
    else { this.di[v] = Math.floor(pos); this.df[v] = pos - Math.floor(pos); }
    this.bw[v] = br && inv[v] ? (1 - w[v]) * Math.exp(-((rx[v] - br.x) ** 2 + (ry[v] - br.y) ** 2) / (2 * br.r * br.r)) : 0;
    const dcx = rx[v] - hc.x, dcy = ry[v] - hc.y, dsx = rx[v] - hs.x, dsy = ry[v] - hs.y;
    const lc = Math.hypot(dcx, dcy) || 1, ls = Math.hypot(dsx, dsy) || 1;
    const tx = dcx / lc + (dsx / ls - dcx / lc) * sf, ty = dcy / lc + (dsy / ls - dcy / lc) * sf, tl = Math.hypot(tx, ty) || 1;
    this.tx[v] = tx / tl; this.ty[v] = ty / tl; this.hr[v] = Math.max(40, lc + (ls - lc) * sf);
  }
  for (let e = 0; e < ea.length; e++) this.ef[e] = (this.sf[ea[e]] + this.sf[eb[e]]) / 2;   // 边的材质混合（silk 比例）
  const nx1 = this.cols + 1;                                   // 全刚性格（四角都钉死）：渲染时合成一次 clip＋一次 drawImage
  this.rigidCell = new Uint8Array(this.cols * this.rows);
  for (const c of this.cells) { const i = c % this.cols, j = (c - i) / this.cols, v = j * nx1 + i; if (!inv[v] && !inv[v + 1] && !inv[v + nx1] && !inv[v + nx1 + 1]) this.rigidCell[c] = 1; }
  this._esKey = '';
  this.stats.tris = this.cells.length * 2;
};
/* 每边长度上限：按两端材质混合；strain {cloth, silk} 覆盖缺省 .12/.2（只在取值变化时重算） */
Rig.prototype._strain = function (st) {
  const sc = st && st.cloth != null ? st.cloth : MATERIALS[0].strain, ss = st && st.silk != null ? st.silk : MATERIALS[1].strain, key = sc + ',' + ss;
  if (key !== this._esKey) {
    const ef = this.ef, es = this.es;
    for (let e = 0; e < ef.length; e++) es[e] = ef[e] < 0.05 ? sc : sc + (ss - sc) * ef[e];
    this._esKey = key; this._sc = sc;
  }
  return this.es;
};
function samp(r0, r1, i, g, f) {
  const a = r0[i] + (r0[i + 1] - r0[i]) * g, b = r1[i] + (r1[i + 1] - r1[i]) * g;
  return a + (b - a) * f;
}
/* 求 t 时刻每个顶点的局部位置（纯函数：只读 t、script、amp、strain、配置） */
Rig.prototype._solve = function (t, script, amp, strain) {
  const D = this.dyn; D.solve(script, t);
  const ws = windStrength(script.wind, t), fl = DYN.flutter * ws * amp;
  const bt = script.breathe ? (script.breathe.amp == null ? 1 : script.breathe.amp) * Math.sin(2 * Math.PI * t / script.breathe.period) : 0;
  const rx = this.rx, ry = this.ry, qx = this.qx, qy = this.qy, w = this.w, inv = this.inv, sf = this.sf, di = this.di, df = this.df, bw = this.bw;
  const Rc = D.rec[0], Rs = D.rec[1], px = this.px, py = this.py, LIM = DYN.limit * amp;
  for (const v of this.verts) {
    if (!inv[v]) { qx[v] = rx[v]; qy[v] = ry[v]; continue; }
    const wv = w[v], f = sf[v], i = di[v], g = df[v];
    const X = samp(Rc.x, Rs.x, i, g, f), Y = samp(Rc.y, Rs.y, i, g, f), Al = samp(Rc.a, Rs.a, i, g, f);
    const gw = wv * amp * (MATERIALS[0].gain + (MATERIALS[1].gain - MATERIALS[0].gain) * f);
    let ux = gw * (X + Al * (ry[v] - py)), uy = gw * (Y - Al * (rx[v] - px));
    const ph = t * 2.1 - wv * 3.2 + rx[v] * 0.004 + ry[v] * 0.003, k2 = fl * wv * wv;
    ux += k2 * noise1(ph, 7); uy += k2 * 0.7 * noise1(ph * 1.13 + 5.3, 19);
    const tx = this.tx[v], ty = this.ty[v], ul = ux * tx + uy * ty, utx = ux - ul * tx, uty = uy - ul * ty;
    const ra = DYN.radial * ul - (utx * utx + uty * uty) / (2 * this.hr[v]);
    ux = utx + ra * tx; uy = uty + ra * ty;
    const L = LIM * wv, m = Math.hypot(ux, uy);
    if (m > 1e-9 && L > 1e-9) { const k = L * Math.tanh(m / L) / m; ux *= k; uy *= k; }
    if (bw[v]) { const b = bw[v] * bt; ux += b * (rx[v] - this.bx) * 0.005; uy += b * ((ry[v] - this.by) * 0.003 - 0.8); }
    qx[v] = rx[v] + ux; qy[v] = ry[v] + uy;
  }
  const ea = this.ea, eb = this.eb, el = this.el, es = this._strain(strain), ks = this.ks;
  for (const v of this.verts) ks[v] = 1;
  for (let e = 0; e < ea.length; e++) {
    const a = ea[e], b = eb[e], s = Math.abs(Math.hypot(qx[b] - qx[a], qy[b] - qy[a]) / el[e] - 1);
    if (s > 1.25 * es[e]) { const k = 1.25 * es[e] / s; if (k < ks[a]) ks[a] = k; if (k < ks[b]) ks[b] = k; }
  }
  for (let it = 0; it < DYN.limitSpread; it++) {
    for (let e = 0; e < ea.length; e++) {
      const a = ea[e], b = eb[e], m = (ks[a] + ks[b]) / 2;
      if (m < ks[a]) ks[a] = m; else if (m < ks[b]) ks[b] = m;
    }
  }
  for (const v of this.verts) if (ks[v] < 1) { qx[v] = rx[v] + (qx[v] - rx[v]) * ks[v]; qy[v] = ry[v] + (qy[v] - ry[v]) * ks[v]; }
  const cx = this.cx, cy = this.cy, cn = this.cn;
  for (let it = 0; it < DYN.iters; it++) {
    cx.fill(0); cy.fill(0); cn.fill(0);
    let any = false;
    for (let e = 0; e < ea.length; e++) {
      const a = ea[e], b = eb[e];
      const dx = qx[b] - qx[a], dy = qy[b] - qy[a], len = Math.hypot(dx, dy), L0 = el[e], S = es[e];
      const tgt = len > L0 * (1 + S) ? L0 * (1 + S) : len < L0 * (1 - S) ? L0 * (1 - S) : len;
      if (tgt === len || len < 1e-9) continue;
      any = true;
      const k = (len - tgt) / (len * (inv[a] + inv[b] || 1));
      cx[a] += dx * k * inv[a]; cy[a] += dy * k * inv[a]; cn[a]++;
      cx[b] -= dx * k * inv[b]; cy[b] -= dy * k * inv[b]; cn[b]++;
    }
    if (!any) break;
    for (const v of this.verts) if (cn[v] && inv[v]) { const m = DYN.relax / cn[v]; qx[v] += cx[v] * m; qy[v] += cy[v] * m; }
  }
  let ms = 0, mc = 0, over = 0;
  for (let e = 0; e < ea.length; e++) {
    const s = Math.abs(Math.hypot(qx[eb[e]] - qx[ea[e]], qy[eb[e]] - qy[ea[e]]) / el[e] - 1);
    if (s > ms) ms = s;
    if (this.ef[e] < 0.05 && s > mc) mc = s;
    if (s > es[e] + 0.005) over++;
  }
  this.stats.maxStrain = ms; this.stats.maxStrainCloth = mc; this.stats.overStrain = over / ea.length;
};
/* 贴图（与 lab 版逐行相同）：外扩 0.75px 多边形 clip + 仿射 drawImage，destination-out + lighter 「替换」合成；同行仿射一致的格子合并 */
const FIT = 0.08, EXPAND = 0.75;
/* 所有 rig 共用一张离屏层（一次按足量分配、只增不减），每次只清、只读需要的那一块 */
let shared = null;
function sharedLayer(bw, bh) {
  if (!shared || shared.c.width < bw || shared.c.height < bh) {
    const w = Math.max(bw, 1400, shared ? shared.c.width : 0), h = Math.max(bh, 1800, shared ? shared.c.height : 0);   // 一次给足：中途换新画布会让首次合成差 1 级（结果随历史变）
    shared = makeCanvas(w, h);
    shared.x.drawImage(shared.c, 0, 0, 1, 1);                 // 新画布先被画一次（首画与后画差 1 级）
  }
  return shared;
}
/* 贴图直接画在「设备像素」里：Md = 局部 → 设备 的总变换（含主体变换、镜头、DPR）。图层与目标画布像素一一对应，最后 1:1 拷回，
   只经一次重采样（旧版先贴到局部坐标图层、再整体变换一次，柔软区被采样两次，锐度约损 5%）。全刚性格合成一个 clip、一次 drawImage。 */
/* 纹理逐级减半（m 级 = 1/2^m）：显示缩小 ≥2 倍时从对应级取样，免得画布源大幅缩小再旋转时结果随历史差 1 级；级画布按实例常驻 */
Rig.prototype._texLv = function (m) {
  const L = this._lv || (this._lv = [this.tex]);
  for (let i = L.length; i <= m; i++) {
    const p = L[i - 1], c = makeCanvas(Math.max(1, Math.round(p.width / 2)), Math.max(1, Math.round(p.height / 2))).c, x = c.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'low'; x.drawImage(p, 0, 0, p.width, p.height, 0, 0, c.width, c.height);
    L.push(settleC(c));
  }
  return L[m];
};
const SETX = makeCanvas(2, 2).x;
function settleC(c) { SETX.drawImage(c, 0, 0, 2, 2); return c; }   // 新画布先被画一次（首画与后画差 1 级）
function lvOf(Md) { return Math.max(0, Math.min(4, Math.floor(Math.log2(1 / Math.max(1e-3, Math.hypot(Md.a, Md.b)))))); }
Rig.prototype._render = function (Md, cvw, cvh) {
  const qx = this.qx, qy = this.qy, rx = this.rx, ry = this.ry, cols = this.cols, cells = this.cells, inv = this.inv, nx = cols + 1, cw = this.cw, ch = this.ch, W = this.W, H = this.H;
  const lv = lvOf(Md), tex = this._texLv(lv), tk = tex.width / W, tkh = tex.height / H;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const v of this.verts) {
    const X = Md.a * qx[v] + Md.c * qy[v] + Md.e, Y = Md.b * qx[v] + Md.d * qy[v] + Md.f;
    if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y;
  }
  const bx = Math.max(0, Math.floor(x0) - 3), by = Math.max(0, Math.floor(y0) - 3), bx1 = Math.min(cvw, Math.ceil(x1) + 3), by1 = Math.min(cvh, Math.ceil(y1) + 3);
  const bw = bx1 - bx, bh = by1 - by;
  this._box = [bx, by, bw, bh];
  if (bw <= 0 || bh <= 0) return false;
  const SL = sharedLayer(Math.max(bw, cvw), Math.max(bh, cvh)), Lx = SL.x;
  this.layer = SL.c;
  const T = new DOMMatrix().translateSelf(-bx, -by).multiplySelf(Md), sc = Math.hypot(Md.a, Md.b) || 1, EXL = EXPAND / sc;   // 外扩按设备像素算
  const PX = this._px || (this._px = new Float64Array(2 * nx + 2)), PY = this._py || (this._py = new Float64Array(2 * nx + 2));
  let draws = 0, rigidErr = 0, n = 0;
  const put = (u) => { PX[n] = qx[u]; PY[n] = qy[u]; n++; };
  const outline = () => {
    let area = 0;
    for (let i = 0, j = n - 1; i < n; j = i++) area += PX[j] * PY[i] - PX[i] * PY[j];
    const sg = area > 0 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const h = (i + n - 1) % n, k = (i + 1) % n;
      let ax = PX[i] - PX[h], ay = PY[i] - PY[h], bx2 = PX[k] - PX[i], by2 = PY[k] - PY[i];
      const la = Math.hypot(ax, ay) || 1, lb = Math.hypot(bx2, by2) || 1;
      ax /= la; ay /= la; bx2 /= lb; by2 /= lb;
      const n1x = ay * sg, n1y = -ax * sg, n2x = by2 * sg, n2y = -bx2 * sg;
      let mx = n1x + n2x, my = n1y + n2y;
      const ml = Math.hypot(mx, my);
      if (ml < 1e-6) { mx = n1x; my = n1y; } else { mx /= ml; my /= ml; }
      const k2 = EXL / Math.max(0.35, mx * n1x + my * n1y);
      if (i === 0) Lx.moveTo(PX[i] + mx * k2 + 1 / 64 / sc, PY[i] + my * k2 + 1 / 64 / sc); else Lx.lineTo(PX[i] + mx * k2, PY[i] + my * k2);
    }
    Lx.closePath();
  };
  const blitClip = (a, b, c, d, e, f, sx0, sy0, sx1, sy1) => {   // 当前路径已建好：clip → 擦 → 按仿射加贴纹理子矩形
    Lx.clip();
    Lx.globalCompositeOperation = 'destination-out';
    Lx.setTransform(1, 0, 0, 1, 0, 0); Lx.fillRect(0, 0, bw, bh);
    Lx.globalCompositeOperation = 'lighter';
    Lx.setTransform(T.multiply(new DOMMatrix([a, b, c, d, e, f])));
    const sx = Math.max(0, Math.floor(sx0) - 2), sy = Math.max(0, Math.floor(sy0) - 2);
    const sw = Math.min(W, Math.ceil(sx1) + 2) - sx, sh = Math.min(H, Math.ceil(sy1) + 2) - sy;
    if (sw > 0 && sh > 0) Lx.drawImage(tex, sx * tk, sy * tkh, sw * tk, sh * tkh, sx, sy, sw, sh);
    draws++;
  };
  const blit = (a, b, c, d, e, f, sx0, sy0, sx1, sy1) => {
    Lx.save(); Lx.setTransform(T); Lx.beginPath(); outline(); blitClip(a, b, c, d, e, f, sx0, sy0, sx1, sy1); Lx.restore();
  };
  Lx.setTransform(1, 0, 0, 1, 0, 0);
  Lx.globalCompositeOperation = 'source-over';
  Lx.clearRect(0, 0, bw, bh);
  Lx.imageSmoothingEnabled = true; Lx.imageSmoothingQuality = 'low';
  const RC = this.rigidCell;
  let any = false, rx0 = 1e9, ry0 = 1e9, rx1 = -1e9, ry1 = -1e9;
  Lx.save(); Lx.setTransform(T); Lx.beginPath();
  for (const c of cells) if (RC[c]) {                          // 全刚性格：一个合并路径（每格外扩），一次 clip＋一次 drawImage（恒等仿射）
    const i0 = c % cols, j = (c - i0) / cols, v = j * nx + i0;
    n = 0; put(v); put(v + 1); put(v + nx + 1); put(v + nx); outline();
    any = true; if (rx[v] < rx0) rx0 = rx[v]; if (ry[v] < ry0) ry0 = ry[v]; if (rx[v] + cw > rx1) rx1 = rx[v] + cw; if (ry[v] + ch > ry1) ry1 = ry[v] + ch;
  }
  if (any) blitClip(1, 0, 0, 1, 0, 0, rx0, ry0, rx1, ry1);
  Lx.restore();
  for (let k = 0; k < cells.length;) {
    const c = cells[k], i0 = c % cols, j = (c - i0) / cols, v = j * nx + i0, X0 = rx[v], Y0 = ry[v];
    if (RC[c]) { k++; continue; }
    const v10 = v + 1, v01 = v + nx, v11 = v + nx + 1;
    const a = (qx[v10] - qx[v]) / cw, b = (qy[v10] - qy[v]) / cw, cc = (qx[v01] - qx[v]) / ch, d = (qy[v01] - qy[v]) / ch;
    const e = qx[v] - a * X0 - cc * Y0, f = qy[v] - b * X0 - d * Y0;
    const err = (u) => Math.max(Math.abs(a * rx[u] + cc * ry[u] + e - qx[u]), Math.abs(b * rx[u] + d * ry[u] + f - qy[u]));
    k++;
    if (err(v11) >= FIT) {
      const c1 = (qx[v11] - qx[v10]) / ch, d1 = (qy[v11] - qy[v10]) / ch;
      n = 0; put(v); put(v10); put(v11);
      blit(a, b, c1, d1, qx[v] - a * X0 - c1 * Y0, qy[v] - b * X0 - d1 * Y0, X0, Y0, X0 + cw, Y0 + ch);
      const a2 = (qx[v11] - qx[v01]) / cw, b2 = (qy[v11] - qy[v01]) / cw;
      n = 0; put(v); put(v11); put(v01);
      blit(a2, b2, cc, d, qx[v] - a2 * X0 - cc * Y0, qy[v] - b2 * X0 - d * Y0, X0, Y0, X0 + cw, Y0 + ch);
      continue;
    }
    let i1 = i0 + 1;
    while (k < cells.length && i1 < cols && cells[k] === j * cols + i1 && !RC[cells[k]] && err(v + (i1 - i0) + 1) < FIT && err(v + nx + (i1 - i0) + 1) < FIT) { i1++; k++; }
    n = 0;
    for (let u = v; u <= v + (i1 - i0); u++) { if (!inv[u]) rigidErr = Math.max(rigidErr, err(u)); put(u); }
    for (let u = v + nx + (i1 - i0); u >= v + nx; u--) { if (!inv[u]) rigidErr = Math.max(rigidErr, err(u)); put(u); }
    blit(a, b, cc, d, e, f, X0, Y0, i1 * cw, Y0 + ch);
  }
  this.stats.draws = draws; this.stats.rigidErr = rigidErr;
  return true;
};
/* 运动脚本规范化：root 关键帧的 dx/dy（相对 pivot 原位，底图像素）换成绝对底图坐标；缺 root 时原位不动。按脚本对象缓存 */
Rig.prototype.norm = function (script) {
  script = script || {};
  let s = this._norm.get(script);
  if (s) return s;
  const X = this.px + this.ox, Y = this.py + this.oy;
  const keys = (script.root && script.root.length ? script.root : [{ t: 0 }]).map((k) => ({
    t: k.t || 0, x: k.x != null ? k.x : X + (k.dx || 0), y: k.y != null ? k.y : Y + (k.dy || 0), rot: k.rot || 0, s: k.s || 1, ease: k.ease
  }));
  s = { root: keys, wind: script.wind, impulse: script.impulse, breathe: script.breathe };
  this._norm.set(script, s);
  return s;
};
/* 画：叠在 ctx 当前变换（底图像素坐标系）之上；o.amp 幅度倍率、o.strain {cloth,silk}（缺省取配置里的 amp/strain） */
Rig.prototype.draw = function (ctx, t, script, o) {
  o = o || {};
  const s = this.norm(script), amp = o.amp != null ? o.amp : this.amp, st = o.strain || this.strain;
  if (this.mode === 'sway') {                                  // 整体刚性＋轻摆：绕支点的小角度，来自风、冲击与呼吸（纯 t 函数）
    let ang = .012 * windStrength(s.wind, t) * Math.sin(t * 1.15 + 1.3) * amp;
    (s.impulse || []).forEach((im) => { const d = t - im.t; if (d > 0) ang += -.03 * (im.amp == null ? 1 : im.amp) * (im.x || 0) * amp * Math.exp(-3 * d) * Math.sin(7 * d); });
    const br = s.breathe ? .004 * (s.breathe.amp == null ? 1 : s.breathe.amp) * Math.sin(2 * Math.PI * t / s.breathe.period) : 0;
    const m = rootMatrix(rootAt(s.root, t, this._r), this.px, this.py);
    const Md = ctx.getTransform().multiply(new DOMMatrix(m)).translate(this.px, this.py).rotate(ang * 57.29578).scale(1, 1 + br).translate(-this.px, -this.py);
    this._m = Md;
    const tx = this._texLv(lvOf(Md));
    ctx.save(); ctx.setTransform(Md); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'low'; ctx.drawImage(tx, 0, 0, tx.width, tx.height, 0, 0, this.W, this.H); ctx.restore();
    this.stats.draws = 1;
    return;
  }
  this._solve(t, s, amp, st);
  const m = rootMatrix(rootAt(s.root, t, this._r), this.px, this.py), Md = ctx.getTransform().multiply(new DOMMatrix(m));
  this._m = Md;                                                // 调试：局部 → 设备像素
  if (!this._render(Md, ctx.canvas.width, ctx.canvas.height)) return;
  const B = this._box;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(this.layer, 0, 0, B[2], B[3], B[0], B[1], B[2], B[3]);   // 1:1 拷回，不再重采样
  ctx.restore();
};
Rig.prototype.drawRigid = function (ctx, t, script) {
  const s = this.norm(script), m = rootMatrix(rootAt(s.root, t, {}), this.px, this.py);
  ctx.save(); ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]); ctx.imageSmoothingEnabled = true; ctx.drawImage(this.tex, 0, 0); ctx.restore();
};
/* 本帧主体变换下，底图坐标点 (x,y) 落在哪（同一变换系）：给剑光、题注等跟随人物用 */
Rig.prototype.follow = function (t, script, x, y) {
  const s = this.norm(script), m = rootMatrix(rootAt(s.root, t, {}), this.px, this.py), lx = x - this.ox, ly = y - this.oy;
  return [m[0] * lx + m[2] * ly + m[4], m[1] * lx + m[3] * ly + m[5]];
};

/* ---------- 调试与编辑（只在 ?rig= 面板里用） ---------- */
Rig.prototype.toLocal = function (X, Y) {                // 设备像素（最近一次 draw 的画布）→ 裁切局部坐标
  const p = this._m.inverse().transformPoint(new DOMPoint(X, Y));
  return [p.x, p.y];
};
Rig.prototype.pinAt = function (lx, ly, rad) {           // rad：局部像素
  let best = null, bd = rad;
  for (const p of this.pins) { const d = Math.hypot(p.x - lx, p.y - ly); if (d < bd) { bd = d; best = p; } }
  return best;
};
Rig.prototype.movePin = function (id, lx, ly) {
  const p = this.pins.find((q) => q.id === id);
  p.x = Math.round(lx * 10) / 10; p.y = Math.round(ly * 10) / 10;
  this.refresh();
};
Rig.prototype.paint = function (lx, ly, rad, amount) {
  for (const v of this.verts) {
    const d = Math.hypot(this.rx[v] - lx, this.ry[v] - ly);
    if (d >= rad) continue;
    const nv = this.delta[v] + amount * (1 - smooth(0, rad, d));
    this.delta[v] = Math.round(Math.max(-1, Math.min(1, nv)) * 1000) / 1000;
  }
  this.refresh();
};
Rig.prototype.exportRig = function () {                  // 锚点写回底图坐标；可直接作 I.rig.define 的配置
  return { version: 2, crop: this.crop, grid: { cols: this.cols, rows: this.rows }, amp: this.amp, strain: this.strain || undefined,
    pins: this.pins.map((p) => { const q = JSON.parse(JSON.stringify(p)); q.x = Math.round((q.x + this.ox) * 10) / 10; q.y = Math.round((q.y + this.oy) * 10) / 10; return q; }),
    weights: Array.from(this.delta) };
};
Rig.prototype.debugDraw = function (ctx, o) {            // ctx 变换须与最近一次 draw 时相同
  o = o || {};
  const m = rootMatrix(this._r, this.px, this.py), sc = this._r.s * Math.hypot(ctx.getTransform().a, ctx.getTransform().b), qx = this.qx, qy = this.qy, w = this.w, cols = this.cols, nx = cols + 1;
  ctx.save();
  ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
  if (o.heat) {
    const buckets = Array.from({ length: 11 }, () => []);
    const push = (a, b, c) => buckets[Math.round((w[a] + w[b] + w[c]) / 3 * 10)].push(a, b, c);
    for (const c of this.cells) { const i = c % cols, j = (c - i) / cols, v = j * nx + i; push(v, v + 1, v + nx + 1); push(v, v + nx + 1, v + nx); }
    buckets.forEach((tris, k) => {
      if (!tris.length) return;
      ctx.fillStyle = 'hsla(' + (220 - 220 * k / 10) + ',85%,50%,' + (k ? 0.42 : 0.18) + ')';
      ctx.beginPath();
      for (let n = 0; n < tris.length; n += 3) { ctx.moveTo(qx[tris[n]], qy[tris[n]]); ctx.lineTo(qx[tris[n + 1]], qy[tris[n + 1]]); ctx.lineTo(qx[tris[n + 2]], qy[tris[n + 2]]); ctx.closePath(); }
      ctx.fill();
    });
  }
  if (o.wire) {
    ctx.beginPath();
    for (let e = 0; e < this.ea.length; e++) {
      const a = this.ea[e], b = this.eb[e];
      if (b === a + nx + 1 || b === a + 1 || b === a + nx) { ctx.moveTo(qx[a], qy[a]); ctx.lineTo(qx[b], qy[b]); }
    }
    ctx.strokeStyle = 'rgba(20,60,160,.55)'; ctx.lineWidth = 0.8 / sc; ctx.stroke();
  }
  ctx.font = (12 / sc) + 'px Menlo, monospace';
  for (const p of this.pins) {
    const sel = o.selected === p.id, col = p.kind === 'rigid' ? '#c0392b' : p.kind === 'soft' ? (p.mat === 'silk' ? '#1f5f9a' : '#1f7a4d') : '#7a4fb0';
    if (p.r) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.setLineDash([6 / sc, 4 / sc]); ctx.strokeStyle = col; ctx.lineWidth = 1.2 / sc; ctx.stroke(); ctx.setLineDash([]); }
    ctx.beginPath(); ctx.arc(p.x, p.y, (sel ? 8 : 6) / sc, 0, Math.PI * 2);
    ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = sel ? '#ffd76a' : '#fff'; ctx.lineWidth = 2 / sc; ctx.stroke();
    ctx.fillStyle = '#111'; ctx.fillText(p.id + (p.kind === 'soft' ? ' ' + p.w : ''), p.x + 9 / sc, p.y - 6 / sc);
  }
  if (o.brush) { ctx.beginPath(); ctx.arc(o.brush.x, o.brush.y, o.brush.r, 0, Math.PI * 2); ctx.strokeStyle = o.brush.sub ? '#2a6fd6' : '#d6532a'; ctx.lineWidth = 1.5 / sc; ctx.stroke(); }
  ctx.restore();
};

CINE.InkRig = { create: (image, opts) => new Rig(image, opts), EASE, MATERIALS, DYN, autoPins,
  rootAt: (script, t) => rootAt(script.root, t, {}) };

/* ================= 引擎接口：I.rig（= env.rig） =================
   I.rig.define(id, cfg)：登记一套配置（可写在幕文件里，cfg 即调试面板导出的 JSON，另加 plate: 底图 id，缺省 = id）。
   I.rig(c, id, t, o)：按底图摆放画出变形立绘，返回 rig（缺图返回 null，静默）。id 未登记但同名底图存在时用自动锚点。
     o: script {root:[{t, dx,dy 相对原位（底图像素）| x,y 绝对, rot, s, ease}], wind{dirDeg,base,gust[]}, impulse[{t,x,y,amp}], breathe{period,amp}}
        （script 对象请复用同一个常量：规范化结果按对象缓存）
        amp 幅度倍率（缺省 1；扑护、反带等重点镜 2–3）| strain {cloth, silk} 边长约束上限（缺省 .12/.2；放大时可放宽到 .2/.35）
        摆放同 I.plate 的 layer 分支：cam {x,y,zoom}、s、dx、dy（逻辑 px）、flip 'h'；alpha；raw true 时不摆放、直接用 c 当前变换（单位 = 底图像素）
   I.rig.get(id) 取实例（调试/跟随用）；I.rig.follow(id, t, o, x, y) 底图坐标点在本帧落在屏幕哪（跟随发带梢、剑符等）。
   实例按 LRU 保留 32 个（重建是纯函数，画面不变）；纹理按 alpha 外接框裁切，变形图层所有实例共用一张。 */
const defs = {}, inst = new Map(), RIG_MAX = 32;
function plateOf(id) { return (defs[id] && defs[id].plate) || id; }
function rigGet(id, lod, ov) {
  lod = lod || 1;
  const ovk = ov && (ov.anchors || ov.rigid || ov.mode) ? '#' + JSON.stringify([ov.anchors || 0, ov.rigid || 0, ov.mode || 0]) : '';
  const key = (lod > 1 ? id + '@' + lod : id) + ovk;
  let r = inst.get(key);
  if (r) { inst.delete(key); inst.set(key, r); return r; }
  const im = I.plateImg && I.plateImg(plateOf(id));
  if (!im) return null;
  let cfg = defs[id] || {};
  if (ovk) cfg = Object.assign({}, cfg, ov.anchors ? { pins: ov.anchors, weights: null } : {}, ov.rigid ? { rigid: ov.rigid } : {}, ov.mode ? { mode: ov.mode } : {});
  if (lod > 1) {                                             // 远景粗网格：格子放大 lod 倍；笔刷权重按细网格存的，粗网格只用锚点
    const base = rigGet(id, 1, ov);
    if (!base) return null;
    cfg = Object.assign({}, cfg, { grid: { cols: Math.max(4, Math.round(base.cols / lod)), rows: Math.max(4, Math.round(base.rows / lod)) }, crop: base.crop, weights: null });
  }
  try { r = new Rig(im, cfg); }
  catch (e) { CINE.errors.push('rig ' + id + ': ' + e.message); return null; }
  r.id = id; r.plate = plateOf(id); r.lod = lod;
  inst.set(key, r);
  while (inst.size > RIG_MAX) inst.delete(inst.keys().next().value);
  return r;
}
/* 把 c 变换到底图像素坐标（与 I.plate 的 layer 分支同一映射；s=1、dx=dy=0 时与普通 I.plate 同位） */
function plateSpace(c, id, o) {
  const im = I.plateImg(id);
  if (!im) return false;
  const W = CINE.W, H = CINE.H, iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
  let cw = iw, ch = ih;
  if (iw / ih > W / H) cw = ih * W / H; else ch = iw * H / W;
  const s = o.s == null ? 1 : o.s, rw = W * s, rh = H * s, rx = (W - rw) / 2 + (o.dx || 0), ry = (H - rh) / 2 + (o.dy || 0);
  I.screen(c);
  if (o.flip === 'h') { c.translate(W, 0); c.scale(-1, 1); }
  I.cam(c, I.plateView(o.cam));
  c.translate(rx, ry); c.scale(rw / cw, rh / ch); c.translate(-(iw - cw) / 2, -(ih - ch) / 2);
  return true;
}
I.plateSpace = plateSpace;
I.rig = function (c, id, t, o) {
  o = o || {};
  const ov = o.anchors || o.rigid || o.mode ? { anchors: o.anchors, rigid: o.rigid, mode: o.mode } : null;
  let r = rigGet(id, 1, ov);
  if (!r) return null;
  c.save();
  if (o.alpha != null) c.globalAlpha *= U.clamp(o.alpha, 0, 1);
  if (c.globalAlpha > .003 && (o.raw || plateSpace(c, r.plate, o))) {
    let lod = o.lod != null ? o.lod : (defs[id] && defs[id].lod === false ? 1 : 0);
    if (!lod) {                                              // 按屏上显示高度（设备像素）自动降档：≥560 细网格，280–560 两倍格，<280 四倍格
      const M = c.getTransform(), sr = rootAt(r.norm(o.script).root, t, {}).s, hgt = r.crop.h * Math.hypot(M.c, M.d) * sr;
      lod = hgt >= 560 ? 1 : hgt >= 280 ? 2 : 4;
    }
    if (lod > 1 && r.mode !== 'sway') r = rigGet(id, lod, ov) || r;
    r.draw(c, t, o.script, o);
  }
  c.restore();
  return r;
};
I.rig.define = function (id, cfg) { defs[id] = cfg || {}; for (const k of Array.from(inst.keys())) if (k === id || k.indexOf(id + '@') === 0 || k.indexOf(id + '#') === 0) inst.delete(k); };
I.rig.defs = defs;
I.rig.get = rigGet;
I.rig.follow = function (id, t, o, x, y) {
  o = o || {};
  const r = rigGet(id);
  if (!r) return [x, y];
  const W = CINE.W, H = CINE.H, im = I.plateImg(r.plate), iw = im.naturalWidth, ih = im.naturalHeight;
  let cw = iw, ch = ih;
  if (iw / ih > W / H) cw = ih * W / H; else ch = iw * H / W;
  const p = r.follow(t, o.script, x, y), s = o.s == null ? 1 : o.s, v = I.plateView(o.cam);
  let X = (W - W * s) / 2 + (o.dx || 0) + (p[0] - (iw - cw) / 2) * W * s / cw, Y = (H - H * s) / 2 + (o.dy || 0) + (p[1] - (ih - ch) / 2) * H * s / ch;
  X = W / 2 + (X - v.x) * v.z; Y = H / 2 + (Y - v.y) * v.z;
  return [o.flip === 'h' ? W - X : X, Y];
};

/* ================= 关键帧序列播放器 I.kfseq（BRIEF §5.8 「因 → 接触 → 果」） =================
   同机位多张 kf 透明层按时间切换：keys = [{t 幕内秒, id 底图 id, at {dx,dy 底图像素, rot, s} 本帧落位, contact 接触帧, hit {x,y,amp} 冲击, rig}]（按 t 升序）。
   · 落位在相邻关键帧之间按 o.ease（缺省 'inOutSine'）插值：节点之间是位移插值，不是静帧；
   · 换帧只在下一帧 t 之前 xf 秒内交叉（o.xf 缺省 .1，上限 .12，避免双影）；进出 contact 帧一律硬切（接触帧不溶接）；
   · rig: true（用该帧同名配置/自动锚点）| 'rigId' | {id, amp, strain, mode, anchors, rigid}：叠次级运动（mode/anchors/rigid 原样透传给 I.rig；o.mode 为全序列缺省形态）。全序列共用一个运动脚本（root 来自 at，impulse 来自 hit，
     o.wind / o.breathe 透传），所以换帧前后衣摆的摆动是连续的；o.amp / o.strain 为缺省倍率。
   · o: cam s dx dy flip（同 I.plate layer 分支）, alpha, pivot [x,y] 无 rig 时旋转缩放的支点（缺省图底边中点）。
   返回当前关键帧序号。纯 t 的函数。 */
const kfCache = new WeakMap();
function kfScript(keys, o) {
  let s = kfCache.get(keys);
  if (s) return s;
  const root = keys.map((k) => { const a = k.at || {}; return { t: k.t, dx: a.dx || 0, dy: a.dy || 0, rot: a.rot || 0, s: a.s || 1, ease: k.ease || o.ease || 'inOutSine' }; });
  const imp = [];
  keys.forEach((k) => { if (k.hit) imp.push({ t: k.t, x: k.hit.x || 0, y: k.hit.y || 0, amp: k.hit.amp == null ? 1 : k.hit.amp }); });
  s = { root, impulse: imp, wind: o.wind, breathe: o.breathe, rel: root.map((k) => ({ t: k.t, x: k.dx, y: k.dy, rot: k.rot, s: k.s, ease: k.ease })) };
  kfCache.set(keys, s);
  return s;
}
I.kfseq = function (c, t, keys, o) {
  o = o || {};
  const n = keys.length;
  if (!n) return -1;
  let i = 0;
  while (i + 1 < n && t >= keys[i + 1].t) i++;
  const sc = kfScript(keys, o), xf = Math.min(.12, o.xf == null ? .1 : o.xf), nx = keys[i + 1];
  let k = 0;
  if (nx && !nx.contact && !keys[i].contact && xf > 0 && t > nx.t - xf) k = U.clamp((t - (nx.t - xf)) / xf, 0, 1);
  const A = o.alpha == null ? 1 : o.alpha;
  const one = (key, a) => {
    if (a <= .003) return;
    if (key.rig) {
      const rid = typeof key.rig === 'string' ? key.rig : key.rig.id || key.id, ro = typeof key.rig === 'object' ? key.rig : {};
      if (I.rig(c, rid, t, { script: sc, amp: ro.amp != null ? ro.amp : o.amp, strain: ro.strain || o.strain, cam: o.cam, s: o.s, dx: o.dx, dy: o.dy, flip: o.flip, alpha: a,
        mode: ro.mode || o.mode, anchors: ro.anchors, rigid: ro.rigid })) return;   // 形态覆盖透传（10-14）：key.rig {mode, anchors, rigid}；o.mode 作全序列缺省
    }
    const im = I.plateImg(key.id);
    if (!im) return;
    c.save();
    if (plateSpace(c, key.id, o)) {
      const r = rootAt(sc.rel, t, {}), pv = o.pivot || [im.naturalWidth / 2, im.naturalHeight];
      c.globalAlpha *= a;
      c.translate(pv[0] + r.x, pv[1] + r.y); c.rotate(r.rot); c.scale(r.s, r.s); c.translate(-pv[0], -pv[1]);
      I.drawImg(c, key.id, 0, 0, im.naturalWidth, im.naturalHeight, 0, 0, im.naturalWidth, im.naturalHeight);   // 逐级 LOD 取样（确定性）
    }
    c.restore();
  };
  one(keys[i], A * (k > 0 ? Math.min(1, 2 * (1 - k)) : 1));
  if (k > 0) one(nx, A * Math.min(1, 2 * k));
  return i;
};

/* ================= 调试面板：index.html?rig=ID（engine boot 调 CINE.rigDebug） =================
   左：1920×1080 画布（宣纸底，立绘按底图原位画，演示脚本循环 10 秒）；右：控制。拖圆点移锚点，在人物上拖涂柔软度（Shift 减），[ ] 调笔刷，空格播放/暂停。
   导出：下载 rig-<ID>.json 并填进文本框（内容可直接作 I.rig.define(ID, …) 的配置）；导入：读文本框。复位 = 自动锚点。 */
const DEMO = {
  root: [{ t: 0 }, { t: 2 }, { t: 2.6, dx: 150, dy: -20, rot: -0.06, ease: 'outBack' }, { t: 5, dx: 170, ease: 'inOutSine' }, { t: 8.5, dx: 0, ease: 'inOutSine' }],
  wind: { dirDeg: 200, base: 0.35, gust: [{ t: 6, dur: 1.5, amp: 1 }] }, impulse: [{ t: 3.2, x: -1, y: -0.3, amp: 1 }], breathe: { period: 4.2, amp: 1 }
};
CINE.rigDebug = function (id) {
  const $ = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d.firstElementChild; };
  const box = $('<div style="position:fixed;inset:0;background:#171512;color:#e8e0cf;font:13px/1.45 -apple-system,\'PingFang SC\',sans-serif;z-index:50;display:flex"></div>');
  const left = $('<div style="flex:1;display:flex;align-items:center;justify-content:center;min-width:0"></div>');
  const cv = document.createElement('canvas'); cv.width = 1920; cv.height = 1080;
  cv.style.cssText = 'max-width:100%;max-height:100%;background:#efe7d5;touch-action:none';
  left.appendChild(cv);
  const P = $('<div style="width:330px;padding:10px 12px;background:#24211c;overflow:auto;border-left:1px solid #000"></div>');
  P.innerHTML = '<h3 style="margin:0 0 6px;color:#c8a560;font-size:14px">立绘调试 · ' + id + '</h3>' +
    '<div id="rgInfo" style="color:#bfb49d;margin-bottom:6px"></div>' +
    '<div><button id="rgPlay">❚❚</button> <input id="rgT" type="range" min="0" max="10" step="0.01" style="width:200px"> <span id="rgTv"></span></div>' +
    '<div>幅度 amp <input id="rgAmp" type="range" min="0" max="3" step="0.05" value="1"> <span id="rgAmpV"></span></div>' +
    '<div>袍边长上限 <input id="rgSc" type="range" min="0.05" max="0.4" step="0.01" value="0.12"> <span id="rgScV"></span></div>' +
    '<div>发带边长上限 <input id="rgSs" type="range" min="0.05" max="0.5" step="0.01" value="0.2"> <span id="rgSsV"></span></div>' +
    '<div><label><input id="rgHeat" type="checkbox" checked>柔软度热力</label> <label><input id="rgWire" type="checkbox">线框</label> <label><input id="rgGhost" type="checkbox">原图对照</label></div>' +
    '<div>笔刷半径 <input id="rgBr" type="range" min="10" max="160" value="40"> 力度 <input id="rgBk" type="range" min="1" max="30" value="8" style="width:70px"></div>' +
    '<div id="rgPin" style="font-family:Menlo,monospace;color:#e8d9a8;min-height:1.5em;margin:4px 0"></div>' +
    '<div id="rgPinEd" style="display:none">r <input id="rgPr" type="number" style="width:60px"> w <input id="rgPw" type="number" step="0.05" style="width:60px"> mat <select id="rgPm"><option>cloth</option><option>silk</option></select></div>' +
    '<div style="margin:6px 0"><button id="rgExp">导出 JSON</button> <button id="rgImp">导入</button> <button id="rgReset">复位（自动锚点）</button></div>' +
    '<textarea id="rgText" spellcheck="false" style="width:100%;height:150px;background:#15130f;color:#d9cfb9;border:1px solid #5a5244;font:11px Menlo,monospace"></textarea>' +
    '<p style="color:#8a8070">拖圆点＝移锚点；在人物上拖＝涂柔软度（Shift 减）；[ ] 笔刷；空格 播放。导出内容即 <code>CINE.ink.rig.define(\'' + id + '\', …)</code> 的配置（锚点为底图坐标）。</p>';
  box.appendChild(left); box.appendChild(P); document.body.appendChild(box);
  const q = (s) => P.querySelector('#' + s), ctx = cv.getContext('2d');
  CINE.px = 1;                                            // 本面板独占：画布 1920×1080
  let t = 0, playing = true, last = 0, drag = null, brush = null, sel = null;
  const perf = [];
  const base = Object.assign({ plate: plateOf(id) }, defs[id] || {});
  const rig = () => rigGet(id);
  if (!I.plateImg(plateOf(id))) { q('rgInfo').textContent = '找不到底图 ' + plateOf(id) + '（plates.js 里没有这张图）'; return; }
  function opts() { return { lod: 1, script: DEMO, amp: +q('rgAmp').value, strain: { cloth: +q('rgSc').value, silk: +q('rgSs').value } }; }
  function frame() {
    const r = rig(), o = opts();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#efe7d5'; ctx.fillRect(0, 0, 1920, 1080);
    if (q('rgGhost').checked) { ctx.save(); plateSpace(ctx, r.plate, {}); ctx.globalAlpha = .25; r.drawRigid(ctx, t, DEMO); ctx.restore(); }
    const t0 = performance.now();
    I.rig(ctx, id, t, o);
    perf.push(performance.now() - t0); if (perf.length > 60) perf.shift();
    ctx.save(); plateSpace(ctx, r.plate, {});
    r.debugDraw(ctx, { heat: q('rgHeat').checked, wire: q('rgWire').checked, selected: sel && sel.id, brush: drag ? null : brush });
    ctx.restore();
    const S = r.stats, avg = perf.reduce((a, b) => a + b, 0) / perf.length;
    q('rgInfo').textContent = '底图 ' + r.plate + ' · 裁切 ' + r.crop.w + '×' + r.crop.h + ' · 网格 ' + r.cols + '×' + r.rows + ' · 三角 ' + S.tris + '（drawImage ' + S.draws + '）· draw ' + avg.toFixed(1) + 'ms · 边长形变 袍 ' + (S.maxStrainCloth * 100).toFixed(1) + '% 全 ' + (S.maxStrain * 100).toFixed(1) + '% · 刚性误差 ' + S.rigidErr.toFixed(2) + 'px';
    q('rgT').value = t; q('rgTv').textContent = t.toFixed(2) + 's';
    q('rgAmpV').textContent = (+q('rgAmp').value).toFixed(2); q('rgScV').textContent = q('rgSc').value; q('rgSsV').textContent = q('rgSs').value;
  }
  function loop(now) {
    if (playing) t = (t + Math.min(.1, (now - last) / 1000)) % 10;
    last = now; frame(); requestAnimationFrame(loop);
  }
  function setPlay(p) { playing = p; q('rgPlay').textContent = p ? '❚❚' : '▶'; }
  q('rgPlay').onclick = () => setPlay(!playing);
  q('rgT').oninput = (e) => { setPlay(false); t = +e.target.value; };
  function dev(e) { const b = cv.getBoundingClientRect(); return [(e.clientX - b.left) * 1920 / b.width, (e.clientY - b.top) * 1080 / b.height]; }
  function scl() { const m = rig()._m; return Math.hypot(m.a, m.b) || 1; }
  function showPin(p) {
    sel = p;
    const r = rig();
    q('rgPin').textContent = p ? p.id + ' (' + p.kind + (p.mat ? ' ' + p.mat : '') + ') x=' + (p.x + r.ox).toFixed(0) + ' y=' + (p.y + r.oy).toFixed(0) + (p.r ? ' r=' + p.r : '') + (p.kind === 'soft' ? ' w=' + p.w : '') : '';
    q('rgPinEd').style.display = p && p.r != null ? '' : 'none';
    if (p && p.r != null) { q('rgPr').value = p.r; q('rgPw').value = p.w == null ? '' : p.w; q('rgPm').value = p.mat || 'cloth'; }
  }
  q('rgPr').onchange = () => { if (sel) { sel.r = +q('rgPr').value; rig().refresh(); } };
  q('rgPw').onchange = () => { if (sel && sel.kind === 'soft') { sel.w = U.clamp(+q('rgPw').value, 0, 1); rig().refresh(); } };
  q('rgPm').onchange = () => { if (sel && sel.kind === 'soft') { if (q('rgPm').value === 'silk') sel.mat = 'silk'; else delete sel.mat; rig().refresh(); } };
  cv.addEventListener('pointerdown', (e) => {
    const r = rig(), d = dev(e), L = r.toLocal(d[0], d[1]), p = r.pinAt(L[0], L[1], 14 / scl());
    cv.setPointerCapture(e.pointerId); setPlay(false);
    if (p) { drag = { id: p.id }; showPin(p); return; }
    drag = { paint: true };
    r.paint(L[0], L[1], +q('rgBr').value, (e.shiftKey ? -1 : 1) * q('rgBk').value / 100);
  });
  cv.addEventListener('pointermove', (e) => {
    const r = rig(), d = dev(e), L = r.toLocal(d[0], d[1]);
    brush = { x: L[0], y: L[1], r: +q('rgBr').value, sub: e.shiftKey };
    if (!drag) { cv.style.cursor = r.pinAt(L[0], L[1], 14 / scl()) ? 'grab' : 'crosshair'; return; }
    if (drag.id) { r.movePin(drag.id, L[0], L[1]); showPin(r.pins.find((p) => p.id === drag.id)); }
    else r.paint(L[0], L[1], brush.r, (e.shiftKey ? -1 : 1) * q('rgBk').value / 100);
  });
  cv.addEventListener('pointerup', () => { drag = null; });
  cv.addEventListener('pointerleave', () => { brush = null; });
  addEventListener('keydown', (e) => {
    if (/TEXTAREA|INPUT|SELECT/.test(e.target.tagName) && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
    if (e.key === ' ') { setPlay(!playing); e.preventDefault(); }
    else if (e.key === '[' || e.key === ']') { const b = q('rgBr'); b.value = +b.value + (e.key === ']' ? 5 : -5); }
  });
  q('rgExp').onclick = () => {
    const j = Object.assign({ plate: plateOf(id) }, rig().exportRig()), text = JSON.stringify(j);
    q('rgText').value = text;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = 'rig-' + id + '.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  q('rgImp').onclick = () => {
    try { const j = JSON.parse(q('rgText').value); I.rig.define(id, Object.assign({ plate: plateOf(id) }, j)); showPin(null); }
    catch (err) { q('rgInfo').textContent = '导入失败：' + err.message; }
  };
  q('rgReset').onclick = () => { I.rig.define(id, { plate: base.plate }); showPin(null); q('rgText').value = ''; };
  requestAnimationFrame((n) => { last = n; loop(n); });
  window.__rigDebug = { rig, setTime: (x) => { setPlay(false); t = x; frame(); }, opts: () => q };
};
})();
