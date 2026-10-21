# Screenshot capture under rapid multi-pick

Resolves `issues/04-screenshot-capture.md`. No code changes.

## Question

Can the existing screenshotter capture up to four element crops reliably when Cmd/Ctrl+clicks arrive faster than the 500ms throttle?

## Method

- Read `lib/picker/screenshot.ts`, `messages.ts`, `read.ts`, `session.ts`, `limits.ts`, their tests, plus `lib/composer/element-submission.ts` and `lib/storage/pending.ts`.
- Read current Chrome Tabs and Runtime API docs, and the Chromium source that enforces the quota (`tabs_api.cc`, `quota_service.{h,cc}`, `chrome/common/extensions/api/tabs.json`), fetched 2026-10-21.
- No runtime extension test was run. Quota claims come from docs and Chromium source; the Unconfirmed section lists what was not measured.

## Confirmed facts

| Fact | Evidence |
| --- | --- |
| `captureVisibleTab` allows **2 calls per second** | Chrome Tabs API reference, `MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND`; Chromium API schema value `2` |
| The quota is a **1-second fixed window with 2 tokens**, not a smooth 2/sec rate | `QuotaService::TimedLimit::Apply`: resets only when `event_time > expiration`; otherwise `DeductToken()` |
| One bucket is shared by the whole extension, across tabs and windows | `QuotaService::Assess` keys by extension id + function name; `SingletonBucketMapper` |
| On exceed, the call fails before capture with `This request exceeds the MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND quota.` | `kOverQuotaError = "This request exceeds the * quota."` in `quota_service.cc`; name from `GetQuotaLimitHeuristics` |
| Promise-returning Chrome APIs reject; they do not set `runtime.lastError` | Chrome Runtime API reference, `lastError` property; WXT `browser` is `globalThis.chrome` in Chrome |
| `captureVisibleTab` captures only the **visible area of the active tab**, not the full page | Chrome Tabs API reference, `captureVisibleTab()` |
| It needs `<all_urls>` or `activeTab`; the repo has `<all_urls>` host permission | Chrome docs; `wxt.config.ts:11` |
| User-gesture calls skip quota limiting | `TabsCaptureVisibleTabFunction::ShouldSkipQuotaLimiting` returns `user_gesture()`. Whether a content-script click carries a gesture into the background here is unconfirmed |

Consequence of the fixed window: three calls at 0ms, 500ms, 1000ms are not safe. A call exactly on the expiration is still rejected; only a call strictly after it resets the bucket.

## Code behavior

- **The crop box is captured at pick time, not capture time.** `readElement` stores `getBoundingClientRect()` and `window.innerWidth/Height` at click (`read.ts:82-93`). `captureFor` later crops that box against a frame captured up to 500ms later (`screenshot.ts:52-63`). `computeCropRect` never reads `element.scroll` (`screenshot.ts:34-47`).
- **The 500ms sleep is not a queue.** Each `captureFor` call independently computes `MIN_CAPTURE_INTERVAL_MS - (now - lastCaptureAt)` and sleeps (`screenshot.ts:55-58`). `lastCaptureAt` is written before the awaited visibility check and capture (`:59`). Concurrent calls therefore sleep to the same deadline and then all capture within a few milliseconds.
- **Picks are concurrent.** `createElementSubmission.track` calls `notify` without awaiting (`element-submission.ts:20-25`), so four rapid clicks produce four in-flight `picker/captured` handlers.
- **A 4-click burst overruns the quota.** One capture runs at t=0; the other three wake at t≈500ms. The 1-second window has one token left, so one succeeds and the rest reject. `captureFor` catches every error and returns `null` (`screenshot.ts:64-65`): the elements still send, silently without shots.
- **A failed capture still spends the local slot.** `lastCaptureAt` is consumed even when the tab is invisible; Chrome's token is consumed on any call that reaches the API, even if the capture later fails. The existing test asserts the next call still waits (`screenshot.test.ts:213-234`).
- **The overlay is absent today only because the picker disarms first.** `onClick` calls `disarm()` before `onPick` (`session.ts:78-79`), which removes the highlight host. A multi-pick loop keeps the picker armed, so a capture at pick time includes the highlight/label unless the overlay is hidden. This is by construction; not runtime-checked.
- **Persistence order is capture-completion order, not pick order.** `persistPendingCapture` runs after each capture (`messages.ts:57-63`), and `setPendingFeedback` serializes writes per tab (`pending.ts:44-55`), but a later pick whose capture finishes first can write first and then be overwritten by an earlier pick. `track` keeps only `latest` and `submit` awaits only that (`element-submission.ts:22,28-36`). Per-pick capture needs a merge/sequence rule and an await-all at finish.
- **A skipped shot is already representable.** `extras.screenshot` is optional; `cropScreenshot` drops crops over `MAX_SCREENSHOT_BYTES` (1.5MB, `limits.ts:1`, `screenshot.ts:96`); a full `storage.session` falls back to the feedback without the shot (`pending.ts:20-22`).

## Direct answers

