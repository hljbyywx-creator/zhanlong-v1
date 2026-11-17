#!/usr/bin/env node
/* 《万古云霄》字幕体检 sub-lint.mjs —— 量「实际上屏」的文字，按新字幕节奏标准（docs/reviews/NEWCOMER-DECISIONS.md §6）判停留/间隔/密度。
   用法：node tools/sub-lint.mjs [--act N] [--from 秒] [--to 秒] [--step .1] [--jobs 2] [--out 前缀] [--json] [--no-cuts] [--contrast] [--contrast-out 前缀] [--contrast-off]
                                 [--hits 命中点.json] [--coscreen-allow 白名单.txt]
         node tools/sub-lint.mjs --ledger 账本.md [--hits 命中点.json] [--coscreen-allow 白名单.txt] [--out 前缀] [--json]      ← 纸面模式，不开浏览器（见文末）
     --act N   只扫第 N 幕（prologue=0、act1=1 … act5=5、coda=6，与 filmstrip 同）；缺省全片。--from/--to 全片秒，与 --act 取交集。
     --step    采样步长（缺省 0.1s）。--jobs 并行页数（缺省 2；每页一个渲染进程，按时间切段）。
     --out     输出前缀（缺省 tools/out/sub-lint-<all|actN|paper>）→ <前缀>.json + <前缀>.txt；--json 只写 JSON 不打印报告。
     --hits    命中点清单 JSON：[{"T":全片秒,"beat":"拍号","label":"…","pre":1.5,"post":1.5,"allow":["子串"]}]（pre 缺省 1.5、post 缺省 2.5（v5）；allow 可缺，文字含其一的条目不判该命中点，须有作者决定记在 GRILL）；给了才判「命中禁字」。
     --coscreen-allow  「跨层重叠」白名单：每行一段子串（空行、# 开头的行不算），重叠的两条里任一条文字含其中一段即豁免。
   原理：无头 Chrome 打开 index.html?mute=1&shot=1&lint=1（引擎 CINE.lintOn 字幕体检钩子，见 ENGINE-NOTES §7.3），逐 step 调 __cine.renderAt(T)
     （不读回像素），每帧取 CINE.lintFrame()：语义入口（I.sub/chant/note/big/say/narr/nameTag、幕名卡）与入口之外的 fillText 行（raw）。
   判定（字数＝去标点、符号、空白后的字数）：
     出现＝首个 any>0.02 的采样；消失＝末个 any>0.02 的采样 + step；完整可读＝全部字已出且不透明度 ≥ 0.9×该条峰值。
     阅读字幕（旁白/台词/心声/心念/画外音/诵/题注/大字/横竖排台词旁白/raw）完整可读停留 ≥ max(2.5, 字数÷4+1.0)；
     前情字卡（recap 幕的 raw 行，时间重叠的行并成一卡）≥ 字数÷3.5+1.5；
     相邻两条：前一条消失 → 后一条出现 ≥ 0.8s；同一层（底部字幕带、上方心声、竖排、题注、大字、字卡各算一层）重叠＝间隔违规，不同层重叠＝同屏双层（只报告）；
     任意 12 秒窗口内「出现」的阅读字数 ≤ 36（旧口径，不含题签；仍照报供对照）；幕名、幕内自画的 ≤4 字短标（raw，如尾声三格名）不计阅读量，只报告与阅读字幕同屏。
     注意：片名（I.big 画）按大字计；印章（精灵贴图）与画中字（程序笔画）不经 fillText，不在统计内。
   第①期新增（REVISION-PLAN v2.1 §9 ①、review-astra 第 3 条；10-21），四类各自计数，均计入退出码：
     题签停留：题签（I.nameTag）自身完整可读 ≥ 2.0s（被 --from/--to 截断的不判）。
     密度（含题签）：12 秒窗口把题签字数与阅读字数合算，≤ 36；幕名、自画标仍不计。窗口按全片秒连续滑动、不在幕界清零
       （判定本来就不分幕；但 --act/--from/--to 只看得到所扫区间，幕界两侧要扫全片或用纸面模式）。
     跨层重叠：阅读字幕与题签（题签自成一层）两两比，分属不同层而「完整可读区间」重叠 → 违规（与按出现→消失算的「同屏双层」不同，后者照旧只报告）；
       豁免：其中一条是 ≤6 字的题签；或任一条文字含 --coscreen-allow 里的一段子串。豁免对另列，不计违规。
     命中禁字：阅读字幕或题签的「出现」落在任一命中点 [T−pre, T+post] 内 → 违规（被 --from/--to 截掉开头的条目不判）。
   跨镜（10-18 增，缺省开，--no-cuts 关）：每帧另取 64×36 亮度缩略，找镜头切换——
     硬切＝相邻两帧差（去掉下 28% 字幕带与各条文字框）突增（≥14 级且 ≥ 邻近中位数×4+4），且 .3s 后仍不回原样（排除闪白）；
     拍界（__cine.beats 与幕界）前后 ±.5s 两帧差 ≥10 且 ≥ 两侧同距基线×2+3 算「换景」，否则算「同镜延伸」（豁免）。
     阅读字幕显示区间（出现→消失）跨过硬切或换景拍界、两侧都超出 0.3s → 跨镜违规；字幕选项 span:true（账本 pos 覆盖即可）豁免。
     清单写 <前缀>-cuts.txt（全片缺省 tools/out/sub-lint-cuts.txt）。
   对比度（--contrast，缺省关；--contrast-out 前缀，缺省 tools/out/contrast-<all|actN>）：对每条阅读字幕/题签/自画字在完整可读区间的
     20%/50%/80% 处各取一帧，同一时刻渲 4 遍（正常／字形不画／字形纯白／字形纯黑，CINE.lintMode；自动对比的决定由 CINE.contrastPin 记下照放），
     由纯白−纯黑得每像素字形覆盖度，取覆盖度 ≥ max(.3, .8×峰值) 的字芯像素（实笔，不含抗锯齿边），逐像素算「正常帧亮度 vs 字形不画帧亮度」的 WCAG 对比比 (L1+.05)/(L2+.05)
     （「字形不画」那遍连字的描边也不画：量的是字对其下画面与衬底，不把字自己的描边算作底），
     条目值 C20＝三帧中最差一帧的 20 分位（八成字芯像素至少有此对比）；C20 < 4.5 报低对比。位置按框心 x：左 <W/3、右 >2W/3，x<.15W 或 >.85W 记「边」。
     --contrast-off：页面加 ?contrast=0 关引擎文字自动对比（与 10-18 前画面逐字节相同），量改版前基线用。
   纸面模式（--ledger 账本，10-21 增）：不开浏览器，按 tools/build-ledger.py 的规则解析账本表格（「## 冷开场/前情/序/第…幕/尾/尾声」标题行定幕，
     「| W123 |」或「| T123 |」起头为条目行，备注列含「建议删」的跳过；印章与退场「常驻」不上 fillText，跳过），每条从「起点＝全片秒、退场＝全片秒＋（退场−幕内秒）」出发，
     按引擎实际画法推算出现、完整可读起止、消失（协调者 10-21 裁定：一律照引擎，extra() 与 lib-text.js 不一致处以 lib-text.js 为准）——
       照 js/lib-text.js 各样式与 engine.js I.nameTag 的代码逐字算不透明度，用与页面模式相同的量法（any>.02＝出现/消失；全部字已出且最淡一字 ≥ .9×峰值＝完整可读）按 .01s 取样：
       旁白/对白/署名 I.sub、心声 I.inner、传讯 I.slip（1024 改版：整句淡入 .25s、退场前 .25s 淡出，不再逐字；v5 按类型：旁白/署名淡入 .35 且由糊到清、对白名先出正文晚 .12 淡入 .15、心声淡入 .45；对白文字＝说话人名＋全角空格＋台词，人名计入字数，
       同 I.ledger 传给 I.sub 的文字）；秘阵声 I.arrayVoice（每字 1/22s、淡入 .3、fo .5）；
       萤光点 I.moteText（每字 .045s、淡入 .9、fo .8）；题注 I.note（每字 1/8s、淡入 .35，末 .6s 淡出）；
       诵 I.chant（每字 .38s）；片名/大字 I.big（1.2s 内逐字压出，退场前 .5s 淡出）；
       题签 I.nameTag：I.ledger 不传 hold、也不读账本退场，固定从起点画到起点+3.0（修订 v2：淡显约 .35s，停到起点+2.5，.5s 墨晕散）。
       心声按说话人换色（血府老祖暗红）只改颜色，不改出字时间。
       幕文件 pos 里的逐条覆盖（如 act1 W006 hold 2.2）账本里看不到，纸面按缺省算。
     层：旁白/对白/署名＝底部带，心声/秘阵声＝上方，题注、传讯、竖排（诵）各一层，萤光点同页面模式归题注层，片名/大字一层，题签自成一层
       （页面模式的 READ 表里传讯与竖排同层，纸面按第①期口径单列）。
     其余规则（停留、相邻间隔 ≥0.8s、同屏双层、跨层重叠、12 秒窗口含题签、命中禁字、题签停留）与页面模式同一套代码；
     报告首行注明「纸面推算，非实测」，时刻精确到 .01s（页面模式是 .1s 采样）。不判跨镜与对比度；不认 --act/--from/--to/--contrast*。
   退出码：停留/间隔/密度/跨镜/题签停留/跨层重叠/命中禁字有违规 → 1；工具出错 → 2（对比度只报告，不计退出码）。零 npm 依赖，Node ≥ 22；CHROME 环境变量可换浏览器。 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INDEX = path.resolve(HERE, '..', 'index.html');
const CHROME = process.env.CHROME || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/opt/pw-browsers/chromium-1194/chrome-linux/chrome');
const STD = { minHold: 2.5, perChar: 4, base: 1.0, cardPerChar: 3.5, cardBase: 1.5, gap: .8, win: 12, winMax: 36, full: .9, vis: .02, tagHold: 2.0, tagFree: 6, hitPad: 1.5, hitPost: 2.5 };   // v5（TXT 第 3 条）：命中后 2.5s 不出新字，前沿仍 1.5
const READ = { narr: 'band', line: 'band', voice: 'band', thought: 'band', say: 'band', heart: 'top', inner: 'top', array: 'top', chant: 'vert', vnarr: 'vert', note: 'note', mote: 'note', big: 'big', card: 'card', raw: 'raw', slip: 'vert' };
const KIND_ZH = { narr: '旁白', line: '台词', voice: '画外音', thought: '心念', say: '横排台词', heart: '心声', inner: '心声', chant: '诵', vnarr: '竖排旁白', note: '题注', mote: '萤光字', big: '大字', card: '字卡', raw: '自画字', tag: '题签', title: '幕名', label: '自画标', array: '秘阵声', slip: '传讯' };

function die(msg) { console.error('sub-lint: ' + msg); process.exit(2); }
function parseArgs(argv) {
  const o = { step: .1, jobs: 2, json: false, cuts: true, contrast: false };
  const num = (s, k) => { const v = Number(s); if (!Number.isFinite(v)) die(`${k} 需要数字，收到 ${s}`); return v; };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], val = () => { if (i + 1 >= argv.length) die(`${a} 缺参数`); return argv[++i]; };
    if (a === '--act') o.act = num(val(), a);
    else if (a === '--from') o.from = num(val(), a);
    else if (a === '--to') o.to = num(val(), a);
    else if (a === '--step') o.step = num(val(), a);
    else if (a === '--jobs') o.jobs = Math.max(1, Math.round(num(val(), a)));
    else if (a === '--out') o.out = val();
    else if (a === '--json') o.json = true;
    else if (a === '--no-cuts') o.cuts = false;
    else if (a === '--contrast') o.contrast = true;
    else if (a === '--contrast-off') o.ctrOff = true;
    else if (a === '--contrast-out') { o.contrast = true; o.ctrOut = val(); }
    else if (a === '--hits') o.hits = val();
    else if (a === '--coscreen-allow') o.allow = val();
    else if (a === '--ledger') o.ledger = val();
    else if (a === '-h' || a === '--help') { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]); process.exit(0); }
    else die(`未知参数 ${a}（--help 看用法）`);
  }
  if (!(o.step > 0)) die('--step 须 > 0');
  if (o.ledger && (o.act !== undefined || o.from !== undefined || o.to !== undefined || o.contrast || o.ctrOff)) die('纸面模式（--ledger）全片推算，不认 --act/--from/--to/--contrast*');
  o.out = path.resolve(o.out || path.join(HERE, 'out', 'sub-lint-' + (o.ledger ? 'paper' : o.act === undefined ? 'all' : 'act' + o.act)));
  const whole = o.act === undefined && o.from === undefined && o.to === undefined;
  o.cutOut = whole && !process.argv.includes('--out') ? path.join(HERE, 'out', 'sub-lint-cuts') : o.out + '-cuts';
  o.ctrOut = path.resolve(o.ctrOut || path.join(HERE, 'out', 'contrast-' + (o.act === undefined ? 'all' : 'act' + o.act)));
  return o;
}

/* ---------- Chrome 与 CDP（同 filmstrip.mjs） ---------- */
let chrome = null, profDir = null, chromeLog = '';
function killChrome() {
  if (chrome) { try { process.kill(-chrome.pid, 'SIGKILL'); } catch { try { chrome.kill('SIGKILL'); } catch { /* 已退 */ } } }
  chrome = null;
  if (profDir) { try { fs.rmSync(profDir, { recursive: true, force: true }); } catch { /* 忽略 */ } profDir = null; }
}
process.on('exit', killChrome);
for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(s, () => { console.error(`\n收到 ${s}，关闭 Chrome`); process.exit(130); });
function launchChrome() {
  profDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sublint-chrome-'));
  const args = ['--headless=new', '--disable-gpu', '--remote-debugging-port=0', '--window-size=1920,1080', '--hide-scrollbars',
    `--user-data-dir=${profDir}`, '--no-first-run', '--no-default-browser-check', '--mute-audio', 'about:blank'];
  if (process.getuid && process.getuid() === 0) args.splice(1, 0, '--no-sandbox', '--disable-dev-shm-usage');
  chrome = spawn(CHROME, args, { stdio: ['ignore', 'ignore', 'pipe'], detached: true });
  return new Promise((resolve, reject) => {
    const tm = setTimeout(() => reject(new Error('Chrome 20 秒内没报出调试端口\n' + chromeLog)), 20000);
    chrome.stderr.on('data', (d) => {
      chromeLog = (chromeLog + d).slice(-4000);
      const m = chromeLog.match(/DevTools listening on ws:\/\/[^:/]+:(\d+)\//);
      if (m) { clearTimeout(tm); resolve(+m[1]); }
    });
    chrome.on('error', (e) => { clearTimeout(tm); reject(e); });
    chrome.on('exit', (code, sig) => { clearTimeout(tm); reject(new Error(`Chrome 提前退出 code=${code} sig=${sig}\n${chromeLog}`)); });
  });
}
class CDP {
  static open(url) {
    return new Promise((resolve, reject) => { const ws = new WebSocket(url); ws.onopen = () => resolve(new CDP(ws)); ws.onerror = () => reject(new Error('WebSocket 连接失败 ' + url)); });
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
    ws.onclose = () => { for (const p of this.pending.values()) { clearTimeout(p.tm); p.reject(new Error('CDP 连接断开（Chrome 崩了？）')); } this.pending.clear(); };
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let CTR_OFF = false;
async function openPage(cdp, errors) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const sid = (await cdp.send('Target.attachToTarget', { targetId, flatten: true })).sessionId;
  const send = (m, p, t) => cdp.send(m, p, sid, t);
  const evaluate = async (expr, awaitPromise = false, timeout = 300000) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise }, timeout);
    if (r.exceptionDetails) throw new Error('页面求值出错：' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  };
  const prev = cdp.onEvent;
  cdp.onEvent = (m) => {
    if (prev) prev(m);
    if (m.sessionId !== sid) return;
    if (m.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  };
  await Promise.all([send('Page.enable'), send('Runtime.enable')]);
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: pathToFileURL(INDEX).href + '?mute=1&shot=1&lint=1' + (CTR_OFF ? '&contrast=0' : '') });
  for (const dl = Date.now() + 120000; ;) {
    const title = await evaluate('document.title').catch(() => '');
    if (typeof title === 'string' && title.startsWith('SHOT-READY')) break;
    if (Date.now() > dl) throw new Error('120 秒内页面没到 SHOT-READY，标题：' + title);
    await sleep(200);
  }
  await evaluate('(async function () { if (window.CINE_FONTS && CINE_FONTS.ready) await CINE_FONTS.ready; await CINE.platesReady; return CINE.lintOn(); })()', true);
  await evaluate(PAGE_HELPER);
  return evaluate;
}


