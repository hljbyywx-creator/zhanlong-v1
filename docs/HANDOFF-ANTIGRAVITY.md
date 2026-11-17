# 《斩龙封神》Antigravity / Web Gemini 云端交接总指南（HANDOFF-ANTIGRAVITY）

本仓库为《问镜》小说第六卷第 169 章末—第 170 章《斩龙封神 碧血开道》全片 22 分钟（`1320.0s`，7 幕 97 镜）水墨青绿长卷动画工程。全部运行时资产（`plates.js`、`audio-assets.js`、`voice-assets.js`、`fonts.js`）与源码、全片 1 秒步长审查拼图均已随仓提交，云端克隆后可直接启动预览或迭代。

---

## 一、仓库完整文件地图（云端与 Web Gemini 查阅索引）

### 1. 必读设计与剧本规范（`docs/`）
- `docs/DECISIONS.md`：创作总纲、南宋院体水墨＋青绿界画色板、动效神韵红线与视听规范。
- `docs/MASTER-MANIFEST.md`：七幕时间轴契约（`0–1320s`）、73 张底图/立绘 ID 字典、`CINE.zl` 20 项专属动效函数签名。
- `docs/LORE-REF.md`：原著第 163–170 章前情因果与人物/法器/星殿考据。
- `docs/BRIEF.md`：全片 97 镜逐镜分镜表（镜头运动、底图立绘、动效编排、进出拍点）。
- `docs/TEXT-LEDGER.md`：全片 137 条字幕/对白/心声/秘阵声/题签/大字/印章账本（14 列标准表）。
- `docs/HITS.json`：20 个戏剧与音乐重音锚点（`H01`–`H20`）。
- `docs/VOICE-SCRIPT.json`：43 条分角色配音脚本（9 类角色声线、6 类声学空间）。
- `docs/ASSET-PLAN.md`：32 项新美术资产构图与提示词规范。
- `docs/COORDINATOR-RESUME.md`：v1 验收状态断点记录。

### 2. 全片视觉审查拼图（供多模态模型直接看图审片，无需跑无头浏览器即可定位画面问题）
- **美术资产总览拼图**：
  - `plates-src/CONTACT-SHEET-SCENES.jpg`：22 张场景底图与叙事插画/特写总览（`#01`–`#22`）。
  - `plates-src/CONTACT-SHEET-SPRITES.jpg`：10 组透明抠图角色与法器立绘总览（`#23`–`#32`）。
- **全片 1320 秒 1 秒步长成片胶片条拼图（`docs/review-grids-v1/`，共 8 张覆盖全片每一秒）**：
  - `docs/review-grids-v1/rev-000-179.jpg`（`0..179s`：`prologue` + `act1` 前半）
  - `docs/review-grids-v1/rev-180-359.jpg`（`180..359s`：`act1` 后半 + `act2` 前半）
  - `docs/review-grids-v1/rev-360-539.jpg`（`360..539s`：`act2` 后半 + `act3` 前半）
  - `docs/review-grids-v1/rev-540-719.jpg`（`540..719s`：`act3` 后半 + `act4` 前半至血链穿胸）
  - `docs/review-grids-v1/rev-720-869.jpg`（`720..869s`：`act4` 后半负链登台问刀）
  - `docs/review-grids-v1/rev-870-1019.jpg`（`870..1019s`：`act5` 前半青莲种道基、一刀断首、时光回溯亲斩杨端明）
  - `docs/review-grids-v1/rev-1020-1169.jpg`（`1020..1169s`：`act5` 后半朝阳先生真容、截杀参罗利那 + `coda` 开头）
  - `docs/review-grids-v1/rev-1170-1319.jpg`（`1170..1319s`：`coda` 碧血化虹、中天紫微星空大殿、清净散人焦骨、尾印收卷）

### 3. 核心引擎与七幕演出源码（`js/`）
- **引擎与通用库**：
  - `js/engine.js`：固定 `1920×1080` 逻辑画布、幕注册与调度、确定性 PRNG/噪声 `CINE.util`、基础水墨笔触 `CINE.ink`、无头截图钩子 `window.__cine`。
  - `js/lib-rig.js`：二阶布料/丝绸物理骨骼绑定 `I.rig` 与序列帧 `I.kfseq`。
  - `js/lib-flow.js`：三角网格 UV 变形水墨流场 `I.flow`。
  - `js/lib-fx.js`：通用领域特效（气环、血潮、浊浪、墨溅、飞白）。
  - `js/lib-motion.js`：动作力学库 `CINE.motion`（预备蓄势 `strike`、顿帧 `hitStop`、弹簧冲击 `kickCam`、墨环冲击波 `inkShock`）。
  - `js/lib-text.js`：字幕、竖排题签 `I.nameTag`、心声 `I.inner`、秘阵声 `I.arrayVoice`、书法大字 `I.big`、魏碑印章 `I.seal` 及自动对比度云雾衬底。
  - `js/lib-ledger.js`：由 `python3 tools/build-ledger.py` 从 `docs/TEXT-LEDGER.md` 自动生成的运行时字幕表。
