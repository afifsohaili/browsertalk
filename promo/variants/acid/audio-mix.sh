#!/bin/sh
set -e
cd "$(dirname "$0")"
mkdir -p assets/audio

ffmpeg -y -hide_banner -loglevel error \
  -i ../../assets/audio/126.mp3 \
  -i ../../assets/sfx/whoosh-1485.mp3 \
  -i ../../assets/sfx/impact-2150.mp3 \
  -i ../../assets/sfx/click-1109.mp3 \
  -i ../../assets/sfx/error-2966.mp3 \
  -filter_complex "\
[0:a]atempo=0.975,atrim=0:27.429,asetpts=N/SR/TB,volume=0.85,volume=0.22:enable='between(t,5.14,6.0)',afade=t=in:st=0:d=0.04,afade=t=out:st=26.63:d=0.8[music];\
[1:a]atrim=0:0.5,asetpts=N/SR/TB,volume=0.45,afade=t=out:st=0.35:d=0.15,adelay=5520|5520[whoosh1];\
[1:a]atrim=0:0.5,asetpts=N/SR/TB,volume=0.4,afade=t=out:st=0.35:d=0.15,adelay=20400|20400[whoosh2];\
[2:a]atrim=0:0.6,asetpts=N/SR/TB,volume=0.55,afade=t=out:st=0.45:d=0.15,adelay=6000|6000[impact1];\
[2:a]atrim=0:0.6,asetpts=N/SR/TB,volume=0.45,afade=t=out:st=0.45:d=0.15,adelay=20570|20570[impact2];\
[2:a]atrim=0:0.6,asetpts=N/SR/TB,volume=0.5,afade=t=out:st=0.45:d=0.15,adelay=24860|24860[impact3];\
[3:a]atrim=0:0.22,asetpts=N/SR/TB,volume=0.5,afade=t=out:st=0.08:d=0.14,adelay=10570|10570[click1];\
[3:a]atrim=0:0.22,asetpts=N/SR/TB,volume=0.5,afade=t=out:st=0.08:d=0.14,adelay=11470|11470[click2];\
[3:a]atrim=0:0.22,asetpts=N/SR/TB,volume=0.55,afade=t=out:st=0.08:d=0.14,adelay=13870|13870[click3];\
[4:a]atrim=0:0.9,asetpts=N/SR/TB,volume=0.22,afade=t=out:st=0.6:d=0.3,adelay=5500|5500[err];\
[music][whoosh1][whoosh2][impact1][impact2][impact3][click1][click2][click3][err]amix=inputs=10:normalize=0,alimiter=limit=0.95,loudnorm=I=-14:TP=-1.5:LRA=11,volume=0dB[a]" \
  -map "[a]" -t 27.429 -ar 48000 -ac 2 -c:a pcm_s16le assets/audio/mix.wav

ffmpeg -hide_banner -i assets/audio/mix.wav -filter_complex ebur128=peak=true -f null - 2>&1 | tail -8
