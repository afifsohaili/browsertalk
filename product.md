# opencode Browsertalk — product definition

Status: 001 shipped. Decisions locked 2026-10-10. Phase tracking lives in `plans/` — one folder and ticket per phase.

## What it is

A Chrome extension that shoots browser feedback straight into an opencode session bound to the right project. You browse, comment on what looks wrong, and the feedback lands in opencode with the facts the agent needs to find the code.

## Problem

Today the loop is manual. You read the element out of DevTools, copy the page URL and query params, switch to the TUI or desktop app, paste the text, and tell opencode which project it belongs to. Every feedback pays a context switch and a hand-assembled description.

| Step | Today | With Browsertalk |
|---|---|---|
| Identify element | eyeball + DevTools | hover, click |
| Capture facts | copy by hand | automatic |
| Choose project | remember it yourself | bound per origin |
| Choose session | create one yourself | reused per session strategy, or picked from the project's list |
| Paste into opencode | manual | one click |

## User

Afif — solo developer. Bilingual products (en + my). Tests features personally in the browser during the HITL phase. Uses the opencode TUI and desktop app. Personal tool first; Chrome Web Store publishing and open source are goals (set 2026-10-10).

## Decisions (locked 2026-10-10)

| Decision | Choice | Why (short) |
|---|---|---|
| Boilerplate | WXT | Actively maintained, Vite-based, side-panel entrypoint built in |
| UI framework | Vue 3 + TypeScript | Matches the existing Nuxt stack and conventions |
| Session strategy | Seam: per-day + sticky, per-backend default + settings override | opencode favors per-day (findable in TUI); one-long-thread backends favor sticky. Settings UI ships with the seam (phase 003) |
| Project routing | Origin memory + project list | Pick once per origin, remembered; `GET /api/project` feeds the list |
| Auth | Pairing codes | No secret copied into the extension; token is revocable |
| Remote servers | Opt-in in settings ("Allow a remote server"), off by default | Tailnet/SSH setups work without weakening the default |
| Delivery default | `queue` | Never interrupts a running agent turn |
| Name | opencode Browsertalk | Explicit about the opencode connection |
| Distribution | Chrome Web Store (public) + open source | Goal set 2026-10-10; first release is public |
| License | MIT | Shortest permissive; matches agent-webbridge |

## Surfaces

| Surface | Role |
|---|---|
| Side panel | Primary. The toolbar icon opens it. Target display with the session chooser and the comment box, outbox, sent list |
| In-page overlay | Picker highlight + inline composer (element comments) |
| Context menu, shortcut (`Alt+Shift+F`) | Arm the picker from the page without opening the panel |
| Options page | Settings: backend, server URL, remote-server opt-in, session-strategy override |

## Workflow

1. Browse and test. Something looks wrong.
2. Arm the picker — panel button, `Alt+Shift+F`, or right-click.
3. Hover: elements highlight with a tag/class label.
4. Click the element. The composer opens next to it.
5. Type the comment. Send. The feedback lands in the session picked by the active session strategy — or the one adopted in the session chooser.

To comment on the page as a whole instead of an element, type in the panel's comment box and send; an empty box sends the URL only.

## What gets captured

Core facts, always:

| Fact | Source |
|---|---|
| URL, path, query params | `location` |
| Page title | `document.title` |
| Tag, id, classes | DOM |
| Unique-ish CSS selector path | generated from the ancestor chain |
| Trimmed text content | `textContent` |
| Key attributes: href, src, role, aria-label, data-testid, placeholder | element attributes |
| Bounding box, viewport, scroll | `getBoundingClientRect` |

Extras (agreed; land in phase 004):

| Extra | Source | Caveat |
|---|---|---|
| Screenshot crop of the element | `captureVisibleTab` + canvas crop | Fidelity under zoom and hi-DPI needs checking |
| Component name | `__reactFiber$*` / `__vueParentComponent` | Dev builds only; best effort |
| Computed styles subset + ARIA role/name | `getComputedStyle`; accessibility info | Keep the subset small or the prompt gets noisy |

Cross-origin iframe content is not reachable from the content script. Feedback targets the top frame only, for now.

## Prompt template

```
## Browser feedback — <project name>

Comment: <user text>

Element: <tag>.<classes> — "<text>"
  selector  <generated path>
  box       <w>×<h> @ (<x>,<y>) · viewport <vw>×<vh> · scroll (<sx>,<sy>)
  attrs     <k=v> · <k=v>

Page: <full URL including query params>
  title     <page title>

Sent by Browsertalk · <timestamp>
```

A screenshot, when captured, is attached as an image file. Component name and styles/ARIA add lines to the Element block.

## Session model

The mapping from feedback to sessions is a seam, `lib/session-strategy/` (interface + registry + one file per strategy), mirroring the AgentBackend seam. Each backend declares its default strategy; settings override per backend.

Strategies that ship:

| Strategy | Rule | Why |
|---|---|---|
| Per-day, per-project | One session per (project directory, local date `YYYY-MM-DD`); title `Browsertalk · <project> · <YYYY-MM-DD>` | A review pass shares context; stands out in the TUI list |
| Sticky, per-project | One long-lived session per project; every feedback appends until "+ new session" rolls over | The style one-long-thread backends live in (Claude Code) |

Defaults: opencode → per-day. The seam must abstract the six axes found in research — identity/addressing, named creation, reuse mechanics, listing, busy/delivery, channel lifetime. Per-backend constraints: `plans/003-session-strategy/research-agent-sessions.md`.

