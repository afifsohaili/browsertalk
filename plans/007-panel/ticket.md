# 007: Panel

**What to build:** The side panel becomes the control room: current target (project + session title), the outbox, the sent list, and "+ new session" which rolls the session over and continues on the fresh one.

**Blocked by:** 006 — Send.

**Status:** done

- [x] Header shows the bound project and current session title; updates when either changes
- [x] Outbox list with retry / discard per item; sent list capped, showing time + target
- [x] "+ new session" rolls over via the active strategy; header shows the new session
- [x] Honest empty + offline states; no fake data
- [x] Verified in a real browser session (not just tests)
- [x] `bun run compile` passes; one conventional commit; phase doc updated

## Outcome

Shipped:

- Strategy peek (`lib/session-strategy/`): `SessionStrategy.peekSession` added to the interface; `persist.peekStoredSession` reads the stored ref for the strategy key without creating a session; per-day and sticky implement it via their existing `persistInput`. The header can show the current session title with no side effect.
- Panel messaging (`lib/panel/protocol.ts`, `lib/panel/messages.ts`, registered from `entrypoints/background.ts`): background-side requests `target/read` (bound project + stored session through the active strategy), `outbox/retry` (awaits `sendQueuedItem` and returns the outcome), `session/rollover` (active strategy for the bound origin). Surface helpers `requestTargetRead` / `requestOutboxRetry` / `requestSessionRollover`; all registry and backend access stays in the background (product.md §Security — background is the only server client).
- Panel logic (`lib/panel/use-panel.ts`): target resolved from the active tab (`tabs.query` + `tabs.onActivated` / `tabs.onUpdated`), re-read on `storage.local` changes (`sessions`, `projects.byOrigin`, `settings.backendId`, `settings.sessionStrategy`); outbox/sent re-read from the `outbox/changed` broadcast and storage changes; `retry`, `discard` (remove + `broadcastOutboxChanged`), `newSession` (header updates from the rollover response); honest `targetState` selection (`unavailable` / `no-page` / `unbound` / `no-session` / `ready`); `formatTimestamp` (time today, `MM-DD HH:mm` otherwise).
- Side panel UI (`entrypoints/sidepanel/App.vue`): project name (+ directory in title) and session title with the session id line under it; "+ new session" (disabled without a bound project, "Starting…" while running); outbox rows with comment, time + page, the item error, Retry / Discard; sent rows with time · session title; explicit "Loading…", "Nothing waiting.", "Nothing sent yet.", "No session yet", "No project bound", "No page" copy; panel-level error line. The stale "Sending lands in a later phase" note is gone.
- Tests: +39 (345 total / 33 files vs 306 / 30): 3 strategy peek, 7 panel protocol guards, 10 panel messaging (target read on/off binding, retry success/failure, rollover success/unbound/backend failure, background-unavailable fallback), 19 panel logic (load, target states, binding/session/tab updates, scope teardown, retry/discard/rollover flows, unavailable state, `targetState`, `formatTimestamp`). One registry-test stub gained `peekSession`.
- Real-browser check (headless Chromium 152 + CDP, built extension, 30/30): the docked side panel opened via a genuine CDP input click in a popup tab (CDP `userGesture` from the service worker was refused by Chrome, so the gesture comes from a real click). Fake opencode stub server only — no LLM, no live server: header showed `browsertalk-panel-smoke` + "No session yet"; seeded outbox rendered with the stored error; Retry sent through the stub, created `ses_stub_1`, and the sent row showed `12:23 · Browsertalk · browsertalk-panel-smoke · 2026-10-10`; Discard emptied the outbox with honest copy; "+ new session" twice moved the header id `ses_stub_1 → ses_stub_2 → ses_stub_3`; a later send landed on `/api/session/ses_stub_3/prompt`; no DELETE ever hit the stub; switching to another tab updated the header to "No project bound" and back; a dead server URL made "+ new session" show `Cannot reach the opencode server …` while keeping the last session. Script: `/tmp/opencode/browsertalk-007-smoke/smoke.mjs` (throwaway, not committed).

Divergences:

- Retry awaits `sendQueuedItem` in the background instead of the fire-and-forget `requestSend` dispatcher: the panel needs the send outcome to refresh and to avoid faking success. Same pipeline the trigger dispatches; the trigger's void dispatcher is unchanged.
- `SessionStrategy` grew one read-only member beyond the documented six axes (`peekSession`); the alternative (compute the strategy storage key in the panel) leaks persistence into the surface.
- The header shows the session id as well as the title: under both strategies a rollover keeps the same title, so the id is the visible proof of "the fresh one". The header also follows the active tab, not only binding/session changes.
- A failed target read surfaces as `unavailable` ("—" rows plus the error) instead of collapsing into "No project bound" — an unknown target never renders as an empty one.
- `SENT_LIMIT = 50` stays enforced in `appendToSent` (006); the panel renders the stored list newest-first without a second cap.
- The fake agent backend gets a fresh instance per resolve, so its ids repeat across rollovers; unit tests pin rollover with a seeded old ref, and the browser check ran against the opencode wire path (stub server) where ids increment.

Pending:

- Popup `sent` counter wiring to `countSent()` — listed as pending for 007 by the 006 doc but outside this ticket's stated panel scope; the popup still shows `sent 0`.
- No project-binding UI exists yet (`requestBind` has no caller); the panel honestly reports "No project bound".
- Stale stored sessions (deleted server-side) are still not pruned (carried over from 006).
