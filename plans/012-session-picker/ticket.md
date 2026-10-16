# 012: Session chooser — create or adopt an existing session

**What to build:** The panel's standalone "+ new session" button becomes a session chooser. The Session row gets a "change" affordance (mirrors the Project row) that opens an inline list for the bound project: "+ new session" as the first row (today's rollover), then the project's existing sessions, newest first, current marked. Picking an existing session adopts it into the active strategy slot; every later send routes there with no send-path change. Backends gain optional `listSessions` / `getSession`; opencode maps them to `GET /api/session` and `GET /api/session/{id}` so stored sessions refresh titles and auto-heal when deleted in the TUI.

Owner decisions (2026-10-16 question round): adopt into the strategy slot (not a manual strategy); combined list with "new session" first row; rows show title + current marker (no timestamp, `SessionRef` unchanged); `getSession` auto-heal in scope. Deferred: list search box, pin-across-days semantics, pi bridge listing.

**Blocked by:** none.

**Status:** done (sha recorded by the follow-up docs commit)

## Wire facts (verified live on `127.0.0.1:15001`, 2026-10-16; plus the v2 OpenAPI)

- `GET /api/session?directory=<abs>&parentID=null&order=desc` → `{ data: Session.Info[], cursor }`; `Session.Info` carries `id`, `title`, `time.updated`, `location.directory`. `roots=true` is silently ignored; `parentID=null` filters to root sessions. Default limit: newest 50.
- `GET /api/session/{id}` → `{ data: Session.Info }`; missing → 404 `_tag: SessionNotFoundError`.
- Titles come from the DB and are present in practice; empty/missing falls back to the session id.

## Checklist

- [x] `SessionListQuery` gains `rootsOnly?: boolean`; `OpenCodeApi.listSessions` builds `directory` + `parentID=null` + `order=desc` + optional `search`; maps `{ data }`; title falls back to id; skips non-root rows defensively; malformed → `UNEXPECTED_RESPONSE`
- [x] `OpenCodeApi.getSession` → `GET /api/session/{id}`; `missing-session` (404) → `null`
- [x] `OpenCodeBackend` implements both (not-paired guard like siblings). `FakeAgentBackend` stays minimal — optional methods opt-in via test subclasses (existing `RefreshingBackend` / `PanelFakeBackend` pattern; a native fake `getSession` would break the "backend without getSession keeps the stored title" guard test)
- [x] `SessionStrategy.adoptSession` + `adoptStoredSession` in `persist.ts`: writes the picked ref into the slot, keeps the slot's generation; both strategies delegate
- [x] `peekStoredSession` refreshes through `getSession` when the backend has it: removed → `null`, renamed → fresh title written back; no `getSession` → stored ref as today
- [x] Panel protocol: `sessions/list` + `sessions/choose` requests, `SessionsListResult` (`supported` flag) + `SessionChooseResult`, guards, client fns
- [x] Handlers: list (supported = `backend.listSessions !== undefined`; bound project as `directory`; `rootsOnly: true`); choose (under `withSessionLock`, same shape as rollover)
- [x] `use-panel`: sessions list state mirroring the projects picker (open/close/choose, delayed-result + origin/connection-change guards); rollover stays as `newSession()`
- [x] `App.vue`: Session row "change"; section with "+ new session" row first, session rows (title + id line, current marked), loading / empty / unsupported-hint / error states, Refresh + Close; standalone button removed
- [x] Tests red→green at each seam (api, adapter, persist, strategy, protocol, handlers, panel); docs updated (`product.md`, `README.md`, `CHROMEWEBSTORE.md`, `CONTEXT.md`)
- [x] `bun run compile` + `bun run test` pass; one conventional commit

## Outcome

Shipped in the phase commit (`feat(panel): session chooser — create or adopt an existing session`; sha recorded by the follow-up docs commit). `bun run compile` exit 0; `bun run test` 49 files / 733 tests; `bun run build` exit 0. Live CDP check against the running server on 15001: 6/6.

**Shipped**

