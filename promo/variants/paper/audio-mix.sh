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
[0:a]atempo=1.029,atrim=45:75.429,asetpts=N/SR/TB,volume=0.85,volume=0.22:enable='between(t,5.14,6.0)',volume=0.55:enable='between(t,6.0,8.85)',afade=t=in:st=0:d=0.04,afade=t=out:st=29.63:d=0.8[music];\
[1:a]atrim=0:0.5,asetpts=N/SR/TB,volume=0.45,afade=t=out:st=0.35:d=0.15,adelay=8520|8520[whoosh1];\
[1:a]atrim=0:0.5,asetpts=N/SR/TB,volume=0.4,afade=t=out:st=0.35:d=0.15,adelay=23400|23400[whoosh2];\
[2:a]atrim=0:0.6,asetpts=N/SR/TB,volume=0.55,afade=t=out:st=0.45:d=0.15,adelay=9000|9000[impact1];\
[2:a]atrim=0:0.6,asetpts=N/SR/TB,volume=0.45,afade=t=out:st=0.45:d=0.15,adelay=23570|23570[impact2];\
[2:a]atrim=0:0.6,asetpts=N/SR/TB,volume=0.5,afade=t=out:st=0.45:d=0.15,adelay=27860|27860[impact3];\
[3:a]atrim=0:0.22,asetpts=N/SR/TB,volume=0.5,afade=t=out:st=0.08:d=0.14,adelay=13570|13570[click1];\
[3:a]atrim=0:0.22,asetpts=N/SR/TB,volume=0.5,afade=t=out:st=0.08:d=0.14,adelay=14470|14470[click2];\
[3:a]atrim=0:0.22,asetpts=N/SR/TB,volume=0.55,afade=t=out:st=0.08:d=0.14,adelay=16870|16870[click3];\
[4:a]atrim=0:0.9,asetpts=N/SR/TB,volume=0.22,afade=t=out:st=0.6:d=0.3,adelay=5500|5500[err];\
[music][whoosh1][whoosh2][impact1][impact2][impact3][click1][click2][click3][err]amix=inputs=10:normalize=0,alimiter=limit=0.95,loudnorm=I=-14:TP=-1.5:LRA=11,volume=-0.8dB[a]" \
  -map "[a]" -t 30.429 -ar 48000 -ac 2 -c:a pcm_s16le assets/audio/mix.wav

ffmpeg -hide_banner -i assets/audio/mix.wav -filter_complex ebur128=peak=true -f null - 2>&1 | tail -8
