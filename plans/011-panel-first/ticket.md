# 011: Panel-first entry point

**What to build:** Clicking the toolbar icon opens the side panel (the control room) instead of the popup. Retire the popup entrypoint; its only unique action ("Send page URL only") moves into the side panel. Owner decision 2026-10-12: panel-first. Right-click → "Open side panel" (Chrome built-in) stays as a bonus path.

**Blocked by:** None (independent of 009/010).

**Status:** done · 8a269ab

- [x] Built manifest has no `action.default_popup`; background calls `sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` at startup (exact property name — a wrong name throws synchronously; the call is an upsert)
- [x] `entrypoints/popup/` deleted with no leftovers; `SendUrlOnlyButton` renders in the side panel and queues a URL-only item; no imports reference the popup
- [x] Action keeps a sensible `default_title` (e.g. "Open Browsertalk panel"); icons unchanged; picker, commands, and context-menu paths untouched
- [x] Docs updated: `product.md` §Surfaces (popup row out; note icon opens the panel), `CONTEXT.md` surfaces term, `CHROMEWEBSTORE.md` entries that mention the popup
- [x] `bun run compile` + full suite + `bun run build` pass; live check: built manifest has no default_popup and `sidePanel.getPanelBehavior()` returns `openPanelOnActionClick: true` (headless + CDP if feasible; note anything human-only, e.g. the actual toolbar click)
- [x] One conventional commit; plans updated

Exploration record (2026-10-12): the popup's only unique functionality was "Send page URL only"; the side panel already mounts ConsentGate, ConnectionPanel, and SettingsLink. No code called any `sidePanel` API before this change, so the icon always opened the popup.

## Outcome

Shipped in `8a269ab` (`feat(panel): panel-first entry point, retire the popup`). `bun run compile` (exit 0), `bun run test` (49 files, 682 tests), and `bun run build` (exit 0) pass; live headless Chromium + CDP check 16/16.

**Shipped**

- Popup retired: `entrypoints/popup/` (App.vue, index.html, main.ts, style.css) deleted; WXT no longer emits `action.default_popup` and no `popup.html` lands in the build. `SendUrlOnlyButton` moved into the side panel's action row next to "Point at element" / "Comment on page" (it takes no props; nothing to rewire). No code or config reference to `popup` remains (grep over `entrypoints/`, `components/`, `lib/`, `wxt.config.ts`, plus `*.ts/vue/html/css/json` repo-wide).
- `entrypoints/background.ts`: `await browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` at startup, in a try/catch that logs `Browsertalk: side panel behavior setup failed` via the context-menu `console.warn` pattern. The try/catch (vs a bare `.catch`) also survives a missing API/sync throw without aborting the rest of startup. No `action.onClicked` added — the setter is an upsert.
- `wxt.config.ts`: `action.default_title: 'Open Browsertalk panel'`; icons, permissions, `commands`, and `side_panel.default_path` unchanged.
- Docs: `product.md` §Surfaces (popup row out; side panel row now notes "The toolbar icon opens it"), `CONTEXT.md` Surfaces term (popup dropped), `CHROMEWEBSTORE.md` test-instruction step 3 ("Click the extension's toolbar icon to open the side panel").
- Live check: built manifest has no `action.default_popup`, `default_title` set, picker content script still emitted; `chrome.sidePanel.getPanelBehavior()` returns `{ openPanelOnActionClick: true }` from both the service worker and the side panel page; the real side panel opened from a genuine CDP input gesture; it rendered all three action buttons; clicking "Send page URL only" confirmed "Queued" and queued exactly one outbox item (empty comment, active page URL + title). Script: `/home/afifsohaili/.cache/opencode-tmp/browsertalk-011-smoke/panel-first-smoke.mjs` (throwaway, not committed).

**Divergences / decisions**

- No new unit tests: the phase is manifest + entrypoint wiring (a Chrome API call in the background, config and template changes). Vitest has no Chrome APIs to assert against, so the live CDP check is the coverage; the existing suite is untouched and green. `tdd` skill not needed.
- `bun run test` required `TMPDIR=~/.cache/opencode-tmp` in this session: `/tmp` is a tmpfs with `usrquota` and the user quota is exhausted (writes fail with `EDQUOT`; the pristine-tree run failed with temp-file `ENOENT`s in Vite's SSR cache). Moving TMPDIR off `/tmp` is the workaround; no repo change. The first full-suite failure was environmental, not from this phase.
- `product.md`/`CONTEXT.md` edits kept to the exact rows the ticket names; see pending for the stale mentions left behind.

**Pending / cannot close locally**

- The actual toolbar-icon click is human-only: CDP cannot click the Chrome toolbar, so `openPanelOnActionClick` is asserted through `getPanelBehavior()`. Final acceptance: click the pinned icon in a real Chrome and see the side panel open.
- Stale "popup" mentions outside the ticket's doc scope, left in place: `product.md` workflow step 2, `product.md` architecture diagram (line 121), `product.md` `activeTab` permission rationale (line 188; already stale since 008 removed the permission), `README.md` surfaces list and architecture diagram. One small follow-up commit fixes all five.
- `/tmp` quota may also break other tooling in this session; the throwaway smoke script lives under `~/.cache/opencode-tmp/` for that reason.
