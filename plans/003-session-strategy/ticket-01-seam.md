# 003a: Session strategy seam

**What to build:** The rule that maps feedback to sessions becomes a seam, so backends with different habits get a fitting rule. Two strategies ship: per-day (one session per project per local day, titled `Browsertalk · <project> · <date>`) and sticky (one long-lived session per project until a rollover). Each backend declares its default; opencode's is per-day. A rollover operation starts a fresh session and continues on it (the panel button arrives in 007).

**Blocked by:** 002 — Connection.

**Status:** ready-for-agent

- [ ] Strategy contract mirrors the agent-backend seam: register / get / list; unknown ids fail fast with the known list
- [ ] Per-day: first feedback of the day creates the session; later feedback reuses it; rolls over at local midnight
- [ ] Sticky: one long-lived session per project; every feedback appends; rollover starts a fresh one
- [ ] Selection resolves settings override first, backend default second; opencode defaults to per-day
- [ ] Session refs stored per strategy in extension storage; survive restarts
- [ ] Unit tests: registry fail-fast, per-day rollover, sticky reuse + rollover — fake-backed
- [ ] `bun run compile` passes; one conventional commit; phase doc updated
