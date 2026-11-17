#!/usr/bin/env node
/* 《万古云霄》审片工具 filmstrip.mjs —— 一个无头 Chrome、一次打开 index.html?mute=1&shot=1，同页批量取帧。
   零 npm 依赖（Node 22 自带 WebSocket / fetch），经 Chrome DevTools Protocol 驱动。
   用法：node tools/filmstrip.mjs [--from 秒] [--to 秒] [--step 2] [--act N] [--out 目录] [--thumb 480] [--cols 6] [--full] [--gpu] [--page 页面.html] [--det]
     --page  换别的页面（缺省 index.html；如 lab/engine-gallery.html）
     --det   确定性检查：每个取帧时刻再做三路径——顺序（自该时刻前 1.5s 起每 1/30s 渲到它）/ 直跳（先跳到远处）/ 乱序（+3s、−1.7s 再回来），
             对整张画布 RGBA 取 FNV-1a 哈希，与首次取帧比；不一致的时刻记入 report.json 的 det.mismatch
     --act N  只渲第 N 幕（prologue=0、act1=1 … act5=5、coda=6，按 __cine.acts 顺序）；与 --from/--to（全片秒，--to 含端点）取交集。
   取帧：页内 __cine.renderAt(t) → 读回 1 像素强制光栅化（计时到此为止）→ 画布叠 #cv 的 CSS 底色后 toDataURL。
     字幕/台词/幕名卡都画在 canvas 上，?shot=1 已隐藏 DOM 控件与开卷遮罩，所以画布读回 = 截图。
   输出：<out>/thumbs/t0083.00.jpg 逐帧缩略 | <out>/full/…（--full）| <out>/strip-<N>.jpg 每幕总表（过长分页 strip-<N>-2.jpg）| <out>/report.json
   报错：每帧收 CINE.errors 增量（幕 draw 抛错被引擎吞掉，只在这里）+ Runtime.exceptionThrown + console.error + Log.entryAdded(error)。
   注意：按时间升序渲染，离屏缓存沿途预热；个别依赖顺播状态的效果不保证与顺播逐像素一致。 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INDEX = path.resolve(HERE, '..', 'index.html');
const CHROME = process.env.CHROME || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/opt/pw-browsers/chromium-1194/chrome-linux/chrome');   // CHROME 环境变量可覆盖
const MAX_ROWS = 40;                                   // 总表每页最多行数，超出分页

function die(msg) { console.error('filmstrip: ' + msg); process.exit(2); }
function parseArgs(argv) {
  const o = { step: 2, thumb: 480, cols: 6, full: false, gpu: false, det: false, page: INDEX };
  const num = (s, k) => { const v = Number(s); if (!Number.isFinite(v)) die(`${k} 需要数字，收到 ${s}`); return v; };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], val = () => { if (i + 1 >= argv.length) die(`${a} 缺参数`); return argv[++i]; };
    if (a === '--from') o.from = num(val(), a);
    else if (a === '--to') o.to = num(val(), a);
    else if (a === '--step') o.step = num(val(), a);
    else if (a === '--act') o.act = num(val(), a);
    else if (a === '--out') o.out = val();
    else if (a === '--thumb') o.thumb = Math.round(num(val(), a));
    else if (a === '--cols') o.cols = Math.round(num(val(), a));
    else if (a === '--full') o.full = true;
    else if (a === '--gpu') o.gpu = true;
    else if (a === '--det') o.det = true;
    else if (a === '--page') o.page = path.resolve(val());
    else if (a === '-h' || a === '--help') { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]); process.exit(0); }
    else die(`未知参数 ${a}（--help 看用法）`);
  }
  if (!(o.step > 0)) die('--step 须 > 0');
  if (!(o.thumb >= 64)) die('--thumb 须 ≥ 64');
  if (!(o.cols >= 1)) die('--cols 须 ≥ 1');
  o.out = path.resolve(o.out || path.join(os.tmpdir(), 'filmstrip-' + new Date().toISOString().replace(/[:.]/g, '-')));
  return o;
}

/* ---------- Chrome 进程：退出时一定杀掉（整组），临时 profile 一并删 ---------- */
let chrome = null, profDir = null, chromeLog = '';
function killChrome() {
  if (chrome) {                                        // 主进程已退也杀一遍整组，清掉残留 helper
    try { process.kill(-chrome.pid, 'SIGKILL'); } catch { try { chrome.kill('SIGKILL'); } catch { /* 已退 */ } }
  }
  chrome = null;
  if (profDir) { try { fs.rmSync(profDir, { recursive: true, force: true }); } catch { /* 忽略 */ } profDir = null; }
}
process.on('exit', killChrome);
for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(s, () => { console.error(`\n收到 ${s}，关闭 Chrome`); process.exit(130); });

