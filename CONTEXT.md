# CONTEXT — ubiquitous language

Canonical terms for opencode Browsertalk. Use these words in UI copy, code, docs, and issues. One word per idea.

## Core terms

| Term | Meaning |
|---|---|
| Feedback | One comment plus its captured facts. The unit Browsertalk produces and sends |
| Facts | The data captured about the page and element, attached to a feedback. Split into core facts and extras |
| Core facts | The always-captured subset: URL, title, element tag/id/classes, selector, text, attributes, box |
| Extras | Optional captures: element screenshot, component name, computed styles + ARIA |
| Picker | The content-script mode for selecting an element. Hover highlights, click selects |
| Arm | Verb: turn the picker on ("arm the picker", "armed") |
| Composer | The inline box next to the selected element where the comment is typed |
| Outbox | Feedback that has not been sent yet |
| Sent | Feedback already delivered to a session, shown as a summary line |
| Session | An opencode conversation. A Browsertalk session is the session for one project and one day |
| Session strategy | The rule mapping feedback to sessions. Currently: per-day, per-project |
| Session title | `Browsertalk · <project> · <YYYY-MM-DD>` — the findable name in the TUI |
| Project | A codebase directory opencode knows (`location.directory`) |
| Project binding | The remembered mapping origin → project |
| Origin | Scheme + host + port of the page. The key for a project binding |
| Backend | Short for agent backend. The software Browsertalk sends feedback to |
| Agent backend | The strategy interface `AgentBackend` (ping / listProjects / createSession / sendFeedback) |
| Adapter | One backend implementation file: `opencode.ts`, `pi.ts`, `fake.ts` |
| Registry | Where adapters register at boot. `getAgentBackend(id)` selects; unknown ids fail fast |
| Fake backend | In-memory test double used by tests and dev without a live server |
| Pairing | Exchanging a short-lived pairing code for a token |
| Pairing code | Short-lived code from `POST /api/pair`; redeemed via `GET /auth/connect/{code}` |
| Token | The credential stored after pairing; used as the auth header |
| Server URL | Base URL of the opencode server. Default `http://127.0.0.1:15001` |
| Delivery | How a feedback enters a busy session: `queue` (wait for idle) or `steer` (interrupt). Default `queue` |
| Surfaces | The UI entry points: side panel, popup, overlay, context menu, shortcut |

## Code names

| Name | Where |
|---|---|
| `AgentBackend`, `AgentBackendId`, `DeliveryMode`, `SessionRef` | `lib/agent-backend/interface.ts` |
| `registerAgentBackend`, `getAgentBackend`, `listAgentBackends` | `lib/agent-backend/registry.ts` |
| `OpenCodeBackend`, `FakeAgentBackend` | `lib/agent-backend/opencode.ts`, `fake.ts` |
| `registerBuiltinBackends` | `lib/agent-backend/builtins.ts`, called from `entrypoints/background.ts` |
| `picker.content.ts` | The content script entrypoint |

File naming follows the seam convention: `interface.ts` (contract), `registry.ts`, one file per adapter, `fake.ts`, `builtins.ts`.

## Words we do not use

| Avoid | Use | Why |
|---|---|---|
| Shot (as a noun) | Feedback | One unit, one word. "Shoot" stays a verb in copy only |
| Connector, provider | Backend, agent backend | Provider is reserved for model providers in opencode |
| Task, ticket, issue | Feedback | A feedback is not a tracked work item |
| Verify, confirm, validate | Check | Global convention |
| Configuration, settings (in prose) | Config | Global convention. "Settings page" is fine as a UI surface name |
| Session per comment | Session strategy names | Name the rule, not the anecdote |
