#!/usr/bin/env bash
# Proxies of the creator videos for the browser (WebGL textures + frame-exact seeks).
#   grid/  432×768  GOP 6   the cards, the row, the sphere (≈30 play at once)
#   feed/  576×1024 GOP 10  phone feed, roadmap circles
#   hero.mp4 1080×1920      the opening full-frame video
#
# Colour: the videos must look exactly as they do in QuickTime / Photos.
#  · three sources are HDR (HLG, BT.2020, 10 bit): macOS converts them to SDR first
#    (avconvert = AVFoundation, the same tone mapping QuickTime shows), so they
#    are not flat and grey;
#  · everything is written as BT.709, limited range, and tagged as such (the
#    full-range phone clips are converted, not just relabelled).
# Sources: ~/Desktop/Video Transf (VIDEO CLEAN + the presentation wall recording,
# which is the only place with GIOIA / NUDE LOOK footage: those tiles are cropped out).
set -euo pipefail
cd "$(dirname "$0")/.."
SRC="$HOME/Desktop/Video Transf/VIDEO CLEAN"
WALL="$HOME/Desktop/Video Transf/Cooltura x Intimissimi - Creative Workshop & Business Review.mp4"
OUT=public/media
SDR=media-src # SDR intermediates of the HDR clips (gitignored)
mkdir -p "$OUT/grid" "$OUT/feed" "$SDR"

X264="-c:v libx264 -preset slow -profile:v high -pix_fmt yuv420p -an -movflags +faststart -sc_threshold 0"
TAGS="-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv"
SCALE=":flags=lanczos:out_range=tv:out_color_matrix=bt709"

# slug|file|start (s)
LIST=(
  "alessia-morelli|Alessia_Morelli_AMPLIFY_V1_Clean.mov|1"
  "alessia-stefani|Alessia_Stefani_Amplify_Clean.MP4|1"
  "beatrice-curina|Beatrice_Curina_AMPLIFY_Clean.mp4|1"
  "carola-solgato|Carola_Solgato_AMPLIFY_V3_Clean.mp4|0.5"
  "chiara-chelo|Chiara_Chelo_AMPLIFY_V2_Clean.mov|1"
  "daria-zeccardo|Daria_Zeccardo_Amplify_Clean.mov|0.4"
  "eleonora-riva|Eleonora_Riva_Amplify_Clean.MOV|1"
  "fabiana-la-torre|Fabiana_La_Torre_AMPLIFY_V1_Clean.MP4|1"
  "federica-gibellini|Federica_Gibellini_AMPLIFY_Clean.mp4|5"
  "francesca-bergesio|Francesca_Bergesio_Amplify_V2_clean.MOV|1"
  "giorgia-radaelli|Giorgia_Radaelli_AMPLIFY_V2_Clean.mov|1"
  "laura-tanushi|Laura_Tanushi_Amplify_Clean.mov|0.5"
  "maria-facchinelli|Maria_Facchinelli_AMPLIFY_V2_Clean.mov|2"
  "marta-carruozzo|Marta_Carruozzo_Amplify_Clean.mov|1"
  "martina-trinca|Martina_Trinca_Amplify_Clean.mov|1"
  "nicole-bonsignori|Nicole_Bonsignori_Amplify_Clean.mp4|1"
  "nicole-pieretto|Nicole_Pieretto_AMPLIFY_V3_Clean.mov|0"
  "rachele-santoro|Rachele_Santoro_AMPLIFY_V1_Clean.mp4|1"
  "selvaggia-may|Selvaggia_May_Amplify_Clean.mov|2"
  "serena-asara|Serena_Asara_Amplify_V1_Clean.mp4|0.4"
  "silvia-mongelluzzo|Silvia_Mongelluzzo_AMPLIFY_V1_Clean.mov|2"
  "sorelle-caressa|Sorelle_Caressa_AMPLIFY_V1_Clean.mp4|2"
  "virginia-labella|Virginia_LaBella_Amplify_Clean.mov|2"
  "creator-25|f8729f1ce4634f238eb6fce2df7b7401.mov|1"
)
# tiles of the presentation wall: slug|x|y (380×704 crops of the 3622×2288 recording)
CROPS=(
  "gioia|187|789"
  "nude-look|3230|789"
  "girls-night|2795|789"
  "venezia|461|1563"
  "red-carpet|895|1563"
)
FEED=(nicole-pieretto marta-carruozzo carola-solgato maria-facchinelli selvaggia-may silvia-mongelluzzo francesca-bergesio virginia-labella)
# the video on top of the pile becomes the phone's screen: one long take in both sizes,
# so it runs unbroken from the sphere to the phone (film time t ↔ media time t - 1)
LONG=marta-carruozzo

