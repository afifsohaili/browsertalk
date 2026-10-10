# 004a: Picker core

**What to build:** The user arms the picker from any surface — side panel button, popup, `Alt+Shift+F`, or the page context menu — hovers and clicks an element, and the core facts are captured and handed to the background. Elements highlight with a tag/class label while hovering.

**Blocked by:** 003b — Settings page.

**Status:** done · 67d42ed

- [x] Arms from all four surfaces; disarms on Escape, click-out, or after selecting
- [x] Hover: highlight + tag/class label; click selects the element
- [x] Core facts captured per `product.md` §What gets captured: URL/title, tag/id/classes, selector path, text, key attributes, box/viewport/scroll
- [x] Captured facts reach the background as one feedback item
- [x] Top frame only; cross-origin iframe content documented as out of scope
- [x] Collector logic unit-tested off-DOM where practical; `bun run compile` passes
- [x] One conventional commit; phase doc updated

## Outcome

Shipped:

- `lib/picker/` core: `facts.ts` (core-fact types + `isPickerFeedback` validation), `collect.ts` (pure: selector path with id anchor + `:nth-of-type`, whitespace collapse + 160-char text cap, attribute whitelist `href`/`src`/`role`/`aria-label`/`data-testid`/`placeholder`, url/path/query parse, rounded box/viewport/scroll, feedback assembly), `read.ts` (thin DOM read of the ancestor chain, attributes, rects), `session.ts` (picker mode: overlay highlight + tag/id/class label, crosshair cursor, disarm on Escape/blur/toggle/select), `protocol.ts` (message guards), `messages.ts` (background handler + surface/content helpers).
- Arm surfaces: side panel and popup buttons (`components/ArmPickerButton.vue`, "Point at element"), `Alt+Shift+F` (`commands.onCommand`), context menu ("Browsertalk: point at element"). All route through the background — active tab via `tabs.query`, right-clicked tab via `onClicked`'s `tab` — then `tabs.sendMessage` to that tab's content script. A page without the content script returns `Can't arm the picker on this page`; no active tab returns `No active page to arm the picker on`. The popup closes after a successful arm.
- Boundary: the content script sends one `picker/captured` message; the background validates it with `isPickerFeedback` and holds it as the pending feedback in `chrome.storage.session` under `pending.feedback` (`lib/storage/pending.ts`) for 005. Nothing touches the send path; no server calls.
- Tests: +47 (20 collect, 14 protocol/guards, 9 messages/handler, 4 pending storage). Suite 152 passed / 18 files.
- `bun run compile` passes; `bun run build` emits `content-scripts/picker.js`, `background.js`, and the popup/side panel chunks.
- Live-browser check run against the built extension (headless Chromium 152 + CDP, 19/19): arm through the content script, overlay mounted, crosshair cursor, hover label `button#go.btn.primary`, click select → overlay removed, pending feedback facts (url/title/selector/classes/text/attrs/box), Escape/blur/surface-toggle disarm, `chrome://` page yields the no-content-script error.

Divergences:

- Pending feedback lives in `storage.session` (cleared on browser restart), not `storage.local`: transient by design, out of the send path. Key `pending.feedback` added to `STORAGE_KEYS`; the storage table in `product.md` lists only local keys, so this is a documented addition.
- Arm requests toggle: the content script owns armed state; a second `picker/arm` disarms and responds `{ ok: true, armed }`. This is how "disarms on a surface toggle" works without surfaces tracking state.
- Selector generation drops classes once an id anchors the path (`button#go`); without ids it emits the chain from `body` with `:nth-of-type` only for duplicated tags. Pinned in tests.
- Window blur (leaving the page) disarms — "click-out" read as leaving the page.
- Shortcut and context-menu wiring is covered by unit tests of `armPickerOnActiveTab` / `armPickerOnTab` with fake APIs; the `commands`/`contextMenus` event listeners themselves could not be triggered under `fakeBrowser` (it does not implement those events).

Pending (004b / later):

- 004b extras: element screenshot crop, component name, computed-styles + ARIA subset.
- Cross-origin iframe content stays out of scope: the content script is top-frame only (no `all_frames` in the manifest).
- Live check did not press the real `Alt+Shift+F` keys or a real context-menu item; both call the same `armPickerOnActiveTab` / `armPickerOnTab` code paths the smoke check exercised via `tabs.sendMessage`.
