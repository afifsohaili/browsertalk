# CONTEXT — ubiquitous language

Canonical terms for opencode Browsertalk. Use these words in UI copy, code, docs, and issues. One word per idea.

## Core terms

| Term | Meaning |
|---|---|
| Feedback | One comment plus the page facts and the element set it describes. The unit Browsertalk produces and sends |
| Facts | The data captured about the page and elements, attached to a feedback. Split into core facts and extras |
| Core facts | The always-captured subset: URL, title, element tag/id/classes, selector, text, attributes, box |
| Extras | Optional captures: element screenshot, component name, computed styles + ARIA |
| Element set | The ordered elements one feedback carries, one to five, all from the same page and tab. Click order is pick order. The composer and panel rows read `1 element` or `N elements`; up to four screenshots attach |
| Pick state | The picker's live element set, spanning arm → finish → composer. `createPickState` owns it; finish hands it to the composer as chips; sending, dismissing, route change, or composer close clears it and the background pending |
| Multi-pick | Holding Cmd (macOS) or Ctrl elsewhere while clicking to build an element set |
| Picker | The content-script mode for selecting elements. Hover highlights; a plain click picks one; Cmd/Ctrl+click accumulates a set |
| Arm | Verb: turn the picker on ("arm the picker", "armed") |
| Composer | The inline card anchored to the last picked element. Chips show the element set, the textarea takes the one comment |
| Chip | One element's row in the composer: label plus `×` to drop that element from the set |
| Count pill | The fixed bottom-centre indicator while picking: `N selected · release <modifier> to comment` (`⌘` or `Ctrl`), with Clear |
| Comment box | The panel's textarea for page-level feedback; an empty box sends the URL only |
| Outbox | Feedback that has not been sent yet |
| Sent | Feedback already delivered to a session, shown as a summary line |
| Session | An agent conversation. A Browsertalk session is the feedback target: per project, per the active strategy |
| Session strategy | The rule mapping feedback to sessions. A seam in `lib/session-strategy/`; ships per-day and sticky |
| Sticky | Strategy: one long-lived session per project until "+ new session" |
| Per-day | Strategy: one session per (project, local date) |
| Session title | Per-day strategy: `Browsertalk · <project> · <YYYY-MM-DD>`. Sticky keeps the human's title |
| Session chooser | The panel list for the bound project's sessions: "+ new session" first, then existing sessions |
| Adopt | Verb: point the active strategy slot at an existing session picked in the session chooser |
| Project | A codebase directory opencode knows (`location.directory`) |
| Project binding | The remembered mapping origin → project |
| Origin | Scheme + host + port of the page. The key for a project binding |
| Backend | Short for agent backend. The software Browsertalk sends feedback to |
| Agent backend | The strategy interface `AgentBackend` (ping / listProjects / createSession / sendFeedback) |
| Adapter | One backend implementation file: `opencode.ts`, `pi.ts`, `fake.ts` |
| Registry | Where adapters register at boot. `getAgentBackend(id)` selects; unknown ids fail fast |
| Fake backend | In-memory test double used by tests without a live server. Not a user choice |
| Setup | The first-run flow from opencode 2 to a picked project. `setupStep` drives it: `checking`, `prerequisite`, `upgrade`, `pair`, `remote`, `project`. The welcome tab and the panel setup card read the same state |
| Pairing | Exchanging a short-lived pairing code from `opencode pair` for a token |
| Pairing link | The `opencode pair` output: a URL ending `/auth/connect/<code>` that carries the server endpoint and a single-use code. Expires in 5 minutes. Copy it; do not open it |
| Pairing code | Short-lived code from `POST /api/pair`; redeemed via `GET /auth/connect/{code}` |
| Token | The credential stored after pairing, keyed by backend and endpoint; used as the auth header |
| Server URL | Base URL of the opencode server. Comes from the pairing link; a bare code uses the saved value. `http://127.0.0.1:15001` is the legacy saved fallback |
| Server check | The unauthenticated `/api/info` probe behind Test connection, Check again, and the startup badge. It separates unreachable from unpaired without a token |
| Connected | The state where the server answered the check, the token was accepted, and the version is 2.x. Clears the setup badge; the next action is "Pick a project" |
| Remote server | An opencode server on another machine; opt-in via the "Allow a remote server" setting, off by default |
| Delivery | How a feedback enters a busy session: `queue` (wait for idle) or `steer` (interrupt). Default `queue` |
| Surfaces | The UI entry points: welcome tab, side panel including its setup card, overlay, context menu, shortcut, options page |

## Code names

| Name | Where |
|---|---|
| `AgentBackend`, `AgentBackendId`, `DeliveryMode`, `SessionRef` | `lib/agent-backend/interface.ts` |
| `registerAgentBackend`, `getAgentBackend`, `listAgentBackends` | `lib/agent-backend/registry.ts` |
| `OpenCodeBackend`, `FakeAgentBackend` | `lib/agent-backend/opencode.ts`, `fake.ts` |
| `registerBuiltinBackends` | `lib/agent-backend/builtins.ts`, called from `entrypoints/background.ts` |
| `SessionStrategy`, `SessionStrategyId` | `lib/session-strategy/interface.ts` |
| `adoptSession`, `adoptStoredSession` | `lib/session-strategy/interface.ts`, `persist.ts` — the pick path |
| `registerSessionStrategy`, `getSessionStrategy`, `listSessionStrategies` | `lib/session-strategy/registry.ts` |
| `createPickState`, `pickAction`, `MAX_PICKED_ELEMENTS` | `lib/picker/pick-state.ts` |
| `MAX_ELEMENT_ATTACHMENTS` | `lib/picker/limits.ts` |
| `installRouteEmitter`, `watchRouteChanges`, `watchWindowRoutes` | `lib/picker/route.ts` |
| `picker-route.content.ts` | The MAIN-world route bridge content script entrypoint |
| `respondToPickerRequest`, `registerPickerMessageHandler` | `lib/picker/handler.ts` — the background layer |
| `formatElementCount` | `lib/element-count.ts` — the `1 element` / `N elements` rule |
| `createPerTabQueue` | `lib/per-tab-queue.ts` — serialises capture and pending writes per tab |
| `picker.content.ts` | The content script entrypoint |

File naming follows the seam convention: `interface.ts` (contract), `registry.ts`, one file per adapter, `fake.ts`, `builtins.ts`. The session-strategy seam reuses the shape: one file per strategy (`per-day.ts`, `sticky.ts`).

## Words we do not use

| Avoid | Use | Why |
|---|---|---|
| Shot (as a noun) | Feedback | One unit, one word. "Shoot" stays a verb in copy only |
| Connector, provider | Backend, agent backend | Provider is reserved for model providers in opencode |
| Task, ticket, issue | Feedback | A feedback is not a tracked work item |
| Verify, confirm, validate | Check | Global convention |
| Configuration, settings (in prose) | Config | Global convention. "Settings page" is fine as a UI surface name |
| Session per comment | Session strategy names | Name the rule, not the anecdote |
| Thread (as our unit) | Session | One word per idea; thread is other agents' vocabulary |
| Selection | Element set | Selection reads as text or marquee selection; the unit is a set of elements |
| Batch | Element set | Batch suggests queued processing; one feedback carries the set |
| Demo, demo mode | Fake backend (tests only) | The fake tests the extension; it is not a product path |
