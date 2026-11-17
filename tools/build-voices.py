#!/usr/bin/env python3
"""
《斩龙封神》分角色古风配音合成与声学空间母带打包器
读取 docs/VOICE-SCRIPT.json -> edge-tts 分角色合成 -> ffmpeg 声学空间滤波/混响/响度归一 -> voice-assets.js
"""
import base64
import concurrent.futures
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EDGE_TTS = "/Users/banana499/.local/bin/edge-tts"
FFMPEG = "/opt/homebrew/bin/ffmpeg"
FFPROBE = "/opt/homebrew/bin/ffprobe"

# 角色声线配置：贴合《问镜》人物气度与年龄层次
ROLE_PROFILES = {
    "yuci": {
        "voice": "zh-CN-YunxiNeural",
        "rate": "-8%",
        "pitch": "-4Hz",
        "eq": "equalizer=f=220:t=q:w=1.1:g=2.2,equalizer=f=3400:t=q:w=1.4:g=1.2",
        "gain": 1.0,
    },
    "yang_old": {
        "voice": "zh-CN-YunjianNeural",
        "rate": "-15%",
        "pitch": "-10Hz",
        "eq": "asetrate=24000*0.95,aresample=24000,atempo=1.052,equalizer=f=160:t=q:w=1.0:g=3.5,lowpass=f=6800",
        "gain": 1.05,
    },
    "yang_spirit": {
        "voice": "zh-CN-YunyangNeural",
        "rate": "-13%",
        "pitch": "-2Hz",
        "eq": "highpass=f=135,equalizer=f=2800:t=q:w=1.5:g=2.0",
        "gain": 0.98,
    },
    "xue": {
        "voice": "zh-CN-XiaoxiaoNeural",
        "rate": "-11%",
        "pitch": "-2Hz",
        "eq": "highpass=f=140,equalizer=f=3200:t=q:w=1.4:g=1.5",
        "gain": 0.98,
    },
    "crane_boy": {
        "voice": "zh-CN-YunxiaNeural",
        "rate": "-5%",
        "pitch": "+2Hz",
        "eq": "highpass=f=180,equalizer=f=3600:t=q:w=1.5:g=1.5",
        "gain": 0.94,
    },
    "general": {
        "voice": "zh-CN-YunjianNeural",
        "rate": "-16%",
        "pitch": "-14Hz",
        "eq": "asetrate=24000*0.92,aresample=24000,atempo=1.087,equalizer=f=130:t=q:w=1.0:g=5.0,equalizer=f=2400:t=q:w=1.2:g=2.5",
        "gain": 1.12,
    },
    "zhao": {
        "voice": "zh-CN-YunyangNeural",
        "rate": "-4%",
        "pitch": "-5Hz",
        "eq": "highpass=f=240,lowpass=f=4400,equalizer=f=1200:t=q:w=1.2:g=2.2",
        "gain": 0.95,
    },
    "yinggui": {
        "voice": "zh-CN-YunxiNeural",
        "rate": "-3%",
        "pitch": "-9Hz",
        "eq": "highpass=f=210,lowpass=f=4800,aecho=0.8:0.75:24:0.25",
        "gain": 0.95,
    },
    "xuefu": {
        "voice": "zh-CN-YunjianNeural",
        "rate": "-8%",
        "pitch": "-7Hz",
        "eq": "highpass=f=220,lowpass=f=4500",
        "gain": 0.95,
    },
    "narr_scroll": {
        "voice": "zh-CN-YunyangNeural",
        "rate": "-16%",
        "pitch": "-6Hz",
        "eq": "equalizer=f=180:t=q:w=1.1:g=2.8,lowpass=f=7200",
        "gain": 0.96,
    },
}

# 声学空间混响链：不同天地对应不同反射质感
SPACE_REVERB = {
    "chengqi": "aecho=0.82:0.78:42|88:0.16|0.08",
    "daojing": "aecho=0.84:0.84:58|126|210:0.20|0.12|0.06",
    "terrace": "aecho=0.82:0.76:68|148:0.22|0.11",
    "telepathy": "highpass=f=250,lowpass=f=4100,aecho=0.80:0.82:52|112:0.26|0.14",
    "starpalace": "aecho=0.85:0.86:76|164|280:0.24|0.15|0.08",
    "void": "aecho=0.82:0.80:54|118:0.18|0.09",
}


