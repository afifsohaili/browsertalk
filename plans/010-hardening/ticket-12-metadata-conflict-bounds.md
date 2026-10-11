# 010-12: Metadata bounds + conflict-gate completeness (final local round)

**What to build:** Fix the three verify3 moderates (`/tmp/opencode/verify3-pre-009.md`): metadata updates enforce the outbox bound, the complete retained sent summary is bounded, and the conflict gate covers every immutable attachment field. This is the **final local fix round**; the next gate is live phase-009 acceptance.

**Blocked by:** 010-11 — Sent bound + target invalidation + conflict gate.

**Status:** ready-for-agent

- [ ] Metadata persisted to the outbox is bounded (error messages / receipts capped at persistence) while immutable admission input and recoverable receipts survive; `jsonByteSize(outbox) ≤ MAX_OUTBOX_BYTES` holds under verify3 probe A (20,000-char error), converted to a corrected repo test
- [ ] The complete retained sent summary is bounded, including page/session metadata (a 1,100,000-char page title cannot push history over `MAX_SENT_BYTES`), and receipt identity is preserved; probe B converted
- [ ] Conflict gate: after admitting an attachment-bearing request, each immutable attachment field mutated independently (URI replacement, name-only, description-only) is conflict-detected by any conforming adapter; probe C converted
- [ ] The three verify3 probes are converted into repo tests with corrected expectations
- [ ] `bun run compile` + full suite pass; one conventional commit; plans updated

Details: `/tmp/opencode/verify3-pre-009.md` findings A, B, C; probes at `/tmp/opencode/verify3-pre-009.probes.test.ts`.
