# 003b: Settings page

**What to build:** An options page where the user sets the agent backend, the server URL, and a per-backend session-strategy override. The background honors the selection; a change takes effect on the next feedback without a reload.

**Blocked by:** 003a — Session strategy seam.

**Status:** done

- [x] Options page is reachable from the extension details and via a link in popup/panel; persists backend, server URL, strategy override
- [x] Defaults render honestly: backend `opencode`, server URL `http://127.0.0.1:15001`, strategy = backend default
- [x] Background reads the current selection on each send; backend/strategy change applies without reload
- [x] Strategy override lists registered strategies only; no way to save an unknown id
- [x] Logic covered with fake extension APIs; `bun run compile` passes
- [x] One conventional commit; phase doc updated

## Outcome

Shipped:

- Options entrypoint `entrypoints/options/` (`index.html` with `<meta name="manifest.open_in_tab" content="true">`, `main.ts`, `App.vue`, `style.css`). WXT emits `options_ui { page: options.html, open_in_tab: true }`; reachable from the extension details and from `browser.runtime.openOptionsPage()`.
- Fields: agent backend select built from `listAgentBackends()` (labels from each backend), server URL text defaulting to `http://127.0.0.1:15001`, and one session-strategy select per registered backend — "Backend default (<default label>)" plus the registered strategies from `listSessionStrategies()`.
- `components/SettingsLink.vue`: "Settings" link in the popup and side-panel headers; calls `browser.runtime.openOptionsPage()`.
- Page logic in `lib/settings/use-settings-page.ts` (composable, mirrors `lib/connection/use-connection.ts`): loads `getSettings()`, builds the backend/strategy choices with labels, saves backend and URL via `setSettings`, saves overrides via `setSessionStrategyOverride`; load and save errors surface through an `error` ref.
- Storage `lib/storage/settings.ts`: `setSessionStrategyOverride(backendId, strategyId | null)` — read-modify-write merge so other backends' overrides survive; `null` clears one entry; an unknown backend or strategy id throws (`Unknown …`) and storage stays untouched.
- `entrypoints/options/main.ts` registers the builtin backends and strategies in the options page context (the background's boot does not run there).
- Tests: +13 (4 storage merge/clear/validation, 1 resolution freshness, 8 settings-page composable). Suite 105 passed / 14 files; `bun run compile` passes; `bun run build` emits the options page.

Divergences:

- WXT defaults `open_in_tab` to false (embedded dialog); the options page sets it true via the WXT meta tag — a settings form in a tab is the better fit. product.md does not specify the presentation.
- The URL field saves the trimmed value; an empty field saves the default URL instead of an empty string.
- "Saved" feedback renders only for the URL save; selects persist silently and surface errors via the composable's `error` ref. Unknown ids cannot be picked: the selects are built from the registries and the handlers re-guard with `isAgentBackendId` / `isSessionStrategyId`.

Pending (later phases):

- 005/006 wire the composer and send path on the resolution path; this phase proves resolution reads storage fresh (test flips backend and override between resolves, no reload).
- 007 "+ new session".
- Live-browser click-through of the options page was not run (no browser test harness in the repo); checked via vue-tsc, the built manifest, and fake-API tests.
