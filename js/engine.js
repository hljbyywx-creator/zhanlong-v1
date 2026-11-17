/* 《万古云霄》引擎 engine.js —— 时间轴 / 渲染循环 / 控制 / 笔墨工具库。零依赖，file:// 可用。
   逻辑坐标恒为 1920×1080（CINE.W/H）；画面只依赖 t 与种子随机（禁用 Math.random 驱动画面）。

 ============================ API 速查（各幕只读） ============================
 注册：CINE.registerAct({ id:'act1', order:1, name:'一 · 东来', duration:150, card:['一','东来'], plates:'p01-xxx p02-yyy',
         beats:[{id:'1',t:0,label:'…'}], draw(ctx, t 幕内秒, env) })
       env = { W,H, T 全局秒, t, act, dur, rand=U.rng, U, C, F, ink=I, song=CINE.songChars }
       幕首 3.3s 由引擎叠宣纸与竖排幕名卡；幕与幕之间引擎自动叠墨晕转场（边界前 1.2s 墨洇满、后 1.2s 墨褪出露出幕名卡），拍点不变。draw 内无需 finish。
       修订 v2 起缺省「连续演出」（CINE.CONTINUOUS）：幕名卡与幕间墨晕/水洗/纸幕转场都不画，幕界＝硬切；?cards=1 恢复上面的旧行为（对照用）。
       可选 xIn：本幕的入场转场 'ink' 墨晕（缺省）| 'wash' 水洗入白 | 'veil' 旧式宣纸淡出淡入（幕尾 1.1s）| 'cut' 硬切；
       仅在本幕有 card 或 veilIn 时生效（两者皆无的边界照旧硬切）。xIn 'veil' 时可给 xPeak 0..1：前一幕幕尾纸幕的峰值（缺省 1）。
       可选 tags：[{name, role, t0 幕内秒, x, y, side, hold, dark, size, a, seed, allowSay}] 人物题签，引擎在本幕 draw 之后统一调 I.nameTag 画（见「字」）。
 颜色 CINE.C：paper/ink/grey/white/gold/goldHi/qing/qingHi/blood/dusk/night/dawn（xxxRGB 为 [r,g,b]）
 字体 CINE.FONT：poem 马善政 | text 霞鹜文楷 | sword 志莽行书 | wild 同 sword（2026-10-11 刘建毛草太潦草认不出，改志莽行书）| stele 碑体（王汉宗中魏碑简体，只收转数印章「一二三四五六七八九十转」，其余字回退马善政）（「·」只在 text 里有）
 CINE.util (U)：clamp lerp smooth easeIn/Out/InOut ramp(t,a,b) win(t,a,b,fi,fo) kf(t,[[t,v]..]) fract  warp([[新秒,旧秒]..])→{toOld,toNew} 幕加长时的时间拉伸表
       hash h2 rng(seed)→f() f.range f.pm  noise1 noise2 fbm1 fbm2  rgba(rgb,a) mix(c1,c2,k)
       canvas(w,h) cached(key,build) LRU 缓存  layer(name) 全屏离屏层  qrgb(rgb) 精灵用色量化（每通道 1/20 档，调色板原色不变；自铺底色要和云/晕染精灵严丝合缝时用它）
       CINE.cacheStats() → {n, mpx, miss, layers} 调试
 CINE.ink (I) —— 底与光：paper(c,a) sky(c,stops,mode) nightSky(c,k,o) dawnLight(c,k,o) screen(c) 复位到屏幕坐标
       wash(c,x,y,rw,rh,a,seed,rgb,rot,o) 晕染（o.edge 'wet' 湿边水渍 | 'soft'；缺省深色湿、浅色柔）  glow(c,x,y,r,rgb,a,mode) 光晕
       soft(c,drawFn,o) 柔边/整组淡入淡出（外渗不齐 + 湿边水渍 o.rim；o.spread 量化到 0.2 档）  blur(canvas,n)
       finish(c,o) 纸纹收尾（引擎每帧自动调；幕内设 env.finish = {paper, fiber} 0..1 调本帧强度；画了底图的帧叠底自动减弱）
 底图：CINE.platesReady（Promise，全部载入或 5 秒；只载入不解码，按幕预解码/释放，见「底图载入」注释）  plate(c,id,o) 画 AI 底图（屏幕坐标 cover 16:9；o.cam {x,y,zoom} 慢推慢移 | alpha | fade {id2,k} 同构图叠化 |
       grade {dark,warm,cool} ≤.35 轻调 | tint 'rgb(r,g,b)' 前景层整张改色、保留 alpha（按 id+tint 缓存，双线性取样，与不改色同价 ≈4ms）|
         layer:true + dx,dy,s 自由叠层（带 alpha 的 fg-* 与 cu-hands：随 cam 所在底图推移，再按画心缩放 s、平移 dx,dy，不夹边、可出画）| flip 'h' 整帧左右镜像（cam 仍按原图坐标）| fallback(c) 缺图时代画）  plateHas(id)  plateView(cam) 底图镜头→I.cam 参数（人物钉在底图上）  plateMist(c,t,o) 底图前 1–2 层淡洗雾带横移（视差；o.y h a rgb speed layers cam depth）
       人物站底图上：I.figure 传 plate:1（衣身/双袖淡墨 ≥ .75 不透云，外缘湿墨渗化与脚下洇痕）
   笔：stroke(c,pts,o) 湿笔（o.w a rgb wf k 书写进度…；新增 o.fade 浓淡 o.bleed 渗化 o.fb 收笔飞白 o.tex 笔毫丝理）
       sweep(c,pts,o) 大写意侧锋一笔（笔毫丝理+渗化+飞白，o.dry）  dry(c,pts,o) 枯笔飞白  blot(c,x,y,r,seed,o) 墨团路径  inkBlot(c,x,y,r,seed,o) 墨团（直接画）
       splat(c,x,y,r,seed,o) 墨点溅  bleed(c,x,y,r,seed,o) 墨滴晕开  spline resample normals
   景：mountains(c,o,dx,dy,k) 层层远山（o.peaks 一角半边）  ridgeFn(o)  tree(c,x,y,s,seed,o) 松/点叶  cun(c,x,y,w,h,o) 皴擦纹理铺块（配 clip）
       rock(c,topPts,o) 岩体（斧劈皴；o.under 底色 rgb；o.lite 提白倍率 o.liteRGB 提白色，夜景压山影用）  ledge(c,x0,x1,y,o) 崖顶石台  tower(c,x,y,s,o) 楼阁（界画）
       pillar(c,geo,x,y,k) 山柱  spiral(c,geo,x,y,s0,s1,o) 螺旋石阶  spiralAt(geo,x,y,s)→{x,y,depth}  pillarHW
       cloud(c,x,y,w,seed,o) 祥云  cloudBank(c,o) 云带  cloudSea(c,o) 云海  mist(c,y,h,a,t,seed,rgb,o) 雾带（o.edge 'soft' 关湿边）
       wind(c,o) 风线（o.beat 节奏）  stars(c,o) 星点  starRiver(c,o) 星河  motes(c,o) 光尘/千帆
   仙：streak(c,pts,o) 御剑流光/白虹  trail(fn,t,len,n) 轨迹采样  rune(c,x,y,s,seed,o) 符文  fu(c,x,y,s,seed,o) 符箓
       flow(c,pts,o) 逝水（o.k 可见长度）  sprout(c,x,y,s,k,seed,o) 草木抽芽  rift(c,x0,y0,x1,y1,k,seed,o) 撕天强光
       press(c,k,o) 四角墨压
   人：figure(c,p) 写意泼墨人物（字段见 I.KIND/I.POSE 上方注释；近景自动加笔墨细节，p.detail 强制 0..1，p.wash 衣身淡墨浓度，p.plate 站底图上；返回 sk：sk.hand/handB/headW/W(局部点)；a:0 时也返回 hand/handB（腕位））
       广袖随前臂方向自动变：下垂时袖底成帘；平举/上举时袖口朝下垂坠成袖角、袖底斜收回肘下（不再是圆兜），上举时前袖滑向肘、露出小臂；佩剑剑格为中式元宝形
       inkSil(c,draw,o) 大剪影水墨化：浓墨剪影 + 墨晕/纸纹 + 干笔飞白边 + 受光侧被丝理打断的轮廓光（全身、头肩、颈部特写通用；draw(L) 在层里画剪影、可返回处理框）
         o: box body tone lift mottle wash[[u,v,r,a]] side±1 paper fb halo seed rim{rgb,a,dx,dy,foot(脚下收光的身高比，缺省 .84，特写给 1)} ds 降采样倍率（大面积用 2）（详见函数注释）
       KIND 预设 yu ci he mw lu jl bg fh  |  POSE 姿态 stand walk lookUp shrug scratch point hush beat laugh handOnShoulder
       reach salute bowDeep holdHead sit meditate curl fly fist  |  pose(name,over)  lerpPose(a,b,k)  poseAt(t,[[t,pose]..])
       skeleton(p)  IK：p.ikF/ikB = [x,y] 局部 | {head|neck|hip:[dx,dy]}；p.ikFW/ikBW = 世界坐标
       bust(c,x,y,s,o) 半身特写（白描+淡墨+湿墨衣；o.style 'sil' 旧版剪影；o.look 1 侧影 → 0 背影：后脑不压扁、发髻居中）  hand(c,x,y,s,o) 白描手（press/open/reach/fist/point）  eye(c,x,y,s,o) 眼（cold/ice/gold/blood/glass）
       closeup(c,k,o,drawFn) 局部特写框
       masterHand(c,x,y,s,o) 主角之手（全片母题：白描淡墨+暖金逆光+宽袖；o.th 手轴 curl knuckle flip）  masterHandAnchor(tx,ty,s,o) 让中指尖落在接触点的腕位
       rimLine(c,pts,w,a,seed,lit) 暖金逆光轮廓线（顺时针走，朝光处亮；内部先按弧长等距重采样）
   字：vtext(c,str,x,y,o) 竖排逐字（o.times 每字时刻）  say(c,text,t,t0,t1,o) 横排台词（o.cut 话尾消散）  narr(c,text,t,t0,t1,o) 旁白
       nameTag(c,t,{name,role,x,y,t0,side,hold,dark,size,a,seed}) 人物题签（竖排名字 72px＋落款式身份 64px，3s 淡入/停/墨晕散；通常写进幕定义 tags 由引擎画）
       CINE._textLog 本帧已画出的 say/narr/tag 记录 [{kind,text,box}]（验收用）
       sing(c,'S4',t,lines,o) 按演唱段竖排唱出  CINE.songChars(id) / CINE.songLine(id,li) 逐字时刻（同源 audio.js，缺失均分）
       CINE.SONG_KEYS / SONG_PUNCT 唱词逐字表（占位为空；CINE.SONG_CUES 由 audio.js 给出演唱段）
   镜：cam(c,{x,y,z,rot,shake,t,seed})  camAt(t,keys)  par(cam,depth) 视差  shots(c,t,[{t,xf,draw}],env) 分镜交叉溶化
       freeze(t,a,len) 骤停一拍
   转：inkBleed(c,k,o) 墨晕转场——墨从 1–3 点在宣纸上洇开（纤维毛边、淡墨水晕），吃掉上一镜，再从另几处褪出下一镜。
       k 0..1 一次完整转场：k<.5 时先画上一镜、k≥.5 时先画下一镜，再调它叠墨（.5 满屏墨）。只洇满传 .5*e，只褪出传 .5+.5*e。
       o: seed（同 seed 同形）pts/pts2 洇开/褪开起点 [[x,y]..] 逻辑坐标 | mode 'ink' | 'wash' 水洗（淡墨化开露白纸，转入留白段）| a 浓度 rgb 墨色（到达场按 seed+pts 缓存，上限 20 个）
       例（幕内两镜在 t0 处墨晕换镜，前后各 .8s）：var k = (t - t0 + .8) / 1.6; (k < .5 ? shotA : shotB)(c, t); I.inkBleed(c, k, { seed: 5 });
   锚：CINE.ANCHOR 破晓“东方微白”位置（第一幕第 8 拍 = 第五幕第 4 拍，用 I.dawnLight 即同光同角）
 本片新增（lib-rig.js / lib-text.js / lib-flow.js / lib-fx.js / lib-ledger.js，速查见 docs/ENGINE-NOTES.md §7）：I.flow I.fxTex I.plateFlow I.rig I.kfseq I.plateSpace | I.sub I.chant I.note I.big I.seal I.sealColumn I.ledger |
       I.inner I.arrayVoice I.motes I.moteText I.slip I.line I.speakerDot（T05 文字样式）| I.ring I.ringPlan I.rings I.mind I.spineLight I.sunfire I.bloodTide I.turbid I.strata I.realm I.snap I.flash；拍式幕 beats:[{id,dur,draw}]；CINE.beatSheet(拍表) 自动导出拍 cue；env.img env.rig；?rig=ID 立绘调试面板
 调试：?t=秒（载入后停在该秒，开卷从这里播） ?to=秒（播到该秒自动暂停） ?cards=1（恢复幕名卡与幕间转场） ?mute=1 ?shot=1（跳过开卷、等字体与底图、同步 renderAt，标题写 SHOT-READY）?bench=1[&n=24]（各幕平均帧耗时 + 行尾 xf[…] 各幕边界转场帧耗时；boot 内同步跑，虚拟时间下也是真值）?beats=1（左上角显示当前拍号与拍内进度）
       window.__cine = { duration, acts:[{id,name,start,end,duration}], beats, seek, play, pause, renderAt, state, tags 全片题签, tagClash(T0,T1,step,full) 题签与字幕同帧的时刻 }  CINE.plateStats() 底图载入/在用/已请求解码/各幕清单与就绪
 音频：只经 acall() 调 CINE.audio.init/running/clock/scheduleFrom/stopAll/tick/LEAD（可选 wake/revivable：挂起后复活），缺失或抛错时静默。
 ========================================================================== */
(function () {
'use strict';
var CINE = window.CINE = window.CINE || {};
var W = 1920, H = 1080;
CINE.W = W; CINE.H = H;

/* ================= 数学与确定性随机 CINE.util ================= */
var U = CINE.util = {};
U.clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };
U.lerp = function (a, b, k) { return a + (b - a) * k; };
U.smooth = function (x) { x = U.clamp(x, 0, 1); return x * x * (3 - 2 * x); };
U.easeIn = function (x) { x = U.clamp(x, 0, 1); return x * x; };
U.easeOut = function (x) { x = U.clamp(x, 0, 1); return 1 - (1 - x) * (1 - x); };
U.easeInOut = function (x) { x = U.clamp(x, 0, 1); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
U.ramp = function (t, a, b) { return U.smooth((t - a) / (b - a)); };
U.win = function (t, a, b, fi, fo) {
  fi = fi == null ? .5 : fi; fo = fo == null ? fi : fo;
  return Math.min(U.ramp(t, a, a + fi), 1 - U.ramp(t, b, b + fo));
};
U.kf = function (t, keys, ease) {
  ease = ease || U.smooth;
  if (t <= keys[0][0]) return keys[0][1];
  for (var i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      var a = keys[i - 1], b = keys[i], k = ease((t - a[0]) / (b[0] - a[0]));
      if (typeof a[1] === 'number') return U.lerp(a[1], b[1], k);
      return a[1].map(function (v, j) { return U.lerp(v, b[1][j], k); });
    }
  }
  return keys[keys.length - 1][1];
};
/* 时间拉伸表：pairs [[新秒, 旧秒], ...]（两列都单调不减、分段线性）。幕加长后，旧镜头与旧提示表仍用旧秒书写，
   经 toOld(新秒) 取画面、toNew(旧秒) 排声音；表外按首末段平移外推。斜率 <1 的段是慢放（停顿），新写的段在幕文件里另画。 */
U.warp = function (pairs) {
  function map(x, a, b) {
    var n = pairs.length;
    if (x <= pairs[0][a]) return pairs[0][b] + x - pairs[0][a];
    for (var i = 1; i < n; i++) {
      var p = pairs[i - 1], q = pairs[i];
      if (x <= q[a]) return q[a] === p[a] ? p[b] : U.lerp(p[b], q[b], (x - p[a]) / (q[a] - p[a]));
    }
    return pairs[n - 1][b] + x - pairs[n - 1][a];
  }
  return { pairs: pairs, toOld: function (t) { return map(t, 0, 1); }, toNew: function (t) { return map(t, 1, 0); } };
};
/* 两张拉伸表串联：A 旧→中、B 中→新，得旧→新（再次加长时用） */
U.warpChain = function (A, B) {
  return { toOld: function (t) { return A.toOld(B.toOld(t)); }, toNew: function (t) { return B.toNew(A.toNew(t)); } };
};
U.fract = function (x) { return x - Math.floor(x); };
U.hash = function (n) {
  n = (n | 0) ^ 0x9e3779b9;
  n = Math.imul(n ^ (n >>> 16), 0x85ebca6b);
  n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
};
U.h2 = function (a, b) { return U.hash(Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663)); };
U.rng = function (seed) {
  var s = (seed * 2654435761) >>> 0;
  var f = function () {
    s = (s + 0x6D2B79F5) >>> 0;
    var r = Math.imul(s ^ (s >>> 15), 1 | s);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  f.range = function (a, b) { return a + (b - a) * f(); };
  f.pm = function (a) { return (f() * 2 - 1) * a; };
  return f;
};
U.noise1 = function (x, seed) {
  seed = seed | 0;
  var i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return U.lerp(U.h2(i, seed), U.h2(i + 1, seed), u) * 2 - 1;
};
U.noise2 = function (x, y, seed) {
  seed = seed | 0;
  var i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  var ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  var s = Math.imul(seed, 668265263);
  var a = U.h2(i + s, j), b = U.h2(i + 1 + s, j), c = U.h2(i + s, j + 1), d = U.h2(i + 1 + s, j + 1);
  return U.lerp(U.lerp(a, b, ux), U.lerp(c, d, ux), uy) * 2 - 1;
};
U.fbm1 = function (x, seed, oct) {
  var s = 0, a = .5, f = 1;
  for (var i = 0; i < (oct || 4); i++) { s += a * U.noise1(x * f, seed + i * 17); f *= 2.03; a *= .5; }
  return s;
};
U.fbm2 = function (x, y, seed, oct) {
  var s = 0, a = .5, f = 1;
  for (var i = 0; i < (oct || 4); i++) { s += a * U.noise2(x * f, y * f, seed + i * 31); f *= 2.01; a *= .5; }
  return s;
};
U.rgba = function (rgb, a) { return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + (a < 0 ? 0 : a > 1 ? 1 : a) + ')'; };
U.mix = function (c1, c2, k) { return [0, 1, 2].map(function (i) { return Math.round(U.lerp(c1[i], c2[i], k)); }); };

/* ================= 颜色（金=希望/暖光，青=冷光，血红=最省着用） ================= */
CINE.C = {
  paper: '#efe7d5', paperRGB: [239, 231, 213], whiteRGB: [250, 247, 238],
  ink: 'rgb(24,20,17)', inkRGB: [24, 20, 17], greyRGB: [92, 86, 80],
  gold: '#d9a441', goldRGB: [226, 170, 70], goldHiRGB: [250, 222, 150],
  qing: '#3e8f8a', qingRGB: [70, 160, 150], qingHiRGB: [170, 232, 222],
  blood: '#9b2a22', bloodRGB: [155, 42, 34],
  duskRGB: [214, 160, 104], nightRGB: [26, 29, 38], dawnRGB: [232, 226, 206]
};

/* 片名与片尾署名（正片文字由账本出；这两条是项目常量，留给尾声/标题使用） */
CINE.TITLE = '万古云霄';
CINE.CREDIT = '据减肥专家《问镜》第四卷《紫极》第五十三至七十二章改编 · 同好之作';

/* ================= 字体 ================= */
var FB = '"Kaiti SC","STKaiti","KaiTi","Songti SC",serif';
CINE.FONT = {
  poem: '"Ma Shan Zheng",' + FB,
  text: '"LXGW WenKai",' + FB,   // 台词/旁白/界面：霞鹜文楷（2026-10-11 由思源宋体换回，DESIGN-enhance-1011 §1）
  sword: '"Zhi Mang Xing",' + FB,
  wild: '"Zhi Mang Xing",' + FB,   // 狂草「去你妈的！」：志莽行书（与 sword 同；1011 用户反馈刘建毛草认不出）
  stele: '"WHZ WeiBei","Ma Shan Zheng",' + FB   // 碑刻：王汉宗中魏碑简体（GPL-2.0，子集只有「时不我待」），缺的字落到马善政
};
CINE.fontsReady = false;

/* ================= 底图载入与按幕解码（plates.js：window.CINE_PLATES = { id: dataURI }，须在 engine.js 之前载入） =================
   ① 启动只载入、不解码：每张建一个 <img>（只占编码数据，全片约 20MB）；缺失或载入失败静默跳过，不报错。
      CINE.platesReady：全部载入或 5 秒超时后 resolve（值为可用张数）。载入后的 <img> 任何时刻都同步可画（画时浏览器同步解码，
      与旧版逐像素一致）——?t= 跳转、__cine.renderAt、filmstrip 逐帧、各幕以底图算的缓存都拿得到真图，不会空帧。
   ② 只预解码当前幕与下一幕：进入第 k 幕时，对第 k、k+1 幕清单里的底图调 img.decode()（离主线程）。
   ③ 离开两幕以上即释放：在用（查询或画过）或已请求解码、而清单不在第 k−1…k+1 幕的底图，换一个只载入未解码的新 <img>
      （新图载入完才换下旧图、旧图 src=''、去掉引用，其间旧图照常可画），并清掉它的改色缓存（plateTint）。
      「在用」plateUsed 与「已请求解码」plateReq 分开记：首次查询只记在用，不挡后续窗口对它调 decode()。
   ④ 每幕清单静态声明（幕定义 plates 字段 / CINE_PLATE_ACTS，按幕 id；与播放历史无关，预热没跑完、?t= 直跳也齐全）。
      幕里用了新底图要同步补清单：drawFrame 里查到清单外 id 会
      console.warn 一次、记进 CINE.plateStats().miss，并临时并入该幕清单（下次换窗起生效）。CINE.plateStats() 调试。
   实测（headless Chrome，软件光栅）：旧版启动即 decode() 全部 51 张（解码尺寸 390MB），这份解码常驻、且不加速画布首画；
   画布自己的解码缓存按 <img> 另存一份，换掉 <img> 后要到内存吃紧才回收（JS 管不到这一层）。
   画布污染：data: URL 图片按规范属同源（CORS-same-origin），drawImage 后画布不被污染，getImageData/toDataURL 照常可用，
   ?bench 的逐帧像素回读不受影响（已在 file:// 下实测）。 */
var plates = {}, plateFrame = -1, plateCov = 0;
var plateSrc = window.CINE_PLATES && typeof window.CINE_PLATES === 'object' ? window.CINE_PLATES : {};
var plateUsed = {}, plateReq = {}, plateMiss = {}, plateSwap = {}, plateAct = -1, plateWin = -1, plateDec = 0, plateQuiet = false;
/* 每幕底图清单（数据驱动，引擎内不写死任何图名）：来源 ① 幕定义 plates:'id id …'（或数组）② window.CINE_PLATE_ACTS / CINE.PLATE_ACTS = { 幕id: 'id id …' }。
   两者取并集；都没有也行——查到清单外的 id 会 console.warn 一次并临时并入（见 plateImg）。 */
var plateDecl = {};
function plateDeclOf(a) {
  var m = plateDecl[a.id];
  if (m) return m;
  m = plateDecl[a.id] = {};
  [a.plates, window.CINE_PLATE_ACTS && window.CINE_PLATE_ACTS[a.id], CINE.PLATE_ACTS && CINE.PLATE_ACTS[a.id]].forEach(function (src) {
    if (!src) return;
    (Array.isArray(src) ? src : String(src).split(/\s+/)).forEach(function (id) { if (id) m[id] = 1; });
  });
  return m;
}
CINE.platesReady = (function () {
  var ids = Object.keys(plateSrc).filter(function (id) { return typeof plateSrc[id] === 'string' && plateSrc[id]; });
  if (!ids.length || typeof Image === 'undefined') return Promise.resolve(0);
  return new Promise(function (resolve) {
    var left = ids.length, n = 0, done = false;
    var fin = function () { if (!done) { done = true; resolve(n); } };
    ids.forEach(function (id) {
      var img = plates[id] = new Image();
      img.onload = function () { img.onload = img.onerror = null; if (img.naturalWidth) n++; if (--left === 0) fin(); };
      img.onerror = function () { img.onload = img.onerror = null; if (--left === 0) fin(); };
      img.src = plateSrc[id];
    });
    setTimeout(fin, 5000);
  });
})();
/* 第 k 幕清单：静态声明 ∪ 运行中查到的表外 id（id → 1） */
function plateList(k) {
  var a = acts[k], m = {}, id, s;
  if (!a) return m;
  s = plateDeclOf(a); for (id in s) m[id] = 1;
  s = plateMiss[a.id]; if (s) for (id in s) m[id] = 1;
  return m;
}
/* 进入第 k 幕：对 k、k+1 幕清单里尚未请求过的调 decode()；释放在用或已请求、而清单不在 k−1…k+1 幕的底图 */
function plateWindow(k) {
  plateWin = k;
  var keep = {}, id, j, m;
  for (j = k - 1; j <= k + 1; j++) { m = plateList(j); for (id in m) keep[id] = 1; }
  if (!plateQuiet) for (j = k; j <= k + 1; j++) { m = plateList(j); for (id in m) if (!plateReq[id]) plateDecode(id); }
  for (id in plateUsed) if (!keep[id]) plateDrop(id);
  for (id in plateReq) if (!keep[id]) plateDrop(id);
}
function plateDecode(id) {                               // plateReq[id].done：0 解码中 | 1 已解码 | -1 失败
  var im = plates[id];
  if (!im || typeof im.decode !== 'function' || !im.complete || !im.naturalWidth) return;   // 未载入：不记，下次换窗再请求
  var r = plateReq[id] = { done: 0 };
  plateDec++;
  im.decode().then(function () { plateDec--; r.done = 1; }, function () { plateDec--; r.done = -1; });
}
function plateDrop(id) {
  delete plateUsed[id]; delete plateReq[id];
  cacheDropPrefix('plateTint:' + id + ':');
  var old = plates[id];
  if (!old || plateSwap[id] || typeof Image === 'undefined') return;
  var n = plateSwap[id] = new Image();
  n.onload = function () {
    n.onload = n.onerror = null;
    if (plateSwap[id] !== n) return;
    delete plateSwap[id];
    if (plateUsed[id] || plateReq[id] || !n.naturalWidth) return;   // 换图途中又被用到或请求解码：留旧图（已解码）
    plates[id] = n; old.onload = old.onerror = null; old.src = '';
  };
  n.onerror = function () { n.onload = n.onerror = null; if (plateSwap[id] === n) delete plateSwap[id]; };
  n.src = plateSrc[id];
}
/* 调试：已载入张数、在用张数、已请求解码张数、两者合计解码尺寸、解码中张数、当前窗口；
   ready 当前幕与下一幕各「已解码/清单」张数；need 各幕清单张数；miss 各幕查到的表外 id */
CINE.plateStats = function () {
  var ld = 0, px = 0, hot = {}, need = {}, ready = {}, miss = {}, id, k, m, n, d;
  for (id in plates) if (plates[id].complete && plates[id].naturalWidth) ld++;
  for (id in plateUsed) hot[id] = 1;
  for (id in plateReq) hot[id] = 1;
  for (id in hot) if (plates[id]) px += plates[id].naturalWidth * plates[id].naturalHeight;
  for (k = 0; k < acts.length; k++) need[acts[k].id] = Object.keys(plateList(k)).length;
  for (k = plateWin; plateWin >= 0 && k <= plateWin + 1 && k < acts.length; k++) {
    m = plateList(k); n = 0; d = 0;
    for (id in m) if (plates[id]) { n++; if (plateReq[id] && plateReq[id].done === 1) d++; }
    ready[acts[k].id] = d + '/' + n;
  }
  for (k in plateMiss) miss[k] = Object.keys(plateMiss[k]);
  return { loaded: ld, used: Object.keys(plateUsed).length, req: Object.keys(plateReq).length, hotMB: Math.round(px * 4 / 1048576),
    decoding: plateDec, win: plateWin, ready: ready, need: need, miss: miss };
};

/* ================= 离屏缓存 ================= */
CINE.px = 1;              // 逻辑单位 → 设备像素
/* U.cached 是 LRU：Map 保序，命中即移到队尾；条目数与像素总量双上限，超限从队首逐出。
   本帧用过的条目不逐出（同帧工作集超限时临时超额，不抖动）。build 必须是参数的纯函数（种子随机），逐出后重建画面不变。
   另按幕窗淘汰（cacheWindow）：条目与全屏层记下用过它的幕（位掩码 m / layerM），换幕时丢掉不再用的，放完全片不累积。 */
var caches = new Map(), layers = {}, layerM = {}, cacheFrame = 0, cachePx = 0, cacheMiss = 0, cacheAct = -1, cacheWin = -1;
var CACHE_MAX_N = 1200, CACHE_MAX_SCREENS = 40, CACHE_COSTLY = 15;   // CACHE_COSTLY：建造耗时 ≥ 此毫秒数的条目逐出时排在最后（PERF O2）         // 条目上限；像素上限 = 40 张全屏画布（DPR1 约 330MB）
U.canvas = function (w, h) {
  var c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  return c;
};
function cacheOver() { return caches.size > CACHE_MAX_N || cachePx > CACHE_MAX_SCREENS * W * H * CINE.px * CINE.px; }
U.cached = function (key, build) {
  var k = key + '@' + CINE.px.toFixed(3), e = caches.get(k);
  if (e) { caches.delete(k); caches.set(k, e); e.f = cacheFrame; if (cacheAct >= 0) e.m |= 1 << cacheAct; return e.v; }
  var b0 = performance.now(), v = build(CINE.px); cacheMiss++;
  e = { v: v, f: cacheFrame, px: v && v.getContext && v.width ? v.width * v.height : 0, m: cacheAct >= 0 ? 1 << cacheAct : 0, c: performance.now() - b0 };
  caches.set(k, e); cachePx += e.px;
  if (cacheOver()) {
    var it, n, old;
    /* PERF O2：先逐出「便宜」的条目（建造 < CACHE_COSTLY ms），建一次就要几十毫秒的大件（整幅底图加工、长卷段）留到最后才逐出，
       开卷预热建好的它们播到时还在，不在命中点上现建卡一下。建造耗时只影响逐出顺序；build 是纯函数，画面与逐出与否无关 */
    it = caches.keys();
    while (cacheOver() && !(n = it.next()).done) {
      old = caches.get(n.value);
      if (old.f === cacheFrame) break;                   // 队首已是本帧用过的：其后更新，全留
      if (old.c >= CACHE_COSTLY) continue;
      caches.delete(n.value); cachePx -= old.px;
    }
    it = caches.keys();
    while (cacheOver() && !(n = it.next()).done) {       // 只剩大件仍超限：按原 LRU 顺序逐出
      old = caches.get(n.value);
      if (old.f === cacheFrame) break;
      caches.delete(n.value); cachePx -= old.px;
    }
  }
  return v;
};
U.clearCache = function () { caches = new Map(); cachePx = 0; layers = {}; layerM = {}; };
/* 换幕淘汰：进入第 k 幕时，丢掉只在第 k−1 幕之前用过的缓存条目（精灵），以及只在 k−1…k+1 幕之外用过的全屏层
   （层每次取用都清空，重建只花一次分配）。m=0（drawFrame 外建的）不参与。片尾→片头倒序预热不会淘汰任何精灵；
   往回跳、重看时被淘汰的按需重建（build 是纯函数，画面不变）。 */
function cacheWindow(k) {
  cacheWin = k;
  var keep = ~((1 << Math.max(0, k - 1)) - 1), near = 0, j, nm;
  for (j = Math.max(0, k - 1); j <= k + 1; j++) near |= 1 << j;
  caches.forEach(function (e, key) { if (e.m && !(e.m & keep)) { caches.delete(key); cachePx -= e.px; } });
  for (nm in layers) if (layerM[nm] && !(layerM[nm] & near)) { delete layers[nm]; delete layerM[nm]; }
}
function cacheDropPrefix(pre) {                          // 逐出键以 pre 开头的缓存条目（释放底图时连带清掉它的改色层）
  var ks = [];
  caches.forEach(function (e, k) { if (k.indexOf(pre) === 0) ks.push(k); });
  ks.forEach(function (k) { cachePx -= caches.get(k).px; caches.delete(k); });
}
/* 调试：缓存条目数、像素（百万）、累计新建次数 */
CINE.cacheStats = function () { return { n: caches.size, mpx: +(cachePx / 1e6).toFixed(1), miss: cacheMiss, layers: Object.keys(layers).length }; };
/* 精灵着色量化：每通道 1/20 档；CINE.C 调色板原色保持精确。逐帧渐变的颜色只落在有限几档上，精灵不再每帧重建 */
var QSTEP = 255 / 20, palette = null;
function qv(v) { return Math.round(U.clamp(Math.round(v / QSTEP) * QSTEP, 0, 255)); }
function qrgb(rgb) {
  if (!palette) { palette = {}; for (var n in CINE.C) if (/RGB$/.test(n)) palette[CINE.C[n].join(',')] = 1; }
  return palette[rgb[0] + ',' + rgb[1] + ',' + rgb[2]] ? rgb : [qv(rgb[0]), qv(rgb[1]), qv(rgb[2])];
}
U.qrgb = qrgb;
function q40(v) { return Math.round(v * 40) / 40; }      // 精灵的浓淡参数量化到 1/40
/* 全屏离屏层（按名复用，尺寸随画布）：返回已清空、已设好逻辑坐标变换的 ctx */
U.layer = function (name) {
  var w = Math.round(W * CINE.px), h = Math.round(H * CINE.px), L = layers[name];
  if (!L || L.width !== w || L.height !== h) { L = layers[name] = U.canvas(w, h); }
  if (cacheAct >= 0) layerM[name] = (layerM[name] || 0) | 1 << cacheAct;
  var x = L.getContext('2d');
  x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
  x.clearRect(0, 0, w, h);
  x.setTransform(CINE.px, 0, 0, CINE.px, 0, 0);
  return x;
};
/* 可重入离屏层：同名层嵌套使用时（如一幕在自己的 soft/shots 里重放另一幕的 draw）按嵌套深度分配独立画布。
   acquire 与 release 必须成对（引擎内部用 try/finally）；每帧开头自动归零 */
var layerDepth = {};
U.layerAcquire = function (name) { var d = (layerDepth[name] || 0) + 1; layerDepth[name] = d; return U.layer(d > 1 ? name + '#' + d : name); };
U.layerRelease = function (name) { if (layerDepth[name] > 0) layerDepth[name]--; };

/* ================= 笔墨工具库 CINE.ink ================= */
var I = CINE.ink = {};

/* 缩放采样模糊（替代 ctx.filter） */
I.blur = function (src, passes) {
  var c = src, w = src.width, h = src.height, list = [];
  for (var i = 0; i < passes; i++) {
    w = Math.max(2, w >> 1); h = Math.max(2, h >> 1);
    var n = U.canvas(w, h), x = n.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(c, 0, 0, w, h); list.push(n); c = n;
  }
  for (var j = list.length - 2; j >= -1; j--) {
    var tgt = j >= 0 ? list[j] : U.canvas(src.width, src.height);
    var tx = tgt.getContext('2d');
    tx.clearRect(0, 0, tgt.width, tgt.height);
    tx.imageSmoothingEnabled = true; tx.imageSmoothingQuality = 'high';
    tx.drawImage(c, 0, 0, tgt.width, tgt.height); c = tgt;
  }
  return c;
};

/* ---------- 宣纸 ---------- */
/* 纸浆云絮：低频浓淡（暖褐与留白两色），小图放大 */
function paperMottle(seed, dark, light) {
  var nw = 160, nh = 90, n = U.canvas(nw, nh), nx = n.getContext('2d'), id = nx.createImageData(nw, nh), d = id.data;
  for (var j = 0; j < nh; j++) for (var i = 0; i < nw; i++) {
    var v = U.fbm2(i / 30, j / 20, seed, 4) + .12 * U.noise2(i / 4, j / 5, seed + 9), k = (j * nw + i) * 4, c = v > 0 ? dark : light;
    d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = U.clamp(Math.abs(v) * c[3], 0, 255);
  }
  nx.putImageData(id, 0, 0);
  return n;
}
/* 纤维：短绒、长丝、偶有成团；col(r) → css 颜色 */
function paperFibers(x, w, h, px, r, n, col) {
  x.lineCap = 'round';
  for (var f = 0; f < n; f++) {
    var fx = r() * w, fy = r() * h, lg = r() < .08, L = (lg ? 40 + r() * 90 : 5 + r() * 24) * px, a = r() * Math.PI * 2, b = a + r.pm(lg ? 1.4 : .9);
    x.strokeStyle = col(r, lg);
    x.lineWidth = (lg ? .35 + r() * .5 : .4 + r() * .8) * px;
    x.beginPath(); x.moveTo(fx, fy);
    x.bezierCurveTo(fx + Math.cos(a) * L * .4, fy + Math.sin(a) * L * .4, fx + Math.cos(b) * L * .7, fy + Math.sin(b) * L * .7, fx + Math.cos(b + r.pm(.6)) * L, fy + Math.sin(b + r.pm(.6)) * L);
    x.stroke();
  }
}
I.paperCanvas = function () {
  return U.cached('paper', function (px) {
    var w = Math.round(W * px), h = Math.round(H * px);
    var c = U.canvas(w, h), x = c.getContext('2d');
    x.fillStyle = CINE.C.paper; x.fillRect(0, 0, w, h);
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(paperMottle(7, [150, 120, 80, 40], [255, 252, 240, 60]), 0, 0, w, h);
    var r = U.rng(11);
    paperFibers(x, w, h, px, r, 5200, function (r, lg) {
      return r() < .55 ? 'rgba(120,96,64,' + (lg ? .04 + r() * .05 : .03 + r() * .06) + ')' : 'rgba(255,252,240,' + (.1 + r() * .16) + ')';
    });
    for (var l = 0; l < h; l += 26 * px) {                   // 帘纹：极淡的横向竹帘印
      x.fillStyle = 'rgba(140,112,76,.018)'; x.fillRect(0, l + r() * 3 * px, w, px * (1 + r()));
    }
    for (var g = 0; g < 14000; g++) {
      x.fillStyle = r() < .5 ? 'rgba(90,70,45,.07)' : 'rgba(255,250,235,.11)';
      x.fillRect(r() * w, r() * h, px * (.5 + r()), px * (.5 + r()));
    }
    return c;
  });
};
/* 满屏铺宣纸（忽略当前变换） */
I.paper = function (c, a) {
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
  if (a != null) c.globalAlpha *= a;
  c.drawImage(I.paperCanvas(), 0, 0);
  c.restore();
};
/* 收尾（engine 每帧自动调用，幕内无需调用）：
   ① 正片叠底：纸纹 + 暗角（亮处见纸）；② 滤色：浅色纤维与纸浆（浓墨处仍透出纸感——夜景是浓墨宣纸，不是黑底）
   o（可缺省）：paper 叠底强度 0..1，fiber 滤色强度 0..1（缺省均 1）。幕内设 env.finish = {…} 即作用于本帧（每帧复位）；
   画了底图（I.plate）的帧，底图自带纸纹，叠底缺省按底图不透明度自动减弱（全不透明时 .45；env.finish 显式给 paper 时以其为准） */
I.finish = function (c, o) {
  var mul = U.cached('finishMul', function (px) {
    var w = Math.round(W * px), h = Math.round(H * px);
    var o = U.canvas(w, h), x = o.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
    x.globalAlpha = .42; x.drawImage(I.paperCanvas(), 0, 0); x.globalAlpha = 1;
    var g = x.createRadialGradient(w / 2, h / 2, h * .38, w / 2, h / 2, h * 1.05);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.6, 'rgba(200,180,150,.14)'); g.addColorStop(1, 'rgba(110,90,66,.4)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    return o;
  });
  var scr = U.cached('finishScr', function (px) {
    var w = Math.round(W * px), h = Math.round(H * px);
    var o = U.canvas(w, h), x = o.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(paperMottle(19, [0, 0, 0, 0], [226, 214, 190, 44]), 0, 0, w, h);
    var r = U.rng(29);                                     // 纤维与颗粒压淡（原 .025–.08 / .04–.12）：浓墨夜景里不再发亮
    paperFibers(x, w, h, px, r, 2600, function (r, lg) { return 'rgba(236,226,204,' + (lg ? .011 + r() * .014 : .014 + r() * .022) + ')'; });
    for (var g = 0; g < 22000; g++) {
      x.fillStyle = 'rgba(232,222,200,' + (.028 + r() * .05) + ')';
      x.fillRect(r() * w, r() * h, px * (.6 + r() * 1.2), px * (.6 + r() * 1.2));
    }
    return o;
  });
  o = o || {};
  var kp = U.clamp(o.paper != null ? o.paper : 1 - .55 * (plateFrame === cacheFrame ? plateCov : 0), 0, 1), kf = U.clamp(o.fiber == null ? 1 : o.fiber, 0, 1);
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'multiply'; c.globalAlpha = kp; if (kp > .003) c.drawImage(mul, 0, 0);
  c.globalCompositeOperation = 'screen'; c.globalAlpha = kf; if (kf > .003) c.drawImage(scr, 0, 0);
  c.restore();
};

/* ---------- 晕染与光 ---------- */
/* 晕染蒙版（与颜色无关，12 种形）：wet 湿边——不规则外缘、墨在边缘淤积成水渍线、缘外纤维状渗化；
   否则 soft 柔晕——轮廓同样不规则，由浓到淡缓缓化开，只有一道极淡的水渍。 */
var washMasks = {};
function washMask(i, wet) {
  var key = i + (wet ? 'w' : 's');
  if (washMasks[key]) return washMasks[key];
  var S = 160, c = U.canvas(S, S), x = c.getContext('2d'), id = x.createImageData(S, S), d = id.data;
  var sd = 101 + i * 37, r = U.rng(sd), ex = r.pm(.07), ey = r.pm(.05);
  for (var j = 0; j < S; j++) for (var q = 0; q < S; q++) {
    var dx = (q + .5) / S * 2.1 - 1.05 - ex, dy = (j + .5) / S * 2.1 - 1.05 - ey, rr = Math.hypot(dx, dy) + 1e-6, cx = dx / rr, cy = dy / rr;
    var R = .72 + .13 * U.noise2(cx * 1.2 + 5, cy * 1.2 + 5, sd) + .05 * U.noise2(cx * 3.5 + 9, cy * 3.5 + 9, sd + 1);
    var u = rr / R, mott = 1 + .22 * U.noise2(dx * 4, dy * 4, sd + 2) + .1 * U.noise2(dx * 11, dy * 11, sd + 4), a;
    if (wet) {
      if (u < 1) a = (.5 + .22 * (1 - u) + .34 * Math.exp(-Math.pow((u - .95) / .06, 2))) * mott * U.clamp((1 - u) / .025, 0, 1);
      else a = .2 * Math.exp(-(u - 1) / .05) * Math.max(0, U.noise2(Math.atan2(dy, dx) * 9, u * 3, sd + 5));
    } else {
      a = (Math.exp(-u * u * 2.4) - Math.exp(-2.4 * 1.15)) / (1 - Math.exp(-2.4 * 1.15));
      a = Math.max(0, a) * mott + .08 * Math.exp(-Math.pow((u - .86) / .07, 2));
    }
    a *= U.clamp(Math.min(q, S - 1 - q, j, S - 1 - j) / (S * .07), 0, 1);   // 贴边 7% 渐到 0：湿边外缘的淡水渍原来能摸到精灵边框，在底图上大尺寸叠出矩形硬边（I.bleed 外圈）
    var k = (j * S + q) * 4; d[k] = d[k + 1] = d[k + 2] = 0; d[k + 3] = U.clamp(a * 255, 0, 255);
  }
  x.putImageData(id, 0, 0);
  washMasks[key] = c;
  return c;
}
/* 着色晕染精灵：i 形号(0..11)，wet 湿边（缺省：深色湿边、浅色柔晕） */
I.washSprite = function (i, rgb, wet) {
  if (wet == null) wet = rgb[0] * .3 + rgb[1] * .59 + rgb[2] * .11 < 150;
  rgb = qrgb(rgb);
  return U.cached('wash' + i + (wet ? 'w' : 's') + rgb.join(','), function () {
    var m = washMask(i, wet), c = U.canvas(m.width, m.height), x = c.getContext('2d');
    x.drawImage(m, 0, 0); x.globalCompositeOperation = 'source-in';
    x.fillStyle = U.rgba(rgb, 1); x.fillRect(0, 0, c.width, c.height);
    return c;
  });
};
I.blobSprite = function (seed, rgb) { return I.washSprite(((seed | 0) % 12 + 12) % 12, rgb); };
/* 晕染一团：中心 (x,y)，半径 rw×rh，rot 旋转。o（新增，可缺省）: edge 'wet'|'soft'（缺省按颜色：深色湿边、浅色柔晕） */
I.wash = function (c, x, y, rw, rh, alpha, seed, rgb, rot, o) {
  if (alpha <= 0.003) return;
  rgb = rgb || CINE.C.inkRGB;
  var s = I.washSprite(((seed || 1) % 12 + 12) % 12, rgb, o && o.edge ? o.edge === 'wet' : null), f = 1.05;
  c.save(); c.globalAlpha *= Math.min(1, alpha);
  if (rot) { c.translate(x, y); c.rotate(rot); c.drawImage(s, -rw * f, -rh * f, rw * 2 * f, rh * 2 * f); }
  else c.drawImage(s, x - rw * f, y - rh * f, rw * 2 * f, rh * 2 * f);
  c.restore();
};
I.glowSprite = function (rgb) {
  rgb = qrgb(rgb);
  return U.cached('glow' + rgb.join(','), function () {
    var S = 128, c = U.canvas(S, S), x = c.getContext('2d');
    var g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, U.rgba(rgb, 1)); g.addColorStop(.18, U.rgba(rgb, .55));
    g.addColorStop(.45, U.rgba(rgb, .16)); g.addColorStop(1, U.rgba(rgb, 0));
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    return c;
  });
};
/* 光晕：mode 默认 'lighter'（叠加发光）；浅底上可传 'source-over' */
I.glow = function (c, x, y, r, rgb, alpha, mode) {
  if (alpha <= 0.003) return;
  c.save(); c.globalAlpha *= Math.min(1, alpha); c.globalCompositeOperation = mode || 'lighter';
  c.drawImage(I.glowSprite(rgb), x - r, y - r, r * 2, r * 2);
  c.restore();
};

/* 渗化噪声蒙版（低分辨率，按尺寸缓存）：外晕乘上它，边缘就不齐、不像发光 */
function bleedNoise(bw, bh) {
  return U.cached('bleedNoise' + bw + 'x' + bh, function () {
    var c = U.canvas(bw, bh), x = c.getContext('2d'), id = x.createImageData(bw, bh), d = id.data;
    for (var j = 0; j < bh; j++) for (var i = 0; i < bw; i++) {
      var v = .45 + .9 * U.fbm2(i / 7, j / 7, 57, 3) + .35 * U.noise2(i / 1.6, j / 2.4, 58), k = (j * bw + i) * 4;
      d[k] = d[k + 1] = d[k + 2] = 0; d[k + 3] = U.clamp(v * 255, 0, 255);
    }
    x.putImageData(id, 0, 0);
    return c;
  });
}
/* 柔边（墨的洇化）：把 draw(ctx) 画进离屏层，① 垫一层边缘不齐的模糊副本（外渗），② 叠清晰本体，③ 边缘内侧再压一道水渍（墨在湿边淤积）。
   用于大尺寸人物/特写，让边缘不像矢量图。o: halo 外渗浓度(.5), spread 模糊倍数(4), a 整体透明(可做淡入淡出), layer 离屏层名, rim 湿边水渍浓度(.35，0 关) */
I.soft = function (c, draw, o) {
  o = o || {};
  var nm = o.layer || 'soft', L = U.layerAcquire(nm);
  try { softBody(c, draw, o, nm, L); } finally { U.layerRelease(nm); }
};
function softBody(c, draw, o, nm, L) {
  L.setTransform(c.getTransform());
  draw(L);
  var cv = L.canvas, sp = Math.max(1, Math.round((o.spread || 4) * 5) / 5), bw = Math.ceil(cv.width / sp), bh = Math.ceil(cv.height / sp);   // spread 量化到 0.2 档（缓存按它建）
  var sm = U.cached('softSmall:' + nm + sp, function () { return U.canvas(bw, bh); });
  var sx = sm.getContext('2d'); sx.clearRect(0, 0, bw, bh); sx.imageSmoothingEnabled = true; sx.drawImage(cv, 0, 0, bw, bh);
  var bm = U.cached('softBleed:' + nm + sp, function () { return U.canvas(bw, bh); }), bx = bm.getContext('2d');
  bx.globalCompositeOperation = 'source-over'; bx.clearRect(0, 0, bw, bh); bx.drawImage(sm, 0, 0);
  bx.globalCompositeOperation = 'destination-in'; bx.drawImage(bleedNoise(bw, bh), 0, 0);
  var A = (o.a == null ? 1 : o.a) * c.globalAlpha, rim = o.rim == null ? .35 : o.rim;      // 与外层 alpha 相乘
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = true;
  c.globalAlpha = (o.halo == null ? .5 : o.halo) * A;
  c.drawImage(bm, -sp * .75, -sp * .5, cv.width + sp * 1.5, cv.height + sp);
  c.globalAlpha = A;
  c.drawImage(cv, 0, 0);
  if (rim > 0) {
    var R = U.layerAcquire(nm + 'Rim');
    try {
      R.setTransform(1, 0, 0, 1, 0, 0); R.drawImage(cv, 0, 0);
      R.globalCompositeOperation = 'destination-out'; R.globalAlpha = .9; R.imageSmoothingEnabled = true; R.drawImage(sm, 0, 0, cv.width, cv.height);
      c.globalAlpha = A * rim; c.drawImage(R.canvas, 0, 0);
    } finally { U.layerRelease(nm + 'Rim'); }
  }
  c.restore();
}
/* ---------- 笔触 ---------- */
I.resample = function (pts, n) {
  var L = [0], i;
  for (i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  var tot = L[L.length - 1] || 1, out = [], j = 1;
  for (var k = 0; k < n; k++) {
    var s = k / (n - 1) * tot;
    while (j < pts.length - 1 && L[j] < s) j++;
    var a = pts[j - 1], b = pts[j] || a, seg = (L[j] - L[j - 1]) || 1, f = (s - L[j - 1]) / seg;
    out.push([U.lerp(a[0], b[0], f), U.lerp(a[1], b[1], f)]);
  }
  out.len = tot;
  return out;
};
/* Catmull-Rom：过控制点的平滑曲线 */
I.spline = function (ctrl, per) {
  per = per || 10;
  if (ctrl.length < 3) return ctrl.slice();
  var out = [], P = [ctrl[0]].concat(ctrl, [ctrl[ctrl.length - 1]]);
  for (var i = 1; i < P.length - 2; i++) {
    for (var k = 0; k < per; k++) {
      var t = k / per, t2 = t * t, t3 = t2 * t;
      var f = function (d) {
        return .5 * ((2 * P[i][d]) + (-P[i - 1][d] + P[i + 1][d]) * t + (2 * P[i - 1][d] - 5 * P[i][d] + 4 * P[i + 1][d] - P[i + 2][d]) * t2 + (-P[i - 1][d] + 3 * P[i][d] - 3 * P[i + 1][d] + P[i + 2][d]) * t3);
      };
      out.push([f(0), f(1)]);
    }
  }
  out.push(ctrl[ctrl.length - 1]);
  return out;
};
function normals(p) {
  var n = [];
  for (var i = 0; i < p.length; i++) {
    var a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)];
    var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    n.push([-dy / l, dx / l]);
  }
  return n;
}
I.normals = normals;
function lumOf(rgb) { return rgb[0] * .3 + rgb[1] * .59 + rgb[2] * .11; }
/* 当前变换下 1 逻辑单位 = 多少设备像素 */
function scaleOf(c) { var m = c.getTransform(); return Math.sqrt(m.a * m.a + m.b * m.b) || 1; }
I.scaleOf = scaleOf;
/* 湿笔：起笔顿、行笔微颤、收笔尖；深色墨默认：起笔浓收笔淡（fade）、边缘一圈淡墨渗化（bleed）。
   o: w 宽, a 透明, rgb, seed, head/tail 起收笔比例, wf(s)→宽度倍率（给定则取代 head/tail）,
      press(s) 额外按压, wob 颤动(默认 .18), raw 不做样条, n 采样数, mode 合成模式, k 0..1 只画前 k 段（书写动画）,
      fill 直接指定填充, fade 浓淡落差 0..1（深色缺省 .3）, bleed 渗化外缘浓度（深色缺省 .2，0 关）, fb 收笔飞白比例 0..1（缺省 0）,
      tex 笔毫丝理 0..1（缺省 0；I.sweep 缺省 1） */
I.stroke = function (c, ctrl, o) {
  o = o || {};
  var p = I.resample(o.raw ? ctrl : I.spline(ctrl, 8), o.n || 40);
  if (o.k != null) { var kk = U.clamp(o.k, 0, 1); if (kk <= 0) return p; p = p.slice(0, Math.max(2, Math.ceil(p.length * kk))); }
  var nm = normals(p), n = p.length;
  var w = o.w || 6, seed = o.seed || 1, head = o.head == null ? .12 : o.head, tail = o.tail == null ? .35 : o.tail;
  var wob = o.wob == null ? .18 : o.wob, L = [], R = [], HW = [];
  for (var i = 0; i < n; i++) {
    var s = i / (n - 1);
    var prof = o.wf ? o.wf(s) : (head > 0 ? Math.min(1, Math.pow(s / head, .6)) : 1) * (tail > 0 ? Math.min(1, Math.pow((1 - s) / tail, .8)) : 1);   // head/tail ≤0：不收笔（免 0/0 = NaN 丢点）
    if (o.press) prof *= o.press(s);
    var ww = w * .5 * Math.max(0, prof) * (1 + wob * U.noise1(s * 7, seed));
    var off = .12 * w * U.noise1(s * 3, seed + 5) * (wob / .18);
    HW.push(ww);
    L.push([p[i][0] + nm[i][0] * (ww + off), p[i][1] + nm[i][1] * (ww + off)]);
    R.push([p[i][0] - nm[i][0] * (ww - off), p[i][1] - nm[i][1] * (ww - off)]);
  }
  var rgb = o.rgb || CINE.C.inkRGB, A = o.a == null ? .9 : o.a, dark = !o.fill && lumOf(rgb) < 110;
  var fb = o.fb > 0 ? U.clamp(o.fb, 0, .9) : 0, m = fb ? Math.max(1, Math.round((n - 1) * (1 - fb))) : n - 1;
  var sc = scaleOf(c), wpx = w * sc;
  c.save();
  if (o.mode) c.globalCompositeOperation = o.mode;
  var poly = function (e, sd) {
    c.beginPath();
    for (var j = 0; j <= m; j++) {
      var ee = e ? e * (1 + .7 * U.noise1(j * .9, sd)) : 0, X = L[j][0] + nm[j][0] * ee, Y = L[j][1] + nm[j][1] * ee;
      if (j) c.lineTo(X, Y); else c.moveTo(X, Y);
    }
    for (j = m; j >= 0; j--) { var e2 = e ? e * (1 + .7 * U.noise1(j * .9 + 40, sd)) : 0; c.lineTo(R[j][0] - nm[j][0] * e2, R[j][1] - nm[j][1] * e2); }
    c.closePath();
  };
  var bl = o.bleed == null ? (dark && !o.mode ? .2 : 0) : o.bleed;
  if (bl > 0 && wpx > 2.5 && m > 1) {                      // 渗化：略宽、边缘起伏的淡墨
    c.fillStyle = U.rgba(rgb, A * bl); poly(Math.max(.9 / sc, w * .1), seed + 11); c.fill();
  }
  var fd = o.fade == null ? (dark && !o.mode ? .3 : 0) : o.fade, tex = o.tex > 0 && !o.fill ? Math.min(1, o.tex) : 0, A0 = A * (1 - .3 * tex);
  if (o.fill) c.fillStyle = o.fill;
  else if (fd > 0 && m > 1 && Math.hypot(p[m][0] - p[0][0], p[m][1] - p[0][1]) > w * .5) {   // 浓淡：蘸墨处浓，行笔渐淡（首尾重合的闭合笔不做）
    var g = c.createLinearGradient(p[0][0], p[0][1], p[m][0], p[m][1]);
    g.addColorStop(0, U.rgba(rgb, A0)); g.addColorStop(1, U.rgba(rgb, A0 * (1 - fd)));
    c.fillStyle = g;
  } else c.fillStyle = U.rgba(rgb, A0);
  poly(0); c.fill();
  if (tex && m > 1) {                                       // 笔毫丝理：沿行笔方向铺一层鬃毫纹
    var pat = I.bristlePattern((seed >>> 0) % 4, rgb), ang = Math.atan2(p[m][1] - p[0][1], p[m][0] - p[0][0]), ts = Math.max(w, 1e-4) / 64;
    pat.setTransform(new DOMMatrix().translateSelf(p[0][0], p[0][1]).rotateSelf(ang * 57.29578).scaleSelf(ts * 2.4, ts).translateSelf(0, -32 + 11 * (seed % 5)));
    c.globalAlpha *= tex * .75 * A; c.fillStyle = pat; poly(0); c.fill(); c.globalAlpha /= tex * .75 * A;
  }
  if (fb && m < n - 1) {                                    // 飞白：收笔处墨尽，笔毫分叉露白
    var hairs = Math.max(4, Math.min(11, Math.round(wpx / 3)));
    c.lineCap = 'round';
    for (var h = 0; h < hairs; h++) {                       // 鬃毫粗细、位置、枯尽处各不相同
      var hs = seed * 131 + h * 7, kq = U.clamp((h + .5) / hairs * 2 - 1 + (U.hash(hs + 2) - .5) * 1.2 / hairs, -1, 1), pen = false, life = .45 + .55 * U.hash(hs + 5);
      c.strokeStyle = o.fill || U.rgba(rgb, A * (1 - fd * .9) * (.6 + .4 * U.hash(hs + 3)));
      c.lineWidth = Math.max(.6 / sc, 2 * HW[m] / hairs * (.45 + 1.4 * U.hash(hs)));
      c.beginPath();
      for (i = m; i < n; i++) {
        var q = (i - m) / Math.max(1, n - 1 - m), ok = q < life && U.noise1(q * (3 + 6 * U.hash(hs + 1)) + h * 2.3, hs) * .5 + .5 > q * .7 + Math.abs(kq) * .2;
        var off2 = kq * HW[i], X = p[i][0] + nm[i][0] * off2, Y = p[i][1] + nm[i][1] * off2;
        if (ok) { if (!pen) { c.moveTo(X, Y); pen = true; } else c.lineTo(X, Y); } else pen = false;
      }
      c.stroke();
    }
  }
  c.restore();
  return p;
};
/* 枯笔 / 飞白：多根鬃毫，墨随笔程渐枯，每根浓淡不一。o: w, a, rgb, seed, dry(0..1), hairs, n, raw, mode, k */
I.dry = function (c, ctrl, o) {
  o = o || {};
  var p = I.resample(o.raw ? ctrl : I.spline(ctrl, 8), o.n || 48);
  if (o.k != null) { var kk = U.clamp(o.k, 0, 1); if (kk <= 0) return; p = p.slice(0, Math.max(2, Math.ceil(p.length * kk))); }
  var nm = normals(p), n = p.length, rgb = o.rgb || CINE.C.inkRGB, A = o.a == null ? .85 : o.a;
  var w = o.w || 10, seed = o.seed || 3, dry = o.dry == null ? .5 : o.dry, hairs = o.hairs || Math.max(6, Math.round(w / 1.3));
  c.save();
  c.lineCap = 'round';
  if (o.mode) c.globalCompositeOperation = o.mode;
  for (var h = 0; h < hairs; h++) {
    var k = (h / (hairs - 1)) * 2 - 1, hs = seed * 131 + h * 7;
    c.strokeStyle = U.rgba(rgb, A * (.55 + .45 * U.hash(hs + 3)));
    c.lineWidth = Math.max(w * .04, w / hairs * (.9 + .5 * U.hash(hs)));
    c.beginPath();
    var pen = false;
    for (var i = 0; i < n; i++) {
      var s = i / (n - 1);
      var taper = Math.min(1, s / .08) * Math.min(1, (1 - s) / .2);
      var gap = U.noise1(s * (4 + 4 * U.hash(hs + 1)) + h * 3.1, hs) * .5 + .5;
      var thresh = dry * (.25 + s * .9) + Math.abs(k) * .25 * dry;
      var on = gap > thresh && taper > .05;
      var off = k * w * .5 * (.35 + .65 * taper);
      var x = p[i][0] + nm[i][0] * off, y = p[i][1] + nm[i][1] * off;
      if (on) { if (!pen) { c.moveTo(x, y); pen = true; } else c.lineTo(x, y); }
      else pen = false;
    }
    c.stroke();
  }
  c.restore();
};
/* 笔毫纹理（与颜色无关，4 种）：x 为行笔方向的鬃毫丝理，偶有露白细缝；两向皆可无缝平铺 */
var bristleMasks = {};
function bristleMask(v) {
  if (bristleMasks[v]) return bristleMasks[v];
  var TW = 256, TH = 64, c = U.canvas(TW, TH), x = c.getContext('2d'), id = x.createImageData(TW, TH), d = id.data, sd = 300 + v * 17, P2 = Math.PI * 2;
  for (var j = 0; j < TH; j++) {
    var cj = Math.cos(j / TH * P2), sj = Math.sin(j / TH * P2);
    var s1 = U.noise2(cj * 3 + 7, sj * 3 + 7, sd) * .5 + .5, s2 = U.noise2(cj * 9 + 3, sj * 9 + 3, sd + 1) * .5 + .5;
    for (var i = 0; i < TW; i++) {
      var ang = i / TW * P2, mod = Math.sin(ang * 2 + j * .21 + sd) * Math.sin(ang + j * .07 + v) + .5 * Math.sin(ang * 3 + j * .5 + v * 2);
      var g = s1 * .55 + s2 * .45 + .22 * mod;
      var a = g < .26 ? U.clamp((g - .12) / .14, 0, 1) * .5 : .6 + .4 * g;
      var k = (j * TW + i) * 4; d[k] = d[k + 1] = d[k + 2] = 0; d[k + 3] = U.clamp(a * 255, 0, 255);
    }
  }
  x.putImageData(id, 0, 0);
  bristleMasks[v] = c;
  return c;
}
I.bristlePattern = function (v, rgb) {
  rgb = qrgb(rgb);
  return U.cached('bristle' + v + ':' + rgb.join(','), function () {
    var m = bristleMask(v), c = U.canvas(m.width, m.height), x = c.getContext('2d');
    x.drawImage(m, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = U.rgba(rgb, 1); x.fillRect(0, 0, c.width, c.height);
    return x.createPattern(c, 'repeat');
  });
};
/* 大写意一笔（侧锋铺毫）：湿笔 + 笔毫丝理 + 边缘渗化 + 收笔飞白，参数同 I.stroke。
   缺省 tex 1, fb .3, bleed .28, fade .35, head .05, tail .25, wob .25；o.dry 0..1 加重飞白 */
I.sweep = function (c, pts, o) {
  o = o || {};
  var q = {}, k;
  for (k in o) q[k] = o[k];
  var d = o.dry == null ? .3 : o.dry;
  if (q.tex == null) q.tex = 1; if (q.fb == null) q.fb = .12 + d * .6; if (q.bleed == null) q.bleed = .28 * (1 - d * .6);
  if (q.head == null) q.head = .05; if (q.tail == null) q.tail = .25; if (q.fade == null) q.fade = .35; if (q.wob == null) q.wob = .25;
  return I.stroke(c, pts, q);
};
/* 不规则墨团路径（只建路径，调用方 fill/stroke）。o: n, rough, sx, sy, rot, fringe 边缘细碎渗化(默认 .04) */
I.blot = function (c, x, y, r, seed, o) {
  o = o || {};
  var N = o.n || 36, rough = o.rough == null ? .22 : o.rough, sx = o.sx || 1, sy = o.sy || 1, rot = o.rot || 0, fr = o.fringe == null ? .04 : o.fringe;
  var cr = Math.cos(rot), sr = Math.sin(rot);
  c.beginPath();
  for (var i = 0; i <= N; i++) {
    var a = i / N * Math.PI * 2;
    var rr = r * (1 + rough * U.fbm1(i / N * 6, seed, 3) * 1.6 + (i < N ? fr * U.noise1(i * 1.7, seed + 7) : fr * U.noise1(0, seed + 7)));
    var dx = Math.cos(a) * rr * sx, dy = Math.sin(a) * rr * sy;
    var px = x + dx * cr - dy * sr, py = y + dx * sr + dy * cr;
    if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
  }
  c.closePath();
};
/* 墨团（直接画）：淡墨外渗 + 墨身 + 浓核 + 边缘水渍。o: a, rgb, sx, sy, rot, rough, core 浓核比(.4) */
I.inkBlot = function (c, x, y, r, seed, o) {
  o = o || {};
  var A = o.a == null ? .9 : o.a, rgb = o.rgb || CINE.C.inkRGB, sx = o.sx || 1, sy = o.sy || 1, bo = { rough: o.rough == null ? .25 : o.rough, sx: sx, sy: sy, rot: o.rot || 0, n: 30 };
  if (A <= .003) return;
  I.wash(c, x, y, r * 1.3 * sx, r * 1.3 * sy, A * .22, seed, rgb, o.rot || 0, { edge: 'wet' });
  c.save();
  c.fillStyle = U.rgba(rgb, A * .62); I.blot(c, x, y, r, seed, bo); c.fill();
  c.strokeStyle = U.rgba(rgb, A * .3); c.lineWidth = r * .09; c.stroke();
  var cr = o.core == null ? .4 : o.core;
  if (cr > 0) { bo.rough = .35; c.fillStyle = U.rgba(rgb, A * .45); I.blot(c, x + r * .08 * sx, y - r * .05 * sy, r * (.3 + cr * .5), seed + 5, bo); c.fill(); }
  c.restore();
};
/* 墨点溅：主团 + 甩出的泪滴点。k 展开进度 0..1，dir 方向(弧度，缺省四散)，spread 集中度，count, rgb, a */
I.splat = function (c, x, y, r, seed, o) {
  o = o || {};
  var k = o.k == null ? 1 : U.clamp(o.k, 0, 1), rgb = o.rgb || CINE.C.inkRGB, a = o.a == null ? .9 : o.a;
  if (k <= 0) return;
  var r0 = U.rng(seed), ek = U.easeOut(k);
  c.save();
  I.wash(c, x, y, r * 1.8 * ek, r * 1.5 * ek, a * .35, seed, rgb);
  c.fillStyle = U.rgba(rgb, a);
  I.blot(c, x, y, r * (.5 + .5 * ek), seed, { rough: .3 }); c.fill();
  var cnt = o.count || 16;
  for (var i = 0; i < cnt; i++) {
    var ang = o.dir == null ? r0() * 6.283 : o.dir + r0.pm(o.spread || .9);
    var d = r * (1.0 + r0() * 2.4) * ek, rr = r * (.05 + r0() * .2);
    var sx = x + Math.cos(ang) * d, sy = y + Math.sin(ang) * d;
    c.fillStyle = U.rgba(rgb, a * (.6 + .4 * r0()));
    I.blot(c, sx, sy, Math.max(.6, rr), seed + i * 13, { rough: .25, n: 12, sx: 1 + r0() * 1.6 * ek, sy: .8, rot: ang });
    c.fill();
  }
  c.restore();
};
/* 墨滴在纸上晕开：k 0..1。外晕淡而软，边缘一圈水渍，中心浓 */
I.bleed = function (c, x, y, r, seed, o) {
  o = o || {};
  var k = U.clamp(o.k == null ? 1 : o.k, 0, 1), a = o.a == null ? 1 : o.a, rgb = o.rgb || CINE.C.inkRGB;
  if (k <= 0) return;
  var R = r * U.easeOut(k);
  var sx = o.sx || 1, sy = o.sy || 1;
  for (var i = 3; i >= 0; i--) I.wash(c, x, y, R * (.55 + i * .28) * sx, R * (.55 + i * .28) * sy, a * (.32 - i * .05), seed + i, rgb, 0, { edge: i === 3 ? 'wet' : 'soft' });   // 只最外一圈留水渍线
  c.save();
  c.strokeStyle = U.rgba(rgb, a * .035); c.lineWidth = Math.max(1, R * .05);
  I.blot(c, x, y, R * 1.02, seed + 9, { rough: .2, n: 64, sx: sx, sy: sy }); c.stroke();
  c.fillStyle = U.rgba(rgb, a * .3);
  I.blot(c, x, y, R * .45, seed + 3, { rough: .3, n: 40, sx: sx, sy: sy }); c.fill();
  c.fillStyle = U.rgba(rgb, a * .85);
  I.blot(c, x, y, R * .16 + r * .04, seed + 20, { rough: .3 }); c.fill();
  c.restore();
};

/* ================= 山 ================= */
/* 山脊函数 X→高度比（约 0..1.2）。o.peaks=[[x, 高比, 半宽, 尖度]] 指定峰（一角半边构图用）；缺省为连绵群峰。
   o: seed, freq, rough 细碎起伏, base 峰间基线, off 横向偏移 */
I.ridgeFn = function (o) {
  var seed = o.seed || 1, f = o.freq || 1, rough = o.rough == null ? .1 : o.rough, peaks = o.peaks, off = o.off || 0;
  var base = o.base == null ? (peaks ? 0 : .5) : o.base;
  return function (X) {
    var x = X + off, v;
    if (peaks) {
      v = base * (.75 + .25 * U.fbm1(x / 400 * f, seed + 9, 3));
      for (var i = 0; i < peaks.length; i++) {
        var p = peaks[i], u = (x - p[0]) / p[2];
        if (u > -1 && u < 1) {
          var k = Math.pow(Math.cos(u * Math.PI / 2), p[3] || 1.4) * p[1];
          v = Math.max(v, k) + Math.min(v, k) * .12;
        }
      }
    } else {
      v = base + .45 * U.fbm1(x / 520 * f, seed, 5);
      v += .35 * Math.pow(1 - Math.abs(U.noise1(x / 300 * f, seed + 3)), 3);
    }
    v += rough * U.fbm1(x / 55 * f, seed + 5, 3) * Math.min(1, v * 2.5);
    return Math.max(0, v);
  };
};
/* 一层山（按参数与尺寸缓存）。脊线最浓，向下渐淡入雾——层层淡墨远山。
   o: seed, y 山脚基线, h 山高, a 墨浓, peaks/base/rough/freq（见 ridgeFn）, w 逻辑宽(默认 W，视差用可更宽),
      fade 从脊线向下多深淡尽(默认 .85h), edge 脊线浓边宽(默认 22), edgeK 浓边占比(.45), tex 皴擦 0..1, dots 苔点 0..1,
      trees 脊上树 0..1, blur 模糊级数, q 采样精度(默认 .5), rgb */
I.mountainLayer = function (o) {
  return U.cached('mtn' + JSON.stringify(o), function (px) {
    var lw = o.w || W, q = Math.min(1, px * (o.q || .5));
    var rf = I.ridgeFn(o), rgb = o.rgb || CINE.C.inkRGB, seed = o.seed || 1;
    var base = o.y, hh = o.h, A = o.a, fade = o.fade || hh * .85, ew = o.edge || 22, ek = o.edgeK == null ? .45 : o.edgeK;
    var tex = o.tex == null ? .5 : o.tex, top = H;
    for (var xx = 0; xx <= lw; xx += 8) top = Math.min(top, base - hh * rf(xx));
    top = U.clamp(Math.floor(top - 70), 0, H - 1);          // 只缓存有内容的下半幅，省填充率
    var cw = Math.ceil(lw * q), ch = Math.ceil((H - top) * q);
    var lo = U.canvas(cw, ch), lx = lo.getContext('2d'), id = lx.createImageData(cw, ch), d = id.data;
    for (var i = 0; i < cw; i++) {
      var X = (i + .5) / q, ry = base - hh * rf(X), gsl = U.clamp((rf(X + 8) - rf(X - 8)) * hh / 16, -1.2, 1.2) * .55;
      var j0 = Math.max(0, Math.floor((ry - 2 - top) * q)), j1 = Math.min(ch, Math.ceil((base - top) * q) + 1);
      for (var j = j0; j < j1; j++) {
        var Y = top + (j + .5) / q, dd = Y - ry, aa = U.clamp(dd * q + .5, 0, 1);
        if (aa <= 0) continue;
        var dens = (ek * Math.exp(-dd / ew) + (1 - ek) * (1 - .55 * U.smooth(dd / fade))) * (1 - U.smooth((Y - base + fade * .75) / (fade * .75)));
        var uu = X + dd * gsl;                               // 披麻：丝理顺坡而下
        var t1 = U.noise2(uu / 4.5, Y / 46, seed) * .6 + U.noise2(uu / 13, Y / 90, seed + 3) * .4, t2 = U.noise2(X / 170, Y / 70, seed + 7);
        var wetE = .22 * Math.exp(-Math.abs(dd - ew * 1.6) / 3);  // 脊下一道湿痕
        var v = A * (dens + wetE * tex) * (1 + tex * .5 * t1 + .38 * t2) * aa;
        var k = (j * cw + i) * 4;
        d[k] = rgb[0]; d[k + 1] = rgb[1]; d[k + 2] = rgb[2]; d[k + 3] = U.clamp(v * 255, 0, 255);
      }
    }
    lx.putImageData(id, 0, 0);
    var c = U.canvas(lw * px, (H - top) * px), x = c.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(I.blur(lo, o.blur || 1), 0, 0, c.width, c.height);
    x.scale(px, px); x.translate(0, -top);
    c.top = top;
    var r = U.rng(seed + 77), n, X0, ry0;
    // 披麻皴：一簇簇顺坡而下的长枯笔，脊下密、往下疏，没入雾中
    n = Math.round(tex * (o.dots != null || o.trees ? 1 : .6) * lw / 34);
    for (i = 0; i < n && tex > .15; i++) {
      X0 = r() * lw; ry0 = base - hh * rf(X0);
      if (hh * rf(X0) < 24) continue;
      var slope = (rf(X0 + 6) - rf(X0 - 6)) * hh / 12, gx = U.clamp(-slope, -1.4, 1.4) * .5 + r.pm(.12);
      var sy = ry0 + 3 + Math.pow(r(), 1.6) * fade * .4, len = 30 + r() * 90, bw = 3 + r() * 5, kk = 1 - (sy - ry0) / fade;
      for (var b2 = 0; b2 < 3; b2++) {
        var bx0 = X0 + (b2 - 1) * (bw * 1.6 + r() * 4), by0 = sy + r.pm(6), L2 = len * (.7 + r() * .5);
        I.dry(x, [[bx0, by0], [bx0 + gx * L2 * .35 + r.pm(3), by0 + L2 * .5], [bx0 + gx * L2 * .6 + r.pm(5), by0 + L2]], {
          w: bw, a: A * (.3 + r() * .4) * kk, rgb: rgb, dry: .55 + r() * .25, seed: i * 3 + b2 + seed, hairs: 4, n: 16
        });
      }
    }
    // 勾勒脊线：分段中锋
    if (o.line) {
      for (var xs = r() * 40; xs < lw;) {
        var seg = 120 + r() * 220, lp = [];
        for (var sx2 = xs; sx2 <= Math.min(lw, xs + seg); sx2 += 8) lp.push([sx2, base - hh * rf(sx2) + 1.5]);
        if (lp.length > 3 && hh * rf(xs + seg / 2) > 26) I.stroke(x, lp, { raw: true, w: 1.6 + r() * 3.8, a: A * o.line * (.55 + r() * .45), rgb: rgb, head: .08, tail: .35, n: lp.length, seed: seed + Math.round(xs), fb: r() < .5 ? .3 : 0, wob: .3 });
        xs += seg + 10 + r() * 90;
      }
    }
    // 苔点
    n = Math.round((o.dots || 0) * lw / 30);
    for (i = 0; i < n; i++) {
      X0 = r() * lw; ry0 = base - hh * rf(X0);
      if (hh * rf(X0) < 14) continue;
      x.fillStyle = U.rgba(rgb, Math.min(1, A * (1.2 + r())));
      I.blot(x, X0, ry0 + 2 + r() * 14, 1.4 + r() * 2.6, i + seed, { rough: .3, n: 10, sx: 1.6, sy: .8 }); x.fill();
    }
    // 脊上树
    n = Math.round((o.trees || 0) * lw / 45);
    for (i = 0; i < n; i++) {
      X0 = r() * lw; ry0 = base - hh * rf(X0);
      if (hh * rf(X0) < 30) continue;
      I.tree(x, X0, ry0 + 3, (o.treeS || 22) * (.6 + r() * .8), seed + i, { a: Math.min(1, A * 1.5), rgb: rgb, type: r() < .6 ? 'pine' : 'dot' });
    }
    return c;
  });
};
/* 画一层山：dx 视差平移，dy 竖移，k 透明度 */
I.mountains = function (c, o, dx, dy, k) {
  var layer = I.mountainLayer(o), lw = o.w || W;
  c.save(); c.globalAlpha *= k == null ? 1 : k;
  c.drawImage(layer, dx || 0, (dy || 0) + layer.top, lw, H - layer.top);
  c.restore();
};
/* 小树：type 'pine' 松（斜干 + 平展针叶团）| 'dot' 点叶；s 高度 */
I.tree = function (c, x, y, s, seed, o) {
  o = o || {};
  var r = U.rng(seed * 7 + 3), rgb = o.rgb || CINE.C.inkRGB, a = o.a == null ? .9 : o.a, lean = (o.lean == null ? r.pm(.35) : o.lean);
  var top = [x + lean * s * .55, y - s];
  I.stroke(c, [[x, y], [x + lean * s * .1 + r.pm(s * .06), y - s * .45], [x + lean * s * .4, y - s * .8], top], { w: Math.max(1, s * .075), a: a, rgb: rgb, head: .04, tail: .6, n: 14, seed: seed });
  c.fillStyle = U.rgba(rgb, a);
  if (o.type === 'dot') {
    for (var i = 0; i < 11; i++) {
      I.blot(c, top[0] + r.pm(s * .3), top[1] + s * .15 + r.pm(s * .18), s * (.05 + r() * .06), seed + i, { rough: .3, n: 9 });
      c.fill();
    }
    return;
  }
  var dirx = lean >= 0 ? 1 : -1;
  [[.0, .02, .34], [-.18, .3, .26], [.1, .52, .2]].forEach(function (tr, k) {      // 三簇针叶，错落向一侧伸展
    var cy = top[1] + s * tr[1], cx = top[0] + dirx * s * tr[0] * (k === 1 ? -1 : 1) + dirx * s * .1, wd = s * tr[2];
    for (var m = 0; m < 4; m++) {
      I.blot(c, cx + (m - 1.5) * wd * .42 + r.pm(s * .02), cy + r.pm(s * .02) - Math.abs(m - 1.5) * s * .012, wd * (.22 + r() * .1), seed + k * 7 + m, { rough: .35, n: 11, sx: 1.4, sy: .55 });
      c.fill();
    }
  });
};

/* ---------- 擎天山柱（高耸石柱 + 螺旋石阶） ----------
   geo: {seed, h 柱高, wb 底半宽, wt 顶半宽, turns 螺旋圈数, th0 起始相位, a 墨浓} —— 所有量为逻辑像素 */
I.pillarHW = function (g, up) {           // up: 距柱脚的高度 → 该处半宽
  var k = U.clamp(up / g.h, 0, 1), sd = g.seed || 1;
  return U.lerp(g.wb, g.wt, Math.pow(k, .7)) * (1 + .16 * U.fbm1(up / 300, sd, 3) + .09 * U.fbm1(up / 80, sd + 2, 2));
};
function pillarEdge(g, up, side) {       // 左右崖壁（在半宽上再加碎裂起伏）
  var sd = (g.seed || 1) + (side > 0 ? 8 : 4);
  return I.pillarHW(g, up) * (1 + .09 * U.fbm1(up / 36, sd, 3) + .05 * Math.max(0, U.noise1(up / 14, sd + 1)));
}
I.pillarSprite = function (g) {
  return U.cached('pillar' + JSON.stringify(g), function (px) {
    var sw = g.wb * 3 + 240, sh = g.h + 60, q = Math.min(1, px * .5);
    var cw = Math.ceil(sw * q), ch = Math.ceil(sh * q), lo = U.canvas(cw, ch), lx = lo.getContext('2d');
    var id = lx.createImageData(cw, ch), d = id.data, rgb = g.rgb || CINE.C.inkRGB, seed = g.seed || 1, cx = sw / 2, A = g.a || .8;
    var edgeL = [], edgeR = [];
    for (var j = 0; j < ch; j++) {
      var Y = (j + .5) / q, up = sh - 20 - Y, jl = pillarEdge(g, up, -1), jr = pillarEdge(g, up, 1);
      var xl = cx - jl, xr = cx + jr;
      if (j % 3 === 0) { edgeL.push([xl, Y]); edgeR.push([xr, Y]); }
      var i0 = Math.max(0, Math.floor((xl - 2) * q)), i1 = Math.min(cw, Math.ceil((xr + 2) * q));
      for (var i = i0; i < i1; i++) {
        var X = (i + .5) / q, e = Math.min(X - xl, xr - X), aa = U.clamp(e * q + .5, 0, 1);
        if (aa <= 0) continue;
        var side = (X - cx) / (jl + jr) * 2;
        var dens = .16 + .5 * Math.exp(-e / 30) + .34 * U.smooth((side + .1) * 1.6);
        var t1 = U.noise2(X / 5, Y / 55, seed) * .55 + U.noise2(X / 16, Y / 110, seed + 1) * .45, t2 = U.fbm2(X / 70, Y / 160, seed + 2, 2);
        var v = A * dens * (1 + .5 * t1 + .3 * t2) * aa;
        var k = (j * cw + i) * 4;
        d[k] = rgb[0]; d[k + 1] = rgb[1]; d[k + 2] = rgb[2]; d[k + 3] = U.clamp(v * 255, 0, 255);
      }
    }
    lx.putImageData(id, 0, 0);
    var c = U.canvas(sw * px, sh * px), x = c.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(I.blur(lo, 1), 0, 0, c.width, c.height);
    x.scale(px, px);
    var r = U.rng(seed + 5), n, u, sx, sy;
    x.save(); x.beginPath();                  // 斧劈皴纹理铺满柱身
    edgeL.forEach(function (q, i) { if (i) x.lineTo(q[0], q[1]); else x.moveTo(q[0], q[1]); });
    for (n = edgeR.length - 1; n >= 0; n--) x.lineTo(edgeR[n][0], edgeR[n][1]);
    x.closePath(); x.clip();
    var rp = rockPattern(rgb); rp.setTransform(new DOMMatrix().translateSelf(seed * 131 % 512, 0).scaleSelf(1 / rp.px, 1 / rp.px));
    x.globalAlpha = A * .55; x.fillStyle = rp; x.fillRect(0, 0, sw, sh); x.globalAlpha = 1;
    for (n = 0; n < g.h / 60; n++) {         // 侧锋斧劈：顺柱身斜下的枯笔
      u = r() * g.h; var hw0 = I.pillarHW(g, u), ax0 = cx + r.pm(hw0 * .85), ay0 = sh - 20 - u, al = 60 + r() * 140, aw = 14 + r() * 26;
      I.dry(x, [[ax0, ay0], [ax0 + r.pm(14), ay0 + al * .5], [ax0 + r.pm(24), ay0 + al]], { w: aw, a: A * (.35 + r() * .35), rgb: rgb, dry: .35 + r() * .3, hairs: Math.round(aw / 2), n: 18, seed: 700 + n });
    }
    x.restore();
    for (n = 0; n < g.h / 34; n++) {         // 竖向裂隙 + 一侧留白：石块体积
      u = r() * g.h; var hw = I.pillarHW(g, u), L = 50 + r() * 150;
      sx = cx + r.pm(hw * .82); sy = sh - 20 - u;
      var pts = [[sx, sy], [sx + r.pm(5), sy + L * .5], [sx + r.pm(9), sy + L]];
      I.stroke(x, pts, { w: 10 + r() * 16, a: .16, rgb: CINE.C.paperRGB, head: .2, tail: .3, n: 16, seed: n + 900 });
      I.stroke(x, pts.map(function (p) { return [p[0] - 6, p[1]]; }), { w: 2.5 + r() * 4, a: A * (.5 + r() * .4), rgb: rgb, head: .15, tail: .4, n: 18, seed: n + seed });
    }
    for (n = 0; n < g.h / 40; n++) {         // 横向岩层短笔 + 苔点
      u = r() * g.h; sy = sh - 20 - u; var hw3 = I.pillarHW(g, u), x0 = cx + r.pm(hw3 * .7), len = 30 + r() * 80;
      I.stroke(x, [[x0, sy], [x0 + len * .5, sy + r.pm(4)], [x0 + len, sy + 6 + r() * 6]], { w: 2 + r() * 3, a: A * .6, rgb: rgb, head: .2, tail: .5, n: 10, seed: n + 300 });
      x.fillStyle = U.rgba(rgb, Math.min(1, A * 1.2));
      for (var m = 0; m < 4; m++) { I.blot(x, x0 + r() * len, sy - 3 - r() * 4, 1.5 + r() * 2.5, n * 9 + m, { rough: .3, n: 9, sx: 1.5, sy: .8 }); x.fill(); }
    }
    [edgeL, edgeR].forEach(function (E, side) {          // 崖壁勾线：分段中锋
      for (var s0 = 0; s0 < E.length - 4;) {
        var len2 = 20 + Math.floor(r() * 40), seg = E.slice(s0, Math.min(E.length, s0 + len2));
        if (seg.length > 3) I.stroke(x, seg, { raw: true, w: 2.5 + r() * 6.5, a: A * (.7 + r() * .3), rgb: rgb, head: .1, tail: .3, n: seg.length, seed: s0 + side * 999, fb: r() < .4 ? .3 : 0, tex: .5, wob: .3 });
        s0 += len2 + Math.floor(r() * 10);
      }
    });
    for (n = 0; n < g.h / 55; n++) {         // 崖边小松
      var u2 = r() * g.h * .96, side2 = r() < .5 ? -1 : 1;
      I.tree(x, cx + side2 * pillarEdge(g, u2, side2) * .97, sh - 20 - u2, 18 + r() * 26, seed + n, { a: .92, rgb: rgb, lean: side2 * (.5 + r() * .6) });
    }
    c.lw = sw; c.lh = sh;
    return c;
  });
};
/* 画石柱：(x,y) 为柱脚中心 */
I.pillar = function (c, g, x, y, k) {
  var s = I.pillarSprite(g);
  c.save(); c.globalAlpha *= k == null ? 1 : k;
  c.drawImage(s, x - s.lw / 2, y - s.lh + 20, s.lw, s.lh);
  c.restore();
};
/* 螺旋石阶上参数 s(0 柱脚 → 1 柱顶) 的点：{x,y,depth(>0 在前面),up} */
I.spiralAt = function (g, x, y, s) {
  var up = s * g.h * .97, th = s * (g.turns || 6) * Math.PI * 2 + (g.th0 || 0);
  var hw = I.pillarHW(g, up) * .96;
  return { x: x + Math.sin(th) * hw, y: y - up + Math.cos(th) * 10, depth: Math.cos(th), up: up };
};
/* 画石阶（只画正面可见段）：s0..s1 区间；o: a, w, rgb */
I.spiral = function (c, g, x, y, s0, s1, o) {
  o = o || {};
  var n = Math.max(20, Math.round((s1 - s0) * (g.turns || 6) * 60)), prev = null, a = o.a == null ? .9 : o.a;
  c.save(); c.lineCap = 'round';
  for (var i = 0; i <= n; i++) {
    var s = U.lerp(s0, s1, i / n), p = I.spiralAt(g, x, y, s);
    if (prev && p.depth > -.05 && prev.depth > -.05) {
      var vis = U.clamp((Math.min(p.depth, prev.depth) + .05) * 4, 0, 1);
      c.strokeStyle = U.rgba(CINE.C.paperRGB, a * .55 * vis); c.lineWidth = (o.w || 5);
      c.beginPath(); c.moveTo(prev.x, prev.y); c.lineTo(p.x, p.y); c.stroke();
      c.strokeStyle = U.rgba(o.rgb || CINE.C.inkRGB, a * .9 * vis); c.lineWidth = (o.w || 5) * .3;
      c.beginPath(); c.moveTo(prev.x, prev.y + (o.w || 5) * .55); c.lineTo(p.x, p.y + (o.w || 5) * .55); c.stroke();
    }
    prev = p;
  }
  c.restore();
};

/* 斧劈皴纹理砖（按墨色与分辨率缓存，可无缝平铺）：侧锋斜劈的短阔笔、夹几道披麻长丝与留白笔 */
function rockPattern(rgb) {
  rgb = qrgb(rgb);
  var cv = U.cached('rockTile' + rgb.join(','), function (px) {
    var T = 512, c = U.canvas(T * px, T * px), x = c.getContext('2d'), r = U.rng(907);
    x.scale(px, px);
    var marks = [];
    for (var i = 0; i < 34; i++) {
      var sx = r() * T, sy = r() * T, an = 1.95 + r.pm(.3), L = 40 + r() * 90, w = 9 + r() * 22, dark = r() < .8;
      var k1 = [sx + Math.cos(an) * L * .45 + r.pm(5), sy + Math.sin(an) * L * .45];
      marks.push({ f: 'dry', pts: [[sx, sy], k1, [k1[0] + Math.cos(an + .45) * L * .55, k1[1] + Math.sin(an + .45) * L * .55]],
        o: { w: w, a: dark ? .25 + r() * .35 : .14, rgb: dark ? rgb : CINE.C.paperRGB, seed: 400 + i, dry: .3 + r() * .35, hairs: Math.round(w / 1.8), raw: true, n: 16 } });
    }
    for (i = 0; i < 46; i++) {
      var hx = r() * T, hy = r() * T, hl = 50 + r() * 110, g = r.pm(.35);
      marks.push({ f: 'dry', pts: [[hx, hy], [hx + g * hl * .4 + r.pm(4), hy + hl * .5], [hx + g * hl * .7 + r.pm(6), hy + hl]], o: { w: 2.5 + r() * 4, a: .18 + r() * .22, rgb: rgb, dry: .6, hairs: 3, n: 14, seed: 500 + i } });
    }
    [[0, 0], [-T, 0], [T, 0], [0, -T], [0, T], [-T, -T], [T, -T], [-T, T], [T, T]].forEach(function (d) {
      x.save(); x.translate(d[0], d[1]);
      marks.forEach(function (m) {
        var b = 0; m.pts.forEach(function (q) { if (q[0] + d[0] > -60 && q[0] + d[0] < T + 60 && q[1] + d[1] > -60 && q[1] + d[1] < T + 60) b = 1; });
        if (b) I[m.f](x, m.pts, m.o);
      });
      x.restore();
    });
    return c;
  });
  return U.cached('rockPat' + rgb.join(','), function (px) { var p = cv.getContext('2d').createPattern(cv, 'repeat'); p.px = px; return p; });
}
/* 皴擦纹理铺一块矩形（常与 clip 合用：先建石面路径 clip，再 I.cun 铺纹）。o: a 浓度(.5), rgb, seed 纹理错位 */
I.cun = function (c, x, y, w, h, o) {
  o = o || {};
  var pat = rockPattern(o.rgb || CINE.C.inkRGB), sd = o.seed || 1;
  pat.setTransform(new DOMMatrix().translateSelf((sd * 173) % 512, (sd * 97) % 512).scaleSelf(1 / pat.px, 1 / pat.px));
  c.save(); c.globalAlpha *= o.a == null ? .5 : o.a; c.fillStyle = pat; c.fillRect(x, y, w, h); c.restore();
};
/* 岩体：top 为顶面轮廓折线（左→右），其下为渐隐的山石：斧劈皴纹理铺底（越往下越淡）、几笔侧锋大斧劈定出石面、
   几道中锋裂隙；顶缘轮廓线粗细顿挫且时断时续，带飞白；苔点。o: seed, a, depth 厚度(260), rgb, tex 皴密度(1), moss 苔点(1), light 顶面受光(.14),
   under 底色 rgb（缺省不铺——石身下部半透；给色则先铺一层渐隐的不透明底，夜景给暗雾色、昼景给纸色），
   lite 提白浓度倍率（缺省 1；约三成大斧劈用纸色淡笔提白，夜景压不住山影时给 0–.3），liteRGB 提白色（缺省纸色；也作用于顶面受光线） */
I.rock = function (c, top, o) {
  o = o || {};
  var sd = o.seed || 3, r = U.rng(sd), rgb = o.rgb || CINE.C.inkRGB, A = o.a == null ? .85 : o.a, dep = o.depth || 260, i, n = top.length;
  var tex = o.tex == null ? 1 : o.tex, y0 = Infinity, x0 = top[0][0], x1 = top[n - 1][0], LK = o.lite == null ? 1 : o.lite, LRGB = o.liteRGB || CINE.C.paperRGB;
  top.forEach(function (p) { y0 = Math.min(y0, p[1]); });
  var g = c.createLinearGradient(0, y0, 0, y0 + dep);
  g.addColorStop(0, U.rgba(rgb, A * .95)); g.addColorStop(.45, U.rgba(rgb, A * .76)); g.addColorStop(.8, U.rgba(rgb, A * .28)); g.addColorStop(1, U.rgba(rgb, 0));
  c.save();
  c.beginPath(); c.moveTo(x0 - dep * .45, top[0][1] + dep * 1.3); top.forEach(function (p) { c.lineTo(p[0], p[1]); }); c.lineTo(x1 + dep * .45, top[n - 1][1] + dep * 1.3); c.closePath();
  if (o.under) {                                     // 底色：石下没入雾，不透出身后的云（缺省不铺，由场景给色）
    var ug = c.createLinearGradient(0, y0, 0, y0 + dep), UC = o.under || CINE.C.paperRGB, ua = Math.min(1, A * 1.1);
    ug.addColorStop(0, U.rgba(UC, ua)); ug.addColorStop(.5, U.rgba(UC, ua)); ug.addColorStop(.95, U.rgba(UC, 0));
    c.fillStyle = ug; c.fill();
  }
  c.fillStyle = g; c.fill();
  c.clip();
  var at = function (x) { var k = U.clamp((x - x0) / (x1 - x0 || 1) * (n - 1), 0, n - 1.001), j = Math.floor(k); return U.lerp(top[j][1], top[j + 1][1], k - j); };
  if (tex > 0) {                                     // 斧劈皴纹理：分六层由浓到淡，没入雾中
    var pat = rockPattern(rgb);
    pat.setTransform(new DOMMatrix().translateSelf((sd * 173) % 512, (sd * 97) % 512).scaleSelf(1 / pat.px, 1 / pat.px));
    c.fillStyle = pat;
    var ga0 = c.globalAlpha;
    for (i = 0; i < 6; i++) { c.globalAlpha = ga0 * A * tex * (.9 - i * .15); c.fillRect(x0 - dep, y0 - 40 + (i ? i * dep * .15 : -200), x1 - x0 + dep * 2, dep * .15 + (i ? 0 : 200)); }
    c.globalAlpha = ga0;
  }
  var m = Math.round(tex * (x1 - x0) / 85);
  for (i = 0; i < m; i++) {                          // 大斧劈：侧锋自顶缘斜劈而下，定出石面；浓笔压暗、淡笔提白，长短阔窄各异
    var xx = x0 + r() * (x1 - x0), yy = at(xx) + 4 + Math.pow(r(), 1.6) * dep * .4, L = 36 + Math.pow(r(), 1.5) * 190, an = 1.92 + r.pm(.42), lite = r() < .35;
    var kx = xx + Math.cos(an) * L * .5, ky = yy + Math.sin(an) * L * .5, ax = [[xx, yy], [kx, ky], [kx + Math.cos(an + r.pm(.5)) * L * .5, ky + Math.sin(an + .3) * L * .5]], aw = 10 + Math.pow(r(), 1.3) * 38;
    var la = lite ? (.1 + r() * .1) * LK : A * (.3 + r() * .35);
    if (la > .003) I.dry(c, ax, { raw: true, w: aw, a: la, rgb: lite ? LRGB : rgb, seed: sd + i, dry: .25 + r() * .45, hairs: Math.max(4, Math.round(aw / 2)), n: 18 });
    else r();                                        // 不画也照样消耗随机数（dry 那一次），后续笔触不变
    if (!lite && r() < .6) I.stroke(c, ax.map(function (q) { return [q[0] - aw * .45, q[1] + aw * .1]; }), { raw: true, w: 2 + r() * 3, a: A * .7, rgb: rgb, head: .05, tail: .5, n: 12, seed: sd + 30 + i, wob: .3 });
  }
  var cr = Math.round(tex * (x1 - x0) / 160);
  for (i = 0; i < cr; i++) {                         // 裂隙：中锋，起笔顿、收笔尖
    var cx0 = x0 + r() * (x1 - x0), cy0 = at(cx0) + 2, cl = 60 + r() * 140, ca = 1.75 + r.pm(.35);
    I.stroke(c, [[cx0, cy0], [cx0 + Math.cos(ca) * cl * .4 + r.pm(8), cy0 + Math.sin(ca) * cl * .4], [cx0 + Math.cos(ca + r.pm(.3)) * cl, cy0 + Math.sin(ca) * cl]], { w: 3 + r() * 4, a: A * (.6 + r() * .3), rgb: rgb, head: .1, tail: .5, n: 14, seed: sd + 50 + i, fb: .3, wob: .35 });
  }
  c.restore();
  I.stroke(c, top.map(function (p) { return [p[0], p[1] + 8]; }), { raw: true, w: 7, a: o.light == null ? .14 : o.light, rgb: LRGB, head: .05, tail: .05, n: n, seed: sd + 1 });
  for (var s0 = 0; s0 < n - 2;) {                   // 顶缘勾线：分段中锋，粗细顿挫，时断时续，间带飞白
    var len = 4 + Math.floor(r() * 9), seg = top.slice(s0, Math.min(n, s0 + len + 1));
    if (seg.length > 1) I.stroke(c, seg, { raw: true, w: 2.5 + r() * 6.5, a: A * (.8 + r() * .2), rgb: rgb, head: .08, tail: .3, n: Math.max(6, seg.length * 3), seed: sd + s0, wob: .35, fb: r() < .4 ? .35 : 0, tex: .5 });
    s0 += len + (r() < .3 ? 1 : 0);
  }
  var mo = Math.round((o.moss == null ? 1 : o.moss) * (x1 - x0) / 60);
  for (i = 0; i < mo; i++) {
    var mx = x0 + r() * (x1 - x0);
    c.fillStyle = U.rgba(rgb, Math.min(1, A * (.8 + r() * .4)));
    I.blot(c, mx, at(mx) - 1 + r() * 4, 1.6 + r() * 3.4, sd + i * 7, { rough: .35, n: 10, sx: 1.6, sy: .8, fringe: .12 }); c.fill();
  }
};
/* 石台 / 崖顶：顶面约在 y（人物站立线），x0..x1，两端下折。o 同 I.rock，另有 trees 0..1 */
I.ledge = function (c, x0, x1, y, o) {
  o = o || {};
  var sd = o.seed || 3, r = U.rng(sd + 50), top = [];
  var ew = Math.min(260, (x1 - x0) * .28);
  for (var x = x0; x <= x1 + .1; x += 14) {
    var e = Math.min(x - x0, x1 - x), drop = e < ew ? Math.pow((ew - e) / ew, 1.8) * (120 + 60 * U.noise1(x / 90, sd + 5)) : 0;
    top.push([x, y + 9 * U.noise1(x / 110, sd) + 4 * U.noise1(x / 26, sd + 1) + 2 * U.noise1(x / 8, sd + 2) + drop]);
  }
  I.rock(c, top, o);
  var nt = Math.round((o.trees || 0) * (x1 - x0) / 140);
  for (var i = 0; i < nt; i++) { var tx = x0 + 30 + r() * (x1 - x0 - 60); I.tree(c, tx, y + 3, 40 + r() * 50, sd + i, { a: o.a == null ? .85 : o.a, rgb: o.rgb, type: r() < .7 ? 'pine' : 'dot' }); }
};

/* ---------- 楼阁（摘星楼等）：界画——细而匀的界尺线勾出柱枋、格扇、平座栏杆与斗拱，淡墨烘出楼身；屋面浓墨带瓦垄，檐角飞翘。
   (x,y) 台基底中心，s 总高。o: tiers 层数, a, rgb, seed, glow 窗光 0..1, glowRGB, rail 栏杆 ---------- */
I.tower = function (c, x, y, s, o) {
  o = o || {};
  var n = o.tiers || 3, rgb = o.rgb || CINE.C.inkRGB, A = o.a == null ? 1 : o.a, PR = CINE.C.paperRGB;
  var ink = function (a) { return U.rgba(rgb, a * A); };
  var spx = s * scaleOf(c), fine = spx > 110, lw = Math.max(.0022, 1 / Math.max(1, spx));   // 界画线：约 1 设备像素
  c.save(); c.translate(x, y); c.scale(s, s); c.lineCap = 'butt';
  var lines = function (segs, w, col) {
    c.strokeStyle = col; c.lineWidth = w; c.beginPath();
    for (var i = 0; i < segs.length; i++) { c.moveTo(segs[i][0], segs[i][1]); c.lineTo(segs[i][2], segs[i][3]); }
    c.stroke();
  };
  // 台基：淡墨一抹 + 上下沿 + 正中踏道
  c.fillStyle = ink(.3); c.fillRect(-.46, -.05, .92, .05);
  c.fillStyle = ink(.85); c.fillRect(-.5, -.058, 1, .01);
  if (fine) {
    var st = []; for (var k = 0; k <= 6; k++) st.push([-.06, -.048 + k * .0075, .06, -.048 + k * .0075]);
    st.push([-.07, -.05, -.07, 0], [.07, -.05, .07, 0]);
    lines(st, lw, ink(.7));
  }
  var yb = -.05;
  for (var i = 0; i < n; i++) {
    var f = i / Math.max(1, n - 1), bw = .56 * (1 - f * .38), bh = (.2 - f * .05) * (3 / n + .1) * .9, L = -bw / 2, Rr = bw / 2, T = yb - bh;
    // 楼身：淡墨烘染，左侧背光略深
    var g = c.createLinearGradient(L, 0, Rr, 0);
    g.addColorStop(0, ink(.46)); g.addColorStop(.6, ink(.26)); g.addColorStop(1, ink(.34));
    c.fillStyle = g; c.fillRect(L, T, bw, bh);
    if (o.glow) {
      c.fillStyle = U.rgba(o.glowRGB || CINE.C.goldHiRGB, o.glow * .8 * A);
      for (k = 0; k < 4; k++) c.fillRect(L + k * bw / 4 + .018, yb - bh * .78, bw / 4 - .036, bh * .5);
    }
    // 柱与额枋（重线）；格扇（细线）
    var col = [];
    for (k = 0; k <= 4; k++) col.push([L + k * bw / 4, T, L + k * bw / 4, yb]);
    col.push([L, T + bh * .1, Rr, T + bh * .1], [L, yb - .003, Rr, yb - .003]);
    lines(col, Math.max(lw * 1.8, .006), ink(.9));
    if (fine) {
      var lat = [];
      for (k = 0; k < 4; k++) {
        var b0 = L + k * bw / 4, b1 = b0 + bw / 4;
        for (var q = 1; q < 4; q++) lat.push([b0 + q * bw / 16, T + bh * .18, b0 + q * bw / 16, yb - bh * .08]);
        lat.push([b0, T + bh * .45, b1, T + bh * .45], [b0, T + bh * .18, b1, T + bh * .18]);
      }
      lines(lat, lw, ink(.5));
    }
    // 平座栏杆：寻杖、地栿、望柱、栏板（节奏）
    if (o.rail !== false && i > 0) {
      var rw = bw * .62, rt = yb - .03, rl = [[-rw, yb - .002, rw, yb - .002], [-rw, rt, rw, rt]];
      var nb = fine ? 24 : 12;
      for (k = 0; k <= nb; k++) { var rx = -rw + k * rw * 2 / nb; rl.push([rx, yb, rx, rt - (k % 4 === 0 ? .008 : 0)]); }
      lines(rl, Math.max(lw, .0035), ink(.85));
      if (fine) { var mid = []; for (k = 0; k < nb; k++) { var mx = -rw + (k + .5) * rw * 2 / nb; mid.push([mx - rw / nb * .5, rt + .015, mx + rw / nb * .5, rt + .015]); } lines(mid, lw, ink(.5)); }
    }
    // 屋檐：中平、角起翘；屋面浓墨带瓦垄
    var e = T, span = bw * (1.55 - f * .1), rh = .07 + (i === n - 1 ? .04 : 0), lift = .045;
    var roof = function () {
      c.beginPath();
      c.moveTo(-span / 2, e - lift);
      c.quadraticCurveTo(-span * .36, e + .004, -span * .2, e + .004);
      c.lineTo(span * .2, e + .004);
      c.quadraticCurveTo(span * .36, e + .004, span / 2, e - lift);
      c.quadraticCurveTo(span * .3, e - .018, span * .17, e - rh);
      c.lineTo(-span * .17, e - rh);
      c.quadraticCurveTo(-span * .3, e - .018, -span / 2, e - lift);
      c.closePath();
    };
    if (fine) {                                        // 斗拱：檐下一排小块，疏密有致
      c.fillStyle = ink(.85);
      for (k = 0; k <= 12; k++) { var dx = -bw * .55 + k * bw * 1.1 / 12; c.fillRect(dx - .006, e + .004, .012, .011); c.fillRect(dx - .011, e + .004, .022, .004); }
    }
    c.fillStyle = ink(.8); roof(); c.fill();
    if (fine) {
      c.save(); roof(); c.clip();
      var tl = []; for (k = 0; k <= 36; k++) { var tx = -span / 2 + k * span / 36; tl.push([tx * .82, e - rh, tx, e + .006]); }
      lines(tl, lw, U.rgba(PR, .28 * A));
      c.restore();
    }
    I.stroke(c, [[-span / 2, e - lift], [-span * .2, e + .006], [span * .2, e + .006], [span / 2, e - lift]], { w: .012, a: A, rgb: rgb, head: .05, tail: .1, n: 20, seed: i + 3, bleed: 0, fade: 0 });
    lines([[-span * .17, e - rh, span * .17, e - rh]], Math.max(lw * 2, .007), ink(.95));      // 正脊
    [-1, 1].forEach(function (sd) {                    // 檐角飞翘 + 鸱吻
      I.stroke(c, [[sd * span * .44, e - lift * .6], [sd * span * .52, e - lift * 1.25], [sd * span * .55, e - lift * 1.9]], { w: .011, a: .95 * A, rgb: rgb, head: .1, tail: .6, n: 10, wob: .05, bleed: 0, fade: 0 });
      if (fine) I.stroke(c, [[sd * span * .17, e - rh], [sd * span * .19, e - rh - .02], [sd * span * .165, e - rh - .03]], { w: .007, a: .9 * A, rgb: rgb, head: .1, tail: .5, n: 8, wob: .05, bleed: 0, fade: 0 });
    });
    yb = e - rh * .55;
    if (i === n - 1) {                                 // 宝顶
      c.fillStyle = ink(.95);
      c.beginPath(); c.moveTo(-.012, yb - .02); c.lineTo(0, yb - .16); c.lineTo(.012, yb - .02); c.closePath(); c.fill();
      c.beginPath(); c.arc(0, yb - .06, .018, 0, 7); c.fill();
      if (fine) lines([[-.02, yb - .09, .02, yb - .09], [-.016, yb - .105, .016, yb - .105]], lw * 1.5, ink(.9));
    }
  }
  c.restore();
};
/* ================= 云雾 ================= */
/* 云朵精灵：翻卷云头（纸白/可着色）+ 云底淡墨 + 上缘勾云线与卷云纹；下半实心，便于层层叠压 */
I.cloudSprite = function (seed, rgb, shade, line, puff) {
  rgb = qrgb(rgb || CINE.C.paperRGB); shade = q40(shade == null ? .3 : shade); line = q40(line == null ? .35 : line);
  return U.cached('cloud' + seed + ':' + rgb.join(',') + ':' + shade + ':' + line + (puff ? 'p' : ''), function () {
    var Wc = 520, Hc = 260, c = U.canvas(Wc, Hc), x = c.getContext('2d'), r = U.rng(seed * 31 + 5);
    var puffs = [], m = 8 + Math.floor(r() * 4);
    for (var i = 0; i < m; i++) {
      var f = (i + .5) / m, env = Math.sin(Math.PI * f);
      var rad = (28 + r() * 30) * (.5 + .7 * env);
      puffs.push([40 + f * (Wc - 80) + r.pm(10), Hc * .56 - env * 50 - r() * 24 + rad * .25, rad]);
    }
    var body = function (inset) {
      x.beginPath();
      puffs.forEach(function (p) { x.moveTo(p[0] + p[2] - inset, p[1]); x.arc(p[0], p[1], Math.max(1, p[2] - inset), 0, 7); });
      var p0 = puffs[0], pl = puffs[m - 1];
      x.moveTo(0, Hc); x.lineTo(0, Hc * .8);
      x.quadraticCurveTo(p0[0] - p0[2] * .6, Hc * .72, p0[0], p0[1] + p0[2] * .4);
      x.lineTo(pl[0], pl[1] + pl[2] * .4);
      x.quadraticCurveTo(pl[0] + pl[2] * .6, Hc * .72, Wc, Hc * .8); x.lineTo(Wc, Hc); x.closePath();
      x.fill();
    };
    x.fillStyle = U.rgba(rgb, 1); body(0);
    x.lineCap = 'round';
    if (line > 0) puffs.forEach(function (p, k) {       // 云头勾线：一笔一弧，起笔重收笔轻，偶带飞白
      var a0 = Math.PI * (1.0 + .06 * U.hash(k * 5 + seed)), a1 = Math.PI * (1.97 - .08 * U.hash(k * 7 + seed)), arc = [];
      for (var q = 0; q <= 14; q++) { var an = U.lerp(a0, a1, q / 14); arc.push([p[0] + Math.cos(an) * (p[2] - 1), p[1] + Math.sin(an) * (p[2] - 1)]); }
      I.stroke(x, arc, { raw: true, w: 3 + U.hash(k * 3 + seed) * 4, a: line * (.7 + .3 * U.hash(k + seed)), rgb: CINE.C.inkRGB, head: .12, tail: .45, n: 24, seed: seed * 7 + k, wob: .3, fb: U.hash(k * 11 + seed) < .35 ? .3 : 0, bleed: 0 });
    });
    x.fillStyle = U.rgba(rgb, 1); body(3.2);
    if (line > 0) puffs.forEach(function (p, k) {                // 卷云纹：云头内一道回旋
      if (U.hash(k * 7 + seed) > .45) return;
      var sp = [];
      for (var q = 0; q <= 16; q++) {
        var an = Math.PI * (1.15 + q / 16 * 1.5), rr = p[2] * (.62 - q / 16 * .42);
        sp.push([p[0] - p[2] * .08 + Math.cos(an) * rr, p[1] + p[2] * .12 + Math.sin(an) * rr]);
      }
      I.stroke(x, sp, { raw: true, w: 2.6, a: line * .6, rgb: CINE.C.inkRGB, head: .1, tail: .6, n: 20, seed: seed + k, wob: .25, bleed: 0 });
    });
    x.save(); x.globalCompositeOperation = 'source-atop';
    var g = x.createLinearGradient(0, Hc * .3, 0, Hc);
    g.addColorStop(0, U.rgba(CINE.C.inkRGB, 0)); g.addColorStop(.5, U.rgba(CINE.C.inkRGB, shade * .35)); g.addColorStop(1, U.rgba(CINE.C.inkRGB, shade * .85));
    x.fillStyle = g; x.fillRect(0, 0, Wc, Hc);
    for (var wq = 0; wq < 3; wq++) I.wash(x, Wc * (.25 + wq * .25) + r.pm(30), Hc * (.6 + r() * .06), Wc * .3, Hc * .13, shade * .45, seed + wq, CINE.C.inkRGB, r.pm(.08), { edge: 'soft' });
    x.restore();
    var out = I.blur(c, 1), ox = out.getContext('2d');
    ox.globalCompositeOperation = 'destination-out';
    var fg = puff ? ox.createLinearGradient(0, Hc * .56, 0, Hc * .74) : ox.createLinearGradient(0, Hc * .82, 0, Hc);
    fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(1, 'rgba(0,0,0,1)');
    ox.fillStyle = fg; ox.fillRect(0, 0, Wc, Hc);
    [[0, 1], [Wc, -1]].forEach(function (e) {
      var sg = ox.createLinearGradient(e[0], 0, e[0] + e[1] * Wc * .16, 0);
      sg.addColorStop(0, 'rgba(0,0,0,1)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      ox.fillStyle = sg; ox.fillRect(e[1] > 0 ? 0 : Wc * .84, Hc * .62, Wc * .16, Hc);
    });
    return out;
  });
};
/* 一朵云：(x,y) 云头基线中心，w 宽。o: a, rgb, shade, line, flip */
I.cloud = function (c, x, y, w, seed, o) {
  o = o || {};
  var s = I.cloudSprite(seed % 9 + 1, o.rgb, o.shade, o.line, o.puff), h = w * s.height / s.width;
  c.save(); c.globalAlpha *= o.a == null ? 1 : o.a;
  if (o.flip) { c.translate(x, y); c.scale(-1, 1); c.drawImage(s, -w / 2, -h * .55, w, h); }
  else c.drawImage(s, x - w / 2, y - h * .55, w, h);
  c.restore();
};
/* 云带：一排漂移的云。o: seed, y, dy 纵向散布, n, w 云宽, t, speed(逻辑px/秒), a, shade, line, rgb, x0, span, solid 云底实心(云海用；缺省为独立云朵，底部收拢) */
I.cloudBank = function (c, o) {
  var r = U.rng(o.seed), span = o.span || (W + o.w * 2), x0 = o.x0 == null ? -o.w : o.x0;
  for (var i = 0; i < o.n; i++) {
    var bx = r() * span, by = o.y + r.pm(o.dy || 0), sc = .75 + r() * .5, sd = Math.floor(r() * 1000);
    var sp = (o.speed || 0) * (.8 + r() * .4);
    var xx = x0 + ((bx + sp * o.t) % span + span) % span;
    I.cloud(c, xx, by + Math.sin(o.t * .25 + i * 1.7) * 3, o.w * sc, sd, { a: (o.a == null ? 1 : o.a), shade: o.shade, line: o.line, rgb: o.rgb, flip: r() < .5, puff: !o.solid });
  }
};
/* 云海：自远而近多排云带，远小而淡、近大而实，翻涌漂移。
   o: t, y 云海顶线, h 深度, rows 排数, speed, rgb 云体色, shade, line, a, seed, fill 云下铺色(默认同云体) */
I.cloudSea = function (c, o) {
  var rows = o.rows || 5, y = o.y, hgt = o.h || 400, rgb = o.rgb || CINE.C.paperRGB, seed = o.seed || 1;
  for (var i = 0; i < rows; i++) {
    var f = i / Math.max(1, rows - 1), w = U.lerp(260, 760, f * f), yy = y + hgt * Math.pow(f, 1.3) * .85;
    var n = Math.ceil((W + w * 2) / (w * .5)) + 1;
    I.cloudBank(c, { seed: seed + i * 7, y: yy, dy: 10 + 20 * f, n: n, w: w, t: o.t || 0, speed: (o.speed == null ? 10 : o.speed) * (.4 + f * 1.4),
      solid: true, a: (o.a == null ? 1 : o.a) * (.72 + .28 * f), shade: (o.shade == null ? .3 : o.shade) * (.6 + .5 * f), line: (o.line == null ? .3 : o.line) * (.4 + .6 * f), rgb: rgb });
    if (i === rows - 1) {
      c.save(); c.globalAlpha *= o.a == null ? 1 : o.a;
      c.fillStyle = U.rgba(o.fill || qrgb(rgb), 1); c.fillRect(-50, yy + w * .12, W + 100, H);      // 缺省与云体精灵同色（量化后）
      c.restore();
    }
  }
};
/* 雾带：横向晕染带缓慢流动。rgb 缺省纸色（遮挡式雾）。o（新增，可缺省）: edge 'soft'|'wet'（缺省同 I.wash：深色湿边、浅色柔晕；深色雾要柔边传 'soft'） */
I.mist = function (c, y, h, a, t, seed, rgb, o) {
  rgb = rgb || CINE.C.paperRGB;
  var r = U.rng(seed || 5), n = 9;
  for (var i = 0; i < n; i++) {
    var sp = 6 + r() * 10, span = W + 900;
    var xx = -450 + ((r() * span + sp * t) % span);
    I.wash(c, xx, y + r.pm(h * .25), 380 + r() * 260, h * (.5 + r() * .4), a * (.7 + r() * .6), 30 + i % 5, rgb, 0, o);
  }
};

/* ---------- 风线：细墨气流 ----------
   o: t, seed, n, x,y,w,h 区域, speed(取绝对值), len, amp, freq, a, lw, rgb, beat(t,i)→0..1 节奏强度, curl 卷梢比例, dir(1 向右/-1 向左) */
I.wind = function (c, o) {
  var r = U.rng(o.seed || 9), n = o.n || 10, dir = o.dir || 1, rgb = o.rgb || CINE.C.inkRGB;
  for (var i = 0; i < n; i++) {
    var by = o.y + r() * o.h, ph = r() * 100, sp = Math.abs(o.speed || 160) * (.6 + r() * .8);   // 方向只由 dir 决定
    var len = (o.len || 260) * (.6 + r() * .8), span = o.w + len * 2;
    var head = (((r() * span + sp * o.t) % span) + span) % span - len;
    var life = Math.sin(Math.PI * U.clamp((head + len) / span, 0, 1));
    var beat = o.beat ? o.beat(o.t, i) : 0;
    var amp = (o.amp || 14) * (1 + beat * .8), fq = (o.freq || .012);
    var pts = [], m = 22;
    for (var k = 0; k < m; k++) {
      var xx = head - len + len * k / (m - 1);
      var yy = by + amp * Math.sin(xx * fq + o.t * 1.3 + ph) + amp * .4 * Math.sin(xx * fq * 2.7 + ph * 2);
      pts.push([o.x + (dir > 0 ? xx : o.w - xx), yy]);
    }
    if (o.curl && r() < o.curl) {
      var e = pts[pts.length - 1], cr = 10 + r() * 14;
      for (var q = 1; q <= 8; q++) {
        var ang = -Math.PI / 2 + dir * q / 8 * Math.PI * 1.3;
        pts.push([e[0] + dir * Math.cos(ang - Math.PI / 2) * cr * (1 - q / 14), e[1] + cr + Math.sin(ang - Math.PI / 2) * cr * (1 - q / 14)]);
      }
    }
    var a = (o.a == null ? .35 : o.a) * life * (.5 + .5 * r()) * (1 + beat * .9);
    if (a < .01) continue;
    I.stroke(c, pts, { raw: true, w: (o.lw || 2.4) * (1 + beat * .8) * (.6 + r() * .8), a: a, rgb: rgb, head: .3, tail: .45, seed: i + 3, n: 30 });
  }
};

/* ================= 天色与光 ================= */
/* 把变换复位到屏幕逻辑坐标（1920×1080，忽略镜头） */
I.screen = function (c) { c.setTransform(CINE.px, 0, 0, CINE.px, 0, 0); };
/* 竖向天色：stops=[[pos, rgb, a], ...]；mode 缺省 source-over */
I.sky = function (c, stops, mode) {
  c.save(); I.screen(c);
  var g = c.createLinearGradient(0, 0, 0, H);
  stops.forEach(function (s) { g.addColorStop(s[0], U.rgba(s[1], s[2] == null ? 1 : s[2])); });
  if (mode) c.globalCompositeOperation = mode;
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.restore();
};
/* ---------- 底图（AI 水墨静景）：I.plate / I.plateHas / I.plateMist ---------- */
function plateImg(id) {                                 // 已载入即可画（drawImage 时同步解码）；drawFrame 内查询记为在用，表外 id 记 miss
  var im = plates[id];
  if (!im) return null;
  if (plateAct >= 0) {
    plateUsed[id] = 1;
    var aid = acts[plateAct].id, dl = plateDeclOf(acts[plateAct]);
    if (!(dl && dl[id]) && !(plateMiss[aid] && plateMiss[aid][id])) {
      (plateMiss[aid] || (plateMiss[aid] = {}))[id] = 1;
      if (window.console) console.warn('[cine] 底图 ' + id + ' 不在 ' + aid + ' 的清单里（幕定义 plates / CINE_PLATE_ACTS），已临时并入');
    }
  }
  return im.complete && im.naturalWidth ? im : null;
}
I.plateHas = function (id) { return !!plateImg(id); };
/* 取已载入的底图 <img>（缺图 null；drawFrame 内调用同样记「在用」、清单外 id 照常 warn）。给 lib-rig.js 等需要原始像素的工具用 */
I.plateImg = plateImg;
/* 逐级减半 LOD 取图（第二幕反馈）：软件光栅下 <img> 大幅缩小（≥4 倍）、或缩小的画布源再大角度旋转时，结果会随此前画过什么差 1 级（Skia 按需生成 mipmap / 缩放缓存），破坏确定性。
   I.imgLod(id, n) → 该底图缩到 1/2^n 的画布（逐级对半双线性缩，按 id 常驻，不进 LRU：逐出后重建的新画布首画又会差 1 级）；
   I.drawImg(c, id, sx,sy,sw,sh, dx,dy,dw,dh)（或简写 (c, id, dx,dy,dw,dh) 整张）＝ drawImage 的替身：按当前变换下的实际缩放自动取级、'low' 取样。各幕贴立绘/器物请一律走它。 */
var imgLv = {}, lvSettle = null;
I.imgLod = function (id, n) {
  var im = plateImg(id);
  if (!im) return null;
  var L = imgLv[id] || (imgLv[id] = [im]);
  for (var i = L.length; i <= n; i++) {
    var p = L[i - 1], w = Math.max(1, Math.round((p.naturalWidth || p.width) / 2)), h = Math.max(1, Math.round((p.naturalHeight || p.height) / 2)), cv = U.canvas(w, h), x = cv.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'low'; x.drawImage(p, 0, 0, p.naturalWidth || p.width, p.naturalHeight || p.height, 0, 0, w, h);
    if (!lvSettle) lvSettle = U.canvas(2, 2).getContext('2d');
    lvSettle.drawImage(cv, 0, 0, 2, 2);
    L.push(cv);
  }
  return L[n];
};
I.drawImg = function (c, id, sx, sy, sw, sh, dx, dy, dw, dh) {
  var im = plateImg(id);
  if (!im) return false;
  var iw = im.naturalWidth, ih = im.naturalHeight;
  if (dx == null) { dx = sx; dy = sy; dw = sw; dh = sh; sx = 0; sy = 0; sw = iw; sh = ih; }
  var M = c.getTransform(), scl = Math.min(Math.hypot(M.a, M.b) * Math.abs(dw / sw), Math.hypot(M.c, M.d) * Math.abs(dh / sh));
  var n = U.clamp(Math.floor(Math.log2(1 / Math.max(scl, 1e-3))), 0, 5), L = n ? I.imgLod(id, n) : im, k = n ? L.width / iw : 1, kh = n ? L.height / ih : 1;
  var sm = c.imageSmoothingEnabled, q = c.imageSmoothingQuality;
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'low';
  c.drawImage(L, sx * k, sy * kh, sw * k, sh * kh, dx, dy, dw, dh);
  c.imageSmoothingEnabled = sm; c.imageSmoothingQuality = q;
  return true;
};
/* 自己铺了整屏底图的工具（I.flow 铺满模式）登记底图覆盖度，纸纹叠底照 I.plate 一样自动减弱 */
I.markPlate = function (a) { if (plateFrame !== cacheFrame) { plateFrame = cacheFrame; plateCov = 0; } plateCov = Math.max(plateCov, U.clamp(a, 0, 1)); };
/* 底图镜头 → I.cam 参数：{x,y,zoom}（相对底图中心的偏移，逻辑 px）夹到不露边后，换成 I.cam 的 {x,y,z}（注视点，底图逻辑坐标 1920×1080）。
   人物、剑光等要"钉"在底图上随推移走时：c.save(); I.cam(c, I.plateView(cam)); …按底图坐标画…; c.restore() */
I.plateView = function (cam) {
  cam = cam || {};
  var z = Math.max(1, cam.zoom || 1), mx = (W - W / z) / 2, my = (H - H / z) / 2;
  return { x: W / 2 + U.clamp(cam.x || 0, -mx, mx), y: H / 2 + U.clamp(cam.y || 0, -my, my), z: z };
};
var PLATE_WARM = [255, 226, 182], PLATE_COOL = [198, 214, 236];
/* 画一张底图：屏幕坐标（忽略当前镜头变换），缺省 cover 铺满 16:9。每帧 1 次 drawImage（fade 时 2 次）；推移只改源矩形，不重采样。
   o: cam {x,y,zoom} 视窗中心相对底图中心的偏移（逻辑 px，按 zoom=1 时的 1920×1080 尺度）与推近倍数（≥1；平移夹在不露边的范围内，见 I.plateView）
      alpha；fade {id2,k} 同构图两张交叉溶化（id2 以 k 叠在 id 上）；
      grade {dark,warm,cool} 轻调，各夹到 ≤ .35（dark<0 为提亮）：合成一次 multiply 填色（提亮另加一次 screen），会作用于其下已画内容；
      tint 'rgb(r,g,b)'（或 [r,g,b]）：给带 alpha 的前景层（fg-*、cu-hands 等）整张改色、保留原 alpha（如夜雾画成浅灰白）；
        离屏 drawImage 后 source-in 填色，按 id+tint 进 U.cached（LRU），此后每帧只 1 次 drawImage；不传时行为不变。
        （0926 实测：缓存本就命中——21 次调用只建 1 次；慢在源是 canvas：软件光栅下 imageSmoothingQuality 'high' 对 canvas/ImageBitmap 源
        走双三次重采样，1280×720 → 全屏约 24ms（'medium' 约 12ms），而 <img> 源 'high' 与 'low' 逐像素相同、约 4ms。
        故改色层以 'low'（双线性）取样：与不改色的底图同一取样、逐像素一致，约 4ms）；
      layer true：自由叠层（带 alpha 的 fg-*、cu-hands 等）——不做露边限制，可整张平移、缩放、出画：
        o.cam 定下它所在底图的镜头（同 I.plateView，随底图一同推移；缺省不推移），再在底图坐标里以画心为中心缩放 s（缺省 1）、
        平移 dx,dy（逻辑 px，缺省 0）。alpha/tint/fade 照常；grade 不作用（它压暗整屏）；不计入底图覆盖（finish 纸纹照常）。
        例：I.plate(c, 'cu-hands', { cam: cam, layer: true, dx: -40, dy: 40 + drop, s: 1, alpha: a })
      flip 'h'：整帧左右镜像（cam 仍按原图坐标给，画出的结果等于不翻时的画面整屏左右翻转；layer 分支同理）。
        比"画进离屏层再翻转贴回"少一次全屏 drawImage；钉在底图上的人物要自己按 x → W − x 镜像。
      fallback(c) 底图缺失时代画（缺省什么都不画） */
function plateTint(id, im, tint) {
  var css = typeof tint === 'string' ? tint : U.rgba(tint, 1);
  return U.cached('plateTint:' + id + ':' + css, function () {
    var cv = U.canvas(im.naturalWidth, im.naturalHeight), x = cv.getContext('2d');
    x.drawImage(im, 0, 0);
    x.globalCompositeOperation = 'source-in'; x.fillStyle = css; x.fillRect(0, 0, cv.width, cv.height);
    return cv;
  });
}
function plateLayer(c, id, im, o, A) {                  // I.plate 的 layer 分支：底图镜头下整张 cover 帧按画心缩放 s、平移 dx,dy，不夹边
  var iw = im.naturalWidth, ih = im.naturalHeight, cw = iw, ch = ih;
  if (iw / ih > W / H) cw = ih * W / H; else ch = iw * H / W;
  var s = o.s == null ? 1 : o.s, rw = W * s, rh = H * s, rx = (W - rw) / 2 + (o.dx || 0), ry = (H - rh) / 2 + (o.dy || 0);
  var sx = (iw - cw) / 2, sy = (ih - ch) / 2, ga;
  c.save(); I.screen(c); if (o.flip === 'h') { c.translate(W, 0); c.scale(-1, 1); } I.cam(c, I.plateView(o.cam));
  ga = c.globalAlpha * A; c.globalAlpha = ga;
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = o.tint ? 'low' : 'high';
  c.drawImage(o.tint ? plateTint(id, im, o.tint) : im, sx, sy, cw, ch, rx, ry, rw, rh);
  var f = o.fade, im2 = f && f.k > .003 ? plateImg(f.id2) : null;
  if (im2) {
    var ax = im2.naturalWidth / iw, ay = im2.naturalHeight / ih;
    c.globalAlpha = ga * Math.min(1, f.k);
    c.drawImage(o.tint ? plateTint(f.id2, im2, o.tint) : im2, sx * ax, sy * ay, cw * ax, ch * ay, rx, ry, rw, rh);
  }
  c.restore();
}
I.plate = function (c, id, o) {
  o = o || {};
  if (o.fade && o.fade.id2) plateImg(o.fade.id2);        // 叠化的第二张也记入清单
  var im = plateImg(id);
  if (!im) { if (o.fallback) o.fallback(c); return; }
  var A = Math.min(1, o.alpha == null ? 1 : o.alpha);
  if (A <= 0.003) return;
  if (o.layer) { plateLayer(c, id, im, o, A); return; }
  if (plateFrame !== cacheFrame) { plateFrame = cacheFrame; plateCov = 0; }
  plateCov = Math.max(plateCov, A);
  var iw = im.naturalWidth, ih = im.naturalHeight, cw = iw, ch = ih;
  if (iw / ih > W / H) cw = ih * W / H; else ch = iw * H / W;           // cover：居中裁成 16:9
  var v = I.plateView(o.cam), k = cw / W;                                // k：底图像素 / 逻辑 px
  var sw = W / v.z * k, sh = H / v.z * k, sx = (iw - cw) / 2 + (v.x - W / v.z / 2) * k, sy = (ih - ch) / 2 + (v.y - H / v.z / 2) * k;
  c.save(); I.screen(c);
  var ga = c.globalAlpha * A, fx = o.flip === 'h';
  if (fx) { c.save(); c.translate(W, 0); c.scale(-1, 1); }                // 水平翻转：只翻底图两张，grade 整屏填色不受影响
  c.globalAlpha = ga; c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  if (o.tint) c.imageSmoothingQuality = 'low';                           // 改色画布走双线性（见上：canvas 源 'high' 贵 6 倍，<img> 源本就等同双线性）
  c.drawImage(o.tint ? plateTint(id, im, o.tint) : im, sx, sy, sw, sh, 0, 0, W, H);
  var f = o.fade, im2 = f && f.k > .003 ? plateImg(f.id2) : null;
  if (im2) {
    var ax = im2.naturalWidth / iw, ay = im2.naturalHeight / ih;
    c.globalAlpha = ga * Math.min(1, f.k);
    c.drawImage(o.tint ? plateTint(f.id2, im2, o.tint) : im2, sx * ax, sy * ay, sw * ax, sh * ay, 0, 0, W, H);
  }
  if (fx) c.restore();
  var g = o.grade;
  if (g) {
    var dk = U.clamp(g.dark || 0, -.35, .35), wm = U.clamp(g.warm || 0, 0, .35), cl = U.clamp(g.cool || 0, 0, .35), ink = CINE.C.inkRGB;
    var m = [0, 1, 2].map(function (i) {
      return Math.round(255 * (1 - Math.max(0, dk) * (1 - ink[i] / 255)) * (1 - wm * (1 - PLATE_WARM[i] / 255)) * (1 - cl * (1 - PLATE_COOL[i] / 255)));
    });
    c.globalAlpha = ga;
    if (m[0] < 255 || m[1] < 255 || m[2] < 255) { c.globalCompositeOperation = 'multiply'; c.fillStyle = U.rgba(m, 1); c.fillRect(0, 0, W, H); }
    if (dk < 0) { c.globalCompositeOperation = 'screen'; c.fillStyle = U.rgba(CINE.C.whiteRGB, -dk); c.fillRect(0, 0, W, H); }
  }
  c.restore();
};
/* 雾带条（可横向无缝平铺，低分辨率放大即柔）：一排大面积柔边淡洗，浓淡沿横向起伏、中间有空隙 */
function mistStrip(seed, rgb) {
  return U.cached('mistStrip' + seed + ':' + rgb.join(','), function () {
    var q = .25, SW = W, SH = 300, c = U.canvas(SW * q, SH * q), x = c.getContext('2d'), r = U.rng(seed * 17 + 3);
    x.scale(q, q);
    for (var i = 0; i < 16; i++) {
      var cx = (i + r()) / 16 * SW, rw = 220 + r() * 300, rh = SH * (.2 + r() * .14), cy = SH * .5 + r.pm(SH * .12);
      var a = (.45 + .55 * Math.max(0, U.noise1(cx / 700, seed))) * (.55 + r() * .45);
      for (var d = -1; d <= 1; d++) if (cx + d * SW + rw * 1.1 > 0 && cx + d * SW - rw * 1.1 < SW)   // 跨缝两侧各画一遍：首尾无缝
        I.wash(x, cx + d * SW, cy, rw, rh, a, seed + i, rgb, r.pm(.04), { edge: 'soft' });
    }
    return c;
  });
}
/* 底图前的薄雾 / 流云：1–2 层大面积淡洗雾带缓慢横移，给静图制造视差（柔边，不画扇贝云头）。屏幕坐标。
   o: y 雾带中线（逻辑 px，缺省 H*.72）, h 带高（缺省 280）, a 浓度（缺省 .2）, rgb（缺省纸色）, speed 横移 px/秒（缺省 12，负为向左）,
      layers 1|2（缺省 2：第二层偏上、更薄更淡、快 1.6 倍）, seed, cam 与 I.plate 同一镜头（雾在推移中多走 depth 倍）, depth（缺省 1.3） */
I.plateMist = function (c, t, o) {
  o = o || {};
  var a = o.a == null ? .2 : o.a;
  if (a <= .003) return;
  var rgb = qrgb(o.rgb || CINE.C.paperRGB), seed = o.seed || 1, n = o.layers == null ? 2 : o.layers, sp = o.speed == null ? 12 : o.speed;
  var v = I.plateView(o.cam), dx = v.x - W / 2, dy = v.y - H / 2, z = v.z, dp = o.depth == null ? 1.3 : o.depth, zs = 1 + (z - 1) * dp;
  c.save(); I.screen(c);
  var ga = c.globalAlpha;
  for (var l = 0; l < n; l++) {
    var s = mistStrip(seed + l * 7, rgb), hh = (o.h || 280) * (l ? .7 : 1) * zs, ww = W * 1.3 * zs;
    var yc = H / 2 + ((o.y == null ? H * .72 : o.y) - (l ? (o.h || 280) * .3 : 0) - H / 2) * zs - dy * z * dp;
    var xo = ((t * sp * (l ? 1.6 : 1) - dx * z * dp + l * 700) % ww + ww) % ww - ww;
    c.globalAlpha = ga * a * (l ? .7 : 1);
    for (var xx = xo; xx < W; xx += ww) c.drawImage(s, xx, yc - hh / 2, ww, hh);
  }
  c.restore();
};
/* 夜墨场（与颜色无关，按 seed 缓存）：几遍横向刷染的浓淡层，层缘留水渍线；横向笔刷纹；大块浓淡压扁成横势 */
var nightFields = {};
function nightField(seed) {
  if (nightFields[seed]) return nightFields[seed];
  var cw = 480, ch = 270, f = new Float32Array(cw * ch), r = U.rng(seed * 13 + 31), bands = [];
  for (var b = 0; b < 5; b++) bands.push({ y: r.range(.08, .9) * ch, amp: r.range(6, 22), fr: r.range(1 / 160, 1 / 60), d: r.range(.035, .075) * (r() < .3 ? -1 : 1), up: r() < .6, sd: seed * 7 + b });
  for (var j = 0; j < ch; j++) for (var i = 0; i < cw; i++) {
    var v = .09 * U.fbm2(i / 120, j / 36, seed, 3) + .022 * U.noise2(i / 70, j / 4.5, seed + 3) + .012 * U.noise2(i / 24, j / 2.2, seed + 5);
    for (b = 0; b < 5; b++) {
      var B = bands[b], by = B.y + B.amp * U.fbm1(i * B.fr, B.sd, 3), dd = B.up ? by - j : j - by;
      if (dd > 0) v += B.d * Math.min(1, dd / 5);
      v += Math.abs(B.d) * 1.1 * Math.exp(-Math.abs(dd) / 1.3);
    }
    f[j * cw + i] = v;
  }
  f.cw = cw; f.ch = ch;
  nightFields[seed] = f;
  return f;
}
/* 夜：浓墨晕染的宣纸（几遍横扫的烘染、层缘水渍，不是照片云雾，也不是纯黑）。k 0..1 浓度；o: rgb, seed, low 地平线处浓度比(默认 .7) */
I.nightSky = function (c, k, o) {
  if (k <= 0.003) return;
  o = o || {};
  var rgb = qrgb(o.rgb || CINE.C.nightRGB), seed = o.seed || 3, low = Math.round((o.low == null ? .7 : o.low) * 100) / 100;
  var cv = U.cached('night' + rgb.join(',') + ':' + seed + ':' + low, function (px) {
    var F = nightField(seed), cw = F.cw, ch = F.ch, lo = U.canvas(cw, ch), lx = lo.getContext('2d');
    var id = lx.createImageData(cw, ch), d = id.data;
    for (var j = 0; j < ch; j++) {
      var base = U.lerp(1, low, Math.pow(j / ch, 1.3));
      for (var i = 0; i < cw; i++) {
        var v = base * (.9 + F[j * cw + i]), kk = (j * cw + i) * 4;
        d[kk] = rgb[0]; d[kk + 1] = rgb[1]; d[kk + 2] = rgb[2]; d[kk + 3] = U.clamp(v * 255, 0, 255);
      }
    }
    lx.putImageData(id, 0, 0);
    var c2 = U.canvas(W * px, H * px), x = c2.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(lo, 0, 0, c2.width, c2.height);
    x.scale(px, px);
    var r = U.rng(seed + 1);
    for (var s = 0; s < 6; s++) I.wash(x, r() * W, (.1 + r() * .7) * H, 600 + r() * 500, 36 + r() * 50, .08 + r() * .1, s + seed, rgb, r.pm(.05), { edge: s % 3 ? 'soft' : 'wet' });
    return c2;
  });
  c.save(); I.screen(c); c.globalAlpha *= Math.min(1, k);
  c.drawImage(cv, 0, 0, W, H);
  c.restore();
};
/* 破晓锚点：“东方微白”的缺省位置与形状（全片统一光位；各幕可传 x/y 覆盖） */
CINE.ANCHOR = { x: 1660, y: 690, rx: 1100, ry: 250 };
/* 东方微白：在夜色上“透出纸色”，k 0..1；o: gold 金色比例 0..1, x,y,rx,ry 覆盖锚点 */
I.dawnLight = function (c, k, o) {
  if (k <= 0.003) return;
  o = o || {};
  var A = CINE.ANCHOR, x = o.x == null ? A.x : o.x, y = o.y == null ? A.y : o.y, rx = o.rx || A.rx, ry = o.ry || A.ry;
  var col = U.mix(CINE.C.dawnRGB, CINE.C.goldHiRGB, o.gold || 0);
  c.save(); I.screen(c);
  c.translate(x, y); c.scale(1, ry / rx);
  var g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, U.rgba(col, .95 * k)); g.addColorStop(.25, U.rgba(col, .6 * k)); g.addColorStop(.6, U.rgba(col, .2 * k)); g.addColorStop(1, U.rgba(col, 0));
  c.fillStyle = g; c.fillRect(-rx, -rx, rx * 2, rx * 2);
  c.restore();
  c.save(); I.screen(c);
  I.wash(c, x - rx * .1, y + 8, rx * .7, 16, .55 * k, 5, col);                 // 地平一线天光
  c.restore();
};
/* 星点（留白点）。o: seed, n, t, a, x,y,w,h 区域, rot 旋转(绕 cx,cy), size, rgb, tw 闪烁幅度, glow 亮星光晕比例 */
I.stars = function (c, o) {
  var r = U.rng(o.seed || 21), n = o.n || 200, rgb = o.rgb || CINE.C.paperRGB, a = o.a == null ? 1 : o.a;
  var x0 = o.x || 0, y0 = o.y || 0, w = o.w || W, h = o.h || H, cx = o.cx == null ? W / 2 : o.cx, cy = o.cy == null ? H / 2 : o.cy;
  var cr = Math.cos(o.rot || 0), sr = Math.sin(o.rot || 0), t = o.t || 0, tw = o.tw == null ? .4 : o.tw;
  c.save();
  for (var i = 0; i < n; i++) {
    var px = x0 + r() * w - cx, py = y0 + r() * h - cy, sz = (o.size || 1.6) * Math.pow(r(), 3) * 2.2 + .5, ph = r() * 6.28, f = .6 + r() * 2;
    var X = cx + px * cr - py * sr, Y = cy + px * sr + py * cr;
    var al = a * (1 - tw + tw * (.5 + .5 * Math.sin(t * f + ph)));
    c.fillStyle = U.rgba(rgb, al);
    c.fillRect(X - sz / 2, Y - sz / 2, sz, sz);
    if (sz > 2.4 && o.glow !== 0) I.glow(c, X, Y, sz * 5, rgb, al * .35 * (o.glow || 1));
  }
  c.restore();
};
/* 星河：斜贯夜空的淡光带（纸色，带暗尘带），绕 (cx,cy) 旋转 rot。o: a, rot, cx, cy, len, wid, seed */
I.starRiver = function (c, o) {
  var seed = o.seed || 4, L = o.len || 2600, Wd = o.wid || 520;
  var sp = U.cached('river' + seed + ':' + L + ':' + Wd, function (px) {
    var q = Math.min(1, px * .25), cw = Math.ceil(L * q), ch = Math.ceil(Wd * q), lo = U.canvas(cw, ch), lx = lo.getContext('2d');
    var id = lx.createImageData(cw, ch), d = id.data, rgb = CINE.C.paperRGB;
    for (var j = 0; j < ch; j++) for (var i = 0; i < cw; i++) {
      var u = i / cw, v = j / ch * 2 - 1, cen = .18 * Math.sin(u * 5 + seed);
      var band = Math.exp(-Math.pow((v - cen) / .42, 2)) * Math.sin(Math.PI * u);
      var dust = U.fbm2(i / 14, j / 6, seed, 4), lane = Math.exp(-Math.pow((v - cen - .05 + .1 * U.noise1(u * 8, seed)) / .08, 2));
      var val = band * (.55 + .5 * dust) * (1 - .75 * lane);
      var k = (j * cw + i) * 4; d[k] = rgb[0]; d[k + 1] = rgb[1]; d[k + 2] = rgb[2]; d[k + 3] = U.clamp(val * 190, 0, 255);
    }
    lx.putImageData(id, 0, 0);
    var c2 = U.canvas(L * px * .5, Wd * px * .5), x = c2.getContext('2d');
    x.imageSmoothingEnabled = true; x.drawImage(I.blur(lo, 1), 0, 0, c2.width, c2.height);
    var r = U.rng(seed + 9);
    for (var s = 0; s < 2600; s++) {
      var uu = r(), vv = r.pm(1) * r(), ce = .18 * Math.sin(uu * 5 + seed);
      if (Math.abs(vv - ce) > .9 * Math.sin(Math.PI * uu)) continue;
      x.fillStyle = 'rgba(250,246,236,' + (.3 + r() * .6) + ')';
      var z = (.5 + r() * 1.2) * px * .5; x.fillRect(uu * c2.width, (vv * .5 + .5) * c2.height, z, z);
    }
    return c2;
  });
  c.save(); c.globalAlpha *= o.a == null ? 1 : o.a;
  c.translate(o.cx == null ? W / 2 : o.cx, o.cy == null ? H / 2 : o.cy); c.rotate(o.rot || 0);
  c.drawImage(sp, -L / 2, -Wd / 2, L, Wd);
  c.restore();
};
/* 光尘：升腾/漂浮的光点。o: seed, n, t, x,y,w,h, speed 上升速度, drift 横摆, rgb, size, a, mode */
I.motes = function (c, o) {
  var r = U.rng(o.seed || 31), n = o.n || 40, rgb = o.rgb || CINE.C.goldHiRGB, a = o.a == null ? 1 : o.a;
  for (var i = 0; i < n; i++) {
    var bx = o.x + r() * o.w, ph = r(), sp = (o.speed == null ? 40 : o.speed) * (.5 + r()), sz = (o.size || 4) * (.4 + r());
    var life = U.fract(ph + (o.t || 0) * sp / o.h), yy = o.y + o.h - life * o.h;
    var xx = bx + Math.sin((o.t || 0) * (.6 + r()) + i) * (o.drift == null ? 14 : o.drift);
    var al = a * Math.sin(Math.PI * life);
    if (al < .01) continue;
    I.glow(c, xx, yy, sz * 3, rgb, al * .5, o.mode);
    c.fillStyle = U.rgba(CINE.C.whiteRGB, al * .9); c.fillRect(xx - sz * .25, yy - sz * .25, sz * .5, sz * .5);
  }
};

/* ---------- 御剑流光 / 白虹 ---------- */
/* 按时间采样轨迹：fn(t)→[x,y]，取 [t-len, t] 共 n 点（尾→头） */
I.trail = function (fn, t, len, n) {
  n = n || 18;
  var pts = [];
  for (var k = 0; k < n; k++) pts.push(fn(t - len * (1 - k / (n - 1))));
  return pts;
};
/* 流光：pts 尾→头。o: rgb 光色, w 头部宽, a, glow 光晕强度, core 白芯(默认 1), mode 光晕合成(默认 lighter；浅底用 'source-over') */
I.streak = function (c, pts, o) {
  o = o || {};
  var rgb = o.rgb || CINE.C.goldHiRGB, w = o.w || 10, a = o.a == null ? 1 : o.a, gl = o.glow == null ? 1 : o.glow;
  if (a <= 0.003 || pts.length < 2) return;
  var n = pts.length;
  for (var i = 0; i < n; i += 2) {
    var k = i / (n - 1);
    I.glow(c, pts[i][0], pts[i][1], w * (1.4 + 3.2 * k) * gl, rgb, a * .22 * k * k * gl, o.mode);
  }
  I.glow(c, pts[n - 1][0], pts[n - 1][1], w * 5 * gl, rgb, a * .55 * gl, o.mode);
  I.stroke(c, pts, { raw: true, w: w, a: a * .85, rgb: rgb, wf: function (s) { return Math.pow(s, .9) * Math.min(1, (1 - s) / .04 + .5); }, n: 40, wob: .1 });
  if (o.core !== 0) I.stroke(c, pts, { raw: true, w: w * .38, a: a * (o.core || 1), rgb: CINE.C.whiteRGB, wf: function (s) { return Math.pow(s, 1.6); }, n: 40, wob: .05 });
};

/* ---------- 符箓灵光 ---------- */
/* 程序化符文（由 seed 决定字形）。o: rgb, a, glow, k 书写进度 0..1, w 线宽比 */
I.rune = function (c, x, y, s, seed, o) {
  o = o || {};
  var r = U.rng(seed * 17 + 1), rgb = o.rgb || CINE.C.qingHiRGB, a = o.a == null ? 1 : o.a, k = o.k == null ? 1 : o.k;
  if (a <= 0.003) return;
  if (o.glow !== 0) I.glow(c, x, y, s * 1.3, rgb, a * .35 * (o.glow || 1), o.mode);
  var lw = s * (o.w || .07), strokes = [], q, an;
  /* 10-14 重画：旧版「一竖三横」读成「丰」。现为符箓式：顶上一朵云头回旋（敕头），一根微 S 的主脊，两侧交替的斜钩（每笔只出一侧、长短不一），
     中段一侧挂一个小方框（罡），底下三折收尾；同 seed 同形 */
  var top = [], cx0 = x + r.pm(s * .04);
  for (q = 0; q <= 14; q++) { an = Math.PI * (1.1 + q / 14 * 2.2); var rr0 = s * (.06 + .1 * q / 14); top.push([cx0 + Math.cos(an) * rr0, y - s * .4 + Math.sin(an) * rr0 * .8]); }
  strokes.push(top);
  var spine = [[x, y - s * .28], [x + s * .05 * (r() < .5 ? -1 : 1), y], [x - s * .03, y + s * .3]];
  strokes.push(spine);
  for (var i = 0; i < 4; i++) {
    var yy = y - s * .2 + i * s * .14 + r.pm(s * .03), sd = i % 2 ? 1 : -1, len = s * (.14 + r() * .16), up = r() < .5 ? -1 : 1;
    strokes.push([[x + sd * s * .02, yy], [x + sd * len * .6, yy + up * s * .03], [x + sd * len, yy - up * s * (.05 + r() * .06)]]);
  }
  var bs = r() < .5 ? -1 : 1, bx = x + bs * s * .2, by = y + s * .1, bw2 = s * .08;
  strokes.push([[bx - bw2, by - bw2], [bx + bw2, by - bw2], [bx + bw2, by + bw2], [bx - bw2, by + bw2], [bx - bw2, by - bw2 * .6]]);
  strokes.push([[x - s * .03, y + s * .3], [x + s * .1, y + s * .36], [x - s * .08, y + s * .42], [x + s * .06, y + s * .5]]);
  var N = strokes.length;
  for (i = 0; i < N; i++) {
    var kk = U.clamp(k * N - i, 0, 1);
    if (kk <= 0) break;
    I.stroke(c, strokes[i], { w: lw, a: a, rgb: rgb, k: kk, head: .1, tail: .3, n: 18, seed: seed + i, wob: .1, mode: o.lineMode });
  }
};
/* 符纸：一道发光竖条符（纸色符身 + 光色符文）。o: rgb, a, rot */
I.fu = function (c, x, y, s, seed, o) {
  o = o || {};
  var rgb = o.rgb || CINE.C.qingHiRGB, a = o.a == null ? 1 : o.a;
  c.save(); c.translate(x, y); c.rotate(o.rot || 0);
  I.glow(c, 0, 0, s * 1.2, rgb, a * .4, o.mode);
  c.fillStyle = U.rgba(CINE.C.paperRGB, a * .9); c.fillRect(-s * .18, -s * .5, s * .36, s);
  c.strokeStyle = U.rgba(rgb, a * .8); c.lineWidth = s * .02; c.strokeRect(-s * .16, -s * .48, s * .32, s * .96);
  I.rune(c, 0, 0, s * .8, seed, { rgb: U.mix(rgb, CINE.C.inkRGB, .35), a: a, glow: 0, w: .06 });
  c.restore();
};

/* ---------- 逝水：一线淡墨水流（时不我待母题） ----------
   pts 路径；o: t, w, a, rgb, speed(px/s), k 可见长度比例 0..1（寿元折半即 .5）, seed */
I.flow = function (c, pts, o) {
  o = o || {};
  var k = o.k == null ? 1 : U.clamp(o.k, 0, 1);
  if (k <= 0.01) return;
  var p = I.resample(I.spline(pts, 8), 80), n = Math.max(2, Math.round(80 * k)), q = p.slice(0, n);
  var w = o.w || 10, a = o.a == null ? .5 : o.a, rgb = o.rgb || CINE.C.inkRGB, len = p.len * k, t = o.t || 0;
  I.stroke(c, q, { raw: true, w: w, a: a * .35, rgb: rgb, head: .08, tail: .25, n: 60, seed: o.seed || 7 });
  I.stroke(c, q, { raw: true, w: w * .3, a: a * .6, rgb: rgb, head: .1, tail: .3, n: 60, seed: (o.seed || 7) + 1 });
  var m = Math.max(3, Math.round(len / 60)), sp = o.speed == null ? 50 : o.speed;
  for (var j = 0; j < m; j++) {
    var s = U.fract(j / m + t * sp / Math.max(1, len)), i0 = Math.floor(s * (n - 1)), i1 = Math.min(n - 1, i0 + 3);
    if (i1 <= i0) continue;
    var fade = Math.sin(Math.PI * s);
    I.stroke(c, [q[i0], q[i1]], { raw: true, w: w * .5, a: a * .7 * fade, rgb: CINE.C.paperRGB, head: .3, tail: .5, n: 8, wob: .05 });
  }
};

/* ---------- 草木抽芽：k 0..1 生长。o: a, rgb, lean ---------- */
I.sprout = function (c, x, y, s, k, seed, o) {
  o = o || {};
  if (k <= 0.01) return;
  var r = U.rng(seed * 13 + 7), n = 3 + Math.floor(r() * 4), rgb = o.rgb || CINE.C.inkRGB, a = o.a == null ? .9 : o.a;
  for (var i = 0; i < n; i++) {
    var kk = U.clamp(k * 1.3 - i * .08, 0, 1), ang = -Math.PI / 2 + r.pm(.7) + (o.lean || 0), L = s * (.5 + r() * .6) * U.easeOut(kk);
    if (L < .5) continue;
    var bend = r.pm(.5);
    var p1 = [x + Math.cos(ang) * L * .5, y + Math.sin(ang) * L * .5], p2 = [x + Math.cos(ang + bend) * L, y + Math.sin(ang + bend) * L];
    I.stroke(c, [[x + r.pm(2), y], p1, p2], { w: Math.max(1, s * .06), a: a, rgb: rgb, head: .05, tail: .7, n: 12, seed: seed + i });
    if (kk > .6 && r() < .6) {
      c.fillStyle = U.rgba(rgb, a * U.ramp(kk, .6, 1));
      I.blot(c, p2[0], p2[1], s * .07, seed + i * 3, { rough: .3, n: 10, sx: 1.5, sy: .7, rot: ang + bend }); c.fill();
    }
  }
};

/* ---------- 撕裂天际的一道强光（破关/天劫）：k 0..1 出现-消散 ---------- */
I.rift = function (c, x0, y0, x1, y1, k, seed, o) {
  o = o || {};
  if (k <= 0.01) return;
  var r = U.rng(seed), pts = [], n = 14, env = Math.sin(Math.PI * U.clamp(k, 0, 1));
  for (var i = 0; i <= n; i++) {
    var f = i / n, j = (i === 0 || i === n) ? 0 : r.pm(1) * 40 * (o.jag == null ? 1 : o.jag);
    pts.push([U.lerp(x0, x1, f) + j * (y1 - y0) / Math.hypot(x1 - x0, y1 - y0 || 1), U.lerp(y0, y1, f) - j * (x1 - x0) / Math.hypot(x1 - x0, y1 - y0 || 1)]);
  }
  var reach = Math.max(2, Math.ceil(pts.length * U.clamp(k * 3, 0, 1)));
  I.streak(c, pts.slice(0, reach), { rgb: o.rgb || CINE.C.goldHiRGB, w: (o.w || 6) * env, a: env, glow: 2, mode: o.mode });
};

/* ---------- 四角墨压（胸口发闷）：k 0..1 ---------- */
I.press = function (c, k, o) {
  if (k <= 0.003) return;
  o = o || {};
  var rgb = o.rgb || CINE.C.inkRGB, R = 520 + 380 * k, al = (o.a == null ? .9 : o.a) * k;
  c.save(); I.screen(c);
  [[0, 0], [W, 0], [0, H], [W, H]].forEach(function (p, i) {
    I.wash(c, p[0], p[1], R * 1.2, R, al, 3 + i, rgb, 0, { edge: 'soft' });
    I.wash(c, p[0], p[1], R * .7, R * .6, al * .9, 7 + i, rgb, 0, { edge: 'soft' });
  });
  c.restore();
};

/* ================= 人物剪影（写意泼墨，姿态参数化） =================
   局部坐标：原点在脚底，向上为负 y，单位 = 身高；面向右（face=-1 镜像）。
   字段（皆可缺省）：
     x,y,s 位置与身高(px)；face 1/-1；kind 角色预设（见 I.KIND，缺省 man）；t 时间（衣袂飘动）；seed；a 整体透明；rgb 墨色
     lean 前倾(弧度)；bow 躬身 0..1；head 仰头(+)/低头(-)；look 头朝向 1 前 → -1 回头；shrug 缩肩 0..1；
     armF/armB [肩角, 肘角]（从下垂起算，向前为正，弧度；π/2 平举、π 上举）；
     stride 步幅 0..1；step 步相(弧度，随时间递增即走路)；sit 坐 0..1；curl 蜷缩 0..1；fly 御剑飞行 0..1（衣袂强烈后飘）；
     wind 风力 0..1；windDir 风向（世界坐标 -1 向左 / 1 向右）；laugh 笑颤 0..1；
     hairStyle 'daoji'道髻|'shufa'束发|'guan'女冠|'kid'双髻|'loose'披发；hair 须发 0 白 → 1 黑；hairRGB；
     beard 长须 0..1；beardFull 络腮 0..1；sleeve 袖宽倍率；build 体宽倍率；tall 身高倍率；
     robe 'ink'|'white'|'grey'；sword 'waist'|'back'|false；fuchen 拂尘 true；
     detail 细节级 0..1（缺省按屏上尺寸：远景简笔，近景泼墨）；wash 近景衣身淡墨浓度（缺省 .46，夜景可给 .7 保剪影）；
     plate 站在 AI 底图上 0..1（true=1）：衣身、双袖淡墨浓度缺省提到 ≥ .75（剪影实、不透云），外缘加一圈湿墨渗化与脚下洇痕，和底图笔意衔接 */
I.KIND = {   // 角色预设：按本片人物自行添加，字段见上；缺省 man 即无预设
  man: {}
};
I.POSE = {
  stand: { armF: [.08, .15], armB: [-.05, .15] },
  walk: { stride: .8, armF: [.22, .3], armB: [-.18, .2] },
  lookUp: { head: .75, lean: -.1, armF: [.12, .2], armB: [-.05, .2] },
  shrug: { shrug: 1, head: -.22, armF: [.3, .7], armB: [.12, .6] },
  scratch: { shrug: .55, head: -.15, ikF: { head: [-.04, -.025] }, armB: [.08, .3] },
  point: { armF: [1.85, -.05], head: .1, lean: .03, armB: [-.1, .3] },
  hush: { ikF: { head: [.075, .025] }, head: .06, armB: [-.05, .2] },
  beat: { armF: [2.3, .5], head: .3, armB: [.1, .3] },
  laugh: { laugh: 1, head: .35, lean: -.08, armF: [.45, .9], armB: [.25, .7] },
  handOnShoulder: { armF: [1.45, .35], lean: .06, armB: [-.05, .2] },
  reach: { armF: [1.4, .1], lean: .1, head: -.05, armB: [-.1, .3] },
  salute: { bow: .3, ikF: { neck: [.13, .1] }, ikB: { neck: [.12, .1] } },
  bowDeep: { bow: .78, head: .2, ikF: { neck: [.13, .08] }, ikB: { neck: [.12, .08] } },
  holdHead: { sit: 1, bow: .5, head: -.6, ikF: { head: [.0, -.04] }, ikB: { head: [-.04, -.02] } },
  sit: { sit: 1, armF: [.55, .9], armB: [.35, .9] },
  meditate: { sit: 1, armF: [.7, 1.2], armB: [.6, 1.25] },
  curl: { sit: 1, curl: 1, bow: .45, head: -.7, ikF: { hip: [.2, -.12] }, ikB: { hip: [.18, -.1] } },
  fly: { fly: 1, lean: .1, armF: [.25, .2], armB: [-.5, .1] },
  fist: { armF: [.7, 1.9], lean: .08, head: -.1, armB: [-.05, .3] }
};
I.pose = function (name, over) {
  var p = {}, b = I.POSE[name] || {}, k;
  for (k in b) p[k] = Array.isArray(b[k]) ? b[k].slice() : b[k];
  for (k in over || {}) p[k] = over[k];
  return p;
};
var POSE_NUM = ['lean', 'bow', 'head', 'shrug', 'stride', 'sit', 'curl', 'fly', 'laugh', 'look'];
/* 两姿态插值（数值字段与手臂角度），k 0..1 */
I.lerpPose = function (a, b, k) {
  var p = {}, key;
  for (key in a) p[key] = a[key];
  for (key in b) if (!(key in p) || k >= .5) p[key] = b[key];
  POSE_NUM.forEach(function (n) {
    var d = n === 'look' ? 1 : 0;
    p[n] = U.lerp(a[n] == null ? d : a[n], b[n] == null ? d : b[n], k);
  });
  ['F', 'B'].forEach(function (w) {
    var A = armAngles(a, w), B = armAngles(b, w);
    p['arm' + w] = [U.lerp(A[0], B[0], k), U.lerp(A[1], B[1], k)];
    delete p['ik' + w]; delete p['ik' + w + 'W'];
  });
  return p;
};
/* 姿态里的 IK 目标折算成手臂角度（供插值） */
function armAngles(pose, w) {
  if (!pose['ik' + w] && !pose['ik' + w + 'W']) return pose['arm' + w] || [0, .2];
  var sk = I.skeleton(pose), A = sk['arm' + w];
  return [A.a1 - sk.tilt, A.a2 - A.a1];
}
/* 姿态时间线：keys=[[t, poseObj], ...] → t 时刻的插值姿态 */
I.poseAt = function (t, keys) {
  if (t <= keys[0][0]) return I.lerpPose(keys[0][1], keys[0][1], 0);
  for (var i = 1; i < keys.length; i++) if (t <= keys[i][0]) {
    return I.lerpPose(keys[i - 1][1], keys[i][1], U.smooth((t - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0])));
  }
  var L = keys[keys.length - 1][1]; return I.lerpPose(L, L, 0);
};
function V(x, y) { return [x, y]; }
function vadd(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
function vrot(v, a) { var c = Math.cos(a), s = Math.sin(a); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c]; }
function vmix(a, b, k) { return [U.lerp(a[0], b[0], k), U.lerp(a[1], b[1], k)]; }
/* 骨架：局部坐标关节 */
I.skeleton = function (p) {
  var sit = p.sit || 0, curl = p.curl || 0, bow = p.bow || 0, shrug = p.shrug || 0;
  var stride = p.stride || 0, step = p.step || 0, t = p.t || 0;
  var bob = stride * .012 * Math.abs(Math.sin(step));
  var hip = V(0, U.lerp(-.47, -.12, sit) + bob);
  var tilt = (p.lean || 0) + bow * 1.15 + curl * .25;
  var laugh = (p.laugh || 0) * (.011 * Math.sin(t * 31) + .006 * Math.sin(t * 17));
  var torsoLen = .3 * (1 - shrug * .05) * (1 - curl * .12);
  var neck = vadd(hip, vrot(V(0, -torsoLen), tilt));
  neck[1] += laugh;
  var headUp = tilt - (p.head || 0) * .9;
  var neckLen = .032 * (1 - shrug * .8);
  var headC = vadd(neck, vrot(V(0, -(neckLen + .052)), headUp));
  headC[1] += laugh * .6;
  var shY = .012 - shrug * .032;
  var shF = vadd(neck, vrot(V(.04, shY + .022), tilt)), shB = vadd(neck, vrot(V(-.048, shY + .026), tilt));
  shF[1] += laugh * .8; shB[1] += laugh * .8;
  var S = (p.s || 200) * (p.tall || 1), fc = p.face || 1;
  function target(T, TW) {                 // IK 目标：[x,y] 局部 | {head|neck|hip:[dx,dy]} 相对关节 | TW 世界坐标
    if (TW) return [(TW[0] - (p.x || 0)) / (S * fc), (TW[1] - (p.y || 0)) / S];
    if (!T) return null;
    if (T.head) return vadd(headC, T.head); if (T.neck) return vadd(neck, T.neck); if (T.hip) return vadd(hip, T.hip);
    return T;
  }
  function arm(sh, ang, T, bend) {
    var a1, a2, el;
    if (T) {
      var dx = T[0] - sh[0], dy = T[1] - sh[1], d = Math.min(Math.hypot(dx, dy), .3099), base = Math.atan2(dx, dy);
      var cA = Math.acos(U.clamp((.0256 + d * d - .0225) / (.32 * Math.max(d, 1e-4)), -1, 1));
      a1 = base + (bend || -1) * cA; el = vadd(sh, vrot(V(0, .16), -a1));
      a2 = Math.atan2(T[0] - el[0], T[1] - el[1]);
    } else {
      ang = ang || [0, .2];
      a1 = ang[0] + tilt; a2 = a1 + ang[1]; el = vadd(sh, vrot(V(0, .16), -a1));
    }
    var wr = vadd(el, vrot(V(0, .15), -a2));
    return { sh: sh, el: el, wr: wr, a1: a1, a2: a2 };
  }
  var lf = Math.sin(step) * stride, lb = -Math.sin(step) * stride;
  return { hip: hip, neck: neck, head: headC, headUp: headUp, tilt: tilt,
    armF: arm(shF, p.armF, target(p.ikF, p.ikFW), p.bendF), armB: arm(shB, p.armB, target(p.ikB, p.ikBW), p.bendB),
    footF: V(.03 + lf * .12, 0), footB: V(-.03 + lb * .12, 0), sit: sit, curl: curl };
};
/* 宽袖：从肩到腕。前臂下垂时袖底随重力与风垂坠成帘（袖摆是一条会起伏的布边，几段波沿摆传开）；
   前臂平举、上举时（rk→1）广袖随重力下垂：袖口自前臂朝下垂坠到最低的袖角，袖底再斜收回肘下、略略下兜——垂帘，不是圆兜；
   前臂上举时袖口顺小臂滑向肘（bare：前袖露出小臂，后袖不滑）。两态按前臂方向连续过渡，控制点逐点插值。
   近景（D>0）靠浓淡衣纹与飞白边表现：袖口一笔湿墨收尖于袖角，袖底一笔淡些、带飞白（不闭合成一圈），自小臂引向袖角的两三道衣纹。
   D 细节级 0..1（远景 0 = 简笔），t 时间，wa 风势。返回手的位置、前臂方向、袖角 tip、袖口点 cuff 与是否露小臂 bare */
function drawSleeve(c, Ar, wx, fl, col, lineRGB, lineA, width, A, seed, D, t, wa, bare) {
  D = D || 0; t = t || 0; wa = wa == null ? .5 : wa;
  var sh = Ar.sh, el = Ar.el, wr = Ar.wr;
  var dx = wr[0] - el[0], dy = wr[1] - el[1], dl = Math.hypot(dx, dy) || 1, ux = dx / dl, uy = dy / dl;
  var nx = -uy, ny = ux;
  if (ny < -.15 || (Math.abs(ny) <= .15 && nx * (wx || -1) < 0)) { nx = -nx; ny = -ny; }
  var N = [nx, ny], hv = [wx * .9, 1], hl = Math.hypot(hv[0], hv[1]); hv = [hv[0] / hl, hv[1] / hl];
  var pv = [-hv[1], hv[0]];
  var f = fl(seed), drop = width * (1.05 + .3 * f), wd = function (P, k, m) { return [P[0] + k[0] * m, P[1] + k[1] * m]; };
  var amp = width * .17 * (wa + .15);
  var wave = function (k, P) {
    var s1 = Math.sin(t * 3.1 + k * 1.9 + seed), s2 = Math.sin(t * 2.2 + k * 2.7 + seed * .7);
    return [P[0] + pv[0] * amp * s1 + hv[0] * amp * .45 * s2, P[1] + pv[1] * amp * s1 + hv[1] * amp * .45 * s2];
  };
  // 下垂态（rk=0）：袖口是整条前缘，自腕上沿垂到袖底最低处；袖底再缓缓收回腋下
  var F0 = [wr[0] - nx * .012, wr[1] - ny * .012];
  var F1 = wave(2, wd(wd([wr[0] + ux * width * .12, wr[1] + uy * width * .12], N, width * .4), hv, drop));
  var Fm = wave(1, wd(wd(vmix(F0, F1, .5), [ux, uy], width * .1), hv, width * .05));
  var B1 = wave(3, wd(wd(vmix(el, wr, .55), N, width * .55), hv, drop * .78));
  var B2 = wave(4, wd(wd(el, N, width * .45), hv, drop * .42));
  var elB = [el[0] + nx * width * .42, el[1] + ny * width * .42];
  // 举臂态（rk=1）：袖口点 Ca（上举时滑向肘）→ 袖口垂坠到袖角 K（略偏向肘、随风微摆）→ 袖角折回 → 袖底下兜 → 肘下
  var rk = U.smooth((.8 - uy) / .45), up = U.clamp(-uy, 0, 1), uc = bare ? 1 - .7 * U.smooth(up / .9) : 1, Ca = vmix(el, wr, uc);
  var E = vmix(wd(wd(el, N, width * .45), hv, width * .5), wd(sh, N, width * .3), up);          // 袖底收回处：平举时在肘下，上举时退到腋下
  var ea = [E[0] - Ca[0], E[1] - Ca[1]], el2 = Math.hypot(ea[0], ea[1]) || 1, bg = (ea[0] * hv[0] + ea[1] * hv[1]), bv = [ea[0] - bg * hv[0], ea[1] - bg * hv[1]], bl = Math.hypot(bv[0], bv[1]);
  bv = bl > 1e-4 ? [bv[0] / bl, bv[1] / bl] : N; bl /= el2;                // 袖帘里侧：自袖口垂直于重力、朝袖底收回处（平举时即朝肘）
  var sway = width * .12 * (Math.sin(t * 2.3 + seed) * .6 + Math.sin(t * 3.7 + seed * .7) * .4) * (wa + .2);
  var C0 = [Ca[0] + ux * .014 - nx * .012, Ca[1] + uy * .014 - ny * .012];
  var K = wd(wd(wd(wd(Ca, hv, width * (1.9 - .4 * up) * (1 + .08 * f)), bv, width * .3 * bl), ea, .3 * up), pv, sway);   // 上举时袖角退向腋下：垂在上臂下，不挑成尖旗
  if (K[1] > -.004) K[1] = -.004;                                          // 不垂到地面以下
  var Km = wd(wd(vmix(C0, K, .5), bv, -width * .1), pv, sway * .4);
  var ke = [E[0] - K[0], E[1] - K[1]], kl = Math.hypot(ke[0], ke[1]) || 1;
  var Kb = wd(K, ke, width * (.35 + .3 * up) / kl), Bm = wd(vmix(Kb, E, .5), hv, width * (.1 + .2 * up));
  var P = [[F0, C0], [Fm, Km], [F1, K], [B1, Kb], [B2, Bm], [elB, E]].map(function (q) { return vmix(q[0], q[1], rk); });
  var hem = I.spline(P, 5), cut = 10;                                     // hem[cut] = P[2] 袖角
  var top0 = [sh[0] - nx * .014, sh[1] - ny * .014 - .006], armpit = [sh[0] - .01, sh[1] + .05];
  var path = function () {
    c.beginPath();
    c.moveTo(top0[0], top0[1]);
    c.quadraticCurveTo(el[0] - nx * .018, el[1] - ny * .018, P[0][0], P[0][1]);
    for (var i = 0; i < hem.length; i++) c.lineTo(hem[i][0], hem[i][1]);
    c.quadraticCurveTo(sh[0] + nx * .03, sh[1] + .06, armpit[0], armpit[1]);
    c.closePath();
  };
  c.fillStyle = col; path(); c.fill();
  var ink = lumOf(lineRGB) < 110 && lineA > .7;
  var iv = vmix([-ux, -uy], bv, rk), il = Math.hypot(iv[0], iv[1]) || 1; iv = [iv[0] / il, iv[1] / il];   // 袖口里侧
  if (D > 0 && ink) {                                        // 袖身：上缘一笔浓墨侧锋，袖口内里一道暗，袖底（垂帘处更大）一片提淡
    c.save(); path(); c.clip();
    var lc = wd(vmix(P[3], vmix(P[1], P[4], .5), rk), hv, -width * (.5 - .3 * rk));   // 垂帘时是一道顺垂向的淡（竖长），不是一团圆光
    I.wash(c, lc[0], lc[1], width * (.9 - .5 * rk), width * (.6 + .5 * rk), (.16 + .02 * rk) * D * A, seed + 2, CINE.C.paperRGB, rk * Math.atan2(-hv[0], hv[1]));
    I.stroke(c, [wd(P[0], iv, width * .1), wd(P[1], iv, width * .16), wd(wd(P[2], iv, width * .2), hv, -width * .15 * rk)], { w: width * .32, a: .45 * D * A, rgb: lineRGB, head: .1, tail: .4, n: 12, seed: seed + 4 });
    c.restore();
    var sl = U.smooth((1 - uc) / .3), s1 = vmix(el, vmix(sh, el, .5), sl), s2 = vmix(Ca, el, sl);   // 袖口滑向肘时，这一笔只走上臂（不在肘弯折回）
    I.sweep(c, [[sh[0] + nx * width * .05, sh[1] + ny * width * .05], [s1[0] + nx * width * .1, s1[1] + ny * width * .1], [s2[0] + nx * width * .12, s2[1] + ny * width * .12]],
      { w: width * .62, a: .75 * D * A, rgb: lineRGB, seed: seed + 5, dry: .35, n: 16 });
  }
  // 布边：袖口一笔（举臂时收尖于袖角）；袖底一笔（举臂时淡些、飞白多，末了一段枯笔）——两笔不闭合成圈
  I.stroke(c, hem.slice(0, cut + 1), { raw: true, w: width * .19, a: lineA * A, rgb: lineRGB, head: .06, tail: U.lerp(.06, .35, rk), n: 14, seed: seed + 3, fb: .15 * D * rk });
  I.stroke(c, hem.slice(cut), { raw: true, w: width * .19 * (1 - .3 * rk), a: lineA * A * (1 - .35 * rk), rgb: lineRGB, head: U.lerp(.06, .25, rk), tail: .45, n: 18, seed: seed + 13, fb: (.3 + .35 * rk) * D });
  if (D > 0 && rk > .01) I.dry(c, hem.slice(cut, hem.length - 3), { raw: true, w: width * .16, a: lineA * A * .45 * rk * D, rgb: lineRGB, dry: .6, seed: seed + 14, hairs: 5, n: 20 });
  if (D > .15) {                                             // 衣纹：自小臂、肘垂向袖角与袖底（浓、次浓、淡三道）
    var fa = lineA * A * Math.min(1, D * 1.5), sE = vmix(el, Ca, .6 * rk), tB = vmix(P[3], P[4], .6 * rk);
    I.stroke(c, [wd(sE, N, width * .18), wd(vmix(sE, P[2], .5), pv, width * .1), wd(P[2], hv, -width * .3)],
      { w: width * .11, a: fa * .6, rgb: lineRGB, head: .1, tail: .6, n: 16, seed: seed + 7, fade: .5 });
    I.stroke(c, [wd(vmix(sh, el, .6), N, width * .2), wd(vmix(el, tB, .6), pv, width * .06), wd(tB, hv, -width * .22)],
      { w: width * .09, a: fa * .5, rgb: lineRGB, head: .1, tail: .6, n: 14, seed: seed + 8, fade: .5 });
    if (rk > .01) I.stroke(c, [wd(C0, bv, width * .22), wd(vmix(C0, K, .35), bv, width * .34), wd(vmix(C0, K, .62), bv, width * .3)],
      { w: width * .07, a: fa * .4 * rk, rgb: lineRGB, head: .15, tail: .6, n: 12, seed: seed + 9, fade: .5 });
  }
  return { hand: [wr[0] + ux * .026, wr[1] + uy * .026], ux: ux, uy: uy, tip: P[2], cuff: Ca, bare: uc < .985 };
}
/* 中式剑格（元宝形）：短而厚，约 2.4 倍剑身宽，中间鼓、两翼略翘向剑柄——不是西式十字护手的细长横杠。
   P 剑格中心，d 指向剑尖的方向（不必单位化），hl 半长，w 中间厚，col 填色 */
function jianGuard(c, P, d, hl, w, col) {
  var dl = Math.hypot(d[0], d[1]) || 1, ux = d[0] / dl, uy = d[1] / dl, nx = -uy, ny = ux, k = hl * .35;
  I.stroke(c, [[P[0] - nx * hl - ux * k, P[1] - ny * hl - uy * k], [P[0] + ux * k * .3, P[1] + uy * k * .3], [P[0] + nx * hl - ux * k, P[1] + ny * hl - uy * k]],
    { w: w, fill: col, wf: function (q) { return .45 + .55 * Math.sin(Math.PI * q); }, n: 12, wob: 0 });
}
/* 头与发式（在头部坐标系里画：x 朝前，y 朝下） */
function headPath(c, R, prof) {           // 头形：侧影（额、鼻、唇、颏的轮廓，不画五官）或圆
  c.beginPath();
  if (!prof) { c.ellipse(0, 0, R * .86, R, 0, 0, 7); return; }
  c.moveTo(-R * .86, 0);
  c.bezierCurveTo(-R * .9, -R * .75, -R * .4, -R * 1.05, R * .1, -R * 1.0);
  c.bezierCurveTo(R * .55, -R * .95, R * .8, -R * .6, R * .82, -R * .3);
  c.lineTo(R * .9, -R * .12);
  c.quadraticCurveTo(R * 1.14, R * .1, R * 1.1, R * .17);
  c.lineTo(R * .9, R * .27);
  c.quadraticCurveTo(R * .99, R * .37, R * .9, R * .45);
  c.quadraticCurveTo(R * .96, R * .6, R * .82, R * .73);
  c.quadraticCurveTo(R * .5, R * .98, 0, R * .92);
  c.quadraticCurveTo(-R * .7, R * .8, -R * .86, 0);
  c.closePath();
}
var PROFILE = [[.1, -1], [.55, -.95], [.8, -.6], [.82, -.3], [.9, -.12], [1.1, .17], [.9, .27], [.96, .4], [.9, .5], [.82, .73], [.45, .95], [0, .92]];
/* 近景的发：两大笔侧锋——额际扫过头顶、头顶落到后颈，收笔飞白；发髻是绕一圈的一笔（头部坐标系，R 头半径） */
var BUN = { shufa: [-.38, -1.1, .26, .21], daoji: [-.12, -1.24, .4, .34], guan: [-.1, -1.18, .44, .34] };
function hairSweeps(c, R, rgb, a, sd, st) {
  I.sweep(c, [[R * .52, -R * .66], [R * .12, -R * .98], [-R * .45, -R * .95], [-R * .86, -R * .42]], { w: R * .5, a: .95 * a, rgb: rgb, seed: sd + 20, dry: .3, fb: .22, head: .08, n: 22 });
  I.sweep(c, [[-R * .2, -R * .9], [-R * .72, -R * .55], [-R * .82, R * .05], [-R * .6, R * .62]], { w: R * .42, a: .9 * a, rgb: rgb, seed: sd + 22, dry: .35, fb: .3, head: .08, n: 22 });
  var b = BUN[st];
  if (b && st !== 'guan') {
    var bk = []; for (var q = 0; q <= 14; q++) { var ba = -.6 + q / 14 * 5.2; bk.push([R * b[0] + Math.cos(ba) * R * b[2] * (1 - q / 40), R * b[1] + Math.sin(ba) * R * b[3] * (1 - q / 40)]); }
    I.sweep(c, bk, { w: R * b[3] * 1.1, a: .95 * a, rgb: rgb, seed: sd + 23, dry: .25, fb: .15, head: .1, tail: .3, n: 30 });
  }
}
/* D 细节级：近景时脸是淡墨一抹、只用一笔侧脸线勾出（简笔，不画五官），发髻浓墨带飞白 */
function drawHeadLocal(c, p, R, ink, hairCol, hairEdge, lineW, A, D) {
  D = D || 0;
  var st = p.hairStyle, white = (p.hair == null ? 1 : p.hair) < .6, prof = p.profile !== false;
  if (!p.noFace) { c.fillStyle = ink(U.lerp(.93, white ? .86 : .7, D)); headPath(c, R, prof); c.fill(); }   // 白发时脸保持深，发色才读得出
  if (D > .2 && prof && !p.noFace) {
    I.stroke(c, PROFILE.map(function (q) { return [q[0] * R, q[1] * R]; }), { w: R * .13, a: .95 * (A == null ? 1 : A), rgb: p.rgb || CINE.C.inkRGB, head: .05, tail: .3, n: 30, seed: 17, wob: .3, fade: .2 });
  }
  if (p.beardFull) { c.fillStyle = ink(.97); c.beginPath(); c.ellipse(R * .28, R * .5, R * 1.0 * p.beardFull, R * .72, .3, 0, 7); c.fill(); }
  var edge = function () { if (white) { c.strokeStyle = hairEdge; c.lineWidth = lineW; c.stroke(); } };
  var big = D > .5 && !p.noCap && (st === 'daoji' || st === 'shufa' || st === 'guan');
  if (big) {                                       // 近景：发用笔扫出，不再是平涂发盖
    var hv = p.hair == null ? 1 : p.hair, hrgb = U.mix([238, 234, 224], p.hairRGB || p.rgb || CINE.C.inkRGB, hv);
    hairSweeps(c, R, hrgb, A == null ? 1 : A, 7, st);
    if (white) I.dry(c, [[R * .5, -R * .7], [-R * .3, -R * 1.02], [-R * .88, -R * .3], [-R * .6, R * .6]], { w: R * .4, a: .45 * (A == null ? 1 : A), rgb: CINE.C.greyRGB, dry: .6, hairs: 6, n: 24, seed: 29 });
  }
  c.fillStyle = hairCol;
  if (!big && !p.noCap && (st === 'daoji' || st === 'guan' || st === 'shufa' || st === 'kid' || st === 'loose')) {
    c.beginPath();                                   // 发盖：前额上缘 → 头顶 → 后脑 → 颈后
    c.moveTo(R * .5, -R * .7);
    c.quadraticCurveTo(R * .1, -R * 1.25, -R * .75, -R * .8);
    c.quadraticCurveTo(-R * 1.12, -R * .2, -R * .72, R * .62);
    c.quadraticCurveTo(-R * .25, R * .1, -R * .05, -R * .35);
    c.quadraticCurveTo(R * .2, -R * .6, R * .5, -R * .7);
    c.closePath(); c.fill(); edge();
    if (D > .2) I.dry(c, [[R * .45, -R * .78], [-R * .2, -R * 1.02], [-R * .85, -R * .55], [-R * .8, R * .3]], { w: R * .5, a: (white ? .35 : .5) * D * (A == null ? 1 : A), rgb: white ? CINE.C.greyRGB : (p.rgb || CINE.C.inkRGB), dry: .55, hairs: 7, n: 24, seed: 23 });
  }
  if (st === 'daoji') {
    if (!big) { c.beginPath(); c.ellipse(-R * .12, -R * 1.24, R * .42, R * .36, -.15, 0, 7); c.fill(); edge(); }
    c.strokeStyle = ink(.85); c.lineWidth = lineW * (big ? .8 : 1.3);
    c.beginPath(); c.moveTo(-R * .62, -R * 1.18); c.lineTo(R * .48, -R * 1.36); c.stroke();
  } else if (st === 'shufa') {
    if (!big) { c.beginPath(); c.ellipse(-R * .38, -R * 1.08, R * .36, R * .3, -.4, 0, 7); c.fill(); }
  } else if (st === 'guan') {
    if (!big) { c.beginPath(); c.ellipse(-R * .1, -R * 1.18, R * .44, R * .34, 0, 0, 7); c.fill(); }
    c.fillStyle = ink(.97);
    c.beginPath(); c.moveTo(-R * .42, -R * 1.3); c.lineTo(-R * .32, -R * 1.72); c.lineTo(R * .18, -R * 1.72); c.lineTo(R * .3, -R * 1.3); c.closePath(); c.fill();
    c.strokeStyle = ink(.95); c.lineWidth = lineW * 1.6;
    c.beginPath(); c.moveTo(-R * .75, -R * 1.5); c.lineTo(R * .65, -R * 1.56); c.stroke();
  } else if (st === 'kid') {
    c.beginPath(); c.arc(-R * .55, -R * 1.02, R * .3, 0, 7); c.fill();
    c.beginPath(); c.arc(R * .32, -R * 1.12, R * .28, 0, 7); c.fill();
  }
}
/* 背影的头（I.bust look→0 用；局部坐标，头心为原点，不压扁）：整颗后脑是发，发髻居中，颈后露一线发际，两侧耳廓各一笔。
   o: rgb 墨色, hr 发色 rgb, a, sd, st 发式, sil 剪影版（浓墨实填，只加发丝与髻） */
function backW(lk) { return 1 - U.clamp(Math.abs(lk) / .35, 0, 1); }                   // 背影权重：|look| ≥ .35 为 0（与旧版全同），0 时为 1
function backX(lk, bw) { return (lk >= 0 ? 1 : -1) * U.lerp(Math.max(.35, Math.abs(lk)), 1, bw); }   // 头的横向缩放：侧转时压扁，转到背影时复原
function backHead(c, R, o) {
  var A = o.a, rgb = o.rgb, hr = o.hr, sd = o.sd, b = BUN[o.st] || BUN.daoji, PR = CINE.C.paperRGB;
  if (A <= .003) return;
  c.fillStyle = o.sil ? U.rgba(rgb, .93 * A) : U.rgba(U.mix(PR, [150, 144, 134], .18), .9 * A);
  headPath(c, R, false); c.fill();
  c.save(); headPath(c, R, false); c.clip();                                         // 发：盖住后脑，颈后发际微微上弧
  c.fillStyle = U.rgba(hr, (o.sil ? .97 : .9) * A);
  c.beginPath(); c.moveTo(-R, -R * 1.1); c.lineTo(R, -R * 1.1); c.lineTo(R, R * .5);
  c.quadraticCurveTo(R * .45, R * .66, 0, R * .56); c.quadraticCurveTo(-R * .45, R * .66, -R, R * .5); c.closePath(); c.fill();
  var white = U.lerp(hr[0], hr[1], .5) > 150;                                         // 白发：发丝用灰墨勾，否则留白一线
  for (var h = 0; h < 5; h++) {                                                      // 发丝：自颈后、两鬓向上梳入髻（干笔）
    var u = (h - 2) * .34;
    I.dry(c, [[u * R * 1.05, R * .58], [u * R * 1.12, -R * .1], [u * R * .45, -R * .86]], { w: R * .2, a: (o.sil ? .16 : white ? .4 : .18) * A, rgb: o.sil ? [110, 112, 120] : white ? CINE.C.greyRGB : PR, dry: .7, n: 18, seed: sd + 60 + h, hairs: 4 });
  }
  c.restore();
  if (!o.sil) {
    [-1, 1].forEach(function (d) {                                                    // 后脑轮廓：颈后两侧各一笔勾到头顶（白发也读得出头形）
      var ol = []; for (var e = 0; e <= 12; e++) { var an = Math.PI / 2 + d * (.35 + e / 12 * 2.45); ol.push([Math.cos(an) * R * .86, Math.sin(an) * R]); }
      I.stroke(c, ol, { raw: true, w: R * .05, a: (white ? .75 : .5) * A, rgb: rgb, head: .15, tail: .3, n: 13, seed: sd + 66 + d });
    });
    I.sweep(c, [[-R * .8, R * .45], [-R * .88, -R * .25], [-R * .5, -R * .88], [0, -R * 1.02]], { w: R * .42, a: .9 * A, rgb: hr, seed: sd + 20, dry: .35, fb: .25, head: .08, n: 22 });
    I.sweep(c, [[R * .8, R * .45], [R * .88, -R * .25], [R * .5, -R * .88], [0, -R * 1.02]], { w: R * .42, a: .9 * A, rgb: hr, seed: sd + 22, dry: .35, fb: .25, head: .08, n: 22 });
    [-1, 1].forEach(function (d) {                                                    // 耳廓：后看只露外缘一笔
      I.stroke(c, [[d * R * .84, -R * .08], [d * R * .97, R * .1], [d * R * .86, R * .32]], { w: R * .06, a: .7 * A, rgb: rgb, head: .1, tail: .4, n: 10, seed: sd + 70 + d });
    });
  }
  var bk = [];                                                                       // 髻：居中，绕一圈
  for (var q = 0; q <= 14; q++) { var ba = -.6 + q / 14 * 5.2; bk.push([Math.cos(ba) * R * b[2] * (1 - q / 40), R * b[1] + Math.sin(ba) * R * b[3] * (1 - q / 40)]); }
  if (o.sil) { c.fillStyle = U.rgba(hr, .97 * A); c.beginPath(); c.ellipse(0, R * b[1], R * b[2], R * b[3], 0, 0, 7); c.fill(); }
  I.sweep(c, bk, { w: R * b[3] * 1.1, a: .95 * A, rgb: hr, seed: sd + 23, dry: .25, fb: .15, head: .1, tail: .3, n: 30 });
  if (!o.sil && white) { c.strokeStyle = U.rgba(rgb, .55 * A); c.lineWidth = R * .035; c.beginPath(); c.ellipse(0, R * b[1], R * b[2] * 1.05, R * b[3] * 1.05, 0, 0, 7); c.stroke(); }
  if (o.st === 'daoji' || o.st === 'guan')                                            // 簪：横穿髻心
    I.stroke(c, [[-R * b[2] * 1.5, R * b[1] + R * .04], [R * b[2] * 1.5, R * b[1] - R * .04]], { raw: true, w: R * .05, a: .85 * A, rgb: rgb, head: .05, tail: .05, n: 6, wob: .05 });
}
/* 半身特写（头与肩，写意剪影）：(x,y) 为领口中心，s 为肩宽的一半。用于按肩、抹脸、回头等近景。
   o: kind（发式同 I.KIND）, face 1/-1, look 1 侧影 / 0 背影, head 仰(+)俯(-), shrug 0..1, sink 近手侧肩头下沉 0..1,
      hair, wind, windDir, t, a, rgb, seed */
function bustSil(c, x, y, s, o) {
  var K = I.KIND[o.kind || 'man'] || {}, p = {}, k;
  for (k in K) p[k] = K[k];
  for (k in o) if (o[k] !== undefined) p[k] = o[k];
  var t = p.t || 0, face = p.face || 1, A = p.a == null ? 1 : p.a, rgb = p.rgb || CINE.C.inkRGB, sd = p.seed || 1;
  if (A <= 0.003) return;
  var ink = function (a) { return U.rgba(rgb, a * A); };
  var wind = p.wind == null ? .4 : p.wind, wx = wind * (p.windDir == null ? -1 : p.windDir) * face;
  var fl = function (q) { return (Math.sin(t * 2.6 + sd + q) * .5 + Math.sin(t * 4.3 + q * 2) * .3) * Math.min(1, wind + .2); };
  var sh = p.shrug || 0, sk = p.sink || 0;
  c.save(); c.translate(x, y); c.scale(s * face, s); c.lineCap = 'round'; c.lineJoin = 'round';
  var sR = [.98, .3 - sh * .12 + sk * .1], sL = [-.92, .32 - sh * .12];
  // 肩背
  c.fillStyle = ink(.86);
  c.beginPath(); c.moveTo(-.2, -.02);
  c.quadraticCurveTo(-.6, .02 - sh * .05, sL[0], sL[1]); c.quadraticCurveTo(-1.18, .55, -1.3, 1.6);
  c.lineTo(1.4, 1.6); c.quadraticCurveTo(1.3, .6, sR[0], sR[1]); c.quadraticCurveTo(.6, .0 + sk * .06, .2, -.04);
  c.closePath(); c.fill();
  c.save(); c.clip();
  I.wash(c, .55, .5, .7, .6, .35 * A, sd + 2, CINE.C.paperRGB);
  I.wash(c, -.5, .7, .6, .7, .5 * A, sd + 3, rgb);
  c.restore();
  I.stroke(c, [[-.2, -.02], [-.62, sL[1] - .2], [sL[0], sL[1]], [-1.2, .6], [-1.3, 1.5]], { w: .07, a: .95 * A, rgb: rgb, head: .05, tail: .4, n: 30, seed: sd + 5 });
  I.stroke(c, [[.2, -.04], [.65, sR[1] - .2], [sR[0], sR[1]], [1.28, .7]], { w: .045, a: .8 * A, rgb: rgb, head: .1, tail: .5, n: 26, seed: sd + 6 });
  I.stroke(c, [[-.16, .0], [.05, .35], [.28, .9]], { w: .05, a: .95 * A, rgb: rgb, head: .1, tail: .4, n: 18, seed: sd + 7 });           // 交领
  I.stroke(c, [[.18, -.02], [.12, .3]], { w: .03, a: .35 * A, rgb: CINE.C.paperRGB, head: .2, tail: .5, n: 10, seed: sd + 8 });
  I.stroke(c, [[.5, .35], [.62, .8], [.58, 1.3]], { w: .06, a: .4 * A, rgb: rgb, head: .1, tail: .5, n: 18, seed: sd + 9 });
  // 颈与头
  var hx = .06, hy = -.5 + sh * .14, R = .4, up = -(p.head || 0) * .5;
  I.stroke(c, [[0, .05], [.02, -.15], [hx - .02, hy + .25]], { raw: true, w: .28, a: .93 * A, rgb: rgb, head: .05, tail: .05, n: 8, wob: .03 });
  var lk = p.look == null ? 1 : p.look, bw = backW(lk), lkx = backX(lk, bw);
  var hairV = p.hair == null ? 1 : p.hair, hRGB = p.hairRGB || rgb;
  var hairCol = U.rgba(U.mix([238, 234, 224], hRGB, hairV), .97 * A), hairEdge = ink(U.lerp(.4, .9, hairV));
  if (p.hairStyle === 'shufa') {
    var kn = [hx - R * .45 * lkx * (1 - bw), hy - R * 1.05];
    I.stroke(c, [kn, [kn[0] - .25 + wx * .3, kn[1] + .25 + .05 * fl(1)], [kn[0] - .45 + wx * .8 + .08 * fl(2), kn[1] + .75]], { w: .12, fill: hairCol, head: .05, tail: .7, n: 18, seed: sd + 30 });
    for (var r1 = 0; r1 < 2; r1++) I.stroke(c, [kn, [kn[0] - .3 + wx * .5, kn[1] + .1 + .06 * fl(r1 + 3)], [kn[0] - .6 + wx * (1.1 + r1 * .3) + .1 * fl(r1 + 5), kn[1] + .3 + .12 * fl(r1 + 6)]], { w: .04, a: .9 * A, rgb: rgb, head: .05, tail: .6, n: 16, seed: sd + 31 + r1 });
  }
  c.save(); c.translate(hx, hy); c.rotate(up); c.scale(lkx, 1);
  if (bw < 1) drawHeadLocal(c, { hairStyle: p.hairStyle, hair: hairV, profile: lk > .5 && p.profile !== false, beardFull: p.beardFull }, R, function (a) { return ink(a * (1 - bw)); }, U.rgba(U.mix([238, 234, 224], hRGB, hairV), .97 * A * (1 - bw)), hairEdge, .02, A * (1 - bw));
  if (bw > 0) backHead(c, R, { a: A * bw, rgb: rgb, hr: U.mix([238, 234, 224], hRGB, hairV), sd: sd, st: p.hairStyle, sil: true });
  c.restore();
  c.restore();
  return { shoulderR: [x + sR[0] * s * face, y + sR[1] * s], shoulderL: [x + sL[0] * s * face, y + sL[1] * s], shoulderTop: [x + .56 * s * face, y + (.06 + sk * .05) * s], head: [x + hx * s * face, y + hy * s] };
};
/* 半身特写（头与肩）：白描 + 淡墨 + 大写意湿墨衣。纸色留白铺出人形（夜里也读得出），脸只一笔侧脸线（不画五官），
   后脑颌下一抹淡墨；发髻浓墨带飞白；肩背与交领是几笔侧锋湿墨。(x,y) 为领口中心，s 为肩宽的一半。用于按肩、抹脸、回头等近景。
   o: kind（发式同 I.KIND）, face 1/-1, look 1 侧影 / 0 背影, head 仰(+)俯(-), shrug 0..1, sink 近手侧肩头下沉 0..1,
      hair, wind, windDir, t, a, rgb, seed, robe（'white' 素衣）, style 'sil' 用旧版平涂剪影 */
I.bust = function (c, x, y, s, o) {
  o = o || {};
  if (o.style === 'sil') return bustSil(c, x, y, s, o);
  var K = I.KIND[o.kind || 'man'] || {}, p = {}, k;
  for (k in K) p[k] = K[k];
  for (k in o) if (o[k] !== undefined) p[k] = o[k];
  var t = p.t || 0, face = p.face || 1, A = p.a == null ? 1 : p.a, rgb = p.rgb || CINE.C.inkRGB, sd = p.seed || 1, PR = CINE.C.paperRGB;
  if (A <= 0.003) return;
  var ink = function (a) { return U.rgba(rgb, a * A); };
  var wind = p.wind == null ? .4 : p.wind, wx = wind * (p.windDir == null ? -1 : p.windDir) * face;
  var fl = function (q) { return (Math.sin(t * 2.6 + sd + q) * .5 + Math.sin(t * 4.3 + q * 2) * .3) * Math.min(1, wind + .2); };
  var sh = p.shrug || 0, sk = p.sink || 0, white = p.robe === 'white';
  c.save(); c.translate(x, y); c.scale(s * face, s); c.lineCap = 'round'; c.lineJoin = 'round';
  var sR = [.98, .3 - sh * .12 + sk * .1], sL = [-.92, .32 - sh * .12];
  var body = function () {
    c.beginPath(); c.moveTo(-.2, -.02);
    c.quadraticCurveTo(-.6, .02 - sh * .05, sL[0], sL[1]); c.quadraticCurveTo(-1.18, .55, -1.3, 1.6);
    c.lineTo(1.4, 1.6); c.quadraticCurveTo(1.3, .6, sR[0], sR[1]); c.quadraticCurveTo(.6, .0 + sk * .06, .2, -.04);
    c.closePath();
  };
  // 1 留白底 + 一层淡墨
  c.fillStyle = U.rgba(PR, .46 * A); body(); c.fill();
  c.save(); body(); c.clip();
  I.wash(c, -.35, .95, 1.2, .9, (white ? .14 : .32) * A, sd + 3, rgb);
  I.wash(c, .75, .7, .6, .55, .1 * A, sd + 2, PR);
  c.restore();
  // 2 衣：远肩一大笔、近肩一笔、交领一笔、两道衣褶
  var mA = (white ? .38 : 1) * A, mR = white ? CINE.C.greyRGB : rgb;
  I.sweep(c, [[-.12, .0], [-.55, .05 - sh * .05], [sL[0] - .04, sL[1] + .08], [-1.17, .75], [-1.27, 1.58]], { w: .46, a: .92 * mA, rgb: mR, seed: sd + 11, dry: .3, n: 30 });
  I.sweep(c, [[.2, .02], [.62, sR[1] - .15 + sk * .04], [sR[0] + .04, sR[1] + .1], [1.2, .78], [1.32, 1.5]], { w: .34, a: .82 * mA, rgb: mR, seed: sd + 12, dry: .45, n: 26 });
  I.sweep(c, [[-.16, .0], [.02, .3], [.19, .7], [.3, 1.15]], { w: .13, a: .95 * mA, rgb: mR, seed: sd + 13, dry: .25, n: 18 });
  I.sweep(c, [[.5, .38], [.62, .85], [.56, 1.45]], { w: .09, a: .55 * mA, rgb: mR, seed: sd + 14, dry: .6, n: 14 });
  I.sweep(c, [[-.6, .5], [-.72, 1.0], [-.7, 1.52]], { w: .08, a: .45 * mA, rgb: mR, seed: sd + 15, dry: .7, n: 14 });
  // 3 颈：留白 + 前后两笔
  var hx = .06, hy = -.5 + sh * .14, R = .4, up = -(p.head || 0) * .5;
  var ng = c.createLinearGradient(0, hy + .3, 0, .08); ng.addColorStop(0, U.rgba(PR, .62 * A)); ng.addColorStop(.6, U.rgba(PR, .5 * A)); ng.addColorStop(1, U.rgba(PR, 0));
  c.fillStyle = ng;
  c.beginPath(); c.moveTo(-.13, .07); c.quadraticCurveTo(-.11, -.12, hx - .15, hy + .3); c.lineTo(hx + .15, hy + .28); c.quadraticCurveTo(.13, -.1, .16, .05); c.closePath(); c.fill();
  I.wash(c, -.03, -.08, .1, .18, .28 * A, sd + 4, rgb, 0, { edge: 'soft' });
  I.stroke(c, [[hx + .13, hy + .32], [.13, -.1], [.17, .05]], { w: .02, a: .85 * A, rgb: rgb, head: .1, tail: .5, n: 12, seed: sd + 16 });
  I.stroke(c, [[hx - .17, hy + .3], [-.1, -.1], [-.14, .07]], { w: .026, a: .9 * A, rgb: rgb, head: .1, tail: .4, n: 12, seed: sd + 17 });
  // 4 头（look → 0 转成背影：头不压扁，整颗后脑是发，发髻居中）
  var lk = p.look == null ? 1 : p.look, bw = backW(lk), lkx = backX(lk, bw);
  var hairV = p.hair == null ? 1 : p.hair, hRGB = p.hairRGB || rgb;
  var hairCol = U.rgba(U.mix([238, 234, 224], hRGB, hairV), .97 * A), hairEdge = ink(U.lerp(.4, .9, hairV));
  if (p.hairStyle === 'shufa') {
    var kn = [hx - R * .45 * lkx * (1 - bw), hy - R * 1.05];
    I.sweep(c, [kn, [kn[0] - .25 + wx * .3, kn[1] + .25 + .05 * fl(1)], [kn[0] - .45 + wx * .8 + .08 * fl(2), kn[1] + .75]], { w: .1, a: .9 * A, rgb: U.mix([238, 234, 224], hRGB, hairV), seed: sd + 30, dry: .55, n: 18 });
    for (var r1 = 0; r1 < 2; r1++) I.stroke(c, [kn, [kn[0] - .3 + wx * .5, kn[1] + .1 + .06 * fl(r1 + 3)], [kn[0] - .6 + wx * (1.1 + r1 * .3) + .1 * fl(r1 + 5), kn[1] + .3 + .12 * fl(r1 + 6)]], { w: .035, a: .9 * A, rgb: rgb, head: .05, tail: .6, n: 16, seed: sd + 31 + r1, fb: .35 });
  }
  var prof = lk > .5 && p.profile !== false, A0 = A;
  c.save(); c.translate(hx, hy); c.rotate(up); c.scale(lkx, 1);
  A *= 1 - bw;                                                                       // 转向背影时侧面的头淡出、后脑淡入
  if (bw > 0) { hairCol = U.rgba(U.mix([238, 234, 224], hRGB, hairV), .97 * A); hairEdge = ink(U.lerp(.4, .9, hairV)); }
  if (A > .003) {
  c.fillStyle = U.rgba(U.mix(PR, [150, 144, 134], .18), .9 * A); headPath(c, R, prof); c.fill();
  c.save(); headPath(c, R, prof); c.clip();
  I.wash(c, R * .35, -R * .2, R * .55, R * .6, .22 * A, sd + 6, PR, 0, { edge: 'soft' });
  I.wash(c, -R * .7, R * .45, R * .6, R * .7, .22 * A, sd + 5, rgb, 0, { edge: 'soft' });
  c.restore();
  if (prof) {
    var bump = function (q) { return .6 + .55 * Math.max(Math.exp(-Math.pow((q - .3) / .05, 2)), Math.exp(-Math.pow((q - .47) / .04, 2)), Math.exp(-Math.pow((q - .75) / .06, 2))); };
    I.stroke(c, PROFILE.map(function (q) { return [q[0] * R, q[1] * R]; }), { w: R * .075, a: .95 * A, rgb: rgb, wf: function (q) { return Math.min(1, q / .06 + .3) * Math.min(1, (1 - q) / .12 + .2) * bump(q); }, n: 40, seed: sd + 18, wob: .2 });
  } else {
    var el = []; for (var e = 0; e <= 20; e++) { var an = -1.2 + e / 20 * 2.6; el.push([Math.cos(an) * R * .86, Math.sin(an) * R]); }
    I.stroke(c, el, { raw: true, w: R * .06, a: .9 * A, rgb: rgb, head: .1, tail: .4, n: 21, seed: sd + 18 });
  }
  I.stroke(c, [[R * .5, R * .93], [-R * .15, R * .9], [-R * .6, R * .62]], { w: R * .045, a: .65 * A, rgb: rgb, head: .1, tail: .5, n: 12, seed: sd + 19, fade: .5 });
  if (p.hairStyle !== 'shufa') drawHeadLocal(c, { hairStyle: p.hairStyle, hair: hairV, profile: prof, beardFull: p.beardFull, noFace: true, noCap: true, rgb: rgb }, R, ink, hairCol, hairEdge, .02, A, 1);
  hairSweeps(c, R, U.mix([238, 234, 224], hRGB, hairV), A, sd, p.hairStyle === 'shufa' ? 'shufa' : '');      // 发：两大笔浓墨侧锋，发髻绕一圈
  }
  A = A0;
  if (bw > 0) backHead(c, R, { a: A * bw, rgb: rgb, hr: U.mix([238, 234, 224], hRGB, hairV), sd: sd, st: p.hairStyle, sil: false });
  c.restore();
  c.restore();
  return { shoulderR: [x + sR[0] * s * face, y + sR[1] * s], shoulderL: [x + sL[0] * s * face, y + sL[1] * s], shoulderTop: [x + .56 * s * face, y + (.06 + sk * .05) * s], head: [x + hx * s * face, y + hy * s] };
};
/* 画一个人：p 见上方说明。返回骨架 sk，另附 sk.hand（前手世界坐标）、sk.headW（头世界坐标）、sk.W(局部点)→世界点 */
/* 发带一梢（I.figure 用）：a 结处 → b 梢，人物局部坐标；bend 弯度（相对长度），ph 飘动相位。
   起笔略实、往梢渐虚的枯笔（收笔飞白），中段一道 S 弯随风起伏，末端分叉成一长一短两缕 */
function ribbonTail(c, a, b, bend, ph, A, rgb, sd) {
  var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
  if (L < 1e-4 || A <= .003) return;
  var nx = -dy / L, ny = dx / L, pts = [], u, o;
  for (var i = 0; i <= 8; i++) {
    u = i / 8; o = L * (bend * Math.sin(Math.PI * u) + .09 * Math.sin(Math.PI * 2 * u + ph) * u);
    pts.push([a[0] + dx * u + nx * o, a[1] + dy * u + ny * o]);
  }
  I.stroke(c, pts, { w: .0075, a: A, rgb: rgb, head: .05, tail: .55, n: 20, seed: sd, fb: .3, wob: .25 });
  var f = pts[7], e = pts[8], sp = .3 + .08 * Math.sin(ph * .7);    // 分叉：梢头另起一缕短梢，略偏开
  var fx = e[0] - f[0], fy = e[1] - f[1];
  I.stroke(c, [f, [f[0] + fx * .5 - fy * sp * .5, f[1] + fy * .5 + fx * sp * .5], [f[0] + fx * .8 - fy * sp, f[1] + fy * .8 + fx * sp]], { w: .0035, a: .7 * A, rgb: rgb, head: .1, tail: .5, n: 8, seed: sd + 7, fb: .35 });
}
I.figure = function (c, p0) {
  var K = I.KIND[p0.kind || 'man'] || {}, p = {}, key;
  for (key in K) p[key] = K[key];
  for (key in p0) if (p0[key] !== undefined) p[key] = p0[key];
  var t = p.t || 0, s = (p.s || 200) * (p.tall || 1), face = p.face || 1, b = p.build || 1, seed = p.seed || 1;
  var sk = I.skeleton(p), rgb = p.rgb || CINE.C.inkRGB, A = p.a == null ? 1 : p.a;
  sk.W = function (q) { return [p.x + q[0] * s * face, p.y + q[1] * s]; };
  sk.headW = sk.W(sk.head);
  if (A <= 0.003) { sk.hand = sk.W(sk.armF.wr); sk.handB = sk.W(sk.armB.wr); return sk; }
  var fly = p.fly || 0, sit = sk.sit, curl = sk.curl;
  var wind = (p.wind == null ? .35 : p.wind) + fly * .9;
  var wdir = fly && p.windDir == null ? -1 : (p.windDir == null ? -1 : p.windDir) * face;
  var wx = U.clamp(wind, 0, 1.6) * wdir, ph = seed * 1.7, wa = Math.min(1, wind + .15);
  var fl = function (k) { return (Math.sin(t * 2.6 + ph + k) * .5 + Math.sin(t * 4.7 + ph * 1.3 + k * 2) * .3) * wa; };
  var ink = function (a) { return U.rgba(rgb, a * A); };
  var robe = p.robe || 'ink', white = robe === 'white', grey = robe === 'grey';
  var D = p.detail != null ? U.clamp(p.detail, 0, 1) : U.clamp((s * scaleOf(c) - 90) / 220, 0, 1);   // 细节级：远景简笔，近景泼墨
  var NK = U.clamp((s * scaleOf(c) - 600) / 300, 0, 1);    // 近景（人高 ≥600px）：颈由等宽直条改为下宽上收（审 D1），中远景与旧版一致
  var PL = p.plate === true ? 1 : U.clamp(+p.plate || 0, 0, 1);            // 底图上：衣身各处淡墨浓度提到 ≥ .75
  var bodyCol = white ? U.rgba(CINE.C.whiteRGB, .97 * A) : grey ? ink(U.lerp(.34, .28, D)) : ink(U.lerp(U.lerp(.72, .82, PL), p.wash == null ? U.lerp(.46, .8, PL) : p.wash, D));
  var lineRGB = rgb, lineA = white ? .55 : grey ? .45 : .95;
  var hairV = p.hair == null ? 1 : p.hair, hRGB = p.hairRGB || rgb;
  var hairCol = U.rgba(U.mix([238, 234, 224], hRGB, hairV), .97 * A), hairEdge = ink(U.lerp(.4, .9, hairV));
  var sleeveW = .1 * (p.sleeve || 1);
  c.save();
  c.translate(p.x, p.y); c.scale(s * face, s);
  c.lineJoin = 'round'; c.lineCap = 'round';
  var nk = sk.neck, hip = sk.hip, tilt = sk.tilt, shF = sk.armF.sh, shB = sk.armB.sh;
  // —— 衣身轮廓点 ——
  var hemY = sit ? -.004 : -.022, fF = Math.max(sk.footF[0], sk.footB[0]), fB = Math.min(sk.footF[0], sk.footB[0]);
  var HF = vmix(V(.135 * b + fF * .45, hemY), V(.25 + curl * .02, hemY), sit);
  var HB = vmix(V(-.16 * b + fB * .35, hemY), V(-.2 * b, hemY), sit);
  var trail = V(HB[0] + wx * (.09 + .05 * fl(0)) - .01, HB[1] - Math.abs(wx) * (.04 + .03 * fl(1)));
  if (fly) { trail = vmix(trail, V(HB[0] - .26 - .06 * fl(0), HB[1] - .14 - .05 * fl(1)), fly); HF = vmix(HF, V(.07, -.05), fly * .6); }
  var backMid = vadd(hip, vrot(V(-.1 * b, -.02), tilt * .6));
  var waistF = vadd(hip, vrot(V(.075 * b, -.07), tilt * .6));
  if (sit) waistF = vmix(waistF, V(.2 + curl * .02, -.14 - curl * .16), sit);
  var chest = vadd(nk, vrot(V(.06 * b, .09), tilt));
  var robePath = function () {
    c.beginPath();
    c.moveTo(shB[0] - .012, shB[1]);
    c.quadraticCurveTo(backMid[0] - .035 * b, U.lerp(shB[1], backMid[1], .45), backMid[0], backMid[1]);
    c.quadraticCurveTo(U.lerp(backMid[0], trail[0], .35) - .02, U.lerp(backMid[1], trail[1], .7), trail[0], trail[1]);
    c.quadraticCurveTo(U.lerp(trail[0], HB[0], .5), HB[1] + .006, HB[0], HB[1]);
    for (var i = 1; i <= 8; i++) {
      var k = i / 8;
      c.lineTo(U.lerp(HB[0], HF[0], k), U.lerp(HB[1], HF[1], k) + .009 * Math.sin(k * 9 + t * 3 + ph) * (wa + .2) * (1 - sit * .6));
    }
    c.quadraticCurveTo(U.lerp(waistF[0], HF[0], .5) + .025, U.lerp(waistF[1], HF[1], .55), waistF[0], waistF[1]);
    c.quadraticCurveTo(chest[0] + .025, U.lerp(chest[1], waistF[1], .5), chest[0], chest[1]);
    c.lineTo(shF[0] + .012, shF[1]);
    c.quadraticCurveTo(nk[0], nk[1] - .02, shB[0] - .012, shB[1]);
    c.closePath();
  };
  // 1 外晕（泼墨渗化）
  if (!white) {
    c.save(); c.globalAlpha *= A * .14; c.fillStyle = U.rgba(rgb, 1);
    c.translate(-.006 * (1 - NK), .004 * (1 - NK)); c.scale(1 + .03 * (1 - .8 * NK), 1 + .01 * (1 - .8 * NK)); robePath(); c.fill(); c.restore();   // 近景外晕不再整体偏移放大（审 D1：否则成一圈错位的重影）
    if (PL > 0) {                  // 底图上：沿衣缘几团柔晕（内半被随后铺的衣身盖住，只露缘外浓淡不齐的洇化）+ 脚下一抹，人物"落"在纸上
      [shB, backMid, trail, HB, vmix(HB, HF, .5), HF, waistF, chest].forEach(function (q, i) {
        I.wash(c, q[0], q[1], .075 * b, .09, (.12 + .06 * U.hash(seed + i)) * A * PL, seed + i * 3 + 1, rgb, i * .7, { edge: 'soft' });
      });
      if (!fly && sit < .5) I.wash(c, .01, -.01, .22 * b, .03, .28 * A * PL, seed + 3, rgb, 0, { edge: 'soft' });
    }
  }
  // 2 后袖
  var bk = drawSleeve(c, sk.armB, wx, fl, white ? U.rgba([228, 224, 214], .96 * A) : grey ? ink(.3) : ink(U.lerp(U.lerp(.58, .78, PL), p.wash == null ? U.lerp(.4, .76, PL) : p.wash - .05, D)), lineRGB, lineA * .8, sleeveW * .92, A, seed + 11, D * .7, t, wa);
  // 3 背剑（在身后）
  if (p.sword === 'back') {
    var sb = vadd(hip, vrot(V(-.12, -.02), tilt)), st2 = vadd(nk, vrot(V(.07, -.1), tilt));
    I.stroke(c, [sb, st2], { raw: true, w: .016, a: .95 * A, rgb: rgb, head: .05, tail: .05, n: 6, wob: 0 });
    jianGuard(c, vmix(sb, st2, .8), [sb[0] - st2[0], sb[1] - st2[1]], .019, .016, ink(.95));   // 剑格：中式元宝形（原为斜出的细长横杠，形近西式十字护手）
  }
  // 4 脚（行走时露出）
  if (sit < .5 && !fly) {
    [sk.footB, sk.footF].forEach(function (f2, i) {
      c.fillStyle = ink(.95); c.beginPath(); c.ellipse(f2[0] + .02, -.009, .032, .011, i ? -.08 : .05, 0, 7); c.fill();
    });
  }
  // 5 头部坐标系与身后发、发带
  var R = .05, hd = sk.head, up = sk.headUp, lk = p.look == null ? 1 : p.look, lks = lk >= 0 ? 1 : -1, lkx = lks * Math.max(.35, Math.abs(lk));
  var hp = function (x, y) { var v = vrot(V(x * lkx, y), up); return [hd[0] + v[0], hd[1] + v[1]]; };
  var fw = fly ? 1.8 : 1;
  if (p.hairStyle === 'shufa') {
    var kn = hp(-R * .45, -R * 1.05);
    var te = [kn[0] + (-.05 * lks + wx * .16 * fw + .015 * fl(6)) * .75, kn[1] + .11], tdx = te[0] - kn[0], tdy = te[1] - kn[1], tb = .16 + .05 * fl(5);   // 发尾：缩短、带一道弯（审 D6，不再是直刺）
    I.stroke(c, [kn, [kn[0] + tdx * .35 - tdy * tb, kn[1] + tdy * .35 + tdx * tb], [kn[0] + tdx * .7 - tdy * tb * .8, kn[1] + tdy * .7 + tdx * tb * .8], te], { w: .02, a: .95 * A, fill: hairCol, head: .05, tail: .7, n: 18, seed: seed + 30 });
    for (var r1 = 0; r1 < 2; r1++) {                 // 发带两梢（审 D6）：不再是两根直刺——长度减到六成、带弯的枯笔，随风起伏，末端分叉
      var re = [kn[0] - .07 * lks + wx * (.22 + r1 * .05) * fw + .02 * fl(r1 + 2), kn[1] + .06 + .03 * fl(r1 + 4)];
      ribbonTail(c, kn, [kn[0] + (re[0] - kn[0]) * .6, kn[1] + (re[1] - kn[1]) * .6 + .012], .2 + .1 * r1 + .07 * fl(r1 + 6), t * 3.1 + ph + r1 * 1.9, .9 * A, rgb, seed + 31 + r1);
    }
  } else if (p.hairStyle === 'guan' || p.hairStyle === 'loose') {
    var np = hp(-R * .8, R * .3), L2 = p.hairStyle === 'loose' ? .34 : .2;
    I.stroke(c, [hp(-R * .6, -R * .6), np, [np[0] - .015 * lks + wx * .04 * fw, np[1] + L2 * .5 + .01 * fl(1)], [np[0] - .02 * lks + wx * .1 * fw + .015 * fl(2), np[1] + L2]],
      { w: .045, a: .95 * A, fill: hairCol, head: .15, tail: .5, n: 22, seed: seed + 44 });
  }
  // 6 衣身：铺墨 → 泼墨浓淡与飞白 → 浓墨提线
  robePath(); c.fillStyle = bodyCol; c.fill();
  c.save(); robePath(); c.clip();
  if (!white) {
    I.wash(c, backMid[0] + .01, U.lerp(shB[1], backMid[1], .5), .13 * b, .24, .55 * A, seed + 1, rgb);
    I.wash(c, U.lerp(HB[0], HF[0], .35), -.07, .2 * b, .12, .32 * A, seed + 2, rgb);
    I.wash(c, U.lerp(chest[0], waistF[0], .5) - .02, U.lerp(chest[1], -.2, .5), .07 * b, .26, .16 * A, seed + 4, CINE.C.paperRGB);
    I.stroke(c, [[waistF[0] - .04, waistF[1] + .03], [U.lerp(waistF[0], HF[0], .4) - .06, -.2], [U.lerp(HB[0], HF[0], .62), -.03]], { w: .03, a: .22 * A, rgb: rgb, head: .1, tail: .6, n: 18, seed: seed + 5 });
    I.stroke(c, [[backMid[0] + .03, backMid[1] - .1], [backMid[0] + .015, backMid[1] + .08], [U.lerp(HB[0], HF[0], .25), -.04]], { w: .026, a: .2 * A, rgb: rgb, head: .1, tail: .6, n: 18, seed: seed + 7 });
  } else {
    I.wash(c, backMid[0], backMid[1], .12, .3, .28 * A, seed + 1, CINE.C.greyRGB);
    I.wash(c, U.lerp(HB[0], HF[0], .3), -.06, .18, .1, .2 * A, seed + 2, CINE.C.greyRGB);
  }
  c.restore();
  if (D > 0) {                   // 大写意泼墨：背一大笔浓墨、前襟一笔、腹下斜折一笔——几块浓淡不同的湿墨，边缘渗化、收笔飞白
    var mA = (white ? .22 : grey ? .4 : .92) * A * D, mR = white ? CINE.C.greyRGB : rgb;
    I.sweep(c, [[shB[0] + .012, shB[1] + .012], [backMid[0] + .025, U.lerp(shB[1], backMid[1], .55)], [U.lerp(backMid[0], trail[0], .45) + .035, U.lerp(backMid[1], trail[1], .55)], [U.lerp(trail[0], HB[0], .5) + .05, HB[1] - .02]],
      { w: .12 * b, a: mA, rgb: mR, seed: seed + 50, dry: .3, n: 26 });
    I.sweep(c, [[chest[0] - .025, chest[1] + .04], [waistF[0] - .035, waistF[1] + .02], [U.lerp(waistF[0], HF[0], .65) - .035, U.lerp(waistF[1], HF[1], .65)], [HF[0] - .05, HF[1] - .015]],
      { w: .06 * b, a: mA * .75, rgb: mR, seed: seed + 51, dry: .45, n: 22 });
    I.sweep(c, [[hip[0] - .01, hip[1] - .01], [U.lerp(HB[0], HF[0], .44), U.lerp(hip[1], 0, .5)], [U.lerp(HB[0], HF[0], .56), -.035]],
      { w: .05 * b, a: mA * .6, rgb: mR, seed: seed + 52, dry: .55, n: 16 });
  }
  var lw = white ? .45 : 1;
  I.stroke(c, [[shB[0] - .012, shB[1] + .005], [backMid[0] - .028 * b, U.lerp(shB[1], backMid[1], .5)], backMid, [U.lerp(backMid[0], trail[0], .6) - .01, U.lerp(backMid[1], trail[1], .75)], trail],
    { w: .028 * lw, a: lineA * A, rgb: lineRGB, head: .06, tail: .55, n: 30, seed: seed + 6, fb: .35 * D, tex: .6 * D });
  I.stroke(c, [[chest[0] - .005, chest[1] + .02], [waistF[0] - .015, waistF[1]], [U.lerp(waistF[0], HF[0], .6) - .01, U.lerp(waistF[1], HF[1], .65)], [HF[0] - .012, HF[1] - .02]],
    { w: .018 * lw, a: lineA * .85 * A, rgb: lineRGB, head: .1, tail: .5, n: 24, seed: seed + 8, fb: .3 * D });
  I.stroke(c, [[hip[0] + .01, hip[1] + .04], [U.lerp(HB[0], HF[0], .45), U.lerp(hip[1], 0, .6)], [U.lerp(HB[0], HF[0], .4) + .01, -.04]],
    { w: .012 * lw, a: lineA * .55 * A, rgb: lineRGB, head: .15, tail: .5, n: 16, seed: seed + 9 });
  I.dry(c, [trail, HB, [U.lerp(HB[0], HF[0], .5), Math.max(HB[1], HF[1]) - .004], HF], { w: .028, a: (white ? .3 : .6) * A, rgb: rgb, dry: .55, seed: seed + 21, hairs: 6, n: 26 });
  I.stroke(c, [[nk[0] - .022, nk[1] - .004], [nk[0] + .01, nk[1] + .03], [chest[0] - .005, chest[1] + .012]], { w: .012 * lw, a: lineA * A, rgb: lineRGB, head: .1, tail: .4, n: 12, seed: seed + 10 });
  var belt = vadd(hip, vrot(V(0, -.075), tilt * .6));
  I.stroke(c, [[belt[0] - .085 * b, belt[1] + .006], [belt[0] + .078 * b, belt[1] - .006]], { raw: true, w: .018, a: (white ? .6 : 1) * A, rgb: rgb, head: .15, tail: .15, n: 8, wob: .1 });
  var bt = [belt[0] - .045 * b, belt[1] + .01];
  for (var r2 = 0; r2 < 2; r2++) {
    I.stroke(c, [bt, [bt[0] - .02 + wx * (.07 + r2 * .03) * fw, bt[1] + .1 * (1 - fly * .3) + .012 * fl(3 + r2)], [bt[0] - .035 + wx * (.17 + r2 * .07) * fw + .02 * fl(4 + r2), bt[1] + .23 * (1 - fly * .45) - r2 * .03 + .02 * fl(5 + r2)]],
      { w: .009, a: (white ? .55 : .9) * A, rgb: rgb, head: .05, tail: .6, n: 18, seed: seed + 13 + r2 });
  }
  // 7 腰间佩剑
  if (p.sword === 'waist' || p.sword === true) {
    var tl = tilt * .6, gdd = vadd(hip, vrot(V(.07, -.04), tl)), pom = vadd(gdd, vrot(V(.065, -.045), tl)), stip = vadd(gdd, vrot(V(-.3, .2), tl));
    I.stroke(c, [gdd, stip], { raw: true, w: .016, a: .97 * A, rgb: rgb, head: .02, tail: .06, n: 6, wob: 0 });
    I.stroke(c, [gdd, pom], { raw: true, w: .011, a: .97 * A, rgb: rgb, head: .05, tail: .1, n: 5, wob: 0 });
    jianGuard(c, gdd, [stip[0] - gdd[0], stip[1] - gdd[1]], .019, .017, ink(.97));   // 剑格：中式元宝形
    I.stroke(c, [pom, [pom[0] + wx * .04 + .01 * fl(7), pom[1] + .05], [pom[0] + wx * .09 + .02 * fl(8), pom[1] + .1]], { w: .007, a: .85 * A, rgb: rgb, head: .05, tail: .5, n: 12, seed: seed + 40 });
  }
  // 8 颈、头、须
  if (NK < 1) I.stroke(c, [vadd(nk, vrot(V(0, .02), tilt)), vmix(nk, hd, .5), hp(-R * .15, R * .2)], { raw: true, w: .048, a: .92 * A * (1 - NK), rgb: rgb, head: .1, tail: .1, n: 8, wob: .05, fade: 0 });
  if (NK > 0) {                  // 近景（人高 ≥600px，审 D1）：颈不再是等宽直条——下宽上收的梯形，颈后与喉前两道弧线落进肩
    var nB = vadd(nk, vrot(V(-.03, .016), tilt)), nF = vadd(nk, vrot(V(.032, .02), tilt)), nN = hp(-R * .3, R * .5), nT = hp(R * .3, R * .7);
    c.fillStyle = ink(.92 * NK); c.beginPath(); c.moveTo(nB[0], nB[1]);
    c.quadraticCurveTo(U.lerp(nB[0], nN[0], .5) + .006, U.lerp(nB[1], nN[1], .5), nN[0], nN[1]);   // 颈后：略内凹，不在后脑下支出尖角
    c.lineTo(hp(-R * .1, -R * .1)[0], hp(-R * .1, -R * .1)[1]); c.lineTo(nT[0], nT[1]);
    c.quadraticCurveTo(U.lerp(nT[0], nF[0], .5) - .004, U.lerp(nT[1], nF[1], .5), nF[0], nF[1]);
    c.quadraticCurveTo(nk[0], nk[1] + .012, nB[0], nB[1]); c.closePath(); c.fill();
  }
  c.save(); c.translate(hd[0], hd[1]); c.rotate(up); c.scale(lkx, 1);
  drawHeadLocal(c, p, R, ink, hairCol, hairEdge, .006, A, D);
  c.restore();
  if (p.beard) {
    var chin = hp(R * .5, R * .72);
    for (var bI = 0; bI < 3; bI++) {
      var len = (.17 - bI * .03) * p.beard;
      var bp = [[chin[0] - bI * .01 * lks, chin[1]], [chin[0] + (.004 - bI * .01) * lks + wx * .04 + .006 * fl(bI), chin[1] + len * .5], [chin[0] + (-.004 - bI * .014) * lks + wx * .11 + .012 * fl(bI + 2), chin[1] + len]];
      if (D > .5) I.sweep(c, bp, { w: (.03 - bI * .006) * 1.15, a: .95 * A, rgb: U.mix([238, 234, 224], hRGB, hairV), dry: .5, head: .1, tail: .65, n: 18, seed: seed + 60 + bI });
      else I.stroke(c, bp, { w: .03 - bI * .006, fill: hairCol, head: .1, tail: .65, n: 18, seed: seed + 60 + bI });
      if (hairV < .6) I.stroke(c, bp, { w: .007, a: .5 * (1 - hairV) * A, rgb: rgb, head: .1, tail: .6, n: 18, seed: seed + 70 + bI });
    }
  }
  // 9 前袖、手、拂尘
  var fs = drawSleeve(c, sk.armF, wx, fl, white ? U.rgba(CINE.C.whiteRGB, .98 * A) : grey ? ink(.36) : ink(U.lerp(U.lerp(.8, .85, PL), p.wash == null ? U.lerp(.5, .85, PL) : p.wash + .05, D)), lineRGB, lineA, sleeveW, A, seed + 17, D, t, wa, true);
  c.fillStyle = white ? U.rgba([234, 228, 216], A) : ink(.95);
  if (fs.bare) I.stroke(c, [[fs.cuff[0] - fs.ux * .01, fs.cuff[1] - fs.uy * .01], fs.hand], { raw: true, w: .022, fill: c.fillStyle, wf: function (q) { return 1 - .2 * q; }, n: 6, wob: .04 });   // 袖口滑落处露出的小臂
  var hb =[fs.hand[0] - fs.ux * .014, fs.hand[1] - fs.uy * .014], ht = [fs.hand[0] + fs.ux * .03, fs.hand[1] + fs.uy * .03];
  I.stroke(c, [hb, fs.hand, ht], { raw: true, w: .026, fill: c.fillStyle, wf: function (q) { return Math.min(1, q / .25 + .5) * (1 - .75 * q); }, n: 10, wob: .05 });
  if (white) I.stroke(c, [hb, fs.hand, ht], { raw: true, w: .006, a: .45 * A, rgb: rgb, head: .1, tail: .3, n: 8, wob: .05 });
  if (p.fuchen) {
    var hh0 = fs.hand;
    I.stroke(c, [hh0, [hh0[0] + .03, hh0[1] - .07]], { raw: true, w: .01, a: .95 * A, rgb: rgb, head: .1, tail: .1, n: 5, wob: 0 });
    for (var q = 0; q < 7; q++) {
      var sp2 = (q - 3) * .008;
      I.stroke(c, [hh0, [hh0[0] + sp2 + wx * .05 + .008 * fl(q), hh0[1] + .13], [hh0[0] + sp2 * 1.6 + wx * .14 + .02 * fl(q + 3), hh0[1] + .27]],
        { w: .007, a: .9 * A, fill: U.rgba(CINE.C.whiteRGB, .9 * A), head: .05, tail: .7, n: 14, seed: seed + 80 + q });
    }
    I.stroke(c, [hh0, [hh0[0] + wx * .05, hh0[1] + .13], [hh0[0] + wx * .14, hh0[1] + .27]], { w: .003, a: .4 * A, rgb: rgb, head: .1, tail: .6, n: 14 });
  }
  c.restore();
  sk.hand = sk.W(fs.hand); sk.handB = sk.W(bk.hand);
  return sk;
};

/* ---------- 大剪影水墨化 I.inkSil(c, draw, o)（原第三幕 inkSil 提入引擎；第一幕按肩特写 H2 的画法：逆光浓墨剪影 + 轮廓光，不纯色平涂） ----------
   剪影先画进离屏层 L，在层内：① 叠一遍自身（墨实不透底）② 上浓下淡、按人铺几团淡墨晕（湿边水渍）③ 纸纹 ④ 边缘以干笔丝理挖出飞白；
   再 ⑤ 由 L 错位求出受光一侧的轮廓光（同样被丝理断开），⑥ 垫一层低分辨率外渗墨晕后贴回。只在剪影所在的矩形里做（按屏上面积计费）。
   全身人物、头肩/颈部特写都能用：draw 里画什么都行（I.figure、I.bust、手绘剪影路径……），处理范围与浓淡按 box/body 走，不假定是全身。
   draw(L)：在层里画剪影（与 c 同一变换，可画多个物件，如人与锤）；可返回 [x0,y0,x1,y1] 取代 o.box（按本帧骨架收紧处理范围）；
   o: box [x0,y0,x1,y1] 当前变换下的处理范围（须罩住所画的全部，飞白丝理按它铺；draw 不返回、又不给 box 时取整屏）；
      body 同式的衣身范围（浓淡、墨晕、纸纹按它铺，随人走、不随屏幕游动；缺省 = box）；
      tone 提淡用的墨色（缺省 [70,64,60]）；lift 下半提淡量（.06）；mottle 墨晕斑驳（.15）；
      wash [[u,v,r,a]..] body 内（0..1）的几团淡墨晕（湿边）；side ±1 受光一侧（-1 左 / 1 右）铺两道干笔皴擦；
      paper 纸纹（.3）；fb 飞白挖边（.85）；halo 外渗墨晕（0 关）；seed；
      rim {rgb, a, dx, dy, foot} 受光轮廓：dx,dy 为逻辑 px 错位（指向光源一侧）；foot 身高比例，以下收掉轮廓光（脚下贴地，缺省 .84；头肩特写给 1 不收）。
      ds 降采样倍率（缺省 1 不降）：如 2 则在 1/2 分辨率的层里画剪影、做墨晕飞白轮廓光，贴回时放大——大面积（半屏以上的剪影）省时，边缘略软。
   例（第二、五幕头肩特写）：I.inkSil(c, function (L) { I.bust(L, x, y, s, { style: 'sil' }); return [x - s, y - s * 1.2, x + s, y + s * .8]; },
        { tone: [58, 62, 74], lift: .1, rim: { rgb: [222, 238, 240], a: .8, dx: 6, dy: -2, foot: 1 }, halo: .3, seed: 5 }); */
function silTex(kind, tone) {                                    // 纹理（种子随机，缓存）：'hair' 竖向干笔丝（飞白挖空用）；'fiber' 纸纹纤维与颗粒；'mottle' 墨晕浓淡（低频斑块 + 斑块边缘的水渍线，染 tone 色）
  return U.cached('inkSil:' + kind + (tone ? tone.join(',') : ''), function () {
    var w = 240, h = 360, cv, x, r = U.rng(kind === 'hair' ? 71 : 73), i;
    if (kind === 'mottle') {
      var mw = 80, mh = 120, sm = U.canvas(mw, mh), sx = sm.getContext('2d'), id = sx.createImageData(mw, mh), d = id.data;
      for (var j = 0; j < mh; j++) for (i = 0; i < mw; i++) {
        var v = U.fbm2(i / 16, j / 16, 91, 4) + .25 * U.noise2(i / 5, j / 5, 93), a = U.clamp((v + .05) * 2.2, 0, 1) * .7 + .55 * Math.exp(-Math.pow((v + .05) / .035, 2)), k = (j * mw + i) * 4;
        d[k] = tone[0]; d[k + 1] = tone[1]; d[k + 2] = tone[2]; d[k + 3] = U.clamp(a * 255, 0, 255);
      }
      sx.putImageData(id, 0, 0);
      cv = U.canvas(w, h); x = cv.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(sm, 0, 0, w, h);
      return cv;
    }
    cv = U.canvas(w, h); x = cv.getContext('2d'); x.lineCap = 'round';
    if (kind === 'hair') {
      for (i = 0; i < 300; i++) {
        var hx = r() * w, y0 = r() * h * 1.2 - h * .2, L2 = 40 + r() * 260, sl = r.pm(.08);
        x.strokeStyle = 'rgba(0,0,0,' + (.3 + r() * .7).toFixed(3) + ')'; x.lineWidth = .6 + r() * 2.2;
        x.beginPath(); x.moveTo(hx, y0); x.quadraticCurveTo(hx + sl * L2 + r.pm(3), y0 + L2 * .5, hx + sl * L2 * 2, y0 + L2); x.stroke();
      }
    } else {
      for (i = 0; i < 260; i++) {
        var fx = r() * w, fy = r() * h, an = r() * 6.283, fl = 3 + r() * 9;
        x.strokeStyle = 'rgba(255,255,255,' + (.08 + r() * .22).toFixed(3) + ')'; x.lineWidth = .5 + r() * .6;
        x.beginPath(); x.moveTo(fx, fy); x.quadraticCurveTo(fx + Math.cos(an) * fl * .5 + r.pm(2), fy + Math.sin(an) * fl * .5 + r.pm(2), fx + Math.cos(an) * fl, fy + Math.sin(an) * fl); x.stroke();
      }
      for (i = 0; i < 2600; i++) { x.fillStyle = 'rgba(255,255,255,' + (.06 + r() * .22).toFixed(3) + ')'; x.fillRect(r() * w, r() * h, .6 + r() * 1.2, .6 + r() * 1.2); }
    }
    return cv;
  });
}
function devRect(m, b, pad, cw, ch) {                          // 逻辑矩形 → 画布像素矩形（夹在画布内，外扩 pad 像素）
  var xs = [b[0], b[2]].map(function (x) { return [m.a * x + m.c * b[1] + m.e, m.a * x + m.c * b[3] + m.e]; }), ys = [b[1], b[3]].map(function (y) { return [m.b * b[0] + m.d * y + m.f, m.b * b[2] + m.d * y + m.f]; });
  var X = [].concat(xs[0], xs[1]), Y = [].concat(ys[0], ys[1]);
  var x0 = Math.max(0, Math.floor(Math.min.apply(0, X) - pad)), y0 = Math.max(0, Math.floor(Math.min.apply(0, Y) - pad));
  var x1 = Math.min(cw, Math.ceil(Math.max.apply(0, X) + pad)), y1 = Math.min(ch, Math.ceil(Math.max.apply(0, Y) + pad));
  return x1 - x0 < 4 || y1 - y0 < 4 ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
function screenBox(m) {                                          // 整张画布在当前变换下的逻辑矩形
  var v = m.inverse(), cw = W * CINE.px, ch = H * CINE.px, xs = [], ys = [];
  [[0, 0], [cw, 0], [0, ch], [cw, ch]].forEach(function (q) { xs.push(v.a * q[0] + v.c * q[1] + v.e); ys.push(v.b * q[0] + v.d * q[1] + v.f); });
  return [Math.min.apply(0, xs), Math.min.apply(0, ys), Math.max.apply(0, xs), Math.max.apply(0, ys)];
}
I.inkSil = function (c, draw, o) {
  var L = U.layerAcquire('inkSil'), E = U.layerAcquire('inkSilE');
  try { inkSilBody(c, draw, o, L, E); } finally { U.layerRelease('inkSilE'); U.layerRelease('inkSil'); }
};
function inkSilBody(c, draw, o, L, E) {
  var m = c.getTransform(), cv = L.canvas, tone = o.tone || [70, 64, 60], ds = o.ds > 1 ? +o.ds : 1, m0 = m;
  if (ds > 1) m = new DOMMatrix([m.a / ds, m.b / ds, m.c / ds, m.d / ds, m.e / ds, m.f / ds]);   // 降采样：层里按 1/ds 画、处理，贴回时放大 ds 倍
  var sc = Math.hypot(m.a, m.b), up = function (C) { if (ds > 1) C.scale(ds, ds); };
  L.setTransform(m);
  var B = draw(L) || o.box || screenBox(m0), b = o.body || B, bw = b[2] - b[0], bh = b[3] - b[1];
  var R = devRect(m, B, 12 * sc, cv.width, cv.height), px = function (C) { C.setTransform(1, 0, 0, 1, 0, 0); }, cp = function (C, src) { C.drawImage(src, R.x, R.y, R.w, R.h, R.x, R.y, R.w, R.h); };
  var clip = function (C, Q) { C.beginPath(); C.rect(Q.x, Q.y, Q.w, Q.h); C.clip(); };
  if (!R) return;
  L.save(); px(L); cp(L, cv); L.restore();                                                          // ① 叠一遍：墨实不透底
  L.save(); L.globalCompositeOperation = 'source-atop';
  var g = L.createLinearGradient(0, b[1], 0, b[3]), lift = o.lift == null ? .06 : o.lift;           // ② 上浓下淡、墨晕斑驳、几团湿边淡晕、受光侧干笔皴擦
  g.addColorStop(0, U.rgba(tone, 0)); g.addColorStop(.5, U.rgba(tone, lift * .3)); g.addColorStop(1, U.rgba(tone, lift));
  L.fillStyle = g; L.fillRect(b[0], b[1], bw, bh);
  L.globalAlpha = o.mottle == null ? .15 : o.mottle; L.drawImage(silTex('mottle', tone), b[0] - bw * .1, b[1], bw * 1.2, bh); L.globalAlpha = 1;
  (o.wash || []).forEach(function (q, i) { I.wash(L, b[0] + q[0] * bw, b[1] + q[1] * bh, q[2] * bw, q[2] * bw * 1.25, q[3], (o.seed || 3) + i * 5, tone, .3 * i, { edge: 'wet' }); });
  if (o.side) [[.06, .1, .18], [.16, .3, .1]].forEach(function (d, i) {
    var u = o.side < 0 ? d[0] : 1 - d[0];
    I.dry(L, [[b[0] + u * bw, b[1] + d[1] * bh], [b[0] + (u + .03 * o.side) * bw, b[1] + (d[1] + .35) * bh], [b[0] + (u + .01 * o.side) * bw, b[1] + .96 * bh]], { w: .09 * bw, a: d[2], rgb: U.mix(tone, o.rim ? o.rim.rgb : [236, 214, 190], .35), dry: .6, seed: (o.seed || 3) + 20 + i, n: 50, hairs: 7 });
  });
  var ft = silTex('fiber'), ts = 240 * Math.max(.6, bw / 700);                                    // ③ 纸纹（按人铺）
  L.globalAlpha = o.paper == null ? .3 : o.paper;
  for (var ty = b[1]; ty < b[3]; ty += ts * 1.5) for (var tx = b[0]; tx < b[2]; tx += ts) L.drawImage(ft, tx, ty, ts, ts * 1.5);
  L.restore();
  var q = U.clamp(Math.round(R.h / 45), 5, 24), sw = Math.ceil(R.w / q), shh = Math.ceil(R.h / q);   // ④ 低分辨率副本：先垫作外渗；再自乘一遍（边缘往里收），
  var sm = U.cached('inkSilSm', function (px) { return U.canvas(W * px / 3, H * px / 3); }), sx = sm.getContext('2d'), A = c.globalAlpha;   //    干笔丝理减去它 = 只剩内缘一圈的丝，从本层挖掉 → 飞白
  sx.clearRect(0, 0, sw + 2, shh + 2); sx.imageSmoothingEnabled = true; sx.drawImage(cv, R.x, R.y, R.w, R.h, 0, 0, sw, shh);
  c.save(); px(c); up(c); c.imageSmoothingEnabled = true;
  if (o.halo) { c.globalAlpha = A * o.halo; c.drawImage(sm, 0, 0, sw, shh, R.x - q * 1.2, R.y - q * .6, R.w + q * 2.4, R.h + q * 1.4); }
  c.restore();
  sx.globalCompositeOperation = 'destination-in'; sx.drawImage(sm, 0, 0, sw, shh, 0, 0, sw, shh); sx.globalCompositeOperation = 'source-over';
  E.save(); px(E); clip(E, R); E.setTransform(m); E.globalCompositeOperation = 'copy'; E.drawImage(silTex('hair'), B[0], B[1], B[2] - B[0], B[3] - B[1]);
  px(E); E.globalCompositeOperation = 'destination-out'; E.imageSmoothingEnabled = true; E.drawImage(sm, 0, 0, sw, shh, R.x - q * .5, R.y - q * .5, R.w + q, R.h + q);
  E.restore();
  L.save(); px(L); L.globalCompositeOperation = 'destination-out'; L.globalAlpha = Math.min(1, o.fb == null ? .85 : o.fb); cp(L, E.canvas); L.restore();
  c.save(); px(c); up(c); c.imageSmoothingEnabled = true;                                          // ⑥ 本体
  cp(c, cv);
  var rm = o.rim;
  if (rm && rm.a > .01) {                                                                         // ⑤ 受光轮廓：错位副本减本体 = 受光一侧一线；丝理断开，再垫一层低分辨率的光晕（逆光，不是描边）
    var dx = Math.round(rm.dx * sc), dy = Math.round(rm.dy * sc), P = { x: R.x - 20, y: R.y - 20, w: R.w + 40, h: R.h + 40 };
    E.save(); px(E); clip(E, P); E.globalCompositeOperation = 'copy';
    E.drawImage(cv, R.x, R.y, R.w, R.h, R.x + dx, R.y + dy, R.w, R.h);
    E.globalCompositeOperation = 'source-in'; E.fillStyle = U.rgba(rm.rgb, 1); E.fillRect(P.x, P.y, P.w, P.h);
    E.globalCompositeOperation = 'destination-out'; cp(E, cv);
    E.setTransform(m); E.globalAlpha = .6; E.drawImage(silTex('hair'), B[0] + 7, B[1] + (B[3] - B[1]) * .13, B[2] - B[0], B[3] - B[1]);
    var ft0 = rm.foot == null ? .84 : rm.foot;                                                     // 脚下贴地处不受逆光：轮廓光在衣摆以下收掉（foot ≥ 1 不收，头肩特写用）
    if (ft0 < 1) {
      var fg = E.createLinearGradient(0, b[1] + bh * ft0, 0, b[3]);
      fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(1, 'rgba(0,0,0,1)');
      E.globalAlpha = 1; E.fillStyle = fg; E.fillRect(B[0] - 20, b[1] + bh * ft0, B[2] - B[0] + 40, B[3] - b[1] - bh * ft0 + 20);
    }
    E.restore();
    var gw = Math.ceil(P.w / 4), gh = Math.ceil(P.h / 4);
    sx.clearRect(0, 0, gw + 2, gh + 2); sx.drawImage(E.canvas, P.x, P.y, P.w, P.h, 0, 0, gw, gh);
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = A * Math.min(1, rm.a) * .35; c.drawImage(sm, 0, 0, gw, gh, P.x - 6, P.y - 6, P.w + 12, P.h + 12);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = A * Math.min(1, rm.a) * .8; c.drawImage(E.canvas, P.x, P.y, P.w, P.h, P.x, P.y, P.w, P.h);
  }
  c.restore();
}

/* ================= 文字 ================= */
var PUNCT = '，。、！？；：…「」『』（）《》·';
var VBOOK = { '《': '︽', '》': '︾' };   // 竖排书名号：换成竖排字形 U+FE3D/FE3E，占整格、不缩不偏（霞鹜文楷有；马善政没有，所以这两个字一律用 text 字体）
function fontOf(f) { return CINE.FONT[f] || f || CINE.FONT.text; }
/* ---------- 文字自动对比度（10-18，ENGINE-NOTES §7.3c；用户整片试看：两侧竖排题注压在同色云雾上看不清） ----------
   I.sub / I.chant / I.note / I.big / I.nameTag 在画字形之前调用。原理：把当前帧「已画出」的画面在字形框下按 4 逻辑 px 一点降采样读回，
   算 WCAG 相对亮度的分布——浅字看亮侧 85 分位、墨字看暗侧 15 分位，与字色比出对比比，目标 CINE.CONTRAST.target（5.0：给体检 C20 ≥ 4.5 留余量）。
   ① I.textContrast（作者底衬之前取样）定深浅：按中段分位（35/65）估，作者给的深浅（各工具的 dark）要补的衬底浓度 > flipAt，且换另一套能少补 flipGain 以上 → 换深浅。
      门槛故意放宽（深浅一换是突变，底在临界附近起伏会来回闪）：只有明显配反（墨字压暗云、白字压亮雾）才换，其余靠 ② 的衬底连续补；底部字幕带（I.sub 除心声）不换深浅。
      只在工具自带的两套配色之间换（心声描边、心念青描、画外音浊黄等样式不变）；显式彩色（I.big 的金/青等 rgb）不换，只补衬底。
   ② I.textBacking（作者底衬之后、字形之前；仅 ① 判定不够时再取样一次）补衬底：逐字一团平顶柔边墨晕（浅字衬墨、墨字衬纸），
      先在临时层合成（重叠处不加深），再按所需浓度 × 文字淡入淡出整体叠上。浓度连续变化，不闪。
   取样只读本帧已画内容：同一 t 画面相同则决定相同（三路径一致）。o.contrast === false 逐条关闭；o.contrast = {target} 改本条目标；
   CINE.CONTRAST.on = false 或 ?contrast=0 全关（与 10-18 前逐字节相同）。体检：tools/sub-lint.mjs --contrast。 */
CINE.CONTRAST = { on: true, target: 5, aa: .8, flipAt: .55, flipGain: .4, max: .92, step: 4 };
var CTR_LUT = new Float32Array(256);
(function () { for (var i = 0; i < 256; i++) { var v = i / 255; CTR_LUT[i] = v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); } })();
function relY(rgb) { return .2126 * CTR_LUT[rgb[0] | 0] + .7152 * CTR_LUT[rgb[1] | 0] + .0722 * CTR_LUT[rgb[2] | 0]; }
function encY(Y) { Y = Math.max(0, Math.min(1, Y)); return Y <= .0031308 ? Y * 12.92 : 1.055 * Math.pow(Y, 1 / 2.4) - .055; }
var CTR_S = null, CTR_PIN = null, CTR_HIST = new Uint32Array(1024);
/* CINE.contrastPin('rec' | 'play' | null)：体检四遍渲染用——'rec' 记下本帧每次决定，'play' 按序照放（不取样），null 关 */
CINE.contrastPin = function (m) {
  if (m === 'rec') CTR_PIN = { mode: 'rec', list: [], i: 0 };
  else if (m === 'play' && CTR_PIN) { CTR_PIN.mode = 'play'; CTR_PIN.i = 0; }
  else CTR_PIN = null;
  return true;
};
function ctrPin(v) {                                         // 记/放一个决定
  if (!CTR_PIN) return v;
  if (CTR_PIN.mode === 'rec') { CTR_PIN.list.push(v); return v; }
  return CTR_PIN.list[CTR_PIN.i++];
}
/* 取样：box [x0,y0,x1,y1] 逻辑屏幕坐标 → {lo 15 分位, hi 85 分位, n}（相对亮度 Y，0..1；透明处按纸色） */
function ctrSample(c, box) {
  var cvs = c.canvas, sc = cvs.width / W, st = CINE.CONTRAST.step;
  var x0 = Math.max(0, box[0]), y0 = Math.max(0, box[1]), x1 = Math.min(W, box[2]), y1 = Math.min(H, box[3]);
  if (x1 - x0 < 2 || y1 - y0 < 2) return null;
  var gw = Math.ceil((x1 - x0) / st), gh = Math.ceil((y1 - y0) / st), k = Math.max(gw / 480, gh / 480, 1);
  gw = Math.max(1, Math.round(gw / k)); gh = Math.max(1, Math.round(gh / k));
  if (!CTR_S) {                                              // 一次分配、先画一次（新画布首次合成会差 1 级，ENGINE-NOTES 7.6）
    var cv0 = U.canvas(480, 480), cx0 = cv0.getContext('2d', { willReadFrequently: false });
    cx0.drawImage(U.canvas(4, 4), 0, 0); CTR_S = cx0;
  }
  var x = CTR_S;
  x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
  x.clearRect(0, 0, gw, gh); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'low';
  x.drawImage(cvs, x0 * sc, y0 * sc, (x1 - x0) * sc, (y1 - y0) * sc, 0, 0, gw, gh);
  var d = x.getImageData(0, 0, gw, gh).data, P = CINE.C.paperRGB, n = gw * gh, i, H2 = CTR_HIST;
  H2.fill(0);
  for (i = 0; i < d.length; i += 4) {
    var a = d[i + 3] / 255, r = d[i] * a + (1 - a) * P[0], g = d[i + 1] * a + (1 - a) * P[1], b = d[i + 2] * a + (1 - a) * P[2];   // 透明处补纸色
    H2[Math.min(1023, (1023 * (.2126 * CTR_LUT[Math.min(255, r | 0)] + .7152 * CTR_LUT[Math.min(255, g | 0)] + .0722 * CTR_LUT[Math.min(255, b | 0)])) | 0)]++;
  }
  function q(f) { var lim = f * n, acc = 0; for (var j = 0; j < 1024; j++) { acc += H2[j]; if (acc >= lim) return (j + .5) / 1023; } return 1; }
  return { lo: q(.15), hi: q(.85), mlo: q(.35), mhi: q(.65), n: n };
}
function decY(v) { v = Math.max(0, Math.min(1, v)); return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }
/* 字色 Yt（不透明度 al，字半透明时混入底色）在底 S 上达到目标 R 所需的衬底浓度：浅字衬墨 [16,13,11]、墨字衬纸 [244,238,224]；
   sRGB 编码空间线性混合近似，对浓度二分 */
function ctrNeed(S, Yt, light, R, mid, al) {
  var vq = encY(mid ? (light ? S.mhi : S.mlo) : light ? S.hi : S.lo), vb = encY(relY(light ? [16, 13, 11] : [244, 238, 224])), vt = encY(Yt);
  al = (al == null ? 1 : al) * CINE.CONTRAST.aa;              // 字笔画多是抗锯齿半覆盖像素（40–64px 字的笔画 3–6px）：按 aa 倍不透明度估，体检的「实笔像素」才够
  function ratio(a) {
    var vg = vq * (1 - a) + vb * a, yg = decY(vg), yt = decY(al * vt + (1 - al) * vg);
    return (Math.max(yg, yt) + .05) / (Math.min(yg, yt) + .05) * ((yt > yg) === light ? 1 : 0);
  }
  if (ratio(0) >= R) return 0;
  if (ratio(1) < R) return 1;
  var lo = 0, hi = 1;
  for (var k = 0; k < 14; k++) { var m = (lo + hi) / 2; if (ratio(m) >= R) hi = m; else lo = m; }
  return hi;
}
/* I.textContrast(c, box, o) → K。o: dark 作者深浅（true＝深景浅字）, light / ink 两套字色 rgb（浅字、墨字）, alpha 字的不透明度（缺省 1）, flip false 不许换深浅, contrast（false 关 | {target}）。
   K = {dark 最终深浅, flip 是否换了, need 预估要补的浓度, box, R, Yt} */
I.textContrast = function (c, box, o) {
  var CT = CINE.CONTRAST, dark = o.dark !== false, K = { dark: dark, flip: false, need: 0, box: box };
  if (!CT.on || o.contrast === false) return K;
  var R = (o.contrast && o.contrast.target) || CT.target, yl = relY(o.light || [240, 232, 214]), yi = relY(o.ink || [30, 25, 21]);
  K.R = R;
  var v = ctrPin(null);
  if (v === null || v === undefined) {
    var S = ctrSample(c, box);
    if (!S) v = { d: dark, f: false, n: 0 };
    else {
      var al = o.alpha, mA = ctrNeed(S, dark ? yl : yi, dark, R, 1, al), mB = ctrNeed(S, dark ? yi : yl, !dark, R, 1, al), fl = o.flip !== false && mA > CT.flipAt && mB < mA - CT.flipGain;
      v = { d: fl ? !dark : dark, f: fl, n: fl ? ctrNeed(S, dark ? yi : yl, !dark, R, 0, al) : ctrNeed(S, dark ? yl : yi, dark, R, 0, al) };
    }
    if (CTR_PIN && CTR_PIN.mode === 'rec') CTR_PIN.list[CTR_PIN.list.length - 1] = v;
  }
  K.dark = v.d; K.flip = v.f; K.need = v.n; K.Yt = K.dark ? yl : yi; K.al = o.alpha;
  var lc = CINE._lintCur && CINE._lintCur();
  if (lc) lc.ctr = { dark: K.dark ? 1 : 0, flip: K.flip ? 1 : 0, need: Math.round(K.need * 100) / 100 };
  return K;
};
/* 衬底层：逐字平顶柔边墨晕的蒙版（与颜色无关，8 种形） */
var BACK_CORE = .42;                                         // 平顶核占团半径的比例
function backMask(i) {
  return U.cached('ctrBack' + i, function () {
    var S = 96, cv = U.canvas(S, S), x = cv.getContext('2d'), id = x.createImageData(S, S), d = id.data, sd = 701 + i * 13;
    for (var j = 0; j < S; j++) for (var q = 0; q < S; q++) {
      var u = (q + .5) / S * 2 - 1, v = (j + .5) / S * 2 - 1, ang = Math.atan2(v, u);
      var dd = Math.hypot(u, v);
      var Rn = .88 + .1 * U.noise1(ang * 1.6 + 3, sd) + .05 * U.noise1(ang * 5 + 7, sd + 1);    // 不齐的外缘
      var e = U.clamp((dd - BACK_CORE) / Math.max(.05, Rn - BACK_CORE), 0, 1), a = 1 - U.smooth(e);
      a *= 1 - e * (.35 + .35 * U.noise2(u * 4 + 5, v * 4 + 5, sd + 2));                          // 羽化区墨色浓淡不匀（核内均匀，保证对比）
      var k = (j * S + q) * 4; d[k] = d[k + 1] = d[k + 2] = 0; d[k + 3] = U.clamp(a * 255, 0, 255);
    }
    x.putImageData(id, 0, 0);
    return cv;
  });
}
var BACK_L = null;
/* I.textBacking(c, K, dabs, A, seed)：dabs = [[cx, cy, half 字半宽, alpha?]…]（c 当前坐标系，即字形所在坐标系）；A 文字整体不透明度 */
I.textBacking = function (c, K, dabs, A, seed) {
  if (!K || !(K.need > .005) || !dabs.length || A <= .003) return 0;
  var CT = CINE.CONTRAST, a = ctrPin(null);
  if (a === null || a === undefined) {
    var S = ctrSample(c, K.box);
    a = S ? Math.min(CT.max, ctrNeed(S, K.Yt, K.dark, K.R, 0, K.al)) : 0;
    if (CTR_PIN && CTR_PIN.mode === 'rec') CTR_PIN.list[CTR_PIN.list.length - 1] = a;
  }
  var lc = CINE._lintCur && CINE._lintCur();
  if (lc && lc.ctr) lc.ctr.back = Math.round(a * 100) / 100;
  if (a <= .005) return 0;
  var bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9, i, G = 1.3 / BACK_CORE;   // 半宽 h 的字配半径 h×1.3/核 的团：核盖住字形外 .15 字高，羽化到约 3 倍半宽
  for (i = 0; i < dabs.length; i++) { var r = dabs[i][2] * G * 1.2; bx0 = Math.min(bx0, dabs[i][0] - r); by0 = Math.min(by0, dabs[i][1] - r); bx1 = Math.max(bx1, dabs[i][0] + r); by1 = Math.max(by1, dabs[i][1] + r); }
  var s = .5, lw = Math.ceil((bx1 - bx0) * s) + 2, lh = Math.ceil((by1 - by0) * s) + 2;
  if (!BACK_L || BACK_L.canvas.width < lw || BACK_L.canvas.height < lh) {   // 一次给足（全屏一半 + 余量），只在超出时换（同 lib-flow tmp）
    var cv = U.canvas(Math.max(lw, 1100, BACK_L ? BACK_L.canvas.width : 0), Math.max(lh, 700, BACK_L ? BACK_L.canvas.height : 0));
    BACK_L = cv.getContext('2d'); BACK_L.drawImage(U.canvas(4, 4), 0, 0);
  }
  var L = BACK_L, rng = U.rng(seed || 3);
  L.setTransform(1, 0, 0, 1, 0, 0); L.globalAlpha = 1; L.globalCompositeOperation = 'source-over'; L.clearRect(0, 0, lw, lh);
  L.imageSmoothingEnabled = true; L.imageSmoothingQuality = 'low';
  L.setTransform(s, 0, 0, s, -bx0 * s, -by0 * s);
  for (i = 0; i < dabs.length; i++) {
    var q = dabs[i], h = q[2] * G * (1 + .1 * rng.pm(1)), hy = h * (1 + .08 * rng.pm(1)), ox = q[2] * .12 * rng.pm(1), oy = q[2] * .08 * rng.pm(1);
    L.globalAlpha = q[3] == null ? 1 : U.clamp(q[3], 0, 1);
    if (L.globalAlpha > .003) L.drawImage(backMask((seed + i * 3) & 7), q[0] - h + ox, q[1] - hy + oy, h * 2, hy * 2);
  }
  L.setTransform(1, 0, 0, 1, 0, 0); L.globalAlpha = 1; L.globalCompositeOperation = 'source-in';
  L.fillStyle = U.rgba(K.dark ? [16, 13, 11] : [244, 238, 224], 1); L.fillRect(0, 0, lw, lh);
  L.globalCompositeOperation = 'source-over';
  c.save(); c.globalAlpha *= Math.min(1, a * A); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'low';
  c.drawImage(L.canvas, 0, 0, lw, lh, bx0, by0, lw / s, lh / s);
  c.restore();
  return a;
};
/* 竖排字心（与 I.vtext 同规：标点占 .35 格）→ 衬底团 [cx, cy, 半宽] */
I.vdabs = function (str, x, y, size, gap, colGap, out) {
  out = out || [];
  str.split('\n').forEach(function (col, ci) {
    var cy = y + size / 2, cx = x - ci * size * (colGap || 1.5);
    for (var i = 0; i < col.length; i++) {
      var ch = col[i], p = !VBOOK[ch] && PUNCT.indexOf(ch) >= 0 && ch !== '·';
      if (!p) out.push([cx, cy, size * .5]);
      cy += p ? size * (gap || 1.08) * .35 : size * (gap || 1.08);
    }
  });
  return out;
};
/* 竖排逐字：str 可含 '\n' 分列（自右向左）。
   o: size, font('poem'|'text'|'sword'|'wild'|css), rgb, a, gap 字距倍率(1.08), colGap 列距倍率(1.5),
      times 每字出现时刻数组（与 str 去掉换行后的字一一对应，标点可占位）, t 当前时刻, fade 每字淡入秒(.45),
      out [t0,t1] 整体淡出区间, bleed 出字时字后晕染强度(.25), grow 出字时由大到正(.18), shake 字形微颤 px, seed,
      glow 发光色 rgb（金字/青字）, glowA；返回每字位置 [{ch,x,y,k}] */
I.vtext = function (c, str, x, y, o) {
  o = o || {};
  var size = o.size || 48, gap = size * (o.gap || 1.08), colGap = size * (o.colGap || 1.5), rgb = o.rgb || CINE.C.inkRGB;
  var A = o.a == null ? 1 : o.a, t = o.t == null ? 1e9 : o.t, fade = o.fade || .45, out = [], idx = 0;
  if (o.out) A *= 1 - U.ramp(t, o.out[0], o.out[1]);
  if (A <= 0.003) return out;
  var cols = str.split('\n');
  c.save();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  cols.forEach(function (col, ci) {
    var cx = x - ci * colGap, cy = y + size / 2;
    for (var i = 0; i < col.length; i++) {
      var ch = col[i], vb = VBOOK[ch], isP = !vb && PUNCT.indexOf(ch) >= 0 && ch !== '·';
      var t0 = o.times ? (o.times[idx] == null ? 1e9 : o.times[idx]) : -1e9;
      var k = U.clamp((t - t0) / fade, 0, 1), ek = U.easeOut(k);
      idx++;
      var px = cx, py = cy;
      if (isP) { px += size * .32; py -= gap * .32; }
      if (k > 0) {
        var jx = 0, jy = 0;
        if (o.shake) { jx = o.shake * U.noise1(t * 9 + idx * 7, o.seed || 3); jy = o.shake * U.noise1(t * 8 + idx * 5, (o.seed || 3) + 9); }
        if (o.bleed !== 0 && !isP && !vb) I.wash(c, px, py + size * .05, size * (.55 + .5 * ek), size * (.6 + .5 * ek), (o.bleed || .25) * A * Math.sin(Math.PI * Math.min(1, k * 1.4)) * .6 + (o.bleed || .25) * A * .25 * ek, idx + 3, rgb, 0, { edge: 'soft' });
        var sc = 1 + (o.grow == null ? .18 : o.grow) * (1 - ek), sz = (isP ? size * .6 : size) * sc;
        c.font = Math.round(sz) + 'px ' + fontOf(ch === '·' || vb ? 'text' : o.font || 'poem');
        if (o.glow) I.glow(c, px + jx, py + jy, size * .9, o.glow, (o.glowA == null ? .35 : o.glowA) * A * ek, o.glowMode);
        c.fillStyle = U.rgba(rgb, A * ek);
        c.fillText(vb || ch, px + jx, py + jy);
      }
      out.push({ ch: ch, x: px, y: py, k: k });
      cy += isP ? gap * .35 : gap;
    }
  });
  c.restore();
  return out;
};
/* 横排台词（画面下部或人物旁，无底块）：t0 起淡入、t1 起淡出。
   o: x, y(默认 H*.86), size(40), font('text'), rgb, a, align('center'|'left'|'right'), fi(.5), fo(.6),
      type 每秒出字数(打字式), cut {from 字序, at 时刻} 话尾从此断掉消散, halo 字后衬晕(rgb，用于夜景可读性), glow 发光色 */
I.say = function (c, text, t, t0, t1, o) {
  o = o || {};
  var fi = o.fi == null ? .5 : o.fi, fo = o.fo == null ? .6 : o.fo;
  var A = (o.a == null ? 1 : o.a) * U.win(t, t0, t1, fi, fo);
  if (A <= 0.003) return;
  var size = o.size || 40, rgb = o.rgb || CINE.C.inkRGB, font = size + 'px ' + fontOf(o.font || 'text');
  c.save(); c.font = font; c.textBaseline = 'middle'; c.textAlign = 'left';
  var ws = [], tot = 0, sp = size * (o.spacing == null ? .06 : o.spacing);
  for (var i = 0; i < text.length; i++) { var w = c.measureText(text[i]).width + sp; ws.push(w); tot += w; }
  var x = o.x == null ? W / 2 : o.x, y = o.y == null ? H * .86 : o.y, al = o.align || 'center';
  var x0 = al === 'center' ? x - tot / 2 : al === 'right' ? x - tot : x;
  if (o.halo) I.wash(c, x0 + tot / 2, y, tot * .62 + size, size * 1.3, .5 * A, 4, o.halo, 0, { edge: 'soft' });
  var drawn = false, bx = x0;
  for (i = 0; i < text.length; i++) {
    var k = 1, dy = 0;
    if (o.type) k = U.clamp((t - t0) * o.type - i, 0, 1);
    if (o.cut && i >= o.cut.from) { var q = U.clamp((t - o.cut.at - (i - o.cut.from) * .06) / .7, 0, 1); k *= 1 - q; dy = -q * size * .6; }
    if (k > 0.003) {
      if (o.glow) I.glow(c, x0 + ws[i] / 2, y, size * .8, o.glow, .25 * A * k);
      c.fillStyle = U.rgba(rgb, A * k);
      c.fillText(text[i], x0, y + dy);
      drawn = true;
    }
    x0 += ws[i];
  }
  c.restore();
  if (drawn) textLog('say', text, [bx, y - size * .6, bx + tot, y + size * .6]);
};
/* 旁白：竖排小字，淡墨，默认靠右留白处逐字浮现。o 同 vtext，另有 x,y（默认 W*.9, H*.16）, cps 每秒字数(6) */
I.narr = function (c, text, t, t0, t1, o) {
  o = o || {};
  var A = (o.a == null ? 1 : o.a) * (1 - U.ramp(t, t1, t1 + (o.fo || .8)));
  if (A <= 0.003 || t < t0) return;
  var times = [], cps = o.cps || 6, n = 0;
  for (var i = 0; i < text.length; i++) if (text[i] !== '\n') times.push(t0 + (n++) / cps);
  var x = o.x == null ? W * .9 : o.x, y = o.y == null ? H * .16 : o.y, size = o.size || 34;
  I.vtext(c, text, x, y, {
    size: size, font: o.font || 'text', rgb: o.rgb || CINE.C.greyRGB, a: A, times: times, t: t, fade: .6, bleed: o.bleed == null ? .12 : o.bleed, grow: .05, gap: 1.12
  });
  if (t > t0) {
    var cols = text.split('\n'), len = Math.max.apply(null, cols.map(function (s) { return s.length; }));
    textLog('narr', text, [x - (cols.length - 1) * size * 1.5 - size / 2, y, x + size / 2, y + len * size * 1.12]);
  }
};

/* 验收钩子：I.say / I.narr / I.nameTag 每次实际画出时往本帧 CINE._textLog 登记 {kind, text, box[x0,y0,x1,y1]}（drawFrame 开头清空）。
   box 是调用时的坐标系（各幕的台词与旁白都在屏幕坐标里画），只作大致定位。 */
CINE._textLog = [];
function textLog(kind, text, box, extra) {
  var e = { kind: kind, text: text, box: box };
  if (extra) for (var k in extra) e[k] = extra[k];
  CINE._textLog.push(e);
}
/* ---------- 字幕体检钩子（tools/sub-lint.mjs；ENGINE-NOTES §7.3）----------
   缺省关：不装任何钩子，零开销、不改画面。?lint=1 或页内 CINE.lintOn() 打开后（只记录、不改任何绘制参数，画面与 --det 哈希不变）：
   · I.sub/chant/note/say/narr/nameTag 与幕名卡包一层：调用期间经 fillText 实际画出的字计数，取每字不透明度（globalAlpha×填色 alpha）的最小/最大值；
     字画全了（字数＝文字去空白后的字数）full＝最小值，否则 full＝0；any＝最大值。嵌套调用（I.sub→I.chant、I.ledger→…）只记最外层。
   · I.big 画的是缓存精灵（不走 fillText）：按返回的逐字进度×整体淡出算，冲散一开始 full＝0。
   · 包层之外的 fillText（前情提要自画字卡、尾声三格名等）记成 raw，按「同字号、同一基线、相邻」拼成行（只认横排）。U.cached 构建精灵时画的字不记。
   每帧：CINE.lintReset() → renderAt(T) → CINE.lintFrame() 取 [{kind, text, full, any, (raw：size, x 行左端, y, 逻辑坐标)}]。 */
var LINT = null;
/* 叠在已登记字形上的装饰重画（题签特效「字亮一下」等）：不算新字、不拉低该条的每字不透明度；量对比度的几遍（LINT.mode）里不画，免得污染取样。正常播放照画。 */
I.textOverlay = function (fn) {
  if (LINT && LINT.mode) return;
  if (LINT) LINT.cache++;
  try { fn(); } finally { if (LINT) LINT.cache--; }
};
function styleAlpha(s) {
  if (typeof s !== 'string') return 1;
  var m = /^rgba\([^)]*,\s*([\d.]+)\s*\)$/.exec(s);
  return m ? +m[1] : 1;
}
/* 字形外接框（逻辑屏幕坐标）并入 C.box：矩形四角过当前变换 */
function lintBox(C, ctx, x0, y0, x1, y1) {
  var m = ctx.getTransform(), p = CINE.px, b = C.box || (C.box = [1e9, 1e9, -1e9, -1e9]);
  [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].forEach(function (q) {
    var X = (m.a * q[0] + m.c * q[1] + m.e) / p, Y = (m.b * q[0] + m.d * q[1] + m.f) / p;
    if (X < b[0]) b[0] = X; if (Y < b[1]) b[1] = Y; if (X > b[2]) b[2] = X; if (Y > b[3]) b[3] = Y;
  });
}
function textRect(ctx, str, x, y) {                          // fillText 的大致字形框（按 textAlign / textBaseline）
  var w = ctx.measureText(str).width, px = parseFloat(/([\d.]+)px/.exec(ctx.font)) || 10, al = ctx.textAlign, bl = ctx.textBaseline;
  var lx = al === 'center' ? x - w / 2 : al === 'right' || al === 'end' ? x - w : x;
  var ty = bl === 'middle' ? y - px * .55 : bl === 'top' || bl === 'hanging' ? y : bl === 'bottom' || bl === 'ideographic' ? y - px : y - px * .85;
  return [lx, ty, lx + w, ty + px * 1.1];
}
var FORCE = { white: 'rgba(255,255,255,', black: 'rgba(0,0,0,' }, FORCE_F = { white: 'brightness(0) invert(1)', black: 'brightness(0)' };
CINE.lintOn = function () {
  if (LINT) return true;
  LINT = { rec: [], raw: [], cur: null, cache: 0, mode: null };
  var P = CanvasRenderingContext2D.prototype, fill = P.fillText, strk = P.strokeText, dimg = P.drawImage, cached = U.cached;
  P.strokeText = function () { if (LINT.mode === 'ghost' && !LINT.cache) return; return strk.apply(this, arguments); };   // 描边属于字形：「字形不画」那遍一起不画（量的是字对其下画面）
  P.fillText = function (s, x, y) {
    var str = String(s);
    if (!LINT.cache && /\S/.test(str)) {
      var a = this.globalAlpha * styleAlpha(this.fillStyle), C = LINT.cur, r = textRect(this, str, x, y);
      if (C) { C.n += str.replace(/\s/g, '').length; if (a < C.lo) C.lo = a; if (a > C.hi) C.hi = a; lintBox(C, this, r[0], r[1], r[2], r[3]); }
      else {
        var m = this.getTransform(), sc = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) / CINE.px, px = parseFloat(/([\d.]+)px/.exec(this.font)) || 10;
        var w = this.measureText(str).width, al = this.textAlign, lx = al === 'center' ? x - w / 2 : al === 'right' || al === 'end' ? x - w : x, R = {};
        lintBox(R, this, r[0], r[1], r[2], r[3]);
        LINT.raw.push({ s: str, a: a, size: px * sc, x: (m.a * lx + m.c * y + m.e) / CINE.px, y: (m.b * lx + m.d * y + m.f) / CINE.px, w: w * sc, box: R.box });
      }
      if (LINT.mode === 'ghost') return;                     // 量对比度：字形不画（衬底、描边照画）
      if (LINT.mode) { var fs = this.fillStyle; this.fillStyle = FORCE[LINT.mode] + styleAlpha(fs) + ')'; try { return fill.apply(this, arguments); } finally { this.fillStyle = fs; } }
    }
    return fill.apply(this, arguments);
  };
  P.drawImage = function (img) {                             // 缓存字形精灵（I.big，标了 _glyph）同上：记框、按模式不画或强制纯白/纯黑
    if (img && img._glyph && !LINT.cache) {
      var n = arguments.length, A = arguments, dx = n >= 9 ? A[5] : A[1], dy = n >= 9 ? A[6] : A[2], dw = n >= 9 ? A[7] : n >= 5 ? A[3] : img.width, dh = n >= 9 ? A[8] : n >= 5 ? A[4] : img.height;
      if (LINT.cur) lintBox(LINT.cur, this, dx, dy, dx + dw, dy + dh);
      if (LINT.mode === 'ghost') return;
      if (LINT.mode) { var f0 = this.filter; this.filter = FORCE_F[LINT.mode]; try { return dimg.apply(this, arguments); } finally { this.filter = f0; } }
    }
    return dimg.apply(this, arguments);
  };
  U.cached = function (key, build) { return cached(key, function (px) { LINT.cache++; try { return build(px); } finally { LINT.cache--; } }); };
  function wrap(f, spec, post) {
    return function () {
      if (LINT.cur) return f.apply(this, arguments);
      var C = LINT.cur = { n: 0, lo: 1, hi: 0, box: null, ctr: null }, r;
      try { r = f.apply(this, arguments); } finally { LINT.cur = null; }
      var s = spec(arguments), e = post ? post(arguments, r) : C.n ? { full: C.n >= s.need ? C.lo : 0, any: C.hi } : null;
      if (e && e.any > .003) {
        var q = { kind: s.kind, text: s.text, full: e.full, any: e.any };
        if (C.box) q.box = C.box.map(function (v) { return Math.round(v); });
        if (s.span) q.span = true;
        if (C.ctr) q.ctr = C.ctr;
        LINT.rec.push(q);
      }
      return r;
    };
  }
  function opt(A, i) { var o = A[i]; return o && typeof o === 'object' ? o : {}; }
  function txt(kind, oi) { return function (A) { return { kind: typeof kind === 'function' ? kind(A) : kind, text: A[1], need: String(A[1]).replace(/\s/g, '').length, span: !!opt(A, oi).span }; }; }
  I.sub = wrap(I.sub, txt(function (A) { return opt(A, 5).kind || 'narr'; }, 5));
  ['chant', 'note', 'say'].forEach(function (k) { if (I[k]) I[k] = wrap(I[k], txt(k, 5)); });
  I.narr = wrap(I.narr, txt('vnarr', 5));
  I.nameTag = wrap(I.nameTag, function (A) { var o = opt(A, 2), n = o.name || '', r = o.role || ''; return { kind: 'tag', text: n + (r ? ' · ' + r : ''), need: (n + r).replace(/\s/g, '').length, span: !!o.span }; });
  if (I.big) I.big = wrap(I.big, txt('big', 4), function (A, out) {
    if (!out || !out.length) return null;
    var t = A[2], o = A[4] || {}, A0 = (o.a == null ? 1 : o.a) * (o.out ? 1 - U.ramp(t, o.out[0], o.out[1]) : 1), lo = 1, hi = 0;
    out.forEach(function (q) { lo = Math.min(lo, q.k); hi = Math.max(hi, q.k); });
    var sc = o.scatter, gone = sc && t > sc.t ? U.clamp((t - sc.t) / (sc.dur || .9), 0, 1) : 0;
    return { full: gone > 0 ? 0 : A0 * lo, any: A0 * hi * (1 - gone) };
  });
  cardFn = wrap(drawCard, function (A) { var a = A[1], s = a.card ? (a.card[0] || '') + '·' + (a.card[1] || '') : ''; return { kind: 'title', text: s, need: s.length }; });
  return true;
};
/* 量对比度用（tools/sub-lint.mjs --contrast）：m = null 正常 | 'ghost' 字形不画 | 'white' / 'black' 字形强制纯白 / 纯黑（保留各字自身透明度）。
   与 CINE.contrastPin 配合：正常一遍记下自动对比的决定，其余三遍照放，保证四遍除字形外逐像素相同。 */
CINE.lintMode = function (m) { if (LINT) LINT.mode = m || null; return !!LINT; };
CINE._lintCur = function () { return LINT && LINT.cur; };
CINE.lintReset = function () { if (LINT) { LINT.rec = []; LINT.raw = []; LINT.cur = null; } };
CINE.lintFrame = function () {
  if (!LINT) return null;
  var R = LINT.raw.slice().sort(function (p, q) { return p.y - q.y; }), bands = [], lines = [];
  R.forEach(function (r) {                                   // 同字号、基线相差 < .45 字高 → 同一横带
    var b = bands[bands.length - 1];
    if (b && Math.abs(b.size - r.size) < 1 && Math.abs(r.y - b.y) < r.size * .45) b.list.push(r); else bands.push({ size: r.size, y: r.y, list: [r] });
  });
  bands.forEach(function (b) {                               // 带内按 x 排，间距 > 1.5 字高处断开
    b.list.sort(function (p, q) { return p.x - q.x; });
    var L = null;
    b.list.forEach(function (r) {
      if (!L || r.x - L.x1 > r.size * 1.5) { L = { kind: 'raw', text: '', full: 1, any: 0, size: Math.round(r.size), x: Math.round(r.x), y: Math.round(b.y), x1: r.x, box: [1e9, 1e9, -1e9, -1e9] }; lines.push(L); }
      L.text += r.s; L.full = Math.min(L.full, r.a); L.any = Math.max(L.any, r.a); L.x1 = Math.max(L.x1, r.x + r.w);
      if (r.box) { L.box[0] = Math.min(L.box[0], r.box[0]); L.box[1] = Math.min(L.box[1], r.box[1]); L.box[2] = Math.max(L.box[2], r.box[2]); L.box[3] = Math.max(L.box[3], r.box[3]); }
    });
  });
  lines.forEach(function (L) { delete L.x1; L.box = L.box[0] < 1e9 ? L.box.map(function (v) { return Math.round(v); }) : undefined; });
  return LINT.rec.concat(lines.filter(function (L) { return L.any > .003; }));
};
/* 人物题签（DESIGN-enhance-1011 §6）：竖排「名字」列（马善政）＋其左侧低半格的「身份」列（霞鹜文楷，像落款）。
   o: name, role, x,y 名字列顶端中心（屏幕逻辑坐标，不跟镜头）, t0 起始幕内秒, side 'left'|'right' 题签在人物哪一侧（墨晕往远离人物的一侧散）,
      hold 停留秒（2.0，允许 1.2–2.0）, dark 深底配色, size 名字字号（72；POLISH-1 由 56 放大：与正文 64 同级略大，靠马善政笔势＋更浓的墨分主次）, roleSize 身份字号（缺省 max(64, size×.9)＝正文字号 CINE.SUB.size；POLISH-1 由 40 放大，astra P2-1）,
      a 整体不透明度（1）, seed, allowSay 例外：允许和台词同帧（只影响 __cine.tagClash）。
   时间：[t0, t0+.35] 逐字淡显（名字 .12s 内起笔、身份晚 .1s 在 .08s 内起笔，每字淡入 .2s）→ 停到 t0+.5+hold → .5s 墨晕散去（字淡出、放大到 1.06、字底一块淡墨晕、整体向外漂 12px），
   t0+1+hold 淡尽（总长不变，缺省 3.0s）。修订 v2：原「.4s 淡显＋.6s 散去」的完整可读只有 1.96s，改成快显、晚散后约 2.17s（sub-lint 要求 ≥2.0）。
   纯 t 的函数，不存状态。 */
var tagWarned = {};
I.nameTag = function (c, t, o) {
  o = o || {};
  var hold = o.hold == null ? 2 : o.hold, t0 = o.t0 || 0;
  if (t < t0 || t > t0 + 1 + hold) return;
  var name = o.name || '', role = o.role || '', size = o.size || 72, rs = o.roleSize || Math.max(64, Math.round(size * .9)), A = o.a == null ? 1 : o.a;
  if (role.length > 8 && !tagWarned[name + role] && /[?&]debug=1/.test(location.search)) { tagWarned[name + role] = 1; if (window.console) console.info('[cine] 题签身份超过 8 字：' + name + ' · ' + role); }
  var k = U.clamp((t - t0 - .5 - hold) / .5, 0, 1), fadeA = Math.pow(1 - k, 1.5), sc = 1 + .06 * k;   // 修订 v2：散去 .6→.5s、晚 .1s 起（淡尽时刻不变）
  var dir = o.side === 'right' ? 1 : -1, dx = dir * 12 * k, x = o.x || 0, y = o.y || 0;
  var dark = !!o.dark;
  if (.92 * A * fadeA <= .003) return;
  var RG = 1.04, rx = x - size * .5 - rs * .5 - size * .3, ry = y + size * .6;   // 身份列紧贴名字列左侧、低半格（落款式）；两列间留 .3 名字字高（POLISH-1：两列近等宽，留白加宽才分得开）；身份字距 1.04（原 1.12，64px 下 7 字列高约 470px）
  var K = I.textContrast(c, [rx - rs / 2 + dx, y, x + size / 2 + dx, Math.max(y + name.length * size * 1.08, role ? ry + role.length * rs * RG : y)],   // 自动对比（§7.3c）：深浅不对就换、不够就补衬底
    { dark: dark, light: [236, 229, 212], ink: [36, 30, 26], alpha: .86 * A, contrast: o.contrast });
  dark = K.dark;
  var nRGB = dark ? [236, 229, 212] : [36, 30, 26], rRGB = dark ? [196, 190, 178] : [62, 56, 50];
  var nA = .92 * A * fadeA, rA = (dark ? .86 : .88) * A * fadeA;   // 身份列 POLISH-1 再提亮（10-18 .84/.86，原 .72/.75），仍略次于名字
  function times(str, start, span) {                     // 每字出现时刻：在 span 秒内依次起笔
    var n = str.replace(/\n/g, '').length, r = [];
    for (var i = 0; i < n; i++) r.push(start + (n > 1 ? i * span / (n - 1) : 0));
    return r;
  }
  function cols(str, cx, cy, sz, gap) {                  // 与 I.vtext 同规的字心（标点占 .35 格）
    var r = [];
    for (var i = 0; i < str.length; i++) { var v = VBOOK[str[i]], p = !v && PUNCT.indexOf(str[i]) >= 0 && str[i] !== '·'; r.push([cx, cy + sz / 2]); cy += p ? sz * gap * .35 : sz * gap; }
    return r;
  }
  c.save(); I.screen(c);
  c.translate(x + dx, y); c.scale(sc, sc); c.translate(-x, -y);
  if (k > 0) {                                           // 墨晕散去：每字底下一块淡墨晕
    var wa = .22 * Math.sin(Math.PI * k) * A, wr = U.lerp(.6, 1.1, k), rnd = U.rng(o.seed || 7);
    cols(name, x, y, size, 1.08).forEach(function (q, i) { I.wash(c, q[0], q[1], size * wr, size * wr * 1.1, wa, (o.seed || 7) + i, nRGB, rnd.pm(.3), { edge: 'soft' }); });
    cols(role, rx, ry, rs, RG).forEach(function (q, i) { I.wash(c, q[0], q[1], rs * wr, rs * wr * 1.1, wa * .7, (o.seed || 7) + 20 + i, rRGB, rnd.pm(.3), { edge: 'soft' }); });
  }
  var fi = .2, ba = .78 * A * fadeA * U.smooth(U.clamp((t - t0) / .5, 0, 1)), bRGB = dark ? [16, 13, 11] : [238, 230, 212];
  if (ba > .003) {                                       // POLISH-1：字后衬一抹柔边淡墨（浅字衬墨、墨字衬纸），放大后压在云、浪、暗部上也读得出；同字幕的字后柔晕
    var nh = name.length * size * 1.08, rh = role.length * rs * RG;
    I.wash(c, x, y + nh / 2, size * 1.05, nh / 2 + size * .5, ba, (o.seed || 7) + 40, bRGB, 0, { edge: 'soft' });
    if (role) I.wash(c, rx, ry + rh / 2, rs * 1.05, rh / 2 + rs * .5, ba, (o.seed || 7) + 41, bRGB, 0, { edge: 'soft' });
  }
  if (K.need > .005) I.textBacking(c, K, I.vdabs(role, rx, ry, rs, RG, 1.5, I.vdabs(name, x, y, size, 1.08)), A * fadeA * U.smooth(U.clamp((t - t0) / .5, 0, 1)), (o.seed || 7) + 60);
  var FX = o.fx && I.tagFx && I.tagFx[o.fx], FG = null;   // 题签特效（可复用样式，见 lib-text I.tagFx）：pre 画在字下、post 画在字上；只收几何与时刻，纯 t
  if (FX) FG = { t0: t0, hold: hold, k: k, A: A * fadeA, dark: dark, seed: o.seed || 7, opt: o.fxOpt || {}, x: x, y: y, size: size, rx: rx, ry: ry, rs: rs,
    nb: cols(name, x, y, size, 1.08), rb: cols(role, rx, ry, rs, RG),
    redraw: function (rgb, a) { I.textOverlay(function () {   // 按同一时序重画字形（给特效做「字亮一下」用；经 I.textOverlay，不算新字）
      I.vtext(c, name, x, y, { size: size, font: 'poem', gap: 1.08, rgb: rgb, a: a * nA, t: t, times: times(name, t0, .12), fade: fi, bleed: 0, grow: .06, seed: o.seed });
      if (role) I.vtext(c, role, rx, ry, { size: rs, font: 'text', gap: RG, rgb: rgb, a: a * rA, t: t, times: times(role, t0 + .1, .08), fade: fi, bleed: 0, grow: .06, seed: o.seed });
    }); } };
  if (FX) FX(c, t, FG, 'pre');
  if (FX && FX.drawName) FX.drawName(c, t, FG, { name: name, x: x, y: y, size: size, rgb: nRGB, a: nA, times: times(name, t0, .12), fade: fi, grow: .06 });   // 特效可接管名字字形（如无形剑的透明字身）
  else I.vtext(c, name, x, y, { size: size, font: 'poem', gap: 1.08, rgb: nRGB, a: nA, t: t, times: times(name, t0, .12), fade: fi, bleed: .18, grow: .06, seed: o.seed });   // 修订 v2：快显（原名字 .15s、身份 t0+.15 起 .1s、淡入 .25）
  if (role) I.vtext(c, role, rx, ry, { size: rs, font: 'text', gap: RG, rgb: rRGB, a: rA, t: t, times: times(role, t0 + .1, .08), fade: fi, bleed: .18, grow: .06, seed: o.seed });
  if (FX) FX(c, t, FG, 'post');
  c.restore();
  var nb = cols(name, x, y, size, 1.08), rb = cols(role, rx, ry, rs, RG);
  var bot = Math.max(nb.length ? nb[nb.length - 1][1] + size / 2 : y, rb.length ? rb[rb.length - 1][1] + rs / 2 : y);
  textLog('tag', name + (role ? ' · ' + role : ''), [rx - rs / 2 + dx, y, x + size / 2 + dx, bot], { allowSay: !!o.allowSay });
};

/* ================= 镜头 ================= */
/* cam: {x,y 画面中心对准的世界点, z 缩放, rot, shake 震幅 px, t, seed}。在 c 上施加变换（调用方负责 save/restore） */
I.cam = function (c, cam) {
  var z = cam.z || 1, sx = 0, sy = 0;
  if (cam.shake) { var t = cam.t || 0, sd = cam.seed || 1; sx = cam.shake * U.noise1(t * 23, sd); sy = cam.shake * U.noise1(t * 21, sd + 5); }
  c.translate(W / 2 + sx, H / 2 + sy);
  if (cam.rot) c.rotate(cam.rot);
  c.scale(z, z);
  c.translate(-(cam.x == null ? W / 2 : cam.x), -(cam.y == null ? H / 2 : cam.y));
};
/* 镜头关键帧：keys=[[t,[x,y,z]],...] → {x,y,z} */
I.camAt = function (t, keys, ease) { var v = U.kf(t, keys, ease); return { x: v[0], y: v[1], z: v[2] == null ? 1 : v[2] }; };
/* 视差：以 depth(0 远 → 1 同焦平面) 对镜头位移打折，返回可直接 I.cam 的对象 */
I.par = function (cam, depth) {
  return { x: W / 2 + (cam.x - W / 2) * depth, y: H / 2 + (cam.y - H / 2) * depth, z: 1 + ((cam.z || 1) - 1) * depth, rot: cam.rot, shake: cam.shake ? cam.shake * depth : 0, t: cam.t, seed: cam.seed };
};
/* 分镜序列：shots=[{t 起始, xf 与上一镜交叉溶化秒数(缺省 .8), draw(c, t, lt 镜内秒, env)}]，按 t 升序。
   溶化期间上一镜继续画（lt 超出其时长），新镜画在离屏层上按透明度叠入。返回当前镜序号 */
I.shots = function (c, t, shots, env) {
  var i = 0;
  while (i + 1 < shots.length && t >= shots[i + 1].t) i++;
  var S = shots[i], xf = S.xf == null ? .8 : S.xf, k = xf > 0 ? U.smooth((t - S.t) / xf) : 1;
  if (i > 0 && k < 1) {
    var P = shots[i - 1];
    c.save(); P.draw(c, t, t - P.t, env); c.restore();
    var L = U.layerAcquire('xfade');
    try {
      L.setTransform(c.getTransform());
      L.save(); S.draw(L, t, t - S.t, env); L.restore();
      var ga = c.globalAlpha;
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = ga * k; c.drawImage(L.canvas, 0, 0); c.restore();
    } finally { U.layerRelease('xfade'); }
  } else { c.save(); S.draw(c, t, t - S.t, env); c.restore(); }
  return i;
};
/* 时间冻结（“画面骤停一拍”）：在 [a, a+len) 内返回 a，其后返回 t（不补偿，时间继续前进） */
I.freeze = function (t, a, len) { return t >= a && t < a + len ? a : t; };

/* ================= 歌（占位）：唱词逐字表与演唱段缺省，均为空 =================
   SONG_KEYS: { key: '一句唱词' }；SONG_PUNCT: { key: '句末标点' }；演唱段 CINE.SONG_CUES 由 audio.js 提供（[{id,act,t0,t1,seq:[key..]}]）。 */
CINE.SONG_KEYS = {};
CINE.SONG_PUNCT = {};
var CUES_DEFAULT = [];
CINE.songCue = function (id) {
  var L = (Array.isArray(CINE.SONG_CUES) && CINE.SONG_CUES) || [], i;
  for (i = 0; i < L.length; i++) if (L[i] && L[i].id === id) return L[i];
  for (i = 0; i < CUES_DEFAULT.length; i++) if (CUES_DEFAULT[i].id === id) return CUES_DEFAULT[i];
  return null;
};
var songMemo = {};
/* 演唱段逐字时间表（幕内相对秒）：[{ch, p 句末标点, t, d, key, li 第几句, i 句内字序}]。
   优先 CINE.THEME.segChars（与音频同源）；其次 THEME.chars/dur 按同一规则（段内等比伸缩、各句首尾相接）；
   都缺失时段内均分。永不抛错。 */
CINE.songChars = function (id) {
  if (songMemo[id]) return songMemo[id];
  var cue = CINE.songCue(id), out = [];
  if (!cue) return out;
  var TH = CINE.THEME;
  try {
    if (TH && typeof TH.segChars === 'function') out = TH.segChars(id) || [];
    if (!out.length && TH && typeof TH.chars === 'function' && typeof TH.dur === 'function') {
      var tot = 0; cue.seq.forEach(function (k) { tot += +TH.dur(k) || 0; });
      if (tot > 0) {
        var sc = (cue.t1 - cue.t0) / tot, acc = 0;
        cue.seq.forEach(function (key, li) {
          (TH.chars(key) || []).forEach(function (x) { out.push({ ch: x.ch, t: cue.t0 + (acc + x.t) * sc, d: x.d * sc, key: key, li: li }); });
          acc += +TH.dur(key) || 0;
        });
      }
    }
  } catch (e) { out = []; }
  var ok = out.length > 0;
  if (ok) {   // 校验逐字与本文件一致，不一致则回退
    var k0 = 0;
    cue.seq.forEach(function (key) { var s = CINE.SONG_KEYS[key]; for (var j = 0; j < s.length; j++) { if (!out[k0] || out[k0].ch !== s[j]) ok = false; k0++; } });
    if (k0 !== out.length) ok = false;
  }
  if (!ok) {
    out = [];
    var n = 0; cue.seq.forEach(function (k) { n += CINE.SONG_KEYS[k].length; });
    var d = (cue.t1 - cue.t0) / n, m = 0;
    cue.seq.forEach(function (key, li) { var s = CINE.SONG_KEYS[key]; for (var j = 0; j < s.length; j++) out.push({ ch: s[j], t: cue.t0 + (m++) * d, d: d, key: key, li: li }); });
  }
  var li0 = -1, ii = 0;
  out.forEach(function (o) {
    if (o.li !== li0) { li0 = o.li; ii = 0; }
    o.i = ii++;
    var s = CINE.SONG_KEYS[o.key];
    o.p = o.i === s.length - 1 ? CINE.SONG_PUNCT[o.key] : '';
  });
  songMemo[id] = out;
  return out;
};
/* 某段第 li 句：{text 含句末标点, times 每字时刻(标点随前字), t0, t1} */
CINE.songLine = function (id, li) {
  var cs = CINE.songChars(id).filter(function (o) { return o.li === li; }), txt = '', times = [];
  cs.forEach(function (o) { txt += o.ch; times.push(o.t); if (o.p) { txt += o.p; times.push(o.t); } });
  return { text: txt, times: times, t0: cs.length ? cs[0].t : 0, t1: cs.length ? cs[cs.length - 1].t + cs[cs.length - 1].d : 0 };
};
/* 竖排唱出一段：lines 为每句的布局 [{x,y,size,rgb,a,glow,shake,font}]（缺省自右向左排列）；o 为公共样式（同 vtext）。返回每句的字位置 */
I.sing = function (c, id, t, lines, o) {
  o = o || {};
  var cue = CINE.songCue(id), res = [];
  if (!cue) return res;
  cue.seq.forEach(function (key, li) {
    var L = CINE.songLine(id, li), lay = (lines && lines[li]) || {}, oo = {}, k;
    for (k in o) oo[k] = o[k];
    for (k in lay) oo[k] = lay[k];
    oo.times = L.times; oo.t = t;
    var x = lay.x == null ? (o.x == null ? W * .8 : o.x) - li * (o.dx == null ? 90 : o.dx) : lay.x, y = lay.y == null ? (o.y == null ? H * .14 : o.y) : lay.y;
    res.push(I.vtext(c, L.text, x, y, oo));
  });
  return res;
};

/* ================= 特写：手、眼、特写框 ================= */
I.SKIN = [200, 186, 164];
/* 写意手（白描 + 淡墨）：纸色留白打底，手指、掌缘用有粗细顿挫的线勾出（关节处一顿、指尖收笔），阴面一抹淡墨；不平涂肤色。
   宽袖口为几笔大写意湿墨（侧锋铺毫、收笔飞白）。(x,y) 手腕，s 手长，局部 +x 指向指尖。
   o: pose 'press'按|'open'张|'reach'伸|'fist'拳|'point'指 , curl 覆盖弯曲 0..1.6, rot, flip(镜像), tremble 颤 0..1, t,
      a, rgb 勾线墨, skin 留白底色（缺省纸色）, sleeve 袖口墨色 rgb（给出则画宽袖口）, sleeveA, seed */
I.hand = function (c, x, y, s, o) {
  o = o || {};
  var pose = o.pose || 'open', t = o.t || 0, A = o.a == null ? 1 : o.a, rgb = o.rgb || CINE.C.inkRGB, skin = o.skin || [238, 230, 212];
  if (A <= 0.003) return;
  var base = { press: .95, open: .2, reach: .12, fist: 1.55, point: 1.4 }[pose];
  var curl = o.curl == null ? (base == null ? .3 : base) : o.curl, tr = (o.tremble || 0) * .06;
  c.save(); c.translate(x, y); c.rotate(o.rot || 0); c.scale(s * (o.flip ? -1 : 1), s);
  c.lineCap = 'round'; c.lineJoin = 'round';
  var reserve = U.rgba(U.mix(skin, [150, 144, 134], .2), .93 * A), LW = .02;   // 留白近乎不透明：后指的线不透到前指上
  var joint = function (q) { return .62 + .38 * Math.max(Math.exp(-Math.pow((q - .02) / .06, 2)), Math.exp(-Math.pow((q - .36) / .05, 2)), Math.exp(-Math.pow((q - .68) / .05, 2))); };
  var fingerPts = function (bx, by, ang, lens, cu, sd) {
    var pts = [[bx, by]], a = ang, px = bx, py = by;
    for (var j = 0; j < lens.length; j++) {
      a += cu * (j === 0 ? .55 : .75) + tr * Math.sin(t * 13 + sd + j);
      px += Math.cos(a) * lens[j]; py += Math.sin(a) * lens[j]; pts.push([px, py]);
    }
    return pts;
  };
  var fingerDraw = function (pts, w, sd) {
    var cp = I.spline(pts, 6), nm = normals(cp), n = cp.length, up = [], lo = [];
    for (var i = 0; i < n; i++) {
      var q = i / (n - 1), half = w * .5 * (1 - .22 * q) * (q > .82 ? .45 + .55 * Math.sqrt(Math.max(0, (1 - q) / .18)) : 1);
      up.push([cp[i][0] + nm[i][0] * half, cp[i][1] + nm[i][1] * half]); lo.push([cp[i][0] - nm[i][0] * half, cp[i][1] - nm[i][1] * half]);
    }
    c.fillStyle = reserve; c.beginPath(); c.moveTo(up[0][0], up[0][1]);
    for (i = 1; i < n; i++) c.lineTo(up[i][0], up[i][1]);
    for (i = n - 1; i >= 0; i--) c.lineTo(lo[i][0], lo[i][1]);
    c.closePath(); c.fill();
    I.stroke(c, lo, { raw: true, w: w * .5, a: .26 * A, rgb: rgb, head: .1, tail: .3, n: n, seed: sd + 4, bleed: 0, fade: .4, wob: .1 });          // 阴面淡墨
    I.stroke(c, up, { raw: true, w: LW, a: .92 * A, rgb: rgb, wf: joint, n: n, seed: sd, wob: .12, bleed: .15 });                                  // 背缘：顿挫
    I.stroke(c, lo.slice(0, Math.round(n * .92)), { raw: true, w: LW * .7, a: .72 * A, rgb: rgb, wf: joint, n: n, seed: sd + 1, wob: .12, bleed: 0 });  // 腹缘：轻
    var tp = [up[n - 3], cp[n - 1], lo[n - 3]];
    I.stroke(c, tp, { w: LW * .8, a: .85 * A, rgb: rgb, head: .2, tail: .4, n: 10, seed: sd + 2, bleed: 0 });                                      // 指尖收笔
    return cp;
  };
  // 手掌：留白 + 阴面淡墨 + 掌背一笔重、掌缘一笔轻
  c.fillStyle = reserve;
  c.beginPath(); c.moveTo(-.02, -.11); c.quadraticCurveTo(.28, -.16, .5, -.12); c.lineTo(.54, .09); c.quadraticCurveTo(.3, .19, .02, .13); c.closePath(); c.fill();
  I.wash(c, .3, .1, .26, .1, .2 * A, 4, rgb, 0, { edge: 'soft' });
  I.wash(c, .22, -.06, .22, .07, .18 * A, 6, skin, 0, { edge: 'soft' });
  I.stroke(c, [[-.04, -.1], [.12, -.15], [.3, -.16], [.52, -.12]], { w: LW * 1.5, a: .95 * A, rgb: rgb, head: .08, tail: .3, n: 18, seed: 3, wob: .2, press: function (q) { return .7 + .5 * Math.exp(-Math.pow((q - .1) / .1, 2)); } });
  I.stroke(c, [[.02, .13], [.18, .175], [.34, .17]], { w: LW, a: .72 * A, rgb: rgb, head: .1, tail: .5, n: 12, seed: 5, bleed: 0 });
  // 四指（自后向前：小指 → 食指）
  var cu = [curl * 1.05, curl, curl * .95, pose === 'point' ? .05 : curl * .9];
  var spread = pose === 'open' ? .12 : pose === 'reach' ? .06 : .02;
  var tips = [];
  for (var f = 0; f < 4; f++) {
    var by = .07 - f * .06, L = [[.17, .12, .1], [.2, .14, .11], [.21, .15, .11], [.19, .13, .1]][f];
    tips.push(fingerDraw(fingerPts(.5 + f * .012, by, (1.5 - f) * spread, L.map(function (v) { return v * .9; }), cu[f], 10 + f * 3), .094 - (3 - f) * .005, 10 + f * 3));
  }
  // 拇指
  var tc = pose === 'fist' ? 1.1 : pose === 'press' ? .5 : .25;
  fingerDraw(fingerPts(.16, .1, pose === 'press' ? .38 : .75, pose === 'press' ? [.15, .11] : [.17, .14], tc * .8, 30), .1, 30);
  // 指节：两三点短笔
  tips.forEach(function (p, k) {
    var q = p[Math.round(p.length * .36)];
    if (q && k % 2 === 0) I.stroke(c, [[q[0] - .014, q[1] - .016], [q[0] + .004, q[1] - .002], [q[0] + .002, q[1] + .014]], { w: LW * .55, a: .45 * A, rgb: rgb, head: .2, tail: .5, n: 6, seed: 60 + k, bleed: 0 });
  });
  // 宽袖口：大写意湿墨几笔
  if (o.sleeve) {
    var sa = (o.sleeveA == null ? .9 : o.sleeveA) * A, fl = Math.sin(t * 2.2 + (o.seed || 1)) * .03, sr = o.sleeve, sd0 = (o.seed || 1) * 7;
    c.fillStyle = U.rgba(sr, sa * .38);
    c.beginPath(); c.moveTo(-1.7, -.34); c.quadraticCurveTo(-.7, -.3, -.04, -.17 + fl * .5);
    c.bezierCurveTo(.08, .0, .06, .25, -.02, .38 + fl);
    c.bezierCurveTo(-.2, .95 + fl, -.7, 1.25 + fl, -1.05, 1.1 + fl); c.quadraticCurveTo(-1.4, .95, -1.7, .7); c.closePath(); c.fill();
    I.wash(c, -.8, .5, .6, .45, .42 * sa, sd0 + 1, sr, .3, { edge: 'soft' });
    I.wash(c, -.45, .2, .3, .25, .14 * sa, sd0 + 2, CINE.C.paperRGB);
    I.sweep(c, [[-1.75, -.2], [-1.0, -.22], [-.45, -.2], [-.06, -.1 + fl * .5]], { w: .3, a: .92 * sa, rgb: sr, seed: sd0 + 3, dry: .25, fb: 0, head: .02, tail: .1 });
    I.sweep(c, [[-.05, -.16 + fl * .5], [.07, .06], [.03, .26], [-.05, .4 + fl]], { w: .075, a: .8 * sa, rgb: sr, seed: sd0 + 4, dry: .3, tail: .3 });
    I.sweep(c, [[-.06, .36 + fl], [-.3, .82 + fl], [-.65, 1.06 + fl], [-1.1, 1.1 + fl]], { w: .2, a: .8 * sa, rgb: sr, seed: sd0 + 5, dry: .55 });
    I.sweep(c, [[-.28, .06], [-.45, .45 + fl * .5], [-.72, .82 + fl]], { w: .09, a: .55 * sa, rgb: sr, seed: sd0 + 6, dry: .6 });
    I.stroke(c, [[-.3, .1], [-.5, .55 + fl], [-.75, .85 + fl]], { w: .05, a: .22 * sa, rgb: CINE.C.paperRGB, head: .2, tail: .6, n: 14, seed: 44 });
  }
  c.restore();
};
/* 逆光轮廓线（新增）：沿 pts 勾一道暖金；pts 顺时针走（行进方向右手为外），外法线朝光（lit，缺省自右略高）处粗亮、背光处收尽。
   先按弧长等距重采样再取亮度：笔触（I.stroke）按弧长走，亮度按点序取，两者须同一套等距点，否则点距不匀时亮段错位 */
I.rimLine = function (c, pts, w, a, seed, lit) {
  var L = lit || [.96, -.28], p = I.spline(pts, 6), n = p.length, k = [];
  if (a <= .003 || n < 2) return;
  p = I.resample(p, n);
  for (var i = 0; i < n; i++) {
    var p0 = p[Math.max(0, i - 1)], p1 = p[Math.min(n - 1, i + 1)], dx = p1[0] - p0[0], dy = p1[1] - p0[1], dl = Math.hypot(dx, dy) || 1;
    k.push(Math.max(0, (dy * L[0] - dx * L[1]) / dl));
  }
  var wf = function (s) { var q = k[Math.min(n - 1, Math.round(s * (n - 1)))]; return Math.pow(q, 1.6) * Math.min(1, s / .04 + .1) * Math.min(1, (1 - s) / .06 + .1); };
  I.stroke(c, p, { raw: true, n: n, w: w * 3.2, a: a * .3, rgb: CINE.C.goldRGB, wf: wf, mode: 'lighter', wob: .1, seed: seed || 1 });
  I.stroke(c, p, { raw: true, n: n, w: w, a: a, rgb: [255, 238, 196], wf: wf, wob: .2, seed: (seed || 1) + 1, bleed: 0, fade: 0 });
};
/* 主角之手（全片母题）：白描加淡墨，侧看小指一侧；指背一线在关节处一顿一折、关节褶两三笔；
   宽袖自腕往后垂坠，暖金逆光轮廓沿手背与袖上缘。(x,y) 腕，s 手长。
   o: th 手轴方向（腕→指尖，弧度，缺省 π 即指尖朝左）, curl 屈指 0..1.3（.9 按、.15 张、1.25 握）, knuckle 指节力度 0..1, flip 掌侧翻到另一边,
      a, t, sleeve 画宽袖（缺省 true）, sleeveRGB, rim 逆光强度（缺省 1，0 关）, lit 光向。返回 { tips: 四指尖世界坐标, wrist } */
var MH_FING = [[.455, -.062, .084, [.2, .12, .088], -.1], [.47, -.047, .09, [.22, .133, .094], -.04], [.46, -.031, .085, [.2, .124, .088], .02], [.44, -.013, .076, [.16, .1, .08], .08]];   // 食 中 无名 小：基点、粗、三节长、基角
var MH_PALM = [[-.02, -.078], [.12, -.096], [.28, -.1], [.4, -.096], [.47, -.088], [.5, -.05], [.49, .02], [.44, .045], [.3, .075], [.14, .086], [0, .078]];
function mhTip(F, cu) {
  var ang = F[4], p = [F[0], F[1]], b = [.42 * cu, .62 * cu, .36 * cu];
  for (var j = 0; j < 3; j++) { ang += b[j]; p = [p[0] + Math.cos(ang) * F[3][j], p[1] + Math.sin(ang) * F[3][j]]; }
  return p;
}
function mhPath(c, pts) {
  var n = pts.length, m = function (a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }, s0 = m(pts[n - 1], pts[0]);
  c.beginPath(); c.moveTo(s0[0], s0[1]);
  for (var i = 0; i < n; i++) { var q = m(pts[i], pts[(i + 1) % n]); c.quadraticCurveTo(pts[i][0], pts[i][1], q[0], q[1]); }
  c.closePath();
}
/* 求腕位：使中指指尖落在 (tx,ty)（贴实接触点用）。o 同 masterHand（th, curl, flip） */
I.masterHandAnchor = function (tx, ty, s, o) {
  o = o || {};
  var th = o.th == null ? Math.PI : o.th, fs = o.flip ? -1 : 1, tp = mhTip(MH_FING[1], o.curl == null ? .9 : o.curl), dx = Math.cos(th), dy = Math.sin(th);
  return [tx - s * (tp[0] * dx + tp[1] * fs * dy), ty - s * (tp[0] * dy - tp[1] * fs * dx)];
};
I.masterHand = function (c, x, y, s, o) {
  o = o || {};
  var th = o.th == null ? Math.PI : o.th, cu = o.curl == null ? .9 : o.curl, kn = o.knuckle == null ? .8 : o.knuckle, a = o.a == null ? 1 : o.a, fs = o.flip ? -1 : 1;
  if (a <= .003) return null;
  var dx = Math.cos(th), dy = Math.sin(th), nx = dy * fs, ny = -dx * fs;
  var Wp = function (q) { return [x + s * (q[0] * dx + q[1] * nx), y + s * (q[0] * dy + q[1] * ny)]; };
  var SK = U.rgba([230, 220, 200], .97 * a), LN = [30, 26, 24], SH = [120, 110, 100], SL = o.sleeveRGB || [20, 20, 27], K = [6, 6, 10], rim = (o.rim == null ? 1 : o.rim) * a, lit = o.lit;
  var poly = function (pts) { c.beginPath(); pts.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.closePath(); };
  if (o.sleeve !== false) {                                  // 宽袖：袖口浓、往后化淡
    var sl = [[.04, -.19], [-.35, -.25], [-.9, -.24], [-1.5, -.12], [-1.75, .45], [-1.35, 1.1], [-.75, 1.2], [-.3, .9], [-.06, .45], [.05, .24]].map(Wp);
    var g = c.createLinearGradient(Wp([0, 0])[0], Wp([0, 0])[1], Wp([-1.6, .4])[0], Wp([-1.6, .4])[1]);
    g.addColorStop(0, U.rgba(SL, .82 * a)); g.addColorStop(.35, U.rgba(SL, .55 * a)); g.addColorStop(.75, U.rgba(SL, .16 * a)); g.addColorStop(1, U.rgba(SL, 0));
    c.fillStyle = g; mhPath(c, sl); c.fill();
    I.wash(c, Wp([-.35, .45])[0], Wp([-.35, .45])[1], s * .42, s * .4, .3 * a, 7, SL, th, { edge: 'soft' });
    I.wash(c, Wp([-.7, .05])[0], Wp([-.7, .05])[1], s * .35, s * .18, .12 * a, 5, CINE.C.paperRGB, th, { edge: 'soft' });
    I.sweep(c, [[.04, -.19], [-.35, -.25], [-.8, -.25], [-1.2, -.18]].map(Wp), { w: s * .05, a: .6 * a, rgb: SL, seed: 91, dry: .5, fb: .45, bleed: .05, n: 30 });
    I.sweep(c, [[.05, .24], [-.08, .5], [-.3, .85], [-.7, 1.15]].map(Wp), { w: s * .05, a: .55 * a, rgb: SL, seed: 92, dry: .5, fb: .4, bleed: .05, n: 24 });
    I.stroke(c, [[-.25, -.1], [-.6, .2], [-.8, .6]].map(Wp), { w: s * .02, a: .35 * a, rgb: K, head: .2, tail: .6, n: 16, seed: 94, bleed: 0 });
  }
  var finger = function (F, k) {
    var ang = F[4], L = F[3], bends = [.42 * cu, .62 * cu, .36 * cu], ctr = [[F[0], F[1]]], cum = [0], j, i;
    for (j = 0; j < 3; j++) { ang += bends[j]; var p = ctr[j]; ctr.push([p[0] + Math.cos(ang) * L[j], p[1] + Math.sin(ang) * L[j]]); cum.push(cum[j] + L[j]); }
    var P = I.resample(ctr, 36), nm = normals(P), n = P.length, tot = cum[3], top = [], bot = [];
    for (i = 0; i < n; i++) {
      var sL = i / (n - 1) * tot, hw = F[2] * .5 * (1 - .22 * sL / tot), bump = .011 * (.6 + .6 * kn) * Math.exp(-Math.pow((sL - cum[1]) / .025, 2)) + .006 * (.6 + .6 * kn) * Math.exp(-Math.pow((sL - cum[2]) / .02, 2));
      if (sL > tot - F[2] * .5) hw *= Math.sqrt(Math.max(.05, (tot - sL) / (F[2] * .5)));
      top.push(Wp([P[i][0] - nm[i][0] * (hw + bump), P[i][1] - nm[i][1] * (hw + bump)]));
      bot.push(Wp([P[i][0] + nm[i][0] * hw * .95, P[i][1] + nm[i][1] * hw * .95]));
    }
    c.fillStyle = SK; poly(top.concat(bot.slice().reverse())); c.fill();
    I.stroke(c, bot, { raw: true, n: n, w: F[2] * s * .5, a: .24 * a, rgb: SH, head: .1, tail: .2, bleed: 0, fade: 0, wob: .1, seed: 70 + k });
    var jw = function (q) {
      var sq = q * tot, v = .5 + .75 * (.5 + .5 * kn) * Math.max(Math.exp(-Math.pow((sq - cum[1]) / .03, 2)), .7 * Math.exp(-Math.pow((sq - cum[2]) / .025, 2)));
      return v * Math.min(1, q / .05 + .3) * Math.min(1, (1 - q) / .06 + .2);
    };
    I.stroke(c, top, { raw: true, n: n, w: s * .014, a: .92 * a, rgb: LN, wf: jw, wob: .12, seed: 60 + k, bleed: .1 });                  // 指背：关节一顿
    I.stroke(c, bot.slice(Math.round(n * .12)), { raw: true, n: n, w: s * .008, a: .6 * a, rgb: LN, head: .2, tail: .2, wob: .12, seed: 64 + k, bleed: 0 });
    I.stroke(c, [top[n - 4], Wp(P[n - 1]), bot[n - 4]], { w: s * .009, a: .8 * a, rgb: LN, head: .2, tail: .3, n: 10, seed: 66 + k, bleed: 0 });
    [1, 2].forEach(function (jn) {                            // 关节褶
      var i0 = Math.round(cum[jn] / tot * (n - 1)), q0 = P[i0], nn = nm[i0], tg = [-nn[1], nn[0]], hw2 = F[2] * .5;
      for (var m = 0; m < (jn === 1 ? 2 : 1); m++) {
        var of = (m - .5) * .014 * (jn === 1 ? 1 : 0);
        I.stroke(c, [Wp([q0[0] - nn[0] * hw2 * .98 + tg[0] * of, q0[1] - nn[1] * hw2 * .98 + tg[1] * of]), Wp([q0[0] - nn[0] * hw2 * .25 + tg[0] * (of - .008), q0[1] - nn[1] * hw2 * .25 + tg[1] * (of - .008)])],
          { raw: true, w: s * .006, a: (.3 + .4 * kn) * a, rgb: LN, head: .2, tail: .5, n: 6, seed: 80 + k * 5 + jn + m, bleed: 0, wob: .1 });
      }
    });
    return { top: top, tip: Wp(P[n - 1]) };
  };
  var fg = [], f;
  for (f = 0; f < 3; f++) fg.push(finger(MH_FING[f], f));
  c.fillStyle = SK; mhPath(c, MH_PALM.map(Wp)); c.fill();   // 掌：留白 + 腹侧淡墨 + 掌背一线（掌指关节处一顿）
  I.wash(c, Wp([.26, .05])[0], Wp([.26, .05])[1], s * .22, s * .05, .22 * a, 4, SH, th, { edge: 'soft' });
  I.stroke(c, [[-.03, -.078], [.14, -.098], [.3, -.101], [.43, -.098], [.47, -.09]].map(Wp), { w: s * .016, a: .95 * a, rgb: LN, wob: .15, seed: 72, bleed: .1,
    wf: function (q) { return (.55 + .7 * (.5 + .5 * kn) * Math.exp(-Math.pow((q - .92) / .07, 2))) * Math.min(1, q / .05 + .3); } });
  I.stroke(c, [[0, .078], [.14, .088], [.3, .078], [.43, .05]].map(Wp), { w: s * .009, a: .55 * a, rgb: LN, head: .2, tail: .4, n: 16, seed: 73, bleed: 0 });
  I.stroke(c, [[.08, -.05], [.24, -.058], [.4, -.056]].map(Wp), { w: s * .005, a: .28 * a, rgb: LN, head: .3, tail: .5, n: 12, seed: 74, bleed: 0 });   // 掌背筋
  fg.push(finger(MH_FING[3], 3));
  if (o.sleeve !== false) I.stroke(c, [[.03, -.22], [.08, -.08], [.08, .1], [.03, .27]].map(Wp), { w: s * .032, a: .85 * a, rgb: K, head: .15, tail: .4, n: 18, seed: 93, bleed: .15 });   // 袖口
  if (rim > .003) {                                          // 暖金逆光：袖上缘、手背与食指背
    var ord = function (pts) { return fs > 0 ? pts : pts.slice().reverse(); };
    if (o.sleeve !== false) I.rimLine(c, ord([[.03, -.2], [-.3, -.25], [-.65, -.26]].map(Wp)), s * .009, .55 * rim, 95, lit);
    I.rimLine(c, ord(fg[0].top.slice().reverse().concat([[.47, -.09], [.3, -.101], [.14, -.098]].map(Wp))), s * .008, .55 * rim, 97, lit);
  }
  return { tips: fg.map(function (q) { return q.tip; }), wrist: [x, y] };
};
/* 眼（特写，白描 + 淡墨）：眼窝一抹淡墨；眼白是纸色留白、上睑投影与眼角用淡墨烘出，不平涂；瞳仁一圈中锋、瞳孔一点湿墨；
   上睑一笔粗细顿挫（外眼角重、收笔带飞白），睑褶一丝，下睑断续两笔；眉是枯笔扫出。(x,y) 眼心，s 眼宽。
   o: open 0..1, iris 'cold'幽冷|'ice'冰封|'gold'金|'ink'|'blood'|'glass'无色琉璃, look [dx,dy] -1..1, frost 结霜 0..1, brow 眉 0..1(默认 1), t, a, flip */
I.eye = function (c, x, y, s, o) {
  o = o || {};
  var A = o.a == null ? 1 : o.a, op = o.open == null ? 1 : o.open, lk = o.look || [0, 0], kind = o.iris || 'cold', C = CINE.C, INK = C.inkRGB;
  if (A <= 0.003) return;
  c.save(); c.translate(x, y); c.scale(s * (o.flip ? -1 : 1), s); c.lineCap = 'round';
  I.wash(c, 0, -.05, .8, .48, .26 * A, 6, INK, 0, { edge: 'soft' });
  I.wash(c, -.05, -.2, .55, .2, .2 * A, 9, INK, 0, { edge: 'soft' });
  var up = -.2 * op - .01, lo = .12 * op + .03;
  var lid = function () { c.beginPath(); c.moveTo(-.5, .02); c.bezierCurveTo(-.25, up * 1.25, .2, up * 1.2, .5, -.03); c.bezierCurveTo(.25, lo, -.2, lo * 1.1, -.5, .02); c.closePath(); };
  if (op > .02) {
    c.save(); lid(); c.clip();
    c.fillStyle = U.rgba(kind === 'ice' ? [222, 234, 232] : U.mix(C.paperRGB, [150, 144, 134], .12), .95 * A); c.fillRect(-.6, -.4, 1.2, .8);
    I.wash(c, 0, up * 1.1, .6, .12, .34 * A, 3, INK, 0, { edge: 'soft' });                       // 上睑投下的影
    I.wash(c, -.46, .0, .14, .12, .22 * A, 4, INK, 0, { edge: 'soft' });                          // 内外眼角
    I.wash(c, .46, -.02, .14, .12, .26 * A, 5, INK, 0, { edge: 'soft' });
    var ix = lk[0] * .16, iy = lk[1] * .05 - .02, R = .2;
    var col = { cold: [34, 36, 44], ice: C.qingHiRGB, gold: C.goldRGB, ink: INK, blood: C.bloodRGB, glass: [206, 214, 214] }[kind] || INK;
    var g = c.createRadialGradient(ix, iy, 0, ix, iy, R);
    g.addColorStop(0, U.rgba(kind === 'gold' ? C.goldHiRGB : kind === 'ice' ? C.whiteRGB : col, .95 * A)); g.addColorStop(.7, U.rgba(col, .88 * A)); g.addColorStop(1, U.rgba(U.mix(col, INK, .5), .9 * A));
    c.fillStyle = g; c.beginPath(); c.arc(ix, iy, R, 0, 7); c.fill();
    var rs = U.rng(13); c.strokeStyle = U.rgba(U.mix(col, INK, .55), .35 * A); c.lineWidth = .006;       // 瞳仁丝理
    for (var q = 0; q < 22; q++) { var an0 = q / 22 * 6.283 + rs.pm(.1), r0 = R * (.48 + rs() * .1); c.beginPath(); c.moveTo(ix + Math.cos(an0) * r0, iy + Math.sin(an0) * r0); c.lineTo(ix + Math.cos(an0) * R * .93, iy + Math.sin(an0) * R * .93); c.stroke(); }
    var ring = []; for (q = 0; q <= 26; q++) { var ra = -.6 + q / 26 * 5.3; ring.push([ix + Math.cos(ra) * R, iy + Math.sin(ra) * R]); }
    I.stroke(c, ring, { raw: true, w: .032, a: (kind === 'glass' ? .4 : .8) * A, rgb: INK, head: .1, tail: .2, n: 27, seed: 17, wob: .25, fade: .2, bleed: 0 });
    if (kind !== 'glass') {
      if (kind === 'ice') { c.fillStyle = U.rgba([200, 236, 232], .6 * A); c.beginPath(); c.arc(ix, iy, R * .42, 0, 7); c.fill(); }
      else I.inkBlot(c, ix, iy, R * .4, 19, { a: .95 * A, rgb: INK, rough: .12, core: .5 });
    }
    if (kind === 'ice' || o.frost) {
      c.strokeStyle = U.rgba(C.whiteRGB, .8 * A); c.lineWidth = .008;
      for (q = 0; q < 12; q++) { var an = q / 12 * 6.283 + .2; c.beginPath(); c.moveTo(ix + Math.cos(an) * R * .45, iy + Math.sin(an) * R * .45); c.lineTo(ix + Math.cos(an) * R * .98, iy + Math.sin(an) * R * .98); c.stroke(); }
    }
    c.fillStyle = U.rgba(C.whiteRGB, .9 * A); c.beginPath(); c.arc(ix + R * .35, iy - R * .35, R * .12, 0, 7); c.fill();
    c.restore();
  }
  I.stroke(c, [[-.52, .03], [-.25, up * 1.05 - .01], [.2, up * 1.0 - .01], [.52, -.02], [.6, -.07]], { w: .07, a: .95 * A, rgb: INK, n: 30, seed: 7, wob: .3, fb: .1,
    wf: function (q) { return Math.min(1, q / .12 + .25) * (.55 + .6 * q) * Math.min(1, (1 - q) / .1 + .1); } });
  I.stroke(c, [[-.36, up * 1.35 - .04], [.05, up * 1.5 - .05], [.42, up * 1.2 - .05]], { w: .018, a: .5 * A, rgb: INK, head: .2, tail: .6, n: 16, seed: 8, bleed: 0 });
  I.stroke(c, [[-.46, .05], [-.2, lo * .9 + .01]], { w: .026, a: .5 * A, rgb: INK, head: .2, tail: .5, n: 10, seed: 9, bleed: 0 });
  I.stroke(c, [[-.08, lo + .012], [.22, lo * .8 + .01], [.46, .0]], { w: .026, a: .45 * A, rgb: INK, head: .2, tail: .5, n: 12, seed: 10, bleed: 0, fb: .3 });
  if (o.brow !== 0) I.sweep(c, [[-.6, -.36 + (1 - op) * .06], [-.1, -.5], [.58, -.44]], { w: .12 * (o.brow || 1), a: .9 * A, rgb: INK, dry: .3, fb: .16, head: .12, tail: .5, n: 20, seed: 11 });
  if (o.frost) {
    var r = U.rng(5);
    for (var k = 0; k < 26 * o.frost; k++) {
      var fx = r.pm(.62), fy = (r() < .5 ? up * 1.3 - .06 : lo + .06) + r.pm(.08), fa = r() * 3;
      I.stroke(c, [[fx, fy], [fx + Math.cos(fa) * .07, fy + Math.sin(fa) * .07]], { raw: true, w: .014, a: .75 * A * o.frost, rgb: C.whiteRGB, head: .2, tail: .5, n: 6, wob: 0 });
    }
  }
  c.restore();
};
/* 局部特写框：椭圆“窗”里画 draw(ctx)（窗外保留原画面，或以 bg 遮住窗外），窗缘一圈枯笔。k 0..1 开合（含淡入）。
   o: x,y 窗心, rx, ry, bg 'paper'|rgb 数组|null, ring 窗缘墨浓(.55), seed。遮罩与窗缘共用同一条（周期噪声）轮廓；与外层 alpha 相乘；离屏层可重入 */
I.closeup = function (c, k, o, draw) {
  if (k <= 0.003) return;
  var ek = U.easeOut(k), x = o.x == null ? W / 2 : o.x, y = o.y == null ? H / 2 : o.y, rx = o.rx * (.6 + .4 * ek), ry = (o.ry || o.rx) * (.6 + .4 * ek), sd = o.seed || 7;
  var N = Math.max(96, Math.min(360, Math.round((rx + ry) / 4))), ga = c.globalAlpha;
  var P = function (a) {
    var ca = Math.cos(a), sa = Math.sin(a), r = 1 + .055 * U.noise2(ca * 1.4 + 3, sa * 1.4 + 3, sd) + .018 * U.noise2(ca * 4 + 7, sa * 4 + 7, sd + 1);
    return [x + ca * rx * r, y + sa * ry * r];
  };
  var path = function (ctx) { for (var i = 0; i < N; i++) { var q = P(i / N * 6.28319); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); } ctx.closePath(); };
  if (o.bg) {
    c.save(); I.screen(c); c.globalAlpha = ga * Math.min(1, k * 1.5);
    c.beginPath(); c.rect(-10, -10, W + 20, H + 20); path(c); c.clip('evenodd');
    if (o.bg === 'paper') I.paper(c); else { c.fillStyle = U.rgba(o.bg, 1); c.fillRect(0, 0, W, H); }
    c.restore();
  }
  var L = U.layerAcquire('closeup');
  try {
    L.save(); draw(L); L.restore();
    L.save(); I.screen(L); L.globalCompositeOperation = 'destination-in'; L.fillStyle = '#000'; L.beginPath(); path(L); L.fill(); L.restore();
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = ga * Math.min(1, k * 1.4); c.drawImage(L.canvas, 0, 0); c.restore();
  } finally { U.layerRelease('closeup'); }
  var pts = [], M = Math.round(N * .84);
  for (var i = 0; i <= M; i++) pts.push(P(i / N * 6.28319 - 1.2));
  c.save(); I.screen(c);
  I.dry(c, pts, { raw: true, w: 9, a: (o.ring == null ? .55 : o.ring) * Math.min(1, k * 1.4), dry: .55, seed: sd, n: Math.max(90, M) });
  c.restore();
};
/* ---------- 墨晕转场 I.inkBleed(c, k, o) ----------
   一团墨从 1–3 个点在宣纸上洇开：外缘是纸纤维般的毛边（墨顺纤维先走一步），浓墨芯后面拖一圈淡墨水晕与一线水渍；
   吃掉上一镜，再从另几处褪开、露出下一镜（余墨沿纤维最后褪尽）。
   k 0..1 是一次完整转场：0→.5 洇开（.5 满屏墨），.5→1 褪出。调用方按 k 画底：k<.5 画上一镜、k≥.5 画下一镜，再调本函数叠墨；
   只要“洇满”传 .5*e，只要“褪出”传 .5+.5*e（e 0..1）。k≤0 或 ≥1 什么也不画。
   o: seed 形状种子（同 seed 同形，可寻址）| pts [[x,y],…] 洇开起点（逻辑坐标；缺省由 seed 取 2–3 点）| pts2 褪开起点（同上）
      mode 'ink' 墨晕（缺省）| 'wash' 水洗：淡墨化开、里面露出白纸，用于转入全白留白段 | a 满墨浓度（.97）| rgb 墨色
   实现：到达场按 seed/pts 建一次、缓存（480×270：距离 + 软斑域扭曲 + 纸纤维纹，纹理用画布画出再读回）；
   每帧只做一遍阈值写 ImageData（约 13 万像素），平滑放大叠上。不用 ctx.filter，不用 Math.random。 */
var BL_W = 480, BL_H = 270, BL_S = W / BL_W, bleedCache = new Map(), bleedCv = null, bleedImg = null, bleedFibers = null;
function bleedRead(x) {
  var d = x.getImageData(0, 0, BL_W, BL_H).data, n = BL_W * BL_H, o = new Float32Array(n);
  for (var i = 0; i < n; i++) o[i] = d[i * 4] / 255;
  return o;
}
function bleedTex(seed, n, r0, r1) {                     // 多尺度软斑 → 0..1（均值约 .5）
  var x = U.canvas(BL_W, BL_H).getContext('2d', { willReadFrequently: true }), r = U.rng(seed);
  x.fillStyle = 'rgb(128,128,128)'; x.fillRect(0, 0, BL_W, BL_H);
  for (var i = 0; i < n; i++) {
    var cx = r() * BL_W, cy = r() * BL_H, rr = r0 + (r1 - r0) * Math.pow(r(), 1.6), v = r() < .5 ? '0,0,0' : '255,255,255';
    var g = x.createRadialGradient(cx, cy, 0, cx, cy, rr);
    g.addColorStop(0, 'rgba(' + v + ',.34)'); g.addColorStop(1, 'rgba(' + v + ',0)');
    x.fillStyle = g; x.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
  }
  return bleedRead(x);
}
function bleedFib() {                                    // 纸纤维（全片同一张纸）：短绒为主、偶有长丝
  if (bleedFibers) return bleedFibers;
  var x = U.canvas(BL_W, BL_H).getContext('2d', { willReadFrequently: true }), r = U.rng(577);
  x.fillStyle = '#000'; x.fillRect(0, 0, BL_W, BL_H); x.lineCap = 'round';
  for (var i = 0; i < 1600; i++) {
    var fx = r() * BL_W, fy = r() * BL_H, lg = r() < .1, L = lg ? 14 + r() * 26 : 3 + r() * 10, a = r() * Math.PI * 2, b = a + r.pm(.8);
    x.strokeStyle = 'rgba(255,255,255,' + (.35 + r() * .65) + ')'; x.lineWidth = .5 + r() * .7;
    x.beginPath(); x.moveTo(fx, fy);
    x.quadraticCurveTo(fx + Math.cos(a) * L * .5, fy + Math.sin(a) * L * .5, fx + Math.cos(b) * L, fy + Math.sin(b) * L); x.stroke();
  }
  return (bleedFibers = bleedRead(x));
}
function bleedPts(r, n) {
  var p = [];
  for (var i = 0; i < n; i++) p.push([W * (.12 + .76 * r()), H * (.16 + .68 * r())]);
  return p;
}
function bleedField(seed, pts, pts2) {
  var key = seed + '|' + JSON.stringify(pts || 0) + '|' + JSON.stringify(pts2 || 0), e = bleedCache.get(key);
  if (e) return e;
  var r = U.rng(seed * 31 + 7), n = BL_W * BL_H;
  pts = pts || bleedPts(r, r() < .5 ? 2 : 3);
  pts2 = pts2 || bleedPts(r, r() < .5 ? 2 : 3);
  var wa = bleedTex(seed * 5 + 1, 260, 8, 80), wb = bleedTex(seed * 5 + 2, 260, 8, 80), fn = bleedTex(seed * 5 + 3, 520, 3, 22), fib = bleedFib();
  var mk = function (P, sgn) {                           // 到达场（逻辑 px）：各起点迟到/快慢不同，域扭曲出墨瓣，纤维处墨先到（洇）或后褪（褪）
    var S = P.map(function (p, i) { return [p[0], p[1], i ? 90 + 300 * r() : 0, .8 + .4 * r()]; });
    var f = new Float32Array(n), mx = 0;
    for (var j = 0; j < BL_H; j++) for (var i = 0; i < BL_W; i++) {
      var k = j * BL_W + i, x = (i + .5) * BL_S + (wa[k] - .5) * 300, y = (j + .5) * BL_S + (wb[k] - .5) * 300, m = 1e9;
      for (var q = 0; q < S.length; q++) { var dx = x - S[q][0], dy = y - S[q][1], v = S[q][2] + Math.sqrt(dx * dx + dy * dy) / S[q][3]; if (v < m) m = v; }
      m = Math.max(0, m + (fn[k] - .5) * 150 + sgn * fib[k] * 34);
      f[k] = m; if (m > mx) mx = m;
    }
    return { f: f, mx: mx };
  };
  var mo = bleedTex(seed * 5 + 4, 360, 4, 50);
  e = { a: mk(pts, -1), b: mk(pts2, 1), tone: new Float32Array(n), lag: new Float32Array(n) };
  for (var k = 0; k < n; k++) {                         // 墨色浓淡：软斑 + 纤维吸墨 + 先到处积墨更浓
    e.tone[k] = U.clamp(.93 + .36 * (mo[k] - .5) + .08 * fib[k], .72, 1) * (1 - .14 * e.a.f[k] / e.a.mx);
    e.lag[k] = 36 + 80 * fn[k];
  }
  bleedCache.set(key, e);
  if (bleedCache.size > 20) bleedCache.delete(bleedCache.keys().next().value);   // 上限 20 个到达场（0926 由 12 提到 20：各幕幕内墨晕换镜 + 幕间转场同时在用时不互相挤掉）
  return e;
}
I.inkBleed = function (c, k, o) {
  if (!(k > 0 && k < 1)) return;
  o = o || {};
  var F = bleedField(o.seed || 1, o.pts, o.pts2), wash = o.mode === 'wash', n = BL_W * BL_H, A = o.a == null ? .97 : o.a;
  if (!bleedCv) { bleedCv = U.canvas(BL_W, BL_H); bleedImg = bleedCv.getContext('2d').createImageData(BL_W, BL_H); }
  var d = bleedImg.data, eat = k < .5, e = eat ? k * 2 : k * 2 - 1, fld = eat ? F.a : F.b, f = fld.f, tone = F.tone, lag = F.lag;
  var body = wash ? CINE.C.paperRGB : (o.rgb || CINE.C.inkRGB), halo = wash ? [214, 205, 186] : body, rimC = wash ? [124, 114, 98] : body;
  var bA = wash ? 1 : A, hA = wash ? .55 : .36 * A, rA = wash ? .34 : .16 * A;
  var D = eat ? Math.pow(e, .85) * (fld.mx + 180) : (1 - (1 - e) * (1 - e)) * (fld.mx + 150), fade = eat ? 1 : 1 - .3 * e;
  var sat = .6 * (eat ? U.ramp(e, .7, 1) : 1 - U.ramp(e, 0, .35));   // 满墨前后墨色压实，上一镜不再透出
  var x0 = BL_W, x1 = -1, y0 = BL_H, y1 = -1;              // 有墨处的外接框：只放大这一块
  for (var i = 0; i < n; i++) {
    var u = D - f[i], T = wash ? 1 : tone[i] + (1 - tone[i]) * sat, aB, aH, aR, s1, s2;
    if (eat) {
      s1 = u <= 0 ? 0 : u >= 14 ? 1 : u / 14; s2 = u <= lag[i] ? 0 : u >= lag[i] + 50 ? 1 : (u - lag[i]) / 50;
      aH = s1 * hA * T; aB = s2 * bA * T; aR = u > 0 && u < 26 ? s1 * (1 - u / 26) * rA : 0;
    } else {
      s1 = u <= 0 ? 0 : u >= 14 ? 1 : u / 14; s2 = u <= 60 ? 0 : u >= 120 ? 1 : (u - 60) / 60;
      aB = (1 - s1) * bA * T * fade; aH = (s1 - s2) * hA * T * fade; aR = u > 0 && u < 26 ? s1 * (1 - u / 26) * rA * fade : 0;
    }
    var j = i * 4, a1 = aB + aH * (1 - aB), a2 = aR + a1 * (1 - aR);
    if (wash && a2 > .002) {                             // 水洗：淡墨晕、纸白、水渍线三色按 over 合成
      var w1 = aH * (1 - aB), w0 = aB;
      for (var ch = 0; ch < 3; ch++) d[j + ch] = ((body[ch] * w0 + halo[ch] * w1) * (1 - aR) + rimC[ch] * aR) / a2;
    } else { d[j] = body[0]; d[j + 1] = body[1]; d[j + 2] = body[2]; }
    d[j + 3] = a2 * 255;
    if (a2 > .004) { var px = i % BL_W, py = (i - px) / BL_W; if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py; }
  }
  if (x1 < 0) return;
  x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2); x1 = Math.min(BL_W, x1 + 3); y1 = Math.min(BL_H, y1 + 3);
  bleedCv.getContext('2d').putImageData(bleedImg, 0, 0);
  c.save(); I.screen(c); c.globalCompositeOperation = 'source-over';
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'low';   // 双线性放大（'high' 在软件光栅下贵 5 倍，画面差别看不出）
  c.drawImage(bleedCv, x0, y0, x1 - x0, y1 - y0, x0 * BL_S, y0 * BL_S, (x1 - x0) * BL_S, (y1 - y0) * BL_S);
  c.restore();
};

/* ================= 时间轴与播放核心 ================= */
var acts = [], beats = [], built = false, duration = 0, regCount = 0;
/* v5 全片时间映射（docs/revision-v5/TIMEMAP.json → js/timemap.js 生成 window.CINE_TIMEMAP）：cuts=[[a,b]…] 旧全片秒（v4 时间轴）里整段删去的区间，升序、互不相交。
   各幕代码与账本「幕内秒」仍按旧时间轴写；引擎把新全片秒 T 换回旧秒 MO(T) 再画，对外（时长、幕表、拍、cue、进度条）一律给新秒 MN(旧秒)。
   删段处是硬切：新秒恰在删点上取删段之后的那一帧（右连续）。无 TIMEMAP 时两者都是恒等，画面与 v4 逐像素一致。 */
var TMK = null, TMX = null;
function tmLoad() {
  if (TMK) return;
  var M = window.CINE_TIMEMAP || {};
  TMK = (M.knots || []).map(function (q) { return [+q[0], +q[1]]; });          // [[旧秒, 新秒]…] 两列都不减：新秒相同的相邻两点＝删段（硬切），旧秒相同的相邻两点＝定格（顿帧）
  TMX = (M.joins || []).map(function (q) { return { at: +q.at, a: +q.a, b: +q.b, xf: +q.xf || 0 }; }).filter(function (q) { return q.xf > 0; });   // 删段接缝的交叉溶化（新秒 at、删段旧秒 a–b、全长 xf）
}
function MN(x) {                                              // 旧全片秒 → 新全片秒
  tmLoad(); var K = TMK, n = K.length;
  if (!n || x <= K[0][0]) return n ? K[0][1] + x - K[0][0] : x;
  for (var i = 1; i < n; i++) if (x <= K[i][0]) return K[i - 1][1] + (x - K[i - 1][0]) * (K[i][1] - K[i - 1][1]) / (K[i][0] - K[i - 1][0]);
  return K[n - 1][1] + x - K[n - 1][0];
}
function MO(y) {                                              // 新全片秒 → 旧全片秒（删点取删段之后：右连续）
  tmLoad(); var K = TMK, n = K.length, i = -1;
  if (!n) return y;
  while (i + 1 < n && K[i + 1][1] <= y) i++;
  if (i < 0) return K[0][0] + y - K[0][1];
  if (i === n - 1) return K[i][0] + y - K[i][1];
  return K[i][0] + (y - K[i][1]) * (K[i + 1][0] - K[i][0]) / (K[i + 1][1] - K[i][1]);
}
CINE.timeNew = MN; CINE.timeOld = MO;
var beatDbg = false;   // ?beats=1（或 CINE.beatDebug(true)）：右上角显示当前拍号与拍内进度
var ORDER = {};   // 可选：{ 幕id: order }；缺省用 def.order，再缺省按注册顺序排在后面
/* 拍表帮助函数（T05）：list = [[拍号, 起秒, 止秒, label?], …] 或 [{id,t0,t1,label}] 或 [{id,t,dur,label}]。
   返回 {beats:[{id,t,dur,label}], cues:{拍号:{t,beat,label}}, duration}；拍号即 cue 名（引擎加幕前缀）。
   拍表应从 0 起、首尾相接；有缝时 console.warn（仍按累加起点导出，与引擎拍式幕的累加一致）。 */
CINE.beatSheet = function (list) {
  var bs = [], cues = {}, s = 0, prev = null;
  if (list && typeof list === 'object' && !Array.isArray(list)) {   // 也接 {拍号:[起,止,label]} / {拍号:{t0,t1}} 的映射写法
    var src = list;
    list = Object.keys(src).map(function (k) {
      var v = src[k];
      return Array.isArray(v) ? [k, v[0], v[1], v[2]] : { id: k, t0: v && v.t0, t1: v && v.t1, dur: v && v.dur, label: v && v.label };
    });
  }
  (list || []).forEach(function (q) {
    var id, a, b, label;
    if (Array.isArray(q)) { id = q[0]; a = +q[1]; b = +q[2]; label = q[3]; }
    else {
      id = q.id; label = q.label;
      a = q.t0 != null ? +q.t0 : +q.t;
      b = q.t1 != null ? +q.t1 : a + (+q.dur || 0);
    }
    if (!id || !isFinite(a) || !isFinite(b) || b <= a) {
      if (window.console) console.warn('[cine] beatSheet 跳过无效拍：' + id + '（' + a + '–' + b + '）');
      return;
    }
    if (prev == null && Math.abs(a) > .001 && window.console) console.warn('[cine] beatSheet 首拍从 ' + a + ' 起（应从 0）');
    if (prev != null && Math.abs(a - prev) > .001 && window.console) console.warn('[cine] beatSheet 拍表不连续：' + id + ' 从 ' + a + ' 起，上一拍止于 ' + prev);
    bs.push({ id: String(id), t: s, dur: b - a, label: label });
    prev = b; s += b - a;
  });
  bs.forEach(function (q) { cues[q.id] = { t: q.t, beat: q.id, label: q.label }; });
  return { beats: bs, cues: cues, duration: s };
};
/* 拍 cue 约定（T05）：有 beats 的幕默认把每拍起点导出为 cue（cue 名＝拍号，引擎加幕前缀）。
   已手写的同名 cue（配乐锚点）不覆盖；beatCues:false 关；cues 用数组写法时跳过（自己写）。 */
function beatCues(def) {
  if (!def.beats || !def.beats.length || def.beatCues === false) return;
  var c = def.cues;
  if (c == null) c = def.cues = {};
  if (Array.isArray(c)) return;
  def.beats.forEach(function (b) {
    if (c[b.id] == null) c[b.id] = { t: b.t, beat: b.id, label: b.label };
  });
}
/* 注册一幕：{id, name, duration, draw(ctx, t, env), card:['一','东来'], beats:[{id,t,label}], veilIn 秒, order} */
CINE.registerAct = function (def) {
  if (!def || !def.id) return;
  beatAct(def);
  def.dur0 = def.duration;                                   // v5：幕定义时长（旧轴）；build 后 def.duration 改为新轴时长
  beatCues(def);
  for (var i = 0; i < acts.length; i++) if (acts[i].id === def.id) { acts.splice(i, 1); break; }
  def.order = def.order != null ? def.order : ORDER[def.id] != null ? ORDER[def.id] : 10 + regCount;
  delete plateDecl[def.id];
  regCount++;
  acts.push(def);
  built = false;
};
/* BRIEF §12 拍式幕：beats 全部带 dur（拍长）时，拍起点 t 按顺序累加、幕长缺省 = 各拍之和；没给 draw 时引擎按拍分派：
   beat.draw(ctx, 拍内秒, env)，env.beat = {id, i, t0 幕内起点, dur, k 拍内进度 0..1}。以后插桥段只插一个拍对象。 */
function beatAct(def) {
  var bs = def.beats;
  if (!bs || !bs.length || !bs.every(function (b) { return b.dur != null; })) return;
  var s = 0;
  bs.forEach(function (b) { b.t = s; s += b.dur; });
  if (def.duration == null) def.duration = s;
  if (!def.draw) def.draw = function (c, t, env) {
    var i = 0;
    while (i + 1 < bs.length && t >= bs[i + 1].t) i++;
    var b = bs[i], lt = t - b.t;
    env.beat = { id: b.id, i: i, t0: b.t, dur: b.dur, k: U.clamp(lt / b.dur, 0, 1) };
    if (b.draw) { c.save(); try { b.draw(c, lt, env); } finally { c.restore(); } } else I.paper(c);
  };
}
function build() {
  if (built) return;
  acts.sort(function (a, b) { return a.order - b.order; });
  var s = 0; beats = [];
  acts.forEach(function (a, i) {
    a.start0 = s; a.end0 = s + a.dur0; s = a.end0;
    a.start = MN(a.start0); a.end = MN(a.end0); a.duration = a.end - a.start;   // 对外：新轴
    (a.beats || []).forEach(function (b) { beats.push({ id: a.id + '.' + b.id, t: MN(a.start0 + b.t), label: b.label }); });
    a._xf = xfOpts(a, i);
  });
  duration = MN(s); built = true;
  cueTable = null;
}
/* 幕边界转场：由后一幕的 xIn 决定（缺省 'ink' 墨晕 | 'wash' 水洗 | 'veil' 旧式宣纸淡出淡入 | 'cut' 硬切）。
   只在后一幕有 card 或 veilIn 时生效（与旧规则一致：两者都没有的边界本就是硬切）。
   墨晕/水洗跨边界前后各 XF 秒：前一幕最后 XF 秒墨洇满，后一幕开头 XF 秒墨褪出；有幕名卡的幕先从画心（卡字处）褪开。拍点时间不变。 */
var XF = 1.2;
/* 连续演出（修订 v2，RV-1；缺省开）：不画幕名卡、不做幕间墨晕/水洗/纸幕转场，幕界处前一幕最后一帧直接接后一幕第一帧（硬切）。
   只改幕卡与转场两处叠画：拍点、幕内秒、幕时长、确定性都不变；首幕的 veilIn（片头纸幕）不算幕间转场，照旧。?cards=1 恢复旧行为（对照用）。 */
var CONT = CINE.CONTINUOUS = !/[?&]cards=1(&|$)/.test(location.search);
function xfMode(a) { return !CONT && a && (a.card || a.veilIn) ? (a.xIn || 'ink') : 'cut'; }
function xfOpts(a, i) {
  var m = xfMode(a), sd = 60 + i * 17, r = U.rng(sd);
  if (!i || (m !== 'ink' && m !== 'wash')) return { mode: i ? m : 'cut' };
  var p2 = a.card ? [[W * .5, H * .48]] : [];
  while (p2.length < 3) p2.push([W * (.15 + .7 * r()), H * (.2 + .6 * r())]);
  var xo = acts[i - 1] && acts[i - 1].xOut;                          // 前一幕可给出场墨晕的起点 {pts 洇开, pts2 褪开}（缺省同旧：pts 随 seed、pts2 如上）
  return xo ? { mode: m, seed: sd, pts: xo.pts, pts2: xo.pts2 || p2 } : { mode: m, seed: sd, pts2: p2 };
}
/* ---------- 音乐/音效锚点（幕定义 cues）合并成全局 cue 表 ----------
   幕定义可写 cues: { 名: 幕内秒 | {t: 幕内秒, …附加字段} } 或 [{id|name, t, …}]。引擎按幕起点换算成全片秒，排成一张表，供 audio.js / 配乐代理读。
   CINE.cueTable() → [{id:'幕id.名', act, name, t 幕内秒, T 全片秒, …附加}]（按 T 升序）
   CINE.cue(id 或 '幕id.名') → 该项 | null；CINE.cuesBetween(T0, T1) → T0 ≤ T < T1 的项
   CINE.onCue(fn)：播放中每帧把「上一帧到这一帧之间越过的 cue」逐个回调 fn(cue, T)（跳转/暂停后从新位置重新起算，renderAt 本身不回调）
   每帧 env.cue(名) → 本幕该锚点的幕内秒（无则 null），env.cues 本幕全部项。只读，不影响画面确定性。 */
var cueTable = null, cueFns = [], cuePrev = null;
function buildCues() {
  build();
  if (cueTable) return cueTable;
  var L = [];
  acts.forEach(function (a) {
    var c = a.cues;
    if (!c) return;
    var list = Array.isArray(c) ? c.map(function (q) { return q; }) : Object.keys(c).map(function (k) { var v = c[k]; return typeof v === 'number' ? { name: k, t: v } : Object.assign({ name: k }, v); });
    list.forEach(function (q) {
      var name = q.name || q.id, t = +q.t;
      if (!name || !isFinite(t)) return;
      var e = {}; for (var k in q) e[k] = q[k];
      e.name = name; e.act = a.id; e.id = a.id + '.' + name; e.t = t; e.T = MN(a.start0 + t);
      L.push(e);
    });
  });
  L.sort(function (p, q) { return p.T - q.T || (p.id < q.id ? -1 : 1); });
  cueTable = L;
  return L;
}
CINE.cueTable = function () { return buildCues().slice(); };
CINE.cue = function (id) { var L = buildCues(); for (var i = 0; i < L.length; i++) if (L[i].id === id || L[i].name === id) return L[i]; return null; };
CINE.cuesBetween = function (T0, T1) { return buildCues().filter(function (c) { return c.T >= T0 && c.T < T1; }); };
CINE.onCue = function (fn) { if (typeof fn === 'function') cueFns.push(fn); };
function fireCues(T) {                                        // 播放帧里调用：越过的 cue 逐个回调
  if (!cueFns.length) { cuePrev = T; return; }
  if (cuePrev != null && T > cuePrev) CINE.cuesBetween(cuePrev, T).forEach(function (c) { cueFns.forEach(function (f) { try { f(c, T); } catch (e) { CINE.errors.push('onCue: ' + e.message); } }); });
  cuePrev = T;
}
function actAt(T) {
  build();
  for (var i = 0; i < acts.length; i++) if (T < acts[i].end) return i;
  return acts.length - 1;
}
function actAt0(T0) {                                       // 旧全片秒所在的幕（画面用）
  build();
  for (var i = 0; i < acts.length; i++) if (T0 < acts[i].end0) return i;
  return acts.length - 1;
}
CINE.acts = function () { build(); return acts; };
CINE.actById = function (id) { build(); for (var i = 0; i < acts.length; i++) if (acts[i].id === id) return acts[i]; return null; };
CINE.errors = [];
CINE.beatDebug = function (v) { beatDbg = v !== false; return beatDbg; };

var cv, ctx, env = {}, imgWarned = {};
var S = { T: 0, t0: 0, tv: 0, playing: false, origin: 0, porigin: 0, useAudio: false, ended: false, started: false, canDraw: false, stopAt: null, clipA: null };   // stopAt：?to=秒 自动暂停点

/* 幕间：宣纸“幕布”与竖排幕名卡（融入画面，不黑屏） */
function drawCard(c, a, t) {
  var veil = 0, txt = 0, idx = acts.indexOf(a), nx = acts[idx + 1];
  if (a.card && !CONT) { veil = (a.cardVeil == null ? 1 : a.cardVeil) * (1 - U.ramp(t, 1.5, 3.3)); txt = U.win(t, .2, 1.9, .7, 1.1); }   // 连续演出不画幕卡（txt 恒 0）；cardVeil：可选，幕卡底纸不透明度（缺省 1）
  else if (a.veilIn && (idx === 0 || xfMode(a) === 'veil')) veil = 1 - U.ramp(t, 0, a.veilIn);
  if (nx && xfMode(nx) === 'veil') veil = Math.max(veil, (nx.xPeak == null ? 1 : nx.xPeak) * U.ramp(t, a.dur0 - 1.1, a.dur0));   // xPeak：可选，后一幕 'veil' 入场时前一幕幕尾纸幕的峰值（缺省 1）
  if (veil > .001) I.paper(c, veil);
  if (txt > .001 && a.card) {
    c.save(); I.screen(c);
    var cx = W * .5, small = a.card[0] || '', big = a.card[1] || '', sz = 110, ss = 44;   // 审 B3：幕卡改马善政（志莽行书的「清」草化，被读成「涛」）
    var colH = small.length * ss * 1.12 + ss * 1.1 + big.length * sz * 1.08, y = H * .5 - colH / 2;
    I.wash(c, cx + 10, H * .5, 170, colH * .62, .12 * txt, 7, null, 0, { edge: 'soft' });
    I.wash(c, cx - 6, y + small.length * ss * 1.12 + ss * .55 + big.length * sz * .54, 120, big.length * sz * .6, .08 * txt, 3, null, 0, { edge: 'soft' });
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = U.rgba(CINE.C.inkRGB, .7 * txt); c.font = ss + 'px ' + CINE.FONT.poem;
    for (var i = 0; i < small.length; i++) c.fillText(small[i], cx, y + ss * (i * 1.12 + .5));
    y += small.length * ss * 1.12;
    c.font = Math.round(ss * .8) + 'px ' + CINE.FONT.text; c.fillText('·', cx, y + ss * .55);
    y += ss * 1.1;
    c.fillStyle = U.rgba(CINE.C.inkRGB, .95 * txt); c.font = sz + 'px ' + CINE.FONT.poem;
    for (var j = 0; j < big.length; j++) c.fillText(big[j], cx, y + sz * (j * 1.08 + .5));
    c.restore();
  }
}
/* 调试叠加（?beats=1）：当前幕/拍号/拍内秒与拍长；只在最后画，不参与幕的自动对比取样。 */
function drawBeatDebug(c, a, t) {
  if (!beatDbg) return;
  var bs = a.beats || [], i, b = null;
  for (i = 0; i < bs.length; i++) if (t >= bs[i].t) b = bs[i];
  var dur = b && b.dur > 0 ? b.dur : 0;
  var label = a.id + (b ? '  ' + b.id : '  —') + '  ' + t.toFixed(1) + 's' + (b ? '  (' + Math.max(0, t - b.t).toFixed(1) + (dur ? '/' + dur.toFixed(1) : '') + ')' : '');
  c.save(); I.screen(c);
  c.font = '600 30px Menlo, Monaco, monospace'; c.textBaseline = 'middle'; c.textAlign = 'left';
  var w = c.measureText(label).width + 36, h = 54, x = Math.max(30, W - w - 30), y = 26;   // 右上角：避开 filmstrip 左上角的时间码标签
  c.fillStyle = 'rgba(8,10,12,.74)'; c.fillRect(x, y, w, h);
  c.strokeStyle = 'rgba(242,238,226,.34)'; c.lineWidth = 1.5; c.strokeRect(x + .75, y + .75, w - 1.5, h - 1.5);
  c.fillStyle = 'rgba(246,242,232,.95)'; c.fillText(label, x + 18, y + h / 2 - (b ? 3 : 0));
  if (b && dur) {
    c.fillStyle = 'rgba(246,242,232,.22)'; c.fillRect(x + 18, y + h - 12, w - 36, 3);
    c.fillStyle = 'rgba(118,206,214,.95)'; c.fillRect(x + 18, y + h - 12, (w - 36) * U.clamp((t - b.t) / dur, 0, 1), 3);
  }
  c.restore();
}
var errSeen = {}, cardFn = drawCard;                   // cardFn：字幕体检钩子（CINE.lintOn）会换成包了一层的 drawCard
/* 一帧（旧全片秒 T0）画进 ctx：幕 draw → 题签 → 幕卡 → 幕间转场。返回幕序号。drawFrame 与删段接缝的溶化都用它 */
function drawOld(T0, T) {
  var i = actAt0(T0), a = acts[i], t = T0 - a.start0;
  if (i !== plateWin) plateWindow(i);                     // 底图：预解码本幕与下一幕，释放离开两幕以上的
  if (i !== cacheWin) cacheWindow(i);                     // 离屏缓存：淘汰前面几幕独用的精灵与远幕的全屏层
  plateAct = i; cacheAct = i;
  env.T = T; env.T0 = T0; env.t = t; env.act = a; env.dur = a.dur0;
  env.cues = buildCues().filter(function (c) { return c.act === a.id; });
  env.cue = function (name) { for (var k = 0; k < env.cues.length; k++) if (env.cues[k].name === name) return env.cues[k].t; return null; };
  ctx.save();
  try { a.draw(ctx, t, env); }
  catch (e) {
    CINE.errors.push(a.id + ': ' + e.message);
    if (!errSeen[a.id]) { errSeen[a.id] = 1; if (window.console) console.error('[cine] ' + a.id, e); }
    ctx.restore(); ctx.save(); I.paper(ctx);
  }
  ctx.restore();
  ctx.setTransform(CINE.px, 0, 0, CINE.px, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  if (a.tags) for (var g = 0; g < a.tags.length; g++) {   // 人物题签：本幕 draw 之后、幕卡/转场/纸纹之前统一画
    try { I.nameTag(ctx, t, a.tags[g]); }
    catch (e) { CINE.errors.push(a.id + '.tag: ' + e.message); if (!errSeen[a.id + '.tag']) { errSeen[a.id + '.tag'] = 1; if (window.console) console.error('[cine] ' + a.id + ' tag', e); } }
  }
  cardFn(ctx, a, t);
  var nx = acts[i + 1], xn = nx && nx.xfLen || XF, xa = a.xfLen || XF;   // xfLen：本幕入场转场每侧时长（缺省 XF；尾声水洗放慢，审 V3-04）
  var xo = nx && t > a.dur0 - xn ? nx._xf : null, xi = t < xa ? a._xf : null;
  if (xo && (xo.mode === 'ink' || xo.mode === 'wash')) I.inkBleed(ctx, .5 * (t - (a.dur0 - xn)) / xn, xo);
  if (xi && (xi.mode === 'ink' || xi.mode === 'wash')) I.inkBleed(ctx, .5 + .5 * t / xa, xi);
  return i;
}
function blankCanvas(c) {
  if (c.reset) c.reset();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  c.fillStyle = CINE.C.paper; c.fillRect(0, 0, c.canvas.width, c.canvas.height);   // 每帧先铺纸色：非整数缩放时整屏图盖不满最后一行像素，不清会透出上一帧（结果随渲染顺序变）
  c.setTransform(CINE.px, 0, 0, CINE.px, 0, 0);
}
var seamCv = null;
function drawFrame(T) {
  build();
  layerDepth = {}; cacheFrame++; env.finish = null; CINE._textLog = [];
  T = U.clamp(T, 0, Math.max(0, duration - 1e-4));
  var T0 = MO(T), seam = null;                               // 新秒 → 旧秒（v5 删段）；幕代码一律按旧幕内秒画
  tmLoad();
  for (var q = 0; q < TMX.length; q++) { var J = TMX[q]; if (Math.abs(T - J.at) < J.xf / 2) { seam = J; break; } }
  blankCanvas(ctx);                                       // 10-14：每帧先整体复位画布（清空未光栅化的绘制记录、状态栈、裁剪与全部上下文状态）；见 git 史
  var i;
  if (seam) {                                             // 删段接缝溶化：两镜都借删段里的帧作把手——删点前一镜照旧秒 a+d 往下走，删点后一镜按旧秒 b+d（d＝距删点的新秒）；smooth 交叉
    var d = T - seam.at, kx = U.smooth(d / seam.xf + .5), Ta = seam.a + d, Tb = seam.b + d;
    var keep = env.finish;
    drawOld(Ta, T); var fA = env.finish;
    if (!seamCv || seamCv.width !== ctx.canvas.width || seamCv.height !== ctx.canvas.height) seamCv = U.canvas(ctx.canvas.width, ctx.canvas.height);
    var sx = seamCv.getContext('2d'); sx.setTransform(1, 0, 0, 1, 0, 0); sx.globalAlpha = 1; sx.globalCompositeOperation = 'copy'; sx.drawImage(ctx.canvas, 0, 0);
    env.finish = keep; layerDepth = {};
    blankCanvas(ctx);
    i = drawOld(Tb, T);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1 - kx; ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(seamCv, 0, 0); ctx.restore();
    if (!env.finish) env.finish = fA;
  } else i = drawOld(T0, T);
  var a = acts[i];
  I.finish(ctx, env.finish);
  drawBeatDebug(ctx, a, env.t);
  plateAct = -1; cacheAct = -1;
  return T;
}
function renderAt(T) {
  if (!ctx) return;
  S.T = drawFrame(T);
  updateUI();
}

/* ---------- 音频（全部容错：audio.js 缺失或不全时静默运行） ---------- */
function acall(name, arg) {
  var a = CINE.audio;
  if (!a || typeof a[name] !== 'function') return undefined;
  try { return a[name](arg); } catch (e) { CINE.errors.push('audio.' + name + ': ' + e.message); return undefined; }
}
function perfNow() { return performance.now() / 1000; }
function clockNow() {
  if (S.useAudio) {
    var v = acall('clock');
    if (typeof v === 'number' && isFinite(v)) return v;
    S.useAudio = false; S.origin = perfNow() - S.T;           // 音频时钟失效：无缝切回系统时钟
  }
  return perfNow();
}
/* 画面时钟：ctx.currentTime 按音频块跳（逐帧 dT 抖 ±5ms 以上），画面改由 performance.now（p 秒，RAF 时间戳）平滑推进，
   每帧向音频时钟 Ta 校正误差的 1/20；音频钟领先 >50ms 直接前跳对齐，落后 >50ms（挂起未判死、卡顿）停住画面等它追上。
   两次起播之间输出单调不减（S.tv 为上次输出；play() 重置）。 */
function smoothT(p) {
  var au = S.useAudio, Ta = clockNow() - S.origin, T;
  if (!S.useAudio) {
    if (au) S.origin = p - S.tv;                            // 本帧刚从音频钟切回系统钟：用同一时间戳 p 接上上次输出
    T = p - S.origin;
  } else {
    var e = Ta - (p - S.porigin);
    if (e > .05) S.porigin = p - Ta;
    else if (e < -.05) S.porigin = p - S.tv;
    else S.porigin -= e * .05;
    T = p - S.porigin;
  }
  if (T < S.tv) T = S.tv;
  return (S.tv = T);
}
function play() {
  build();
  cuePrev = null;
  if (S.T >= duration - .05) S.T = 0;
  if (S.clipA != null && (S.T >= S.stopAt - .05 || S.T < S.clipA)) S.T = S.clipA;   // 样片模式：在段尾再播＝从段首重播
  S.ended = false; hideAgain();
  if (!CINE.muted) acall('wake');                            // 先请求 resume、重置宽限计时（被挂起过或已判死的上下文借此复活）
  var ok = !CINE.muted && acall('running') === true;
  var c0 = ok ? acall('clock') : null;
  S.useAudio = ok && typeof c0 === 'number' && isFinite(c0);
  if (S.useAudio) acall('scheduleFrom', S.T);
  S.t0 = S.T;                                                 // 本次起播点：音频预调度的 LEAD 秒内画面停在这里，不倒退
  S.origin = clockNow() - S.T;
  if (S.useAudio) { var L = CINE.audio && +CINE.audio.LEAD; if (L > 0 && L < 2) S.origin += L; }
  S.tv = clockNow() - S.origin; S.porigin = perfNow() - S.tv;
  S.playing = true;
  updateUI();
}
function pause() {
  if (S.playing) S.T = U.clamp(Math.max(S.t0, smoothT(perfNow())), 0, duration);
  S.playing = false;
  acall('stopAll');
  updateUI();
}
function seek(T) {
  build();
  var was = S.playing;
  if (was) pause();
  S.T = U.clamp(+T || 0, 0, duration - .01);
  if (S.clipA != null) S.T = U.clamp(S.T, S.clipA, S.stopAt - .01);   // 样片模式：跳转不出本段
  if (S.ended) { S.ended = false; hideAgain(); }             // 播完后再跳转：撤「重看」，按暂停态显示
  renderAt(S.T);
  if (was) play();
}
function frame(ts) {
  requestAnimationFrame(frame);
  if (!S.playing) return;
  var T = smoothT(ts > 0 ? ts / 1000 : perfNow());
  if (T >= duration) {
    renderAt(duration - 1e-3); S.playing = false; S.ended = true;
    acall('stopAll', true);
    showAgain(); return;
  }
  if (S.stopAt != null && S.t0 < S.stopAt && T >= S.stopAt) {   // ?to=秒：本次起播点在停点之前、播到停点就暂停在停点（从停点再按播放则继续往后）
    S.playing = false; acall('stopAll');
    renderAt(S.stopAt); fireCues(S.T);
    if (S.clipA != null) { S.ended = true; showAgain(); }     // 样片模式（?t&to）：段尾停住、出「重看」，不往后播
    poke(); return;
  }
  if (S.useAudio) {
    if (acall('revivable') === true) { pause(); play(); return; }   // 播放中被判死、上下文又回到 running：按当前时刻重排音频
    acall('tick', Math.max(0, T));
  }
  renderAt(Math.max(0, S.t0, T));
  fireCues(S.T);
}

/* ---------- 尺寸：16:9 等比、留边，DPR ≤ 2 ---------- */
function resize() {
  var ww = window.innerWidth, wh = window.innerHeight;
  var w = Math.min(ww, wh * 16 / 9), h = w * 9 / 16;
  var st = document.getElementById('stage');
  st.style.width = w + 'px'; st.style.height = h + 'px';
  st.style.left = ((ww - w) / 2) + 'px'; st.style.top = ((wh - h) / 2) + 'px';
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var bw = Math.max(16, Math.round(w * dpr)), bh = Math.max(9, Math.round(h * dpr));
  if (cv.width !== bw || cv.height !== bh) {
    cv.width = bw; cv.height = bh;
    CINE.px = bw / W;
    U.clearCache();
  }
  if (S.canDraw) renderAt(S.playing ? Math.max(S.t0, smoothT(perfNow())) : S.T);
}

/* ---------- 控件：进度条（五幕刻度，可点击）、暂停提示、2 秒无操作淡出 ---------- */
var ui, fillEl, pzEl, idleTimer = 0;
function buildBar() {
  var bar = document.getElementById('bar');
  if (!bar) return;
  acts.forEach(function (a) {
    if (!a.card || S.clipA != null) return;                   // 样片模式：进度条只代表本段，不画幕刻度
    var x = (a.start / duration * 100) + '%';
    var tk = document.createElement('div'); tk.className = 'tick'; tk.style.left = x; bar.appendChild(tk);
    var lb = document.createElement('div'); lb.className = 'lab'; lb.style.left = x; lb.textContent = a.card[1]; bar.appendChild(lb);
  });
  bar.addEventListener('click', function (e) {
    var r = bar.getBoundingClientRect();
    var f = U.clamp((e.clientX - r.left) / r.width, 0, 1);
    seek(S.clipA != null ? S.clipA + f * (S.stopAt - S.clipA) : f * duration); poke();
  });
}
function updateUI() {
  if (!fillEl) return;
  fillEl.style.width = (S.clipA != null ? U.clamp((S.T - S.clipA) / Math.max(.01, S.stopAt - S.clipA), 0, 1) : S.T / Math.max(1, duration)) * 100 + '%';
  pzEl.textContent = (!S.playing && !S.ended && S.started) ? '暂停' : '';
}
function poke() {
  if (!ui) return;
  ui.classList.remove('hide'); document.body.style.cursor = '';
  clearTimeout(idleTimer);
  idleTimer = setTimeout(function () { if (S.playing) { ui.classList.add('hide'); document.body.style.cursor = 'none'; } }, 2000);
}
function showAgain() {
  var e = document.getElementById('again');
  if (!e) return;
  e.style.display = 'flex';
  setTimeout(function () { e.style.opacity = 1; }, 30);
  ui.classList.remove('hide'); document.body.style.cursor = '';
}
function hideAgain() {
  var e = document.getElementById('again');
  if (e) { e.style.opacity = 0; e.style.display = 'none'; }
}
function jumpAct(d) {
  var i = actAt(S.T), a = acts[i];
  if (d < 0 && S.T - a.start > 2) { seek(a.start); return; }   // 幕内已过 2 秒：先回本幕开头
  seek(acts[U.clamp(i + d, 0, acts.length - 1)].start);
}
function onKey(e) {
  var k = e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowLeft' || e.code === 'ArrowRight';
  if (k && (e.code !== 'Enter' || !S.started)) e.preventDefault();   // 开卷后回车留给获焦的「重看」按钮
  if (e.repeat) return;                                       // 按住不放：只认第一下（空格不再连切播放/暂停）
  if (!S.started) { if ((e.code === 'Space' || e.code === 'Enter') && S.canDraw) start(); return; }   // 资源就绪（开卷按钮启用）前不开卷
  if (e.code === 'Space') { if (S.playing) pause(); else play(); poke(); }
  else if (e.code === 'ArrowLeft') { if (S.clipA != null) seek(S.T - 5); else jumpAct(-1); poke(); }
  else if (e.code === 'ArrowRight') { if (S.clipA != null) seek(S.T + 5); else jumpAct(1); poke(); }
}
function start() {
  if (S.started) return;
  var cov = document.getElementById('cover');
  cov.style.transition = 'opacity .45s ease-out';          // 开卷遮罩快褪（原 1.2s），片头合着的手卷一开场就看得清
  cov.style.opacity = 0; setTimeout(function () { cov.style.display = 'none'; }, 600);
  S.started = true;
  if (!CINE.muted) acall('init');
  play(); poke();
}

/* ---------- 字体就绪（canvas 画字前等待；fonts.js 缺失或超时则用回退栈） ---------- */
function whenFonts(cb) {
  var F = window.CINE_FONTS, done = false;
  var go = function () { if (done) return; done = true; CINE.fontsReady = true; cb(); };
  if (F && F.ready && typeof F.ready.then === 'function') { F.ready.then(go, go); setTimeout(go, 3500); }
  else go();
}
/* 字体与底图都就绪（各自有超时：字体 3.5 秒、底图 5 秒）再画首帧 */
function whenReady(cb) {
  var k = 2, go = function () { if (--k === 0) cb(); };
  whenFonts(go);
  CINE.platesReady.then(go, go);
}

/* ---------- 基准：?bench=1（或 =sync）—— 每幕先暖缓存，再均匀取 N 帧同步渲染，输出平均帧耗时 ----------
   一律在 boot 里同步跑：无头 Chrome 加 --virtual-time-budget 时，页面载入后任务里的 performance.now()/Date.now()（连 Worker 的）
   全被冻结，异步测出恒为 0；只有首轮同步脚本里时钟是真的（实测）。字体可能尚未就绪（回退字体，行尾记 fonts:0），
   底图记已载入张数 plates:k/n。结果写进 <pre id="bench">、document.title 与 CINE.benchResult，--dump-dom 可直接取回；
   但本机无头 Chrome 输出后进程不退出，取数脚本要轮询输出里出现 BENCH 后自行结束进程。 */
function bench(N) {
  var out = [], tot = 0, frames = 0;
  acts.forEach(function (a) {
    for (var w = 0; w < 8; w++) { drawFrame(a.start + (w + .5) / 8 * a.duration); ctx.getImageData(0, 0, 1, 1); }
    var t0 = performance.now();
    for (var k = 0; k < N; k++) { drawFrame(a.start + (k + .37) / N * a.duration); ctx.getImageData(0, 0, 1, 1); }   // 读回一像素：强制光栅化，计入真实绘制成本
    var ms = (performance.now() - t0) / N;
    tot += ms * N; frames += N;
    out.push(a.id + ':' + ms.toFixed(1) + 'ms');
  });
  var pids = window.CINE_PLATES ? Object.keys(window.CINE_PLATES) : [], pn = pids.filter(function (id) { return I.plateHas(id); }).length;
  var xs = [];                                           // 幕边界 ±XF 秒内（墨晕/水洗转场帧）的平均帧耗时
  acts.forEach(function (a, i) {
    var m = a._xf && a._xf.mode;
    if (!i || (m !== 'ink' && m !== 'wash')) return;
    var M = Math.max(8, N >> 1);
    for (var w = 0; w < 4; w++) drawFrame(a.start - XF + (w + .5) / 4 * 2 * XF);
    var t1 = performance.now();
    for (var k = 0; k < M; k++) { drawFrame(a.start - XF + (k + .37) / M * 2 * XF); ctx.getImageData(0, 0, 1, 1); }
    xs.push(a.id + ':' + ((performance.now() - t1) / M).toFixed(1));
  });
  var line = 'BENCH ' + cv.width + 'x' + cv.height + ' N=' + N + ' ' + out.join(' ') + ' avg:' + (tot / frames).toFixed(1) + 'ms fonts:' + (CINE.fontsReady ? 1 : 0) + ' plates:' + pn + '/' + pids.length +
    ' cache:' + caches.size + ' errors:' + CINE.errors.length + (CINE.errors.length ? ' ' + CINE.errors.slice(0, 3).join(' | ') : '') + ' xf[' + xs.join(' ') + ']ms';
  if (window.console) console.log(line);
  var pre = document.createElement('pre'); pre.id = 'bench'; pre.textContent = line;
  pre.style.cssText = 'position:absolute;left:8px;top:8px;margin:0;font:14px monospace;color:#000;background:rgba(255,255,255,.8);z-index:9';
  document.body.appendChild(pre);
  document.title = line;
  CINE.benchResult = line;
}
/* 预热：开卷前在空闲时把各拍首帧画一遍，建好离屏缓存（避免播放中首次建缓存卡顿）。
   从片尾往片头倒着画：缓存是 LRU，最后画的（片头几幕）最不易被逐出，开卷时正好是热的。
   预热途中底图照常释放，不调 decode()（否则窗口滑过全片会把每张都预解码一遍）；各幕清单是静态表，不靠预热收集 */
function prewarm() {
  var list = [];
  acts.forEach(function (a) {
    list.push(a.start + .5);
    (a.beats || []).forEach(function (b) { list.push(MN(a.start0 + b.t + 1)); list.push(MN(a.start0 + b.t + .05)); });   // PERF O2：拍首帧也画（切镜即用的大件多在拍首建）
  });
  buildCues().forEach(function (q) { list.push(q.T + .05); });   // PERF O2：各 cue（命中、乐句、特效起头）后一帧
  list.sort(function (p, q) { return p - q; });
  list = list.filter(function (T, k) { return T < duration && (!k || T - list[k - 1] > .2); });   // 去重（相距 ≤0.2 s 的只画一帧）
  list.reverse();
  var i = 0;
  (function step() {
    if (S.started || i >= list.length) { plateWin = -1; if (!S.started) renderAt(S.T); return; }   // 预热完：按当前幕重排底图窗口（此时才预解码）
    plateQuiet = true;
    try { drawFrame(list[i++]); } finally { plateQuiet = false; }
    setTimeout(step, 0);
  })();
}

/* ---------- 题签验收（DESIGN-enhance-1011 §6） ----------
   allTags：各幕 tags 声明，附全片秒 T0（=幕起点+t0）与可见区间 [T0, T1]。
   tagClash(T0, T1, step=.1, full)：在 [T0,T1] 内逐 step 秒 renderAt，返回题签与台词/旁白同帧出现的时刻
   [{T, tag, text}]（allowSay 的题签不算）。缺省只扫声明题签的可见区间（全片逐帧太慢）；full 为真时整段逐帧扫（幕内直接调 I.nameTag 的也查得到）。
   扫完回到原来的时刻重画一帧。 */
function allTags() {
  build();
  var r = [];
  acts.forEach(function (a) {
    (a.tags || []).forEach(function (g) {
      var hold = g.hold == null ? 2 : g.hold;
      r.push({ act: a.id, name: g.name, role: g.role, t0: g.t0, T0: MN(a.start0 + g.t0), T1: MN(a.start0 + g.t0 + 1 + hold), allowSay: !!g.allowSay });
    });
  });
  return r;
}
function tagClash(T0, T1, step, full) {
  step = step || .1;
  var out = [], back = S.T, wins = full ? [[T0, T1]] : allTags().map(function (g) { return [Math.max(T0, g.T0), Math.min(T1, g.T1)]; });
  var seen = {};
  wins.forEach(function (w) {
    for (var n = Math.ceil(w[0] / step - 1e-6); n * step <= w[1] + 1e-6; n++) {
      var T = +(n * step).toFixed(4);
      if (seen[T]) continue;
      seen[T] = 1;
      drawFrame(T);
      var log = CINE._textLog, tg = log.filter(function (e) { return e.kind === 'tag' && !e.allowSay; }), tx = log.filter(function (e) { return e.kind !== 'tag' && e.kind !== 'note'; });   // 题注可与题签/字幕同屏（BRIEF §4）
      if (tg.length && tx.length) out.push({ T: T, tag: tg.map(function (e) { return e.text; }).join(' / '), text: tx.map(function (e) { return e.text; }).join(' / ') });
    }
  });
  renderAt(back);
  return out.sort(function (a, b) { return a.T - b.T; });
}

/* ---------- 启动 ---------- */
CINE.boot = function () {
  build();
  cv = document.getElementById('cv');
  ctx = cv.getContext('2d');
  env.W = W; env.H = H; env.rand = U.rng; env.U = U; env.C = CINE.C; env.F = CINE.FONT; env.ink = I;
  env.audio = CINE.audio; env.song = CINE.songChars;
  env.rig = I.rig;                                            // lib-rig.js：立绘次级运动（缺 lib-rig.js 时为 undefined）
  env.img = function (id) {                                   // BRIEF §12：图像资产；缺图返回 null 并 info 一次（画面由调用方 fallback）
    var im = plateImg(id);
    if (!im && !imgWarned[id]) { imgWarned[id] = 1; if (window.console) console.info('[cine] 缺图 ' + id + '（占位）'); }
    return im;
  };
  ui = document.getElementById('ui'); fillEl = ui && ui.querySelector('.fill'); pzEl = document.getElementById('pz');
  var q = {};
  location.search.replace(/^\?/, '').split('&').forEach(function (kv) {
    if (!kv) return; var p = kv.split('='); q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '1');
  });
  S.T = q.t ? U.clamp(parseFloat(q.t) || 0, 0, duration - .01) : 0;
  var to = q.to ? parseFloat(q.to) : NaN;
  S.stopAt = isFinite(to) && to > 0 ? Math.min(to, duration) : null;
  if (S.stopAt != null && q.t && S.stopAt > S.T + .1 && !q.shot && !q.lint && !q.bench) S.clipA = S.T;   // ?t&to 同给：样片模式，只播这一段
  // ?to=秒：样片段落播到该秒自动暂停（例 ?t=24&to=278）
  CINE.muted = q.mute === '1' || q.shot === '1' || !!q.bench;
  beatDbg = q.beats === '1' || !!window.CINE_BEATS;            // ?beats=1：胶片条/调试时显示当前拍号
  if (q.lint) CINE.lintOn();                                  // ?lint=1：字幕体检钩子（tools/sub-lint.mjs）
  if (q.contrast === '0') CINE.CONTRAST.on = false;           // ?contrast=0：关文字自动对比（对照用）
  window.addEventListener('resize', resize);
  resize();
  buildBar();
  window.__cine = {
    duration: duration,
    acts: acts.map(function (a) { return { id: a.id, name: a.name, start: a.start, end: a.end, duration: a.duration }; }),
    beats: beats,
    seek: seek, play: play, pause: pause, renderAt: renderAt,
    state: function () { return { T: S.T, playing: S.playing, audio: S.useAudio, ta: S.playing && S.useAudio ? clockNow() - S.origin : null, errors: CINE.errors.slice() }; },   // ta：音频时钟上的当前时刻（测音画误差）
    tags: allTags(),
    cues: buildCues(),
    tagClash: tagClash
  };
  if (q.rig && CINE.rigDebug) {                                // ?rig=ID：立绘调试面板（lib-rig.js），不播片
    document.getElementById('cover').style.display = 'none';
    if (ui) ui.style.display = 'none';
    whenReady(function () { CINE.rigDebug(q.rig); });
    return;
  }
  if (q.shot === '1' || q.bench) {
    document.getElementById('cover').style.display = 'none';
    if (ui) ui.style.display = 'none';
    if (q.bench) { S.canDraw = true; renderAt(S.T); bench(parseInt(q.n, 10) || 24); return; }   // 同步基准（见 bench 注释）
    whenReady(function () {
      S.canDraw = true;
      renderAt(S.T);
      document.title = 'SHOT-READY t=' + S.T + (CINE.errors.length ? ' ERR ' + CINE.errors.join(' | ') : '');
    });
    return;
  }
  document.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', function () {  // 切到后台：暂停（RAF 停了，乐句与音效不再调度）；回到前台保持暂停、亮出控件
    if (document.hidden) { if (S.playing) pause(); }
    else if (S.started) poke();
  });
  document.addEventListener('mousemove', function () { if (S.started) poke(); });
  document.getElementById('againBtn').addEventListener('click', function () { seek(S.clipA != null ? S.clipA : 0); play(); poke(); });
  var sb = document.getElementById('startBtn');
  sb.disabled = true; sb.style.opacity = .35;                 // index.html 里已先写 disabled（本脚本载入前点击无效）
  sb.addEventListener('click', start);
  whenReady(function () {
    S.canDraw = true; sb.disabled = false; sb.style.opacity = '';
    renderAt(S.T);
    prewarm();
  });
  requestAnimationFrame(frame);
};

})();
