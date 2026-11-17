# 字体说明

`../fonts.js` 以 base64 data-URI 内嵌下列四款字体的子集（file:// 下 Chrome 拦截外链字体，所以只能内嵌）。

- 前三款为 SIL Open Font License 1.1，许可证原文见本目录 `OFL-*.txt`；子集是 OFL 允许的修改版本，保留了原字体名（均未声明 Reserved Font Name）。
- 台词字体沿革：霞鹜文楷 →（2026-10-10）思源宋体 →（2026-10-11，强化轮三，用户拍板）换回霞鹜文楷。`OFL-NotoSerifSC.txt` 保留存档。
- 狂草「去你妈的！」原用刘建毛草，2026-10-11 用户反馈太潦草认不出，改用志莽行书（`CINE.FONT.wild` 保留为 sword 的别名）；`OFL-LiuJianMaoCao.txt` 保留存档。
- 碑体（第四款）为 **GNU GPL v2（或更新版）**，见下节。

| 用途 | 字体族名 | 源文件 | 来源与版本 | 源文件 sha256 | 许可 |
|---|---|---|---|---|---|
| 诗、片名、幕卡、题签名字、碑字（碑体缺字时） | Ma Shan Zheng | MaShanZheng-Regular.ttf（5,857,936 B） | github.com/google/fonts `ofl/mashanzheng/`，main@23e54b51 | 6d2546bb189c732a8ca29af9e22457b152387d158aa459e4ac2ce1e51788b7fb | OFL-1.1 |
| 台词、旁白、UI、题签身份 | LXGW WenKai | LXGWWenKai-Regular.ttf（25,575,676 B） | github.com/lxgw/LxgwWenKai release v1.522 | 39ad71264b588165b469e35e6afb162a378dacd1f95348160240ba9038ac3009 | OFL-1.1 |
| 剑写血字、幕名、片名、「去你妈的！」 | Zhi Mang Xing | ZhiMangXing-Regular.ttf（4,063,532 B） | github.com/google/fonts `ofl/zhimangxing/`，main@23e54b51 | 644e0cae9b40f0b10ab729a01bd32032e3973bac22be3dccae01bf6ae7fde969 | OFL-1.1 |
| 碑刻「时不我待」 | WHZ WeiBei（改名后） | wts43.ttf「王汉宗中魏碑简」（10,520,732 B） | 王汉宗自由字型 wangfonts 1.3.0：code.google.com/archive/p/wangfonts → `wangfonts-1.3.0.zip`（134,088,455 B，sha1 152e17d0bd169c89d438fc0f8daaa0319cd2c6e7，即项目页公布值） | 0ba4b5398dbb98e4dcc86a781928bd056db66248ee4224e594db733c6b4dcd4e | GPL-2.0-or-later |

## 碑体的 GPL 说明

- 原字体：王汉宗教授 2004 年捐出的自由字型之一「王汉宗中魏碑简」（英文名 HanWang WeiBeiMedium-Gb5），版权 (C) Dr. Hann-Tzong Wang 2002–2004，以 GNU GPL v2 或更新版发布。许可全文（随原字体包分发的 `license.txt` 原样拷贝）见本目录 `GPL-2.0-WangHanZong.txt`。
- 本片的修改：按用户 2026-10-11 的决定只取「时不我待」四个字做子集；该字体的 cmap 是 Big5 码位（繁体码位上画的是简体字形），所以子集化前给「时」(U+65F6) 补了一条指向「時」(U+6642) 字形的码位；族名改为 `WHZ WeiBei`（GPL 允许改名）。做法见 `../tools/build-fonts.sh` 第 2 步。
- 源：子集本身就是完整可编辑的 TrueType 字形数据（`fonts.js` 里 `WHZ WeiBei` 那段 base64，解码即得 woff2），原字体按上表地址可取。
- 只有 `fonts.js` 里的这一段字体受 GPL 约束；页面其余代码只是和它放在一起，不构成衍生作品。

## 子集化

- 字符清单在 `../tools/font-charsets/`：`poem.txt`、`sword.txt`、`stele.txt` 手工维护（`#` 开头为注释）；`text.txt` 由脚本自动生成＝`BRIEF.md`、`index.html`、`js/*.js` 中全部 CJK 字符与中文/全角标点 ∪ ASCII 可见字符 ∪ 其余三份清单。
- `pyftsubset`：保留全部 OpenType 特性、去 hinting、去子程序化；fontTools 有 brotli 时输出 woff2，否则退回 woff（zlib）。本机 Homebrew 的 pyftsubset 没有 brotli，用 miniforge 的：`PYFTSUBSET=~/miniforge3/bin/pyftsubset`。
- 脚本会用源字体 cmap 报告每份清单里字体本身没有的字（「缺字」）。
- 碑体只收四个字；二幕双碑、三幕戒律碑用 `CINE.FONT.stele` 时，除这四个字以外都落到回退栈里的马善政（那些碑字收在 `poem.txt`）。

## 重建

改了台词/旁白或 `js/*.js` 后需重建（否则新字会回退到楷体）：

```sh
FONT_SRC=/path/to/源字体目录 PYFTSUBSET=~/miniforge3/bin/pyftsubset sh tools/build-fonts.sh
```

源字体不入仓库；按上表地址下载并核对 sha256（wts43.ttf 从 zip 里解出）。脚本同时刷新 `../fonts-test.html` 里的字符清单；用浏览器打开该页，标题栏显示 `PASS` 即四款字体均生效且无缺字（判定法：同一字符分别配两种不同回退栈渲染，像素一致即字体自身有字形）。
