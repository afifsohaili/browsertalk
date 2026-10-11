# 010-10: Migration ownership + frozen-input accounting + pending fallback

**What to build:** Fix verify2 issues 2, 4, and 6 (`/tmp/opencode/verify2-pre-009.md`): migration claims are safe under failure, frozen admission input never renders accepted feedback unsendable, and pending quota recovery cannot overwrite a newer capture.

**Blocked by:** 010-09 — Atomic admission reservation + legacy attempt gating.

**Status:** ready-for-agent

- [ ] Migration persists its owning connection before claiming/removing legacy data; after a rejected removal, the legacy key can never be claimed by another endpoint (reproduce verify2 probe 4)
- [ ] Accepted feedback always fits its frozen admission input: budget the delivery-ready representation at queue time (or persist frozen input without duplicating large data), with receipt/error metadata headroom reserved (reproduce probes 1–2)
- [ ] Pending screenshot quota recovery is one per-tab mutation and can never overwrite a newer capture (reproduce probe 6)
- [ ] The verify2 reproduction probes are converted into repo tests with corrected expectations
- [ ] `bun run compile` + full suite pass; one conventional commit; plans updated

Details: `/tmp/opencode/verify2-pre-009.md` remaining errors 2, 4, 6; probes at `/tmp/opencode/verify2-pre-009.probes.test.ts`.
