# opencode Browsertalk

Chrome extension for shooting browser feedback straight into opencode sessions, bound to the right project.

Status: phase 001 — scaffold only. Features land in phase 002 and later; see `product.md` roadmap.

## Dev

```sh
bun install
bun run dev        # Chrome with the extension loaded
bun run compile    # vue-tsc typecheck
bun run build      # production build → .output/chrome-mv3
```

Manual load: chrome://extensions → enable Developer mode → Load unpacked → `.output/chrome-mv3`.

## Docs

- `product.md` — product definition, locked decisions, architecture, roadmap.
- `CONTEXT.md` — ubiquitous language. Read before naming anything.
