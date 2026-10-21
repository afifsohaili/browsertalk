# 015c: Multi-pick selection (N>1)

**What to build:** Cmd/Ctrl+click accumulates up to five elements on the current page. Numbered badges and outlines; a bottom-centre count pill with Clear; release Cmd/Ctrl, Enter, or the fifth pick opens the composer with the full set. Modifier-click toggles; blur and any route change clear and disarm; Escape and Clear disarm. The composer and queue are already set-aware from 015b.

**Owner decisions (2026-10-21):** [Multi-pick loop](issues/02-pick-loop.md), [Visual affordance](issues/03-visual-affordance.md). Visual source: `prototype.html`, variant A.

**Blocked by:** 015b.

**Status:** done.

## Checklist

- [x] `lib/picker/selection.ts` (new): pure state for add/toggle/cap/finish/clear; tests.
- [x] `lib/picker/session.ts`: one set id created at arm and reused by every per-element feedback; Cmd/Ctrl clicks add, toggle, stay armed; plain click with no set adds and finishes; plain click with a set finishes without adding; release/Enter/fifth pick finish; blur clears; numbered badges and selected outlines; bottom-centre count pill (`N selected · release ⌘/Ctrl to comment`) with Clear; tests for the pure parts + live CDP.
- [x] Route watcher: patch `popstate`, `hashchange`, `pushState`, `replaceState`; clear and disarm on any route change; keep the watcher alive through the composer; restore history methods on cleanup; tests/live.
- [x] `lib/picker/protocol.ts` + `lib/picker/messages.ts`: real `elementIndex` per picked element; one message per element; guards; tests.
- [x] `lib/picker/facts.ts`: optional `index` on `PickerElementCapture` (prompt ignores it); `lib/storage/pending.ts`: upsert by index and sort, so out-of-order captures keep pick order; out-of-order tests.
- [x] `lib/composer/element-submission.ts`: track all elements; `submit` awaits all; fail on the first capture error; tests.
- [x] Chip × must also remove the element from the background pending (new `composer/remove` request with set id + index, or equivalent), so the queue count matches the remaining set; tests. The 015b local-only remove is not enough at N>1.
- [x] Add `picker/cleared` (set id) to clear the background pending on cancel, blur, or route; tests.
- [x] `entrypoints/picker.content.ts`: wire `onPick` → `track(feedback, index)`, `onFinish` → `openSet(elements, anchor)`, and clear notifications.
- [x] `bun run compile` + `bun run test` pass; one conventional commit. Live CDP smoke deferred to 015f: the available headless Chrome loaded the built service worker but never injected the content script, so the loop could not be driven.

## Acceptance

- Hold Cmd/Ctrl, click 3 elements: badges 1–3, `3 selected · release ⌘/Ctrl to comment`; release opens the composer with 3 chips.
- One comment sends one feedback with 3 elements; the pending set is complete; no partial send.
- Plain click with no set sends 1; the fifth modifier-click opens the composer immediately; there is no sixth click.
- Modifier-click a selected element toggles it off; chip × removes one and the remaining set still sends; removing all shows the empty state.
- Blur and any route change clear and disarm; Escape and Clear disarm; an open composer closes on a route change.
- Single-element behavior is unchanged.

## Outcome

**Shipped.** One armed set with a single capture id, up to five elements, picked with Cmd/Ctrl+click.

- `lib/picker/selection.ts`: pure add/toggle/cap/clear state and the click rule (`add`, `add-and-finish`, `remove`, `finish`, `ignore`).
- `lib/picker/platform.ts`: `⌘`/`Ctrl` label and the count-pill copy.
- `lib/picker/route.ts`: patches `pushState`/`replaceState`, listens to `popstate`/`hashchange`, restores every original on stop.
- `lib/picker/session.ts`: one set id at arm, per-element feedback reusing it; stays armed on modifier adds, toggles a selected element off; plain click adds-and-finishes with no set, finishes with a set; release, Enter, or the fifth pick opens the composer; blur, Escape, Clear, and any route change clear and disarm; numbered badges, selected outlines, hover label, bottom-centre count pill with Clear. The watcher survives `finish()` and stops on `end()` (composer close/send), clear, and route.
- `lib/picker/facts.ts`: optional `index` on `PickerElementCapture`, guarded, ignored by the prompt.
- `lib/storage/pending.ts`: upsert by pick index and sort on every merge; `removePendingElement` splices one element and returns the remaining count, dropping the entry at zero. Capture work is serialised per tab (`queuePendingCapture`), and clears/removals wait on that tail.
- `lib/picker/protocol.ts`/`messages.ts`: `picker/captured` carries the real index, one message per element; new `picker/cleared` clears only the named set and needs the sender tab; `notifyCleared`.
- `lib/composer/protocol.ts`/`messages.ts`: new `composer/remove` (`captureID` + `index`) returns `elementCount`; no consent needed for a local removal.
- `lib/composer/element-submission.ts`: tracks every element by pick index, awaits all on submit, fails on the first capture error; `remove` calls the background first and keeps the entry when it refuses; `clear` forgets a finished set.
- `lib/composer/session.ts`: chips carry the pick index; × awaits the background removal and only then drops the chip; failed removal shows the error; `onClose` hook; `openSet({ elements, anchor })`.
- `entrypoints/picker.content.ts`: `onPick` → `track`, `onFinish` → `openSet` with ordered labels, `onRemove`/`onClear` wiring, `notifyCleared` on cancel, blur, and route; arming closes a stale composer.

**Tests.** 862 pass across 56 files; `bun run compile` and `bun run build` clean.

- New: `selection.test.ts` (10), `platform.test.ts` (3), `route.test.ts` (5), `composer/multi-pick.test.ts` (5).
- Extended: `pending.test.ts` (out-of-order sort, index on capture, remove/report/zero), `picker/protocol.test.ts` (index guard, clear guard), `picker/messages.test.ts` (out-of-order merge, clear by set, newer set untouched, no-tab clear, in-flight capture after clear, `notifyCleared`), `composer/protocol.test.ts` (remove guard/result), `composer/messages.test.ts` (remove + count + refusals), `composer/element-submission.test.ts` (out-of-order track, background-first removal, refused removal keeps the chip, clear).

**Divergences.**

- Pick indices are stable per pick (a counter reset at arm), not positional. Removal never reindexes, a re-pick after a toggle-off gets a fresh index, and out-of-order or in-flight captures still sort correctly. The final array order equals pick order.
- Modifier-toggle during picking also sends `composer/remove`, because a deselected element must leave the pending set before the queue count is checked.
- Capture operations are serialised per tab. A pending capture always lands before a clear or a removal for its set, so the queue count cannot drift from the screenshots still in flight. Not in the ticket; added to keep the count honest.
- The route watcher lives in `lib/picker/route.ts` with injectable history/listeners so it is unit-testable without a DOM.
- `ComposerSetElement` gained `index`, and `openSet` now takes `{ elements, anchor }`. The composer layout is unchanged beyond what N chips already needed.

**Live check.** Not run. Headless Chrome 155 loaded the built extension's service worker but never injected `content-scripts/picker.js` into the local test page (no isolated execution context after load and reload), so the loop could not be driven. The full live smoke stays with 015f.

**Sha:** recorded by 015f.
