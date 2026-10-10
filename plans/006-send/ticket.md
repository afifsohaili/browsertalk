# 006: Send

**What to build:** A queued feedback actually lands in the right opencode session: the session is created or reused through the strategy seam, the prompt renders per the template, delivery is `queue` so a running turn is never interrupted, and the item moves from outbox to sent log.

**Blocked by:** 005 — Composer.

**Status:** ready-for-agent

- [ ] With per-day selected: first feedback of the day creates `Browsertalk · <project> · <date>`; later feedback reuses it (verified once against a live server, manually)
- [ ] Prompt renders per `product.md` §Prompt template, extras included when present
- [ ] Delivery is `queue`; a send while the agent is mid-turn parks instead of interrupting
- [ ] Success moves the item to the sent log (capped); failure keeps it in the outbox with a clear error
- [ ] Send path unit-tested against the fake backend
- [ ] `bun run compile` passes; one conventional commit; phase doc updated
