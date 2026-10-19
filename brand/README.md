# Brand

The app icon: a speech bubble with a terminal prompt — feedback goes straight to the agent.

| File | Use |
|---|---|
| `icon.svg` | Source for 48 px and larger |
| `icon-small.svg` | Source for 16 and 32 px (slightly larger, thicker glyph) |

Regenerate the manifest icons after editing either source:

```sh
rsvg-convert -w 16 -h 16 brand/icon-small.svg -o public/icon/16.png
rsvg-convert -w 32 -h 32 brand/icon-small.svg -o public/icon/32.png
rsvg-convert -w 48 -h 48 brand/icon.svg -o public/icon/48.png
rsvg-convert -w 96 -h 96 brand/icon.svg -o public/icon/96.png
rsvg-convert -w 128 -h 128 brand/icon.svg -o public/icon/128.png
```

Colors: tile gradient `#4c3fd6 → #7c3aed`, glyph `#ffffff`, prompt `#4c3fd6`.
