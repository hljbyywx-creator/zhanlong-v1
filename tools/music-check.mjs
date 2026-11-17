#!/usr/bin/env node
/* 《万古云霄》配乐 v2 客观自检（不能用耳朵听，就用量）：零 npm 依赖；画图借无头 Chrome，频谱图与试听片段借 ffmpeg/lame。
   用法：node tools/music-check.mjs [--wav tools/out/music-v2/master.wav] [--out tools/out/music-v2] [--no-png] [--no-clips]
   读 master.wav＋master.json（渲染器写出的段落表、标记、主题音、硬停窗、重音表），输出：
     report.json / report.txt：积分响度、短时/瞬时最大值、样本峰/近似真峰、削波数；逐段平均短时响度、瞬时最大、起音密度、频谱质心；
       「突兀」检查：瞬时响度 0.5s 内上跳 ≥10LU 而附近（±0.35s）没有乐谱里设计的重音/硬停/标记的时刻；段落交界 ±1.5s 的响度差；
       主题可辨：每个主题音起音处的色度变化（新出现的音高类）中，应有音高类的名次（第 1/前 2 的比例）；
       封口骤静：封口后到摩擦前的 RMS（应为数字静音）。
     loudness.png（全片短时/瞬时响度＋段落与标记＋起音密度）、spectrum.png（ffmpeg 频谱图）、clips/*.mp3（关键段落试听）。 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readWav, kPower, loudness, SR } from './music-render.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const OUT = path.resolve(arg('--out', path.join(HERE, 'out', 'music-v2')));
const WAV = path.resolve(arg('--wav', path.join(OUT, 'master.wav')));
const META = JSON.parse(fs.readFileSync(WAV.replace(/\.wav$/, '.json'), 'utf8'));
const LU = (p) => -0.691 + 10 * Math.log10(Math.max(p, 1e-20));
const r1 = (x) => Math.round(x * 10) / 10;

function fft(re, im) {                                   // 原位基 2 FFT
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let j = 0; j < len / 2; j++) { const ur = re[i + j], ui = im[i + j], vr = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci, vi = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr; re[i + j] = ur + vr; im[i + j] = ui + vi; re[i + j + len / 2] = ur - vr; im[i + j + len / 2] = ui - vi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } }
  }
}
function spec(x, i0, N) {                                // 汉宁窗幅度谱
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let k = 0; k < N; k++) { const v = x[i0 + k] || 0; re[k] = v * (.5 - .5 * Math.cos(2 * Math.PI * k / N)); }
  fft(re, im);
  const m = new Float64Array(N / 2); for (let k = 0; k < N / 2; k++) m[k] = Math.hypot(re[k], im[k]); return m;
}
function chroma(x, t, dur) {                             // 色度：MIDI 36–96 各音基频附近能量按音高类累加
  const N = 8192, i0 = Math.floor(t * SR), c = new Float64Array(12);
  let k = 0; const steps = Math.max(1, Math.floor(dur * SR / (N / 2)));
  for (let s = 0; s < steps; s++) {
    const m = spec(x, i0 + s * N / 2, N);
    for (let p = 36; p <= 96; p++) { const f = 440 * Math.pow(2, (p - 69) / 12), b = f * N / SR, lo = Math.floor(b * Math.pow(2, -.5 / 12)), hi = Math.ceil(b * Math.pow(2, .5 / 12)); let e = 0; for (let q = lo; q <= hi; q++) e = Math.max(e, m[q] || 0); c[p % 12] += e * e; }
    k++;
  }
  return c.map((v) => v / k);
}

async function main() {
  const w = readWav(WAV), L = w.ch[0], R = w.ch[1], n = L.length, T0 = META.t0 || 0;
  const mono = new Float32Array(n); for (let i = 0; i < n; i++) mono[i] = (L[i] + R[i]) / 2;
  const pw = kPower(L, R), nb = pw.length;
  const mom = [], st = [];
  for (let j = 0; j < nb; j++) { let a = 0, ca = 0, b = 0, cb = 0; for (let k = Math.max(0, j - 3); k <= j; k++) { a += pw[k]; ca++; } for (let k = Math.max(0, j - 29); k <= j; k++) { b += pw[k]; cb++; } mom.push(LU(a / ca)); st.push(LU(b / cb)); }
  const integ = loudness(pw);
  /* 峰值 */
  let sp = 0, tp = 0, clip = 0;
  for (let i = 1; i < n - 2; i++) for (const x of [L, R]) {
    const a = Math.abs(x[i]); if (a > sp) sp = a; if (a >= .999) clip++;
    if (a > .5) for (const f of [.25, .5, .75]) { const xm = x[i - 1], x0 = x[i], x1 = x[i + 1], x2 = x[i + 2]; const v = Math.abs(((((.5 * (x2 - xm) + 1.5 * (x0 - x1)) * f + (xm - 2.5 * x0 + 2 * x1 - .5 * x2)) * f + .5 * (x1 - xm)) * f + x0)); if (v > tp) tp = v; }
  }
  tp = Math.max(tp, sp);
  /* 起音（谱通量）：1024 点、hop 512，自适应门限取峰 */
  const N = 1024, hop = 512, nf = Math.floor((n - N) / hop), flux = new Float64Array(nf), cen = new Float64Array(nf);
  let prev = null;
  for (let f = 0; f < nf; f++) {
    const m = spec(mono, f * hop, N); let s = 0, cs = 0, ms = 0;
    for (let k = 1; k < N / 2; k++) { const v = Math.log1p(1000 * m[k]); if (prev) s += Math.max(0, v - prev[k]); cs += k * m[k]; ms += m[k]; }
    flux[f] = s; cen[f] = ms > 1e-9 ? cs / ms * SR / N : 0; prev = m.map((v) => Math.log1p(1000 * v));
  }
  const onsets = [];
  for (let f = 2; f < nf - 2; f++) {
    let mu = 0, c = 0; for (let k = Math.max(0, f - 20); k <= Math.min(nf - 1, f + 20); k++) { mu += flux[k]; c++; } mu /= c;
    if (flux[f] > flux[f - 1] && flux[f] >= flux[f + 1] && flux[f] > mu * 1.5 + 2 && (!onsets.length || (f * hop / SR) - onsets[onsets.length - 1] > .05)) onsets.push(f * hop / SR + T0);
  }
  const dens = (a, b) => onsets.filter((t) => t >= a && t < b).length / Math.max(.1, b - a);
  /* 逐段 */
  const secTab = (META.sections || []).map((s) => {
    const a = Math.max(0, Math.floor((s.t0 - T0) * 10)), b = Math.min(nb, Math.ceil((s.t1 - T0) * 10));
    let ps = 0, c = 0, mm = -Infinity; for (let j = a; j < b; j++) { ps += pw[j]; c++; if (mom[j] > mm) mm = mom[j]; }
    const fa = Math.floor((s.t0 - T0) * SR / hop), fb = Math.min(nf, Math.floor((s.t1 - T0) * SR / hop)); let cc = 0, cw = 0; for (let f = Math.max(0, fa); f < fb; f++) { cc += cen[f]; cw++; }
    return { name: s.name, t0: s.t0, t1: s.t1, lufs: r1(LU(ps / Math.max(1, c))), momMax: r1(mm), onsetsPerSec: r1(dens(s.t0, s.t1)), centroidHz: Math.round(cc / Math.max(1, cw)), note: s.note };
  });
  /* 突兀上跳：瞬时响度比前 0.5s 最低值高 ≥10LU、且当前 ≥ −40，附近 ±0.35s 无设计重音/标记/硬停 */
  const designed = (META.accents || []).concat((META.kills || []).flatMap((k) => [k.t0, k.t1])).concat((META.theme || []).map((x) => x.t)), markT = (META.marks || []).map((m) => m.t);
  const jumps = [];
  for (let j = 5; j < nb; j++) {
    let lo = Infinity; for (let k = j - 5; k < j; k++) lo = Math.min(lo, mom[k]);
    const rise = mom[j] - Math.max(lo, -70);
    if (rise >= 10 && mom[j] > -40) {
      const t = T0 + j / 10, near = designed.some((d) => Math.abs(d - t) <= .45) || markT.some((d) => t - d >= -.45 && t - d <= 1.2);
      if (!jumps.length || t - jumps[jumps.length - 1].t > 1) jumps.push({ t: r1(t), rise: r1(rise), level: r1(mom[j]), designed: near });
    }
  }
  const undesigned = jumps.filter((j) => !j.designed);
  /* 段落交界：交界前后各 1.5s 的平均短时响度差 */
  const bounds = [];
  for (let i = 1; i < secTab.length; i++) {
    const t = secTab[i].t0, a = Math.floor((t - T0 - 1.5) * 10), b = Math.floor((t - T0) * 10), c = Math.floor((t - T0 + 1.5) * 10);
    if (a < 0 || c > nb) continue;
    let p1 = 0, p2 = 0; for (let j = a; j < b; j++) p1 += pw[j]; for (let j = b; j < c; j++) p2 += pw[j];
    bounds.push({ at: secTab[i].name, t: r1(t), before: r1(LU(p1 / (b - a))), after: r1(LU(p2 / (c - b))), diff: r1(LU(p2 / (c - b)) - LU(p1 / (b - a))) });
  }
  /* 主题可辨：起音处新出现的音高类（后 0.25s 色度 − 前 0.2s 色度，取正）中应有音的名次 */
  const th = (META.theme || []).filter((x) => x.t - T0 > .3 && x.t - T0 < n / SR - 1);
  let top1 = 0, top2 = 0; const byLabel = {};
  for (const x of th) {
    const a = chroma(mono, x.t - T0 - .24, .18), b = chroma(mono, x.t - T0 + .03, Math.min(.3, Math.max(.18, x.d * .6)));
    const nov = b.map((v, i) => Math.max(0, v - a[i] * .9) + v * .15);
    const pc = ((x.m % 12) + 12) % 12, rank = nov.filter((v) => v > nov[pc]).length + 1;
    if (rank === 1) top1++; if (rank <= 2) top2++;
    const L2 = byLabel[x.label] = byLabel[x.label] || { n: 0, top1: 0, top2: 0 }; L2.n++; if (rank === 1) L2.top1++; if (rank <= 2) L2.top2++;
  }
  /* 封口骤静 */
  const seal = (META.kills || [])[0];
  let sealRms = null;
  if (seal) { let s = 0, c = 0; for (let i = Math.floor((seal.t0 + .12 - T0) * SR); i < Math.floor((seal.t1 - .1 - T0) * SR); i++) { s += L[i] * L[i] + R[i] * R[i]; c += 2; } sealRms = c ? (s > 0 ? r1(10 * Math.log10(s / c)) : -Infinity) : null; }
  let stMax = -Infinity, stAt = 0, mMax = -Infinity, mAt = 0; for (let j = 30; j < nb; j++) { if (st[j] > stMax) { stMax = st[j]; stAt = j / 10 + T0; } if (mom[j] > mMax) { mMax = mom[j]; mAt = j / 10 + T0; } }
  const rep = {
    file: path.relative(process.cwd(), WAV), duration: r1(n / SR), integratedLUFS: r1(integ), shortTermMax: { lufs: r1(stMax), at: r1(stAt) }, momentaryMax: { lufs: r1(mMax), at: r1(mAt) },
    samplePeakDb: r1(20 * Math.log10(sp)), truePeakApproxDb: r1(20 * Math.log10(tp)), clippedSamples: clip,
    sealSilence: seal ? { from: seal.t0, to: seal.t1, rmsDb: sealRms } : null,
    jumps: { total: jumps.length, undesigned: undesigned.length, list: jumps },
    boundaries: bounds, sections: secTab,
    theme: { notes: th.length, top1: th.length ? r1(100 * top1 / th.length) : null, top2: th.length ? r1(100 * top2 / th.length) : null, byLabel },
    onsets: onsets.length
  };
  const base = path.basename(WAV, '.wav');
  fs.writeFileSync(path.join(OUT, base === 'master' ? 'report.json' : base + '-report.json'), JSON.stringify(rep, null, 1));
  const txt = [];
  txt.push(`${rep.file}  ${rep.duration}s  积分 ${rep.integratedLUFS} LUFS  短时最大 ${rep.shortTermMax.lufs}@${rep.shortTermMax.at}s  瞬时最大 ${rep.momentaryMax.lufs}@${rep.momentaryMax.at}s`);
  txt.push(`样本峰 ${rep.samplePeakDb} dBFS  近似真峰 ${rep.truePeakApproxDb} dBTP  削波 ${clip}  起音 ${onsets.length}`);
  if (seal) txt.push(`封口 ${seal.t0}→${seal.t1}：RMS ${sealRms} dBFS`);
  txt.push(`上跳 ≥10LU：${jumps.length} 处，其中无设计重音 ${undesigned.length} 处：` + undesigned.map((j) => `${j.t}s(+${j.rise})`).join(' '));
  txt.push(`主题音 ${th.length} 个：新出现音高类第 1 名 ${rep.theme.top1}% ，前 2 名 ${rep.theme.top2}%`);
  for (const [k, v] of Object.entries(byLabel)) txt.push(`  ${k}: ${v.top2}/${v.n}（第1 ${v.top1}）`);
  txt.push('段落：');
  for (const s of secTab) txt.push(`  ${String(s.t0).padStart(7)}–${String(s.t1).padEnd(7)} ${s.name.padEnd(14, '　')} 平均 ${String(s.lufs).padStart(6)}  瞬时最大 ${String(s.momMax).padStart(6)}  起音 ${String(s.onsetsPerSec).padStart(4)}/s  质心 ${s.centroidHz}Hz`);
  txt.push('交界（前 1.5s → 后 1.5s）：' + bounds.map((b) => `${b.at} ${b.diff > 0 ? '+' : ''}${b.diff}`).join('；'));
  fs.writeFileSync(path.join(OUT, base === 'master' ? 'report.txt' : base + '-report.txt'), txt.join('\n') + '\n');
  console.log(txt.join('\n'));
  if (!process.argv.includes('--no-png')) await plots(base, { mom, st, onsets, secTab, META, T0, nb, dur: n / SR, jumps });
  if (!process.argv.includes('--no-clips') && base === 'master') clips();
}

