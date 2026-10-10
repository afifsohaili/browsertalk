# 010-03: Serialized storage + admission reliability

**What to build:** Fix review findings 6, 7, and 10: all outbox/session mutations go through one background-owned serialized writer, session resolve/rollover/admission share a lock, remote admission is idempotent and recoverable, and no stalled request can block other sends.

**Blocked by:** 010-02 — Backend-independent onboarding + six-axis contract.

**Status:** ready-for-agent

- [ ] One serialized writer in the background owns outbox/session mutations; UI never writes directly; per-connection/project session lock shared by resolve, rollover, and admission
- [ ] Admission: stable request ids through the seam; admitted state persisted before cleanup; outbox removal + sent append committed together; malformed 2xx rejected; ambiguous admission distinguished from definite failure
- [ ] Timeouts: abortable deadlines on requests; `sendFeedback` completion means admission, not turn completion; per-connection queues (one stalled request cannot block other connections)
- [ ] Tests: concurrent interleavings (append/remove/discard, resolve/rollover), lost response, duplicate retry, malformed success, deadline expiry
- [ ] `bun run compile` + full suite pass; one conventional commit; plans updated

Details: `/tmp/opencode/review-pre-009.md` findings 6, 7, 10; coverage gaps 2, 3.
