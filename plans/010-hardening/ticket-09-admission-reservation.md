# 010-09: Atomic admission reservation + legacy attempt gating

**What to build:** Fix verify2 issues 1 and 3 (`/tmp/opencode/verify2-pre-009.md`): a successful discard and a transmission can never both happen, and ambiguous legacy attempts can never re-resolve and transmit.

**Blocked by:** 010-08 — Migration leftovers + connection-bound selection.

**Status:** ready-for-agent

- [ ] Admission reservation is atomic in the serialized writer: before reservation, a successful discard means no transmission and no sent summary; after reservation, a later discard cannot succeed silently (refuse it, or an equivalent contract that closes the race) — both interleavings pinned by tests, reproducing verify2 probe 3
- [ ] Ambiguous legacy attempts (no frozen admission input) are blocked pending explicit recovery with a clear error state; their missing input is never invented; no retry can re-resolve a session (reproduces verify2 probe 7)
- [ ] A retried request never lands in a different session than its sent receipt records
- [ ] The verify2 reproduction probes are converted into repo tests with corrected expectations
- [ ] `bun run compile` + full suite pass; one conventional commit; plans updated

Details: `/tmp/opencode/verify2-pre-009.md` remaining errors 1 and 3; probes at `/tmp/opencode/verify2-pre-009.probes.test.ts`.
