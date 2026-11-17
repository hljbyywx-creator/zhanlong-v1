#!/usr/bin/env node
/* 《万古云霄》配乐 v2 验证 verify-audio.mjs —— 无头 Chrome 打开 file:// index.html（不带 ?mute），经 CDP 驱动。零 npm 依赖。
   用法：node tools/verify-audio.mjs [--profile]
   检查：
     0. ?mute=1 / ?shot=1 不载入 audio-assets.js、不解码
     1. 载入 0 报错（Runtime 异常 / console.error / Log error / CINE.errors / CINE.audio.errors）；音轨首段解码就绪（A.clips().state === 'ready'）；资产幕表与当前幕表一致；
        全片时长＝页面幕表各幕时长之和＝音轨时长（±0.05s）＝配乐所用的 cue 表 docs/revision-v2/CUES-v2.json（CUES 环境变量可改）——全部实时读，不写死全片秒
     2. 点「开卷」后音频时钟接管；跳到若干时刻（取 CUES-v2 的拍起点 cue，每第 4 个，＋1s，按全片秒直接 seek——配乐就是按这张表渲的，不依赖页面 cue 名；播放中 seek）后：
        在响的段 = 段落表在该时刻应响的段，且各自源位置与时间轴一致（±80ms），音频时刻与画面时刻差 < 150ms（段按需解码，跳转后 0.7s 内应已补排）；
        另报页面 cue 表与 CUES-v2 的拍起点差（只提示，不计失败：页面 cue 由画面执行者维护，第③期在改）
     3. 暂停即停：pause 后会话清空、无段在响；再播从原位接上
     4. 骤静：离线渲染 act2.seal 前后（除实时风声外的全部声音），封口后到「摩擦」前 RMS < −70 dBFS，封口前 > −45 dBFS
     5. 解码对齐：页内解出一段有声的配乐，与 tools/out/<MUSIC_DIR 缺省 music-v4>/master.wav 同一处做互相关，偏差 < 2ms（MP3 编码延迟已被裁掉）；
        取样点缺省自动选：HITS 命中点里 master.wav 上响度最大、且离 24 秒分段边界 ≥0.6s 的一个；ALIGN_T 环境变量可指定
   --profile：另把全片离线渲染（22.05kHz），按 5 秒打印 RMS（dBFS），用来看段落衔接有没有空洞/过响。
   退出码：0 全过，1 有失败，2 工具自身出错。 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INDEX = pathToFileURL(path.resolve(HERE, '..', 'index.html')).href;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PROFILE = process.argv.includes('--profile');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let chrome = null, profDir = null;
function kill() {
  if (chrome) { try { process.kill(-chrome.pid, 'SIGKILL'); } catch { /* 已退 */ } chrome = null; }
  if (profDir) { try { fs.rmSync(profDir, { recursive: true, force: true }); } catch { /* 忽略 */ } profDir = null; }
}
process.on('exit', kill);
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => process.exit(130));

