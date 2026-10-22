# opencode Browsertalk

Chrome extension that sends browser feedback straight into an opencode session bound to the right project. You browse, point at or describe what looks wrong, and the feedback lands in opencode with the facts the agent needs to find the code.

Status: MVP complete through phase 017 (015 element sets, 016 review fixes, 017 onboarding; pi adapter, phase 009, pending). Chrome Web Store submission pending — see `CHROMEWEBSTORE.md`. Phase tracking lives in `plans/`.

## Setup

Browsertalk needs opencode 2 on this machine.

1. Install opencode 2 from https://opencode.ai. `opencode --version` must start with `2`; on 1.x run `opencode upgrade`.
2. Start the server. `opencode serve` defaults to port 4096. The background service uses a dynamic port; `opencode service status` prints its URL. Do not guess the port — the pairing link carries it.
3. In a terminal, run `opencode pair`.
4. Copy the link it prints. Do not open it. Links expire in 5 minutes.
5. Click the Browsertalk toolbar icon. A fresh install opens the welcome tab; if it was closed, open the side panel, accept the first-run feedback disclosure, then click **Finish setup**. Paste the link or the bare code into the welcome tab and click **Pair**.
6. The link sets the server URL, so no port is typed. A link to another machine shows its origin and the remote-server warning; confirm it to continue.
7. Switch to your dev site and open the side panel from the toolbar icon. Accept the first-run feedback disclosure if it is showing.
8. Click **Choose project** and pick the project from the server's list. The origin is now bound.

The toolbar badge `1` stays until the connection is ready. "Forget pairing" in settings clears the token for the current server.

## Surfaces

- **Welcome tab** — opens on a fresh install. Runs setup: opencode 2, `opencode pair`, paste the link or code, connected, then hand off to the side panel on the dev site.
- **Side panel** — primary; opens on toolbar icon click. Current target (project + session), session chooser, comment box, outbox, sent list. A setup card shows the connection state and opens the welcome tab until setup is done.
- **In-page overlay** — picker highlight, numbered badges, count pill, and inline composer with element chips.
- **Context menu / `Alt+Shift+F`** — arm the picker without opening the panel.
- **Options page** — backend, Test connection, Forget pairing, advanced server URL, remote-server opt-in, session-strategy override.

## Picking elements

1. Arm the picker — panel button, `Alt+Shift+F`, or right-click → "Browsertalk: point at element".
2. Plain click one element for the single-element flow. The composer opens next to it.
3. For several elements on the same page, hold **Cmd** (macOS) or **Ctrl** (Windows/Linux) and click each one. Numbered badges and the count pill track the set.
4. Release the modifier, press Enter, or pick the fifth element. The composer opens anchored to the last pick.
5. Type one comment for the set. Chip `×` drops an element; Enter or Queue sends.

Limits and exit paths:

| Rule | Value |
|---|---|
| Elements per feedback | 5 |
| Screenshots per feedback | 4, best effort (Chrome allows 2 captures per second; fast picks skip the shot) |
| Count wording | `1 element` / `N elements` in the composer and panel rows |
| Scope | One page and tab; click order is kept |
| After the composer opens | No adding; chip `×` is the only change |
| Clear in the pill, or Escape | Discards the set and disarms |
| Window blur | Discards the set and disarms |
| Route change (`pushState`, `replaceState`, `popstate`, `hashchange`) | Discards the set and closes an open composer; the background pending is cleared |
| Composer dismissed (Escape) | Drops the unsent set and clears the background pending |

## Architecture

```
┌ Chrome ──────────────────────────────────────────────────────────┐
│ side panel (Vue 3)              UI, outbox, sent                │
│ options page                    backend · server · strategy     │
│ picker.content.ts               element picking + facts         │
│ picker-route.content.ts         MAIN-world route bridge         │
│ background                      router · registries · auth      │
└────────────────────────────┬───────────────────────────────────┘
                             │ feedback
                             ▼
              SessionStrategy (per-day · sticky) ── lib/session-strategy
                             │ session ref
                             ▼
              AgentBackend (registry) ──────────── lib/agent-backend
                             ├── opencode.ts ── HTTP ── your opencode server
                             └── fake.ts ── in-memory (tests)
```

WXT + Vue 3 + TypeScript. The background service worker is the only client of the opencode server; the content script talks only to the background. A second content script, `picker-route.content.ts`, runs in the MAIN world at `document_start` and reports page-world `pushState`/`replaceState`; it adds no permission. Feedback routes through a session-strategy seam (`per-day` / `sticky`) and an agent-backend registry (`opencode`; `fake` stays registered for tests). Adding a backend is one adapter file plus one registration line.

## Where it connects

Browsertalk talks only to the opencode server you pair with — loopback by default. The pairing link carries the server URL, so a non-default port needs no configuration. `opencode serve` defaults to 4096; the background service picks a dynamic port and `opencode service status` prints it. There are no external servers, no analytics, and no third-party sharing; all network traffic stays on loopback. Settings can allow a server on another machine ("Allow a remote server", off by default) — the pairing token and feedback then cross your network, so keep that link encrypted (Tailscale, SSH tunnel) or trusted.

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
