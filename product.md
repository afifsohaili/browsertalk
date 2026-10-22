# opencode Browsertalk — product definition

Status: MVP shipped through phase 017 (015 element sets, 016 review fixes, 017 onboarding). Decisions locked 2026-10-10; element-set decisions locked 2026-10-21; onboarding decisions locked 2026-10-22. Phase tracking lives in `plans/` — one folder and ticket per phase.

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

## Decisions (locked 2026-10-22, onboarding)

| Decision | Choice | Why (short) |
|---|---|---|
| Setup surface | Welcome tab on install + a setup card in the side panel | One flow, visible where the user works |
| Server discovery | `opencode pair` link; no port scan | The link carries the real endpoint, including a dynamic background-service port |
| Pairing input | Pairing link or bare code | The link sets the URL; the code covers the saved-URL case |
| Version | Require opencode 2.x; nudge with `opencode upgrade` | The connection API differs on 1.x |
| Fake backend | Removed from user choices; kept for tests | It is a test double, not a product path |
| Remote link | Confirm the origin with the existing remote-server warning | Keeps the loopback default honest |

## Surfaces

| Surface | Role |
|---|---|
| Welcome tab | Opens on a fresh install. Runs setup: opencode 2, `opencode pair`, paste the link or code, Connected, then hand off to the side panel on the dev site |
| Side panel | Primary. The toolbar icon opens it. Target display with the session chooser and the comment box, outbox, sent list. A setup card shows the connection state and opens the welcome tab until setup is done |
| In-page overlay | Picker highlight, numbered badges, count pill, inline composer with element chips |
| Context menu, shortcut (`Alt+Shift+F`) | Arm the picker from the page without opening the panel |
| Options page | Settings: backend, Test connection, Forget pairing, advanced server URL, remote-server opt-in, session-strategy override |

## Setup workflow

1. A fresh install opens the welcome tab. Updates do not. The toolbar badge reads `1` until the connection is ready.
2. Install opencode 2. `opencode --version` must start with `2`; `opencode upgrade` moves 1.x up.
3. Run `opencode pair` in a terminal. Copy the link. Do not open it; links expire in 5 minutes.
4. Paste the link or the bare code into the welcome tab. The link supplies the server endpoint, so no port is typed. A link to another machine shows its origin and the remote-server warning; confirming it sets the remote policy.
5. Connected. The page reads `Connected: opencode <version> at <host>`, and the badge clears.
6. Open the dev site, open the side panel, accept the disclosure, then pick a project. The panel card's "Finish setup" reopens the welcome tab if it was closed.

## Workflow

1. Browse and test. Something looks wrong.
2. Arm the picker — panel button, `Alt+Shift+F`, or right-click.
3. Hover: elements highlight with a tag/class label.
4. Click the element. The composer opens next to it.
5. Type the comment. Send. The feedback lands in the session picked by the active session strategy — or the one adopted in the session chooser.

To comment on the page as a whole instead of an element, type in the panel's comment box and send; an empty box sends the URL only.

## Element set (one comment, many elements)

One feedback can carry up to five elements from the same page. The comment is written once for the whole set.

| Gesture | Result |
|---|---|
| Cmd on macOS / Ctrl elsewhere + click | Adds the element; numbered badge, outline, count pill |
| Cmd/Ctrl+click an element already picked | Removes it |
| Release Cmd/Ctrl, press Enter, or pick the fifth element | Opens the composer with the set; the textarea takes focus |
| Plain click with an empty set | Adds the element and opens the composer — the single-element flow |
| Plain click with a set | Opens the composer; does not add the clicked element |
| Clear in the count pill, or Escape | Discards the set and disarms |
| Window blur | Discards the set and disarms |
| Route change (`pushState`, `replaceState`, `popstate`, `hashchange`) | Discards the set and disarms; an open composer closes and the background pending is cleared |
| Chip × in the composer | Removes one element before sending |
| Composer dismissed (Escape) | Drops the unsent set and clears the background pending |

Limits: five elements, four element screenshots, one page and tab per set, no elements added after the composer opens, click order kept as pick order. The count pill reads `N selected · release <modifier> to comment` (`⌘` on macOS, `Ctrl` elsewhere); the composer count line and the panel outbox/sent rows read `1 element` or `N elements`.

