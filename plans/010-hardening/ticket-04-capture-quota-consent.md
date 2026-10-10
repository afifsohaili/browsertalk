# 010-04: Capture scoping, quota budgets, consent, staleness

**What to build:** Fix review findings 5, 8, 9, and 12: pending picks and captures are tab-scoped, storage quotas are budgeted with a recovery path, consent is enforced at delivery time, and stale async results can never resurrect old targets.

**Blocked by:** 010-03 — Serialized storage + admission reliability.

**Status:** done · df64ba9

- [x] Pending picks keyed by (tab, capture id); submissions rejected after a failed capture; active tab verified against the sender before capture; only the consumed capture is cleared
- [x] Byte budgets for screenshots and the outbox; quota errors offer screenshot-free queueing; incoming data URLs validated (type, length); errors while recording errors are surfaced, not swallowed
- [x] Consent re-checked immediately before remote admission and before persisting delayed captures; blocked items stay queued with a clear error
- [x] Generation checks discard stale async results (connection status, target, project list); binding uses the origin captured when project selection opened
- [x] Runtime protocol validation (required fields, project member shapes) with tests
- [x] `bun run compile` + full suite pass; one conventional commit; plans updated

Details: `/tmp/opencode/review-pre-009.md` findings 5, 8, 9, 12; coverage gap 5.

## Outcome

Shipped in `df64ba9` (`fix(capture): tab-scoped picks, quota budgets, delivery-time consent`). `bun run compile`, `bun run test` (47 files, 550 tests), and `bun run build` pass.

**Shipped**

- Tab-scoped picks: `storage.session` keys are `pending.feedback.<tabId>`; `getPendingFeedback(tabId)` / `clearPendingFeedback(tabId, captureID)` clear only when the stored capture id matches the consumed one. The composer queue request carries `captureID` (required for element mode), `respondToComposerRequest` takes `{ tabId }` from `sender.tab`, and a mismatch or missing pick is refused with `No picked element to comment on`. Page-mode submits clear only the sending tab's stale pick. A `tabs.onRemoved` listener drops the closed tab's pick.
- Capture truthfulness: `createElementSubmission` (new `lib/composer/element-submission.ts`, wired in `entrypoints/picker.content.ts`) tracks the latest capture, awaits it before submitting, and refuses submission when the capture failed; the capture id rides the request. The screenshotter takes a `ScreenshotRequest { windowId, isVisible }` and re-checks that the sender tab is the window's visible tab immediately before `captureVisibleTab` (after the 500ms spacing sleep), so a tab switch mid-capture skips the screenshot instead of grabbing another page.
- Quota budgets: `lib/picker/limits.ts` holds `MAX_SCREENSHOT_BYTES` (1.5MB raw) and `MAX_SCREENSHOT_DATA_URL_CHARS` (2,000,064); `isImageDataUrl` requires a bounded base64 `png|jpeg|webp` data URL and is used by `isPickerFeedback`/`isOutboxItem`, so incoming and stored screenshots are type- and length-checked. `lib/storage/budgets.ts` holds `MAX_OUTBOX_BYTES` (5,000,000 JSON chars), `outboxSize`, `OutboxFullError`, and `isQuotaExceeded`; `appendToOutbox` rejects appends past the budget. On a budget or browser quota rejection the composer retries without the screenshot (`withoutScreenshot`), returns `screenshotDropped: true`, and the composer shows `Queued without the screenshot — storage is full`. With nothing to drop the error is returned and the pick stays.
- Error recording: `recordError` logs `could not record the send error` and still returns the outcome; the background dispatcher logs unexpected send failures instead of swallowing them.
- Consent at delivery: `deliver` blocks non-admitted items before the session lock; `admit` re-checks immediately before `sendFeedback`. Items already admitted still commit. `picker/messages.ts` re-checks consent after the screenshot await, before persisting. Blocked items stay queued with `CONSENT_REQUIRED_ERROR`.
- Staleness guards: `useConnection` keeps a generation, discards superseded status/onboarding pairs, and refreshes on `settings.backendId` / `settings.serverUrl` storage changes. `usePanel` discards superseded target reads and project lists (`targetGeneration` / `projectsGeneration`; `closeProjects` invalidates and resets loading), binds with the `projectsOrigin` captured at open time, and refuses when no list is open. Rollover guards by origin (see Divergences).
- Protocol validation: `isConnectionRequest` requires `code` for pair and `origin` + `projectDirectory` for bind; `isProject` member-checks `listProjects` results in `isProjectsResult` and again in `listServerProjects` (`The server sent a project list we could not read`).
- Tests: two-tab interleaved picks and captures; replaced-capture and failed-capture refusals; sender-tab visibility skip (unit + screenshotter); screenshot drop on a full outbox and the no-screenshot error path; data URL type/length rejection; consent revocation mid-connection-queue, mid-session-resolve, and mid-screenshot-capture; stale connection status, target read, and project list discards; captured-origin binding; malformed requests/projects.

**Divergences / decisions**

- `wxt.config.ts` is unchanged: no `unlimitedStorage` permission. The ticket asked for budgets plus a recovery path, and budgets keep the extension under the 10MB local quota without a new install permission.
- "Offer screenshot-free queueing" is implemented as automatic drop-and-retry with a composer notice rather than an interactive prompt; the composer has no secondary confirm affordance.
- Outbox budget is measured as `JSON.stringify(items).length` (5,000,000 chars, half the 10MB quota, leaving headroom for sent/sessions/settings).
- `newSession` guards with `target.value?.origin !== origin` rather than a generation: the rollover's own storage write fires an `onChanged` refresh, and a monotonic guard would discard the rollover's own result. A same-origin refresh reads the fresh session from storage anyway; a different origin wins.
- The consent check before admission sits after session resolution, so a revocation mid-resolve can still create the session before the send is blocked (tested). The feedback itself is never transmitted.
- Choosing without an open list now refuses with `No page to target` (the origin capture is `null`); previously it read whatever `target.value` held.
- `clearPendingFeedback(tabId)` on tab removal is storage hygiene added beyond the review text; per-tab keys would otherwise accumulate screenshots in `storage.session`.

**Pending**

- Real Chrome behavior stays unconfirmed: MV3 worker lifetime around capture/queue, the actual `captureVisibleTab` visible-tab semantics, and live quota rejection shapes were exercised only through `fakeBrowser` and injected fakes.
- No live server smoke: consent-blocked retry against a real opencode session, and the composer notice rendering in a real browser, are unverified.
