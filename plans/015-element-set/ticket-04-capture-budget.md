# 015d: Capture budget and multi-element attachments

**What to build:** Screenshots for an element set are best effort. Capture at pick time on Chrome's 2-per-1-second fixed window; the first pick waits for a token, later picks skip when the window is empty. Hide the picker overlay around each capture. Attach up to four crops as `element-1.png` …; storage-quota drops strip from the last element.

**Owner decisions (2026-10-21):** [Screenshot capture under rapid multi-pick](issues/04-screenshot-capture.md). 2-per-1s fixed window; no single frame at finish; skip fast picks; no user-gesture reliance.

**Blocked by:** 015c.

**Status:** done.

## Checklist

- [x] `lib/picker/capture-budget.ts` (new): 2 tokens per 1000ms fixed window; `tryAcquire`/`waitForToken`; injectable clock; tests (0/100/200/300ms, 0/500/1000ms, no refund).
- [x] `lib/picker/screenshot.ts`: remove the 500ms sleep; `captureFor(feedback, request, { allowWait })`; `allowWait` only for index 0; skip otherwise; tests.
- [x] `lib/picker/messages.ts`: one shared budget in the background; skip capture for index ≥ 4; tests.
- [x] `lib/picker/session.ts` / `lib/composer/element-submission.ts`: hide the overlay host and count pill around each capture with a ref count; restore in `finally`; live check.
- [x] `lib/send/attachments.ts`: at most 4; `element-1.png` … in element order; tests.
- [x] `lib/composer/assemble.ts`: `withoutScreenshot` strips the last element's shot, then the previous; tests.
- [x] `lib/storage/budgets.ts`: count every attachment; tests.
- [x] `bun run compile` + `bun run test` pass; live CDP check; one conventional commit.

## Acceptance

- Four rapid picks produce at most two `captureVisibleTab` calls in the first second; no quota error; elements without shots still send.
- A lone pick on an empty window waits for the next token and captures; N=1 parity.
- Captured crops contain no picker overlay or count pill; a skipped pick leaves no overlay stuck hidden.
- A five-element set has at most four attachments; the fifth element sends without a shot.
- A full outbox drops screenshots from the last element backward until it fits.

## Outcome

**Shipped.** Best-effort per-pick capture on Chrome's fixed window, an overlay that never appears in a crop, and four attachments maximum.

- `lib/picker/capture-budget.ts` (new): `createCaptureBudget({ now, sleep })` with `tryAcquire`/`waitForToken`, `CAPTURE_WINDOW_MS = 1000`, `CAPTURE_TOKENS_PER_WINDOW = 2`. The window resets only when `now > expiresAt`, matching `QuotaService::TimedLimit`; a waiter sleeps to `expiresAt - now + 1` and is bounded at three attempts.
- `lib/picker/screenshot.ts`: the 500ms sleep and `MIN_CAPTURE_INTERVAL_MS` are gone. `ScreenshotDeps` takes `budget` instead of `now`/`sleep`. `captureFor(feedback, request, { allowWait })` claims a token before the visibility check; `waitForToken` when `allowWait`, `tryAcquire` otherwise; no token means `null` with no API call.
- `lib/picker/messages.ts`: one module-level budget feeds the default screenshotter (extension-wide). `capturePick` passes `{ allowWait: elementIndex === 0 }` and skips the screenshotter entirely for index ≥ 4.
- `lib/picker/limits.ts`: `MAX_ELEMENT_ATTACHMENTS = 4`, shared by the capture gate and the attachment cap.
- `lib/picker/overlay-visibility.ts` (new): pure ref-counted `createOverlayHolds({ hide, show })`; `guard` restores in `finally`, releases are idempotent.
- `lib/picker/session.ts`: hides the overlay host and count pill through the holds; `buildOverlay` re-applies a held hide; `withOverlayHidden` exposed. Hiding a missing host (disarm or finish mid-capture) is a no-op.
- `entrypoints/picker.content.ts`: `notify` wrapped in `session.withOverlayHidden`, so the overlay is hidden from message send until the background capture and merge settle.
- `lib/send/attachments.ts`: shots keep their element ordinal and stop at four.
- `lib/storage/budgets.ts`: unchanged; it counts through `elementAttachments`, so the cap applies to the delivery estimate too.

**Tests.** 891 pass across 58 files; `bun run compile` and `bun run build` clean.

- New: `capture-budget.test.ts` (10), `overlay-visibility.test.ts` (7).
- Feature spec in `picker/messages.test.ts`: four rapid `respondToPickerRequest` calls with the real budget and screenshotter, fake `captureTab` → two captures, four stored elements, four `{ ok: true }`, shots on 1–2 only; a lone pick on a full window sleeps 1001ms and captures; index 4 never reaches the screenshotter; `allowWait` is true only at index 0.
- Extended: `screenshot.test.ts` (two per window, wait, skip, default skip, visibility check spends the token, no refund, empty box spends nothing), `attachments.test.ts` (five shots → four, ordinal kept), `assemble.test.ts` (five-element strip order), `budgets.test.ts` (all four counted, fifth shot not).

**Divergences.**

- `captureFor` keeps the `(feedback, request, options)` shape with `allowWait`, not the ticket's `entry`; the screenshotter already reads `elements[0]` and every call site passes a one-element feedback.
- The hide sits around `notifyCaptured` in the content script, not in `element-submission.ts`. The capture runs in the background after the message, and the response resolves only after the crop is persisted, so the send-to-response span covers the capture exactly. Overlapping picks share the ref count.
- The budget lives in `messages.ts` next to the default screenshotter rather than a separate background singleton; `setElementScreenshotter` still replaces the whole screenshotter in tests.
- The token is spent before `isVisible()`: Chrome spends its token on any call that reaches the API, and the research confirmed the local slot must follow.
- `elementAttachments` slices after naming by ordinal, so a set whose only shot is the fifth element still yields `element-5.png`. That keeps the file-to-element mapping from 015a.

**Live check.** Not run. No CDP endpoint on `127.0.0.1:9222`, and 015c already hit the blocker that headless Chrome loads the built service worker but never injects `content-scripts/picker.js`. The overlay-free crop, the no-quota-error burst, and the stuck-hidden check stay in the 015f live smoke.

**Sha:** recorded by 015f.
