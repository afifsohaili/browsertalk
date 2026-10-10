# 010-02: Backend-independent onboarding + six-axis contract

**What to build:** Fix review findings 1, 3, and 11: pairing/onboarding is dispatched through the selected backend (opencode pairing code vs pi token/bridge), project discovery respects capabilities with manual directory binding when absent, deterministic creation distinguishes reuse from rollover, and the seam contract carries the six axes truthfully.

**Blocked by:** 010-01 — Connection identity + transport security.

**Status:** done · e3c1053

- [x] Pairing/auth dispatched via the backend: each adapter exposes its onboarding (instructions + credential handling); the connection panel renders backend-specific copy; no opencode strings leak into generic surfaces
- [x] `capabilities.projects = false` → panel offers manual directory binding (origin → directory + name); empty discovery lists stay honest
- [x] Deterministic creation: `createSession` receives a stable creation intent (strategy identity + persisted rollover generation or explicit fresh flag) so same-day rollover and reuse differ for deterministic-id backends
- [x] Contract: registry-derived backend ids (no hardcoded union edit needed for a new adapter), optional `listSessions` + session refresh, truthful capability flags (named creation, delivery modes, images), generic error codes (unauthorized / missing-session / busy / ambiguous-admission)
- [x] Tests with fake + opencode fixtures pinning the conformance-shaped inputs
- [x] `bun run compile` + full suite pass; one conventional commit; plans updated

Details: `/tmp/opencode/review-pre-009.md` findings 1, 3, 11.

## Outcome

Shipped in `e3c1053` (`fix(backend): backend-driven onboarding and truthful six-axis contract`). `bun run compile`, `bun run test` (41 files, 477 tests), and `bun run build` pass.

**Shipped**

- Onboarding seam: `AgentBackend.onboarding` (`BackendOnboarding | null`) carries `instructions`, `command(endpoint)`, `credentialLabel`, `emptyCredentialError`, and `authenticate`. `pairWithServer` resolves the configured connection, dispatches the credential exchange, and stores the returned token under the connection key; opencode's pairing copy and redeem live in `opencode.ts`. The new `connection/onboarding` message renders the copy in `ConnectionPanel.vue`; generic connection surfaces hold no `opencode api post /api/pair` string.
- Project capabilities: `capabilities.projects = false` → `listServerProjects` returns `{ ok: true, supported: false, projects: [] }` without calling the adapter; `usePanel.projectsSupported` drives a manual binding form (directory input + live derived name) in the sidepanel; supported-but-empty lists keep the honest "No projects on the server."
- Creation intent: `SessionCreateInput.intent = { strategyId, strategyKey, generation }`; the generation persists in `StoredSession` (legacy records read as 0). First creation is generation 0, rollover is stored + 1, and failed creations/rollovers retry with the same intent.
- Session refresh: optional `getSession` / `listSessions` on the seam. `persist.resolveStoredSession` refreshes an adapter that implements `getSession` (a rename updates the stored title; a deleted ref recreates with generation + 1); adapters without it keep the cached ref.
- Truthful flags + error codes: `BackendCapabilities = { projects, namedCreation, delivery, images }`; `send` only attaches a screenshot when `capabilities.images`. `BackendError` codes (`unauthorized`, `missing-session`, `busy`, `ambiguous-admission`) are mapped in `opencode-api` (401 / 404 / 409 / unreadable prompt 2xx); `backendErrorCode` reads them. `AgentBackendId` is an open string; `hasAgentBackend` and the registry list drive settings and options; `isAgentBackendId` is a shape check.
- Tests: new `registry.test.ts`; new `persist.test.ts` (intent identity, retry reuse, generation bump, refresh rename, deleted recreate); service tests for onboarding dispatch + unsupported discovery; usePanel manual-binding test; opencode-api error-code tests; messages/use-connection onboarding tests; stored-session generation tests.

**Divergences / decisions**

- The manual binding form collects the project directory; the name is derived (`projectName`) and shown live under the input instead of a second stored field. Storage binds origin → directory and every consumer derives the name, so a stored name would be dead data; a binding-shape change would also touch 010-01's namespacing and migration.
- `setSessionStrategyOverride` validates the backend id against the registry (`hasAgentBackend`); settings reads stay registry-free so storage reads do not depend on which surface registered adapters. Unknown shaped ids are preserved (no silent rewrite) and fail fast at `getAgentBackend` with the known list.
- `readSessionStrategyOverrides` keeps well-formed entries for unregistered backends inert (a not-yet-shipped adapter's override survives); junk strategy values still drop.
- opencode does not implement `getSession` yet, so opencode-side renames and deleted refs still need an adapter opt-in (009 pi is the expected first implementer). `listSessions` is contract-only until manual session pick ships.
- `delivery` and `namedCreation` are flags only; no call site selects deliveries or skips titles yet. Images is the one flag with consumer behavior (attachment skipped, feedback still sent).
- `BackendError` replaces `OpenCodeError` for 401/404/409 and malformed prompt 2xx; other opencode failures keep `OpenCodeError`.

**Pending**

- Real-browser check of the new panel copy and manual binding not run (no committed harness; component-level tests are at the composable seam).
- 010-03 owns the `ambiguous-admission` recovery path (stable admission ids, admitted state, deadlines); this subphase only maps the code.