function launchChrome(gpu) {
  profDir = fs.mkdtempSync(path.join(os.tmpdir(), 'filmstrip-chrome-'));
  const args = ['--headless=new', '--remote-debugging-port=0', '--window-size=1920,1080', '--hide-scrollbars',
    `--user-data-dir=${profDir}`, '--no-first-run', '--no-default-browser-check', '--mute-audio', 'about:blank'];
  if (!gpu) args.splice(1, 0, '--disable-gpu');
  if (process.getuid && process.getuid() === 0) args.splice(1, 0, '--no-sandbox', '--disable-dev-shm-usage');   // 云端容器以 root 跑
  chrome = spawn(CHROME, args, { stdio: ['ignore', 'ignore', 'pipe'], detached: true });   // detached：独立进程组，便于整组杀
  return new Promise((resolve, reject) => {
    const tm = setTimeout(() => reject(new Error('Chrome 20 秒内没报出调试端口\n' + chromeLog)), 20000);
    chrome.stderr.on('data', (d) => {                  // 一直读 stderr，免得管道写满卡住 Chrome
      chromeLog = (chromeLog + d).slice(-4000);
      const m = chromeLog.match(/DevTools listening on ws:\/\/[^:/]+:(\d+)\//);
      if (m) { clearTimeout(tm); resolve(+m[1]); }
    });
    chrome.on('error', (e) => { clearTimeout(tm); reject(e); });
    chrome.on('exit', (code, sig) => { clearTimeout(tm); reject(new Error(`Chrome 提前退出 code=${code} sig=${sig}\n${chromeLog}`)); });
  });
}

/* ---------- 极简 CDP 客户端（flatten 会话） ---------- */
class CDP {
  static open(url) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      ws.onopen = () => resolve(new CDP(ws));
      ws.onerror = () => reject(new Error('WebSocket 连接失败 ' + url));
    });
  }
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.onEvent = null;
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id === undefined) { if (this.onEvent) this.onEvent(m); return; }
      const p = this.pending.get(m.id);
      if (!p) return;
      this.pending.delete(m.id); clearTimeout(p.tm);
      if (m.error) p.reject(new Error(`${p.method}: ${m.error.message}`)); else p.resolve(m.result);
    };
    ws.onclose = () => {
      for (const p of this.pending.values()) { clearTimeout(p.tm); p.reject(new Error('CDP 连接断开（Chrome 崩了？）')); }
      this.pending.clear();
    };
  }
  send(method, params = {}, sessionId, timeout = 60000) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const tm = setTimeout(() => { this.pending.delete(id); reject(new Error(`${method} 超时 ${timeout}ms`)); }, timeout);
      this.pending.set(id, { resolve, reject, tm, method });
      this.ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
    });
  }
}

