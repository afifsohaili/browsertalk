# 016d: Structural seams

**What to build:** Split the two large modules and the mixed picker messages module, with the 016b tests as the safety net.

**Findings:**

- `picker/messages.ts` mixes content senders with the background handler and storage writes.
- `picker/session.ts` (470 lines) and `composer/session.ts` (332) mix state, DOM, and styling.
- `picker/wiring.ts` still patches `withOverlayHidden` / `endSet` after construction (temporal coupling).

**Blocked by:** 016c.

**Status:** done.

## Checklist

- [x] Split `lib/picker/messages.ts` into client senders and the background handler (e.g. `messages.ts` + `handler.ts`); update `entrypoints/background.ts` and tests.
- [x] Extract the picker overlay/pill DOM from `picker/session.ts` into a module; the session keeps state/event wiring.
- [x] Extract the composer DOM builder from `composer/session.ts`; the session keeps state/queue wiring.
- [x] Remove the lifecycle-callback patching in `wiring.ts` via explicit handles or a controller; no `let` callbacks assigned after construction.
- [x] `bun run compile` + `bun run test` pass; one conventional commit.

## Acceptance

- `picker/messages.ts` has one layer.
- `picker/session.ts` and `composer/session.ts` are state/wiring, not DOM builders.
- No post-construction callback patching.
- All 016b tests pass unchanged or with mechanical import updates.

## Outcome

Shipped:

- `lib/picker/messages.ts` is client senders only (34 lines): `requestArmPicker`, `notifyCaptured`, `notifyCleared`. The background layer moved to `lib/picker/handler.ts` (205): `respondToPickerRequest`, `registerPickerMessageHandler`, `registerPickerTriggers`, `armPickerOnActiveTab`, `armPickerOnTab`, the screenshotter and capture budget, and the pending-storage writes. `entrypoints/background.ts`, `element-set.test.ts`, and `multi-pick.test.ts` now import the handler.
- `lib/picker/overlay.ts` (246): overlay host, hover box and label, selected boxes with badges, count pill, hidden holds, and the crosshair style. `picker/session.ts` keeps pick state, event listeners, route watch, and cursor save/restore (471 → 262 lines).
- `lib/composer/dom.ts` (211): composer host, count line, chips, empty state, textarea, error line, queue row, confirmation styling, and repositioning. `composer/session.ts` keeps entries, the controller, the confirmation timer, and keyboard wiring (332 → 168 lines). `COMPOSER_HOST_ID` now lives in `dom.ts`; `renderComposerChips` takes the remove callback as a parameter.
- `picker/wiring.ts` builds `submission`, `composer`, and `session` in that order and calls `session.withOverlayHidden` / `session.end` through the `const` handles inside callbacks. `let withOverlayHidden` and `let endSet` are gone; nothing is assigned after construction.

Tests: `bun run compile` pass; `bun run test` 65 files / 962 tests pass; `bun run build` pass (chrome-mv3). Test edits are imports only (`PICKER_OVERLAY_ID` / `PICKER_COUNT_ID` from `overlay`, `COMPOSER_HOST_ID` from `dom`, handler functions from `handler`); no assertion changed.

Divergences: none. No split reverted.

sha recorded by 016e.
