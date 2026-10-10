# 010-03: Serialized storage + admission reliability

**What to build:** Fix review findings 6, 7, and 10: all outbox/session mutations go through one background-owned serialized writer, session resolve/rollover/admission share a lock, remote admission is idempotent and recoverable, and no stalled request can block other sends.

**Blocked by:** 010-02 — Backend-independent onboarding + six-axis contract.

**Status:** done · b9874ef

- [x] One serialized writer in the background owns outbox/session mutations; UI never writes directly; per-connection/project session lock shared by resolve, rollover, and admission
- [x] Admission: stable request ids through the seam; admitted state persisted before cleanup; outbox removal + sent append committed together; malformed 2xx rejected; ambiguous admission distinguished from definite failure
- [x] Timeouts: abortable deadlines on requests; `sendFeedback` completion means admission, not turn completion; per-connection queues (one stalled request cannot block other connections)
- [x] Tests: concurrent interleavings (append/remove/discard, resolve/rollover), lost response, duplicate retry, malformed success, deadline expiry
- [x] `bun run compile` + full suite pass; one conventional commit; plans updated

Details: `/tmp/opencode/review-pre-009.md` findings 6, 7, 10; coverage gaps 2, 3.

## Outcome

Shipped in `b9874ef` (`fix(send): serialized storage, admission receipts, request deadlines`). `bun run compile`, `bun run test` (43 files, 503 tests), and `bun run build` pass.

**Shipped**

- Serialized writer (`lib/storage/writer.ts`): one promise chain owns every outbox/session/sent mutation. `commitDeliveredItem` removes the item and prepends the sent summary in a single `storage.local.set`; a rejected write leaves both keys untouched. The raw mutators left `outbox.ts` / `sent.ts` / `sessions.ts` (reads stay there). The sidepanel discards through a new `outbox/discard` background request; `lib/panel/use-panel.ts` imports no storage mutator.
- Session lock (`lib/session-strategy/lock.ts`): `withSessionLock` keyed by `connectionKey::directory`. The send admission section holds it across resolve + `sendFeedback` + commit; the panel rollover takes the same key, so a rollover cannot start a create while a first send is resolving, and interleaved session-map writes cannot lose refs.
- Admission reliability: `FeedbackSendInput.requestID` (a UUID persisted in `OutboxItem.attempt` before the first remote call) and `SendResult { admitted: true, messageID }`; the opencode adapter sends it as the prompt `id`. An `OutboxItem.admission` receipt (request id, message id, session, time) is persisted after admission and before cleanup, so an admitted item whose response or cleanup was lost is committed on retry without a second remote call. Retries reuse the same request id, text, and `sentAt`.
- Malformed 2xx rejected: a prompt 2xx without `data.id` (including unrelated JSON without `data`) is `ambiguous-admission`. Item errors distinguish ambiguous ("The server did not confirm the feedback was admitted; retrying is safe and will not send it twice") from definite rejections (backend message preserved).
- Deadlines + queues: every opencode request runs under an `AbortController` deadline (15s default, `timeoutMs` test seam). A prompt timeout or network failure is `ambiguous-admission`; other operations keep "Cannot reach…". The global send chain is replaced by a routing chain (reads + destination capture only) plus per-connection queues keyed by `backendId@endpoint`; a stalled connection cannot block another.
- Tests: writer interleavings (5 concurrent appends; append + remove; interleaved session-map writes; rejected write; commit atomicity; attempt/admission mutation), lock serialization/parallelism/failure recovery, gated resolve-vs-rollover, stable request id across a definite-failure retry, lost-response dedup, malformed 2xx retry, deadline expiry, cleanup-write rejection resume, seeded receipt worker-restart resume, per-connection isolation, single-write commit spy, discard through the background, protocol/guard updates.

**Divergences / decisions**

- opencode dedup is real: the v2 OpenAPI documents `id? (^msg_)` on `POST /api/session/{sessionID}/prompt`, and the v2 spec / core tests (`specs/v2/session.md`, `packages/core/test/session-prompt.test.ts`) pin "exact reuse returns the same admission receipt" and 409 `PromptConflictError` on conflicting reuse. Live opencode 2.0.24 dedup behaviour stays unconfirmed (no server smoke).
- The seam carries an opaque UUID `requestID`; only the opencode adapter formats it as `msg_<uuid>`. Fake and future pi keep the opaque id.
- `SendResult.admitted` is a literal `true`; `send` re-checks it at runtime and treats a missing marker as ambiguous.
- `route` returns a delivery handle (`RoutedDelivery`) so the routing chain serializes reads and destination capture only; deliveries run per connection.
- Session creation is not deduplicated: a lost `POST /api/session` response can still create an orphan session on retry. Pre-existing; out of this ticket's admission scope.
- A retry after local midnight resolves a different day session; opencode's globally unique message id then returns 409 instead of duplicating. Safe, not re-routed.
- `migrateLegacyConnectionStorage` still writes the sessions key directly; it runs at boot before any handler registers, so it cannot race the writer.

**Pending**

- Live smoke: real MV3 worker termination between admission and commit, and real opencode dedup on retry, are unconfirmed.
- The admission-only contract for pi is documented on `AgentBackend.sendFeedback`; pi implements it in 009.
