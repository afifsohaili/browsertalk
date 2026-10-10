# 004b: Picker extras

**What to build:** Optional captures enrich a feedback when available, and never block it when absent: a screenshot crop of the selected element, the component name (best effort), and a small computed-styles + ARIA subset.

**Blocked by:** 004a — Picker core.

**Status:** done · 5ca2514

- [x] Screenshot crop attaches when capture succeeds; skipped silently when the tab cannot be captured
- [x] Component name detected best-effort (React dev fibers, Vue) and omitted when unknown
- [x] Computed-styles + ARIA subset kept small enough not to flood the prompt; cap recorded in the phase doc
- [x] Feedback with zero extras still sends fine
- [x] Crop fidelity under browser zoom / hi-DPI checked once; findings recorded
- [x] `bun run compile` passes; one conventional commit; phase doc updated

## Outcome

Shipped:

- Extras ride the existing capture path: content script reads component/styles/ARIA on click (`readExtras`), `assembleFeedback` omits the `extras` key when every piece is empty; background validates with `isPickerExtras`, attaches the screenshot, then stores `pending.feedback`. Zero-extras feedback stores unchanged.
- Screenshot crop: background captures the visible tab (`browser.tabs.captureVisibleTab`, PNG) for the sender tab's `windowId` and crops to the element box. Crop math is pure (`computeCropRect`): scale = captured image size ÷ viewport, so devicePixelRatio and browser zoom cancel; origin floored, far edge ceiled (whole element kept); clamped to the image; null for offscreen/empty elements. The canvas work runs in the background service worker (`OffscreenCanvas` + `createImageBitmap` + `convertToBlob`).
- Format and where: PNG data URL stored at `extras.screenshot = { dataUrl, width, height }` (width/height in captured-image pixels), inside the existing `pending.feedback` in `storage.session`. Data URLs over 1.5 MB are skipped (`MAX_SCREENSHOT_BYTES`).
- Never blocks: capture throw, decode/crop throw, empty box, or oversize crop all return null and the feedback stores without a screenshot. Captures are spaced ≥500 ms (`MIN_CAPTURE_INTERVAL_MS`, the 2/sec `captureVisibleTab` ceiling); a spent capture still counts toward the interval. Tests inject clock/sleep/capture/crop.
- Component name: `detectComponentName` reads `__reactFiber$*` (walks `return`; function name, `displayName`, memo inner, forwardRef render; depth cap 50) and `__vueParentComponent` (`name` → `__name`, walks `parent`). Omitted when unknown. Dev builds only: React prod minifies names; Vue prod does not attach the marker.
- Computed styles subset: 11-property whitelist (`display`, `position`, `z-index`, `opacity`, `color`, `background-color`, `font-size`, `font-weight`, `border-radius`, `overflow`, `cursor`), capped at **8 properties × 60 chars**, whitespace collapsed (`pickStyleSubset`).
- ARIA: role fallback explicit `role` attribute → implicit role (tag, input type, `select[multiple]`, `a[href]`); name fallback `aria-labelledby` → `aria-label` → native `<label>` → `alt` → `title` → text content for name-from-content elements, capped at **120 chars**. Both members optional; omitted when neither resolves (`resolveAria`).
- Tests: +64 (216 total / 21 files vs 152 in 004a): 14 component, 21 extras, 16 crop/screenshot, 7 extras guard, 4 messages wiring, 2 collect assembly. `fakeBrowser` for extension APIs; injected screenshotter seam (`setElementScreenshotter`, null restores the default).
- Live check (headless Chromium 152 + CDP, built extension, 15/15): dsf 2 → crop 400×80 for a 200×40 box (exact), stored width/height match the PNG IHDR; `chrome.tabs.setZoom(tabId, 1.25)` on top (dpr 2.5) → crop 500×101 vs expected 500×100 (1 px outward rounding); styles subset hits the 8 cap; aria `{ role: 'button', name: 'Go now' }`; component omitted without fibers.

Divergences:

- Crop runs in the background service worker (`OffscreenCanvas`), not the content script: capture and crop stay in one place; no image data crosses the message boundary.
- `setElementScreenshotter` test seam added; messages tests inject fakes because `fakeBrowser` does not implement `captureVisibleTab`.
- `aria` members are optional (`{ role }` or `{ name }` alone is valid), and `extras` itself is absent when empty — a zero-extras feedback is byte-identical to a 004a feedback.
- Zoom fidelity rounds outward by ≤1 px at fractional scales — by design, keeps the whole element.
- Component detection was not exercised live (smoke page has no React/Vue); representative fiber/instance shapes are pinned in unit tests. React 19 prod minification and Vue prod builds stay best-effort by definition.

Pending (005+):

- Nothing blocking 005. 005 consumes `pending.feedback.extras`; the screenshot rides as a PNG data URL string and attaches as an image file per `product.md` §Prompt template.
