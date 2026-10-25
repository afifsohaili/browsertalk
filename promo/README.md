# Browsertalk promo

30.36s Paper cut for opencode Browsertalk, cut to Mixkit "Stylz" at 140 BPM.
1280×720, 30 fps, H.264 + AAC, mastered for X/Twitter.

## Deliverable

- Master: `output/browsertalk-promo-1280x720.mp4` — Paper, 30.36s, 1280×720.
- Draft: `output/preview-paper.mp4` — Paper, 480×270, timecode HUD.
- Other variants: `output/preview-terminal.mp4` and `variants/acid/output/preview-full.mp4`.
- Poster: `output/poster-1280x720.png`.
- Previous 30.8s cut with the feature cards: `output/archive/browsertalk-promo-v1-30s.mp4`.

The selected master is built from `variants/paper`. The base `src/` is the shared kit
(Terminal styling); the Paper theme and audio live in `variants/paper`.

## Preview loop

Use 480p drafts for pacing. Never review the 2× master unless the cut is locked.

```sh
cd variants/paper
./preview.sh                     # full Paper cut, 480×270, HUD
SHOT=breather ./preview.sh       # one section
FROM=6.0 TO=9.0 ./preview.sh     # exact seconds
WIDTH=640 SHOT=loop ./preview.sh # readable panel text
HUD=0 SHOT=loop ./preview.sh     # no timecode
```

Outputs land in `variants/paper/output/preview-*.mp4`. The HUD reads
`global seconds · shot · beat`. `SHOT` accepts:
`bug`, `blind`, `pain`, `breather`, `logo`, `tagline`, `loop`, `agent`, `prompt`, `end`.

## Shot map

| Time | Shot | Content |
|---|---|---|
| 0.00–1.71 | `bug` | POV bug, annotation, caption swap |
| 1.71–3.00 | `blind` | agent asks "which button?" |
| 3.00–6.00 | `pain` | 6-panel manual-loop montage, ends on `AND PRAY` |
| 6.00–9.00 | `breather` | "It doesn't have to be this way." |
| 9.00–9.86 | `logo` | logo slam |
| 9.86–11.57 | `tagline` | point / click / send |
| 11.57–20.57 | `loop` | picker → composer → send → sent → facts |
| 20.57–23.57 | `agent` | opencode receives it, browser PiP, file found |
| 23.57–27.86 | `prompt` | full prompt template, highlights |
| 27.86–30.36 | `end` | logo, tagline, backend strip, link, stamp |

## Rebuild

```sh
cd variants/paper
./audio-mix.sh
SCALE=2 ./build.sh
```

`SCALE=1` for a fast draft, `SCALE=2` for the master (renders at 2560×1440 and downsamples).
Frames are written to `frames/`; the audio mix to `assets/audio/mix.wav`.
`playwright-core` resolves from `promo/node_modules`, so run `npm install` in `promo` once.

## What is in the cut

- Paper surface: cream `#f4efe6`, black type, vermilion `#ff4b2b`, hard-shadow caption plates.
- Synthetic UI only: no screen recording, no third-party footage.
- 71 beats at 140 BPM. Cuts land on beat boundaries.
- The product mock mirrors the shipped panel copy: Project, Session, the picker tag,
  the composer, Outbox, Sent, and the prompt template from `product.md`.
- The opencode shot uses a browser PiP to show the handoff happens in the background.
- The end card names opencode as today's backend and shows pi + more as coming.

## Assets and licences

| Asset | Source | Licence |
|---|---|---|
| Music: "Stylz" — Ahjay Stelino | https://mixkit.co/free-stock-music/electronic/ (track 102) | Mixkit Stock Music Free License |
| SFX: click, whoosh, impact, error | https://mixkit.co/free-sound-effects/ | Mixkit License |
| Type: Archivo Black, Inter, JetBrains Mono | Google Fonts | SIL Open Font License 1.1 |
| App icon | `assets/icon.svg` | MIT (this repo) |

Terminal uses "Trap Electro Vibes"; acid uses "Infected Mushroom Vibes".
No paid generation, no API keys.

## Notes

- The 9:16 cutdown is not built. The timeline is 16:9; a vertical version needs a new
  layout pass, not just a crop.
- The panel is a mock. It uses the real vocabulary and copy, but no live opencode server.
