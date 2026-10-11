# 010-11: Sent bound + target invalidation + conflict gate

**What to build:** Fix verify2 issues 5 and 7 plus the conformance conflict-gate note (`/tmp/opencode/verify2-pre-009.md`): the sent byte bound is truthful, target actions cannot run on a stale connection, and the conformance conflict gate compares the complete immutable request input.

**Blocked by:** 010-10 — Migration ownership + frozen-input accounting + pending fallback.

**Status:** done · b08d057

- [x] Sent history respects a truthful byte bound (each summary bounded, or the newest-summary allowance explicitly budgeted and documented so the advertised storage headroom holds under the verify2 probe)
- [x] Target identity invalidates synchronously on connection change; `newSession` / `openProjects` / rollover actions are gated until the refreshed target arrives (reproduce verify2 probe 5)
- [x] The conformance conflict gate compares the complete immutable request input (session, delivery, attachments — not just text)
- [x] The verify2 reproduction probes are converted into repo tests with corrected expectations
- [x] `bun run compile` + full suite pass; one conventional commit; plans updated

Details: `/tmp/opencode/verify2-pre-009.md` remaining errors 5, 7 and the conflict-gate note; probes at `/tmp/opencode/verify2-pre-009.probes.test.ts`.

## Outcome

Shipped in `b08d057` (`fix(panel): truthful sent bound, synchronous target invalidation, full conflict gate`). `bun run compile`, `bun run test` (49 files, 676 tests), and `bun run build` pass.

**Shipped**

- Sent bound (`lib/storage/budgets.ts`, `lib/storage/writer.ts`): `retainSent` maps every summary through `boundSentSummary`, which measures the summary's JSON inside the sent array minus its comment and trims an oversized comment to the exact remaining byte budget, appending a `…` marker. New `truncateJsonString` counts UTF-8 bytes and JSON escape bytes and never splits a code point (CJK, escape, and zero-budget tests). Probe 2 converted: a lone 1,100,000-char comment still sends, and the stored sent history measures exactly ≤ `MAX_SENT_BYTES` (1,000,000) instead of 1,100,193 bytes.
- Target invalidation (`lib/panel/use-panel.ts`): a `backendId`/`serverUrl` change now clears `target` and `targetConnection` synchronously, closes the project picker, and bumps the target generation so a stale in-flight read cannot restore them. `newSession` and `openProjects` wait on the in-flight target refresh (`waitForRefreshedTarget`) before capturing the connection, so no action runs on the connection that just went away. Probe 5 converted: while the refreshed target read is gated, `newSession` creates nothing and does not resolve; after the refresh it acts on the new connection (unbound B → `This site has no project binding`), never rolling over A. A second test pins `openProjects`.
- Conflict gate (`lib/agent-backend/conformance/checks.ts`, `cases.ts`, `pi-fixture.ts`, `suite.ts`): `checkConflictingRequestReuse` reuses the admitted request id against a text, session, delivery, and attachment variant (delivery/attachment axes gated per declared capability), requires a backend error with exactly one admission and one sent summary for each, and still dedups an exact replay. The fake scenario adapter fingerprints session + text + delivery + files (uri/name/description); the opencode server sim and the pi bridge fingerprint session + text + delivery + raw files/images. A teeth test fails an adapter that compares only text when a request id is reused.
- Tests: +10 (676 vs 666): 5 `truncateJsonString` unit cases, writer lone-summary bound, send end-to-end bound, 2 panel gating tests, 1 conformance teeth test.

**Divergences / decisions**

- The newest summary is now truncated instead of allowed to exceed `MAX_SENT_BYTES`: the record stays (id, session, page, timestamp), its comment becomes a bounded excerpt ending in `…`. This makes the advertised sent ≤ 1 MB claim true for every case while keeping 010-07's "an admitted feedback's sent record is never dropped" decision. Metadata fields (session/page titles) are still bounded by their producers, not by this trim.
- `newSession`/`openProjects` wait for the refreshed target rather than refusing with an error, matching "gated until the refreshed target arrives". A refresh that fails leaves the target cleared, and the action then reports `No page to target`.
- The rollover started before a connection change still completes on its captured connection and stores under it (010-08 behavior); the panel discards the result for the current target.
- The teeth test wires the registry through the harness (`registerAgentBackend(id, (config) => harness.backend(config))`); registering the bare backend leaves the seam empty and the check would fail for the wrong reason.

**Pending / cannot close locally**

- Live Chrome/MV3 stays unconfirmed: real storage quota shapes, worker termination between a connection change and the refreshed action, and the real opencode server's conflict behavior on the session/delivery/attachment axes were exercised only through `fakeBrowser` and injected fetch/sim fixtures.
- The original probe 5 now times out (5 s) against corrected code because the action waits on the gated refresh; the converted repo test releases the gate before awaiting, which is the corrected expectation.
