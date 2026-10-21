# 015b: Element-set composer plumbing (N=1)

**What to build:** Make the composer and queue set-aware while the picker still sends one element. The composer renders one chip, the queue requires the set count, and the background merges pending elements by index. This is the shippable N=1 step before multi-pick.

**Owner decisions (2026-10-21):** [Data/prompt](issues/01-data-and-prompt.md), [Visual affordance](issues/03-visual-affordance.md). The composer is variant A (anchored card, chips, textarea, Queue); 015c unlocks N>1.

**Blocked by:** 015a.

**Status:** done.

## Checklist

- [x] `lib/picker/protocol.ts` + `lib/picker/messages.ts`: `picker/captured` carries `elementIndex` (0 for now); guards; tests.
- [x] `lib/storage/pending.ts`: `mergePendingElement(tabId, feedback, index)` upserts by index, sorted, initializes on the first; tests.
- [x] `lib/composer/element-submission.ts`: track by index; `remove(index)`; `submit` awaits all tracked captures and sends `elementCount`; tests.
- [x] `lib/composer/protocol.ts` + `lib/composer/messages.ts`: `composer/queue` gains `elementCount`; reject an incomplete set; tests.
- [x] `lib/composer/session.ts`: `openSet(elements, anchor)` anchored card with chips + ×, empty state, textarea focus, Queue; chip labels from `PickerElementFacts`; `queue` passes the remaining count; tests for the pure label helper, live smoke for the DOM.
- [x] `entrypoints/picker.content.ts`: `onPick` → `track(feedback, 0)`; open the composer with one chip; single-element behavior preserved.
- [x] `bun run compile` + `bun run test` pass; one conventional commit.

## Acceptance

- A single pick opens the anchored card with one chip; × shows the empty state and disables Queue.
- Sending queues one outbox item with `elements.length === 1`; the prompt is compact and attachments are unchanged.
- `composer/queue` rejects a request whose `elementCount` does not match the pending set.
- N>1 is not selectable yet; N=1 behavior is otherwise unchanged.

## Outcome

**Shipped.**

- `picker/captured` carries `elementIndex`, checked by `isElementIndex` (whole number from 0). `notifyCaptured(feedback, index)`; the background merges with `mergePendingElement(tabId, feedback, index, fallback?)`, keeping the quota fallback for the screenshot.
- `mergePendingElement` initializes the tab set on the first pick, upserts by index (clamped so the set stays dense), keeps the set identity (`id`, `capturedAt`, `page`) from the first pick, and starts a new set when the feedback id changes. A newer set written while a quota fallback is in flight is kept.
- `ElementSubmission`: `track(feedback, index)`, `remove(index)`, `submit(comment, page, elementCount)`. Submits the lowest remaining index's `captureID`, awaits every tracked capture in index order, fails on the first capture error, and sends `elementCount`.
- `composer/queue` requires `elementCount` (whole number from 1); the handler rejects a count that differs from the pending set with `The element set changed — pick again`.
- `ComposerSession.openSet(elements, anchor)`: anchored card variant A with a count line, chips with ×, empty state (`No elements left. Close and pick again.`), focused textarea, Queue disabled while empty or busy. `queue(comment, elementCount)`; `remove(index)` option. `openElement` is gone; `openSet` replaces it.
- `entrypoints/picker.content.ts`: one pick → `track(feedback, 0)` + `openSet([{ element, label }], element)`. Disarm on pick and N=1 behavior unchanged.

**Tests.** 52 files, 811 tests pass (`bun run test`); `bun run compile` clean; `bun run build` built chrome-mv3 (199.91 kB).

- Boundary spec: `lib/composer/element-set.test.ts` — one pick → pending merge → `composer/queue` → one outbox item with one element and the compact N=1 prompt; count mismatch rejected; invalid index rejected; page-only path unchanged.
- Unit: `mergePendingElement` (init, append, identity, upsert, clamp, new set, quota fallback, newer set kept), picker index guard and per-index merge, submission track/remove/await-all/first-error, `formatChipLabel` / `formatCountLabel` / `removeChip`.

**Live check:** deferred to 015f. The repo has no DOM test environment (node vitest, no jsdom/happy-dom), so `openSet`, chip ×, and the empty state are unverified in a real browser; the pure label, count, and removal helpers carry the unit coverage.

**Divergences.**

- The pure chip helpers live in `lib/composer/chips.ts` (`formatChipLabel`, `formatCountLabel`, `removeChip`) rather than `session.ts`, so they can be tested without a DOM.
- The pending set is identified by the feedback id, so **015c must reuse the set's `captureID` for later picks**. Today the picker mints a new id per click; a differing id starts a new set.
- Merges are upserts: an index that already landed is replaced. Pending holds no index metadata, so an out-of-order arrival cannot insert before a landed element. **015c must keep merge order aligned with pick order** (merge before awaiting the screenshot, or queue merges per tab).
- A chip removal before submit lowers `elementCount` while the pending set keeps the removed element, so with N>1 the queue guard rejects the send. Harmless at N=1 (the empty set disables Queue); 015c must send the removed indices or drop them background-side.
- `elementIndex` is required; there is no legacy default for a content script older than the background.

**Commit:** sha recorded by 015f.

