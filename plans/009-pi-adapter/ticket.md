# 009: Pi adapter

**What to build:** pi is selectable as a backend. A small local bridge wraps `pi --mode rpc` (a Chrome extension cannot spawn processes) and exposes the same backend contract; pi's natural default strategy applies (per-day works through deterministic session ids).

**Blocked by:** 003b — Settings page.

**Status:** ready-for-agent

- [ ] Bridge runs locally, speaks pi's JSONL RPC, and serves the backend contract (capabilities as pi supports them)
- [ ] Bridge shape decided and documented (daemon vs one-shot per send; what queue/steer behavior it offers)
- [ ] pi registers as one adapter file + one registration line; selectable in settings
- [ ] One end-to-end send against a live pi verified manually; unit tests fake-backed
- [ ] `bun run compile` passes; one conventional commit; phase doc updated
