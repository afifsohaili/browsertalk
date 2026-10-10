# 007: Panel

**What to build:** The side panel becomes the control room: current target (project + session title), the outbox, the sent list, and "+ new session" which rolls the session over and continues on the fresh one.

**Blocked by:** 006 — Send.

**Status:** ready-for-agent

- [ ] Header shows the bound project and current session title; updates when either changes
- [ ] Outbox list with retry / discard per item; sent list capped, showing time + target
- [ ] "+ new session" rolls over via the active strategy; header shows the new session
- [ ] Honest empty + offline states; no fake data
- [ ] Verified in a real browser session (not just tests)
- [ ] `bun run compile` passes; one conventional commit; phase doc updated
