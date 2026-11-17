#!/usr/bin/env node
/* 《万古云霄》配乐 v2：从页面实时读幕表与 cue 表（无头 Chrome 打开 index.html?mute=1&shot=1，零 npm 依赖）。
   用法：node tools/music-cues.mjs [输出.json]   （缺省 tools/out/music-v2/cues.json）
   输出 { duration, acts:[{id,name,start,end,duration}], cues:[{id,act,name,t,T}] }，供 tools/music-render.mjs 定位乐谱。
   乐谱一律按「幕起点 + 幕内 cue」取点，幕长/插幕（如前情提要 recap）变了重跑本脚本再渲染即对齐。 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INDEX = pathToFileURL(path.resolve(HERE, '..', 'index.html')).href + '?mute=1&shot=1';
const OUT = path.resolve(process.argv[2] || path.join(HERE, 'out', 'music-v2', 'cues.json'));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let chrome = null, profDir = null;
function kill() {
  if (chrome) { try { process.kill(-chrome.pid, 'SIGKILL'); } catch { /* 已退 */ } chrome = null; }
  if (profDir) { try { fs.rmSync(profDir, { recursive: true, force: true }); } catch { /* 忽略 */ } profDir = null; }
}
process.on('exit', kill);
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => process.exit(130));

async function main() {
  profDir = fs.mkdtempSync(path.join(os.tmpdir(), 'music-cues-'));
  chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${profDir}`,
    '--no-first-run', '--no-default-browser-check', '--mute-audio', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'], detached: true });
  let log = '';
  const port = await new Promise((res, rej) => {
    const tm = setTimeout(() => rej(new Error('Chrome 无调试端口\n' + log)), 20000);
    chrome.stderr.on('data', (d) => { log = (log + d).slice(-4000); const m = log.match(/listening on ws:\/\/[^:/]+:(\d+)\//); if (m) { clearTimeout(tm); res(+m[1]); } });
    chrome.on('exit', (c) => { clearTimeout(tm); rej(new Error('Chrome 退出 ' + c + '\n' + log)); });
  });
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const tab = tabs.find((t) => t.type === 'page');
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('CDP 连接失败')); });
  let id = 0; const pend = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); const p = pend.get(m.id); if (!p) return; pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; };
  await send('Page.navigate', { url: INDEX });
  let data = null;
  for (let i = 0; i < 300 && !data; i++) {
    await sleep(100);
    data = await ev(`(function(){ if (!(window.CINE && CINE.cueTable && CINE.acts && window.__cine)) return null;
      var acts = CINE.acts().map(function (a) { return { id: a.id, name: a.name, start: a.start, end: a.start + a.duration, duration: a.duration }; });
      if (!acts.length) return null;
      return { duration: __cine.duration, acts: acts, cues: CINE.cueTable().map(function (c) { return { id: c.id, act: c.act, name: c.name, t: c.t, T: c.T }; }) }; })()`).catch(() => null);
  }
  if (!data) throw new Error('页面 30 秒内没给出幕表/cue 表');
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(data, null, 1));
  console.log(`music-cues: ${data.acts.length} 幕 ${data.cues.length} 个 cue，全片 ${data.duration}s → ${path.relative(process.cwd(), OUT)}`);
  console.log('  ' + data.acts.map((a) => `${a.id} ${a.start}–${a.end}`).join(' | '));
  process.exit(0);
}
main().catch((e) => { console.error('music-cues: ' + (e && e.stack || e)); process.exit(2); });
