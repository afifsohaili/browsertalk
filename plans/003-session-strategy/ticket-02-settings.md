# 003b: Settings page

**What to build:** An options page where the user sets the agent backend, the server URL, and a per-backend session-strategy override. The background honors the selection; a change takes effect on the next feedback without a reload.

**Blocked by:** 003a — Session strategy seam.

**Status:** ready-for-agent

- [ ] Options page is reachable from the extension details and via a link in popup/panel; persists backend, server URL, strategy override
- [ ] Defaults render honestly: backend `opencode`, server URL `http://127.0.0.1:15001`, strategy = backend default
- [ ] Background reads the current selection on each send; backend/strategy change applies without reload
- [ ] Strategy override lists registered strategies only; no way to save an unknown id
- [ ] Logic covered with fake extension APIs; `bun run compile` passes
- [ ] One conventional commit; phase doc updated
