# opencode Browsertalk — product definition

Status: phase 001 (scaffold). Decisions locked 2026-10-10.

## What it is

A Chrome extension that shoots browser feedback straight into an opencode session bound to the right project. You browse, comment on what looks wrong, and the feedback lands in opencode with the facts the agent needs to find the code.

## Problem

Today the loop is manual. You read the element out of DevTools, copy the page URL and query params, switch to the TUI or desktop app, paste the text, and tell opencode which project it belongs to. Every feedback pays a context switch and a hand-assembled description.

| Step | Today | With Browsertalk |
|---|---|---|
| Identify element | eyeball + DevTools | hover, click |
| Capture facts | copy by hand | automatic |
| Choose project | remember it yourself | bound per origin |
| Choose session | create one yourself | reused per day |
| Paste into opencode | manual | one click |

## User

Afif — solo developer. Bilingual products (en + my). Tests features personally in the browser during the HITL phase. Uses the opencode TUI and desktop app. Personal tool first; store publishing is not a goal.

## Decisions (locked 2026-10-10)

| Decision | Choice | Why (short) |
|---|---|---|
| Boilerplate | WXT | Actively maintained, Vite-based, side-panel entrypoint built in |
| UI framework | Vue 3 + TypeScript | Matches the existing Nuxt stack and conventions |
| Session strategy | Per-day, per-project | A review pass shares context; rolls over daily; findable in TUI |
| Project routing | Origin memory + project list | Pick once per origin, remembered; `GET /api/project` feeds the list |
| Auth | Pairing codes | No secret copied into the extension; token is revocable |
| Delivery default | `queue` | Never interrupts a running agent turn |
| Name | opencode Browsertalk | Explicit about the opencode connection |

## Surfaces

| Surface | Role |
|---|---|
| Side panel | Primary. Target display, outbox, sent list, "+ new session" |
| Toolbar popup | Quick actions, connection status, open panel |
| In-page overlay | Picker highlight + inline composer |
| Context menu, shortcut (`Alt+Shift+F`) | Arm the picker from the page without opening the panel |

## Workflow

1. Browse and test. Something looks wrong.
2. Arm the picker — panel button, popup, `Alt+Shift+F`, or right-click.
3. Hover: elements highlight with a tag/class label.
4. Click the element. The composer opens next to it.
5. Type the comment. Send. The feedback lands in the opencode session for (project, day).

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

Extras (agreed; land in phase 003):

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

- Key: (`project directory`, local date `YYYY-MM-DD`).
- Title: `Browsertalk · <project> · <YYYY-MM-DD>` so the session stands out in the TUI list.
- First feedback of a day creates the session. Later feedback reuses it.
- "+ new session" in the panel replaces the day's session with a fresh one and continues on it.
- Delivery is `queue`: the prompt waits until the agent is idle. `steer` stays reachable later; no decision yet.

## Architecture

```
┌ Chrome ───────────────────────────────────────────────────┐
│ popup · side panel (Vue 3)     UI, outbox, settings        │
│ picker.content.ts              element picking + facts     │
│ background                     router · registry · auth    │
└────────────────────────┬───────────────────────────────────┘
                         │ AgentBackend (strategy + registry)
                         ├── opencode.ts ── HTTP ── 127.0.0.1:15001
                         ├── pi.ts ── (later) JSONL RPC via local bridge
                         └── fake.ts ── in-memory (tests)
```

The seam lives in `lib/agent-backend/`:

| File | Role |
|---|---|
| `interface.ts` | The contract: `AgentBackend` with `ping` / `listProjects` / `createSession` / `sendFeedback` |
| `registry.ts` | `registerAgentBackend` / `getAgentBackend` / `listAgentBackends`; fails fast with the known list |
| `opencode.ts` | opencode adapter (stub in phase 001) |
| `fake.ts` | In-memory test double |
| `builtins.ts` | Registers built-ins at boot |

Adding pi later = one adapter file + one registration line. No call site changes. Backend selection comes from settings (phase 007).

Why pi needs more than a URL: pi integrates as JSONL RPC over a subprocess (`pi --mode rpc`). A Chrome extension cannot spawn processes, so a pi adapter needs a small local bridge that wraps pi and exposes this contract. The seam keeps the UI and routing logic unaware.

