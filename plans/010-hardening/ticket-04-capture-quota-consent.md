# 010-04: Capture scoping, quota budgets, consent, staleness

**What to build:** Fix review findings 5, 8, 9, and 12: pending picks and captures are tab-scoped, storage quotas are budgeted with a recovery path, consent is enforced at delivery time, and stale async results can never resurrect old targets.

**Blocked by:** 010-03 — Serialized storage + admission reliability.

**Status:** ready-for-agent

- [ ] Pending picks keyed by (tab, capture id); submissions rejected after a failed capture; active tab verified against the sender before capture; only the consumed capture is cleared
- [ ] Byte budgets for screenshots and the outbox; quota errors offer screenshot-free queueing; incoming data URLs validated (type, length); errors while recording errors are surfaced, not swallowed
- [ ] Consent re-checked immediately before remote admission and before persisting delayed captures; blocked items stay queued with a clear error
- [ ] Generation checks discard stale async results (connection status, target, project list); binding uses the origin captured when project selection opened
- [ ] Runtime protocol validation (required fields, project member shapes) with tests
- [ ] `bun run compile` + full suite pass; one conventional commit; plans updated

Details: `/tmp/opencode/review-pre-009.md` findings 5, 8, 9, 12; coverage gap 5.
