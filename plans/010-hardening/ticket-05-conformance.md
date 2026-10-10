# 010-05: Adapter conformance suite

**What to build:** Coverage gap 1 (blocker): a reusable conformance suite any adapter must pass, proven against the fake backend, the opencode adapter, and a pi-shaped fixture (deterministic ids, no session listing, bridge-style admission). This is the acceptance gate for starting 009.

**Blocked by:** 010-04 — Capture scoping, quota budgets, consent, staleness.

**Status:** done · 5bdea01

- [x] Reusable conformance suite: opaque session handles, absent project discovery, backend auth, queue→followUp mapping, image attachments, fresh rollover vs reuse, naming, admission-only completion
- [x] Suite runs against fake + opencode fixtures + a pi-shaped fixture; a new adapter's pass/fail is machine-checkable
- [x] Security/quota/routing/concurrency test additions from 010-01..04 are wired into the suite where cross-backend
- [x] Remaining coverage gaps from the review are closed or explicitly documented as unconfirmed
- [x] `bun run compile` + full suite pass; one conventional commit; plans updated (including the 009 row unblock note)

Details: `/tmp/opencode/review-pre-009.md` coverage gaps 1–5.

## Outcome

Shipped in `5bdea01` (`test(backend): reusable adapter conformance suite with pi-shaped fixture`). `bun run compile`, `bun run test` (48 files, 604 tests), and `bun run build` pass.

**Shipped**

- `lib/agent-backend/conformance/`: `types.ts` (case + raw transport shapes), `harness.ts` (seam recorder + `ConformanceHarness`), `checks.ts` (13 exported checks), `suite.ts` (`describeAdapterConformance` registers the checks and one `registerAgentBackend` line per case), `cases.ts` (fake, fake-minimal, opencode-over-injected-fetch), `pi-fixture.ts` (pi-shaped adapter + in-memory loopback bridge), `wire.ts`, `index.ts`.
- Checks per adapter: truthful six-axis capabilities and onboarding shape; opaque handles that round-trip `createSession` → `sendFeedback` untouched (pi-style deterministic ids accepted as-is); project discovery only when `capabilities.projects`, manual directory binding delivering when false; onboarding auth (valid credential → token, wrong → `unauthorized`) and transport 401 → `unauthorized`; queue delivery mapped into the transport vocabulary (`queue` → `followUp` on pi) with rejection staying a rejection and the retry reusing request id and mode; images mapped or dropped per `capabilities.images`; stored reuse (one create) vs rollover (intent generation + 1, new handle); naming where `namedCreation`; resolution on admission with exactly one transport send (pi fixture: resolves while the bridge reports a running turn); loopback-only transport (`remote rejected before any fetch`), `redirect: 'error'`, captured endpoint + credential immutable across a settings change; admitted-but-lost feedback resumed with the same request id and one durable admission; persisted receipts committing without transport calls; delivery-time consent blocking before any adapter call.
- Registration and settings selection of `pi-fixture` run through the real `send`/session-strategy pipeline, so "a fourth adapter plugs in" is exercised by settings + one registration line, not by edited call sites.
- Teeth tests: `checkOpaqueSessionHandles` rejects an adapter that returns UUID handles but only accepts `ses_` ones; `checkContract` rejects an adapter whose declared capabilities lie.

**Divergences / decisions**

- A fourth case (`fake-minimal`: `projects:false`, `namedCreation:false`, `delivery:['queue']`, `images:false`) runs the suite's negative capability branches (manual binding, unnamed creation, attachment drop). The ticket's three adapters still run unchanged.
- Coverage gap 2 (admission/recovery) additions are in the suite where cross-backend: admitted-but-lost, duplicate retry, stable request id, receipt resume. Malformed 2xx, deadline expiry, and cleanup-write rejection stay adapter-level tests in `send.test.ts`/`opencode-api.test.ts` because they pin the opencode transport's own semantics.
- Coverage gap 3 (concurrency) and the quota half of gap 4 are adapter-independent (writer, session lock, budgets, composer). They are pinned in `writer.test.ts`, `lock.test.ts`, `send.test.ts`, `budgets.test.ts`, `composer/messages.test.ts`; wiring them per adapter would test storage, not the adapter. Security/routing isolation is per adapter and is in the suite.
- Coverage gap 5 (real Chrome) stays unconfirmed: MV3 worker lifetime, real redirect behavior, and live pi/opencode servers are untouched by this suite (no live server, no live LLM spend).
- `checkAdmissionOnly` runs the turn-running assertion only where the fixture can defer a turn (pi bridge). For HTTP adapters it asserts the structural contract: one admission call, resolution without follow-up polling.
- The pi fixture's bridge contract is a proposal for 009, not a decision: `GET /api/health`, `POST /api/pair`, `POST /api/sessions` (`{directory, title, intent}` → deterministic id), `POST /api/sessions/{id}/prompt` (`{requestID, text, streamingBehavior, images?}` → `{admitted, messageID}`), Bearer token, id derivation from intent generation.

**What a new adapter (009 pi bridge) must implement to pass**

1. `AgentBackend` with `id`, `label`, `defaultSessionStrategy`, and truthful `capabilities` (`projects`, `namedCreation`, `delivery`, `images`).
2. `onboarding` or `null`; when present, `authenticate` returns `{ token }` and maps a bad credential to `BackendError('unauthorized')`.
3. `createSession` consumes `intent` ({ strategyId, strategyKey, generation }); deterministic-id backends must return the same handle for the same intent and a new handle when `generation` bumps.
4. `sendFeedback` resolves on durable admission (`{ admitted: true, messageID }`), never on turn completion; forwards `requestID` for dedup; maps 401/404/409 and unconfirmed admissions to the generic `BackendError` codes.
5. Opaque `SessionRef.id` — no `ses_` assumption anywhere.
6. Loopback-only transport using `BackendConnectionConfig` per attempt, `redirect: 'error'`, and a credential header.
7. A `ConformanceCase` (declared capabilities, `create`, `transport()` raw calls, `admissions()`, `reset`, token/pairing, `deliveryMapping`, scenarios) plus `describeAdapterConformance(case)` next to the adapter's tests.