/* ---------- 页内助手：渲一帧、出缩略、拼总表（全在页里用 canvas 做，不依赖 ImageMagick） ---------- */
const PAGE_HELPER = `window.__fs = (function () {
  var cv = document.getElementById('cv'), bg = getComputedStyle(cv).backgroundColor || '#efe7d5';
  var tw, th, cols, G = 4, tc, tx, fc, fx, strip, sx;
  function label(c, x, y, s) {
    var f = Math.max(11, Math.round(tw / 30)), h = Math.round(f * 1.5);
    c.font = '600 ' + f + 'px Menlo, Monaco, monospace'; c.textBaseline = 'middle';
    c.fillStyle = 'rgba(0,0,0,.62)'; c.fillRect(x, y, Math.ceil(c.measureText(s).width + f * .8), h);
    c.fillStyle = '#fff'; c.fillText(s, x + f * .4, y + h / 2);
  }
  /* 冲刷 GPU：主画布缩画到显式 willReadFrequently:false 的 1×1 画布再回读。
     直接对主画布 getImageData 连续约 40 次后 Chrome 会把主画布降成 CPU 画布，计时虚高到 50–90ms（PERF §1.2 / O7） */
  var f1 = null;
  function flush1() {
    if (!f1) { var q = document.createElement('canvas'); q.width = q.height = 1; f1 = q.getContext('2d', { willReadFrequently: false }); }
    f1.clearRect(0, 0, 1, 1); f1.drawImage(cv, 0, 0, 1, 1); f1.getImageData(0, 0, 1, 1);
  }
  return {
    init: function (o) {
      tw = o.tw; cols = o.cols; th = Math.round(tw * cv.height / cv.width);
      tc = document.createElement('canvas'); tc.width = tw; tc.height = th; tx = tc.getContext('2d');
      tx.imageSmoothingEnabled = true; tx.imageSmoothingQuality = 'high';
      fc = document.createElement('canvas'); fc.width = cv.width; fc.height = cv.height; fx = fc.getContext('2d');
      return { w: cv.width, h: cv.height, th: th };
    },
    begin: function (n) {
      var c = Math.min(n, cols), r = Math.ceil(n / cols);
      strip = document.createElement('canvas'); strip.width = c * tw + (c + 1) * G; strip.height = r * th + (r + 1) * G;
      sx = strip.getContext('2d'); sx.fillStyle = '#14120f'; sx.fillRect(0, 0, strip.width, strip.height);
    },
    frame: function (T, i, lab, full) {
      var e0 = CINE.errors.length, err = [], t0 = performance.now();
      try { __cine.renderAt(T); flush1(); }
      catch (e) { err.push('renderAt 抛错: ' + (e && e.stack || e)); }
      var ms = performance.now() - t0;
      err = CINE.errors.slice(e0).concat(err);
      tx.fillStyle = bg; tx.fillRect(0, 0, tw, th); tx.drawImage(cv, 0, 0, tw, th);
      var x = G + (i % cols) * (tw + G), y = G + Math.floor(i / cols) * (th + G);
      sx.drawImage(tc, x, y); label(sx, x, y, lab);
      var r = { ms: ms, errors: err, thumb: tc.toDataURL('image/jpeg', .85).slice(23) };
      if (full) { fx.fillStyle = bg; fx.fillRect(0, 0, fc.width, fc.height); fx.drawImage(cv, 0, 0); r.full = fc.toDataURL('image/jpeg', .92).slice(23); }
      return r;
    },
    end: function () { var u = strip.toDataURL('image/jpeg', .85).slice(23); strip = sx = null; return u; },
    hash: function () {
      var d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, h = 0x811c9dc5;
      for (var i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 0x01000193); }
      return (h >>> 0).toString(16);
    },
    det: function (T, lo, hi) {
      var self = this, r = {};
      __cine.renderAt(T); r.first = self.hash();
      for (var s = Math.max(lo, T - 1.5); s < T - 1e-6; s += 1 / 30) __cine.renderAt(s);
      __cine.renderAt(T); r.seq = self.hash();
      __cine.renderAt(T + 200 < hi ? T + 200 : Math.max(lo, T - 200)); __cine.renderAt(T); r.jump = self.hash();
      __cine.renderAt(Math.min(hi - .01, T + 3)); __cine.renderAt(Math.max(lo, T - 1.7)); __cine.renderAt(T); r.shuf = self.hash();
      r.ok = r.first === r.seq && r.seq === r.jump && r.jump === r.shuf;
      return r;
    }
  };
})(); 'ok'`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tc = (T) => { const r = Math.round(T * 10) / 10, m = Math.floor(r / 60); return `${m}:${(r - m * 60).toFixed(1).padStart(4, '0')}`; };
const fmtDur = (ms) => ms < 60000 ? (ms / 1000).toFixed(1) + 's' : `${Math.floor(ms / 60000)}m${Math.round(ms % 60000 / 1000)}s`;

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const T0 = performance.now();
  fs.mkdirSync(path.join(o.out, 'thumbs'), { recursive: true });
  if (o.full) fs.mkdirSync(path.join(o.out, 'full'), { recursive: true });

  const port = await launchChrome(o.gpu);
  const ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  const cdp = await CDP.open(ver.webSocketDebuggerUrl);
  let sid = null, bucket = [];
  const loadErrors = bucket;
  try {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    sid = (await cdp.send('Target.attachToTarget', { targetId, flatten: true })).sessionId;
    const send = (m, p, t) => cdp.send(m, p, sid, t);
    const evaluate = async (expr, awaitPromise = false, timeout = 120000) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise }, timeout);
      if (r.exceptionDetails) throw new Error('页面求值出错：' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
      return r.result.value;
    };
    cdp.onEvent = (m) => {
      if (m.sessionId !== sid) return;
      const p = m.params;
      if (m.method === 'Runtime.exceptionThrown') bucket.push('exception: ' + (p.exceptionDetails.exception?.description || p.exceptionDetails.text));
      else if (m.method === 'Runtime.consoleAPICalled' && (p.type === 'error' || p.type === 'assert'))
        bucket.push('console.' + p.type + ': ' + p.args.map((a) => a.value ?? a.description ?? '').join(' '));
      else if (m.method === 'Log.entryAdded' && p.entry.level === 'error') bucket.push(`log(${p.entry.source}): ${p.entry.text}${p.entry.url ? ' @ ' + p.entry.url : ''}`);
    };
    await Promise.all([send('Page.enable'), send('Runtime.enable'), send('Log.enable')]);
    await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
    const url = pathToFileURL(o.page).href + '?mute=1&shot=1';
    await send('Page.navigate', { url });
    for (const dl = Date.now() + 90000; ;) {            // shot 模式：字体（≤3.5s）与底图（≤5s）都就绪、首帧画完才写 SHOT-READY
      const title = await evaluate('document.title').catch(() => '');
      if (typeof title === 'string' && title.startsWith('SHOT-READY')) break;
      if (Date.now() > dl) throw new Error('90 秒内页面没到 SHOT-READY，标题：' + title);
      await sleep(150);
    }
    const info = await evaluate(`(async function () {
      var F = window.CINE_FONTS, flag = F && F.ready ? await F.ready : null;
      var total = window.CINE_PLATES ? Object.keys(CINE_PLATES).length : 0, n = await CINE.platesReady;
      return { duration: __cine.duration, acts: __cine.acts, fontsReady: flag, plates: n, platesTotal: total,
        fonts: Array.from(document.fonts).map(function (f) { return f.family.replace(/"/g, '') + ':' + f.status; }),
        title: document.title, errors: CINE.errors.slice() };
    })()`, true);
    const loadMs = performance.now() - T0;
    const badFonts = info.fonts.filter((s) => !s.endsWith(':loaded'));
    console.log(`载入 ${fmtDur(loadMs)} · 全片 ${info.duration}s · ${info.acts.length} 幕 · 底图 ${info.plates}/${info.platesTotal} · 字体 ${info.fonts.length - badFonts.length}/${info.fonts.length} 已载`);
    if (info.plates < info.platesTotal) console.warn(`警告：底图只解码了 ${info.plates}/${info.platesTotal} 张`);
    if (badFonts.length || info.fontsReady === false) console.warn('警告：字体未全部就绪 ' + badFonts.join(' '));
    const dims = JSON.parse(await evaluate(PAGE_HELPER + `; JSON.stringify(__fs.init(${JSON.stringify({ tw: o.thumb, cols: o.cols })}))`));

    /* 取帧时刻：全片秒网格（--act 时从该幕起点起算）；幕尾/片尾不含，--to 含 */
    const acts = info.acts;
    let lo = 0, hiEx = info.duration, hiIn = Infinity;
    if (o.act !== undefined) {
      if (!acts[o.act]) die(`--act ${o.act} 越界：共 ${acts.length} 幕（0–${acts.length - 1}）`);
      lo = acts[o.act].start; hiEx = acts[o.act].end;
    }
    if (o.from !== undefined) lo = Math.max(lo, o.from);
    if (o.to !== undefined) hiIn = o.to;
    const frames = [];
    for (let k = 0; ; k++) {
      const T = Math.round((lo + k * o.step) * 1000) / 1000;
      if (T >= hiEx || T > hiIn + 1e-9) break;
      const ai = acts.findIndex((a) => T >= a.start && T < a.end);
      frames.push({ T, act: ai, actId: acts[ai].id, t: Math.round((T - acts[ai].start) * 1000) / 1000 });
    }
    if (!frames.length) die('区间内没有可渲的时刻');
    console.log(`取 ${frames.length} 帧 · step ${o.step}s · 画布 ${dims.w}×${dims.h} · 缩略 ${o.thumb}×${dims.th} · ${o.gpu ? 'GPU' : '--disable-gpu'} → ${o.out}`);

    /* 按幕分组（每组 ≤ cols×MAX_ROWS 帧一页），升序渲染 */
    const groups = [];
    for (const f of frames) {
      const g = groups[groups.length - 1];
      if (g && g.act === f.act && g.frames.length < o.cols * MAX_ROWS) g.frames.push(f);
      else groups.push({ act: f.act, page: g && g.act === f.act ? g.page + 1 : 1, frames: [f] });
    }
    const L0 = performance.now(), strips = [];
    let done = 0;
    for (const g of groups) {
      await evaluate(`__fs.begin(${g.frames.length})`);
      for (let i = 0; i < g.frames.length; i++) {
        const f = g.frames[i], w0 = performance.now();
        bucket = [];
        const lab = `${tc(f.T)} · ${f.actId} +${f.t.toFixed(1)}s`;
        const r = await evaluate(`__fs.frame(${f.T}, ${i}, ${JSON.stringify(lab)}, ${o.full})`);
        const name = 't' + f.T.toFixed(2).padStart(7, '0') + '.jpg';
        fs.writeFileSync(path.join(o.out, 'thumbs', name), Buffer.from(r.thumb, 'base64'));
        if (r.full) fs.writeFileSync(path.join(o.out, 'full', name), Buffer.from(r.full, 'base64'));
        f.ms = Math.round(r.ms * 10) / 10;
        f.errors = r.errors.concat(bucket);
        f.wallMs = Math.round(performance.now() - w0);
        if (o.det) f.det = await evaluate(`__fs.det(${f.T}, 0, ${info.duration})`);
        if (++done % 25 === 0) console.log(`  ${done}/${frames.length}  ${tc(f.T)}  ${fmtDur(performance.now() - L0)}`);
      }
      const sname = `strip-${g.act}${g.page > 1 ? '-' + g.page : ''}.jpg`;
      fs.writeFileSync(path.join(o.out, sname), Buffer.from(await evaluate('__fs.end()'), 'base64'));
      strips.push(sname);
      const ms = g.frames.map((f) => f.ms), ne = g.frames.reduce((s, f) => s + f.errors.length, 0);
      console.log(`${sname}  ${acts[g.act].id} ${acts[g.act].name}  ${g.frames.length} 帧  渲染均 ${Math.round(ms.reduce((a, b) => a + b, 0) / ms.length)}ms  最慢 ${Math.round(Math.max(...ms))}ms${ne ? `  报错 ${ne}` : ''}`);
    }

    /* 汇总 */
    const loopMs = performance.now() - L0, totalMs = performance.now() - T0;
    const nErr = frames.reduce((s, f) => s + f.errors.length, 0) + loadErrors.length + info.errors.length;
    const avgRender = frames.reduce((s, f) => s + f.ms, 0) / frames.length;
    const slow = [...frames].sort((a, b) => b.ms - a.ms).slice(0, 10);
    const report = {
      url, chrome: ver.Browser, gpu: o.gpu, args: process.argv.slice(2), createdAt: new Date().toISOString(),
      load: { ms: Math.round(loadMs), fontsReady: info.fontsReady, fonts: info.fonts, plates: info.plates, platesTotal: info.platesTotal,
        canvas: [dims.w, dims.h], title: info.title, errors: info.errors.concat(loadErrors) },
      det: o.det ? { checked: frames.length, mismatch: frames.filter((f) => !f.det.ok).map((f) => ({ T: f.T, ...f.det })) } : undefined,
      summary: { frames: frames.length, totalMs: Math.round(totalMs), loopMs: Math.round(loopMs), avgWallMs: Math.round(loopMs / frames.length),
        avgRenderMs: Math.round(avgRender * 10) / 10, errors: nErr, strips },
      frames: frames.map((f) => ({ T: f.T, tc: tc(f.T), act: f.act, actId: f.actId, t: f.t, ms: f.ms, wallMs: f.wallMs, errors: f.errors, det: f.det }))
    };
    fs.writeFileSync(path.join(o.out, 'report.json'), JSON.stringify(report, null, 1));
    console.log(`\n帧数 ${frames.length} · 总耗时 ${fmtDur(totalMs)}（载入 ${fmtDur(loadMs)}，取帧 ${fmtDur(loopMs)}）· 平均每帧 ${Math.round(loopMs / frames.length)}ms（其中渲染 ${avgRender.toFixed(1)}ms）· 报错 ${nErr}`);
    if (o.det) { const bad = frames.filter((f) => !f.det.ok); console.log(`确定性（顺序/直跳/乱序 三路径整帧哈希）：${frames.length - bad.length}/${frames.length} 一致` + (bad.length ? '  不一致：' + bad.map((f) => f.T).join(' ') : '')); }
    console.log('最慢 10 帧（渲染 ms）：');
    for (const f of slow) console.log(`  ${tc(f.T).padStart(7)}  ${f.actId} +${f.t.toFixed(1)}s  ${f.ms}ms`);
    if (nErr) {
      const seen = new Set(report.load.errors);
      for (const f of frames) for (const e of f.errors) seen.add(e);
      console.log('报错（去重，前 10 条；逐帧见 report.json）：');
      [...seen].slice(0, 10).forEach((e) => console.log('  ' + e.split('\n')[0]));
    }
    console.log(`输出：${o.out}（report.json、${strips.length} 张总表、thumbs/${o.full ? '、full/' : ''}）`);
  } finally {
    try { await cdp.send('Browser.close', {}, undefined, 3000); } catch { /* 已断 */ }
    for (let i = 0; i < 30 && chrome && chrome.exitCode === null && chrome.signalCode === null; i++) await sleep(100);
    killChrome();
  }
}

main().catch((e) => { console.error('filmstrip 失败：' + (e && e.stack || e)); killChrome(); process.exit(1); });
