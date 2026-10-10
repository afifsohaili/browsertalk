# 002: Connection

**What to build:** The extension can reach the opencode server the user runs. The user creates a pairing code on the TUI side, pastes it into the extension, and it is exchanged for a token that is remembered. Popup and side panel show live connection status, the project list is fetched, and the current page's origin can be bound to a project (remembered).

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Pairing works end to end against a live loopback server: a code issued by `opencode api post /api/pair` (TUI side) is redeemed; a wrong or expired code shows a clear error and changes nothing — verified against the live 2.0.24 server on 2026-10-10 with the real adapter module (see Outcome; the command needs `--server <settings.serverUrl>` because a bare `opencode api post /api/pair` targets the CLI's own background service on a random port)
- [x] The token lives only in extension storage; never in code, logs, or pages (responses to the surfaces carry no token; asserted in tests)
- [x] `ping` status (ok / detail) renders in popup and side panel and updates after pairing without a reload (shared `ConnectionPanel.vue`; the `useConnection` spec proves the update — no in-browser visual check was run)
- [x] The project list is fetched and the origin can be bound to a project; the binding persists (`GET /api/project` → `Project`; `bindOrigin` → `projects.byOrigin`; the picking UI lands in the picker/panel phases)
- [x] Test harness lands: Vitest with WXT's plugin (`WxtVitest`) + in-memory extension APIs; pairing/token/storage covered against an injected fetch — no live server in tests
- [x] `bun run compile` passes; one conventional commit; phase doc updated

## Outcome

Shipped:

- Test harness: `vitest.config.ts` (`WxtVitest`), `"test": "vitest run"`, `fakeBrowser.reset()` per test, module-level `setOpenCodeFetch`/`resetOpenCodeFetch` seam. 63 tests, 8 files, no live server.
- Storage (`lib/storage/`): `settings.backendId` / `settings.serverUrl` with defaults `opencode` / `http://127.0.0.1:15001`, `auth.token`, `projects.byOrigin` (origin → project directory), plus `keys.ts` and the `isAgentBackendId` guard in `interface.ts`.
- Client (`lib/agent-backend/opencode-api.ts`): `redeemPairingCode` (`GET /auth/connect/{code}`, `Accept: application/json`), `OpenCodeApi.info` (`GET /api/info`), `OpenCodeApi.listProjects` (`GET /api/project`, maps `{id, canonical, name?}` → `Project {id, name, directory}`, name falls back to the directory basename).
- `OpenCodeBackend.ping` / `listProjects` implemented; config resolves storage lazily, explicit constructor config wins. `ping` uses `GET /api/info` (lighter than `/api/project`; returns the version for the status detail). Not paired short-circuits without a network call.
- Connection seam (`lib/connection/`): `protocol.ts` (message types + guards), `service.ts` (`pairWithServer`, `pingConnection`, `listServerProjects`, `bindOrigin`), `messages.ts` (background handler that answers `connection/*`, UI helpers, `connection/changed` broadcast after a successful pair), `use-connection.ts` (Vue composable).
- UI: shared `components/ConnectionPanel.vue` (status ok/detail + pairing form whose hint shows the exact `opencode api post /api/pair --server <serverUrl>` command) mounted in popup and side panel; background registers the connection handler.

Auth header choice (documented per ticket): `Authorization: Basic base64("<username>:<token>")` with username `opencode`. v1 server docs name basic auth with username `opencode` (overridable server-side via `OPENCODE_SERVER_USERNAME`) and the v2 OpenAPI says the pairing token is "a session token to use as the password". Verified live: `curl -u opencode:<token> /api/info` → 200.

Divergences:

- The pairing-command hint includes `--server <settings.serverUrl>`. Verified on this machine: `opencode api post /api/pair` without `--server` created codes on the CLI's own background service (`http://127.0.0.1:49374`) that the 15001 server rejected as "Pairing link expired or already used". With `--server http://127.0.0.1:15001` redemption works.
- `ping` reads `settings.backendId` and goes through the registry (future backends plug in); the default selects `opencode`.
- Settings writes (`setSettings`) ship here because this phase's keys need them; the options page is 003b.
- Server-side error bodies are not surfaced; errors use our own fixed messages (clear, vocabulary-consistent).

Manual items pending (not faked):

- Loading the built extension into a real Chrome and observing the popup/panel status + pairing flow visually. The live checks done were: curl shapes, and a throwaway bun script exercising the real `opencode-api.ts` module against the live 2.0.24 server (wrong code → "That pairing code is wrong or expired"; real code → 54-char token; `info` → `2.0.24`; `listProjects` → 20 mapped projects; garbage token → "Pairing token rejected").
- Binding a live origin through the UI: the surface lands in later phases; `requestProjects`/`requestBind` are the ready seam.

Next-phase must-know notes:

- Token header: `openCodeAuthHeader(token)` in `lib/agent-backend/opencode-api.ts`; token only under `auth.token`.
- `GET /api/project` returns a bare array, not `{data}`; projects have `canonical` (directory), optional `name`, no `directory` field.
- 401 is the "wrong/expired code" and "bad token" signal; pairing redemption is unauthenticated.
- Tests: register builtins once per file (`registerBuiltinBackends()` throws on double registration); use `setOpenCodeFetch` + `fakeBrowser.reset()`.
- `connection/changed` is broadcast after a successful pair; surfaces refresh their status on it.
