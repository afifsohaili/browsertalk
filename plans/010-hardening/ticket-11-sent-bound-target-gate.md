# 010-11: Sent bound + target invalidation + conflict gate

**What to build:** Fix verify2 issues 5 and 7 plus the conformance conflict-gate note (`/tmp/opencode/verify2-pre-009.md`): the sent byte bound is truthful, target actions cannot run on a stale connection, and the conformance conflict gate compares the complete immutable request input.

**Blocked by:** 010-10 — Migration ownership + frozen-input accounting + pending fallback.

**Status:** ready-for-agent

- [ ] Sent history respects a truthful byte bound (each summary bounded, or the newest-summary allowance explicitly budgeted and documented so the advertised storage headroom holds under the verify2 probe)
- [ ] Target identity invalidates synchronously on connection change; `newSession` / `openProjects` / rollover actions are gated until the refreshed target arrives (reproduce verify2 probe 5)
- [ ] The conformance conflict gate compares the complete immutable request input (session, delivery, attachments — not just text)
- [ ] The verify2 reproduction probes are converted into repo tests with corrected expectations
- [ ] `bun run compile` + full suite pass; one conventional commit; plans updated

Details: `/tmp/opencode/verify2-pre-009.md` remaining errors 5, 7 and the conflict-gate note; probes at `/tmp/opencode/verify2-pre-009.probes.test.ts`.
