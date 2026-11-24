#!/usr/bin/env bash
# V4 (Brief V2) clips: the creators' moments WITH their original audio.
# Each clip is one excerpt of a source in ~/Desktop/INTIMISSIMI VIDEO, cut at the same
# start for picture and sound, so media time 0 of the .mp4 is media time 0 of the .m4a:
#   public/media/v4/<slug>.mp4   1080 × 1920, 30 fps, GOP 10, BT.709 (HDR / P3 through avconvert)
#   public/media/v4/<slug>.m4a   AAC 48 kHz stereo, 70 Hz high-pass, levelled to about -18 LUFS
# then the durations are merged into public/media/manifest.json (keys v4/<slug>.mp4).
set -euo pipefail
cd "$(dirname "$0")/.."
SRC="$HOME/Desktop/INTIMISSIMI VIDEO"
OUT=public/media/v4
SDR=media-src/v4
mkdir -p "$OUT" "$SDR"
X264="-c:v libx264 -preset slow -profile:v high -pix_fmt yuv420p -an -movflags +faststart -sc_threshold 0 -crf ${CRF:-18} -g 10 -keyint_min 10"
TAGS="-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv"
VF="fps=30,scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos:out_range=tv:out_color_matrix=bt709,crop=1080:1920"

# slug|folder|file|start (s)|duration (s)
LIST=(
  "open-sara|ULTRALIGHT WITH CASHMERE|Copy of Sara Tibo x Intimissimi - UL_CLEAN.MOV|0|4"
  "hero-alice|ARIA|Alice_Muzza_ENGAGE_V1_clean.MOV|9.4|5.6"
  "hero-chiara|ARIA|Copy of Chiara_Chelo_SPARK_V2 (2).mov|94.9|6.5"
  "comm-corinne|ARIA|Corinne_Pino_Engage_Clean.mp4|38.8|5.5"
  "venice-chiara|NUDE LOOK|Copy of Chiara Chelo Clean HD.mov|46.6|6"
  "venice-duo|NUDE LOOK|Copy of Chiara Chelo Clean HD.mov|0|5"
  "venice-walk|NUDE LOOK|Copy of TikTok_Jingherly.mov|0|6.5"
  "venice-gemels|NUDE LOOK|Copy of Le Gemels HD.mp4|0.5|6"
  "venice-cuccuru|NUDE LOOK|Copy of FrancescaCuccuru_TikTok.mov|57|6"
  "venice-dance|NUDE LOOK|Copy of Rebecca Maurino HD.mov|44.6|3.5"
  "venice-rebecca|NUDE LOOK|Copy of Rebecca Maurino HD.mov|2.9|4"
  # the library of voiced moments (2026-11-23 night): one per Aria creator, so any of them can be the
  # one who comes forward in the wheel and speak; Rebecca on the Venice terrace (one shot, to camera)
  "aria-asia|ARIA|Asia_Busciantella_Engage_Clean (1).MOV|12.9|8.6"
  "aria-aurora|ARIA|Aurora_Pederzoli_Engage_Clean.mp4|5.3|7"
  "aria-giulia|ARIA|Giulia_Romanelli_ENGAGE_Clean.mov|15.8|7"
  "aria-noemi|ARIA|Copy of Noemi_Piunti_SPARK_V1 (2).mp4|17.7|7"
  "aria-rebecca|ARIA|Copy of Rebecca_Maurino_ENGAGE_V2 (1) (1).mp4|26.6|7"
  "aria-alessia|ARIA|Copy of Alessia_Morelli_SPAK_V3.mp4|40.6|6.4"
  "aria-parente|ARIA|Copy of Chiara_Parente_SPARK_V1 (2).mov|27.4|7"
  "venice-terrace|NUDE LOOK|Copy of Rebecca Maurino HD.mov|32.5|4.72"
  "venice-aurora|NUDE LOOK|Copy of Aurora Clean HD Video 1.MOV|25.4|6"
)

clip() { # slug folder file start dur
  local slug=$1 file="$SRC/$2/$3" ss=$4 d=$5 in trc prim
  trc=$(ffprobe -v error -select_streams v:0 -show_entries stream=color_transfer -of csv=p=0 "$file" | tr -d ',')
  prim=$(ffprobe -v error -select_streams v:0 -show_entries stream=color_primaries -of csv=p=0 "$file" | tr -d ',')
  in="$file"
  local vss=$ss
  if [[ "$trc" == "arib-std-b67" || "$trc" == "smpte2084" || "$prim" == "smpte432" || "$prim" == "bt2020" ]]; then
    in="$SDR/$slug.mov"
    [ -f "$in" ] || avconvert -s "$file" -p Preset1920x1080 -o "$in" --start "$ss" --duration "$d" --replace >/dev/null
    vss=0
  fi
  [ -f "$OUT/$slug.mp4" ] || ffmpeg -v error -y -ss "$vss" -i "$in" -t "$d" -vf "$VF" $X264 $TAGS "$OUT/$slug.mp4"
  if [ ! -f "$OUT/$slug.m4a" ]; then
    # level: integrated loudness of the excerpt → gain to -18 LUFS (a limiter catches the peaks)
    local I
    I=$(ffmpeg -v info -ss "$ss" -t "$d" -i "$file" -vn -af "highpass=f=70,ebur128" -f null - 2>&1 | awk '/I:/{v=$2} END{print v}')
    local g
    g=$(python3 -c "i=float('$I' or -30); print(max(-12, min(18, -18 - i)))")
    ffmpeg -v error -y -ss "$ss" -t "$d" -i "$file" -vn -ac 2 -ar 48000 -af "highpass=f=70,volume=${g}dB,alimiter=limit=0.89:level=false" -c:a aac -b:a 192k "$OUT/$slug.m4a"
    echo "  $slug  I=$I LUFS → +${g} dB"
  fi
  echo "  ✓ $slug"
}

for row in "${LIST[@]}"; do
  IFS='|' read -r slug dir file st d <<<"$row"
  clip "$slug" "$dir" "$file" "$st" "$d" &
  while [ "$(jobs -rp | wc -l)" -ge 3 ]; do sleep 0.3; done
done
wait

# durations into the manifest
python3 - <<'PY'
import json, subprocess, glob, os
m = json.load(open('public/media/manifest.json'))
for k in [k for k in m if k.startswith('v4/')]: del m[k]
for f in sorted(glob.glob('public/media/v4/*.mp4')):
    d = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).decode().strip())
    m['v4/' + os.path.basename(f)] = round(d, 6)
json.dump(m, open('public/media/manifest.json', 'w'), indent=2)
print('manifest:', len([k for k in m if k.startswith('v4/')]), 'v4 clips')
PY
du -sh "$OUT"