Screenshots are best effort per element: Chrome allows two `captureVisibleTab` calls per one-second window (extension-wide), so a fast burst skips the shot for later picks and keeps the element. The first pick of a set may wait for a token; later picks never queue. At most four shots attach per feedback. The 016 live smoke attached 4 shots on five picks 1.5 s apart; a faster 015 burst attached 2.

Route detection needs no extra permission. A MAIN-world content script (`picker-route.content.ts`, `document_start`) wraps the page's own `history.pushState`/`replaceState` and dispatches one event; the isolated picker listens for it plus `popstate`/`hashchange`. A page-world `pushState` closes an open composer and clears an armed set, confirmed live (016a). A page script can dispatch the same event by name and clear an armed set; accepted as a nuisance — it exposes no data and the worst case is a discarded unsent set.

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
| Bounding box, viewport, scroll | `getBoundingClientRect`; used for the screenshot crop, not rendered in the prompt |

Extras (shipped in phase 004b):

| Extra | Source | Caveat |
|---|---|---|
| Screenshot crop of each element | `captureVisibleTab` + canvas crop | Best effort; 2 captures per second; at most four per feedback. Fidelity under zoom and hi-DPI needs checking |
| Component name | `__reactFiber$*` / `__vueParentComponent` | Dev builds only; best effort |
| Computed styles subset + ARIA role/name | `getComputedStyle`; accessibility info | Keep the subset small or the prompt gets noisy |

Cross-origin iframe content is not reachable from the content script. Feedback targets the top frame only, for now.

## Prompt template

One compact shape for every N. N=1:

```
## Browser feedback — <project name>

Comment: <user text>

Element: <tag>.<classes> — "<text>" · <selector> · <attrs>
  extras    <component · aria · styles, only when captured>

Page: <full URL including query params>
  title     <page title>
```

N>1:

```
## Browser feedback — <project name>

Comment: <user text>

Elements (<N>):
1. <tag>.<classes> — "<text>" · <selector> · <attrs>
2. <tag>.<classes> — "<text>" · <selector> · <attrs>
   extras    <component · aria · styles, only when captured>

Page: <full URL including query params>
  title     <page title>
```

- Classes render as `.class` segments after the tag; the attrs segment is dropped when empty.
- No box, viewport, or scroll lines.
- One indented `extras` line per element, only when component, ARIA, or styles were captured.
- No `Sent by Browsertalk` footer. `SentItem.sentAt` still drives the panel timestamp.
- `Comment:` has no trailing space when the comment is empty; the `title` line is dropped when the title is empty.
- Screenshots attach as `element-1.png` … in pick order, at most four. The byte budget counts every attachment; a storage-quota drop strips the last element's screenshot, then the previous one, repeating until the item fits.

## Session model

The mapping from feedback to sessions is a seam, `lib/session-strategy/` (interface + registry + one file per strategy), mirroring the AgentBackend seam. Each backend declares its default strategy; settings override per backend.

One feedback is one comment for one page and its element set. The set never spans pages, tabs, or sessions; every send routes the whole set to the active session as a single prompt, regardless of the number of elements.

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
│ welcome tab (Vue 3)             setup: pair → connected         │
│ side panel (Vue 3)              UI, outbox, sent, setup card     │
│ options page                    backend · connection · strategy │
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

opencode endpoints the adapter uses (verified against a live 2.x server):

| Op | Endpoint |
|---|---|
| Pair | `POST /api/pair` → code; `GET /auth/connect/{code}` with `Accept: application/json` → token |
| Projects | `GET /api/project` |
| Session | `POST /api/session` with `{ title, location: { directory } }` |
| Sessions | `GET /api/session` — list; filters `directory`, `search`, `parentID`, `cursor` |
| Session refresh | `GET /api/session/{id}` — 404 when the session is gone |
| Prompt | `POST /api/session/{id}/prompt` with `{ text, delivery }` |
| Events (later) | `GET /api/event` |

Server URL: the endpoint carried by the pairing link. A bare code redeems against the saved URL. `opencode serve` defaults to port 4096; the background service uses a dynamic port and `opencode service status` prints its URL. `http://127.0.0.1:15001` remains the stored fallback for installs that predate link pairing; it is not a stock opencode default.

