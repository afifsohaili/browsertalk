# 010-07: Byte-accurate budgets + pending/binding serialization

**What to build:** Fix verification issues 4, 5, and 8 (from `/tmp/opencode/verify-pre-009.md`): budgets are byte-accurate and bound retained data, pending-capture mutations are race-free per tab, and binding writes go through the serialized writer.

**Blocked by:** 010-06 — Admission integrity + delivery bounds.

**Status:** ready-for-agent

- [ ] Budgets measure UTF-8 bytes (not string length); sent history is byte-bounded; metadata updates pass budget checks; pending capture writes have screenshot-free quota recovery
- [ ] Pending-capture mutations serialized per tab (or captures stored separately) — a cleanup can never delete a newer concurrent capture
- [ ] Binding mutations route through the background serialized writer; concurrent bindings for two origins both survive
- [ ] Tests: CJK byte case exceeding the old char-based limit, concurrent replacement cleanup, concurrent bindings
- [ ] `bun run compile` + full suite pass; one conventional commit; plans updated

Details: `/tmp/opencode/verify-pre-009.md` regressions 4, 5, 8.
