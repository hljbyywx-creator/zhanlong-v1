#!/bin/sh
# usage: sh gen.sh <id> <suffix> <style-file-basename> [ref.png ...]
# Uses Magpie gateway configured in ~/.codex/config.toml with model gpt-6.1-sol and reasoning_effort=high (no fast tier).
set -u
B=/Users/banana499/Desktop/liige-video/zhanlong-v1/plates-src
mkdir -p "$B/${OUTDIR:-samples}" "$B/logs"
id="$1"; suf="$2"; style="$3"; shift 3
out="$B/${OUTDIR:-samples}/$id-$suf.png"
if [ -f "$out" ] && [ "${FORCE:-0}" != "1" ]; then
  echo "SKIP existing $out"
  exit 0
fi

body="$(cat "$B/prompts/$id.txt")

$(cat "$B/prompts/$style")"

refs=""; imgs=""
for r in "$@"; do
  refs="$refs $r"
  imgs="$imgs -i $r"
done

if [ -n "$refs" ]; then
  refnote="Pass these files to image_gen as referenced images (referenced_image_paths, in this order):$refs . They are references ONLY for character identity / object form / brushwork lineage as stated in the prompt; compose a fresh scene as described."
else
  refnote="Do not pass any reference images."
fi

task="You are strictly an image-generation operator. Call the image_gen tool (image_gen__imagegen) exactly ONCE with the prompt between the markers below, passed verbatim (do not shorten, rewrite, or reinterpret creative details). $refnote
After the tool finishes, locate the newly generated PNG file (under ~/.codex/generated_images/) and copy it via cp/python to this exact destination path: $out
Do not inspect, critique, or regenerate the image.
The last line of your reply must be 'DONE $out' if $out exists and is non-empty, or 'FAIL <reason>' otherwise.
=== PROMPT START ===
$body
=== PROMPT END ==="

for try in 1 2 3 4; do
  # shellcheck disable=SC2086
  codex exec -m gpt-6.1-sol -c model_reasoning_effort="${EFFORT:-high}" -c service_tier="default" --skip-git-repo-check -s workspace-write --add-dir "$B" -C "$B/${OUTDIR:-samples}" "$task" $imgs < /dev/null > "$B/logs/$id-$suf.log" 2>&1
  rc=$?
  [ -s "$out" ] && break
  if grep -q -i -E "429|Too Many Requests|usage.?limit|rate.?limit|quota|exceeded" "$B/logs/$id-$suf.log"; then
    echo "LIMIT $id-$suf try $try $(date +%H:%M:%S)" >> "$B/logs/LIMITS.txt"
    sleep 120
  else
    [ $try -ge 2 ] && break
    sleep 10
  fi
done

echo "exit=$rc $(tail -n 2 "$B/logs/$id-$suf.log" | tr '\n' ' ')"
ls -lh "$out" 2>/dev/null
