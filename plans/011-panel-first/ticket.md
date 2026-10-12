# 011: Panel-first entry point

**What to build:** Clicking the toolbar icon opens the side panel (the control room) instead of the popup. Retire the popup entrypoint; its only unique action ("Send page URL only") moves into the side panel. Owner decision 2026-10-12: panel-first. Right-click → "Open side panel" (Chrome built-in) stays as a bonus path.

**Blocked by:** None (independent of 009/010).

**Status:** ready-for-agent

- [ ] Built manifest has no `action.default_popup`; background calls `sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` at startup (exact property name — a wrong name throws synchronously; the call is an upsert)
- [ ] `entrypoints/popup/` deleted with no leftovers; `SendUrlOnlyButton` renders in the side panel and queues a URL-only item; no imports reference the popup
- [ ] Action keeps a sensible `default_title` (e.g. "Open Browsertalk panel"); icons unchanged; picker, commands, and context-menu paths untouched
- [ ] Docs updated: `product.md` §Surfaces (popup row out; note icon opens the panel), `CONTEXT.md` surfaces term, `CHROMEWEBSTORE.md` entries that mention the popup
- [ ] `bun run compile` + full suite + `bun run build` pass; live check: built manifest has no default_popup and `sidePanel.getPanelBehavior()` returns `openPanelOnActionClick: true` (headless + CDP if feasible; note anything human-only, e.g. the actual toolbar click)
- [ ] One conventional commit; plans updated

Exploration record (2026-10-12): the popup's only unique functionality was "Send page URL only"; the side panel already mounts ConsentGate, ConnectionPanel, and SettingsLink. No code called any `sidePanel` API before this change, so the icon always opened the popup.
