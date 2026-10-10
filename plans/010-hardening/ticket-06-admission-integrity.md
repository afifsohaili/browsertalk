# 010-06: Admission integrity + delivery bounds

**What to build:** Fix verification issues 1, 2, and 6 (from `/tmp/opencode/verify-pre-009.md`): a retried admission uses the exact original admission input (no session drift), deadlines cover response-body consumption, and discarded feedback can never transmit.

**Blocked by:** 010-05 — Adapter conformance suite.

**Status:** done · c9430aa

- [x] The full admission input (session ref, delivery, text, attachments) is persisted before the first remote attempt; retries reuse it verbatim — a rollover or re-resolution cannot change the session a retry targets or corrupt the sent receipt
- [x] In-flight discard semantics defined and enforced in the serialized writer: an item discarded during resolve/admission does not transmit and does not enter the sent log
- [x] Abortable deadlines stay active through response-body parsing (opencode adapter and the conformance pi fixture); a stalled body aborts and marks ambiguous
- [x] Conformance additions: null-message-ID case; admission-only check mandatory where expressible; conflicting request-ID reuse surfaced (documented for 009's live bridge if not locally expressible)
- [x] Tests for all of the above; `bun run compile` + full suite pass; one conventional commit; plans updated

Details: `/tmp/opencode/verify-pre-009.md` regressions 1, 2, 6 and the carry-into-009 list.

## Outcome

Shipped in `c9430aa` (`fix(send): frozen admission input, discard semantics, deadlines through response bodies`). `bun run compile`, `bun run test` (49 files, 624 tests), and `bun run build` pass.

**Shipped**

- Frozen admission input (`lib/storage/outbox.ts`, `lib/send/send.ts`): `OutboxAttempt.admissionInput` carries the exact first-attempt session ref (`sessionID`, `sessionTitle`), rendered `text`, `delivery`, and `files`. `admit` resolves the session, builds the input, persists it with `setOutboxAttempt` **before** `sendFeedback`, and every later attempt reads it back verbatim — no strategy resolve, no settings read, no capability re-check, no re-render. The admission receipt and the sent summary take the session from the frozen input, so the verification's reproduction (lost response → rollover → retry) now targets `ses_fake_1` and logs it against `ses_fake_1`. A changed backend capability mid-retry sends the frozen attachment set instead of dropping it.
- Discard semantics (`lib/storage/writer.ts`, `lib/send/send.ts`): `hasQueuedOutboxItem` is a writer-queue read, serialized with `removeFromOutbox`. The admission section calls it immediately before consent + `sendFeedback`; an item discarded during a deferred resolve transmits nothing, resolves the send as "no longer in the outbox", and enters neither the outbox nor the sent log.
- Deadlines through the body (`lib/agent-backend/opencode-api.ts`, `lib/agent-backend/conformance/pi-fixture.ts`): both `requestJson` and the fixture's `request` now wrap headers, status mapping, and `response.json()` in one `try/finally` that keeps the `AbortController` deadline armed until the body settles and always clears the timer. A stalled body aborts at the deadline: admissions report `ambiguous-admission`, other operations report the timeout message instead of "unexpected response".
- Conformance (`lib/agent-backend/conformance/`): the pi fixture bridge, `OpenCodeServerSim`, and `FakeScenarioAdapter` reject a request id reused with different session/text (409 / coded `busy`) instead of silently admitting twice; `checkConflictingRequestReuse` pins the rejection and that `admissions()` stays at one, with a teeth test for a silently deduping adapter. The pi fixture can admit without a message id (`{ admitted: true }` → `messageID: null`, per the six-axis contract), and `checkNullMessageID` runs the send and a seeded null-message receipt resume. `deferTurn` is now a declared case property; where true the case must provide `deferTurnCompletion` and the check asserts the send resolved while a turn was running. All four cases (fake, fake-minimal, opencode, pi fixture) declare it.
- Tests: retry-after-rollover session + sent receipt; frozen session/text/attachments across changed capabilities; discard during a gated resolve (nothing transmits, nothing logs); writer-queue discard ordering; outbox frozen-input validator round-trip; null-message receipt commit; stalled-body abort for the opencode adapter (admission and non-admission paths) and the pi fixture; suite checks for null-message-ID and conflicting reuse across all four cases.

**Divergences / decisions**

- Discard boundary: the pre-admission check is the last serialized transition before `sendFeedback`. A discard that lands **after** that check cannot recall an in-flight request; the delivery then commits the admission and sent summary truthfully. The reproducible case (discard during resolve/admission setup) is closed; the microtask-sized post-check window is not physically closable without holding the writer queue across the remote call.
- Legacy attempts (persisted before this change) have no `admissionInput`. Their first retry resolves once more and then freezes; from then on the session cannot drift. Deliberate rerouting is not part of retry — it stays a discard-and-re-queue action; ambiguous retry is strictly verbatim.
- opencode keeps treating a prompt 2xx without a message id as `ambiguous-admission` (its API always assigns one); the case declares `admitsWithoutMessageID: false` and the check records that. The pi fixture accepts the omitted id as `messageID: null`.
- Conflicting reuse is surfaced as HTTP 409 mapped to the generic `busy` code — the error-code set has no separate conflict code; the fixture and sims reject instead of admitting twice. The check requires a coded rejection, not a specific code.
- `checkConflictingRequestReuse` and `checkNullMessageID` are mandatory for every case that declares the capability expressible; a future adapter may declare false and the check records the absence.
- The writer check returns a plain boolean; `setOutboxItemError` on a discarded item remains a benign no-op and the send outcome still reports "no longer in the outbox".

**Pending / cannot close locally**

- Live opencode dedup/conflict behaviour and live pi bridge durable receipts across bridge restarts stay unconfirmed; the fixture pins the proposed 009 contract only. Restart dedup is documented for the 009 live bridge.
- Real Chrome abort semantics for a stalled body are simulated with an injected `ReadableStream` that errors on signal abort; no live server or real network was used.
