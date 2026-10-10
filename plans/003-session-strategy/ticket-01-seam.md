# 003a: Session strategy seam

**What to build:** The rule that maps feedback to sessions becomes a seam, so backends with different habits get a fitting rule. Two strategies ship: per-day (one session per project per local day, titled `Browsertalk · <project> · <date>`) and sticky (one long-lived session per project until a rollover). Each backend declares its default; opencode's is per-day. A rollover operation starts a fresh session and continues on it (the panel button arrives in 007).

**Blocked by:** 002 — Connection.

**Status:** done

- [x] Strategy contract mirrors the agent-backend seam: register / get / list; unknown ids fail fast with the known list (`lib/session-strategy/registry.ts`; tests assert the exact error with `per-day, sticky`)
- [x] Per-day: first feedback of the day creates the session; later feedback reuses it; rolls over at local midnight (key `<directory>::<YYYY-MM-DD>`; `now` injected per call so tests cross midnight)
- [x] Sticky: one long-lived session per project; every feedback appends; rollover starts a fresh one (key `<directory>`; reuse returns the stored title, so a human rename survives)
- [x] Selection resolves settings override first, backend default second; opencode defaults to per-day (`AgentBackend.defaultSessionStrategy`; fake also per-day; junk overrides fall back to the default)
- [x] Session refs stored per strategy in extension storage; survive restarts (`sessions` key, scoped `sessions[backendId][strategyId][<key>]` — see Outcome for the deviation)
- [x] Unit tests: registry fail-fast, per-day rollover, sticky reuse + rollover — fake-backed (`fakeBrowser` storage + `fake` backend; no live server, no LLM spend)
- [x] `bun run compile` passes; one conventional commit; phase doc updated

## Outcome

Shipped:

- Seam `lib/session-strategy/`: `interface.ts` (`SessionStrategyId` = `per-day` | `sticky`, `isSessionStrategyId`, `SessionStrategy` with `resolveSession` / `rolloverSession`, input `{ backend, directory, now? }`), `registry.ts` (`registerSessionStrategy` / `getSessionStrategy` / `listSessionStrategies`), `per-day.ts`, `sticky.ts`, `selection.ts`, `builtins.ts`, `index.ts`. `persist.ts` holds the shared read-from-storage-or-create flow both strategies use.
- Per-day: key `${directory}::${localDateKey(now)}`, title `Browsertalk · <project> · <YYYY-MM-DD>` (project = directory basename, local date). First feedback creates via `backend.createSession({ directory, title })`; later feedback returns the stored ref; the date change at local midnight creates the next session. `rolloverSession` re-creates for the current day and replaces the stored ref.
- Sticky: key `${directory}`, creation title `Browsertalk · <project>`; every feedback returns the same ref across days; `rolloverSession` creates a fresh session and replaces the ref.
- Storage `lib/storage/sessions.ts`: `getStoredSession` / `setStoredSession` under the `sessions` key; value shape `{ sessionID, title }`; junk shapes read as null.
- Settings: `settings.sessionStrategy` = `{ [backendId]: strategyId }`; `getSettings()` validates and drops junk entries; `setSettings` replaces the whole map when provided. Selection: stored override (validated) beats `backend.defaultSessionStrategy`; opencode and fake default `per-day`. `resolveActiveSessionStrategy()` returns `{ backend, strategy }` — the call surface phase 006 sends on.
- `AgentBackend` gains `defaultSessionStrategy`; `FakeAgentBackend` records `createInputs`. Boot: `registerBuiltinSessionStrategies()` in `entrypoints/background.ts`.
- Tests: 29 added (registry, storage, per-day, sticky, selection); suite 92 passed / 13 files; `bun run compile` passes.

Divergences:

- Refs are storage-scoped by backend and strategy (`sessions[backendId][strategyId][<key>]`) instead of product.md's flat `sessions[<key>]` — refs never leak between backends or strategies. Key formats (`<directory>::<date>`, `<directory>`) and the `{ sessionID, title }` value match product.md.
- A junk stored override falls back to the backend default (same policy as `settings.backendId`); `getSessionStrategy` still fails fast for unregistered ids.
- Sticky creation title is `Browsertalk · <project>` — product.md names no creation title for sticky; reuse never re-titles.
- Rollover keeps the previous ref and session (old sessions stay resumable); stale per-day refs are not pruned yet.

Pending (later phases):

- 006 wires the send path on `resolveActiveSessionStrategy()`; no sending or prompt rendering here.
- 007 "+ new session" calls `strategy.rolloverSession(...)`.
- 003b options page writes `settings.sessionStrategy` (replace semantics; read-modify-write).
- Stale refs (session deleted server-side, old per-day dates) are not validated or pruned.
