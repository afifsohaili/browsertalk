# Variants

Three cuts, different sound and surface. Paper is selected and is the master source.

| Variant | Draft | Music | Look | Length |
|---|---|---|---|---|
| `terminal` | `../output/preview-terminal.mp4` | Trap Electro Vibes — 140 BPM | Dark UI, purple, yellow plates | 27.36s |
| `acid` | `acid/output/preview-full.mp4` | Infected Mushroom Vibes — 143.6 → 140 BPM | Acid green + hot pink + black | 27.36s |
| `paper` | `paper/output/preview-full.mp4` | Stylz — 136 → 140 BPM, from 0:45 | Cream + black + vermilion, paper plates | 30.36s |

Paper adds the 3s breather at 06.0–09.0: “It doesn’t have to be this way.”
The other two are the 27.36s cut without it.

All three are normalized to about −14 LUFS. Comparison grid:
`../output/variants-grid.png`. Rows are terminal, acid, paper; the paper row is the
pre-breather frame set.

## Build

The variants are copies of the base kit. `theme-acid.css` and `theme-paper.css` are
appended to each copy's `src/style.css`; the music replaces `assets/audio/126.mp3`.

```sh
cd acid && ./audio-mix.sh && ./preview.sh
cd paper && ./audio-mix.sh && ./preview.sh
cd paper && SCALE=2 ./build.sh
```

The selected master is `paper/output/browsertalk-promo-1280x720.mp4`, copied to
`../output/browsertalk-promo-1280x720.mp4`.
