# 010-05: Adapter conformance suite

**What to build:** Coverage gap 1 (blocker): a reusable conformance suite any adapter must pass, proven against the fake backend, the opencode adapter, and a pi-shaped fixture (deterministic ids, no session listing, bridge-style admission). This is the acceptance gate for starting 009.

**Blocked by:** 010-04 — Capture scoping, quota budgets, consent, staleness.

**Status:** ready-for-agent

- [ ] Reusable conformance suite: opaque session handles, absent project discovery, backend auth, queue→followUp mapping, image attachments, fresh rollover vs reuse, naming, admission-only completion
- [ ] Suite runs against fake + opencode fixtures + a pi-shaped fixture; a new adapter's pass/fail is machine-checkable
- [ ] Security/quota/routing/concurrency test additions from 010-01..04 are wired into the suite where cross-backend
- [ ] Remaining coverage gaps from the review are closed or explicitly documented as unconfirmed
- [ ] `bun run compile` + full suite pass; one conventional commit; plans updated (including the 009 row unblock note)

Details: `/tmp/opencode/review-pre-009.md` coverage gaps 1–5.