/* ---------- 页内助手：镜头缩略（跨镜）与四遍渲染量对比度 ---------- */
const PAGE_HELPER = `(function () {
  var cv = document.getElementById('cv'), tc = document.createElement('canvas'); tc.width = 64; tc.height = 36;
  var tx = tc.getContext('2d', { willReadFrequently: true }); tx.imageSmoothingEnabled = true; tx.imageSmoothingQuality = 'high';
  window.__thumb = function () {
    tx.drawImage(cv, 0, 0, 64, 36);
    var d = tx.getImageData(0, 0, 64, 36).data, s = '';
    for (var k = 0; k < d.length; k += 4) s += String.fromCharCode(Math.round(d[k] * .299 + d[k + 1] * .587 + d[k + 2] * .114));
    return btoa(s);
  };
  var LUT = new Float32Array(256);
  for (var i = 0; i < 256; i++) { var v = i / 255; LUT[i] = v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }
  function Y(d, k) { return .2126 * LUT[d[k]] + .7152 * LUT[d[k + 1]] + .0722 * LUT[d[k + 2]]; }
  function q(arr, f) { if (!arr.length) return null; var i = Math.min(arr.length - 1, Math.max(0, Math.floor(f * (arr.length - 1)))); return arr[i]; }
  function grab(mode, T) { CINE.lintMode(mode); CINE.lintReset(); __cine.renderAt(T); var g = cv.getContext('2d'); return g.getImageData(0, 0, cv.width, cv.height).data; }
  /* keys：[{key, kind, text}]；返回 {key: {n, c20, c50, light, ty, by, box}} */
  window.__ctr = function (T, keys) {
    var pin = CINE.contrastPin ? CINE.contrastPin('rec') : null;
    var A = grab(null, T), recs = CINE.lintFrame() || [];
    if (CINE.contrastPin) CINE.contrastPin('play');
    var B = grab('ghost', T), Wt = grab('white', T), K = grab('black', T);
    CINE.lintMode(null); if (CINE.contrastPin) CINE.contrastPin(null);
    var w = cv.width, h = cv.height, px = w / 1920, out = {};
    keys.forEach(function (it) {
      var cand = recs.filter(function (r) { return r.box && (it.kind === 'raw' || it.kind === 'card' || it.kind === 'label' ? r.kind === 'raw' && (r.text === it.text || it.text.indexOf(r.text) === 0) : r.kind === it.kind && r.text === it.text); });
      if (!cand.length) { out[it.key] = null; return; }
      var bx = cand.reduce(function (a, r) { return !a || r.text.length > a.text.length ? r : a; }, null).box;
      var x0 = Math.max(0, Math.floor((bx[0] - 6) * px)), y0 = Math.max(0, Math.floor((bx[1] - 6) * px)), x1 = Math.min(w, Math.ceil((bx[2] + 6) * px)), y1 = Math.min(h, Math.ceil((bx[3] + 6) * px));
      var cov = [], cmax = 0, x, y, k;
      for (y = y0; y < y1; y++) for (x = x0; x < x1; x++) { k = (y * w + x) * 4; var c = (Wt[k] - K[k] + Wt[k + 1] - K[k + 1] + Wt[k + 2] - K[k + 2]) / 765; if (c > .05) cov.push(c); }
      cov.sort(function (a, b) { return a - b; }); cmax = q(cov, .98) || 0;
      var thr = Math.max(.3, .8 * cmax), rs = [], ty = [], by = [], light = 0;
      for (y = y0; y < y1; y++) for (x = x0; x < x1; x++) {
        k = (y * w + x) * 4; var cc = (Wt[k] - K[k] + Wt[k + 1] - K[k + 1] + Wt[k + 2] - K[k + 2]) / 765;
        if (cc < thr) continue;
        var ya = Y(A, k), yb = Y(B, k);
        rs.push(ya > yb ? (ya + .05) / (yb + .05) : (yb + .05) / (ya + .05)); ty.push(ya); by.push(yb); if (ya > yb) light++;
      }
      rs.sort(function (a, b) { return a - b; }); ty.sort(function (a, b) { return a - b; }); by.sort(function (a, b) { return a - b; });
      out[it.key] = { n: rs.length, c20: rs.length ? +q(rs, .2).toFixed(2) : null, c50: rs.length ? +q(rs, .5).toFixed(2) : null, light: rs.length ? +(light / rs.length).toFixed(2) : null,
        ty: rs.length ? +q(ty, .5).toFixed(3) : null, by: rs.length ? +q(by, .5).toFixed(3) : null, box: bx, cmax: +cmax.toFixed(2) };
    });
    return out;
  };
  /* 直调入口：引擎的 lint 钩子只包 I.sub/chant/note/say/narr/nameTag/big；幕文件直接调这四个样式时
     经 I.sub 的同名 kind 过一遍（照常量字、不再记 raw），sub-lint 才能按新 kind 归类。只影响测量，不改画面。 */
  [['inner', 'inner'], ['arrayVoice', 'array'], ['moteText', 'mote'], ['slip', 'slip']].forEach(function (p) {
    var nm = p[0], kd = p[1], orig = CINE.ink[nm];
    if (!orig) return;
    var proxy = function (c, text, t, t0, t1, o) {
      var q = {}, k;
      o = o || {};
      for (k in o) q[k] = o[k];
      q.kind = kd;
      CINE.ink[nm] = orig;
      try { return CINE.ink.sub(c, text, t, t0, t1, q); } finally { CINE.ink[nm] = proxy; }
    };
    CINE.ink[nm] = proxy;
  });
  return 'ok';
})()`;