- **本片专属高神韵动效与配音库**：
  - `js/lib-zhanlong.js`（2573 行，`CINE.zl` / `I.zl`）：20 项纯 `t` 确定性水墨矿物动效（`purpleCanopy`, `craneFlight`, `qiMeridians`, `tadpoleEdict`, `meltShadows`, `invertedDish`, `sixPathsWheel`, `timeRiver`, `abyssEyes`, `bloodChains`, `dragonSha`, `cyanLotusAndMist`, `inkBloodToJade`, `headToAsh`, `spiderEscape`, `rainbowBridge`, `starEmbryo`, `spiritDust`, `chronalVignette`, `slashImpact`）。
  - `js/audio.js` + `js/voice.js`：WebAudio 配乐分片调度、合成音效与角色配音滑窗解码及自动配乐闪避（`0.40`）。
- **七幕分幕实现（共 97 镜）**：
  - `js/act-prologue.js`（`0–75s`）、`js/act1.js`（`75–230s`）、`js/act2.js`（`230–420s`）、`js/act3.js`（`420–630s`）、`js/act4.js`（`630–870s`）、`js/act5.js`（`870–1130s`）、`js/act-coda.js`（`1130–1320s`）。

### 4. 配乐总谱与构建/验收工具（`tools/`）
- `tools/score/score-zhanlong.mjs` + `tools/score/lib.mjs`：全片七乐段国风交响总谱（2799 事件）。
- `tools/build-plates.sh`：将 `plates/*.webp`（73 张）打包为 `plates.js`。
- `tools/build-ledger.py`：将 `docs/TEXT-LEDGER.md` 编译为 `js/lib-ledger.js`。
- `tools/build-fonts.sh`：扫描全仓字符子集化生成 `fonts.js`。
- `tools/build-voices.py`：合成并混响处理 `docs/VOICE-SCRIPT.json` 生成 `voice-assets.js`（已处理好的 43 条 MP3 亦存于 `voice-src/processed/`）。
- `tools/filmstrip.mjs`：无头 Chrome 胶片条渲染与 `--det` 确定性校验器。
- `tools/det-run.py`：全片多进程自动二分容错 `--det` 确定性门禁运行器。
- `tools/sub-lint.mjs`：纸面与浏览器双模字幕节奏/跨镜/对比度门禁检查器。
- `tools/verify-audio.mjs`：配乐起播、31 点跳转对齐、静音窗与波形互相关门禁检查器。

---

## 二、核心修改守则与验收门禁

1. **纯 `t` 确定性**：任何画面只允许依赖 `t` 与固定整数种子（`CINE.util`），**严禁 `Math.random()`、`Date` 或跨帧可变状态**；`I.rig` 的 `script` 必须定义为模块级常量。
2. **南宋水墨与青绿界画审美**：严禁等宽几何圆环/椭圆（禁用裸 `ctx.arc(..., 0, Math.PI*2)`）、硬边直线、霓虹发光色、立绘矩形硬边；宣纸浅底上画亮色特效须先铺 `multiply` 焦墨/赭石衬底。
3. **立绘缩放公式**：`I.rig` 对竖版裁边立绘按宽度缩放，常规站立人物 `s ≈ 0.18 – 0.23`，近景 `0.28 – 0.35`，远景 `0.08 – 0.11`；`flip: 'h'` 会反转 `dx` 与 `cam.x`（请统一使用各幕内的 `rigAt` 辅助函数）。
4. **每次改动后的必跑门禁**：
   - 语法检查：`node --check js/*.js`
   - 字幕快检：`node tools/sub-lint.mjs --ledger docs/TEXT-LEDGER.md --hits docs/HITS.json --coscreen-allow docs/coscreen-allow.txt`
   - 局部胶片条渲染（单次 `<= 45` 帧）：`node tools/filmstrip.mjs --from <起秒> --to <止秒> --step 1 --thumb 320 --out /tmp/zl-chk`
   - 确定性检查：`python3 tools/det-run.py . /tmp/zl-det 1320 --jobs 3 --seg 32`