# HDR (HLG / PQ) → SDR through AVFoundation; prints the file to read from and the start offset left to apply
source_of() { # file start
  local file=$1 ss=$2
  local trc
  trc=$(ffprobe -v error -select_streams v:0 -show_entries stream=color_transfer -of csv=p=0 "$SRC/$file" | tr -d ',')
  if [[ "$trc" == "arib-std-b67" || "$trc" == "smpte2084" ]]; then
    local sdr="$SDR/${file%.*}.mov"
    [ -f "$sdr" ] || avconvert -s "$SRC/$file" -p Preset1920x1080 -o "$sdr" --start "$ss" --duration 8 --replace >/dev/null
    echo "$sdr|0"
  else
    echo "$SRC/$file|$ss"
  fi
}

job() { # slug file start
  local slug=$1 in ss gd=7 fd=6
  IFS='|' read -r in ss <<<"$(source_of "$2" "$3")"
  if [ "$slug" = "$LONG" ]; then gd=13; fd=13; fi
  [ -f "$OUT/grid/$slug.mp4" ] || ffmpeg -v error -y -ss "$ss" -i "$in" -t $gd \
    -vf "fps=30,scale=432:768:force_original_aspect_ratio=increase$SCALE,crop=432:768" \
    $X264 -crf 20 -g 6 -keyint_min 6 $TAGS "$OUT/grid/$slug.mp4"
  if [[ " ${FEED[*]} " == *" $slug "* ]] && [ ! -f "$OUT/feed/$slug.mp4" ]; then
    ffmpeg -v error -y -ss "$ss" -i "$in" -t $fd \
      -vf "fps=30,scale=576:1024:force_original_aspect_ratio=increase$SCALE,crop=576:1024" \
      $X264 -crf 19 -g 10 -keyint_min 10 $TAGS "$OUT/feed/$slug.mp4"
  fi
  echo "  ✓ $slug"
}

echo "grid + feed"
for row in "${LIST[@]}"; do
  IFS='|' read -r slug file ss <<<"$row"
  job "$slug" "$file" "$ss" &
  while [ "$(jobs -rp | wc -l)" -ge 4 ]; do sleep 0.3; done
done
wait

echo "wall crops"
for row in "${CROPS[@]}"; do
  IFS='|' read -r slug x y <<<"$row"
  [ -f "$OUT/grid/$slug.mp4" ] || ffmpeg -v error -y -ss 0 -i "$WALL" -t 7 \
    -vf "crop=380:704:$x:$y,fps=30,scale=432:768:force_original_aspect_ratio=increase$SCALE,crop=432:768" \
    $X264 -crf 20 -g 6 -keyint_min 6 $TAGS "$OUT/grid/$slug.mp4" &
  [ -f "$OUT/feed/$slug.mp4" ] || ffmpeg -v error -y -ss 0 -i "$WALL" -t 6 \
    -vf "crop=380:704:$x:$y,fps=30,scale=576:1024:force_original_aspect_ratio=increase$SCALE,crop=576:1024" \
    $X264 -crf 19 -g 10 -keyint_min 10 $TAGS "$OUT/feed/$slug.mp4" &
  wait
  echo "  ✓ $slug"
done

echo "hero"
[ -f "$OUT/hero.mp4" ] || ffmpeg -v error -y -i "$SRC/Nicole_Pieretto_AMPLIFY_V3_Clean.mov" \
  -vf "fps=30,scale=1080:1920:force_original_aspect_ratio=increase$SCALE,crop=1080:1920" \
  $X264 -crf 17 -g 15 -keyint_min 15 $TAGS "$OUT/hero.mp4"

echo "manifest"
{
  echo "{"
  first=1
  for f in "$OUT"/grid/*.mp4 "$OUT"/feed/*.mp4 "$OUT"/hero.mp4; do
    rel=${f#"$OUT/"}
    d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
    [ $first -eq 1 ] || echo ","
    first=0
    printf '  "%s": %s' "$rel" "$d"
  done
  echo ""
  echo "}"
} >"$OUT/manifest.json"
du -sh "$OUT"
echo done