Pairing: `opencode pair` prints a link to `/auth/connect/{code}` that carries the server endpoint. The code is single-use and expires in 5 minutes. The user copies the link — opening it spends the code — and pastes it, or the bare code, into the setup surface.

## Storage model (keys in `chrome.storage.local`)

| Key | Value |
|---|---|
| `settings.backendId` | `opencode` \| `pi` \| `fake`; `fake` is not offered as a user choice |
| `settings.serverUrl` | Base URL of the server; set by the pairing link |
| `settings.allowRemote` | Remote-server opt-in, off by default |
| `settings.sessionStrategy` | Per-backend strategy override (`{ [backendId]: strategyId }`) |
| `auth.tokens` | Pairing tokens keyed by `backendId@endpoint`; the legacy `auth.token` is migrated on boot |
| `projects.byOrigin` | Per connection, then `origin → project directory` |
| `sessions` | Per connection, then session refs per strategy: per-day `<directory>::<date>`, sticky `<directory>` → `{ sessionID, title }` |
| `outbox` | Unsent feedback items. `facts.elements[]` holds the ordered element set; a legacy `facts.element` is normalized to a one-entry set on read |
| `sent` | Recent sent summaries, capped. `elementCount` records the set size (0 for page-only, N for element sets); old records have no count |

## Permissions rationale

| Permission | Why |
|---|---|
| `storage` | Settings, token, outbox, mappings |
| `sidePanel` | The primary surface |
| `contextMenus` | Right-click → comment on element |
| `<all_urls>` (host) | Picker on any dev site; element screenshots |
| `commands.arm-picker` | `Alt+Shift+F` shortcut |

The MAIN-world route bridge (`picker-route.content.ts`) runs under the existing host access; it adds no permission. No `webNavigation` permission.

## Security

- The pairing token lives in extension storage only. Never in code, logs, or the page.
- The pairing link is single-use and expires in 5 minutes. Setup copy says "Copy the link. Do not open it."
- The server is loopback-only by default. A settings opt-in ("Allow a remote server", off by default, with a warning) accepts another machine; credentials never live in the URL either way.
- The content script never talks to the server. The background service worker is the only client.

## Non-goals (MVP)

- Firefox / Safari builds. WXT supports them; untested here.
- Attachments beyond the element screenshot.
- Multi-user, shared sessions.

### Out of scope for element sets (015)

- Cross-page pick sets, cross-tab collection, per-element session routing.
- Marquee, area, or text-range selection.
- More than five elements, or more than four screenshots, per feedback.
- Adding elements after the composer opens.
- Page-level feedback carrying an element set; the panel comment box stays page-only.
- Reordering the set; click order is kept.
- Changing delivery; `queue` stays the default.

## Open questions

- Pi bridge shape: new daemon vs. an existing pi server mode. Unconfirmed.
- Screenshot crop fidelity under browser zoom and hi-DPI displays. The capture budget is settled: 2 captures per 1-second window, 4 shots per set, fast picks skip the shot (`plans/015-element-set/research-screenshot-capture.md`). Live runs: 016e attached 4 shots on five picks 1.5 s apart; 015 attached 2 on a faster burst. The four-attachment cap is unit-tested (five shots → four attachments). Procedure: `plans/016-review-fixes/smoke.md`.
- Component-name detection coverage (React 19 dev fibers, Vue production builds).
- Day boundary: local midnight assumed; sessions created just before it split.
- Expose `steer` as a per-send toggle, or keep queue-only.
- Ship phase: in-product consent wording for User Data FAQ #10; enforcement scope unconfirmed.
- Ship phase: host access strategy — keep `<all_urls>` vs `activeTab` + optional host grants; review-time tradeoff.
- Ship phase: whether Chrome Web Store review accepts an opencode 2.x install as the test prerequisite, with no demo path. Unconfirmed until submission.

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
| Port scan for the opencode server | The pairing link carries the real port; scanning is slow and intrusive |
| Demo or fake backend as a user choice | A test double cannot deliver to a session; the fake stays test-only |
