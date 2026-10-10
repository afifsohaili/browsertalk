# 010-08: Migration leftovers + connection-bound selection

**What to build:** Fix verification issues 3 and 7 (from `/tmp/opencode/verify-pre-009.md`): legacy-key migration claims once without overwriting scoped data, and project selection/rollover capture the connection identity they act on.

**Blocked by:** 010-07 — Byte-accurate budgets + pending/binding serialization.

**Status:** done · 5a181e4

- [x] Migration consumes legacy credentials/refs exactly once and never assigns them to a later connection (test: scoped token + legacy token present, then endpoint change → legacy never claimed by the new endpoint)
- [x] Project picker and rollover capture connection identity (backend + endpoint) when opened; results from a previous connection are discarded; binding/rollover act on the captured connection
- [x] Tests for both; `bun run compile` + full suite pass; one conventional commit; plans updated

Details: `/tmp/opencode/verify-pre-009.md` regressions 3, 7.

## Outcome

Shipped in `5a181e4` (`fix(connection): migration once-only claiming and connection-bound selection`). `bun run compile`, `bun run test` (49 files, 649 tests), and `bun run build` pass.

**Shipped**

- Migration once-only claiming (`lib/connection/migrate.ts`): a scoped token wins and the legacy `auth.token` is removed in the same pass, so no later endpoint can claim it. Legacy backend-keyed session refs are merged into the scoped connection per strategy slot (scoped wins on a collision, unrelated legacy refs are carried over) and the legacy bucket is deleted.
- Connection identity on the wire: `connection/projects`, `connection/bind`, and `session/rollover` carry a `ConnectionIdentity` validated by `isConnectionIdentity` (non-empty backend id, canonical loopback endpoint); `target/read` echoes the identity it resolved, token stripped.
- Captured-connection actions: `listServerProjects(connection)`, `bindOrigin({ ..., connection })`, and new `resolveSessionStrategyFor(connection)` act on the captured identity, never the configured one. `resolveConnection` is the shared builder (loopback re-check + namespaced token).
- Panel binding (`lib/panel/use-panel.ts`): `openProjects` captures the target's connection identity; `chooseProject` binds on it; `newSession` captures it and discards a result superseded by a connection change. `onStorageChanged` closes the picker synchronously when `backendId`/`serverUrl` change, and a target read whose connection differs from the open picker closes it; both discard delayed list results.
- Tests: migration reproduction (scoped token + legacy token, then endpoint change → nothing claimed by the new endpoint; same for refs, with an unrelated legacy ref merged); delayed project list discarded after a same-origin endpoint change; rollover bound to captured A while settings switch to B mid-flight (session lands under A, result discarded); superseded bind refused; captured-connection listing and binding at service and message level.

**Divergences / decisions**

- Binding no longer reads the stored server URL: the captured identity is authoritative and re-validated against loopback, so the stored-URL refusal test became a captured-endpoint refusal test.
- `usePanel` keeps the target's connection identity internally (not on `PanelTarget`), so the public panel shape and `App.vue` are unchanged.
- Once the panel observes a connection change it closes the picker and refuses `chooseProject`/`newSession`; requests already in flight still act on the captured connection, which keeps routing correct.
- Session refs merge per strategy+slot with scoped precedence; a legacy ref under a strategy the scoped store does not have is preserved rather than dropped.

**Pending**

- Live Chrome and live server behavior stays unconfirmed: no real browser or live opencode run; the panel and message paths were exercised through `fakeBrowser` and the fake backend only.
