# 010-08: Migration leftovers + connection-bound selection

**What to build:** Fix verification issues 3 and 7 (from `/tmp/opencode/verify-pre-009.md`): legacy-key migration claims once without overwriting scoped data, and project selection/rollover capture the connection identity they act on.

**Blocked by:** 010-07 — Byte-accurate budgets + pending/binding serialization.

**Status:** ready-for-agent

- [ ] Migration consumes legacy credentials/refs exactly once and never assigns them to a later connection (test: scoped token + legacy token present, then endpoint change → legacy never claimed by the new endpoint)
- [ ] Project picker and rollover capture connection identity (backend + endpoint) when opened; results from a previous connection are discarded; binding/rollover act on the captured connection
- [ ] Tests for both; `bun run compile` + full suite pass; one conventional commit; plans updated

Details: `/tmp/opencode/verify-pre-009.md` regressions 3, 7.
