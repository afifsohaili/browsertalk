# 018c: Component tests for welcome and panel

**What to build:** Rendered specs for the welcome tab and the panel setup card. The tests exercise the actual template conditions, visible warnings, and click wiring.

**Blocked by:** 018a.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Add `@vue/test-utils` as a dev dependency. Use happy-dom per file (`// @vitest-environment happy-dom`).
- [ ] Welcome spec: unreachable entry still shows the pair form; upgrade shows the form and “Check again”; remote confirmation shows the origin and warning; cancel returns to pair; connected shows the project handoff.
- [ ] Welcome spec: clipboard success and rejection are visible; “Open side panel” failure shows the fallback copy.
- [ ] Panel setup card spec: each state shows the right label/action; “Finish setup” opens the welcome tab; no pairing form in the card.
- [ ] Tests use `fakeBrowser`, the fake backend, and injected fetch responses. No live server.
- [ ] `bun run compile` and `bun run test` pass.
- [ ] One conventional commit; ticket status and phase README updated with the SHA.