- First feedback creates or reuses the session per the active strategy.
- The session chooser in the panel lists the project's sessions: "+ new session" creates a fresh one and continues on it; picking an existing one adopts it into the active strategy slot, and every later send routes there.
- Delivery is `queue`: the prompt waits until the agent is idle. `steer` stays reachable later; no decision yet.

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
                             ├── pi.ts ── (later) JSONL RPC via local bridge
                             └── fake.ts ── in-memory (tests)
```

The seam lives in `lib/agent-backend/`:

| File | Role |
|---|---|
| `interface.ts` | The contract: `AgentBackend` with `ping` / `listProjects` / `createSession` / `sendFeedback`; optional `listSessions` / `getSession` for picking existing sessions |
| `registry.ts` | `registerAgentBackend` / `getAgentBackend` / `listAgentBackends`; fails fast with the known list |
| `opencode.ts` | opencode adapter (stub in phase 001) |
| `fake.ts` | In-memory test double |
| `builtins.ts` | Registers built-ins at boot |

Adding pi later = one adapter file + one registration line. No call site changes. Backend and session-strategy selection come from settings (phase 003).

The session-strategy seam lives in `lib/session-strategy/`: `interface.ts` (contract), `registry.ts` (`registerSessionStrategy` / `getSessionStrategy` / `listSessionStrategies`), one file per strategy (`per-day.ts`, `sticky.ts`). Each backend declares a default; settings override per backend. The six axes the seam must abstract, and per-backend constraints: `plans/003-session-strategy/research-agent-sessions.md`.

Why pi needs more than a URL: pi integrates as JSONL RPC over a subprocess (`pi --mode rpc`). A Chrome extension cannot spawn processes, so a pi adapter needs a small local bridge that wraps pi and exposes this contract. The seam keeps the UI and routing logic unaware.

opencode endpoints the adapter will use (verified against a live 2.0.24 server):

| Op | Endpoint |
|---|---|
| Pair | `POST /api/pair` → code; `GET /auth/connect/{code}` with `Accept: application/json` → token |
| Projects | `GET /api/project` |
| Session | `POST /api/session` with `{ title, location: { directory } }` |
| Sessions | `GET /api/session` — list; filters `directory`, `search`, `parentID`, `cursor` |
| Session refresh | `GET /api/session/{id}` — 404 when the session is gone |
| Prompt | `POST /api/session/{id}/prompt` with `{ text, delivery }` |
| Events (later) | `GET /api/event` |

Default server URL: `http://127.0.0.1:15001` — this machine's systemd `opencode-server`. Stock opencode defaults to port 4096. Configurable in settings.

Pairing code creation requires an authenticated client, so the user runs one command on the TUI side: `opencode api post /api/pair`.

## Storage model (keys in `chrome.storage.local`)

| Key | Value |
|---|---|
| `settings.backendId` | `opencode` \| `pi` \| `fake` |
| `settings.serverUrl` | Base URL of the server |
| `settings.sessionStrategy` | Per-backend strategy override (`{ [backendId]: strategyId }`) |
| `auth.token` | Pairing token |
| `projects.byOrigin` | `origin → project directory` |
| `sessions` | Session refs per strategy: per-day `<directory>::<date>`, sticky `<directory>` → `{ sessionID, title }` |
| `outbox` | Unsent feedback items |
| `sent` | Recent sent summaries, capped |

## Permissions rationale

| Permission | Why |
|---|---|
| `storage` | Settings, token, outbox, mappings |
| `sidePanel` | The primary surface |
| `contextMenus` | Right-click → comment on element |
| `<all_urls>` (host) | Picker on any dev site; element screenshots |
| `commands.arm-picker` | `Alt+Shift+F` shortcut |

## Security

- The pairing token lives in extension storage only. Never in code, logs, or the page.
- The server is loopback-only by default. A settings opt-in ("Allow a remote server", off by default, with a warning) accepts another machine; credentials never live in the URL either way.
- The content script never talks to the server. The background service worker is the only client.

## Non-goals (MVP)

- Firefox / Safari builds. WXT supports them; untested here.
- Attachments beyond the element screenshot.
- Multi-user, shared sessions.

## Open questions

- Pi bridge shape: new daemon vs. an existing pi server mode. Unconfirmed.
- Screenshot crop fidelity under browser zoom and hi-DPI displays.
- Component-name detection coverage (React 19 dev fibers, Vue production builds).
- Day boundary: local midnight assumed; sessions created just before it split.
- Expose `steer` as a per-send toggle, or keep queue-only.
- Pairing code UX: exact flow for `opencode api post /api/pair` from the TUI.
- Ship phase: in-product consent wording for User Data FAQ #10; enforcement scope unconfirmed.
- Ship phase: host access strategy — keep `<all_urls>` vs `activeTab` + optional host grants; review-time tradeoff.

## Rejected options

| Option | Reason |
|---|---|
| Plasmo boilerplate | Unmaintained since 2025; maintainers left; Chrome 144 bugs open |
| CRXJS boilerplate | Breaks on Vite majors; smaller maintenance surface |
| Extension.js boilerplate | Newer, less ecosystem proof |
| New session per feedback | Session-list clutter; related comments lose context |
| Sticky-only, no rollover | Context bloat, drift, mixed topics; sticky still ships as a strategy, with "+ new session" as the reset |
| Manual password paste auth | Secret handling worse than a revocable pairing token |
| Ask-each-send delivery | No default; queue is the safe one |
| Configurable-only session strategy | Defaults are needed anyway; each backend declares its natural default |
