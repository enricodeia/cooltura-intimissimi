#!/usr/bin/env bash
# V3 proxies of the campaign videos for the browser (WebGL textures + frame-exact seeks).
# Source: ~/Desktop/INTIMISSIMI VIDEO/{ARIA, ESTERNABILITÀ, NUDE LOOK, ULTRALIGHT WITH CASHMERE}
#   v3/grid/  432×768  GOP 6   the cards of the campaigns grid (≈45 play at once)
#   v3/feed/  576×1024 GOP 10  the two carousels (ARIA, ESTERNABILITÀ): bigger on screen
#   v3/hero.mp4 1080×1920      the opening video (full frame)
#
# Colour: the videos must look exactly as they do in QuickTime / Photos.
#  · HDR (HLG, BT.2020, 10 bit) and Display P3 sources go through macOS first
#    (avconvert = AVFoundation, the same conversion QuickTime shows), so they are
#    not flat and grey;
#  · everything is written as BT.709, limited range, and tagged as such.
# Duplicates in the folder (same file in two campaigns) are made once.
# V2 (Video Transf) is in archive/v2/tools/media.sh.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC="$HOME/Desktop/INTIMISSIMI VIDEO"
OUT=public/media/v3
SDR=media-src/v3 # SDR intermediates (gitignored)
mkdir -p "$OUT/grid" "$OUT/feed" "$SDR"

X264="-c:v libx264 -preset slow -profile:v high -pix_fmt yuv420p -an -movflags +faststart -sc_threshold 0"
TAGS="-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv"
SCALE=":flags=lanczos:out_range=tv:out_color_matrix=bt709"