/* ---------- 扫描 ---------- */
async function scan(o) {
  CTR_OFF = !!o.ctrOff;
  const port = await launchChrome();
  const ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  const cdp = await CDP.open(ver.webSocketDebuggerUrl);
  const errors = [];
  try {
    const pages = [];
    for (let j = 0; j < o.jobs; j++) pages.push(await openPage(cdp, errors));
    const info = await pages[0]('({ duration: __cine.duration, acts: __cine.acts, beats: __cine.beats, errors: CINE.errors.slice() })');
    const acts = info.acts;
    let lo = 0, hi = info.duration;
    if (o.act !== undefined) { if (!acts[o.act]) die(`--act ${o.act} 越界：共 ${acts.length} 幕（0–${acts.length - 1}）`); lo = acts[o.act].start; hi = acts[o.act].end; }
    if (o.from !== undefined) lo = Math.max(lo, o.from);
    if (o.to !== undefined) hi = Math.min(hi, o.to + 1e-6);
    const Ts = [];
    for (let k = 0; ; k++) { const T = Math.round((lo + k * o.step) * 1000) / 1000; if (T >= hi) break; Ts.push(T); }
    if (!Ts.length) die('区间内没有可扫的时刻');
    const t0 = performance.now(), per = Math.ceil(Ts.length / pages.length), frames = new Array(Ts.length);
    let done = 0, lastLog = 0;
    console.error(`扫 ${Ts.length} 帧（${lo.toFixed(1)}–${hi.toFixed(1)}s，step ${o.step}s，${pages.length} 页并行）`);
    await Promise.all(pages.map(async (ev, j) => {
      const part = Ts.slice(j * per, (j + 1) * per), B = 40;
      for (let i = 0; i < part.length; i += B) {
        const chunk = part.slice(i, i + B);
        const r = await ev(`(function (L) { return L.map(function (T) { var e0 = CINE.errors.length; CINE.lintReset(); __cine.renderAt(T);
          return { T: T, recs: CINE.lintFrame(), err: CINE.errors.slice(e0)${o.cuts ? ', th: __thumb()' : ''} }; }); })(${JSON.stringify(chunk)})`);
        r.forEach((f, k) => { frames[j * per + i + k] = f; });
        done += chunk.length;
        if (performance.now() - lastLog > 15000) { lastLog = performance.now(); console.error(`  ${done}/${Ts.length}  ${((performance.now() - t0) / 1000).toFixed(0)}s`); }
      }
    }));
    console.error(`扫描完成 ${((performance.now() - t0) / 1000).toFixed(0)}s`);
    const S0 = { acts, beats: info.beats, duration: info.duration, lo, hi, frames };
    let ctr = null;
    if (o.contrast) ctr = await contrastPass(o, pages, track(S0, o.step));
    return { acts, beats: info.beats, ctr, duration: info.duration, lo, hi, frames, errors: errors.concat(info.errors), chrome: ver.Browser,
      firstT: Ts[0], lastT: Ts[Ts.length - 1], cutLo: o.from !== undefined && o.from > (o.act === undefined ? 0 : acts[o.act].start), cutHi: o.to !== undefined && o.to + 1e-6 < (o.act === undefined ? info.duration : acts[o.act].end) };
  } finally {
    try { await cdp.send('Browser.close', {}, undefined, 3000); } catch { /* 已断 */ }
    for (let i = 0; i < 30 && chrome && chrome.exitCode === null && chrome.signalCode === null; i++) await sleep(100);
    killChrome();
  }
}


/* ---------- 对比度：每条在完整可读区间 20/50/80% 处各量一帧 ---------- */
const CTR_MIN = 4.5;
async function contrastPass(o, pages, E) {
  const tgt = E.filter((e) => (e.reading || e.kind === 'tag' || e.kind === 'label') && e.kind !== 'title' && e.readFrom != null && e.readTo > e.readFrom);
  const byT = new Map();
  tgt.forEach((e, i) => {
    e.ckey = 'k' + i;
    for (const f of [.2, .5, .8]) {
      const T = Math.round((e.readFrom + f * (e.readTo - e.readFrom)) * 100) / 100;
      if (!byT.has(T)) byT.set(T, []);
      byT.get(T).push({ key: e.ckey, kind: e.kind, text: e.text });
    }
  });
  const Ts = [...byT.keys()].sort((a, b) => a - b), res = new Map(), t0 = performance.now(), per = Math.ceil(Ts.length / pages.length);
  console.error(`对比度：${tgt.length} 条、${Ts.length} 帧 × 4 遍`);
  let done = 0, lastLog = 0;
  await Promise.all(pages.map(async (ev, j) => {
    for (const T of Ts.slice(j * per, (j + 1) * per)) {
      const r = await ev(`__ctr(${T}, ${JSON.stringify(byT.get(T))})`);
      for (const k in r) { if (!res.has(k)) res.set(k, []); res.get(k).push({ T, ...(r[k] || { n: 0 }) }); }
      if (++done && performance.now() - lastLog > 15000) { lastLog = performance.now(); console.error(`  对比度 ${done}/${Ts.length}  ${((performance.now() - t0) / 1000).toFixed(0)}s`); }
    }
  }));
  console.error(`对比度完成 ${((performance.now() - t0) / 1000).toFixed(0)}s`);
  return tgt.map((e) => {
    const ms = (res.get(e.ckey) || []).sort((a, b) => a.T - b.T), ok = ms.filter((m) => m.n > 20);
    const worst = ok.reduce((a, m) => !a || m.c20 < a.c20 ? m : a, null);
    const box = worst ? worst.box : null, cx = box ? (box[0] + box[2]) / 2 : null, vert = box ? box[3] - box[1] > (box[2] - box[0]) * 1.5 : false;
    const pos = cx == null ? '?' : cx < 1920 / 3 ? '左' : cx > 1920 * 2 / 3 ? '右' : '中', edge = cx != null && (cx < 1920 * .15 || cx > 1920 * .85);
    const flips = ok.length > 1 && ok.some((m) => (m.light > .5) !== (ok[0].light > .5));
    return { kind: e.kind, text: e.text, act: e.act, t: e.t, appear: e.appear, readFrom: e.readFrom, readTo: e.readTo, pos, edge, vert, flips, swap: e.swap,
      c20: worst ? worst.c20 : null, c50: worst ? worst.c50 : null, worstT: worst ? worst.T : null, ty: worst ? worst.ty : null, by: worst ? worst.by : null, box,
      low: !worst || worst.c20 < CTR_MIN, samples: ms.map((m) => ({ T: m.T, n: m.n, c20: m.c20, c50: m.c50, light: m.light })) };
  });
}
function ctrReport(o, S, C) {
  const A = S.acts, L = [], q = (e) => `${KIND_ZH[e.kind] || e.kind}「${e.text.replace(/\n/g, '⏎')}」`;
  const at = (e) => `${e.act} +${e.t.toFixed(1)}s｜${e.appear.toFixed(1)}`, mm = (T) => { const m = Math.floor(T / 60); return `${m}:${(T - m * 60).toFixed(1).padStart(4, '0')}`; };
  const low = C.filter((e) => e.low), side = C.filter((e) => e.edge && e.vert);
  const line = (e) => `  [${at(e)}｜${mm(e.appear)}] ${q(e)} ${e.pos}${e.edge ? '·边' : ''}${e.vert ? '·竖' : ''}  C20 ${e.c20 == null ? '—' : e.c20.toFixed(2)}  C50 ${e.c50 == null ? '—' : e.c50.toFixed(2)}` +
    (e.ty != null ? `  字亮度 ${e.ty.toFixed(2)} / 底 ${e.by.toFixed(2)}` : '') + (e.worstT != null ? `  最差 @${e.worstT.toFixed(2)}` : '') + (e.flips ? '  ⚠三帧深浅不一' : '') +
    (e.swap && e.swap.length ? `  换深浅 ${e.swap.length} 次 @${e.swap.slice(0, 4).map((x) => x.toFixed(1)).join(',')}${e.swap.length > 4 ? '…' : ''}` : '');
  L.push(`text-contrast ${o.act === undefined ? '全片' : `--act ${o.act}（${A[o.act].id} ${A[o.act].name}）`}  ${S.lo.toFixed(1)}–${S.hi.toFixed(1)}s  ${new Date().toISOString()}`);
  L.push(`指标：字芯像素（白/黑两遍得覆盖度 ≥ max(.3,.8×峰值)）逐像素 WCAG 对比比 vs 字形与描边都不画的同帧；C20＝20 分位，取完整可读区间 20/50/80% 三帧最差；阈值 C20 ≥ ${CTR_MIN}。`);
  L.push(`条目 ${C.length}：低对比 ${low.length}（其中两侧竖排 ${low.filter((e) => e.edge && e.vert).length}）；三帧深浅不一 ${C.filter((e) => e.flips).length}；显示中自动换深浅的条目 ${C.filter((e) => e.swap && e.swap.length).length}（共 ${C.reduce((n, e) => n + (e.swap ? e.swap.length : 0), 0)} 次）`);
  L.push('', `== 低对比（C20 < ${CTR_MIN}，${low.length}）==`);
  low.forEach((e) => L.push(line(e)));
  L.push('', `== 两侧竖排（x<.15W 或 >.85W，${side.length}）==`);
  side.forEach((e) => L.push((e.low ? ' ✘' : ' ✔') + line(e).slice(1)));
  L.push('', '== 全部 ==');
  C.forEach((e) => L.push((e.low ? ' ✘' : ' ✔') + line(e).slice(1)));
  return L.join('\n') + '\n';
}