async function launch() {
  profDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-audio-'));
  chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profDir}`,
    '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required',
    '--window-size=1280,720', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'], detached: true });
  let log = '';
  const port = await new Promise((res, rej) => {
    const tm = setTimeout(() => rej(new Error('Chrome 无调试端口\n' + log)), 20000);
    chrome.stderr.on('data', (d) => { log = (log + d).slice(-4000); const m = log.match(/listening on ws:\/\/[^:/]+:(\d+)\//); if (m) { clearTimeout(tm); res(+m[1]); } });
    chrome.on('exit', (c) => { clearTimeout(tm); rej(new Error('Chrome 退出 ' + c + '\n' + log)); });
  });
  const ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('CDP 连接失败')); });
  let id = 0; const pend = new Map(); let onEvent = () => {};
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id === undefined) return onEvent(m);
    const p = pend.get(m.id); if (!p) return; pend.delete(m.id);
    m.error ? p.rej(new Error(p.method + ': ' + m.error.message)) : p.res(m.result);
  };
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const i = ++id; pend.set(i, { res, rej, method });
    ws.send(JSON.stringify(sessionId ? { id: i, method, params, sessionId } : { id: i, method, params }));
  });
  return { send, setOnEvent: (f) => { onEvent = f; } };
}

async function openPage(cdp, url, errors) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const sid = (await cdp.send('Target.attachToTarget', { targetId, flatten: true })).sessionId;
  const send = (m, p) => cdp.send(m, p, sid);
  cdp.setOnEvent((m) => {
    if (m.sessionId !== sid) return;
    const p = m.params;
    if (m.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (p.exceptionDetails.exception?.description || p.exceptionDetails.text));
    else if (m.method === 'Runtime.consoleAPICalled' && p.type === 'error') errors.push('console.error: ' + p.args.map((a) => a.value ?? a.description).join(' '));
    else if (m.method === 'Log.entryAdded' && p.entry.level === 'error') errors.push('log: ' + p.entry.text + (p.entry.url ? ' ' + p.entry.url : ''));
  });
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Page.navigate', { url });
  const ev = async (expr, awaitPromise = false) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise });
    if (r.exceptionDetails) throw new Error('页内求值出错：' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  };
  for (let i = 0; i < 300; i++) {                     // 等引擎就绪（开卷可点）＋ 配乐首段解码完
    await sleep(100);
    const ok = await ev(`!!(window.CINE && CINE.audio && document.getElementById('startBtn') && !document.getElementById('startBtn').disabled && CINE.audio.clips && (CINE.audio.muted || /ready|missing/.test(String(CINE.audio.clips().state))))`).catch(() => false);
    if (ok) break;
  }
  return { ev, targetId };
}

const fails = [];
const check = (ok, msg) => { console.log((ok ? '  ✓ ' : '  ✗ ') + msg); if (!ok) fails.push(msg); };
const db = (x) => (x > 0 ? (20 * Math.log10(x)).toFixed(1) : '-inf');

/* 页内：某时刻应在响的片段（与 A.clips().playing 同形） */
const EXPECT = `function (T) {
  return CINE.audio.cues().filter(function (c) { return c.n === 'clip' && c.t <= T && T < c.e - .03; }).map(function (c) {
    var o = c.o, p = o.off + (T - c.t) * (o.rate || 1);
    if (o.loop && p >= o.loop[1]) p = o.loop[0] + (p - o.loop[0]) % (o.loop[1] - o.loop[0]);
    return { src: o.src, t: c.t, pos: p };
  });
}`;

async function main() {
  const cdp = await launch();
  const errors = [];
  console.log('0) 静音/截图模式不载入');
  for (const q of ['?mute=1', '?shot=1']) {
    const e0 = [];
    const pg = await openPage(cdp, INDEX + q, e0);
    await sleep(1500);
    const m = await pg.ev(`({ st: CINE.audio.clips().state, v2: !!window.CINE_SCORE_V2, tag: [].some.call(document.scripts, function (s) { return /audio-assets\.js/.test(s.src); }) })`);
    check(m.st === null && !m.v2 && !m.tag, `${q}：未挂载音轨（state=${m.st} 资产=${m.v2} script=${m.tag}）`);
    await cdp.send('Target.closeTarget', { targetId: pg.targetId });
  }
  console.log('1) 载入');
  const { ev } = await openPage(cdp, INDEX, errors);
  const st0 = await ev(`(function(){ var c = CINE.audio.clips(); return { state: c.state, buffers: c.buffers, nClip: CINE.audio.cues().filter(function(x){return x.n==='clip'}).length, nCue: CINE.audio.cues().length, dur: __cine.duration, aerr: CINE.audio.errors.slice(), cerr: (CINE.errors||[]).slice() }; })()`);
  check(st0.state === 'ready', `配乐解码就绪 state=${st0.state} 片段=${JSON.stringify(st0.buffers)}`);
  check(st0.nClip > 20, `段落表 ${st0.nClip} 段 / 共 ${st0.nCue} 条提示；全片 ${st0.dur}s`);
  const sv = await ev(`(function(){ var c = CINE.audio.clips(); return { stale: c.stale, parts: c.parts, chunk: c.chunk, lead: c.lead, dur: window.CINE_SCORE_V2 && CINE_SCORE_V2.duration }; })()`);
  check(!sv.stale && Math.abs(sv.dur - st0.dur) < .05, `音轨按当前幕表构建（stale=${sv.stale}；音轨 ${sv.dur}s / 全片 ${st0.dur}s；${sv.parts} 段×${sv.chunk}s，lead ${sv.lead}）`);
  const acts = await ev(`CINE.acts().map(function (a) { return { id: a.id, start: a.start, duration: a.duration }; })`);
  const sumActs = acts.reduce((x, a) => x + a.duration, 0), lastEnd = acts.length ? acts[acts.length - 1].start + acts[acts.length - 1].duration : 0;
  const cuesFile = path.resolve(process.env.CUES || path.join(HERE, 'out', 'music-zhanlong', 'cues.json')), built = fs.existsSync(cuesFile) ? JSON.parse(fs.readFileSync(cuesFile, 'utf8')) : null;
  check(Math.abs(sumActs - st0.dur) < .05 && Math.abs(lastEnd - st0.dur) < .05 && (!built || Math.abs(built.duration - st0.dur) < .05),
    `全片时长 ${st0.dur}s ＝ 幕表之和 ${+sumActs.toFixed(3)}s（末幕止于 ${+lastEnd.toFixed(3)}s）${built ? ` ＝ 构建 cue 表 ${built.duration}s（${built.cues.length} 个 cue）` : '（无构建 cue 表可比）'}；${acts.map((a) => a.id + ' ' + a.start + '–' + +(a.start + a.duration).toFixed(3)).join(' | ')}`);

  console.log('2) 起播与跳转');
  await ev(`document.getElementById('startBtn').click()`);
  await sleep(1500);
  const s1 = await ev(`__cine.state()`);
  check(s1.playing && s1.audio, `开卷后在播、音频时钟接管（playing=${s1.playing} audio=${s1.audio}）`);
  // 跳转点：CUES-v2 拍起点 cue 每第 4 个（+1s），按全片秒直接 seek
  const beats = (built ? built.cues : []).filter((q) => (q.kind || 'beat') === 'beat');
  const PTS = beats.filter((q, i) => i % 4 === 1).map((q) => [q.id, q.T]);
  check(PTS.length > 10, `跳转点 ${PTS.length} 个（取自 ${path.relative(path.resolve(HERE, '..'), cuesFile)}）`);
  const pg = await ev(`${JSON.stringify(beats.map((q) => q.id))}.map(function (id) { var c = CINE.cue(id); return c ? c.T : null; })`);
  const off = beats.map((q, i) => [q.id, q.T, pg[i]]).filter(([, T, P]) => P == null || Math.abs(P - T) > .05);
  console.log(`    （提示）页面 cue 表与 CUES-v2 拍起点：${beats.length - off.length}/${beats.length} 一致${off.length ? '；不一致/缺 ' + off.length + ' 个，如 ' + off.slice(0, 6).map(([id, T, P]) => id + ' ' + T + '→' + (P == null ? '缺' : P)).join('，') : ''}`);
  const points = PTS.map((p) => +(p[1] + 1).toFixed(2));
  for (const T of points) {
    await ev(`__cine.seek(${T})`);
    await sleep(700);
    const r = await ev(`(function(){ var c = CINE.audio.clips(), s = __cine.state(); return { c: c, s: s, exp: (${EXPECT})(c.T) }; })()`);
    const play = r.c.playing, exp = r.exp;
    const drift = r.s.ta != null && r.c.T != null ? Math.abs(r.s.ta - r.c.T) : NaN;
    let ok = play.length === exp.length && drift < .15, worst = 0;
    for (const e of exp) {
      const m = play.find((p) => p.src === e.src && Math.abs(p.t - e.t) < 1e-6);
      if (!m) { ok = false; continue; }
      worst = Math.max(worst, Math.abs(m.pos - e.pos));
    }
    ok = ok && worst < .08;
    check(ok, `seek ${T} → 音频 T=${r.c.T?.toFixed(2)} 画面差 ${(drift * 1000).toFixed(0)}ms；在响 ${play.map((p) => p.src + '@' + p.pos.toFixed(2)).join(' ') || '（无片段）'}；应响 ${exp.length}，源位置最大误差 ${(worst * 1000).toFixed(0)}ms`);
  }

  console.log('3) 暂停即停');
  await ev(`__cine.seek(600)`); await sleep(800);
  await ev(`__cine.pause()`); await sleep(200);
  const p1 = await ev(`(function(){ var c = CINE.audio.clips(); return { n: c.playing.length, T: c.T, s: __cine.state() }; })()`);
  check(p1.n === 0 && p1.T === null && !p1.s.playing, `pause 后无片段在响、会话已清（playing=${p1.n} T=${p1.T}）停在 ${p1.s.T.toFixed(2)}`);
  await sleep(600);
  const T0 = p1.s.T;
  await ev(`__cine.play()`); await sleep(800);
  const p2 = await ev(`(function(){ var c = CINE.audio.clips(); return { c: c, exp: (${EXPECT})(c.T) }; })()`);
  check(p2.c.playing.length === p2.exp.length && p2.c.T > T0 && p2.c.T < T0 + 1.2, `再播从 ${T0.toFixed(2)} 接上 → 音频 T=${p2.c.T?.toFixed(2)}，在响 ${p2.c.playing.length}/${p2.exp.length}`);
  await ev(`__cine.pause()`);

  const lateErr = await ev(`(CINE.errors||[]).concat(CINE.audio.errors)`);
  check(errors.length === 0 && lateErr.length === 0, `页面 0 报错（CDP ${errors.length} 条，CINE/audio ${lateErr.length} 条）${errors.concat(lateErr).slice(0, 5).map((e) => '\n      ' + e).join('')}`);

  console.log('4) 骤静（离线渲染）');
  const seal = await ev(`(function(){ var a = CINE.cue('act5.callblade'); return a ? { t0: a.T - 1.8, t1: a.T } : null; })()`);
  const RMS = `function (b, a, z, T0) { var s = 0, n = 0; for (var ch = 0; ch < b.numberOfChannels; ch++) { var d = b.getChannelData(ch), i0 = Math.max(0, Math.floor((a - T0) * b.sampleRate)), i1 = Math.min(d.length, Math.floor((z - T0) * b.sampleRate)); for (var i = i0; i < i1; i++) { s += d[i] * d[i]; n++; } } return Math.sqrt(s / Math.max(1, n)); }`;
  if (!seal) console.log('    （无骤静节拍，跳过）');
  else {
  const z = await ev(`CINE.audio._offline(${seal.t0 - 4}, ${seal.t1 - .05}, 22050, function (c) { return c.n !== 'wind'; }).then(function (b) {
    var R = ${RMS}; return { pre: R(b, ${seal.t0 - 3}, ${seal.t0 - .1}, ${seal.t0 - 4}), post: R(b, ${seal.t0 + .12}, ${seal.t1 - .1}, ${seal.t0 - 4}) };
  })`, true);
  check(z.post < Math.pow(10, -70 / 20) && z.pre > Math.pow(10, -45 / 20), `act5.callblade 静音窗 ${seal.t0.toFixed(2)}→${seal.t1.toFixed(2)}：窗前 ${db(z.pre)} dBFS → 窗内 ${db(z.post)} dBFS`);
  }

  console.log('5) 解码对齐');
  try {
    const wavFile = path.resolve(HERE, 'out', process.env.MUSIC_DIR || 'music-zhanlong', 'master.wav');
    if (!fs.existsSync(wavFile)) throw new Error('缺 ' + wavFile + '（先 sh tools/build-audio.sh）');
    const { readWav } = await import('./music-render.mjs');
    const w = readWav(wavFile), x = w.ch[0], sr0 = w.sr;
    let now = process.env.ALIGN_T ? +process.env.ALIGN_T : null;
    if (now == null) {                                                     // 自动选一个有声段：命中点里 master 上最响、且不贴 24s 分段边界的
      const hitsFile = path.resolve(HERE, '..', 'docs', 'HITS.json'), rawH = fs.existsSync(hitsFile) ? JSON.parse(fs.readFileSync(hitsFile, 'utf8')) : [];
      const H = Array.isArray(rawH) ? rawH : (rawH.hits || []);
      let best = -1;
      for (const h of H) {
        const r = h.T % sv.chunk; if (r < .6 || r > sv.chunk - .6) continue;
        let e = 0; for (let i = Math.floor((h.T - .3) * sr0); i < Math.floor((h.T + .5) * sr0); i++) e += (x[i] || 0) ** 2;
        if (e > best) { best = e; now = h.T; }
      }
      if (now == null) now = 600;
    }
    const part = Math.floor(now / sv.chunk);
    const pr = await ev(`CINE.audio._part(${part}, 0, 1).then(function (r) { return r && { sr: r.sr, a: r.a, len: r.len }; })`, true);
    const from = Math.max(0, Math.round((now - .3 - pr.a) * pr.sr)), N = Math.round(pr.sr * .8);
    const dec = await ev(`CINE.audio._part(${part}, ${from}, ${N}).then(function (r) { return r && r.L; })`, true);
    const t0 = pr.a + from / pr.sr, lagMax = Math.round(.03 * pr.sr);
    let best = -1, bestLag = 0;
    for (let lag = -lagMax; lag <= lagMax; lag++) {                      // 解码样本 k ↔ 原 WAV 时刻 t0 + (k + lag)/sr
      let s = 0, e1 = 0, e2 = 0;
      for (let k = 0; k < dec.length; k += 2) { const p = (t0 + (k + lag) / pr.sr) * sr0, i = Math.floor(p), f = p - i, v = (x[i] || 0) * (1 - f) + (x[i + 1] || 0) * f; s += v * dec[k]; e1 += v * v; e2 += dec[k] * dec[k]; }
      const c = s / Math.sqrt(e1 * e2 + 1e-12); if (c > best) { best = c; bestLag = lag; }
    }
    const ms = -bestLag / pr.sr * 1000;
    check(Math.abs(ms) < 2 && best > .9, `第 ${part} 段（含 ${now}s）解码后比原 WAV ${ms >= 0 ? '晚' : '早'} ${Math.abs(ms).toFixed(2)}ms，相关 ${best.toFixed(4)}（解码采样率 ${pr.sr}）`);
  } catch (e) { check(false, '解码对齐检查出错：' + (e && e.message || e)); }

  if (PROFILE) {
    console.log('5) 全片 RMS（5 秒一格，dBFS）');
    const dur = st0.dur, rows = [];
    for (let a = 0; a < dur; a += 60) {
      const b = Math.min(dur, a + 60);
      const v = await ev(`CINE.audio._offline(${a}, ${b}, 22050).then(function (buf) { var R = ${RMS}, out = []; for (var t = ${a}; t < ${b}; t += 5) out.push(R(buf, t, Math.min(${b}, t + 5), ${a})); return out; })`, true);
      v.forEach((x, i) => rows.push([a + i * 5, x]));
    }
    for (let i = 0; i < rows.length; i += 6) console.log('    ' + rows.slice(i, i + 6).map(([t, x]) => String(t).padStart(4) + 's ' + db(x).padStart(6)).join('  '));
  }

  console.log(fails.length ? `\n失败 ${fails.length} 项` : '\n全部通过');
  process.exit(fails.length ? 1 : 0);
}
main().catch((e) => { console.error('verify-audio: ' + (e && e.stack || e)); process.exit(2); });
