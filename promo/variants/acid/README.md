# Browsertalk promo

27.43s landscape promo for opencode Browsertalk, cut to Mixkit "Trap Electro Vibes" at 140 BPM.
1280×720, 30 fps, H.264 + AAC, mastered for X/Twitter.

## Preview loop

Use 480p drafts for pacing. Never review the 2× master unless the cut is locked.

```sh
./preview.sh                    # full cut, 480×270, timecode HUD, ~3 min
SHOT=loop ./preview.sh          # one section, ~30s
FROM=9.0 TO=13.0 ./preview.sh   # exact seconds, ~15s
WIDTH=640 SHOT=loop ./preview.sh # readable panel text
HUD=0 SHOT=loop ./preview.sh    # no timecode
```

Outputs land in `output/preview-*.mp4`. The HUD reads `global seconds · shot · beat`,
so feedback can be given as a timestamp or a shot name. `SHOT` accepts:
`bug`, `blind`, `pain`, `logo`, `tagline`, `loop`, `agent`, `prompt`, `end`.

When the cut is locked, rebuild the master with `SCALE=2 ./build.sh`.

## Shot map

| Time | Shot | Content | Fastest unit |
|---|---|---|---|
| 0.00–1.71 | `bug` | POV bug, annotation, caption swap | 0.86s per caption |
| 1.71–3.00 | `blind` | agent asks "which button?" | — |
| 3.00–6.00 | `pain` | 6-panel manual-loop montage | **0.50s per panel** |
| 6.00–6.86 | `logo` | logo slam | 0.86s |
| 6.86–8.57 | `tagline` | point / click / send | 0.57s per word |
| 8.57–17.57 | `loop` | picker → composer → send → sent → facts | 1.29s per caption |
| 17.57–20.57 | `agent` | opencode receives it, browser PiP, file found | — |
| 20.57–24.86 | `prompt` | full prompt template, highlights | — |
| 24.86–27.43 | `end` | logo, tagline, backend strip, link, stamp | — |

## Deliverable

Draft: `output/preview-full.mp4` — 480×270, 27.36s, timecode HUD.

Master: `output/browsertalk-promo-1280x720.mp4` — only render after the cut is locked.
The previous 30.8s cut (with the feature cards) is archived at
`output/archive/browsertalk-promo-v1-30s.mp4`.

## Rebuild

```sh
npm install
./audio-mix.sh
SCALE=2 ./build.sh
```

`SCALE=1` for a fast draft, `SCALE=2` for the master (renders at 2560×1440 and downsamples).
Frames are written to `frames/`; the audio mix to `assets/audio/mix.wav`.

## What is in the cut

- Synthetic UI only: no screen recording, no third-party footage.
- 64 beats at 140 BPM. Cuts land on beat boundaries.
- The product mock mirrors the shipped panel copy: Project, Session, the picker tag,
  the composer, Outbox, Sent, and the prompt template from `product.md`.
- The opencode shot uses a browser PiP to show the handoff happens in the background.
- The end card names opencode as today's backend and shows pi + more as coming.

## Assets and licences

| Asset | Source | Licence |
|---|---|---|
| Music: "Trap Electro Vibes" — Alejandro Magaña (A. M.) | https://mixkit.co/free-stock-music/electronic/ (track 126) | Mixkit Stock Music Free License |
| SFX: click, whoosh, impact, error | https://mixkit.co/free-sound-effects/ | Mixkit License |
| Type: Archivo Black, Inter, JetBrains Mono | Google Fonts | SIL Open Font License 1.1 |
| App icon | `assets/icon.svg` | MIT (this repo) |

No paid generation, no API keys.

## Notes

- The 9:16 cutdown is not built. The timeline is 16:9; a vertical version needs a new
  layout pass, not just a crop.
- The panel is a mock. It uses the real vocabulary and copy, but no live opencode server.