/* ---------- 跨镜：硬切与拍界 ---------- */
const CUT = { hard: 14, ratio: 4, add: 4, persist: .55, beatD: 10, beatRatio: 2, beatAdd: 3, tol: .3 };
function findCuts(S, step) {
  const F = S.frames.filter((f) => f.th), n = F.length;
  if (!n) return { cuts: [], bounds: [] };
  const TW = 64, TH = 36, sx = TW / 1920, sy = TH / 1080, ROWS = Math.floor(TH * .72);
  F.forEach((f) => {
    f.Y = Uint8Array.from(Buffer.from(f.th, 'base64'));
    const m = new Uint8Array(TW * TH);                       // 1 = 参与比较；下 28% 与文字框（外扩 50px）不比
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < TW; x++) m[y * TW + x] = 1;
    for (const r of f.recs || []) if (r.box) {
      const x0 = Math.max(0, Math.floor((r.box[0] - 50) * sx)), x1 = Math.min(TW, Math.ceil((r.box[2] + 50) * sx)), y0 = Math.max(0, Math.floor((r.box[1] - 50) * sy)), y1 = Math.min(TH, Math.ceil((r.box[3] + 50) * sy));
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m[y * TW + x] = 0;
    }
    f.M = m; delete f.th;
  });
  const diff = (a, b) => { let s = 0, c = 0; const A = F[a], B = F[b]; for (let k = 0; k < A.Y.length; k++) if (A.M[k] && B.M[k]) { s += Math.abs(A.Y[k] - B.Y[k]); c++; } return c > 100 ? s / c : 0; };
  const idx = (T) => { let lo = 0, hi = n - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (F[m].T < T - 1e-6) lo = m + 1; else hi = m; } return lo; };
  const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
  const actAt = (T) => { const i = S.acts.findIndex((a) => T >= a.start && T < a.end); return S.acts[i < 0 ? S.acts.length - 1 : i]; };
  const d = new Float32Array(n);
  for (let i = 1; i < n; i++) d[i] = Math.abs(F[i].T - F[i - 1].T - step) < 1e-3 ? diff(i - 1, i) : 0;
  const cuts = [];
  for (let i = 1; i < n; i++) {
    if (d[i] < CUT.hard) continue;
    const nb = [];
    for (let j = Math.max(1, i - 12); j <= Math.min(n - 1, i + 12); j++) if (Math.abs(j - i) > 1) nb.push(d[j]);
    if (d[i] < CUT.ratio * med(nb) + CUT.add || d[i] < d[i - 1] || (i + 1 < n && d[i] < d[i + 1])) continue;
    const pj = Math.min(n - 1, i + 3), pd = diff(i - 1, pj);
    if (pd < CUT.persist * d[i] || pd < CUT.hard * .7) continue;  // 闪白/闪黑后回原样，不是切
    const T = F[i].T, a = actAt(T);
    cuts.push({ T, d: Math.round(d[i]), type: '硬切', act: a.id, t: Math.round((T - a.start) * 10) / 10 });
  }
  const bset = new Map();
  for (const b of S.beats || []) if (b.t > S.lo + .5 && b.t < S.hi - .5) bset.set(Math.round(b.t * 100) / 100, b);
  for (const a of S.acts) if (a.start > S.lo + .5 && a.start < S.hi - .5 && !bset.has(Math.round(a.start * 100) / 100)) bset.set(Math.round(a.start * 100) / 100, { id: a.id + '.(幕界)', t: a.start, label: '' });
  const bounds = [];
  for (const [Tb, b] of [...bset.entries()].sort((p, q) => p[0] - q[0])) {
    const a = actAt(Tb), e = { T: Tb, beat: b.id, label: b.label || '', act: a.id, t: Math.round((Tb - a.start) * 10) / 10 };
    const hc = cuts.find((c) => Math.abs(c.T - Tb) <= .4);
    if (hc) { hc.beat = b.id; e.type = '拍界·硬切'; e.cut = hc; bounds.push(e); continue; }
    const D = diff(idx(Tb - .5), idx(Tb + .5)), base = med([[Tb - 2.6, Tb - 1.6], [Tb - 1.6, Tb - .6], [Tb + .6, Tb + 1.6], [Tb + 1.6, Tb + 2.6]].map((p) => diff(idx(p[0]), idx(p[1]))));
    e.D = Math.round(D); e.base = Math.round(base);
    e.type = D >= CUT.beatD && D >= CUT.beatRatio * base + CUT.beatAdd ? '拍界·换景' : '拍界·同镜';
    bounds.push(e);
  }
  return { cuts, bounds };
}
function judgeCuts(E, K) {
  const list = K.cuts.map((c) => ({ T: c.T, type: c.beat ? '拍界·硬切' : '硬切', beat: c.beat || '', act: c.act, t: c.t, d: c.d }))
    .concat(K.bounds.filter((b) => b.type === '拍界·换景').map((b) => ({ T: b.T, type: b.type, beat: b.beat, act: b.act, t: b.t, d: b.D })));
  list.sort((a, b) => a.T - b.T);
  const V = [], span = [];
  for (const e of E.filter((x) => x.reading)) for (const c of list) {
    if (!(e.appear + CUT.tol < c.T && e.gone - CUT.tol > c.T)) continue;
    const v = { e, c, before: r1(c.T - e.appear), after: r1(e.gone - c.T) };
    v.over = Math.min(v.before, v.after);
    (e.span ? span : V).push(v);
  }
  return { list, V, span };
}
function cutReport(o, S, K, CJ) {
  const A = S.acts, L = [], q = (e) => `${KIND_ZH[e.kind] || e.kind}「${e.text.replace(/\n/g, '⏎')}」`;
  const mm = (T) => { const m = Math.floor(T / 60); return `${m}:${(T - m * 60).toFixed(1).padStart(4, '0')}`; };
  L.push(`sub-lint 跨镜 ${o.act === undefined ? '全片' : `--act ${o.act}（${A[o.act].id} ${A[o.act].name}）`}  ${S.lo.toFixed(1)}–${S.hi.toFixed(1)}s  step ${o.step}s  ${new Date().toISOString()}`);
  L.push(`判定：阅读字幕显示区间（出现→消失）跨过镜头边界、边界两侧都超出 ${CUT.tol}s 即违规；「超出」＝较短一侧的秒数（字幕伸进另一镜的那段）。span:true 豁免。`);
  L.push(`边界：硬切（缩略图相邻帧突变且不回原样）＋拍界（__cine.beats/幕界；±.5s 两帧差 ≥${CUT.beatD} 且 ≥ 基线×${CUT.beatRatio}+${CUT.beatAdd} 记换景，否则同镜延伸豁免）。`);
  const byAct = {};
  CJ.V.forEach((v) => { byAct[v.e.act] = (byAct[v.e.act] || 0) + 1; });
  L.push(`边界 ${CJ.list.length}（硬切 ${K.cuts.length}，其中落在拍界 ${K.cuts.filter((c) => c.beat).length}；换景拍界 ${K.bounds.filter((b) => b.type === '拍界·换景').length}；同镜拍界 ${K.bounds.filter((b) => b.type === '拍界·同镜').length} 豁免）`);
  L.push(`跨镜违规 ${CJ.V.length}：` + (A.map((a) => byAct[a.id] ? `${a.id} ${byAct[a.id]}` : null).filter(Boolean).join(' · ') || '无') + `　｜　span:true 豁免 ${CJ.span.length}`);
  L.push('', `== 跨镜违规（${CJ.V.length}）==`);
  CJ.V.forEach((v) => L.push(`  [${v.e.act} +${v.e.t.toFixed(1)}s｜${v.e.appear.toFixed(1)}｜${mm(v.e.appear)}] ${q(v.e)} 显示 ${v.e.appear.toFixed(1)}→${v.e.gone.toFixed(1)}  跨 ${v.c.type} ${v.c.T.toFixed(1)}（${v.c.act} +${v.c.t.toFixed(1)}s${v.c.beat ? ' ' + v.c.beat : ''}）  前 ${v.before.toFixed(1)}s / 后 ${v.after.toFixed(1)}s  超出 ${v.over.toFixed(1)}s`));
  if (CJ.span.length) { L.push('', `== span:true 豁免（${CJ.span.length}）==`); CJ.span.forEach((v) => L.push(`  [${v.e.act} +${v.e.t.toFixed(1)}s] ${q(v.e)} 跨 ${v.c.type} ${v.c.T.toFixed(1)}`)); }
  L.push('', '== 全部边界 ==');
  const all = K.cuts.filter((c) => !c.beat).map((c) => ({ T: c.T, s: `硬切　　　 ${c.act} +${c.t.toFixed(1)}s  差 ${c.d}` }))
    .concat(K.bounds.map((b) => ({ T: b.T, s: `${b.type} ${b.act} +${b.t.toFixed(1)}s ${b.beat}${b.label ? '「' + b.label + '」' : ''}  ${b.cut ? '差 ' + b.cut.d : `±.5s 差 ${b.D} / 基线 ${b.base}`}` })));
  all.sort((a, b) => a.T - b.T).forEach((x) => L.push(`  ${x.T.toFixed(1).padStart(6)}｜${mm(x.T)}  ${x.s}`));
  return L.join('\n') + '\n';
}