# slug|campaign folder|file|start (s)|feed (1 = also a carousel proxy)
LIST=(
  "aria-alice-muzza|ARIA|Alice_Muzza_ENGAGE_V1_clean.MOV|1|1"
  "aria-asia-busciantella|ARIA|Asia_Busciantella_Engage_Clean (1).MOV|1|1"
  "aria-aurora-pederzoli|ARIA|Aurora_Pederzoli_Engage_Clean.mp4|1|1"
  "aria-beatrice-scintu|ARIA|Beatrice_Scintu_Recall_V1 (1).mp4|1|1"
  "aria-chiara-chelo|ARIA|Chiara_Chelo_ENGAGE_V1_Clean.mov|1|1"
  "aria-alessia-morelli|ARIA|Copy of Alessia_Morelli_AMPLIFY_V1.mov|1|1"
  "aria-alessia-morelli-spark|ARIA|Copy of Alessia_Morelli_SPAK_V3.mp4|1|1"
  "aria-chiara-chelo-spark|ARIA|Copy of Chiara_Chelo_SPARK_V2 (2).mov|1|1"
  "aria-chiara-parente|ARIA|Copy of Chiara_Parente_SPARK_V1 (2).mov|1|1"
  "aria-federica-bimbi|ARIA|Copy of Federica_Bimbi_AMPLIFY_V3.MOV|1|1"
  "aria-clean-look|ARIA|Copy of NO TESTI.mov|0.5|1"
  "aria-noemi-piunti|ARIA|Copy of Noemi_Piunti_SPARK_V1 (2).mp4|1|1"
  "aria-rachele-santoro|ARIA|Copy of Rachele_Santoro_AMPLIFY_V1.mp4|0.6|1"
  "aria-rebecca-maurino|ARIA|Copy of Rebecca_Maurino_ENGAGE_V2 (1) (1).mp4|1|1"
  "aria-corinne-pino|ARIA|Corinne_Pino_Engage_Clean.mp4|1|1"
  "aria-giulia-romanelli|ARIA|Giulia_Romanelli_ENGAGE_Clean.mov|1|1"
  "aria-laura-tanushi|ARIA|Laura_Tanushi_ENGAGE_Clean (1).mov|1|1"
  "ext-benedetta-quagli|ESTERNABILITÀ|Copy of Benedetta Quagli x Intimissimi - UL_CLEAN.mov|1|1"
  "ext-corinne-tiktok|ESTERNABILITÀ|Copy of CORINNE_TIKTOK_clean.mp4|1|1"
  "ext-coco-genge|ESTERNABILITÀ|Copy of Coco Genge x Intimissimi_NOTEXT.mp4|2.2|1"
  "ext-elettra-lastra|ESTERNABILITÀ|Copy of Elettra Lastra x Intimissimi - UL_CLEAN.mov|1|1"
  "ext-gaia-amati|ESTERNABILITÀ|Copy of Gaia Amati x Intimissimi - UL_CLEAN.mov|0.6|1"
  "ext-gaia-sgalia|ESTERNABILITÀ|Copy of Gaia Sgalia x Intimissimi - UL_CLEAN.mov|1|1"
  "ext-ginevra-beretta|ESTERNABILITÀ|Copy of Ginevra_Beretta_SPARK_V2.MOV|1|1"
  "ext-giorgia-mordenti|ESTERNABILITÀ|Copy of Giorgia mordenti x Intimissimi - UL_CLEAN.mov|0|1"
  "ext-noemi-piunti|ESTERNABILITÀ|Copy of Noemi Piunti x Intimissimi - UL_CLEAN.mp4|3.4|1"
  "ext-virginia-giva|ESTERNABILITÀ|Copy of Virginia Giva x Intimissimi - UL_CLEAN.MP4|1|1"
  "nude-asia-busciantella|NUDE LOOK|Copy of Asia Busciantella con super.MP4|0.5|0"
  "nude-aurora|NUDE LOOK|Copy of Aurora Clean HD Video 1.MOV|1|0"
  "nude-beatrice-scintu|NUDE LOOK|Copy of BeatriceScintu_TikTok.mp4|1|0"
  "nude-benedetta-vari|NUDE LOOK|Copy of Benedetta Vari con super.MP4|0.5|0"
  "nude-chiara-chelo|NUDE LOOK|Copy of Chiara Chelo Clean HD.mov|1|0"
  "nude-corinne-pino|NUDE LOOK|Copy of Corinne Pino con super.mp4|1|0"
  "nude-federica-scagnetti|NUDE LOOK|Copy of Federica Scagnetti con super.MOV|0.5|0"
  "nude-francesca-cuccuru|NUDE LOOK|Copy of FrancescaCuccuru_TikTok.mov|1|0"
  "nude-le-gemels|NUDE LOOK|Copy of Le Gemels HD.mp4|1|0"
  "nude-rebecca-maurino|NUDE LOOK|Copy of Rebecca Maurino HD.mov|1|0"
  "nude-jingherly|NUDE LOOK|Copy of TikTok_Jingherly.mov|0|0"
  "ul-rita-benedetto|ULTRALIGHT WITH CASHMERE|Copy of  Rita Benedetto x Intimissimi - UL CLEAN.mp4|1|0"
  "ul-aurora-pederzoli|ULTRALIGHT WITH CASHMERE|Copy of Auroa Pederzoli x Intimissimi - UL_CLEAN.MP4|1|0"
  "ul-benedetta-vari|ULTRALIGHT WITH CASHMERE|Copy of Benedetta Vari x Intimissimi - UL_CLEAN.MOV|6|0"
  "ul-chiara-chelo|ULTRALIGHT WITH CASHMERE|Copy of Chiara Chelo x Intimissimi - ULV2_CLEAN.mov|1|0"
  "ul-giulia-romanelli|ULTRALIGHT WITH CASHMERE|Copy of GIULIA ROMANELLI2 X INTIMISSIMI - UL_CLEANmov.mov|1|0"
  "ul-giorgia-malerba|ULTRALIGHT WITH CASHMERE|Copy of Giorgia Malerba x Intimissimi - UL_CLEAN.MOV|1|0"
  "ul-lisa-luchetta|ULTRALIGHT WITH CASHMERE|Copy of Lisa Luchetta x Intimissimi - UL_CLEAN.mov|1|0"
  "ul-matilde-parigi|ULTRALIGHT WITH CASHMERE|Copy of Matilde Parigi x INtimissimi - ULV2_CLEAn.MOV|0.5|0"
  "ul-nicky-passarella|ULTRALIGHT WITH CASHMERE|Copy of Nicky Passarella x Intimissimi - UL.MOV|1|0"
  "ul-rebecca-maurino|ULTRALIGHT WITH CASHMERE|Copy of Rebecca Maurino x Intimissimi - UL_clean.mp4|1|0"
  "ul-rossella-migliaccio|ULTRALIGHT WITH CASHMERE|Copy of Rossella Migliaccio x Intimissimi - UL_CLEAN.MP4.mp4|3.6|0"
  "ul-sara-costantini|ULTRALIGHT WITH CASHMERE|Copy of Sara Costantini x Intimissimi - UL_CLEAN NEW.MOV|1|0"
  "ul-sara-tibo|ULTRALIGHT WITH CASHMERE|Copy of Sara Tibo x Intimissimi - UL_CLEAN.MOV|1|0"
  "ul-sofia-greggi|ULTRALIGHT WITH CASHMERE|Copy of Sofia Greggi2 x Intimissimi - UL_CLEAN.mov|1|0"
)
HERO="aria-alice-muzza"