/* ---------- 图：响度曲线（Chrome 画布截图）＋ ffmpeg 频谱图 ---------- */
async function plots(base, d) {
  const sp = path.join(OUT, base === 'master' ? 'spectrum.png' : base + '-spectrum.png');
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', WAV, '-lavfi', 'showspectrumpic=s=2400x500:mode=combined:scale=log:fscale=log:legend=1:gain=1.5', sp]);
  const rows = Math.ceil(d.dur / 250), W = 2400, RH = 420, H = rows * RH + 40;
  const dens = []; for (let t = 0; t < d.dur; t += 1) dens.push(d.onsets.filter((x) => x - d.T0 >= t - 1 && x - d.T0 < t + 1).length / 2);
  const data = { mom: d.mom.map((v) => Math.round(Math.max(-60, v) * 10) / 10), st: d.st.map((v) => Math.round(Math.max(-60, v) * 10) / 10), dens, secs: d.secTab, marks: d.META.marks || [], kills: d.META.kills || [], jumps: d.jumps, T0: d.T0, dur: d.dur, rows, W, RH };
  const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#fbf8f1"><canvas id="c" width="${W}" height="${H}"></canvas><script>
  const D=${JSON.stringify(data)};const c=document.getElementById('c').getContext('2d');c.font='15px "PingFang SC",sans-serif';
  c.fillStyle='#222';c.font='bold 20px "PingFang SC",sans-serif';c.fillText('《万古云霄》配乐 v2 响度曲线：蓝＝短时(3s) LUFS，浅灰＝瞬时(0.4s)，橙柱＝起音密度(次/秒)，红线＝标记/硬停，红三角＝无设计重音的上跳',20,26);c.font='14px "PingFang SC",sans-serif';
  const per=250,L0=60,PW=D.W-90;
  for(let r=0;r<D.rows;r++){const y0=40+r*D.RH,top=y0+40,h=D.RH-80,t0=r*per,t1=Math.min(D.dur,t0+per);
    const X=t=>L0+(t-t0)/per*PW,Y=v=>top+h*(1-(v+60)/52);
    D.secs.forEach((s,i)=>{const a=Math.max(t0,s.t0-D.T0),b=Math.min(t1,s.t1-D.T0);if(b<=a)return;c.fillStyle=i%2?'rgba(120,100,60,.07)':'rgba(60,90,120,.07)';c.fillRect(X(a),top,X(b)-X(a),h);c.save();c.fillStyle='#6a5a40';c.translate(X(a)+3,y0+14+(i%2)*16);c.fillText(s.name+'  '+s.lufs,0,0);c.restore();});
    c.strokeStyle='#ccc';c.lineWidth=1;for(let v=-60;v<=-8;v+=10){c.beginPath();c.moveTo(L0,Y(v));c.lineTo(L0+PW,Y(v));c.stroke();c.fillStyle='#888';c.fillText(v,8,Y(v)+4);}
    c.beginPath();c.moveTo(L0,Y(-23));c.lineTo(L0+PW,Y(-23));c.strokeStyle='#4a8';c.setLineDash([6,4]);c.stroke();c.setLineDash([]);
    for(let t=Math.ceil(t0/10)*10;t<=t1;t+=10){c.fillStyle='#777';c.fillText(t+'s',X(t)-12,top+h+16);c.strokeStyle='#e4e0d6';c.beginPath();c.moveTo(X(t),top+h);c.lineTo(X(t),top+h+4);c.stroke();}
    c.fillStyle='rgba(230,140,40,.55)';for(let t=Math.floor(t0);t<t1;t++){const v=D.dens[t]||0;c.fillRect(X(t),top+h-v*6,PW/per*.9,v*6);}
    const line=(arr,col,lw)=>{c.beginPath();c.strokeStyle=col;c.lineWidth=lw;let s=false;for(let j=Math.floor(t0*10);j<Math.min(arr.length,t1*10);j++){const x=X(j/10),y=Y(arr[j]);if(!s){c.moveTo(x,y);s=true}else c.lineTo(x,y);}c.stroke();};
    line(D.mom,'rgba(120,120,120,.45)',1);line(D.st,'#2a5ea8',2.2);
    c.strokeStyle='rgba(190,40,30,.55)';c.lineWidth=1;D.marks.forEach(m=>{const t=m.t-D.T0;if(t<t0||t>t1)return;c.beginPath();c.moveTo(X(t),top);c.lineTo(X(t),top+h);c.stroke();c.save();c.fillStyle='rgba(160,30,20,.9)';c.translate(X(t)+2,top+h-4);c.rotate(-Math.PI/2);c.fillText(m.label,0,0);c.restore();});
    D.kills.forEach(k=>{const a=Math.max(t0,k.t0-D.T0),b=Math.min(t1,k.t1-D.T0);if(b>a){c.fillStyle='rgba(190,40,30,.15)';c.fillRect(X(a),top,X(b)-X(a),h);}});
    D.jumps.filter(j=>!j.designed).forEach(j=>{const t=j.t-D.T0;if(t<t0||t>t1)return;c.fillStyle='#c22';c.beginPath();c.moveTo(X(t),Y(j.level)-12);c.lineTo(X(t)-6,Y(j.level)-24);c.lineTo(X(t)+6,Y(j.level)-24);c.fill();});
  }
  document.title='done';</script>`;
  const hp = path.join(OUT, '_plot.html'); fs.writeFileSync(hp, html);
  await shot(hp, path.join(OUT, base === 'master' ? 'loudness.png' : base + '-loudness.png'), W, H);
  fs.rmSync(hp, { force: true });
}
async function shot(file, png, W, H) {
  const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'music-plot-'));
  const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--window-size=${W},${H}`, '--remote-debugging-port=0', `--user-data-dir=${prof}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'], detached: true });
  try {
    let log = '';
    const port = await new Promise((res, rej) => { const tm = setTimeout(() => rej(new Error('Chrome 无调试端口')), 20000); ch.stderr.on('data', (x) => { log += x; const m = log.match(/listening on ws:\/\/[^:/]+:(\d+)\//); if (m) { clearTimeout(tm); res(+m[1]); } }); });
    const tab = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page');
    const ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise((r) => { ws.onopen = r; });
    let id = 0; const pend = new Map(); ws.onmessage = (e) => { const m = JSON.parse(e.data); const p = pend.get(m.id); if (p) { pend.delete(m.id); p(m.result); } };
    const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
    await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: 'file://' + file });
    for (let i = 0; i < 100; i++) { await new Promise((r) => setTimeout(r, 100)); const r = await send('Runtime.evaluate', { expression: 'document.title', returnByValue: true }); if (r.result && r.result.value === 'done') break; }
    const s = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });
    fs.writeFileSync(png, Buffer.from(s.data, 'base64'));
  } finally { try { process.kill(-ch.pid, 'SIGKILL'); } catch { /* 已退 */ } fs.rmSync(prof, { recursive: true, force: true }); }
}
/* ---------- 试听片段（时刻全部由 cue 表／幕表算出，不写全片秒） ---------- */
function clips() {
  const cues = JSON.parse(fs.readFileSync(path.join(OUT, 'cues.json'), 'utf8'));
  const C = {}; for (const c of cues.cues) C[c.id] = c.T;
  const A = {}; for (const a of cues.acts) A[a.id] = a;
  const end = cues.duration;
  const T = (id, d) => (C[id] != null ? C[id] : d);
  const list = [                                             // 《万古云霄》关键段（拍 cue）
    ['01-冷开场与前情', A.prologue.start, A.prologue.start + 45],
    ['02-一幕刺杀到天外音', T('act1.1-04', 77) - 2, T('act1.1-12', 173) + 12],
    ['03-二幕暗室毒鳄', T('act2.2-06', 251) - 2, T('act2.2-07', 277) + 4],
    ['04-三幕无明火到长啸', T('act3.3-05', 425) - 2, T('act3.3-09', 491) + 4],
    ['05-三幕玄黄剑意', T('act3.3-09', 491), T('act3.3-10', 513)],
    ['06-四幕千里一吼', T('act4.4-12', 743) - 1, T('act4.4-14', 760) + 1],
    ['07-五幕放开拘束到画中人', T('act5.5-07', 962) - 3, T('act5.5-09', 998)],
    ['08-五幕落羽与万古云霄', T('act5.5-12', 1046) - 1, T('act5.5-14', 1096) + 2],
    ['09-尾声最后40秒', end - 40, end + .5]
  ];
  const dir = path.join(OUT, 'clips'); fs.mkdirSync(dir, { recursive: true });
  for (const [name, a, b] of list) {
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(Math.max(0, a)), '-t', String(b - a), '-i', WAV, '-af', `afade=t=in:d=0.3,afade=t=out:st=${Math.max(0, b - a - .6).toFixed(2)}:d=0.6`, '-c:a', 'libmp3lame', '-q:a', '2', path.join(dir, name + '.mp3')]);
  }
  console.log(`clips：${list.length} 段 → ${path.relative(process.cwd(), dir)}`);
}
main().catch((e) => { console.error('music-check: ' + (e && e.stack || e)); process.exit(2); });