/* ---------- 跟踪：逐帧记录 → 条目 ---------- */
const nChars = (s) => String(s).replace(/[\p{P}\p{S}\s]/gu, '').length;
const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;
function track(S, step) {
  const { acts, frames } = S, ents = [];
  const actAt = (T) => { const i = acts.findIndex((a) => T >= a.start && T < a.end); return i < 0 ? acts.length - 1 : i; };
  let open = new Map(), rawOpen = [];
  for (const f of frames) {
    const ai = actAt(f.T), act = acts[ai], nextOpen = new Map(), nextRaw = [];
    for (const r of f.recs || []) {
      let e;
      if (r.kind === 'raw') {
        e = rawOpen.find((q) => !nextRaw.includes(q) && q.act === act.id && Math.abs(q.size - r.size) < 2 && Math.abs(q.y - r.y) < r.size * .6 && Math.abs(q.x - r.x) < r.size * 1.5 &&
          (q.last.startsWith(r.text) || r.text.startsWith(q.last)));
        if (!e) { e = { kind: act.id === 'recap' ? 'card' : 'raw', act: act.id, ai, x: r.x, y: r.y, size: r.size, samples: [] }; ents.push(e); }
        e.last = r.text; nextRaw.push(e);
      } else {
        const key = r.kind + '|' + r.text;
        e = open.get(key);
        if (!e) { e = { kind: r.kind, text: r.text, act: act.id, ai, samples: [] }; ents.push(e); }
        nextOpen.set(key, e);
      }
      e.samples.push({ T: f.T, any: r.any, full: r.full, text: r.text, dk: r.ctr ? r.ctr.dark : null });
      if (r.span) e.span = true;
    }
    open = nextOpen; rawOpen = nextRaw;
  }
  for (const e of ents) {
    const peak = Math.max(...e.samples.map((s) => s.any));
    if (e.kind === 'raw' || e.kind === 'card') e.text = e.samples.reduce((a, s) => s.text.length > a.length ? s.text : a, '');
    const vis = e.samples.filter((s) => s.any > STD.vis), full = e.samples.filter((s) => s.text === e.text && s.full >= STD.full * peak);
    e.peak = Math.round(peak * 100) / 100;
    e.appear = vis.length ? vis[0].T : e.samples[0].T;
    e.gone = r1((vis.length ? vis[vis.length - 1].T : e.samples[e.samples.length - 1].T) + step);
    e.readFrom = full.length ? full[0].T : null;
    e.readTo = full.length ? r1(full[full.length - 1].T + step) : null;
    e.cut0 = !!(S.cutLo && e.appear <= S.firstT + 1e-6);   // 开头被 --from 截掉：「出现」不是真出现，不判命中禁字
    e.edge = e.cut0 || (S.cutHi && e.gone - step >= S.lastT - 1e-6);   // 被 --from/--to 截断的条目不判停留（幕界本身就是真实的出入）
    e.swap = [];                                             // 自动对比在本条显示期间换深浅的时刻（看是否闪）
    for (let k = 1; k < e.samples.length; k++) if (e.samples[k].dk != null && e.samples[k - 1].dk != null && e.samples[k].dk !== e.samples[k - 1].dk) e.swap.push(e.samples[k].T);
    delete e.samples; delete e.last;
  }
  /* 前情字卡：时间重叠的行并成一卡（文字以「／」相接；可读区间取各行交集） */
  const cards = ents.filter((e) => e.kind === 'card').sort((a, b) => a.appear - b.appear), merged = [];
  for (const e of cards) {
    const m = merged[merged.length - 1];
    if (m && e.appear < m.gone) {
      m.text += '／' + e.text; m.gone = Math.max(m.gone, e.gone); m.edge = m.edge || e.edge;
      m.readFrom = m.readFrom == null || e.readFrom == null ? null : Math.max(m.readFrom, e.readFrom);
      m.readTo = m.readTo == null || e.readTo == null ? null : Math.min(m.readTo, e.readTo);
    } else merged.push({ ...e });
  }
  const out = ents.filter((e) => e.kind !== 'card').concat(merged).sort((a, b) => a.appear - b.appear || a.gone - b.gone);
  for (const e of out) {
    const a = acts[e.ai];
    e.t = r1(e.appear - a.start); e.n = nChars(e.text);
    if (e.kind === 'raw' && e.n <= 4) e.kind = 'label';         // 幕内自画的 ≤4 字短标（如尾声三格名＝账本题签 T120）按题签算，不计阅读量
    e.layer = READ[e.kind] || null; e.reading = !!e.layer;
    e.hold = e.readFrom == null || e.readTo == null || e.readTo <= e.readFrom ? 0 : r1(e.readTo - e.readFrom);
    e.need = e.kind === 'card' ? r1(e.n / STD.cardPerChar + STD.cardBase) : e.reading ? r1(Math.max(STD.minHold, e.n / STD.perChar + STD.base)) : null;
    if (e.reading && !e.edge && e.hold + 1e-6 < e.need) e.short = true;
  }
  return out;
}

/* ---------- 纸面模式：账本 → 推算条目 ----------
   解析同 build-ledger.py。出字/淡出一律照引擎实际画法（协调者 10-21 裁定；extra() 与 lib-text.js 不一致处以 lib-text.js 为准）：
   按 js/lib-text.js 各样式与 engine.js I.nameTag 的代码逐字算不透明度，再用与页面模式 track() 相同的量法（any>.02＝出现/消失；
   全部字已出且最淡一字 ≥ .9×峰值＝完整可读）按 .01s 取样。缺省参数照 I.ledger 的调用（不传 fo/hold/fadeIn）；幕文件 pos 里的覆盖（如 hold）看不到。 */
