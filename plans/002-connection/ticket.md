# 002: Connection

**What to build:** The extension can reach the opencode server the user runs. The user creates a pairing code on the TUI side, pastes it into the extension, and it is exchanged for a token that is remembered. Popup and side panel show live connection status, the project list is fetched, and the current page's origin can be bound to a project (remembered).

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Pairing works end to end against a live loopback server: a code issued by `opencode api post /api/pair` (TUI side) is redeemed; a wrong or expired code shows a clear error and changes nothing
- [ ] The token lives only in extension storage; never in code, logs, or the page
- [ ] `ping` status (ok / detail) renders in popup and side panel and updates after pairing without a reload
- [ ] The project list is fetched and the origin can be bound to a project; the binding persists
- [ ] Test harness lands: Vitest with WXT's plugin (`WxtVitest`) + in-memory extension APIs; pairing/token/storage covered against an injected fetch — no live server in tests
- [ ] `bun run compile` passes; one conventional commit; phase doc updated
