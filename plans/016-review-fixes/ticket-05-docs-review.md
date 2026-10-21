# 016e: Docs, live verification, re-review

**What to build:** Document the fixes, verify live, and hand the two-axis re-review to the orchestrator. No feature code.

**Blocked by:** 016a–016d.

**Status:** done.

## Checklist

- [x] Update `product.md`, `CONTEXT.md`, `README.md`, `CHROMEWEBSTORE.md` for the route bridge, multi-drop quota, pending clear, count wording, and any permission/script changes.
- [x] Update `plans/README.md` 016 row and `plans/016-review-fixes/README.md` with per-ticket shas and status.
- [x] `bun run compile`, `bun run test`, `bun run build` exit 0.
- [x] Live CDP smoke: page-world `pushState` clears armed set and open composer; composer close clears pending; five picks with waits; N=1 parity.
- [x] Handoff for the Standards + Spec re-review of `be30179..HEAD`. The orchestrator runs it after this commit; 016e does not run it.
- [x] One conventional `docs(plans)` commit.

## Acceptance

- Docs match the fixes and the live results.
- The re-review no longer reports the pushState gap, single-drop quota, or pending leak.
- Any remaining findings are explicitly listed as accepted/deferred.

## Outcome

**Shipped.** Docs and plan files only; no feature code changed.

Docs:

- `product.md`: route row and a route-bridge paragraph (MAIN-world `picker-route.content.ts`, no extra permission, page-world `pushState` closes the composer and clears the set, confirmed live); composer-dismissed row (clears background pending); count wording `1 element` / `N elements` for the composer and panel rows; quota strip walks the last element backward one shot at a time until it fits; `picker-route.content.ts` in the architecture diagram; permissions note (no `webNavigation`); open question about SPA `pushState` removed; the 015 live run attached 2 shots and the four-shot cap is unit-tested.
- `README.md`: navigation row covers `pushState`/`replaceState`/`popstate`/`hashchange` and clears the pending; composer-dismissed row; count-wording row; route bridge in the diagram and the architecture paragraph.
- `CHROMEWEBSTORE.md`: host-permission justification adds the MAIN-world route script as use (3), server access becomes (4), and states it adds no permission and reads no page content; remote-code section names both bundled content scripts.
- `CONTEXT.md`: Element set and Pick state rows cover count wording, the four-shot cap, and the clear on dismiss/route/composer close; code names add `installRouteEmitter` / `watchRouteChanges` / `watchWindowRoutes`, `picker-route.content.ts`, `respondToPickerRequest` / `registerPickerMessageHandler`, `formatElementCount`, `createPerTabQueue`.
- `plans/README.md`: 016 row → `shipped · cd1d9fa`, `ticket-01..05`.
- `plans/016-review-fixes/README.md`: per-ticket shas (016a `ade8fad`, 016b `8e9f315`, 016c `5be28b0`, 016d `cd1d9fa`, 016e this docs commit) and a note that the final review follows this commit.
- `plans/015-element-set/README.md`, `ticket-06-docs-verification.md`: the stale "unconfirmed" wording is gone; both say 016a confirmed the route bridge live.
- Each 016 ticket's `**Sha:**` line filled.

Verification (all exit 0):

- `bun run compile`: clean.
- `bun run test`: 65 files, 962 tests passed.
- `bun run build`: chrome-mv3, 210.67 kB; `content-scripts/picker-route.js` 888 B; manifest carries `world: "MAIN"` and `run_at: "document_start"`, with permissions still `storage`, `sidePanel`, `contextMenus` and host `<all_urls>`.

Live CDP smoke (Chrome 155.0.8059.85 headless, real content scripts, `127.0.0.1:5199`):

| Case | Result |
|---|---|
| Page-world `pushState`, composer open | One `browsertalk:picker-route` event; composer and overlay gone; pending `1 element` → empty |
| Page-world `pushState`, armed 2-element set | Overlay gone; pending `2 elements` (2 shots) → empty |
| Page-world `replaceState`, armed set | Overlay gone; pending `1 element` → empty |
| Composer Escape | Pending `1 element` → empty; composer gone |
| Five picks, 1.5 s apart | Composer `5 elements`; pending 5 elements, indices 0–4, 4 shots |
| N=1 plain click | Composer `1 element`; pending 1 element, 1 shot |

- With `--load-extension`, the extension did not load in this Chrome build: an extension page returned `chrome-error://chromewebdata` and had no `chrome.*` APIs. Loaded via CDP `Extensions.loadUnpacked` with `--enable-unsafe-extension-debugging` instead (id `aanallejggimbllapacalneoddeccnhg`). Not a product blocker, but future smokes must use this route.
- The quota multi-drop loop was not exercised live; it is unit-tested (two drops, success with only the first element's shot).
- `captureVisibleTab` worked in headless: 4 shots on 5 picks after waits, matching the cap.

Re-review: **not run in 016e.** The orchestrator runs the Standards + Spec review of `be30179..HEAD` after this commit; the three 015 material gaps are closed in the code and covered by tests, and this ticket records no remaining findings of its own.

Divergences:

- `plans/016-review-fixes/README.md` names 016e by "this docs commit" rather than a sha; a file cannot carry its own commit sha.
- Chrome's `--load-extension` path is unusable for smokes in this build; the CDP `Extensions.loadUnpacked` route above is the replacement.

**Sha:** this docs commit.