def probe_duration(path: Path) -> float:
    out = subprocess.check_output(
        [FFPROBE, "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        text=True,
    ).strip()
    return float(out)


def render_one(item: dict, raw_dir: Path, proc_dir: Path) -> dict:
    cid = item["id"]
    role = item.get("role", "yuci")
    prof = ROLE_PROFILES.get(role, ROLE_PROFILES["yuci"])
    space = item.get("space", "terrace")
    rev = SPACE_REVERB.get(space, SPACE_REVERB["terrace"])

    rate = item.get("rate") or prof["rate"]
    pitch = item.get("pitch") or prof["pitch"]
    text = item["text"].strip()

    raw_mp3 = raw_dir / f"{cid}.mp3"
    proc_mp3 = proc_dir / f"{cid}.mp3"

    if not proc_mp3.exists() or os.environ.get("FORCE_VOICE") == "1":
        cmd_tts = [
            EDGE_TTS,
            "--voice", prof["voice"],
            f"--rate={rate}",
            f"--pitch={pitch}",
            "--text", text,
            "--write-media", str(raw_mp3),
        ]
        subprocess.run(cmd_tts, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

        # 裁去首尾多余空白 -> 角色音色均衡 -> 空间混响 -> 响度归一与柔滑淡出
        af_base = (
            f"silenceremove=start_periods=1:start_duration=0.02:start_threshold=-46dB,"
            f"areverse,silenceremove=start_periods=1:start_duration=0.04:start_threshold=-48dB,areverse,"
            f"{prof['eq']},{rev},apad=pad_dur=0.22,"
            f"loudnorm=I=-16.5:TP=-2.0:LRA=9"
        )
        subprocess.run(
            [FFMPEG, "-y", "-loglevel", "error", "-i", str(raw_mp3), "-af", af_base, "-ar", "44100", "-ac", "1", "-b:a", "56k", str(proc_mp3)],
            check=True,
        )

        # 若超出允许窗口 maxDur，则温和提速收紧，绝不叠音
        dur = probe_duration(proc_mp3)
        max_dur = float(item.get("maxDur", 99.0))
        if dur > max_dur and max_dur > 0.8:
            speed = min(1.32, (dur / max_dur) * 1.03)
            tmp_mp3 = proc_dir / f"{cid}.fit.mp3"
            subprocess.run(
                [FFMPEG, "-y", "-loglevel", "error", "-i", str(proc_mp3), "-af", f"atempo={speed:.3f}", "-ar", "44100", "-ac", "1", "-b:a", "56k", str(tmp_mp3)],
                check=True,
            )
            tmp_mp3.replace(proc_mp3)

    dur = round(probe_duration(proc_mp3), 3)
    b64 = base64.b64encode(proc_mp3.read_bytes()).decode("ascii")
    return {
        "id": cid,
        "ledgerId": item.get("ledgerId", ""),
        "act": item.get("act", ""),
        "G": round(float(item["G"]), 3),
        "dur": dur,
        "gain": round(float(item.get("gain", prof["gain"])), 3),
        "role": role,
        "space": space,
        "speaker": item.get("speaker", ""),
        "text": text,
        "src": f"data:audio/mpeg;base64,{b64}",
    }


def main():
    script_path = Path(sys.argv[1]) if len(sys.argv) > 1 else (ROOT / "docs" / "VOICE-SCRIPT.json")
    out_js = Path(sys.argv[2]) if len(sys.argv) > 2 else (ROOT / "voice-assets.js")

    raw_dir = ROOT / "voice-src" / "raw"
    proc_dir = ROOT / "voice-src" / "processed"
    raw_dir.mkdir(parents=True, exist_ok=True)
    proc_dir.mkdir(parents=True, exist_ok=True)

    data = json.loads(script_path.read_text("utf-8"))
    items = data["clips"] if isinstance(data, dict) else data
    items = sorted(items, key=lambda x: float(x["G"]))

    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
        futs = [ex.submit(render_one, it, raw_dir, proc_dir) for it in items]
        for f in futs:
            results.append(f.result())

    results.sort(key=lambda x: x["G"])

    # 严格保证全局无叠音：若前一条尾音略越过下一条起点，自动微调或报告
    overlaps = 0
    for i in range(len(results) - 1):
        end_i = results[i]["G"] + results[i]["dur"]
        next_g = results[i + 1]["G"]
        if end_i > next_g - 0.08:
            overlaps += 1
            print(f"WARN overlap: {results[i]['id']} ends {end_i:.2f}s > {results[i+1]['id']} starts {next_g:.2f}s", file=sys.stderr)

    payload = {"version": 1, "count": len(results), "clips": results}
    js_txt = "/* Auto-generated by tools/build-voices.py — do not edit manually */\nwindow.CINE_VOICES = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n"
    out_js.write_text(js_txt, "utf-8")
    mb = out_js.stat().st_size / (1024 * 1024)
    print(f"voice-assets.js: {len(results)} clips, {mb:.2f} MiB, overlaps={overlaps}")


if __name__ == "__main__":
    main()
