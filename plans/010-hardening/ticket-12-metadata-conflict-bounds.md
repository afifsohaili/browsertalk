# 010-12: Metadata bounds + conflict-gate completeness (final local round)

**What to build:** Fix the three verify3 moderates (`/tmp/opencode/verify3-pre-009.md`): metadata updates enforce the outbox bound, the complete retained sent summary is bounded, and the conflict gate covers every immutable attachment field. This is the **final local fix round**; the next gate is live phase-009 acceptance.

**Blocked by:** 010-11 — Sent bound + target invalidation + conflict gate.

**Status:** done · 0175cb1

- [x] Metadata persisted to the outbox is bounded (error messages / receipts capped at persistence) while immutable admission input and recoverable receipts survive; `jsonByteSize(outbox) ≤ MAX_OUTBOX_BYTES` holds under verify3 probe A (20,000-char error), converted to a corrected repo test
- [x] The complete retained sent summary is bounded, including page/session metadata (a 1,100,000-char page title cannot push history over `MAX_SENT_BYTES`), and receipt identity is preserved; probe B converted
- [x] Conflict gate: after admitting an attachment-bearing request, each immutable attachment field mutated independently (URI replacement, name-only, description-only) is conflict-detected by any conforming adapter; probe C converted
- [x] The three verify3 probes are converted into repo tests with corrected expectations
- [x] `bun run compile` + full suite pass; one conventional commit; plans updated

Details: `/tmp/opencode/verify3-pre-009.md` findings A, B, C; probes at `/tmp/opencode/verify3-pre-009.probes.test.ts`.

## Outcome

Shipped in `0175cb1` (`fix(storage): metadata bounds and complete attachment conflict gate`). `bun run compile`, `bun run test` (49 files, 682 tests), and `bun run build` pass. Re-running `/tmp/opencode/verify3-pre-009.probes.test.ts` now fails all three reproductions (corrected behavior).

**Shipped**

- Outbox metadata bound (`lib/storage/writer.ts`): every `updateOutboxItem` write now runs through `boundOutboxMetadata`, which trims the error string and the receipt title (`admission.sessionTitle`) to the exact remaining byte budget with `truncateJsonString` and a `…` marker, never touching the frozen admission input or the receipt identity (requestID, messageID, sessionID, admittedAt). Probe A converted: a near-limit accepted item plus a 20,000-char backend error stores a 4,315-char error and exactly 5,000,000 bytes; the frozen input survives intact.
- Sent summary bound (`lib/storage/writer.ts`): `boundSentSummary` caps `page.title` and `session.title` at 512 bytes per field (marker on truncation) before bounding the comment, so non-comment metadata can no longer push the retained history over `MAX_SENT_BYTES`. Receipt identity (id, sentAt, session id, page url) is never trimmed; the comment keeps the remaining room. Probe B converted: a 1,100,000-char page title sends, the history measures ≤ 1,000,000 bytes, and the short comment survives.
- Conflict gate (`lib/agent-backend/conformance/checks.ts`, `pi-fixture.ts`): `checkConflictingRequestReuse` now admits an attachment-bearing request (a screenshot item where `capabilities.images`), copies the admitted attachment into the base input, and independently mutates its URI, name, and description alongside the existing text/session/delivery axes. The pi fixture prompt payload forwards `description`, so the bridge fingerprint covers every immutable attachment field. Probe C converted to a teeth test: a URI-only fingerprint adapter now fails the gate; the text-only teeth test still fails.
- Tests: +6 (682 vs 676): outbox error bound (writer plus send end to end), receipt-title bound, sent page + session title bound (writer plus send end to end), URI-only conflict teeth test.

**Divergences / decisions**

- Metadata fit is lifecycle-aware: an unfrozen item is measured against `deliveryReadySize` (a recorded error can never consume the reserved freeze duplication), a frozen item on raw `jsonByteSize` (the 010-10 4 KB headroom estimate was documented as an estimate; raw bytes are the bounded quantity, so a real receipt can never push the stored outbox over `MAX_OUTBOX_BYTES`).
- Receipt bounding truncates only the display title; identity fields are never trimmed, so `commitAdmitted` and receipt resume keep working.
- The sent title cap is a fixed 512 bytes per field, not an exact fit: titles stay readable and bounded while the comment keeps the rest. Identity fields (URL, ids) are still trusted to their producers; a pathological >1 MB URL can still exceed the per-summary budget and is documented, not trimmed.
- The URI-only teeth test counts unique admissions (`backend.sent.length`) rather than transport calls; with `feedbackCalls` the exact replay would count as a second admission and the gate would reject for the wrong reason.

**Pending / cannot close locally**

- Real Chrome quota shapes, actual MV3 worker-termination durability, and the live opencode/pi servers' real conflict behavior were exercised only through `fakeBrowser` and injected fetch/sim fixtures; no live server or real browser was used.
- The verify3 probes are external artifacts under `/tmp/opencode/`; they now fail as expected but are not part of the repo.
