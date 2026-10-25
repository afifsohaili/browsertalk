#!/bin/sh
set -e
cd "$(dirname "$0")"

PREVIEW="${PREVIEW:-0}"
SCALE="${SCALE:-2}"
WIDTH="${WIDTH:-1280}"
HUD="${HUD:-0}"

if [ "$PREVIEW" = "1" ]; then
  SCALE="${PREVIEW_SCALE:-1}"
  WIDTH="${WIDTH:-480}"
  PRESET="${PRESET:-ultrafast}"
  CRF="${CRF:-24}"
else
  PRESET="${PRESET:-slow}"
  CRF="${CRF:-17}"
fi

mkdir -p frames output
find frames -name '*.png' -delete

SCALE="$SCALE" HUD="$HUD" FROM="$FROM" TO="$TO" SHOT="$SHOT" node render.mjs

META=$(node -e "const m=require('./frames/meta.json'); console.log([m.from,m.to,m.fps,m.shot||'all'].join(' '))")
set -- $META
FROM_FRAME=$1
TO_FRAME=$2
FPS=$3
SHOT_NAME=$4
DUR=$(node -e "const m=require('./frames/meta.json'); console.log(((m.to-m.from)/m.fps).toFixed(3))")
OFFSET=$(node -e "const m=require('./frames/meta.json'); console.log((m.from/m.fps).toFixed(3))")
TO_SECONDS=$(node -e "const m=require('./frames/meta.json'); console.log((m.to/m.fps).toFixed(2))")

if [ -n "$OUT" ]; then
  OUT_PATH="$OUT"
elif [ "$PREVIEW" = "1" ]; then
  if [ "$SHOT_NAME" != "all" ]; then
    OUT_PATH="output/preview-$SHOT_NAME.mp4"
  elif [ "$FROM_FRAME" != "0" ]; then
    OUT_PATH="output/preview-$OFFSET-$TO_SECONDS.mp4"
  else
    OUT_PATH="output/preview-full.mp4"
  fi
else
  OUT_PATH="output/browsertalk-promo-1280x720.mp4"
fi

ffmpeg -y -hide_banner -loglevel warning \
  -framerate 30 -start_number "$FROM_FRAME" -i frames/%05d.png \
  -ss "$OFFSET" -t "$DUR" -i assets/audio/mix.wav \
  -vf "scale=$WIDTH:-2" \
  -c:v libx264 -preset "$PRESET" -crf "$CRF" -pix_fmt yuv420p -r 30 \
  -c:a aac -b:a 128k -ar 48000 \
  -shortest -movflags +faststart \
  "$OUT_PATH"

if [ "$PREVIEW" != "1" ] && [ "$FROM_FRAME" = "0" ]; then
  ffmpeg -y -hide_banner -loglevel error \
    -i "$OUT_PATH" -ss 29.6 -frames:v 1 -update 1 \
    output/poster-1280x720.png
fi

ls -lh "$OUT_PATH"