const LEDGER_ACTS = [['冷开场', 'prologue'], ['前情', 'prologue'], ['序', 'prologue'], ['第一幕', 'act1'], ['第二幕', 'act2'], ['第三幕', 'act3'], ['第四幕', 'act4'], ['第五幕', 'act5'], ['尾', 'coda'], ['尾声', 'coda']];
const PAPER = {                                              // 账本类型 → [页面 kind, 层（题签 null＝自成一层）, 引擎样式]
  旁白: ['narr', 'band', 'narr'], 对白: ['line', 'band', 'line'], 台词: ['line', 'band', 'line'], 心念: ['thought', 'band', 'sub'], 画外音: ['voice', 'band', 'sub'], 署名: ['narr', 'band', 'narr'],
  心声: ['inner', 'top', 'inner'], 秘阵声: ['array', 'top', 'array'], 萤光点: ['mote', 'note', 'mote'], 传讯: ['slip', 'slip', 'slip'], 题注: ['note', 'note', 'note'], 诵: ['chant', 'vert', 'chant'],
  片名: ['big', 'big', 'big'], 大字: ['big', 'big', 'big'], 题签: ['tag', null, 'tag']
};
const TAG_HOLD = 2;                                          // I.ledger 画题签不传 hold：I.nameTag 缺省 2.0 → 起点+3.0 消失，不读账本退场
const FADE = .25;                                            // 1024：整句淡入淡出（lib-text CINE.SUB.fade）；v5 起只剩心念/画外音/传讯淡入用它，淡出全用它
const NARR_IN = .35, NARR_SHARP = .7, LINE_IN = .15, NAME_LEAD = .12, INNER_IN = .45;   // v5（TXT 第 5 条）：同 lib-text CINE.SUB.narrIn/narrSharp/lineIn/nameLead/innerIn，改一处要三处（lib-text、本表、ledger-retime EXTRA＝0.6 的余量）一起核
const clamp01 = (x) => x < 0 ? 0 : x > 1 ? 1 : x, smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); }, easeOut = (x) => { x = clamp01(x); return 1 - (1 - x) * (1 - x); };
function glyphIdx(text, group = true) {                      // 各字形在「去掉换行的文字」里的位置（连续省略号并成一个字形，同 lib-text glyphs）；空白不记（lint 不数空白 fillText）
  const idx = [];
  let i = 0;
  for (const g of text.replace(/\n/g, '').match(group ? /…+|[^]/g : /[^]/g) || []) { if (/\S/.test(g)) idx.push(i); i += g.length; }
  return { idx, len: i };
}
function frame(A, list, fade, t) {                           // 一帧的 lint 记录：A 整体不透明度，list [[起笔时刻, 振幅]]，每字 easeOut 淡入 fade 秒
  if (A <= .003) return null;
  let lo = 1, hi = 0, all = true;
  for (const [s, amp] of list) { const k = clamp01((t - s) / fade); if (k <= 0) { all = false; continue; } const a = A * amp * easeOut(k); if (a < lo) lo = a; if (a > hi) hi = a; }
  return hi > .003 ? { any: hi, full: all ? lo : 0 } : null;
}
const STYLE = {                                              // (文字, 起点 t0, 退场 t1) → { end 最晚可见, at(t) → {any, full} | null }
  sub: (s, t0, t1) => { const g = glyphIdx(s).idx.map(() => [t0, 1]); return { end: t1, at: (t) => t < t0 ? null : frame(1 - smooth((t - t1 + FADE) / FADE), g, FADE, t) }; },   // I.sub 心念/画外音：整句淡入 .25（easeOut）、fo .25
  narr: (s, t0, t1) => { const n = glyphIdx(s).idx.length;   // v5 I.sub 旁白/署名：淡入 .35（easeOut）×清晰度 (1−.7(1−e))（模糊副本不计）、fo .25
    return { end: t1, at: (t) => { if (t < t0 || !n) return null; const e = easeOut((t - t0) / NARR_IN), a = (1 - smooth((t - t1 + FADE) / FADE)) * e * (1 - NARR_SHARP * (1 - e)); return a > .003 ? { any: a, full: e > 0 ? a : 0 } : null; } }; },
  line: (s, t0, t1) => { const k = s.indexOf('\u3000'), G = glyphIdx(s).idx, g = G.map((i) => [k > 0 && i < k ? t0 : t0 + (k > 0 ? NAME_LEAD : 0), 1]);   // v5 I.sub 对白：说话人名 t0 起、正文晚 .12，各淡入 .15；fo .25
    return { end: t1, at: (t) => t < t0 ? null : frame(1 - smooth((t - t1 + FADE) / FADE), g, LINE_IN, t) }; },
  inner: (s, t0, t1) => { const g = glyphIdx(s.replace(/[「」『』“”"]/g, '')).idx.map(() => [t0, 1]);   // I.inner（v5）：整句淡入 .45（上浮 12px，不改透明度）、fo .25
    return { end: t1, at: (t) => t < t0 ? null : frame(1 - smooth((t - t1 + FADE) / FADE), g, INNER_IN, t) }; },
  array: (s, t0, t1) => { const g = glyphIdx(s).idx.map((i) => [t0 + i / 22, 1]); return { end: t1, at: (t) => t < t0 ? null : frame(1 - smooth((t - t1 + .5) / .5), g, .3, t) }; },   // I.arrayVoice
  mote: (s, t0, t1) => { const g = glyphIdx(s).idx.map((i) => [t0 + i * .045, 1]); return { end: t1, at: (t) => t < t0 ? null : frame(.85 * (1 - smooth((t - t1 + .8) / .8)), g, .9, t) }; },   // I.moteText
  slip: (s, t0, t1) => { const g = glyphIdx(s, false).idx.map(() => [t0, 1]);   // I.slip（1024）：柔边淡纸，整句淡入 .25、fo .25；字 ×.94
    return { end: t1, at: (t) => { if (t < t0 || t > t1) return null; return frame(.94 * (1 - smooth((t - t1 + FADE) / FADE)), g, FADE, t); } }; },
  note: (s, t0, t1) => { const g = glyphIdx(s).idx.map((i) => [t0 + i / 8, 1]);   // I.note：每字 1/8s、淡入 .35；末 .6s (1−k)^1.4
    return { end: t1, at: (t) => { if (t < t0 || t > t1) return null; return frame(.92 * Math.pow(1 - clamp01((t - t1 + .6) / .6), 1.4), g, .35, t); } }; },
  chant: (s, t0, t1) => { const g = glyphIdx(s).idx.map((i) => [t0 + i * .38, 1]); return { end: t1, at: (t) => t < t0 ? null : frame(1 - smooth((t - t1 + .5) / .5), g, .3, t) }; },   // I.chant
  tag: (s, t0) => {                                          // I.nameTag（修订 v2）：名字 .12s 内起笔、身份晚 .1s 在 .08s 内起笔，淡入 .2；停到 t0+.5+hold 后 .5s (1−k)^1.5 散去
    const [nm, rl = ''] = s.split(' · '), col = (str, st, sp, amp) => { const G = glyphIdx(str, false); return G.idx.map((i) => [st + (G.len > 1 ? i * sp / (G.len - 1) : 0), amp]); };
    const g = col(nm, t0, .12, .92).concat(col(rl, t0 + .1, .08, .86)), end = t0 + 1 + TAG_HOLD;
    return { end, at: (t) => { if (t < t0 || t > end) return null; const fa = Math.pow(1 - clamp01((t - t0 - .5 - TAG_HOLD) / .5), 1.5); return .92 * fa <= .003 ? null : frame(fa, g, .2, t); } };
  },
  big: (s, t0, t1) => {                                      // I.big：整句 1.2s 内逐字压出（每字 dur 线性），out [t1−.5, t1] 淡出；lint 量 full＝A×最小进度、any＝A×最大进度
    const n = [...s.replace(/\n/g, '')].length, dur = Math.min(.42, Math.max(.16, 1.2 / Math.max(1, n) * 1.6)), ts = Array.from({ length: n }, (_, i) => t0 + (n > 1 ? i * (1.2 - dur) / (n - 1) : 0));
    return { end: t1, at: (t) => { if (t < t0 - 1e-6) return null; const A = 1 - smooth((t - t1 + .5) / .5); if (A <= .003) return null; const ks = ts.map((x) => clamp01((t - x) / dur)); const hi = A * Math.max(...ks); return hi > .003 ? { any: hi, full: A * Math.min(...ks) } : null; } };
  }
};
function simulate(st, t0) {                                  // 同 track()：.01s 取样，出现＝首个 any>.02，消失＝末个 +dt，可读＝full ≥ .9×峰值
  const dt = .01, S = [];
  for (let k = 0; ; k++) { const T = Math.round((t0 + k * dt) * 1e4) / 1e4; if (T > st.end + dt) break; const r = st.at(T); if (r) S.push({ T, ...r }); }
  if (!S.length) return null;
  const peak = Math.max(...S.map((s) => s.any)), vis = S.filter((s) => s.any > STD.vis), full = S.filter((s) => s.full >= STD.full * peak), V = vis.length ? vis : S;
  return { appear: r2(V[0].T), gone: r2(V[V.length - 1].T + dt), readFrom: full.length ? r2(full[0].T) : null, readTo: full.length ? r2(full[full.length - 1].T + dt) : null, peak: r2(peak) };
}
function paperTrack(file) {
  let src;
  try { src = fs.readFileSync(file, 'utf8'); } catch (e) { die(`读不了账本 ${file}：${e.message}`); }
  const ents = [], acts = [], skip = { del: 0, noAct: 0, kinds: {} };
  let act = null;
  for (const line of src.split('\n')) {
    if (line.startsWith('## ')) {
      const h = line.slice(3).trim(), hit = LEDGER_ACTS.find(([k]) => h.startsWith(k));
      act = hit ? hit[1] : null;
      if (act && !acts.some((a) => a.id === act)) acts.push({ id: act, name: h, start: null });
      continue;
    }
    if (!/^\|\s*[TW]\d{3}\s*\|/.test(line)) continue;
    if (!act) { skip.noAct++; continue; }
    const c = line.trim().replace(/^\|+|\|+$/g, '').split('|').map((x) => x.trim());
    if (c.length > 12 && c[12].includes('建议删')) { skip.del++; continue; }
    const [id, beat, t, G, kind, text0, , , , out] = c, P = PAPER[kind];
    const who = c[10] && !['—', '旁白'].includes(c[10]) ? c[10] : '';
    const text = (kind === '对白' || kind === '台词') && who ? who + '\u3000' + text0 : text0;   // 1024：对白句首冠名（同 I.ledger），人名计入字数
    if (!P || out === '常驻') { skip.kinds[kind] = (skip.kinds[kind] || 0) + 1; continue; }
    const tt = Number(t), g = Number(G), ot = Number(out);
    if (![tt, g].every(Number.isFinite) || (P[2] !== 'tag' && !Number.isFinite(ot))) die(`账本 ${id}：幕内秒「${t}」全片秒「${G}」退场「${out}」读不成数字`);
    const A = acts.find((a) => a.id === act);
    if (A.start == null) A.start = r2(g - tt);
    const m = simulate(STYLE[P[2]](text, g, g + ot - tt), g);
    if (!m) { skip.kinds[kind + '（画不出）'] = (skip.kinds[kind + '（画不出）'] || 0) + 1; continue; }
    ents.push({ id, beat, kind: P[0], text, act, t: tt, ...m, n: nChars(text), layer: P[1], edge: false });
  }
  if (!ents.length) die(`账本 ${file} 里没读到条目（要「## 第…幕」等标题行下的「| W123 |」行）`);
  const A = acts.filter((a) => a.start != null).sort((a, b) => a.start - b.start), end = Math.max(...ents.map((e) => e.gone));
  A.forEach((a, i) => { a.end = i + 1 < A.length ? A[i + 1].start : end; });
  for (const e of ents) {
    e.ai = A.findIndex((a) => a.id === e.act);
    e.reading = !!e.layer;
    e.hold = e.readTo > e.readFrom ? r2(e.readTo - e.readFrom) : 0;
    e.need = e.reading ? r2(Math.max(STD.minHold, e.n / STD.perChar + STD.base)) : null;   // 纸面不按 .1s 采样，需时不进位（页面模式进位到 .1 与采样等价）
    if (e.reading && e.hold + 1e-6 < e.need) e.short = true;
  }
  ents.sort((a, b) => a.appear - b.appear || a.gone - b.gone);
  return { E: ents, acts: A, skip, lo: Math.min(0, ...ents.map((e) => e.appear)), hi: end };
}

/* ---------- 判定 ---------- */
/* 12 秒窗口：以每条的出现时刻为窗口起点，超标窗口连成段；list 跨幕连续（不分幕） */
function windows(list) {
  const out = [];
  let cl = null;
  list.forEach((e) => {
    const inW = list.filter((q) => q.appear >= e.appear - 1e-6 && q.appear < e.appear + STD.win - 1e-6), n = inW.reduce((s, q) => s + q.n, 0);
    if (n <= STD.winMax) return;
    const w = { from: e.appear, to: r1(e.appear + STD.win), n, items: inW };
    if (cl && w.from < cl.to) { cl.to = w.to; if (n > cl.max.n) cl.max = w; } else { cl = { from: w.from, to: w.to, max: w }; out.push(cl); }
  });
  return out;
}
function judge(E, X = {}) {
  const R = E.filter((e) => e.reading), V = { dwell: [], gap: [], density: [], tagDwell: [], densityTag: [], cross: [], hits: [] }, coscreen = [], tagScreen = [];
  R.forEach((e) => { if (e.short) V.dwell.push(e); });
  R.forEach((e, i) => {
    let lastGone = -Infinity, prev = null;
    for (let j = 0; j < i; j++) {
      const p = R[j];
      if (p.gone > e.appear + 1e-6) {                        // 重叠
        if (p.layer === e.layer) V.gap.push({ a: p, b: e, gap: r2(e.appear - p.gone), overlap: true });
        else coscreen.push({ a: p, b: e, from: e.appear, to: Math.min(p.gone, e.gone) });
      } else if (p.gone > lastGone) { lastGone = p.gone; prev = p; }
    }
    if (prev && e.appear - lastGone < STD.gap - 1e-6) V.gap.push({ a: prev, b: e, gap: r2(e.appear - lastGone), overlap: false });
  });
  V.density = windows(R);                                    // 旧口径（不含题签），照报供对照
  E.filter((e) => e.kind === 'tag' || e.kind === 'title' || e.kind === 'label').forEach((g) => R.forEach((e) => {
    const a = Math.max(g.appear, e.appear), b = Math.min(g.gone, e.gone);
    if (b - a > 1e-6) tagScreen.push({ tag: g, text: e, from: r1(a), to: r1(b) });
  }));
  /* ---- 第①期新增：题签停留、密度（含题签）、跨层重叠、命中禁字 ---- */
  const T = E.filter((e) => e.kind === 'tag'), RT = R.concat(T).sort((a, b) => a.appear - b.appear || a.gone - b.gone);
  T.forEach((g) => { g.need = STD.tagHold; g.tagShort = !g.edge && g.hold + 1e-6 < STD.tagHold; if (g.tagShort) V.tagDwell.push(g); });
  V.densityTag = windows(RT);
  const allow = X.allow || [], crossOk = [], layerOf = (e) => e.kind === 'tag' ? 'tag' : e.layer;
  RT.forEach((b, j) => {
    for (let i = 0; i < j; i++) {
      const a = RT[i];
      if (layerOf(a) === layerOf(b) || a.readFrom == null || b.readFrom == null) continue;
      const from = Math.max(a.readFrom, b.readFrom), to = Math.min(a.readTo, b.readTo);
      if (to - from <= 1e-6) continue;
      const free = [a, b].some((e) => e.kind === 'tag' && e.n <= STD.tagFree), ok = free ? null : allow.find((s) => a.text.includes(s) || b.text.includes(s));
      const why = free ? `≤${STD.tagFree}字题签` : ok ? `白名单「${ok}」` : undefined;
      (why ? crossOk : V.cross).push({ a, b, from: r2(from), to: r2(to), over: r2(to - from), why });
    }
  });
  for (const e of RT) {
    if (e.cut0) continue;
    for (const h of X.hits || []) if (!(h.allow || []).some((x) => e.text.includes(x)) && e.appear >= h.T - h.pre - 1e-6 && e.appear <= h.T + h.post + 1e-6) V.hits.push({ e, h, d: r2(e.appear - h.T) });
  }
  return { V, coscreen, tagScreen, crossOk };
}

/* ---------- 报告 ---------- */
const LAYER_ZH = { band: '底部带', top: '上方', vert: '竖排', note: '题注层', big: '大字', card: '字卡', raw: '自画字', slip: '传讯', tag: '题签' };
function report(o, S, E, J) {
  const A = S.acts, paper = !!o.ledger, f = (x) => x.toFixed(paper ? 2 : 1), at = (e) => `${e.id ? e.id + ' ' : ''}${e.act} +${e.t.toFixed(1)}s｜${e.appear.toFixed(1)}`;
  const q = (e) => `${KIND_ZH[e.kind] || e.kind}「${e.text.replace(/\n/g, '⏎')}」`, ly = (e) => `〔${LAYER_ZH[e.kind === 'tag' ? 'tag' : e.layer] || e.layer}〕`;
  const loc = (T) => { const i = A.findIndex((a) => T >= a.start && T < a.end), a = A[i < 0 ? A.length - 1 : i]; return `${a.id} +${(T - a.start).toFixed(1)}s`; };
  const L = [], R = E.filter((e) => e.reading), { V } = J;
  if (paper) L.push(`sub-lint 【纸面推算，非实测】 账本 ${path.relative(process.cwd(), path.resolve(o.ledger))}  ${S.lo.toFixed(1)}–${S.hi.toFixed(1)}s  ${new Date().toISOString()}`);
  else L.push(`sub-lint ${o.act === undefined ? '全片' : `--act ${o.act}（${A[o.act].id} ${A[o.act].name}）`}  ${S.lo.toFixed(1)}–${S.hi.toFixed(1)}s  step ${o.step}s  ${new Date().toISOString()}`);
  L.push(`标准（NEWCOMER-DECISIONS §6）：阅读字幕完整可读 ≥ max(${STD.minHold}, 字数÷${STD.perChar}+${STD.base})s；前情字卡 ≥ 字数÷${STD.cardPerChar}+${STD.cardBase}s；相邻间隔 ≥ ${STD.gap}s；任意 ${STD.win}s 出现字数 ≤ ${STD.winMax}。`);
  L.push(`第①期新增：题签完整可读 ≥ ${STD.tagHold.toFixed(1)}s；${STD.win}s 窗口含题签字数（全片连续，不在幕界清零）；不同层「完整可读」不重叠（≤${STD.tagFree} 字题签、白名单 ${J.allowN} 段豁免）；命中点 [T−pre, T+post] 内不出新字（${J.hitN == null ? '未给 --hits，不判' : `命中点 ${J.hitN} 个`}）。`);
  if (paper) {
    L.push(`推算：起点＝全片秒、退场＝全片秒＋退场−幕内秒（题签固定起点+3.0）；按 lib-text.js / I.nameTag 的逐字不透明度、用页面同一量法 .01s 取样得出现、完整可读、消失。幕文件 pos 覆盖不计。`);
    const k = Object.entries(S.skip.kinds).map(([a, n]) => `${a} ${n}`).join('、');
    L.push(`跳过：备注含「建议删」${S.skip.del} 条` + (k ? `；不推算的类型/常驻 ${k}` : '') + (S.skip.noAct ? `；不在任何幕标题下 ${S.skip.noAct} 条（⚠ 标题行没认出）` : ''));
  } else L.push(`时刻写法：幕id +幕内秒｜全片秒；停留按 ${o.step}s 采样，误差约 ±${o.step}s。「可读」＝全部字已出且不透明度 ≥ ${STD.full}×峰值。`);
  const cnt = (k) => E.filter((e) => e.kind === k).length;
  L.push(`条目 ${E.length}：阅读 ${R.length}（字卡 ${cnt('card')}、自画字 ${cnt('raw')}）· 题签 ${cnt('tag')} · 自画标 ${cnt('label')} · 幕名 ${cnt('title')}`);
  L.push(`违规：停留 ${V.dwell.length} · 间隔 ${V.gap.length}（其中同层重叠 ${V.gap.filter((g) => g.overlap).length}）· 密度 ${V.density.length} 段${J.cuts ? ` · 跨镜 ${J.cuts.V.length}（清单 ${path.relative(process.cwd(), o.cutOut)}.txt）` : ''}　｜　同屏双层 ${J.coscreen.length} · 题签/幕名与阅读字幕同屏 ${J.tagScreen.length}`);
  L.push(`新增违规：题签停留 ${V.tagDwell.length} · 密度（含题签）${V.densityTag.length} 段 · 跨层重叠 ${V.cross.length}（豁免 ${J.crossOk.length}）· 命中禁字 ${V.hits.length}`);
  if (S.errors.length) L.push('页面报错：' + [...new Set(S.errors)].slice(0, 5).join(' | '));
  const dens = (c) => {
    L.push(`  超标区 ${loc(c.from)} – ${loc(c.to - .001)}（全片 ${c.from.toFixed(1)}–${c.to.toFixed(1)}）最多 ${c.max.n} 字：窗口 ${c.max.from.toFixed(1)}–${c.max.to.toFixed(1)}`);
    c.max.items.forEach((e) => L.push(`      ${e.appear.toFixed(1)} ${e.n}字 ${q(e)}`));
  };
  L.push('', `== 停留不足（${V.dwell.length}）==`);
  V.dwell.forEach((e) => L.push(`  [${at(e)}] ${q(e)} ${e.n}字 可读 ${f(e.hold)}s < 需 ${f(e.need)}s（出现 ${e.appear.toFixed(1)}→消失 ${e.gone.toFixed(1)}）`));
  L.push('', `== 间隔不足（${V.gap.length}）==`);
  V.gap.forEach((g) => L.push(`  [${at(g.b)}] ${q(g.a)} → ${q(g.b)}  ${g.overlap ? `同层重叠 ${f(-g.gap)}s` : `间隔 ${f(g.gap)}s`}`));
  L.push('', `== 密度超标（旧口径，不含题签，${V.density.length} 段）==`);
  V.density.forEach(dens);
  L.push('', `== 题签停留不足（< ${STD.tagHold.toFixed(1)}s，${V.tagDwell.length}）==`);
  V.tagDwell.forEach((e) => L.push(`  [${at(e)}] ${q(e)} ${e.n}字 可读 ${f(e.hold)}s < 需 ${STD.tagHold.toFixed(1)}s（出现 ${e.appear.toFixed(1)}→消失 ${e.gone.toFixed(1)}）`));
  L.push('', `== 密度超标（含题签，${V.densityTag.length} 段）==`);
  V.densityTag.forEach(dens);
  L.push('', `== 跨层重叠（完整可读区间重叠，${V.cross.length}）==`);
  V.cross.forEach((c) => L.push(`  [${loc(c.from)}｜${f(c.from)}–${f(c.to)}] ${q(c.a)}${ly(c.a)} ＋ ${q(c.b)}${ly(c.b)}  重叠 ${f(c.over)}s`));
  L.push('', `== 跨层重叠豁免（不算违规，${J.crossOk.length}）==`);
  J.crossOk.forEach((c) => L.push(`  [${loc(c.from)}｜${f(c.from)}–${f(c.to)}] ${q(c.a)}${ly(c.a)} ＋ ${q(c.b)}${ly(c.b)}  重叠 ${f(c.over)}s  ${c.why}`));
  L.push('', `== 命中禁字（${J.hitN == null ? '未给 --hits，不判' : V.hits.length}）==`);
  V.hits.forEach((v) => L.push(`  [${at(v.e)}] ${q(v.e)} 出现 ${f(v.e.appear)} 落在命中 ${v.h.beat}${v.h.label ? '「' + v.h.label + '」' : ''} ${v.h.T.toFixed(1)}（−${v.h.pre}/+${v.h.post}）内，距命中 ${v.d >= 0 ? '+' : ''}${f(v.d)}s`));
  L.push('', `== 同屏双层（不算违规，${J.coscreen.length}）==`);
  J.coscreen.forEach((c) => L.push(`  [${loc(c.from)}｜${c.from.toFixed(1)}–${c.to.toFixed(1)}] ${q(c.a)} ＋ ${q(c.b)}`));
  L.push('', `== 题签/幕名与阅读字幕同屏（不算违规，${J.tagScreen.length}）==`);
  J.tagScreen.forEach((c) => L.push(`  [${loc(c.from)}｜${c.from.toFixed(1)}–${c.to.toFixed(1)}] ${q(c.tag)} ＋ ${q(c.text)}`));
  L.push('', '== 全部条目（按出现时刻）==');
  E.forEach((e) => {
    const tag = e.kind === 'tag', mark = !e.reading && !tag ? '  ·' : e.edge ? ' 截' : e.short || e.tagShort ? ' ✘' : ' ✔';
    L.push(`${mark} [${at(e)}] ${(KIND_ZH[e.kind] || e.kind).padEnd(4, '　')} ${String(e.n).padStart(2)}字 ${e.appear.toFixed(1)}→${e.gone.toFixed(1)}` +
      (e.reading || tag ? ` 可读 ${f(e.hold)}/${f(e.need)}s` : '') + `  「${e.text.replace(/\n/g, '⏎')}」`);
  });
  return L.join('\n') + '\n';
}

function loadHits(f) {
  let L;
  try { L = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { die(`--hits 读不了 ${f}：${e.message}`); }
  if (!Array.isArray(L)) die(`--hits ${f} 须是数组 [{"T":秒,"beat":…,"label":…,"pre":1.5,"post":1.5}]`);
  return L.map((h, i) => {
    if (!h || !Number.isFinite(h.T)) die(`--hits 第 ${i + 1} 项缺数字 T（全片秒）`);
    return { T: h.T, beat: h.beat || '', label: h.label || '', pre: Number.isFinite(h.pre) ? h.pre : STD.hitPad, post: Number.isFinite(h.post) ? h.post : STD.hitPost, allow: Array.isArray(h.allow) ? h.allow : [] };
  });
}
function loadAllow(f) {
  try { return fs.readFileSync(f, 'utf8').split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('#')); } catch (e) { die(`--coscreen-allow 读不了 ${f}：${e.message}`); }
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const X = { hits: o.hits ? loadHits(o.hits) : null, allow: o.allow ? loadAllow(o.allow) : [] };
  let S, E;
  if (o.ledger) { const P = paperTrack(o.ledger); E = P.E; S = { acts: P.acts, lo: P.lo, hi: P.hi, errors: [], skip: P.skip }; }
  else { S = await scan(o); E = track(S, o.step); }
  const J = judge(E, X);
  J.allowN = X.allow.length; J.hitN = X.hits ? X.hits.length : null;
  const K = o.cuts && !o.ledger ? findCuts(S, o.step) : null, CJ = K ? judgeCuts(E, K) : { list: [], V: [], span: [] };
  const slim = (e) => ({ id: e.id, kind: e.kind, text: e.text, act: e.act, t: e.t, appear: e.appear, gone: e.gone, readFrom: e.readFrom, readTo: e.readTo, hold: e.hold, need: e.need, n: e.n, peak: e.peak, edge: e.edge || undefined,
    ok: e.reading ? !e.short : e.kind === 'tag' ? !e.tagShort : undefined });
  const dens = (c) => ({ from: c.from, to: c.to, max: { from: c.max.from, to: c.max.to, n: c.max.n, items: c.max.items.map((e) => ({ appear: e.appear, n: e.n, kind: e.kind, text: e.text })) } });
  const pair = (c) => ({ from: c.from, to: c.to, over: c.over, why: c.why, a: slim(c.a), b: slim(c.b) });
  const json = {
    mode: o.ledger ? 'paper' : 'page', ledger: o.ledger ? path.resolve(o.ledger) : undefined, skip: S.skip,
    args: process.argv.slice(2), chrome: S.chrome, range: [S.lo, S.hi], step: o.ledger ? undefined : o.step, std: STD, errors: [...new Set(S.errors)], hits: X.hits || undefined, allow: X.allow,
    counts: { entries: E.length, dwell: J.V.dwell.length, gap: J.V.gap.length, density: J.V.density.length, cuts: CJ.V.length, coscreen: J.coscreen.length, tagScreen: J.tagScreen.length,
      tagDwell: J.V.tagDwell.length, densityTag: J.V.densityTag.length, cross: J.V.cross.length, crossExempt: J.crossOk.length, hits: J.V.hits.length },
    violations: {
      dwell: J.V.dwell.map(slim),
      gap: J.V.gap.map((g) => ({ gap: g.gap, overlap: g.overlap, a: slim(g.a), b: slim(g.b) })),
      density: J.V.density.map(dens),
      tagDwell: J.V.tagDwell.map(slim),
      densityTag: J.V.densityTag.map(dens),
      cross: J.V.cross.map(pair),
      hits: J.V.hits.map((v) => ({ d: v.d, hit: v.h, e: slim(v.e) }))
    },
    crossExempt: J.crossOk.map(pair),
    coscreen: J.coscreen.map((c) => ({ from: c.from, to: c.to, a: c.a.text, b: c.b.text })),
    tagScreen: J.tagScreen.map((c) => ({ from: c.from, to: c.to, tag: c.tag.text, text: c.text.text })),
    cuts: K ? { bounds: K.bounds.map((b) => { const { cut, ...r } = b; return r; }), hard: K.cuts, violations: CJ.V.map((v) => ({ text: v.e.text, kind: v.e.kind, act: v.e.act, appear: v.e.appear, gone: v.e.gone, cut: v.c.T, type: v.c.type, beat: v.c.beat, before: v.before, after: v.after, over: v.over })) } : undefined,
    entries: E.map(slim)
  };
  fs.mkdirSync(path.dirname(o.out), { recursive: true });
  fs.writeFileSync(o.out + '.json', JSON.stringify(json, null, 1));
  J.cuts = K ? CJ : null;
  const txt = report(o, S, E, J);
  fs.writeFileSync(o.out + '.txt', txt);
  if (!o.json) process.stdout.write(txt);
  console.error(`输出：${o.out}.txt / .json`);
  if (K) { fs.writeFileSync(o.cutOut + '.txt', cutReport(o, S, K, CJ)); console.error(`跨镜：违规 ${CJ.V.length} → ${o.cutOut}.txt`); }
  if (S.ctr) {
    fs.mkdirSync(path.dirname(o.ctrOut), { recursive: true });
    fs.writeFileSync(o.ctrOut + '.txt', ctrReport(o, S, S.ctr));
    fs.writeFileSync(o.ctrOut + '.json', JSON.stringify({ args: process.argv.slice(2), min: CTR_MIN, items: S.ctr }, null, 1));
    console.error(`对比度：低 ${S.ctr.filter((e) => e.low).length}/${S.ctr.length} → ${o.ctrOut}.txt`);
  }
  const V = J.V;
  process.exit(V.dwell.length + V.gap.length + V.density.length + CJ.V.length + V.tagDwell.length + V.densityTag.length + V.cross.length + V.hits.length ? 1 : 0);
}
main().catch((e) => { console.error('sub-lint 失败：' + (e && e.stack || e)); killChrome(); process.exit(2); });