opencode endpoints the adapter will use (verified against a live 2.0.24 server):

| Op | Endpoint |
|---|---|
| Pair | `POST /api/pair` → code; `GET /auth/connect/{code}` with `Accept: application/json` → token |
| Projects | `GET /api/project` |
| Session | `POST /api/session` with `{ title, location: { directory } }` |
| Prompt | `POST /api/session/{id}/prompt` with `{ text, delivery }` |
| Events (later) | `GET /api/event` |

Default server URL: `http://127.0.0.1:15001` — this machine's systemd `opencode-server`. Stock opencode defaults to port 4096. Configurable in settings.

Pairing code creation requires an authenticated client, so the user runs one command on the TUI side: `opencode api post /api/pair`.

## Storage model (keys in `chrome.storage.local`)

| Key | Value |
|---|---|
| `settings.backendId` | `opencode` \| `pi` \| `fake` |
| `settings.serverUrl` | Base URL of the server |
| `auth.token` | Pairing token |
| `projects.byOrigin` | `origin → project directory` |
| `sessions.byDay` | `<directory>::<date> → { sessionID, title }` |
| `outbox` | Unsent feedback items |
| `sent` | Recent sent summaries, capped |

## Permissions rationale

| Permission | Why |
|---|---|
| `storage` | Settings, token, outbox, mappings |
| `sidePanel` | The primary surface |
| `contextMenus` | Right-click → comment on element |
| `activeTab` | Gesture-scoped access when arming from the popup |
| `<all_urls>` (host) | Picker on any dev site; element screenshots |
| `commands.arm-picker` | `Alt+Shift+F` shortcut |

## Security

- The pairing token lives in extension storage only. Never in code, logs, or the page.
- The server is loopback-only. No external network calls from the extension.
- The content script never talks to the server. The background service worker is the only client.

## Non-goals (MVP)

- Store publishing. Personal unpacked extension first.
- Firefox / Safari builds. WXT supports them; untested here.
- Remote servers (tailscale, SSH). Loopback only.
- Attachments beyond the element screenshot.
- Multi-user, shared sessions.

## Roadmap

One phase = one commit. Backend tests use `fake.ts`; no live LLM spend in tests.

| Phase | Scope |
|---|---|
| 001 | Scaffold: WXT + Vue, entrypoint stubs, AgentBackend seam, product.md + CONTEXT.md ← this session |
| 002 | Connection: pairing flow, token storage, `ping` status, `GET /api/project` list |
| 003 | Picker: arm, hover highlight, click select, facts collector (core + extras) |
| 004 | Composer: inline feedback box, outbox persistence, comment-on-page, URL-only send |
| 005 | Send: per-day session strategy, prompt template, queue delivery, sent log |
| 006 | Panel: outbox and sent lists, project/session header, "+ new session" |
| 007 | Settings: options page (server URL, backend id), context menu + shortcut wiring |
| 008 | Pi adapter: local bridge around `pi --mode rpc`, registered and selectable |

## Open questions

- Pi bridge shape: new daemon vs. an existing pi server mode. Unconfirmed.
- Screenshot crop fidelity under browser zoom and hi-DPI displays.
- Component-name detection coverage (React 19 dev fibers, Vue production builds).
- Day boundary: local midnight assumed; sessions created just before it split.
- Expose `steer` as a per-send toggle, or keep queue-only.
- Pairing code UX: exact flow for `opencode api post /api/pair` from the TUI.

## Rejected options

| Option | Reason |
|---|---|
| Plasmo boilerplate | Unmaintained since 2025; maintainers left; Chrome 144 bugs open |
| CRXJS boilerplate | Breaks on Vite majors; smaller maintenance surface |
| Extension.js boilerplate | Newer, less ecosystem proof |
| New session per feedback | Session-list clutter; related comments lose context |
| Single sticky session per project | Context bloat, drift, mixed topics |
| Manual password paste auth | Secret handling worse than a revocable pairing token |
| Ask-each-send delivery | No default; queue is the safe one |
| Configurable-only session strategy | A default is needed anyway; per-day per-project chosen |