- Seam: `SessionListQuery` gains `rootsOnly`. `OpenCodeApi.listSessions` builds `GET /api/session?directory=&parentID=null&order=desc` (plus optional `search`), maps the `{ data }` envelope, falls back to the id when the title is missing/empty, and filters child rows defensively. `OpenCodeApi.getSession` reads `GET /api/session/{id}` and maps `missing-session` (404) to `null`. `OpenCodeBackend` implements both behind the not-paired guard. `FakeAgentBackend` stays unchanged: the optional methods are opt-in via test subclasses, which keeps the "backend without `getSession` keeps the stored title" contract test honest and lets the plain fake exercise the unsupported-list path.
- Strategy: `adoptSession` on `SessionStrategy`; `adoptStoredSession` writes the picked ref into the slot and keeps the slot's generation; `per-day` / `sticky` delegate. `peekStoredSession` now refreshes through `getSession` when the backend has it: removed → `null` (panel shows "No session yet"; the next send recreates with the next generation), renamed → fresh title written back; when the refresh fails it keeps the last known ref (display-only — sends still surface the failure).
- Panel protocol: `sessions/list` (`supported` flag from method presence; `directory` = bound project; `rootsOnly: true`) and `sessions/choose` (adopt under the session lock, same shape as rollover), guards and client fns.
- `use-panel`: sessions list state mirroring the project picker (open/close/choose, delayed-result and origin/connection-change guards, one list at a time, rollover closes the list on success). `App.vue`: the Session row gets "change"; the standalone "+ new session" button became the first row of the chooser; rows show title + id line with the current row marked; loading / empty / unsupported-hint / error states; Refresh + Close.
- Docs: `product.md` (comparison table, surfaces, workflow, session model, endpoint table), `README.md`, `CHROMEWEBSTORE.md`, `CONTEXT.md` (Session chooser, Adopt terms; `adoptSession`/`adoptStoredSession` code names).

**Live check** (throwaway script `~/.cache/opencode-tmp/browsertalk-012-smoke/smoke.mjs`, not committed)

- Headless Chrome 155 + CDP. `--load-extension` no longer works (removed in Chrome 137+); used `Extensions.loadUnpacked` with `--enable-unsafe-extension-debugging`. `sidepanel.html` was driven as a tab; the real side-panel chrome was not exercised.
- Against the live server with a throwaway session: the chooser listed both project sessions with "+ new session" first; adopting wrote the per-day slot (`opencode` default) and the header followed; "Send page URL only" admitted the feedback into the adopted session (Sent entry with its title; the server's session context contains the `## Browser feedback — browsertalk` prompt); reopening the chooser marks the row current. The throwaway session was deleted after the check (204). A real agent turn may have started once in the throwaway session before deletion.

**Wire facts (live, server 2.0.25 on 15001)**

- `GET /api/session` honors `directory` and `parentID=null`; `roots=true` is silently ignored — keep `parentID=null`.
- `GET /api/session/{id}` → `{ data: Session.Info }`; missing → 404 `_tag: SessionNotFoundError`.
- Titles come from the DB and are present in practice; empty/missing falls back to the id.

**Divergences / decisions**

- Exploration said `fake.ts` would implement both optional methods; shipped as opt-in test subclasses instead (see Shipped).
- Conformance: `OpenCodeServerSim` gained a `GET /api/session/{id}` route and a `get-session` transport operation — implementing `getSession` activated the stored-session refresh inside `checkCreationIntent`, which had been silently skipped.
- `peekStoredSession`'s last-known-ref fallback on refresh failure was added mid-phase with its test; not in the original checklist.
- Session rows include the id line: titles repeat after rollover (two sticky sessions can share one title).
- Shared list styles were renamed to neutral `.choice*` classes; the project picker uses the same classes.
- Deferred as planned: search box, updated-time column, pin-across-days semantics, pi bridge listing.

**Next-phase must-know**

- Roots filter is `parentID=null`; `roots=true` is ignored by 2.0.25.
- Backends without `listSessions` (pi bridge) show "This backend does not list sessions." while "+ new session" keeps working.