# HDR (HLG / PQ) or wide-gamut → SDR BT.709 through AVFoundation; prints the file to read from and the start offset left to apply
source_of() { # path start
  local file=$1 ss=$2 trc prim
  trc=$(ffprobe -v error -select_streams v:0 -show_entries stream=color_transfer -of csv=p=0 "$file" | tr -d ',')
  prim=$(ffprobe -v error -select_streams v:0 -show_entries stream=color_primaries -of csv=p=0 "$file" | tr -d ',')
  if [[ "$trc" == "arib-std-b67" || "$trc" == "smpte2084" || "$prim" == "smpte432" || "$prim" == "bt2020" ]]; then
    local base
    base=$(basename "${file%.*}")
    local sdr="$SDR/${base// /_}.mov"
    [ -f "$sdr" ] || avconvert -s "$file" -p Preset1920x1080 -o "$sdr" --start "$ss" --duration 13 --replace >/dev/null
    echo "$sdr|0"
  else
    echo "$file|$ss"
  fi
}

job() { # slug folder file start feed
  local slug=$1 dir=$2 file=$3 st=$4 feed=$5 in ss
  IFS='|' read -r in ss <<<"$(source_of "$SRC/$dir/$file" "$st")"
  [ -f "$OUT/grid/$slug.mp4" ] || ffmpeg -v error -y -ss "$ss" -i "$in" -t 7 \
    -vf "fps=30,scale=432:768:force_original_aspect_ratio=increase$SCALE,crop=432:768" \
    $X264 -crf 20 -g 6 -keyint_min 6 $TAGS "$OUT/grid/$slug.mp4"
  if [ "$feed" = "1" ] && [ ! -f "$OUT/feed/$slug.mp4" ]; then
    ffmpeg -v error -y -ss "$ss" -i "$in" -t 8 \
      -vf "fps=30,scale=576:1024:force_original_aspect_ratio=increase$SCALE,crop=576:1024" \
      $X264 -crf 19 -g 10 -keyint_min 10 $TAGS "$OUT/feed/$slug.mp4"
  fi
  if [ "$slug" = "$HERO" ] && [ ! -f "$OUT/hero.mp4" ]; then
    ffmpeg -v error -y -ss "$ss" -i "$in" -t 12 \
      -vf "fps=30,scale=1080:1920:force_original_aspect_ratio=increase$SCALE,crop=1080:1920" \
      $X264 -crf 17 -g 15 -keyint_min 15 $TAGS "$OUT/hero.mp4"
  fi
  echo "  ✓ $slug"
}

echo "grid + feed + hero"
for row in "${LIST[@]}"; do
  IFS='|' read -r slug dir file st feed <<<"$row"
  job "$slug" "$dir" "$file" "$st" "$feed" &
  while [ "$(jobs -rp | wc -l)" -ge 4 ]; do sleep 0.3; done
done
wait

echo "manifest"
{
  echo "{"
  first=1
  for f in "$OUT"/grid/*.mp4 "$OUT"/feed/*.mp4 "$OUT"/hero.mp4; do
    rel=${f#public/media/}
    d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
    [ $first -eq 1 ] || echo ","
    first=0
    printf '  "%s": %s' "$rel" "$d"
  done
  echo ""
  echo "}"
} >public/media/manifest.json
# the hard cuts inside the feed videos (the cards start their clips where they do not cut)
node "$(dirname "$0")/cuts.mjs" >/dev/null
du -sh "$OUT"
echo done
