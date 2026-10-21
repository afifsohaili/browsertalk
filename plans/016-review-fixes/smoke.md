# 016 smoke — reproducible CDP procedure

Live check of the element-set and route fixes against real content scripts. Run it after `bun run build`; update the results table each run and say what was not exercised.

## What it covers

| Case | What it proves |
|---|---|
| Page-world `pushState` with the composer open | The MAIN-world bridge closes the composer and clears the pending |
| Page-world `pushState` on an armed set | The armed set and overlay go; the pending clears |
| Page-world `replaceState` on an armed set | Both history hooks reach the isolated picker |
| Composer Escape | Unsent set drops and the background pending clears |
| Five modifier picks, 1.5 s apart | The set cap, the composer count, and the shot budget |
| N=1 plain click | The single-element flow matches the set flow |

Not covered: the quota multi-drop loop (unit-tested: two drops, then success with only the first element's shot), window blur, and hi-DPI crop fidelity.

## Environment (recorded from the 016e run, 2026-10-21)

- Chrome 155.0.8059.85, headless, macOS.
- Build: `.output/chrome-mv3` from `bun run build`.
- Test page: any page on `127.0.0.1:5199` with a heading, a button, and a paragraph.
- Extension id returned by `Extensions.loadUnpacked`: `aanallejggimbllapacalneoddeccnhg`.

`--load-extension` does not work in this build: the extension page returns `chrome-error://chromewebdata` and has no `chrome.*` APIs. Chrome 137+ removed that flag. Use CDP `Extensions.loadUnpacked` with `--enable-unsafe-extension-debugging`.

## Procedure

1. Build and serve the test page:

   ```sh
   bun run build
   python3 -m http.server 5199 --bind 127.0.0.1 --directory <page-dir>
   ```

2. Launch Chrome headless with the debugging port and the unsafe-extension-debugging switch:

   ```sh
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
     --headless \
     --remote-debugging-port=9222 \
     --enable-unsafe-extension-debugging \
     --user-data-dir="$TMPDIR/browsertalk-016-smoke" \
     about:blank
   ```

3. Connect a CDP client to `http://127.0.0.1:9222/json/version` (`webSocketDebuggerUrl`). Any client works; the 016e run used a throwaway node script, not committed.

4. `Page.navigate` the tab to `http://127.0.0.1:5199/`.

5. On the browser target, call `Extensions.loadUnpacked` with `{ "path": "<repo>/.output/chrome-mv3" }`. Record the returned id. Attach to its `service_worker` target from `http://127.0.0.1:9222/json/list`.

6. Reload the tab so both content scripts inject (`picker.content.ts` isolated, `picker-route.content.ts` in `MAIN`).

7. Drive real input, not synthetic DOM events, so the content script sees trusted events:

   | Step | CDP call |
   |---|---|
   | Arm the picker | `Input.dispatchKeyEvent` for `Alt+Shift+F`, or the panel arm request |
   | Modifier pick | `Input.dispatchMouseEvent` (`mousePressed` + `mouseReleased`) with `modifiers: 4` (Meta) |
   | Finish | `Input.dispatchKeyEvent` for the Meta/Control key-up |
   | Dismiss | `Input.dispatchKeyEvent` for `Escape` |
   | Page-world route change | `Runtime.evaluate` in the tab: `history.pushState({}, '', '/next')` |

8. Read state after each case:

   - Page DOM, via `Runtime.evaluate` on the tab: `#browsertalk-picker-overlay`, `#browsertalk-picker-count`, `#browsertalk-composer`.
   - Pending, via `Runtime.evaluate` on the service worker: `chrome.storage.session.get(null)`, keys `pending.feedback.<tabId>`. Count `elements` and `extras.screenshot` entries.

## Results — 016e run

| Case | Result |
|---|---|
| Page-world `pushState`, composer open | One `browsertalk:picker-route` event; composer and overlay gone; pending `1 element` → empty |
| Page-world `pushState`, armed 2-element set | Overlay gone; pending `2 elements` (2 shots) → empty |
| Page-world `replaceState`, armed set | Overlay gone; pending `1 element` → empty |
| Composer Escape | Pending `1 element` → empty; composer gone |
| Five picks, 1.5 s apart | Composer `5 elements`; pending 5 elements, indices 0–4, 4 shots; the fifth shot is gated by the index ≥ 4 rule |
| N=1 plain click | Composer `1 element`; pending 1 element, 1 shot |

`captureVisibleTab` works headless: 4 shots on 5 picks after waits, matching the cap.

## Accepted nuisance: page-dispatchable route event

Any page script can call `window.dispatchEvent(new Event('browsertalk:picker-route'))` and clear an armed set or an open composer. Accepted:

- The event carries no page data and reaches no background code.
- The worst case is a discarded unsent set, the same outcome as Escape or a real route change.
- The event name is part of the bridge contract; a secret handshake would add page-visible state without a real threat to defend.

## Recording a run

Write the Chrome version, the extension id, the results table, and the not-exercised list. Keep every claim to a path that actually ran.
