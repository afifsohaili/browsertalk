# 010-01: Connection identity + transport security

**What to build:** Fix review findings 2 and 4: the extension only ever talks to loopback, and credentials, bindings, and session refs are scoped to a connection (backend + canonical endpoint) so retries and config changes can never leak data to another server or reuse another server's session handle.

**Blocked by:** 008 — Ship.

**Status:** done · 281b18c

- [x] Loopback-only enforced at save time and at the transport boundary; non-loopback URLs rejected with a clear error; credentials embedded in URLs rejected; redirects cannot carry credentials/feedback off loopback (validate or forbid)
- [x] Connection identity = (backendId, canonical endpoint); `auth.token`, `projects.byOrigin`, and session refs namespaced by it
- [x] A queued feedback captures its destination connection at queue time; retries route to the same destination; a later settings change cannot silently re-route existing items
- [x] Per-attempt immutable config: session creation and sending for one attempt use the same captured config
- [x] Tests: remote URL rejection, redirect rejection, token/ref isolation across endpoints, retained retry destination
- [x] `bun run compile` + full suite pass; live smoke if the harness is available; one conventional commit; plans updated

Details: `/tmp/opencode/review-pre-009.md` findings 2 and 4.

## Outcome

Shipped in `281b18c` (`fix(security): loopback-only transport and connection-scoped identity`). `bun run compile`, `bun run test` (39 files, 441 tests), and `bun run build` pass.

**Shipped**

- `lib/connection/endpoint.ts`: `parseLoopbackUrl` accepts `http(s)` + `localhost` / `127.0.0.0/8` / `::1` (literal host, no DNS), rejects embedded credentials, canonicalizes the endpoint (trailing slash, query, hash dropped). Used by `setSettings` (save time), the settings page, and `requestJson` (transport, stored config included).
- Transport forbids redirects: every fetch sets `redirect: 'error'` and a `response.redirected` response is rejected before the body is read.
- `lib/connection/identity.ts`: `connectionKey` = `"<backendId>@<canonical endpoint>"`. Token (`auth.tokens`), bindings (`projects.byOrigin`), and session refs (`sessions`) are nested by that key.
- Queue-time capture: `captureQueuedDestination` writes `destination: { backendId, endpoint, directory }` onto the item when the origin is bound; `send` uses it verbatim. Destinationless items (legacy/unbound) resolve once at first attempt and persist the destination before the first remote call. Settings or binding changes never re-route an item with a destination.
- Per-attempt config: `AgentBackendFactory` takes an optional `BackendConnectionConfig`; `send` captures `{ baseUrl, token }` once and passes it to the backend, so `createSession` and `sendFeedback` of one attempt cannot split across servers.
- Legacy storage handled by an eager boot migration (`lib/connection/migrate.ts`, called from the background): claims `auth.token`, a flat `projects.byOrigin`, and backend-keyed `sessions` for the connection configured at upgrade time, then removes the claimed legacy keys.

**Divergences / decisions**

- Migration is an eager claim for the currently configured connection only (not a read-fallback): pre-fix data carried no endpoint, so the configured server is the only honest owner. It refuses when the stored URL is non-loopback and leaves legacy data untouched. Already-scoped data is never overwritten. Other backends' legacy refs are left in place (readers never look at bare backend keys).
- `getSettings` still returns a stored remote URL as-is (visible in Settings); the transport and save paths reject it. No silent rewrite.
- Redirects are forbidden entirely (`redirect: 'error'`), not followed-then-validated: browser fetch cannot inspect a followed redirect, so forbidding is the only enforceable option.
- Loopback includes `localhost`; browsers resolve it locally. Documented here rather than in `CONTEXT.md` (not rewritten per scope).
- `resolveDestination`'s persist-then-proceed is a read-modify-write like the other outbox mutations; 010-03 serializes storage.

**Pending**

- Live smoke not run: no committed smoke harness (007–008 used throwaway `/tmp/opencode/*-smoke` scripts). Real-browser redirect refusal under MV3 remains unconfirmed, per the review.
- 010-02 continues backend-independent onboarding; `BackendConnectionConfig` is the seam it can extend.