1. **Quota and on exceed:** 2 per 1-second fixed window, extension-wide. Exceeding rejects the promise; this code swallows it into `null`.
2. **Current behavior:** sleep, visibility check, capture, crop. The crop box is pick-time, not capture-time.
3. **Delayed capture after scroll or move:** no, not correct. Scroll, element movement, layout shift, or window resize all invalidate the pick-time box. A partly offscreen box is clamped to a partial crop; a fully offscreen one returns `null` (`screenshot.ts:39-46`). Silent wrong pixels are possible when the stale box still fits inside the new frame.
4. **One frame plus N crops:** viable only when all N elements are visible in that one frame at that one scroll position. Elements picked at another scroll position are not in the frame; their stale boxes crop whatever now occupies those coordinates. Covering them requires scrolling and recapturing, which spends the same quota and janks the page. The composer/overlay can also occlude the frame.
5. **Recommendation:** skip screenshots for elements picked faster than the throttle.

## Options and tradeoffs

| Option | What it does | Tradeoff | Verdict |
| --- | --- | --- | --- |
| Capture per pick (status quo) | Sleep 500ms, then capture for every pick | 4 rapid picks collapse into 3-4 attempts in one window; at most 2 pass; errors are swallowed. A real queue at 500ms still fails the third call in a fixed window and captures stale boxes 1-2s later, with the overlay visible | No |
| Batch at finish | One frame at finish, crop all elements | Only the final viewport and scroll position. Other elements are absent; stale boxes crop wrong pixels. Restoring scroll to recapture costs the same quota and page jank. Adds latency before the composer opens | No |
| Skip fast picks | Capture immediately at pick time when the budget allows; otherwise keep the element with no shot | Loses shots in a fast burst; never produces wrong pixels or quota errors; N=1 unchanged | **Yes** |

## Recommendation

**Skip screenshots for elements picked faster than the throttle.**

1. Capture at pick time; do not queue later picks behind the camera. If the budget has no token for a later pick, return `null` immediately. The element and its facts stay; only `extras.screenshot` is absent.
2. Put the budget in the background, shared across tabs: 2 capture starts per 1-second window, claimed synchronously before any `await`. Do not refund a token on failure; Chrome does not. The 500ms constant alone is not safe against the fixed window.
3. Hide the picker overlay around the capture, with a ref count so overlapping picks cannot restore it early. Restore in `finally`, including on skip/failure.
4. Keep N=1 behavior unchanged: if the window is momentarily empty at the first pick of a set, wait for the next token (bounded by the window) instead of skipping; later picks in the same burst skip. The existing optional-screenshot path, 4-shot cap, and 1.5MB limit already cover the rest.
5. Send one message per picked element so the capture happens while the click-time frame is current. A single message at finish cannot recover earlier scroll positions. `pending` must merge by element id/index, not overwrite by completion order; finish must await all in-flight captures before submit.
6. Do not rely on the user-gesture quota bypass for a message-driven capture.

## What the plan must test

- Four `captureFor` calls at 0/100/200/300ms: at most 2 `captureTab` calls, no `sleep`, the rest `null`.
- Three calls at 0/500/1000ms: the third is not allowed by the same 1-second window (match Chrome's `> expiration` reset, not `>=`); assert no quota rejection.
- A lone pick with a fresh window always captures; a lone pick with an empty window waits for the reset and still captures (N=1 parity).
- A failed API call spends its token and does not retry immediately; an invisible tab spends the local slot and keeps the element without a shot.
- Four picks completing out of order still produce the ordered set, with no lost element and correct final `pending`.
- Submit waits for all captures; no capture writes `pending` after the feedback is queued.
- Browser check: four rapid Cmd/Ctrl+clicks produce no quota error in the service-worker console; captured crops contain no highlight border/wash; a skipped pick leaves no overlay stuck hidden.
- Browser check: pick at one scroll position, scroll, pick again. Each crop matches its own element at its own scroll position; a stale box from the other position is never used.

## Unconfirmed

- Whether a content-script click's user activation reaches the background and triggers `ShouldSkipQuotaLimiting`. The source shows the bypass exists; this path was not measured. Do not rely on it.
- Exact behavior at the 1-second boundary. Source uses `> expiration`; runtime timing may differ by milliseconds, so leave margin or use a token bucket.
- Whether the picker overlay appears in `captureVisibleTab` output. Expected by construction; not runtime-checked.
- Behavior when the window is minimized or fully occluded. `isSenderTabVisible` checks the active tab in the window, not window focus (`messages.ts:81-89`); capture failure is caught into `null`.

## Sources

- Chrome Tabs API, `captureVisibleTab` and `MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND`: https://developer.chrome.com/docs/extensions/reference/api/tabs#method-captureVisibleTab
- Chrome Runtime API, `lastError`: https://developer.chrome.com/docs/extensions/reference/api/runtime#property-lastError
- Chromium `tabs_api.cc` (quota heuristic, user-gesture skip): https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/extensions/api/tabs/tabs_api.cc
- Chromium `quota_service.cc` / `quota_service.h` (fixed window, error text): https://chromium.googlesource.com/chromium/src/+/main/extensions/browser/quota_service.cc
- Chromium API schema (quota value 2): https://chromium.googlesource.com/chromium/src/+/main/chrome/common/extensions/api/tabs.json
- Repo: `lib/picker/screenshot.ts`, `lib/picker/messages.ts`, `lib/picker/read.ts`, `lib/picker/session.ts`, `lib/picker/limits.ts`, `lib/composer/element-submission.ts`, `lib/storage/pending.ts`
