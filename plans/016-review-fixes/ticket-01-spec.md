# 016a: Review spec fixes

**What to build:** Close the three material spec gaps and two precision notes from the 015 review.

**Findings:**

- **Page-world `pushState` never clears the set.** `lib/picker/route.ts` patches `window.history` in the content script's isolated world; the page's `history` is a different wrapper. The branch is dead code. Ticket 03 required any route change to clear and disarm.
- **Quota strip is single-shot.** `appendItem` in `lib/composer/messages.ts` strips one screenshot and retries once; a still-oversized item fails. Ticket 04 says drop until it fits.
- **Composer dismissal leaves pending behind.** `composer.close()` calls `session.end()`, which omits `onClear`, so the background pending and screenshots survive. Ticket 03 required `picker/cleared` on cancel.
- **Minor:** panel renders `1 element` where ticket 05 writes `N elements`; live five-element run attached 2 shots, so the 4-shot live path was not exercised.

**Blocked by:** 015.

**Status:** done.

## Checklist

- [x] Route bridge: add a MAIN-world content script (`world: 'MAIN'`, `runAt: 'document_start'`) that wraps page-world `pushState`/`replaceState` and dispatches one custom route event; the isolated content script listens for it plus `popstate`/`hashchange`. Remove the dead isolated history patch. If this WXT version does not support `world: 'MAIN'`, use `webNavigation.onHistoryStateUpdated` in the background plus the permission. Test the emitter against a fake history and the isolated listener against the event.
- [x] `lib/composer/messages.ts`: loop `withoutScreenshot` while an element screenshot remains and the append fails with quota; stop when it fits or no shots remain. Test two or more drops.
- [x] `lib/picker/session.ts`: `end()` calls `onClear(setID)`; `picker.content.ts` `onClose` relies on that path so the background pending is cleared on composer close. Test with happy-dom or a seam.
- [x] Add a 5-shots → 4-attachments test if missing; add `SentItem.elementCount` for N>1 in the send test.
- [x] Docs precision: specify `1 element` / `N elements`; state the live run attached 2 shots and the cap is unit-tested.
- [x] `bun run compile` + `bun run test` pass; `bun run build` once; one conventional commit.

## Acceptance

- A page-world `history.pushState` clears an armed set and closes an open composer.
- An outbox that needs three screenshot drops sends successfully with the last element's shots removed.
- Closing the composer clears the background pending; the next arm starts clean.
- A five-element set with five shots attaches four; a N>1 send records `elementCount: N`.
- N=1 behavior unchanged.

## Outcome

**Shipped.** The three gaps are closed; N=1 is unchanged.

- `entrypoints/picker-route.content.ts` (new): MAIN-world content script at `document_start`, matches `<all_urls>`. WXT 0.21.4's own types accept `world: 'MAIN'`, so the `webNavigation` fallback was not needed. The built manifest carries `world: "MAIN"` and `run_at: "document_start"`.
- `lib/picker/route.ts`: `installRouteEmitter({ history, dispatch })` replaces the isolated patch; it wraps `pushState`/`replaceState`, dispatches one `browsertalk:picker-route` event after each, and restores (or deletes) both methods on stop. `watchRouteChanges` now only listens: the custom event plus `popstate` and `hashchange`. `watchWindowRoutes` passes the real window.
- `lib/composer/messages.ts`: `appendItem` loops `withoutScreenshot` while the append fails with quota and a shot remains; it returns the stored item plus `screenshotDropped`.
- `lib/picker/session.ts`: `end()` snapshots the set id, clears, then calls `onClear(cleared)` when a set was live, so the composer-close path names the set the background must drop. `entrypoints/picker.content.ts`: `onClose` is `endSet()`; `onClear` already clears the local submission and sends `picker/cleared`.
- Docs: `product.md` lists `pushState`/`replaceState` in the route row, writes `1 element` / `N elements`, and the SPA open question now describes the MAIN-world bridge as unit-tested, live unconfirmed. `plans/015-element-set/ticket-06-docs-verification.md` and `README.md` state the live run attached 2 shots and the four-shot cap is unit-tested, not exercised live.

**Tests.** 59 files, 910 passed. `bun run compile` clean. `bun run build` clean: chrome-mv3, 209.55 kB, `content-scripts/picker-route.js` 888 B.

- `lib/picker/route.test.ts` (9, rewritten): emitter dispatches once after `pushState` and once after `replaceState`, after the original runs; arguments pass through; stop restores own and prototype methods and stops dispatching; double stop safe. Listener fires on the custom event, `popstate`, and `hashchange`; stop removes all three.
- `lib/picker/session.test.ts` (new, happy-dom): `end()` clears the pending once after arm and is idempotent; closing a finished two-pick set names that set on `onClear`; a `popstate` closes the composer and clears once.
- `lib/composer/messages.test.ts`: three 100 kB shots with 250 kB headroom → success, `screenshotDropped: true`, only the first element keeps its shot (two drops). Existing single-drop tests unchanged.
- Existing and unchanged: `attachments.test.ts` five shots → four attachments; `send.test.ts` three-element send records `elementCount: 3`.

**Live note.** Headless Chrome 155 loaded `.output/chrome-mv3` and drove the real content scripts on `127.0.0.1:5199`. Composer Escape: pending went from one set / 2 elements to empty. Page-world `history.pushState`: the page saw `browsertalk:picker-route`, the composer and overlay closed, pending went to empty. Page-world `replaceState` on a freshly armed set: event seen, overlay gone. The quota loop and the four-shot cap were not exercised live; both are unit-tested.

**Divergences.**

- `end()` notifies only when a set is live. On a route change the session drops the set id before calling `onRouteChange`, so the composer's `end()` does not fire a second, null-named clear; the route path sends the one `picker/cleared`.
- The isolated content script no longer patches history at all, so `route.ts` lost the isolated patch instead of keeping it as a fallback. Main-world only, per the ticket.
- `happy-dom@21.0.4` is a new dev dependency for the session lifecycle test.

**Sha:** recorded by 016d.
