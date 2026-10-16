# opencode Browsertalk

Chrome extension that sends browser feedback straight into an opencode session bound to the right project. You browse, point at or describe what looks wrong, and the feedback lands in opencode with the facts the agent needs to find the code.

Status: MVP complete through phase 011 (pi adapter, phase 009, pending). Chrome Web Store submission pending — see `CHROMEWEBSTORE.md`. Phase tracking lives in `plans/`.

## Surfaces

- **Side panel** — primary; opens on toolbar icon click. Current target (project + session), session chooser, comment box, outbox, sent list.
- **In-page overlay** — picker highlight and inline composer.
- **Context menu / `Alt+Shift+F`** — arm the picker without opening the panel.
- **Options page** — backend, server URL, session-strategy override.

## Architecture

```
┌ Chrome ──────────────────────────────────────────────────────────┐
│ side panel (Vue 3)              UI, outbox, sent                │
│ options page                    backend · server · strategy     │
│ picker.content.ts               element picking + facts         │
│ background                      router · registries · auth      │
└────────────────────────────┬───────────────────────────────────┘
                             │ feedback
                             ▼
              SessionStrategy (per-day · sticky) ── lib/session-strategy
                             │ session ref
                             ▼
              AgentBackend (registry) ──────────── lib/agent-backend
                             ├── opencode.ts ── HTTP ── 127.0.0.1:15001
                             └── fake.ts ── in-memory (tests, offline use)
```

WXT + Vue 3 + TypeScript. The background service worker is the only client of the opencode server; the content script talks only to the background. Feedback routes through a session-strategy seam (`per-day` / `sticky`) and an agent-backend registry (`opencode`, `fake`). Adding a backend is one adapter file plus one registration line.

## Localhost only

Browsertalk talks only to the opencode server on your own computer (default `http://127.0.0.1:15001`). There are no external servers, no analytics, and no third-party sharing; all network traffic stays on loopback.

## Privacy summary

First run shows an in-product disclosure you accept or decline; nothing is captured before you accept. Feedback — your comment, page and element facts, an optional element screenshot crop — goes only to the server you run. Everything else lives in `chrome.storage.local` on your machine. The full policy, including the Limited Use statement, is in `PRIVACY.md`.

## Dev

```sh
bun install
bun run dev        # Chrome with the extension loaded
bun run compile    # vue-tsc typecheck
bun run test       # vitest
bun run build      # production build → .output/chrome-mv3
```

Manual load: chrome://extensions → enable Developer mode → Load unpacked → `.output/chrome-mv3`.

## Docs

- `product.md` — product definition, locked decisions, architecture.
- `CONTEXT.md` — ubiquitous language. Read before naming anything.
- `plans/` — phase tickets and status.
- `PRIVACY.md` — privacy policy.
- `CHROMEWEBSTORE.md` — store submission packet (dashboard texts, disclosures, test instructions).

## License

MIT — see `LICENSE`. Browsertalk is an independent project and is not affiliated with, endorsed by, or produced by the opencode project.
