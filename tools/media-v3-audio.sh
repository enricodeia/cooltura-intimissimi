#!/usr/bin/env bash
# The original sound of the v3 proxies, so ANY clip of V4's library can be the one who speaks.
# tools/media.sh cut the v3 videos silent; this cuts the sound of the same excerpt from the original source,
# at the same start as the picture, so media time 0 of the .mp4 is media time 0 of the .m4a:
#   public/media/v3/grid/<slug>.m4a   every row of media.sh's LIST (as long as its .mp4: 7 s)
#   public/media/v3/feed/<slug>.m4a   the rows with feed = 1 (8 s)
#   public/media/v3/hero.m4a          the opening video (12 s)
# Exactly media-v4.sh's sound: AAC 48 kHz stereo 192k, 70 Hz high-pass, levelled to about -18 LUFS
# (integrated loudness of the excerpt → gain, a limiter catches the peaks). The rows are read from
# tools/media.sh, so the two never disagree. Existing files are kept (delete one to redo it).
set -euo pipefail
cd "$(dirname "$0")/.."
SRC="$HOME/Desktop/INTIMISSIMI VIDEO"
OUT=public/media/v3
eval "$(sed -n '/^LIST=(/,/^)/p' tools/media.sh)"
HERO=$(sed -n 's/^HERO="\(.*\)"$/\1/p' tools/media.sh)

# slug|lead (s): proxies whose picture runs ahead of their source. Two sources at odd frame rates (21.4 and
# 18 fps) had their first frame put on slot 1 of media.sh's 30 fps grid, then moved to 0 by the muxer (that is
# why their mp4 is one frame short): their picture leads by ~50 ms (measured frame by frame against the source,
# 2026-11-24), so their sound starts that much later too. Every other proxy is within a frame of its start
# (the HDR ones too: avconvert's intermediates start exactly at start).
LEAD=(
  "ext-elettra-lastra|0.05"
  "ext-noemi-piunti|0.05"
)

lead_of() { # slug → seconds
  local row
  for row in "${LEAD[@]}"; do [ "${row%%|*}" = "$1" ] && { echo "${row#*|}"; return; }; done
  echo 0
}

dur_of() { # mp4 fallback → the picture's duration (a source that ends early, or a short first slot, makes it shorter)
  if [ -f "$1" ]; then ffprobe -v error -show_entries format=duration -of csv=p=0 "$1"; else echo "$2"; fi
}

sound() { # out source start dur
  local out=$1 file=$2 ss=$3 d=$4 I g
  [ -f "$out" ] && return 0
  # level: integrated loudness of the excerpt → gain to -18 LUFS (a limiter catches the peaks)
  I=$(ffmpeg -v info -ss "$ss" -t "$d" -i "$file" -vn -af "highpass=f=70,ebur128" -f null - 2>&1 | awk '/I:/{v=$2} END{print v}')
  g=$(python3 -c "i=float('$I' or -30); print(max(-12, min(18, -18 - i)))")
  # written aside, then moved: an interrupted run never leaves a half file that would be skipped next time
  ffmpeg -v error -y -ss "$ss" -t "$d" -i "$file" -vn -ac 2 -ar 48000 -af "highpass=f=70,volume=${g}dB,alimiter=limit=0.89:level=false" -c:a aac -b:a 192k "${out%.m4a}.part.m4a"
  mv "${out%.m4a}.part.m4a" "$out"
  echo "  $out  I=$I LUFS → +${g} dB"
}

row() { # slug folder file start feed
  local slug=$1 file="$SRC/$2/$3" feed=$5 ss
  ss=$(python3 -c "print(round($4 + $(lead_of "$slug"), 3))")
  sound "$OUT/grid/$slug.m4a" "$file" "$ss" "$(dur_of "$OUT/grid/$slug.mp4" 7)"
  if [ "$feed" = "1" ]; then sound "$OUT/feed/$slug.m4a" "$file" "$ss" "$(dur_of "$OUT/feed/$slug.mp4" 8)"; fi
  if [ "$slug" = "$HERO" ]; then sound "$OUT/hero.m4a" "$file" "$ss" "$(dur_of "$OUT/hero.mp4" 12)"; fi
  echo "  ✓ $slug"
}

for r in "${LIST[@]}"; do
  IFS='|' read -r slug dir file st feed <<<"$r"
  row "$slug" "$dir" "$file" "$st" "$feed" &
  while [ "$(jobs -rp | wc -l)" -ge 3 ]; do sleep 0.3; done
done
wait

# check: every .m4a as long as its .mp4 (± 0.03 s), 48 kHz, stereo
python3 - <<'PY'
import glob, subprocess
def probe(f, what):
    return subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_entries', what, '-of', 'csv=p=0', f]).decode().strip()
files = sorted(f for f in glob.glob('public/media/v3/*/*.m4a') + glob.glob('public/media/v3/*.m4a') if '.part.' not in f)
bad = []
for a in files:
    v = a[:-4] + '.mp4'
    da = float(probe(a, 'format=duration'))
    dv = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', v]).decode().strip())
    sr, ch = probe(a, 'stream=sample_rate,channels').split(',')
    if abs(da - dv) > 0.03 or sr != '48000' or ch != '2':
        bad.append(f'{a}: {da:.3f} s (mp4 {dv:.3f} s), {sr} Hz, {ch} ch')
print(f'{len(files)} sounds, {len(bad)} off:', *bad, sep='\n  ' if bad else ' ')
PY
du -ch "$OUT"/*/*.m4a "$OUT"/*.m4a | tail -1
